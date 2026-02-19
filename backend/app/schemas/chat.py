from uuid import UUID
from pydantic import BaseModel
from datetime import datetime


class ConversationCreate(BaseModel):
    title: str | None = None
    knowledge_base_ids: list[str] = []
    model_provider: str = "claude"


class ConversationResponse(BaseModel):
    id: UUID
    title: str | None
    knowledge_base_ids: list[str]
    model_provider: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    content: str


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    role: str
    content: str
    sources: list[dict]
    model_used: str | None
    tokens_used: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ModelSwitch(BaseModel):
    model_provider: str
