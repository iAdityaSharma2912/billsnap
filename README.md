<div align="center">

<img src="https://thebillsnap.vercel.app/og-image.png" alt="BillSnap" width="600"/>

# BillSnap

**Free offline billing software for small shops**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-navy)](https://thebillsnap.vercel.app)
[![Version](https://img.shields.io/badge/Version-1.0.0-amber)](https://github.com/iAdityaSharma2912/billsnap/releases)
[![Website](https://img.shields.io/badge/Website-thebillsnap.vercel.app-185FA5)](https://thebillsnap.vercel.app)

[Download](https://github.com/iAdityaSharma2912/billsnap/releases/latest) · [Website](https://thebillsnap.vercel.app) · [Report a bug](https://github.com/iAdityaSharma2912/billsnap/issues) · [Request a feature](https://github.com/iAdityaSharma2912/billsnap/issues/new)

</div>

---

## What is BillSnap?

BillSnap is a desktop billing application built for small shops — kirana stores, electronics shops, hardware stores, cloth merchants, and any business that needs to create invoices, track inventory, and see daily sales without relying on the internet or paying a monthly subscription.

It runs entirely on your own Windows PC. No internet connection required. No account to create. No data ever leaves your machine. Everything — invoices, customers, stock levels, reports — is stored in a single local database file.

---

## Features

- **PDF invoices** — Cash Memo / Delivery Challan format with original and duplicate copies on one A4 sheet, separated by a cut line. Your shop name, address, customer details, item list, grand total, UPI QR code, and bank details all print automatically.
- **Inventory management** — Add items with selling price, unit, and minimum stock threshold. Stock deducts automatically every time an invoice is saved. Low-stock alerts appear on the dashboard before you run out.
- **Customer management** — Save customer names, addresses, and phone numbers. Repeat customers fill in automatically when creating invoices.
- **Daily and monthly reports** — See total sales, top customers, payment mode breakdown (cash, UPI, credit), and a per-item inventory report for any date or month. All reports are printable.
- **Excel exports** — Export all invoices for any date range to a formatted `.xlsx` file.
- **One-click backup and restore** — Zips the entire database, all invoice PDFs, and all exports into a single file. Restore on any PC by uploading that zip.
- **Multiple companies** — Run two or more businesses from one installation, each with its own invoice series, inventory, customers, and reports. Switch between them with a tab click.
- **100% offline** — Works during power cuts, BSNL outages, or anywhere without internet. No server dependency of any kind.
- **First-run setup wizard** — Fresh install shows a guided setup to create your first company before unlocking the rest of the app.
- **Application logs** — All events (invoices created, backups taken, errors) logged to daily rotating files, viewable from Settings → Logs.

---

## Tech stack

BillSnap is a Tauri v1 desktop application. The frontend is a React web app rendered inside a native WebView2 window. The backend is a FastAPI Python application packaged as a PyInstaller sidecar that Tauri spawns automatically on launch.

| Layer | Technology |
|---|---|
| Desktop shell | Tauri v1 (Rust) |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, React Router |
| Backend | FastAPI, SQLAlchemy 2.0, Pydantic v2, Uvicorn |
| Database | SQLite (single local file, zero config) |
| PDF generation | ReportLab |
| Excel export | openpyxl, pandas |
| Icons / UI | lucide-react |
| Packaging | PyInstaller (`--onefile`) |
| Installer | NSIS + WiX (via Tauri bundler) |

---

## Architecture

```
BillSnap.exe  (Tauri shell)
├── WebView2 window  →  React frontend (localhost:8000)
└── billsnap-backend.exe  (PyInstaller sidecar)
    └── FastAPI + SQLAlchemy + SQLite
        └── %APPDATA%\BillSnap\
            ├── database\smartbill.db
            ├── invoices\
            ├── exports\
            ├── backup\
            └── logs\
```

The Rust shell spawns the Python backend sidecar on launch with `BILLSNAP_ENV=production` set, and kills it cleanly when the window closes. The frontend polls `/health` every 400ms until the backend is ready (typically 2-3 seconds), then proceeds normally.

In development, you run the backend directly with `uvicorn` and the frontend with `vite dev`. In production, the backend is frozen into a single `.exe` by PyInstaller and the frontend is compiled to static files by Vite, both bundled into the installer by Tauri.

---

## Project structure

```
smartbill/
├── backend/
│   ├── main.py                     # FastAPI app entry point
│   ├── requirements.txt
│   ├── billsnap-backend.spec       # PyInstaller build config
│   └── app/
│       ├── api/                    # Route handlers
│       │   ├── customer.py
│       │   ├── invoice.py
│       │   ├── inventory.py
│       │   ├── report.py
│       │   ├── export.py
│       │   ├── backup.py
│       │   └── settings_api.py
│       ├── core/
│       │   └── paths.py            # %APPDATA% path resolver (dev vs prod)
│       ├── models/
│       │   └── models.py           # SQLAlchemy ORM models
│       ├── schemas/
│       │   └── schemas.py          # Pydantic request/response schemas
│       ├── repositories/           # Data access layer
│       ├── services/               # Business logic
│       │   ├── invoice_service.py  # Invoice create/edit + stock reconciliation
│       │   ├── pdf_service.py      # ReportLab PDF generation
│       │   ├── excel_service.py    # openpyxl export
│       │   └── backup_service.py   # Zip backup/restore
│       ├── database/
│       │   └── db.py               # SQLAlchemy engine + session + migrations
│       └── utils/
│           └── logger.py           # Rotating daily log files
│
├── frontend/
│   └── src/
│       ├── pages/                  # One file per screen
│       │   ├── Dashboard.tsx
│       │   ├── NewInvoice.tsx
│       │   ├── InvoiceHistory.tsx
│       │   ├── Customers.tsx
│       │   ├── Inventory.tsx
│       │   ├── Reports.tsx
│       │   ├── Export.tsx
│       │   ├── Backup.tsx
│       │   ├── Settings.tsx
│       │   └── CompanySetup.tsx    # First-run wizard
│       ├── components/
│       │   ├── layout/             # Sidebar, Topbar
│       │   ├── shared/             # CompanyTabs, Modal, Toast,
│       │   │                       # BackendReadyGate, CompanySetupGate
│       │   ├── invoice/            # Invoice form components
│       │   └── settings/           # CompaniesPanel, SystemPanel
│       ├── store/                  # Zustand state
│       │   ├── appStore.ts         # activeCompany, toasts
│       │   ├── settingsStore.ts    # Company list
│       │   └── preferencesStore.ts # Notification toggle (localStorage)
│       ├── services/               # axios API clients
│       │   ├── api.ts              # Base axios instance
│       │   ├── invoiceApi.ts
│       │   ├── inventoryApi.ts
│       │   ├── customerApi.ts
│       │   ├── reportApi.ts
│       │   └── tauriApi.ts         # Desktop-only commands (folder open, notifications)
│       ├── hooks/
│       │   ├── useCompanies.ts
│       │   ├── useDebounce.ts
│       │   └── useKeyboard.ts
│       └── types/
│           └── index.ts
│
├── src-tauri/
│   ├── src/
│   │   ├── main.rs                 # Window lifecycle, event handlers
│   │   ├── sidecar.rs              # Backend process spawn/kill (taskkill /IM)
│   │   └── commands.rs             # Tauri commands: get_app_data_dir, open_folder
│   ├── icons/                      # App icon in 5 formats
│   ├── binaries/                   # PyInstaller output (gitignored, built locally)
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── scripts/
│   ├── build-backend.ps1           # PyInstaller → correctly named sidecar binary
│   └── build-all.ps1               # Full pipeline → finished installer
│
├── docs/
│   ├── INSTALLATION.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.md
│   ├── TROUBLESHOOTING.md
│   └── FUTURE_IMPROVEMENTS.md
│
├── index.html                      # Landing page (served via GitHub Pages / Vercel)
├── og-image.png                    # Open Graph preview image
├── sitemap.xml
├── robots.txt
├── .gitignore
└── README.md
```

---

## Database

SQLite — single file at `%APPDATA%\BillSnap\database\smartbill.db`.

| Table | Purpose |
|---|---|
| `settings` | Company profiles (name, address, phone, UPI, bank details) |
| `customers` | Customer records |
| `inventory` | Items with price, unit, stock, and minimum threshold |
| `invoices` | Invoice headers |
| `invoice_items` | Line items per invoice (with stock-deducted flag) |
| `users` | User accounts (schema present, auth not yet wired) |
| `app_logs` | Application event log |

Schema migrations are handled by a lightweight custom runner in `db.py` (`_run_column_migrations`) — adds missing columns on startup without touching existing data. Safe to run on every launch.

---

## Getting started

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Python | 3.11 or 3.12 | Backend runtime |
| Node.js | 18+ | Frontend build |
| Rust | stable | Tauri shell compilation |
| VS Build Tools | Desktop C++ workload | Rust linker on Windows |
| Tauri CLI | v1.x | `cargo install tauri-cli --version "^1"` |

### Development setup

**1. Clone the repo**
```bash
git clone https://github.com/iAdityaSharma2912/billsnap.git
cd billsnap
```

**2. Backend**
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**3. Frontend**
```powershell
cd ..\frontend
npm install
```

**4. Run in web mode** (fastest for frontend iteration)

Terminal 1:
```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```

Terminal 2:
```powershell
cd frontend
npm run dev
```

Open `http://localhost:1420` — you'll see BillSnap's first-run setup screen.

**5. Run as a desktop app**
```powershell
# From project root
.\scripts\build-backend.ps1   # packages backend into PyInstaller sidecar
cargo tauri dev               # compiles Rust shell + opens native window
```

### Building the installer

```powershell
.\scripts\build-all.ps1
```

Output:
```
src-tauri\target\release\bundle\nsis\BillSnap_1.0.0_x64-setup.exe
src-tauri\target\release\bundle\msi\BillSnap_1.0.0_x64_en-US.msi
```

---

## API reference

Start the backend and open `http://localhost:8000/docs` for the full interactive Swagger UI.

| Prefix | Description |
|---|---|
| `GET /health` | Health check — returns `{"status":"healthy"}` |
| `/customer/*` | CRUD for customer records |
| `/invoice/*` | Create, list, update, delete invoices + PDF download |
| `/inventory/*` | Item management, stock list, low-stock endpoint |
| `/report/*` | Daily report, monthly report, inventory report |
| `/export/*` | Excel export generation and download |
| `/backup/*` | Create backup zip, list backups, restore |
| `/settings/*` | Company CRUD, application logs |

---

## Key design decisions

**`--onefile` PyInstaller packaging over `--onedir`** — Tauri's `externalBin` sidecar mechanism manages a single named executable file. Using `--onedir` produces a binary plus a `_internal/` support folder that Tauri can't automatically relocate alongside the binary during bundling. `--onefile` embeds everything into one self-contained executable, which fits Tauri's contract exactly.

**`taskkill /F /IM billsnap-backend.exe /T` for process cleanup** — Tauri's `CommandChild.kill()` targets the PyInstaller bootloader PID, not the uvicorn worker PID it spawns internally. The bootloader exits cleanly but uvicorn keeps running, holding port 8000 open. Killing by image name with `/T` (kill process tree) terminates the entire chain correctly.

**Pre-spawn cleanup in `spawn_backend()`** — Before spawning a new backend, the sidecar module calls `taskkill` to kill any stray `billsnap-backend.exe` from a previous session that may have survived. This makes every fresh launch self-healing rather than colliding with an orphaned process.

**`BackendReadyGate` with per-attempt 1.5s timeout** — The shared axios instance has a 15s timeout, which would burn almost the entire polling budget (45s) in just 2-3 retries. The gate uses native `fetch()` with its own 1.5s `AbortController` timeout instead, allowing ~30 retry attempts within the budget on a slow PC.

**`CompanySetupGate` before the routed app** — A fresh install has zero company rows. Rather than let each page handle "no company" as an edge case, a single gate component detects this and shows the setup wizard before mounting any routes. After company creation, the gate falls through automatically — no page reload needed.

**Relative PDF paths stored in the database** — `Invoice.pdf_path` is stored relative to `APP_DATA_DIR` (e.g. `invoices/2026/July/SA-001.pdf`) rather than as an absolute path. This survives PC migrations, user renames, and OneDrive sync folder moves — the path is resolved at read time by joining with the current `APP_DATA_DIR`.

---

## Environment

| Variable | Value | Effect |
|---|---|---|
| `BILLSNAP_ENV` | `production` | Data written to `%APPDATA%\BillSnap\` |
| `BILLSNAP_ENV` | *(absent)* | Data written to `%APPDATA%\BillSnap-Dev\` |

Tauri sets `BILLSNAP_ENV=production` before spawning the sidecar. Running `uvicorn` directly in a terminal (no variable set) uses `BillSnap-Dev` — so dev and production data can never collide, even on the same machine.

---

## Contributing

Issues and pull requests are welcome. For significant changes, please open an issue first to discuss what you'd like to change.

```bash
# Run backend tests
cd backend && pytest

# Run frontend type check
cd frontend && npx tsc --noEmit

# Run frontend tests
cd frontend && npm test
```

---

## Roadmap

- [ ] GST Tax Invoice format (GSTIN, HSN codes, tax breakdown)
- [ ] Code signing (removes Windows SmartScreen warning)
- [ ] Auto-update mechanism via Tauri updater plugin
- [ ] Hindi language support
- [ ] Scheduled automatic backups
- [ ] Thermal printer support (58mm / 80mm receipt printers)

---

## License

MIT — see [LICENSE](LICENSE) for full text.

You can use BillSnap for any purpose, including commercial use. The only requirement is keeping the MIT License notice intact in any copies or derivative works.

---

## Built by

**Aditya Sharma**

[Portfolio](https://iaddy29.vercel.app) · [Twitter](https://twitter.com/iaddy29) · [Instagram](https://www.instagram.com/iaddy29/)

---

<div align="center">
  <sub>Made in India 🇮🇳 · Free forever · Your data never leaves your PC</sub>
</div>
