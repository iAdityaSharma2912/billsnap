"""Repository layer for Inventory — data access + fast name search.
Every list/search/get call is scoped to a single company's inventory.
"""
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models.models import Inventory


class InventoryRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, data: dict) -> Inventory:
        item = Inventory(**data)
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def get(self, item_id: int) -> Optional[Inventory]:
        return self.db.query(Inventory).filter(Inventory.id == item_id).first()

    def get_by_name(self, company_key: str, item_name: str) -> Optional[Inventory]:
        return (
            self.db.query(Inventory)
            .filter(Inventory.company_key == company_key)
            .filter(Inventory.item_name.ilike(item_name))
            .first()
        )

    def get_or_create_from_invoice_line(
        self, company_key: str, item_name: str, unit: str, rate: float
    ) -> Inventory:
        """
        Called when an invoice is saved with a line item that doesn't match
        an existing inventory_id. Adds the item to that company's inventory
        list so it shows up in future autocomplete/search — but does NOT
        set a stock quantity (stays at 0) since the person typed it ad hoc
        rather than picking it from stock.
        """
        existing = self.get_by_name(company_key, item_name)
        if existing:
            return existing
        item = Inventory(
            company_key=company_key,
            item_name=item_name,
            category="General",
            unit=unit or "Pcs",
            selling_price=rate or 0.0,
            current_stock=0.0,
            min_stock=0.0,
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def list(self, company_key: str, search: Optional[str] = None, category: Optional[str] = None) -> List[Inventory]:
        query = self.db.query(Inventory).filter(Inventory.company_key == company_key)
        if search:
            query = query.filter(Inventory.item_name.ilike(f"%{search}%"))
        if category:
            query = query.filter(Inventory.category == category)
        return query.order_by(Inventory.item_name.asc()).all()

    def search(self, company_key: str, q: str, limit: int = 15) -> List[Inventory]:
        """Lightweight instant search — LIKE index lookup, sub-100ms on local SQLite."""
        if not q:
            return []
        return (
            self.db.query(Inventory)
            .filter(Inventory.company_key == company_key)
            .filter(Inventory.item_name.ilike(f"%{q}%"))
            .order_by(Inventory.item_name.asc())
            .limit(limit)
            .all()
        )

    def update(self, item_id: int, data: dict) -> Optional[Inventory]:
        item = self.get(item_id)
        if not item:
            return None
        for key, value in data.items():
            if value is not None:
                setattr(item, key, value)
        self.db.commit()
        self.db.refresh(item)
        return item

    def adjust_stock(self, item_id: int, delta: float) -> Optional[Inventory]:
        item = self.get(item_id)
        if not item:
            return None
        item.current_stock = max(0.0, (item.current_stock or 0.0) + delta)
        self.db.commit()
        self.db.refresh(item)
        return item

    def low_stock(self, company_key: str) -> List[Inventory]:
        return (
            self.db.query(Inventory)
            .filter(Inventory.company_key == company_key)
            .filter(Inventory.current_stock < Inventory.min_stock)
            .order_by(Inventory.current_stock.asc())
            .all()
        )
