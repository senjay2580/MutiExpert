"""Bot Tools CRUD API"""
from __future__ import annotations

import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.extras import BotTool

router = APIRouter()


class BotToolCreate(BaseModel):
    name: str
    description: str
    action_type: str = "query"
    endpoint: str
    method: str = "GET"
    param_mapping: dict | None = None
    parameters: dict | None = None


class BotToolUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    action_type: str | None = None
    endpoint: str | None = None
    method: str | None = None
    param_mapping: dict | None = None
    parameters: dict | None = None
    enabled: bool | None = None


@router.get("/")
async def list_tools(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BotTool).order_by(BotTool.name))
    return [_tool_to_dict(t) for t in result.scalars().all()]


@router.post("/")
async def create_tool(data: BotToolCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(BotTool).where(BotTool.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Tool '{data.name}' already exists")
    tool = BotTool(
        name=data.name,
        description=data.description,
        action_type=data.action_type,
        endpoint=data.endpoint,
        method=data.method,
        param_mapping=data.param_mapping or {},
        parameters=data.parameters or {},
    )
    db.add(tool)
    await db.commit()
    await db.refresh(tool)
    return _tool_to_dict(tool)


@router.get("/{tool_id}")
async def get_tool(tool_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    tool = await _get_tool_or_404(tool_id, db)
    return _tool_to_dict(tool)


@router.put("/{tool_id}")
async def update_tool(tool_id: uuid.UUID, data: BotToolUpdate, db: AsyncSession = Depends(get_db)):
    tool = await _get_tool_or_404(tool_id, db)
    for field in ("name", "description", "action_type", "endpoint", "method", "param_mapping", "parameters", "enabled"):
        val = getattr(data, field, None)
        if val is not None:
            setattr(tool, field, val)
    tool.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(tool)
    return _tool_to_dict(tool)


@router.delete("/{tool_id}")
async def delete_tool(tool_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    tool = await _get_tool_or_404(tool_id, db)
    await db.delete(tool)
    await db.commit()
    return {"message": "已删除"}


@router.post("/{tool_id}/toggle")
async def toggle_tool(tool_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    tool = await _get_tool_or_404(tool_id, db)
    tool.enabled = not tool.enabled
    tool.updated_at = datetime.utcnow()
    await db.commit()
    return {"enabled": tool.enabled}


async def _get_tool_or_404(tool_id: uuid.UUID, db: AsyncSession) -> BotTool:
    result = await db.execute(select(BotTool).where(BotTool.id == tool_id))
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool


def _tool_to_dict(t: BotTool) -> dict:
    return {
        "id": str(t.id),
        "name": t.name,
        "description": t.description,
        "action_type": t.action_type,
        "endpoint": t.endpoint,
        "method": t.method,
        "param_mapping": t.param_mapping,
        "parameters": t.parameters,
        "enabled": t.enabled,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }
