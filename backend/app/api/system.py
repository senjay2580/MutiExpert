from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/config/models")
async def get_available_models():
    return {
        "models": [
            {"id": "claude", "name": "Claude (Anthropic)", "provider": "anthropic"},
            {"id": "codex", "name": "Codex (OpenAI)", "provider": "openai"},
        ]
    }
