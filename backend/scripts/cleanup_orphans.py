#!/usr/bin/env python3
"""
Remove data left behind by documents and accounts deleted before deletion was fixed:
chatbot chunks, analyses, and tasks whose document no longer exists, and S3 objects
that no document references.

Dry run by default; pass --apply to actually delete.
Run from the backend directory: python -m scripts.cleanup_orphans [--apply]
"""
import argparse
import asyncio
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings
from app.services.storage import get_s3_client


async def main(apply: bool):
    db = AsyncIOMotorClient(settings.MONGO_URL)[settings.MONGO_DB_NAME]

    existing_doc_ids = {str(d["_id"]) async for d in db.documents.find({}, {"_id": 1})}
    referenced_keys = {
        d["file_path"] async for d in db.documents.find({"storage_type": "s3"}, {"file_path": 1})
    }

    for name in ("document_chunks", "analysis_results", "analysis_tasks"):
        referenced = await db[name].distinct("document_id")
        orphaned = [doc_id for doc_id in referenced if doc_id not in existing_doc_ids]
        count = await db[name].count_documents({"document_id": {"$in": orphaned}}) if orphaned else 0
        print(f"{name}: {count} records for {len(orphaned)} deleted documents")
        if apply and orphaned:
            await db[name].delete_many({"document_id": {"$in": orphaned}})

    s3 = get_s3_client()
    if not s3:
        print("S3 not configured; skipping bucket scan")
        return

    orphaned_keys = []
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=settings.AWS_S3_BUCKET):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            user_id = key.split("/", 1)[0]
            # Only consider keys in the app's <user_id>/<category>/<file> layout
            if ObjectId.is_valid(user_id) and key not in referenced_keys:
                orphaned_keys.append(key)

    print(f"S3: {len(orphaned_keys)} objects not referenced by any document")
    if apply:
        for i in range(0, len(orphaned_keys), 1000):
            batch = [{"Key": key} for key in orphaned_keys[i:i + 1000]]
            s3.delete_objects(Bucket=settings.AWS_S3_BUCKET, Delete={"Objects": batch})

    print("Deleted." if apply else "Dry run only. Re-run with --apply to delete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="actually delete the orphaned data")
    asyncio.run(main(parser.parse_args().apply))
