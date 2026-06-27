"""Detection Engine API.

Covers Human Rights (1), Exploitation (2), Consumer (12), Dark Patterns (13),
HR Compliance (14), Vendor Risk (15) — one set of endpoints, `domain`-selected.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.rbac import require_permission
from app.core.roles import Permission
from app.db import get_db
from app.models import Detection, DetectionFinding, User
from app.schemas import (DetectionOut, DetectionRequest, DetectionSummary,
                         DomainInfo, FindingOut, ReviewRequest)
from app.services import analytics, taxonomy
from app.services.auth import get_current_user
from app.services.detection import DetectionService

router = APIRouter(prefix="/detection", tags=["detection"])


def _finding_out(f: DetectionFinding) -> FindingOut:
    return FindingOut(
        id=f.id, category=f.category, category_label=f.category_label, severity=f.severity,
        probability=f.probability, confidence=f.confidence, evidence=f.evidence,
        explanation=f.explanation, laws=f.laws or [],
        recommended_actions=f.recommended_actions or [],
        reviewed=f.reviewed, review_verdict=f.review_verdict or "",
    )


def _detection_out(d: Detection) -> DetectionOut:
    return DetectionOut(
        id=d.id, domain=d.domain, jurisdiction=d.jurisdiction, language=d.language,
        title=d.title, subject=d.subject or "", region=d.region or "", industry=d.industry or "",
        risk_score=d.risk_score, severity=d.severity,
        findings=[_finding_out(f) for f in d.findings],
    )


@router.get("/domains", response_model=list[DomainInfo])
def list_domains():
    return [DomainInfo(**d) for d in taxonomy.list_domains()]


@router.post("/run", response_model=DetectionOut)
def run_detection(req: DetectionRequest, db: Session = Depends(get_db),
                  user: User = Depends(require_permission(Permission.DETECTION_RUN))):
    try:
        detection = DetectionService(db).run(
            domain=req.domain, text=req.text, jurisdiction=req.jurisdiction,
            language=req.language, title=req.title, subject=req.subject,
            region=req.region, industry=req.industry, user_id=user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _detection_out(detection)


@router.get("/detections", response_model=list[DetectionSummary])
def list_detections(domain: str | None = None, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    q = db.query(Detection)
    if user:
        q = q.filter(Detection.user_id == user.id)
    if domain:
        q = q.filter(Detection.domain == domain)
    rows = q.order_by(Detection.created_at.desc()).limit(50).all()
    return [DetectionSummary(id=d.id, domain=d.domain, title=d.title, risk_score=d.risk_score,
                             severity=d.severity, finding_count=len(d.findings)) for d in rows]


@router.get("/detections/{detection_id}", response_model=DetectionOut)
def get_detection(detection_id: str, db: Session = Depends(get_db)):
    d = db.get(Detection, detection_id)
    if not d:
        raise HTTPException(status_code=404, detail="Detection not found")
    return _detection_out(d)


@router.patch("/findings/{finding_id}/review", response_model=FindingOut)
def review_finding(finding_id: int, req: ReviewRequest, db: Session = Depends(get_db),
                   user: User = Depends(require_permission(Permission.DETECTION_REVIEW))):
    if req.verdict not in ("confirmed", "dismissed", "adjusted"):
        raise HTTPException(status_code=400, detail="verdict must be confirmed|dismissed|adjusted")
    f = DetectionService(db).review_finding(finding_id, req.verdict)
    if not f:
        raise HTTPException(status_code=404, detail="Finding not found")
    return _finding_out(f)


@router.get("/analytics/{domain}")
def analytics_dashboard(domain: str, days: int = 90, db: Session = Depends(get_db),
                        user: User = Depends(get_current_user)):
    data = analytics.dashboard(db, domain, days)
    data["leaderboard"] = analytics.severity_leaderboard(db, domain)
    return data
