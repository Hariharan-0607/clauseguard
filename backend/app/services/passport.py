"""Protection Passports (Modules 9, 10, 11).

One service, three verticals selected by `kind`:
  - worker  : Worker Protection Passport (employment history, wage records, certs)
  - migrant : Migrant Worker Assistance (recruitment/contract verification, embassy)
  - rental  : Rental Guardian (tenancy, deposit, rent-increase, eviction protection)

A passport is a thin aggregate: it stores a durable user record (Profile.records)
and, on read, composes the user's live Detections / Cases / Estimates into a
Trust Score + a rights/risk dashboard. It deliberately reuses the engines already
built rather than re-implementing detection or case logic.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.repository import Repository
from app.models import Case, Detection, Estimate, Profile
from app.services.taxonomy import SEVERITY_RANK

VALID_KINDS = {"worker", "migrant", "rental"}

# Which detection domains are most relevant to each passport vertical.
_RELEVANT_DOMAINS = {
    "worker": {"human_rights", "exploitation", "hr_compliance"},
    "migrant": {"human_rights", "exploitation"},
    "rental": {"exploitation", "consumer"},
}

# Rights checklist per vertical — what protections the holder should have.
_RIGHTS = {
    "worker": [
        "Timely payment of at least the minimum wage",
        "Overtime pay and regulated working hours",
        "A safe workplace and protective equipment",
        "Freedom from discrimination, harassment and retaliation",
        "Provident fund / social security where applicable",
    ],
    "migrant": [
        "Keep your own passport and identity documents",
        "A written contract you understand before travel",
        "No recruitment fees charged to you",
        "Access to your embassy and emergency help",
        "Equal labour rights to local workers",
    ],
    "rental": [
        "Refund of your deposit minus genuine itemised damages",
        "Reasonable notice before eviction",
        "Rent increases only as the agreement/law allows",
        "Quiet enjoyment — no entry without notice",
        "Written receipts for all payments",
    ],
}


class PassportService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = Repository(db, Profile)

    def get_or_create(self, user_id: str, kind: str) -> Profile:
        if kind not in VALID_KINDS:
            raise ValueError(f"Unknown passport kind '{kind}'. Valid: {', '.join(VALID_KINDS)}.")
        existing = self.repo.first(user_id=user_id, kind=kind)
        if existing:
            return existing
        p = Profile(user_id=user_id, kind=kind, records={})
        self.repo.add(p)
        self.repo.commit()
        self.db.refresh(p)
        return p

    def update_records(self, profile: Profile, *, display_name: str | None,
                       jurisdiction: str | None, records: dict | None) -> Profile:
        if display_name is not None:
            profile.display_name = display_name
        if jurisdiction is not None:
            profile.jurisdiction = jurisdiction
        if records is not None:
            merged = dict(profile.records or {})
            merged.update(records)
            profile.records = merged
        self.repo.commit()
        self.db.refresh(profile)
        return profile

    def dashboard(self, profile: Profile) -> dict:
        """Compose the live trust score + protection dashboard for this passport."""
        domains = _RELEVANT_DOMAINS.get(profile.kind, set())
        dets = [d for d in self.db.query(Detection)
                .filter(Detection.user_id == profile.user_id).all()
                if d.domain in domains]
        cases = self.db.query(Case).filter(Case.owner_id == profile.user_id).all()
        estimates = self.db.query(Estimate).filter(Estimate.user_id == profile.user_id).all()

        trust = self._trust_score(profile, dets, cases)
        return {
            "id": profile.id,
            "kind": profile.kind,
            "display_name": profile.display_name,
            "jurisdiction": profile.jurisdiction,
            "trust_score": trust["score"],
            "trust_band": trust["band"],
            "risk_factors": trust["factors"],
            "rights": _RIGHTS.get(profile.kind, []),
            "record_completeness": self._completeness(profile),
            "stats": {
                "checks_run": len(dets),
                "open_cases": sum(1 for c in cases if c.status in ("open", "in_progress")),
                "total_cases": len(cases),
                "estimates": len(estimates),
            },
            "recent_findings": self._recent_findings(dets),
        }

    # --- scoring ---
    def _trust_score(self, profile: Profile, dets: list[Detection], cases: list[Case]) -> dict:
        """100 = fully protected. Severity of findings and open cases reduce it."""
        score = 100.0
        factors: list[str] = []
        for d in dets:
            penalty = {0: 0, 1: 5, 2: 12, 3: 20}[SEVERITY_RANK.get(d.severity, 0)]
            if penalty:
                score -= penalty
                factors.append(f"{d.severity.title()} issue in '{d.title}'")
        open_cases = sum(1 for c in cases if c.status in ("open", "in_progress"))
        score -= 4 * open_cases
        if open_cases:
            factors.append(f"{open_cases} unresolved case(s)")
        score = max(0, min(100, round(score)))
        band = "strong" if score >= 75 else "moderate" if score >= 45 else "at risk"
        return {"score": score, "band": band, "factors": factors[:6]}

    def _completeness(self, profile: Profile) -> int:
        expected = {
            "worker": ["employer", "wage", "start_date", "certifications"],
            "migrant": ["origin_country", "destination", "recruiter", "contract_verified"],
            "rental": ["address", "rent", "deposit", "lease_end"],
        }.get(profile.kind, [])
        if not expected:
            return 0
        rec = profile.records or {}
        have = sum(1 for k in expected if rec.get(k))
        return round(100 * have / len(expected))

    def _recent_findings(self, dets: list[Detection]) -> list[dict]:
        out = []
        for d in sorted(dets, key=lambda x: x.created_at, reverse=True)[:5]:
            out.append({"title": d.title, "severity": d.severity,
                        "domain": d.domain, "risk_score": d.risk_score})
        return out
