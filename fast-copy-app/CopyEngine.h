#pragma once

#include <windows.h>
#include <atomic>
#include <string>
#include <vector>
#include <mutex>
#include <deque>
#include <thread>

// How thoroughly a copied file is checked against its source afterwards.
// This matters when the copy is a one-shot backup before something
// destructive (a factory reset, deleting the source) — "the file count
// matches" is not the same guarantee as "every byte matches".
enum class VerifyMode {
    None,      // no post-copy check beyond CopyFileEx's own success/failure
    SizeOnly,  // compare destination file size to source (cheap, catches truncation)
    FullHash,  // compare SHA-256 of source and destination (catches silent corruption too, but reads every file twice)
};

// Multithreaded folder-copy engine.
//
// Explorer copies one file at a time and spends most of its time on
// per-file overhead (open/attributes/ACL/progress-UI) rather than on the
// disk transfer itself. This engine parallelizes that per-file overhead
// across worker threads and skips Explorer's own bookkeeping, which is
// where most of the wall-clock time goes when copying many small files.
class CopyEngine {
public:
    struct Stats {
        std::atomic<uint64_t> totalFiles{0};
        std::atomic<uint64_t> totalBytes{0};
        std::atomic<uint64_t> copiedFiles{0};
        std::atomic<uint64_t> copiedBytes{0};
        std::atomic<uint64_t> failedFiles{0};
        std::atomic<uint64_t> verifiedFiles{0};
        std::atomic<uint64_t> mismatchFiles{0};
        std::atomic<bool> enumerating{true};
        std::atomic<bool> finished{false};
    };

    CopyEngine();
    ~CopyEngine();

    // Starts the copy on a background thread. sources are the folders the
    // user picked; each is copied INTO destRoot as destRoot\<folder name>\...
    // Safe to call once per instance.
    void Start(std::vector<std::wstring> sources, std::wstring destRoot, unsigned threadCount,
               VerifyMode verifyMode = VerifyMode::SizeOnly);

    // Requests cancellation; safe to call from the UI thread at any time.
    void Cancel();

    bool IsCancelled() const { return cancelRequested_.load(); }

    // Snapshot of progress counters; safe to poll from the UI thread.
    const Stats& GetStats() const { return stats_; }

    // Human-readable error lines collected during the copy (thread-safe).
    std::vector<std::wstring> TakeErrors();

    bool IsRunning() const { return running_.load(); }

private:
    struct FileTask {
        std::wstring src;
        std::wstring dst;
    };

    void RunEnumerationAndCopy(std::vector<std::wstring> sources, std::wstring destRoot, unsigned threadCount);
    void WorkerLoop();
    bool CopyOneFile(const FileTask& task);
    bool VerifyOneFile(const FileTask& task);
    void LogError(const std::wstring& msg);

    VerifyMode verifyMode_ = VerifyMode::SizeOnly;

    std::thread driver_;
    std::vector<std::thread> workers_;

    std::mutex queueMutex_;
    std::deque<FileTask> queue_;
    std::atomic<bool> queueClosed_{false};

    std::mutex errorMutex_;
    std::vector<std::wstring> errors_;

    std::atomic<bool> cancelRequested_{false};
    std::atomic<bool> running_{false};
    BOOL cancelFlagForApi_ = FALSE;

    Stats stats_;
};
