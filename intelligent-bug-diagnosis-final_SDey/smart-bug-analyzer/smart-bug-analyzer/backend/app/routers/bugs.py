import json
import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db
from app.auth import get_current_user
from app.agents.orchestrator import AgentOrchestrator
from app.services import notifications as notif_service
from app.services.pdf_report import generate_bug_report_pdf
from app.services.ocr import is_image_filename, extract_text_from_image

router = APIRouter(prefix="/api/bugs", tags=["bugs"])

orchestrator = AgentOrchestrator()

# backend/app/routers/bugs.py -> backend/ -> repo root -> uploads/
# backend/app/routers/bugs.py -> backend/ -> repo root -> uploads/
# Overridable via the UPLOAD_DIR env var (used by the test suite so tests
# never write into the real repo's uploads/ folder) — read lazily inside
# the handler rather than cached at import time, so overriding it after
# the app has already been imported (as the test fixtures do) still works.
_DEFAULT_UPLOAD_ROOT = Path(__file__).resolve().parents[3] / "uploads"


def _upload_root() -> Path:
    override = os.environ.get("UPLOAD_DIR")
    return Path(override) if override else _DEFAULT_UPLOAD_ROOT
ALLOWED_UPLOAD_EXTENSIONS = {".txt", ".log", ".json", ".xml", ".csv", ".png", ".jpg", ".jpeg", ".zip"}
MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB


def _log_event(db: Session, bug_id: int, event_type: str, detail: Optional[str], actor_id: Optional[int]):
    db.add(models.BugEvent(bug_id=bug_id, event_type=event_type, detail=detail, actor_id=actor_id))


def _get_bug_or_404(db: Session, bug_id: int, with_relations: bool = False) -> models.Bug:
    query = db.query(models.Bug)
    if with_relations:
        query = query.options(
            joinedload(models.Bug.comments).joinedload(models.Comment.author),
            joinedload(models.Bug.attachments),
            joinedload(models.Bug.events).joinedload(models.BugEvent.actor),
            joinedload(models.Bug.analysis),
        )
    bug = query.filter(models.Bug.id == bug_id).first()
    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")
    return bug


def _build_analysis_out(analysis: models.BugAnalysis) -> schemas.BugAnalysisOut:
    duplicates = json.loads(analysis.duplicates_json) if analysis.duplicates_json else []
    best_practices = json.loads(analysis.best_practices) if analysis.best_practices else []
    prevention_tips = json.loads(analysis.prevention_tips) if analysis.prevention_tips else []
    risk_factors = json.loads(analysis.risk_factors_json) if analysis.risk_factors_json else []
    return schemas.BugAnalysisOut(
        id=analysis.id,
        predicted_severity=analysis.predicted_severity,
        predicted_priority=analysis.predicted_priority,
        predicted_category=analysis.predicted_category,
        triage_confidence=analysis.triage_confidence or 0,
        triage_reasoning=analysis.triage_reasoning,
        exception_type=analysis.exception_type,
        failure_file=analysis.failure_file,
        failure_line=analysis.failure_line,
        failure_function=analysis.failure_function,
        log_summary=analysis.log_summary,
        duplicates=[schemas.DuplicateMatchOut(**d) for d in duplicates],
        root_cause_text=analysis.root_cause_text,
        root_cause_confidence=analysis.root_cause_confidence or 0,
        suggested_fix=analysis.suggested_fix,
        best_practices=best_practices,
        prevention_tips=prevention_tips,
        estimated_fix_time=analysis.estimated_fix_time,
        risk_score=analysis.risk_score or 0,
        risk_level=analysis.risk_level or "Minimal",
        risk_summary=analysis.risk_summary,
        risk_factors=[schemas.RiskFactorOut(**f) for f in risk_factors],
        created_at=analysis.created_at,
        updated_at=analysis.updated_at,
    )


def _to_detail_out(bug: models.Bug) -> schemas.BugDetailOut:
    data = schemas.BugOut.model_validate(bug).model_dump()
    data["comments"] = [schemas.CommentOut.model_validate(c) for c in bug.comments]
    data["attachments"] = [schemas.AttachmentOut.model_validate(a) for a in bug.attachments]
    data["events"] = [schemas.BugEventOut.model_validate(e) for e in bug.events]
    data["analysis"] = _build_analysis_out(bug.analysis) if bug.analysis else None
    return schemas.BugDetailOut(**data)


