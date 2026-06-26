"""LLM access — 100% free either way.

  AI_PROVIDER=ollama  -> local Llama 3 / Mistral, $0, private  (dev + live demo)
  AI_PROVIDER=groq    -> Groq free API, no card                (deployed, always-on)
  AI_MOCK=true        -> deterministic offline stub            (tests / no-internet demo)

Same prompts, same code — only the endpoint changes.
"""
import json
import re

import requests

from app.config import settings


# --------------------------------------------------------------------------- #
#  Low-level: send one prompt, get raw text back
# --------------------------------------------------------------------------- #
class AIError(RuntimeError):
    """Raised when a live AI provider is unreachable/misconfigured (clear demo message)."""


def call_llm(prompt: str, system: str = "") -> str:
    if settings.ai_mock:
        return _mock(prompt)

    if settings.ai_provider == "ollama":
        return _call_ollama(prompt, system)
    if settings.ai_provider == "groq":
        return _call_groq(prompt, system)
    raise AIError(f"Unknown AI_PROVIDER '{settings.ai_provider}'. Use 'ollama', 'groq' or AI_MOCK=true.")


def _call_ollama(prompt: str, system: str) -> str:
    full = (system + "\n\n" + prompt) if system else prompt
    try:
        r = requests.post(
            f"{settings.ollama_url}/api/generate",
            json={"model": settings.ollama_model, "prompt": full, "stream": False,
                  "options": {"temperature": 0.2}},
            timeout=120,
        )
    except requests.exceptions.ConnectionError as e:
        raise AIError(
            f"Cannot reach Ollama at {settings.ollama_url}. Is it running? "
            f"Try: `ollama serve` and `ollama pull {settings.ollama_model}`."
        ) from e
    if r.status_code == 404:
        raise AIError(f"Ollama model '{settings.ollama_model}' not found. Run: "
                      f"`ollama pull {settings.ollama_model}`.")
    r.raise_for_status()
    return r.json().get("response", "")


def _call_groq(prompt: str, system: str) -> str:
    if not settings.groq_api_key:
        raise AIError("GROQ_API_KEY is not set. Get a free key at https://console.groq.com")
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    r = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {settings.groq_api_key}"},
        json={"model": settings.groq_model, "messages": messages, "temperature": 0.2},
        timeout=120,
    )
    if r.status_code == 401:
        raise AIError("Groq rejected the API key (401). Check GROQ_API_KEY.")
    if r.status_code == 429:
        raise AIError("Groq free-tier rate limit hit (429). Wait a moment and retry.")
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def ai_health() -> dict:
    """Ping the configured provider so the demo can confirm real AI is live."""
    if settings.ai_mock:
        return {"provider": "mock", "ok": True, "detail": "offline deterministic stub"}
    try:
        reply = call_llm("Reply with the single word: OK")
        return {"provider": settings.ai_provider, "ok": True, "detail": reply.strip()[:80]}
    except AIError as e:
        return {"provider": settings.ai_provider, "ok": False, "detail": str(e)}
    except Exception as e:  # noqa: BLE001 - surface any provider error in the health check
        return {"provider": settings.ai_provider, "ok": False, "detail": f"{type(e).__name__}: {e}"}


def _extract_json(text: str) -> dict:
    """LLMs sometimes wrap JSON in prose/markdown — pull the first {...} block."""
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return {}
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return {}


# --------------------------------------------------------------------------- #
#  High-level: per-clause explain + classify (+ fair rewrite) in one round-trip
# --------------------------------------------------------------------------- #
def analyze_clause(clause: str, language: str) -> dict:
    """Return {explanation, verdict, reason, suggestion} for one clause."""
    system = (
        "You are ClauseGuard, a consumer-rights assistant for gig workers, tenants and "
        "migrants. You explain contract clauses in simple words and spot unfair or illegal terms. "
        "You are not a lawyer and you say so when relevant."
    )
    prompt = f"""Analyse this single contract clause for an ordinary person.
The clause may be in any language.

CLAUSE:
\"\"\"{clause}\"\"\"

Respond ONLY with a JSON object using these exact keys:
{{
  "explanation": "plain-language meaning, written in {language}",
  "verdict": "fair | unfair | illegal",
  "reason": "one short sentence on why, in {language}",
  "suggestion": "a fairer wording the person could counter-offer, in {language} (empty string if the clause is already fair)",
  "english_gist": "a short ENGLISH paraphrase of what this clause does (always English, used internally for legal matching)"
}}"""
    data = _extract_json(call_llm(prompt, system))
    verdict = str(data.get("verdict", "fair")).lower().strip()
    if verdict not in ("fair", "unfair", "illegal"):
        verdict = "fair"
    return {
        "explanation": data.get("explanation", ""),
        "verdict": verdict,
        "reason": data.get("reason", ""),
        "suggestion": data.get("suggestion", ""),
        "english_gist": data.get("english_gist", ""),
    }


