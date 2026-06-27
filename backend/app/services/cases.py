"""Case Management service (Module 5).

The spine of the platform: complaints/cases with a timeline (CaseEvent), evidence,
status workflow, assignment, and analytics. Every status change is recorded as a
timeline event for an auditable history.

Event-driven: subscribes to 'detection.completed' so a finished detection can
auto-attach to a case timeline, and publishes 'case.status_changed'.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.core import events
from app.core.repository import Repository
from app.models import Case, CaseEvent, Evidence

VALID_STATUS = {"open", "in_progress", "filed", "resolved", "closed"}
VALID_PRIORITY = {"low", "medium", "high", "urgent"}


class CaseService:
    def __init__(self, db: Session):
        self.db = db
        self.cases = Repository(db, Case)
        self.case_events = Repository(db, CaseEvent)
        self.evidence = Repository(db, Evidence)

    # --- lifecycle ---
    def create(self, *, owner_id: str, title: str, category: str, jurisdiction: str,
               priority: str, summary: str, detection_id: str | None = None) -> Case:
        if priority not in VALID_PRIORITY:
            priority = "medium"
        case = Case(owner_id=owner_id, title=title, category=category,
                    jurisdiction=jurisdiction, priority=priority, summary=summary,
                    detection_id=detection_id, status="open")
        self.cases.add(case)
        self._add_event(case.id, owner_id, "system", "Case created", summary)
        self.cases.commit()
        self.db.refresh(case)
        return case

    def update(self, case: Case, *, actor_id: str, status: str | None = None,
               priority: str | None = None, assignee_id: str | None = None,
               summary: str | None = None) -> Case:
        if status and status in VALID_STATUS and status != case.status:
            old = case.status
            case.status = status
            self._add_event(case.id, actor_id, "status", f"Status: {old} -> {status}", "")
            events.publish("case.status_changed", case_id=case.id, old=old, new=status)
        if priority and priority in VALID_PRIORITY:
            case.priority = priority
        if assignee_id is not None:
            case.assignee_id = assignee_id or None
            self._add_event(case.id, actor_id, "system", "Assignment changed", "")
        if summary is not None:
            case.summary = summary
        self.cases.commit()
        self.db.refresh(case)
        return case

    # --- timeline + evidence ---
    def add_event(self, case_id: str, actor_id: str, kind: str, title: str, body: str) -> CaseEvent:
        ev = self._add_event(case_id, actor_id, kind, title, body)
        self.case_events.commit()
        self.db.refresh(ev)
        return ev

    def _add_event(self, case_id, actor_id, kind, title, body, meta=None) -> CaseEvent:
        ev = CaseEvent(case_id=case_id, actor_id=actor_id, kind=kind,
                       title=title, body=body, meta=meta or {})
        return self.case_events.add(ev)

    def add_evidence(self, case_id: str, label: str, kind: str, description: str,
                     detection_id: str | None) -> Evidence:
        ev = Evidence(case_id=case_id, label=label, kind=kind,
                      description=description, detection_id=detection_id)
        self.evidence.add(ev)
        self._add_event(case_id, None, "system", f"Evidence added: {label}", "")
        self.evidence.commit()
        self.db.refresh(ev)
        return ev

    # --- analytics ---
    def analytics(self, owner_id: str | None = None) -> dict:
        rows = self.cases.list(limit=1000, **({"owner_id": owner_id} if owner_id else {}))
        from collections import Counter
        by_status = Counter(c.status for c in rows)
        by_category = Counter(c.category for c in rows)
        by_priority = Counter(c.priority for c in rows)
        resolved = by_status.get("resolved", 0) + by_status.get("closed", 0)
        rate = round(resolved / len(rows), 2) if rows else 0.0
        return {
            "total": len(rows), "by_status": dict(by_status),
            "by_category": dict(by_category), "by_priority": dict(by_priority),
            "resolution_rate": rate,
        }


# --- Event-driven wiring: a finished detection leaves a trace if linked to a case.
@events.subscribe("detection.completed")
def _on_detection_completed(event: events.Event) -> None:
    # Detection is user-initiated and not always tied to a case; this is a hook
    # point for auto-linking. Kept side-effect-light to avoid surprising writes.
    # (Case linkage happens explicitly when a user attaches the detection as evidence.)
    return None
