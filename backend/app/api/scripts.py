"""用户脚本 + Bot Tools CRUD API"""
from __future__ import annotations

import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.extras import UserScript
from app.services.script_executor import execute_script
from app.services.script_env_resolver import (
    prepare_script_env,
    detect_hardcoded_secrets,
    ENV_VAR_REGISTRY,
)

router = APIRouter()


# ── UserScript schemas ──

class ScriptParameter(BaseModel):
    """脚本参数定义。脚本内通过 `SCRIPT_<NAME>` 环境变量或 `{{name}}` 占位符取值。"""
    name: str
    type: str = "string"  # string | integer | number | boolean | enum
    description: str | None = None
    required: bool = False
    default: object | None = None
    options: list[str] | None = None  # enum 类型时的可选值


class ScriptCreate(BaseModel):
    name: str
    description: str | None = None
    script_content: str
    script_type: str = "typescript"
    parameters: list[ScriptParameter] = []
    expose_as_tool: bool = False

class ScriptUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    script_content: str | None = None
    enabled: bool | None = None
    parameters: list[ScriptParameter] | None = None
    expose_as_tool: bool | None = None


class ScriptTestBody(BaseModel):
    """测试脚本时的运行时参数（可选）：

    - **params** (推荐, v2): 命名参数 dict，对应脚本 parameters 定义。
      后端会自动注入为 `SCRIPT_<NAME>` 环境变量，同时替换脚本里的 `{{name}}` 占位符。
    - **args**: 命令行参数列表，脚本里用 argparse / sys.argv 读取。
    - **env**: 原始环境变量 dict（兼容旧用法），优先级最高。
    """
    params: dict[str, object] | None = None
    args: list[str] | None = None
    env: dict[str, str] | None = None


# ── UserScript endpoints ──

@router.get("/env-vars/available")
async def list_available_env_vars():
    """返回脚本中可用的系统环境变量列表"""
    return ENV_VAR_REGISTRY


@router.get("/")
async def list_scripts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserScript).order_by(UserScript.created_at.desc()))
    return [_script_to_dict(s) for s in result.scalars().all()]


@router.post("/")
async def create_script(data: ScriptCreate, db: AsyncSession = Depends(get_db)):
    warnings = detect_hardcoded_secrets(data.script_content)
    script = UserScript(
        name=data.name,
        description=data.description,
        script_content=data.script_content,
        script_type=data.script_type,
        parameters=[p.model_dump(exclude_none=True) for p in data.parameters],
        expose_as_tool=data.expose_as_tool,
    )
    db.add(script)
    await db.commit()
    await db.refresh(script)
    result = _script_to_dict(script)
    if warnings:
        result["warnings"] = warnings
    return result


@router.get("/{script_id}")
async def get_script(script_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    script = await _get_script_or_404(script_id, db)
    return _script_to_dict(script)


@router.put("/{script_id}")
async def update_script(script_id: uuid.UUID, data: ScriptUpdate, db: AsyncSession = Depends(get_db)):
    script = await _get_script_or_404(script_id, db)
    if data.name is not None:
        script.name = data.name
    if data.description is not None:
        script.description = data.description
    if data.script_content is not None:
        script.script_content = data.script_content
    if data.enabled is not None:
        script.enabled = data.enabled
    if data.parameters is not None:
        script.parameters = [p.model_dump(exclude_none=True) for p in data.parameters]
    if data.expose_as_tool is not None:
        script.expose_as_tool = data.expose_as_tool
    script.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(script)
    result = _script_to_dict(script)
    if data.script_content is not None:
        warnings = detect_hardcoded_secrets(data.script_content)
        if warnings:
            result["warnings"] = warnings
    return result


@router.delete("/{script_id}")
async def delete_script(script_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    script = await _get_script_or_404(script_id, db)
    await db.delete(script)
    await db.commit()
    return {"message": "已删除"}


@router.post("/{script_id}/test")
async def test_script(
    script_id: uuid.UUID,
    body: ScriptTestBody = ScriptTestBody(),  # 默认空对象，OpenAPI 直接生成 ScriptTestBody schema 不走 anyOf（避免 BotTool 解析丢字段）
    timeout: int = 600,
    db: AsyncSession = Depends(get_db),
):
    """测试运行用户脚本。

    - **timeout** (query 参数, 秒): 默认 600（10 分钟，兼顾长任务），最大 900。
      想跑超长任务（30 分钟视频转录）传 timeout=900。
    - **env** (body 字段): 注入到脚本进程的环境变量字典，脚本用 `os.environ.get("键")`
      读取。例如 B站视频转录脚本可传 `{"env": {"BILIBILI_URL": "https://..."}}` 切换视频。
    """
    script = await _get_script_or_404(script_id, db)
    timeout = max(1, min(timeout, 900))
    env_result = await prepare_script_env(db, script.script_content)
    # 合并系统注入的 env + 调用方传入的运行时 env（运行时优先级更高）
    merged_env = dict(env_result.env_vars)
    if body.env:
        merged_env.update(body.env)
    extra_args = body.args if body.args else None
    result = await execute_script(
        script.script_content,
        timeout_seconds=timeout,
        script_type=script.script_type or "typescript",
        extra_env=merged_env,
        extra_args=extra_args,
        params=body.params,
        parameters_schema=script.parameters or [],
    )
    script.last_test_at = datetime.utcnow()
    script.last_test_status = "success" if result.success else "failed"
    script.last_test_output = (result.output or result.error)[:5000]
    await db.commit()
    return {
        "success": result.success,
        "output": result.output,
        "error": result.error,
        "timed_out": result.timed_out,
        "warnings": env_result.warnings,
    }


async def _get_script_or_404(script_id: uuid.UUID, db: AsyncSession) -> UserScript:
    result = await db.execute(select(UserScript).where(UserScript.id == script_id))
    script = result.scalar_one_or_none()
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
    return script


def _script_to_dict(s: UserScript) -> dict:
    return {
        "id": str(s.id),
        "name": s.name,
        "description": s.description,
        "script_content": s.script_content,
        "script_type": s.script_type,
        "parameters": s.parameters or [],
        "expose_as_tool": s.expose_as_tool,
        "created_by": s.created_by,
        "last_test_at": s.last_test_at.isoformat() if s.last_test_at else None,
        "last_test_status": s.last_test_status,
        "last_test_output": s.last_test_output,
        "enabled": s.enabled,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }
