"""Case Management API (Module 5).

RBAC:
  - Any user can create cases and read/update their OWN cases.
  - CASEWORKER/REVIEWER/ADMIN (CASE_READ_ANY) can read any case.
  - CASEWORKER/ADMIN (CASE_UPDATE_ANY / CASE_ASSIGN) can update/assign any case.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.roles import Permission, has_permission
from app.db import get_db
from app.models import Case, CaseEvent, Evidence, User
from app.schemas import (CaseCreate, CaseEventIn, CaseEventOut, CaseOut,
                         CaseSummary, CaseUpdate, EvidenceIn, EvidenceOut)
from app.services.auth import require_user
from app.services.cases import CaseService

router = APIRouter(prefix="/cases", tags=["cases"])


def _event_out(e: CaseEvent) -> CaseEventOut:
    return CaseEventOut(id=e.id, created_at=e.created_at.isoformat(), actor_id=e.actor_id,
                        kind=e.kind, title=e.title or "", body=e.body or "")


def _evidence_out(e: Evidence) -> EvidenceOut:
    return EvidenceOut(id=e.id, label=e.label, kind=e.kind,
                       description=e.description or "", detection_id=e.detection_id)


def _case_out(c: Case) -> CaseOut:
    return CaseOut(
        id=c.id, title=c.title, category=c.category, jurisdiction=c.jurisdiction,
        status=c.status, priority=c.priority, summary=c.summary or "",
        owner_id=c.owner_id, assignee_id=c.assignee_id, detection_id=c.detection_id,
        events=[_event_out(e) for e in sorted(c.events, key=lambda x: x.created_at)],
        evidence=[_evidence_out(e) for e in c.evidence],
    )


def _load_readable(case_id: str, db: Session, user: User) -> Case:
    case = db.get(Case, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if case.owner_id == user.id or case.assignee_id == user.id:
        return case
    if has_permission(user.role, Permission.CASE_READ_ANY):
        return case
    raise HTTPException(status_code=403, detail="You cannot access this case.")


def _can_update(case: Case, user: User) -> bool:
    return case.owner_id == user.id or has_permission(user.role, Permission.CASE_UPDATE_ANY)


@router.post("", response_model=CaseOut)
def create_case(req: CaseCreate, db: Session = Depends(get_db), user: User = Depends(require_user)):
    case = CaseService(db).create(
        owner_id=user.id, title=req.title, category=req.category,
        jurisdiction=req.jurisdiction, priority=req.priority, summary=req.summary,
        detection_id=req.detection_id)
    return _case_out(case)


@router.get("", response_model=list[CaseSummary])
def list_cases(db: Session = Depends(get_db), user: User = Depends(require_user)):
    q = db.query(Case)
    if not has_permission(user.role, Permission.CASE_READ_ANY):
        q = q.filter((Case.owner_id == user.id) | (Case.assignee_id == user.id))
    rows = q.order_by(Case.updated_at.desc()).limit(100).all()
    return [CaseSummary(id=c.id, title=c.title, category=c.category,
                        status=c.status, priority=c.priority) for c in rows]


@router.get("/analytics")
def case_analytics(db: Session = Depends(get_db), user: User = Depends(require_user)):
    owner = None if has_permission(user.role, Permission.CASE_READ_ANY) else user.id
    return CaseService(db).analytics(owner_id=owner)


@router.get("/{case_id}", response_model=CaseOut)
def get_case(case_id: str, db: Session = Depends(get_db), user: User = Depends(require_user)):
    return _case_out(_load_readable(case_id, db, user))


@router.patch("/{case_id}", response_model=CaseOut)
def update_case(case_id: str, req: CaseUpdate, db: Session = Depends(get_db),
                user: User = Depends(require_user)):
    case = _load_readable(case_id, db, user)
    if not _can_update(case, user):
        raise HTTPException(status_code=403, detail="You cannot update this case.")
    if req.assignee_id is not None and not has_permission(user.role, Permission.CASE_ASSIGN):
        raise HTTPException(status_code=403, detail="You cannot assign cases.")
    case = CaseService(db).update(case, actor_id=user.id, status=req.status,
                                  priority=req.priority, assignee_id=req.assignee_id,
                                  summary=req.summary)
    return _case_out(case)


@router.post("/{case_id}/events", response_model=CaseEventOut)
def add_event(case_id: str, req: CaseEventIn, db: Session = Depends(get_db),
              user: User = Depends(require_user)):
    case = _load_readable(case_id, db, user)
    ev = CaseService(db).add_event(case.id, user.id, req.kind, req.title, req.body)
    return _event_out(ev)


@router.post("/{case_id}/evidence", response_model=EvidenceOut)
def add_evidence(case_id: str, req: EvidenceIn, db: Session = Depends(get_db),
                 user: User = Depends(require_user)):
    case = _load_readable(case_id, db, user)
    if not _can_update(case, user):
        raise HTTPException(status_code=403, detail="You cannot modify this case.")
    ev = CaseService(db).add_evidence(case.id, req.label, req.kind, req.description, req.detection_id)
    return _evidence_out(ev)
