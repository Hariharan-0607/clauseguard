"""POST /chat — page-aware know-your-rights assistant.

The floating widget sends the visible page text as `page_context` so the assistant
can answer questions about whatever the user is currently looking at, grounded in
the jurisdiction rule pack.
"""
from fastapi import APIRouter, HTTPException

from app.schemas import ChatRequest, ChatResponse
from app.services import ai
from app.services.ai import AIError
from app.services.rights import load_rules

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    rules = load_rules(req.jurisdiction)
    rules_ctx = "\n".join(
        f"- {r.get('plain_reason', '')} ({r.get('citation', '')})"
        for r in rules if r.get("plain_reason")
    ) or "No specific rules loaded; answer generally and suggest local legal aid."

    context = f"JURISDICTION RULES:\n{rules_ctx}"
    if req.page_context:
        snippet = req.page_context[:3000]   # cap to stay within free-tier limits
        page = f" ({req.page_name})" if req.page_name else ""
        context += (
            f"\n\nWHAT THE USER IS CURRENTLY VIEWING{page}:\n\"\"\"{snippet}\"\"\"\n"
            "If the question refers to 'this', 'the page', 'this clause', etc., use the content above."
        )

    try:
        answer = ai.chat_answer(req.question, context, req.language)
    except AIError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return ChatResponse(answer=answer)
