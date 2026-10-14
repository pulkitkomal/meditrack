import logging
import sys
from logging.handlers import RotatingFileHandler
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from contextlib import asynccontextmanager
from app.config import settings
from app.db import ensure_indexes
from app.routes import auth_router, documents_router, users_router, analysis_router, telegram_router, readings_router

# Configure comprehensive logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        RotatingFileHandler('/tmp/medical-records-app.log', maxBytes=10 * 1024 * 1024, backupCount=3)
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
    await ensure_indexes(app.mongo_db)
    yield
    app.mongo_client.close()

app = FastAPI(title="Medical Records API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(documents_router, prefix="/api/documents", tags=["documents"])
app.include_router(users_router, prefix="/api/users", tags=["users"])
app.include_router(analysis_router, prefix="/api/analysis", tags=["analysis"])
app.include_router(telegram_router, prefix="/api/telegram", tags=["telegram"])
app.include_router(readings_router, prefix="/api/readings", tags=["readings"])

@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"[REQUEST] {request.method} {request.url.path} - Client: {request.client.host if request.client else 'unknown'}")
    response = await call_next(request)
    logger.info(f"[RESPONSE] {request.method} {request.url.path} - Status: {response.status_code}")
    return response

@app.get("/health")
async def health_check():
    return {"status": "healthy"}