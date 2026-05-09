import asyncio
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
from app.services.analysis import generate_document_title

async def update_existing_documents():
    """Generate predicted titles for all existing documents that don't have one"""
    client = AsyncIOMotorClient(settings.MONGO_URL)
    db = client[settings.MONGO_DB_NAME]
    
    print("Finding documents without predicted titles...")
    
    # Find all documents without predicted_title
    cursor = db.documents.find({"predicted_title": {"$exists": False}})
    
    count = 0
    updated = 0
    
    async for doc in cursor:
        count += 1
        doc_id = str(doc["_id"])
        file_path = doc.get("file_path")
        category = doc.get("category", "other")
        
        if not file_path:
            print(f"Skipping doc {doc_id} - no file path")
            continue
        
        print(f"Processing doc {count}: {doc.get('original_name', 'unknown')}")
        
        # Check if file exists or is S3
        if doc.get("storage_type") == "s3":
            print(f"  - Skipping S3 document (would need download): {file_path}")
            continue
        
        try:
            title = await generate_document_title(file_path, category)
            if title:
                await db.documents.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"predicted_title": title}}
                )
                updated += 1
                print(f"  - Updated: {title}")
            else:
                print(f"  - No title generated")
        except Exception as e:
            print(f"  - Error: {e}")
    
    print(f"\nDone! Processed {count} documents, updated {updated} with titles.")
    client.close()

if __name__ == "__main__":
    asyncio.run(update_existing_documents())