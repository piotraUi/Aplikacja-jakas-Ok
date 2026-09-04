cmake_minimum_required(VERSION 3.16)
project(FastCopy LANGUAGES CXX)

if(NOT WIN32)
    message(FATAL_ERROR "FastCopy is a Windows GUI application (Win32 API) and can't be built for this OS.")
endif()

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(FastCopy WIN32
    main.cpp
    CopyEngine.cpp
    CopyEngine.h
)

if(MSVC)
    # MSVC embeds a plain .manifest file passed as a source automatically.
    target_sources(FastCopy PRIVATE app.manifest)
else()
    # MinGW: compile the .rc (which references app.manifest) with windres.
    enable_language(RC)
    set(CMAKE_RC_COMPILER_INIT windres)
    target_sources(FastCopy PRIVATE app.rc)
    # -municode selects the wWinMain/wmain entry point family (we use wWinMain).
    target_compile_options(FastCopy PRIVATE -municode)
    target_link_options(FastCopy PRIVATE -municode)
endif()

target_compile_definitions(FastCopy PRIVATE UNICODE _UNICODE)
target_link_libraries(FastCopy PRIVATE comctl32 shell32 ole32 uuid gdi32 comdlg32)
