from datetime import datetime
from typing import Dict, List

async def log_usage_to_db(db, user_id: str, usage_data: dict, category: str, model: str = "gpt-4o-mini"):
    """Log token usage from OpenAI response to MongoDB"""
    await db.token_usage.insert_one({
        "user_id": user_id,
        "timestamp": datetime.utcnow(),
        "category": category,
        "prompt_tokens": usage_data.get("prompt_tokens", 0),
        "completion_tokens": usage_data.get("completion_tokens", 0),
        "total_tokens": usage_data.get("total_tokens", 0),
        "model": model
    })

async def get_user_usage(db, user_id: str) -> Dict:
    """Get total token usage for a user"""
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": None,
            "total_tokens": {"$sum": "$total_tokens"},
            "total_prompt_tokens": {"$sum": "$prompt_tokens"},
            "total_completion_tokens": {"$sum": "$completion_tokens"},
            "request_count": {"$sum": 1}
        }}
    ]
    result = await db.token_usage.aggregate(pipeline).to_list(length=1)
    if result and len(result) > 0:
        return {
            "total_tokens": result[0]["total_tokens"],
            "total_prompt_tokens": result[0]["total_prompt_tokens"],
            "total_completion_tokens": result[0]["total_completion_tokens"],
            "request_count": result[0]["request_count"]
        }
    return {
        "total_tokens": 0,
        "total_prompt_tokens": 0,
        "total_completion_tokens": 0,
        "request_count": 0
    }

async def get_usage_history(db, user_id: str, limit: int = 50) -> List[Dict]:
    """Get token usage history for a user"""
    cursor = db.token_usage.find({"user_id": user_id}).sort("timestamp", -1).limit(limit)
    history = []
    async for doc in cursor:
        history.append({
            "id": str(doc["_id"]),
            "timestamp": doc["timestamp"],
            "category": doc["category"],
            "prompt_tokens": doc["prompt_tokens"],
            "completion_tokens": doc["completion_tokens"],
            "total_tokens": doc["total_tokens"],
            "model": doc.get("model", "gpt-4o-mini")
        })
    return history

async def get_all_usage(db) -> Dict:
    """Get total usage across all users (admin function)"""
    pipeline = [
        {"$group": {
            "_id": None,
            "total_tokens": {"$sum": "$total_tokens"},
            "total_requests": {"$sum": 1},
            "unique_users": {"$addToSet": "$user_id"}
        }}
    ]
    result = await db.token_usage.aggregate(pipeline).to_list(length=1)
    if result is not None:
        return {
            "total_tokens": result[0]["total_tokens"],
            "total_requests": result[0]["total_requests"],
            "unique_users": len(result[0]["unique_users"])
        }
    return {
        "total_tokens": 0,
        "total_requests": 0,
        "unique_users": 0
    }
