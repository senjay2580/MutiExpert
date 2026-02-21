import asyncio
from contextlib import suppress
from datetime import datetime
from uuid import UUID
from croniter import croniter
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.extras import ScheduledTask
from app.models.knowledge import KnowledgeBase
from app.services.rag_service import retrieve_context, build_rag_prompt
from app.services.ai_service import stream_chat
from app.services.feishu_service import get_feishu_service
from app.services.skill_executor import execute_skill
from app.services.script_executor import execute_script


async def _generate_text(messages: list[dict], provider: str, system_prompt: str, db) -> str:
    full_response = ""
    async for chunk in stream_chat(messages, provider, system_prompt, db=db):
        full_response += chunk
    return full_response


def _is_due(task: ScheduledTask, now: datetime) -> bool:
    base = task.last_run_at or task.created_at or now
    try:
        itr = croniter(task.cron_expression, base)
        next_run = itr.get_next(datetime)
    except Exception:
        return False
    return next_run <= now


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
            provider = config.get("model_provider") or "claude"
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
            context, sources = await retrieve_context(db, prompt, kb_ids) if kb_ids else ("", [])
            system_prompt = build_rag_prompt(context, prompt) if context else ""
            response = await _generate_text([
                {"role": "user", "content": prompt},
            ], provider, system_prompt, db)

            if config.get("push_to_feishu"):
                svc = await get_feishu_service(db)
                chat_id = config.get("feishu_chat_id") or svc.default_chat_id
                title = config.get("feishu_title") or f"AI 定时任务：{task.name}"
                if chat_id:
                    await svc.send_text_message(chat_id, response)
                else:
                    await svc.send_webhook_message(title, response)
            status = "success"

        elif task.task_type == "feishu_push":
            svc = await get_feishu_service(db)
            chat_id = config.get("chat_id") or svc.default_chat_id
            title = config.get("title") or task.name
            content = config.get("content") or ""
            if chat_id:
                result = await svc.send_text_message(chat_id, content)
            else:
                result = await svc.send_webhook_message(title, content)
            if not result.get("success"):
                raise RuntimeError(result.get("error", "feishu push failed"))
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
                if chat_id:
                    await svc.send_text_message(chat_id, content)
                else:
                    await svc.send_webhook_message(title, content)
            status = "success"

        elif task.task_type == "script_exec":
            from app.models.extras import UserScript
            script_id = task.script_id or config.get("script_id")
            if not script_id:
                raise RuntimeError("Missing script_id")
            sr = await db.execute(select(UserScript).where(UserScript.id == script_id))
            script = sr.scalar_one_or_none()
            if not script:
                raise RuntimeError(f"Script {script_id} not found")
            result = await execute_script(script.script_content, timeout_seconds=config.get("timeout", 30))
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
        while self._running:
            await self._run_pending()
            await asyncio.sleep(30)

    async def _run_pending(self) -> None:
        async with AsyncSessionLocal() as db:
            now = datetime.utcnow()
            result = await db.execute(select(ScheduledTask).where(ScheduledTask.enabled.is_(True)))
            tasks = result.scalars().all()
            for task in tasks:
                if _is_due(task, now):
                    await _execute_task(task, db)
