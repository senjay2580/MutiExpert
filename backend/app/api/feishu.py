import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import get_settings
from app.database import get_db, AsyncSessionLocal
from app.models.extras import Conversation, Message, FeishuConfig, FeishuPendingAction
from app.services.feishu_service import (
    get_feishu_service,
    verify_feishu_signature,
    decrypt_feishu_event,
    encrypt_secret,
)
from app.services.pipeline_service import PipelineRequest, run as pipeline_run

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
    """后台任务：通过统一管道处理飞书消息，维护对话历史"""
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

            provider = svc.default_provider or "claude"

            # 1. 查找或创建飞书会话
            conv = await _get_or_create_feishu_conversation(db, chat_id)

            # 2. 保存用户消息
            user_msg = Message(conversation_id=conv.id, role="user", content=question)
            db.add(user_msg)
            conv.updated_at = datetime.utcnow()
            if not conv.title:
                conv.title = question[:50] + ("..." if len(question) > 50 else "")
            await db.commit()

            # 3. 加载历史消息
            history = await _load_feishu_history(db, conv.id)

            # 4. 收集知识库 ID
            from app.models.knowledge import KnowledgeBase
            kb_result = await db.execute(select(KnowledgeBase.id))
            kb_ids = [row[0] for row in kb_result.all()]

            # 5. 通过统一管道处理
            request = PipelineRequest(
                message=question,
                conversation_id=conv.id,
                channel="feishu",
                provider=provider,
                modes=set(conv.default_modes or ["knowledge", "tools"]),
                knowledge_base_ids=kb_ids,
                history=history,
            )
            result = await pipeline_run(request, db)
            response_text = result.get("text", "") or "抱歉，暂时无法回答这个问题。"

            # 6. 保存 AI 回复
            file_attachments = result.get("file_attachments", [])
            assistant_msg = Message(
                conversation_id=conv.id,
                role="assistant",
                content=response_text,
                sources=result.get("sources", []),
                tool_calls=result.get("tool_calls", []),
                attachments=file_attachments or None,
                model_used=provider,
            )
            db.add(assistant_msg)
            conv.updated_at = datetime.utcnow()
            await db.commit()

            # 7. 回复飞书
            # 截断过长回复（飞书文本消息限制约 4000 字符）
            reply_text = response_text[:3800]
            if len(response_text) > 3800:
                reply_text += "\n\n...(回复过长已截断)"
            await svc.reply_message(message_id, reply_text)

            # 8. 如有文件附件，发送下载卡片
            if file_attachments and chat_id:
                settings = get_settings()
                base = settings.backend_url.rstrip("/")
                for fa in file_attachments:
                    size_kb = fa.get("size", 0) / 1024
                    download_url = f"{base}{fa.get('url', '')}"
                    card = {
                        "header": {
                            "title": {"tag": "plain_text", "content": "文件下载"},
                            "template": "blue",
                        },
                        "elements": [
                            {"tag": "markdown", "content": (
                                f"**{fa.get('filename', '文件')}**\n"
                                f"大小: {size_kb:.1f} KB\n"
                                f"类型: {fa.get('mime_type', '未知')}"
                            )},
                            {
                                "tag": "action",
                                "actions": [{
                                    "tag": "button",
                                    "text": {"tag": "plain_text", "content": "下载文件"},
                                    "type": "primary",
                                    "url": download_url,
                                }],
                            },
                        ],
                    }
                    await svc.send_interactive_card(chat_id, card)

    except Exception as e:
        if svc is not None:
            await svc.reply_message(message_id, f"处理出错: {str(e)}")


async def _get_or_create_feishu_conversation(db: AsyncSession, chat_id: str) -> Conversation:
    """根据 feishu_chat_id 查找会话，不存在则创建"""
    result = await db.execute(
        select(Conversation).where(
            Conversation.channel == "feishu",
            Conversation.feishu_chat_id == chat_id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        conv = Conversation(
            channel="feishu",
            feishu_chat_id=chat_id,
            title="飞书对话",
            default_modes=["knowledge", "tools"],
        )
        db.add(conv)
        await db.commit()
        await db.refresh(conv)
    return conv


async def _load_feishu_history(db: AsyncSession, conv_id, limit: int = 10) -> list[dict]:
    """加载飞书会话的最近历史消息"""
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    msgs = list(reversed(result.scalars().all()))
    # 排除最后一条（刚保存的 user_msg）
    if msgs and msgs[-1].role == "user":
        msgs = msgs[:-1]
    return [{"role": m.role, "content": m.content} for m in msgs]


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
