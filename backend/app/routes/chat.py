import logging
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.oauth2 import oauth2_scheme
from app.services.chatbot import (
    chat_allowance, chat_suggestions, get_conversation, run_chat, to_ndjson,
)
from app.utils.security import get_current_user

logger = logging.getLogger("medical-records-app")
router = APIRouter()


def get_db():
    from app.main import app
    return app.mongo_db

CHAT_MAX_MESSAGE_CHARS = 4000


class ChatMessageIn(BaseModel):
    message: str = Field(..., min_length=1, max_length=CHAT_MAX_MESSAGE_CHARS)
    conversation_id: Optional[str] = None


class FeedbackIn(BaseModel):
    rating: Optional[Literal["up", "down"]] = None


async def ensure_allowance(db, user_id: str) -> None:
    allowance = await chat_allowance(db, user_id)
    if allowance["used"] >= allowance["limit"]:
        logger.warning(f"[CHAT] Daily chat allowance reached for user {user_id}")
        raise HTTPException(429, "You've used today's Health Assistant allowance. It resets over the next 24 hours.")


def _summary(conv: dict) -> dict:
    return {
        "id": str(conv["_id"]),
        "title": conv.get("title") or "Conversation",
        "updated_at": conv.get("updated_at"),
        "message_count": len(conv.get("messages", [])),
    }


@router.get("/status")
async def chat_status(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    user = await get_current_user(token, db)
    return {"suggestions": await chat_suggestions(db, user), "allowance": await chat_allowance(db, str(user["_id"]))}


@router.get("/conversations")
async def list_conversations(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    user = await get_current_user(token, db)
    convs = await db.chat_conversations.find(
        {"user_id": str(user["_id"])}, {"title": 1, "updated_at": 1, "messages.role": 1}
    ).sort("updated_at", -1).to_list(length=50)
    return [_summary(c) for c in convs]


@router.get("/conversations/{conversation_id}")
async def read_conversation(conversation_id: str, token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    user = await get_current_user(token, db)
    conv = await get_conversation(db, str(user["_id"]), conversation_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    return {
        **_summary(conv),
        "messages": [
            {k: m.get(k) for k in ("role", "content", "sources", "urgent", "feedback", "created_at")}
            for m in conv.get("messages", [])
        ],
    }


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    user = await get_current_user(token, db)
    conv = await get_conversation(db, str(user["_id"]), conversation_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    await db.chat_conversations.delete_one({"_id": conv["_id"]})
    return {"message": "Conversation deleted"}


@router.delete("/conversations")
async def delete_all_conversations(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    user = await get_current_user(token, db)
    result = await db.chat_conversations.delete_many({"user_id": str(user["_id"])})
    return {"deleted": result.deleted_count}


@router.post("/conversations/{conversation_id}/messages/{index}/feedback")
async def rate_message(conversation_id: str, index: int, body: FeedbackIn, token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    user = await get_current_user(token, db)
    conv = await get_conversation(db, str(user["_id"]), conversation_id)
    messages = conv.get("messages", []) if conv else []
    if not conv or not 0 <= index < len(messages) or messages[index].get("role") != "assistant":
        raise HTTPException(404, "Message not found")
    await db.chat_conversations.update_one({"_id": conv["_id"]}, {"$set": {f"messages.{index}.feedback": body.rating}})
    return {"feedback": body.rating}


@router.post("/messages")
async def send_message(body: ChatMessageIn, token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    user = await get_current_user(token, db)
    await ensure_allowance(db, str(user["_id"]))
    if body.conversation_id and not await get_conversation(db, str(user["_id"]), body.conversation_id):
        raise HTTPException(404, "Conversation not found")

    async def events():
        async for event in run_chat(db, user, body.message.strip(), body.conversation_id):
            yield to_ndjson(event)

    return StreamingResponse(
        events(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
