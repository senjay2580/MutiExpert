from fastapi import APIRouter, Depends, HTTPException
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.config import get_settings
from app.models.extras import AIModelConfig, SiteSetting
from app.schemas.ai_models import AIModelConfigUpdate, AIModelConfigOut
from app.services.ai_model_config import DEFAULT_MODEL_CONFIGS, list_configs
from app.services.ai_service import stream_chat

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok"}


def _config_to_out(config: AIModelConfig) -> AIModelConfigOut:
    extras = config.extras or {}
    provider = DEFAULT_MODEL_CONFIGS.get(config.provider_id, {}).get("provider", config.provider_id)
    api_key_set = bool(config.api_key)
    if not api_key_set:
        settings = get_settings()
        env_key_map = {
            "claude": settings.anthropic_api_key,
            "openai": settings.openai_api_key,
            "deepseek": settings.deepseek_api_key,
            "qwen": settings.qwen_api_key,
        }
        if env_key_map.get(config.provider_id):
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
        available_models=extras.get("available_models", []),
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
    if data.available_models is not None:
        extras["available_models"] = data.available_models
    config.extras = extras

    await db.commit()
    await db.refresh(config)
    return _config_to_out(config)


@router.post("/config/models/{provider_id}/test")
async def test_model_connection(
    provider_id: str,
    data: dict | None = None,
    db: AsyncSession = Depends(get_db),
):
    provider = "openai" if provider_id == "codex" else provider_id
    if provider not in {"openai", "claude", "deepseek", "qwen"}:
        raise HTTPException(status_code=400, detail="Unsupported provider")

    model_name = data.get("model") if data else None
    generator = stream_chat([{"role": "user", "content": "ping"}], provider, "", db=db, model_name=model_name)
    try:
        try:
            first_chunk = await asyncio.wait_for(generator.__anext__(), timeout=20)
        except StopAsyncIteration:
            return {"ok": False, "message": "无响应"}
        if isinstance(first_chunk, str) and first_chunk.lower().startswith("error:"):
            return {"ok": False, "message": first_chunk.replace("Error:", "").strip()}
        from app.services.ai_service import StreamChunk
        if isinstance(first_chunk, StreamChunk) and first_chunk.content.lower().startswith("error:"):
            return {"ok": False, "message": first_chunk.content.replace("Error:", "").strip()}
        return {"ok": True, "message": "连接成功"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        await generator.aclose()


# ── Tavily 配置 ──────────────────────────────────────────────

@router.get("/config/tavily")
async def get_tavily_config(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SiteSetting.value).where(SiteSetting.key == "tavily_api_key")
    )
    raw = result.scalar_one_or_none() or ""
    # 脱敏：只返回前4位 + 掩码
    masked = (raw[:4] + "****" + raw[-4:]) if len(raw) > 8 else ("****" if raw else "")
    return {"api_key_set": bool(raw), "api_key_masked": masked}


@router.put("/config/tavily")
async def update_tavily_config(
    data: dict,
    db: AsyncSession = Depends(get_db),
):
    api_key = (data.get("api_key") or "").strip()
    result = await db.execute(
        select(SiteSetting).where(SiteSetting.key == "tavily_api_key")
    )
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = api_key
    else:
        db.add(SiteSetting(key="tavily_api_key", value=api_key))
    await db.commit()
    return {"message": "Tavily API Key 已保存"}


# ── Supabase Storage 配置 ────────────────────────────────────

_SUPABASE_KEYS = ("supabase_url", "supabase_service_key", "supabase_bucket")


def _mask(val: str) -> str:
    if len(val) > 12:
        return val[:6] + "****" + val[-4:]
    return "****" if val else ""


@router.get("/config/supabase")
async def get_supabase_config(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SiteSetting).where(SiteSetting.key.in_(_SUPABASE_KEYS))
    )
    rows = {r.key: r.value for r in result.scalars()}
    url = rows.get("supabase_url", "")
    key = rows.get("supabase_service_key", "")
    bucket = rows.get("supabase_bucket", "")
    return {
        "supabase_url": url,
        "supabase_service_key_masked": _mask(key),
        "supabase_service_key_set": bool(key),
        "supabase_bucket": bucket or "public-files",
    }


@router.put("/config/supabase")
async def update_supabase_config(
    data: dict,
    db: AsyncSession = Depends(get_db),
):
    for field in _SUPABASE_KEYS:
        val = (data.get(field) or "").strip()
        if not val:
            continue
        row = await db.execute(
            select(SiteSetting).where(SiteSetting.key == field)
        )
        setting = row.scalar_one_or_none()
        if setting:
            setting.value = val
        else:
            db.add(SiteSetting(key=field, value=val))
    await db.commit()
    return {"message": "Supabase Storage 配置已保存"}
