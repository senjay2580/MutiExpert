"""嵌入向量生成服务 — 使用 SiliconFlow Embedding API"""
from app.config import get_settings

_client = None


def _get_client():
    global _client
    if _client is None:
        from openai import OpenAI
        settings = get_settings()
        _client = OpenAI(
            api_key=settings.embedding_api_key,
            base_url=settings.embedding_api_base,
        )
    return _client


async def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """批量生成文本嵌入向量"""
    settings = get_settings()
    client = _get_client()
    resp = client.embeddings.create(
        model=settings.embedding_model,
        input=texts,
    )
    return [item.embedding for item in resp.data]


async def generate_embedding(text: str) -> list[float]:
    """单条文本嵌入"""
    result = await generate_embeddings([text])
    return result[0]
