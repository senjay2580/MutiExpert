"""Bot Tools 初始化 — 预置工具定义，首次启动时写入数据库"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.extras import BotTool, ExternalService

DEFAULT_TOOLS = [
    {
        "name": "list_scheduled_tasks",
        "description": "查看定时任务列表。返回任务名称、cron 表达式、启用状态。无参数时返回全部任务。",
        "action_type": "query",
        "endpoint": "/api/v1/scheduled-tasks/",
        "method": "GET",
        "param_mapping": {},
        "parameters": {
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": ["all", "enabled", "disabled"], "description": "筛选状态，默认 all"},
            },
        },
    },
    {
        "name": "query_knowledge",
        "description": "按关键词搜索知识库内容。返回匹配的文档片段。用于回答需要知识库支撑的问题。",
        "action_type": "query",
        "endpoint": "/api/v1/knowledge-bases/",
        "method": "GET",
        "param_mapping": {},
        "parameters": {
            "type": "object",
            "properties": {
                "search": {"type": "string", "description": "搜索关键词"},
            },
        },
    },
    {
        "name": "list_todos",
        "description": "查看待办事项列表。返回所有待办的标题、优先级和状态。",
        "action_type": "query",
        "endpoint": "/api/v1/todos/",
        "method": "GET",
        "param_mapping": {},
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "create_todo",
        "description": "创建一条新的待办事项。必须提供标题，可选设置优先级。",
        "action_type": "mutation",
        "endpoint": "/api/v1/todos/",
        "method": "POST",
        "param_mapping": {"title": "body.title", "priority": "body.priority"},
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "待办标题"},
                "priority": {"type": "string", "enum": ["low", "medium", "high"], "description": "优先级，默认 medium"},
            },
            "required": ["title"],
        },
    },
    {
        "name": "list_knowledge_bases",
        "description": "查看所有知识库列表。返回知识库名称和所属行业。不需要参数。",
        "action_type": "query",
        "endpoint": "/api/v1/knowledge-bases/",
        "method": "GET",
        "param_mapping": {},
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "list_scripts",
        "description": "查看用户脚本列表。返回脚本名称、类型和描述。不需要参数。",
        "action_type": "query",
        "endpoint": "/api/v1/scripts/",
        "method": "GET",
        "param_mapping": {},
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "get_dashboard",
        "description": "获取系统仪表盘概览数据（知识库数量、文档数、任务数等）。不需要参数，调用一次即可。",
        "action_type": "query",
        "endpoint": "/api/v1/dashboard/stats",
        "method": "GET",
        "param_mapping": {},
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "switch_model",
        "description": "切换飞书机器人使用的 AI 模型。这是修改操作，切换后立即生效。",
        "action_type": "mutation",
        "endpoint": "/api/v1/feishu/config",
        "method": "PUT",
        "param_mapping": {"provider": "body.default_provider"},
        "parameters": {
            "type": "object",
            "properties": {
                "provider": {
                    "type": "string",
                    "enum": ["claude", "deepseek", "qwen", "openai"],
                    "description": "模型提供商",
                },
            },
            "required": ["provider"],
        },
    },
    # ── Sandbox tools ──
    {
        "name": "sandbox_shell",
        "description": "在沙箱中执行 Shell 命令。适用于 ls、grep、curl、git、wc 等操作。命令在 /app/workspace 目录下执行。执行前确认命令正确，避免重复执行相同命令。",
        "action_type": "mutation",
        "endpoint": "/api/v1/sandbox/shell",
        "method": "POST",
        "param_mapping": {"command": "body.command", "timeout": "body.timeout", "cwd": "body.cwd"},
        "parameters": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "要执行的 Shell 命令"},
                "timeout": {"type": "integer", "description": "超时秒数，默认30"},
                "cwd": {"type": "string", "description": "工作目录（相对于 workspace）"},
            },
            "required": ["command"],
        },
    },
    {
        "name": "sandbox_list_files",
        "description": "列出工作区目录的当前层级内容（不递归）。目录会显示子项数量。不传 path 列出根目录，传 path 查看子目录。像剥洋葱一样逐层浏览，不要一次性递归展开所有文件。",
        "action_type": "query",
        "endpoint": "/api/v1/sandbox/files",
        "method": "GET",
        "param_mapping": {"path": "query.path"},
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "目录路径（相对于 workspace），不传则列出根目录"},
            },
        },
    },
    {
        "name": "sandbox_read_file",
        "description": "读取工作区文件内容。支持多种文档格式：PDF、Word（docx）、Excel（xlsx）、PPT（pptx）、CSV 以及所有文本文件。自动识别格式并提取文本内容。",
        "action_type": "query",
        "endpoint": "/api/v1/sandbox/files/read",
        "method": "GET",
        "param_mapping": {"path": "query.path"},
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "文件路径（相对于 workspace）"},
            },
            "required": ["path"],
        },
    },
    {
        "name": "sandbox_write_file",
        "description": "在工作区创建或覆盖文件。必须提供路径和内容。如果文件已存在会被覆盖。",
        "action_type": "mutation",
        "endpoint": "/api/v1/sandbox/files/write",
        "method": "POST",
        "param_mapping": {"path": "body.path", "content": "body.content"},
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "文件路径（相对于 workspace）"},
                "content": {"type": "string", "description": "文件内容"},
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "sandbox_delete_file",
        "description": "删除工作区中的指定文件。这是不可逆操作，删除前应确认用户意图。",
        "action_type": "mutation",
        "endpoint": "/api/v1/sandbox/files/delete",
        "method": "DELETE",
        "param_mapping": {"path": "query.path"},
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "文件路径（相对于 workspace）"},
            },
            "required": ["path"],
        },
    },
    {
        "name": "sandbox_find_file",
        "description": "在工作区中按文件名快速搜索。当用户说「找xx文件」「xx文件在哪」时使用此工具，比 list_files 逐层浏览更快。支持通配符（*.pdf）和子串匹配（report）。",
        "action_type": "query",
        "endpoint": "/api/v1/sandbox/files/find",
        "method": "GET",
        "param_mapping": {"keyword": "query.keyword", "max_results": "query.max_results"},
        "parameters": {
            "type": "object",
            "properties": {
                "keyword": {"type": "string", "description": "文件名关键词或通配符模式（如 *.pdf、report、数据*.xlsx）"},
                "max_results": {"type": "integer", "description": "最大返回数量，默认30"},
            },
            "required": ["keyword"],
        },
    },
    {
        "name": "sandbox_send_file",
        "description": "将工作区文件发送到对话中供用户下载。必须先确认文件存在（用 sandbox_list_files 检查）。适用于交付生成的报告、处理结果等。",
        "action_type": "query",
        "endpoint": "/api/v1/sandbox/files/send",
        "method": "POST",
        "param_mapping": {"path": "body.path"},
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "文件路径（相对于 workspace）"},
            },
            "required": ["path"],
        },
    },
    {
        "name": "sandbox_fetch_url",
        "description": "抓取网页内容并提取正文。mode=auto 智能提取（默认，SPA 页面自动 fallback Jina），mode=jina 强制 JS 渲染返回 Markdown，mode=raw 返回原始 HTML。",
        "action_type": "query",
        "endpoint": "/api/v1/sandbox/web/fetch",
        "method": "POST",
        "param_mapping": {"url": "body.url", "mode": "body.mode"},
        "parameters": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "要抓取的完整 URL（含 https://）"},
                "mode": {"type": "string", "enum": ["auto", "jina", "raw"], "description": "抓取模式，默认 auto"},
            },
            "required": ["url"],
        },
    },
    {
        "name": "web_search",
        "description": "搜索互联网获取实时信息。返回网页标题、链接和摘要。适用于查询最新资讯、技术文档等知识库中没有的内容。",
        "action_type": "query",
        "endpoint": "/api/v1/sandbox/web/search",
        "method": "POST",
        "param_mapping": {"query": "body.query", "max_results": "body.max_results"},
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "搜索关键词，尽量具体"},
                "max_results": {"type": "integer", "description": "最大结果数，默认5，最大10"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "sandbox_python",
        "description": "在沙箱中执行 Python 代码。适用于数据处理、计算、文件转换、文本分析等。代码在 /app/workspace 目录下执行，可读写工作区文件。",
        "action_type": "mutation",
        "endpoint": "/api/v1/sandbox/python",
        "method": "POST",
        "param_mapping": {"code": "body.code", "timeout": "body.timeout"},
        "parameters": {
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "要执行的 Python 代码"},
                "timeout": {"type": "integer", "description": "超时秒数，默认30"},
            },
            "required": ["code"],
        },
    },
]


async def ensure_default_tools(db: AsyncSession) -> None:
    """确保默认工具存在，已有的更新定义（描述、参数等）。"""
    for tool_def in DEFAULT_TOOLS:
        result = await db.execute(
            select(BotTool).where(BotTool.name == tool_def["name"])
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.description = tool_def["description"]
            existing.action_type = tool_def["action_type"]
            existing.endpoint = tool_def["endpoint"]
            existing.method = tool_def["method"]
            existing.param_mapping = tool_def.get("param_mapping", {})
            existing.parameters = tool_def.get("parameters", {})
        else:
            db.add(BotTool(
                name=tool_def["name"],
                description=tool_def["description"],
                action_type=tool_def["action_type"],
                endpoint=tool_def["endpoint"],
                method=tool_def["method"],
                param_mapping=tool_def.get("param_mapping", {}),
                parameters=tool_def.get("parameters", {}),
            ))
    await db.commit()


# ── Supabase PostgREST 工具定义 ──

SUPABASE_TOOLS = [
    {
        "name": "supabase_query",
        "description": "查询 Supabase 数据库表。table_name 是表名，select 指定返回列（默认 *），order 排序（如 created_at.desc），limit 限制行数。可用于检查数据是否已存在。",
        "action_type": "query",
        "endpoint": "/{table_name}",
        "method": "GET",
        "param_mapping": {
            "table_name": "path.table_name",
            "select": "query.select",
            "order": "query.order",
            "limit": "query.limit",
            "offset": "query.offset",
        },
        "parameters": {
            "type": "object",
            "properties": {
                "table_name": {"type": "string", "description": "表名"},
                "select": {"type": "string", "description": "返回列，默认 *"},
                "order": {"type": "string", "description": "排序，如 created_at.desc"},
                "limit": {"type": "integer", "description": "返回行数限制"},
                "offset": {"type": "integer", "description": "偏移量"},
            },
            "required": ["table_name"],
        },
    },
    {
        "name": "supabase_insert",
        "description": "向 Supabase 数据库表插入一行或多行数据。record 是要插入的数据对象。",
        "action_type": "mutation",
        "endpoint": "/{table_name}",
        "method": "POST",
        "param_mapping": {"table_name": "path.table_name", "record": "body"},
        "parameters": {
            "type": "object",
            "properties": {
                "table_name": {"type": "string", "description": "表名"},
                "record": {"type": "object", "description": "要插入的数据，键为列名"},
            },
            "required": ["table_name", "record"],
        },
    },
    {
        "name": "supabase_update",
        "description": "更新 Supabase 表中匹配条件的行。match_column 和 match_value 指定过滤条件（PostgREST 语法如 eq.123）。",
        "action_type": "mutation",
        "endpoint": "/{table_name}",
        "method": "PATCH",
        "param_mapping": {
            "table_name": "path.table_name",
            "updates": "body",
            "match_column": "query_key",
            "match_value": "query_value",
        },
        "parameters": {
            "type": "object",
            "properties": {
                "table_name": {"type": "string", "description": "表名"},
                "updates": {"type": "object", "description": "要更新的字段"},
                "match_column": {"type": "string", "description": "匹配列名，如 id"},
                "match_value": {"type": "string", "description": "匹配值，PostgREST 语法如 eq.123"},
            },
            "required": ["table_name", "updates", "match_column", "match_value"],
        },
    },
    {
        "name": "supabase_delete",
        "description": "删除 Supabase 表中匹配条件的行。必须提供 match 条件防止全表删除。",
        "action_type": "mutation",
        "endpoint": "/{table_name}",
        "method": "DELETE",
        "param_mapping": {
            "table_name": "path.table_name",
            "match_column": "query_key",
            "match_value": "query_value",
        },
        "parameters": {
            "type": "object",
            "properties": {
                "table_name": {"type": "string", "description": "表名"},
                "match_column": {"type": "string", "description": "匹配列名，如 id"},
                "match_value": {"type": "string", "description": "匹配值，PostgREST 语法如 eq.123"},
            },
            "required": ["table_name", "match_column", "match_value"],
        },
    },
    {
        "name": "supabase_rpc",
        "description": "调用 Supabase 数据库中的 RPC 函数（存储过程）。",
        "action_type": "mutation",
        "endpoint": "/rpc/{function_name}",
        "method": "POST",
        "param_mapping": {"function_name": "path.function_name", "args": "body"},
        "parameters": {
            "type": "object",
            "properties": {
                "function_name": {"type": "string", "description": "RPC 函数名"},
                "args": {"type": "object", "description": "函数参数"},
            },
            "required": ["function_name"],
        },
    },
]


SUPABASE_SQL_PARAMS = {
    "type": "object",
    "properties": {
        "query": {"type": "string", "description": "要执行的 SQL 语句"},
    },
    "required": ["query"],
}


async def ensure_supabase_service(db: AsyncSession) -> None:
    """如果 Supabase 已配置，自动创建 ExternalService + PostgREST 工具。"""
    import re
    from app.models.extras import SiteSetting

    rows = await db.execute(
        select(SiteSetting).where(
            SiteSetting.key.in_(("supabase_url", "supabase_service_key", "supabase_access_token"))
        )
    )
    config = {r.key: r.value for r in rows.scalars()}
    supabase_url = (config.get("supabase_url") or "").strip()
    service_key = (config.get("supabase_service_key") or "").strip()
    access_token = (config.get("supabase_access_token") or "").strip()

    if not supabase_url or not service_key:
        return

    postgrest_url = f"{supabase_url.rstrip('/')}/rest/v1"

    # ── PostgREST ExternalService ──
    result = await db.execute(
        select(ExternalService).where(ExternalService.name == "supabase_postgrest")
    )
    service = result.scalar_one_or_none()
    if not service:
        service = ExternalService(
            name="supabase_postgrest",
            description="Supabase PostgREST API — 直接操作 Supabase 数据库表",
            base_url=postgrest_url,
            auth_type="apikey_header",
            auth_config={"header_name": "apikey", "value": service_key},
            default_headers={
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            enabled=True,
        )
        db.add(service)
        await db.flush()
    else:
        service.base_url = postgrest_url
        service.auth_config = {"header_name": "apikey", "value": service_key}
        service.default_headers = {
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    # Upsert PostgREST tools
    for tool_def in SUPABASE_TOOLS:
        result = await db.execute(
            select(BotTool).where(BotTool.name == tool_def["name"])
        )
        existing = result.scalar_one_or_none()
        if existing:
            for k, v in tool_def.items():
                setattr(existing, k, v)
            existing.service_id = service.id
        else:
            db.add(BotTool(service_id=service.id, **tool_def))

    # ── Management API ExternalService (supabase_sql) ──
    if access_token:
        m = re.match(r"https://([^.]+)\.supabase\.co", supabase_url)
        project_ref = m.group(1) if m else ""

        result = await db.execute(
            select(ExternalService).where(ExternalService.name == "supabase_mgmt")
        )
        mgmt_svc = result.scalar_one_or_none()
        if not mgmt_svc:
            mgmt_svc = ExternalService(
                name="supabase_mgmt",
                description="Supabase Management API — 执行 SQL、管理项目",
                base_url="https://api.supabase.com",
                auth_type="bearer",
                auth_config={"token": access_token},
                default_headers={"Content-Type": "application/json"},
                enabled=True,
            )
            db.add(mgmt_svc)
            await db.flush()
        else:
            mgmt_svc.auth_config = {"token": access_token}

        # endpoint 直接写死 project_ref，AI 只需传 query
        fixed_endpoint = f"/v1/projects/{project_ref}/database/query"

        result = await db.execute(
            select(BotTool).where(BotTool.name == "supabase_sql")
        )
        existing = result.scalar_one_or_none()
        desc = "通过 Supabase Management API 执行任意 SQL（建表、查表、DDL 等）。只需传 query 参数。"
        if existing:
            existing.endpoint = fixed_endpoint
            existing.description = desc
            existing.method = "POST"
            existing.action_type = "mutation"
            existing.param_mapping = {"query": "body.query"}
            existing.parameters = SUPABASE_SQL_PARAMS
            existing.service_id = mgmt_svc.id
        else:
            db.add(BotTool(
                name="supabase_sql",
                description=desc,
                action_type="mutation",
                endpoint=fixed_endpoint,
                method="POST",
                param_mapping={"query": "body.query"},
                parameters=SUPABASE_SQL_PARAMS,
                service_id=mgmt_svc.id,
            ))

    await db.commit()
