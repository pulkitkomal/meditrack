import logging
from fastapi import APIRouter, Depends
from app.oauth2 import oauth2_scheme
from app.utils.security import get_current_user
from bson import ObjectId

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
