from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.extras import Todo

router = APIRouter()


class TodoCreate(BaseModel):
    title: str
    priority: str = "medium"
    sort_order: int = 0


class TodoUpdate(BaseModel):
    title: str | None = None
    priority: str | None = None
    sort_order: int | None = None
    completed: bool | None = None


@router.get("/")
async def list_todos(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Todo).order_by(Todo.completed, Todo.sort_order, Todo.created_at.desc())
    )
    return result.scalars().all()


@router.post("/", status_code=201)
async def create_todo(data: TodoCreate, db: AsyncSession = Depends(get_db)):
    todo = Todo(**data.model_dump())
    db.add(todo)
    await db.commit()
    await db.refresh(todo)
    return todo


@router.put("/{todo_id}")
async def update_todo(todo_id: UUID, data: TodoUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Todo).where(Todo.id == todo_id))
    todo = result.scalar_one_or_none()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(todo, key, value)
    await db.commit()
    await db.refresh(todo)
    return todo


@router.put("/{todo_id}/toggle")
async def toggle_todo(todo_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Todo).where(Todo.id == todo_id))
    todo = result.scalar_one_or_none()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    todo.completed = not todo.completed
    await db.commit()
    await db.refresh(todo)
    return todo


@router.delete("/{todo_id}", status_code=204)
async def delete_todo(todo_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Todo).where(Todo.id == todo_id))
    todo = result.scalar_one_or_none()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    await db.delete(todo)
    await db.commit()


@router.delete("/completed", status_code=204)
async def clear_completed(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Todo).where(Todo.completed == True))
    todos = result.scalars().all()
    for todo in todos:
        await db.delete(todo)
    await db.commit()
