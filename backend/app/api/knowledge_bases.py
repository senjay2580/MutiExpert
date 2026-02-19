from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.knowledge import KnowledgeBase, Document
from app.schemas.knowledge_base import KnowledgeBaseCreate, KnowledgeBaseUpdate, KnowledgeBaseResponse, DocumentResponse
from app.services.document_parser import parse_document
from app.services.document_pipeline import process_document

router = APIRouter()


@router.get("/", response_model=list[KnowledgeBaseResponse])
async def list_knowledge_bases(
    industry_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(KnowledgeBase).order_by(KnowledgeBase.updated_at.desc())
    if industry_id:
        query = query.where(KnowledgeBase.industry_id == industry_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=KnowledgeBaseResponse, status_code=201)
async def create_knowledge_base(data: KnowledgeBaseCreate, db: AsyncSession = Depends(get_db)):
    kb = KnowledgeBase(**data.model_dump())
    db.add(kb)
    await db.commit()
    await db.refresh(kb)
    return kb


@router.get("/{kb_id}", response_model=KnowledgeBaseResponse)
async def get_knowledge_base(kb_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == kb_id))
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return kb


@router.put("/{kb_id}", response_model=KnowledgeBaseResponse)
async def update_knowledge_base(kb_id: UUID, data: KnowledgeBaseUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == kb_id))
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(kb, key, value)
    await db.commit()
    await db.refresh(kb)
    return kb


@router.delete("/{kb_id}", status_code=204)
async def delete_knowledge_base(kb_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == kb_id))
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    await db.delete(kb)
    await db.commit()


@router.get("/{kb_id}/documents", response_model=list[DocumentResponse])
async def list_documents(kb_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Document)
        .where(Document.knowledge_base_id == kb_id)
        .order_by(Document.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{kb_id}/documents/upload", response_model=DocumentResponse, status_code=201)
async def upload_document(
    kb_id: UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    # Verify KB exists
    result = await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == kb_id))
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    # Determine file type
    filename = file.filename or "unknown"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ("pdf", "docx", "md"):
        raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, DOCX, or MD.")

    # Read file content
    content = await file.read()

    # Parse text
    try:
        text = await parse_document(content, ext)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse document: {str(e)}")

    # Create document record
    doc = Document(
        knowledge_base_id=kb_id,
        title=filename,
        file_type=ext,
        file_size=len(content),
        content_text=text,
        status="processing",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Trigger background processing (chunking + embedding)
    background_tasks.add_task(process_document, doc.id)

    return doc


@router.get("/{kb_id}/stats")
async def get_kb_stats(kb_id: UUID, db: AsyncSession = Depends(get_db)):
    doc_count = await db.execute(
        select(func.count(Document.id)).where(Document.knowledge_base_id == kb_id)
    )
    ready_count = await db.execute(
        select(func.count(Document.id)).where(
            Document.knowledge_base_id == kb_id,
            Document.status == "ready",
        )
    )
    return {
        "total_documents": doc_count.scalar() or 0,
        "ready_documents": ready_count.scalar() or 0,
    }
