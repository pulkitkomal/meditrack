import logging
from bson import ObjectId
from datetime import datetime
from typing import Optional

logger = logging.getLogger("medical-records-app")

TASK_STATUSES = ["pending", "processing", "completed", "failed"]

async def create_analysis_task(db, document_id: str, user_id: str, category: str) -> str:
    """Create a new analysis task in the queue"""
    task_doc = {
        "document_id": document_id,
        "user_id": user_id,
        "category": category,
        "status": "pending",
        "created_at": datetime.utcnow(),
        "started_at": None,
        "completed_at": None,
        "error": None,
        "result": None
    }
    result = await db.analysis_tasks.insert_one(task_doc)
    task_id = str(result.inserted_id)
    logger.info(f"[TASK] Created analysis task: {task_id} for document: {document_id}")
    return task_id

async def get_task_status(db, task_id: str) -> Optional[dict]:
    """Get status of a specific task"""
    try:
        task = await db.analysis_tasks.find_one({"_id": ObjectId(task_id)})
        if task:
            return {
                "id": str(task["_id"]),
                "document_id": task["document_id"],
                "user_id": task["user_id"],
                "category": task["category"],
                "status": task["status"],
                "created_at": task["created_at"],
                "started_at": task.get("started_at"),
                "completed_at": task.get("completed_at"),
                "error": task.get("error")
            }
    except Exception as e:
        logger.error(f"[TASK] Error fetching task {task_id}: {e}")
    return None

async def get_user_tasks(db, user_id: str, status: str = None) -> list:
    """Get all tasks for a user, optionally filtered by status"""
    query = {"user_id": user_id}
    if status:
        query["status"] = status
    
    cursor = db.analysis_tasks.find(query).sort("created_at", -1)
    tasks = []
    async for task in cursor:
        tasks.append({
            "id": str(task["_id"]),
            "document_id": task["document_id"],
            "user_id": task["user_id"],
            "category": task["category"],
            "status": task["status"],
            "created_at": task["created_at"],
            "started_at": task.get("started_at"),
            "completed_at": task.get("completed_at"),
            "error": task.get("error")
        })
    return tasks

async def get_pending_tasks(db, limit: int = 10) -> list:
    """Get pending tasks for processing"""
    cursor = db.analysis_tasks.find({"status": "pending"}).sort("created_at", 1).limit(limit)
    tasks = []
    async for task in cursor:
        tasks.append({
            "id": str(task["_id"]),
            "document_id": task["document_id"],
            "user_id": task["user_id"],
            "category": task["category"]
        })
    return tasks

async def update_task_status(db, task_id: str, status: str, error: str = None, result: dict = None) -> bool:
    """Update task status"""
    if status not in TASK_STATUSES:
        logger.warning(f"[TASK] Invalid status: {status}")
        return False
    
    update_fields = {"status": status}
    if status == "processing":
        update_fields["started_at"] = datetime.utcnow()
    elif status in ["completed", "failed"]:
        update_fields["completed_at"] = datetime.utcnow()
    if error:
        update_fields["error"] = error
    if result:
        update_fields["result"] = result
    
    try:
        await db.analysis_tasks.update_one(
            {"_id": ObjectId(task_id)},
            {"$set": update_fields}
        )
        logger.info(f"[TASK] Updated task {task_id} status to: {status}")
        return True
    except Exception as e:
        logger.error(f"[TASK] Error updating task {task_id}: {e}")
        return False

async def delete_user_tasks(db, user_id: str, document_id: str) -> int:
    """Delete tasks for a specific document"""
    try:
        result = await db.analysis_tasks.delete_many({
            "user_id": user_id,
            "document_id": document_id
        })
        return result.deleted_count
    except Exception as e:
        logger.error(f"[TASK] Error deleting tasks: {e}")
        return 0