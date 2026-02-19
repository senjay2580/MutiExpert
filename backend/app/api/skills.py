from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.extras import Skill
from app.services.skill_executor import execute_skill as run_skill, load_registry

router = APIRouter()


class SkillCreate(BaseModel):
    name: str
    type: str = "yaml"
    config: dict = {}
    file_path: str | None = None
    enabled: bool = True


class SkillUpdate(BaseModel):
    name: str | None = None
    config: dict | None = None
    file_path: str | None = None
    enabled: bool | None = None


class SkillExecuteRequest(BaseModel):
    params: dict[str, str] = {}
    context: str = ""


@router.get("/")
async def list_skills(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Skill).order_by(Skill.name))
    db_skills = result.scalars().all()
    registry = load_registry()
    return {"db_skills": db_skills, "registry_skills": registry}


@router.get("/{skill_id}")
async def get_skill(skill_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


@router.post("/", status_code=201)
async def create_skill(data: SkillCreate, db: AsyncSession = Depends(get_db)):
    skill = Skill(**data.model_dump())
    db.add(skill)
    await db.commit()
    await db.refresh(skill)
    return skill


@router.put("/{skill_id}")
async def update_skill(skill_id: UUID, data: SkillUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(skill, key, value)
    await db.commit()
    await db.refresh(skill)
    return skill


@router.delete("/{skill_id}", status_code=204)
async def delete_skill(skill_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    await db.delete(skill)
    await db.commit()


@router.post("/{skill_id}/execute")
async def execute_skill(skill_id: UUID, data: SkillExecuteRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    exec_result = await run_skill(skill.name, data.params, data.context)
    return exec_result
