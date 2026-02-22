"""Sandbox API — Shell / File / Web / Python / Search 沙箱执行端点"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.sandbox_service import (
    execute_shell,
    read_file,
    write_file,
    list_files,
    delete_file,
    fetch_url,
    execute_python,
)
from app.db import get_db

router = APIRouter()


class ShellRequest(BaseModel):
    command: str
    timeout: int = 30
    cwd: str | None = None


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
