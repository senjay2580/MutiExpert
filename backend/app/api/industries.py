from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.knowledge import Industry
from app.schemas.industry import IndustryCreate, IndustryUpdate, IndustryResponse

router = APIRouter()


@router.get("/", response_model=list[IndustryResponse])
async def list_industries(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Industry).order_by(Industry.name))
    return result.scalars().all()


@router.post("/", response_model=IndustryResponse, status_code=201)
async def create_industry(data: IndustryCreate, db: AsyncSession = Depends(get_db)):
    industry = Industry(**data.model_dump())
    db.add(industry)
    await db.commit()
    await db.refresh(industry)
    return industry


@router.put("/{industry_id}", response_model=IndustryResponse)
async def update_industry(industry_id: UUID, data: IndustryUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Industry).where(Industry.id == industry_id))
    industry = result.scalar_one_or_none()
    if not industry:
        raise HTTPException(status_code=404, detail="Industry not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(industry, key, value)
    await db.commit()
    await db.refresh(industry)
    return industry


@router.delete("/{industry_id}", status_code=204)
async def delete_industry(industry_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Industry).where(Industry.id == industry_id))
    industry = result.scalar_one_or_none()
    if not industry:
        raise HTTPException(status_code=404, detail="Industry not found")
    await db.delete(industry)
    await db.commit()
