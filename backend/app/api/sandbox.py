"""Sandbox API — Shell / File / Web / Python / Search 沙箱执行端点"""
from __future__ import annotations

import mimetypes
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.services.sandbox_service import (
    execute_shell,
    read_file,
    write_file,
    list_files,
    delete_file,
    fetch_url,
    execute_python,
    _safe_path,
)
from app.database import get_db

router = APIRouter()


class ShellRequest(BaseModel):
    command: str
    timeout: int = 30
    cwd: str | None = None


class FileSendRequest(BaseModel):
    path: str


class FileWriteRequest(BaseModel):
    path: str
    content: str


class FetchRequest(BaseModel):
    url: str
    mode: str = "auto"  # auto / jina / raw


class PythonRequest(BaseModel):
    code: str
    timeout: int = 30


class SearchRequest(BaseModel):
    query: str
    max_results: int = 5


def _to_response(result):
    return {
        "success": result.success,
        "output": result.output,
        "error": result.error,
        "timed_out": result.timed_out,
    }


@router.post("/shell", summary="执行 Shell 命令")
async def api_shell(req: ShellRequest):
    try:
        result = await execute_shell(req.command, req.timeout, req.cwd)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _to_response(result)


@router.get("/files", summary="列出工作区文件")
async def api_list_files(path: str = "."):
    result = await list_files(path)
    return _to_response(result)


@router.get("/files/read", summary="读取文件内容")
async def api_read_file(path: str):
    result = await read_file(path)
    return _to_response(result)


@router.post("/files/write", summary="写入文件")
async def api_write_file(req: FileWriteRequest):
    result = await write_file(req.path, req.content)
    return _to_response(result)


@router.delete("/files/delete", summary="删除文件")
async def api_delete_file(path: str):
    result = await delete_file(path)
    return _to_response(result)


@router.post("/web/fetch", summary="抓取网页内容（智能提取）")
async def api_fetch_url(req: FetchRequest):
    result = await fetch_url(req.url, mode=req.mode)
    return _to_response(result)


@router.post("/web/search", summary="网络搜索")
async def api_web_search(req: SearchRequest, db: AsyncSession = Depends(get_db)):
    from app.services.web_search_service import tavily_search
    try:
        results = await tavily_search(req.query, db=db, max_results=req.max_results)
        if not results:
            return {"success": True, "output": "未找到相关结果", "error": "", "timed_out": False}
        lines = []
        for i, r in enumerate(results, 1):
            lines.append(f"[{i}] {r['title']}")
            lines.append(f"    {r['url']}")
            lines.append(f"    {r['content'][:300]}\n")
        return {"success": True, "output": "\n".join(lines), "error": "", "timed_out": False}
    except Exception as e:
        return {"success": False, "output": "", "error": str(e), "timed_out": False}


@router.post("/python", summary="执行 Python 代码")
async def api_python(req: PythonRequest):
    result = await execute_python(req.code, req.timeout)
    return _to_response(result)


@router.post("/files/send", summary="发送工作区文件到对话（可下载）")
async def api_send_file(req: FileSendRequest):
    """验证文件存在并返回元数据 + 下载链接，供 AI 将文件发送到对话中。"""
    try:
        target = _safe_path(req.path)
    except ValueError as e:
        return {"success": False, "output": "", "error": str(e), "timed_out": False}

    p = Path(target)
    if not p.exists() or not p.is_file():
        return {"success": False, "output": "", "error": f"文件不存在: {req.path}", "timed_out": False}

    rel_path = req.path.replace("\\", "/")
    mime = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
    size = p.stat().st_size
    download_url = f"/api/v1/sandbox/files/download?path={rel_path}"

    return {
        "success": True,
        "output": f"已发送文件: {p.name} ({size} bytes)",
        "error": "",
        "timed_out": False,
        "file": {
            "filename": p.name,
            "path": rel_path,
            "size": size,
            "mime_type": mime,
            "url": download_url,
        },
    }


@router.post("/files/upload", summary="上传文件到工作区")
async def api_upload_file(
    file: UploadFile = File(...),
    path: str = Query("", description="工作区内子目录，默认根目录"),
):
    settings = get_settings()
    # 读取文件内容并校验大小
    content = await file.read()
    if len(content) > settings.max_upload_size:
        raise HTTPException(status_code=413, detail=f"文件超过 {settings.max_upload_size // 1048576}MB 限制")

    filename = file.filename or "unnamed"
    # 安全路径
    try:
        sub = os.path.join(path, filename) if path else filename
        target = _safe_path(sub)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 写入
    p = Path(target)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(content)

    rel_path = sub.replace("\\", "/")
    mime = file.content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    return {
        "filename": filename,
        "path": rel_path,
        "size": len(content),
        "mime_type": mime,
        "url": f"/api/v1/sandbox/files/download?path={rel_path}",
    }


@router.get("/files/download", summary="下载工作区文件")
async def api_download_file(
    path: str = Query(..., description="工作区内文件路径"),
    inline: bool = Query(False, description="是否内联预览"),
):
    try:
        target = _safe_path(path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    p = Path(target)
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail="文件不存在")

    mime = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
    disposition = "inline" if inline else "attachment"
    return FileResponse(
        path=str(p),
        media_type=mime,
        filename=p.name,
        content_disposition_type=disposition,
    )


@router.post("/files/image-host", summary="上传图片到 sm.ms 图床")
async def api_upload_to_image_host(file: UploadFile = File(...)):
    """上传图片到 sm.ms 免费图床，返回公开 URL。"""
    content = await file.read()
    filename = file.filename or "image.png"
    mime = file.content_type or mimetypes.guess_type(filename)[0] or "image/png"

    from app.services.image_hosting_service import upload_to_smms
    result = await upload_to_smms(content, filename, mime)

    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)

    return {
        "url": result.url,
        "delete_url": result.delete_url,
        "filename": result.filename,
        "size": result.size,
        "mime_type": result.mime_type,
    }
