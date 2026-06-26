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


class TokenOut(BaseModel):
    token: str
    user: UserOut


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
