"""统一系统提示词服务 — 为所有 AI 模型提供一致的平台上下文"""
from __future__ import annotations

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.extras import (
    BotTool,
    ScheduledTask,
    Skill,
    UserScript,
)
from app.models.knowledge import KnowledgeBase, Industry


# ── 静态身份描述 ──────────────────────────────────────────────
IDENTITY = """\
你是 MutiExpert 智能助手，一个多行业知识管理平台的 AI 核心。
平台帮助用户跨行业整合知识、自动化工作流、管理日常事务。"""

PROVIDER_LABELS: dict[str, str] = {
    "claude": "Claude (Anthropic)",
    "openai": "GPT (OpenAI)",
    "deepseek": "DeepSeek",
    "qwen": "通义千问 (Qwen)",
}

GUIDELINES = """\
行为准则：
- 回复使用中文，语气专业但友好
- 优先使用知识库内容回答，引用来源编号如 [来源1]
- 知识库无相关内容时，明确说明并基于自身知识补充
- 发现跨行业关联时主动指出
- 回答要结构化、清晰、有条理
- 涉及修改操作（创建、删除、更新）时，先确认用户意图再调用工具
- 需要操作平台数据时，使用可调用工具（Bot Tools）
- 需要执行命令、读写文件、运行代码时，使用沙箱工具（sandbox_shell / sandbox_python / sandbox_read_file / sandbox_write_file）
- 沙箱工作区路径为 /app/workspace，所有文件操作限制在此目录内
- 需要获取网页内容时使用 sandbox_fetch_url
- 复杂任务可组合多个沙箱工具：先 fetch_url 获取数据 → write_file 保存 → python 处理 → read_file 返回结果
- 用户消息以 /技能名 开头时，直接触发对应技能处理
- 根据用户意图自动选择合适的技能或工具，将复杂问题拆解为多步骤执行"""


async def build_system_prompt(
    db: AsyncSession,
    *,
    provider: str = "",
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
        provider: 当前使用的模型提供商 ID（claude/openai/deepseek/qwen）
        include_tools: 是否包含 Bot Tools 信息
        include_scripts: 是否包含用户脚本信息
        include_tasks: 是否包含定时任务信息
        include_knowledge: 是否包含知识库概览
        include_skills: 是否包含 Skills 信息
        compact: 紧凑模式（用于 intent router 等 token 敏感场景）
    """
    identity = IDENTITY
    if provider:
        label = PROVIDER_LABELS.get(provider, provider)
        identity += f"\n当前底层模型：{label}。请勿自称其他模型的名字。"

    sections: list[str] = [identity]

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
        text = await _skills_summary(db)
        if text:
            parts.append(text)

    return "\n\n".join(parts)


async def _knowledge_summary(db: AsyncSession) -> str:
    """知识库概览。"""
    total = await db.scalar(select(func.count()).select_from(KnowledgeBase))
    if not total:
        return ""
    limit = 20
    result = await db.execute(
        select(KnowledgeBase.name, Industry.name.label("industry"))
        .outerjoin(Industry, KnowledgeBase.industry_id == Industry.id)
        .order_by(Industry.name, KnowledgeBase.name)
        .limit(limit)
    )
    rows = result.all()
    lines = [f"- {r.name}（{r.industry or '未分类'}）" for r in rows]
    header = f"### 知识库（共 {total} 个"
    if total > limit:
        header += f"，显示前 {limit} 个"
    header += "）\n可检索以下知识库回答问题："
    return header + "\n" + "\n".join(lines)


async def _tools_summary(db: AsyncSession) -> str:
    """已启用的 Bot Tools（含参数签名）。"""
    result = await db.execute(
        select(BotTool.name, BotTool.description, BotTool.parameters)
        .where(BotTool.enabled.is_(True))
        .order_by(BotTool.name)
    )
    rows = result.all()
    if not rows:
        return ""
    lines = []
    for r in rows:
        params = r.parameters or {}
        props = list((params.get("properties") or {}).keys())
        param_hint = f"（参数: {', '.join(props)}）" if props else ""
        lines.append(f"- `{r.name}`: {r.description}{param_hint}")
    return f"### 可调用工具（共 {len(rows)} 个）\n" + "\n".join(lines)


async def _scripts_summary(db: AsyncSession) -> str:
    """已启用的用户脚本。"""
    total = await db.scalar(
        select(func.count()).select_from(UserScript).where(UserScript.enabled.is_(True))
    )
    if not total:
        return ""
    limit = 20
    result = await db.execute(
        select(UserScript.name, UserScript.description, UserScript.script_type)
        .where(UserScript.enabled.is_(True))
        .order_by(UserScript.name)
        .limit(limit)
    )
    rows = result.all()
    lines = []
    for r in rows:
        lang = "Python" if r.script_type == "python" else "TypeScript"
        desc = f": {r.description}" if r.description else ""
        lines.append(f"- {r.name}（{lang}）{desc}")
    header = f"### 用户脚本（共 {total} 个"
    if total > limit:
        header += f"，显示前 {limit} 个"
    header += "）\n可通过定时任务或 AI 调度执行的脚本："
    return header + "\n" + "\n".join(lines)


async def _tasks_summary(db: AsyncSession) -> str:
    """活跃的定时任务。"""
    total = await db.scalar(
        select(func.count()).select_from(ScheduledTask).where(ScheduledTask.enabled.is_(True))
    )
    if not total:
        return ""
    limit = 20
    result = await db.execute(
        select(ScheduledTask.name, ScheduledTask.cron_expression, ScheduledTask.task_type)
        .where(ScheduledTask.enabled.is_(True))
        .order_by(ScheduledTask.name)
        .limit(limit)
    )
    rows = result.all()
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
    header = f"### 定时任务（共 {total} 个"
    if total > limit:
        header += f"，显示前 {limit} 个"
    header += "）\n当前活跃的定时任务："
    return header + "\n" + "\n".join(lines)


async def _skills_summary(db: AsyncSession) -> str:
    """从数据库加载已启用的 Skills 信息。"""
    result = await db.execute(
        select(Skill.name, Skill.description)
        .where(Skill.enabled.is_(True), Skill.description.isnot(None))
        .order_by(Skill.sort_order, Skill.name)
    )
    rows = result.all()
    if not rows:
        return ""
    lines = [f"- `{r.name}`: {r.description}" for r in rows]
    return f"### 技能（共 {len(rows)} 个）\n可通过 /技能名 直接触发，或由 AI 自动选择：\n" + "\n".join(lines)
