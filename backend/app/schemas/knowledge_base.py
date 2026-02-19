from uuid import UUID
from pydantic import BaseModel
from datetime import datetime


class KnowledgeBaseCreate(BaseModel):
    name: str
    description: str | None = None
    industry_id: str | None = None


class KnowledgeBaseUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    industry_id: str | None = None


class KnowledgeBaseResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    industry_id: UUID | None
    document_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentResponse(BaseModel):
    id: UUID
    knowledge_base_id: UUID
    title: str
    file_type: str
    file_url: str | None
    file_size: int | None
    source_url: str | None = None
    content_html: str | None = None
    chunk_count: int
    status: str
    error_message: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LinkDocumentCreate(BaseModel):
    title: str
    source_url: str


class ArticleDocumentCreate(BaseModel):
    title: str
    content_html: str
