"""Taxonomy loader for the Detection Engine.

One JSON file per domain in /taxonomies. This config is what lets a single engine
serve six product modules (Human Rights, Exploitation, Consumer, Dark Patterns,
HR Compliance, Vendor Risk) — adding a new "module" is adding a JSON file.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

TAXONOMY_DIR = Path(__file__).resolve().parents[2] / "taxonomies"

SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}
SEVERITY_BY_RANK = {v: k for k, v in SEVERITY_RANK.items()}


@lru_cache(maxsize=32)
def load_taxonomy(domain: str) -> dict:
    path = TAXONOMY_DIR / f"{domain}.json"
    if not path.exists():
        raise ValueError(f"Unknown detection domain '{domain}'.")
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def list_domains() -> tuple:
    out = []
    for p in sorted(TAXONOMY_DIR.glob("*.json")):
        data = json.loads(p.read_text(encoding="utf-8"))
        out.append({"domain": data["domain"], "label": data.get("label", data["domain"]),
                    "description": data.get("description", ""),
                    "categories": [{"id": c["id"], "label": c["label"]} for c in data.get("categories", [])]})
    return tuple(out)


def category_by_id(domain: str, category_id: str) -> dict | None:
    for c in load_taxonomy(domain).get("categories", []):
        if c["id"] == category_id:
            return c
    return None


def law_for(category: dict, jurisdiction: str) -> str:
    laws = category.get("laws", {})
    return laws.get(jurisdiction) or laws.get("IN") or next(iter(laws.values()), "")
