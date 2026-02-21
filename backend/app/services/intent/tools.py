"""统一 Tool Schema — 从 DB 加载 bot_tools，转换为各模型的 function calling 格式"""
from __future__ import annotations

from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.extras import BotTool


async def load_tools(db: AsyncSession) -> list[dict[str, Any]]:
    """从数据库加载所有启用的 bot_tools"""
    result = await db.execute(
        select(BotTool).where(BotTool.enabled.is_(True)).order_by(BotTool.name)
    )
    tools = []
    for t in result.scalars().all():
        tools.append({
            "name": t.name,
            "description": t.description,
            "action_type": t.action_type,
            "endpoint": t.endpoint,
            "method": t.method,
            "param_mapping": t.param_mapping or {},
            "parameters": t.parameters or {},
        })
    return tools


def to_openai_tools(tools: list[dict]) -> list[dict]:
    """转换为 OpenAI / DeepSeek / Qwen 的 tools 格式"""
    result = []
    for t in tools:
        result.append({
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t.get("parameters") or {"type": "object", "properties": {}},
            },
        })
    return result


def to_claude_tools(tools: list[dict]) -> list[dict]:
    """转换为 Claude tool_use 格式"""
    result = []
    for t in tools:
        params = t.get("parameters") or {"type": "object", "properties": {}}
        result.append({
            "name": t["name"],
            "description": t["description"],
            "input_schema": params,
        })
    return result
