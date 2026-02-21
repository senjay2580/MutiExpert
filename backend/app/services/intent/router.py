"""IntentRouter — 调用 AI 模型进行意图识别（function calling）"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.ai_service import generate as ai_generate
from app.services.intent.tools import load_tools, to_openai_tools
from app.services.system_prompt_service import build_system_prompt


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
    """用当前模型识别用户意图，返回 tool_call 或纯文本。

    统一走 ai_service.generate()，不再直接调 SDK。
    """
    tools = await load_tools(db)
    if not tools:
        return IntentResult(text_response="暂未配置任何能力，请先添加 Bot Tools。")

    tool_index = {t["name"]: t for t in tools}
    openai_tools = to_openai_tools(tools)

    messages = list(history or [])
    messages.append({"role": "user", "content": message})

    # 使用统一系统提示词（紧凑模式，节省 token）
    system_prompt = await build_system_prompt(
        db,
        compact=True,
        include_scripts=False,
        include_tasks=False,
    )
    system_prompt += "\n如果需要调用工具就调用最合适的工具；如果不需要，直接用文字回答。"

    result = await ai_generate(
        messages, provider, system_prompt,
        tools=openai_tools, db=db,
    )

    if result.tool_calls:
        tc = result.tool_calls[0]
        tool_def = tool_index.get(tc.name)
        if tool_def:
            return IntentResult(
                has_tool_call=True,
                tool_name=tc.name,
                tool_args=tc.arguments,
                action_type=tool_def["action_type"],
                endpoint=tool_def["endpoint"],
                method=tool_def["method"],
                param_mapping=tool_def.get("param_mapping"),
            )

    return IntentResult(
        text_response=result.text or "我不太理解你的意思，可以换个说法试试。"
    )
