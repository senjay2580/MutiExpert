from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.knowledge import KnowledgeBase, Document
from app.models.extras import Conversation, Message
from app.models.network import Insight

router = APIRouter()


@router.get("/overview")
async def get_overview(db: AsyncSession = Depends(get_db)):
    kb_count = (await db.execute(select(func.count(KnowledgeBase.id)))).scalar() or 0
    doc_count = (await db.execute(select(func.count(Document.id)))).scalar() or 0
    conv_count = (await db.execute(select(func.count(Conversation.id)))).scalar() or 0
    insight_count = (await db.execute(select(func.count(Insight.id)))).scalar() or 0
    return {
        "total_knowledge_bases": kb_count,
        "total_documents": doc_count,
        "total_conversations": conv_count,
        "total_insights": insight_count,
    }


@router.get("/ai-usage")
async def get_ai_usage(db: AsyncSession = Depends(get_db)):
    claude_count = (await db.execute(
        select(func.count(Message.id)).where(Message.role == "assistant", Message.model_used == "claude")
    )).scalar() or 0
    codex_count = (await db.execute(
        select(func.count(Message.id)).where(
            Message.role == "assistant",
            Message.model_used.in_(["openai", "codex"]),
        )
    )).scalar() or 0
    total_tokens = (await db.execute(
        select(func.coalesce(func.sum(Message.tokens_used), 0)).where(Message.role == "assistant")
    )).scalar() or 0
    return {"claude_calls": claude_count, "openai_calls": codex_count, "total_tokens": total_tokens}


@router.get("/activity-timeline")
async def get_activity_timeline(db: AsyncSession = Depends(get_db)):
    # Recent documents
    docs = (await db.execute(
        select(Document.id, Document.title, Document.created_at, Document.status)
        .order_by(Document.created_at.desc()).limit(10)
    )).fetchall()

    # Recent conversations
    convs = (await db.execute(
        select(Conversation.id, Conversation.title, Conversation.created_at)
        .order_by(Conversation.created_at.desc()).limit(10)
    )).fetchall()

    timeline = []
    for d in docs:
        timeline.append({"type": "document", "id": str(d.id), "title": d.title, "time": d.created_at.isoformat(), "status": d.status})
    for c in convs:
        timeline.append({"type": "conversation", "id": str(c.id), "title": c.title or "未命名对话", "time": c.created_at.isoformat()})

    timeline.sort(key=lambda x: x["time"], reverse=True)
    return timeline[:15]


@router.get("/knowledge-heatmap")
async def get_knowledge_heatmap(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(KnowledgeBase.id, KnowledgeBase.name, KnowledgeBase.document_count)
        .order_by(KnowledgeBase.document_count.desc())
    )
    return [{"id": str(r.id), "name": r.name, "count": r.document_count or 0} for r in result.fetchall()]
