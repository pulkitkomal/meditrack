import logging
from datetime import datetime

from app.models import LabValueUpdate
from app.services.analysis import (
    build_key_facts,
    build_risk_factors,
    generate_chunks_from_analysis,
    normalize_lab_display_names,
    save_document_chunks,
)

logger = logging.getLogger("medical-records-app")

CORRECTABLE_FIELDS = ("test", "value", "unit", "reference_range", "status")


async def apply_lab_correction(db, analysis: dict, index: int, update: LabValueUpdate) -> dict:
    """Replace one extracted lab value, keeping the AI's original the first time it is edited,
    and rebuild everything derived from the lab values. Returns the updated lab value."""
    lab_values = analysis["extracted_data"]["lab_values"]
    lab = dict(lab_values[index])
    if "original" not in lab:
        lab["original"] = {field: lab.get(field) for field in CORRECTABLE_FIELDS}

    changes = update.model_dump(exclude_none=True)
    lab.update(changes)
    if "test" in changes:
        normalize_lab_display_names([lab])
    lab["edited"] = True
    lab["edited_at"] = datetime.utcnow()
    lab_values[index] = lab

    extracted = analysis["extracted_data"]
    await db.analysis_results.update_one(
        {"_id": analysis["_id"]},
        {"$set": {
            f"extracted_data.lab_values.{index}": lab,
            "chatbot_context.key_facts": build_key_facts(lab_values, extracted.get("medications", [])),
            "risk_assessment.risk_factors": build_risk_factors(lab_values),
        }},
    )
    logger.info(f"[CORRECTIONS] Lab value {index} corrected for document {analysis['document_id']}")
    return lab


async def rebuild_document_chunks(db, analysis: dict):
    """Regenerate the chat search chunks for a document so the assistant sees corrected values."""
    chunks = await generate_chunks_from_analysis(analysis)
    await db.document_chunks.delete_many({"document_id": analysis["document_id"]})
    await save_document_chunks(db, chunks)
