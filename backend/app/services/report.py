"""Builds the one-page-or-so PDF summary a patient can bring to a doctor's appointment."""
import asyncio
import io
from datetime import datetime, timedelta
from html import escape
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import pymupdf

from app.utils.age import user_age
from app.services.analysis import get_user_analyses
from app.services.chatbot import generate_doctor_questions

LAB_HISTORY_DAYS = 365
VITALS_DAYS = 30
CATEGORY_LABELS = {
    "lab_results": "Lab results",
    "prescriptions": "Prescription",
    "imaging": "Imaging",
    "discharge_summary": "Discharge summary",
}

CSS = """
* { font-family: sans-serif; }
body { font-size: 9pt; color: #1e293b; }
h1 { font-size: 16pt; color: #0f766e; margin: 0 0 2pt 0; }
h2 { font-size: 11pt; color: #0f766e; margin: 12pt 0 4pt 0; border-bottom: 1px solid #99f6e4; }
p { margin: 2pt 0; }
.muted { color: #64748b; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; background-color: #f1f5f9; padding: 3pt; font-size: 8pt; }
td { padding: 3pt; border-bottom: 1px solid #e2e8f0; }
.high { color: #b91c1c; font-weight: bold; }
.low { color: #b45309; font-weight: bold; }
.normal { color: #15803d; }
"""


def _as_datetime(value) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value[:10])
        except ValueError:
            return None
    return None


def _fmt_date(value) -> str:
    dt = _as_datetime(value)
    return dt.strftime("%d %b %Y") if dt else "-"


