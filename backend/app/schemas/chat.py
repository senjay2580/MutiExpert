from uuid import UUID
from pydantic import BaseModel
from datetime import datetime


class ConversationCreate(BaseModel):
    title: str | None = None
    knowledge_base_ids: list[str] = []
    model_provider: str = "claude"
    default_modes: list[str] = ["knowledge"]  # ["knowledge","search","tools"]


class ConversationResponse(BaseModel):
    id: UUID
    title: str | None
    knowledge_base_ids: list[str]
    model_provider: str
    is_pinned: bool
    pinned_at: datetime | None
    channel: str
    default_modes: list[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    content: str
    model_provider: str | None = None
    modes: list[str] | None = None  # 消息级别覆盖：["knowledge","search","tools"]


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    role: str
    content: str
    thinking_content: str | None = None
    sources: list[dict]
    model_used: str | None
    tokens_used: int | None
    prompt_tokens: int | None
    completion_tokens: int | None
    cost_usd: float | None
    latency_ms: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ModelSwitch(BaseModel):
    model_provider: str


class ConversationUpdate(BaseModel):
    title: str | None = None
    knowledge_base_ids: list[str] | None = None
    is_pinned: bool | None = None
    default_modes: list[str] | None = None


class ConversationMemoryUpdate(BaseModel):
    memory_summary: str | None = None
    memory_enabled: bool | None = None


class ConversationMemoryResponse(BaseModel):
    conversation_id: UUID
    memory_summary: str | None
    memory_enabled: bool

    model_config = {"from_attributes": True}
