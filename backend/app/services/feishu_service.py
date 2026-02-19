"""飞书集成服务 - 消息发送、Webhook 处理、语音转文字"""
import json
import httpx
from app.config import get_settings


class FeishuService:
    def __init__(self):
        settings = get_settings()
        self.app_id = settings.feishu_app_id
        self.app_secret = settings.feishu_app_secret
        self.webhook_url = settings.feishu_webhook_url
        self._tenant_token: str | None = None

    async def _get_tenant_token(self) -> str:
        """获取 tenant_access_token"""
        if self._tenant_token:
            return self._tenant_token
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
                json={"app_id": self.app_id, "app_secret": self.app_secret},
            )
            data = resp.json()
            self._tenant_token = data.get("tenant_access_token", "")
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

        if event_type == "im.message.receive_v1":
            message = event.get("message", {})
            content = json.loads(message.get("content", "{}"))
            return {
                "type": "message",
                "message_id": message.get("message_id"),
                "chat_id": message.get("chat_id"),
                "text": content.get("text", ""),
                "message_type": message.get("message_type"),
            }

        return {"type": "unknown", "event_type": event_type}


_feishu_service: FeishuService | None = None


def get_feishu_service() -> FeishuService:
    global _feishu_service
    if _feishu_service is None:
        _feishu_service = FeishuService()
    return _feishu_service
