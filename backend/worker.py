#!/usr/bin/env python3
"""
Standalone worker script for processing analysis tasks in the background.
This runs as a separate service in Docker to continuously process pending tasks.
"""
import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("medical-records-app-worker")

# Import after logging setup
from app.services.worker import process_all_pending
from app.config import settings


async def main():
    """Main worker loop - continuously process pending tasks"""
    logger.info("[WORKER] Starting background worker service...")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.MONGO_URL)
    db = client[settings.MONGO_DB_NAME]
    
    logger.info(f"[WORKER] Connected to MongoDB: {settings.MONGO_URL}")
    
    # Test connection
    try:
        await db.command("ping")
        logger.info("[WORKER] MongoDB connection verified")
    except Exception as e:
        logger.error(f"[WORKER] Failed to connect to MongoDB: {e}")
        return
    
    logger.info("[WORKER] Entering main processing loop...")
    
    while True:
        try:
            # Process pending tasks
            processed = await process_all_pending(db, max_tasks=5)
            
            if processed > 0:
                logger.info(f"[WORKER] Processed {processed} tasks")
            else:
                # No tasks - sleep for a bit
                await asyncio.sleep(5)
                
        except Exception as e:
            logger.error(f"[WORKER] Error in main loop: {e}", exc_info=True)
            await asyncio.sleep(10)
        
        # Small delay between iterations
        await asyncio.sleep(2)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("[WORKER] Worker stopped by user")
    except Exception as e:
        logger.error(f"[WORKER] Worker crashed: {e}", exc_info=True)
