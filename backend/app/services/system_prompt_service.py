"""统一系统提示词服务 — 为所有 AI 模型提供一致的平台上下文"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.extras import (
    BotTool,
    ScheduledTask,
    UserScript,
)
from app.models.knowledge import KnowledgeBase, Industry


# ── 静态身份描述 ──────────────────────────────────────────────
IDENTITY = """\
你是 MutiExpert 智能助手，一个多行业知识管理平台的 AI 核心。
平台帮助用户跨行业整合知识、自动化工作流、管理日常事务。"""

GUIDELINES = """\
行为准则：
- 回复使用中文，语气专业但友好
- 优先使用知识库内容回答，引用来源编号如 [来源1]
- 知识库无相关内容时，明确说明并基于自身知识补充
- 发现跨行业关联时主动指出
- 回答要结构化、清晰、有条理
- 涉及修改操作（创建、删除、更新）时，先确认用户意图"""


async def build_system_prompt(
    db: AsyncSession,
    *,
    include_tools: bool = True,
    include_scripts: bool = True,
    include_tasks: bool = True,
    include_knowledge: bool = True,
    include_skills: bool = True,
    compact: bool = False,
) -> str:
    """构建统一系统提示词，动态注入平台能力上下文。

    Args:
        db: 数据库会话
        include_tools: 是否包含 Bot Tools 信息
        include_scripts: 是否包含用户脚本信息
        include_tasks: 是否包含定时任务信息
        include_knowledge: 是否包含知识库概览
        include_skills: 是否包含 Skills 信息
        compact: 紧凑模式（用于 intent router 等 token 敏感场景）
    """
    sections: list[str] = [IDENTITY]

    if not compact:
        sections.append(GUIDELINES)

    # 并行查询所有动态数据
    capabilities = await _load_capabilities(
        db,
        include_tools=include_tools,
        include_scripts=include_scripts,
        include_tasks=include_tasks,
        include_knowledge=include_knowledge,
        include_skills=include_skills,
    )

    if capabilities:
        sections.append("## 平台能力\n" + capabilities)

    return "\n\n".join(sections)


async def _load_capabilities(
    db: AsyncSession,
    *,
    include_tools: bool,
    include_scripts: bool,
    include_tasks: bool,
    include_knowledge: bool,
    include_skills: bool,
) -> str:
    """从数据库加载各模块摘要，拼接为能力描述。"""
    parts: list[str] = []

    if include_knowledge:
        text = await _knowledge_summary(db)
        if text:
            parts.append(text)

    if include_tools:
        text = await _tools_summary(db)
        if text:
            parts.append(text)

    if include_scripts:
        text = await _scripts_summary(db)
        if text:
            parts.append(text)

    if include_tasks:
        text = await _tasks_summary(db)
        if text:
            parts.append(text)

    if include_skills:
        text = _skills_summary()
        if text:
            parts.append(text)

    return "\n\n".join(parts)


async def _knowledge_summary(db: AsyncSession) -> str:
    """知识库概览。"""
    result = await db.execute(
        select(KnowledgeBase.name, Industry.name.label("industry"))
        .outerjoin(Industry, KnowledgeBase.industry_id == Industry.id)
        .order_by(KnowledgeBase.created_at.desc())
        .limit(20)
    )
    rows = result.all()
    if not rows:
        return ""
    lines = [f"- {r.name}（{r.industry or '未分类'}）" for r in rows]
    return "### 知识库\n可检索以下知识库回答问题：\n" + "\n".join(lines)


async def _tools_summary(db: AsyncSession) -> str:
    """已启用的 Bot Tools。"""
    result = await db.execute(
        select(BotTool.name, BotTool.description)
        .where(BotTool.enabled.is_(True))
        .order_by(BotTool.name)
    )
    rows = result.all()
    if not rows:
        return ""
    lines = [f"- `{r.name}`: {r.description}" for r in rows]
    return "### 可调用工具\n" + "\n".join(lines)


async def _scripts_summary(db: AsyncSession) -> str:
    """已启用的用户脚本。"""
    result = await db.execute(
        select(UserScript.name, UserScript.id)
        .where(UserScript.enabled.is_(True))
        .order_by(UserScript.name)
        .limit(20)
    )
    rows = result.all()
    if not rows:
        return ""
    lines = [f"- {r.name}" for r in rows]
    return "### 用户脚本\n可通过定时任务执行的 TypeScript 脚本：\n" + "\n".join(lines)


async def _tasks_summary(db: AsyncSession) -> str:
    """活跃的定时任务。"""
    result = await db.execute(
        select(ScheduledTask.name, ScheduledTask.cron_expression, ScheduledTask.task_type)
        .where(ScheduledTask.enabled.is_(True))
        .order_by(ScheduledTask.name)
        .limit(20)
    )
    rows = result.all()
    if not rows:
        return ""
    type_label = {
        "ai_query": "AI问答",
        "feishu_push": "飞书推送",
        "skill_exec": "技能执行",
        "script_exec": "脚本执行",
    }
    lines = [
        f"- {r.name}（{type_label.get(r.task_type, r.task_type)}，cron: `{r.cron_expression}`）"
        for r in rows
    ]
    return "### 定时任务\n当前活跃的定时任务：\n" + "\n".join(lines)


def _skills_summary() -> str:
    """从 registry.yaml 加载 Skills 信息。"""
    from app.services.skill_executor import load_registry

    try:
        registry = load_registry()
    except Exception:
        return ""
    if not registry:
        return ""
    lines = [
        f"- {s['name']}: {s.get('description', '')}"
        for s in registry
    ]
    return "### 技能（Skills）\n可在回答中灵活运用：\n" + "\n".join(lines)
