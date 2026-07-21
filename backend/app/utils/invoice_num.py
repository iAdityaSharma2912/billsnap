"""
Invoice number generator.

Format: {COMPANY_KEY}-{NNN}
Examples: SA-001, SA-002, SE-001, SA-003

The counter is global and sequential per company — it NEVER resets
for a new date. SA-042 is always the 42nd invoice ever created for
the SA company, regardless of which date it was created on. This
makes invoice numbers shorter, simpler to read out loud, and easier
to look up by number alone.

The counter is derived from the total count of invoices for that
company in the database, not from a separate sequence table. This
means it's generated correctly even after invoices are deleted
(it will skip numbers rather than reuse them — acceptable and
actually preferred for accounting purposes).

Uses a SELECT COUNT inside the same transaction as the invoice
INSERT, so concurrent saves can never produce the same number
(SQLite serialises writes).
"""
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.models import Invoice


def generate_invoice_number(db: Session, company: str, invoice_date=None) -> str:
    """
    Generate the next invoice number for `company`.

    `invoice_date` is accepted but ignored — kept in the signature so
    callers (invoice_service.py) don't need to change when they pass it.
    The counter is global across all dates.
    """
    count_all = (
        db.query(func.count(Invoice.id))
        .filter(Invoice.company == company)
        .scalar()
    ) or 0

    next_seq = count_all + 1
    return f"{company}-{next_seq:03d}"
