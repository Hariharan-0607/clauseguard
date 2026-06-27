"""SQLAlchemy ORM models.

Privacy by design: we persist the derived analysis (explanations + verdicts),
not the raw uploaded contract image. Rows are user-deletable.
"""
import uuid
from datetime import datetime

from sqlalchemy import (JSON, Boolean, Column, DateTime, Float, ForeignKey,
                        Integer, String, Text)
from sqlalchemy.orm import relationship

from app.db import Base


def _uuid() -> str:
    return uuid.uuid4().hex


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    created_at = Column(DateTime, default=datetime.utcnow)
    email = Column(String, unique=True, index=True)
    name = Column(String, default="")
    password_hash = Column(String)
    role = Column(String, default="user", nullable=False)   # RBAC: user|caseworker|reviewer|admin

    analyses = relationship("Analysis", back_populates="user")
    deadlines = relationship("Deadline", back_populates="user", cascade="all, delete-orphan")
    plans = relationship("AdvicePlan", back_populates="user", cascade="all, delete-orphan")


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(String, primary_key=True, default=_uuid)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    title = Column(String, default="Contract")
    jurisdiction = Column(String, default="IN")
    language = Column(String, default="en")
    risk_level = Column(String, default="green")     # red / amber / green
    risk_score = Column(Float, default=0.0)          # 0..1
    summary = Column(Text, default="")
    counterparty = Column(String, default="")        # landlord/employer name (optional, for the map)

    user = relationship("User", back_populates="analyses")
    clauses = relationship("Clause", back_populates="analysis", cascade="all, delete-orphan")


class Clause(Base):
    __tablename__ = "clauses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    analysis_id = Column(String, ForeignKey("analyses.id"))
    order = Column(Integer, default=0)
    original = Column(Text)
    explanation = Column(Text, default="")
    verdict = Column(String, default="fair")         # fair | unfair | illegal
    reason = Column(Text, default="")
    citation = Column(String, default="")
    suggestion = Column(Text, default="")

    analysis = relationship("Analysis", back_populates="clauses")


class Report(Base):
    """Anonymous aggregate report — powers the repeat-offender map (Leaflet/OSM)."""
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    counterparty = Column(String, index=True)
    category = Column(String, default="landlord")    # landlord | employer | platform
    jurisdiction = Column(String, default="IN")
    worst_verdict = Column(String, default="unfair")
    city = Column(String, default="")
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)


class AdvicePlan(Base):
    """A saved legal-advice action plan from the Advisor."""
    __tablename__ = "advice_plans"

    id = Column(String, primary_key=True, default=_uuid)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(String, ForeignKey("users.id"))
    title = Column(String, default="Your situation")
    category = Column(String, default="other")
    urgency = Column(String, default="medium")
    summary = Column(Text, default="")
    rights = Column(JSON, default=list)
    steps = Column(JSON, default=list)
    documents = Column(JSON, default=list)
    deadline_note = Column(Text, default="")
    help = Column(Text, default="")

    user = relationship("User", back_populates="plans")


class Deadline(Base):
    """Deadline & reminder tracker — notice periods, rent due, renewals."""
    __tablename__ = "deadlines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    title = Column(String)
    kind = Column(String, default="other")           # rent | notice | renewal | payment | other
    due_date = Column(String)                         # ISO date string
    notes = Column(Text, default="")
    done = Column(Boolean, default=False)

    user = relationship("User", back_populates="deadlines")


# =========================================================================== #
#  ADVANCED MODULES
# =========================================================================== #

# --- Module: Detection Engine (covers Human Rights, Exploitation, Consumer,
#     Dark Patterns, HR Compliance, Vendor Risk via taxonomy config) ----------
class Detection(Base):
    """One run of the detection engine over a piece of text, in one domain."""
    __tablename__ = "detections"

    id = Column(String, primary_key=True, default=_uuid)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    domain = Column(String, index=True)              # human_rights | exploitation | consumer | ...
    jurisdiction = Column(String, default="IN")
    language = Column(String, default="en")
    title = Column(String, default="Document")
    subject = Column(String, default="")             # employer/landlord/vendor name (analytics)
    region = Column(String, default="")              # city/state (analytics)
    industry = Column(String, default="")            # for exploitation/vendor analytics
    risk_score = Column(Float, default=0.0)          # 0..1
    severity = Column(String, default="low")         # low | medium | high | critical

    findings = relationship("DetectionFinding", back_populates="detection",
                            cascade="all, delete-orphan")


