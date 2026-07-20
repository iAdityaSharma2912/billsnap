"""Backup & restore API routes — /backup/*

- POST /backup/create        creates a ZIP on disk, returns its path
- GET  /backup/download/{name}  streams that ZIP for the browser to download
- GET  /backup/list           lists previously created backups on disk
- POST /backup/restore        restores from an uploaded ZIP file (browse +
                               upload from the frontend, not a server path)
"""
import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database.db import get_db, engine, SessionLocal
from app.models.models import Settings
from app.services.backup_service import create_backup, restore_backup, list_backups, BACKUP_DIR
from app.schemas.schemas import PathResponse, SuccessResponse
from app.utils.logger import log_event

router = APIRouter(prefix="/backup", tags=["backup"])


@router.post("/create", response_model=PathResponse)
def backup_create(db: Session = Depends(get_db)):
    settings_rows = [
        {
            "company_key": s.company_key,
            "company_name": s.company_name,
            "address": s.address,
            "phone": s.phone,
            "bank_details": s.bank_details,
            "upi_id": s.upi_id,
        }
        for s in db.query(Settings).all()
    ]
    path = create_backup(settings_rows)
    log_event("INFO", f"Backup created: {path}", db)
    return PathResponse(path=path)


@router.get("/list")
def backup_list():
    return {"backups": list_backups()}


@router.get("/download/{filename}")
def backup_download(filename: str):
    """Streams the ZIP with Content-Disposition: attachment so the browser
    saves it rather than trying to display it — used by the frontend's
    Download button right after a backup is created, and for any backup in
    the list."""
    safe_name = os.path.basename(filename)  # prevent path traversal
    zip_path = os.path.join(BACKUP_DIR, safe_name)
    if not os.path.exists(zip_path):
        raise HTTPException(404, "Backup file not found")
    return FileResponse(
        zip_path,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


@router.post("/restore", response_model=SuccessResponse)
async def backup_restore(file: UploadFile = File(...)):
    """Restores from a ZIP the user browsed to and uploaded from their own
    machine — not a filename already sitting on the server."""
    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(400, "Please upload a .zip backup file")

    os.makedirs(BACKUP_DIR, exist_ok=True)
    upload_path = os.path.join(BACKUP_DIR, f"_uploaded_{file.filename}")

    try:
        with open(upload_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # close current connections before swapping the db file
        engine.dispose()
        try:
            result = restore_backup(upload_path)
        except Exception as e:
            raise HTTPException(500, f"Restore failed: {e}")
    finally:
        if os.path.exists(upload_path):
            os.remove(upload_path)

    db = SessionLocal()
    log_event("INFO", f"Backup restored from uploaded file '{file.filename}': {result}", db)
    db.close()

    return SuccessResponse(success=True, message=f"Restored: {result}")
