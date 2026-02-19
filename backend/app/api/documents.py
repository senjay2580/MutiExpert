from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sa_delete
from app.database import get_db
from app.models.knowledge import Document, KnowledgeBase
from app.models.network import DocumentChunk
from app.schemas.knowledge_base import DocumentResponse
from app.services.document_pipeline import process_document

router = APIRouter()


@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{doc_id}", status_code=204)
async def delete_document(doc_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    kb_result = await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == doc.knowledge_base_id))
    kb = kb_result.scalar_one_or_none()
    if kb and kb.document_count > 0:
        kb.document_count -= 1
    await db.delete(doc)
    await db.commit()


@router.post("/{doc_id}/reprocess")
async def reprocess_document(
    doc_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    # 清除旧分块
    await db.execute(sa_delete(DocumentChunk).where(DocumentChunk.document_id == doc_id))
    doc.status = "processing"
    doc.chunk_count = 0
    doc.error_message = None
    await db.commit()
    background_tasks.add_task(process_document, doc_id)
    return {"message": "Reprocessing started", "document_id": str(doc_id)}
