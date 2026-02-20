from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import get_settings
from app.models.extras import AIModelConfig


DEFAULT_MODEL_CONFIGS: dict[str, dict[str, Any]] = {
    "claude": {
        "name": "Claude (Anthropic)",
        "provider": "anthropic",
        "base_url": None,
        "model": "claude-sonnet-4-20250514",
        "extras": {},
    },
    "openai": {
        "name": "OpenAI (Responses)",
        "provider": "openai",
        "base_url": None,
        "model": "gpt-5.3-codex",
        "extras": {
            "wire_api": "responses",
            "reasoning_effort": "xhigh",
            "disable_response_storage": True,
            "preferred_auth_method": "apikey",
            "requires_openai_auth": True,
            "model_migrations": {"gpt-5.2-codex": "gpt-5.3-codex"},
        },
    },
    "deepseek": {
        "name": "DeepSeek",
        "provider": "deepseek",
        "base_url": "https://api.deepseek.com",
        "model": "deepseek-chat",
        "extras": {
            "available_models": [
                {"id": "deepseek-chat", "name": "DeepSeek-V3"},
                {"id": "deepseek-reasoner", "name": "DeepSeek-R1"},
            ],
        },
    },
    "qwen": {
        "name": "通义千问 (Qwen)",
        "provider": "qwen",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "qwen-plus",
        "extras": {
            "available_models": [
                {"id": "qwen-plus", "name": "Qwen Plus"},
                {"id": "qwen-turbo", "name": "Qwen Turbo"},
                {"id": "qwen-max", "name": "Qwen Max"},
                {"id": "qwen-long", "name": "Qwen Long"},
            ],
        },
    },
}


@dataclass
class ProviderConfig:
    provider_id: str
    name: str
    provider: str
    base_url: str | None
    api_key: str | None
    model: str | None
    extras: dict[str, Any]


async def ensure_default_configs(db: AsyncSession) -> None:
    for provider_id, defaults in DEFAULT_MODEL_CONFIGS.items():
        result = await db.execute(
            select(AIModelConfig).where(AIModelConfig.provider_id == provider_id)
        )
        config = result.scalar_one_or_none()
        if config:
            continue
        db.add(
            AIModelConfig(
                provider_id=provider_id,
                name=defaults["name"],
                base_url=defaults["base_url"],
                api_key=None,
                model=defaults["model"],
                extras=defaults["extras"],
            )
        )
    await db.commit()


async def list_configs(db: AsyncSession) -> list[AIModelConfig]:
    await ensure_default_configs(db)
    result = await db.execute(select(AIModelConfig).order_by(AIModelConfig.provider_id))
    return list(result.scalars().all())


async def get_provider_config(
    db: AsyncSession | None,
    provider_id: str,
) -> ProviderConfig:
    defaults = DEFAULT_MODEL_CONFIGS.get(provider_id, {
        "name": provider_id,
        "provider": provider_id,
        "base_url": None,
        "model": None,
        "extras": {},
    })

    config: AIModelConfig | None = None
    if db is not None:
        result = await db.execute(
            select(AIModelConfig).where(AIModelConfig.provider_id == provider_id)
        )
        config = result.scalar_one_or_none()
        if config is None:
            config = AIModelConfig(
                provider_id=provider_id,
                name=defaults["name"],
                base_url=defaults["base_url"],
                api_key=None,
                model=defaults["model"],
                extras=defaults["extras"],
            )
            db.add(config)
            await db.commit()
            await db.refresh(config)

    settings = get_settings()
    api_key = None
    if config and config.api_key:
        api_key = config.api_key
    else:
        env_key_map = {
            "claude": settings.anthropic_api_key,
            "openai": settings.openai_api_key,
            "deepseek": settings.deepseek_api_key,
            "qwen": settings.qwen_api_key,
        }
        api_key = env_key_map.get(provider_id) or None

    return ProviderConfig(
        provider_id=provider_id,
        name=config.name if config else defaults["name"],
        provider=defaults.get("provider", provider_id),
        base_url=(config.base_url if config else defaults["base_url"]),
        api_key=api_key,
        model=(config.model if config else defaults["model"]),
        extras=(config.extras if config else defaults["extras"]),
    )

