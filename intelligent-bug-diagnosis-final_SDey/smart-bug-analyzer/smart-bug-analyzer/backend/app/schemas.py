import datetime
from typing import Optional, List

from pydantic import BaseModel, EmailStr, ConfigDict

from app.models import SeverityEnum, PriorityEnum, StatusEnum


# ---------- Auth / Users ----------

class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: Optional[str] = "Developer"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    role: str
    created_at: datetime.datetime


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Bugs ----------

class BugCreate(BaseModel):
    title: str
    description: str
    stack_trace: Optional[str] = None
    category: Optional[str] = None
    module: Optional[str] = None
    project: Optional[str] = None
    severity: SeverityEnum = SeverityEnum.medium
    priority: PriorityEnum = PriorityEnum.p2


class BugUpdate(BaseModel):
    status: Optional[StatusEnum] = None
    severity: Optional[SeverityEnum] = None
    priority: Optional[PriorityEnum] = None
    resolution_notes: Optional[str] = None
    stack_trace: Optional[str] = None


class ReporterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr


class BugOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    stack_trace: Optional[str]
    category: Optional[str]
    module: Optional[str] = None
    project: Optional[str] = None
    severity: SeverityEnum
    priority: PriorityEnum
    status: StatusEnum
    resolution_notes: Optional[str]
    resolved_at: Optional[datetime.datetime] = None
    reporter: ReporterOut
    assignee: Optional[ReporterOut] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime


class BugAssign(BaseModel):
    assignee_id: Optional[int] = None


class BugListResponse(BaseModel):
    total: int
    items: List[BugOut]


# ---------- Comments / Attachments / Timeline ----------

class CommentCreate(BaseModel):
    body: str


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    body: str
    author: ReporterOut
    created_at: datetime.datetime


class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    content_type: Optional[str]
    size_bytes: int
    extracted_text: Optional[str] = None
    created_at: datetime.datetime


class BugEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: str
    detail: Optional[str]
    actor: Optional[ReporterOut] = None
    created_at: datetime.datetime


# ---------- AI Analysis ----------

class DuplicateMatchOut(BaseModel):
    bug_id: int
    title: str
    similarity: float
    status: str
    resolution_notes: Optional[str] = None


class RiskFactorOut(BaseModel):
    label: str
    points: int
    detail: str


class BugAnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int

    # Triage Agent
    predicted_severity: Optional[SeverityEnum]
    predicted_priority: Optional[PriorityEnum]
    predicted_category: Optional[str]
    triage_confidence: int
    triage_reasoning: Optional[str] = None

    # Log Analysis Agent
    exception_type: Optional[str]
    failure_file: Optional[str]
    failure_line: Optional[str]
    failure_function: Optional[str]
    log_summary: Optional[str]

    # Duplicate Detection Agent
    duplicates: List[DuplicateMatchOut] = []

    # Root Cause Agent
    root_cause_text: Optional[str]
    root_cause_confidence: int

    # Remediation Agent
    suggested_fix: Optional[str]
    best_practices: List[str] = []
    prevention_tips: List[str] = []
    estimated_fix_time: Optional[str]

    # AI Risk Score
    risk_score: int = 0
    risk_level: str = "Minimal"
    risk_summary: Optional[str] = None
    risk_factors: List[RiskFactorOut] = []

    created_at: datetime.datetime
    updated_at: datetime.datetime


class BugDetailOut(BugOut):
    comments: List[CommentOut] = []
    attachments: List[AttachmentOut] = []
    events: List[BugEventOut] = []
    analysis: Optional[BugAnalysisOut] = None


# ---------- Knowledge Base ----------

class KnowledgeBaseEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    category: Optional[str]
    module: Optional[str] = None
    project: Optional[str] = None
    severity: SeverityEnum
    resolution_notes: str
    resolved_at: Optional[datetime.datetime]
    reporter: ReporterOut


class KnowledgeBaseResponse(BaseModel):
    total: int
    items: List[KnowledgeBaseEntryOut]


# ---------- Project Health Score ----------

class HealthScoreBreakdownOut(BaseModel):
    label: str
    penalty: float
    detail: str


class HealthScoreOut(BaseModel):
    score: int
    status: str
    total_bugs: int
    open_bugs: int
    critical_open_bugs: int
    resolved_bugs: int
    resolved_pct: float
    likely_duplicate_open_bugs: int
    avg_resolution_hours: float
    breakdown: List[HealthScoreBreakdownOut]


# ---------- AI Chat Assistant ----------

class ChatRequest(BaseModel):
    message: str
    context_bug_id: Optional[int] = None


class ChatResponse(BaseModel):
    reply: str
    related_bug_ids: List[int] = []


# ---------- Analytics ----------

class CountItem(BaseModel):
    label: str
    count: int


class TimeSeriesPoint(BaseModel):
    date: str
    count: int


class AnalyticsSummary(BaseModel):
    total_bugs: int
    open_bugs: int
    resolved_bugs: int
    critical_bugs: int
    by_severity: List[CountItem]
    by_priority: List[CountItem]
    by_status: List[CountItem]
    by_category: List[CountItem]
    trend_last_30_days: List[TimeSeriesPoint]


# ---------- Admin Panel ----------

class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    role: str
    created_at: datetime.datetime
    bugs_reported: int = 0
    bugs_assigned: int = 0


class AdminUserRoleUpdate(BaseModel):
    role: str


class AdminUserListResponse(BaseModel):
    total: int
    items: List[AdminUserOut]


# ---------- Notifications ----------

class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    message: str
    related_bug_id: Optional[int] = None
    is_read: bool
    created_at: datetime.datetime


class NotificationListResponse(BaseModel):
    total: int
    unread_count: int
    items: List[NotificationOut]