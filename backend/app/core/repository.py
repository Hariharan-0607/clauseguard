"""Generic Repository pattern over SQLAlchemy.

Keeps persistence concerns out of the service layer. Each module defines a thin
subclass (or uses the generic) and services depend on the repository, not on the
Session directly — which makes them unit-testable and swappable.
"""
from __future__ import annotations

from typing import Generic, Iterable, Optional, Type, TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import Base

ModelT = TypeVar("ModelT", bound=Base)


class Repository(Generic[ModelT]):
    """CRUD operations for a single ORM model.

    Note: `commit()` is the caller's responsibility (the service layer owns the
    transaction boundary / unit of work), except for `add` which flushes so the
    caller gets a populated primary key.
    """

    def __init__(self, db: Session, model: Type[ModelT]):
        self.db = db
        self.model = model

    def get(self, id_: object) -> Optional[ModelT]:
        return self.db.get(self.model, id_)

    def list(self, *, limit: int = 100, offset: int = 0, **filters) -> list[ModelT]:
        stmt = select(self.model)
        for key, value in filters.items():
            stmt = stmt.where(getattr(self.model, key) == value)
        stmt = stmt.offset(offset).limit(limit)
        return list(self.db.execute(stmt).scalars().all())

    def first(self, **filters) -> Optional[ModelT]:
        rows = self.list(limit=1, **filters)
        return rows[0] if rows else None

    def count(self, **filters) -> int:
        stmt = select(self.model)
        for key, value in filters.items():
            stmt = stmt.where(getattr(self.model, key) == value)
        return len(list(self.db.execute(stmt).scalars().all()))

    def add(self, obj: ModelT) -> ModelT:
        self.db.add(obj)
        self.db.flush()      # populate PK / defaults without ending the transaction
        return obj

    def add_all(self, objs: Iterable[ModelT]) -> list[ModelT]:
        objs = list(objs)
        self.db.add_all(objs)
        self.db.flush()
        return objs

    def delete(self, obj: ModelT) -> None:
        self.db.delete(obj)

    def commit(self) -> None:
        self.db.commit()
