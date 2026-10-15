import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from app.models import ReadingIn, TrackingType
from app.oauth2 import oauth2_scheme
from app.utils.security import get_current_user
from bson import ObjectId
from bson.errors import InvalidId
from typing import Optional

logger = logging.getLogger("medical-records-app")

router = APIRouter()


def get_db():
    from app.main import app
    return app.mongo_db


def serialize_reading(doc: dict) -> dict:
    reading = {
        "id": str(doc["_id"]),
        "type": doc["type"],
        "value": doc["value"],
        "unit": doc.get("unit", "kg" if doc["type"] == "weight" else "mg/dL"),
        # Stored as naive UTC; the suffix keeps browsers from reading it as local time.
        "timestamp": doc["timestamp"].isoformat() + "Z",
        "source": doc.get("source", "telegram_text"),
    }
    if doc["type"] == "bp":
        reading["systolic"] = doc.get("systolic")
        reading["diastolic"] = doc.get("diastolic")
    return reading


async def get_owned_reading(db, reading_id: str, user_id: str) -> dict:
    try:
        oid = ObjectId(reading_id)
    except InvalidId:
        raise HTTPException(status_code=404, detail="Reading not found")
    reading = await db.health_readings.find_one({"_id": oid, "user_id": user_id})
    if not reading:
        raise HTTPException(status_code=404, detail="Reading not found")
    return reading


@router.get("/")
async def list_readings(
    token: str = Depends(oauth2_scheme),
    db=Depends(get_db),
    type: Optional[TrackingType] = None,
    limit: int = Query(100, ge=1, le=500),
):
    user = await get_current_user(token, db)
    query = {"user_id": str(user["_id"])}
    if type:
        query["type"] = type
    cursor = db.health_readings.find(query).sort("timestamp", -1).limit(limit)
    return [serialize_reading(doc) async for doc in cursor]


@router.get("/summary")
async def readings_summary(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    """Latest reading, average, and count for each vital type."""
    user = await get_current_user(token, db)
    user_id = str(user["_id"])
    summary = {}
    for reading_type in ("glucose", "bp", "weight"):
        query = {"user_id": user_id, "type": reading_type}
        latest = await db.health_readings.find_one(query, sort=[("timestamp", -1)])
        count = await db.health_readings.count_documents(query)
        entry = {"latest": serialize_reading(latest) if latest else None, "count": count}
        if count:
            fields = ("systolic", "diastolic") if reading_type == "bp" else ("value",)
            group = {"_id": None, **{f: {"$avg": f"${f}"} for f in fields}}
            averages = await db.health_readings.aggregate([{"$match": query}, {"$group": group}]).to_list(length=1)
            entry["avg"] = {f: round(averages[0][f], 1) for f in fields if averages and averages[0].get(f) is not None}
        summary[reading_type] = entry
    return summary


@router.post("/", status_code=201)
async def create_reading(reading: ReadingIn, token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    user = await get_current_user(token, db)
    doc = {"user_id": str(user["_id"]), "source": "web", **reading.to_document()}
    result = await db.health_readings.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_reading(doc)


@router.put("/{reading_id}")
async def update_reading(reading_id: str, reading: ReadingIn, token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    user = await get_current_user(token, db)
    existing = await get_owned_reading(db, reading_id, str(user["_id"]))
    if reading.type != existing["type"]:
        raise HTTPException(status_code=400, detail="Reading type cannot be changed")
    update = reading.to_document()
    if reading.timestamp is None:
        update["timestamp"] = existing["timestamp"]
    await db.health_readings.update_one({"_id": existing["_id"]}, {"$set": {**update, "edited": True}})
    return serialize_reading({**existing, **update})


@router.delete("/{reading_id}")
async def delete_reading(reading_id: str, token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    user = await get_current_user(token, db)
    existing = await get_owned_reading(db, reading_id, str(user["_id"]))
    await db.health_readings.delete_one({"_id": existing["_id"]})
    return {"message": "Reading deleted"}
