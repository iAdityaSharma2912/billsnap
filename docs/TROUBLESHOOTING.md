# BillSnap — Troubleshooting Guide

## Build-time issues (on your development machine)

### `error: linker 'link.exe' not found`

**Cause:** Microsoft C++ Build Tools aren't installed. Rust on Windows
needs this to actually produce an `.exe` — it's a separate install from
Rust itself.

**Fix:** Install Visual Studio Build Tools with the "Desktop development
with C++" workload — see Installation Guide, step A5. Restart your
computer afterward.

### `cargo tauri build` succeeds, but the app can't find the backend / window shows "BillSnap couldn't start" forever

**Cause, most likely:** the backend sidecar binary wasn't named correctly.
Tauri's `externalBin` mechanism requires the file in `src-tauri/binaries/`
to be named `billsnap-backend-<TARGET_TRIPLE>.exe`, not plain
`billsnap-backend.exe`. This is easy to get wrong by hand.

**Fix:** Always use `.\scripts\build-backend.ps1` rather than copying the
PyInstaller output manually — it detects your target triple automatically
and names the file correctly. Verify the file exists:
```powershell
Get-ChildItem src-tauri\binaries\
```
You should see something like `billsnap-backend-x86_64-pc-windows-msvc.exe`.

### PyInstaller build succeeds, but the packaged backend exits instantly with no error

**Cause:** if you ever bypass `billsnap-backend.spec` and run PyInstaller
directly on `main.py` without the spec file, you lose the hidden-imports
list — the packaged exe will fail with `ModuleNotFoundError` on a library
like `uvicorn.protocols.http.h11_impl` that isn't visible to static
analysis.

**Fix:** Always build via `pyinstaller billsnap-backend.spec --noconfirm`,
not `pyinstaller main.py` directly.

### Packaged backend opens a console window and immediately closes, too fast to read the error

**Fix:** Open `backend\billsnap-backend.spec`, find the `EXE(...)` block,
and temporarily set `console=True` if it's currently `False`. Rebuild.
The console window will now stay open and show the Python traceback.
Also check `%APPDATA%\BillSnap\logs\startup-crash.log` (or
`%APPDATA%\BillSnap-Dev\logs\startup-crash.log` if running outside the
packaged app) — `main.py`'s `__main__` block writes a full traceback
there specifically for this scenario, since the production build runs
with the console hidden.

### `npm run dev` works, but `cargo tauri dev` shows a blank white window

**Likely cause:** the backend sidecar isn't running yet, or crashed on
startup, and you're seeing the React app before `BackendReadyGate`
finishes its first poll — or it's stuck because the backend genuinely
isn't responding.

**Fix:** Check `%APPDATA%\BillSnap-Dev\logs\startup-crash.log`. Also
check the terminal you ran `cargo tauri dev` from — `sidecar.rs` prints
the backend's stdout/stderr lines prefixed with `[backend]`.

## Runtime issues (after installing on a shop PC)

### Windows SmartScreen warning when running the installer

This is expected for any new, unsigned application — it isn't specific
to a bug in BillSnap. Click "More info" → "Run anyway". This goes away
permanently only if the app is code-signed in the future (see Future
Improvements).

### App won't start after install, no error visible

The console is hidden in the production build by design. Check:
```
%APPDATA%\BillSnap\logs\startup-crash.log
```
If this file doesn't exist either, the failure happened before Python
even started — check Windows Event Viewer (Windows Logs → Application)
for a Tauri/WebView2-related crash entry instead.

### "Low stock alert" notifications never appear

1. Check Settings → System → the notifications toggle is on.
2. Windows may have notifications disabled system-wide for the app on
   first run — check Windows Settings → System → Notifications →
   BillSnap is allowed.
3. Notifications only fire once per company-load when low-stock items
   exist (see `Dashboard.tsx`) — switching company tabs back and forth
   without the underlying low-stock count changing won't re-trigger it;
   this is intentional, not a bug.

### Printing doesn't work / print dialog doesn't open

The print flow uses a hidden iframe and `iframe.contentWindow.print()`,
unchanged from the web version, relying on WebView2's Chromium engine
to support it the same way Chrome does. If this breaks, it's the one
area of the migration that wasn't independently re-verified end-to-end
inside an actual Tauri window (this guide's authors could only verify
it in a regular browser) — report the exact symptom (does the dialog
not open at all, or does it open with a blank/wrong page) for a precise
fix.

### Excel export / backup ZIP doesn't download, or the save dialog never appears

Same caveat as printing above: the existing download mechanism
(`fetch()` + `URL.createObjectURL()` + a synthetic `<a download>`
click — see `frontend/src/services/reportApi.ts`) works in a regular
Chromium browser, but embedded webviews like Tauri's WebView2 don't
always handle programmatic downloads identically to a full browser
window — this specific behavior was not independently re-verified
inside an actual Tauri window during the migration. If it breaks,
report whether nothing happens at all, or whether a save dialog opens
but fails — these point to different fixes (the former likely needs a
small Tauri-side helper using the `dialog`/`fs` APIs instead of the
browser download attribute; the latter is probably a path issue).

### Database/invoices seem to have disappeared after reinstalling

They haven't — `%APPDATA%\BillSnap\` is never touched by a normal
reinstall (only an explicit uninstall with "delete app data" checked
removes it). Check Settings → System → "Open data folder" to confirm
the files are still there.

## General debugging approach

1. Settings → Logs tab shows the last 100 application log lines (from
   the `app_logs` database table) — covers anything that happened *after*
   the backend successfully started.
2. `%APPDATA%\BillSnap\logs\` (or `BillSnap-Dev` in development) has
   daily rotating `.log` files plus `startup-crash.log` for failures
   *before* the backend could start.
3. If neither has anything useful, the problem is likely in the Tauri/
   Rust shell itself, not the Python backend — check the terminal output
   from `cargo tauri dev`, or Windows Event Viewer for the packaged app.