def summarize(clauses: list[dict], risk_level: str, language: str) -> str:
    """Two-line bottom-line summary for the top of the result page."""
    illegal = sum(1 for c in clauses if c["verdict"] == "illegal")
    unfair = sum(1 for c in clauses if c["verdict"] == "unfair")
    prompt = (
        f"A contract was analysed. It has {illegal} illegal and {unfair} unfair clauses. "
        f"Overall risk is {risk_level}. In {language}, write a 2-sentence 'bottom line' for the "
        f"person: what the risk is and what to do. Plain words, no legal jargon."
    )
    return call_llm(prompt).strip()


def generate_letter(letter_type: str, clauses: list[dict], language: str) -> str:
    """Draft a negotiation / response / complaint letter citing the flagged clauses."""
    flagged = [c for c in clauses if c["verdict"] in ("unfair", "illegal")]
    bullet = "\n".join(f"- {c['original'][:200]} -> {c['reason']}" for c in flagged) or "- (none)"
    intent = {
        "negotiation": "politely ask the other party to change the unfair clauses before signing",
        "response": "formally object to the unfair/illegal clauses already in effect",
        "complaint": "file a complaint with the relevant authority about the illegal clauses",
    }.get(letter_type, "object to the unfair clauses")
    prompt = (
        f"Write a clear, firm, polite {letter_type} letter in {language} that helps the person "
        f"{intent}. Reference these problem clauses:\n{bullet}\n\n"
        "Keep it short, ready to send, with placeholders like [Your name], [Date], [Address]. "
        "Do not invent facts beyond the clauses listed."
    )
    return call_llm(prompt).strip()


def chat_answer(question: str, context: str, language: str) -> str:
    """Know-your-rights chat, grounded in jurisdiction context."""
    prompt = (
        f"Using this rights context:\n{context}\n\n"
        f"Answer the person's question in simple {language}. If unsure, say so and suggest "
        f"contacting local legal aid.\n\nQUESTION: {question}"
    )
    return call_llm(prompt).strip()


def negotiation_message(clause_text: str, reason: str, suggestion: str, language: str) -> str:
    """A short, polite, ready-to-send message asking the other party to fix one clause."""
    prompt = (
        f"Write a short, polite but firm message (3-5 sentences, in {language}) that a person can send "
        f"to the other party asking them to change ONE unfair clause in a contract before signing.\n\n"
        f"The clause: \"{clause_text[:400]}\"\n"
        f"Why it's a problem: {reason}\n"
        f"A fairer version to propose: {suggestion}\n\n"
        "Be respectful and reasonable. Output only the message, ready to copy and send."
    )
    return call_llm(prompt).strip()


