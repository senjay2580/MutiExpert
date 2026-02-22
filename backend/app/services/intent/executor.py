"""ActionExecutor — 根据 IntentResult 调用内部 API 并返回格式化结果"""
from __future__ import annotations

import json
from typing import Any
import httpx
from app.config import get_settings
from app.services.intent.router import IntentResult


async def execute_action(intent: IntentResult) -> dict[str, Any]:
    """执行 tool_call 对应的内部 API，返回结构化结果"""
    settings = get_settings()
    base = settings.backend_url.rstrip("/")
    url = f"{base}{intent.endpoint}"

    headers: dict[str, str] = {"content-type": "application/json"}
    if settings.api_key:
        headers["x-api-key"] = settings.api_key

    # 根据 param_mapping 构建请求参数
    query_params: dict[str, Any] = {}
    body_params: dict[str, Any] = {}
    path_replacements: dict[str, str] = {}

    mapping = intent.param_mapping or {}
    args = intent.tool_args or {}

    for arg_name, arg_value in args.items():
        target = mapping.get(arg_name, f"query.{arg_name}")
        if target.startswith("query."):
            query_params[target[6:]] = arg_value
        elif target.startswith("body."):
            body_params[target[5:]] = arg_value
        elif target.startswith("path."):
            path_replacements[target[5:]] = str(arg_value)
        else:
            query_params[arg_name] = arg_value

    # 替换路径参数 e.g. /api/v1/todos/{id}
    final_url = url
    for key, val in path_replacements.items():
        final_url = final_url.replace(f"{{{key}}}", val)

    timeout = httpx.Timeout(15.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        method = intent.method.upper()
        if method == "GET":
            resp = await client.get(final_url, headers=headers, params=query_params)
        elif method == "POST":
            resp = await client.post(final_url, headers=headers, json=body_params, params=query_params)
        elif method == "PUT":
            resp = await client.put(final_url, headers=headers, json=body_params, params=query_params)
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


def format_result(result: dict[str, Any]) -> str:
    """将 API 返回结果格式化为可读文本"""
    if not result.get("success"):
        status = result.get("status_code", "?")
        data = result.get("data", "未知错误")
        # 尝试从 data 中提取更有用的错误信息
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
        # sandbox 风格响应：直接提取 output 字段，让 LLM 看到干净的结果
        # 但如果包含 file 字段（如 sandbox_send_file），保留完整 JSON 供下游解析
        if "output" in data and "timed_out" in data:
            if "file" in data:
                # send_file: 保留完整 JSON（下游 _extract_send_file_info 需要解析 file 字段）
                return json.dumps(data, ensure_ascii=False, indent=2)
            if data.get("success", True):
                return data["output"] if data["output"] else "(空结果)"
            else:
                return f"操作失败: {data.get('error', '未知错误')}"
        if "message" in data:
            return str(data["message"])
        return json.dumps(data, ensure_ascii=False, indent=2)

    return str(data)
