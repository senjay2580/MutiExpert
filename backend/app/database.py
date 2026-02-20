import logging

from sqlalchemy import inspect as sa_inspect, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_size=5,
    max_overflow=10,
) if settings.database_url else None

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
) if engine else None


def _sync_add_missing_columns(conn):
    """Compare model columns with DB columns and ADD missing ones."""
    inspector = sa_inspect(conn)
    existing_tables = inspector.get_table_names()

    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            continue
        db_columns = {col["name"] for col in inspector.get_columns(table.name)}
        for col in table.columns:
            if col.name not in db_columns:
                col_type = col.type.compile(dialect=conn.dialect)
                conn.execute(text(
                    f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {col_type}'
                ))
                logger.info(f"Auto-added column: {table.name}.{col.name} ({col_type})")


async def init_db():
    """Auto-create tables and add missing columns on startup."""
    if engine is None:
        return
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_sync_add_missing_columns)


async def get_db():
    if AsyncSessionLocal is None:
        raise RuntimeError("Database not configured. Set DATABASE_URL in .env")
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
