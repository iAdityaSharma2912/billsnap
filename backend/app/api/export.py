"""Export API routes — /export/*"""
import os
from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.repositories.invoice_repo import InvoiceRepository
from app.services.excel_service import export_invoices_to_excel
from app.core.paths import APP_DATA_DIR as BASE_DIR
from app.schemas.schemas import PathResponse
from app.utils.logger import log_event

router = APIRouter(prefix="/export", tags=["export"])


@router.post("/excel", response_model=PathResponse)
def export_excel(
    company: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
):
    repo = InvoiceRepository(db)
    invoices = repo.list(company=company, date_from=date_from, date_to=date_to)
    path = export_invoices_to_excel(invoices)
    log_event("INFO", f"Excel export generated: {path} ({len(invoices)} invoices)", db)
    return PathResponse(path=path)


@router.get("/excel/download")
def download_excel(path: str):
    """
    Streams the generated .xlsx file with Content-Disposition: attachment
    so the browser actually saves it, rather than just reporting where it
    sits on the server's disk. `path` is the relative path returned by
    POST /export/excel (e.g. "exports/2026/June/Invoices-Export-....xlsx").

    Restricted to the exports/ directory to prevent path traversal — any
    path outside it (e.g. "../../database/smartbill.db") is rejected.
    """
    exports_root = os.path.join(BASE_DIR, "exports")
    full_path = os.path.normpath(os.path.join(BASE_DIR, path))

    if not full_path.startswith(os.path.normpath(exports_root)):
        raise HTTPException(400, "Invalid export path")
    if not os.path.exists(full_path):
        raise HTTPException(404, "Export file not found")

    filename = os.path.basename(full_path)
    return FileResponse(
        full_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
