"""Admin API — user & role management (RBAC).

Gated by USER_MANAGE, which only the `admin` role holds. This is what makes the
caseworker/reviewer/admin roles reachable: an admin promotes other accounts.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.rbac import require_permission
from app.core.roles import Permission, Role
from app.db import get_db
from app.models import User
from app.schemas import RoleUpdate, UserOut

router = APIRouter(prefix="/admin", tags=["admin"])

_VALID_ROLES = {r.value for r in Role}


def _out(u: User) -> UserOut:
    return UserOut(id=u.id, email=u.email, name=u.name or "", role=u.role or "user")


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db),
               admin: User = Depends(require_permission(Permission.USER_MANAGE))):
    rows = db.query(User).order_by(User.created_at.desc()).limit(200).all()
    return [_out(u) for u in rows]


@router.patch("/users/{user_id}/role", response_model=UserOut)
def set_role(user_id: str, req: RoleUpdate, db: Session = Depends(get_db),
             admin: User = Depends(require_permission(Permission.USER_MANAGE))):
    if req.role not in _VALID_ROLES:
        raise HTTPException(status_code=400,
                            detail=f"Invalid role. Valid: {', '.join(sorted(_VALID_ROLES))}.")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id and req.role != Role.ADMIN.value:
        raise HTTPException(status_code=400, detail="You cannot remove your own admin role.")
    user.role = req.role
    db.commit(); db.refresh(user)
    return _out(user)
