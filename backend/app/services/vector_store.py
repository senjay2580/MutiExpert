"""向量存储服务 - pgvector 相似度搜索"""
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


async def search_similar_chunks(
    db: AsyncSession,
    query_embedding: list[float],
    knowledge_base_ids: list[UUID],
    top_k: int = 5,
    threshold: float = 0.3,
) -> list[dict]:
    """在指定知识库中搜索最相似的文档分块"""
    if not knowledge_base_ids:
        return []

    kb_ids_str = ",".join(f"'{str(kid)}'" for kid in knowledge_base_ids)
    embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"

    sql = text(f"""
        SELECT
            dc.id,
            dc.document_id,
            dc.knowledge_base_id,
            dc.chunk_index,
            dc.content,
            d.title as document_title,
            1 - (dc.embedding <=> cast(:embedding as vector)) as similarity
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE dc.knowledge_base_id IN ({kb_ids_str})
            AND dc.embedding IS NOT NULL
            AND 1 - (dc.embedding <=> cast(:embedding as vector)) > :threshold
        ORDER BY dc.embedding <=> cast(:embedding as vector)
        LIMIT :top_k
    """)

    result = await db.execute(sql, {
        "embedding": embedding_str,
        "threshold": threshold,
        "top_k": top_k,
    })

    rows = result.fetchall()
    return [
        {
            "chunk_id": str(row.id),
            "document_id": str(row.document_id),
            "knowledge_base_id": str(row.knowledge_base_id),
            "chunk_index": row.chunk_index,
            "content": row.content,
            "document_title": row.document_title,
            "score": round(float(row.similarity), 4),
        }
        for row in rows
    ]
