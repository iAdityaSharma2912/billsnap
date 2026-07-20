"""
Logging utility for BillSnap.
Writes INFO/WARNING/ERROR/CRITICAL to both a daily rotating file
(logs/YYYY-MM-DD.log) and the app_logs DB table, so they're viewable
from Settings → Logs in the UI.
"""
import os
import logging
from datetime import datetime, timedelta

from app.core.paths import LOGS_DIR


def _file_handler():
    log_file = os.path.join(LOGS_DIR, f"{datetime.now().strftime('%Y-%m-%d')}.log")
    handler = logging.FileHandler(log_file, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(message)s"))
    return handler


_logger = logging.getLogger("billsnap")
_logger.setLevel(logging.INFO)
if not _logger.handlers:
    _logger.addHandler(_file_handler())
    _logger.addHandler(logging.StreamHandler())


def log_event(level: str, message: str, db=None):
    """Log to file + console, and optionally persist to app_logs table."""
    level = level.upper()
    getattr(_logger, level.lower(), _logger.info)(message)

    if db is not None:
        try:
            from app.models.models import AppLog, LogLevel
            db.add(AppLog(level=LogLevel(level), message=message))
            db.commit()
        except Exception:
            db.rollback()


def archive_old_logs(days: int = 30):
    """Move log files older than `days` into logs/archive/."""
    archive_dir = os.path.join(LOGS_DIR, "archive")
    os.makedirs(archive_dir, exist_ok=True)
    cutoff = datetime.now() - timedelta(days=days)

    for fname in os.listdir(LOGS_DIR):
        fpath = os.path.join(LOGS_DIR, fname)
        if not fname.endswith(".log") or not os.path.isfile(fpath):
            continue
        try:
            file_date = datetime.strptime(fname.replace(".log", ""), "%Y-%m-%d")
            if file_date < cutoff:
                os.rename(fpath, os.path.join(archive_dir, fname))
        except ValueError:
            continue
