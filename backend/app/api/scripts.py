"""用户脚本 + Bot Tools CRUD API"""
from __future__ import annotations

import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.extras import UserScript
from app.services.script_executor import execute_script
from app.services.script_env_resolver import (
    prepare_script_env,
    detect_hardcoded_secrets,
    ENV_VAR_REGISTRY,
)

router = APIRouter()


# ── UserScript schemas ──

class ScriptCreate(BaseModel):
    name: str
    description: str | None = None
    script_content: str
    script_type: str = "typescript"

class ScriptUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    script_content: str | None = None
    enabled: bool | None = None


# ── UserScript endpoints ──

@router.get("/env-vars/available")
async def list_available_env_vars():
    """返回脚本中可用的系统环境变量列表"""
    return ENV_VAR_REGISTRY


@router.get("/")
async def list_scripts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserScript).order_by(UserScript.created_at.desc()))
    return [_script_to_dict(s) for s in result.scalars().all()]


@router.post("/")
async def create_script(data: ScriptCreate, db: AsyncSession = Depends(get_db)):
    warnings = detect_hardcoded_secrets(data.script_content)
    script = UserScript(
        name=data.name,
        description=data.description,
        script_content=data.script_content,
        script_type=data.script_type,
    )
    db.add(script)
    await db.commit()
    await db.refresh(script)
    result = _script_to_dict(script)
    if warnings:
        result["warnings"] = warnings
    return result


@router.get("/{script_id}")
async def get_script(script_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    script = await _get_script_or_404(script_id, db)
    return _script_to_dict(script)


@router.put("/{script_id}")
async def update_script(script_id: uuid.UUID, data: ScriptUpdate, db: AsyncSession = Depends(get_db)):
    script = await _get_script_or_404(script_id, db)
    if data.name is not None:
        script.name = data.name
    if data.description is not None:
        script.description = data.description
    if data.script_content is not None:
        script.script_content = data.script_content
    if data.enabled is not None:
        script.enabled = data.enabled
    script.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(script)
    result = _script_to_dict(script)
    if data.script_content is not None:
        warnings = detect_hardcoded_secrets(data.script_content)
        if warnings:
            result["warnings"] = warnings
    return result


@router.delete("/{script_id}")
async def delete_script(script_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    script = await _get_script_or_404(script_id, db)
    await db.delete(script)
    await db.commit()
    return {"message": "已删除"}


@router.post("/{script_id}/test")
async def test_script(script_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    script = await _get_script_or_404(script_id, db)
    # 预处理：解析系统配置环境变量 + 检测硬编码密钥
    env_result = await prepare_script_env(db, script.script_content)
    result = await execute_script(
        script.script_content,
        timeout_seconds=30,
        script_type=script.script_type or "typescript",
        extra_env=env_result.env_vars,
    )
    script.last_test_at = datetime.utcnow()
    script.last_test_status = "success" if result.success else "failed"
    script.last_test_output = (result.output or result.error)[:5000]
    await db.commit()
    return {
        "success": result.success,
        "output": result.output,
        "error": result.error,
        "timed_out": result.timed_out,
        "warnings": env_result.warnings,
    }


async def _get_script_or_404(script_id: uuid.UUID, db: AsyncSession) -> UserScript:
    result = await db.execute(select(UserScript).where(UserScript.id == script_id))
    script = result.scalar_one_or_none()
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
    return script


def _script_to_dict(s: UserScript) -> dict:
    return {
        "id": str(s.id),
        "name": s.name,
        "description": s.description,
        "script_content": s.script_content,
        "script_type": s.script_type,
        "created_by": s.created_by,
        "last_test_at": s.last_test_at.isoformat() if s.last_test_at else None,
        "last_test_status": s.last_test_status,
        "last_test_output": s.last_test_output,
        "enabled": s.enabled,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }
