from pydantic import BaseModel


class AIModelConfigUpdate(BaseModel):
    name: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    model: str | None = None
    reasoning_effort: str | None = None
    disable_response_storage: bool | None = None
    preferred_auth_method: str | None = None
    wire_api: str | None = None
    requires_openai_auth: bool | None = None
    model_migrations: dict[str, str] | None = None


class AvailableModel(BaseModel):
    id: str
    name: str


class AIModelConfigOut(BaseModel):
    id: str
    name: str
    provider: str
    base_url: str | None
    model: str | None
    api_key_set: bool
    reasoning_effort: str | None
    disable_response_storage: bool | None
    preferred_auth_method: str | None
    wire_api: str | None
    requires_openai_auth: bool | None
    available_models: list[AvailableModel] = []

