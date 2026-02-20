"""AI 服务抽象层 - Claude / OpenAI 策略模式"""
from __future__ import annotations

import json
from typing import AsyncGenerator, Any
from sqlalchemy.ext.asyncio import AsyncSession
import httpx
from app.services.ai_model_config import get_provider_config, ProviderConfig


def _normalize_provider(provider: str) -> str:
    if provider == "codex":
        return "openai"
    return provider


class ClaudeStrategy:
    def __init__(self, config: ProviderConfig):
        self.config = config

    async def stream(self, messages: list[dict], system_prompt: str) -> AsyncGenerator[str, None]:
        if not self.config.api_key:
            yield "Error: Anthropic API key not configured"
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
                yield text


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

    async def stream(self, messages: list[dict], system_prompt: str) -> AsyncGenerator[str, None]:
        if not self.config.api_key:
            yield "Error: OpenAI API key not configured"
            return

        model = self._resolve_model()
        if not model:
            yield "Error: OpenAI model not configured"
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
            yield f"Error: Unsupported OpenAI wire_api '{wire_api}'"
            return

        reasoning_effort = extras.get("reasoning_effort")
        if reasoning_effort:
            payload["reasoning"] = {"effort": reasoning_effort}

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
                    yield f"Error: OpenAI request failed ({resp.status_code}) {detail}"
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

                    delta = self._extract_delta(event)
                    if delta:
                        emitted = True
                        yield delta
                        continue

                    final_text = self._extract_final(event)
                    if final_text and not emitted:
                        pending_final = final_text

                if not emitted and pending_final:
                    yield pending_final


class OpenAIChatCompletionsStrategy:
    """OpenAI-compatible /chat/completions strategy for DeepSeek, Qwen, etc."""

    def __init__(self, config: ProviderConfig):
        self.config = config

    async def stream(self, messages: list[dict], system_prompt: str) -> AsyncGenerator[str, None]:
        if not self.config.api_key:
            yield f"Error: {self.config.provider_id} API key not configured"
            return

        model = self.config.model
        if not model:
            yield f"Error: {self.config.provider_id} model not configured"
            return

        base_url = (self.config.base_url or "").rstrip("/")
        if not base_url:
            yield f"Error: {self.config.provider_id} base_url not configured"
            return

        url = f"{base_url}/chat/completions"

        api_messages: list[dict[str, Any]] = []
        if system_prompt:
            api_messages.append({"role": "system", "content": system_prompt})
        api_messages.extend(messages)

        payload: dict[str, Any] = {
            "model": model,
            "messages": api_messages,
            "stream": True,
        }

        headers = {
            "content-type": "application/json",
            "authorization": f"Bearer {self.config.api_key}",
        }

        timeout = httpx.Timeout(60.0, read=3600.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as resp:
                if resp.status_code >= 400:
                    body = await resp.aread()
                    detail = body.decode("utf-8", "replace") if body else ""
                    yield f"Error: {self.config.provider_id} request failed ({resp.status_code}) {detail}"
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
                        content = delta.get("content")
                        if content:
                            yield content


async def stream_chat(
    messages: list[dict],
    provider: str = "claude",
    system_prompt: str = "",
    db: AsyncSession | None = None,
) -> AsyncGenerator[str, None]:
    """流式生成 AI 回答"""
    provider = _normalize_provider(provider)

    if provider == "claude":
        config = await get_provider_config(db, "claude")
        strategy = ClaudeStrategy(config)
    elif provider == "openai":
        config = await get_provider_config(db, "openai")
        strategy = OpenAIResponsesStrategy(config)
    elif provider in ("deepseek", "qwen"):
        config = await get_provider_config(db, provider)
        strategy = OpenAIChatCompletionsStrategy(config)
    else:
        yield f"Unknown provider: {provider}"
        return

    async for chunk in strategy.stream(messages, system_prompt):
        yield chunk
