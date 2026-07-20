"""Invoice API routes — /invoice/*"""
import os
from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.repositories.invoice_repo import InvoiceRepository
from app.services.invoice_service import InvoiceService
from app.schemas.schemas import (
    InvoiceCreate, InvoiceUpdate, InvoiceOut, InvoiceDetail, InvoiceItemOut, SuccessResponse, PathResponse
)
from app.utils.logger import log_event
from app.core.paths import APP_DATA_DIR as BASE_DIR

router = APIRouter(prefix="/invoice", tags=["invoice"])


def _to_detail(invoice) -> InvoiceDetail:
    items = [
        InvoiceItemOut(
            id=it.id, inventory_id=it.inventory_id, item_name=it.item_name,
            unit=it.unit, qty=it.qty, rate=it.rate, amount=round(it.qty * it.rate, 2),
        )
        for it in invoice.items
    ]
    detail = InvoiceDetail.model_validate(invoice)
    detail.company = invoice.company.value if hasattr(invoice.company, "value") else invoice.company
    detail.customer_name = invoice.customer.name if invoice.customer else ""
    detail.customer_phone = invoice.customer.phone if invoice.customer else ""
    detail.customer_address = invoice.customer.address if invoice.customer else ""
    detail.items = items
    return detail


@router.post("/create", response_model=InvoiceDetail)
def create_invoice(payload: InvoiceCreate, db: Session = Depends(get_db)):
    if not payload.items:
        raise HTTPException(400, "Invoice must have at least one item")
    service = InvoiceService(db)
    try:
        invoice = service.create_invoice(payload)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return _to_detail(invoice)


@router.put("/{invoice_id}", response_model=InvoiceDetail)
def update_invoice(invoice_id: int, payload: InvoiceUpdate, db: Session = Depends(get_db)):
    """
    Edits an existing invoice: customer, payment mode, remarks, and line
    items can all change. The invoice number and date stay fixed. Stock is
    automatically reconciled — old quantities are added back to inventory
    before the new quantities are deducted, so this is safe to call
    multiple times on the same invoice.
    """
    if not payload.items:
        raise HTTPException(400, "Invoice must have at least one item")
    service = InvoiceService(db)
    try:
        invoice = service.update_invoice(invoice_id, payload)
    except ValueError as e:
        message = str(e)
        status = 404 if message == "Invoice not found" else 400
        raise HTTPException(status, message)
    return _to_detail(invoice)


@router.get("/list", response_model=list[InvoiceOut])
def list_invoices(
    company: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    customer_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    repo = InvoiceRepository(db)
    invoices = repo.list(company=company, date_from=date_from, date_to=date_to, customer_id=customer_id)
    out = []
    for inv in invoices:
        o = InvoiceOut.model_validate(inv)
        o.company = inv.company.value if hasattr(inv.company, "value") else inv.company
        o.customer_name = inv.customer.name if inv.customer else ""
        out.append(o)
    return out


@router.get("/{invoice_id}", response_model=InvoiceDetail)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    repo = InvoiceRepository(db)
    invoice = repo.get(invoice_id)
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    return _to_detail(invoice)


@router.delete("/{invoice_id}", response_model=SuccessResponse)
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    repo = InvoiceRepository(db)
    ok = repo.delete(invoice_id)
    if not ok:
        raise HTTPException(404, "Invoice not found")
    log_event("INFO", f"Invoice deleted: id={invoice_id}", db)
    return SuccessResponse(success=True, message="Invoice deleted")


@router.get("/{invoice_id}/pdf")
def get_invoice_pdf(invoice_id: int, db: Session = Depends(get_db)):
    repo = InvoiceRepository(db)
    invoice = repo.get(invoice_id)
    if not invoice or not invoice.pdf_path:
        raise HTTPException(404, "PDF not found for this invoice")
    return PathResponse(path=invoice.pdf_path)


@router.get("/{invoice_id}/pdf/view")
def view_invoice_pdf(invoice_id: int, db: Session = Depends(get_db)):
    """Streams the PDF for in-browser viewing/printing — Content-Disposition
    is 'inline' so the browser opens its native PDF viewer instead of
    downloading. Used by the frontend's Print button."""
    repo = InvoiceRepository(db)
    invoice = repo.get(invoice_id)
    if not invoice or not invoice.pdf_path:
        raise HTTPException(404, "PDF not found for this invoice")

    full_path = os.path.join(BASE_DIR, invoice.pdf_path)
    if not os.path.exists(full_path):
        raise HTTPException(404, "PDF file is missing on disk")

    return FileResponse(
        full_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{invoice.invoice_number}.pdf"'},
    )


@router.get("/{invoice_id}/pdf/file")
def download_invoice_pdf(invoice_id: int, db: Session = Depends(get_db)):
    """Streams the PDF with Content-Disposition: attachment, which forces
    the browser to save it rather than display it — used by the frontend's
    Download button. Setting this explicitly matters: FastAPI's
    FileResponse defaults to 'inline' even when a filename is passed, so a
    plain <a download> link to this URL is not enough on its own."""
    repo = InvoiceRepository(db)
    invoice = repo.get(invoice_id)
    if not invoice or not invoice.pdf_path:
        raise HTTPException(404, "PDF not found for this invoice")

    full_path = os.path.join(BASE_DIR, invoice.pdf_path)
    if not os.path.exists(full_path):
        raise HTTPException(404, "PDF file is missing on disk")

    return FileResponse(
        full_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{invoice.invoice_number}.pdf"'},
    )
