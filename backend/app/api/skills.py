from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_skills():
    return []


@router.get("/{skill_id}")
async def get_skill(skill_id: str):
    return {"message": "TODO"}


@router.post("/")
async def create_skill():
    return {"message": "TODO"}


@router.put("/{skill_id}")
async def update_skill(skill_id: str):
    return {"message": "TODO"}


@router.delete("/{skill_id}")
async def delete_skill(skill_id: str):
    return {"message": "TODO"}


@router.post("/{skill_id}/execute")
async def execute_skill(skill_id: str):
    return {"message": "TODO"}
