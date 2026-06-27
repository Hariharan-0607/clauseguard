"""Detection Engine service (Service Layer + Repository + Event-Driven).

Pipeline:
  1. Split text into clauses (reuses the MVP segmenter).
  2. Keyword pre-screen each clause against the domain taxonomy (cheap, no LLM).
  3. For each (clause, candidate-category) hit, ask the LLM to confirm + enrich.
  4. Persist Detection + DetectionFindings, compute risk score & severity.
  5. Publish 'detection.completed' for subscribers (case timeline, agent memory).

One engine, many products: the `domain` selects the taxonomy file, so Human
Rights / Exploitation / Consumer / Dark Patterns / HR Compliance / Vendor Risk
are all the same code with different config.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.core import events
from app.core.repository import Repository
from app.models import Detection, DetectionFinding
from app.services import ai, taxonomy
from app.services.segment import split_clauses
from app.services.taxonomy import SEVERITY_BY_RANK, SEVERITY_RANK

MAX_CLAUSES = 40
MAX_LLM_CALLS = 25          # cap LLM round-trips per run (cost / rate-limit guard)
PRESENCE_THRESHOLD = 0.5    # findings below this probability are dropped


def _prescreen(clause_lower: str, category: dict) -> bool:
    return any(kw.lower() in clause_lower for kw in category.get("keywords", []))


class DetectionService:
    def __init__(self, db: Session):
        self.db = db
        self.detections = Repository(db, Detection)
        self.findings = Repository(db, DetectionFinding)

    def run(self, *, domain: str, text: str, jurisdiction: str = "IN",
            language: str = "en", title: str = "Document", subject: str = "",
            region: str = "", industry: str = "", user_id: str | None = None) -> Detection:
        tax = taxonomy.load_taxonomy(domain)        # raises ValueError on bad domain
        domain_label = tax.get("label", domain)
        categories = tax.get("categories", [])

        clauses = split_clauses(text)[:MAX_CLAUSES] or [text]
        finding_rows: list[DetectionFinding] = []
        llm_calls = 0

        for clause in clauses:
            cl = clause.lower()
            for cat in categories:
                if llm_calls >= MAX_LLM_CALLS:
                    break
                if not _prescreen(cl, cat):
                    continue
                law = taxonomy.law_for(cat, jurisdiction)
                assessment = ai.assess_violation(clause, cat["label"], domain_label, law, language)
                llm_calls += 1
                if not assessment["present"] or assessment["probability"] < PRESENCE_THRESHOLD:
                    continue
                # severity = max(model, taxonomy default) — config escalates, never downgrades
                sev = SEVERITY_BY_RANK[max(
                    SEVERITY_RANK.get(assessment["severity"], 0),
                    SEVERITY_RANK.get(cat.get("default_severity", "low"), 0),
                )]
                finding_rows.append(DetectionFinding(
                    category=cat["id"], category_label=cat["label"], severity=sev,
                    probability=assessment["probability"], confidence=assessment["confidence"],
                    evidence=assessment["evidence"] or clause[:300],
                    explanation=assessment["explanation"],
                    laws=[law] if law else [],
                    recommended_actions=assessment["recommended_actions"],
                ))

        risk_score, overall_sev = self._aggregate(finding_rows)
        detection = Detection(
            domain=domain, jurisdiction=jurisdiction, language=language, title=title,
            subject=subject, region=region, industry=industry,
            risk_score=risk_score, severity=overall_sev, user_id=user_id,
        )
        detection.findings = finding_rows
        self.detections.add(detection)
        self.detections.commit()
        self.db.refresh(detection)

        events.publish(
            "detection.completed",
            detection_id=detection.id, domain=domain, user_id=user_id,
            severity=overall_sev, risk_score=risk_score,
            finding_count=len(finding_rows), title=title,
        )
        return detection

    @staticmethod
    def _aggregate(findings: list[DetectionFinding]) -> tuple[float, str]:
        if not findings:
            return 0.0, "low"
        # weighted by severity rank * probability, normalised to 0..1
        total = sum(SEVERITY_RANK.get(f.severity, 0) * f.probability for f in findings)
        score = round(min(1.0, total / (3 * len(findings)) + 0.15 * min(len(findings), 4)), 2)
        top_rank = max(SEVERITY_RANK.get(f.severity, 0) for f in findings)
        return min(score, 1.0), SEVERITY_BY_RANK[top_rank]

    def get(self, detection_id: str) -> Detection | None:
        return self.detections.get(detection_id)

    def review_finding(self, finding_id: int, verdict: str) -> DetectionFinding | None:
        f = self.findings.get(finding_id)
        if not f:
            return None
        f.reviewed = True
        f.review_verdict = verdict          # confirmed | dismissed | adjusted
        self.findings.commit()
        return f
