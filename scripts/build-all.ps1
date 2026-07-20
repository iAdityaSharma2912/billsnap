# scripts/build-all.ps1
#
# Builds the complete BillSnap desktop application from source:
# Python backend -> PyInstaller sidecar -> Tauri app -> Windows installer.
#
# Run this from the project root (smartbill folder), after the one-time
# setup described in the Installation Guide (Rust, Node, Python venv,
# npm install all already done).
#
# OUTPUT: installers land in src-tauri\target\release\bundle\
#   - msi\BillSnap_1.0.0_x64_en-US.msi
#   - nsis\BillSnap_1.0.0_x64-setup.exe

$ErrorActionPreference = "Stop"

Write-Host "=== BillSnap full build ===" -ForegroundColor Magenta
Write-Host ""

Write-Host "=== Step 1 of 3: Building backend sidecar ===" -ForegroundColor Cyan
.\scripts\build-backend.ps1

Write-Host ""
Write-Host "=== Step 2 of 3: Building frontend (production) ===" -ForegroundColor Cyan
Push-Location frontend
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "=== Step 3 of 3: Building Tauri app and installers ===" -ForegroundColor Cyan
Write-Host "This compiles Rust in release mode and can take several minutes." -ForegroundColor Yellow
cargo tauri build
if ($LASTEXITCODE -ne 0) { throw "Tauri build failed" }

Write-Host ""
Write-Host "=== Build complete ===" -ForegroundColor Green
Write-Host "Installers are in: src-tauri\target\release\bundle\" -ForegroundColor Green