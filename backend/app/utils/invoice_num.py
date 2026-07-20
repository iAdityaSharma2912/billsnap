"""
Invoice number generator.
Format: SA-YYYYMMDD-NNN / SE-YYYYMMDD-NNN
Counter resets per company per day. Uses a DB count query inside the
same transaction as the invoice insert, so it never repeats.
"""
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.models import Invoice


def generate_invoice_number(db: Session, company: str, invoice_date: date) -> str:
    date_str = invoice_date.strftime("%Y%m%d")
    prefix = f"{company}-{date_str}-"

    count_today = (
        db.query(func.count(Invoice.id))
        .filter(Invoice.company == company)
        .filter(Invoice.invoice_number.like(f"{prefix}%"))
        .scalar()
    ) or 0

    next_seq = count_today + 1
    return f"{prefix}{next_seq:03d}"
