// FastCopy — prosty, wielowątkowy zamiennik kopiowania z Eksploratora
// Windows dla wielu folderów naraz.
//
// Dlaczego jest szybszy niż Eksplorator przy kopiowaniu wielu plików:
//  - kopiuje wieloma wątkami naraz zamiast plik po pliku,
//  - nie liczy z góry całego drzewa dla paska postępu (procent liczy
//    z bieżących bajtów zamiast blokować start na "Discovering items..."),
//  - dla dużych plików używa nieskrytego I/O (COPY_FILE_NO_BUFFERING),
//    więc nie zapycha pamięci podręcznej systemu.
//
// Kompilacja: patrz README.md / CMakeLists.txt (MinGW-w64 lub MSVC).

#include <windows.h>
#include <commctrl.h>
#include <shobjidl.h>
#include <shlobj.h>

#include <memory>
#include <string>
#include <vector>
#include <sstream>
#include <iomanip>
#include <filesystem>
#include <algorithm>

#include "CopyEngine.h"

#pragma comment(lib, "comctl32.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "uuid.lib")

namespace fs = std::filesystem;

namespace {

enum ControlId : int {
    IDC_SRC_LIST = 101,
    IDC_BTN_ADD_SRC,
    IDC_BTN_REMOVE_SRC,
    IDC_BTN_CLEAR_SRC,
    IDC_EDIT_DST,
    IDC_BTN_PICK_DST,
    IDC_COMBO_THREADS,
    IDC_COMBO_VERIFY,
    IDC_BTN_COPY,
    IDC_BTN_CANCEL,
    IDC_PROGRESS,
    IDC_STATUS_TEXT,
    IDC_ERROR_LIST,
};

constexpr UINT_PTR IDT_PROGRESS_TIMER = 1;

// --- small formatting helpers ------------------------------------------------

std::wstring FormatBytes(uint64_t bytes) {
    static const wchar_t* units[] = {L"B", L"KB", L"MB", L"GB", L"TB"};
    double value = static_cast<double>(bytes);
    int unit = 0;
    while (value >= 1024.0 && unit < 4) {
        value /= 1024.0;
        ++unit;
    }
    std::wstringstream ss;
    ss << std::fixed << std::setprecision(unit == 0 ? 0 : 1) << value << L" " << units[unit];
    return ss.str();
}

std::wstring FormatElapsed(ULONGLONG ms) {
    ULONGLONG totalSec = ms / 1000;
    ULONGLONG m = totalSec / 60;
    ULONGLONG s = totalSec % 60;
    std::wstringstream ss;
    ss << m << L" min " << std::setw(2) << std::setfill(L'0') << s << L" s";
    return ss.str();
}

// --- folder picking via IFileOpenDialog -------------------------------------

bool PickFolders(HWND owner, bool allowMultiple, std::vector<std::wstring>& outPaths) {
    IFileOpenDialog* dialog = nullptr;
    HRESULT hr = CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&dialog));
    if (FAILED(hr) || !dialog) return false;

    DWORD options = 0;
    dialog->GetOptions(&options);
    options |= FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST;
    if (allowMultiple) options |= FOS_ALLOWMULTISELECT;
    dialog->SetOptions(options);

    bool gotAny = false;
    hr = dialog->Show(owner);
    if (SUCCEEDED(hr)) {
        IShellItemArray* items = nullptr;
        if (SUCCEEDED(dialog->GetResults(&items)) && items) {
            DWORD count = 0;
            items->GetCount(&count);
            for (DWORD i = 0; i < count; ++i) {
                IShellItem* item = nullptr;
                if (SUCCEEDED(items->GetItemAt(i, &item)) && item) {
                    PWSTR path = nullptr;
                    if (SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &path)) && path) {
                        outPaths.emplace_back(path);
                        CoTaskMemFree(path);
                        gotAny = true;
                    }
                    item->Release();
                }
            }
            items->Release();
        }
    }
    dialog->Release();
    return gotAny;
}

// --- main window state --------------------------------------------------------

struct AppState {
    HWND hwnd = nullptr;
    HWND srcList = nullptr;
    HWND dstEdit = nullptr;
    HWND threadsCombo = nullptr;
    HWND copyBtn = nullptr;
    HWND cancelBtn = nullptr;
    HWND progress = nullptr;
    HWND statusText = nullptr;
    HWND errorList = nullptr;

    HWND verifyCombo = nullptr;

