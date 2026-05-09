import logging
import re
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from app.oauth2 import oauth2_scheme
from app.models.document import DocumentUpload, ALLOWED_CATEGORIES
from app.services.storage import save_file, validate_file
from app.services.analysis import extract_text_from_pdf
from app.utils.security import get_current_user
from bson import ObjectId
from datetime import datetime

logger = logging.getLogger("medical-records-app")

router = APIRouter()
def get_db():
    from app.main import app
    return app.mongo_db

def extract_date_from_text(text: str) -> datetime | None:
    """Extract date from document text"""
    date_patterns = [
        r"(?:Report Date|Date of|Service Date|Collection Date|Test Date|Exam Date|DOS|Date:)\s*[:\-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
        r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
        r"(?:Report Date|Date of|Service Date|Collection Date|Test Date|Exam Date|DOS|Date:)\s*[:\-]?\s*(\w+\s+\d{1,2},?\s+\d{4})",
    ]
    
    for pattern in date_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            date_str = match.group(1)
            try:
                for fmt in ["%m/%d/%Y", "%m/%d/%y", "%d/%m/%Y", "%d/%m/%y", "%B %d, %Y", "%b %d, %Y"]:
                    try:
                        return datetime.strptime(date_str, fmt)
                    except:
                        continue
                parsed = datetime.strptime(date_str.replace("-", "/"), "%m/%d/%Y")
                return parsed
            except:
                continue
    return None

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form(...),
    description: str = Form(None),
    document_date: str = Form(None),
    token: str = Depends(oauth2_scheme),
    db=Depends(get_db)
):
    logger.info(f"[UPLOAD] Starting document upload - filename: {file.filename}, category: {category}, document_date: {document_date}")
    if category not in ALLOWED_CATEGORIES:
        logger.warning(f"[UPLOAD] Invalid category: {category}. Allowed: {ALLOWED_CATEGORIES}")
        raise HTTPException(400, "Invalid category")
    
    validate_file(file)
    logger.info(f"[UPLOAD] Authenticating user...")
    user = await get_current_user(token, db)
    logger.info(f"[UPLOAD] User authenticated: {user.get('email', user['_id'])} (ID: {user['_id']})")
    
    file_info = await save_file(file, str(user["_id"]), category)
    logger.info(f"[UPLOAD] File saved successfully: {file_info}")
    
    file_path_str = str(file_info["file_path"])
    parsed_date = None
    
    if document_date:
        try:
            parsed_date = datetime.fromisoformat(document_date.replace('Z', '+00:00'))
            logger.info(f"[UPLOAD] Parsed document date from input: {parsed_date}")
        except Exception as e:
            logger.warning(f"[UPLOAD] Failed to parse document date: {e}")
            parsed_date = None
    else:
        logger.info(f"[UPLOAD] No document date provided, attempting to extract from file...")
        if file_path_str.lower().endswith(('.pdf', '.jpg', '.jpeg', '.png')):
            try:
                text = extract_text_from_pdf(file_path_str) if file_path_str.lower().endswith('.pdf') else ""
                if text:
                    extracted_date = extract_date_from_text(text)
                    if extracted_date:
                        parsed_date = extracted_date
                        logger.info(f"[UPLOAD] Extracted date from document: {parsed_date}")
                    else:
                        logger.info(f"[UPLOAD] No date found in document, using upload date")
            except Exception as e:
                logger.warning(f"[UPLOAD] Failed to extract date from document: {e}")
    
    if not parsed_date:
        parsed_date = datetime.utcnow()
        logger.info(f"[UPLOAD] Using upload date as fallback: {parsed_date}")
    
    doc_dict = {
        "user_id": str(user["_id"]),
        "uploaded_by": str(user["_id"]),
        "category": category,
        "description": description,
        "upload_date": datetime.utcnow(),
        "document_date": parsed_date,
        **file_info
    }
    
    # Generate predicted title
    try:
        from app.services.analysis import generate_document_title
        predicted_title = await generate_document_title(file_path_str, category)
        if predicted_title:
            doc_dict["predicted_title"] = predicted_title
            logger.info(f"[UPLOAD] Generated predicted title: {predicted_title}")
    except Exception as e:
        logger.warning(f"[UPLOAD] Failed to generate title: {e}")
    
    result = await db.documents.insert_one(doc_dict)
    document_id = str(result.inserted_id)
    logger.info(f"[UPLOAD] Document record created in MongoDB with ID: {document_id}")
    
    # Queue analysis instead of running inline
    from app.services.task_queue import create_analysis_task
    task_id = await create_analysis_task(db, document_id, str(user["_id"]), category)
    logger.info(f"[UPLOAD] Analysis queued with task: {task_id}")
    
    # Process queue immediately
    try:
        from app.services.worker import process_all_pending
        await process_all_pending(db, max_tasks=3)
        logger.info(f"[UPLOAD] Processed pending tasks")
    except Exception as e:
        logger.error(f"[UPLOAD] Error processing queue: {e}")
    
    logger.info(f"[UPLOAD] Upload flow completed for document: {document_id}")
    return {"message": "Document uploaded", "document_id": document_id, "task_id": task_id}

