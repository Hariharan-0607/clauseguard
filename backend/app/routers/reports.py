"""Anonymous repeat-offender reports — powers the free Leaflet/OpenStreetMap map.

We store only counterparty name, category, jurisdiction, worst verdict, city and
optional coords — never the contract itself.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Analysis, Report
from app.schemas import ReportOut

router = APIRouter(tags=["reports"])


@router.post("/reports/{analysis_id}", response_model=ReportOut)
def file_report(analysis_id: str, lat: float | None = None, lon: float | None = None,
                city: str = "", category: str = "landlord", db: Session = Depends(get_db)):
    analysis = db.get(Analysis, analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    if not analysis.counterparty:
        raise HTTPException(status_code=400, detail="No counterparty name on this analysis to report.")

    worst_verdict = {"red": "illegal", "amber": "unfair", "green": "fair"}[analysis.risk_level]
    report = Report(counterparty=analysis.counterparty.strip(), category=category,
                    jurisdiction=analysis.jurisdiction, worst_verdict=worst_verdict,
                    city=city, lat=lat, lon=lon)
    db.add(report); db.commit()

    count = db.query(Report).filter(Report.counterparty == report.counterparty).count()
    return ReportOut(counterparty=report.counterparty, category=category,
                     jurisdiction=report.jurisdiction, worst_verdict=worst_verdict,
                     city=city, count=count, lat=lat, lon=lon)


@router.get("/reports", response_model=list[ReportOut])
def list_reports(db: Session = Depends(get_db)):
    """Aggregated repeat-offender list for the map / leaderboard."""
    rows = (
        db.query(
            Report.counterparty, Report.category, Report.jurisdiction,
            func.count(Report.id).label("count"),
            func.max(Report.city).label("city"),
            func.max(Report.lat).label("lat"),
            func.max(Report.lon).label("lon"),
        )
        .group_by(Report.counterparty, Report.category, Report.jurisdiction)
        .order_by(func.count(Report.id).desc())
        .limit(200)
        .all()
    )
    return [
        ReportOut(counterparty=r.counterparty, category=r.category or "landlord",
                  jurisdiction=r.jurisdiction, worst_verdict="illegal",
                  city=r.city or "", count=r.count, lat=r.lat, lon=r.lon)
        for r in rows
    ]