    std::vector<std::wstring> sourceFolders;
    std::wstring destFolder;

    std::unique_ptr<CopyEngine> engine;
    ULONGLONG copyStartTick = 0;
    VerifyMode lastVerifyMode = VerifyMode::SizeOnly;
};

void RefreshSrcListBox(AppState& state) {
    SendMessageW(state.srcList, LB_RESETCONTENT, 0, 0);
    for (const auto& p : state.sourceFolders) {
        SendMessageW(state.srcList, LB_ADDSTRING, 0, reinterpret_cast<LPARAM>(p.c_str()));
    }
}

void SetControlsEnabled(AppState& state, bool copying) {
    EnableWindow(state.copyBtn, !copying);
    EnableWindow(state.cancelBtn, copying);
    EnableWindow(GetDlgItem(state.hwnd, IDC_BTN_ADD_SRC), !copying);
    EnableWindow(GetDlgItem(state.hwnd, IDC_BTN_REMOVE_SRC), !copying);
    EnableWindow(GetDlgItem(state.hwnd, IDC_BTN_CLEAR_SRC), !copying);
    EnableWindow(GetDlgItem(state.hwnd, IDC_BTN_PICK_DST), !copying);
    EnableWindow(state.threadsCombo, !copying);
    EnableWindow(state.verifyCombo, !copying);
}

// Refuses to start a copy where the destination is the same as, or nested
// inside, one of the sources (or vice versa) — that would recurse forever
// or overwrite the source while it's still being read.
bool ValidateDestination(const std::vector<std::wstring>& sources, const std::wstring& dest, std::wstring& errorOut) {
    std::error_code ec;
    fs::path destCanon = fs::weakly_canonical(fs::path(dest), ec);
    if (ec) {
        errorOut = L"Nie można rozwiązać ścieżki docelowej.";
        return false;
    }
    for (const auto& s : sources) {
        fs::path srcCanon = fs::weakly_canonical(fs::path(s), ec);
        if (ec) continue;
        auto destStr = destCanon.wstring();
        auto srcStr = srcCanon.wstring();
        auto isPrefix = [](const std::wstring& base, const std::wstring& other) {
            if (other.size() < base.size()) return false;
            if (_wcsnicmp(other.c_str(), base.c_str(), base.size()) != 0) return false;
            return other.size() == base.size() || other[base.size()] == L'\\';
        };
        if (isPrefix(srcStr, destStr) || isPrefix(destStr, srcStr)) {
            errorOut = L"Folder docelowy nie może znajdować się wewnątrz folderu źródłowego (ani odwrotnie):\n" + s;
            return false;
        }
    }
    return true;
}

void StartCopy(AppState& state) {
    if (state.sourceFolders.empty()) {
        MessageBoxW(state.hwnd, L"Najpierw dodaj co najmniej jeden folder źródłowy.", L"FastCopy", MB_ICONWARNING);
        return;
    }
    if (state.destFolder.empty()) {
        MessageBoxW(state.hwnd, L"Wybierz folder docelowy.", L"FastCopy", MB_ICONWARNING);
        return;
    }
    std::wstring err;
    if (!ValidateDestination(state.sourceFolders, state.destFolder, err)) {
        MessageBoxW(state.hwnd, err.c_str(), L"FastCopy", MB_ICONERROR);
        return;
    }

    wchar_t buf[16] = {};
    GetWindowTextW(state.threadsCombo, buf, 15);
    unsigned threads = static_cast<unsigned>(_wtoi(buf));
    if (threads == 0) threads = 8;

    int verifySel = static_cast<int>(SendMessageW(state.verifyCombo, CB_GETCURSEL, 0, 0));
    VerifyMode verifyMode = VerifyMode::SizeOnly;
    if (verifySel == 0) verifyMode = VerifyMode::None;
    else if (verifySel == 1) verifyMode = VerifyMode::SizeOnly;
    else if (verifySel == 2) verifyMode = VerifyMode::FullHash;
    state.lastVerifyMode = verifyMode;

    SendMessageW(state.errorList, LB_RESETCONTENT, 0, 0);
    SendMessageW(state.progress, PBM_SETPOS, 0, 0);
    SetWindowTextW(state.statusText, L"Rozpoczynanie...");

    state.engine = std::make_unique<CopyEngine>();
    state.copyStartTick = GetTickCount64();
    state.engine->Start(state.sourceFolders, state.destFolder, threads, verifyMode);

    SetControlsEnabled(state, true);
    SetTimer(state.hwnd, IDT_PROGRESS_TIMER, 150, nullptr);
}

