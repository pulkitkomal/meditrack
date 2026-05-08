import logging
import asyncio
from app.services.task_queue import (
    create_analysis_task, get_pending_tasks, update_task_status, get_task_status, delete_user_tasks
)
from app.services.analysis import analyze_document, save_analysis_result
from app.services.storage import get_file_path, download_s3_file

logger = logging.getLogger("medical-records-app")

async def process_task(db, task: dict):
    """Process a single analysis task"""
    task_id = task["id"]
    document_id = task["document_id"]
    user_id = task["user_id"]
    category = task["category"]
    
    logger.info(f"[WORKER] Processing task {task_id} for document {document_id}")
    
    await update_task_status(db, task_id, "processing")
    
    try:
        from bson import ObjectId
        doc = await db.documents.find_one({"_id": ObjectId(document_id)})
        
        if not doc:
            logger.error(f"[WORKER] Document not found: {document_id}")
            await update_task_status(db, task_id, "failed", error="Document not found")
            return False
        
        file_path = doc.get("file_path")
        storage_type = doc.get("storage_type", "local")
        
        if not file_path:
            logger.error(f"[WORKER] File path not found for document {document_id}")
            await update_task_status(db, task_id, "failed", error="File path not found")
            return False
        
        if storage_type == "s3":
            local_path = await download_s3_file(file_path)
            if not local_path:
                logger.error(f"[WORKER] Failed to download S3 file: {file_path}")
                await update_task_status(db, task_id, "failed", error="Failed to download file from S3")
                return False
            file_path = local_path
        
        analysis_data = await analyze_document(str(file_path), category, user_id, document_id, db)
        
        if analysis_data.get("extracted_data", {}).get("summary") != "Analysis skipped - API key missing":
            await save_analysis_result(db, analysis_data)
            logger.info(f"[WORKER] Analysis result saved for document {document_id}")
        
        await update_task_status(db, task_id, "completed", result={"document_id": document_id})
        logger.info(f"[WORKER] Task {task_id} completed successfully")
        return True
        
    except Exception as e:
        logger.error(f"[WORKER] Error processing task {task_id}: {e}", exc_info=True)
        await update_task_status(db, task_id, "failed", error=str(e))
        return False

async def process_all_pending(db, max_tasks: int = 5):
    """Process all pending tasks"""
    logger.info(f"[WORKER] Fetching pending tasks (max: {max_tasks})")
    tasks = await get_pending_tasks(db, limit=max_tasks)
    
    if not tasks:
        logger.info("[WORKER] No pending tasks found")
        return 0
    
    logger.info(f"[WORKER] Found {len(tasks)} pending tasks")
    
    processed = 0
    for task in tasks:
        success = await process_task(db, task)
        if success:
            processed += 1
    
    logger.info(f"[WORKER] Processed {processed}/{len(tasks)} tasks")
    return processed