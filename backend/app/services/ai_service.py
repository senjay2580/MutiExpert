"""AI 服务抽象层 - Claude / OpenAI 策略模式"""
from __future__ import annotations

import json
from dataclasses import dataclass, replace as dc_replace, field
from typing import AsyncGenerator, Any
from sqlalchemy.ext.asyncio import AsyncSession
import httpx
from app.services.ai_model_config import get_provider_config, ProviderConfig


# ── 流式 StreamChunk ──────────────────────────────────────────────

@dataclass
class StreamChunk:
    """流式输出的单个片段"""
    type: str   # "text" | "thinking"
    content: str


# ── 非流式 generate() 数据结构 ──────────────────────────────────

@dataclass
class ToolCallResult:
    """LLM 返回的单个工具调用"""
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class GenerateResult:
    """非流式生成结果"""
    text: str = ""
    tool_calls: list[ToolCallResult] = field(default_factory=list)
    stop_reason: str = "end_turn"  # "end_turn" | "tool_use" | "stop"
    usage: dict[str, int] = field(default_factory=dict)


def _normalize_provider(provider: str) -> str:
    if provider == "codex":
        return "openai"
    return provider


def _openai_tools_to_claude(tools: list[dict]) -> list[dict]:
    """OpenAI function calling 格式 → Claude tool_use 格式"""
    result = []
    for t in tools:
        fn = t.get("function", t)
        result.append({
            "name": fn["name"],
            "description": fn.get("description", ""),
            "input_schema": fn.get("parameters", {"type": "object", "properties": {}}),
        })
    return result


