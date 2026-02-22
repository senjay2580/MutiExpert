from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, func, select
from app.database import get_db
from app.config import get_settings
from app.models.network import DocumentChunk

router = APIRouter()


@router.get("/embedding-info")
async def embedding_info(db: AsyncSession = Depends(get_db)):
    """Return embedding model config and vector chunk stats."""
    settings = get_settings()
    chunk_count = (await db.execute(select(func.count(DocumentChunk.id)))).scalar() or 0
    return {
        "model": settings.embedding_model,
        "api_base": settings.embedding_api_base,
        "total_chunks": chunk_count,
    }


@router.post("/test-embedding")
async def test_embedding():
    """Test embedding API connectivity with a short probe text."""
    try:
        from app.services.embedding_service import generate_embedding
        vec = await generate_embedding("connection test")
        return {"ok": True, "dimension": len(vec)}
    except Exception as e:
        return JSONResponse(status_code=502, content={"ok": False, "detail": str(e)})


@router.post("/rebuild-indexes")
async def rebuild_indexes(db: AsyncSession = Depends(get_db)):
    """Rebuild vector indexes on document_chunks."""
    try:
        await db.execute(text("REINDEX INDEX idx_chunks_embedding"))
        await db.commit()
        return {"message": "Indexes rebuilt successfully"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Rebuild failed: {str(e)}"})
