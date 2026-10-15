import asyncio
import json
from datetime import datetime, timedelta

import pytest
from bson import ObjectId

from app.config import settings
from app.services import chat_context, chatbot
from app.services.chat_context import build_chat_context, load_documents, retrieve_snippets
from app.services.chat_safety import triage
from tests.conftest import auth_header, make_user


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


class FakeModel:
    """Stands in for the OpenAI stream and records what it was sent."""

    def __init__(self, reply="Your Fasting Glucose was 132 mg/dL on 01 Oct 2026, which is high."):
        self.reply = reply
        self.calls = []

    async def __call__(self, messages, model, max_tokens):
        self.calls.append({"messages": messages, "max_tokens": max_tokens})
        for word in self.reply.split(" "):
            yield "delta", word + " "
        yield "usage", {"prompt_tokens": 100, "completion_tokens": 20, "total_tokens": 120}


@pytest.fixture
def fake_model(monkeypatch):
    model = FakeModel()
    monkeypatch.setattr(chatbot, "stream_completion", model)
    return model


async def seed_records(db, user, glucose_unit="mg/dL"):
    uid = str(user["_id"])
    await db.users.update_one({"_id": user["_id"]}, {"$set": {
        "glucose_unit": glucose_unit, "timezone": "Asia/Kolkata", "medical_conditions": ["Type 2 diabetes"],
        "date_of_birth": "1970-05-01", "dry_weight": 70,
    }})
    docs = {}
    for title, when, glucose in (("Quarterly panel Oct", datetime(2026, 10, 1), 132), ("Quarterly panel Jul", datetime(2026, 7, 1), 118)):
        doc_id = (await db.documents.insert_one({
            "user_id": uid, "category": "lab_results", "original_name": "labs.pdf", "predicted_title": title,
            "document_date": when, "upload_date": when,
        })).inserted_id
        docs[title] = str(doc_id)
        await db.analysis_results.insert_one({
            "document_id": str(doc_id), "user_id": uid, "category": "lab_results", "analysis_date": when, "document_date": when,
            "extracted_data": {
                "lab_values": [{"test": "Fasting Glucose", "value": glucose, "unit": "mg/dL", "reference_range": "70-99", "status": "high"}],
                "medications": [{"name": "Metformin", "dosage": "500 mg", "frequency": "twice daily"}],
            },
        })
    now = datetime.utcnow()
    await db.health_readings.insert_many([
        {"user_id": uid, "type": "glucose", "value": 108, "unit": "mg/dL", "timestamp": now - timedelta(hours=2), "source": "web"},
        {"user_id": uid, "type": "glucose", "value": 144, "unit": "mg/dL", "timestamp": now - timedelta(days=3), "source": "web"},
        {"user_id": uid, "type": "bp", "value": "132/84", "systolic": 132, "diastolic": 84, "unit": "mmHg", "timestamp": now - timedelta(days=1), "source": "web"},
    ])
    return docs


def read_stream(response):
    return [json.loads(line) for line in response.text.splitlines() if line.strip()]


@pytest.mark.parametrize("message", [
    "I have crushing chest pain right now",
    "my sugar is 45 and I feel shaky",
    "glucose reading 2.6 mmol",
    "blood sugar 480 what do I do",
    "bp is 190/125 this morning",
    "I want to end my life",
])
def test_emergencies_get_an_urgent_reply(message):
    assert triage(message)


@pytest.mark.parametrize("message", [
    "what is my latest HbA1c?",
    "my bp was 120/80 yesterday, is that ok?",
    "I took 2 tablets with my sugar at 110",
    "explain my cholesterol from 15 Oct",
])
def test_ordinary_questions_are_not_flagged(message):
    assert triage(message) is None


def test_context_has_dated_labs_with_history_and_vitals_in_users_unit(db):
    alice = run(make_user(db, "alice@example.com"))
    run(seed_records(db, alice, glucose_unit="mmol/L"))
    user = run(db.users.find_one({"_id": alice["_id"]}))
    ctx = run(build_chat_context(db, user))

    assert "Fasting Glucose: 132 mg/dL (high, range 70-99) on 01 Oct 2026 [Quarterly panel Oct]; earlier: 118 on 01 Jul 2026" in ctx.records
    assert "Metformin 500 mg twice daily" in ctx.records
    assert "latest 6.0 mmol/L" in ctx.records  # 108 mg/dL home reading shown in the user's unit
    assert "132/84" in ctx.records and "Asia/Kolkata" in ctx.records
    assert ctx.glucose_unit == "mmol/L"
    assert "Dry weight target: 70 kg" in ctx.records


