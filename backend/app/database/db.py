"""
Database engine + session management for BillSnap.
Uses SQLite — single file, zero install, offline-first.
"""
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.paths import DATABASE_PATH

DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Columns that were added to existing tables after the app was first
# released. SQLite has no built-in migration tool and `create_all()` only
# creates missing TABLES, never adds columns to ones that already exist —
# so without this, anyone with a database file from before a column was
# added gets a startup crash ("no such column"). This runs a plain
# `ALTER TABLE ... ADD COLUMN` for anything missing, which is safe and
# non-destructive on SQLite.
_COLUMN_MIGRATIONS = [
    # (table, column, DDL type + default)
    ("settings", "created_at", "DATETIME"),
    ("invoice_items", "stock_deducted", "INTEGER DEFAULT 0"),
]


def get_db():
    """FastAPI dependency — yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _run_column_migrations():
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    with engine.begin() as conn:
        for table, column, ddl_type in _COLUMN_MIGRATIONS:
            if table not in existing_tables:
                continue  # table doesn't exist yet — create_all() will make it with the column already present
            existing_columns = {c["name"] for c in inspector.get_columns(table)}
            if column not in existing_columns:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}"))


def init_db():
    """Create all tables and migrate any missing columns.

    Deliberately does NOT seed any company/Settings row. Earlier versions
    of BillSnap auto-created "Sharma Agency" and "Sharma Electricals" here,
    which made sense for a single shared install used by both businesses.
    The desktop version installs separately on each shop's own PC, so
    hardcoding either company into every install is wrong for both of
    them. Instead, a fresh database starts with zero rows in `settings`,
    and the frontend detects that (GET /settings/companies returns an
    empty list) and shows a first-run "Set up your company" screen before
    unlocking the rest of the app. See CompanySetupGate in the frontend
    for that logic.
    """
    from app.models import models  # noqa: F401 (ensures models are registered)
    Base.metadata.create_all(bind=engine)
    _run_column_migrations()
