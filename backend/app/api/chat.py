import json
import asyncio
import time
import math
from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, delete
from app.database import get_db, AsyncSessionLocal
from app.models.extras import Conversation, Message
from app.schemas.chat import (
    ConversationCreate,
    ConversationResponse,
    ConversationUpdate,
    MessageCreate,
    MessageResponse,
    ModelSwitch,
    ConversationMemoryResponse,
    ConversationMemoryUpdate,
)
from app.services.rag_service import retrieve_context, build_rag_context
from app.services.ai_service import stream_chat
from app.services.system_prompt_service import build_system_prompt
from app.services.pipeline_service import PipelineRequest, run_stream as pipeline_run_stream

router = APIRouter()


@router.get("/", response_model=list[ConversationResponse])
async def list_conversations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation)
        .order_by(
            Conversation.is_pinned.desc(),
            Conversation.pinned_at.desc().nullslast(),
            Conversation.updated_at.desc(),
        )
    )
    return result.scalars().all()


@router.post("/", response_model=ConversationResponse, status_code=201)
async def create_conversation(data: ConversationCreate, db: AsyncSession = Depends(get_db)):
    conv = Conversation(
        title=data.title,
        knowledge_base_ids=data.knowledge_base_ids,
        model_provider=data.model_provider,
        default_modes=data.default_modes,
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


@router.get("/search", response_model=list[ConversationResponse])
async def search_conversations(q: str, db: AsyncSession = Depends(get_db)):
    term = q.strip()
    if not term:
        return []
    like = f"%{term}%"
    result = await db.execute(
        select(Conversation)
        .outerjoin(Message, Message.conversation_id == Conversation.id)
        .where(or_(Conversation.title.ilike(like), Message.content.ilike(like)))
        .distinct(Conversation.id)
        .order_by(
            Conversation.is_pinned.desc(),
            Conversation.pinned_at.desc().nullslast(),
            Conversation.updated_at.desc(),
        )
        .limit(200)
    )
    return result.scalars().all()


@router.get("/{conv_id}", response_model=ConversationResponse)
async def get_conversation(conv_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.get("/{conv_id}/messages", response_model=list[MessageResponse])
async def list_messages(conv_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Message).where(Message.conversation_id == conv_id).order_by(Message.created_at)
    )
    return result.scalars().all()


@router.delete("/{conv_id}", status_code=204)
async def delete_conversation(conv_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db.delete(conv)
    await db.commit()


@router.patch("/{conv_id}", response_model=ConversationResponse)
async def update_conversation(
    conv_id: UUID,
    data: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if data.title is not None:
        conv.title = data.title
    if data.knowledge_base_ids is not None:
        conv.knowledge_base_ids = data.knowledge_base_ids
    if data.is_pinned is not None:
        conv.is_pinned = data.is_pinned
        conv.pinned_at = datetime.utcnow() if data.is_pinned else None
    if data.default_modes is not None:
        conv.default_modes = data.default_modes
    conv.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(conv)
    return conv


@router.post("/{conv_id}/messages")
async def send_message(conv_id: UUID, data: MessageCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # 消息级别的 model_provider 优先，同时同步到会话
    if data.model_provider and data.model_provider != conv.model_provider:
        conv.model_provider = data.model_provider

    user_msg = Message(conversation_id=conv_id, role="user", content=data.content)
    db.add(user_msg)
    conv.updated_at = datetime.utcnow()
    await db.commit()

    if not conv.title:
        conv.title = data.content[:50] + ("..." if len(data.content) > 50 else "")
        await db.commit()

    # 决定增强模式
    modes = set(data.modes or conv.default_modes or ["knowledge"])
    use_pipeline = bool(modes & {"tools", "search"})

    if use_pipeline:
        return _stream_pipeline_response(db, conv, conv_id, data.content, modes)

    # 纯 knowledge / 纯模型 → 走现有流式路径（向后兼容）
    context, sources = await _build_context(db, conv, data.content)
    system_prompt = await build_system_prompt(db, provider=_resolve_provider(conv.model_provider))
    if context:
        system_prompt += "\n\n" + build_rag_context(context, data.content)
    if conv.memory_enabled and conv.memory_summary:
        system_prompt += f"\n\n会话记忆摘要（仅作背景，不需逐字重复）:\n{conv.memory_summary}"

    history_result = await db.execute(
        select(Message).where(Message.conversation_id == conv_id).order_by(Message.created_at.desc()).limit(10)
    )
    history = list(reversed(history_result.scalars().all()))
    messages = [{"role": m.role, "content": m.content} for m in history]
    return _stream_assistant_response(
        db=db, conv=conv, conv_id=conv_id,
        messages=messages, system_prompt=system_prompt, sources=sources,
    )


@router.put("/{conv_id}/model", response_model=ConversationResponse)
async def switch_model(conv_id: UUID, data: ModelSwitch, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv.model_provider = data.model_provider
    await db.commit()
    await db.refresh(conv)
    return conv


@router.post("/{conv_id}/regenerate")
async def regenerate_last_answer(conv_id: UUID, data: MessageCreate | None = None, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if data and data.model_provider and data.model_provider != conv.model_provider:
        conv.model_provider = data.model_provider

    history_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv_id)
        .order_by(Message.created_at)
    )
    history = history_result.scalars().all()
    last_user = None
    for message in reversed(history):
        if message.role == "user":
            last_user = message
            break
    if not last_user:
        raise HTTPException(status_code=400, detail="No user message to regenerate")

    await db.execute(
        delete(Message).where(
            Message.conversation_id == conv_id,
            Message.created_at > last_user.created_at,
        )
    )
    await db.commit()

    context, sources = await _build_context(db, conv, last_user.content)
    system_prompt = await build_system_prompt(db, provider=_resolve_provider(conv.model_provider))
    if context:
        system_prompt += "\n\n" + build_rag_context(context, last_user.content)
    if conv.memory_enabled and conv.memory_summary:
        system_prompt += f"\n\n会话记忆摘要（仅作背景，不需逐字重复）:\n{conv.memory_summary}"

    history_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv_id)
        .order_by(Message.created_at.desc())
        .limit(10)
    )
    messages = [{"role": m.role, "content": m.content} for m in reversed(history_result.scalars().all())]
    return _stream_assistant_response(
        db=db,
        conv=conv,
        conv_id=conv_id,
        messages=messages,
        system_prompt=system_prompt,
        sources=sources,
    )


@router.post("/{conv_id}/messages/{message_id}/edit")
async def edit_last_user_message(
    conv_id: UUID,
    message_id: UUID,
    data: MessageCreate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if data.model_provider and data.model_provider != conv.model_provider:
        conv.model_provider = data.model_provider

    msg_result = await db.execute(
        select(Message).where(Message.id == message_id, Message.conversation_id == conv_id)
    )
    message = msg_result.scalar_one_or_none()
    if not message or message.role != "user":
        raise HTTPException(status_code=400, detail="Message not editable")
    last_user_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv_id, Message.role == "user")
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    last_user = last_user_result.scalar_one_or_none()
    if not last_user or last_user.id != message.id:
        raise HTTPException(status_code=400, detail="Only last user message can be edited")

    await db.execute(
        delete(Message).where(
            Message.conversation_id == conv_id,
            Message.created_at > message.created_at,
        )
    )
    message.content = data.content
    conv.updated_at = datetime.utcnow()
    await db.commit()

    context, sources = await _build_context(db, conv, message.content)
    system_prompt = await build_system_prompt(db, provider=_resolve_provider(conv.model_provider))
    if context:
        system_prompt += "\n\n" + build_rag_context(context, message.content)
    if conv.memory_enabled and conv.memory_summary:
        system_prompt += f"\n\n会话记忆摘要（仅作背景，不需逐字重复）:\n{conv.memory_summary}"

    history_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv_id)
        .order_by(Message.created_at.desc())
        .limit(10)
    )
    messages = [{"role": m.role, "content": m.content} for m in reversed(history_result.scalars().all())]
    return _stream_assistant_response(
        db=db,
        conv=conv,
        conv_id=conv_id,
        messages=messages,
        system_prompt=system_prompt,
        sources=sources,
    )


