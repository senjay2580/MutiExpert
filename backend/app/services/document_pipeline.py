"""文档处理管线 - 上传 → 解析 → 分块 → 向量化 → 存储"""
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.knowledge import Document, KnowledgeBase
from app.models.network import DocumentChunk
from app.services.document_parser import parse_document
from app.services.embedding_service import generate_embeddings
from app.core.chunking import chunk_text
from app.database import AsyncSessionLocal


async def process_document(document_id: uuid.UUID):
    """后台处理文档：解析 → 分块 → 向量化 → 存储分块"""
    if AsyncSessionLocal is None:
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Document).where(Document.id == document_id))
        doc = result.scalar_one_or_none()
        if not doc:
            return

        try:
            doc.status = "processing"
            await db.commit()

            # 1. 解析文档文本
            if not doc.content_text:
                doc.status = "error"
                doc.error_message = "No content to process"
                await db.commit()
                return

            # 2. 分块
            chunks = chunk_text(doc.content_text)
            if not chunks:
                doc.status = "error"
                doc.error_message = "No valid chunks generated"
                await db.commit()
                return

            # 3. 批量生成嵌入向量
            embeddings = await generate_embeddings(chunks)

            # 4. 存储分块
            for i, (text, embedding) in enumerate(zip(chunks, embeddings)):
                chunk = DocumentChunk(
                    document_id=doc.id,
                    knowledge_base_id=doc.knowledge_base_id,
                    chunk_index=i,
                    content=text,
                    embedding=embedding,
                    metadata_={"chunk_index": i, "total_chunks": len(chunks)},
                )
                db.add(chunk)

            doc.chunk_count = len(chunks)
            doc.status = "ready"

            # 更新知识库文档计数
            kb_result = await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == doc.knowledge_base_id))
            kb = kb_result.scalar_one_or_none()
            if kb:
                kb.document_count = (kb.document_count or 0) + 1

            await db.commit()

        except Exception as e:
            doc.status = "error"
            doc.error_message = str(e)[:500]
            await db.commit()
