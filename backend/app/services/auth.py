from app.utils.security import hash_password, verify_password, create_access_token
from app.models import UserCreate, UserLogin, PRIVACY_POLICY_VERSION
from datetime import datetime
from pymongo.errors import DuplicateKeyError

async def register_user(user_data: UserCreate, db):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        return None
    user_dict = user_data.model_dump(exclude={"password", "accept_privacy_policy"})
    user_dict["role"] = "patient"
    user_dict["privacy_consent"] = {"version": PRIVACY_POLICY_VERSION, "accepted_at": datetime.utcnow()}
    user_dict["password_hash"] = hash_password(user_data.password)
    user_dict["created_at"] = datetime.utcnow()
    try:
        result = await db.users.insert_one(user_dict)
    except DuplicateKeyError:
        return None
    return {"id": str(result.inserted_id)}

async def login_user(login_data: UserLogin, db):
    user = await db.users.find_one({"email": login_data.email})
    if not user or not verify_password(login_data.password, user["password_hash"]):
        return None
    token = create_access_token(
        {"sub": user["email"], "role": user.get("role", "patient")},
        token_version=user.get("token_version", 0),
    )
    return {"access_token": token, "token_type": "bearer"}