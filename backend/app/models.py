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
