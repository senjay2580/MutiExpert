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
]


async def ensure_default_tools(db: AsyncSession) -> None:
    """确保默认工具存在，不覆盖已有的"""
    for tool_def in DEFAULT_TOOLS:
        result = await db.execute(
            select(BotTool).where(BotTool.name == tool_def["name"])
        )
        if result.scalar_one_or_none():
            continue
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
