from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings


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


async def get_db():
    if AsyncSessionLocal is None:
        raise RuntimeError("Database not configured. Set DATABASE_URL in .env")
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
