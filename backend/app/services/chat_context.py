"""Builds the factual context the chat assistant answers from."""
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from statistics import mean
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import numpy as np

from app.services.analysis import get_user_analyses
from app.services.comparison import calculate_health_score, get_active_conditions, predict_conditions
from app.utils.age import user_age

logger = logging.getLogger("medical-records-app")

MMOL_FACTOR = 18.0182
MAX_LAB_TESTS = 45
MAX_RECORDS_CHARS = 9000
VITALS_DAYS = 30


@dataclass
class Source:
    doc_id: str
    title: str
    category: str
    date: str | None

    def as_dict(self) -> dict:
        return {"doc_id": self.doc_id, "title": self.title, "category": self.category, "date": self.date}


@dataclass
class ChatContext:
    records: str
    today: str
    glucose_unit: str
    # (lower-case name, source) pairs used to cite the records an answer talks about
    mentionables: list[tuple[str, Source]] = field(default_factory=list)
    snippet_sources: list[Source] = field(default_factory=list)


def user_timezone(user: dict) -> ZoneInfo:
    try:
        return ZoneInfo(user.get("timezone") or "UTC")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def _as_datetime(value) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value:
        try:
            return datetime.fromisoformat(value[:19].replace("Z", ""))
        except ValueError:
            try:
                return datetime.fromisoformat(value[:10])
            except ValueError:
                return None
    return None


def _day(value: datetime | None) -> str:
    return value.strftime("%d %b %Y") if value else "undated"


