"""
Pydantic v2 schemas — request/response validation for all modules.
"""
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


# ───────────────────────── Customer ─────────────────────────

class CustomerCreate(BaseModel):
    name: str
    phone: str
    address: Optional[str] = ""
    email: Optional[str] = None
    notes: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    phone: str
    address: Optional[str] = ""
    email: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime


class CustomerDetail(CustomerOut):
    total_purchases: float = 0.0
    invoice_count: int = 0


# ───────────────────────── Inventory ─────────────────────────

class InventoryCreate(BaseModel):
    company_key: str
    item_name: str
    category: Optional[str] = "General"
    unit: Optional[str] = "Pcs"
    selling_price: float = 0.0
    current_stock: float = 0.0
    min_stock: float = 0.0
    remarks: Optional[str] = None


class InventoryUpdate(BaseModel):
    item_name: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    selling_price: Optional[float] = None
    current_stock: Optional[float] = None
    min_stock: Optional[float] = None
    remarks: Optional[str] = None


class InventoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    company_key: str
    item_name: str
    category: str
    unit: str
    selling_price: float
    current_stock: float
    min_stock: float
    remarks: Optional[str] = None
    low_stock: bool = False


# ───────────────────────── Invoice ─────────────────────────

class InvoiceItemIn(BaseModel):
    inventory_id: Optional[int] = None
    item_name: str
    unit: str = "Pcs"
    qty: float
    rate: float


class InvoiceItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    inventory_id: Optional[int] = None
    item_name: str
    unit: str
    qty: float
    rate: float
    amount: float = 0.0


class InvoiceCreate(BaseModel):
    company: str
    customer_id: int
    invoice_date: Optional[date] = None
    payment_mode: str = "Cash"
    remarks: Optional[str] = None
    items: List[InvoiceItemIn]


class InvoiceUpdate(BaseModel):
    """
    Used to edit an existing invoice. Company and invoice_date are
    intentionally not included — the invoice number was generated against
    a specific company+date combination, and changing either after the
    fact would make the numbering inconsistent. To move an invoice to a
    different company or date, delete it and create a new one instead.
    """
    customer_id: int
    payment_mode: str = "Cash"
    remarks: Optional[str] = None
    items: List[InvoiceItemIn]


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    invoice_number: str
    company: str
    customer_id: int
    customer_name: str = ""
    invoice_date: date
    grand_total: float
    payment_mode: str
    remarks: Optional[str] = None
    pdf_path: Optional[str] = None
    created_at: datetime


class InvoiceDetail(InvoiceOut):
    customer_name: str = ""
    customer_phone: str = ""
    customer_address: str = ""
    items: List[InvoiceItemOut] = []


# ───────────────────────── Settings / Companies ─────────────────────────

class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    company_key: str
    company_name: str
    address: str
    phone: str
    bank_details: Optional[str] = None
    upi_id: Optional[str] = None
    show_payment_block: int = 1
    created_at: Optional[datetime] = None


class SettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    bank_details: Optional[str] = None
    upi_id: Optional[str] = None
    show_payment_block: Optional[int] = None


class CompanyCreate(BaseModel):
    company_key: str = Field(..., min_length=1, max_length=10, pattern="^[A-Za-z0-9_-]+$")
    company_name: str
    address: Optional[str] = ""
    phone: Optional[str] = ""
    bank_details: Optional[str] = None
    upi_id: Optional[str] = None
    show_payment_block: int = 1


# ───────────────────────── Reports ─────────────────────────

class DailyReport(BaseModel):
    date: str
    total_amount: float
    invoice_count: int
    top_customers: List[dict]
    payment_breakdown: dict


class MonthlyReport(BaseModel):
    month: str
    total_amount: float
    invoice_count: int
    weekly_breakdown: List[dict]
    top_items: List[dict]


# ───────────────────────── Generic ─────────────────────────

class SuccessResponse(BaseModel):
    success: bool = True
    message: Optional[str] = None


class PathResponse(BaseModel):
    path: str
