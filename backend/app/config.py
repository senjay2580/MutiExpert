from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # PostgreSQL
    postgres_user: str = "mutiexpert"
    postgres_password: str = "change_me_in_production"
    postgres_db: str = "mutiexpert"
    database_url: str = "postgresql+asyncpg://mutiexpert:change_me_in_production@localhost:5432/mutiexpert"

    # AI Models
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    deepseek_api_key: str = ""
    qwen_api_key: str = ""

    # Embedding (SiliconFlow)
    embedding_api_base: str = "https://api.siliconflow.cn/v1"
    embedding_api_key: str = ""
    embedding_model: str = "BAAI/bge-m3"

    # Feishu
    feishu_app_id: str = ""
    feishu_app_secret: str = ""
    feishu_webhook_url: str = ""
    feishu_verification_token: str = ""
    feishu_encrypt_key: str = ""
    feishu_default_chat_id: str = ""
    feishu_secret_key: str = ""

    # Server
    backend_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:5173"

    # Upload
    upload_dir: str = "/app/uploads"
    max_upload_size: int = 52428800  # 50MB

    # Security
    api_key: str = ""  # If set, require X-API-Key / Bearer token for most endpoints
    max_link_fetch_size: int = 2000000  # 2MB max remote HTML/text fetch

    # Third-party integrations
    tavily_api_key: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
