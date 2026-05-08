import boto3
import os
from pymongo import MongoClient
from gridfs import GridFS
from io import BytesIO
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET", "k4ge-meditrack")
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")

def migrate_documents():
    client = MongoClient(MONGO_URL)
    db = client["medical_records"]
    
    s3 = boto3.client(
        "s3",
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_REGION
    )
    
    local_docs = list(db.documents.find({"storage_type": {"$ne": "s3"}}))
    logger.info(f"Found {len(local_docs)} local documents to migrate")
    
    migrated = 0
    errors = 0
    
    for doc in local_docs:
        doc_id = str(doc["_id"])
        local_path = doc.get("file_path")
        
        if not local_path or not os.path.exists(local_path):
            logger.warning(f"File not found: {local_path}")
            continue
        
        try:
            with open(local_path, "rb") as f:
                content = f.read()
            
            parts = local_path.split("/")
            user_id = parts[-3]
            category = parts[-2]
            file_name = parts[-1]
            
            s3_key = f"{user_id}/{category}/{file_name}"
            
            s3.upload_fileobj(
                BytesIO(content),
                AWS_S3_BUCKET,
                s3_key,
                ExtraArgs={"ContentType": doc.get("mime_type", "application/pdf")}
            )
            
            db.documents.update_one(
                {"_id": doc["_id"]},
                {"$set": {"file_path": s3_key, "storage_type": "s3"}}
            )
            
            os.remove(local_path)
            logger.info(f"Migrated: {doc_id} -> {s3_key}")
            migrated += 1
            
        except Exception as e:
            logger.error(f"Error migrating {doc_id}: {e}")
            errors += 1
    
    logger.info(f"Migration complete: {migrated} migrated, {errors} errors")
    
    client.close()

if __name__ == "__main__":
    migrate_documents()