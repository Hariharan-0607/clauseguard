"""Compensation (Module 7) + Settlement (Module 6) estimation engines.

Deterministic, auditable calculators — every number has a formula and a legal
basis, so the output is defensible (unlike a black-box LLM guess). Each estimate
is persisted (Estimate table) for an audit trail and can attach to a case.

Compensation: claim-type-specific formulas (wage theft, overtime, deposit, etc.).
Settlement: expected-value model over claim amount x evidence strength x success
probability, producing low/mid/high bands and a success probability.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.repository import Repository
from app.models import Estimate


# --------------------------------------------------------------------------- #
#  Compensation
# --------------------------------------------------------------------------- #
def _wage_theft(i: dict) -> tuple[list[dict], list[str]]:
    unpaid = float(i.get("unpaid_amount", 0))
    months = float(i.get("months_unpaid", 0))
    monthly = float(i.get("monthly_wage", 0))
    base = unpaid or (monthly * months)
    interest = round(base * 0.12 * (months / 12 if months else 0.25), 2)  # ~12% p.a.
    items = [
        {"label": "Unpaid wages", "amount": round(base, 2), "note": "Principal owed"},
        {"label": "Interest", "amount": interest, "note": "~12% p.a. statutory-style interest"},
    ]
    return items, ["Minimum Wages Act, 1948", "Payment of Wages Act, 1936"]


def _overtime(i: dict) -> tuple[list[dict], list[str]]:
    hours = float(i.get("overtime_hours", 0))
    rate = float(i.get("hourly_rate", 0))
    multiplier = float(i.get("multiplier", 2.0))  # OT often 2x in IN
    amt = round(hours * rate * multiplier, 2)
    return ([{"label": "Overtime pay", "amount": amt,
             "note": f"{hours}h x {rate} x {multiplier}"}],
            ["Factories Act, 1948 (s.59 — double rate)"])


def _deposit(i: dict) -> tuple[list[dict], list[str]]:
    deposit = float(i.get("deposit_amount", 0))
    deductions = float(i.get("lawful_deductions", 0))
    recoverable = max(0.0, deposit - deductions)
    items = [{"label": "Refundable deposit", "amount": round(recoverable, 2),
              "note": "Deposit minus genuine itemised deductions"}]
    if i.get("withheld_unlawfully"):
        items.append({"label": "Penalty for wrongful withholding", "amount": round(recoverable, 2),
                      "note": "Up to 2x in some jurisdictions"})
    return items, ["Model Tenancy Act, 2021", "CA Civil Code 1950.5"]


def _consumer(i: dict) -> tuple[list[dict], list[str]]:
    price = float(i.get("amount_paid", 0))
    items = [{"label": "Refund / replacement value", "amount": round(price, 2), "note": "Amount paid"}]
    if i.get("deficiency"):
        items.append({"label": "Compensation for deficiency", "amount": round(price * 0.2, 2),
                      "note": "Indicative ~20% for service deficiency / harassment"})
    return items, ["Consumer Protection Act, 2019"]


def _insurance(i: dict) -> tuple[list[dict], list[str]]:
    claimed = float(i.get("claimed_amount", 0))
    paid = float(i.get("amount_paid", 0))
    shortfall = max(0.0, claimed - paid)
    return ([{"label": "Claim shortfall", "amount": round(shortfall, 2),
             "note": "Claimed minus amount paid"}],
            ["Insurance Act, 1938", "IRDAI claim norms"])


def _benefits(i: dict) -> tuple[list[dict], list[str]]:
    monthly = float(i.get("monthly_wage", 0))
    years = float(i.get("years_served", 0))
    # Indicative gratuity-style: 15 days wage per year of service
    gratuity = round((monthly / 26) * 15 * years, 2)
    return ([{"label": "Gratuity / end-of-service", "amount": gratuity,
             "note": "15 days' wage per year of service (indicative)"}],
            ["Payment of Gratuity Act, 1972", "EPF Act, 1952"])


_COMP = {
    "wage_theft": _wage_theft, "overtime": _overtime, "deposit": _deposit,
    "consumer": _consumer, "insurance": _insurance, "benefits": _benefits,
}


class EstimationService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = Repository(db, Estimate)

    def compensation(self, *, claim_type: str, currency: str, inputs: dict,
                     jurisdiction: str, user_id: str | None, case_id: str | None) -> Estimate:
        if claim_type not in _COMP:
            raise ValueError(f"Unknown claim_type '{claim_type}'. "
                             f"Valid: {', '.join(_COMP)}.")
        items, basis = _COMP[claim_type](inputs)
        total = round(sum(x["amount"] for x in items), 2)
        # uncertainty band: +/- 20%
        est = Estimate(
            kind="compensation", currency=currency, user_id=user_id, case_id=case_id,
            amount_low=round(total * 0.8, 2), amount_mid=total, amount_high=round(total * 1.2, 2),
            breakdown=items, legal_basis=basis, inputs={"claim_type": claim_type, **inputs},
            notes="Indicative estimate — not legal advice. Final amounts depend on evidence and forum.",
        )
        self.repo.add(est)
        self.repo.commit()
        self.db.refresh(est)
        return est

    # --- Module 8: Legal Cost Prediction ---
    # Base costs are indicative and scale by forum tier and case complexity.
    _FORUM_FACTOR = {
        "consumer_forum": 0.4, "labour_court": 0.7, "civil_court": 1.0,
        "high_court": 1.8, "tribunal": 0.6,
    }

    def cost(self, *, currency: str, forum: str, complexity: float, claim_amount: float,
             jurisdiction: str, user_id: str | None, case_id: str | None) -> Estimate:
        """Forecast the cost of pursuing a case (lawyer/court/filing/docs/settlement)."""
        factor = self._FORUM_FACTOR.get(forum, 1.0)
        cx = max(0.5, min(2.0, complexity or 1.0))     # 0.5 simple .. 2.0 complex

        lawyer = round(25000 * factor * cx, 2)
        court = round(8000 * factor, 2)
        # filing fee in many forums is a small % of the claim, capped
        filing = round(min(claim_amount * 0.01, 5000) * factor, 2)
        documentation = round(3000 * cx, 2)
        # settlement/mediation cost only if claim is non-trivial
        settlement = round(5000 * factor if claim_amount > 0 else 0, 2)

        items = [
            {"label": "Lawyer fees", "amount": lawyer, "note": f"{forum.replace('_', ' ')}, complexity {cx}x"},
            {"label": "Court costs", "amount": court, "note": "Hearings / appearances"},
            {"label": "Filing fees", "amount": filing, "note": "~1% of claim, capped"},
            {"label": "Documentation costs", "amount": documentation, "note": "Drafting, notarisation, copies"},
            {"label": "Settlement / mediation costs", "amount": settlement, "note": "If pursued"},
        ]
        total = round(sum(x["amount"] for x in items), 2)
        est = Estimate(
            kind="cost", currency=currency, user_id=user_id, case_id=case_id,
            amount_low=round(total * 0.7, 2), amount_mid=total, amount_high=round(total * 1.5, 2),
            breakdown=items,
            legal_basis=["Indicative cost forecast based on forum tier and case complexity"],
            inputs={"forum": forum, "complexity": cx, "claim_amount": claim_amount},
            notes="Costs vary widely by lawyer and locality. Free legal aid may reduce these substantially.",
        )
        self.repo.add(est)
        self.repo.commit()
        self.db.refresh(est)
        return est

    def settlement(self, *, claim_amount: float, currency: str, evidence_strength: float,
                   jurisdiction: str, user_id: str | None, case_id: str | None,
                   detection_id: str | None) -> Estimate:
        strength = max(0.0, min(1.0, evidence_strength))
        # success probability rises with evidence strength (logistic-ish, bounded)
        probability = round(0.25 + 0.6 * strength, 2)
        expected = claim_amount * probability
        items = [
            {"label": "Claim amount", "amount": round(claim_amount, 2), "note": "Full claim if won"},
            {"label": "Risk-adjusted expected value", "amount": round(expected, 2),
             "note": f"claim x {probability} success probability"},
        ]
        est = Estimate(
            kind="settlement", currency=currency, user_id=user_id, case_id=case_id,
            amount_low=round(expected * 0.6, 2), amount_mid=round(expected, 2),
            amount_high=round(min(claim_amount, expected * 1.4), 2),
            probability=probability, breakdown=items,
            legal_basis=["Negotiated settlement — informed by evidence strength and comparable outcomes"],
            inputs={"claim_amount": claim_amount, "evidence_strength": strength,
                    "detection_id": detection_id},
            notes="Settlement band is a negotiation guide, not a guarantee.",
        )
        self.repo.add(est)
        self.repo.commit()
        self.db.refresh(est)
        return est
