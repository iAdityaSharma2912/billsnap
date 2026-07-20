"""
SQLAlchemy ORM models for BillSnap.
Tables: Users, Companies (was "Settings"), Customers, Inventory, Invoices,
InvoiceItems, AppLogs.

Companies are now dynamic — there is no hardcoded SA/SE enum. The
`company_key` column on Settings/Inventory/Invoice is a free-form short
code (e.g. "SA", "SE", or anything a new company is given when created in
Settings → Companies). Validity is checked against the Settings table at
the API layer, not the database layer, so adding a company never needs a
schema change.
"""
from datetime import datetime, date

from sqlalchemy import (
    Column, Integer, String, Float, Text, DateTime, Date,
    ForeignKey, Enum as SAEnum, UniqueConstraint
)
from sqlalchemy.orm import relationship
import enum

from app.database.db import Base


class LogLevel(str, enum.Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class User(Base):
    """Simple local user/admin table (single-PC app, no auth server)."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False)
    role = Column(String(20), default="admin")  # admin / billing_staff / manager
    created_at = Column(DateTime, default=datetime.utcnow)


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    phone = Column(String(20), nullable=False, index=True)
    address = Column(Text, default="")
    email = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    invoices = relationship("Invoice", back_populates="customer")


class Inventory(Base):
    """
    Inventory is now scoped per-company — each company has its own item
    list and stock. company_key matches Settings.company_key.
    """
    __tablename__ = "inventory"
    __table_args__ = (
        UniqueConstraint("company_key", "item_name", name="uq_inventory_company_item"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_key = Column(String(10), nullable=False, index=True)
    item_name = Column(String(200), nullable=False, index=True)
    category = Column(String(50), default="General")
    unit = Column(String(20), default="Pcs")
    selling_price = Column(Float, default=0.0)
    current_stock = Column(Float, default=0.0)
    min_stock = Column(Float, default=0.0)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (UniqueConstraint("invoice_number", name="uq_invoice_number"),)

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(30), nullable=False, index=True)
    company = Column(String(10), nullable=False, index=True)  # company_key, validated at API layer
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    invoice_date = Column(Date, default=date.today)
    grand_total = Column(Float, default=0.0)
    payment_mode = Column(String(20), default="Cash")  # Cash/Credit/UPI/Bank transfer/Cheque
    remarks = Column(Text, nullable=True)
    pdf_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    inventory_id = Column(Integer, ForeignKey("inventory.id"), nullable=True)
    item_name = Column(String(200), nullable=False)
    unit = Column(String(20), default="Pcs")
    qty = Column(Float, default=1.0)
    rate = Column(Float, default=0.0)
    # True when this line's qty was actually subtracted from the matching
    # inventory row's stock at save time (i.e. it resolved to a
    # pre-existing item, not a brand-new auto-created one at zero stock).
    # Needed so editing an invoice later can reverse stock exactly —
    # without this, there's no way to tell which lines to add qty back to.
    stock_deducted = Column(Integer, default=0)  # 1=true, 0=false (SQLite has no bool)

    invoice = relationship("Invoice", back_populates="items")

    @property
    def amount(self) -> float:
        return round(self.qty * self.rate, 2)


class Settings(Base):
    """
    One row per company. This is effectively the "Companies" table now —
    creating a new row here is how a new company gets added to the system
    (dropdown filters, inventory scoping, invoice numbering all key off
    company_key).
    """
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    company_key = Column(String(10), nullable=False, unique=True)  # e.g. "SA", "SE", or new short code
    company_name = Column(String(100), nullable=False)
    address = Column(Text, default="")
    phone = Column(String(20), default="")
    bank_details = Column(Text, nullable=True)
    upi_id = Column(String(100), nullable=True)
    show_payment_block = Column(Integer, default=1)  # 1=true, 0=false (SQLite has no bool)
    created_at = Column(DateTime, default=datetime.utcnow)


class AppLog(Base):
    __tablename__ = "app_logs"

    id = Column(Integer, primary_key=True, index=True)
    level = Column(SAEnum(LogLevel), default=LogLevel.INFO)
    message = Column(Text, nullable=False)
    logged_at = Column(DateTime, default=datetime.utcnow)
