from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings


# ---------------------------------------------------------
# Database Engine
# ---------------------------------------------------------

connect_args = (
    {"check_same_thread": False}
    if settings.DATABASE_URL.startswith("sqlite")
    else {}
)

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
)


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


Base = declarative_base()


# ---------------------------------------------------------
# Database Dependency
# ---------------------------------------------------------

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------
# Lightweight SQLite Migration
# ---------------------------------------------------------

def _ensure_bug_analysis_risk_columns():
    """
    Adds the AI Risk Score columns to an existing SQLite database.

    This allows old project databases to continue working without
    deleting existing users, bugs, analysis history, or other data.

    If the columns already exist, nothing is changed.
    """

    if not settings.DATABASE_URL.startswith("sqlite"):
        return

    inspector = inspect(engine)

    # On a brand-new database the table may not exist yet.
    # Base.metadata.create_all() will create it later.
    if "bug_analyses" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("bug_analyses")
    }

    migrations = []

    if "risk_score" not in existing_columns:
        migrations.append(
            "ALTER TABLE bug_analyses "
            "ADD COLUMN risk_score INTEGER NOT NULL DEFAULT 0"
        )

    if "risk_level" not in existing_columns:
        migrations.append(
            "ALTER TABLE bug_analyses "
            "ADD COLUMN risk_level VARCHAR(30) NOT NULL DEFAULT 'Minimal'"
        )

    if "risk_summary" not in existing_columns:
        migrations.append(
            "ALTER TABLE bug_analyses "
            "ADD COLUMN risk_summary TEXT"
        )

    if "risk_factors_json" not in existing_columns:
        migrations.append(
            "ALTER TABLE bug_analyses "
            "ADD COLUMN risk_factors_json TEXT"
        )

    if not migrations:
        return

    with engine.begin() as connection:
        for statement in migrations:
            connection.execute(text(statement))

    print("AI Risk Score database migration completed successfully.")


# Run migration automatically when backend starts.
_ensure_bug_analysis_risk_columns()