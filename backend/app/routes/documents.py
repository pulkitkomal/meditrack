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
    result = await db.documents.insert_one(doc_dict)
    document_id = str(result.inserted_id)
    logger.info(f"[UPLOAD] Document record created in MongoDB with ID: {document_id}")
    
    # Trigger analysis
    from app.services.analysis import analyze_document, save_analysis_result
    from pathlib import Path
    
    if Path(file_path_str).exists():
        logger.info(f"[UPLOAD] File exists at path: {file_path_str}, starting analysis...")
        try:
            analysis_data = await analyze_document(file_path_str, category, str(user["_id"]), document_id, db)
            logger.info(f"[UPLOAD] Analysis completed, saving results...")
            await save_analysis_result(db, analysis_data)
            logger.info(f"[UPLOAD] Analysis results saved successfully for document: {document_id}")
        except Exception as e:
            logger.error(f"[UPLOAD] Analysis failed for document {document_id}: {e}", exc_info=True)
    else:
        logger.warning(f"[UPLOAD] File not found at path: {file_path_str}, skipping analysis")
    
    logger.info(f"[UPLOAD] Upload flow completed for document: {document_id}")
    return {"message": "Document uploaded", "document_id": document_id}

@router.get("/")
async def list_documents(
    category: str = None,
    token: str = Depends(oauth2_scheme),
    db=Depends(get_db)
):
    logger.info(f"[DOCUMENTS] Listing documents - category filter: {category}")
    user = await get_current_user(token, db)
    logger.info(f"[DOCUMENTS] User: {user.get('email', user['_id'])}")
    query = {"user_id": str(user["_id"])}
    if category:
        query["category"] = category
        logger.info(f"[DOCUMENTS] Filtering by category: {category}")
    cursor = db.documents.find(query).sort("document_date", -1)
    docs = []
    async for doc in cursor:
        docs.append({
            "id": str(doc["_id"]),
            "original_name": doc["original_name"],
            "category": doc["category"],
            "file_size": doc["file_size"],
            "upload_date": doc["upload_date"],
            "document_date": doc.get("document_date"),
            "description": doc.get("description")
        })
    logger.info(f"[DOCUMENTS] Found {len(docs)} documents")
    return docs