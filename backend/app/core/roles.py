"""Role-Based Access Control: roles, permissions, and the permission matrix.

Roles are intentionally coarse so the MVP's "everyone is a user" behaviour is
preserved (default role = USER), while the new advanced modules (case management,
detection review, agent admin) can gate sensitive actions.
"""
from __future__ import annotations

from enum import Enum


class Role(str, Enum):
    """A user's role. Stored as a plain string on the users table."""

    USER = "user"            # the person seeking help (tenant, worker, consumer) — the MVP default
    CASEWORKER = "caseworker"  # NGO / legal-aid staff who manage cases on behalf of users
    REVIEWER = "reviewer"    # reviews/overrides AI detection verdicts
    ADMIN = "admin"          # full access, taxonomy + user management


class Permission(str, Enum):
    # Detection engine
    DETECTION_RUN = "detection:run"
    DETECTION_REVIEW = "detection:review"      # override AI verdicts
    DETECTION_MANAGE_TAXONOMY = "detection:manage_taxonomy"

    # Case management
    CASE_CREATE = "case:create"
    CASE_READ_OWN = "case:read_own"
    CASE_READ_ANY = "case:read_any"
    CASE_UPDATE_ANY = "case:update_any"
    CASE_ASSIGN = "case:assign"

    # Estimation engines
    ESTIMATE_RUN = "estimate:run"

    # Personal agent
    AGENT_USE = "agent:use"
    AGENT_ADMIN = "agent:admin"

    # Platform
    USER_MANAGE = "user:manage"


# Which permissions each role holds. Higher roles inherit lower-role permissions
# explicitly (kept flat for auditability rather than implicit inheritance).
_BASE_USER = {
    Permission.DETECTION_RUN,
    Permission.CASE_CREATE,
    Permission.CASE_READ_OWN,
    Permission.ESTIMATE_RUN,
    Permission.AGENT_USE,
}

ROLE_PERMISSIONS: dict[Role, set[Permission]] = {
    Role.USER: set(_BASE_USER),
    Role.CASEWORKER: _BASE_USER | {
        Permission.CASE_READ_ANY,
        Permission.CASE_UPDATE_ANY,
        Permission.CASE_ASSIGN,
    },
    Role.REVIEWER: _BASE_USER | {
        Permission.DETECTION_REVIEW,
        Permission.CASE_READ_ANY,
    },
    Role.ADMIN: set(Permission),  # everything
}


def role_from_str(value: str | None) -> Role:
    try:
        return Role(value or Role.USER.value)
    except ValueError:
        return Role.USER


def has_permission(role: str | Role, permission: Permission) -> bool:
    r = role if isinstance(role, Role) else role_from_str(role)
    return permission in ROLE_PERMISSIONS.get(r, set())
