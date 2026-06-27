"""Pydantic request/response schemas."""
from typing import List, Optional

from pydantic import BaseModel


# --- auth ---
class SignupRequest(BaseModel):
    email: str
    password: str
    name: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str = "user"


class TokenOut(BaseModel):
    token: str
    user: UserOut


# --- admin: role management ---
class RoleUpdate(BaseModel):
    role: str                          # user | caseworker | reviewer | admin


# --- analyze ---
class AnalyzeTextRequest(BaseModel):
    text: str
    language: str = "en"
    jurisdiction: str = "IN"
    counterparty: Optional[str] = ""
    title: Optional[str] = "Contract"


class ClauseOut(BaseModel):
    order: int
    original: str
    explanation: str
    verdict: str
    reason: str
    citation: str = ""
    suggestion: str = ""


class AnalysisOut(BaseModel):
    id: str
    title: str
    jurisdiction: str
    language: str
    risk_level: str
    risk_score: float
    summary: str
    clauses: List[ClauseOut]


class AnalysisSummary(BaseModel):
    id: str
    title: str
    risk_level: str
    risk_score: float
    summary: str
    jurisdiction: str
    language: str


# --- redraft whole contract ---
class RedraftRequest(BaseModel):
    language: str = "en"


class RedraftResponse(BaseModel):
    title: str
    text: str


# --- letters ---
class LetterRequest(BaseModel):
    analysis_id: str
    letter_type: str = "complaint"
    language: str = "en"


class LetterOut(BaseModel):
    letter_type: str
    text: str


# --- reports / map ---
class ReportOut(BaseModel):
    counterparty: str
    category: str = "landlord"
    jurisdiction: str
    worst_verdict: str
    city: str = ""
    count: int
    lat: Optional[float] = None
    lon: Optional[float] = None


# --- deadlines ---
class DeadlineIn(BaseModel):
    title: str
    kind: str = "other"
    due_date: str
    notes: str = ""


class DeadlineOut(BaseModel):
    id: int
    title: str
    kind: str
    due_date: str
    notes: str
    done: bool


# --- chat ---
class ChatRequest(BaseModel):
    question: str
    jurisdiction: str = "IN"
    language: str = "en"
    page_context: str = ""      # visible text of the page the user is on (optional)
    page_name: str = ""         # human label of the current page


class ChatResponse(BaseModel):
    answer: str


# --- redline / negotiation ---
class ClauseMessageRequest(BaseModel):
    analysis_id: str
    clause_order: int
    language: str = "en"


class ClauseMessageResponse(BaseModel):
    message: str


# --- compare ---
class CompareRequest(BaseModel):
    text_a: str
    text_b: str
    label_a: str = "Contract A"
    label_b: str = "Contract B"
    jurisdiction: str = "IN"
    language: str = "en"


class CompareSide(BaseModel):
    label: str
    risk_level: str
    risk_score: float
    counts: dict
    summary: str


class CompareResponse(BaseModel):
    a: CompareSide
    b: CompareSide
    safer: str
    verdict: str
    differences: List[str]


# --- advisor ---
class AdviseRequest(BaseModel):
    situation: str
    jurisdiction: str = "IN"
    language: str = "en"


class AdviseResponse(BaseModel):
    title: str
    category: str
    summary: str
    rights: List[str]
    steps: List[str]
    documents: List[str]
    urgency: str
    deadline_note: str = ""
    help: str


class SavedPlanOut(AdviseResponse):
    id: str


class PlanSummary(BaseModel):
    id: str
    title: str
    category: str
    urgency: str
    summary: str


# =========================================================================== #
#  ADVANCED MODULE SCHEMAS
# =========================================================================== #

# --- Detection Engine ---
class DetectionRequest(BaseModel):
    domain: str                        # human_rights | exploitation | consumer | ...
    text: str
    jurisdiction: str = "IN"
    language: str = "en"
    title: str = "Document"
    subject: str = ""
    region: str = ""
    industry: str = ""


class FindingOut(BaseModel):
    id: int
    category: str
    category_label: str
    severity: str
    probability: float
    confidence: float
    evidence: str
    explanation: str
    laws: List[str]
    recommended_actions: List[str]
    reviewed: bool
    review_verdict: str


