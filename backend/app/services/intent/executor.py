"""ActionExecutor — 根据 IntentResult 调用内部 API 或外部服务并返回格式化结果"""
from __future__ import annotations

import base64
import json
from typing import Any
import httpx
from app.config import get_settings
from app.services.intent.router import IntentResult


def _apply_auth(headers: dict[str, str], query_params: dict[str, Any], service) -> None:
    """根据 ExternalService 配置注入认证信息"""
    auth = service.auth_config or {}
    match service.auth_type:
        case "bearer":
            headers["Authorization"] = f"Bearer {auth.get('token', '')}"
        case "apikey_header":
            header_name = auth.get("header_name", "apikey")
            headers[header_name] = auth.get("value", "")
        case "apikey_query":
            query_params[auth.get("param_name", "apikey")] = auth.get("value", "")
        case "basic":
            cred = base64.b64encode(
                f"{auth.get('username', '')}:{auth.get('password', '')}".encode()
            ).decode()
            headers["Authorization"] = f"Basic {cred}"


async def execute_action(intent: IntentResult) -> dict[str, Any]:
    """执行 tool_call：内部 API 或外部服务"""
    query_params: dict[str, Any] = {}
    body_params: dict[str, Any] = {}
    path_replacements: dict[str, str] = {}

    # ── 解析 base URL 和认证 ──
    if intent.service_id:
        from app.database import AsyncSessionLocal
        from app.models.extras import ExternalService
        from sqlalchemy import select
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(ExternalService).where(ExternalService.id == intent.service_id)
            )
            service = result.scalar_one_or_none()
        if not service:
            return {"success": False, "error": f"外部服务未找到: {intent.service_id}", "tool_name": intent.tool_name}

        base = service.base_url.rstrip("/")
        url = f"{base}{intent.endpoint}"
        headers: dict[str, str] = dict(service.default_headers or {})
        headers.setdefault("content-type", "application/json")
        _apply_auth(headers, query_params, service)
    else:
        settings = get_settings()
        base = settings.backend_url.rstrip("/")
        url = f"{base}{intent.endpoint}"
        headers = {"content-type": "application/json"}
        if settings.api_key:
            headers["x-api-key"] = settings.api_key

    # ── 根据 param_mapping 构建请求参数 ──
    mapping = intent.param_mapping or {}
    args = intent.tool_args or {}

    dynamic_key: str | None = None
    dynamic_val: str | None = None

    for arg_name, arg_value in args.items():
        target = mapping.get(arg_name, f"query.{arg_name}")
        if target == "body":
            # 整体映射：将参数值直接作为 request body（用于 PostgREST insert 等）
            if isinstance(arg_value, (dict, list)):
                body_params = arg_value
        elif target.startswith("body."):
            body_params[target[5:]] = arg_value
        elif target.startswith("query."):
            query_params[target[6:]] = arg_value
        elif target.startswith("path."):
            path_replacements[target[5:]] = str(arg_value)
        elif target == "query_key":
            dynamic_key = str(arg_value)
        elif target == "query_value":
            dynamic_val = str(arg_value)
        else:
            query_params[arg_name] = arg_value

    # 动态查询参数（PostgREST 过滤: ?column=eq.value）
    if dynamic_key and dynamic_val:
        query_params[dynamic_key] = dynamic_val

    # 替换路径参数 e.g. /api/v1/todos/{id}
    final_url = url
    for key, val in path_replacements.items():
        final_url = final_url.replace(f"{{{key}}}", val)

    timeout = httpx.Timeout(30.0 if intent.service_id else 15.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        method = intent.method.upper()
        if method == "GET":
            resp = await client.get(final_url, headers=headers, params=query_params)
        elif method == "POST":
            resp = await client.post(final_url, headers=headers, json=body_params, params=query_params)
        elif method == "PUT":
            resp = await client.put(final_url, headers=headers, json=body_params, params=query_params)
        elif method == "PATCH":
            resp = await client.patch(final_url, headers=headers, json=body_params, params=query_params)
        elif method == "DELETE":
            resp = await client.delete(final_url, headers=headers, params=query_params)
        else:
            return {"success": False, "error": f"Unsupported method: {method}"}

        try:
            data = resp.json()
        except Exception:
            data = resp.text

        return {
            "success": 200 <= resp.status_code < 400,
            "status_code": resp.status_code,
            "data": data,
            "tool_name": intent.tool_name,
        }


async def execute_supabase_sql(
    args: dict[str, Any], tool_def: dict[str, Any], db,
) -> dict[str, Any]:
    """专用路径：直接调 Supabase Management API 执行 SQL"""
    from sqlalchemy import select
    from app.models.extras import ExternalService

    query = args.get("query", "")
    if not query:
        return {"success": False, "error": "缺少 query 参数", "tool_name": "supabase_sql"}

    service_id = tool_def.get("service_id")
    if not service_id:
        return {"success": False, "error": "supabase_mgmt 服务未配置", "tool_name": "supabase_sql"}

    result = await db.execute(
        select(ExternalService).where(ExternalService.id == service_id)
    )
    service = result.scalar_one_or_none()
    if not service:
        return {"success": False, "error": "supabase_mgmt 服务未找到", "tool_name": "supabase_sql"}

    token = (service.auth_config or {}).get("token", "")
    endpoint = tool_def.get("endpoint", "")
    url = f"{service.base_url.rstrip('/')}{endpoint}"

    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
        resp = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={"query": query},
        )
        try:
            data = resp.json()
        except Exception:
            data = resp.text

        return {
            "success": 200 <= resp.status_code < 400,
            "status_code": resp.status_code,
            "data": data,
            "tool_name": "supabase_sql",
        }


def format_result(result: dict[str, Any]) -> str:
    """将 API 返回结果格式化为可读文本"""
    if not result.get("success"):
        status = result.get("status_code", "?")
        data = result.get("data", "未知错误")
        if isinstance(data, dict):
            detail = data.get("detail") or data.get("error") or data.get("message")
            if detail:
                return f"操作失败 (HTTP {status}): {detail}"
        return f"操作失败 (HTTP {status}): {data}"

    data = result.get("data")

    # 列表类结果
    if isinstance(data, list):
        if not data:
            return "查询结果为空。"
        lines = []
        for i, item in enumerate(data[:20], 1):
            if isinstance(item, dict):
                name = item.get("name") or item.get("title") or item.get("id", "")
                status = item.get("status") or item.get("enabled")
                if status is not None:
                    lines.append(f"{i}. {name} [{status}]")
                else:
                    lines.append(f"{i}. {name}")
            else:
                lines.append(f"{i}. {item}")
        header = f"共 {len(data)} 条结果"
        if len(data) > 20:
            header += "（显示前 20 条）"
        return f"{header}:\n" + "\n".join(lines)

    # 单对象结果
    if isinstance(data, dict):
        if "output" in data and "timed_out" in data:
            if "file" in data:
                return json.dumps(data, ensure_ascii=False, indent=2)
            if data.get("success", True):
                return data["output"] if data["output"] else "(空结果)"
            else:
                return f"操作失败: {data.get('error', '未知错误')}"
        if "message" in data:
            return str(data["message"])
        return json.dumps(data, ensure_ascii=False, indent=2)

    return str(data)