@router.get("/{conv_id}/memory", response_model=ConversationMemoryResponse)
async def get_conversation_memory(conv_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return ConversationMemoryResponse(
        conversation_id=conv.id,
        memory_summary=conv.memory_summary,
        memory_enabled=conv.memory_enabled,
    )


@router.put("/{conv_id}/memory", response_model=ConversationMemoryResponse)
async def update_conversation_memory(
    conv_id: UUID,
    data: ConversationMemoryUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if data.memory_summary is not None:
        conv.memory_summary = data.memory_summary
    if data.memory_enabled is not None:
        conv.memory_enabled = data.memory_enabled
    conv.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(conv)
    return ConversationMemoryResponse(
        conversation_id=conv.id,
        memory_summary=conv.memory_summary,
        memory_enabled=conv.memory_enabled,
    )


@router.post("/{conv_id}/memory/refresh", response_model=ConversationMemoryResponse)
async def refresh_conversation_memory(conv_id: UUID):
    await _update_conversation_memory(conv_id)
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
        conv = result.scalar_one_or_none()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return ConversationMemoryResponse(
            conversation_id=conv.id,
            memory_summary=conv.memory_summary,
            memory_enabled=conv.memory_enabled,
        )


async def _update_conversation_memory(conv_id: UUID) -> None:
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Conversation).where(Conversation.id == conv_id))
        conv = result.scalar_one_or_none()
        if not conv or not conv.memory_enabled:
            return

        history_result = await session.execute(
            select(Message)
            .where(Message.conversation_id == conv_id)
            .order_by(Message.created_at.desc())
            .limit(12)
        )
        history = list(reversed(history_result.scalars().all()))
        if len(history) < 4:
            return

        history_text = "\n".join([f"{m.role}: {m.content}" for m in history])
        base_summary = conv.memory_summary or ""
        summary_prompt = f"""你是会话记忆整理助手，需要为同一会话维护一份简洁的长期记忆摘要。
规则：
1) 只保留稳定事实、偏好、目标、约束与关键结论，不要记录临时寒暄。
2) 用中文输出，长度控制在 300-600 字以内。
3) 保持客观，不要编造。

已有记忆摘要：
{base_summary or "（空）"}

最近对话片段：
{history_text}

请输出更新后的记忆摘要："""

        summary = ""
        async for chunk in stream_chat(
            [{"role": "user", "content": summary_prompt}],
            provider=conv.model_provider,
            system_prompt="",
            db=session,
        ):
            if chunk.type == "text":
                summary += chunk.content

        summary = summary.strip()
        if summary:
            conv.memory_summary = summary
            conv.updated_at = datetime.utcnow()
            await session.commit()


