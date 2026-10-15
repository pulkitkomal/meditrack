import asyncio
from datetime import date, datetime, timedelta

from app.config import settings
from app.services import analysis as analysis_service
from app.services.comparison import predict_conditions
from tests.conftest import auth_header, make_user


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_usage_reports_todays_chat_allowance(client, db):
    alice = run(make_user(db, "alice@example.com"))
    uid = str(alice["_id"])
    run(db.token_usage.insert_many([
        {"user_id": uid, "category": "chat", "total_tokens": 1200, "timestamp": datetime.utcnow()},
        {"user_id": uid, "category": "analysis", "total_tokens": 9000, "timestamp": datetime.utcnow()},
        {"user_id": uid, "category": "chat", "total_tokens": 5000, "timestamp": datetime.utcnow() - timedelta(days=2)},
    ]))
    usage = client.get("/api/analysis/usage", headers=auth_header(alice)).json()
    assert usage["chat_today"] == {"used": 1200, "limit": settings.DAILY_CHAT_TOKEN_LIMIT}


def test_age_is_derived_from_date_of_birth(client, db):
    alice = run(make_user(db, "alice@example.com"))
    today = date.today()
    dob = date(today.year - 40, 1, 1)
    body = client.patch("/api/users/me", headers=auth_header(alice), json={
        "date_of_birth": dob.isoformat(), "glucose_unit": "mmol/L", "timezone": "Asia/Kolkata",
        "dry_weight": 68.5, "medical_conditions": ["Type 2 Diabetes"], "allergies": [],
    }).json()
    assert body["age"] == 40
    assert body["date_of_birth"] == dob.isoformat()
    assert (body["glucose_unit"], body["timezone"], body["dry_weight"]) == ("mmol/L", "Asia/Kolkata", 68.5)


def test_diabetes_prediction_only_mentions_values_present():
    only_hba1c = predict_conditions([{"extracted_data": {"lab_values": [{"test": "HbA1c", "value": "7.2"}]}}])
    assert only_hba1c[0]["reasoning"] == "HbA1c: 7.2%"
    assert "None" not in only_hba1c[0]["reasoning"]

    fasting = predict_conditions([{"extracted_data": {"lab_values": [{"display_name": "Fasting Glucose", "value": 140}]}}])
    assert fasting[0]["reasoning"] == "Glucose: 140 mg/dL"

    assert predict_conditions([{"extracted_data": {"lab_values": [{"test": "HbA1c", "value": "n/a"}]}}]) == []


def test_bulk_upload_applies_given_document_date(client, db, monkeypatch):
    async def fail_if_called(*args, **kwargs):
        raise AssertionError("upload must not call OpenAI inline")

    monkeypatch.setattr(analysis_service, "generate_document_title", fail_if_called)
    alice = run(make_user(db, "alice@example.com"))
    response = client.post(
        "/api/documents/bulk-upload",
        headers=auth_header(alice),
        data={"category": "prescriptions", "document_date": "2026-03-14"},
        files=[("files", ("a.pdf", b"%PDF-1.4\n%a\n", "application/pdf")),
               ("files", ("b.pdf", b"%PDF-1.4\n%b\n", "application/pdf"))],
    )
    assert response.status_code == 200
    assert len(response.json()["uploaded"]) == 2
    docs = run(db.documents.find({}).to_list(length=10))
    assert {d["document_date"] for d in docs} == {datetime(2026, 3, 14)}
    assert run(db.analysis_tasks.count_documents({})) == 2

    bad = client.post(
        "/api/documents/bulk-upload", headers=auth_header(alice),
        data={"category": "prescriptions", "document_date": "not-a-date"},
        files=[("files", ("c.pdf", b"%PDF-1.4\n%c\n", "application/pdf"))],
    )
    assert bad.status_code == 400


def test_history_and_analysis_include_document_title(client, db):
    alice = run(make_user(db, "alice@example.com"))
    doc_id = run(db.documents.insert_one({
        "user_id": str(alice["_id"]), "category": "lab_results", "original_name": "scan.pdf",
        "predicted_title": "Lipid Panel", "upload_date": datetime.utcnow(), "document_date": datetime.utcnow(),
    })).inserted_id
    run(db.analysis_results.insert_one({
        "document_id": str(doc_id), "user_id": str(alice["_id"]), "category": "lab_results",
        "analysis_date": datetime.utcnow(), "extracted_data": {"lab_values": []},
    }))
    history = client.get("/api/analysis/history", headers=auth_header(alice)).json()
    assert history[0]["title"] == "Lipid Panel"
    assert client.get(f"/api/analysis/{doc_id}", headers=auth_header(alice)).json()["title"] == "Lipid Panel"


def test_age_comes_from_date_of_birth_even_if_stored_age_is_stale(client, db):
    alice = run(make_user(db, "alice@example.com"))
    today = date.today()
    run(db.users.update_one({"_id": alice["_id"]}, {"$set": {"date_of_birth": date(today.year - 30, 1, 1).isoformat(), "age": 12}}))
    assert client.get("/api/users/me", headers=auth_header(alice)).json()["age"] == 30
    assert client.get("/api/analysis/summary", headers=auth_header(alice)).json()["profile"]["age"] == 30