void PollProgress(AppState& state) {
    if (!state.engine) return;
    const CopyEngine::Stats& stats = state.engine->GetStats();

    for (const auto& e : state.engine->TakeErrors()) {
        SendMessageW(state.errorList, LB_ADDSTRING, 0, reinterpret_cast<LPARAM>(e.c_str()));
    }

    uint64_t totalBytes = stats.totalBytes.load();
    uint64_t copiedBytes = stats.copiedBytes.load();
    uint64_t totalFiles = stats.totalFiles.load();
    uint64_t copiedFiles = stats.copiedFiles.load();
    uint64_t failed = stats.failedFiles.load();
    uint64_t verified = stats.verifiedFiles.load();
    uint64_t mismatched = stats.mismatchFiles.load();

    if (stats.enumerating.load()) {
        std::wstringstream ss;
        ss << L"Skanowanie plików... (znaleziono " << totalFiles << L", " << FormatBytes(totalBytes) << L")";
        SetWindowTextW(state.statusText, ss.str().c_str());
        SendMessageW(state.progress, PBM_SETMARQUEE, TRUE, 30);
        SetWindowLongPtrW(state.progress, GWL_STYLE, GetWindowLongPtrW(state.progress, GWL_STYLE) | PBS_MARQUEE);
    } else {
        SetWindowLongPtrW(state.progress, GWL_STYLE, GetWindowLongPtrW(state.progress, GWL_STYLE) & ~PBS_MARQUEE);
        SendMessageW(state.progress, PBM_SETMARQUEE, FALSE, 0);

        UINT percent = 0;
        if (totalBytes > 0) {
            percent = static_cast<UINT>((static_cast<double>(copiedBytes) / static_cast<double>(totalBytes)) * 100.0);
        } else if (totalFiles > 0) {
            percent = static_cast<UINT>((static_cast<double>(copiedFiles) / static_cast<double>(totalFiles)) * 100.0);
        }
        SendMessageW(state.progress, PBM_SETRANGE32, 0, 100);
        SendMessageW(state.progress, PBM_SETPOS, percent, 0);

        std::wstringstream ss;
        ss << L"Skopiowano " << copiedFiles << L" z " << totalFiles << L" plików ("
           << FormatBytes(copiedBytes) << L" z " << FormatBytes(totalBytes) << L")";
        if (state.lastVerifyMode != VerifyMode::None) ss << L", zweryfikowano: " << verified;
        if (failed > 0) ss << L" — błędów: " << failed;
        if (mismatched > 0) ss << L" — niezgodności: " << mismatched;
        SetWindowTextW(state.statusText, ss.str().c_str());
    }

    if (stats.finished.load()) {
        KillTimer(state.hwnd, IDT_PROGRESS_TIMER);
        SetControlsEnabled(state, false);

        ULONGLONG elapsed = GetTickCount64() - state.copyStartTick;
        std::wstringstream summary;
        if (state.engine->IsCancelled()) {
            summary << L"Anulowano. Skopiowano " << copiedFiles << L" z " << totalFiles << L" plików w " << FormatElapsed(elapsed) << L".";
        } else {
            summary << L"Gotowe: " << copiedFiles << L" z " << totalFiles << L" plików ("
                    << FormatBytes(copiedBytes) << L") w " << FormatElapsed(elapsed) << L".";
            if (state.lastVerifyMode != VerifyMode::None) {
                summary << L" Zweryfikowano: " << verified << L".";
            }
            if (failed > 0) summary << L" Błędów: " << failed << L".";
            if (mismatched > 0) summary << L" NIEZGODNOŚCI (kopia różni się od źródła): " << mismatched << L"!";
            if (failed > 0 || mismatched > 0) summary << L" Patrz lista poniżej.";
        }
        SetWindowTextW(state.statusText, summary.str().c_str());
    }
}

// --- window procedure ---------------------------------------------------------

LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    AppState* state = reinterpret_cast<AppState*>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));

    switch (msg) {
        case WM_CREATE: {
            auto* cs = reinterpret_cast<CREATESTRUCTW*>(lParam);
            state = reinterpret_cast<AppState*>(cs->lpCreateParams);
            SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(state));
            state->hwnd = hwnd;

            HFONT font = reinterpret_cast<HFONT>(GetStockObject(DEFAULT_GUI_FONT));
            auto mk = [&](const wchar_t* cls, const wchar_t* text, DWORD style, int x, int y, int w, int h, int id) {
                HWND h2 = CreateWindowExW(0, cls, text, style | WS_CHILD | WS_VISIBLE, x, y, w, h, hwnd,
                                           reinterpret_cast<HMENU>(static_cast<INT_PTR>(id)), nullptr, nullptr);
                SendMessageW(h2, WM_SETFONT, reinterpret_cast<WPARAM>(font), TRUE);
                return h2;
            };

            mk(L"STATIC", L"Foldery źródłowe do skopiowania:", 0, 12, 10, 300, 18, 0);
            state->srcList = mk(L"LISTBOX", nullptr, WS_BORDER | WS_VSCROLL | LBS_NOTIFY | LBS_EXTENDEDSEL, 12, 30, 460, 130, IDC_SRC_LIST);
            mk(L"BUTTON", L"Dodaj foldery...", WS_TABSTOP, 482, 30, 120, 28, IDC_BTN_ADD_SRC);
            mk(L"BUTTON", L"Usuń zaznaczone", WS_TABSTOP, 482, 64, 120, 28, IDC_BTN_REMOVE_SRC);
            mk(L"BUTTON", L"Wyczyść listę", WS_TABSTOP, 482, 98, 120, 28, IDC_BTN_CLEAR_SRC);

            mk(L"STATIC", L"Folder docelowy:", 0, 12, 172, 300, 18, 0);
            state->dstEdit = mk(L"EDIT", nullptr, WS_BORDER | ES_READONLY | ES_AUTOHSCROLL, 12, 192, 460, 24, IDC_EDIT_DST);
            mk(L"BUTTON", L"Wybierz...", WS_TABSTOP, 482, 192, 120, 24, IDC_BTN_PICK_DST);

            mk(L"STATIC", L"Liczba wątków kopiowania:", 0, 12, 230, 170, 18, 0);
            state->threadsCombo = mk(L"COMBOBOX", nullptr, WS_BORDER | CBS_DROPDOWNLIST, 190, 226, 80, 200, IDC_COMBO_THREADS);
            for (const wchar_t* v : {L"2", L"4", L"8", L"16", L"32"}) {
                SendMessageW(state->threadsCombo, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(v));
            }
            SendMessageW(state->threadsCombo, CB_SELECTSTRING, static_cast<WPARAM>(-1), reinterpret_cast<LPARAM>(L"8"));

            mk(L"STATIC", L"Weryfikacja po skopiowaniu:", 0, 300, 230, 150, 18, 0);
            state->verifyCombo = mk(L"COMBOBOX", nullptr, WS_BORDER | CBS_DROPDOWNLIST, 452, 226, 150, 200, IDC_COMBO_VERIFY);
            SendMessageW(state->verifyCombo, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(L"Brak"));
            SendMessageW(state->verifyCombo, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(L"Szybka (rozmiar)"));
            SendMessageW(state->verifyCombo, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(L"Pełna (SHA-256)"));
            SendMessageW(state->verifyCombo, CB_SETCURSEL, 1, 0);

            state->copyBtn = mk(L"BUTTON", L"Kopiuj", WS_TABSTOP | BS_DEFPUSHBUTTON, 12, 264, 120, 34, IDC_BTN_COPY);
            state->cancelBtn = mk(L"BUTTON", L"Anuluj", WS_TABSTOP, 140, 264, 120, 34, IDC_BTN_CANCEL);
            EnableWindow(state->cancelBtn, FALSE);

            state->progress = CreateWindowExW(0, PROGRESS_CLASSW, nullptr, WS_CHILD | WS_VISIBLE | WS_BORDER,
                                               12, 312, 590, 22, hwnd, reinterpret_cast<HMENU>(IDC_PROGRESS), nullptr, nullptr);
            SendMessageW(state->progress, PBM_SETRANGE32, 0, 100);

            state->statusText = mk(L"STATIC", L"Gotowy.", 0, 12, 342, 590, 20, IDC_STATUS_TEXT);

            mk(L"STATIC", L"Dziennik błędów:", 0, 12, 368, 300, 18, 0);
            state->errorList = mk(L"LISTBOX", nullptr, WS_BORDER | WS_VSCROLL, 12, 388, 590, 110, IDC_ERROR_LIST);
            return 0;
        }

        case WM_COMMAND: {
            if (!state) break;
            int id = LOWORD(wParam);
            int code = HIWORD(wParam);

            if (id == IDC_BTN_ADD_SRC && code == BN_CLICKED) {
                std::vector<std::wstring> picked;
                if (PickFolders(hwnd, true, picked)) {
                    for (auto& p : picked) {
                        bool exists = std::find(state->sourceFolders.begin(), state->sourceFolders.end(), p) != state->sourceFolders.end();
                        if (!exists) state->sourceFolders.push_back(p);
                    }
                    RefreshSrcListBox(*state);
                }
            } else if (id == IDC_BTN_REMOVE_SRC && code == BN_CLICKED) {
                int selCount = static_cast<int>(SendMessageW(state->srcList, LB_GETSELCOUNT, 0, 0));
                if (selCount > 0) {
                    std::vector<int> indices(selCount);
                    SendMessageW(state->srcList, LB_GETSELITEMS, selCount, reinterpret_cast<LPARAM>(indices.data()));
                    std::sort(indices.rbegin(), indices.rend());
                    for (int idx : indices) {
                        if (idx >= 0 && idx < static_cast<int>(state->sourceFolders.size())) {
                            state->sourceFolders.erase(state->sourceFolders.begin() + idx);
                        }
                    }
                    RefreshSrcListBox(*state);
                }
            } else if (id == IDC_BTN_CLEAR_SRC && code == BN_CLICKED) {
                state->sourceFolders.clear();
                RefreshSrcListBox(*state);
            } else if (id == IDC_BTN_PICK_DST && code == BN_CLICKED) {
                std::vector<std::wstring> picked;
                if (PickFolders(hwnd, false, picked) && !picked.empty()) {
                    state->destFolder = picked.front();
                    SetWindowTextW(state->dstEdit, state->destFolder.c_str());
                }
            } else if (id == IDC_BTN_COPY && code == BN_CLICKED) {
                StartCopy(*state);
            } else if (id == IDC_BTN_CANCEL && code == BN_CLICKED) {
                if (state->engine) {
                    state->engine->Cancel();
                    SetWindowTextW(state->statusText, L"Anulowanie...");
                }
            }
            return 0;
        }

        case WM_TIMER:
            if (state && wParam == IDT_PROGRESS_TIMER) {
                PollProgress(*state);
            }
            return 0;

        case WM_CLOSE:
            if (state && state->engine && state->engine->IsRunning()) {
                if (MessageBoxW(hwnd, L"Kopiowanie trwa. Przerwać i zamknąć program?", L"FastCopy",
                                MB_ICONWARNING | MB_YESNO) != IDYES) {
                    return 0;
                }
                state->engine->Cancel();
            }
            DestroyWindow(hwnd);
            return 0;

        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;
    }
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

} // namespace

