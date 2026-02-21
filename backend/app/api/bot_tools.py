"""Bot Tools API — 自动从 OpenAPI schema 同步接口定义，用户只控制开关"""
from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.extras import BotTool

logger = logging.getLogger(__name__)
router = APIRouter()

EXCLUDED_PREFIXES = ("/api/v1/bot-tools", "/api/v1/health", "/api/v1/config")
MUTATION_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


# ── 辅助函数 ─────────────────────────────────────────────────

class BulkEnableRequest(BaseModel):
    ids: list[uuid.UUID] = []
    enabled: bool = True


def _resolve_ref(schema: dict, ref: str) -> dict:
    """解析 $ref 引用，如 #/components/schemas/Foo"""
    parts = ref.lstrip("#/").split("/")
    node = schema
    for p in parts:
        node = node.get(p, {})
    return node


def _extract_parameters(openapi: dict, path: str, method: str) -> dict:
    """从 OpenAPI schema 提取端点的参数定义，转为 function calling JSON Schema。"""
    props: dict = {}
    required: list[str] = []
    method_lower = method.lower()
    path_obj = openapi.get("paths", {}).get(path, {})
    op = path_obj.get(method_lower, {})
    if not op:
        return {"type": "object", "properties": {}}

    # 1. path / query parameters
    for param in op.get("parameters", []):
        name = param.get("name", "")
        p_schema = param.get("schema", {})
        if "$ref" in p_schema:
            p_schema = _resolve_ref(openapi, p_schema["$ref"])
        prop: dict = {"type": p_schema.get("type", "string")}
        desc = param.get("description") or p_schema.get("title")
        if desc:
            prop["description"] = desc
        if "enum" in p_schema:
            prop["enum"] = p_schema["enum"]
        props[name] = prop
        if param.get("required"):
            required.append(name)

    # 2. requestBody (JSON)
    body = op.get("requestBody", {})
    body_schema = (
        body.get("content", {}).get("application/json", {}).get("schema", {})
    )
    if "$ref" in body_schema:
        body_schema = _resolve_ref(openapi, body_schema["$ref"])
    if body_schema.get("properties"):
        for name, p_schema in body_schema["properties"].items():
            if "$ref" in p_schema:
                p_schema = _resolve_ref(openapi, p_schema["$ref"])
            prop = {"type": p_schema.get("type", "string")}
            desc = p_schema.get("description") or p_schema.get("title")
            if desc:
                prop["description"] = desc
            if "enum" in p_schema:
                prop["enum"] = p_schema["enum"]
            if "default" in p_schema:
                prop["default"] = p_schema["default"]
            props[name] = prop
        for r in body_schema.get("required", []):
            if r not in required:
                required.append(r)

    result: dict = {"type": "object", "properties": props}
    if required:
        result["required"] = required
    return result


def _path_to_tool_name(method: str, path: str) -> str:
    """从 method + path 生成 snake_case 工具名。"""
    clean = path.replace("/api/v1/", "").strip("/")
    clean = re.sub(r"\{[^}]+\}", "by_id", clean)
    clean = re.sub(r"[^a-zA-Z0-9]+", "_", clean).strip("_")
    prefix_map = {"GET": "get", "POST": "create", "PUT": "update", "PATCH": "patch", "DELETE": "delete"}
    prefix = prefix_map.get(method, method.lower())
    return f"{prefix}_{clean}"


def _build_param_mapping(openapi: dict, path: str, method: str) -> dict:
    """自动生成 param_mapping：参数名 → query.x / path.x / body.x"""
    mapping: dict = {}
    method_lower = method.lower()
    path_obj = openapi.get("paths", {}).get(path, {})
    op = path_obj.get(method_lower, {})
    if not op:
        return mapping
    for param in op.get("parameters", []):
        name = param.get("name", "")
        location = param.get("in", "query")
        mapping[name] = f"{location}.{name}"
    body = op.get("requestBody", {})
    body_schema = body.get("content", {}).get("application/json", {}).get("schema", {})
    if "$ref" in body_schema:
        body_schema = _resolve_ref(openapi, body_schema["$ref"])
    for name in body_schema.get("properties", {}):
        if name not in mapping:
            mapping[name] = f"body.{name}"
    return mapping


