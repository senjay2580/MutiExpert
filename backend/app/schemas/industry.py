from uuid import UUID
from pydantic import BaseModel
from datetime import datetime


class IndustryCreate(BaseModel):
    name: str
    description: str | None = None
    icon: str | None = None
    color: str | None = None


class IndustryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    color: str | None = None


class IndustryResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    icon: str | None
    color: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