def test_streamed_answer_is_saved_cited_and_remembers_history(client, db, fake_model):
    alice = run(make_user(db, "alice@example.com"))
    docs = run(seed_records(db, alice))

    first = client.post("/api/chat/messages", headers=auth_header(alice), json={"message": "What was my last fasting glucose?"})
    assert first.status_code == 200
    assert first.headers["content-type"].startswith("application/x-ndjson")
    events = read_stream(first)
    assert events[0]["type"] == "start"
    assert "".join(e["text"] for e in events if e["type"] == "delta").startswith("Your Fasting Glucose was 132")
    done = events[-1]
    assert done["type"] == "done" and done["message_index"] == 1
    assert done["sources"][0] == {"doc_id": docs["Quarterly panel Oct"], "title": "Quarterly panel Oct", "category": "lab_results", "date": "2026-10-01"}
    assert done["allowance"] == {"used": 120, "limit": settings.DAILY_CHAT_TOKEN_LIMIT}
    assert fake_model.calls[0]["max_tokens"] == 350

    system = fake_model.calls[0]["messages"][0]["content"]
    assert "<records>" in system and "Fasting Glucose: 132" in system and "never tell the person to start, stop" in system

    conv_id = events[0]["conversation_id"]
    client.post("/api/chat/messages", headers=auth_header(alice), json={"message": "And what does that mean for my diabetes overall?", "conversation_id": conv_id})
    sent = fake_model.calls[1]["messages"]
    assert [m["role"] for m in sent] == ["system", "user", "assistant", "user"]
    assert fake_model.calls[1]["max_tokens"] == 900

    saved = client.get(f"/api/chat/conversations/{conv_id}", headers=auth_header(alice)).json()
    assert saved["title"] == "What was my last fasting glucose?"
    assert [m["role"] for m in saved["messages"]] == ["user", "assistant", "user", "assistant"]


def test_urgent_message_skips_the_model(client, db, monkeypatch):
    async def must_not_call(*args, **kwargs):
        raise AssertionError("model should not be called for emergencies")
        yield  # pragma: no cover

    monkeypatch.setattr(chatbot, "stream_completion", must_not_call)
    alice = run(make_user(db, "alice@example.com"))
    events = read_stream(client.post("/api/chat/messages", headers=auth_header(alice), json={"message": "chest pain and sweating"}))
    assert events[-1]["urgent"] is True
    assert "emergency" in "".join(e.get("text", "") for e in events).lower()


def test_model_failure_returns_a_friendly_reply(client, db, monkeypatch):
    async def broken(*args, **kwargs):
        raise RuntimeError("upstream down")
        yield  # pragma: no cover

    monkeypatch.setattr(chatbot, "stream_completion", broken)
    alice = run(make_user(db, "alice@example.com"))
    events = read_stream(client.post("/api/chat/messages", headers=auth_header(alice), json={"message": "hello"}))
    assert chatbot.FALLBACK_REPLY in "".join(e.get("text", "") for e in events)


def test_allowance_blocks_chat_when_used_up(client, db, fake_model):
    alice = run(make_user(db, "alice@example.com"))
    run(db.token_usage.insert_one({"user_id": str(alice["_id"]), "category": "chat", "total_tokens": settings.DAILY_CHAT_TOKEN_LIMIT, "timestamp": datetime.utcnow()}))
    response = client.post("/api/chat/messages", headers=auth_header(alice), json={"message": "hi"})
    assert response.status_code == 429
    assert "allowance" in response.json()["detail"]
    assert client.post("/api/analysis/chat", headers=auth_header(alice), json={"message": "hi"}).status_code == 429


def test_conversations_are_private_and_deletable(client, db, fake_model):
    alice = run(make_user(db, "alice@example.com"))
    bob = run(make_user(db, "bob@example.com"))
    conv_id = read_stream(client.post("/api/chat/messages", headers=auth_header(alice), json={"message": "hi"}))[0]["conversation_id"]

    assert client.get(f"/api/chat/conversations/{conv_id}", headers=auth_header(bob)).status_code == 404
    assert client.delete(f"/api/chat/conversations/{conv_id}", headers=auth_header(bob)).status_code == 404
    assert client.post("/api/chat/messages", headers=auth_header(bob), json={"message": "hi", "conversation_id": conv_id}).status_code == 404
    assert client.get("/api/chat/conversations", headers=auth_header(bob)).json() == []

    listed = client.get("/api/chat/conversations", headers=auth_header(alice)).json()
    assert listed[0]["id"] == conv_id and listed[0]["message_count"] == 2

    assert client.delete(f"/api/chat/conversations/{conv_id}", headers=auth_header(alice)).status_code == 200
    assert client.get("/api/chat/conversations", headers=auth_header(alice)).json() == []


