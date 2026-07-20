"""Report API routes — /report/*"""
from datetime import date, datetime, timedelta
from collections import defaultdict
from calendar import monthrange
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from app.database.db import get_db
from app.models.models import Invoice, InvoiceItem
from app.schemas.schemas import DailyReport, MonthlyReport

router = APIRouter(prefix="/report", tags=["report"])


@router.get("/daily", response_model=DailyReport)
def daily_report(date: date = Query(...), db: Session = Depends(get_db)):
    invoices = (
        db.query(Invoice)
        .options(joinedload(Invoice.customer))
        .filter(Invoice.invoice_date == date)
        .all()
    )

    total_amount = sum(inv.grand_total for inv in invoices)
    payment_breakdown: dict = defaultdict(float)
    customer_totals: dict = defaultdict(float)

    for inv in invoices:
        payment_breakdown[inv.payment_mode] += inv.grand_total
        if inv.customer:
            customer_totals[inv.customer.name] += inv.grand_total

    top_customers = [
        {"name": name, "total": round(total, 2)}
        for name, total in sorted(customer_totals.items(), key=lambda x: -x[1])[:5]
    ]

    return DailyReport(
        date=date.isoformat(),
        total_amount=round(total_amount, 2),
        invoice_count=len(invoices),
        top_customers=top_customers,
        payment_breakdown={k: round(v, 2) for k, v in payment_breakdown.items()},
    )


@router.get("/monthly", response_model=MonthlyReport)
def monthly_report(month: str = Query(..., description="YYYY-MM"), db: Session = Depends(get_db)):
    year, mon = map(int, month.split("-"))
    _, last_day = monthrange(year, mon)
    start = date(year, mon, 1)
    end = date(year, mon, last_day)

    invoices = (
        db.query(Invoice)
        .options(joinedload(Invoice.items))
        .filter(Invoice.invoice_date >= start, Invoice.invoice_date <= end)
        .all()
    )

    total_amount = sum(inv.grand_total for inv in invoices)

    weekly: dict = defaultdict(float)
    item_totals: dict = defaultdict(float)

    for inv in invoices:
        week_num = ((inv.invoice_date.day - 1) // 7) + 1
        weekly[f"Week {week_num}"] += inv.grand_total
        for it in inv.items:
            item_totals[it.item_name] += it.qty * it.rate

    weekly_breakdown = [{"week": k, "total": round(v, 2)} for k, v in sorted(weekly.items())]
    top_items = [
        {"name": name, "total": round(total, 2)}
        for name, total in sorted(item_totals.items(), key=lambda x: -x[1])[:5]
    ]

    return MonthlyReport(
        month=month,
        total_amount=round(total_amount, 2),
        invoice_count=len(invoices),
        weekly_breakdown=weekly_breakdown,
        top_items=top_items,
    )


# ── Inventory Report schemas (defined here, close to the endpoint that
#    uses them, rather than polluting the shared schemas.py) ──────────────

class InventoryReportRow(BaseModel):
    item_name: str
    unit: str
    total_qty: float
    total_amount: float
    invoice_count: int  # how many invoices this item appeared in that day/month

class InventoryReport(BaseModel):
    company: str
    period: str          # date string ("2026-07-15") or month string ("2026-07")
    period_type: str     # "daily" or "monthly"
    rows: List[InventoryReportRow]
    grand_qty: float     # sum of all quantities across all items
    grand_amount: float  # sum of all amounts


@router.get("/inventory", response_model=InventoryReport)
def inventory_report(
    company: str = Query(..., description="Company key, e.g. SA or SE"),
    period_type: str = Query("daily", description="'daily' or 'monthly'"),
    date: Optional[str] = Query(None, description="YYYY-MM-DD for daily"),
    month: Optional[str] = Query(None, description="YYYY-MM for monthly"),
    db: Session = Depends(get_db),
):
    """
    Returns a per-item summary of what was billed on a given date (daily)
    or across a full month (monthly), filtered by company.

    Each row shows: item name, unit, total qty billed, total amount, and
    how many invoices the item appeared in — so the shop owner can see at
    a glance "aaj kaunsa item kitna bika" for their specific company.

    Sorted by total amount descending so the highest-value items appear
    at the top — the most actionable order for a shop report.
    """
    # ── Build the date filter ──────────────────────────────────────────────
    from datetime import date as date_type
    from calendar import monthrange as _monthrange

    if period_type == "daily":
        if not date:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="date is required for daily report")
        from datetime import date as _date
        filter_date = _date.fromisoformat(date)
        invoices = (
            db.query(Invoice)
            .options(joinedload(Invoice.items))
            .filter(Invoice.company == company, Invoice.invoice_date == filter_date)
            .all()
        )
        period_str = date
    else:
        if not month:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="month is required for monthly report")
        year, mon = map(int, month.split("-"))
        _, last_day = _monthrange(year, mon)
        from datetime import date as _date
        start = _date(year, mon, 1)
        end = _date(year, mon, last_day)
        invoices = (
            db.query(Invoice)
            .options(joinedload(Invoice.items))
            .filter(Invoice.company == company, Invoice.invoice_date >= start, Invoice.invoice_date <= end)
            .all()
        )
        period_str = month

    # ── Aggregate per item ─────────────────────────────────────────────────
    # item_name -> {unit, total_qty, total_amount, invoice_count}
    agg: dict = defaultdict(lambda: {"unit": "", "total_qty": 0.0, "total_amount": 0.0, "invoice_count": 0})

    for inv in invoices:
        for it in inv.items:
            key = it.item_name
            agg[key]["unit"] = it.unit
            agg[key]["total_qty"] += it.qty
            agg[key]["total_amount"] += round(it.qty * it.rate, 2)
            agg[key]["invoice_count"] += 1

    rows = sorted(
        [
            InventoryReportRow(
                item_name=name,
                unit=data["unit"],
                total_qty=round(data["total_qty"], 3),
                total_amount=round(data["total_amount"], 2),
                invoice_count=data["invoice_count"],
            )
            for name, data in agg.items()
        ],
        key=lambda r: -r.total_amount,
    )

    grand_qty    = round(sum(r.total_qty    for r in rows), 3)
    grand_amount = round(sum(r.total_amount for r in rows), 2)

    return InventoryReport(
        company=company,
        period=period_str,
        period_type=period_type,
        rows=rows,
        grand_qty=grand_qty,
        grand_amount=grand_amount,
    )
