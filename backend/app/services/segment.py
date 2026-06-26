"""Split raw contract text into individual clauses.

Heuristics, in priority order:
  1. Numbered/lettered headings:  "1.", "1)", "(a)", "Section 3", "Clause 4"
  2. Otherwise: blank-line separated blocks
  3. Otherwise: sentence splitting as a last resort
Kept deliberately simple — good enough for a clear demo, no ML needed.
"""
import re

_NUMBERED = re.compile(
    r"(?:^|\n)\s*(?:"
    r"(?:clause|section|article)\s+\d+|"   # Clause 3 / Section 2
    r"\(?[0-9]{1,2}[.)]|"                    # 1.  2)  (3)
    r"\(?[a-z][.)]"                          # a.  b)  (c)
    r")",
    re.IGNORECASE,
)


def split_clauses(text: str) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []

    # 1) split on numbered/lettered markers, keeping the marker with its clause
    matches = list(_NUMBERED.finditer(text))
    if len(matches) >= 2:
        clauses = []
        for i, m in enumerate(matches):
            start = m.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            chunk = text[start:end].strip()
            if chunk:
                clauses.append(chunk)
        if len(clauses) >= 2:
            return _clean(clauses)

    # 2) blank-line separated blocks
    blocks = [b.strip() for b in re.split(r"\n\s*\n", text) if b.strip()]
    if len(blocks) >= 2:
        return _clean(blocks)

    # 3) sentence fallback
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    return _clean(sentences) if sentences else [text]


def _clean(clauses: list[str]) -> list[str]:
    out = []
    for c in clauses:
        c = re.sub(r"\s+", " ", c).strip()
        if len(c) >= 10:          # drop stray fragments / page numbers
            out.append(c)
    return out or clauses
