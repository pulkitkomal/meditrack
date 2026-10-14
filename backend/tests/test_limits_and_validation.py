import asyncio
from datetime import datetime, timedelta

import pytest
from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.config import settings
from app.db import ensure_indexes
from app.routes import analysis as analysis_routes
from app.services.task_queue import MAX_TASK_ATTEMPTS, requeue_stale_tasks
from tests.conftest import auth_header, make_user


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_register_requires_privacy_consent_and_records_it(client, db):
    user = {"email": "dan@example.com", "password": "correct-horse", "first_name": "D", "last_name": "E"}
    assert client.post("/api/auth/register", json=user).status_code == 422
    assert client.post("/api/auth/register", json={**user, "accept_privacy_policy": False}).status_code == 422

    assert client.post("/api/auth/register", json={**user, "accept_privacy_policy": True}).status_code == 200
    stored = run(db.users.find_one({"email": "dan@example.com"}))
    assert stored["privacy_consent"]["version"]
    assert "accept_privacy_policy" not in stored


def test_chat_rejects_overlong_messages(client, db):
    alice = run(make_user(db, "alice@example.com"))
    response = client.post("/api/analysis/chat", headers=auth_header(alice), json={"message": "x" * 4001})
    assert response.status_code == 422


def test_chat_blocked_after_daily_quota(client, db, monkeypatch):
    async def fake_chat(*args, **kwargs):
        return {"response": "ok", "sources": []}

    monkeypatch.setattr(analysis_routes, "chat_with_medical_advisor", fake_chat)
    alice = run(make_user(db, "alice@example.com"))
    assert client.post("/api/analysis/chat", headers=auth_header(alice), json={"message": "hi"}).status_code == 200

    run(db.token_usage.insert_one({
        "user_id": str(alice["_id"]), "category": "chat", "timestamp": datetime.utcnow(),
        "total_tokens": settings.DAILY_CHAT_TOKEN_LIMIT,
    }))
    assert client.post("/api/analysis/chat", headers=auth_header(alice), json={"message": "hi"}).status_code == 429


def test_document_analysis_usage_does_not_count_toward_chat_quota(client, db, monkeypatch):
    async def fake_chat(*args, **kwargs):
        return {"response": "ok", "sources": []}

    monkeypatch.setattr(analysis_routes, "chat_with_medical_advisor", fake_chat)
    alice = run(make_user(db, "alice@example.com"))
    run(db.token_usage.insert_one({
        "user_id": str(alice["_id"]), "category": "lab_results", "timestamp": datetime.utcnow(),
        "total_tokens": settings.DAILY_CHAT_TOKEN_LIMIT * 2,
    }))
    assert client.post("/api/analysis/chat", headers=auth_header(alice), json={"message": "hi"}).status_code == 200


def test_profile_update_accepts_valid_values(client, db):
    alice = run(make_user(db, "alice@example.com"))
    response = client.patch("/api/users/me", headers=auth_header(alice), json={
        "blood_type": "AB-", "gender": "female", "age": 40, "date_of_birth": "1986-03-01",
        "allergies": ["penicillin"], "timezone": "Asia/Kolkata", "tracking_types": ["glucose", "weight"],
    })
    assert response.status_code == 200
    body = response.json()
    assert body["blood_type"] == "AB-"
    assert body["date_of_birth"] == "1986-03-01"
    assert body["timezone"] == "Asia/Kolkata"


def test_profile_update_rejects_invalid_values(client, db):
    alice = run(make_user(db, "alice@example.com"))
    for bad in (
        {"blood_type": "ab_"},
        {"age": -1},
        {"timezone": "Mars/Olympus"},
        {"notification_times": ["25:00"]},
        {"tracking_types": ["cholesterol"]},
        {"allergies": ["x" * 101]},
    ):
        assert client.patch("/api/users/me", headers=auth_header(alice), json=bad).status_code == 422, bad


def test_stale_processing_tasks_are_requeued_then_failed(db):
    old = datetime.utcnow() - timedelta(hours=1)
    retry_id, give_up_id, fresh_id = ObjectId(), ObjectId(), ObjectId()
    run(db.analysis_tasks.insert_many([
        {"_id": retry_id, "status": "processing", "started_at": old, "attempts": 1},
        {"_id": give_up_id, "status": "processing", "started_at": old, "attempts": MAX_TASK_ATTEMPTS},
        {"_id": fresh_id, "status": "processing", "started_at": datetime.utcnow(), "attempts": 1},
    ]))

    run(requeue_stale_tasks(db))

    statuses = {t["_id"]: t["status"] for t in run(db.analysis_tasks.find({}).to_list(None))}
    assert statuses == {retry_id: "pending", give_up_id: "failed", fresh_id: "processing"}


def test_ensure_indexes_enforces_unique_email(db):
    run(ensure_indexes(db))
    run(db.users.insert_one({"email": "same@example.com"}))
    with pytest.raises(DuplicateKeyError):
        run(db.users.insert_one({"email": "same@example.com"}))
