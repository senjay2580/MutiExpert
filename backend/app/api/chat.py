import json
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.extras import Conversation, Message
from app.schemas.chat import ConversationCreate, ConversationResponse, MessageCreate, MessageResponse, ModelSwitch
from app.services.rag_service import retrieve_context, build_rag_prompt
from app.services.ai_service import stream_chat
from app.services.skill_executor import load_registry

router = APIRouter()


@router.get("/", response_model=list[ConversationResponse])
async def list_conversations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).order_by(Conversation.updated_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=ConversationResponse, status_code=201)
async def create_conversation(data: ConversationCreate, db: AsyncSession = Depends(get_db)):
    conv = Conversation(
        title=data.title,
        knowledge_base_ids=data.knowledge_base_ids,
        model_provider=data.model_provider,
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


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


@router.post("/{conv_id}/messages")
async def send_message(conv_id: UUID, data: MessageCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    user_msg = Message(conversation_id=conv_id, role="user", content=data.content)
    db.add(user_msg)
    await db.commit()

    if not conv.title:
        conv.title = data.content[:50] + ("..." if len(data.content) > 50 else "")
        await db.commit()

    kb_ids = [UUID(kid) for kid in (conv.knowledge_base_ids or [])]
    context, sources = await retrieve_context(db, data.content, kb_ids)

    # 加载 Skills 信息，让 AI 知道可用技能
    skills_info = ""
    try:
        registry = load_registry()
        if registry:
            skills_info = "\n".join(
                f"- {s['name']}: {s.get('description', '')}" for s in registry
            )
    except Exception:
        pass

    system_prompt = build_rag_prompt(context, data.content, skills_info) if context else ""

    history_result = await db.execute(
        select(Message).where(Message.conversation_id == conv_id).order_by(Message.created_at.desc()).limit(10)
    )
    history = list(reversed(history_result.scalars().all()))
    messages = [{"role": m.role, "content": m.content} for m in history]
    provider = conv.model_provider or "claude"
    if provider == "codex":
        provider = "openai"

    async def event_stream():
        full_content = ""
        try:
            async for chunk in stream_chat(messages, provider, system_prompt, db=db):
                full_content += chunk
                yield f"event: chunk\ndata: {json.dumps({'content': chunk, 'type': 'text'})}\n\n"
            if sources:
                source_data = [
                    {"chunk_id": s["chunk_id"], "document_title": s["document_title"],
                     "snippet": s["content"][:200], "score": s["score"]}
                    for s in sources
                ]
                yield f"event: sources\ndata: {json.dumps({'sources': source_data})}\n\n"
            assistant_msg = Message(
                conversation_id=conv_id, role="assistant", content=full_content,
                sources=sources, model_used=provider,
            )
            db.add(assistant_msg)
            await db.commit()
            yield f"event: done\ndata: {json.dumps({'message_id': str(assistant_msg.id)})}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


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
