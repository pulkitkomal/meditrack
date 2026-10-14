import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from app.config import settings
from app.oauth2 import oauth2_scheme, AUTH_COOKIE_NAME
from app.models import UserCreate, UserLogin
from app.services.auth import register_user, login_user
from app.utils.rate_limit import FailedAttemptLimiter
from app.utils.security import get_current_user, decode_token, revoke_token

logger = logging.getLogger("medical-records-app")

router = APIRouter()

login_limiter = FailedAttemptLimiter(max_attempts=5, window_seconds=15 * 60)

def get_db():
    from app.main import app
    return app.mongo_db

@router.post("/register", response_model=dict)
async def register(user: UserCreate, db=Depends(get_db)):
    result = await register_user(user, db)
    if not result:
        logger.warning("[AUTH] Registration failed - email already registered")
        raise HTTPException(400, "Email already registered")
    logger.info(f"[AUTH] User registered successfully - user_id: {result['id']}")
    return {"message": "User registered", "user_id": result["id"]}

@router.post("/login", response_model=dict)
async def login(user: UserLogin, response: Response, db=Depends(get_db)):
    limiter_key = user.email.lower()
    if login_limiter.is_blocked(limiter_key):
        logger.warning("[AUTH] Login blocked - too many failed attempts")
        raise HTTPException(429, "Too many failed login attempts. Try again later.")
    result = await login_user(user, db)
    if not result:
        login_limiter.record_failure(limiter_key)
        logger.warning("[AUTH] Login failed - invalid credentials")
        raise HTTPException(401, "Invalid credentials")
    login_limiter.reset(limiter_key)
    response.set_cookie(
        AUTH_COOKIE_NAME,
        result["access_token"],
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="strict",
        path="/api",
    )
    logger.info("[AUTH] Login successful")
    return {"message": "Logged in"}

def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        AUTH_COOKIE_NAME, path="/api", httponly=True, secure=settings.COOKIE_SECURE, samesite="strict"
    )

@router.post("/logout", response_model=dict)
async def logout(request: Request, response: Response, db=Depends(get_db)):
    token = request.cookies.get(AUTH_COOKIE_NAME)
    if token:
        try:
            await revoke_token(decode_token(token), db)
        except HTTPException:
            pass
    clear_auth_cookie(response)
    return {"message": "Logged out"}

@router.post("/logout-all", response_model=dict)
async def logout_all(response: Response, token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    """Invalidate every token issued to this account, on all devices."""
    user = await get_current_user(token, db)
    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"token_version": 1}})
    clear_auth_cookie(response)
    logger.info(f"[AUTH] Signed out all sessions for user {user['_id']}")
    return {"message": "Signed out of all devices"}

@router.get("/me")
async def get_me(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    user = await get_current_user(token, db)
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "first_name": user["first_name"],
        "last_name": user["last_name"],
        "role": user.get("role", "patient")
    }
