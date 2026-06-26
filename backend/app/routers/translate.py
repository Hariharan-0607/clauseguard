"""POST /translate — batch-translate UI/content strings via the free LLM, cached.

The frontend sends a list of English strings + a target language; we return the
translations in the same order. Results are cached in-process so repeat requests
(and repeat users) are instant and don't spend AI calls.
"""
import hashlib
import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import ai
from app.services.ai import AIError

router = APIRouter(tags=["translate"])

# simple in-memory cache: key -> list[str]
_CACHE: dict[str, list[str]] = {}
_MAX_CACHE = 2000


class TranslateRequest(BaseModel):
    texts: list[str]
    language: str          # human-readable, e.g. "Hindi"


class TranslateResponse(BaseModel):
    translations: list[str]


def _key(texts: list[str], language: str) -> str:
    raw = json.dumps([language, texts], ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


@router.post("/translate", response_model=TranslateResponse)
def translate(req: TranslateRequest):
    if not req.texts:
        return TranslateResponse(translations=[])
    # English needs no translation
    if req.language.strip().lower() in ("english", "en"):
        return TranslateResponse(translations=req.texts)

    key = _key(req.texts, req.language)
    if key in _CACHE:
        return TranslateResponse(translations=_CACHE[key])

    numbered = "\n".join(f"{i+1}. {t}" for i, t in enumerate(req.texts))
    prompt = (
        f"Translate each of the following UI strings into {req.language}. "
        f"Keep the same numbering, one translation per line, and do NOT add anything else. "
        f"Keep product names like 'ClauseGuard' and 'AI' unchanged.\n\n{numbered}"
    )
    try:
        raw = ai.call_llm(prompt)
    except AIError as e:
        raise HTTPException(status_code=503, detail=str(e))

    out = _parse(raw, len(req.texts), req.texts)
    if len(_CACHE) < _MAX_CACHE:
        _CACHE[key] = out
    return TranslateResponse(translations=out)


def _parse(raw: str, n: int, fallback: list[str]) -> list[str]:
    """Pull numbered lines back into a list; fall back to English on mismatch."""
    lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    result: list[str] = []
    for ln in lines:
        # strip a leading "12." / "12)" marker
        s = ln
        for sep in (". ", ".", ") ", ")"):
            if s[:6].split(sep)[0].isdigit() and sep in s:
                s = s.split(sep, 1)[1].strip()
                break
        result.append(s)
    if len(result) != n:
        return fallback
    return result
