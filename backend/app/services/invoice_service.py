"""
Invoice service — the core business logic.

create_invoice(): invoice number generation -> resolve/save items ->
auto-add unmatched items to inventory -> auto-reduce stock for matched
items -> generate PDF -> log.

update_invoice(): reverses stock for the invoice's OLD items (using the
stock_deducted flag recorded at save time, so reversal is exact even
across multiple edits), replaces the item list, re-resolves/deducts stock
for the NEW items, regenerates the PDF, and keeps the original invoice
number and date unchanged.
"""
from datetime import date
from sqlalchemy.orm import Session

from app.models.models import Invoice, InvoiceItem, Customer, Settings
from app.utils.invoice_num import generate_invoice_number
from app.utils.logger import log_event
from app.services.pdf_service import generate_invoice_pdf
from app.repositories.invoice_repo import InvoiceRepository
from app.repositories.inventory_repo import InventoryRepository


class InvoiceService:
    def __init__(self, db: Session):
        self.db = db
        self.invoice_repo = InvoiceRepository(db)
        self.inventory_repo = InventoryRepository(db)

    def _resolve_items(self, company: str, item_lines) -> tuple[list[InvoiceItem], float]:
        """
        Shared resolution logic used by both create and update: for each
        line, figures out which inventory row it belongs to (auto-creating
        a zero-stock one if it's brand new), builds the InvoiceItem rows,
        and returns them alongside the computed grand total. Does NOT
        touch stock yet — deduction happens in a separate pass so the
        caller can choose when (immediately for create; after reversing
        old stock, for update).
        """
        items: list[InvoiceItem] = []
        grand_total = 0.0

        for it in item_lines:
            amount = round(it.qty * it.rate, 2)
            grand_total += amount

            inventory_id = it.inventory_id
            deduct = bool(inventory_id)  # explicit autocomplete pick -> always deduct

            if not inventory_id:
                # Item typed ad hoc (no autocomplete pick attached). Look it
                # up by name in this company's inventory:
                #   - if it already exists, link to it and deduct stock just
                #     like a normal pick (the person is selling real stock,
                #     they just didn't use the dropdown);
                #   - if it doesn't exist, create it at zero stock so it's
                #     searchable next time, and skip deduction (nothing to
                #     deduct from).
                existing = self.inventory_repo.get_by_name(company, it.item_name)
                if existing:
                    inventory_id = existing.id
                    deduct = True
                else:
                    inv_item = self.inventory_repo.get_or_create_from_invoice_line(
                        company_key=company,
                        item_name=it.item_name,
                        unit=it.unit,
                        rate=it.rate,
                    )
                    inventory_id = inv_item.id
                    deduct = False

            items.append(InvoiceItem(
                inventory_id=inventory_id,
                item_name=it.item_name,
                unit=it.unit,
                qty=it.qty,
                rate=it.rate,
                stock_deducted=1 if deduct else 0,
            ))

        return items, round(grand_total, 2)

    def _apply_stock_deductions(self, items: list[InvoiceItem]):
        """Subtracts qty from inventory stock for every item flagged
        stock_deducted=1. Call only once per set of items being newly
        applied (i.e. after they've been committed with real ids)."""
        for item in items:
            if item.stock_deducted and item.inventory_id:
                self.inventory_repo.adjust_stock(item.inventory_id, -item.qty)

    def _reverse_stock_deductions(self, items):
        """Adds qty back to inventory stock for every item that had it
        deducted — the exact inverse of _apply_stock_deductions(), used
        before replacing an invoice's items during an edit."""
        for item in items:
            if item.stock_deducted and item.inventory_id:
                self.inventory_repo.adjust_stock(item.inventory_id, item.qty)

    def create_invoice(self, payload) -> Invoice:
        customer = self.db.query(Customer).filter(Customer.id == payload.customer_id).first()
        if not customer:
            raise ValueError("Customer not found")

        company_settings = self.db.query(Settings).filter(Settings.company_key == payload.company).first()
        if not company_settings:
            raise ValueError(f"Unknown company '{payload.company}'. Add it in Settings → Companies first.")

        inv_date = payload.invoice_date or date.today()
        invoice_number = generate_invoice_number(self.db, payload.company, inv_date)

        items, grand_total = self._resolve_items(payload.company, payload.items)

        invoice = Invoice(
            invoice_number=invoice_number,
            company=payload.company,
            customer_id=payload.customer_id,
            invoice_date=inv_date,
            grand_total=grand_total,
            payment_mode=payload.payment_mode,
            remarks=payload.remarks,
        )

        invoice = self.invoice_repo.create(invoice, items)
        self._apply_stock_deductions(invoice.items)
        self._regenerate_pdf(invoice, customer, company_settings)
        return invoice

    def update_invoice(self, invoice_id: int, payload) -> Invoice:
        """
        Edits an existing invoice's customer, payment mode, remarks, and
        line items. The invoice number and original invoice date are kept
        unchanged — editing a mistake shouldn't make it look like a new
        sale happened. Stock is reconciled exactly: old deductions are
        reversed first, then the new item list is resolved and deducted
        fresh, so quantity changes, removed items, and newly added items
        all net out correctly regardless of how many times an invoice is
        edited.
        """
        invoice = self.invoice_repo.get(invoice_id)
        if not invoice:
            raise ValueError("Invoice not found")

        customer = self.db.query(Customer).filter(Customer.id == payload.customer_id).first()
        if not customer:
            raise ValueError("Customer not found")

        company_settings = self.db.query(Settings).filter(Settings.company_key == invoice.company).first()
        if not company_settings:
            raise ValueError(f"Unknown company '{invoice.company}'.")

        # Reverse stock for the old line items before replacing them.
        self._reverse_stock_deductions(invoice.items)

        # Replace the item list. The cascade="all, delete-orphan" on
        # Invoice.items means clearing this list and committing deletes
        # the old InvoiceItem rows.
        new_items, grand_total = self._resolve_items(invoice.company, payload.items)
        invoice.items.clear()
        self.db.flush()

        invoice.customer_id = payload.customer_id
        invoice.payment_mode = payload.payment_mode
        invoice.remarks = payload.remarks
        invoice.grand_total = grand_total
        for item in new_items:
            item.invoice_id = invoice.id
            self.db.add(item)

        self.db.commit()
        self.db.refresh(invoice)

        self._apply_stock_deductions(invoice.items)
        self._regenerate_pdf(invoice, customer, company_settings)

        log_event("INFO", f"Invoice {invoice.invoice_number} edited", self.db)
        return invoice

    def _regenerate_pdf(self, invoice: Invoice, customer: Customer, company_settings: Settings):
        try:
            pdf_path = generate_invoice_pdf(invoice, customer, company_settings, invoice.items)
            invoice.pdf_path = pdf_path
            self.db.commit()
            self.db.refresh(invoice)
            log_event("INFO", f"Invoice {invoice.invoice_number} saved, PDF: {pdf_path}", self.db)
        except Exception as e:
            log_event("ERROR", f"PDF generation failed for {invoice.invoice_number}: {e}", self.db)
