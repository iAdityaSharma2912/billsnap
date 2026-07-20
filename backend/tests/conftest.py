"""Shared pytest fixtures — isolated in-memory SQLite DB per test session."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.db import Base, get_db
import main


@pytest.fixture(scope="function")
def client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    # seed default settings rows
    from app.models.models import Settings
    db = TestingSessionLocal()
    db.add_all([
        Settings(company_key="SA", company_name="Sharma Agency", address="Delhi", phone="9999900001"),
        Settings(company_key="SE", company_name="Sharma Electricals", address="Delhi", phone="9999900002"),
    ])
    db.commit()
    db.close()

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[get_db] = override_get_db
    with TestClient(main.app) as c:
        yield c
    main.app.dependency_overrides.clear()
