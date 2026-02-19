from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # PostgreSQL
    postgres_user: str = "mutiexpert"
    postgres_password: str = "mutiexpert_secure_2024"
    postgres_db: str = "mutiexpert"
    database_url: str = "postgresql+asyncpg://mutiexpert:mutiexpert_secure_2024@localhost:5432/mutiexpert"

    # AI Models
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # Embedding
    embedding_model: str = "BAAI/bge-m3"
    embedding_device: str = "cpu"

    # Feishu
    feishu_app_id: str = ""
    feishu_app_secret: str = ""
    feishu_webhook_url: str = ""

    # Server
    backend_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:5173"

    # Upload
    upload_dir: str = "/app/uploads"
    max_upload_size: int = 52428800  # 50MB

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
