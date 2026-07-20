"""Customer API routes — /customer/*"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.repositories.customer_repo import CustomerRepository
from app.models.models import Invoice
from app.schemas.schemas import CustomerCreate, CustomerUpdate, CustomerOut, CustomerDetail, SuccessResponse
from app.utils.logger import log_event

router = APIRouter(prefix="/customer", tags=["customer"])


@router.post("/create", response_model=CustomerOut)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    repo = CustomerRepository(db)
    customer = repo.create(payload.model_dump())
    log_event("INFO", f"Customer created: {customer.name} ({customer.phone})", db)
    return customer


@router.get("/list", response_model=list[CustomerOut])
def list_customers(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    repo = CustomerRepository(db)
    return repo.list(search=search, page=page, limit=limit)


@router.get("/{customer_id}", response_model=CustomerDetail)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    repo = CustomerRepository(db)
    customer = repo.get(customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")

    invoices = db.query(Invoice).filter(Invoice.customer_id == customer_id).all()
    total_purchases = sum(inv.grand_total for inv in invoices)

    detail = CustomerDetail.model_validate(customer)
    detail.total_purchases = round(total_purchases, 2)
    detail.invoice_count = len(invoices)
    return detail


@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: int, payload: CustomerUpdate, db: Session = Depends(get_db)):
    repo = CustomerRepository(db)
    customer = repo.update(customer_id, payload.model_dump(exclude_unset=True))
    if not customer:
        raise HTTPException(404, "Customer not found")
    log_event("INFO", f"Customer updated: id={customer_id}", db)
    return customer


@router.delete("/{customer_id}", response_model=SuccessResponse)
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    repo = CustomerRepository(db)
    customer = repo.get(customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")

    invoice_count = db.query(Invoice).filter(Invoice.customer_id == customer_id).count()
    if invoice_count > 0:
        raise HTTPException(
            400,
            f"Cannot delete customer with {invoice_count} existing invoice(s). "
            "Delete or reassign their invoices first.",
        )

    repo.delete(customer_id)
    log_event("INFO", f"Customer deleted: id={customer_id}", db)
    return SuccessResponse(success=True, message="Customer deleted")