int WINAPI wWinMain(HINSTANCE hInstance, HINSTANCE, PWSTR, int nCmdShow) {
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);

    INITCOMMONCONTROLSEX icc{sizeof(icc), ICC_PROGRESS_CLASS | ICC_STANDARD_CLASSES};
    InitCommonControlsEx(&icc);

    const wchar_t* className = L"FastCopyMainWindow";
    WNDCLASSEXW wc{};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInstance;
    wc.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    wc.hbrBackground = reinterpret_cast<HBRUSH>(COLOR_BTNFACE + 1);
    wc.lpszClassName = className;
    wc.hIcon = LoadIconW(nullptr, IDI_APPLICATION);
    RegisterClassExW(&wc);

    AppState state;

    RECT r{0, 0, 630, 530};
    AdjustWindowRect(&r, WS_OVERLAPPEDWINDOW & ~(WS_THICKFRAME | WS_MAXIMIZEBOX), FALSE);
    HWND hwnd = CreateWindowExW(0, className, L"FastCopy — szybkie kopiowanie folderów",
                                 (WS_OVERLAPPEDWINDOW & ~(WS_THICKFRAME | WS_MAXIMIZEBOX)),
                                 CW_USEDEFAULT, CW_USEDEFAULT, r.right - r.left, r.bottom - r.top,
                                 nullptr, nullptr, hInstance, &state);
    if (!hwnd) return 0;

    ShowWindow(hwnd, nCmdShow);
    UpdateWindow(hwnd);

    MSG msg;
    while (GetMessageW(&msg, nullptr, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    CoUninitialize();
    return static_cast<int>(msg.wParam);
}
