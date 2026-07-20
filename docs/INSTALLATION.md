# BillSnap Desktop — Installation Guide

This guide assumes you know nothing about the tools involved. Every
command is given exactly as you should type it. Run them in
**PowerShell** (not Command Prompt) unless told otherwise — right-click
the Start button → "Windows PowerShell" or "Terminal".

This guide covers two different audiences in two different sections:

- **Part A — Developer setup**: what *you* (Tushar) need installed to
  build BillSnap from source. Do this once.
- **Part B — Shop PC installation**: what a *shop owner* needs to do to
  install the finished app. This is just "double-click the installer" —
  see the end of this guide.

---

## Part A — Developer machine setup (one-time)

### A1. Install Git

Git tracks changes to the project's source code.

1. Download from https://git-scm.com/download/win
2. Run the installer, accepting all defaults.
3. Verify:
   ```powershell
   git --version
   ```
   You should see something like `git version 2.45.0.windows.1`.

### A2. Install Node.js (for the frontend)

1. Go to https://nodejs.org and download the **LTS** version (not "Current").
2. Run the installer, accepting all defaults (this also installs `npm`).
3. **Restart PowerShell** after installing — Windows needs a fresh
   terminal to pick up the new PATH entry.
4. Verify:
   ```powershell
   node --version
   npm --version
   ```

### A3. Install Python (for the backend)

1. Go to https://www.python.org/downloads/ and download **Python 3.11
   or 3.12** (avoid 3.13+ for now — some packages like `reportlab` may
   lag behind on day-one support for brand-new Python versions).
2. Run the installer. **Important:** on the first screen, check the box
   "Add python.exe to PATH" before clicking Install.
3. Restart PowerShell.
4. Verify:
   ```powershell
   python --version
   pip --version
   ```

### A4. Install Rust (for the Tauri desktop shell)

1. Go to https://www.rust-lang.org/tools/install
2. Download and run `rustup-init.exe`.
3. When prompted, type `1` and press Enter for the default installation.
4. **Restart PowerShell.**
5. Verify:
   ```powershell
   rustc --version
   cargo --version
   ```

### A5. Install Microsoft C++ Build Tools (required by Rust on Windows)

This is easy to miss and causes a confusing `linker 'link.exe' not
found` error later if skipped — Rust cannot produce a working `.exe` on
Windows without it.

1. Download the Visual Studio Build Tools installer:
   https://visualstudio.microsoft.com/visual-cpp-build-tools/
2. Run it. In the workload list, check **"Desktop development with
   C++"**.
3. Click Install (this step alone can take 15–30 minutes and several GB
   of disk space — there's no way around its size, it's the official
   Microsoft toolchain).
4. Restart your computer after it finishes.

### A6. Install WebView2 Runtime (usually already present)

Windows 11 includes this already. Windows 10 usually does too, but to
be safe:

1. Download the Evergreen Bootstrapper:
   https://developer.microsoft.com/en-us/microsoft-edge/webview2/
2. Run it. It installs in seconds if not already present, or does
   nothing if it's already there.

### A7. Install VS Code (recommended editor)

1. Download from https://code.visualstudio.com/
2. Run the installer, accepting all defaults (check "Add to PATH" if
   offered).
