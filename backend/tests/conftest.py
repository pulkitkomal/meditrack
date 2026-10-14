import os

os.environ.update({
    "MONGO_URL": "mongodb://test",
    "MONGO_DB_NAME": "test",
    "SECRET_KEY": "test-secret",
    "ACCESS_TOKEN_EXPIRE_MINUTES": "5",
    "UPLOAD_DIR": "/tmp/test-uploads",
    "CORS_ORIGINS": "http://localhost:6363",
    "TELEGRAM_WEBHOOK_SECRET": "webhook-secret",
})

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

from app.main import app
from app.routes import analysis, auth, documents, telegram, users
from app.utils.security import create_access_token


@pytest.fixture
def db():
    return AsyncMongoMockClient()["test"]


@pytest.fixture
def client(db):
    for module in (analysis, auth, documents, telegram, users):
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
