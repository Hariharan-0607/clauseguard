"""Personal Legal AI Agent API (Module 19)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.rbac import require_permission
from app.core.roles import Permission
from app.db import get_db
from app.models import AgentMemory, User
from app.schemas import (AgentChatRequest, AgentChatResponse, MemoryIn,
                         MemoryOut)
from app.services.agent import AgentService
from app.services.ai import AIError

router = APIRouter(prefix="/agent", tags=["agent"])


def _mem_out(m: AgentMemory) -> MemoryOut:
    return MemoryOut(id=m.id, kind=m.kind, content=m.content, source=m.source or "")


@router.post("/chat", response_model=AgentChatResponse)
def chat(req: AgentChatRequest, db: Session = Depends(get_db),
         user: User = Depends(require_permission(Permission.AGENT_USE))):
    try:
        result = AgentService(db).chat(user.id, req.message, req.jurisdiction, req.language)
    except AIError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return AgentChatResponse(**result)


@router.get("/memories", response_model=list[MemoryOut])
def list_memories(db: Session = Depends(get_db),
                  user: User = Depends(require_permission(Permission.AGENT_USE))):
    return [_mem_out(m) for m in AgentService(db).list_memories(user.id)]


@router.post("/memories", response_model=MemoryOut)
def add_memory(req: MemoryIn, db: Session = Depends(get_db),
               user: User = Depends(require_permission(Permission.AGENT_USE))):
    mem = AgentService(db).remember(user.id, req.content, kind=req.kind, source=req.source)
    return _mem_out(mem)


@router.delete("/memories/{memory_id}")
def delete_memory(memory_id: str, db: Session = Depends(get_db),
                  user: User = Depends(require_permission(Permission.AGENT_USE))):
    if not AgentService(db).forget(user.id, memory_id):
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"ok": True}
