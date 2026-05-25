import asyncio
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
from app.services.analysis import generate_chunks_from_analysis, save_document_chunks


async def update_existing_embeddings():
    """Generate embeddings for existing documents that have analysis results but no chunks"""
    client = AsyncIOMotorClient(settings.MONGO_URL)
    db = client[settings.MONGO_DB_NAME]
    
    print("Finding analysis results without document chunks...")
    
    cursor = db.analysis_results.find({})
    
    total_analyses = await db.analysis_results.count_documents({})
    print(f"Total analysis results: {total_analyses}")
    
    processed = 0
    skipped = 0
    updated = 0
    errors = 0
    
    async for analysis in cursor:
        document_id = analysis.get("document_id")
        user_id = analysis.get("user_id")
        
        if not document_id or not user_id:
            skipped += 1
            continue
        
        existing_chunks = await db.document_chunks.count_documents({
            "document_id": document_id
        })
        
        if existing_chunks > 0:
            skipped += 1
            continue
        
        print(f"Processing document {document_id} (user: {user_id})")
        
        try:
            chunks = await generate_chunks_from_analysis(analysis)
            
            if chunks:
                for chunk in chunks:
                    chunk["user_id"] = user_id
                    chunk["document_id"] = document_id
                
                await save_document_chunks(db, chunks)
                updated += 1
                print(f"  - Generated and saved {len(chunks)} chunks")
            else:
                print(f"  - No chunks generated (empty analysis)")
                skipped += 1
                
        except Exception as e:
            print(f"  - Error: {e}")
            errors += 1
        
        processed += 1
        
        if processed % 10 == 0:
            print(f"Progress: {processed}/{total_analyses} processed, {updated} updated, {skipped} skipped, {errors} errors")
    
    print(f"\nDone!")
    print(f"Total processed: {processed}")
    print(f"Updated with chunks: {updated}")
    print(f"Skipped (already have chunks or no analysis): {skipped}")
    print(f"Errors: {errors}")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(update_existing_embeddings())