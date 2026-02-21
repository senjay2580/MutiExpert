"""飞书集成服务 - 消息发送、Webhook 处理、语音转文字"""
import base64
import hashlib
import json
import httpx
from datetime import datetime, timedelta
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import get_settings
from app.models.extras import FeishuConfig


class FeishuService:
    def __init__(
        self,
        app_id: str = "",
        app_secret: str = "",
        webhook_url: str = "",
        verification_token: str = "",
        encrypt_key: str = "",
        default_chat_id: str = "",
        default_provider: str = "claude",
    ):
        self.app_id = app_id
        self.app_secret = app_secret
        self.webhook_url = webhook_url
        self.verification_token = verification_token
        self.encrypt_key = encrypt_key
        self.default_chat_id = default_chat_id
        self.default_provider = default_provider
        self._tenant_token: str | None = None
        self._tenant_token_expire_at: datetime | None = None

    async def _get_tenant_token(self) -> str:
        """获取 tenant_access_token"""
        if self._tenant_token and self._tenant_token_expire_at:
            if datetime.utcnow() < self._tenant_token_expire_at - timedelta(seconds=60):
                return self._tenant_token

        if not self.app_id or not self.app_secret:
            return ""

        if self._tenant_token and not self._tenant_token_expire_at:
            return self._tenant_token
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
                json={"app_id": self.app_id, "app_secret": self.app_secret},
            )
            data = resp.json()
            self._tenant_token = data.get("tenant_access_token", "")
            expire = data.get("expire") or data.get("expires_in")
            if isinstance(expire, int):
                self._tenant_token_expire_at = datetime.utcnow() + timedelta(seconds=expire)
            return self._tenant_token

    async def send_webhook_message(self, title: str, content: str) -> dict:
        """通过 Webhook 发送富文本卡片消息"""
        if not self.webhook_url:
            return {"success": False, "error": "Webhook URL not configured"}

        card = {
            "msg_type": "interactive",
            "card": {
                "header": {"title": {"tag": "plain_text", "content": title}},
                "elements": [
                    {"tag": "markdown", "content": content},
                ],
            },
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(self.webhook_url, json=card)
            return {"success": resp.status_code == 200, "data": resp.json()}

    async def send_text_message(self, chat_id: str, text: str) -> dict:
        """通过 Open API 发送文本消息到指定会话"""
        token = await self._get_tenant_token()
        if not token:
            return {"success": False, "error": "Tenant token not available"}
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://open.feishu.cn/open-apis/im/v1/messages",
                headers={"Authorization": f"Bearer {token}"},
                params={"receive_id_type": "chat_id"},
                json={
                    "receive_id": chat_id,
                    "msg_type": "text",
                    "content": json.dumps({"text": text}),
                },
            )
            return {"success": resp.status_code == 200, "data": resp.json()}

    async def reply_message(self, message_id: str, text: str) -> dict:
        """回复飞书消息"""
        token = await self._get_tenant_token()
        if not token:
            return {"success": False, "error": "Tenant token not available"}
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://open.feishu.cn/open-apis/im/v1/messages/{message_id}/reply",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "msg_type": "text",
                    "content": json.dumps({"text": text}),
                },
            )
            return {"success": resp.status_code == 200, "data": resp.json()}

    async def send_interactive_card(self, chat_id: str, card: dict) -> dict:
        """发送消息卡片（用于确认操作等交互场景）"""
        token = await self._get_tenant_token()
        if not token:
            return {"success": False, "error": "Tenant token not available"}
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://open.feishu.cn/open-apis/im/v1/messages",
                headers={"Authorization": f"Bearer {token}"},
                params={"receive_id_type": "chat_id"},
                json={
                    "receive_id": chat_id,
                    "msg_type": "interactive",
                    "content": json.dumps(card),
                },
            )
            data = resp.json()
            message_id = data.get("data", {}).get("message_id", "")
            return {"success": resp.status_code == 200, "data": data, "message_id": message_id}

    async def update_card(self, message_id: str, card: dict) -> dict:
        """更新已发送的消息卡片内容"""
        token = await self._get_tenant_token()
        if not token:
            return {"success": False, "error": "Tenant token not available"}
        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"https://open.feishu.cn/open-apis/im/v1/messages/{message_id}",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "msg_type": "interactive",
                    "content": json.dumps(card),
                },
            )
            return {"success": resp.status_code == 200, "data": resp.json()}

    async def test_connection(self) -> dict:
        """测试飞书连接"""
        try:
            token = await self._get_tenant_token()
            if token:
                return {"success": True, "message": "连接成功"}
            return {"success": False, "message": "获取 token 失败"}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def parse_webhook_event(self, body: dict) -> dict:
        """解析飞书 Webhook 事件"""
        # URL 验证挑战
        if "challenge" in body:
            return {"type": "challenge", "challenge": body["challenge"]}

        header = body.get("header", {})
        event = body.get("event", {})
        event_type = header.get("event_type", "")
        token = body.get("token") or header.get("token")

        if event_type == "im.message.receive_v1":
            message = event.get("message", {})
            content = json.loads(message.get("content", "{}"))
            sender = event.get("sender", {})
            return {
                "type": "message",
                "token": token,
                "message_id": message.get("message_id"),
                "chat_id": message.get("chat_id"),
                "text": content.get("text", ""),
                "message_type": message.get("message_type"),
                "sender_type": sender.get("sender_type"),
                "sender_id": sender.get("sender_id", {}),
            }

        return {"type": "unknown", "event_type": event_type, "token": token}


