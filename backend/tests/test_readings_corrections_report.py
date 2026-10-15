import asyncio
from datetime import datetime, timedelta

import pymupdf
import pytest
from bson import ObjectId

from app.services import corrections
from tests.conftest import auth_header, make_user


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_add_glucose_in_mmol_is_stored_as_mg_dl(client, db):
    alice = run(make_user(db, "alice@example.com"))
    response = client.post("/api/readings/", headers=auth_header(alice),
                           json={"type": "glucose", "value": 5.5, "unit": "mmol/L"})
    assert response.status_code == 201
    body = response.json()
    assert body["value"] == 99 and body["unit"] == "mg/dL" and body["source"] == "web"
    assert body["timestamp"].endswith("Z")


@pytest.mark.parametrize("payload", [
    {"type": "glucose", "value": 900},
    {"type": "glucose", "value": 50, "unit": "kg"},
    {"type": "bp", "systolic": 120},
    {"type": "bp", "systolic": 80, "diastolic": 120},
    {"type": "weight", "value": 5},
    {"type": "weight", "value": 70, "timestamp": (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z"},
    {"type": "temperature", "value": 37},
])
def test_invalid_readings_are_rejected(client, db, payload):
    alice = run(make_user(db, "alice@example.com"))
    assert client.post("/api/readings/", headers=auth_header(alice), json=payload).status_code == 422


def test_edit_and_delete_reading_only_for_owner(client, db):
    alice = run(make_user(db, "alice@example.com"))
    bob = run(make_user(db, "bob@example.com"))
    created = client.post("/api/readings/", headers=auth_header(alice),
                          json={"type": "bp", "systolic": 130, "diastolic": 85}).json()

    edit = {"type": "bp", "systolic": 125, "diastolic": 82}
    assert client.put(f"/api/readings/{created['id']}", headers=auth_header(bob), json=edit).status_code == 404
    assert client.delete(f"/api/readings/{created['id']}", headers=auth_header(bob)).status_code == 404

    updated = client.put(f"/api/readings/{created['id']}", headers=auth_header(alice), json=edit)
    assert updated.status_code == 200
    assert updated.json()["value"] == "125/82"
    assert updated.json()["timestamp"] == created["timestamp"]

    wrong_type = client.put(f"/api/readings/{created['id']}", headers=auth_header(alice), json={"type": "weight", "value": 70})
    assert wrong_type.status_code == 400

    assert client.delete(f"/api/readings/{created['id']}", headers=auth_header(alice)).status_code == 200
    assert client.get("/api/readings/", headers=auth_header(alice)).json() == []


def test_summary_reports_latest_and_average(client, db):
    alice = run(make_user(db, "alice@example.com"))
    now = datetime.utcnow()
    for minutes_ago, value in ((30, 100), (20, 140), (10, 120)):
        ts = (now - timedelta(minutes=minutes_ago)).isoformat() + "Z"
        client.post("/api/readings/", headers=auth_header(alice), json={"type": "glucose", "value": value, "timestamp": ts})

    summary = client.get("/api/readings/summary", headers=auth_header(alice)).json()
    assert summary["glucose"]["latest"]["value"] == 120
    assert summary["glucose"]["avg"]["value"] == 120.0
    assert summary["glucose"]["count"] == 3
    assert summary["bp"] == {"latest": None, "count": 0}


async def seed_analysis(db, user, lab_values, **extra):
    doc_id = (await db.documents.insert_one({
        "user_id": str(user["_id"]), "category": "lab_results", "original_name": "labs.pdf",
        "upload_date": datetime.utcnow(), "document_date": datetime.utcnow(), **extra,
    })).inserted_id
    await db.analysis_results.insert_one({
        "document_id": str(doc_id), "user_id": str(user["_id"]), "category": "lab_results",
        "analysis_date": datetime.utcnow(),
        "extracted_data": {"lab_values": lab_values, "medications": [{"name": "Metformin", "dosage": "500mg"}]},
        "chatbot_context": {"key_facts": []},
        "risk_assessment": {"risk_factors": []},
    })
    return str(doc_id)


def test_correct_lab_value_keeps_original_and_rebuilds_derived_data(client, db, monkeypatch):
    async def fake_save_chunks(db, chunks):
        if chunks:
            await db.document_chunks.insert_many(chunks)

    monkeypatch.setattr(corrections, "save_document_chunks", fake_save_chunks)
    alice = run(make_user(db, "alice@example.com"))
    bob = run(make_user(db, "bob@example.com"))
    doc_id = run(seed_analysis(db, alice, [
        {"test": "HbA1c", "display_name": "HbA1c", "value": 75, "unit": "%", "status": "high"},
    ]))
    run(db.document_chunks.insert_one({"document_id": doc_id, "user_id": str(alice["_id"]), "content": "Lab Results: HbA1c: 75 %"}))

    fix = {"value": 7.5, "unit": "%", "reference_range": "4.0-5.6", "status": "high"}
    assert client.put(f"/api/analysis/{doc_id}/lab-values/0", headers=auth_header(bob), json=fix).status_code == 404
    assert client.put(f"/api/analysis/{doc_id}/lab-values/3", headers=auth_header(alice), json=fix).status_code == 404

    response = client.put(f"/api/analysis/{doc_id}/lab-values/0", headers=auth_header(alice), json=fix)
    assert response.status_code == 200

    stored = run(db.analysis_results.find_one({"document_id": doc_id}))
    lab = stored["extracted_data"]["lab_values"][0]
    assert lab["value"] == 7.5 and lab["edited"] is True
    assert lab["original"]["value"] == 75
    assert "HbA1c: 7.5 % (high)" in stored["chatbot_context"]["key_facts"]
    assert stored["risk_assessment"]["risk_factors"] == ["Elevated HbA1c"]

    chunks = run(db.document_chunks.find({"document_id": doc_id}).to_list(length=10))
    assert any("HbA1c: 7.5 %" in c["content"] for c in chunks)
    assert not any("75 %" in c["content"] and "7.5" not in c["content"] for c in chunks)

    client.put(f"/api/analysis/{doc_id}/lab-values/0", headers=auth_header(alice), json={**fix, "value": 7.4})
    stored = run(db.analysis_results.find_one({"document_id": doc_id}))
    assert stored["extracted_data"]["lab_values"][0]["original"]["value"] == 75


def test_doctor_report_is_a_pdf_with_flagged_labs_and_vitals(client, db):
    alice = run(make_user(db, "alice@example.com"))
    bob = run(make_user(db, "bob@example.com"))
    run(seed_analysis(db, alice, [
        {"test": "HbA1c", "display_name": "HbA1c", "value": 7.5, "unit": "%", "status": "high", "edited": True},
        {"test": "Hemoglobin", "display_name": "Hemoglobin", "value": 14, "unit": "g/dL", "status": "normal"},
    ]))
    run(seed_analysis(db, bob, [{"test": "Bob secret test", "value": 1, "status": "high"}]))
    client.post("/api/readings/", headers=auth_header(alice), json={"type": "bp", "systolic": 135, "diastolic": 88})

    response = client.get("/api/users/me/report", headers=auth_header(alice))
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "attachment" in response.headers["content-disposition"]

    text = "".join(page.get_text() for page in pymupdf.open("pdf", response.content))
    assert "HbA1c" in text and "7.5 % *" in text
    assert "135/88" in text
    assert "Metformin" in text
    assert "Bob secret test" not in text


def test_doctor_questions_use_only_latest_value_per_test(db):
    from app.services.chatbot import generate_doctor_questions

    alice = run(make_user(db, "alice@example.com"))
    for days_ago, value in ((90, 8.1), (0, 7.5)):
        doc_id = run(seed_analysis(db, alice, [{"test": "HbA1c", "display_name": "HbA1c", "value": value, "unit": "%", "status": "high"}]))
        date = (datetime.utcnow() - timedelta(days=days_ago)).strftime("%Y-%m-%d")
        run(db.analysis_results.update_one({"document_id": doc_id}, {"$set": {"document_date": date}}))

    questions = run(generate_doctor_questions(db, str(alice["_id"])))
    hba1c = [q for q in questions if "HbA1c" in q]
    assert hba1c == ["My HbA1c is 7.5 %, which is high. Should we adjust my treatment?"]


def test_doctor_report_works_with_no_data(client, db):
    alice = run(make_user(db, "alice@example.com"))
    response = client.get("/api/users/me/report", headers=auth_header(alice))
    assert response.status_code == 200
    assert response.content.startswith(b"%PDF")
