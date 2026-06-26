#!/usr/bin/env python3
"""Quick CLI demo of the REAL AI pipeline (Ollama or Groq) — no frontend needed.

Usage:
    # Local, free, private (after: ollama pull llama3)
    AI_PROVIDER=ollama python demo_ai.py

    # Deployed-style, free (after getting a key at https://console.groq.com)
    AI_PROVIDER=groq GROQ_API_KEY=gsk_... python demo_ai.py

    # No setup at all (deterministic offline stub)
    AI_MOCK=true python demo_ai.py

It prints the AI health check, then runs a real analysis on a sample lease and shows
the plain-language explanations, verdicts, citations and a generated complaint letter.
"""
from app.config import settings
from app.services import ai, rights
from app.services.segment import split_clauses

SAMPLE = """1. The Tenant shall pay rent of Rs. 15,000 payable on or before the 5th of each month.
2. The Landlord shall forfeit the deposit in full if the Tenant vacates early for any reason.
3. The Landlord may evict the Tenant and require them to vacate within 24 hours without notice.
4. The Landlord may change these terms at any time without notice."""

C = {"red": "\033[91m", "amber": "\033[93m", "green": "\033[92m", "0": "\033[0m", "b": "\033[1m"}


def main():
    print(f"\n{C['b']}ClauseGuard — real AI demo{C['0']}")
    print(f"Provider: {settings.ai_provider}  |  mock: {settings.ai_mock}\n")

    health = ai.ai_health()
    status = "OK" if health["ok"] else "FAILED"
    print(f"AI health: {status} — {health['detail']}\n")
    if not health["ok"]:
        print("Fix the provider above, then re-run. (Or use AI_MOCK=true for an offline demo.)")
        return

    clauses = split_clauses(SAMPLE)
    analysed = []
    for i, clause in enumerate(clauses, 1):
        out = ai.analyze_clause(clause, "English")
        ruled = rights.apply_rules(clause, "IN", out["verdict"])
        verdict = ruled["verdict"]
        reason = ruled["reason_override"] or out["reason"]
        analysed.append({"original": clause, "verdict": verdict, "reason": reason})
        col = C.get(verdict, C["0"]) if verdict != "fair" else C["green"]
        print(f"{C['b']}Clause {i}{C['0']}: {clause}")
        print(f"  Verdict : {col}{verdict.upper()}{C['0']}")
        print(f"  Plain   : {out['explanation']}")
        print(f"  Why     : {reason}")
        if ruled["citation"]:
            print(f"  Law     : {ruled['citation']}")
        if out["suggestion"]:
            print(f"  Fix     : {out['suggestion']}")
        print()

    level, score = rights.overall_risk(
        [{"verdict": a["verdict"]} for a in analysed]
    )
    print(f"{C['b']}Overall risk{C['0']}: {C.get(level)}{level.upper()} ({int(score*100)}%){C['0']}")
    print(f"Bottom line : {ai.summarize(analysed, level, 'English')}\n")

    print(f"{C['b']}Generated complaint letter:{C['0']}\n")
    print(ai.generate_letter("complaint", analysed, "English"))
    print()


if __name__ == "__main__":
    main()
