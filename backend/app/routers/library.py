"""Rights library + NGO/legal-aid directory (static free content)."""
import json
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["library"])
CONTENT = Path(__file__).resolve().parents[1] / "content"


@lru_cache(maxsize=2)
def _load(name: str) -> dict:
    return json.loads((CONTENT / name).read_text(encoding="utf-8"))


@router.get("/library")
def list_topics():
    topics = _load("rights_library.json")["topics"]
    # list view: omit the long body
    return [{k: v for k, v in t.items() if k != "body"} for t in topics]


@router.get("/library/{topic_id}")
def get_topic(topic_id: str):
    for t in _load("rights_library.json")["topics"]:
        if t["id"] == topic_id:
            return t
    raise HTTPException(status_code=404, detail="Topic not found")


@router.get("/directory")
def directory(country: str | None = None):
    orgs = _load("ngos.json")["orgs"]
    if country:
        orgs = [o for o in orgs if o["country"] == country]
    return orgs
