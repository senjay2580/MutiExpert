import json
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import get_settings
from app.database import get_db, AsyncSessionLocal
from app.models.extras import FeishuConfig
from app.models.knowledge import KnowledgeBase
from app.services.feishu_service import (
    get_feishu_service,
    verify_feishu_signature,
    decrypt_feishu_event,
    encrypt_secret,
)
from app.services.rag_service import retrieve_context, build_rag_prompt
from app.services.ai_service import stream_chat
from app.services.skill_executor import load_registry

router = APIRouter()


class FeishuConfigUpdate(BaseModel):
    app_id: str | None = None
    app_secret: str | None = None
    webhook_url: str | None = None
    verification_token: str | None = None
    encrypt_key: str | None = None
    default_chat_id: str | None = None
    bot_enabled: bool | None = None


class FeishuMessageRequest(BaseModel):
    chat_id: str | None = None
    text: str
    use_webhook: bool | None = None


@router.post("/webhook")
async def feishu_webhook(request: Request, background_tasks: BackgroundTasks):
    raw_body = await request.body()
    if not raw_body:
        raise HTTPException(status_code=400, detail="Empty request body")

    config = None
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(FeishuConfig).limit(1))
        config = result.scalar_one_or_none()

    settings = get_settings()
    encrypt_key = (config.encrypt_key if config else "") or settings.feishu_encrypt_key
    verification_token = (config.verification_token if config else "") or settings.feishu_verification_token

    signature = request.headers.get("X-Lark-Signature")
    timestamp = request.headers.get("X-Lark-Request-Timestamp")
    nonce = request.headers.get("X-Lark-Request-Nonce")
    if signature or encrypt_key:
        if not encrypt_key:
            raise HTTPException(status_code=400, detail="Missing encrypt_key for signature verification")
        if not verify_feishu_signature(encrypt_key, timestamp, nonce, raw_body, signature):
            raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        body = json.loads(raw_body.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    if isinstance(body, dict) and "encrypt" in body:
        if not encrypt_key:
            raise HTTPException(status_code=400, detail="Missing encrypt_key for encrypted payload")
        try:
            decrypted = decrypt_feishu_event(encrypt_key, body["encrypt"])
            body = json.loads(decrypted)
        except Exception:
            raise HTTPException(status_code=400, detail="Failed to decrypt payload")

    svc = await get_feishu_service()
    parsed = svc.parse_webhook_event(body)
    if parsed["type"] == "challenge":
        return {"challenge": parsed["challenge"]}
    if not config or not config.bot_enabled:
        return {"code": 0, "msg": "bot disabled"}
    if verification_token:
        token = parsed.get("token")
        if not token or verification_token != token:
            raise HTTPException(status_code=401, detail="Invalid verification token")
    if parsed["type"] == "message" and parsed.get("text") and parsed.get("message_type") == "text":
        background_tasks.add_task(_handle_feishu_question, parsed)
    return {"code": 0, "msg": "ok"}


async def _handle_feishu_question(parsed: dict):
    """后台任务：用 RAG + AI 回答飞书消息并回复"""
    question = parsed["text"]
    message_id = parsed.get("message_id")
    if not message_id:
        return
    if parsed.get("sender_type") in {"app", "bot"}:
        return

    try:
        svc = None
        async with AsyncSessionLocal() as db:
            svc = await get_feishu_service(db)
            # 绑定默认 chat_id
            if question.strip().lower() in {"绑定", "bind", "绑定机器人"}:
                result = await db.execute(select(FeishuConfig).limit(1))
                config = result.scalar_one_or_none()
                if config:
                    config.default_chat_id = parsed.get("chat_id")
                    await db.commit()
                if svc is not None:
                    await svc.reply_message(message_id, "已绑定当前会话为默认推送目标。")
                return

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
            async for chunk in stream_chat(messages, "claude", system_prompt, db=db):
                full_response += chunk

        if svc is not None:
            await svc.reply_message(message_id, full_response or "抱歉，暂时无法回答这个问题。")
    except Exception as e:
        if svc is not None:
            await svc.reply_message(message_id, f"处理出错: {str(e)}")


@router.get("/config")
async def get_feishu_config(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FeishuConfig).limit(1))
    config = result.scalar_one_or_none()
    if not config:
        return {
            "app_id": "",
            "app_secret_encrypted": "",
            "webhook_url": "",
            "verification_token": "",
            "encrypt_key": "",
            "default_chat_id": "",
            "bot_enabled": False,
        }
    return {
        "app_id": config.app_id or "",
        "app_secret_encrypted": "",
        "webhook_url": config.webhook_url or "",
        "verification_token": "",
        "encrypt_key": "",
        "default_chat_id": config.default_chat_id or "",
        "bot_enabled": config.bot_enabled,
    }


@router.put("/config")
async def update_feishu_config(data: FeishuConfigUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FeishuConfig).limit(1))
    config = result.scalar_one_or_none()
    if not config:
        config = FeishuConfig()
        db.add(config)

    settings = get_settings()
    if data.app_id is not None:
        config.app_id = data.app_id
    if data.webhook_url is not None:
        config.webhook_url = data.webhook_url
    if data.app_secret is not None and data.app_secret != "":
        config.app_secret_encrypted = encrypt_secret(data.app_secret, settings.feishu_secret_key)
    if data.verification_token is not None and data.verification_token != "":
        config.verification_token = data.verification_token
    if data.encrypt_key is not None and data.encrypt_key != "":
        config.encrypt_key = data.encrypt_key
    if data.default_chat_id is not None:
        config.default_chat_id = data.default_chat_id
    if data.bot_enabled is not None:
        config.bot_enabled = data.bot_enabled

    await db.commit()
    await db.refresh(config)
    return {"message": "Config saved"}


@router.post("/test-connection")
async def test_feishu_connection(db: AsyncSession = Depends(get_db)):
    svc = await get_feishu_service(db)
    result = await svc.test_connection()
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.post("/send-message")
async def send_feishu_message(data: FeishuMessageRequest, db: AsyncSession = Depends(get_db)):
    svc = await get_feishu_service(db)
    chat_id = data.chat_id or svc.default_chat_id
    if data.use_webhook or not chat_id:
        result = await svc.send_webhook_message("来自 MutiExpert 的消息", data.text)
    else:
        result = await svc.send_text_message(chat_id, data.text)
    if not result["success"]:
        raise HTTPException(status_code=400, detail="Failed to send message")
    return result
