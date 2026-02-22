"""图床上传服务 — sm.ms 免费图床（备用）"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

SMMS_UPLOAD_URL = "https://sm.ms/api/v2/upload"


@dataclass
class UploadResult:
    success: bool
    url: str = ""
    delete_url: str = ""
    filename: str = ""
    size: int = 0
    mime_type: str = ""
    error: str = ""


async def upload_to_smms(
    file_bytes: bytes,
    filename: str,
    mime_type: str = "image/png",
) -> UploadResult:
    """上传文件到 sm.ms 图床，返回公开 URL。"""
    if len(file_bytes) > 5 * 1024 * 1024:
        return UploadResult(success=False, error="文件超过 5MB 限制")

    try:
        timeout = httpx.Timeout(30.0, read=60.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                SMMS_UPLOAD_URL,
                files={"smfile": (filename, file_bytes, mime_type)},
                headers={"User-Agent": "MutiExpert/1.0"},
            )
            data = resp.json()

            if data.get("success"):
                d = data["data"]
                return UploadResult(
                    success=True,
                    url=d.get("url", ""),
                    delete_url=d.get("delete", ""),
                    filename=d.get("filename", filename),
                    size=d.get("size", len(file_bytes)),
                    mime_type=mime_type,
                )
            elif data.get("code") == "image_repeated":
                return UploadResult(
                    success=True,
                    url=data.get("images", ""),
                    filename=filename,
                    size=len(file_bytes),
                    mime_type=mime_type,
                )
            else:
                return UploadResult(
                    success=False,
                    error=data.get("message", "上传失败"),
                )
    except Exception as e:
        logger.error("sm.ms upload failed: %s", e)
        return UploadResult(success=False, error=str(e))
