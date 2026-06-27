"""POST /translate — batch-translate UI/content strings via the free LLM, cached.

The frontend sends a list of English strings + a target language; we return the
translations in the same order. Results are cached in-process so repeat requests
(and repeat users) are instant and don't spend AI calls.
"""
import hashlib
import json
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import ai
from app.services.ai import AIError

router = APIRouter(tags=["translate"])

# simple in-memory cache: key -> list[str]
_CACHE: dict[str, list[str]] = {}
_MAX_CACHE = 2000

# Built-in offline UI dictionary (works even without a live LLM, e.g. AI_MOCK).
_DICT_PATH = Path(__file__).resolve().parents[1] / "content" / "ui_translations.json"


@lru_cache(maxsize=1)
def _ui_dict() -> dict:
    try:
        return json.loads(_DICT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _dict_lookup(text: str, language: str) -> str | None:
    return _ui_dict().get(language, {}).get(text)


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

    # 1) Serve from the built-in UI dictionary where possible (works offline).
    out: list[str | None] = [_dict_lookup(t, req.language) for t in req.texts]
    missing = [(i, t) for i, t in enumerate(req.texts) if out[i] is None]

    # 2) Anything not in the dictionary -> ask the LLM (if a real provider works).
    if missing:
        numbered = "\n".join(f"{n+1}. {t}" for n, (_, t) in enumerate(missing))
        prompt = (
            f"Translate each of the following UI strings into {req.language}. "
            f"Keep the same numbering, one translation per line, and do NOT add anything else. "
            f"Keep product names like 'ClauseGuard' and 'AI' unchanged.\n\n{numbered}"
        )
        translated_missing = None
        try:
            raw = ai.call_llm(prompt)
            parsed = _parse(raw, len(missing), [t for _, t in missing])
            translated_missing = parsed
        except AIError:
            translated_missing = None        # LLM unavailable: keep English for the gaps

        for slot, (idx, original) in enumerate(missing):
            if translated_missing is not None:
                out[idx] = translated_missing[slot]
            else:
                out[idx] = original          # graceful fallback to English

    result = [o if o is not None else t for o, t in zip(out, req.texts)]
    if len(_CACHE) < _MAX_CACHE:
        _CACHE[key] = result
    return TranslateResponse(translations=result)


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
