from fastapi import APIRouter

router = APIRouter()


@router.get("/events")
async def list_events():
    return []


@router.post("/events")
async def create_event():
    return {"message": "TODO"}


@router.put("/events/{event_id}")
async def update_event(event_id: str):
    return {"message": "TODO"}


@router.delete("/events/{event_id}")
async def delete_event(event_id: str):
    return {"message": "TODO"}
