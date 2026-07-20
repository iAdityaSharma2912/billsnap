# scripts/build-backend.ps1
#
# Builds the Python backend with PyInstaller (--onefile, see
# backend/billsnap-backend.spec for why) and copies the resulting
# single .exe into src-tauri/binaries/ with the exact filename Tauri's
# sidecar mechanism requires: <name>-<target-triple>.exe on Windows.
#
# WHY THIS SCRIPT EXISTS, RATHER THAN JUST RUNNING PYINSTALLER DIRECTLY:
# Tauri does not look for "billsnap-backend.exe" in src-tauri/binaries/.
# It looks for "billsnap-backend-<TARGET_TRIPLE>.exe", where the triple
# depends on your exact machine/toolchain (typically
# x86_64-pc-windows-msvc, but ARM64 Windows would differ). Getting this
# filename wrong is one of the most common Tauri sidecar mistakes — the
# build succeeds with no error, but the app fails to find the backend at
# runtime. This script detects the triple automatically via `rustc -Vv`
# instead of you having to hardcode and remember it.
#
# USAGE (from the project root, smartbill\):
#   .\scripts\build-backend.ps1
#
# WHAT IT DOES, IN ORDER:
#   1. Activates backend's venv (assumes you've already created it —
#      see the Installation Guide for the one-time setup)
#   2. Runs PyInstaller using backend/billsnap-backend.spec (--onefile,
#      so the output is ONE .exe with no separate support folder —
#      important: see the WHY --onefile comment in the .spec file for
#      why --onedir specifically breaks with Tauri's sidecar mechanism)
#   3. Detects your Rust target triple
#   4. Copies+renames that single .exe into src-tauri/binaries/

$ErrorActionPreference = "Stop"

Write-Host "=== Step 1: Building backend with PyInstaller ===" -ForegroundColor Cyan
Push-Location backend
try {
    & .\venv\Scripts\Activate.ps1
    pyinstaller billsnap-backend.spec --noconfirm
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed with exit code $LASTEXITCODE" }
} finally {
    Pop-Location
}

Write-Host "=== Step 2: Detecting Rust target triple ===" -ForegroundColor Cyan
$rustInfo = rustc -Vv
$targetTriple = ($rustInfo | Select-String "host:").ToString().Split(" ")[1]
if (-not $targetTriple) {
    throw "Could not detect target triple from 'rustc -Vv' output. Is Rust installed? See the Installation Guide."
}
Write-Host "Detected target triple: $targetTriple"

Write-Host "=== Step 3: Copying backend exe into src-tauri/binaries/ ===" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "src-tauri\binaries" | Out-Null

# --onefile produces exactly one file here — no _internal\ folder, no
# separate DLLs to track down and copy alongside it. This is the whole
# reason --onefile was chosen over --onedir for this project: Tauri's
# sidecar mechanism only manages a single named file, and this keeps us
# inside that contract instead of fighting it.
$source = "backend\dist\billsnap-backend.exe"
$destExe = "src-tauri\binaries\billsnap-backend-$targetTriple.exe"

if (-not (Test-Path $source)) {
    throw "Expected PyInstaller output not found at $source - check the PyInstaller step above for errors."
}

Copy-Item $source $destExe -Force

Write-Host ""
Write-Host "Done. Backend sidecar ready at: $destExe" -ForegroundColor Green
