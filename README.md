# BillSnap

Offline billing, inventory, and customer management — now a **native
Windows desktop app** (no browser, no terminals, single installer).
Originally built as a local web app; see `docs/ARCHITECTURE.md` for the
full migration story.

No internet, no cloud, no monthly fees — everything runs on the PC it's
installed on. Each shop/business gets its own separate install with its
own independent database; nothing is shared between installs.

## Requirements

**To use BillSnap (end users):** nothing — the installer includes
everything needed. See `docs/INSTALLATION.md` Part C.

**To build BillSnap from source (developers):** Python 3.11/3.12,
Node.js 18+, Rust, and the Tauri CLI. See `docs/INSTALLATION.md` Part A
for the complete from-scratch setup.

## Quick start (development)

```powershell
# Desktop app (what end users get):
.\scripts\build-backend.ps1
cargo tauri dev

# OR plain web app, for faster frontend-only iteration:
```

Open **two terminals** for the web-app route.

**Terminal 1 — backend:**
```bash
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
Backend is now running at http://localhost:8000 (API docs at `/docs`).

**Terminal 2 — frontend:**
```bash
cd frontend
npm install
npm run dev
```
Open the URL it prints (http://localhost:1420) in your browser.

A fresh database starts with **zero companies** — you'll see a
"Welcome to BillSnap" setup screen prompting you to create the first
one. (Earlier versions of this project auto-seeded "Sharma Agency" and
"Sharma Electricals" — that was removed once each shop started getting
its own separate install, since hardcoding either company into every
install would be wrong for one of them. See `docs/ARCHITECTURE.md`.)

## Project structure

```
billsnap/
├── backend/                  FastAPI + SQLAlchemy + SQLite
│   ├── main.py                Entry point — uvicorn (dev) or direct exe (packaged)
│   ├── billsnap-backend.spec  PyInstaller build config (--onefile)
│   ├── app/
│   │   ├── api/                Route handlers (customer, invoice, inventory, ...)
│   │   ├── core/                 paths.py — single source of truth for %APPDATA% locations
│   │   ├── models/              SQLAlchemy ORM models (7 tables)
│   │   ├── schemas/             Pydantic request/response schemas
│   │   ├── repositories/        Data-access layer
│   │   ├── services/            Business logic (PDF, Excel, backup, invoice)
│   │   ├── database/            DB engine/session setup
│   │   └── utils/                Logger, invoice number generator
│   └── tests/                  pytest test suite
├── frontend/                  React + TypeScript + Vite + Tailwind
│   └── src/
│       ├── pages/               One file per screen (+ CompanySetup.tsx, first-run wizard)
│       ├── components/          layout/ invoice/ shared/ settings/
│       ├── store/                Zustand stores (+ preferencesStore.ts)
│       ├── services/             axios API clients (+ tauriApi.ts, desktop-only bridge)
│       ├── hooks/                useDebounce, useKeyboard
│       └── types/                Shared TypeScript interfaces
├── src-tauri/                 Rust desktop shell
│   ├── src/main.rs              Window lifecycle, sidecar spawn/kill
│   ├── src/sidecar.rs            Backend process management
│   ├── src/commands.rs           Custom commands callable from React (open folder, get data dir)
│   ├── tauri.conf.json           Window, icon, installer config
│   ├── icons/                    App icon (5 formats, generated from Logo.tsx's brand mark)
│   └── binaries/                 PyInstaller output lands here (gitignored, built locally)
├── scripts/                   PowerShell build automation
│   ├── build-backend.ps1        Backend -> PyInstaller -> correctly-named sidecar
│   └── build-all.ps1            Full pipeline -> finished installer
├── docs/                      Architecture, schema, troubleshooting, installation guide
└── README.md                 You are here
```

## Running the tests

**Backend (pytest):**
```bash
cd backend
source venv/bin/activate   # or venv\Scripts\activate on Windows
pytest tests/ -v
```

**Frontend (vitest):**
```bash
cd frontend
npm test
```

## Core workflow

1. **Dashboard** — pick a company tab, see today's sales, invoice count,
   low-stock alerts, and recent invoices.
2. **New invoice** (`Ctrl+N`) — search or create a customer, type an item
   name to get instant autocomplete from that company's inventory, fill
   qty/rate, the total updates live. Typing a brand-new item name (no
   autocomplete match) automatically adds it to that company's inventory
   list at zero stock, so it's searchable next time. `Ctrl+S` saves the
   invoice and generates the PDF in one step — a dialog then offers
   **Print** and **Download** for that PDF immediately.
3. **Invoice history** — filter by company/date, click a row to see full
   line items, and use the **Print** / **Download** buttons there too.
4. **Customers** — simple CRUD screens with search.
5. **Inventory** — scoped per company: each company (Sharma Agency, Sharma
   Electricals, or any company you add later) has its own independent item
   list and stock numbers. Switch companies with the tabs at the top. Rows
   under their minimum stock are highlighted in red.
6. **Reports** — daily and monthly breakdowns: totals, top customers, top
   items, payment-mode split.
7. **Export** (`Ctrl+E`) — generates a formatted `.xlsx` with bold headers,
   auto column widths, and filters enabled, saved under `backend/exports/`.
8. **Backup** (`Ctrl+B`) — zips the database, all invoice PDFs, exports, and
   settings into one file and **downloads it straight to your computer**.
   To restore, click **Browse & restore ZIP file** and pick any previously
   downloaded backup ZIP from your computer — no server-side filename
   needed.
9. **Settings** — has three tabs:
   - **Companies**: add a brand-new company (short code + name + address +
     phone + UPI/bank details), or click an existing company to edit its
     details. Deleting a company is blocked if it already has invoices.
   - **Logs**: a live viewer of recent application log entries.
   - **System** (desktop app only): toggle low-stock desktop notifications,
     view/open the app's data folder, and see the app version.

## Adding a new company

Go to **Settings → Companies → Add company**. Give it a short code (used
in invoice numbers, e.g. `GS` → invoices like `GS-20260624-001`) and a
name. It immediately appears as a new tab everywhere — Dashboard,
Inventory, New invoice, Export — with its own independent inventory and
invoice numbering, no restart needed.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+N` | New invoice (from anywhere) |
| `Ctrl+S` | Save invoice + generate PDF |
| `Ctrl+E` | Open export screen |
| `Ctrl+B` | Create & download backup now |
| `Enter` (in item row) | Add the current line item |
| `Esc` | Close the open modal |

## Where files end up

**Desktop app:** everything lives under `%APPDATA%\BillSnap\`
(production) or `%APPDATA%\BillSnap-Dev\` (development) — see
`backend/app/core/paths.py` for the exact resolution logic, or
Settings → System → "Open data folder" in the running app.
- Database: `%APPDATA%\BillSnap\database\smartbill.db`
- Invoice PDFs: `%APPDATA%\BillSnap\invoices\<year>\<month>\<INVOICE-NUMBER>.pdf`
- Excel exports: `%APPDATA%\BillSnap\exports\<year>\<month>\Invoices-Export-*.xlsx`
- Backups: `%APPDATA%\BillSnap\backup\BillSnap-Backup-<date>.zip`
- Logs: `%APPDATA%\BillSnap\logs\<date>.log`, auto-archived after 30 days

**Web-app dev mode** (running `uvicorn` directly, not through the
desktop shell): same structure, but under your OS's equivalent app-data
folder with a `-Dev` suffix (e.g. `~/.local/share/BillSnap-Dev/` on
Linux) — kept separate from production data so testing never risks
overwriting real shop data.

## API reference

Once the backend is running, open **http://localhost:8000/docs** for the
full interactive Swagger UI covering every endpoint (customer, invoice,
inventory, report, export, backup, settings/companies).

## Desktop packaging

This project ships as a Tauri-based Windows desktop app — see
`docs/ARCHITECTURE.md` for the full system design and
`docs/INSTALLATION.md` for build/install instructions. The backend
(FastAPI) is packaged with PyInstaller into a sidecar executable that
Tauri's Rust shell spawns and manages automatically; the frontend
(React) is built as static files and rendered in a native WebView2
window. No browser, no manual server startup, no terminals for the end
user.

## Documentation

- `docs/INSTALLATION.md` — complete from-scratch setup, build, and shop-PC install guide
- `docs/ARCHITECTURE.md` — system diagram and what changed in the web-to-desktop migration
- `docs/DATABASE_SCHEMA.md` — table structure, ER diagram, migration approach
- `docs/DEVELOPER_GUIDE.md` — codebase patterns, how to add a new field/module, stock reconciliation logic
- `docs/USER_MANUAL.md` — day-to-day usage guide for billing staff and shop owners
- `docs/TROUBLESHOOTING.md` — known failure modes and fixes
- `docs/FUTURE_IMPROVEMENTS.md` — known gaps and suggested next steps

## Notes on scope

This build implements every module from the plan except the Tally import
column-mapping backend (the UI screen and file picker exist at
`/import`; wiring it to a `/import/*` API with fuzzy match-and-preview logic
is straightforward to add following the same repository/service pattern
used for customers and inventory, but was left as a stub since it depends on
a sample Tally export file to map columns against correctly).
