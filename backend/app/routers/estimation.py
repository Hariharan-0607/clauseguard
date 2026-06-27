"""Compensation (7) + Settlement (6) estimation API."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.rbac import require_permission
from app.core.roles import Permission
from app.db import get_db
from app.models import Estimate, User
from app.schemas import (CompensationRequest, CostRequest, EstimateLineItem,
                         EstimateOut, SettlementRequest)
from app.services.estimation import EstimationService

router = APIRouter(prefix="/estimation", tags=["estimation"])


def _out(e: Estimate) -> EstimateOut:
    return EstimateOut(
        id=e.id, kind=e.kind, currency=e.currency,
        amount_low=e.amount_low, amount_mid=e.amount_mid, amount_high=e.amount_high,
        probability=e.probability,
        breakdown=[EstimateLineItem(**x) for x in (e.breakdown or [])],
        legal_basis=e.legal_basis or [], notes=e.notes or "",
    )


@router.post("/compensation", response_model=EstimateOut)
def estimate_compensation(req: CompensationRequest, db: Session = Depends(get_db),
                          user: User = Depends(require_permission(Permission.ESTIMATE_RUN))):
    try:
        est = EstimationService(db).compensation(
            claim_type=req.claim_type, currency=req.currency, inputs=req.inputs,
            jurisdiction=req.jurisdiction, user_id=user.id, case_id=req.case_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _out(est)


@router.post("/settlement", response_model=EstimateOut)
def estimate_settlement(req: SettlementRequest, db: Session = Depends(get_db),
                        user: User = Depends(require_permission(Permission.ESTIMATE_RUN))):
    est = EstimationService(db).settlement(
        claim_amount=req.claim_amount, currency=req.currency,
        evidence_strength=req.evidence_strength, jurisdiction=req.jurisdiction,
        user_id=user.id, case_id=req.case_id, detection_id=req.detection_id)
    return _out(est)


@router.post("/cost", response_model=EstimateOut)
def estimate_cost(req: CostRequest, db: Session = Depends(get_db),
                  user: User = Depends(require_permission(Permission.ESTIMATE_RUN))):
    est = EstimationService(db).cost(
        currency=req.currency, forum=req.forum, complexity=req.complexity,
        claim_amount=req.claim_amount, jurisdiction=req.jurisdiction,
        user_id=user.id, case_id=req.case_id)
    return _out(est)


@router.get("/estimates", response_model=list[EstimateOut])
def list_estimates(db: Session = Depends(get_db),
                   user: User = Depends(require_permission(Permission.ESTIMATE_RUN))):
    rows = (db.query(Estimate).filter(Estimate.user_id == user.id)
            .order_by(Estimate.created_at.desc()).limit(50).all())
    return [_out(e) for e in rows]
