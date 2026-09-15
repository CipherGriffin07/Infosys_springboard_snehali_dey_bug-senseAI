import datetime
from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.auth import get_current_user
from app.services.health_score import compute_health_score

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/health-score", response_model=schemas.HealthScoreOut)
def health_score(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    result = compute_health_score(db)
    return schemas.HealthScoreOut(
        score=result.score,
        status=result.status,
        total_bugs=result.total_bugs,
        open_bugs=result.open_bugs,
        critical_open_bugs=result.critical_open_bugs,
        resolved_bugs=result.resolved_bugs,
        resolved_pct=result.resolved_pct,
        likely_duplicate_open_bugs=result.likely_duplicate_open_bugs,
        avg_resolution_hours=result.avg_resolution_hours,
        breakdown=[
            schemas.HealthScoreBreakdownOut(label=b.label, penalty=b.penalty, detail=b.detail)
            for b in result.breakdown
        ],
    )


@router.get("/team-performance", response_model=list[schemas.CountItem])
def team_performance(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Resolved bugs grouped by whoever worked on them: the assignee if one was
    set, falling back to the reporter otherwise (many small teams resolve
    their own reports without a formal assignment step).
    """
    resolved = (
        db.query(models.Bug)
        .filter(models.Bug.status.in_([models.StatusEnum.resolved, models.StatusEnum.closed]))
        .all()
    )
    counts = Counter()
    for b in resolved:
        owner = b.assignee or b.reporter
        if owner:
            counts[owner.full_name] += 1
    return [schemas.CountItem(label=k, count=v) for k, v in sorted(counts.items(), key=lambda kv: -kv[1])]


@router.get("/summary", response_model=schemas.AnalyticsSummary)
def summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    bugs = db.query(models.Bug).all()

    total_bugs = len(bugs)
    open_bugs = sum(1 for b in bugs if b.status in ("Open", "In Progress"))
    resolved_bugs = sum(1 for b in bugs if b.status in ("Resolved", "Closed"))
    critical_bugs = sum(1 for b in bugs if b.severity == "Critical")

    severity_counts = Counter(b.severity.value if hasattr(b.severity, "value") else b.severity for b in bugs)
    priority_counts = Counter(b.priority.value if hasattr(b.priority, "value") else b.priority for b in bugs)
    status_counts = Counter(b.status.value if hasattr(b.status, "value") else b.status for b in bugs)
    category_counts = Counter((b.category or "Uncategorized") for b in bugs)

    today = datetime.date.today()
    trend = []
    counts_by_day = Counter()
    for b in bugs:
        d = b.created_at.date() if b.created_at else today
        counts_by_day[d] += 1

    for i in range(29, -1, -1):
        day = today - datetime.timedelta(days=i)
        trend.append(schemas.TimeSeriesPoint(date=day.isoformat(), count=counts_by_day.get(day, 0)))

    return schemas.AnalyticsSummary(
        total_bugs=total_bugs,
        open_bugs=open_bugs,
        resolved_bugs=resolved_bugs,
        critical_bugs=critical_bugs,
        by_severity=[schemas.CountItem(label=k, count=v) for k, v in severity_counts.items()],
        by_priority=[schemas.CountItem(label=k, count=v) for k, v in priority_counts.items()],
        by_status=[schemas.CountItem(label=k, count=v) for k, v in status_counts.items()],
        by_category=[schemas.CountItem(label=k, count=v) for k, v in category_counts.items()],
        trend_last_30_days=trend,
    )
