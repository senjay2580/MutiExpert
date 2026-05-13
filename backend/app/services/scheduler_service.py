import asyncio
import logging
from contextlib import suppress
from datetime import datetime
from uuid import UUID
from zoneinfo import ZoneInfo
from croniter import croniter
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.extras import ScheduledTask
from app.models.knowledge import KnowledgeBase
from app.services.rag_service import retrieve_context, build_rag_context
from app.services.ai_service import stream_chat
from app.services.feishu_service import get_feishu_service, build_stream_card
from app.services.skill_executor import execute_skill
from app.services.script_executor import execute_script

logger = logging.getLogger(__name__)

TZ_UTC = ZoneInfo("UTC")
TZ_LOCAL = ZoneInfo("Asia/Shanghai")


async def _generate_text(messages: list[dict], provider: str, system_prompt: str, db) -> str:
    full_response = ""
    async for chunk in stream_chat(messages, provider, system_prompt, db=db):
        if chunk.type == "text":
            full_response += chunk.content
    return full_response


def _is_due(task: ScheduledTask, now_utc: datetime) -> bool:
    base_utc = task.last_run_at or task.created_at or now_utc
    # DB 里 last_run_at / created_at 是 naive UTC（utcnow() 写入），先标注成 aware UTC
    if base_utc.tzinfo is None:
        base_utc = base_utc.replace(tzinfo=TZ_UTC)
    if now_utc.tzinfo is None:
        now_utc = now_utc.replace(tzinfo=TZ_UTC)
    # cron 表达式按用户期望的本地时区（Asia/Shanghai）解读
    base_local = base_utc.astimezone(TZ_LOCAL)
    now_local = now_utc.astimezone(TZ_LOCAL)
    try:
        itr = croniter(task.cron_expression, base_local)
        next_run = itr.get_next(datetime)
    except Exception as e:
        logger.warning("Invalid cron for task %s (%s): %s", task.name, task.cron_expression, e)
        return False
    return next_run <= now_local


def _format_status(status: str) -> str:
    if len(status) <= 120:
        return status
    return status[:117] + "..."


