import asyncio

from bson import ObjectId

from app.services import worker
from tests.conftest import auth_header, make_user


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def setup_two_users_with_analysis(db):
    alice = run(make_user(db, "alice@example.com"))
    bob = run(make_user(db, "bob@example.com"))
    doc_id = ObjectId()
    run(db.documents.insert_one({"_id": doc_id, "user_id": str(alice["_id"]), "file_path": "/secret/alice.pdf"}))
    run(db.analysis_results.insert_one({"document_id": str(doc_id), "user_id": str(alice["_id"]), "summary": "private"}))
    return alice, bob, str(doc_id)


def test_owner_can_read_own_analysis(client, db):
    alice, _, doc_id = setup_two_users_with_analysis(db)
    response = client.get(f"/api/analysis/{doc_id}", headers=auth_header(alice))
    assert response.status_code == 200
    assert response.json()["summary"] == "private"


def test_other_user_cannot_read_analysis(client, db):
    _, bob, doc_id = setup_two_users_with_analysis(db)
    response = client.get(f"/api/analysis/{doc_id}", headers=auth_header(bob))
    assert response.status_code == 404
    assert "private" not in response.text
    assert "alice.pdf" not in response.text


def test_invalid_document_id_returns_404(client, db):
    alice, _, _ = setup_two_users_with_analysis(db)
    response = client.get("/api/analysis/not-an-object-id", headers=auth_header(alice))
    assert response.status_code == 404


def test_logs_endpoint_removed(client):
    assert client.get("/logs").status_code == 404


def test_process_queue_requires_auth(client):
    assert client.post("/api/analysis/process-queue").status_code == 401


def test_process_queue_only_processes_callers_tasks(client, db, monkeypatch):
    alice = run(make_user(db, "alice@example.com"))
    bob = run(make_user(db, "bob@example.com"))
    for owner in (alice, bob):
        run(db.analysis_tasks.insert_one({
            "document_id": str(ObjectId()), "user_id": str(owner["_id"]),
            "category": "lab_report", "status": "pending", "created_at": 0,
        }))

    processed_for = []

    async def fake_process_task(_db, task):
        processed_for.append(task["user_id"])
        return True

    monkeypatch.setattr(worker, "process_task", fake_process_task)
    response = client.post("/api/analysis/process-queue?max_tasks=100", headers=auth_header(alice))
    assert response.status_code == 200
    assert processed_for == [str(alice["_id"])]


def test_webhook_endpoint_removed(client):
    assert client.post("/api/telegram/webhook", json={}).status_code in (404, 405)


def test_cors_allows_configured_origin_only(client):
    preflight = {"Access-Control-Request-Method": "GET"}
    allowed = client.options("/health", headers={"Origin": "http://localhost:6363", **preflight})
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:6363"

    evil = client.options("/health", headers={"Origin": "https://evil.example", **preflight})
    assert "access-control-allow-origin" not in evil.headers
