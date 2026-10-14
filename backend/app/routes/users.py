import logging
import os
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Body, Response
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from app.models import ProfileUpdate
from app.oauth2 import oauth2_scheme, AUTH_COOKIE_NAME
from app.config import settings
from app.services.user_data import delete_user_data, export_user_data
from app.utils.security import get_current_user, verify_password
from bson import ObjectId

logger = logging.getLogger("medical-records-app")

router = APIRouter()

def get_db():
    from app.main import app
    return app.mongo_db

@router.get("/me")
async def get_user_profile(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    user = await get_current_user(token, db)
    return serialize_user(user)

def serialize_user(user: dict) -> dict:
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

@router.get("/me/export")
async def export_my_data(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    """Download all of the current user's records as JSON."""
    user = await get_current_user(token, db)
    data = await export_user_data(db, user)
    logger.info(f"[USER] Exported data for user {user['_id']}")
    return JSONResponse(
        jsonable_encoder(data, custom_encoder={ObjectId: str}),
        headers={"Content-Disposition": 'attachment; filename="healthsync-export.json"'},
    )

@router.delete("/me")
async def delete_my_account(
    response: Response,
    password: str = Body(..., embed=True),
    token: str = Depends(oauth2_scheme),
    db=Depends(get_db),
):
    """Permanently delete the account, all stored files, and every derived record."""
    user = await get_current_user(token, db)
    if not verify_password(password, user["password_hash"]):
        raise HTTPException(403, "Incorrect password")
    try:
        await delete_user_data(db, user)
    except Exception as e:
        logger.error(f"[USER] Account deletion failed for user {user['_id']}: {e}")
        raise HTTPException(500, "Could not delete all stored files; please retry")
    response.delete_cookie(
        AUTH_COOKIE_NAME, path="/api", httponly=True, secure=settings.COOKIE_SECURE, samesite="strict"
    )
    return {"message": "Account deleted"}

@router.patch("/me")
async def update_user_profile(
    profile: ProfileUpdate,
    token: str = Depends(oauth2_scheme),
    db=Depends(get_db),
):
    user = await get_current_user(token, db)
    
    update_data = profile.model_dump(exclude_none=True)
    if "date_of_birth" in update_data:
        update_data["date_of_birth"] = update_data["date_of_birth"].isoformat()
    
    if update_data:
        await db.users.update_one({"_id": user["_id"]}, {"$set": update_data})
        logger.info(f"[USER] Profile updated with fields: {list(update_data.keys())}")
    
    updated_user = await db.users.find_one({"_id": user["_id"]})
    return serialize_user(updated_user)

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