def _number(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _status_cell(status: str | None) -> str:
    status = status or "normal"
    css = "high" if status in ("high", "critical") else "low" if status == "low" else "normal"
    return f'<td class="{css}">{escape(status.capitalize())}</td>'


async def collect_report_data(db, user: dict) -> dict:
    user_id = str(user["_id"])
    analyses = await get_user_analyses(db, user_id)
    documents = {
        str(doc["_id"]): doc
        async for doc in db.documents.find({"user_id": user_id}, {"document_date": 1, "upload_date": 1, "predicted_title": 1, "original_name": 1, "category": 1})
    }
    for analysis in analyses:
        doc = documents.get(analysis.get("document_id"), {})
        analysis["_date"] = _as_datetime(doc.get("document_date")) or _as_datetime(analysis.get("document_date")) or _as_datetime(analysis.get("analysis_date"))
    analyses = [a for a in analyses if a["_date"]]
    analyses.sort(key=lambda a: a["_date"], reverse=True)

    lab_cutoff = datetime.utcnow() - timedelta(days=LAB_HISTORY_DAYS)
    labs_by_test: dict[str, list] = {}
    for analysis in analyses:
        if analysis["_date"] < lab_cutoff:
            continue
        for lab in analysis.get("extracted_data", {}).get("lab_values", []):
            name = lab.get("display_name") or lab.get("test")
            if name:
                labs_by_test.setdefault(name.strip().lower(), []).append({**lab, "name": name, "date": analysis["_date"]})

    lab_rows = []
    for history in labs_by_test.values():
        latest = history[0]
        previous = history[1] if len(history) > 1 else None
        lab_rows.append({"latest": latest, "previous": previous})
    lab_rows.sort(key=lambda row: (row["latest"].get("status", "normal") == "normal", row["latest"]["name"].lower()))

    medications, seen_meds = [], set()
    diagnoses, seen_diagnoses = [], set()
    for analysis in analyses:
        extracted = analysis.get("extracted_data", {})
        for med in extracted.get("medications", []):
            key = (med.get("name") or "").strip().lower()
            if key and key not in seen_meds:
                seen_meds.add(key)
                medications.append({**med, "date": analysis["_date"]})
        for diagnosis in extracted.get("diagnoses", []):
            key = (diagnosis.get("condition") or "").strip().lower()
            if key and key not in seen_diagnoses:
                seen_diagnoses.add(key)
                diagnoses.append({**diagnosis, "date": analysis["_date"]})

    vitals_cutoff = datetime.utcnow() - timedelta(days=VITALS_DAYS)
    vitals = {}
    for reading_type in ("glucose", "bp", "weight"):
        readings = await db.health_readings.find(
            {"user_id": user_id, "type": reading_type, "timestamp": {"$gte": vitals_cutoff}}
        ).sort("timestamp", -1).to_list(length=1000)
        if readings:
            vitals[reading_type] = readings

    recent_documents = sorted(
        documents.values(),
        key=lambda d: _as_datetime(d.get("document_date")) or _as_datetime(d.get("upload_date")) or datetime.min,
        reverse=True,
    )[:15]

    questions = await generate_doctor_questions(db, user_id, {
        "age": user_age(user),
        "gender": user.get("gender"),
        "medical_conditions": user.get("medical_conditions", []),
    })

    return {
        "user": user,
        "lab_rows": lab_rows,
        "medications": medications[:20],
        "diagnoses": diagnoses[:20],
        "vitals": vitals,
        "documents": recent_documents,
        "questions": questions,
    }


def _vitals_html(vitals: dict) -> str:
    if not vitals:
        return '<p class="muted">No readings in the last 30 days.</p>'
    rows = []
    if "glucose" in vitals:
        values = [r["value"] for r in vitals["glucose"]]
        rows.append(("Blood glucose", f"{values[0]} mg/dL", f"{sum(values) / len(values):.0f} mg/dL", f"{min(values)}-{max(values)} mg/dL", len(values)))
    if "bp" in vitals:
        sys = [r["systolic"] for r in vitals["bp"] if r.get("systolic")]
        dia = [r["diastolic"] for r in vitals["bp"] if r.get("diastolic")]
        if sys and dia:
            rows.append(("Blood pressure", f"{sys[0]}/{dia[0]} mmHg", f"{sum(sys) / len(sys):.0f}/{sum(dia) / len(dia):.0f} mmHg",
                         f"{min(sys)}-{max(sys)} / {min(dia)}-{max(dia)}", len(sys)))
    if "weight" in vitals:
        values = [r["value"] for r in vitals["weight"]]
        rows.append(("Weight", f"{values[0]} kg", f"{sum(values) / len(values):.1f} kg", f"{min(values)}-{max(values)} kg", len(values)))
    body = "".join(
        f"<tr><td>{name}</td><td>{latest}</td><td>{avg}</td><td>{span}</td><td>{count}</td></tr>"
        for name, latest, avg, span, count in rows
    )
    return f"<table><tr><th>Vital</th><th>Latest</th><th>Average</th><th>Range</th><th>Readings</th></tr>{body}</table>"


def _labs_html(lab_rows: list) -> str:
    if not lab_rows:
        return '<p class="muted">No lab results in the last 12 months.</p>'
    body = []
    for row in lab_rows:
        lab, previous = row["latest"], row["previous"]
        marker = " *" if lab.get("edited") else ""
        value = f"{escape(str(lab.get('value', '')))} {escape(lab.get('unit') or '')}{marker}"
        prev = "-"
        if previous:
            prev = f"{escape(str(previous.get('value', '')))} ({_fmt_date(previous['date'])})"
            now, before = _number(lab.get("value")), _number(previous.get("value"))
            if now is not None and before is not None and now != before:
                value += " &#8593;" if now > before else " &#8595;"
        body.append(
            f"<tr><td>{escape(lab['name'])}</td><td>{value}</td><td>{escape(lab.get('reference_range') or '-')}</td>"
            f"{_status_cell(lab.get('status'))}<td>{_fmt_date(lab['date'])}</td><td>{prev}</td></tr>"
        )
    return ("<table><tr><th>Test</th><th>Latest</th><th>Reference</th><th>Status</th><th>Date</th><th>Previous</th></tr>"
            + "".join(body) + "</table>")


def build_report_html(data: dict) -> str:
    user = data["user"]
    name = escape(f"{user.get('first_name', '')} {user.get('last_name', '')}".strip())
    details = []
    if user.get("date_of_birth"):
        details.append(f"DOB {_fmt_date(user['date_of_birth'])}")
    elif user.get("age"):
        details.append(f"Age {user['age']}")
    if user.get("gender"):
        details.append(escape(str(user["gender"]).capitalize()))
    if user.get("blood_type"):
        details.append(f"Blood type {escape(user['blood_type'])}")
    try:
        today = datetime.now(ZoneInfo(user.get("timezone") or "UTC"))
    except (ZoneInfoNotFoundError, ValueError):
        today = datetime.utcnow()
    conditions = ", ".join(escape(c) for c in user.get("medical_conditions") or []) or "None recorded"
    allergies = ", ".join(escape(a) for a in user.get("allergies") or []) or "None recorded"

    parts = [
        f"<h1>Health summary: {name}</h1>",
        f'<p class="muted">{" &#183; ".join(details)}{" &#183; " if details else ""}Generated {today.strftime("%d %b %Y")} by HealthSync</p>',
        f"<p><b>Known conditions:</b> {conditions}</p>",
        f"<p><b>Allergies:</b> {allergies}</p>",
        "<h2>Vitals (last 30 days)</h2>", _vitals_html(data["vitals"]),
        "<h2>Lab results (last 12 months, out-of-range first)</h2>", _labs_html(data["lab_rows"]),
    ]

    if data["medications"]:
        rows = "".join(
            f"<tr><td>{escape(m.get('name') or '')}</td><td>{escape(m.get('dosage') or '-')}</td>"
            f"<td>{escape(m.get('frequency') or '-')}</td><td>{_fmt_date(m['date'])}</td></tr>"
            for m in data["medications"]
        )
        parts += ["<h2>Medications found in records</h2>",
                  f"<table><tr><th>Medication</th><th>Dose</th><th>Frequency</th><th>Record date</th></tr>{rows}</table>"]

    if data["diagnoses"]:
        items = "".join(f"<li>{escape(d.get('condition') or '')} <span class='muted'>({_fmt_date(d['date'])})</span></li>" for d in data["diagnoses"])
        parts += ["<h2>Diagnoses found in records</h2>", f"<ul>{items}</ul>"]

    if data["questions"]:
        items = "".join(f"<li>{escape(q)}</li>" for q in data["questions"])
        parts += ["<h2>Questions to ask</h2>", f"<ul>{items}</ul>"]

    if data["documents"]:
        rows = "".join(
            f"<tr><td>{_fmt_date(d.get('document_date') or d.get('upload_date'))}</td>"
            f"<td>{escape(d.get('predicted_title') or d.get('original_name') or 'Untitled')}</td>"
            f"<td>{escape(CATEGORY_LABELS.get(d.get('category'), d.get('category') or '-'))}</td></tr>"
            for d in data["documents"]
        )
        parts += ["<h2>Recent records</h2>", f"<table><tr><th>Date</th><th>Record</th><th>Type</th></tr>{rows}</table>"]

    parts.append('<p class="muted" style="margin-top: 12pt">Values were extracted from uploaded documents by AI and may contain errors; '
                 "values marked * were corrected by the patient. This summary is not a diagnosis.</p>")
    return "<body>" + "".join(parts) + "</body>"


def render_pdf(html: str) -> bytes:
    buffer = io.BytesIO()
    writer = pymupdf.DocumentWriter(buffer)
    story = pymupdf.Story(html=html, user_css=CSS)
    page = pymupdf.paper_rect("a4")
    content = page + (36, 36, -36, -48)
    more = True
    while more:
        device = writer.begin_page(page)
        more, _ = story.place(content)
        story.draw(device)
        writer.end_page()
    writer.close()

    doc = pymupdf.open("pdf", buffer.getvalue())
    for number, pdf_page in enumerate(doc, start=1):
        pdf_page.insert_text((36, page.height - 24), f"HealthSync health summary - page {number} of {doc.page_count}",
                             fontsize=7, color=(0.4, 0.45, 0.55))
    return doc.tobytes(garbage=3, deflate=True)


async def build_doctor_report(db, user: dict) -> bytes:
    data = await collect_report_data(db, user)
    return await asyncio.to_thread(render_pdf, build_report_html(data))
