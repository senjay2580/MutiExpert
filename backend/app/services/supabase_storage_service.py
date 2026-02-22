"""Supabase Storage 服务 — 文件/图片公开托管"""
from __future__ import annotations

import logging
import mimetypes
import uuid
from dataclasses import dataclass
from pathlib import Path

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


@dataclass
class StorageResult:
    success: bool
    url: str = ""           # 公开访问 URL
    key: str = ""           # object path（用于删除）
    filename: str = ""
    size: int = 0
    mime_type: str = ""
    error: str = ""


def _base_url() -> str:
    return get_settings().supabase_url.rstrip("/")


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {get_settings().supabase_service_key}",
    }


def _bucket() -> str:
    return get_settings().supabase_bucket


def is_configured() -> bool:
    s = get_settings()
    return bool(s.supabase_url and s.supabase_service_key)

def _make_key(filename: str, prefix: str = "chat") -> str:
    """生成唯一 object key: prefix/uuid8_filename"""
    short_id = uuid.uuid4().hex[:8]
    safe_name = Path(filename).name
    return f"{prefix}/{short_id}_{safe_name}"


def public_url(key: str) -> str:
    """拼接公开访问 URL。"""
    return f"{_base_url()}/storage/v1/object/public/{_bucket()}/{key}"


async def upload_bytes(
    file_bytes: bytes,
    filename: str,
    mime_type: str = "",
    prefix: str = "chat",
) -> StorageResult:
    """上传字节内容到 Supabase Storage，返回公开 URL。"""
    if not is_configured():
        return StorageResult(success=False, error="Supabase Storage 未配置")

    if not mime_type:
        mime_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"

    key = _make_key(filename, prefix)
    url = f"{_base_url()}/storage/v1/object/{_bucket()}/{key}"

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
            resp = await client.post(
                url,
                headers={**_headers(), "Content-Type": mime_type},
                content=file_bytes,
            )
            if resp.status_code in (200, 201):
                pub = public_url(key)
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
    """上传本地文件到 Supabase Storage。"""
    p = Path(file_path)
    if not p.exists() or not p.is_file():
        return StorageResult(success=False, error=f"文件不存在: {file_path}")
    mime_type = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
    return await upload_bytes(p.read_bytes(), p.name, mime_type, prefix)


async def list_objects(prefix: str = "", limit: int = 100, offset: int = 0) -> list[dict] | StorageResult:
    """列出 bucket 中的文件。"""
    if not is_configured():
        return StorageResult(success=False, error="Supabase Storage 未配置")

    url = f"{_base_url()}/storage/v1/object/list/{_bucket()}"
    body = {"prefix": prefix, "limit": limit, "offset": offset}

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
            resp = await client.post(url, headers=_headers(), json=body)
            if resp.status_code == 200:
                return resp.json()
            return StorageResult(success=False, error=f"HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        return StorageResult(success=False, error=str(e))


async def delete_objects(keys: list[str]) -> StorageResult:
    """批量删除文件。"""
    if not is_configured():
        return StorageResult(success=False, error="Supabase Storage 未配置")

    url = f"{_base_url()}/storage/v1/object/{_bucket()}"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
            resp = await client.request("DELETE", url, headers=_headers(), json={"prefixes": keys})
            if resp.status_code == 200:
                return StorageResult(success=True)
            return StorageResult(success=False, error=f"HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        return StorageResult(success=False, error=str(e))


async def test_connection() -> StorageResult:
    """测试连通性：上传→读取→删除。"""
    if not is_configured():
        return StorageResult(success=False, error="请设置 SUPABASE_URL 和 SUPABASE_SERVICE_KEY")

    result = await upload_bytes(b"connectivity test", "_test.txt", "text/plain", "_test")
    if not result.success:
        return result

    await delete_objects([result.key])
    return StorageResult(success=True, url=result.url, filename="_test.txt")
