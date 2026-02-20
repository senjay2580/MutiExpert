from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.network import Insight
from app.services.network_scanner import scan_cross_kb_links, get_graph_data
from app.services.insight_generator import generate_insights
from app.services.feishu_service import get_feishu_service

router = APIRouter()


@router.post("/scan")
async def scan_network(db: AsyncSession = Depends(get_db)):
    scan_result = await scan_cross_kb_links(db)
    insights = await generate_insights(db)
    return {**scan_result, "insights_generated": len(insights)}


@router.get("/graph")
async def get_graph(
    kb_ids: str | None = Query(None, description="Comma-separated KB UUIDs"),
    db: AsyncSession = Depends(get_db),
):
    parsed_ids = [UUID(kid.strip()) for kid in kb_ids.split(",")] if kb_ids else None
    return await get_graph_data(db, parsed_ids)


@router.get("/insights")
async def list_insights(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Insight).order_by(Insight.created_at.desc()))
    return result.scalars().all()


@router.get("/insights/{insight_id}")
async def get_insight(insight_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Insight).where(Insight.id == insight_id))
    insight = result.scalar_one_or_none()
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")
    return insight


@router.post("/insights/{insight_id}/push-feishu")
async def push_insight_to_feishu(insight_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Insight).where(Insight.id == insight_id))
    insight = result.scalar_one_or_none()
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")
    svc = await get_feishu_service(db)
    result = await svc.send_webhook_message(
        title=f"💡 创意洞察: {insight.title}",
        content=insight.content,
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to push to Feishu"))
    insight.status = "pushed_to_feishu"
    await db.commit()
    return {"message": "Pushed to Feishu", "insight_id": str(insight_id)}
