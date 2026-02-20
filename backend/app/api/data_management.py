import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.database import get_db
from app.models.knowledge import Industry, KnowledgeBase, Document
from app.models.extras import Todo, SiteSetting, ScheduledTask

router = APIRouter()


@router.get("/export")
async def export_data(db: AsyncSession = Depends(get_db)):
    """Export all core data as JSON."""
    industries = (await db.execute(select(Industry))).scalars().all()
    kbs = (await db.execute(select(KnowledgeBase))).scalars().all()
    docs = (await db.execute(select(Document))).scalars().all()
    todos = (await db.execute(select(Todo))).scalars().all()
    settings = (await db.execute(select(SiteSetting))).scalars().all()
    tasks = (await db.execute(select(ScheduledTask))).scalars().all()

    def serialize(obj):
        d = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
        for k, v in d.items():
            if hasattr(v, "isoformat"):
                d[k] = v.isoformat()
            elif hasattr(v, "hex"):
                d[k] = str(v)
        return d

    return {
        "version": "1.0",
        "industries": [serialize(i) for i in industries],
        "knowledge_bases": [serialize(kb) for kb in kbs],
        "documents": [serialize(d) for d in docs],
        "todos": [serialize(t) for t in todos],
        "site_settings": [serialize(s) for s in settings],
        "scheduled_tasks": [serialize(t) for t in tasks],
    }


@router.post("/import")
async def import_data(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    """Import data from JSON file."""
    try:
        content = await file.read()
        data = json.loads(content)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Invalid JSON file")

    imported = {}

    # Import site_settings
    if "site_settings" in data:
        for item in data["site_settings"]:
            result = await db.execute(select(SiteSetting).where(SiteSetting.key == item["key"]))
            existing = result.scalar_one_or_none()
            if existing:
                existing.value = item["value"]
            else:
                db.add(SiteSetting(key=item["key"], value=item["value"]))
        imported["site_settings"] = len(data["site_settings"])

    # Import todos
    if "todos" in data:
        for item in data["todos"]:
            db.add(Todo(
                title=item["title"],
                completed=item.get("completed", False),
                priority=item.get("priority", "medium"),
                sort_order=item.get("sort_order", 0),
            ))
        imported["todos"] = len(data["todos"])

    await db.commit()
    return {"message": "Import completed", "imported": imported}


@router.post("/rebuild-indexes")
async def rebuild_indexes(db: AsyncSession = Depends(get_db)):
    """Rebuild vector indexes on document_chunks."""
    try:
        await db.execute(text("REINDEX INDEX idx_chunks_embedding"))
        await db.commit()
        return {"message": "Indexes rebuilt successfully"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Rebuild failed: {str(e)}"})
