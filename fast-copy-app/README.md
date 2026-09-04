# FastCopy

Prosta aplikacja Windows (Win32 GUI, C++17) do szybszego kopiowania wielu
folderów niż robi to Eksplorator plików.

## Jak działa

1. Klikasz **"Dodaj foldery..."** — otwiera się standardowe okno wyboru
   folderów Eksploratora Windows, w którym można zaznaczyć **kilka
   folderów naraz** (Ctrl/Shift + klik).
2. Klikasz **"Wybierz..."** przy folderze docelowym — też przez okno
   Eksploratora.
3. Klikasz **"Kopiuj"**. Każdy wybrany folder źródłowy trafia do folderu
   docelowego jako podfolder o tej samej nazwie
   (`Docelowy\NazwaFolderuŹródłowego\...`).

Pasek postępu i dziennik błędów aktualizują się na żywo; kopiowanie można
przerwać przyciskiem "Anuluj".

## Dlaczego jest szybsza niż Eksplorator

Eksplorator kopiuje pliki pojedynczo i większość czasu przy wielu małych
plikach schodzi na narzut na plik (otwarcie, atrybuty, ACL, aktualizacja
UI), a nie na sam transfer danych. Ta aplikacja:

- **Kopiuje wieloma wątkami naraz** (domyślnie 8, do wyboru w GUI) —
  narzut na plik jest rozłożony na kilka rdzeni zamiast wykonywany
  sekwencyjnie. To główne źródło przyspieszenia przy wielu małych plikach.
- **Nie blokuje startu na pełnym przeliczaniu drzewa** — enumeracja i
  kopiowanie lecą równolegle z aktualizacją paska postępu.
- **Używa nieskrytego I/O (`COPY_FILE_NO_BUFFERING`) dla dużych plików**
  (powyżej 64 MB) — dane nie zapychają pamięci podręcznej systemu, więc
  nie ma efektu "szybko przez pierwsze sekundy, potem czołganie się".
  Małe pliki zostają na zwykłym, buforowanym I/O, bo dla nich narzut
  wyrównania unbuffered I/O tylko by szkodził.
- **Wspiera długie ścieżki** (`\\?\...`) — nie wywala się na limicie 260
  znaków, na który czasem trafia Eksplorator.

Rzeczywiste przyspieszenie zależy od nośnika: na SSD z NVMe/SATA
wielowątkowość daje wyraźny zysk (kolejkowanie poleceń, wiele operacji I/O
w locie). Na pojedynczym talerzowym dysku HDD zysk bywa mniejszy, bo
głowica i tak musi skakać między plikami sekwencyjnie — tam liczbę wątków
warto zejść np. do 2.

## Budowanie

### Wymagania
- Kompilator z obsługą C++17 i Win32 API: MSVC (Visual Studio) albo
  MinGW-w64.
- CMake 3.16+.

### Visual Studio / MSVC (na Windows)

```powershell
cmake -B build -S . -A x64
cmake --build build --config Release
```

Plik wynikowy: `build\Release\FastCopy.exe`.

### MinGW-w64 (na Windows albo cross-build z Linuksa)

Na Windows z zainstalowanym MinGW-w64 w PATH:

```powershell
cmake -B build -S . -G "MinGW Makefiles"
cmake --build build
```

Cross-build z Linuksa (np. Ubuntu/Debian: `apt install mingw-w64`) —
dołączony `toolchain-mingw.cmake` wskazuje kompilator:

```bash
cmake -B build -S . -DCMAKE_TOOLCHAIN_FILE=toolchain-mingw.cmake
cmake --build build
```

Wynikowy `FastCopy.exe` jest samodzielny — wystarczy skopiować go na
komputer z Windows i uruchomić (nie wymaga instalacji, tylko standardowego
runtime Windows).

## Struktura projektu

- `main.cpp` — okno Win32, obsługa GUI, wybór folderów przez
  `IFileOpenDialog` (z `FOS_PICKFOLDERS | FOS_ALLOWMULTISELECT`).
- `CopyEngine.h/.cpp` — silnik kopiowania: enumeracja drzewa, tworzenie
  struktury katalogów, pula wątków kopiujących pliki równolegle.
- `app.manifest` / `app.rc` — manifest aplikacji (visual styles, DPI
  awareness, obsługa długich ścieżek).
