"""知识网络扫描器 - 跨知识库向量相似度扫描，发现关联"""
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.models.knowledge import KnowledgeBase
from app.models.network import KnowledgeLink


async def scan_cross_kb_links(db: AsyncSession, threshold: float = 0.6, max_links: int = 100):
    """扫描所有知识库间的向量相似度，生成关联边"""
    # 获取所有知识库
    result = await db.execute(select(KnowledgeBase))
    kbs = result.scalars().all()
    kb_ids = [kb.id for kb in kbs]

    if len(kb_ids) < 2:
        return {"message": "Need at least 2 knowledge bases to scan", "links_created": 0}

    # 清除旧的关联
    await db.execute(text("DELETE FROM knowledge_links"))

    # 跨知识库两两比较
    links_created = 0
    for i, kb_a in enumerate(kb_ids):
        for kb_b in kb_ids[i + 1:]:
            sql = text("""
                SELECT
                    a.id as source_id, b.id as target_id,
                    a.content as source_content, b.content as target_content,
                    1 - (a.embedding <=> b.embedding) as similarity
                FROM document_chunks a, document_chunks b
                WHERE a.knowledge_base_id = :kb_a
                    AND b.knowledge_base_id = :kb_b
                    AND a.embedding IS NOT NULL
                    AND b.embedding IS NOT NULL
                    AND 1 - (a.embedding <=> b.embedding) > :threshold
                ORDER BY a.embedding <=> b.embedding
                LIMIT :max_per_pair
            """)
            rows = await db.execute(sql, {
                "kb_a": str(kb_a), "kb_b": str(kb_b),
                "threshold": threshold, "max_per_pair": max_links // max(len(kb_ids), 1),
            })

            for row in rows.fetchall():
                link = KnowledgeLink(
                    source_chunk_id=row.source_id,
                    target_chunk_id=row.target_id,
                    source_kb_id=kb_a,
                    target_kb_id=kb_b,
                    relation_type="similar_concept",
                    strength=round(float(row.similarity), 4),
                    description=f"Similarity: {row.similarity:.2%}",
                )
                db.add(link)
                links_created += 1

    await db.commit()
    return {"message": "Scan complete", "links_created": links_created}


async def get_graph_data(db: AsyncSession, kb_ids: list[uuid.UUID] | None = None) -> dict:
    """获取知识网络图数据 (nodes + edges)"""
    # Nodes: 知识库
    query = select(KnowledgeBase)
    if kb_ids:
        query = query.where(KnowledgeBase.id.in_(kb_ids))
    result = await db.execute(query)
    kbs = result.scalars().all()

    nodes = []
    for kb in kbs:
        nodes.append({
            "id": str(kb.id),
            "label": kb.name,
            "industry_id": str(kb.industry_id) if kb.industry_id else None,
            "document_count": kb.document_count or 0,
        })

    # Edges: 知识关联
    link_query = select(KnowledgeLink)
    if kb_ids:
        link_query = link_query.where(
            KnowledgeLink.source_kb_id.in_(kb_ids) | KnowledgeLink.target_kb_id.in_(kb_ids)
        )
    link_result = await db.execute(link_query)
    links = link_result.scalars().all()

    # 聚合：同一对 KB 之间的多条 link 合并为一条 edge
    edge_map: dict[tuple, dict] = {}
    for link in links:
        key = (str(link.source_kb_id), str(link.target_kb_id))
        if key not in edge_map:
            edge_map[key] = {
                "source": key[0], "target": key[1],
                "strength": 0, "count": 0,
                "relation_type": link.relation_type or "similar_concept",
            }
        edge_map[key]["strength"] += link.strength or 0
        edge_map[key]["count"] += 1

    edges = []
    for edge in edge_map.values():
        avg_strength = edge["strength"] / edge["count"] if edge["count"] > 0 else 0
        edges.append({
            "source": edge["source"],
            "target": edge["target"],
            "strength": round(avg_strength, 4),
            "relation_type": edge["relation_type"],
            "description": f"{edge['count']} connections, avg similarity: {avg_strength:.2%}",
        })

    return {"nodes": nodes, "edges": edges}
