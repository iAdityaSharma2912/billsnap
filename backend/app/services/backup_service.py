"""
Backup & restore service.
Backup ZIP contains: smartbill.db, Invoices/, Exports/, Settings export.
Filename: BillSnap-Backup-YYYYMMDD.zip, saved to Backup/.
"""
import os
import json
import shutil
import zipfile
from datetime import datetime

from app.core.paths import APP_DATA_DIR, DATABASE_PATH, INVOICES_DIR, EXPORTS_DIR, BACKUP_DIR

# Kept as BASE_DIR for backward compatibility — see pdf_service.py for why.
BASE_DIR = APP_DATA_DIR


def create_backup(settings_rows: list) -> str:
    os.makedirs(BACKUP_DIR, exist_ok=True)
    today = datetime.now().strftime("%Y%m%d")
    zip_path = os.path.join(BACKUP_DIR, f"BillSnap-Backup-{today}.zip")

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        if os.path.exists(DATABASE_PATH):
            zf.write(DATABASE_PATH, arcname="smartbill.db")

        if os.path.isdir(INVOICES_DIR):
            for root, _, files in os.walk(INVOICES_DIR):
                for f in files:
                    fp = os.path.join(root, f)
                    arc = os.path.join("Invoices", os.path.relpath(fp, INVOICES_DIR))
                    zf.write(fp, arcname=arc)

        if os.path.isdir(EXPORTS_DIR):
            for root, _, files in os.walk(EXPORTS_DIR):
                for f in files:
                    fp = os.path.join(root, f)
                    arc = os.path.join("Exports", os.path.relpath(fp, EXPORTS_DIR))
                    zf.write(fp, arcname=arc)

        settings_json = json.dumps(settings_rows, indent=2, default=str)
        zf.writestr("Settings/settings.json", settings_json)

    return os.path.relpath(zip_path, BASE_DIR)


def restore_backup(zip_path: str) -> dict:
    """
    Extracts the ZIP and restores db file + Invoices/ + Exports/.
    Caller is responsible for closing DB connections before calling this,
    and re-initializing them after.
    """
    if not os.path.exists(zip_path):
        raise FileNotFoundError(f"Backup file not found: {zip_path}")

    restored = {"db": False, "invoices": 0, "exports": 0}

    with zipfile.ZipFile(zip_path, "r") as zf:
        tmp_dir = os.path.join(BACKUP_DIR, "_restore_tmp")
        if os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir)
        zf.extractall(tmp_dir)

        db_src = os.path.join(tmp_dir, "smartbill.db")
        if os.path.exists(db_src):
            shutil.copy2(db_src, DATABASE_PATH)
            restored["db"] = True

        inv_src = os.path.join(tmp_dir, "Invoices")
        if os.path.isdir(inv_src):
            shutil.copytree(inv_src, INVOICES_DIR, dirs_exist_ok=True)
            restored["invoices"] = sum(len(files) for _, _, files in os.walk(inv_src))

        exp_src = os.path.join(tmp_dir, "Exports")
        if os.path.isdir(exp_src):
            shutil.copytree(exp_src, EXPORTS_DIR, dirs_exist_ok=True)
            restored["exports"] = sum(len(files) for _, _, files in os.walk(exp_src))

        shutil.rmtree(tmp_dir)

    return restored


def list_backups() -> list:
    if not os.path.isdir(BACKUP_DIR):
        return []
    return sorted(
        [f for f in os.listdir(BACKUP_DIR) if f.endswith(".zip")],
        reverse=True,
    )
