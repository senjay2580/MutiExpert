import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, Boolean, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMP
from app.database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str | None] = mapped_column(String(500))
    knowledge_base_ids = mapped_column(JSONB, default=list)
    model_provider: Mapped[str] = mapped_column(String(20), default="claude")
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sources = mapped_column(JSONB, default=list)
    model_used: Mapped[str | None] = mapped_column(String(50))
    tokens_used: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    __table_args__ = (Index("idx_messages_conv_time", "conversation_id", "created_at"),)


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    config = mapped_column(JSONB, default=dict)
    file_path: Mapped[str | None] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    event_type: Mapped[str | None] = mapped_column(String(50))
    start_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    end_time: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    related_kb_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="SET NULL"))
    feishu_event_id: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (Index("idx_calendar_time", "start_time", "end_time"),)


class ScheduledTask(Base):
    __tablename__ = "scheduled_tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    cron_expression: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "0 9 * * 1" = 每周一9点
    task_type: Mapped[str] = mapped_column(String(50), nullable=False)  # skill_exec | ai_query | feishu_push
    task_config = mapped_column(JSONB, default=dict)  # skill_id, prompt, kb_ids, feishu_chat_id 等
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_run_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    last_run_status: Mapped[str | None] = mapped_column(String(20))  # success | failed
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class FeishuConfig(Base):
    __tablename__ = "feishu_config"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    app_id: Mapped[str | None] = mapped_column(String(200))
    app_secret_encrypted: Mapped[str | None] = mapped_column(Text)
    webhook_url: Mapped[str | None] = mapped_column(Text)
    bot_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