async def _build_context(db: AsyncSession, conv: Conversation, question: str) -> tuple[str, list[dict]]:
    kb_ids = []
    for kid in (conv.knowledge_base_ids or []):
        try:
            kb_ids.append(UUID(kid))
        except Exception:
            continue
    if not kb_ids:
        return "", []
    return await retrieve_context(db, question, kb_ids)


def _resolve_provider(provider: str | None) -> str:
    resolved = provider or "claude"
    if resolved == "codex":
        return "openai"
    return resolved


def _estimate_tokens(text: str) -> int:
    if not text:
        return 0
    return max(1, math.ceil(len(text) / 4))


def _stream_assistant_response(
    db: AsyncSession,
    conv: Conversation,
    conv_id: UUID,
    messages: list[dict],
    system_prompt: str,
    sources: list[dict],
) -> StreamingResponse:
    provider = _resolve_provider(conv.model_provider)
    prompt_tokens = _estimate_tokens(system_prompt) + sum(_estimate_tokens(m.get("content", "")) for m in messages)

    async def event_stream():
        full_content = ""
        full_thinking = ""
        started = time.monotonic()
        try:
            async for chunk in stream_chat(messages, provider, system_prompt, db=db):
                if chunk.type == "thinking":
                    full_thinking += chunk.content
                    yield f"event: thinking\ndata: {json.dumps({'content': chunk.content})}\n\n"
                else:
                    full_content += chunk.content
                    yield f"event: chunk\ndata: {json.dumps({'content': chunk.content, 'type': 'text'})}\n\n"
            if sources:
                source_data = [
                    {"chunk_id": s["chunk_id"], "document_title": s["document_title"],
                     "snippet": s["content"][:200], "score": s["score"]}
                    for s in sources
                ]
                yield f"event: sources\ndata: {json.dumps({'sources': source_data})}\n\n"
            latency_ms = int((time.monotonic() - started) * 1000)
            completion_tokens = _estimate_tokens(full_content)
            assistant_msg = Message(
                conversation_id=conv_id,
                role="assistant",
                content=full_content,
                thinking_content=full_thinking or None,
                sources=sources,
                model_used=provider,
                latency_ms=latency_ms,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                tokens_used=prompt_tokens + completion_tokens if prompt_tokens or completion_tokens else None,
            )
            db.add(assistant_msg)
            conv.updated_at = datetime.utcnow()
            await db.commit()
            payload = {
                "message_id": str(assistant_msg.id),
                "latency_ms": latency_ms,
                "tokens_used": assistant_msg.tokens_used,
                "prompt_tokens": assistant_msg.prompt_tokens,
                "completion_tokens": assistant_msg.completion_tokens,
                "cost_usd": assistant_msg.cost_usd,
            }
            yield f"event: done\ndata: {json.dumps(payload)}\n\n"
            if conv.memory_enabled:
                asyncio.create_task(_update_conversation_memory(conv_id))
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


