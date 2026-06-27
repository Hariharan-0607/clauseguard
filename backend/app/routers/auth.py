"""Auth endpoints: signup, login, current user."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas import LoginRequest, SignupRequest, TokenOut, UserOut
from app.services.auth import (create_token, hash_password, require_user,
                               verify_password)

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_out(u: User) -> UserOut:
    return UserOut(id=u.id, email=u.email, name=u.name or "", role=u.role or "user")


@router.post("/signup", response_model=TokenOut)
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    if not email or len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Valid email and 6+ char password required.")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    user = User(email=email, name=req.name.strip(), password_hash=hash_password(req.password))
    db.add(user); db.commit(); db.refresh(user)
    return TokenOut(token=create_token(user.id), user=_user_out(user))


@router.post("/login", response_model=TokenOut)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.strip().lower()).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Wrong email or password.")
    return TokenOut(token=create_token(user.id), user=_user_out(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(require_user)):
    return _user_out(user)