@router.post("/bulk-upload")
async def bulk_upload_documents(
    files: list[UploadFile] = File(...),
    category: str = Form(...),
    token: str = Depends(oauth2_scheme),
    db=Depends(get_db)
):
    logger.info(f"[BULK-UPLOAD] Starting bulk upload - {len(files)} files, category: {category}")
    logger.info(f"[BULK-UPLOAD] Request received at /documents/bulk-upload endpoint")
    if category not in ALLOWED_CATEGORIES:
        logger.warning(f"[BULK-UPLOAD] Invalid category: {category}")
        raise HTTPException(400, "Invalid category")
    
    if len(files) > 20:
        raise HTTPException(400, "Maximum 20 files allowed at once")
    
    user = await get_current_user(token, db)
    logger.info(f"[BULK-UPLOAD] User authenticated: {user.get('email', user['_id'])}")
    
    uploaded_docs = []
    errors = []
    
    for file in files:
        try:
            validate_file(file)
            file_info = await save_file(file, str(user["_id"]), category)
            file_path_str = str(file_info["file_path"])
            
            parsed_date = datetime.utcnow()
            if file_path_str.lower().endswith('.pdf'):
                try:
                    text = extract_text_from_pdf(file_path_str)
                    if text:
                        extracted_date = extract_date_from_text(text)
                        if extracted_date:
                            parsed_date = extracted_date
                except:
                    pass
            
            doc_dict = {
                "user_id": str(user["_id"]),
                "uploaded_by": str(user["_id"]),
                "category": category,
                "upload_date": datetime.utcnow(),
                "document_date": parsed_date,
                **file_info
            }
            result = await db.documents.insert_one(doc_dict)
            document_id = str(result.inserted_id)
            
            from app.services.task_queue import create_analysis_task
            
            # Queue analysis instead of running inline
            task_id = await create_analysis_task(db, document_id, str(user["_id"]), category)
            logger.info(f"[BULK-UPLOAD] Analysis queued with task: {task_id}")
            
            uploaded_docs.append({
                "id": document_id,
                "name": file.filename,
                "status": "uploaded"
            })
            logger.info(f"[BULK-UPLOAD] Uploaded: {file.filename}")
            
        except Exception as e:
            logger.error(f"[BULK-UPLOAD] Failed to upload {file.filename}: {e}")
            errors.append({"name": file.filename, "error": str(e)})
    
    logger.info(f"[BULK-UPLOAD] Completed - {len(uploaded_docs)} uploaded, {len(errors)} failed")
    
    # Process queue after bulk upload
    try:
        from app.services.worker import process_all_pending
        await process_all_pending(db, max_tasks=10)
        logger.info(f"[BULK-UPLOAD] Processed pending tasks")
    except Exception as e:
        logger.error(f"[BULK-UPLOAD] Error processing queue: {e}")
    
    return {
        "message": f"Uploaded {len(uploaded_docs)} documents",
        "uploaded": uploaded_docs,
        "errors": errors
    }

from datetime import datetime, timedelta

