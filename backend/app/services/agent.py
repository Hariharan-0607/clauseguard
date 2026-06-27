"""Personal Legal AI Agent (Module 19) — persistent memory + RAG.

The agent gives each user a continuous assistant that remembers their situation.
Memory is dual-stored:
  - Postgres (AgentMemory)  : durable system-of-record + metadata
  - ChromaDB (vectorstore)  : semantic recall for RAG (namespace per user)

On a chat turn the agent:
  1. retrieves the most relevant memories for the question (vector search),
  2. composes them into the prompt as grounding,
  3. answers via the shared LLM,
  4. logs the turn (AgentMessage) for continuity.

Event-driven: subscribes to 'detection.completed' and 'case.status_changed' to
auto-record facts into the user's memory, so the agent stays current passively.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.core import events
from app.core.repository import Repository
from app.db import SessionLocal
from app.models import AgentMemory, AgentMessage
from app.services import ai
from app.services.vectorstore import store

RECALL_K = 5


class AgentService:
    def __init__(self, db: Session):
        self.db = db
        self.memories = Repository(db, AgentMemory)
        self.messages = Repository(db, AgentMessage)

    def _ns(self, user_id: str) -> str:
        return f"agent_{user_id}"

    def remember(self, user_id: str, content: str, kind: str = "fact", source: str = "") -> AgentMemory:
        mem = AgentMemory(user_id=user_id, content=content, kind=kind, source=source)
        self.memories.add(mem)
        self.memories.commit()
        self.db.refresh(mem)
        store.add(self._ns(user_id), mem.id, content, {"kind": kind, "source": source})
        return mem

    def list_memories(self, user_id: str) -> list[AgentMemory]:
        return (self.db.query(AgentMemory).filter(AgentMemory.user_id == user_id)
                .order_by(AgentMemory.created_at.desc()).limit(100).all())

    def forget(self, user_id: str, memory_id: str) -> bool:
        mem = self.memories.get(memory_id)
        if not mem or mem.user_id != user_id:
            return False
        self.memories.delete(mem)
        self.memories.commit()
        # vector copy is namespaced; deleting the namespace entry is best-effort
        store.add(self._ns(user_id), memory_id, "", {})  # tombstone (empty doc)
        return True

    def chat(self, user_id: str, message: str, jurisdiction: str, language: str) -> dict:
        matches = store.query(self._ns(user_id), message, top_k=RECALL_K)
        used = [m.text for m in matches if m.text.strip()]
        context = "\n".join(f"- {t}" for t in used) or "(no prior context yet)"

        # recent conversation for continuity
        recent = (self.db.query(AgentMessage).filter(AgentMessage.user_id == user_id)
                  .order_by(AgentMessage.created_at.desc()).limit(6).all())
        history = "\n".join(f"{m.role}: {m.content}" for m in reversed(recent))

        system = (
            "You are the user's Personal Legal Agent in JusticeAI. You remember their situation "
            "and give practical, plain-language help (rights, deadlines, next steps). You are not a "
            "lawyer and you say so for anything consequential. Use the remembered context when relevant."
        )
        prompt = (
            f"Jurisdiction: {jurisdiction}. Answer in {language}.\n\n"
            f"WHAT YOU REMEMBER ABOUT THIS USER:\n{context}\n\n"
            f"RECENT CONVERSATION:\n{history or '(none)'}\n\n"
            f"USER MESSAGE: {message}\n\n"
            "Reply helpfully and concisely. If a deadline or risk is implied, call it out."
        )
        answer = ai.call_llm(prompt, system).strip()

        # log the turn
        self.messages.add(AgentMessage(user_id=user_id, role="user", content=message))
        self.messages.add(AgentMessage(user_id=user_id, role="assistant", content=answer))
        self.messages.commit()
        return {"answer": answer, "used_memories": used}


# --------------------------------------------------------------------------- #
#  Event-driven memory seeding (the agent learns passively)
# --------------------------------------------------------------------------- #
def _record_for_user(user_id: str | None, content: str, kind: str, source: str) -> None:
    if not user_id:
        return
    db = SessionLocal()
    try:
        AgentService(db).remember(user_id, content, kind=kind, source=source)
    finally:
        db.close()


@events.subscribe("detection.completed")
def _seed_from_detection(event: events.Event) -> None:
    p = event.payload
    if p.get("finding_count", 0) <= 0:
        return
    content = (f"Ran a {p.get('domain')} check titled '{p.get('title')}': "
               f"{p.get('finding_count')} issue(s), overall severity {p.get('severity')}.")
    _record_for_user(p.get("user_id"), content, kind="case_ref",
                     source=f"detection:{p.get('detection_id')}")


@events.subscribe("case.status_changed")
def _seed_from_case(event: events.Event) -> None:
    p = event.payload
    # case status events don't carry user_id; left as an extension point.
    return None
