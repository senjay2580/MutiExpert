from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.extras import ScheduledTask
from app.services.scheduler_service import SchedulerService

router = APIRouter()


class TaskCreate(BaseModel):
    name: str
    description: str | None = None
    cron_expression: str
    task_type: str  # skill_exec | ai_query | feishu_push
    task_config: dict = {}
    enabled: bool = True


class TaskUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    cron_expression: str | None = None
    task_type: str | None = None
    task_config: dict | None = None
    enabled: bool | None = None


@router.get("/")
async def list_tasks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ScheduledTask).order_by(ScheduledTask.created_at.desc()))
    return result.scalars().all()


@router.post("/", status_code=201)
async def create_task(data: TaskCreate, db: AsyncSession = Depends(get_db)):
    task = ScheduledTask(**data.model_dump())
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.get("/{task_id}")
async def get_task(task_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ScheduledTask).where(ScheduledTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.put("/{task_id}")
async def update_task(task_id: UUID, data: TaskUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ScheduledTask).where(ScheduledTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(task, key, value)
    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ScheduledTask).where(ScheduledTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(task)
    await db.commit()


@router.post("/{task_id}/toggle")
async def toggle_task(task_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ScheduledTask).where(ScheduledTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.enabled = not task.enabled
    await db.commit()
    await db.refresh(task)
    return task


@router.post("/{task_id}/run")
async def run_task(task_id: UUID):
    scheduler = SchedulerService()
    success, message = await scheduler.run_once(task_id)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": "Task executed", "status": message}
