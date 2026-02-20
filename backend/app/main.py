from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from app.config import get_settings
from app.api.router import api_router
from app.database import init_db
from app.services.scheduler_service import SchedulerService


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: auto-create tables
    await init_db()
    scheduler = SchedulerService()
    await scheduler.start()
    yield
    # Shutdown
    await scheduler.stop()


app = FastAPI(
    title="MutiExpert API",
    description="Multi-industry Knowledge Asset Management Platform",
    version="0.1.0",
    lifespan=lifespan,
)

settings = get_settings()

PUBLIC_PATHS = {
    "/health",
    "/api/v1/health",
    "/api/v1/feishu/webhook",
}


@app.middleware("http")
async def api_key_guard(request: Request, call_next):
    # Let CORS preflight through.
    if request.method == "OPTIONS":
        return await call_next(request)

    expected = settings.api_key
    if not expected:
        return await call_next(request)

    if request.url.path in PUBLIC_PATHS:
        return await call_next(request)

    provided = request.headers.get("x-api-key")
    if not provided:
        auth = request.headers.get("authorization") or ""
        if auth.lower().startswith("bearer "):
            provided = auth[7:].strip()

    if provided != expected:
        return JSONResponse(status_code=401, content={"detail": "Unauthorized"})

    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "mutiexpert-api"}
