import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.extras import SiteSetting

router = APIRouter()

DEFAULTS = {
    "siteName": "MutiExpert",
    "siteSubtitle": "知识管理平台",
    "logoUrl": "/logo.svg",
    "navIcons": json.dumps({
        "dashboard": "streamline-color:dashboard-3",
        "knowledge": "streamline-color:open-book",
        "scheduler": "streamline-color:circle-clock",
        "settings": "streamline-color:cog",
        "aiModels": "streamline-color:computer-chip-1",
        "integrations": "streamline-color:electric-cord-1",
        "data": "streamline-color:database",
    }),
}


class SiteSettingsUpdate(BaseModel):
    siteName: str | None = None
    siteSubtitle: str | None = None
    logoUrl: str | None = None
    navIcons: dict | None = None


@router.get("/")
async def get_site_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SiteSetting))
    rows = result.scalars().all()
    settings = {r.key: r.value for r in rows}
    # Parse navIcons from JSON string
    out = {}
    for key, default in DEFAULTS.items():
        raw = settings.get(key, default)
        if key == "navIcons" and isinstance(raw, str):
            try:
                out[key] = json.loads(raw)
            except json.JSONDecodeError:
                out[key] = json.loads(default)
        else:
            out[key] = raw
    return out


@router.put("/")
async def update_site_settings(data: SiteSettingsUpdate, db: AsyncSession = Depends(get_db)):
    updates = data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        # Serialize dicts to JSON string
        store_value = json.dumps(value) if isinstance(value, dict) else str(value)
        result = await db.execute(select(SiteSetting).where(SiteSetting.key == key))
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = store_value
        else:
            db.add(SiteSetting(key=key, value=store_value))
    await db.commit()
    return {"message": "Settings saved"}
