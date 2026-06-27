"""Shared infrastructure for JusticeAI advanced modules.

This package holds the cross-cutting building blocks the new modules depend on,
without disturbing the original ClauseGuard MVP:

  - roles.py       : RBAC role enum + permission matrix
  - repository.py  : generic Repository pattern over SQLAlchemy
  - events.py      : lightweight in-process event bus (event-driven design)
  - rbac.py        : FastAPI dependencies for role-based route protection
"""
