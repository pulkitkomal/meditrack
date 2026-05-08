import os
import logging
import boto3
from io import BytesIO
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

def get_s3_client():
    if not settings.AWS_S3_BUCKET:
        return None
    return boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION
    )

async def save_file(file: UploadFile, user_id: str, category: str):
    logger.info(f"[STORAGE] Saving file: {file.filename} for user: {user_id}, category: {category}")
    
    content = await file.read()
    logger.info(f"[STORAGE] Read file content, size: {len(content)} bytes")
    
    if len(content) > MAX_FILE_SIZE:
        logger.warning(f"[STORAGE] File size {len(content)} exceeds limit {MAX_FILE_SIZE}")
        raise HTTPException(400, "File exceeds 10MB limit")
    
    file_ext = Path(file.filename).suffix
    unique_name = f"{datetime.utcnow().timestamp()}{file_ext}"
    s3_key = f"{user_id}/{category}/{unique_name}"
    
    if settings.AWS_S3_BUCKET and settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        logger.info(f"[STORAGE] Uploading to S3 bucket: {settings.AWS_S3_BUCKET}")
        s3 = get_s3_client()
        s3.upload_fileobj(
            BytesIO(content),
            settings.AWS_S3_BUCKET,
            s3_key,
            ExtraArgs={"ContentType": file.content_type}
        )
        logger.info(f"[STORAGE] File uploaded to S3: {s3_key}")
        
        file_info = {
            "file_name": unique_name,
            "original_name": file.filename,
            "file_path": s3_key,
            "file_size": len(content),
            "mime_type": file.content_type,
            "storage_type": "s3"
        }
    else:
        user_dir = Path(settings.UPLOAD_DIR) / user_id / category
        user_dir.mkdir(parents=True, exist_ok=True)
        file_path = user_dir / unique_name
        
        with open(file_path, "wb") as f:
            f.write(content)
        logger.info(f"[STORAGE] File saved locally to: {file_path}")
        
        file_info = {
            "file_name": unique_name,
            "original_name": file.filename,
            "file_path": str(file_path),
            "file_size": len(content),
            "mime_type": file.content_type,
            "storage_type": "local"
        }
    
    logger.info(f"[STORAGE] Returning file info: {file_info}")
    return file_info

async def get_file_path(document_id: str, user_id: str, db):
    """Get file path from document record"""
    from bson import ObjectId
    doc = await db.documents.find_one({"_id": ObjectId(document_id), "user_id": user_id})
    if doc and doc.get("file_path"):
        return doc["file_path"]
    return None

async def get_file_stream(s3_key: str):
    """Get file stream from S3"""
    s3 = get_s3_client()
    if not s3:
        return None
    try:
        response = s3.get_object(Bucket=settings.AWS_S3_BUCKET, Key=s3_key)
        return response["Body"]
    except Exception as e:
        logger.warning(f"[STORAGE] Failed to get file from S3: {e}")
        return None