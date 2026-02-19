from fastapi import APIRouter

router = APIRouter()


@router.post("/webhook")
async def feishu_webhook():
    return {"message": "TODO"}


@router.get("/config")
async def get_feishu_config():
    return {"message": "TODO"}


@router.put("/config")
async def update_feishu_config():
    return {"message": "TODO"}


@router.post("/test-connection")
async def test_feishu_connection():
    return {"message": "TODO"}


@router.post("/send-message")
async def send_feishu_message():
    return {"message": "TODO"}
