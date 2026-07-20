"""Inventory API routes — /inventory/*
Every endpoint is scoped to one company via the `company_key` query param,
so Sharma Agency and Sharma Electricals (or any future company) each see
only their own item list and stock.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.repositories.inventory_repo import InventoryRepository
from app.models.models import Settings
from app.schemas.schemas import InventoryCreate, InventoryUpdate, InventoryOut
from app.utils.logger import log_event

router = APIRouter(prefix="/inventory", tags=["inventory"])


def _to_out(item) -> InventoryOut:
    out = InventoryOut.model_validate(item)
    out.low_stock = item.current_stock < item.min_stock
    return out


def _validate_company(db: Session, company_key: str):
    exists = db.query(Settings).filter(Settings.company_key == company_key).first()
    if not exists:
        raise HTTPException(400, f"Unknown company '{company_key}'. Add it in Settings → Companies first.")


@router.get("/list", response_model=list[InventoryOut])
def list_inventory(
    company_key: str = Query(...),
    search: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    _validate_company(db, company_key)
    repo = InventoryRepository(db)
    items = repo.list(company_key, search=search, category=category)
    return [_to_out(i) for i in items]


@router.get("/search", response_model=list[InventoryOut])
def search_inventory(company_key: str = Query(...), q: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    """Instant autocomplete search — target <100ms response."""
    _validate_company(db, company_key)
    repo = InventoryRepository(db)
    items = repo.search(company_key, q)
    return [_to_out(i) for i in items]


@router.get("/low-stock", response_model=list[InventoryOut])
def low_stock_items(company_key: str = Query(...), db: Session = Depends(get_db)):
    _validate_company(db, company_key)
    repo = InventoryRepository(db)
    return [_to_out(i) for i in repo.low_stock(company_key)]


@router.post("/create", response_model=InventoryOut)
def create_item(payload: InventoryCreate, db: Session = Depends(get_db)):
    _validate_company(db, payload.company_key)
    repo = InventoryRepository(db)
    existing = repo.get_by_name(payload.company_key, payload.item_name)
    if existing:
        raise HTTPException(400, f"'{payload.item_name}' already exists in this company's inventory")
    item = repo.create(payload.model_dump())
    log_event("INFO", f"Inventory item created: {item.item_name} ({payload.company_key})", db)
    return _to_out(item)


@router.put("/{item_id}", response_model=InventoryOut)
def update_item(item_id: int, payload: InventoryUpdate, db: Session = Depends(get_db)):
    repo = InventoryRepository(db)
    item = repo.update(item_id, payload.model_dump(exclude_unset=True))
    if not item:
        raise HTTPException(404, "Item not found")
    log_event("INFO", f"Inventory item updated: id={item_id}", db)
    return _to_out(item)
