"""Skills CRUD API — 技能管理，含引用子节点和脚本关联"""
from __future__ import annotations

import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.extras import Skill, SkillReference, SkillScript, UserScript

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────

class SkillCreate(BaseModel):
    name: str
    description: str | None = None
    content: str | None = None
    icon: str | None = None
    sort_order: int = 0
    config: dict | None = None


class SkillUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    content: str | None = None
    icon: str | None = None
    sort_order: int | None = None
    config: dict | None = None
    enabled: bool | None = None


class RefCreate(BaseModel):
    name: str
    ref_type: str = "markdown"
    content: str | None = None
    file_path: str | None = None
    sort_order: int = 0


class RefUpdate(BaseModel):
    name: str | None = None
    ref_type: str | None = None
    content: str | None = None
    file_path: str | None = None
    sort_order: int | None = None


class ScriptLinkCreate(BaseModel):
    script_id: str
    sort_order: int = 0


class BulkEnableRequest(BaseModel):
    ids: list[uuid.UUID] = []
    enabled: bool = True


# ── Skill CRUD ───────────────────────────────────────────────

@router.get("/")
async def list_skills(db: AsyncSession = Depends(get_db)):
    ref_count = (
        select(func.count(SkillReference.id))
        .where(SkillReference.skill_id == Skill.id)
        .correlate(Skill)
        .scalar_subquery()
    )
    script_count = (
        select(func.count(SkillScript.id))
        .where(SkillScript.skill_id == Skill.id)
        .correlate(Skill)
        .scalar_subquery()
    )
    result = await db.execute(
        select(Skill, ref_count.label("ref_count"), script_count.label("script_count"))
        .order_by(Skill.sort_order, Skill.name)
    )
    rows = result.all()
    return [
        {**_skill_to_dict(row[0]), "ref_count": row[1], "script_count": row[2]}
        for row in rows
    ]


@router.post("/")
async def create_skill(data: SkillCreate, db: AsyncSession = Depends(get_db)):
    skill = Skill(
        name=data.name,
        description=data.description,
        content=data.content,
        icon=data.icon,
        sort_order=data.sort_order,
        config=data.config or {},
    )
    db.add(skill)
    await db.commit()
    await db.refresh(skill)
    return _skill_to_dict(skill)


