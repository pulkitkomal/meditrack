import logging
from fastapi import APIRouter, Depends, HTTPException, status
from app.oauth2 import oauth2_scheme
from app.models import UserCreate, UserLogin, Token
from app.services.auth import register_user, login_user
from app.utils.security import get_current_user

logger = logging.getLogger("medical-records-app")

router = APIRouter()
def get_db():
    from app.main import app
    return app.mongo_db

@router.post("/register", response_model=dict)
async def register(user: UserCreate, db=Depends(get_db)):
    logger.info(f"[AUTH] Registration attempt for email: {user.email}")
    result = await register_user(user, db)
    if not result:
        logger.warning(f"[AUTH] Registration failed - email already registered: {user.email}")
        raise HTTPException(400, "Email already registered")
    logger.info(f"[AUTH] User registered successfully - user_id: {result['id']}, email: {user.email}")
    return {"message": "User registered", "user_id": result["id"]}

@router.post("/login", response_model=dict)
async def login(user: UserLogin, db=Depends(get_db)):
    logger.info(f"[AUTH] Login attempt for email: {user.email}")
    result = await login_user(user, db)
    if not result:
        logger.warning(f"[AUTH] Login failed - invalid credentials for email: {user.email}")
        raise HTTPException(401, "Invalid credentials")
    logger.info(f"[AUTH] Login successful for email: {user.email}")
    return result

@router.get("/me")
async def get_me(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    logger.info(f"[AUTH] Fetching current user info")
    user = await get_current_user(token, db)
    logger.info(f"[AUTH] Current user: {user.get('email')} (ID: {user['_id']})")
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "first_name": user["first_name"],
        "last_name": user["last_name"],
        "role": user["role"]
    }