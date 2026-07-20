"""Repository layer for Customer — pure data access, no business logic."""
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.models import Customer


class CustomerRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, data: dict) -> Customer:
        customer = Customer(**data)
        self.db.add(customer)
        self.db.commit()
        self.db.refresh(customer)
        return customer

    def get(self, customer_id: int) -> Optional[Customer]:
        return self.db.query(Customer).filter(Customer.id == customer_id).first()

    def list(self, search: Optional[str] = None, page: int = 1, limit: int = 50) -> List[Customer]:
        query = self.db.query(Customer)
        if search:
            query = query.filter(
                or_(Customer.name.ilike(f"%{search}%"), Customer.phone.ilike(f"%{search}%"))
            )
        query = query.order_by(Customer.updated_at.desc())
        return query.offset((page - 1) * limit).limit(limit).all()

    def update(self, customer_id: int, data: dict) -> Optional[Customer]:
        customer = self.get(customer_id)
        if not customer:
            return None
        for key, value in data.items():
            if value is not None:
                setattr(customer, key, value)
        self.db.commit()
        self.db.refresh(customer)
        return customer

    def delete(self, customer_id: int) -> bool:
        customer = self.get(customer_id)
        if not customer:
            return False
        self.db.delete(customer)
        self.db.commit()
        return True
