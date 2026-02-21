from uuid import UUID
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import Response, RedirectResponse
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
    if doc.file_type == "link":
        raise HTTPException(status_code=400, detail="Link documents do not support reprocessing")
    # 清除旧分块
    await db.execute(sa_delete(DocumentChunk).where(DocumentChunk.document_id == doc_id))
    doc.status = "processing"
    doc.chunk_count = 0
    doc.error_message = None
    await db.commit()
    background_tasks.add_task(process_document, doc_id)
    return {"message": "Reprocessing started", "document_id": str(doc_id)}


@router.get("/{doc_id}/download")
async def download_document(doc_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.file_type in ("md", "pdf", "docx"):
        content = doc.content_text or ""
        if doc.file_type == "md":
            ext, media = ".md", "text/markdown; charset=utf-8"
        else:
            ext, media = ".txt", "text/plain; charset=utf-8"
        safe_title = doc.title.rsplit(".", 1)[0] if "." in doc.title else doc.title
        filename_encoded = quote(safe_title + ext)
        return Response(
            content=content.encode("utf-8"),
            media_type=media,
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename_encoded}"},
        )
    elif doc.file_type == "article":
        content = doc.content_html or doc.content_text or ""
        filename_encoded = quote(doc.title + ".html")
        return Response(
            content=content.encode("utf-8"),
            media_type="text/html; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename_encoded}"},
        )
    elif doc.file_type == "link":
        if doc.source_url:
            return RedirectResponse(url=doc.source_url)
        raise HTTPException(status_code=400, detail="No source URL available")
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {doc.file_type}")


@router.get("/{doc_id}/preview")
async def preview_document(doc_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.file_type in ("md", "pdf", "docx"):
        content = doc.content_text or ""
        return Response(content=content, media_type="text/plain; charset=utf-8")
    elif doc.file_type == "article":
        content = doc.content_html or ""
        html_page = (
            "<!DOCTYPE html><html><head><meta charset='utf-8'>"
            f"<title>{doc.title}</title>"
            "<style>body{max-width:800px;margin:0 auto;padding:2rem;"
            "font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#333}"
            "img{max-width:100%}</style>"
            f"</head><body>{content}</body></html>"
        )
        return Response(content=html_page, media_type="text/html; charset=utf-8")
    elif doc.file_type == "link":
        if doc.source_url:
            return RedirectResponse(url=doc.source_url)
        raise HTTPException(status_code=400, detail="No source URL available")
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {doc.file_type}")
