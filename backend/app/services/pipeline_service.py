"""统一 AI 能力管道 — 编排 Skills / BotTools / RAG / 网络搜索"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.ai_service import (
    generate as ai_generate,
    stream_chat,
    GenerateResult,
    ToolCallResult,
)
from app.services.intent.tools import load_tools, to_openai_tools
from app.services.intent.router import IntentResult
from app.services.rag_service import retrieve_context, build_rag_context
from app.services.system_prompt_service import build_system_prompt

logger = logging.getLogger(__name__)

# ── 数据结构 ──────────────────────────────────────────────────

@dataclass
class PipelineRequest:
    message: str
    conversation_id: UUID | None = None
    channel: str = "web"
    provider: str = "claude"
    modes: set[str] = field(default_factory=lambda: {"knowledge"})
    knowledge_base_ids: list[UUID] = field(default_factory=list)
    history: list[dict] | None = None
    max_tool_rounds: int = 5
    memory_summary: str | None = None


@dataclass
class PipelineEvent:
    """流式事件，前端通过 SSE 接收"""
    type: str  # text_chunk | tool_start | tool_result | sources | done | error
    data: dict[str, Any] = field(default_factory=dict)



# ── 工具收集 ──────────────────────────────────────────────────

async def _collect_tools(db: AsyncSession) -> tuple[list[dict], dict[str, dict]]:
    """收集所有可用工具定义，返回 (openai_tools, tool_index)。

    tool_index: name → {action_type, endpoint, method, param_mapping, source, skill_id?}
    """
    # 1. BotTools
    raw_tools = await load_tools(db)
    openai_tools = to_openai_tools(raw_tools)
    tool_index: dict[str, dict] = {}
    for t in raw_tools:
        tool_index[t["name"]] = {
            "action_type": t["action_type"],
            "endpoint": t["endpoint"],
            "method": t["method"],
            "param_mapping": t.get("param_mapping", {}),
            "source": "bot_tool",
        }

    # 2. Skills（enabled + 有 description）
    from app.models.extras import Skill
    result = await db.execute(
        select(Skill).where(Skill.enabled.is_(True), Skill.description.isnot(None))
    )
    for skill in result.scalars().all():
        tool_name = f"skill_{skill.name.replace(' ', '_').lower()}"
        openai_tools.append({
            "type": "function",
            "function": {
                "name": tool_name,
                "description": skill.description,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "用户的具体问题或需求"},
                    },
                    "required": ["query"],
                },
            },
        })
        tool_index[tool_name] = {
            "source": "skill",
            "skill_id": str(skill.id),
        }

    return openai_tools, tool_index


async def _execute_tool_call(
    tc: ToolCallResult, tool_index: dict[str, dict], db: AsyncSession,
) -> tuple[str, bool]:
    """执行单个工具调用，返回 (result_text, success)"""
    tool_def = tool_index.get(tc.name)
    if not tool_def:
        return f"未知工具: {tc.name}", False

    if tool_def["source"] == "bot_tool":
        intent = IntentResult(
            has_tool_call=True,
            tool_name=tc.name,
            tool_args=tc.arguments,
            action_type=tool_def["action_type"],
            endpoint=tool_def["endpoint"],
            method=tool_def["method"],
            param_mapping=tool_def.get("param_mapping"),
        )
        from app.services.intent.executor import execute_action, format_result
        result = await execute_action(intent)
        return format_result(result), result.get("success", False)

    if tool_def["source"] == "skill":
        return await _execute_skill(tool_def, tc.arguments, db)

    return f"不支持的工具来源: {tool_def['source']}", False


async def _execute_skill(
    tool_def: dict, arguments: dict, db: AsyncSession,
) -> tuple[str, bool]:
    """执行 Skill 工具调用"""
    from app.models.extras import Skill, SkillReference, SkillScript, UserScript
    from app.services.script_executor import execute_script

    skill_id = tool_def["skill_id"]
    query = arguments.get("query", "")

    # 加载 skill
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        return "技能未找到", False

    # 加载引用资料
    refs_result = await db.execute(
        select(SkillReference).where(SkillReference.skill_id == skill_id).order_by(SkillReference.sort_order)
    )
    refs = refs_result.scalars().all()
    ref_context = ""
    for ref in refs:
        if ref.content:
            ref_context += f"\n\n### 引用: {ref.name}\n{ref.content}"

    # 加载关联脚本并执行（如果有）
    links_result = await db.execute(
        select(SkillScript).where(SkillScript.skill_id == skill_id).order_by(SkillScript.sort_order)
    )
    script_outputs: list[str] = []
    for link in links_result.scalars().all():
        if not link.script_id:
            continue
        script_result = await db.execute(select(UserScript).where(UserScript.id == link.script_id))
        user_script = script_result.scalar_one_or_none()
        if user_script and user_script.script_content:
            exec_result = await execute_script(
                user_script.script_content,
                timeout_seconds=30,
                script_type=user_script.script_type or "typescript",
            )
            if exec_result.success:
                script_outputs.append(exec_result.output)
            else:
                script_outputs.append(f"脚本执行失败: {exec_result.error}")

    # 构建 prompt：content + 引用 + 脚本输出（如有）
    parts = []
    if skill.content:
        parts.append(f"技能内容:\n{skill.content}")
    if ref_context:
        parts.append(ref_context)
    if script_outputs:
        parts.append(f"脚本执行结果:\n{chr(10).join(script_outputs)}")
    parts.append(f"用户问题: {query}")

    prompt = "\n\n".join(parts)
    full_response = ""
    async for chunk in stream_chat(
        [{"role": "user", "content": prompt}],
        provider="claude", db=db,
    ):
        full_response += chunk
    return full_response or "无法生成回答", bool(full_response)


# ── 消息格式转换 ─────────────────────────────────────────────

def _build_tool_call_messages_claude(
    tc: ToolCallResult, assistant_text: str, tool_result_text: str,
) -> list[dict]:
    """构建 Claude 格式的 tool_use → tool_result 消息对"""
    assistant_content: list[dict[str, Any]] = []
    if assistant_text:
        assistant_content.append({"type": "text", "text": assistant_text})
    assistant_content.append({
        "type": "tool_use", "id": tc.id, "name": tc.name, "input": tc.arguments,
    })
    return [
        {"role": "assistant", "content": assistant_content},
        {"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": tc.id, "content": tool_result_text},
        ]},
    ]


def _build_tool_call_messages_openai(
    tc: ToolCallResult, assistant_text: str, tool_result_text: str,
) -> list[dict]:
    """构建 OpenAI chat/completions 格式的 tool_calls → tool 消息对"""
    return [
        {
            "role": "assistant",
            "content": assistant_text or None,
            "tool_calls": [{
                "id": tc.id, "type": "function",
                "function": {"name": tc.name, "arguments": json.dumps(tc.arguments, ensure_ascii=False)},
            }],
        },
        {"role": "tool", "tool_call_id": tc.id, "content": tool_result_text},
    ]


def _build_tool_call_messages_responses(
    tc: ToolCallResult, assistant_text: str, tool_result_text: str,
) -> list[dict]:
    """构建 OpenAI Responses API 格式的 function_call → function_call_output"""
    items: list[dict] = []
    items.append({
        "type": "function_call",
        "call_id": tc.id,
        "name": tc.name,
        "arguments": json.dumps(tc.arguments, ensure_ascii=False),
    })
    items.append({
        "type": "function_call_output",
        "call_id": tc.id,
        "output": tool_result_text,
    })
    return items


def _build_tool_messages(
    provider: str, tc: ToolCallResult, assistant_text: str, tool_result_text: str,
) -> list[dict]:
    if provider == "claude":
        return _build_tool_call_messages_claude(tc, assistant_text, tool_result_text)
    if provider == "openai":
        return _build_tool_call_messages_responses(tc, assistant_text, tool_result_text)
    return _build_tool_call_messages_openai(tc, assistant_text, tool_result_text)


def _flatten_tool_messages(messages: list[dict], provider: str) -> list[dict]:
    """对 deepseek/qwen 等不支持 tool 消息角色的 provider，将工具调用历史转为普通文本。

    只保留工具名称，不输出完整参数，避免 LLM 在最终回复中复述大段工具调用代码。
    """
    if provider in ("claude", "openai"):
        return messages  # 这两个 provider 原生支持 tool 消息

    result: list[dict] = []
    for msg in messages:
        role = msg.get("role", "")
        # tool 角色 → 转为 user 消息（截断过长结果）
        if role == "tool":
            content = (msg.get("content", "") or "")[:500]
            result.append({"role": "user", "content": f"[工具执行结果]\n{content}"})
        # assistant 带 tool_calls → 只保留工具名
        elif role == "assistant" and msg.get("tool_calls"):
            text = msg.get("content") or ""
            tc_names = [tc.get("function", {}).get("name", "unknown") for tc in msg["tool_calls"]]
            summary = "已调用工具: " + ", ".join(tc_names)
            combined = (text + "\n" + summary) if text else summary
            result.append({"role": "assistant", "content": combined})
        # function_call_output (Responses API 格式) → 转为 user
        elif msg.get("type") == "function_call_output":
            output = (msg.get("output", "") or "")[:500]
            result.append({"role": "user", "content": f"[工具执行结果]\n{output}"})
        # function_call (Responses API 格式) → 只保留工具名
        elif msg.get("type") == "function_call":
            result.append({"role": "assistant", "content": f"已调用工具: {msg.get('name', 'unknown')}"})
        else:
            result.append(msg)
    return result


# ── 核心编排：流式 ─────────────────────────────────────────────

async def run_stream(
    request: PipelineRequest, db: AsyncSession,
) -> AsyncGenerator[PipelineEvent, None]:
    """统一 AI 能力管道 — 流式输出。

    工具循环阶段用非流式 generate()，最后一轮切换为 stream_chat() 流式输出。
    """
    # 1. 构建系统提示词
    system_prompt = await build_system_prompt(db)

    # 2. knowledge 模式 → RAG 上下文
    sources: list[dict] = []
    if "knowledge" in request.modes and request.knowledge_base_ids:
        context, sources = await retrieve_context(db, request.message, request.knowledge_base_ids)
        if context:
            system_prompt += "\n\n" + build_rag_context(context, request.message)
            yield PipelineEvent(type="sources", data={"sources": sources})

    # 2.5 会话记忆
    if request.memory_summary:
        system_prompt += f"\n\n会话记忆摘要（仅作背景，不需逐字重复）:\n{request.memory_summary}"

    # 2.6 search 模式 → Tavily 网络搜索
    if "search" in request.modes:
        from app.services.web_search_service import tavily_search, build_search_context
        search_results = await tavily_search(request.message, db=db)
        if search_results:
            system_prompt += "\n\n" + build_search_context(search_results, request.message)
            yield PipelineEvent(type="web_search", data={"results": search_results})

    # 3. 收集工具定义
    openai_tools: list[dict] = []
    tool_index: dict[str, dict] = {}
    if "tools" in request.modes:
        openai_tools, tool_index = await _collect_tools(db)

    tools_for_llm = openai_tools if openai_tools else None

    # 4. 构建消息历史
    messages: list[dict] = list(request.history or [])
    messages.append({"role": "user", "content": request.message})

    all_tool_calls: list[dict] = []

    # 5. 工具循环
    for round_idx in range(request.max_tool_rounds):
        if not tools_for_llm:
            # 无工具 → 直接流式输出
            break

        result: GenerateResult = await ai_generate(
            messages, request.provider, system_prompt,
            tools=tools_for_llm, db=db,
        )

        if not result.tool_calls:
            # 无工具调用 → 用这次的文本作为最终回答（非流式）
            if result.text:
                yield PipelineEvent(type="text_chunk", data={"content": result.text})
            yield PipelineEvent(type="done", data={
                "tool_calls": all_tool_calls,
                "usage": result.usage,
            })
            return

        # 有工具调用 → 逐个执行
        for tc in result.tool_calls:
            yield PipelineEvent(type="tool_start", data={
                "name": tc.name, "args": tc.arguments,
            })

            tool_result_text, success = await _execute_tool_call(tc, tool_index, db)

            all_tool_calls.append({
                "name": tc.name, "args": tc.arguments,
                "result": tool_result_text[:2000], "success": success,
            })

            yield PipelineEvent(type="tool_result", data={
                "name": tc.name, "result": tool_result_text[:500], "success": success,
            })

            # 追加工具调用消息到历史
            messages.extend(_build_tool_messages(
                request.provider, tc, result.text, tool_result_text,
            ))

    # 6. 最后一轮：流式输出（无工具或超过最大轮次）
    # 对不支持 tool 消息角色的 provider，将工具调用历史扁平化为普通文本
    final_messages = _flatten_tool_messages(messages, request.provider)
    async for chunk in stream_chat(final_messages, request.provider, system_prompt, db=db):
        if chunk.type == "thinking":
            yield PipelineEvent(type="thinking", data={"content": chunk.content})
        else:
            yield PipelineEvent(type="text_chunk", data={"content": chunk.content})

    yield PipelineEvent(type="done", data={
        "tool_calls": all_tool_calls,
    })


# ── 核心编排：非流式（飞书等场景） ──────────────────────────────

async def run(request: PipelineRequest, db: AsyncSession) -> dict[str, Any]:
    """非流式版本，收集所有事件后返回完整结果。"""
    text_parts: list[str] = []
    all_sources: list[dict] = []
    all_tool_calls: list[dict] = []
    usage: dict[str, int] = {}

    async for event in run_stream(request, db):
        if event.type == "text_chunk":
            text_parts.append(event.data.get("content", ""))
        elif event.type == "sources":
            all_sources = event.data.get("sources", [])
        elif event.type == "tool_result":
            pass  # already tracked in done event
        elif event.type == "done":
            all_tool_calls = event.data.get("tool_calls", [])
            usage = event.data.get("usage", {})

    return {
        "text": "".join(text_parts),
        "sources": all_sources,
        "tool_calls": all_tool_calls,
        "usage": usage,
    }
