"""POST /compare — analyse two contracts and say which is safer."""
from fastapi import APIRouter

from app.routers.analyze import analyze_text_core
from app.schemas import CompareRequest, CompareResponse, CompareSide
from app.services import ai

router = APIRouter(tags=["compare"])


def _counts(clauses):
    c = {"illegal": 0, "unfair": 0, "fair": 0}
    for cl in clauses:
        c[cl["verdict"]] = c.get(cl["verdict"], 0) + 1
    return c


@router.post("/compare", response_model=CompareResponse)
def compare(req: CompareRequest):
    clauses_a, lvl_a, score_a, sum_a = analyze_text_core(req.text_a, req.language, req.jurisdiction)
    clauses_b, lvl_b, score_b, sum_b = analyze_text_core(req.text_b, req.language, req.jurisdiction)

    cmp = ai.compare(sum_a, sum_b, req.label_a, req.label_b, req.language)

    return CompareResponse(
        a=CompareSide(label=req.label_a, risk_level=lvl_a, risk_score=score_a,
                      counts=_counts(clauses_a), summary=sum_a),
        b=CompareSide(label=req.label_b, risk_level=lvl_b, risk_score=score_b,
                      counts=_counts(clauses_b), summary=sum_b),
        safer=cmp["safer"], verdict=cmp["verdict"], differences=cmp["differences"],
    )
