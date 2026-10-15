import logging
from app.services.storage import delete_stored_file

logger = logging.getLogger("medical-records-app")

USER_OWNED_COLLECTIONS = [
    "documents", "analysis_results", "analysis_tasks", "document_chunks", "health_readings", "token_usage", "chat_conversations",
]


async def delete_document_data(db, doc: dict) -> None:
    """Delete a document's stored file and everything derived from it."""
    delete_stored_file(doc)
    doc_id = str(doc["_id"])
    await db.analysis_results.delete_many({"document_id": doc_id})
    await db.analysis_tasks.delete_many({"document_id": doc_id})
    await db.document_chunks.delete_many({"document_id": doc_id})
    await db.documents.delete_one({"_id": doc["_id"]})
    logger.info(f"[USER-DATA] Deleted document {doc_id} and derived data")


async def delete_user_data(db, user: dict) -> None:
    """Delete every stored file and record belonging to a user, then the user."""
    user_id = str(user["_id"])
    async for doc in db.documents.find({"user_id": user_id}):
        delete_stored_file(doc)
    for name in USER_OWNED_COLLECTIONS:
        await db[name].delete_many({"user_id": user_id})
    await db.users.delete_one({"_id": user["_id"]})
    logger.info(f"[USER-DATA] Deleted account {user_id} and all associated data")


async def export_user_data(db, user: dict) -> dict:
    """Return all of a user's records (without secrets or embeddings) for download."""
    user_id = str(user["_id"])
    secret_fields = {"password_hash", "telegram_link_token", "telegram_link_expires", "token_version"}
    profile = {k: v for k, v in user.items() if k not in secret_fields}

    export = {"profile": profile}
    projections = {"document_chunks": {"embedding": 0}}
    for name in USER_OWNED_COLLECTIONS:
        export[name] = await db[name].find({"user_id": user_id}, projections.get(name)).to_list(length=None)
    return export