def _stream_pipeline_response(
    db: AsyncSession,
    conv: Conversation,
    conv_id: UUID,
    message: str,
    modes: set[str],
) -> StreamingResponse:
    """通过统一管道处理消息（支持工具调用 + 网络搜索 + RAG）"""
    provider = _resolve_provider(conv.model_provider)

    # 加载历史
    async def _load_history() -> list[dict]:
        result = await db.execute(
            select(Message).where(Message.conversation_id == conv_id)
            .order_by(Message.created_at.desc()).limit(10)
        )
        msgs = list(reversed(result.scalars().all()))
        # 排除最后一条（刚保存的 user_msg）
        return [{"role": m.role, "content": m.content} for m in msgs]

    async def event_stream():
        started = time.monotonic()
        full_content = ""
        full_thinking = ""
        all_sources: list[dict] = []
        all_tool_calls: list[dict] = []

        try:
            history = await _load_history()
            kb_ids = []
            for kid in (conv.knowledge_base_ids or []):
                try:
                    kb_ids.append(UUID(kid))
                except Exception:
                    continue

            request = PipelineRequest(
                message=message,
                conversation_id=conv_id,
                channel=conv.channel or "web",
                provider=provider,
                modes=modes,
                knowledge_base_ids=kb_ids,
                history=history,
            )

            async for event in pipeline_run_stream(request, db):
                if event.type == "text_chunk":
                    chunk = event.data.get("content", "")
                    full_content += chunk
                    yield f"event: chunk\ndata: {json.dumps({'content': chunk, 'type': 'text'})}\n\n"
                elif event.type == "thinking":
                    chunk = event.data.get("content", "")
                    full_thinking += chunk
                    yield f"event: thinking\ndata: {json.dumps({'content': chunk})}\n\n"
                elif event.type == "sources":
                    all_sources = event.data.get("sources", [])
                    source_data = [
                        {"chunk_id": s.get("chunk_id", ""), "document_title": s.get("document_title", ""),
                         "snippet": s.get("content", "")[:200], "score": s.get("score", 0)}
                        for s in all_sources
                    ]
                    yield f"event: sources\ndata: {json.dumps({'sources': source_data})}\n\n"
                elif event.type == "tool_start":
                    yield f"event: tool_start\ndata: {json.dumps(event.data)}\n\n"
                elif event.type == "tool_result":
                    yield f"event: tool_result\ndata: {json.dumps(event.data)}\n\n"
                elif event.type == "done":
                    all_tool_calls = event.data.get("tool_calls", [])

            latency_ms = int((time.monotonic() - started) * 1000)
            completion_tokens = _estimate_tokens(full_content)
            prompt_tokens = _estimate_tokens(message)

            assistant_msg = Message(
                conversation_id=conv_id,
                role="assistant",
                content=full_content,
                thinking_content=full_thinking or None,
                sources=all_sources,
                tool_calls=all_tool_calls,
                model_used=provider,
                latency_ms=latency_ms,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                tokens_used=(prompt_tokens + completion_tokens) if (prompt_tokens or completion_tokens) else None,
            )
            db.add(assistant_msg)
            conv.updated_at = datetime.utcnow()
            await db.commit()

            payload = {
                "message_id": str(assistant_msg.id),
                "latency_ms": latency_ms,
                "tokens_used": assistant_msg.tokens_used,
                "prompt_tokens": assistant_msg.prompt_tokens,
                "completion_tokens": assistant_msg.completion_tokens,
                "cost_usd": assistant_msg.cost_usd,
                "tool_calls": all_tool_calls,
            }
            yield f"event: done\ndata: {json.dumps(payload)}\n\n"

            if conv.memory_enabled:
                asyncio.create_task(_update_conversation_memory(conv_id))
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