3. Recommended extensions (open VS Code, go to the Extensions icon on
   the left sidebar, search and install each):
   - **rust-analyzer** (Rust language support)
   - **Python** (Microsoft's official Python extension)
   - **ES7+ React/Redux/React-Native snippets**
   - **Tailwind CSS IntelliSense**
   - **Even Better TOML** (for editing Cargo.toml comfortably)

### A8. Install the Tauri CLI

```powershell
cargo install tauri-cli --version "^1"
```

This takes a few minutes the first time (it compiles from source).
Verify:
```powershell
cargo tauri --version
```

### A9. Get the project code

If you already have the `smartbill` folder from this conversation, skip
to A10. Otherwise, if it's in a Git repository:

```powershell
git clone <your-repo-url> smartbill
cd smartbill
```

### A10. Set up the Python backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install pyinstaller
```

If PowerShell refuses to run the activation script with an error about
execution policy, run this once (only needed the first time on a given
PC) and try again:
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### A11. Set up the React frontend

```powershell
cd ..\frontend
npm install
```

### A12. Verify the dev environment works

From the project root (`smartbill\`):

**Terminal 1 — backend:**
```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```
You should see `Uvicorn running on http://127.0.0.1:8000`. Leave this running.

**Terminal 2 — frontend:**
```powershell
cd frontend
npm run dev
```
Open http://localhost:1420 in a browser — you should see BillSnap's
first-run "Welcome to BillSnap" setup screen. This confirms the web
version still works exactly as before — nothing about the desktop
migration changed this dev workflow.

Stop both (Ctrl+C in each terminal) before continuing.

### A13. Build and run the actual desktop app for the first time

This is the real test of the whole migration. From the project root:

```powershell
.\scripts\build-backend.ps1
cargo tauri dev
```

`build-backend.ps1` packages the Python backend into a `.exe` (see
`backend/billsnap-backend.spec` for what this does and why). `cargo
tauri dev` then compiles the Rust shell (this can take a few minutes
the *first* time only — subsequent runs are much faster) and opens
BillSnap as an actual native window.

**What you should see:** a native window titled "BillSnap" opens,
briefly shows "Starting BillSnap..." (the backend sidecar booting, ~2-3
seconds), then shows the same "Welcome to BillSnap" first-run screen you
saw in the browser in A12 — except now it's a real desktop app with no
browser chrome around it.

If something goes wrong here, see the Troubleshooting Guide
(`docs/TROUBLESHOOTING.md`) — bring the exact error text.

---

## Part B — Building the final installer (do this whenever you want a new release)

```powershell
.\scripts\build-all.ps1
```

This runs all three build stages in order: backend → frontend →
Tauri/installer. It takes several minutes. When it finishes, you'll
have:

```
src-tauri\target\release\bundle\msi\BillSnap_1.0.0_x64_en-US.msi
src-tauri\target\release\bundle\nsis\BillSnap_1.0.0_x64-setup.exe
```

Either file is a complete, standalone installer — copy it to a USB
drive, email it, or transfer it however is convenient to the shop PC.
You don't need both; NSIS (`.exe`) is generally the friendlier
end-user experience (nicer install wizard), MSI is more standard for
IT-managed environments. For two small shops, NSIS is the simpler
choice.

**Note on Administrator rights:** the installer is configured to
install to `Program Files` (so it's visible to any Windows user account
on that PC, with a proper Start Menu entry and uninstaller) — this
requires clicking "Yes" on the Windows admin prompt during installation.
This is a one-time thing during setup, not something needed for daily
use afterward.

---

## Part C — Installing on a shop PC (give this section to the shop owner, or do it yourself there)

1. Copy `BillSnap_1.0.0_x64-setup.exe` onto the shop PC (USB drive, email
   attachment, cloud download — any method).
2. Double-click it.
3. If Windows shows a blue "Windows protected your PC" SmartScreen
   warning (this happens for any new, unsigned app — not specific to
   BillSnap), click "More info" → "Run anyway". This warning will go
   away if/when the app is ever code-signed in the future, which isn't
   set up yet.
4. Click through the installer (accept the defaults — install
   location, Start Menu shortcut, Desktop shortcut).
5. Click "Yes" on the Windows Administrator prompt.
6. BillSnap launches automatically after install finishes, showing the
   first-run "Welcome to BillSnap" screen — fill in that shop's company
   details (name, address, phone, UPI ID if used).
7. Done. BillSnap is now in the Start Menu and (if selected) on the
   Desktop for future launches.

**Repeat this exact process on the second shop's PC** — each install
gets its own independent database (see the architecture doc for why),
so there's no need to coordinate the two installs or copy any data
between them.

---

## Updating BillSnap later

There's no auto-update mechanism set up yet (this was intentionally
left out of the initial scope — see Future Improvements in
`docs/README.md`). To ship an update:

1. Make your code changes.
2. Run `.\scripts\build-all.ps1` again.
3. Copy the new installer to each shop PC and run it — it will install
   over the existing version, keeping the existing database untouched
   (the database lives in `%APPDATA%\BillSnap\`, completely separate
   from the installed program files, so reinstalling never touches
   shop data).
