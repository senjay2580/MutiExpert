from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, text
from app.database import get_db
from app.models.knowledge import KnowledgeBase, Document, Industry
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


@router.get("/usage-trend")
async def get_usage_trend(
    months: int = Query(6, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
):
    """月度使用趋势：本地 AI 次数 vs 飞书交互次数"""
    trunc_col = func.date_trunc("month", Conversation.created_at)
    month_col = func.to_char(trunc_col, "YYYY-MM")
    result = await db.execute(
        select(
            month_col.label("month"),
            func.count(case((Conversation.channel != "feishu", Conversation.id))).label("local_ai"),
            func.count(case((Conversation.channel == "feishu", Conversation.id))).label("feishu"),
        )
        .where(
            Conversation.created_at >= func.date_trunc(
                "month", func.now() - text(f"interval '{months} months'"),
            )
        )
        .group_by(trunc_col)
        .order_by(trunc_col)
    )
    return [{"month": r.month, "local_ai": r.local_ai, "feishu": r.feishu} for r in result.fetchall()]


@router.get("/ai-model-trend")
async def get_ai_model_trend(
    months: int = Query(6, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
):
    """月度 AI 模型调用趋势：按模型分组"""
    trunc_col = func.date_trunc("month", Message.created_at)
    month_col = func.to_char(trunc_col, "YYYY-MM")
    result = await db.execute(
        select(
            month_col.label("month"),
            func.count(case((Message.model_used == "claude", Message.id))).label("claude"),
            func.count(
                case((Message.model_used.in_(["openai", "codex"]), Message.id))
            ).label("openai"),
        )
        .where(
            Message.role == "assistant",
            Message.created_at >= func.date_trunc(
                "month", func.now() - text(f"interval '{months} months'"),
            ),
        )
        .group_by(trunc_col)
        .order_by(trunc_col)
    )
    return [{"month": r.month, "claude": r.claude, "openai": r.openai} for r in result.fetchall()]


@router.get("/industry-distribution")
async def get_industry_distribution(db: AsyncSession = Depends(get_db)):
    """知识库行业分布"""
    result = await db.execute(
        select(
            Industry.name,
            Industry.color,
            func.count(KnowledgeBase.id).label("value"),
        )
        .select_from(KnowledgeBase)
        .join(Industry, KnowledgeBase.industry_id == Industry.id)
        .group_by(Industry.id, Industry.name, Industry.color)
        .order_by(func.count(KnowledgeBase.id).desc())
    )
    # 未分类的知识库
    uncategorized = (await db.execute(
        select(func.count(KnowledgeBase.id)).where(KnowledgeBase.industry_id.is_(None))
    )).scalar() or 0

    items = [{"name": r.name, "color": r.color, "value": r.value} for r in result.fetchall()]
    if uncategorized > 0:
        items.append({"name": "未分类", "color": "#94a3b8", "value": uncategorized})
    return items
