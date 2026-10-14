import asyncio

from bson import ObjectId
import jwt

from app.config import settings
from app.services import storage
from app.utils.security import hash_password
from tests.conftest import auth_header, make_user


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


async def add_document_with_derived_data(db, user, **doc_fields):
    doc_id = ObjectId()
    user_id = str(user["_id"])
    await db.documents.insert_one({"_id": doc_id, "user_id": user_id, **doc_fields})
    for name in ("analysis_results", "analysis_tasks", "document_chunks"):
        await db[name].insert_one({"document_id": str(doc_id), "user_id": user_id, "embedding": [0.1]})
    await db.health_readings.insert_one({"user_id": user_id, "type": "glucose", "value": 120})
    await db.token_usage.insert_one({"user_id": user_id, "total_tokens": 10})
    return str(doc_id)


async def count_for(db, user):
    user_id = str(user["_id"])
    names = ("documents", "analysis_results", "analysis_tasks", "document_chunks", "health_readings", "token_usage")
    return {name: await db[name].count_documents({"user_id": user_id}) for name in names}


class FakeS3:
    def __init__(self):
        self.deleted = []

    def delete_object(self, Bucket, Key):
        self.deleted.append(Key)


def test_deleting_document_removes_file_chunks_and_analysis(client, db, tmp_path):
    alice = run(make_user(db, "alice@example.com"))
    file_path = tmp_path / "report.pdf"
    file_path.write_bytes(b"%PDF-1.4")
    doc_id = run(add_document_with_derived_data(db, alice, file_path=str(file_path), storage_type="local"))

    response = client.delete(f"/api/analysis/{doc_id}", headers=auth_header(alice))
    assert response.status_code == 200
    assert not file_path.exists()
    for name in ("documents", "analysis_results", "analysis_tasks", "document_chunks"):
        assert run(count_for(db, alice))[name] == 0


def test_deleting_s3_document_deletes_the_object(client, db, monkeypatch):
    fake_s3 = FakeS3()
    monkeypatch.setattr(storage, "get_s3_client", lambda: fake_s3)
    alice = run(make_user(db, "alice@example.com"))
    doc_id = run(add_document_with_derived_data(db, alice, file_path="u/lab/1.pdf", storage_type="s3"))

    assert client.delete(f"/api/analysis/{doc_id}", headers=auth_header(alice)).status_code == 200
    assert fake_s3.deleted == ["u/lab/1.pdf"]


def test_document_is_kept_when_s3_deletion_fails(client, db, monkeypatch):
    class BrokenS3:
        def delete_object(self, **kwargs):
            raise RuntimeError("S3 down")

    monkeypatch.setattr(storage, "get_s3_client", lambda: BrokenS3())
    alice = run(make_user(db, "alice@example.com"))
    doc_id = run(add_document_with_derived_data(db, alice, file_path="u/lab/1.pdf", storage_type="s3"))

    assert client.delete(f"/api/analysis/{doc_id}", headers=auth_header(alice)).status_code == 500
    assert run(count_for(db, alice))["documents"] == 1


def test_account_deletion_requires_correct_password(client, db):
    alice = run(make_user(db, "alice@example.com"))
    run(db.users.update_one({"_id": alice["_id"]}, {"$set": {"password_hash": hash_password("correct-horse")}}))

    response = client.request("DELETE", "/api/users/me", headers=auth_header(alice), json={"password": "wrong"})
    assert response.status_code == 403
    assert run(db.users.count_documents({"_id": alice["_id"]})) == 1


def test_account_deletion_removes_everything_but_only_for_that_user(client, db, tmp_path):
    alice = run(make_user(db, "alice@example.com"))
    bob = run(make_user(db, "bob@example.com"))
    run(db.users.update_one({"_id": alice["_id"]}, {"$set": {"password_hash": hash_password("correct-horse")}}))
    file_path = tmp_path / "alice.pdf"
    file_path.write_bytes(b"%PDF-1.4")
    run(add_document_with_derived_data(db, alice, file_path=str(file_path), storage_type="local"))
    run(add_document_with_derived_data(db, bob, file_path="/nonexistent", storage_type="local"))

    response = client.request("DELETE", "/api/users/me", headers=auth_header(alice), json={"password": "correct-horse"})
    assert response.status_code == 200
    assert run(db.users.count_documents({"_id": alice["_id"]})) == 0
    assert not file_path.exists()
    assert all(count == 0 for count in run(count_for(db, alice)).values())
    assert all(count == 1 for count in run(count_for(db, bob)).values())


def test_export_contains_records_but_no_secrets_or_embeddings(client, db):
    alice = run(make_user(db, "alice@example.com"))
    run(db.users.update_one({"_id": alice["_id"]}, {"$set": {"password_hash": "hash", "telegram_link_token": "secret"}}))
    run(add_document_with_derived_data(db, alice, file_path="/x", storage_type="local"))

    response = client.get("/api/users/me/export", headers=auth_header(alice))
    assert response.status_code == 200
    assert "attachment" in response.headers["content-disposition"]
    data = response.json()
    assert data["profile"]["email"] == "alice@example.com"
    assert "password_hash" not in data["profile"]
    assert "telegram_link_token" not in data["profile"]
    assert len(data["documents"]) == 1
    assert len(data["health_readings"]) == 1
    assert "embedding" not in data["document_chunks"][0]


def register_and_login(client, email="carol@example.com", password="correct-horse"):
    client.post("/api/auth/register", json={
        "email": email, "password": password, "first_name": "C", "last_name": "D", "accept_privacy_policy": True,
    })
    client.post("/api/auth/login", json={"email": email, "password": password})
    return client.cookies.get("access_token")


def test_logout_revokes_the_token_server_side(client):
    token = register_and_login(client)
    client.post("/api/auth/logout")
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_logout_all_invalidates_every_session(client):
    first_token = register_and_login(client)
    client.post("/api/auth/login", json={"email": "carol@example.com", "password": "correct-horse"})
    second_token = client.cookies.get("access_token")
    assert first_token != second_token

    assert client.post("/api/auth/logout-all").status_code == 200
    for token in (first_token, second_token):
        assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_tokens_issued_before_versioning_are_rejected(client, db):
    alice = run(make_user(db, "alice@example.com"))
    legacy = jwt.encode({"sub": "alice@example.com", "exp": 9999999999}, settings.SECRET_KEY, algorithm="HS256")
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {legacy}"}).status_code == 401
    assert client.get("/api/auth/me", headers=auth_header(alice)).status_code == 200