class DetectionOut(BaseModel):
    id: str
    domain: str
    jurisdiction: str
    language: str
    title: str
    subject: str
    region: str
    industry: str
    risk_score: float
    severity: str
    findings: List[FindingOut]


class DetectionSummary(BaseModel):
    id: str
    domain: str
    title: str
    risk_score: float
    severity: str
    finding_count: int


class ReviewRequest(BaseModel):
    verdict: str                       # confirmed | dismissed | adjusted


class DomainInfo(BaseModel):
    domain: str
    label: str
    description: str
    categories: List[dict]


# --- Case Management ---
class CaseCreate(BaseModel):
    title: str
    category: str = "other"
    jurisdiction: str = "IN"
    priority: str = "medium"
    summary: str = ""
    detection_id: Optional[str] = None


class CaseUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee_id: Optional[str] = None
    summary: Optional[str] = None


class CaseEventIn(BaseModel):
    kind: str = "note"
    title: str = ""
    body: str = ""


class CaseEventOut(BaseModel):
    id: int
    created_at: str
    actor_id: Optional[str] = None
    kind: str
    title: str
    body: str


class EvidenceIn(BaseModel):
    label: str
    kind: str = "document"
    description: str = ""
    detection_id: Optional[str] = None


class EvidenceOut(BaseModel):
    id: int
    label: str
    kind: str
    description: str
    detection_id: Optional[str] = None


class CaseOut(BaseModel):
    id: str
    title: str
    category: str
    jurisdiction: str
    status: str
    priority: str
    summary: str
    owner_id: str
    assignee_id: Optional[str] = None
    detection_id: Optional[str] = None
    events: List[CaseEventOut] = []
    evidence: List[EvidenceOut] = []


class CaseSummary(BaseModel):
    id: str
    title: str
    category: str
    status: str
    priority: str


# --- Estimation (Compensation + Settlement) ---
class CompensationRequest(BaseModel):
    claim_type: str                    # wage_theft|overtime|deposit|consumer|insurance|benefits
    currency: str = "INR"
    inputs: dict                       # numbers specific to the claim type
    jurisdiction: str = "IN"
    case_id: Optional[str] = None


class SettlementRequest(BaseModel):
    case_id: Optional[str] = None
    claim_amount: float
    currency: str = "INR"
    evidence_strength: float = 0.5     # 0..1
    detection_id: Optional[str] = None
    jurisdiction: str = "IN"


class CostRequest(BaseModel):
    forum: str = "civil_court"         # consumer_forum|labour_court|civil_court|high_court|tribunal
    complexity: float = 1.0            # 0.5 simple .. 2.0 complex
    claim_amount: float = 0.0
    currency: str = "INR"
    jurisdiction: str = "IN"
    case_id: Optional[str] = None


class EstimateLineItem(BaseModel):
    label: str
    amount: float
    note: str = ""


class EstimateOut(BaseModel):
    id: Optional[str] = None
    kind: str
    currency: str
    amount_low: float
    amount_mid: float
    amount_high: float
    probability: float = 0.0
    breakdown: List[EstimateLineItem]
    legal_basis: List[str]
    notes: str = ""


# --- Personal Legal Agent ---
class AgentChatRequest(BaseModel):
    message: str
    jurisdiction: str = "IN"
    language: str = "en"


class AgentChatResponse(BaseModel):
    answer: str
    used_memories: List[str] = []


class MemoryIn(BaseModel):
    content: str
    kind: str = "fact"
    source: str = ""


class MemoryOut(BaseModel):
    id: str
    kind: str
    content: str
    source: str


# --- Protection Passports (Worker / Migrant / Rental) ---
class PassportUpdate(BaseModel):
    display_name: Optional[str] = None
    jurisdiction: Optional[str] = None
    records: Optional[dict] = None


class PassportDashboard(BaseModel):
    id: str
    kind: str
    display_name: str
    jurisdiction: str
    trust_score: int
    trust_band: str
    risk_factors: List[str]
    rights: List[str]
    record_completeness: int
    stats: dict
    recent_findings: List[dict]
