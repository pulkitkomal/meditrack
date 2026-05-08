import logging
from fastapi import APIRouter, Depends, HTTPException, Body
from bson import ObjectId
from pathlib import Path
from app.oauth2 import oauth2_scheme
from app.utils.security import get_current_user
from app.services.analysis import get_user_analyses, get_analysis_for_document, generate_doctor_questions, analyze_document, save_analysis_result, chat_with_medical_advisor
from app.services.comparison import compare_lab_values, calculate_health_score, get_active_conditions, predict_conditions
from app.services.token_tracker import get_user_usage, get_usage_history
from app.services.task_queue import create_analysis_task, get_task_status, get_user_tasks

logger = logging.getLogger("medical-records-app")

router = APIRouter()

def get_db():
    from app.main import app
    return app.mongo_db

@router.get("/usage")
async def get_usage_stats(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    logger.info(f"[ANALYSIS-ROUTE] GET /usage - Fetching usage stats")
    user = await get_current_user(token, db)
    logger.info(f"[ANALYSIS-ROUTE] User: {user.get('email', user['_id'])}")
    result = await get_user_usage(db, str(user["_id"]))
    logger.info(f"[ANALYSIS-ROUTE] Usage stats returned: {result}")
    return result

@router.get("/usage/history")
async def get_usage_history_endpoint(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    logger.info(f"[ANALYSIS-ROUTE] GET /usage/history - Fetching usage history")
    user = await get_current_user(token, db)
    logger.info(f"[ANALYSIS-ROUTE] User: {user.get('email', user['_id'])}")
    result = await get_usage_history(db, str(user["_id"]))
    logger.info(f"[ANALYSIS-ROUTE] Usage history returned with {len(result) if isinstance(result, list) else 'N/A'} entries")
    return result

@router.post("/analyze/{doc_id}")
async def trigger_analysis(doc_id: str, token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    logger.info(f"[ANALYSIS-ROUTE] POST /analyze/{doc_id} - Queuing analysis")
    user = await get_current_user(token, db)
    logger.info(f"[ANALYSIS-ROUTE] User: {user.get('email', user['_id'])}")
    
    from bson import ObjectId
    doc = await db.documents.find_one({"_id": ObjectId(doc_id), "user_id": str(user["_id"])})
    if not doc:
        logger.warning(f"[ANALYSIS-ROUTE] Document not found: {doc_id}")
        raise HTTPException(404, "Document not found")
    logger.info(f"[ANALYSIS-ROUTE] Document found: {doc.get('original_name')}, category: {doc.get('category')}")
    
    existing = await db.analysis_results.find_one({"document_id": doc_id})
    if existing:
        logger.info(f"[ANALYSIS-ROUTE] Document already analyzed, analysis_id: {existing['_id']}")
        return {"message": "Already analyzed", "analysis_id": str(existing["_id"])}
    
    existing_task = await db.analysis_tasks.find_one({"document_id": doc_id, "status": {"$in": ["pending", "processing"]}})
    if existing_task:
        logger.info(f"[ANALYSIS-ROUTE] Task already exists: {existing_task['_id']}")
        return {"message": "Analysis queued", "task_id": str(existing_task["_id"]), "status": existing_task["status"]}
    
    task_id = await create_analysis_task(db, doc_id, str(user["_id"]), doc["category"])
    logger.info(f"[ANALYSIS-ROUTE] Task created: {task_id}")
    
    return {"message": "Analysis queued", "task_id": task_id}

@router.get("/tasks")
async def get_analysis_queue(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    logger.info(f"[ANALYSIS-ROUTE] GET /tasks - Fetching analysis queue status")
    user = await get_current_user(token, db)
    logger.info(f"[ANALYSIS-ROUTE] User: {user.get('email', user['_id'])}")
    
    tasks = await get_user_tasks(db, str(user["_id"]))
    logger.info(f"[ANALYSIS-ROUTE] Retrieved {len(tasks)} tasks")
    
    return {"tasks": tasks}

@router.get("/tasks/{task_id}")
async def get_task(task_id: str, token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    logger.info(f"[ANALYSIS-ROUTE] GET /tasks/{task_id} - Fetching task status")
    user = await get_current_user(token, db)
    
    task = await get_task_status(db, task_id)
    if not task:
        logger.warning(f"[ANALYSIS-ROUTE] Task not found: {task_id}")
        raise HTTPException(404, "Task not found")
    
    if task["user_id"] != str(user["_id"]):
        logger.warning(f"[ANALYSIS-ROUTE] Unauthorized access to task: {task_id}")
        raise HTTPException(403, "Access denied")
    
    logger.info(f"[ANALYSIS-ROUTE] Task status: {task['status']}")
    return task

@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    """Delete a task from the queue"""
    logger.info(f"[ANALYSIS-ROUTE] DELETE /tasks/{task_id} - Deleting task")
    user = await get_current_user(token, db)
    logger.info(f"[ANALYSIS-ROUTE] User authenticated: {user.get('email', user['_id'])}")
    
    task = await get_task_status(db, task_id)
    if not task:
        logger.warning(f"[ANALYSIS-ROUTE] Task not found: {task_id}")
        raise HTTPException(404, "Task not found")
    
    logger.info(f"[ANALYSIS-ROUTE] Found task: {task}")
    
    if task["user_id"] != str(user["_id"]):
        logger.warning(f"[ANALYSIS-ROUTE] Unauthorized delete attempt")
        raise HTTPException(403, "Access denied")
    
    from bson import ObjectId
    result = await db.analysis_tasks.delete_one({"_id": ObjectId(task_id)})
    logger.info(f"[ANALYSIS-ROUTE] Deleted task: {task_id}, result: {result.deleted_count}")
    
    return {"message": "Task deleted"}

@router.post("/process-queue")
async def process_queue(max_tasks: int = 5):
    """Process pending analysis tasks"""
    from app.main import app
    from app.services.worker import process_all_pending
    
    logger.info(f"[ANALYSIS-ROUTE] POST /process-queue - Processing pending tasks")
    
    try:
        db = app.mongo_db
        if db is not None:
            processed = await process_all_pending(db, max_tasks=max_tasks)
            logger.info(f"[ANALYSIS-ROUTE] Processed {processed} tasks")
            return {"message": f"Processed {processed} tasks"}
    except Exception as e:
        logger.error(f"[ANALYSIS-ROUTE] Error processing queue: {e}")
    
    return {"message": "No tasks processed"}

@router.get("/history")
async def get_history(category: str = None, token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    logger.info(f"[ANALYSIS-ROUTE] GET /history - Fetching analysis history, category filter: {category}")
    user = await get_current_user(token, db)
    logger.info(f"[ANALYSIS-ROUTE] User: {user.get('email', user['_id'])}")
    analyses = await get_user_analyses(db, str(user["_id"]), category)
    logger.info(f"[ANALYSIS-ROUTE] Retrieved {len(analyses)} analyses")
    
    # Add document_date from the associated document
    from bson import ObjectId
    for analysis in analyses:
        doc = await db.documents.find_one({"_id": ObjectId(analysis["document_id"])})
        if doc and doc.get("document_date"):
            analysis["document_date"] = doc["document_date"]
        else:
            analysis["document_date"] = analysis.get("analysis_date")
    
    # Sort by document_date
    analyses.sort(key=lambda x: x.get("document_date", x.get("analysis_date", "")), reverse=True)
    
    # Add comparisons for lab values
    if analyses:
        logger.info(f"[ANALYSIS-ROUTE] Adding comparisons for {len(analyses)} analyses")
        for i, analysis in enumerate(analyses):
            if i < len(analyses) - 1:
                analysis["comparison"] = compare_lab_values(analysis, analyses[i+1:])
        logger.info(f"[ANALYSIS-ROUTE] Comparisons added")
    
    return analyses

@router.get("/summary")
async def get_summary(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    logger.info(f"[ANALYSIS-ROUTE] GET /summary - Fetching health summary")
    user = await get_current_user(token, db)
    logger.info(f"[ANALYSIS-ROUTE] User: {user.get('email', user['_id'])}")
    analyses = await get_user_analyses(db, str(user["_id"]))
    logger.info(f"[ANALYSIS-ROUTE] Retrieved {len(analyses)} analyses for summary")
    
    health_score = calculate_health_score(analyses)
    logger.info(f"[ANALYSIS-ROUTE] Health score calculated: {health_score}")
    active_conditions = get_active_conditions(analyses)
    logger.info(f"[ANALYSIS-ROUTE] Active conditions: {active_conditions}")
    predictions = predict_conditions(analyses)
    logger.info(f"[ANALYSIS-ROUTE] Predictions generated: {len(predictions)} items")
    
    profile_info = {}
    if user.get("age"):
        profile_info["age"] = user["age"]
    if user.get("gender"):
        profile_info["gender"] = user["gender"]
    if user.get("blood_type"):
        profile_info["blood_type"] = user["blood_type"]
    if user.get("medical_conditions"):
        profile_info["medical_conditions"] = user["medical_conditions"]
    if user.get("allergies"):
        profile_info["allergies"] = user["allergies"]
    
    result = {
        "health_score": health_score,
        "active_conditions": active_conditions,
        "total_analyses": len(analyses),
        "predictions": predictions,
        "latest_analysis_date": analyses[0]["analysis_date"] if analyses else None,
        "profile": profile_info
    }
    logger.info(f"[ANALYSIS-ROUTE] Summary returned: {result}")
    return result

@router.get("/doctor-questions")
async def get_doctor_questions(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    logger.info(f"[ANALYSIS-ROUTE] GET /doctor-questions - Generating doctor questions")
    user = await get_current_user(token, db)
    logger.info(f"[ANALYSIS-ROUTE] User: {user.get('email', user['_id'])}")
    
    user_profile = {
        "age": user.get("age"),
        "gender": user.get("gender"),
        "blood_type": user.get("blood_type"),
        "medical_conditions": user.get("medical_conditions", []),
        "allergies": user.get("allergies", []),
        "height": user.get("height"),
        "weight": user.get("weight")
    }
    
    questions = await generate_doctor_questions(db, str(user["_id"]), user_profile)
    logger.info(f"[ANALYSIS-ROUTE] Generated {len(questions)} doctor questions")
    return {"questions": questions}

@router.get("/trends/{category}")
async def get_trends(category: str, token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    logger.info(f"[ANALYSIS-ROUTE] GET /trends/{category} - Fetching trends")
    user = await get_current_user(token, db)
    logger.info(f"[ANALYSIS-ROUTE] User: {user.get('email', user['_id'])}")
    analyses = await get_user_analyses(db, str(user["_id"]), category)
    logger.info(f"[ANALYSIS-ROUTE] Retrieved {len(analyses)} analyses for trends")
    
    trends = []
    if analyses:
        trends = compare_lab_values(analyses[0], analyses[1:])
        logger.info(f"[ANALYSIS-ROUTE] Generated {len(trends)} trend entries")
    
    return {"trends": trends}

@router.get("/{doc_id}")
async def get_analysis(doc_id: str, token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    logger.info(f"[ANALYSIS-ROUTE] GET /{doc_id} - Fetching analysis for display")
    user = await get_current_user(token, db)
    logger.info(f"[ANALYSIS-ROUTE] User: {user.get('email', user['_id'])}")
    analysis = await get_analysis_for_document(db, doc_id)
    if not analysis:
        logger.warning(f"[ANALYSIS-ROUTE] Analysis not found for document: {doc_id}")
        raise HTTPException(404, "Analysis not found")
    analysis["_id"] = str(analysis["_id"])
    
    # Get document info to include file_path
    doc = await db.documents.find_one({"_id": ObjectId(doc_id)})
    if doc and doc.get("file_path"):
        analysis["file_path"] = str(doc["file_path"])
        analysis["mime_type"] = doc.get("mime_type", "")
        analysis["storage_type"] = doc.get("storage_type", "local")
    
    logger.info(f"[ANALYSIS-ROUTE] Analysis found - category: {analysis.get('category')}, date: {analysis.get('analysis_date')}")
    logger.info(f"[ANALYSIS-ROUTE] Returning analysis with keys: {list(analysis.keys())}")
    return analysis

@router.post("/chat")
async def chat(message: str = Body(..., embed=True), token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    logger.info(f"[ANALYSIS-ROUTE] POST /chat - Medical advisor chat")
    user = await get_current_user(token, db)
    logger.info(f"[ANALYSIS-ROUTE] User: {user.get('email', user['_id'])}, message length: {len(message)}")
    
    result = await chat_with_medical_advisor(db, str(user["_id"]), message)
    logger.info(f"[ANALYSIS-ROUTE] Chat response ready, sources: {len(result.get('sources', []))}")
    return result

@router.delete("/{doc_id}")
async def delete_analysis(doc_id: str, token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    logger.info(f"[ANALYSIS-ROUTE] DELETE /{doc_id} - Deleting analysis and document")
    user = await get_current_user(token, db)
    user_id = str(user["_id"])
    
    doc = await db.documents.find_one({"_id": ObjectId(doc_id)})
    if not doc:
        logger.warning(f"[ANALYSIS-ROUTE] Document not found: {doc_id}")
        raise HTTPException(404, "Document not found")
    
    if str(doc.get("user_id")) != user_id:
        logger.warning(f"[ANALYSIS-ROUTE] Unauthorized delete attempt")
        raise HTTPException(403, "Access denied")
    
    file_path = doc.get("file_path")
    if file_path and Path(file_path).exists():
        Path(file_path).unlink()
        logger.info(f"[ANALYSIS-ROUTE] Deleted file: {file_path}")
    
    await db.documents.delete_one({"_id": ObjectId(doc_id)})
    await db.analysis_results.delete_one({"document_id": doc_id})
    await db.analysis_tasks.delete_many({"document_id": doc_id})
    logger.info(f"[ANALYSIS-ROUTE] Deleted document, analysis and tasks for: {doc_id}")
    
    return {"message": "Deleted successfully"}
