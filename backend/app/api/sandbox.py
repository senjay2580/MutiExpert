"""Sandbox API — Shell / File / Web / Python 沙箱执行端点"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.sandbox_service import (
    execute_shell,
    read_file,
    write_file,
    list_files,
    delete_file,
    fetch_url,
    execute_python,
)

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


class PythonRequest(BaseModel):
    code: str
    timeout: int = 30


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


@router.post("/web/fetch", summary="抓取网页内容")
async def api_fetch_url(req: FetchRequest):
    result = await fetch_url(req.url)
    return _to_response(result)


@router.post("/python", summary="执行 Python 代码")
async def api_python(req: PythonRequest):
    result = await execute_python(req.code, req.timeout)
    return _to_response(result)
