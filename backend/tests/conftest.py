import os

os.environ.update({
    "MONGO_URL": "mongodb://test",
    "MONGO_DB_NAME": "test",
    "SECRET_KEY": "test-secret",
    "ACCESS_TOKEN_EXPIRE_MINUTES": "5",
    "UPLOAD_DIR": "/tmp/test-uploads",
    "CORS_ORIGINS": "http://localhost:6363",
    # Override values from the real .env so tests never touch S3 or OpenAI
    "AWS_S3_BUCKET": "",
    "AWS_ACCESS_KEY_ID": "",
    "AWS_SECRET_ACCESS_KEY": "",
    "OPENAI_API_KEY": "",
})

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

from app.main import app
from app.routes import analysis, auth, chat, documents, readings, telegram, users
from app.utils.security import create_access_token


@pytest.fixture
def db():
    return AsyncMongoMockClient()["test"]


@pytest.fixture
def client(db):
    auth.login_limiter._attempts.clear()
    for module in (analysis, auth, chat, documents, readings, telegram, users):
        app.dependency_overrides[module.get_db] = lambda: db
    # Not used as a context manager so the lifespan (real Mongo, Telegram bot) never starts.
    yield TestClient(app)
    app.dependency_overrides.clear()


async def make_user(db, email: str) -> dict:
    user = {"_id": ObjectId(), "email": email, "first_name": "T", "last_name": "U", "role": "patient"}
    await db.users.insert_one(user)
    user["token"] = create_access_token({"sub": email, "role": "patient"})
    return user


def auth_header(user: dict) -> dict:
    return {"Authorization": f"Bearer {user['token']}"}
