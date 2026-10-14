import asyncio

from app.services import analysis as analysis_service
from app.services.task_queue import claim_task, create_analysis_task
from tests.conftest import auth_header, make_user

NEW_USER = {"email": "carol@example.com", "password": "correct-horse", "first_name": "C", "last_name": "D"}


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_register_ignores_client_supplied_role(client, db):
    response = client.post("/api/auth/register", json={**NEW_USER, "role": "admin"})
    assert response.status_code == 200
    user = run(db.users.find_one({"email": NEW_USER["email"]}))
    assert user["role"] == "patient"


def test_register_rejects_short_password(client):
    response = client.post("/api/auth/register", json={**NEW_USER, "password": "short"})
    assert response.status_code == 422


def test_login_sets_httponly_cookie_and_hides_token(client):
    client.post("/api/auth/register", json=NEW_USER)
    response = client.post("/api/auth/login", json={"email": NEW_USER["email"], "password": NEW_USER["password"]})
    assert response.status_code == 200
    assert "access_token" not in response.json()
    set_cookie = response.headers["set-cookie"].lower()
    assert "access_token=" in set_cookie
    assert "httponly" in set_cookie
    assert "samesite=strict" in set_cookie

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == NEW_USER["email"]

    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401


def test_login_is_rate_limited_after_repeated_failures(client):
    client.post("/api/auth/register", json=NEW_USER)
    for _ in range(5):
        response = client.post("/api/auth/login", json={"email": NEW_USER["email"], "password": "wrong-password"})
        assert response.status_code == 401

    blocked = client.post("/api/auth/login", json={"email": NEW_USER["email"], "password": NEW_USER["password"]})
    assert blocked.status_code == 429


def test_upload_rejects_content_that_does_not_match_type(client, db):
    alice = run(make_user(db, "alice@example.com"))
    response = client.post(
        "/api/documents/upload",
        headers=auth_header(alice),
        data={"category": "lab_results"},
        files={"file": ("report.pdf", b"<html><script>alert(1)</script></html>", "application/pdf")},
    )
    assert response.status_code == 400
    assert run(db.documents.count_documents({})) == 0


def test_upload_queues_work_without_calling_openai_inline(client, db, monkeypatch):
    async def fail_if_called(*args, **kwargs):
        raise AssertionError("upload must not call OpenAI inline")

    monkeypatch.setattr(analysis_service, "generate_document_title", fail_if_called)
    monkeypatch.setattr(analysis_service, "analyze_document", fail_if_called)

    alice = run(make_user(db, "alice@example.com"))
    response = client.post(
        "/api/documents/upload",
        headers=auth_header(alice),
        data={"category": "lab_results", "document_date": "2026-01-01"},
        files={"file": ("../../etc/passwd.pdf", b"%PDF-1.4\n%fake\n", "application/pdf")},
    )
    assert response.status_code == 200
    doc = run(db.documents.find_one({}))
    assert doc["file_name"].endswith(".pdf")
    assert ".." not in doc["file_path"]
    task = run(db.analysis_tasks.find_one({}))
    assert task["status"] == "pending"


def test_task_can_only_be_claimed_once(db):
    task_id = run(create_analysis_task(db, "doc", "user", "lab_results"))
    assert run(claim_task(db, task_id)) is True
    assert run(claim_task(db, task_id)) is False
