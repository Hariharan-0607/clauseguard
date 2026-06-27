"""FastAPI dependencies for role-based access control.

Usage in a router:

    from app.core.rbac import require_permission
    from app.core.roles import Permission

    @router.post("/cases/{id}/assign")
    def assign(..., user = Depends(require_permission(Permission.CASE_ASSIGN))):
        ...
"""
from __future__ import annotations

from fastapi import Depends, HTTPException

from app.core.roles import Permission, Role, has_permission
from app.models import User
from app.services.auth import require_user


def require_permission(permission: Permission):
    """Return a dependency that 403s unless the current user holds `permission`."""

    def _dep(user: User = Depends(require_user)) -> User:
        if not has_permission(user.role, permission):
            raise HTTPException(
                status_code=403,
                detail=f"Your role ({user.role}) lacks permission '{permission.value}'.",
            )
        return user

    return _dep


def require_role(*roles: Role):
    """Return a dependency that 403s unless the user's role is one of `roles`."""
    allowed = {r.value for r in roles}

    def _dep(user: User = Depends(require_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Requires role: {', '.join(sorted(allowed))}.",
            )
        return user

    return _dep
