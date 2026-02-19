from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import String, Text, Integer, BigInteger, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from app.database import Base

if TYPE_CHECKING:
    from app.models.network import DocumentChunk


class Industry(Base):
    __tablename__ = "industries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str | None] = mapped_column(String(50))
    color: Mapped[str | None] = mapped_column(String(7))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    knowledge_bases: Mapped[list["KnowledgeBase"]] = relationship(back_populates="industry")


class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    industry_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("industries.id", ondelete="SET NULL"))
    document_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    industry: Mapped[Industry | None] = relationship(back_populates="knowledge_bases")
    documents: Mapped[list["Document"]] = relationship(back_populates="knowledge_base", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    knowledge_base_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)
    file_url: Mapped[str | None] = mapped_column(Text)
    file_size: Mapped[int | None] = mapped_column(BigInteger)
    content_text: Mapped[str | None] = mapped_column(Text)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="uploading")
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    knowledge_base: Mapped[KnowledgeBase] = relationship(back_populates="documents")
    chunks: Mapped[list["DocumentChunk"]] = relationship(back_populates="document", cascade="all, delete-orphan")

    __table_args__ = (Index("idx_documents_kb_id", "knowledge_base_id"),)
