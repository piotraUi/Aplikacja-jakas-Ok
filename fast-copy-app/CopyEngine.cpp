#include "CopyEngine.h"

#include <filesystem>
#include <algorithm>
#include <sstream>

namespace fs = std::filesystem;

namespace {

// Above this size a file is copied with COPY_FILE_NO_BUFFERING, which
// bypasses the system cache. That matters for big files (no cache
// eviction storm, no "fast then it crawls" effect) but actively hurts
// throughput on lots of small files because of the extra alignment
// overhead per open, so small files stay on the normal buffered path.
constexpr uint64_t kUnbufferedThreshold = 64ULL * 1024 * 1024;

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

} // namespace

CopyEngine::CopyEngine() = default;

CopyEngine::~CopyEngine() {
    Cancel();
    if (driver_.joinable()) driver_.join();
}

void CopyEngine::Start(std::vector<std::wstring> sources, std::wstring destRoot, unsigned threadCount) {
    if (running_.exchange(true)) return; // already running
    threadCount = std::clamp(threadCount, 1u, 32u);
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

void CopyEngine::RunEnumerationAndCopy(std::vector<std::wstring> sources, std::wstring destRoot, unsigned threadCount) {
    stats_.enumerating.store(true);

    // Pass 1: walk every source tree, create the mirrored directory
    // structure under destRoot up front (cheap, single-threaded), and
    // collect every file to copy. Doing directories first means the
    // worker threads below never have to coordinate about mkdir races.
    std::vector<FileTask> allFiles;
    uint64_t totalBytes = 0;

    for (const auto& srcStr : sources) {
        if (cancelRequested_.load()) break;

        fs::path srcRoot(srcStr);
        std::error_code ec;
        if (!fs::exists(srcRoot, ec) || !fs::is_directory(srcRoot, ec)) {
            LogError(L"Pominięto (nie jest folderem): " + srcStr);
            continue;
        }

        fs::path destForThisSource = fs::path(destRoot) / srcRoot.filename();
        CreateDirectoryW(ToLongPath(destForThisSource.wstring()).c_str(), nullptr);

        fs::recursive_directory_iterator it(
            srcRoot,
            fs::directory_options::skip_permission_denied,
            ec);
        fs::recursive_directory_iterator end;

        for (; it != end && !ec; it.increment(ec)) {
            if (cancelRequested_.load()) break;

            const fs::directory_entry& entry = *it;
            std::error_code entryEc;
            fs::path relative = fs::relative(entry.path(), srcRoot, entryEc);
            if (entryEc) continue;
            fs::path destPath = destForThisSource / relative;

            if (entry.is_directory(entryEc)) {
                CreateDirectoryW(ToLongPath(destPath.wstring()).c_str(), nullptr);
            } else if (entry.is_regular_file(entryEc)) {
                uint64_t size = 0;
                std::error_code sizeEc;
                size = entry.file_size(sizeEc);
                allFiles.push_back(FileTask{entry.path().wstring(), destPath.wstring()});
                totalBytes += size;
                stats_.totalFiles.fetch_add(1);
                stats_.totalBytes.store(totalBytes);
            }
        }
        if (ec) {
            std::string msg = ec.message();
            LogError(L"Błąd przeglądania " + srcStr + L": " + std::wstring(msg.begin(), msg.end()));
        }
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
        if (ok) {
            stats_.copiedFiles.fetch_add(1);
        } else {
            stats_.failedFiles.fetch_add(1);
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
