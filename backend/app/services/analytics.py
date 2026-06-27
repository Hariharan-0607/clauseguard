"""Analytics for the Detection Engine dashboards & trend monitoring.

Pure read-side aggregation over the detections/findings tables. Powers the
Human Rights / Exploitation dashboards (severity mix, category leaderboard,
regional + industry breakdowns, trend over time).
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Detection, DetectionFinding


def dashboard(db: Session, domain: str, days: int = 90) -> dict:
    since = datetime.utcnow() - timedelta(days=days)
    dets = (db.query(Detection)
            .filter(Detection.domain == domain, Detection.created_at >= since)
            .all())
    det_ids = [d.id for d in dets]

    severity_mix = Counter(d.severity for d in dets)
    avg_risk = round(sum(d.risk_score for d in dets) / len(dets), 2) if dets else 0.0

    findings = (db.query(DetectionFinding)
                .filter(DetectionFinding.detection_id.in_(det_ids)).all()) if det_ids else []
    category_counts = Counter(f.category_label for f in findings)
    region_counts = Counter(d.region for d in dets if d.region)
    industry_counts = Counter(d.industry for d in dets if d.industry)

    # weekly trend (count of detections per ISO week)
    trend: dict[str, int] = {}
    for d in dets:
        key = d.created_at.strftime("%Y-W%U")
        trend[key] = trend.get(key, 0) + 1

    return {
        "domain": domain,
        "window_days": days,
        "total_detections": len(dets),
        "total_findings": len(findings),
        "average_risk_score": avg_risk,
        "severity_mix": dict(severity_mix),
        "top_categories": category_counts.most_common(10),
        "by_region": region_counts.most_common(10),
        "by_industry": industry_counts.most_common(10),
        "trend_weekly": sorted(trend.items()),
    }


def severity_leaderboard(db: Session, domain: str, limit: int = 10) -> list[dict]:
    """Subjects (employers/landlords/vendors) with the most/most-severe findings."""
    rows = (db.query(Detection.subject,
                     func.count(Detection.id),
                     func.avg(Detection.risk_score))
            .filter(Detection.domain == domain, Detection.subject != "")
            .group_by(Detection.subject)
            .order_by(func.avg(Detection.risk_score).desc())
            .limit(limit).all())
    return [{"subject": s, "detections": c, "avg_risk": round(float(r or 0), 2)}
            for s, c, r in rows]