@router.post("", response_model=schemas.BugOut, status_code=201)
def create_bug(
    payload: schemas.BugCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    bug = models.Bug(
        title=payload.title,
        description=payload.description,
        stack_trace=payload.stack_trace,
        category=payload.category,
        module=payload.module,
        project=payload.project,
        severity=payload.severity,
        priority=payload.priority,
        reporter_id=current_user.id,
    )
    db.add(bug)
    db.flush()  # assigns bug.id before we log an event referencing it
    _log_event(db, bug.id, "created", f"Bug reported by {current_user.full_name}", current_user.id)

    if bug.severity == models.SeverityEnum.critical:
        recipients = db.query(models.User).filter(models.User.role.in_(["Admin", "Team Lead"])).all()
        notif_service.notify_critical_bug(db, bug, recipients)

    db.commit()
    db.refresh(bug)
    return bug


@router.get("", response_model=schemas.BugListResponse)
def list_bugs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    search: Optional[str] = None,
    severity: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    query = db.query(models.Bug)

    if search:
        like = f"%{search}%"
        query = query.filter(or_(models.Bug.title.ilike(like), models.Bug.description.ilike(like)))
    if severity:
        query = query.filter(models.Bug.severity == severity)
    if status_filter:
        query = query.filter(models.Bug.status == status_filter)
    if priority:
        query = query.filter(models.Bug.priority == priority)

    total = query.count()
    items = (
        query.order_by(models.Bug.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return schemas.BugListResponse(total=total, items=items)


@router.get("/{bug_id}", response_model=schemas.BugDetailOut)
def get_bug(
    bug_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    bug = _get_bug_or_404(db, bug_id, with_relations=True)
    return _to_detail_out(bug)


@router.patch("/{bug_id}", response_model=schemas.BugOut)
def update_bug(
    bug_id: int,
    payload: schemas.BugUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    bug = _get_bug_or_404(db, bug_id)
    import datetime as _dt

    if payload.status is not None and payload.status != bug.status:
        _log_event(db, bug.id, "status_changed", f"{bug.status.value} → {payload.status.value}", current_user.id)
        bug.status = payload.status
        if payload.status in (models.StatusEnum.resolved, models.StatusEnum.closed):
            bug.resolved_at = _dt.datetime.utcnow()
            if bug.reporter_id != current_user.id:
                notif_service.notify_bug_resolved(db, bug)
        else:
            bug.resolved_at = None
    if payload.severity is not None:
        bug.severity = payload.severity
    if payload.priority is not None:
        bug.priority = payload.priority
    if payload.resolution_notes is not None:
        bug.resolution_notes = payload.resolution_notes
        _log_event(db, bug.id, "resolution_notes_updated", None, current_user.id)
    if payload.stack_trace is not None:
        bug.stack_trace = payload.stack_trace
        _log_event(db, bug.id, "stack_trace_updated", None, current_user.id)

    db.commit()
    db.refresh(bug)
    return bug


@router.patch("/{bug_id}/assign", response_model=schemas.BugOut)
def assign_bug(
    bug_id: int,
    payload: schemas.BugAssign,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    bug = _get_bug_or_404(db, bug_id)

    if payload.assignee_id is not None:
        assignee = db.query(models.User).filter(models.User.id == payload.assignee_id).first()
        if not assignee:
            raise HTTPException(status_code=404, detail="Assignee user not found")
        bug.assignee_id = assignee.id
        _log_event(db, bug.id, "assigned", f"Assigned to {assignee.full_name}", current_user.id)
        if assignee.id != current_user.id:
            notif_service.notify_bug_assigned(db, bug, assignee)
    else:
        bug.assignee_id = None
        _log_event(db, bug.id, "unassigned", None, current_user.id)

    db.commit()
    db.refresh(bug)
    return bug


@router.delete("/{bug_id}", status_code=204)
def delete_bug(
    bug_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    bug = _get_bug_or_404(db, bug_id)
    db.delete(bug)
    db.commit()
    return None


# ---------- Comments ----------

@router.post("/{bug_id}/comments", response_model=schemas.CommentOut, status_code=201)
def add_comment(
    bug_id: int,
    payload: schemas.CommentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    bug = _get_bug_or_404(db, bug_id)
    comment = models.Comment(bug_id=bug.id, author_id=current_user.id, body=payload.body)
    db.add(comment)
    _log_event(db, bug.id, "comment_added", payload.body[:120], current_user.id)
    db.commit()
    db.refresh(comment)
    return comment


# ---------- Attachments ----------

@router.post("/{bug_id}/attachments", response_model=schemas.AttachmentOut, status_code=201)
async def upload_attachment(
    bug_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    bug = _get_bug_or_404(db, bug_id)

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext or 'unknown'}' not allowed. Allowed: {', '.join(sorted(ALLOWED_UPLOAD_EXTENSIONS))}",
        )

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File exceeds the 20 MB upload limit.")

    bug_dir = _upload_root() / str(bug_id)
    bug_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    stored_path = bug_dir / stored_name
    with open(stored_path, "wb") as f:
        f.write(contents)

    attachment = models.Attachment(
        bug_id=bug.id,
        filename=file.filename or stored_name,
        stored_path=str(stored_path),
        content_type=file.content_type,
        size_bytes=len(contents),
        uploaded_by_id=current_user.id,
    )

    if is_image_filename(file.filename or ""):
        attachment.extracted_text = extract_text_from_image(contents)

    db.add(attachment)
    _log_event(db, bug.id, "attachment_added", file.filename, current_user.id)
    db.commit()
    db.refresh(attachment)
    return attachment


# ---------- AI Multi-Agent Analysis ----------

@router.post("/{bug_id}/analyze", response_model=schemas.BugAnalysisOut)
def analyze_bug(
    bug_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    bug = _get_bug_or_404(db, bug_id)

    other_bugs = db.query(models.Bug).filter(models.Bug.id != bug.id).all()
    corpus = [
        {
            "id": b.id,
            "title": b.title,
            "description": b.description,
            "status": b.status.value if hasattr(b.status, "value") else b.status,
            "resolution_notes": b.resolution_notes,
        }
        for b in other_bugs
    ]

    result = orchestrator.run(
        title=bug.title,
        description=bug.description,
        stack_trace=bug.stack_trace,
        corpus=corpus,
    )

    analysis = bug.analysis or models.BugAnalysis(bug_id=bug.id)

    analysis.predicted_severity = result.triage.severity
    analysis.predicted_priority = result.triage.priority
    analysis.predicted_category = result.triage.category
    analysis.triage_confidence = result.triage.confidence
    analysis.triage_reasoning = result.triage.reasoning

    analysis.exception_type = result.log_analysis.exception_type
    analysis.failure_file = result.log_analysis.failure_file
    analysis.failure_line = result.log_analysis.failure_line
    analysis.failure_function = result.log_analysis.failure_function
    analysis.log_summary = result.log_analysis.summary

    analysis.duplicates_json = json.dumps([
        {
            "bug_id": d.bug_id,
            "title": d.title,
            "similarity": d.similarity,
            "status": d.status,
            "resolution_notes": d.resolution_notes,
        }
        for d in result.duplicates
    ])

    analysis.root_cause_text = result.root_cause.explanation
    analysis.root_cause_confidence = result.root_cause.confidence
    analysis.grounded_on_json = json.dumps(result.root_cause.grounded_in)

    analysis.suggested_fix = result.remediation.suggested_fix
    analysis.best_practices = json.dumps(result.remediation.best_practices)
    analysis.prevention_tips = json.dumps(result.remediation.prevention_tips)
    analysis.estimated_fix_time = f"{result.remediation.estimated_fix_time_hours}h"

    # AI Bug Risk Score
    analysis.risk_score = result.risk_score.score
    analysis.risk_level = result.risk_score.level
    analysis.risk_summary = result.risk_score.summary
    analysis.risk_factors_json = json.dumps([
        {
            "label": factor.label,
            "points": factor.points,
            "detail": factor.detail,
        }
        for factor in result.risk_score.factors
    ])

    db.add(analysis)
    _log_event(db, bug.id, "ai_analysis_run", f"Predicted {result.triage.severity}/{result.triage.priority}", current_user.id)
    notif_service.notify_ai_analysis_complete(db, bug)
    db.commit()
    db.refresh(analysis)

    return _build_analysis_out(analysis)


@router.get("/{bug_id}/analysis", response_model=schemas.BugAnalysisOut)
def get_bug_analysis(
    bug_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    bug = _get_bug_or_404(db, bug_id)
    if not bug.analysis:
        raise HTTPException(status_code=404, detail="This bug hasn't been analyzed yet.")
    return _build_analysis_out(bug.analysis)


@router.get("/{bug_id}/report")
def download_bug_report(
    bug_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Downloadable PDF summary of the bug: core details, AI analysis (if run),
    and resolution notes. Generated on demand with reportlab — no stored
    file, no system-level PDF dependencies.
    """
    bug = _get_bug_or_404(db, bug_id, with_relations=True)
    pdf_bytes = generate_bug_report_pdf(bug)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="bug_{bug.id}_report.pdf"'},
    )
