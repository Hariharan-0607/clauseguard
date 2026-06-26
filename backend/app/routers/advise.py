"""POST /advise — plain-language legal advisor for the common person.

Takes a described situation and returns a structured action plan (rights, steps,
documents, where to get help), grounded in the jurisdiction rule pack.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AdvicePlan, User
from app.schemas import (AdviseRequest, AdviseResponse, PlanSummary,
                         SavedPlanOut)
from app.services import ai
from app.services.ai import AIError
from app.services.auth import require_user
from app.services.rights import load_rules

router = APIRouter(tags=["advise"])


def _plan_out(p: AdvicePlan) -> SavedPlanOut:
    return SavedPlanOut(id=p.id, title=p.title, category=p.category, urgency=p.urgency,
                        summary=p.summary, rights=p.rights or [], steps=p.steps or [],
                        documents=p.documents or [], deadline_note=p.deadline_note or "",
                        help=p.help or "")


@router.post("/advise", response_model=AdviseResponse)
def advise(req: AdviseRequest):
    if not req.situation.strip() or len(req.situation.strip()) < 8:
        raise HTTPException(status_code=400, detail="Please describe your situation in a sentence or two.")

    rules = load_rules(req.jurisdiction)
    context = "\n".join(
        f"- {r.get('plain_reason', '')} ({r.get('citation', '')})"
        for r in rules if r.get("plain_reason")
    ) or "No specific rules loaded; give general guidance and point to local legal aid."

    try:
        plan = ai.advise(req.situation, req.jurisdiction, context, req.language)
    except AIError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return AdviseResponse(**plan)


@router.post("/advise/save", response_model=SavedPlanOut)
def save_plan(plan: AdviseResponse, db: Session = Depends(get_db),
              user: User = Depends(require_user)):
    row = AdvicePlan(
        user_id=user.id, title=plan.title, category=plan.category, urgency=plan.urgency,
        summary=plan.summary, rights=plan.rights, steps=plan.steps, documents=plan.documents,
        deadline_note=plan.deadline_note, help=plan.help,
    )
    db.add(row); db.commit(); db.refresh(row)
    return _plan_out(row)


@router.get("/advise/plans", response_model=list[PlanSummary])
def list_plans(db: Session = Depends(get_db), user: User = Depends(require_user)):
    rows = (db.query(AdvicePlan).filter(AdvicePlan.user_id == user.id)
            .order_by(AdvicePlan.created_at.desc()).limit(50).all())
    return [PlanSummary(id=p.id, title=p.title, category=p.category, urgency=p.urgency,
                        summary=p.summary) for p in rows]


@router.get("/advise/plans/{plan_id}", response_model=SavedPlanOut)
def get_plan(plan_id: str, db: Session = Depends(get_db), user: User = Depends(require_user)):
    p = db.get(AdvicePlan, plan_id)
    if not p or p.user_id != user.id:
        raise HTTPException(status_code=404, detail="Plan not found")
    return _plan_out(p)
