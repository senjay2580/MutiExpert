"""脚本环境变量解析器 — 从系统配置自动映射环境变量 + 明文密钥检测"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import get_settings
from app.models.extras import AIModelConfig, FeishuConfig
from app.services.feishu_service import decrypt_secret


# ── 可用环境变量注册表 ──

ENV_VAR_REGISTRY: list[dict[str, str]] = [
    {"name": "CLAUDE_API_KEY", "source": "AI 模型配置 → Claude", "group": "ai_model"},
    {"name": "OPENAI_API_KEY", "source": "AI 模型配置 → OpenAI", "group": "ai_model"},
    {"name": "DEEPSEEK_API_KEY", "source": "AI 模型配置 → DeepSeek", "group": "ai_model"},
    {"name": "QWEN_API_KEY", "source": "AI 模型配置 → 通义千问", "group": "ai_model"},
    {"name": "CLAUDE_MODEL", "source": "AI 模型配置 → Claude 模型名", "group": "ai_model"},
    {"name": "OPENAI_MODEL", "source": "AI 模型配置 → OpenAI 模型名", "group": "ai_model"},
    {"name": "DEEPSEEK_MODEL", "source": "AI 模型配置 → DeepSeek 模型名", "group": "ai_model"},
    {"name": "QWEN_MODEL", "source": "AI 模型配置 → Qwen 模型名", "group": "ai_model"},
    {"name": "DEEPSEEK_BASE_URL", "source": "AI 模型配置 → DeepSeek Base URL", "group": "ai_model"},
    {"name": "QWEN_BASE_URL", "source": "AI 模型配置 → Qwen Base URL", "group": "ai_model"},
    {"name": "FEISHU_APP_ID", "source": "飞书配置 → App ID", "group": "feishu"},
    {"name": "FEISHU_APP_SECRET", "source": "飞书配置 → App Secret（解密）", "group": "feishu"},
    {"name": "FEISHU_WEBHOOK_URL", "source": "飞书配置 → Webhook URL", "group": "feishu"},
    {"name": "FEISHU_CHAT_ID", "source": "飞书配置 → 默认群 Chat ID", "group": "feishu"},
    {"name": "EMBEDDING_API_KEY", "source": "系统环境变量 → Embedding API Key", "group": "embedding"},
    {"name": "EMBEDDING_API_BASE", "source": "系统环境变量 → Embedding Base URL", "group": "embedding"},
]

# ── 明文密钥检测正则 ──

_SECRET_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("Anthropic API Key", re.compile(r"""sk-ant-[a-zA-Z0-9\-_]{20,}""")),
    ("OpenAI API Key", re.compile(r"""sk-[a-zA-Z0-9]{20,}""")),
    ("通用 Bearer Token", re.compile(r"""(?:bearer|token)\s*[:=]\s*["']?[a-zA-Z0-9\-_]{30,}""", re.I)),
    ("飞书 App Secret", re.compile(r"""(?:app_?secret|feishu.*secret)\s*[:=]\s*["']?[a-zA-Z0-9]{20,}""", re.I)),
    ("硬编码 API Key 赋值", re.compile(r"""(?:api_?key|apikey|secret)\s*[:=]\s*["'][a-zA-Z0-9\-_]{20,}["']""", re.I)),
]


@dataclass
class EnvResolveResult:
    env_vars: dict[str, str] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)


def detect_hardcoded_secrets(script_content: str) -> list[str]:
    """扫描脚本内容，检测疑似硬编码的密钥，返回警告列表"""
    warnings: list[str] = []
    for label, pattern in _SECRET_PATTERNS:
        matches = pattern.findall(script_content)
        if matches:
            # 只展示前 8 个字符，避免泄露
            preview = matches[0][:8] + "***"
            warnings.append(
                f"检测到疑似硬编码的 {label}（{preview}），"
                f"建议使用 Deno.env.get(\"变量名\") 引用系统配置"
            )
    return warnings


async def resolve_env_vars(db: AsyncSession) -> dict[str, str]:
    """从数据库配置解析所有可用环境变量，返回 name→value 映射"""
    settings = get_settings()
    env: dict[str, str] = {}

    # ── AI 模型配置 ──
    result = await db.execute(select(AIModelConfig))
    configs = {c.provider_id: c for c in result.scalars().all()}

    provider_env_map = {
        "claude": ("CLAUDE_API_KEY", "CLAUDE_MODEL", None),
        "openai": ("OPENAI_API_KEY", "OPENAI_MODEL", None),
        "deepseek": ("DEEPSEEK_API_KEY", "DEEPSEEK_MODEL", "DEEPSEEK_BASE_URL"),
        "qwen": ("QWEN_API_KEY", "QWEN_MODEL", "QWEN_BASE_URL"),
    }
    env_key_fallback = {
        "claude": settings.anthropic_api_key,
        "openai": settings.openai_api_key,
        "deepseek": settings.deepseek_api_key,
        "qwen": settings.qwen_api_key,
    }

    for pid, (key_var, model_var, url_var) in provider_env_map.items():
        cfg = configs.get(pid)
        api_key = (cfg.api_key if cfg and cfg.api_key else None) or env_key_fallback.get(pid) or ""
        model = (cfg.model if cfg else None) or ""
        base_url = (cfg.base_url if cfg else None) or ""
        if api_key:
            env[key_var] = api_key
        if model:
            env[model_var] = model
        if url_var and base_url:
            env[url_var] = base_url

    # ── 飞书配置 ──
    fs_result = await db.execute(select(FeishuConfig).limit(1))
    fs_cfg = fs_result.scalar_one_or_none()
    if fs_cfg:
        if fs_cfg.app_id:
            env["FEISHU_APP_ID"] = fs_cfg.app_id
        if fs_cfg.app_secret_encrypted:
            env["FEISHU_APP_SECRET"] = decrypt_secret(
                fs_cfg.app_secret_encrypted, settings.feishu_secret_key
            )
        if fs_cfg.webhook_url:
            env["FEISHU_WEBHOOK_URL"] = fs_cfg.webhook_url
        if fs_cfg.default_chat_id:
            env["FEISHU_CHAT_ID"] = fs_cfg.default_chat_id
    else:
        # 回退到环境变量
        if settings.feishu_app_id:
            env["FEISHU_APP_ID"] = settings.feishu_app_id
        if settings.feishu_app_secret:
            env["FEISHU_APP_SECRET"] = settings.feishu_app_secret
        if settings.feishu_webhook_url:
            env["FEISHU_WEBHOOK_URL"] = settings.feishu_webhook_url
        if settings.feishu_default_chat_id:
            env["FEISHU_CHAT_ID"] = settings.feishu_default_chat_id

    # ── Embedding ──
    if settings.embedding_api_key:
        env["EMBEDDING_API_KEY"] = settings.embedding_api_key
    if settings.embedding_api_base:
        env["EMBEDDING_API_BASE"] = settings.embedding_api_base

    return env


async def prepare_script_env(
    db: AsyncSession, script_content: str
) -> EnvResolveResult:
    """一站式预处理：解析环境变量 + 检测硬编码密钥"""
    warnings = detect_hardcoded_secrets(script_content)
    env_vars = await resolve_env_vars(db)
    return EnvResolveResult(env_vars=env_vars, warnings=warnings)
