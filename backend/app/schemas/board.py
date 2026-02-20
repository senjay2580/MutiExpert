from uuid import UUID
from pydantic import BaseModel
from datetime import datetime
from typing import Any


class BoardCreate(BaseModel):
    name: str
    description: str | None = None
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []


class BoardUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    thumbnail_url: str | None = None
    nodes: list[dict[str, Any]] | None = None
    edges: list[dict[str, Any]] | None = None
    viewport: dict[str, Any] | None = None


class BoardResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    thumbnail_url: str | None
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    viewport: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BoardListItem(BaseModel):
    id: UUID
    name: str
    description: str | None
    thumbnail_url: str | None
    node_count: int
    created_at: datetime
    updated_at: datetime