class DetectionFinding(Base):
    """A single violation/issue found within a detection run."""
    __tablename__ = "detection_findings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    detection_id = Column(String, ForeignKey("detections.id"))
    category = Column(String, index=True)            # taxonomy category id, e.g. 'forced_labor'
    category_label = Column(String, default="")
    severity = Column(String, default="low")         # low | medium | high | critical
    probability = Column(Float, default=0.0)         # 0..1 (likelihood it's real)
    confidence = Column(Float, default=0.0)          # 0..1 (model confidence)
    evidence = Column(Text, default="")              # quoted supporting text
    explanation = Column(Text, default="")
    laws = Column(JSON, default=list)                # applicable law citations
    recommended_actions = Column(JSON, default=list)
    reviewed = Column(Boolean, default=False)        # a REVIEWER confirmed/overrode it
    review_verdict = Column(String, default="")      # confirmed | dismissed | adjusted

    detection = relationship("Detection", back_populates="findings")


# --- Module 5: Case Management --------------------------------------------- #
class Case(Base):
    __tablename__ = "cases"

    id = Column(String, primary_key=True, default=_uuid)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    owner_id = Column(String, ForeignKey("users.id"))       # the person the case is for
    assignee_id = Column(String, ForeignKey("users.id"), nullable=True)  # caseworker
    title = Column(String)
    category = Column(String, default="other")     # tenancy|employment|consumer|wages|other
    jurisdiction = Column(String, default="IN")
    status = Column(String, default="open", index=True)  # open|in_progress|filed|resolved|closed
    priority = Column(String, default="medium")    # low|medium|high|urgent
    summary = Column(Text, default="")
    detection_id = Column(String, ForeignKey("detections.id"), nullable=True)

    events = relationship("CaseEvent", back_populates="case",
                          cascade="all, delete-orphan", order_by="CaseEvent.created_at")
    evidence = relationship("Evidence", back_populates="case",
                            cascade="all, delete-orphan")


class CaseEvent(Base):
    """Timeline entry: status change, note, action, deadline, system event."""
    __tablename__ = "case_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(String, ForeignKey("cases.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    actor_id = Column(String, ForeignKey("users.id"), nullable=True)
    kind = Column(String, default="note")          # note|status|action|deadline|system
    title = Column(String, default="")
    body = Column(Text, default="")
    meta = Column(JSON, default=dict)

    case = relationship("Case", back_populates="events")


class Evidence(Base):
    """A piece of evidence attached to a case (metadata only; privacy by design)."""
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(String, ForeignKey("cases.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    label = Column(String)
    kind = Column(String, default="document")      # document|photo|message|receipt|other
    description = Column(Text, default="")
    detection_id = Column(String, ForeignKey("detections.id"), nullable=True)

    case = relationship("Case", back_populates="evidence")


# --- Modules 6 & 7: Settlement + Compensation estimates -------------------- #
class Estimate(Base):
    """A saved settlement / compensation / cost estimate (audit trail)."""
    __tablename__ = "estimates"

    id = Column(String, primary_key=True, default=_uuid)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    case_id = Column(String, ForeignKey("cases.id"), nullable=True)
    kind = Column(String, index=True)              # compensation | settlement
    currency = Column(String, default="INR")
    amount_low = Column(Float, default=0.0)
    amount_mid = Column(Float, default=0.0)
    amount_high = Column(Float, default=0.0)
    probability = Column(Float, default=0.0)       # settlement: success probability
    breakdown = Column(JSON, default=list)         # line items
    legal_basis = Column(JSON, default=list)
    inputs = Column(JSON, default=dict)            # echo of the request for audit
    notes = Column(Text, default="")


# --- Module 19: Personal Legal AI Agent ------------------------------------ #
class AgentMemory(Base):
    """Persistent memory facts for a user's personal legal agent.

    The text is also embedded into ChromaDB (namespace 'agent_<user_id>') for RAG;
    this row is the durable system-of-record + metadata.
    """
    __tablename__ = "agent_memories"

    id = Column(String, primary_key=True, default=_uuid)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    kind = Column(String, default="fact")          # fact|preference|case_ref|deadline|note
    content = Column(Text)
    source = Column(String, default="")            # where it came from (detection id, chat, etc.)


class AgentMessage(Base):
    """Conversation log for the personal agent (context continuity)."""
    __tablename__ = "agent_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    role = Column(String, default="user")          # user | assistant
    content = Column(Text)


# --- Modules 9, 10, 11: Vertical Protection Passports ---------------------- #
class Profile(Base):
    """A portable protection record for one vertical (worker / migrant / rental).

    Stores the durable, user-supplied record (employment history, certifications,
    wage records, tenancy details, etc.). Live detections/cases/estimates are
    aggregated on read to compute the trust/risk score — they are not duplicated.
    """
    __tablename__ = "profiles"

    id = Column(String, primary_key=True, default=_uuid)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    kind = Column(String, default="worker")        # worker | migrant | rental
    display_name = Column(String, default="")
    jurisdiction = Column(String, default="IN")
    records = Column(JSON, default=dict)           # vertical-specific structured record