@router.get("/{skill_id}")
async def get_skill(skill_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    skill = await _get_skill_or_404(skill_id, db)
    refs = await db.execute(
        select(SkillReference).where(SkillReference.skill_id == skill_id).order_by(SkillReference.sort_order)
    )
    scripts = await db.execute(
        select(SkillScript, UserScript.name.label("script_name"))
        .outerjoin(UserScript, SkillScript.script_id == UserScript.id)
        .where(SkillScript.skill_id == skill_id)
        .order_by(SkillScript.sort_order)
    )
    return {
        **_skill_to_dict(skill),
        "references": [_ref_to_dict(r) for r in refs.scalars().all()],
        "scripts": [_script_link_to_dict(row) for row in scripts.all()],
    }


@router.put("/{skill_id}")
async def update_skill(skill_id: uuid.UUID, data: SkillUpdate, db: AsyncSession = Depends(get_db)):
    skill = await _get_skill_or_404(skill_id, db)
    for field in ("name", "description", "content", "icon", "sort_order", "config", "enabled"):
        val = getattr(data, field, None)
        if val is not None:
            setattr(skill, field, val)
    skill.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(skill)
    return _skill_to_dict(skill)


@router.delete("/{skill_id}")
async def delete_skill(skill_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    skill = await _get_skill_or_404(skill_id, db)
    await db.delete(skill)
    await db.commit()
    return {"message": "已删除"}


@router.post("/{skill_id}/toggle")
async def toggle_skill(skill_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    skill = await _get_skill_or_404(skill_id, db)
    skill.enabled = not skill.enabled
    skill.updated_at = datetime.utcnow()
    await db.commit()
    return {"enabled": skill.enabled}


@router.post("/bulk-enable")
async def bulk_enable_skills(data: BulkEnableRequest, db: AsyncSession = Depends(get_db)):
    """批量启用/禁用技能"""
    if not data.ids:
        return {"updated": 0}
    result = await db.execute(
        select(Skill).where(Skill.id.in_(data.ids))
    )
    count = 0
    for skill in result.scalars().all():
        if skill.enabled != data.enabled:
            skill.enabled = data.enabled
            skill.updated_at = datetime.utcnow()
            count += 1
    await db.commit()
    return {"updated": count}


class BulkDeleteRequest(BaseModel):
    ids: list[uuid.UUID] = []


@router.post("/bulk-delete")
async def bulk_delete_skills(data: BulkDeleteRequest, db: AsyncSession = Depends(get_db)):
    """批量删除技能"""
    if not data.ids:
        return {"deleted": 0}
    result = await db.execute(
        select(Skill).where(Skill.id.in_(data.ids))
    )
    count = 0
    for skill in result.scalars().all():
        await db.delete(skill)
        count += 1
    await db.commit()
    return {"deleted": count}


# ── Reference CRUD ───────────────────────────────────────────

@router.get("/{skill_id}/references")
async def list_references(skill_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await _get_skill_or_404(skill_id, db)
    result = await db.execute(
        select(SkillReference).where(SkillReference.skill_id == skill_id).order_by(SkillReference.sort_order)
    )
    return [_ref_to_dict(r) for r in result.scalars().all()]


@router.post("/{skill_id}/references")
async def create_reference(skill_id: uuid.UUID, data: RefCreate, db: AsyncSession = Depends(get_db)):
    await _get_skill_or_404(skill_id, db)
    ref = SkillReference(
        skill_id=skill_id,
        name=data.name,
        ref_type=data.ref_type,
        content=data.content,
        file_path=data.file_path,
        sort_order=data.sort_order,
    )
    db.add(ref)
    await db.commit()
    await db.refresh(ref)
    return _ref_to_dict(ref)


@router.put("/{skill_id}/references/{ref_id}")
async def update_reference(skill_id: uuid.UUID, ref_id: uuid.UUID, data: RefUpdate, db: AsyncSession = Depends(get_db)):
    ref = await _get_ref_or_404(skill_id, ref_id, db)
    for field in ("name", "ref_type", "content", "file_path", "sort_order"):
        val = getattr(data, field, None)
        if val is not None:
            setattr(ref, field, val)
    ref.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(ref)
    return _ref_to_dict(ref)


@router.delete("/{skill_id}/references/{ref_id}")
async def delete_reference(skill_id: uuid.UUID, ref_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    ref = await _get_ref_or_404(skill_id, ref_id, db)
    await db.delete(ref)
    await db.commit()
    return {"message": "已删除"}


# ── Script Link CRUD ─────────────────────────────────────────

@router.get("/{skill_id}/scripts")
async def list_script_links(skill_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await _get_skill_or_404(skill_id, db)
    result = await db.execute(
        select(SkillScript, UserScript.name.label("script_name"))
        .outerjoin(UserScript, SkillScript.script_id == UserScript.id)
        .where(SkillScript.skill_id == skill_id)
        .order_by(SkillScript.sort_order)
    )
    return [_script_link_to_dict(row) for row in result.all()]


@router.post("/{skill_id}/scripts")
async def link_script(skill_id: uuid.UUID, data: ScriptLinkCreate, db: AsyncSession = Depends(get_db)):
    await _get_skill_or_404(skill_id, db)
    script_uuid = uuid.UUID(data.script_id)
    link = SkillScript(skill_id=skill_id, script_id=script_uuid, sort_order=data.sort_order)
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return {"id": str(link.id), "skill_id": str(skill_id), "script_id": data.script_id}


@router.delete("/{skill_id}/scripts/{link_id}")
async def unlink_script(skill_id: uuid.UUID, link_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SkillScript).where(SkillScript.id == link_id, SkillScript.skill_id == skill_id)
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Script link not found")
    await db.delete(link)
    await db.commit()
    return {"message": "已取消关联"}


# ── Helpers ──────────────────────────────────────────────────

async def _get_skill_or_404(skill_id: uuid.UUID, db: AsyncSession) -> Skill:
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


async def _get_ref_or_404(skill_id: uuid.UUID, ref_id: uuid.UUID, db: AsyncSession) -> SkillReference:
    result = await db.execute(
        select(SkillReference).where(SkillReference.id == ref_id, SkillReference.skill_id == skill_id)
    )
    ref = result.scalar_one_or_none()
    if not ref:
        raise HTTPException(status_code=404, detail="Reference not found")
    return ref


def _skill_to_dict(s: Skill) -> dict:
    return {
        "id": str(s.id),
        "name": s.name,
        "description": s.description,
        "content": s.content,
        "icon": s.icon,
        "sort_order": s.sort_order,
        "config": s.config,
        "enabled": s.enabled,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


def _ref_to_dict(r: SkillReference) -> dict:
    return {
        "id": str(r.id),
        "skill_id": str(r.skill_id),
        "name": r.name,
        "ref_type": r.ref_type,
        "content": r.content,
        "file_path": r.file_path,
        "sort_order": r.sort_order,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def _script_link_to_dict(row) -> dict:
    link = row[0] if hasattr(row, '__getitem__') else row
    script_name = row[1] if hasattr(row, '__getitem__') and len(row) > 1 else None
    return {
        "id": str(link.id),
        "skill_id": str(link.skill_id),
        "script_id": str(link.script_id) if link.script_id else None,
        "script_name": script_name,
        "sort_order": link.sort_order,
        "created_at": link.created_at.isoformat() if link.created_at else None,
    }
