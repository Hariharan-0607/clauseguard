"""Deadline & reminder tracker (per user)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Deadline, User
from app.schemas import DeadlineIn, DeadlineOut
from app.services.auth import require_user

router = APIRouter(prefix="/deadlines", tags=["deadlines"])


def _out(d: Deadline) -> DeadlineOut:
    return DeadlineOut(id=d.id, title=d.title, kind=d.kind, due_date=d.due_date,
                       notes=d.notes or "", done=d.done)


@router.get("", response_model=list[DeadlineOut])
def list_deadlines(db: Session = Depends(get_db), user: User = Depends(require_user)):
    rows = (db.query(Deadline).filter(Deadline.user_id == user.id)
            .order_by(Deadline.due_date).all())
    return [_out(d) for d in rows]


@router.post("", response_model=DeadlineOut)
def add_deadline(req: DeadlineIn, db: Session = Depends(get_db), user: User = Depends(require_user)):
    d = Deadline(user_id=user.id, title=req.title, kind=req.kind,
                 due_date=req.due_date, notes=req.notes)
    db.add(d); db.commit(); db.refresh(d)
    return _out(d)


@router.patch("/{deadline_id}", response_model=DeadlineOut)
def toggle_done(deadline_id: int, db: Session = Depends(get_db), user: User = Depends(require_user)):
    d = db.get(Deadline, deadline_id)
    if not d or d.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")
    d.done = not d.done
    db.commit(); db.refresh(d)
    return _out(d)


@router.delete("/{deadline_id}")
def delete_deadline(deadline_id: int, db: Session = Depends(get_db), user: User = Depends(require_user)):
    d = db.get(Deadline, deadline_id)
    if not d or d.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(d); db.commit()
    return {"ok": True}
