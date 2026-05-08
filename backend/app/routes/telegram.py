import logging
from fastapi import APIRouter, Depends, HTTPException
from app.oauth2 import oauth2_scheme
from app.utils.security import get_current_user
from bson import ObjectId
from datetime import datetime

logger = logging.getLogger("medical-records-app")

router = APIRouter()

def get_db():
    from app.main import app
    return app.mongo_db

@router.get("/config")
async def get_telegram_config(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    """Get Telegram configuration for current user"""
    user = await get_current_user(token, db)
    
    return {
        "enabled": user.get("telegram_enabled", False),
        "connected": bool(user.get("telegram_chat_id")),
        "notification_times": user.get("notification_times") or ["08:00", "12:00", "18:00", "21:00"],
        "tracking_types": user.get("tracking_types") or ["glucose", "bp"]
    }

@router.put("/config")
async def update_telegram_config(
    token: str = Depends(oauth2_scheme),
    db=Depends(get_db),
    enabled: bool = None,
    notification_times: list = None,
    tracking_types: list = None
):
    """Update Telegram configuration"""
    user = await get_current_user(token, db)
    
    update_data = {}
    
    if enabled is not None:
        update_data["telegram_enabled"] = enabled
        if not enabled:
            # Clear chat_id when disabling
            update_data["telegram_chat_id"] = None
    
    if notification_times is not None:
        update_data["notification_times"] = notification_times
    
    if tracking_types is not None:
        update_data["tracking_types"] = tracking_types
    
    if update_data:
        await db.users.update_one(
            {"_id": ObjectId(user["_id"])},
            {"$set": update_data}
        )
        logger.info(f"[TELEGRAM] Config updated for user {user['_id']}")
    
    updated_user = await db.users.find_one({"_id": ObjectId(user["_id"])})
    
    return {
        "enabled": updated_user.get("telegram_enabled", False),
        "connected": bool(updated_user.get("telegram_chat_id")),
        "notification_times": updated_user.get("notification_times") or ["08:00", "12:00", "18:00", "21:00"],
        "tracking_types": updated_user.get("tracking_types") or ["glucose", "bp"]
    }

@router.post("/disconnect")
async def disconnect_telegram(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    """Disconnect Telegram account"""
    user = await get_current_user(token, db)
    
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {
            "telegram_enabled": False,
            "telegram_chat_id": None,
            "notification_times": []
        }}
    )
    
    logger.info(f"[TELEGRAM] User {user['_id']} disconnected")
    
    return {"message": "Telegram disconnected successfully"}

@router.get("/readings")
async def get_health_readings(
    token: str = Depends(oauth2_scheme),
    db=Depends(get_db),
    type: str = None,
    limit: int = 20
):
    """Get health readings"""
    user = await get_current_user(token, db)
    
    query = {"user_id": str(user["_id"])}
    if type:
        query["type"] = type
    
    cursor = db.health_readings.find(query).sort("timestamp", -1).limit(limit)
    
    readings = []
    async for doc in cursor:
        reading = {
            "id": str(doc["_id"]),
            "type": doc["type"],
            "value": doc["value"],
            "unit": doc.get("unit", "mg/dL"),
            "timestamp": doc["timestamp"].isoformat(),
            "source": doc.get("source", "telegram_text")
        }
        if doc["type"] == "bp":
            reading["systolic"] = doc.get("systolic")
            reading["diastolic"] = doc.get("diastolic")
        
        readings.append(reading)
    
    return readings

@router.get("/readings/summary")
async def get_readings_summary(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    """Get summary of average readings"""
    user = await get_current_user(token, db)
    
    # Calculate average glucose
    glucose_pipeline = [
        {"$match": {"user_id": str(user["_id"]), "type": "glucose"}},
        {"$group": {
            "_id": "$type",
            "avg_value": {"$avg": "$value"},
            "unit": {"$first": "$unit"},
            "count": {"$sum": 1}
        }}
    ]
    glucose_result = await db.health_readings.aggregate(glucose_pipeline).to_list(length=1)
    
    # Calculate average blood pressure
    bp_pipeline = [
        {"$match": {"user_id": str(user["_id"]), "type": "bp"}},
        {"$group": {
            "_id": "$type",
            "avg_systolic": {"$avg": "$systolic"},
            "avg_diastolic": {"$avg": "$diastolic"},
            "count": {"$sum": 1}
        }}
    ]
    bp_result = await db.health_readings.aggregate(bp_pipeline).to_list(length=1)
    
    glucose_data = glucose_result[0] if glucose_result else None
    bp_data = bp_result[0] if bp_result else None
    
    return {
        "glucose": {
            "latest": {
                "value": round(glucose_data["avg_value"], 1) if glucose_data else None,
                "unit": glucose_data["unit"] if glucose_data else "mg/dL",
                "timestamp": None  # No timestamp for average
            } if glucose_data else None,
            "count": glucose_data["count"] if glucose_data else 0
        },
        "bp": {
            "latest": {
                "systolic": round(bp_data["avg_systolic"], 1) if bp_data else None,
                "diastolic": round(bp_data["avg_diastolic"], 1) if bp_data else None,
                "timestamp": None  # No timestamp for average
            } if bp_data else None,
            "count": bp_data["count"] if bp_data else 0
        }
    }

@router.post("/webhook")
async def telegram_webhook(update: dict):
    """Handle incoming Telegram updates"""
    from telegram import Update
    from telegram.ext import Application
    from app.services.telegram_bot import app as bot_app, process_link_token
    
    if not bot_app:
        raise HTTPException(503, "Bot not initialized")
    
    # Check if this is a /start command with token
    if "message" in update and "text" in update["message"]:
        text = update["message"]["text"]
        if text.startswith("/start "):
            token = text.split(" ", 1)[1]
            chat_id = update["message"]["chat"]["id"]
            
            from app.main import app
            db = app.mongo_db
            
            success = await process_link_token(token, chat_id, db)
            
            if success:
                from telegram import Bot
                bot = Bot(token=update["message"]["chat"]["id"])
                await bot.send_message(
                    chat_id=chat_id,
                    text="✅ Successfully connected to HealthSync! You can now log your health readings."
                )
    
    # Process the update
    telegram_update = Update.de_json(update, bot_app.bot)
    await bot_app.process_update(telegram_update)
    
    return {"ok": True}