def _number(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def format_glucose(mg_dl: float, unit: str) -> str:
    return f"{mg_dl / MMOL_FACTOR:.1f} mmol/L" if unit == "mmol/L" else f"{round(mg_dl)} mg/dL"


async def load_documents(db, user_id: str) -> dict[str, Source]:
    docs = {}
    async for doc in db.documents.find(
        {"user_id": user_id},
        {"predicted_title": 1, "original_name": 1, "category": 1, "document_date": 1, "upload_date": 1},
    ):
        date = _as_datetime(doc.get("document_date")) or _as_datetime(doc.get("upload_date"))
        docs[str(doc["_id"])] = Source(
            doc_id=str(doc["_id"]),
            title=doc.get("predicted_title") or doc.get("original_name") or "Record",
            category=doc.get("category", "other"),
            date=date.strftime("%Y-%m-%d") if date else None,
        )
    return docs


def _profile_section(user: dict, glucose_unit: str) -> list[str]:
    lines = []
    if user_age(user):
        lines.append(f"Age: {user_age(user)}")
    for label, key in (("Gender", "gender"), ("Blood type", "blood_type")):
        if user.get(key):
            lines.append(f"{label}: {user[key]}")
    if user.get("height"):
        lines.append(f"Height: {user['height']} cm")
    if user.get("weight"):
        lines.append(f"Weight (profile): {user['weight']} kg")
    if user.get("dry_weight"):
        lines.append(f"Dry weight target: {user['dry_weight']} kg")
    lines.append(f"Known conditions: {', '.join(user.get('medical_conditions') or []) or 'none recorded'}")
    lines.append(f"Allergies: {', '.join(user.get('allergies') or []) or 'none recorded'}")
    lines.append(f"Preferred glucose unit: {glucose_unit}")
    return lines


def _vitals_section(readings: list[dict], user: dict, glucose_unit: str, tz: ZoneInfo, now: datetime) -> list[str]:
    def local(ts: datetime) -> str:
        return ts.replace(tzinfo=ZoneInfo("UTC")).astimezone(tz).strftime("%d %b %H:%M")

    by_type: dict[str, list[dict]] = {}
    for r in readings:
        by_type.setdefault(r["type"], []).append(r)
    week_ago = now - timedelta(days=7)
    lines = []

    glucose = by_type.get("glucose", [])
    if glucose:
        values = [_number(r["value"]) for r in glucose if _number(r["value"]) is not None]
        week = [_number(r["value"]) for r in glucose if r["timestamp"] >= week_ago and _number(r["value"]) is not None]
        lines.append(
            f"Glucose ({len(values)} readings in {VITALS_DAYS} days): latest {format_glucose(values[0], glucose_unit)} on {local(glucose[0]['timestamp'])}; "
            f"7-day average {format_glucose(mean(week), glucose_unit) if week else 'n/a'}; "
            f"30-day average {format_glucose(mean(values), glucose_unit)}; range {format_glucose(min(values), glucose_unit)}–{format_glucose(max(values), glucose_unit)}; "
            f"{sum(v < 70 for v in values)} below 70 mg/dL, {sum(v > 180 for v in values)} above 180 mg/dL"
        )
        lines.append("Recent glucose: " + "; ".join(
            f"{local(r['timestamp'])} {format_glucose(_number(r['value']), glucose_unit)}" for r in glucose[:8] if _number(r["value"]) is not None
        ))

    bp = [r for r in by_type.get("bp", []) if r.get("systolic") and r.get("diastolic")]
    if bp:
        week = [r for r in bp if r["timestamp"] >= week_ago]
        avg = f"{round(mean(r['systolic'] for r in week))}/{round(mean(r['diastolic'] for r in week))}" if week else "n/a"
        lines.append(
            f"Blood pressure ({len(bp)} readings in {VITALS_DAYS} days): latest {bp[0]['systolic']}/{bp[0]['diastolic']} mmHg on {local(bp[0]['timestamp'])}; "
            f"7-day average {avg} mmHg; highest {max(r['systolic'] for r in bp)}/{max(r['diastolic'] for r in bp)}"
        )
        lines.append("Recent BP: " + "; ".join(f"{local(r['timestamp'])} {r['systolic']}/{r['diastolic']}" for r in bp[:6]))

    weight = [r for r in by_type.get("weight", []) if _number(r["value"]) is not None]
    if weight:
        latest = _number(weight[0]["value"])
        oldest = _number(weight[-1]["value"])
        text = f"Weight: latest {latest:g} kg on {local(weight[0]['timestamp'])}; change over {VITALS_DAYS} days {latest - oldest:+.1f} kg"
        if user.get("dry_weight"):
            text += f"; {latest - float(user['dry_weight']):+.1f} kg vs dry weight"
        lines.append(text)
    return lines


async def build_chat_context(db, user: dict) -> ChatContext:
    user_id = str(user["_id"])
    glucose_unit = user.get("glucose_unit") or "mg/dL"
    tz = user_timezone(user)
    now = datetime.utcnow()
    today = datetime.now(tz).strftime("%A %d %B %Y")

    documents = await load_documents(db, user_id)
    analyses = await get_user_analyses(db, user_id)
    for analysis in analyses:
        source = documents.get(analysis.get("document_id"))
        analysis["_source"] = source
        analysis["_date"] = _as_datetime(source.date if source else None) or _as_datetime(analysis.get("document_date")) or _as_datetime(analysis.get("analysis_date"))
    analyses.sort(key=lambda a: a["_date"] or datetime.min, reverse=True)

    sections: list[tuple[str, list[str]]] = [("PROFILE", _profile_section(user, glucose_unit))]
    mentionables: list[tuple[str, Source]] = []

    labs: dict[str, list[dict]] = {}
    for analysis in analyses:
        for lab in analysis.get("extracted_data", {}).get("lab_values", []):
            name = (lab.get("display_name") or lab.get("test") or "").strip()
            if name:
                labs.setdefault(name.lower(), []).append({**lab, "_name": name, "_date": analysis["_date"], "_source": analysis["_source"]})
    lab_lines = []
    ordered = sorted(labs.values(), key=lambda h: ((h[0].get("status") or "normal") == "normal", h[0]["_name"].lower()))
    for history in ordered[:MAX_LAB_TESTS]:
        latest = history[0]
        line = f"{latest['_name']}: {latest.get('value')} {latest.get('unit') or ''}".rstrip()
        line += f" ({(latest.get('status') or 'unknown')}"
        if latest.get("reference_range"):
            line += f", range {latest['reference_range']}"
        line += f") on {_day(latest['_date'])}"
        if latest["_source"]:
            line += f" [{latest['_source'].title}]"
            mentionables.append((latest["_name"].lower(), latest["_source"]))
        if len(history) > 1:
            earlier = ", ".join(f"{h.get('value')} on {_day(h['_date'])}" for h in history[1:4])
            line += f"; earlier: {earlier}"
        lab_lines.append(line)
    if len(ordered) > MAX_LAB_TESTS:
        lab_lines.append(f"(+{len(ordered) - MAX_LAB_TESTS} more tests not listed)")
    sections.append(("LAB RESULTS (latest per test, out-of-range first)", lab_lines or ["No lab results yet."]))

    meds, seen = [], set()
    diagnoses, seen_dx = [], set()
    for analysis in analyses:
        extracted = analysis.get("extracted_data", {})
        for med in extracted.get("medications", []):
            key = (med.get("name") or "").strip().lower()
            if key and key not in seen:
                seen.add(key)
                detail = " ".join(str(med[k]) for k in ("dosage", "frequency") if med.get(k))
                meds.append(f"{med['name']} {detail} (from {_day(analysis['_date'])})".replace("  ", " "))
                if analysis["_source"]:
                    mentionables.append((key, analysis["_source"]))
        for dx in extracted.get("diagnoses", []):
            key = (dx.get("condition") or "").strip().lower()
            if key and key not in seen_dx:
                seen_dx.add(key)
                diagnoses.append(f"{dx['condition']} (from {_day(analysis['_date'])})")
                if analysis["_source"]:
                    mentionables.append((key, analysis["_source"]))
    sections.append(("MEDICATIONS IN RECORDS (most recent first; may not reflect current prescriptions)", meds or ["None recorded."]))
    sections.append(("DIAGNOSES IN RECORDS", diagnoses or ["None recorded."]))

    readings = await db.health_readings.find(
        {"user_id": user_id, "timestamp": {"$gte": now - timedelta(days=VITALS_DAYS)}}
    ).sort("timestamp", -1).to_list(length=2000)
    sections.append((f"HOME READINGS (last {VITALS_DAYS} days, times in {tz.key})", _vitals_section(readings, user, glucose_unit, tz, now) or ["No readings logged."]))

    if analyses:
        summary = [f"Health score: {calculate_health_score(analyses, user.get('medical_conditions') or [])}/100 (same score as the dashboard)"]
        active = get_active_conditions(analyses)
        if active:
            summary.append(f"Conditions flagged from results: {', '.join(active)}")
        for p in predict_conditions(analyses)[:3]:
            summary.append(f"Possible risk: {p['condition']} — {p.get('reasoning', '')}")
        sections.append(("SUMMARY", summary))

    analysed = {a.get("document_id") for a in analyses}
    pending = [s for doc_id, s in documents.items() if doc_id not in analysed]
    if pending:
        sections.append(("NOT YET ANALYSED", [f"{s.title} ({s.date or 'undated'})" for s in pending[:10]]))

    text = "\n\n".join(f"## {title}\n" + "\n".join(f"- {line}" for line in lines) for title, lines in sections)
    if len(text) > MAX_RECORDS_CHARS:
        text = text[:MAX_RECORDS_CHARS] + "\n(records truncated)"
    return ChatContext(records=text, today=f"{today} ({tz.key})", glucose_unit=glucose_unit, mentionables=mentionables)


# --- Semantic search over document snippets (findings, imaging notes, etc.) ---

_index_cache: dict[str, tuple[tuple, np.ndarray, list[dict]]] = {}


async def _load_index(db, user_id: str):
    count = await db.document_chunks.count_documents({"user_id": user_id, "embedding": {"$exists": True}})
    if not count:
        return None
    newest = await db.document_chunks.find({"user_id": user_id}, {"_id": 1}).sort("_id", -1).limit(1).to_list(length=1)
    signature = (count, str(newest[0]["_id"]) if newest else "")
    cached = _index_cache.get(user_id)
    if cached and cached[0] == signature:
        return cached[1], cached[2]
    chunks = await db.document_chunks.find(
        {"user_id": user_id, "embedding": {"$exists": True}},
        {"embedding": 1, "content": 1, "document_id": 1, "chunk_type": 1},
    ).to_list(length=None)
    chunks = [c for c in chunks if c.get("embedding")]
    if not chunks:
        return None
    matrix = np.array([c["embedding"] for c in chunks], dtype=np.float32)
    matrix /= np.linalg.norm(matrix, axis=1, keepdims=True) + 1e-9
    meta = [{k: c.get(k) for k in ("content", "document_id", "chunk_type")} for c in chunks]
    _index_cache[user_id] = (signature, matrix, meta)
    return matrix, meta


async def retrieve_snippets(db, user_id: str, query: str, documents: dict[str, Source], top_k: int = 5) -> tuple[list[str], list[Source]]:
    try:
        index = await _load_index(db, user_id)
        if not index:
            return [], []
        matrix, meta = index
        from app.services.embeddings import embed_text
        from app.services.reranker import rerank_chunks

        q = np.array(await embed_text(query), dtype=np.float32)
        q /= np.linalg.norm(q) + 1e-9
        scores = matrix @ q
        candidates = [meta[i] for i in np.argsort(-scores)[:20]]
        best = await rerank_chunks(query, candidates, top_k=top_k) if len(candidates) > top_k else candidates
    except Exception as e:
        logger.warning(f"[CHAT] Snippet search unavailable: {e}")
        return [], []

    snippets, sources = [], []
    for chunk in best:
        source = documents.get(str(chunk.get("document_id")))
        label = f"{source.title}, {source.date or 'undated'}" if source else "Unknown record"
        snippets.append(f"[{label}] {chunk.get('content', '')}")
        if source and source not in sources:
            sources.append(source)
    return snippets, sources
