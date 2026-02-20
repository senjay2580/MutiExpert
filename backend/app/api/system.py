from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.config import get_settings
from app.models.extras import AIModelConfig
from app.schemas.ai_models import AIModelConfigUpdate, AIModelConfigOut
from app.services.ai_model_config import DEFAULT_MODEL_CONFIGS, list_configs

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok"}


def _config_to_out(config: AIModelConfig) -> AIModelConfigOut:
    extras = config.extras or {}
    provider = DEFAULT_MODEL_CONFIGS.get(config.provider_id, {}).get("provider", config.provider_id)
    settings = get_settings()
    api_key_set = bool(config.api_key)
    if not api_key_set:
        if config.provider_id == "claude" and settings.anthropic_api_key:
            api_key_set = True
        if config.provider_id == "openai" and settings.openai_api_key:
            api_key_set = True
    return AIModelConfigOut(
        id=config.provider_id,
        name=config.name,
        provider=provider,
        base_url=config.base_url,
        model=config.model,
        api_key_set=api_key_set,
        reasoning_effort=extras.get("reasoning_effort"),
        disable_response_storage=extras.get("disable_response_storage"),
        preferred_auth_method=extras.get("preferred_auth_method"),
        wire_api=extras.get("wire_api"),
        requires_openai_auth=extras.get("requires_openai_auth"),
    )


@router.get("/config/models", response_model=list[AIModelConfigOut])
async def get_available_models(db: AsyncSession = Depends(get_db)):
    configs = await list_configs(db)
    return [_config_to_out(c) for c in configs]


@router.put("/config/models/{provider_id}", response_model=AIModelConfigOut)
async def update_model_config(
    provider_id: str,
    data: AIModelConfigUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AIModelConfig).where(AIModelConfig.provider_id == provider_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        defaults = DEFAULT_MODEL_CONFIGS.get(provider_id, {
            "name": provider_id,
            "base_url": None,
            "model": None,
            "extras": {},
        })
        config = AIModelConfig(
            provider_id=provider_id,
            name=defaults["name"],
            base_url=defaults["base_url"],
            model=defaults["model"],
            extras=defaults["extras"],
        )
        db.add(config)

    if data.name is not None:
        config.name = data.name
    if data.base_url is not None:
        config.base_url = data.base_url.strip() or None
    if data.model is not None:
        config.model = data.model.strip() or None
    if data.api_key is not None:
        config.api_key = data.api_key.strip() or None

    extras = dict(config.extras or {})
    if data.reasoning_effort is not None:
        extras["reasoning_effort"] = data.reasoning_effort
    if data.disable_response_storage is not None:
        extras["disable_response_storage"] = data.disable_response_storage
    if data.preferred_auth_method is not None:
        extras["preferred_auth_method"] = data.preferred_auth_method
    if data.wire_api is not None:
        extras["wire_api"] = data.wire_api
    if data.requires_openai_auth is not None:
        extras["requires_openai_auth"] = data.requires_openai_auth
    if data.model_migrations is not None:
        extras["model_migrations"] = data.model_migrations
    config.extras = extras

    await db.commit()
    await db.refresh(config)
    return _config_to_out(config)
