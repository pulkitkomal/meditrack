import logging
import sys
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from contextlib import asynccontextmanager
from app.config import settings
from app.routes import auth_router, documents_router, users_router, analysis_router, telegram_router

# Configure comprehensive logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('/tmp/medical-records-app.log')
    ]
)
logger = logging.getLogger("medical-records-app")
logger.info("=" * 60)
logger.info("Medical Records App starting up...")
logger.info("=" * 60)

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.mongo_client = AsyncIOMotorClient(settings.MONGO_URL)
    app.mongo_db = app.mongo_client[settings.MONGO_DB_NAME]
    
    # Initialize Telegram bot (in separate process)
    import multiprocessing
    def run_bot_process():
        import asyncio
        from app.services.telegram_bot import setup_bot, start_bot
        bot_app = setup_bot()
        if bot_app:
            asyncio.run(start_bot())
    
    bot_process = multiprocessing.Process(target=run_bot_process, daemon=True)
    bot_process.start()
    logger.info("[TELEGRAM] Bot started in separate process")
    
    yield
    app.mongo_client.close()

app = FastAPI(title="Medical Records API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(documents_router, prefix="/api/documents", tags=["documents"])
app.include_router(users_router, prefix="/api/users", tags=["users"])
app.include_router(analysis_router, prefix="/api/analysis", tags=["analysis"])
app.include_router(telegram_router, prefix="/api/telegram", tags=["telegram"])

@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"[REQUEST] {request.method} {request.url.path} - Client: {request.client.host if request.client else 'unknown'}")
    response = await call_next(request)
    logger.info(f"[RESPONSE] {request.method} {request.url.path} - Status: {response.status_code}")
    return response

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/logs")
async def get_logs(lines: int = 50):
    """Return the last N lines of the log file for debugging"""
    try:
        with open('/tmp/medical-records-app.log', 'r') as f:
            log_lines = f.readlines()
            return {"logs": log_lines[-lines:]}
    except Exception as e:
        return {"error": str(e), "message": "Could not read log file"}