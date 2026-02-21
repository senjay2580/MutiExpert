"""创意洞察生成器 - AI 分析跨行业关联，生成创意思路"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.models.network import Insight
from app.services.ai_service import stream_chat


async def generate_insights(db: AsyncSession) -> list[dict]:
    """基于知识关联生成创意洞察"""
    # 获取最强的跨 KB 关联
    sql = text("""
        SELECT
            kl.source_kb_id, kl.target_kb_id,
            kb1.name as source_name, kb2.name as target_name,
            AVG(kl.strength) as avg_strength,
            COUNT(*) as link_count,
            ARRAY_AGG(DISTINCT LEFT(dc1.content, 200)) as source_snippets,
            ARRAY_AGG(DISTINCT LEFT(dc2.content, 200)) as target_snippets
        FROM knowledge_links kl
        JOIN knowledge_bases kb1 ON kb1.id = kl.source_kb_id
        JOIN knowledge_bases kb2 ON kb2.id = kl.target_kb_id
        LEFT JOIN document_chunks dc1 ON dc1.id = kl.source_chunk_id
        LEFT JOIN document_chunks dc2 ON dc2.id = kl.target_chunk_id
        GROUP BY kl.source_kb_id, kl.target_kb_id, kb1.name, kb2.name
        HAVING COUNT(*) >= 2
        ORDER BY AVG(kl.strength) DESC
        LIMIT 5
    """)

    result = await db.execute(sql)
    rows = result.fetchall()

    if not rows:
        return []

    # 构建 AI prompt
    connections_text = ""
    for row in rows:
        source_snippets = row.source_snippets[:3] if row.source_snippets else []
        target_snippets = row.target_snippets[:3] if row.target_snippets else []
        connections_text += f"\n\n## {row.source_name} <-> {row.target_name}\n"
        connections_text += f"关联强度: {row.avg_strength:.2%}, 连接数: {row.link_count}\n"
        connections_text += f"来源片段: {'; '.join(s for s in source_snippets if s)}\n"
        connections_text += f"目标片段: {'; '.join(s for s in target_snippets if s)}\n"

    prompt = f"""你是一个跨行业创新顾问。以下是从多个行业知识库中发现的知识关联：

{connections_text}

请基于这些跨行业关联，生成 3 个创意洞察。每个洞察包含：
1. 标题（简洁有力）
2. 核心思路（2-3句话描述跨行业创新机会）
3. 可行性建议（具体的行动方向）

用 JSON 数组格式输出，每个元素包含 title 和 content 字段。只输出 JSON，不要其他内容。"""

    # 调用 AI 生成
    full_response = ""
    async for chunk in stream_chat(
        [{"role": "user", "content": prompt}],
        provider="claude",
        db=db,
    ):
        if chunk.type == "text":
            full_response += chunk.content

    # 解析并保存洞察
    import json
    insights_created = []
    try:
        # 提取 JSON
        start = full_response.find("[")
        end = full_response.rfind("]") + 1
        if start >= 0 and end > start:
            items = json.loads(full_response[start:end])
            kb_ids = list(set(
                [str(r.source_kb_id) for r in rows] + [str(r.target_kb_id) for r in rows]
            ))
            for item in items:
                insight = Insight(
                    title=item.get("title", "未命名洞察"),
                    content=item.get("content", ""),
                    related_kb_ids=kb_ids,
                    status="new",
                )
                db.add(insight)
                insights_created.append({"title": insight.title, "content": insight.content})
            await db.commit()
    except (json.JSONDecodeError, KeyError):
        pass

    return insights_created
