"""External Services API — 外部服务连接器管理（轻量 MCP）"""
from __future__ import annotations

import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import httpx
from app.database import get_db
from app.models.extras import ExternalService

router = APIRouter()


class ServiceCreate(BaseModel):
    name: str
    description: str | None = None
    base_url: str
    auth_type: str = "none"
    auth_config: dict = {}
    default_headers: dict = {}
    enabled: bool = True


class ServiceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    base_url: str | None = None
    auth_type: str | None = None
    auth_config: dict | None = None
    default_headers: dict | None = None
    enabled: bool | None = None


def _to_dict(s: ExternalService) -> dict:
    return {
        "id": str(s.id),
        "name": s.name,
        "description": s.description,
        "base_url": s.base_url,
        "auth_type": s.auth_type,
        "auth_config": s.auth_config or {},
        "default_headers": s.default_headers or {},
        "enabled": s.enabled,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


@router.get("/")
async def list_services(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ExternalService).order_by(ExternalService.name))
    return [_to_dict(s) for s in result.scalars().all()]


@router.post("/")
async def create_service(data: ServiceCreate, db: AsyncSession = Depends(get_db)):
    service = ExternalService(**data.model_dump())
    db.add(service)
    await db.commit()
    await db.refresh(service)
    return _to_dict(service)


@router.get("/{service_id}")
async def get_service(service_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ExternalService).where(ExternalService.id == service_id))
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(404, "服务不存在")
    return _to_dict(service)


@router.put("/{service_id}")
async def update_service(service_id: uuid.UUID, data: ServiceUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ExternalService).where(ExternalService.id == service_id))
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(404, "服务不存在")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(service, k, v)
    service.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(service)
    return _to_dict(service)


@router.delete("/{service_id}")
async def delete_service(service_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ExternalService).where(ExternalService.id == service_id))
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(404, "服务不存在")
    await db.delete(service)
    await db.commit()
    return {"message": "已删除"}


@router.post("/{service_id}/test")
async def test_connection(service_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ExternalService).where(ExternalService.id == service_id))
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(404, "服务不存在")
    headers: dict[str, str] = dict(service.default_headers or {})
    auth = service.auth_config or {}
    query_params: dict[str, str] = {}
    match service.auth_type:
        case "bearer":
            headers["Authorization"] = f"Bearer {auth.get('token', '')}"
        case "apikey_header":
            headers[auth.get("header_name", "apikey")] = auth.get("value", "")
        case "apikey_query":
            query_params[auth.get("param_name", "apikey")] = auth.get("value", "")
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            resp = await client.get(service.base_url, headers=headers, params=query_params)
        return {"success": 200 <= resp.status_code < 400, "status_code": resp.status_code}
    except Exception as e:
        return {"success": False, "error": str(e)}
