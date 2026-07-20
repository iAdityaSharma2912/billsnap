"""Repository layer for Invoice — data access, joins, and filters."""
from typing import Optional, List
from datetime import date
from sqlalchemy.orm import Session, joinedload

from app.models.models import Invoice, InvoiceItem


class InvoiceRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, invoice: Invoice, items: List[InvoiceItem]) -> Invoice:
        self.db.add(invoice)
        self.db.flush()  # get invoice.id without full commit
        for item in items:
            item.invoice_id = invoice.id
            self.db.add(item)
        self.db.commit()
        self.db.refresh(invoice)
        return invoice

    def get(self, invoice_id: int) -> Optional[Invoice]:
        return (
            self.db.query(Invoice)
            .options(joinedload(Invoice.items), joinedload(Invoice.customer))
            .filter(Invoice.id == invoice_id)
            .first()
        )

    def list(
        self,
        company: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        customer_id: Optional[int] = None,
    ) -> List[Invoice]:
        query = self.db.query(Invoice).options(joinedload(Invoice.customer))
        if company:
            query = query.filter(Invoice.company == company)
        if date_from:
            query = query.filter(Invoice.invoice_date >= date_from)
        if date_to:
            query = query.filter(Invoice.invoice_date <= date_to)
        if customer_id:
            query = query.filter(Invoice.customer_id == customer_id)
        return query.order_by(Invoice.created_at.desc()).all()

    def delete(self, invoice_id: int) -> bool:
        invoice = self.get(invoice_id)
        if not invoice:
            return False
        self.db.delete(invoice)
        self.db.commit()
        return True
