import secrets
import bcrypt
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from app.config import settings
from fastapi import HTTPException, status

def hash_password(password: str) -> str:
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    plain_bytes = plain.encode('utf-8')
    if len(plain_bytes) > 72:
        plain_bytes = plain_bytes[:72]
    return bcrypt.checkpw(plain_bytes, hashed.encode('utf-8'))

def create_access_token(data: dict, token_version: int = 0) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "jti": secrets.token_urlsafe(16), "ver": token_version})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def revoke_token(payload: dict, db) -> None:
    """Deny-list a single token until it would have expired anyway (TTL index cleans it up)."""
    if payload.get("jti"):
        expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        await db.revoked_tokens.update_one(
            {"_id": payload["jti"]}, {"$set": {"expires_at": expires_at}}, upsert=True
        )

async def get_current_user(token: str, db):
    payload = decode_token(token)
    user = await db.users.find_one({"email": payload.get("sub")})
    if not user or payload.get("ver") != user.get("token_version", 0):
        raise HTTPException(status_code=401, detail="Invalid token")
    if await db.revoked_tokens.find_one({"_id": payload.get("jti")}):
        raise HTTPException(status_code=401, detail="Invalid token")
    return user