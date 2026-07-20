"""
Single source of truth for "where does BillSnap store its data".

Why this file exists
---------------------
Before this, six different files (db.py, pdf_service.py, excel_service.py,
backup_service.py, logger.py, invoice.py, export.py) each computed their
own BASE_DIR as `<this file's folder>/../../..`, i.e. "three levels up from
wherever this particular .py file happens to live". That only works while
BillSnap runs as `uvicorn main:app` from inside the project's backend/
folder — there's no such thing as "the project folder" once this code is
frozen into a packaged .exe by PyInstaller and launched by Tauri from
Program Files. BASE_DIR would silently point somewhere inside a temp
extraction folder instead of anywhere persistent.

This module fixes that by resolving ONE root folder, the same way, no
matter who imports it, and that root changes meaning based on how the app
was started:

  1. Packaged production app (started by Tauri)
       -> %APPDATA%\\BillSnap\\               (Windows)
       -> ~/.local/share/BillSnap/            (Linux, for completeness)
       -> ~/Library/Application Support/BillSnap/   (macOS, for completeness)
  2. Local development (`uvicorn main:app --reload`, run directly)
       -> %APPDATA%\\BillSnap-Dev\\            (same logic, different folder,
          so dev data and real shop data can never collide or overwrite
          each other)

How the app knows which mode it's in: Tauri sets the environment variable
BILLSNAP_ENV=production before it spawns the backend sidecar process. If
that variable is absent (e.g. you just ran `uvicorn` yourself in a
terminal), we assume dev mode. This means dev and production go through
the exact same code path for directory resolution — the only difference
is one string — so a bug in path handling shows up immediately while
coding, instead of only after a full Windows build-and-install cycle.

Every other file in the app should import APP_DATA_DIR (or the specific
subfolder constants below) from here instead of computing its own.
"""
import os
import sys

# ---------------------------------------------------------------------------
# 1. Decide which "mode" we're in.
# ---------------------------------------------------------------------------
_IS_PRODUCTION = os.environ.get("BILLSNAP_ENV", "").lower() == "production"
_APP_FOLDER_NAME = "BillSnap" if _IS_PRODUCTION else "BillSnap-Dev"


def _resolve_os_data_dir() -> str:
    """Returns the OS-appropriate per-user app-data root (without the
    BillSnap folder name appended yet)."""
    if sys.platform == "win32":
        # APPDATA is always set on real Windows; the getenv default only
        # matters for accidental runs under e.g. a misconfigured shell.
        return os.environ.get("APPDATA", os.path.expanduser("~"))
    elif sys.platform == "darwin":
        return os.path.expanduser("~/Library/Application Support")
    else:
        # Linux / other: follow the XDG base directory spec.
        return os.environ.get("XDG_DATA_HOME", os.path.expanduser("~/.local/share"))


# ---------------------------------------------------------------------------
# 2. The root BillSnap data folder, and every subfolder under it.
#    These names intentionally match the folder names BillSnap has always
#    used (database/, invoices/, exports/, backup/, logs/), so the only
#    thing that changed is the parent — everything below APP_DATA_DIR is
#    unchanged from before.
# ---------------------------------------------------------------------------
APP_DATA_DIR = os.path.join(_resolve_os_data_dir(), _APP_FOLDER_NAME)

DATABASE_DIR = os.path.join(APP_DATA_DIR, "database")
INVOICES_DIR = os.path.join(APP_DATA_DIR, "invoices")
EXPORTS_DIR = os.path.join(APP_DATA_DIR, "exports")
BACKUP_DIR = os.path.join(APP_DATA_DIR, "backup")
LOGS_DIR = os.path.join(APP_DATA_DIR, "logs")

DATABASE_PATH = os.path.join(DATABASE_DIR, "smartbill.db")

# Created eagerly (not lazily) because several modules read/write into
# these the moment they're imported (e.g. logger.py opens a log file at
# import time), before init_db()'s startup hook would otherwise run.
for _dir in (DATABASE_DIR, INVOICES_DIR, EXPORTS_DIR, BACKUP_DIR, LOGS_DIR):
    os.makedirs(_dir, exist_ok=True)
