"""
BillSnap backend — FastAPI app entry point.
Run with: uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database.db import init_db
from app.utils.logger import log_event, archive_old_logs
from app.api import customer, invoice, inventory, report, export, backup, settings_api

app = FastAPI(
    title="BillSnap API",
    description="Offline billing & inventory system for small businesses",
    version="1.0.0",
)

# Tauri/Vite dev server runs on localhost — allow it to call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1420", "http://localhost:5173", "tauri://localhost", "https://tauri.localhost"],

    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(customer.router)
app.include_router(invoice.router)
app.include_router(inventory.router)
app.include_router(report.router)
app.include_router(export.router)
app.include_router(backup.router)
app.include_router(settings_api.router)


@app.on_event("startup")
def on_startup():
    init_db()
    archive_old_logs(days=30)
    log_event("INFO", "BillSnap backend started")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log_event("ERROR", f"Unhandled exception on {request.url.path}: {exc}")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/")
def root():
    return {"status": "ok", "app": "BillSnap API", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    # Reached only when this file is executed directly — i.e. the
    # packaged PyInstaller .exe (Tauri spawns it this way), or someone
    # running `python main.py` by hand. It is NOT reached during normal
    # development, where you run `uvicorn main:app --reload --port 8000`
    # — in that case the uvicorn CLI imports this file and serves `app`
    # itself, so this block never executes and --reload (which needs the
    # CLI's file-watcher) keeps working exactly as before.
    #
    # No --reload here on purpose: hot-reload relies on a file-watcher
    # that has no meaning inside a frozen, packaged executable where the
    # "source files" don't exist as separate files to watch.
    #
    # The try/except below exists specifically because the packaged
    # app's console window is hidden (see src-tauri's sidecar spawn
    # config) — with no visible terminal, an exception raised here
    # (e.g. uvicorn.run() failing because the port is already in use, or
    # a PyInstaller bundling gap surfacing as an ImportError that only
    # shows up at runtime, not at build time) would otherwise vanish
    # with zero trace anywhere. app.exception_handler() above does NOT
    # cover this: that only catches errors raised *during a request*,
    # after the server has already started successfully. This is the
    # one safety net for everything before that point.
    import os
    import sys
    import traceback
    from datetime import datetime
    from app.core.paths import LOGS_DIR

    try:
        import uvicorn
        uvicorn.run(app, host="127.0.0.1", port=8000)
    except Exception:
        crash_log = os.path.join(LOGS_DIR, "startup-crash.log")
        with open(crash_log, "a", encoding="utf-8") as f:
            f.write(f"\n--- Startup crash at {datetime.now().isoformat()} ---\n")
            f.write(traceback.format_exc())
        sys.exit(1)