def test_feedback_is_stored_on_assistant_messages_only(client, db, fake_model):
    alice = run(make_user(db, "alice@example.com"))
    conv_id = read_stream(client.post("/api/chat/messages", headers=auth_header(alice), json={"message": "hi"}))[0]["conversation_id"]
    url = f"/api/chat/conversations/{conv_id}/messages"
    assert client.post(f"{url}/1/feedback", headers=auth_header(alice), json={"rating": "down"}).status_code == 200
    assert client.post(f"{url}/0/feedback", headers=auth_header(alice), json={"rating": "up"}).status_code == 404
    assert client.get(f"/api/chat/conversations/{conv_id}", headers=auth_header(alice)).json()["messages"][1]["feedback"] == "down"


def test_conversations_are_exported_and_removed_with_the_account(client, db, fake_model):
    alice = run(make_user(db, "alice@example.com"))
    run(db.users.update_one({"_id": alice["_id"]}, {"$set": {"password_hash": __import__("app.utils.security", fromlist=["hash_password"]).hash_password("correct-horse")}}))
    client.post("/api/chat/messages", headers=auth_header(alice), json={"message": "hi"})
    export = json.loads(client.get("/api/users/me/export", headers=auth_header(alice)).content)
    assert len(export["chat_conversations"]) == 1
    assert client.request("DELETE", "/api/users/me", headers=auth_header(alice), json={"password": "correct-horse"}).status_code == 200
    assert run(db.chat_conversations.count_documents({})) == 0


def test_status_suggests_questions_about_flagged_results(client, db):
    alice = run(make_user(db, "alice@example.com"))
    run(seed_records(db, alice))
    status = client.get("/api/chat/status", headers=auth_header(alice)).json()
    assert status["suggestions"][0] == "Why is my Fasting Glucose high?"
    assert "How has my blood sugar been this week?" in status["suggestions"]
    assert status["allowance"]["used"] == 0


def test_snippet_search_labels_snippets_and_resolves_sources(db, monkeypatch):
    import sys
    import types

    async def fake_embed(text):
        return [1.0, 0.0]

    async def fake_rerank(query, chunks, top_k=5):
        return chunks[:top_k]

    # The real modules load sentence-transformers models, which tests must not download.
    monkeypatch.setitem(sys.modules, "app.services.embeddings", types.SimpleNamespace(embed_text=fake_embed))
    monkeypatch.setitem(sys.modules, "app.services.reranker", types.SimpleNamespace(rerank_chunks=fake_rerank))
    chat_context._index_cache.clear()

    alice = run(make_user(db, "alice@example.com"))
    uid = str(alice["_id"])
    doc_id = run(db.documents.insert_one({"user_id": uid, "category": "imaging", "original_name": "x.pdf", "predicted_title": "Chest X-ray", "document_date": datetime(2026, 9, 2)})).inserted_id
    run(db.document_chunks.insert_many([
        {"user_id": uid, "document_id": str(doc_id), "chunk_type": "findings", "content": "Findings: clear lungs", "embedding": [0.9, 0.1]},
        {"user_id": uid, "document_id": str(doc_id), "chunk_type": "summary", "content": "Unrelated", "embedding": [0.0, 1.0]},
    ]))
    documents = run(load_documents(db, uid))
    snippets, sources = run(retrieve_snippets(db, uid, "lungs", documents, top_k=1))
    assert snippets == ["[Chest X-ray, 2026-09-02] Findings: clear lungs"]
    assert sources[0].title == "Chest X-ray"

    run(db.document_chunks.insert_one({"user_id": uid, "document_id": str(doc_id), "content": "New", "embedding": [1.0, 0.0]}))
    snippets, _ = run(retrieve_snippets(db, uid, "lungs", documents, top_k=1))
    assert snippets == ["[Chest X-ray, 2026-09-02] New"], "cache must refresh when chunks change"
