from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.auth import get_current_user

router = APIRouter(prefix="/api/knowledge-base", tags=["knowledge-base"])


@router.get("", response_model=schemas.KnowledgeBaseResponse)
def list_knowledge_base(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    search: Optional[str] = None,
    category: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    """
    The knowledge base is every resolved/closed bug that has resolution
    notes — the team's accumulated "how we actually fixed this" record.
    There's no separate table: it's a filtered, searchable view over Bug,
    which keeps it perfectly in sync as bugs get resolved with no extra
    write path to maintain.
    """
    query = db.query(models.Bug).filter(
        models.Bug.status.in_([models.StatusEnum.resolved, models.StatusEnum.closed]),
        models.Bug.resolution_notes.isnot(None),
        models.Bug.resolution_notes != "",
    )

    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                models.Bug.title.ilike(like),
                models.Bug.description.ilike(like),
                models.Bug.resolution_notes.ilike(like),
            )
        )
    if category:
        query = query.filter(models.Bug.category == category)

    total = query.count()
    items = (
        query.order_by(models.Bug.resolved_at.desc().nullslast())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return schemas.KnowledgeBaseResponse(total=total, items=items)
