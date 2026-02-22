from fastapi import APIRouter
from app.api import industries, knowledge_bases, documents, chat, network, feishu, skills, calendar, dashboard, system, scheduled_tasks, todos, site_settings, data_management, boards, scripts, bot_tools, sandbox

api_router = APIRouter()

api_router.include_router(system.router, tags=["system"])
api_router.include_router(industries.router, prefix="/industries", tags=["industries"])
api_router.include_router(knowledge_bases.router, prefix="/knowledge-bases", tags=["knowledge-bases"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(chat.router, prefix="/conversations", tags=["chat"])
api_router.include_router(network.router, prefix="/knowledge-network", tags=["network"])
api_router.include_router(feishu.router, prefix="/feishu", tags=["feishu"])
api_router.include_router(skills.router, prefix="/skills", tags=["skills"])
api_router.include_router(calendar.router, prefix="/calendar", tags=["calendar"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(scheduled_tasks.router, prefix="/scheduled-tasks", tags=["scheduled-tasks"])
api_router.include_router(todos.router, prefix="/todos", tags=["todos"])
api_router.include_router(site_settings.router, prefix="/site-settings", tags=["site-settings"])
api_router.include_router(data_management.router, prefix="/data", tags=["data-management"])
api_router.include_router(boards.router, prefix="/boards", tags=["boards"])
api_router.include_router(scripts.router, prefix="/scripts", tags=["scripts"])
api_router.include_router(bot_tools.router, prefix="/bot-tools", tags=["bot-tools"])
api_router.include_router(sandbox.router, prefix="/sandbox", tags=["sandbox"])
