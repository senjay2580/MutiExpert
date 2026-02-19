from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db, AsyncSessionLocal
from app.models.extras import FeishuConfig
from app.models.knowledge import KnowledgeBase
from app.services.feishu_service import get_feishu_service
from app.services.rag_service import retrieve_context, build_rag_prompt
from app.services.ai_service import stream_chat
from app.services.skill_executor import load_registry

router = APIRouter()


class FeishuConfigUpdate(BaseModel):
    app_id: str | None = None
    app_secret: str | None = None
    webhook_url: str | None = None
    bot_enabled: bool = False


class FeishuMessageRequest(BaseModel):
    chat_id: str
    text: str


@router.post("/webhook")
async def feishu_webhook(request: Request, background_tasks: BackgroundTasks):
    body = await request.json()
    svc = get_feishu_service()
    parsed = svc.parse_webhook_event(body)
    if parsed["type"] == "challenge":
        return {"challenge": parsed["challenge"]}
    if parsed["type"] == "message" and parsed.get("text"):
        background_tasks.add_task(_handle_feishu_question, parsed)
    return {"code": 0, "msg": "ok"}


async def _handle_feishu_question(parsed: dict):
    """后台任务：用 RAG + AI 回答飞书消息并回复"""
    svc = get_feishu_service()
    question = parsed["text"]
    message_id = parsed.get("message_id")
    if not message_id:
        return

    try:
        async with AsyncSessionLocal() as db:
            # 获取所有知识库 ID 用于检索
            result = await db.execute(select(KnowledgeBase.id))
            kb_ids = [row[0] for row in result.all()]

            context, sources = await retrieve_context(db, question, kb_ids) if kb_ids else ("", [])

            # 加载 Skills 信息
            skills_info = ""
            try:
                registry = load_registry()
                if registry:
                    skills_info = "\n".join(f"- {s['name']}: {s.get('description', '')}" for s in registry)
            except Exception:
                pass

            system_prompt = build_rag_prompt(context, question, skills_info) if context else ""
            messages = [{"role": "user", "content": question}]

            full_response = ""
            async for chunk in stream_chat(messages, "claude", system_prompt):
                full_response += chunk

        await svc.reply_message(message_id, full_response or "抱歉，暂时无法回答这个问题。")
    except Exception as e:
        await svc.reply_message(message_id, f"处理出错: {str(e)}")


@router.get("/config")
async def get_feishu_config(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FeishuConfig).limit(1))
    config = result.scalar_one_or_none()
    if not config:
        return {"app_id": "", "webhook_url": "", "bot_enabled": False}
    return {
        "app_id": config.app_id or "",
        "webhook_url": config.webhook_url or "",
        "bot_enabled": config.bot_enabled,
    }


@router.put("/config")
async def update_feishu_config(data: FeishuConfigUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FeishuConfig).limit(1))
    config = result.scalar_one_or_none()
    if not config:
        config = FeishuConfig()
        db.add(config)
    config.app_id = data.app_id
    config.app_secret_encrypted = data.app_secret  # TODO: encrypt in production
    config.webhook_url = data.webhook_url
    config.bot_enabled = data.bot_enabled
    await db.commit()
    await db.refresh(config)
    return {"message": "Config saved"}


@router.post("/test-connection")
async def test_feishu_connection():
    svc = get_feishu_service()
    result = await svc.test_connection()
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.post("/send-message")
async def send_feishu_message(data: FeishuMessageRequest):
    svc = get_feishu_service()
    result = await svc.send_text_message(data.chat_id, data.text)
    if not result["success"]:
        raise HTTPException(status_code=400, detail="Failed to send message")
    return result
