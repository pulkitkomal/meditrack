from pymongo import ASCENDING, DESCENDING


async def ensure_indexes(db) -> None:
    """Create the indexes the app's queries rely on. Safe to run on every startup."""
    await db.users.create_index("email", unique=True)
    await db.users.create_index("telegram_chat_id", sparse=True)
    await db.users.create_index("telegram_link_token", sparse=True)

    await db.documents.create_index([("user_id", ASCENDING), ("upload_date", DESCENDING)])
    await db.analysis_results.create_index("document_id")
    await db.analysis_results.create_index([("user_id", ASCENDING), ("document_date", DESCENDING)])
    await db.analysis_tasks.create_index([("status", ASCENDING), ("created_at", ASCENDING)])
    await db.analysis_tasks.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    await db.analysis_tasks.create_index("document_id")
    await db.document_chunks.create_index("user_id")
    await db.document_chunks.create_index("document_id")
    await db.health_readings.create_index([("user_id", ASCENDING), ("type", ASCENDING), ("timestamp", DESCENDING)])
    await db.token_usage.create_index([("user_id", ASCENDING), ("timestamp", DESCENDING)])

    await db.revoked_tokens.create_index("expires_at", expireAfterSeconds=0)
