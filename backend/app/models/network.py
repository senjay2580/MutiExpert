from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import String, Text, Integer, Float, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMP
from pgvector.sqlalchemy import Vector
from app.database import Base

if TYPE_CHECKING:
    from app.models.knowledge import Document


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    knowledge_base_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding = mapped_column(Vector(1024), nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    document: Mapped["Document"] = relationship(back_populates="chunks")

    __table_args__ = (Index("idx_chunks_kb_id", "knowledge_base_id"),)


class KnowledgeLink(Base):
    __tablename__ = "knowledge_links"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_chunk_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("document_chunks.id", ondelete="CASCADE"))
    target_chunk_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("document_chunks.id", ondelete="CASCADE"))
    source_kb_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    target_kb_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    relation_type: Mapped[str | None] = mapped_column(String(50))
    strength: Mapped[float | None] = mapped_column(Float)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    __table_args__ = (Index("idx_links_source_target", "source_kb_id", "target_kb_id"),)


class Insight(Base):
    __tablename__ = "insights"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    related_kb_ids = mapped_column(JSONB, default=list)
    related_link_ids = mapped_column(JSONB, default=list)
    status: Mapped[str] = mapped_column(String(20), default="new")
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
