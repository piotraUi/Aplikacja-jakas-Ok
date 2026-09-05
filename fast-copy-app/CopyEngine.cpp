#include "CopyEngine.h"

#include <bcrypt.h>

#include <filesystem>
#include <algorithm>
#include <sstream>
#include <vector>
#include <deque>
#include <condition_variable>

#pragma comment(lib, "bcrypt.lib")

namespace fs = std::filesystem;

namespace {

// Above this size a file is copied with COPY_FILE_NO_BUFFERING, which
// bypasses the system cache. That matters for big files (no cache
// eviction storm, no "fast then it crawls" effect) but actively hurts
// throughput on lots of small files because of the extra alignment
// overhead per open, so small files stay on the normal buffered path.
constexpr uint64_t kUnbufferedThreshold = 64ULL * 1024 * 1024;

// Directory listing is latency-bound (one syscall/round-trip per folder),
// not CPU-bound, so a handful of enumeration threads is enough to hide
// that latency by overlapping many folders' worth of it at once. This is
// deliberately independent from the copy thread-count setting.
constexpr unsigned kEnumThreads = 6;

// Turns an absolute Windows path into its \\?\ form so CreateDirectoryW/
// CopyFileExW aren't limited by MAX_PATH (260 chars) the way Explorer is.
std::wstring ToLongPath(const std::wstring& path) {
    if (path.size() >= 4 && path.compare(0, 4, L"\\\\?\\") == 0) {
        return path;
    }
    if (path.size() >= 2 && path[0] == L'\\' && path[1] == L'\\') {
        // UNC path: \\server\share\... -> \\?\UNC\server\share\...
        return L"\\\\?\\UNC\\" + path.substr(2);
    }
    return L"\\\\?\\" + path;
}

// Reparse points cover both symlinks AND NTFS junctions/mount points (the
// latter are common in Windows user profiles and aren't guaranteed to be
// recognized by std::filesystem::is_symlink on every standard library).
// Checking the raw attribute directly is the reliable way to catch both,
// which matters because either can point back up the tree and turn a
// recursive walk into an infinite loop.
bool IsReparsePoint(const std::wstring& longPath) {
    DWORD attrs = GetFileAttributesW(longPath.c_str());
    if (attrs == INVALID_FILE_ATTRIBUTES) return false;
    return (attrs & FILE_ATTRIBUTE_REPARSE_POINT) != 0;
}

std::wstring GetLastErrorMessage(DWORD err) {
    LPWSTR buf = nullptr;
    DWORD len = FormatMessageW(
        FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS,
        nullptr, err, MAKELANGID(LANG_NEUTRAL, SUBLANG_DEFAULT), reinterpret_cast<LPWSTR>(&buf), 0, nullptr);
    std::wstring msg = len ? std::wstring(buf, len) : L"";
    if (buf) LocalFree(buf);
    while (!msg.empty() && (msg.back() == L'\n' || msg.back() == L'\r')) msg.pop_back();
    return msg;
}

// SHA-256 of a file via CNG (BCrypt), read in 1 MB chunks so memory use
// doesn't scale with file size. Returns false on any I/O or API error.
bool ComputeSha256(const std::wstring& path, std::vector<BYTE>& outHash) {
    std::wstring longPath = ToLongPath(path);
    HANDLE file = CreateFileW(longPath.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr,
                               OPEN_EXISTING, FILE_FLAG_SEQUENTIAL_SCAN, nullptr);
    if (file == INVALID_HANDLE_VALUE) return false;

    BCRYPT_ALG_HANDLE alg = nullptr;
    bool ok = false;
    if (BCryptOpenAlgorithmProvider(&alg, BCRYPT_SHA256_ALGORITHM, nullptr, 0) == 0) {
        DWORD hashObjLen = 0, cbData = 0;
        BCryptGetProperty(alg, BCRYPT_OBJECT_LENGTH, reinterpret_cast<PUCHAR>(&hashObjLen), sizeof(DWORD), &cbData, 0);
        DWORD hashLen = 0;
        BCryptGetProperty(alg, BCRYPT_HASH_LENGTH, reinterpret_cast<PUCHAR>(&hashLen), sizeof(DWORD), &cbData, 0);

        std::vector<BYTE> hashObj(hashObjLen ? hashObjLen : 256);
        BCRYPT_HASH_HANDLE hash = nullptr;
        if (BCryptCreateHash(alg, &hash, hashObj.data(), static_cast<ULONG>(hashObj.size()), nullptr, 0, 0) == 0) {
            std::vector<BYTE> buffer(1 << 20);
            DWORD bytesRead = 0;
            BOOL readOk = TRUE;
            bool hashError = false;
            while ((readOk = ReadFile(file, buffer.data(), static_cast<DWORD>(buffer.size()), &bytesRead, nullptr)) && bytesRead > 0) {
                if (BCryptHashData(hash, buffer.data(), bytesRead, 0) != 0) {
                    hashError = true;
                    break;
                }
            }
            if (readOk && !hashError) {
                outHash.assign(hashLen, 0);
                ok = BCryptFinishHash(hash, outHash.data(), hashLen, 0) == 0;
            }
            BCryptDestroyHash(hash);
        }
        BCryptCloseAlgorithmProvider(alg, 0);
    }
    CloseHandle(file);
    return ok;
}

} // namespace