def redraft_contract(clauses: list[dict], title: str, language: str) -> str:
    """Rewrite a whole contract into a fair version, fixing every flagged clause.

    `clauses` is the analysed list (each has original/verdict/reason/suggestion).
    Fair clauses are kept as-is; unfair/illegal clauses are replaced with balanced wording.
    """
    lines = []
    for i, c in enumerate(clauses, 1):
        v = c.get("verdict", "fair")
        if v == "fair":
            lines.append(f"Clause {i} (already fair — keep as-is): {c['original']}")
        else:
            fix = c.get("suggestion") or "make this balanced and lawful"
            lines.append(
                f"Clause {i} ({v.upper()} — MUST be rewritten): {c['original']}\n"
                f"    Problem: {c.get('reason', '')}\n"
                f"    Rewrite it to be fair, e.g.: {fix}"
            )
    body = "\n".join(lines)
    prompt = (
        f"Redraft the contract titled \"{title or 'Contract'}\" into a FAIR, balanced version "
        f"for an ordinary person. Write the entire redrafted contract in {language}.\n\n"
        "Rules:\n"
        "- Keep the 'already fair' clauses essentially unchanged.\n"
        "- For every clause marked MUST be rewritten, replace it with genuinely fair, lawful, "
        "balanced wording that fixes the stated problem (do not keep the unfair term).\n"
        "- Keep the same clauses in the same order. Do NOT add extra clauses that weren't listed.\n"
        "- NEVER print labels like 'KEEP', 'fix', 'MUST be rewritten', or 'Problem' — output a clean contract only.\n"
        "- Use placeholders like [Party A], [Party B], [Date], [Amount] where specifics are unknown.\n\n"
        f"CLAUSES TO REDRAFT:\n{body}\n\n"
        "Output ONLY the finished contract: a title, the numbered clauses, and a signature block. "
        "At the very end add one short italic line: this is an AI-generated fair draft, not legal advice — "
        "have it reviewed before signing."
    )
    return call_llm(prompt).strip()


def compare(summary_a: str, summary_b: str, label_a: str, label_b: str, language: str) -> dict:
    """Compare two analysed contracts -> which is safer + plain-language differences."""
    prompt = f"""Two contracts were analysed for an ordinary person.

CONTRACT A ({label_a}): {summary_a}
CONTRACT B ({label_b}): {summary_b}

In {language}, compare them for the person. Respond ONLY with a JSON object:
{{
  "safer": "A | B | tie",
  "verdict": "1-2 sentences saying which is safer to accept and why, plain words",
  "differences": ["3-5 short bullet points of the key practical differences between A and B"]
}}"""
    data = _extract_json(call_llm(prompt))
    safer = str(data.get("safer", "tie")).upper().strip()
    if safer not in ("A", "B", "TIE"):
        safer = "TIE"
    diffs = data.get("differences", [])
    diffs = [str(x) for x in diffs][:5] if isinstance(diffs, list) else []
    return {"safer": safer, "verdict": data.get("verdict", ""), "differences": diffs}


def advise(situation: str, jurisdiction: str, context: str, language: str) -> dict:
    """Turn a plain-language legal situation into a structured action plan."""
    system = (
        "You are ClauseGuard, a friendly legal-rights assistant for ordinary people "
        "(tenants, workers, consumers, migrants). You are NOT a lawyer and you always make that "
        "clear. You give practical, plain-language guidance and point people to real help. "
        "Never invent specific case outcomes or guarantee results."
    )
    prompt = f"""A person describes their problem. Jurisdiction: {jurisdiction}.

RELEVANT LOCAL RIGHTS (use if applicable):
{context}

THEIR SITUATION:
\"\"\"{situation}\"\"\"

Give practical guidance, all written in {language}. Respond ONLY with a JSON object:
{{
  "title": "a short title naming the issue",
  "category": "one of: tenancy | employment | consumer | wages | other",
  "summary": "2-3 sentences: what's happening and the person's basic position, plain words",
  "rights": ["3-5 short bullet points of the rights that likely apply to them"],
  "steps": ["4-6 concrete, ordered actions they should take, each a short sentence"],
  "documents": ["2-4 documents or letters they should gather or send"],
  "urgency": "low | medium | high",
  "deadline_note": "one sentence on any time limits to watch (empty string if none)",
  "help": "one sentence telling them to seek free legal aid / the relevant authority for their case"
}}"""
    data = _extract_json(call_llm(prompt, system))
    # sanitise
    def _list(key):
        v = data.get(key, [])
        return [str(x) for x in v][:6] if isinstance(v, list) else []
    urgency = str(data.get("urgency", "medium")).lower().strip()
    if urgency not in ("low", "medium", "high"):
        urgency = "medium"
    return {
        "title": data.get("title", "Your situation"),
        "category": str(data.get("category", "other")).lower().strip(),
        "summary": data.get("summary", ""),
        "rights": _list("rights"),
        "steps": _list("steps"),
        "documents": _list("documents"),
        "urgency": urgency,
        "deadline_note": data.get("deadline_note", ""),
        "help": data.get("help", "Contact your local free legal-aid service for advice on your specific case."),
    }


