"""飞书 WebSocket 长连接 — 接收消息事件并转发到处理逻辑"""
import asyncio
import collections
import json
import logging
import os
import sys
import threading
import time
from typing import Callable, Awaitable

import lark_oapi as lark
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.extras import FeishuConfig
from app.services.feishu_service import decrypt_secret
from app.config import get_settings

logger = logging.getLogger(__name__)

_ws_client: lark.ws.Client | None = None
_ws_thread: threading.Thread | None = None
_lock_file = None  # 文件锁句柄，防止多 worker 重复连接


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


def _run_ws_in_thread(client: lark.ws.Client):
    """在独立线程中运行 WebSocket 客户端（需要自己的事件循环）"""
    import lark_oapi.ws.client as ws_module
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    # SDK 在模块级缓存了 loop = asyncio.get_event_loop()，
    # 指向 uvicorn 主循环，必须替换为当前线程的新循环
    ws_module.loop = loop
    try:
        client.start()
    except Exception as e:
        logger.error("飞书 WebSocket 线程异常退出: %s", e)
    finally:
        loop.close()


async def start_feishu_ws(handle_question: Callable[[dict], Awaitable[None]]):
    """启动飞书 WebSocket 长连接，需要数据库中已配置 app_id + app_secret"""
    global _ws_client, _ws_thread, _lock_file

    # 多 worker 环境下，用文件锁确保只有一个 worker 启动 WS
    lock_path = "/tmp/feishu_ws.lock" if sys.platform != "win32" else os.path.join(os.environ.get("TEMP", "."), "feishu_ws.lock")
    try:
        _lock_file = open(lock_path, "w")
        if sys.platform == "win32":
            import msvcrt
            msvcrt.locking(_lock_file.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(_lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        _lock_file.write(str(os.getpid()))
        _lock_file.flush()
    except (OSError, IOError):
        logger.info("另一个 worker 已持有飞书 WS 锁，跳过 (pid=%d)", os.getpid())
        if _lock_file:
            _lock_file.close()
            _lock_file = None
        return

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

    # 捕获主线程的事件循环，用于从 ws 线程回调中调度异步任务
    main_loop = asyncio.get_running_loop()

    # 消息去重：飞书 WS 重连/重投可能重复推送同一条消息
    _seen_msg_ids: collections.OrderedDict[str, float] = collections.OrderedDict()
    _seen_lock = threading.Lock()
    DEDUP_MAX = 500

    def on_message(data: lark.im.v1.P2ImMessageReceiveV1):
        print(f"[FEISHU-WS] 收到事件: {type(data).__name__}", flush=True)
        parsed = _parse_message_event(data)
        print(f"[FEISHU-WS] 解析: text={parsed.get('text') if parsed else None}, type={parsed.get('message_type') if parsed else None}", flush=True)
        if parsed and parsed.get("text") and parsed.get("message_type") == "text":
            msg_id = parsed.get("message_id", "")
            # 去重检查
            with _seen_lock:
                now = time.time()
                if msg_id in _seen_msg_ids:
                    print(f"[FEISHU-WS] 跳过重复消息: message_id={msg_id}", flush=True)
                    return
                _seen_msg_ids[msg_id] = now
                # 清理过期条目
                while len(_seen_msg_ids) > DEDUP_MAX:
                    _seen_msg_ids.popitem(last=False)
            print(f"[FEISHU-WS] 调度处理: chat_id={parsed.get('chat_id')}", flush=True)
            main_loop.call_soon_threadsafe(asyncio.ensure_future, handle_question(parsed))

    handler = lark.EventDispatcherHandler.builder("", "").register_p2_im_message_receive_v1(on_message).build()

    _ws_client = lark.ws.Client(
        app_id=app_id,
        app_secret=app_secret,
        event_handler=handler,
        log_level=lark.LogLevel.INFO,
    )

    print(f"[FEISHU-WS] 启动飞书 WebSocket 长连接 (app_id={app_id})", flush=True)
    _ws_thread = threading.Thread(target=_run_ws_in_thread, args=(_ws_client,), daemon=True)
    _ws_thread.start()


def stop_feishu_ws():
    """停止长连接"""
    global _ws_client, _ws_thread, _lock_file
    if _ws_client:
        logger.info("停止飞书 WebSocket 长连接")
        _ws_client = None
        _ws_thread = None
    if _lock_file:
        try:
            if sys.platform == "win32":
                import msvcrt
                msvcrt.locking(_lock_file.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl
                fcntl.flock(_lock_file, fcntl.LOCK_UN)
            _lock_file.close()
        except Exception:
            pass
        _lock_file = None
