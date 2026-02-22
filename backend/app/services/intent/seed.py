"""Bot Tools 初始化 — 预置工具定义，首次启动时写入数据库"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.extras import BotTool

DEFAULT_TOOLS = [
    {
        "name": "list_scheduled_tasks",
        "description": "查看定时任务列表，可按状态筛选",
        "action_type": "query",
        "endpoint": "/api/v1/scheduled-tasks/",
        "method": "GET",
        "param_mapping": {},
        "parameters": {
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": ["all", "enabled", "disabled"], "description": "筛选状态"},
            },
        },
    },
    {
        "name": "query_knowledge",
        "description": "搜索知识库内容，回答知识类问题",
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
        "description": "查看待办事项列表",
        "action_type": "query",
        "endpoint": "/api/v1/todos/",
        "method": "GET",
        "param_mapping": {},
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "create_todo",
        "description": "创建新的待办事项",
        "action_type": "mutation",
        "endpoint": "/api/v1/todos/",
        "method": "POST",
        "param_mapping": {"title": "body.title", "priority": "body.priority"},
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "待办标题"},
                "priority": {"type": "string", "enum": ["low", "medium", "high"], "description": "优先级"},
            },
            "required": ["title"],
        },
    },
    {
        "name": "list_knowledge_bases",
        "description": "查看所有知识库列表",
        "action_type": "query",
        "endpoint": "/api/v1/knowledge-bases/",
        "method": "GET",
        "param_mapping": {},
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "list_scripts",
        "description": "查看用户脚本列表",
        "action_type": "query",
        "endpoint": "/api/v1/scripts/",
        "method": "GET",
        "param_mapping": {},
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "get_dashboard",
        "description": "查看系统仪表盘概览数据（知识库数量、文档数、任务数等）",
        "action_type": "query",
        "endpoint": "/api/v1/dashboard/stats",
        "method": "GET",
        "param_mapping": {},
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "switch_model",
        "description": "切换当前飞书机器人使用的AI模型",
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
        "description": "在沙箱工作区执行 Shell 命令（ls, grep, curl, git, cat, wc 等），用于文件操作、数据处理、系统查询",
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
        "description": "列出沙箱工作区的文件和目录",
        "action_type": "query",
        "endpoint": "/api/v1/sandbox/files",
        "method": "GET",
        "param_mapping": {"path": "query.path"},
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "目录路径（相对于 workspace），默认根目录"},
            },
        },
    },
    {
        "name": "sandbox_read_file",
        "description": "读取沙箱工作区中的文件内容",
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
        "description": "在沙箱工作区创建或覆盖文件",
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
        "description": "删除沙箱工作区中的文件",
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
        "name": "sandbox_fetch_url",
        "description": "抓取网页 URL 内容并智能提取正文。mode=auto 自动提取（SPA 页面自动 fallback Jina Reader），mode=jina 强制用 Jina Reader 渲染 JS 页面返回 Markdown，mode=raw 返回原始内容",
        "action_type": "query",
        "endpoint": "/api/v1/sandbox/web/fetch",
        "method": "POST",
        "param_mapping": {"url": "body.url", "mode": "body.mode"},
        "parameters": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "要抓取的网页 URL"},
                "mode": {"type": "string", "enum": ["auto", "jina", "raw"], "description": "抓取模式：auto=智能提取（默认），jina=JS渲染，raw=原始内容"},
            },
            "required": ["url"],
        },
    },
    {
        "name": "web_search",
        "description": "搜索互联网获取实时信息，返回相关网页标题、链接和摘要。适用于查询最新资讯、技术文档、产品信息等",
        "action_type": "query",
        "endpoint": "/api/v1/sandbox/web/search",
        "method": "POST",
        "param_mapping": {"query": "body.query", "max_results": "body.max_results"},
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "搜索关键词"},
                "max_results": {"type": "integer", "description": "最大结果数，默认5"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "sandbox_python",
        "description": "在沙箱中执行 Python 代码片段，可用于数据处理、计算、文本分析、文件处理等",
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
