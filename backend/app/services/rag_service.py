"""RAG 管线 - 检索增强生成"""
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.embedding_service import generate_embedding
from app.services.vector_store import search_similar_chunks


async def retrieve_context(
    db: AsyncSession,
    query: str,
    knowledge_base_ids: list[UUID],
    top_k: int = 5,
) -> tuple[str, list[dict]]:
    """检索相关上下文，返回 (context_text, sources)"""
    query_embedding = await generate_embedding(query)

    sources = await search_similar_chunks(
        db=db,
        query_embedding=query_embedding,
        knowledge_base_ids=knowledge_base_ids,
        top_k=top_k,
    )

    if not sources:
        return "", []

    context_parts = []
    for i, src in enumerate(sources, 1):
        context_parts.append(
            f"[来源{i}] {src['document_title']} (相关度: {src['score']})\n{src['content']}"
        )

    context_text = "\n\n---\n\n".join(context_parts)
    return context_text, sources


def build_rag_prompt(context: str, query: str, skills_info: str = "") -> str:
    """构建 RAG 系统提示词"""
    skills_section = ""
    if skills_info:
        skills_section = f"""
5. 你还拥有以下技能（Skills），可在回答中灵活运用：
{skills_info}
当用户的问题需要用到某个技能时，主动运用该技能来增强回答质量。"""

    return f"""你是一个专业的多行业知识助手，融汇贯通各行业知识，打通信息壁垒。

规则：
1. 优先使用知识库中的内容回答，引用来源编号如 [来源1]
2. 如果知识库中没有相关内容，明确说明并基于你的知识补充
3. 回答要结构化、清晰、有条理
4. 如果发现跨行业的关联，主动指出{skills_section}

以下是从知识库中检索到的相关内容：

{context}

---

用户问题：{query}"""
