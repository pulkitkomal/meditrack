from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Annotated, Literal, Optional
from datetime import datetime, date
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

ShortText = Annotated[str, Field(min_length=1, max_length=100)]
TimeOfDay = Annotated[str, Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]
TrackingType = Literal["glucose", "bp", "weight"]


class ProfileUpdate(BaseModel):
    """Fields a user may change on their own profile; omitted fields are left untouched."""
    gender: Optional[Literal["male", "female", "other"]] = None
    age: Optional[int] = Field(None, ge=0, le=130)
    date_of_birth: Optional[date] = None
    blood_type: Optional[Literal["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]] = None
    height: Optional[float] = Field(None, gt=0, le=300)
    weight: Optional[float] = Field(None, gt=0, le=500)
    dry_weight: Optional[float] = Field(None, gt=0, le=500)
    emergency_contact: Optional[str] = Field(None, max_length=200)
    medical_conditions: Optional[list[ShortText]] = Field(None, max_length=50)
    allergies: Optional[list[ShortText]] = Field(None, max_length=50)
    glucose_unit: Optional[Literal["mg/dL", "mmol/L"]] = None
    timezone: Optional[str] = None
    telegram_enabled: Optional[bool] = None
    notification_times: Optional[list[TimeOfDay]] = Field(None, max_length=24)
    tracking_types: Optional[list[TrackingType]] = Field(None, max_length=3)

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value):
        if value is None:
            return value
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Unknown timezone")
        return value

class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    date_of_birth: Optional[str] = None
    phone: Optional[str] = None

PRIVACY_POLICY_VERSION = "2026-10-14"

class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=72)
    accept_privacy_policy: Literal[True]

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
