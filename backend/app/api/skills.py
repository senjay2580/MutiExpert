from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.skill_executor import execute_skill as run_skill, load_registry

router = APIRouter()


class SkillExecuteRequest(BaseModel):
    params: dict[str, str] = {}
    context: str = ""


@router.get("/")
async def list_skills():
    """List all skills from the file-based registry."""
    registry = load_registry()
    return {"skills": registry}


@router.post("/{skill_name}/execute")
async def execute_skill(skill_name: str, data: SkillExecuteRequest):
    """Execute a skill by name from the file-based registry."""
    registry = load_registry()
    skill_entry = next((s for s in registry if s["name"] == skill_name), None)
    if not skill_entry:
        raise HTTPException(status_code=404, detail=f"Skill '{skill_name}' not found in registry")
    result = await run_skill(skill_name, data.params, data.context)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Unknown error"))
    return result
