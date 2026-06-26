"""POST /analyze — the core pipeline: text/file -> clauses -> explain -> flag -> persist."""
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Analysis, Clause, User
from app.schemas import (AnalysisOut, AnalysisSummary, AnalyzeTextRequest,
                         ClauseOut, RedraftRequest, RedraftResponse)
from app.services import ai, ocr, rights
from app.services.ai import AIError
from app.services.auth import get_current_user
from app.services.segment import split_clauses

router = APIRouter(tags=["analyze"])

MAX_CLAUSES = 25   # keep demo fast & within free-tier rate limits


def analyze_text_core(text, language, jurisdiction):
    """Shared core: text -> (clause_dicts, risk_level, score, summary).

    Used by both /analyze (which persists) and /compare (which doesn't).
    Raises HTTPException on empty text or AI failure.
    """
    pieces = split_clauses(text)[:MAX_CLAUSES]
    if not pieces:
        raise HTTPException(status_code=400, detail="No readable text found in the contract.")

    clause_dicts = []
    for piece in pieces:
        try:
            out = ai.analyze_clause(piece, language)      # explanation + verdict + reason + suggestion
        except AIError as e:
            raise HTTPException(status_code=503, detail=str(e))
        # Match rules against the original text AND the English gist, so the legal
        # engine works even when the contract is written in another language.
        match_text = f"{piece}\n{out.get('english_gist', '')}"
        ruled = rights.apply_rules(match_text, jurisdiction, out["verdict"])
        verdict = ruled["verdict"]
        reason = ruled["reason_override"] or out["reason"]
        clause_dicts.append({
            "original": piece,
            "explanation": out["explanation"],
            "verdict": verdict,
            "reason": reason,
            "citation": ruled["citation"],
            "suggestion": out["suggestion"] if verdict != "fair" else "",
        })

    level, score = rights.overall_risk(clause_dicts)
    summary = ai.summarize(clause_dicts, level, language)
    return clause_dicts, level, score, summary


def _run_pipeline(text, language, jurisdiction, counterparty, title, db, user) -> Analysis:
    clause_dicts, level, score, summary = analyze_text_core(text, language, jurisdiction)

    analysis = Analysis(
        title=title or "Contract", jurisdiction=jurisdiction, language=language,
        risk_level=level, risk_score=score, summary=summary,
        counterparty=counterparty or "", user_id=user.id if user else None,
    )
    for i, c in enumerate(clause_dicts):
        analysis.clauses.append(Clause(order=i, **c))
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis


def _to_out(a: Analysis) -> AnalysisOut:
    return AnalysisOut(
        id=a.id, title=a.title, jurisdiction=a.jurisdiction, language=a.language,
        risk_level=a.risk_level, risk_score=a.risk_score, summary=a.summary,
        clauses=[
            ClauseOut(order=c.order, original=c.original, explanation=c.explanation,
                      verdict=c.verdict, reason=c.reason, citation=c.citation, suggestion=c.suggestion)
            for c in sorted(a.clauses, key=lambda x: x.order)
        ],
    )


@router.post("/analyze", response_model=AnalysisOut)
def analyze_text(req: AnalyzeTextRequest, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    analysis = _run_pipeline(req.text, req.language, req.jurisdiction,
                             req.counterparty or "", req.title, db, user)
    return _to_out(analysis)


@router.post("/analyze/upload", response_model=AnalysisOut)
async def analyze_upload(
    file: UploadFile = File(...),
    language: str = Form("en"),
    jurisdiction: str = Form("IN"),
    counterparty: str = Form(""),
    title: str = Form("Contract"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    data = await file.read()
    text = ocr.extract_text(file.filename, data)
    analysis = _run_pipeline(text, language, jurisdiction, counterparty, title, db, user)
    return _to_out(analysis)


@router.post("/extract")
async def extract(file: UploadFile = File(...)):
    """Pull plain text out of an uploaded file (PDF / image / txt) without analysing it.

    Used by the comparison page so a user can upload a document into a pane.
    """
    data = await file.read()
    text = ocr.extract_text(file.filename, data)
    if not text.strip():
        raise HTTPException(status_code=400, detail="No readable text found in that file.")
    return {"text": text}


@router.get("/analyses", response_model=list[AnalysisSummary])
def list_analyses(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Analysis)
    # logged-in users see their own; anonymous see anonymous (user_id is null)
    q = q.filter(Analysis.user_id == user.id) if user else q.filter(Analysis.user_id.is_(None))
    rows = q.order_by(Analysis.created_at.desc()).limit(50).all()
    return [
        AnalysisSummary(id=a.id, title=a.title, risk_level=a.risk_level, risk_score=a.risk_score,
                        summary=a.summary, jurisdiction=a.jurisdiction, language=a.language)
        for a in rows
    ]


@router.get("/analyses/{analysis_id}", response_model=AnalysisOut)
def get_analysis(analysis_id: str, db: Session = Depends(get_db)):
    analysis = db.get(Analysis, analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return _to_out(analysis)


@router.post("/analyses/{analysis_id}/redraft", response_model=RedraftResponse)
def redraft_analysis(analysis_id: str, req: RedraftRequest, db: Session = Depends(get_db)):
    """Rewrite the whole contract into a fair version, fixing every flagged clause."""
    analysis = db.get(Analysis, analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    clauses = [
        {"original": c.original, "verdict": c.verdict, "reason": c.reason, "suggestion": c.suggestion}
        for c in sorted(analysis.clauses, key=lambda x: x.order)
    ]
    if not clauses:
        raise HTTPException(status_code=400, detail="This analysis has no clauses to redraft.")
    try:
        text = ai.redraft_contract(clauses, analysis.title, req.language or analysis.language)
    except AIError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return RedraftResponse(title=analysis.title or "Contract", text=text)