async def _execute_task(task: ScheduledTask, db) -> tuple[bool, str]:
    config = task.task_config or {}
    now = datetime.utcnow()
    try:
        if task.task_type == "ai_query":
            prompt = config.get("prompt") or task.name
            # 读取系统默认模型（和 AI 问答一致）
            if config.get("model_provider"):
                provider = config["model_provider"]
            else:
                from app.models.extras import FeishuConfig
                fc_result = await db.execute(select(FeishuConfig).limit(1))
                fc = fc_result.scalar_one_or_none()
                provider = (fc.default_provider if fc else None) or "claude"
            raw_kb_ids = config.get("knowledge_base_ids") or []
            kb_ids = []
            for kid in raw_kb_ids:
                try:
                    kb_ids.append(UUID(str(kid)))
                except Exception:
                    continue
            if not kb_ids:
                result = await db.execute(select(KnowledgeBase.id))
                kb_ids = [row[0] for row in result.all()]

            # 走和前端 AI 问答同一个 pipeline，支持工具调用 / RAG / 网络搜索循环。
            # 之前直接 stream_chat() 会让模型产出的 <function_calls> XML 没人解析，
            # 字面量推到飞书。
            from app.services.pipeline_service import PipelineRequest, run_stream as pipeline_run_stream
            request = PipelineRequest(
                message=prompt,
                channel="scheduled",
                provider=provider,
                modes={"knowledge"} if kb_ids else set(),
                knowledge_base_ids=kb_ids,
                history=[],
            )
            response = ""
            async for event in pipeline_run_stream(request, db):
                if event.type == "text_chunk":
                    response += event.data.get("content", "")

            if config.get("push_to_feishu"):
                svc = await get_feishu_service(db)
                chat_id = config.get("feishu_chat_id") or svc.default_chat_id
                title = config.get("feishu_title") or f"AI 定时任务：{task.name}"
                card = build_stream_card(response, "completed")
                card["header"]["title"]["content"] = title
                if chat_id:
                    await svc.send_interactive_card(chat_id, card)
                else:
                    await svc.send_webhook_message(title, response)
            status = "success"

        elif task.task_type == "skill_exec":
            skill_name = config.get("skill_name")
            params = config.get("params") or {}
            if not skill_name:
                raise RuntimeError("Missing skill_name")
            result = await execute_skill(skill_name, params)
            if not result.get("success"):
                raise RuntimeError(result.get("error", "Skill execution failed"))
            if config.get("push_to_feishu"):
                svc = await get_feishu_service(db)
                chat_id = config.get("feishu_chat_id") or svc.default_chat_id
                title = config.get("feishu_title") or f"技能任务：{skill_name}"
                content = result.get("result", "")
                card = build_stream_card(content, "completed")
                card["header"]["title"]["content"] = title
                if chat_id:
                    await svc.send_interactive_card(chat_id, card)
                else:
                    await svc.send_webhook_message(title, content)
            status = "success"

        elif task.task_type == "script_exec":
            from app.models.extras import UserScript
            from app.services.script_env_resolver import resolve_env_vars
            script_id = task.script_id or config.get("script_id")
            if not script_id:
                raise RuntimeError("Missing script_id")
            sr = await db.execute(select(UserScript).where(UserScript.id == script_id))
            script = sr.scalar_one_or_none()
            if not script:
                raise RuntimeError(f"Script {script_id} not found")
            env_vars = await resolve_env_vars(db)
            result = await execute_script(
                script.script_content,
                timeout_seconds=config.get("timeout", 30),
                script_type=script.script_type or "typescript",
                extra_env=env_vars,
            )
            if not result.success:
                raise RuntimeError(result.error or "Script execution failed")
            if config.get("push_to_feishu"):
                svc = await get_feishu_service(db)
                chat_id = config.get("feishu_chat_id") or svc.default_chat_id
                title = config.get("feishu_title") or f"脚本任务：{script.name}"
                content = result.output or "(无输出)"
                if chat_id:
                    await svc.send_text_message(chat_id, content)
                else:
                    await svc.send_webhook_message(title, content)
            status = "success"

        else:
            raise RuntimeError(f"Unknown task_type: {task.task_type}")

        task.last_run_at = now
        task.last_run_status = status
        await db.commit()
        return True, status
    except Exception as exc:
        task.last_run_at = now
        task.last_run_status = _format_status(f"error: {exc}")
        await db.commit()
        return False, str(exc)


class SchedulerService:
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._running = False

    async def start(self) -> None:
        if self._task:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            with suppress(Exception):
                await self._task
            self._task = None

    async def run_once(self, task_id: UUID) -> tuple[bool, str]:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(ScheduledTask).where(ScheduledTask.id == task_id))
            task = result.scalar_one_or_none()
            if not task:
                return False, "Task not found"
            return await _execute_task(task, db)

    async def _loop(self) -> None:
        logger.info("Scheduler loop started (tz=Asia/Shanghai, tick=30s)")
        while self._running:
            try:
                await self._run_pending()
            except asyncio.CancelledError:
                raise
            except Exception:
                # 任何一次 tick 出错都不能让整个调度器死掉
                logger.exception("Scheduler tick failed, will retry next cycle")
            await asyncio.sleep(30)
        logger.info("Scheduler loop stopped")

    async def _run_pending(self) -> None:
        async with AsyncSessionLocal() as db:
            now = datetime.utcnow()
            result = await db.execute(select(ScheduledTask).where(ScheduledTask.enabled.is_(True)))
            tasks = result.scalars().all()
            for task in tasks:
                try:
                    if _is_due(task, now):
                        logger.info("Executing scheduled task: %s (cron=%s)", task.name, task.cron_expression)
                        await _execute_task(task, db)
                except asyncio.CancelledError:
                    raise
                except Exception:
                    # 单个任务失败不影响其他任务调度
                    logger.exception("Scheduled task execution failed: %s", task.name)
