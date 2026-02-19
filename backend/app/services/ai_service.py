"""AI 服务抽象层 - Claude / OpenAI 统一接口"""
from typing import AsyncGenerator
from app.config import get_settings


async def stream_chat(
    messages: list[dict],
    provider: str = "claude",
    system_prompt: str = "",
) -> AsyncGenerator[str, None]:
    """流式生成 AI 回答"""
    settings = get_settings()

    if provider == "claude":
        async for chunk in _stream_claude(messages, system_prompt, settings.anthropic_api_key):
            yield chunk
    elif provider == "codex":
        async for chunk in _stream_openai(messages, system_prompt, settings.openai_api_key):
            yield chunk
    else:
        yield f"Unknown provider: {provider}"


async def _stream_claude(
    messages: list[dict],
    system_prompt: str,
    api_key: str,
) -> AsyncGenerator[str, None]:
    if not api_key:
        yield "Error: Anthropic API key not configured"
        return

    import anthropic
    client = anthropic.AsyncAnthropic(api_key=api_key)

    async with client.messages.stream(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=system_prompt,
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            yield text


async def _stream_openai(
    messages: list[dict],
    system_prompt: str,
    api_key: str,
) -> AsyncGenerator[str, None]:
    if not api_key:
        yield "Error: OpenAI API key not configured"
        return

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key)

    all_messages = []
    if system_prompt:
        all_messages.append({"role": "system", "content": system_prompt})
    all_messages.extend(messages)

    stream = await client.chat.completions.create(
        model="gpt-4o",
        messages=all_messages,
        max_tokens=4096,
        stream=True,
    )

    async for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
