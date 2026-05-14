import logging
import os
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Body
from app.oauth2 import oauth2_scheme
from app.utils.security import get_current_user
from bson import ObjectId

logger = logging.getLogger("medical-records-app")

router = APIRouter()

def get_db():
    from app.main import app
    return app.mongo_db

@router.get("/me")
async def get_user_profile(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    logger.info(f"[USER] Fetching user profile")
    user = await get_current_user(token, db)
    logger.info(f"[USER] User profile fetched: {user.get('email')} (ID: {user['_id']})")
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "first_name": user["first_name"],
        "last_name": user["last_name"],
        "role": user.get("role", "user"),
        "gender": user.get("gender"),
        "age": user.get("age"),
        "date_of_birth": user.get("date_of_birth"),
        "blood_type": user.get("blood_type"),
        "height": user.get("height"),
        "weight": user.get("weight"),
        "dry_weight": user.get("dry_weight"),
        "emergency_contact": user.get("emergency_contact"),
        "medical_conditions": user.get("medical_conditions", []),
        "allergies": user.get("allergies", []),
        "glucose_unit": user.get("glucose_unit", "mg/dL"),
        "timezone": user.get("timezone", "UTC"),
        "telegram_enabled": user.get("telegram_enabled", False),
        "telegram_chat_id": user.get("telegram_chat_id"),
        "notification_times": user.get("notification_times", []),
        "tracking_types": user.get("tracking_types", [])
    }

@router.patch("/me")
async def update_user_profile(
    token: str = Depends(oauth2_scheme), 
    db=Depends(get_db),
    gender: str = Body(None),
    age: int = Body(None),
    date_of_birth: str = Body(None),
    blood_type: str = Body(None),
    height: float = Body(None),
    weight: float = Body(None),
    dry_weight: float = Body(None),
    emergency_contact: str = Body(None),
    medical_conditions: list = Body(None),
    allergies: list = Body(None),
    glucose_unit: str = Body(None),
    timezone: str = Body(None),
    telegram_enabled: bool = Body(None),
    notification_times: list = Body(None),
    tracking_types: list = Body(None)
):
    logger.info(f"[USER] Updating user profile")
    user = await get_current_user(token, db)
    
    update_data = {}
    if gender is not None:
        update_data["gender"] = gender
    if age is not None:
        update_data["age"] = age
    if date_of_birth is not None:
        update_data["date_of_birth"] = date_of_birth
    if blood_type is not None:
        update_data["blood_type"] = blood_type
    if height is not None:
        update_data["height"] = height
    if weight is not None:
        update_data["weight"] = weight
    if dry_weight is not None:
        update_data["dry_weight"] = dry_weight
    if emergency_contact is not None:
        update_data["emergency_contact"] = emergency_contact
    if medical_conditions is not None:
        update_data["medical_conditions"] = medical_conditions
    if allergies is not None:
        update_data["allergies"] = allergies
    if glucose_unit is not None:
        update_data["glucose_unit"] = glucose_unit
    if timezone is not None:
        update_data["timezone"] = timezone
    if telegram_enabled is not None:
        update_data["telegram_enabled"] = telegram_enabled
    if notification_times is not None:
        update_data["notification_times"] = notification_times
    if tracking_types is not None:
        update_data["tracking_types"] = tracking_types
    
    if update_data:
        await db.users.update_one(
            {"_id": ObjectId(user["_id"])},
            {"$set": update_data}
        )
        logger.info(f"[USER] Profile updated with fields: {list(update_data.keys())}")
    
    # Fetch updated user
    updated_user = await db.users.find_one({"_id": ObjectId(user["_id"])})
    return {
        "id": str(updated_user["_id"]),
        "email": updated_user["email"],
        "first_name": updated_user["first_name"],
        "last_name": updated_user["last_name"],
        "role": updated_user.get("role", "user"),
        "gender": updated_user.get("gender"),
        "age": updated_user.get("age"),
        "date_of_birth": updated_user.get("date_of_birth"),
        "blood_type": updated_user.get("blood_type"),
        "height": updated_user.get("height"),
        "weight": updated_user.get("weight"),
        "dry_weight": updated_user.get("dry_weight"),
        "emergency_contact": updated_user.get("emergency_contact"),
        "medical_conditions": updated_user.get("medical_conditions", []),
        "allergies": updated_user.get("allergies", []),
        "glucose_unit": updated_user.get("glucose_unit", "mg/dL"),
        "timezone": updated_user.get("timezone", "UTC"),
        "telegram_enabled": updated_user.get("telegram_enabled", False),
        "telegram_chat_id": updated_user.get("telegram_chat_id"),
        "notification_times": updated_user.get("notification_times", []),
        "tracking_types": updated_user.get("tracking_types", [])
    }

@router.post("/telegram/generate-link")
async def generate_telegram_link(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    """Generate a unique link token for Telegram connection"""
    user = await get_current_user(token, db)
    
    # Generate unique token
    link_token = secrets.token_urlsafe(32)
    expires = datetime.utcnow() + timedelta(hours=24)
    
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {"telegram_link_token": link_token, "telegram_link_expires": expires}}
    )
    
    # Get bot username from Telegram API
    from telegram import Bot
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if bot_token:
        try:
            bot = Bot(token=bot_token)
            bot_info = await bot.get_me()
            username = bot_info.username
            url = f"https://t.me/{username}?start={link_token}"
            return {"url": url, "expires": expires.isoformat()}
        except Exception as e:
            logging.warning(f"Could not get bot username: {e}")
    
    return {"url": f"https://t.me/HealthSyncBot?start={link_token}", "expires": expires.isoformat()}