@router.get("/")
async def list_documents(
    category: str = None,
    date_from: str = None,
    date_to: str = None,
    upload_from: str = None,
    upload_to: str = None,
    token: str = Depends(oauth2_scheme),
    db=Depends(get_db)
):
    logger.info(f"[DOCUMENTS] Listing documents - category: {category}, date_from: {date_from}, date_to: {date_to}, upload_from: {upload_from}, upload_to: {upload_to}")
    user = await get_current_user(token, db)
    logger.info(f"[DOCUMENTS] User: {user.get('email', user['_id'])}")
    query = {"user_id": str(user["_id"])}
    if category:
        query["category"] = category
        logger.info(f"[DOCUMENTS] Filtering by category: {category}")
    
    if date_from or date_to:
        doc_date_filter = {}
        if date_from:
            try:
                doc_date_filter["$gte"] = datetime.strptime(date_from, "%Y-%m-%d")
                logger.info(f"[DOCUMENTS] Filtering from date: {date_from}")
            except Exception as e:
                logger.warning(f"[DOCUMENTS] Failed to parse date_from: {e}")
        if date_to:
            try:
                doc_date_filter["$lte"] = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
                logger.info(f"[DOCUMENTS] Filtering to date: {date_to}")
            except Exception as e:
                logger.warning(f"[DOCUMENTS] Failed to parse date_to: {e}")
        if doc_date_filter:
            query["document_date"] = doc_date_filter
    
    if upload_from or upload_to:
        upload_date_filter = {}
        if upload_from:
            try:
                upload_date_filter["$gte"] = datetime.strptime(upload_from, "%Y-%m-%d")
                logger.info(f"[DOCUMENTS] Filtering upload from: {upload_from}")
            except Exception as e:
                logger.warning(f"[DOCUMENTS] Failed to parse upload_from: {e}")
        if upload_to:
            try:
                upload_date_filter["$lte"] = datetime.strptime(upload_to, "%Y-%m-%d") + timedelta(days=1)
                logger.info(f"[DOCUMENTS] Filtering upload to: {upload_to}")
            except Exception as e:
                logger.warning(f"[DOCUMENTS] Failed to parse upload_to: {e}")
        if upload_date_filter:
            query["upload_date"] = upload_date_filter
    
    logger.info(f"[DOCUMENTS] Final query: {query}")
    cursor = db.documents.find(query).sort("document_date", -1)
    docs = []
    async for doc in cursor:
        doc_date = doc.get("document_date")
        upload_date = doc.get("upload_date")
        
        analysis = await db.analysis_results.find_one({"document_id": str(doc["_id"])})
        
        docs.append({
            "id": str(doc["_id"]),
            "original_name": doc["original_name"],
            "predicted_title": doc.get("predicted_title"),
            "category": doc["category"],
            "file_size": doc["file_size"],
            "upload_date": str(upload_date) if upload_date else None,
            "document_date": str(doc_date) if doc_date else None,
            "description": doc.get("description"),
            "analysis_id": str(analysis["_id"]) if analysis else None
        })
    logger.info(f"[DOCUMENTS] Found {len(docs)} documents")
    return docs

@router.get("/file/{doc_id}")
async def get_document_file(
    doc_id: str,
    token: str = Depends(oauth2_scheme),
    db=Depends(get_db)
):
    """Get the actual document file (image or PDF)"""
    logger.info(f"[DOCUMENTS] Getting file for document: {doc_id}")
    
    try:
        from jose import jwt
        from app.config import settings
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        email = payload.get("sub")
        user = await db.users.find_one({"email": email})
    except Exception as e:
        logger.warning(f"[DOCUMENTS] Token parse failed: {e}")
        raise HTTPException(401, "Invalid token")
    
    if not user:
        raise HTTPException(401, "User not found")
    
    try:
        doc_oid = ObjectId(doc_id)
    except Exception:
        raise HTTPException(400, "Invalid document ID")
    
    doc = await db.documents.find_one({"_id": doc_oid, "user_id": str(user["_id"])})
    if not doc:
        raise HTTPException(404, "Document not found")
    
    file_path = doc.get("file_path")
    if not file_path:
        raise HTTPException(404, "File not found")
    
    storage_type = doc.get("storage_type", "local")
    
    if storage_type == "s3":
        from app.services.storage import get_file_stream
        from fastapi.responses import StreamingResponse
        logger.info(f"[DOCUMENTS] Serving file from S3: {file_path}")
        file_stream = await get_file_stream(file_path)
        if not file_stream:
            raise HTTPException(404, "File not found in S3")
        return StreamingResponse(
            file_stream,
            media_type=doc.get("mime_type", "application/octet-stream"),
            headers={"Content-Disposition": f"inline; filename={doc.get('original_name', 'document')}"}
        )
    else:
        from fastapi.responses import FileResponse
        return FileResponse(
            path=file_path,
            media_type=doc.get("mime_type", "application/octet-stream"),
            filename=doc.get("original_name", "document")
        )

@router.post("/update-titles")
async def update_all_titles(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    """Generate predicted titles for all documents without one"""
    logger.info(f"[UPLOAD] Updating titles for all user documents")
    user = await get_current_user(token, db)
    
    # Find documents without predicted_title
    cursor = db.documents.find({
        "user_id": str(user["_id"]),
        "predicted_title": {"$exists": False}
    })
    
    updated = 0
    from app.services.analysis import generate_document_title
    
    async for doc in cursor:
        file_path = doc.get("file_path")
        category = doc.get("category", "other")
        
        if not file_path:
            continue
        
        storage_type = doc.get("storage_type", "local")
        if storage_type == "s3":
            logger.info(f"[UPLOAD] Skipping S3 doc {doc['_id']}")
            continue
        
        try:
            title = await generate_document_title(file_path, category)
            if title:
                await db.documents.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"predicted_title": title}}
                )
                updated += 1
                logger.info(f"[UPLOAD] Updated title for doc {doc['_id']}: {title}")
        except Exception as e:
            logger.error(f"[UPLOAD] Error updating doc {doc['_id']}: {e}")
    
    logger.info(f"[UPLOAD] Updated {updated} document titles")
    return {"message": f"Updated {updated} document titles"}