CopyEngine::CopyEngine() = default;

CopyEngine::~CopyEngine() {
    Cancel();
    if (driver_.joinable()) driver_.join();
}

void CopyEngine::Start(std::vector<std::wstring> sources, std::wstring destRoot, unsigned threadCount,
                        VerifyMode verifyMode) {
    if (running_.exchange(true)) return; // already running
    threadCount = std::clamp(threadCount, 1u, 32u);
    verifyMode_ = verifyMode;
    driver_ = std::thread([this, sources = std::move(sources), destRoot = std::move(destRoot), threadCount]() mutable {
        RunEnumerationAndCopy(std::move(sources), std::move(destRoot), threadCount);
    });
}

void CopyEngine::Cancel() {
    cancelRequested_.store(true);
    cancelFlagForApi_ = TRUE;
}

std::vector<std::wstring> CopyEngine::TakeErrors() {
    std::lock_guard<std::mutex> lock(errorMutex_);
    std::vector<std::wstring> out;
    out.swap(errors_);
    return out;
}

void CopyEngine::LogError(const std::wstring& msg) {
    std::lock_guard<std::mutex> lock(errorMutex_);
    errors_.push_back(msg);
}

namespace {
struct DirTask {
    fs::path src;
    fs::path dst;
};
} // namespace