def _tool_to_dict(t: BotTool) -> dict:
    return {
        "id": str(t.id),
        "name": t.name,
        "description": t.description,
        "action_type": t.action_type,
        "endpoint": t.endpoint,
        "method": t.method,
        "param_mapping": t.param_mapping,
        "parameters": t.parameters,
        "enabled": t.enabled,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


# ── API 端点 ─────────────────────────────────────────────────

@router.get("/")
async def list_tools(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BotTool).order_by(BotTool.name))
    return [_tool_to_dict(t) for t in result.scalars().all()]


@router.post("/{tool_id}/toggle")
async def toggle_tool(tool_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BotTool).where(BotTool.id == tool_id))
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    tool.enabled = not tool.enabled
    tool.updated_at = datetime.utcnow()
    await db.commit()
    return {"enabled": tool.enabled}


@router.post("/bulk-enable")
async def bulk_enable(data: BulkEnableRequest, db: AsyncSession = Depends(get_db)):
    """批量启用/禁用工具"""
    if not data.ids:
        return {"updated": 0}
    result = await db.execute(
        select(BotTool).where(BotTool.id.in_(data.ids))
    )
    count = 0
    for tool in result.scalars().all():
        if tool.enabled != data.enabled:
            tool.enabled = data.enabled
            tool.updated_at = datetime.utcnow()
            count += 1
    await db.commit()
    return {"updated": count}


@router.post("/sync")
async def sync_tools(request: Request, db: AsyncSession = Depends(get_db)):
    """从 OpenAPI schema 自动扫描所有业务端点，同步到 BotTool 表。

    - 新发现的端点 → 创建（默认 disabled）
    - 已存在的端点 → 更新签名（保留 enabled 状态）
    - 已消失的端点 → 标记 disabled
    """
    openapi = request.app.openapi()
    paths = openapi.get("paths", {})

    # 收集所有有效端点
    discovered: dict[str, dict] = {}  # key = "METHOD /path"
    for path, path_obj in paths.items():
        if any(path.startswith(p) for p in EXCLUDED_PREFIXES):
            continue
        if not path.startswith("/api/v1/"):
            continue
        for method_lower, op in path_obj.items():
            if method_lower in ("parameters", "servers", "summary", "description"):
                continue
            method = method_lower.upper()
            if method in ("HEAD", "OPTIONS"):
                continue
            key = f"{method} {path}"
            summary = op.get("summary") or op.get("operationId", "").replace("_", " ").title()
            discovered[key] = {
                "name": _path_to_tool_name(method, path),
                "description": summary,
                "action_type": "mutation" if method in MUTATION_METHODS else "query",
                "endpoint": path,
                "method": method,
                "parameters": _extract_parameters(openapi, path, method),
                "param_mapping": _build_param_mapping(openapi, path, method),
            }

    # 加载现有工具（以 method+endpoint 为键）
    result = await db.execute(select(BotTool))
    existing: dict[str, BotTool] = {}
    for t in result.scalars().all():
        existing[f"{t.method} {t.endpoint}"] = t

    created = 0
    updated = 0
    removed = 0

    # upsert
    for key, info in discovered.items():
        if key in existing:
            tool = existing[key]
            tool.description = info["description"]
            tool.parameters = info["parameters"]
            tool.param_mapping = info["param_mapping"]
            tool.action_type = info["action_type"]
            tool.updated_at = datetime.utcnow()
            updated += 1
        else:
            tool = BotTool(
                name=info["name"],
                description=info["description"],
                action_type=info["action_type"],
                endpoint=info["endpoint"],
                method=info["method"],
                parameters=info["parameters"],
                param_mapping=info["param_mapping"],
                enabled=False,
            )
            db.add(tool)
            created += 1

    # 标记已消失的端点为 disabled
    for key, tool in existing.items():
        if key not in discovered and tool.enabled:
            tool.enabled = False
            tool.updated_at = datetime.utcnow()
            removed += 1

    await db.commit()
    return {"created": created, "updated": updated, "removed": removed, "total": len(discovered)}
