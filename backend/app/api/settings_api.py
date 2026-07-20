"""
Settings API routes — /settings/*

The Settings table is effectively the "Companies" table: each row is one
company (Sharma Agency, Sharma Electricals, or any new one added later).
/settings/companies/create lets the UI add a brand-new company at runtime —
no code change, no schema migration. Every other module (inventory,
invoices) validates against this table to know which company_key values
are valid.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.models.models import Settings, AppLog
from app.schemas.schemas import SettingsOut, SettingsUpdate, CompanyCreate, SuccessResponse

router = APIRouter(prefix="/settings", tags=["settings"])


def _to_out(s: Settings) -> SettingsOut:
    return SettingsOut.model_validate(s)


@router.get("/list", response_model=list[SettingsOut])
def list_settings(db: Session = Depends(get_db)):
    """Returns every company currently configured — used to populate the
    company tabs/dropdowns throughout the app."""
    return [_to_out(s) for s in db.query(Settings).order_by(Settings.id.asc()).all()]


@router.post("/companies/create", response_model=SettingsOut)
def create_company(payload: CompanyCreate, db: Session = Depends(get_db)):
    key = payload.company_key.strip().upper()
    existing = db.query(Settings).filter(Settings.company_key == key).first()
    if existing:
        raise HTTPException(400, f"Company key '{key}' already exists")

    company = Settings(
        company_key=key,
        company_name=payload.company_name.strip(),
        address=payload.address or "",
        phone=payload.phone or "",
        bank_details=payload.bank_details,
        upi_id=payload.upi_id,
        show_payment_block=payload.show_payment_block,
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return _to_out(company)


@router.delete("/companies/{company_key}", response_model=SuccessResponse)
def delete_company(company_key: str, db: Session = Depends(get_db)):
    from app.models.models import Invoice, Inventory

    company = db.query(Settings).filter(Settings.company_key == company_key).first()
    if not company:
        raise HTTPException(404, "Company not found")

    if db.query(Settings).count() <= 1:
        raise HTTPException(400, "At least one company must remain")

    invoice_count = db.query(Invoice).filter(Invoice.company == company_key).count()
    if invoice_count > 0:
        raise HTTPException(
            400,
            f"Cannot delete '{company.company_name}': it has {invoice_count} existing invoice(s).",
        )

    # safe to remove orphaned inventory for this company along with it
    db.query(Inventory).filter(Inventory.company_key == company_key).delete()
    db.delete(company)
    db.commit()
    return SuccessResponse(success=True, message="Company deleted")


@router.get("/logs/recent")
def recent_logs(limit: int = 100, db: Session = Depends(get_db)):
    logs = db.query(AppLog).order_by(AppLog.logged_at.desc()).limit(limit).all()
    return [
        {"id": l.id, "level": l.level.value if hasattr(l.level, "value") else l.level,
         "message": l.message, "logged_at": l.logged_at.isoformat()}
        for l in logs
    ]


@router.get("/{company_key}", response_model=SettingsOut)
def get_settings(company_key: str, db: Session = Depends(get_db)):
    s = db.query(Settings).filter(Settings.company_key == company_key).first()
    if not s:
        raise HTTPException(404, "Settings not found")
    return _to_out(s)


@router.put("/{company_key}", response_model=SettingsOut)
def update_settings(company_key: str, payload: SettingsUpdate, db: Session = Depends(get_db)):
    s = db.query(Settings).filter(Settings.company_key == company_key).first()
    if not s:
        raise HTTPException(404, "Settings not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(s, key, value)
    db.commit()
    db.refresh(s)
    return _to_out(s)
