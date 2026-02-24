"""飞书集成服务 - 消息发送、Webhook 处理、语音转文字"""
import base64
import hashlib
import json
import re
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
        """通过 Open API 发送文本消息到指定会话（私聊/群聊均可）"""
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
            data = resp.json()
            code = data.get("code", -1)
            if resp.status_code != 200 or code != 0:
                msg = data.get("msg") or data.get("message") or "Unknown error"
                return {"success": False, "error": f"[{code}] {msg}", "data": data}
            return {"success": True, "data": data}

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


def adapt_markdown_for_feishu(text: str) -> str:
    """将标准 Markdown 文本转换为飞书卡片支持的 Markdown 子集。

    注意：表格不在此处处理，由 _build_content_elements 在 element 层面
    转为飞书原生 Table 组件。
    """
    lines = text.split("\n")
    result: list[str] = []
    in_code_block = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("```"):
            in_code_block = not in_code_block
            result.append(line)
            continue
        if in_code_block:
            result.append(line)
            continue
        heading_match = re.match(r'^(#{1,6})\s+(.+)$', line)
        if heading_match:
            result.append(f"**{heading_match.group(2).strip()}**")
            continue
        quote_match = re.match(r'^>\s*(.*)$', line)
        if quote_match:
            qt = quote_match.group(1).strip()
            result.append(f"*{qt}*" if qt else "")
            continue
        if re.match(r'^-{3,}$', stripped) or re.match(r'^\*{3,}$', stripped):
            result.append("")
            continue
        result.append(line)
    return "\n".join(result)


def _parse_markdown_table(lines: list[str]) -> dict | None:
    """将 Markdown 表格行解析为飞书原生 Table 组件 JSON。

    要求至少 3 行（表头 + 分隔线 + ≥1 数据行）。
    """
    if len(lines) < 3:
        return None
    sep_line = lines[1].strip()
    if not re.match(r'^\|[\s\-:|]+\|?\s*$', sep_line):
        return None
    headers = [h.strip() for h in lines[0].strip().strip("|").split("|")]
    rows: list[dict] = []
    for line in lines[2:]:
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        row = {f"col_{i}": (cells[i] if i < len(cells) else "") for i in range(len(headers))}
        rows.append(row)
    if not rows:
        return None
    columns = [
        {"name": f"col_{i}", "display_name": h, "data_type": "text", "width": "auto"}
        for i, h in enumerate(headers)
    ]
    return {
        "tag": "table",
        "page_size": len(rows),
        "row_height": "low",
        "header_style": {
            "text_align": "left",
            "text_size": "normal",
            "background_style": "grey",
            "bold": True,
            "lines": 1,
        },
        "columns": columns,
        "rows": rows,
    }


def _build_content_elements(text: str) -> list[dict]:
    """将 Markdown 文本拆分为飞书卡片元素列表。

    普通文本 → {"tag": "markdown", ...}（经 adapt_markdown_for_feishu 转换）
    表格     → {"tag": "table", ...}（飞书原生 Table 组件）
    """
    lines = text.split("\n")
    elements: list[dict] = []
    text_buf: list[str] = []
    table_buf: list[str] = []
    in_code_block = False

    def _flush_text():
        if not text_buf:
            return
        md = adapt_markdown_for_feishu("\n".join(text_buf)).strip()
        if md:
            elements.append({"tag": "markdown", "content": md})
        text_buf.clear()

    def _flush_table():
        if not table_buf:
            return
        table_elem = _parse_markdown_table(table_buf)
        if table_elem:
            _flush_text()
            elements.append(table_elem)
        else:
            # 无效表格，回退为普通文本
            text_buf.extend(table_buf)
        table_buf.clear()

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("```"):
            _flush_table()
            in_code_block = not in_code_block
            text_buf.append(line)
            continue
        if in_code_block:
            text_buf.append(line)
            continue
        if stripped.startswith("|") and stripped.count("|") >= 2:
            table_buf.append(line)
            continue
        _flush_table()
        text_buf.append(line)

    _flush_table()
    _flush_text()
    return elements


def build_stream_card(
    text: str,
    status: str = "processing",
    tool_name: str = "",
    tool_calls: list[dict] | None = None,
    sources: list[dict] | None = None,
) -> dict:
    """构建流式更新卡片 JSON（Card JSON 2.0，支持原生 Table 组件）"""
    templates = {"processing": "blue", "completed": "green", "error": "red"}
    titles = {"processing": "AI 助手", "completed": "AI 助手", "error": "AI 助手 · 出错"}
    header_title = titles.get(status, "AI 助手")
    if status == "processing" and tool_name:
        header_title = f"AI 助手 · 调用 {tool_name}..."

    content = text or "思考中..."
    if status == "processing":
        content += " ▌"
    if len(content) > 28000:
        content = content[:28000] + "\n\n...(内容过长已截断)"

    # 拆分为 markdown + table 元素
    elements = _build_content_elements(content)
    if not elements:
        elements = [{"tag": "markdown", "content": adapt_markdown_for_feishu(content)}]

    if status == "completed" and tool_calls:
        tool_lines = []
        for tc in tool_calls:
            icon = "✅" if tc.get("success") else "❌"
            name = tc.get("name", "unknown")
            result_preview = tc.get("result", "")[:100]
            tool_lines.append(f"{icon} **{name}**：{result_preview}")
        if tool_lines:
            elements.append({"tag": "hr"})
            elements.append({"tag": "markdown", "content": "**工具调用**\n" + "\n".join(tool_lines)})
    if status == "completed" and sources:
        src_lines = [f"· {s.get('document_title', s.get('title', ''))}" for s in sources[:5]]
        if src_lines:
            elements.append({"tag": "hr"})
            elements.append({"tag": "markdown", "content": "**参考来源**\n" + "\n".join(src_lines)})

    return {
        "schema": "2.0",
        "config": {"wide_screen_mode": True, "update_multi": True},
        "header": {
            "title": {"tag": "plain_text", "content": header_title},
            "template": templates.get(status, "blue"),
        },
        "body": {
            "elements": elements,
        },
    }
