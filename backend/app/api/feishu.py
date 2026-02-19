from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.extras import FeishuConfig
from app.services.feishu_service import get_feishu_service

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
async def feishu_webhook(request: Request):
    body = await request.json()
    svc = get_feishu_service()
    parsed = svc.parse_webhook_event(body)
    if parsed["type"] == "challenge":
        return {"challenge": parsed["challenge"]}
    # 收到消息事件时可扩展自动回复逻辑
    return {"code": 0, "msg": "ok", "event": parsed}


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
