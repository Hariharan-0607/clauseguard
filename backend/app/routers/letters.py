"""Letters + per-clause negotiation messages, derived from an analysis."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Analysis, Clause
from app.schemas import (ClauseMessageRequest, ClauseMessageResponse, LetterOut,
                         LetterRequest)
from app.services import ai
from app.services.ai import AIError

router = APIRouter(tags=["letters"])

VALID_TYPES = {"negotiation", "response", "complaint"}


@router.post("/letters", response_model=LetterOut)
def make_letter(req: LetterRequest, db: Session = Depends(get_db)):
    if req.letter_type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"letter_type must be one of {VALID_TYPES}")
    analysis = db.get(Analysis, req.analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    clauses = [
        {"original": c.original, "verdict": c.verdict, "reason": c.reason}
        for c in analysis.clauses
    ]
    text = ai.generate_letter(req.letter_type, clauses, req.language or analysis.language)
    return LetterOut(letter_type=req.letter_type, text=text)


@router.post("/clauses/message", response_model=ClauseMessageResponse)
def clause_message(req: ClauseMessageRequest, db: Session = Depends(get_db)):
    """Draft a short message asking the other party to fix ONE flagged clause (redline mode)."""
    analysis = db.get(Analysis, req.analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    clause = (db.query(Clause)
              .filter(Clause.analysis_id == analysis.id, Clause.order == req.clause_order)
              .first())
    if not clause:
        raise HTTPException(status_code=404, detail="Clause not found")
    try:
        msg = ai.negotiation_message(clause.original, clause.reason, clause.suggestion,
                                     req.language or analysis.language)
    except AIError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return ClauseMessageResponse(message=msg)
