"""Protection Passport API (Modules 9 Worker, 10 Migrant, 11 Rental).

One set of endpoints, `kind`-selected. Each passport aggregates the user's live
detections/cases/estimates into a trust score + rights dashboard.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas import PassportDashboard, PassportUpdate
from app.services.auth import require_user
from app.services.passport import PassportService

router = APIRouter(prefix="/passport", tags=["passport"])


@router.get("/{kind}", response_model=PassportDashboard)
def get_passport(kind: str, db: Session = Depends(get_db), user: User = Depends(require_user)):
    svc = PassportService(db)
    try:
        profile = svc.get_or_create(user.id, kind)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return PassportDashboard(**svc.dashboard(profile))


@router.patch("/{kind}", response_model=PassportDashboard)
def update_passport(kind: str, req: PassportUpdate, db: Session = Depends(get_db),
                    user: User = Depends(require_user)):
    svc = PassportService(db)
    try:
        profile = svc.get_or_create(user.id, kind)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    profile = svc.update_records(profile, display_name=req.display_name,
                                 jurisdiction=req.jurisdiction, records=req.records)
    return PassportDashboard(**svc.dashboard(profile))
