import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import get_settings
from app.database import get_db, AsyncSessionLocal
from app.models.extras import FeishuConfig, FeishuPendingAction
from app.services.feishu_service import (
    get_feishu_service,
    verify_feishu_signature,
    decrypt_feishu_event,
    encrypt_secret,
)
from app.services.intent.router import recognize_intent
from app.services.intent.executor import execute_action, format_result
from app.services.rag_service import retrieve_context, build_rag_context
from app.services.ai_service import stream_chat
from app.services.system_prompt_service import build_system_prompt

router = APIRouter()


class FeishuConfigUpdate(BaseModel):
    app_id: str | None = None
    app_secret: str | None = None
    webhook_url: str | None = None
    verification_token: str | None = None
    encrypt_key: str | None = None
    default_chat_id: str | None = None
    bot_enabled: bool | None = None
    default_provider: str | None = None


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
    """后台任务：意图识别 → 自动路由 → 回复飞书"""
    question = parsed["text"]
    message_id = parsed.get("message_id")
    chat_id = parsed.get("chat_id")
    if not message_id:
        return
    if parsed.get("sender_type") in {"app", "bot"}:
        return

    try:
        svc = None
        async with AsyncSessionLocal() as db:
            svc = await get_feishu_service(db)

            # 特殊指令：绑定
            if question.strip().lower() in {"绑定", "bind", "绑定机器人"}:
                result = await db.execute(select(FeishuConfig).limit(1))
                config = result.scalar_one_or_none()
                if config:
                    config.default_chat_id = chat_id
                    await db.commit()
                await svc.reply_message(message_id, "已绑定当前会话为默认推送目标。")
                return

            # 意图识别
            provider = svc.default_provider or "claude"
            intent = await recognize_intent(question, provider, db)

            if not intent.has_tool_call:
                # 没有 tool_call → 走 RAG 问答兜底
                if intent.text_response and not intent.text_response.startswith("暂未配置"):
                    await svc.reply_message(message_id, intent.text_response)
                else:
                    response = await _fallback_rag(question, provider, db)
                    await svc.reply_message(message_id, response)
                return

            # 有 tool_call
            if intent.action_type == "mutation":
                # 修改操作 → 发确认卡片
                await _send_confirm_card(svc, chat_id, intent, db)
            else:
                # 查询操作 → 直接执行
                result = await execute_action(intent)
                text = format_result(result)
                await svc.reply_message(message_id, text)

    except Exception as e:
        if svc is not None:
            await svc.reply_message(message_id, f"处理出错: {str(e)}")


async def _fallback_rag(question: str, provider: str, db) -> str:
    """RAG 问答兜底"""
    from app.models.knowledge import KnowledgeBase
    result = await db.execute(select(KnowledgeBase.id))
    kb_ids = [row[0] for row in result.all()]
    context, sources = await retrieve_context(db, question, kb_ids) if kb_ids else ("", [])
    system_prompt = await build_system_prompt(db, provider=provider, compact=True)
    if context:
        system_prompt += "\n\n" + build_rag_context(context, question)
    messages = [{"role": "user", "content": question}]
    full_response = ""
    async for chunk in stream_chat(messages, provider, system_prompt, db=db):
        full_response += chunk
    return full_response or "抱歉，暂时无法回答这个问题。"


async def _send_confirm_card(svc, chat_id: str, intent, db):
    """发送确认卡片，存储待确认操作"""
    action = FeishuPendingAction(
        chat_id=chat_id,
        action_type=intent.tool_name,
        action_payload={
            "tool_name": intent.tool_name,
            "tool_args": intent.tool_args,
            "endpoint": intent.endpoint,
            "method": intent.method,
            "param_mapping": intent.param_mapping,
        },
        expires_at=datetime.utcnow() + timedelta(minutes=5),
    )
    db.add(action)
    await db.commit()
    await db.refresh(action)

    args_text = "\n".join(f"  {k}: {v}" for k, v in (intent.tool_args or {}).items())
    card = {
        "header": {
            "title": {"tag": "plain_text", "content": f"确认操作: {intent.tool_name}"},
            "template": "orange",
        },
        "elements": [
            {"tag": "markdown", "content": f"**操作参数:**\n{args_text or '(无参数)'}"},
            {
                "tag": "action",
                "actions": [
                    {
                        "tag": "button",
                        "text": {"tag": "plain_text", "content": "确认执行"},
                        "type": "primary",
                        "value": {"action_id": str(action.id), "confirm": True},
                    },
                    {
                        "tag": "button",
                        "text": {"tag": "plain_text", "content": "取消"},
                        "value": {"action_id": str(action.id), "confirm": False},
                    },
                ],
            },
        ],
    }
    resp = await svc.send_interactive_card(chat_id, card)
    if resp.get("message_id"):
        action.message_id = resp["message_id"]
        await db.commit()


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
        "default_provider": config.default_provider or "claude",
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
    if data.default_provider is not None:
        config.default_provider = data.default_provider

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


@router.post("/card-action")
async def feishu_card_action(request: Request):
    """飞书消息卡片按钮回调"""
    body = await request.json()
    action = body.get("action", {})
    value = action.get("value", {})
    action_id = value.get("action_id")
    confirm = value.get("confirm", False)

    if not action_id:
        return {"code": 0}

    async with AsyncSessionLocal() as db:
        from sqlalchemy import select as sa_select
        result = await db.execute(
            sa_select(FeishuPendingAction).where(FeishuPendingAction.id == action_id)
        )
        pending = result.scalar_one_or_none()
        if not pending or pending.status != "pending":
            return {"code": 0}

        svc = await get_feishu_service(db)

        if not confirm:
            pending.status = "cancelled"
            await db.commit()
            if pending.message_id:
                await svc.update_card(pending.message_id, {
                    "header": {"title": {"tag": "plain_text", "content": "操作已取消"}, "template": "grey"},
                    "elements": [{"tag": "markdown", "content": "用户取消了此操作。"}],
                })
            return {"code": 0}

        # 检查过期
        from datetime import datetime as dt
        if dt.utcnow() > pending.expires_at:
            pending.status = "expired"
            await db.commit()
            if pending.message_id:
                await svc.update_card(pending.message_id, {
                    "header": {"title": {"tag": "plain_text", "content": "操作已过期"}, "template": "grey"},
                    "elements": [{"tag": "markdown", "content": "确认超时（5分钟），请重新发起。"}],
                })
            return {"code": 0}

        # 执行操作
        from app.services.intent.router import IntentResult
        from app.services.intent.executor import execute_action, format_result
        payload = pending.action_payload or {}
        intent = IntentResult(
            has_tool_call=True,
            tool_name=payload.get("tool_name", ""),
            tool_args=payload.get("tool_args"),
            action_type="mutation",
            endpoint=payload.get("endpoint", ""),
            method=payload.get("method", "POST"),
            param_mapping=payload.get("param_mapping"),
        )
        exec_result = await execute_action(intent)
        text = format_result(exec_result)

        pending.status = "confirmed"
        await db.commit()

        if pending.message_id:
            template = "green" if exec_result.get("success") else "red"
            await svc.update_card(pending.message_id, {
                "header": {"title": {"tag": "plain_text", "content": "操作已执行"}, "template": template},
                "elements": [{"tag": "markdown", "content": text}],
            })

    return {"code": 0}
