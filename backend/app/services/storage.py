import os
import logging
from pathlib import Path
from fastapi import UploadFile, HTTPException
from datetime import datetime
from app.config import settings

logger = logging.getLogger("medical-records-app")

ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"]
MAX_FILE_SIZE = 10 * 1024 * 1024

def validate_file(file: UploadFile):
    logger.info(f"[STORAGE] Validating file: {file.filename}, content_type: {file.content_type}, size: unknown (validated after read)")
    if file.content_type not in ALLOWED_MIME_TYPES:
        logger.warning(f"[STORAGE] File validation failed: {file.filename} has invalid content type: {file.content_type}")
        raise HTTPException(400, "Only PDF, JPG, PNG allowed")
    logger.info(f"[STORAGE] File validation passed for: {file.filename}")

async def save_file(file: UploadFile, user_id: str, category: str):
    logger.info(f"[STORAGE] Saving file: {file.filename} for user: {user_id}, category: {category}")
    user_dir = Path(settings.UPLOAD_DIR) / user_id / category
    user_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"[STORAGE] Created/upload directory: {user_dir}")
    
    file_ext = Path(file.filename).suffix
    unique_name = f"{datetime.utcnow().timestamp()}{file_ext}"
    file_path = user_dir / unique_name
    logger.info(f"[STORAGE] Generated unique filename: {unique_name}, full path: {file_path}")
    
    content = await file.read()
    logger.info(f"[STORAGE] Read file content, size: {len(content)} bytes")
    
    if len(content) > MAX_FILE_SIZE:
        logger.warning(f"[STORAGE] File size {len(content)} exceeds limit {MAX_FILE_SIZE}")
        raise HTTPException(400, "File exceeds 10MB limit")
    
    with open(file_path, "wb") as f:
        f.write(content)
    logger.info(f"[STORAGE] File saved successfully to: {file_path}")
    
    file_info = {
        "file_name": unique_name,
        "original_name": file.filename,
        "file_path": str(file_path),
        "file_size": len(content),
        "mime_type": file.content_type
    }
    logger.info(f"[STORAGE] Returning file info: {file_info}")
    return file_info