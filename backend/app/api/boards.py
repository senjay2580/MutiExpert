from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.board import Board
from app.schemas.board import BoardCreate, BoardUpdate, BoardResponse, BoardListItem

router = APIRouter()


@router.get("/", response_model=list[BoardListItem])
async def list_boards(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            Board.id,
            Board.name,
            Board.description,
            Board.thumbnail_url,
            func.jsonb_array_length(Board.nodes).label("node_count"),
            Board.created_at,
            Board.updated_at,
        ).order_by(Board.updated_at.desc())
    )
    rows = result.all()
    return [
        BoardListItem(
            id=r.id,
            name=r.name,
            description=r.description,
            thumbnail_url=r.thumbnail_url,
            node_count=r.node_count or 0,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@router.post("/", response_model=BoardResponse, status_code=201)
async def create_board(data: BoardCreate, db: AsyncSession = Depends(get_db)):
    board = Board(**data.model_dump())
    db.add(board)
    await db.commit()
    await db.refresh(board)
    return board


@router.get("/{board_id}", response_model=BoardResponse)
async def get_board(board_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Board).where(Board.id == board_id))
    board = result.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


@router.put("/{board_id}", response_model=BoardResponse)
async def update_board(board_id: UUID, data: BoardUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Board).where(Board.id == board_id))
    board = result.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(board, key, value)
    await db.commit()
    await db.refresh(board)
    return board


@router.delete("/{board_id}", status_code=204)
async def delete_board(board_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Board).where(Board.id == board_id))
    board = result.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    await db.delete(board)
    await db.commit()
