from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.extras import CalendarEvent

router = APIRouter()


class EventCreate(BaseModel):
    title: str
    description: str | None = None
    event_type: str | None = None
    start_time: datetime
    end_time: datetime | None = None
    related_kb_id: str | None = None


class EventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    event_type: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None


@router.get("/events")
async def list_events(
    start: datetime | None = Query(None),
    end: datetime | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(CalendarEvent).order_by(CalendarEvent.start_time)
    if start:
        query = query.where(CalendarEvent.start_time >= start)
    if end:
        query = query.where(CalendarEvent.start_time <= end)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/events", status_code=201)
async def create_event(data: EventCreate, db: AsyncSession = Depends(get_db)):
    event = CalendarEvent(**data.model_dump())
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


@router.put("/events/{event_id}")
async def update_event(event_id: UUID, data: EventUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CalendarEvent).where(CalendarEvent.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(event, key, value)
    await db.commit()
    await db.refresh(event)
    return event


@router.delete("/events/{event_id}", status_code=204)
async def delete_event(event_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CalendarEvent).where(CalendarEvent.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.delete(event)
    await db.commit()
