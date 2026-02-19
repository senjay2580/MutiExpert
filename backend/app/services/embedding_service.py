"""嵌入向量生成服务"""
from app.config import get_settings

_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        settings = get_settings()
        _model = SentenceTransformer(settings.embedding_model, device=settings.embedding_device)
    return _model


async def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """批量生成文本嵌入向量"""
    model = _get_model()
    embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return embeddings.tolist()


async def generate_embedding(text: str) -> list[float]:
    """单条文本嵌入"""
    result = await generate_embeddings([text])
    return result[0]
