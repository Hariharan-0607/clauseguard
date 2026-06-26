"""Authentication helpers — password hashing (stdlib, no extra dep) + JWT."""
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import User

# Optional bearer — many routes work anonymously too.
_bearer = HTTPBearer(auto_error=False)


# --- password hashing (PBKDF2 via stdlib; avoids native bcrypt build issues) ---
def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
    return salt.hex() + "$" + dk.hex()


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, dk_hex = stored.split("$")
    except ValueError:
        return False
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 100_000)
    return hmac.compare_digest(dk.hex(), dk_hex)


# --- JWT ---
def create_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=14)}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User | None:
    """Returns the logged-in user, or None for anonymous requests."""
    if not creds:
        return None
    try:
        payload = jwt.decode(creds.credentials, settings.jwt_secret,
                             algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    return db.get(User, payload.get("sub"))


def require_user(user: User | None = Depends(get_current_user)) -> User:
    if not user:
        raise HTTPException(status_code=401, detail="Please sign in.")
    return user