void CopyEngine::RunEnumerationAndCopy(std::vector<std::wstring> sources, std::wstring destRoot, unsigned threadCount) {
    stats_.enumerating.store(true);

    // Pass 1: walk every source tree and create the mirrored directory
    // structure under destRoot, collecting every file to copy. This used
    // to be one thread doing a single recursive_directory_iterator; that
    // serializes on the latency of every folder listing. Instead this is
    // now a small BFS thread pool over folders: kEnumThreads threads pull
    // a folder off a shared queue, list just that folder (non-recursive),
    // queue any subfolders they find, and record files. Multiple folder
    // listings in flight at once hides most of that per-folder latency,
    // which is where the wall-clock time goes on trees with many folders.
    std::vector<FileTask> allFiles;
    std::mutex fileListMutex;

    std::mutex dirQueueMutex;
    std::condition_variable dirCv;
    std::deque<DirTask> dirQueue;
    std::atomic<long long> pendingDirs{0};

    for (const auto& srcStr : sources) {
        fs::path srcRoot(srcStr);
        std::error_code ec;
        if (!fs::exists(srcRoot, ec) || !fs::is_directory(srcRoot, ec)) {
            LogError(L"Pominięto (nie jest folderem): " + srcStr);
            continue;
        }
        fs::path destForThisSource = fs::path(destRoot) / srcRoot.filename();
        CreateDirectoryW(ToLongPath(destForThisSource.wstring()).c_str(), nullptr);

        dirQueue.push_back(DirTask{srcRoot, destForThisSource});
        pendingDirs.fetch_add(1);
    }

    auto enumWorker = [&]() {
        for (;;) {
            DirTask task;
            {
                std::unique_lock<std::mutex> lock(dirQueueMutex);
                dirCv.wait(lock, [&] { return !dirQueue.empty() || pendingDirs.load() == 0; });
                if (dirQueue.empty()) return; // pendingDirs == 0: nothing left anywhere
                task = std::move(dirQueue.front());
                dirQueue.pop_front();
            }

            if (!cancelRequested_.load()) {
                std::error_code ec;
                fs::directory_iterator it(task.src, fs::directory_options::skip_permission_denied, ec);
                fs::directory_iterator end;
                for (; it != end && !ec; it.increment(ec)) {
                    if (cancelRequested_.load()) break;

                    const fs::directory_entry& entry = *it;
                    std::error_code entryEc;
                    fs::path destPath = task.dst / entry.path().filename();

                    // Symlinks/junctions/reparse points (common in Windows user
                    // profiles, OneDrive, npm/pnpm) can point back up the tree
                    // and turn a naive recursive walk into an infinite loop —
                    // this is what made scanning hang forever. Skip them
                    // entirely rather than traversing, same as plain
                    // recursive_directory_iterator's default (non-follow)
                    // behavior that the old single-threaded scan relied on.
                    if (IsReparsePoint(ToLongPath(entry.path().wstring()))) {
                        LogError(L"Pominięto link/skrót (nie jest podążany, by uniknąć pętli): " + entry.path().wstring());
                        continue;
                    }

                    if (entry.is_directory(entryEc)) {
                        CreateDirectoryW(ToLongPath(destPath.wstring()).c_str(), nullptr);
                        {
                            std::lock_guard<std::mutex> lock(dirQueueMutex);
                            dirQueue.push_back(DirTask{entry.path(), destPath});
                            pendingDirs.fetch_add(1);
                        }
                        dirCv.notify_all();
                    } else if (entry.is_regular_file(entryEc)) {
                        std::error_code sizeEc;
                        uint64_t size = entry.file_size(sizeEc);
                        {
                            std::lock_guard<std::mutex> lock(fileListMutex);
                            allFiles.push_back(FileTask{entry.path().wstring(), destPath.wstring()});
                        }
                        stats_.totalFiles.fetch_add(1);
                        if (!sizeEc) stats_.totalBytes.fetch_add(size);
                    }
                }
                if (ec) {
                    std::string msg = ec.message();
                    LogError(L"Błąd przeglądania " + task.src.wstring() + L": " + std::wstring(msg.begin(), msg.end()));
                }
            }

            {
                std::lock_guard<std::mutex> lock(dirQueueMutex);
                pendingDirs.fetch_sub(1);
            }
            dirCv.notify_all();
        }
    };

    {
        std::vector<std::thread> enumWorkers;
        unsigned n = std::min<unsigned>(kEnumThreads, std::max<unsigned>(1, static_cast<unsigned>(sources.size()) * 2));
        for (unsigned i = 0; i < n; ++i) enumWorkers.emplace_back(enumWorker);
        for (auto& t : enumWorkers) t.join();
    }

    stats_.enumerating.store(false);

    // Pass 2: hand the file list to a small thread pool. Each thread just
    // pulls the next task and calls CopyFileExW; parallelizing this is
    // what actually buys the speedup over Explorer on many small files.
    {
        std::lock_guard<std::mutex> lock(queueMutex_);
        queue_.assign(allFiles.begin(), allFiles.end());
    }
    queueClosed_.store(true);

    if (!cancelRequested_.load() && !queue_.empty()) {
        workers_.reserve(threadCount);
        for (unsigned i = 0; i < threadCount; ++i) {
            workers_.emplace_back([this]() { WorkerLoop(); });
        }
        for (auto& t : workers_) {
            if (t.joinable()) t.join();
        }
        workers_.clear();
    }

    stats_.finished.store(true);
    running_.store(false);
}