# --------------------------------------------------------------------------- #
#  Deterministic offline stub (AI_MOCK=true) — keeps tests/demos free & stable
# --------------------------------------------------------------------------- #
def _mock(prompt: str) -> str:
    low = prompt.lower()
    if '"verdict"' in low:
        if "deposit" in low or "deduct" in low or "forfeit" in low:
            v, r = "illegal", "Keeping the full deposit for any reason is not allowed."
        elif "evict" in low or "terminate" in low or "24 hour" in low or "notice" in low:
            v, r = "unfair", "The notice period is far too short and one-sided."
        elif "penalty" in low or "interest" in low or "fine" in low:
            v, r = "unfair", "The penalty is excessive compared to normal practice."
        else:
            v, r = "fair", "This is a standard, reasonable term."
        return json.dumps({
            "explanation": "In plain terms: this clause affects your money or housing — read it carefully.",
            "verdict": v,
            "reason": r,
            "suggestion": "" if v == "fair" else "Ask for a balanced version with reasonable notice and limits.",
        })
    if '"safer"' in low and '"differences"' in low:
        return json.dumps({
            "safer": "A",
            "verdict": "Contract A is safer to accept — it has fewer one-sided terms than B.",
            "differences": [
                "A returns your deposit; B lets the other side keep it.",
                "A gives proper notice; B allows removal on very short notice.",
                "B lets the other party change the terms anytime; A does not.",
            ],
        })
    if "ready to copy and send" in low or ("message" in low and "other party" in low):
        return ("Hello, before I sign I'd like to discuss one term in the agreement. The current clause "
                "is one-sided and could put me at a disadvantage. Could we replace it with a fairer, "
                "balanced version? I'm happy to talk it through. Thank you.")
    if '"steps"' in low and '"rights"' in low:
        return json.dumps({
            "title": "Security deposit not returned",
            "category": "tenancy",
            "summary": "Your landlord is refusing to return your security deposit. The deposit is your money and must be refunded minus only genuine, itemised damages.",
            "rights": [
                "Your deposit must be refunded, minus lawful deductions only.",
                "Deductions must be itemised and genuine, not arbitrary.",
                "You are entitled to the refund within the legal time limit.",
            ],
            "steps": [
                "Write down the amount, the date you paid it, and when you moved out.",
                "Send the landlord a written request for the refund, by a traceable method.",
                "Ask for an itemised list of any deductions they claim.",
                "If they refuse, file a complaint with the rent authority or consumer forum.",
            ],
            "documents": [
                "Your rental agreement and deposit receipt",
                "A written demand letter for the refund",
                "Photos of the property at move-out",
            ],
            "urgency": "medium",
            "deadline_note": "Act soon — many places have a limited window to claim a deposit refund.",
            "help": "Contact your local free legal-aid service or tenant helpline for help with your specific case.",
        })
    if "redrafting a contract" in low or "redrafted contract" in low:
        return ("FAIR AGREEMENT (Redrafted)\n\n"
                "1. The deposit shall be refunded within 30 days, minus only genuine, itemised damages.\n"
                "2. Either party may end this agreement with one month's written notice.\n"
                "3. Any penalty shall be reasonable and proportionate to the actual loss.\n\n"
                "Signed: [Party A] ____  [Party B] ____  Date: [Date]\n\n"
                "_This is an AI-generated fair draft, not legal advice — have it reviewed before signing._")
    if "bottom line" in low or "2-sentence" in low or "2 sentence" in low:
        return "This contract has terms that could cost you money or your home. Do not sign it as-is — push back on the flagged clauses or seek free legal aid."
    if "letter" in low:
        return ("[Date]\n\nTo whom it may concern,\n\nI am writing regarding the agreement between us. "
                "Several clauses appear unfair or unlawful and I request that they be revised before I proceed. "
                "Please respond within 14 days.\n\nSincerely,\n[Your name]")
    return "This is a demo answer. For real advice, consult local legal aid."