def verify_feishu_signature(
    encrypt_key: str,
    timestamp: str | None,
    nonce: str | None,
    body: bytes,
    signature: str | None,
) -> bool:
    if not encrypt_key or not timestamp or not nonce or not signature:
        return False
    base = (timestamp + nonce + encrypt_key).encode("utf-8") + body
    digest = hashlib.sha256(base).hexdigest()
    return digest == signature


def decrypt_feishu_event(encrypt_key: str, encrypted: str) -> str:
    key = hashlib.sha256(encrypt_key.encode("utf-8")).digest()
    payload = base64.b64decode(encrypted)
    iv = payload[:16]
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    decryptor = cipher.decryptor()
    padded = decryptor.update(payload[16:]) + decryptor.finalize()
    unpadder = padding.PKCS7(128).unpadder()
    data = unpadder.update(padded) + unpadder.finalize()
    return data.decode("utf-8")


def encrypt_secret(value: str, key: str) -> str:
    if not key:
        return value
    token = Fernet(key).encrypt(value.encode("utf-8")).decode("utf-8")
    return f"enc:{token}"


def decrypt_secret(value: str, key: str) -> str:
    if not value or not key or not value.startswith("enc:"):
        return value
    token = value[4:]
    try:
        return Fernet(key).decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return value


async def get_feishu_service(db: AsyncSession | None = None) -> FeishuService:
    """优先使用数据库配置；没有则回退到环境变量配置。"""
    settings = get_settings()
    app_id = settings.feishu_app_id
    app_secret = settings.feishu_app_secret
    webhook_url = settings.feishu_webhook_url
    verification_token = settings.feishu_verification_token
    encrypt_key = settings.feishu_encrypt_key
    default_chat_id = settings.feishu_default_chat_id
    default_provider = "claude"

    if db is not None:
        result = await db.execute(select(FeishuConfig).limit(1))
        config = result.scalar_one_or_none()
        if config:
            app_id = config.app_id or app_id
            stored_secret = config.app_secret_encrypted or app_secret
            app_secret = decrypt_secret(stored_secret, settings.feishu_secret_key)
            webhook_url = config.webhook_url or webhook_url
            verification_token = config.verification_token or ""
            encrypt_key = config.encrypt_key or ""
            default_chat_id = config.default_chat_id or ""
            default_provider = getattr(config, "default_provider", None) or "claude"

    return FeishuService(
        app_id=app_id,
        app_secret=app_secret,
        webhook_url=webhook_url,
        verification_token=verification_token,
        encrypt_key=encrypt_key,
        default_chat_id=default_chat_id,
        default_provider=default_provider,
    )
