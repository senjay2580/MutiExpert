"""Supabase Storage 服务 — 文件/图片公开托管（DB 优先配置）"""
from __future__ import annotations

import logging
import mimetypes
import uuid
from dataclasses import dataclass
from pathlib import Path

import httpx
from sqlalchemy import select

from app.config import get_settings

logger = logging.getLogger(__name__)


@dataclass
class StorageResult:
    success: bool
    url: str = ""
    key: str = ""
    filename: str = ""
    size: int = 0
    mime_type: str = ""
    error: str = ""


@dataclass
class _SupabaseConfig:
    url: str
    service_key: str
    bucket: str


async def _get_config() -> _SupabaseConfig:
    """DB 优先，.env 回退。"""
    from app.database import AsyncSessionLocal
    from app.models.extras import SiteSetting

    url = ""
    key = ""
    bucket = ""
    try:
        if AsyncSessionLocal is None:
            raise RuntimeError("DB not ready")
        async with AsyncSessionLocal() as session:
            rows = await session.execute(
                select(SiteSetting).where(
                    SiteSetting.key.in_(("supabase_url", "supabase_service_key", "supabase_bucket"))
                )
            )
            for r in rows.scalars():
                if r.key == "supabase_url":
                    url = r.value
                elif r.key == "supabase_service_key":
                    key = r.value
                elif r.key == "supabase_bucket":
                    bucket = r.value
    except Exception:
        pass  # DB 不可用时 fallback .env

    s = get_settings()
    return _SupabaseConfig(
        url=(url or s.supabase_url).rstrip("/"),
        service_key=key or s.supabase_service_key,
        bucket=bucket or s.supabase_bucket or "public-files",
    )


async def is_configured() -> bool:
    cfg = await _get_config()
    return bool(cfg.url and cfg.service_key)


def _make_key(filename: str, prefix: str = "chat") -> str:
    short_id = uuid.uuid4().hex[:8]
    safe_name = Path(filename).name
    return f"{prefix}/{short_id}_{safe_name}"


def _public_url(cfg: _SupabaseConfig, key: str) -> str:
    return f"{cfg.url}/storage/v1/object/public/{cfg.bucket}/{key}"


async def upload_bytes(
    file_bytes: bytes,
    filename: str,
    mime_type: str = "",
    prefix: str = "chat",
) -> StorageResult:
    cfg = await _get_config()
    if not (cfg.url and cfg.service_key):
        return StorageResult(success=False, error="Supabase Storage 未配置")

    if not mime_type:
        mime_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"

    key = _make_key(filename, prefix)
    url = f"{cfg.url}/storage/v1/object/{cfg.bucket}/{key}"

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
            resp = await client.post(
                url,
                headers={"Authorization": f"Bearer {cfg.service_key}", "Content-Type": mime_type},
                content=file_bytes,
            )
            if resp.status_code in (200, 201):
                pub = _public_url(cfg, key)
                logger.info("Supabase upload ok: %s (%d bytes)", key, len(file_bytes))
                return StorageResult(
                    success=True, url=pub, key=key,
                    filename=filename, size=len(file_bytes), mime_type=mime_type,
                )
            return StorageResult(success=False, error=f"HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.error("Supabase upload error: %s", e)
        return StorageResult(success=False, error=str(e))


async def upload_file(file_path: str, prefix: str = "chat") -> StorageResult:
    p = Path(file_path)
    if not p.exists() or not p.is_file():
        return StorageResult(success=False, error=f"文件不存在: {file_path}")
    mime_type = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
    return await upload_bytes(p.read_bytes(), p.name, mime_type, prefix)


async def list_objects(prefix: str = "", limit: int = 100, offset: int = 0) -> list[dict] | StorageResult:
    cfg = await _get_config()
    if not (cfg.url and cfg.service_key):
        return StorageResult(success=False, error="Supabase Storage 未配置")

    url = f"{cfg.url}/storage/v1/object/list/{cfg.bucket}"
    body = {"prefix": prefix, "limit": limit, "offset": offset}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
            resp = await client.post(
                url,
                headers={"Authorization": f"Bearer {cfg.service_key}"},
                json=body,
            )
            if resp.status_code == 200:
                return resp.json()
            return StorageResult(success=False, error=f"HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        return StorageResult(success=False, error=str(e))


async def delete_objects(keys: list[str]) -> StorageResult:
    cfg = await _get_config()
    if not (cfg.url and cfg.service_key):
        return StorageResult(success=False, error="Supabase Storage 未配置")

    url = f"{cfg.url}/storage/v1/object/{cfg.bucket}"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
            resp = await client.request(
                "DELETE", url,
                headers={"Authorization": f"Bearer {cfg.service_key}"},
                json={"prefixes": keys},
            )
            if resp.status_code == 200:
                return StorageResult(success=True)
            return StorageResult(success=False, error=f"HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        return StorageResult(success=False, error=str(e))


async def test_connection() -> StorageResult:
    cfg = await _get_config()
    if not (cfg.url and cfg.service_key):
        return StorageResult(success=False, error="请先配置 Supabase URL 和 Service Key")

    result = await upload_bytes(b"connectivity test", "_test.txt", "text/plain", "_test")
    if not result.success:
        return result
    await delete_objects([result.key])
    return StorageResult(success=True, url=result.url, filename="_test.txt")