void CopyEngine::WorkerLoop() {
    for (;;) {
        FileTask task;
        {
            std::lock_guard<std::mutex> lock(queueMutex_);
            if (queue_.empty()) return;
            task = std::move(queue_.front());
            queue_.pop_front();
        }
        if (cancelRequested_.load()) return;

        bool ok = CopyOneFile(task);
        if (!ok) {
            stats_.failedFiles.fetch_add(1);
            continue;
        }
        stats_.copiedFiles.fetch_add(1);

        if (verifyMode_ != VerifyMode::None) {
            if (VerifyOneFile(task)) {
                stats_.verifiedFiles.fetch_add(1);
            } else {
                stats_.mismatchFiles.fetch_add(1);
            }
        }
    }
}

bool CopyEngine::CopyOneFile(const FileTask& task) {
    std::error_code sizeEc;
    uint64_t size = fs::file_size(task.src, sizeEc);

    DWORD flags = COPY_FILE_NO_BUFFERING;
    if (sizeEc || size < kUnbufferedThreshold) {
        flags = 0;
    }

    std::wstring srcLong = ToLongPath(task.src);
    std::wstring dstLong = ToLongPath(task.dst);

    BOOL result = CopyFileExW(
        srcLong.c_str(), dstLong.c_str(),
        nullptr, nullptr,
        &cancelFlagForApi_,
        flags);

    if (!result && flags == COPY_FILE_NO_BUFFERING) {
        // Unbuffered copy can fail on some filesystems/redirected drives;
        // fall back to a normal buffered copy before giving up on the file.
        result = CopyFileExW(srcLong.c_str(), dstLong.c_str(), nullptr, nullptr, &cancelFlagForApi_, 0);
    }

    if (!result) {
        DWORD err = GetLastError();
        if (err == ERROR_REQUEST_ABORTED) return false; // user cancelled
        std::wstringstream ss;
        ss << task.src << L" -> " << task.dst << L": " << GetLastErrorMessage(err) << L" (kod " << err << L")";
        LogError(ss.str());
        return false;
    }

    if (!sizeEc) {
        stats_.copiedBytes.fetch_add(size);
    }
    return true;
}

bool CopyEngine::VerifyOneFile(const FileTask& task) {
    std::error_code srcEc, dstEc;
    uint64_t srcSize = fs::file_size(task.src, srcEc);
    uint64_t dstSize = fs::file_size(task.dst, dstEc);

    if (srcEc || dstEc) {
        LogError(L"Weryfikacja nieudana (brak dostępu): " + task.dst);
        return false;
    }
    if (srcSize != dstSize) {
        std::wstringstream ss;
        ss << L"Niezgodny rozmiar: " << task.dst << L" (źródło " << srcSize << L" B, kopia " << dstSize << L" B)";
        LogError(ss.str());
        return false;
    }
    if (verifyMode_ == VerifyMode::SizeOnly) {
        return true;
    }

    // FullHash: compare SHA-256 of both files. This re-reads everything
    // that was just written, so it roughly doubles I/O for the file — the
    // cost is worth it only when you need certainty the bytes are intact
    // (e.g. a one-shot backup before wiping the source).
    std::vector<BYTE> srcHash, dstHash;
    if (!ComputeSha256(task.src, srcHash) || !ComputeSha256(task.dst, dstHash)) {
        LogError(L"Weryfikacja SHA-256 nieudana (błąd odczytu): " + task.dst);
        return false;
    }
    if (srcHash != dstHash) {
        LogError(L"NIEZGODNY SKRÓT SHA-256 — plik uszkodzony przy kopiowaniu: " + task.dst);
        return false;
    }
    return true;
}