class ClaudeStrategy:
    def __init__(self, config: ProviderConfig):
        self.config = config

    async def stream(self, messages: list[dict], system_prompt: str) -> AsyncGenerator[StreamChunk, None]:
        if not self.config.api_key:
            yield StreamChunk("text", "Error: Anthropic API key not configured")
            return

        import anthropic

        model = self.config.model or "claude-sonnet-4-20250514"
        client = anthropic.AsyncAnthropic(api_key=self.config.api_key)

        async with client.messages.stream(
            model=model,
            max_tokens=4096,
            system=system_prompt,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield StreamChunk("text", text)

    async def generate(
        self, messages: list[dict], system_prompt: str, tools: list[dict] | None = None,
    ) -> GenerateResult:
        if not self.config.api_key:
            return GenerateResult(text="Error: Anthropic API key not configured")

        import anthropic

        model = self.config.model or "claude-sonnet-4-20250514"
        client = anthropic.AsyncAnthropic(api_key=self.config.api_key)

        kwargs: dict[str, Any] = {
            "model": model,
            "max_tokens": 4096,
            "system": system_prompt,
            "messages": messages,
        }
        if tools:
            kwargs["tools"] = _openai_tools_to_claude(tools)

        resp = await client.messages.create(**kwargs)

        text_parts: list[str] = []
        tool_calls: list[ToolCallResult] = []
        for block in resp.content:
            if block.type == "text":
                text_parts.append(block.text)
            elif block.type == "tool_use":
                tool_calls.append(ToolCallResult(
                    id=block.id, name=block.name, arguments=block.input or {},
                ))

        usage = {}
        if resp.usage:
            usage = {"prompt_tokens": resp.usage.input_tokens, "completion_tokens": resp.usage.output_tokens}

        return GenerateResult(
            text="\n".join(text_parts),
            tool_calls=tool_calls,
            stop_reason=resp.stop_reason or "end_turn",
            usage=usage,
        )


class OpenAIResponsesStrategy:
    def __init__(self, config: ProviderConfig):
        self.config = config

    def _resolve_model(self) -> str | None:
        model = self.config.model
        migrations = (self.config.extras or {}).get("model_migrations", {}) if self.config.extras else {}
        if model and isinstance(migrations, dict) and model in migrations:
            return migrations[model]
        return model

    def _build_headers(self) -> dict[str, str]:
        headers = {
            "accept": "text/event-stream",
            "content-type": "application/json",
            "user-agent": "MutiExpert/1.0",
        }
        if not self.config.api_key:
            return headers

        extras = self.config.extras or {}
        preferred = extras.get("preferred_auth_method")
        requires_openai_auth = bool(extras.get("requires_openai_auth"))

        if preferred == "apikey":
            headers["x-api-key"] = self.config.api_key
        if preferred != "apikey" or requires_openai_auth:
            headers["authorization"] = f"Bearer {self.config.api_key}"
        return headers

    def _extract_delta(self, event: dict[str, Any]) -> str | None:
        if isinstance(event.get("delta"), str):
            return event.get("delta")
        if isinstance(event.get("text"), str) and str(event.get("type", "")).endswith(".delta"):
            return event.get("text")
        return None

    def _extract_final(self, event: dict[str, Any]) -> str | None:
        if isinstance(event.get("text"), str) and str(event.get("type", "")).endswith(".done"):
            return event.get("text")
        response = event.get("response")
        if isinstance(response, dict):
            output = response.get("output")
            if isinstance(output, list):
                for item in output:
                    if not isinstance(item, dict):
                        continue
                    if item.get("type") == "output_text" and isinstance(item.get("text"), str):
                        return item.get("text")
                    content = item.get("content")
                    if isinstance(content, list):
                        for part in content:
                            if isinstance(part, dict) and isinstance(part.get("text"), str):
                                return part.get("text")
        return None

    async def stream(self, messages: list[dict], system_prompt: str) -> AsyncGenerator[StreamChunk, None]:
        if not self.config.api_key:
            yield StreamChunk("text", "Error: OpenAI API key not configured")
            return

        model = self._resolve_model()
        if not model:
            yield StreamChunk("text", "Error: OpenAI model not configured")
            return

        base_url = (self.config.base_url or "https://api.openai.com").rstrip("/")
        url = f"{base_url}/v1/responses"

        input_messages: list[dict[str, Any]] = list(messages)

        payload: dict[str, Any] = {
            "model": model,
            "input": input_messages,
            "stream": True,
        }

        if system_prompt:
            payload["instructions"] = system_prompt

        extras = self.config.extras or {}
        wire_api = extras.get("wire_api")
        if wire_api and wire_api != "responses":
            yield StreamChunk("text", f"Error: Unsupported OpenAI wire_api '{wire_api}'")
            return

        reasoning_effort = extras.get("reasoning_effort")
        if reasoning_effort:
            payload["reasoning"] = {"effort": reasoning_effort, "summary": "auto"}

        disable_storage = extras.get("disable_response_storage")
        if disable_storage is True:
            payload["store"] = False
        elif disable_storage is False:
            payload["store"] = True

        headers = self._build_headers()

        timeout = httpx.Timeout(60.0, read=3600.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as resp:
                if resp.status_code >= 400:
                    body = await resp.aread()
                    detail = body.decode("utf-8", "replace") if body else ""
                    yield StreamChunk("text", f"Error: OpenAI request failed ({resp.status_code}) {detail}")
                    return

                emitted = False
                pending_final = None
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data:"):
                        data = line[5:].strip()
                    else:
                        continue
                    if data == "[DONE]":
                        break
                    try:
                        event = json.loads(data)
                    except json.JSONDecodeError:
                        continue

                    # reasoning summary（如果中转服务透传）
                    evt_type = event.get("type", "")
                    if evt_type == "response.output_item.done":
                        item = event.get("item", {})
                        if item.get("type") == "reasoning":
                            for s in item.get("summary", []):
                                txt = s.get("text", "")
                                if txt:
                                    yield StreamChunk("thinking", txt)
                            continue

                    delta = self._extract_delta(event)
                    if delta:
                        emitted = True
                        yield StreamChunk("text", delta)
                        continue

                    final_text = self._extract_final(event)
                    if final_text and not emitted:
                        pending_final = final_text

                if not emitted and pending_final:
                    yield StreamChunk("text", pending_final)

    async def generate(
        self, messages: list[dict], system_prompt: str, tools: list[dict] | None = None,
    ) -> GenerateResult:
        """OpenAI Responses API 的 generate — function calling 降级到 /chat/completions"""
        if not self.config.api_key:
            return GenerateResult(text="Error: OpenAI API key not configured")

        model = self._resolve_model()
        if not model:
            return GenerateResult(text="Error: OpenAI model not configured")

        base_url = (self.config.base_url or "https://api.openai.com").rstrip("/")
        url = f"{base_url}/v1/chat/completions"

        api_messages: list[dict[str, Any]] = []
        if system_prompt:
            api_messages.append({"role": "system", "content": system_prompt})
        api_messages.extend(messages)

        payload: dict[str, Any] = {
            "model": model,
            "messages": api_messages,
            "stream": False,
        }
        if tools:
            payload["tools"] = tools

        headers = {
            "content-type": "application/json",
            "authorization": f"Bearer {self.config.api_key}",
        }

        return await _openai_chat_completions_generate(url, headers, payload, "openai")


class OpenAIChatCompletionsStrategy:
    """OpenAI-compatible /chat/completions strategy for DeepSeek, Qwen, etc."""

    def __init__(self, config: ProviderConfig):
        self.config = config

    def _build_url_and_headers(self) -> tuple[str, dict[str, str]] | None:
        base_url = (self.config.base_url or "https://api.openai.com/v1").rstrip("/")
        url = f"{base_url}/chat/completions"
        headers = {
            "content-type": "application/json",
            "authorization": f"Bearer {self.config.api_key}",
        }
        return url, headers

    async def stream(self, messages: list[dict], system_prompt: str) -> AsyncGenerator[StreamChunk, None]:
        if not self.config.api_key:
            yield StreamChunk("text", f"Error: {self.config.provider_id} API key not configured")
            return

        model = self.config.model
        if not model:
            yield StreamChunk("text", f"Error: {self.config.provider_id} model not configured")
            return

        result = self._build_url_and_headers()
        if not result:
            yield StreamChunk("text", f"Error: {self.config.provider_id} base_url not configured")
            return
        url, headers = result

        api_messages: list[dict[str, Any]] = []
        if system_prompt:
            api_messages.append({"role": "system", "content": system_prompt})
        api_messages.extend(messages)

        payload: dict[str, Any] = {
            "model": model,
            "messages": api_messages,
            "stream": True,
        }

        timeout = httpx.Timeout(60.0, read=3600.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as resp:
                if resp.status_code >= 400:
                    body = await resp.aread()
                    detail = body.decode("utf-8", "replace") if body else ""
                    yield StreamChunk("text", f"Error: {self.config.provider_id} request failed ({resp.status_code}) {detail}")
                    return

                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data:"):
                        data = line[5:].strip()
                    else:
                        continue
                    if data == "[DONE]":
                        break
                    try:
                        event = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    choices = event.get("choices", [])
                    if choices:
                        delta = choices[0].get("delta", {})
                        reasoning = delta.get("reasoning_content")
                        if reasoning:
                            yield StreamChunk("thinking", reasoning)
                            continue
                        content = delta.get("content")
                        if content:
                            yield StreamChunk("text", content)

    async def generate(
        self, messages: list[dict], system_prompt: str, tools: list[dict] | None = None,
    ) -> GenerateResult:
        if not self.config.api_key:
            return GenerateResult(text=f"Error: {self.config.provider_id} API key not configured")
        if not self.config.model:
            return GenerateResult(text=f"Error: {self.config.provider_id} model not configured")

        result = self._build_url_and_headers()
        if not result:
            return GenerateResult(text=f"Error: {self.config.provider_id} base_url not configured")
        url, headers = result

        api_messages: list[dict[str, Any]] = []
        if system_prompt:
            api_messages.append({"role": "system", "content": system_prompt})
        api_messages.extend(messages)

        payload: dict[str, Any] = {
            "model": self.config.model,
            "messages": api_messages,
            "stream": False,
        }
        if tools:
            payload["tools"] = tools

        return await _openai_chat_completions_generate(url, headers, payload, self.config.provider_id)


# ── 共享辅助函数 ──────────────────────────────────────────────

async def _openai_chat_completions_generate(
    url: str, headers: dict[str, str], payload: dict[str, Any], provider_label: str,
) -> GenerateResult:
    """OpenAI /chat/completions 非流式调用，解析 tool_calls"""
    timeout = httpx.Timeout(60.0, read=120.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code >= 400:
            return GenerateResult(text=f"Error: {provider_label} request failed ({resp.status_code})")

        data = resp.json()
        choice = data.get("choices", [{}])[0]
        msg = choice.get("message", {})

        text = msg.get("content") or ""
        stop_reason = choice.get("finish_reason") or "stop"

        tool_calls: list[ToolCallResult] = []
        raw_tool_calls = msg.get("tool_calls") or []
        for tc in raw_tool_calls:
            fn = tc.get("function", {})
            try:
                args = json.loads(fn.get("arguments", "{}"))
            except json.JSONDecodeError:
                args = {}
            tool_calls.append(ToolCallResult(
                id=tc.get("id", ""), name=fn.get("name", ""), arguments=args,
            ))

        usage_data = data.get("usage") or {}
        usage = {}
        if usage_data:
            usage = {
                "prompt_tokens": usage_data.get("prompt_tokens", 0),
                "completion_tokens": usage_data.get("completion_tokens", 0),
            }

        if stop_reason == "tool_calls":
            stop_reason = "tool_use"

        return GenerateResult(text=text, tool_calls=tool_calls, stop_reason=stop_reason, usage=usage)


async def stream_chat(
    messages: list[dict],
    provider: str = "claude",
    system_prompt: str = "",
    db: AsyncSession | None = None,
    model_name: str | None = None,
) -> AsyncGenerator[StreamChunk, None]:
    """流式生成 AI 回答，yield StreamChunk(type, content)"""
    provider = _normalize_provider(provider)

    if provider == "claude":
        config = await get_provider_config(db, "claude")
        if model_name:
            config = dc_replace(config, model=model_name)
        strategy = ClaudeStrategy(config)
    elif provider == "openai":
        config = await get_provider_config(db, "openai")
        if model_name:
            config = dc_replace(config, model=model_name)
        strategy = OpenAIChatCompletionsStrategy(config)
    elif provider in ("deepseek", "qwen"):
        config = await get_provider_config(db, provider)
        if model_name:
            config = dc_replace(config, model=model_name)
        strategy = OpenAIChatCompletionsStrategy(config)
    else:
        yield f"Unknown provider: {provider}"
        return

    async for chunk in strategy.stream(messages, system_prompt):
        yield chunk


# ── 非流式统一入口 ──────────────────────────────────────────────

def _get_strategy(provider: str, config: ProviderConfig):
    """根据 provider 返回对应 Strategy 实例"""
    if provider == "claude":
        return ClaudeStrategy(config)
    else:
        return OpenAIChatCompletionsStrategy(config)


async def generate(
    messages: list[dict],
    provider: str = "claude",
    system_prompt: str = "",
    tools: list[dict] | None = None,
    db: AsyncSession | None = None,
    model_name: str | None = None,
) -> GenerateResult:
    """非流式生成，支持 function calling。

    tools 统一用 OpenAI 格式: [{"type":"function","function":{...}}]
    内部按 provider 自动转换。
    """
    provider = _normalize_provider(provider)

    if provider not in ("claude", "openai", "deepseek", "qwen"):
        return GenerateResult(text=f"Unknown provider: {provider}")

    config = await get_provider_config(db, provider)
    if model_name:
        config = dc_replace(config, model=model_name)

    strategy = _get_strategy(provider, config)
    return await strategy.generate(messages, system_prompt, tools)
