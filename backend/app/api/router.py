from fastapi import APIRouter
from app.api import industries, knowledge_bases, documents, chat, network, feishu, skills, calendar, dashboard, system, scheduled_tasks

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
