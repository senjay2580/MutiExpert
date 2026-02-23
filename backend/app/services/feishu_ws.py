"""飞书 WebSocket 长连接 — 接收消息事件并转发到处理逻辑"""
import asyncio
import json
import logging
from typing import Callable, Awaitable

import lark_oapi as lark
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.extras import FeishuConfig
from app.services.feishu_service import decrypt_secret
from app.config import get_settings

logger = logging.getLogger(__name__)

_ws_client: lark.ws.Client | None = None


def _parse_message_event(data: lark.im.v1.P2ImMessageReceiveV1) -> dict | None:
    """从 SDK 事件对象中提取消息信息，返回与 webhook parse 一致的 dict"""
    event = data.event
    if not event or not event.message:
        return None
    msg = event.message
    sender = event.sender
    try:
        content = json.loads(msg.content or "{}")
    except (json.JSONDecodeError, TypeError):
        content = {}

    # 去掉 @机器人 的 mention
    text = content.get("text", "")
    if msg.mentions:
        for m in msg.mentions:
            if m.key:
                text = text.replace(m.key, "").strip()

    return {
        "type": "message",
        "message_id": msg.message_id,
        "chat_id": msg.chat_id,
        "text": text,
        "message_type": msg.message_type,
        "sender_type": sender.sender_type if sender else None,
        "sender_id": {"open_id": sender.sender_id.open_id} if sender and sender.sender_id else {},
    }


async def start_feishu_ws(handle_question: Callable[[dict], Awaitable[None]]):
    """启动飞书 WebSocket 长连接，需要数据库中已配置 app_id + app_secret"""
    global _ws_client

    settings = get_settings()
    app_id = settings.feishu_app_id
    app_secret = settings.feishu_app_secret

    # 优先从数据库读取配置
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(FeishuConfig).limit(1))
            config = result.scalar_one_or_none()
            if config:
                app_id = config.app_id or app_id
                stored = config.app_secret_encrypted or app_secret
                app_secret = decrypt_secret(stored, settings.feishu_secret_key)
    except Exception as e:
        logger.warning("读取飞书配置失败，使用环境变量: %s", e)

    if not app_id or not app_secret:
        logger.info("飞书 App ID/Secret 未配置，跳过长连接启动")
        return

    # 同步回调 → 在事件循环中调度异步处理
    _loop = asyncio.get_event_loop()

    def on_message(data: lark.im.v1.P2ImMessageReceiveV1):
        parsed = _parse_message_event(data)
        if parsed and parsed.get("text") and parsed.get("message_type") == "text":
            _loop.call_soon_threadsafe(asyncio.ensure_future, handle_question(parsed))

    handler = lark.EventDispatcherHandler.builder("", "").register_p2_im_message_receive_v1(on_message).build()

    _ws_client = lark.ws.Client(
        app_id=app_id,
        app_secret=app_secret,
        event_handler=handler,
        log_level=lark.LogLevel.INFO,
    )

    logger.info("启动飞书 WebSocket 长连接 (app_id=%s)", app_id)
    # ws_client.start() 是阻塞的，放到线程里
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _ws_client.start)


def stop_feishu_ws():
    """停止长连接"""
    global _ws_client
    if _ws_client:
        logger.info("停止飞书 WebSocket 长连接")
        _ws_client = None
