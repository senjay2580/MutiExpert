"""IntentRouter — 调用 AI 模型进行意图识别（function calling）"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.ai_model_config import get_provider_config, ProviderConfig
from app.services.intent.tools import load_tools, to_openai_tools, to_claude_tools


@dataclass
class IntentResult:
    """意图识别结果"""
    has_tool_call: bool = False
    tool_name: str = ""
    tool_args: dict[str, Any] | None = None
    action_type: str = "query"
    endpoint: str = ""
    method: str = "GET"
    param_mapping: dict[str, Any] | None = None
    text_response: str = ""  # 如果没有 tool_call，AI 的文本回复


async def recognize_intent(
    message: str,
    provider: str,
    db: AsyncSession,
    history: list[dict] | None = None,
) -> IntentResult:
    """用当前模型识别用户意图，返回 tool_call 或纯文本"""
    tools = await load_tools(db)
    if not tools:
        return IntentResult(text_response="暂未配置任何能力，请先添加 Bot Tools。")

    # 构建 tool 索引
    tool_index = {t["name"]: t for t in tools}

    messages = list(history or [])
    messages.append({"role": "user", "content": message})

    system_prompt = (
        "你是 MutiExpert 智能助手。根据用户消息判断是否需要调用工具。"
        "如果需要，调用最合适的工具；如果不需要，直接用文字回答。"
        "回复请用中文。"
    )

    config = await get_provider_config(db, provider)

    if provider == "claude":
        return await _call_claude(config, messages, system_prompt, tools, tool_index)
    else:
        return await _call_openai_compat(config, messages, system_prompt, tools, tool_index)

async def _call_claude(
    config: ProviderConfig,
    messages: list[dict],
    system_prompt: str,
    tools: list[dict],
    tool_index: dict[str, dict],
) -> IntentResult:
    """Claude tool_use 调用（非流式）"""
    if not config.api_key:
        return IntentResult(text_response="Error: Anthropic API key not configured")

    import anthropic
    client = anthropic.AsyncAnthropic(api_key=config.api_key)
    claude_tools = to_claude_tools(tools)

    resp = await client.messages.create(
        model=config.model or "claude-sonnet-4-20250514",
        max_tokens=1024,
        system=system_prompt,
        messages=messages,
        tools=claude_tools,
    )

    # 解析响应：可能有 text block 和 tool_use block
    text_parts = []
    for block in resp.content:
        if block.type == "text":
            text_parts.append(block.text)
        elif block.type == "tool_use":
            tool_def = tool_index.get(block.name)
            if tool_def:
                return IntentResult(
                    has_tool_call=True,
                    tool_name=block.name,
                    tool_args=block.input,
                    action_type=tool_def["action_type"],
                    endpoint=tool_def["endpoint"],
                    method=tool_def["method"],
                    param_mapping=tool_def.get("param_mapping"),
                )

    return IntentResult(text_response="\n".join(text_parts) or "我不太理解你的意思，可以换个说法试试。")


async def _call_openai_compat(
    config: ProviderConfig,
    messages: list[dict],
    system_prompt: str,
    tools: list[dict],
    tool_index: dict[str, dict],
) -> IntentResult:
    """OpenAI 兼容接口（DeepSeek / Qwen / OpenAI）的 function calling"""
    if not config.api_key:
        return IntentResult(text_response=f"Error: {config.provider_id} API key not configured")

    base_url = (config.base_url or "").rstrip("/")
    if not base_url:
        return IntentResult(text_response=f"Error: {config.provider_id} base_url not configured")

    url = f"{base_url}/chat/completions"
    openai_tools = to_openai_tools(tools)

    api_messages = [{"role": "system", "content": system_prompt}] + messages
    payload = {
        "model": config.model,
        "messages": api_messages,
        "tools": openai_tools,
        "stream": False,
    }
    headers = {
        "content-type": "application/json",
        "authorization": f"Bearer {config.api_key}",
    }

    timeout = httpx.Timeout(30.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code >= 400:
            return IntentResult(text_response=f"Error: AI request failed ({resp.status_code})")

        data = resp.json()
        choice = data.get("choices", [{}])[0]
        msg = choice.get("message", {})

        # 检查 tool_calls
        tool_calls = msg.get("tool_calls")
        if tool_calls:
            tc = tool_calls[0]
            fn = tc.get("function", {})
            name = fn.get("name", "")
            try:
                args = json.loads(fn.get("arguments", "{}"))
            except json.JSONDecodeError:
                args = {}

            tool_def = tool_index.get(name)
            if tool_def:
                return IntentResult(
                    has_tool_call=True,
                    tool_name=name,
                    tool_args=args,
                    action_type=tool_def["action_type"],
                    endpoint=tool_def["endpoint"],
                    method=tool_def["method"],
                    param_mapping=tool_def.get("param_mapping"),
                )

        # 没有 tool_call，返回文本
        content = msg.get("content", "")
        return IntentResult(text_response=content or "我不太理解你的意思，可以换个说法试试。")
