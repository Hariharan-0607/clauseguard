"""Jurisdiction rights engine.

Loads a free, repo-bundled JSON rule pack (rules/<jurisdiction>.json) and combines
keyword/regex matching with the LLM verdict. A rule match adds a legal citation and
can escalate the severity (the law is authoritative over the model's guess).
"""
import json
import re
from functools import lru_cache
from pathlib import Path

RULES_DIR = Path(__file__).resolve().parents[2] / "rules"

_SEVERITY = {"fair": 0, "unfair": 1, "illegal": 2}
_SEVERITY_INV = {0: "fair", 1: "unfair", 2: "illegal"}


@lru_cache(maxsize=16)
def load_rules(jurisdiction: str) -> tuple:
    path = RULES_DIR / f"{jurisdiction.upper()}.json"
    if not path.exists():
        path = RULES_DIR / "IN.json"          # sensible default for the demo
    if not path.exists():
        return tuple()
    data = json.loads(path.read_text(encoding="utf-8"))
    return tuple(data.get("rules", []))


def apply_rules(clause: str, jurisdiction: str, llm_verdict: str) -> dict:
    """Return {verdict, citation, reason_override} after consulting the rule pack."""
    text = clause.lower()
    best = None
    for rule in load_rules(jurisdiction):
        if _matches(text, rule):
            sev = _SEVERITY.get(rule.get("severity", "unfair"), 1)
            if best is None or sev > _SEVERITY.get(best.get("severity", "unfair"), 1):
                best = rule

    final = llm_verdict
    citation = ""
    reason_override = ""
    if best:
        rule_sev = _SEVERITY.get(best.get("severity", "unfair"), 1)
        # the law escalates, never downgrades, the model's verdict
        final = _SEVERITY_INV[max(_SEVERITY.get(llm_verdict, 0), rule_sev)]
        citation = best.get("citation", "")
        reason_override = best.get("plain_reason", "")
    return {"verdict": final, "citation": citation, "reason_override": reason_override}


def _matches(text: str, rule: dict) -> bool:
    for kw in rule.get("keywords", []):
        if kw.lower() in text:
            return True
    for pat in rule.get("patterns", []):
        if re.search(pat, text, re.IGNORECASE):
            return True
    return False


def overall_risk(clauses: list[dict]) -> tuple[str, float]:
    """Aggregate clause verdicts into a red/amber/green level and 0..1 score."""
    if not clauses:
        return "green", 0.0
    weights = [_SEVERITY[c["verdict"]] for c in clauses]
    score = sum(weights) / (2 * len(weights))     # normalise to 0..1
    if any(c["verdict"] == "illegal" for c in clauses):
        level = "red"
    elif any(c["verdict"] == "unfair" for c in clauses):
        level = "amber"
    else:
        level = "green"
    return level, round(score, 2)
