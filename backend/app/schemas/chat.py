from uuid import UUID
from pydantic import BaseModel, field_validator
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
    channel: str = "web"
    default_modes: list[str] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    content: str
    model_provider: str | None = None
    modes: list[str] | None = None  # 消息级别覆盖：["knowledge","search","tools"]
    attachments: list[dict] | None = None  # [{filename, path, size, mime_type, url}]


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    role: str
    content: str
    thinking_content: str | None = None
    sources: list[dict] = []
    attachments: list[dict] = []
    tool_calls: list[dict] = []
    model_used: str | None = None
    tokens_used: int | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    cost_usd: float | None = None
    latency_ms: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("sources", "attachments", "tool_calls", mode="before")
    @classmethod
    def none_to_list(cls, v: list | None) -> list:
        return v if v is not None else []


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
