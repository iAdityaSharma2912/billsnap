# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for BillSnap's FastAPI backend.

WHY A .spec FILE INSTEAD OF A BARE `pyinstaller main.py`:
A bare command can't express the hidden-import list or the --onefile
build mode below, and re-typing a long flag list every build is
error-prone. This file IS the build configuration — checked into the
repo, run the same way every time.

WHY --onefile (a single .exe) INSTEAD OF --onedir (an .exe + a support
folder):
This matters specifically because of how Tauri's sidecar mechanism
works, not just general packaging preference. Tauri's `externalBin`
config bundles and manages exactly ONE named executable file — it has no
built-in concept of "this exe also needs a folder of DLLs/data sitting
next to it" the way --onedir produces (a `billsnap-backend/` folder
containing billsnap-backend.exe plus an `_internal/` folder it depends
on). Trying to make Tauri ship that _internal/ folder alongside the
sidecar requires fighting the tool via the separate, differently-scoped
`resources` config — multiple people in the Tauri community have hit
exactly this and gotten "Failed to load Python shared library: no such
file" errors at runtime, because the sidecar machinery doesn't relocate
_internal/ the way it does the single exe.
--onefile avoids all of that: PyInstaller produces ONE self-contained
.exe with everything embedded inside it. The tradeoff is a slightly
slower startup (it self-extracts to a temp folder on every launch,
typically adding well under a second for an app this size) — acceptable
given we already show a "Starting BillSnap..." loading state in the
frontend (see BackendReadyGate.tsx) specifically to absorb backend
startup time, native splash or not.

WHY EXPLICIT hiddenimports:
PyInstaller builds its dependency graph by statically scanning import
statements. Some libraries (uvicorn's protocol/loop implementations,
pydantic's compiled core, pandas' C extensions, qrcode's PIL backend)
select which submodule to load AT RUNTIME based on what's installed
(e.g. uvicorn picks "h11" vs "httptools" depending on which is present).
Static analysis can't see those — so without listing them here, the
packaged .exe runs fine on THIS machine in testing, then crashes with
"ModuleNotFoundError" the moment it's launched on the actual shop PC,
which is exactly the kind of bug you want to catch now, not after
installing it at the shop.
"""
from pathlib import Path

block_cipher = None
backend_root = Path.cwd()

hidden_imports = [
    # uvicorn dynamically selects its event loop and HTTP protocol
    # implementation by string name at startup — PyInstaller's static
    # scanner never sees those import strings, so they must be listed
    # explicitly or the packaged exe crashes the instant uvicorn.run() fires.
    "uvicorn.lifespan.on",
    "uvicorn.lifespan.off",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.protocols.websockets.wsproto_impl",
    "uvicorn.loops.auto",
    "uvicorn.loops.asyncio",
    "uvicorn.logging",
    # pydantic v2's validation core is a compiled Rust extension
    # (pydantic_core) that PyInstaller's hook sometimes misses pieces of.
    "pydantic.deprecated.decorator",
    "pydantic_core",
    # pandas pulls in several compiled submodules only at first use.
    "pandas._libs.tslibs.base",
    "pandas._libs.tslibs.np_datetime",
    # qrcode's PIL-based image factory is selected at runtime based on
    # what's installed, same pattern as uvicorn above.
    "qrcode.image.pil",
    "PIL._tkinter_finder",
    # multipart form parsing (used by file-upload endpoints, if any).
    "multipart",
]

a = Analysis(
    ['main.py'],
    pathex=[str(backend_root)],
    binaries=[],
    # No bundled data files needed: BillSnap reads/writes everything
    # through app/core/paths.py into %APPDATA%, not from files shipped
    # alongside the .exe. If a logo/template asset is added later that
    # the backend needs to read at runtime, add it here as
    # ('relative/source/path', 'destination/folder/inside/bundle').
    datas=[],
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # pytest/httpx are dev/test-only dependencies (requirements.txt
        # mixes them with runtime deps) — excluding them keeps the
        # packaged app smaller and avoids PyInstaller trying to resolve
        # test-framework internals that have nothing to do with running
        # the actual API.
        "pytest",
        "_pytest",
    ],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='billsnap-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    # console=True keeps a visible console window attached to the
    # backend process — intentional for now, so any startup crash on
    # your test machine prints a visible Python traceback instead of
    # silently vanishing. We will flip this to console=False as one of
    # the very last steps, once you've confirmed the packaged backend
    # runs correctly end-to-end (see the "Final polish" step later).
    # Note this is independent of the crash-log safety net already
    # added in main.py's __main__ block, which exists specifically to
    # cover the eventual console=False state.
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
