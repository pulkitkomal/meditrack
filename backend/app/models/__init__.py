from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from typing import Annotated, Literal, Optional
from datetime import datetime, date, timedelta, timezone
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

MMOL_TO_MG_DL = 18.0182


class ReadingIn(BaseModel):
    """A vital sign entered on the website. Stored in the same shape as Telegram readings:
    glucose in mg/dL, weight in kg, timestamps as naive UTC."""
    type: TrackingType
    value: Optional[float] = None
    unit: Optional[Literal["mg/dL", "mmol/L", "kg"]] = None
    systolic: Optional[int] = None
    diastolic: Optional[int] = None
    timestamp: Optional[datetime] = None

    @model_validator(mode="after")
    def validate_reading(self):
        if self.type == "bp":
            if self.systolic is None or self.diastolic is None:
                raise ValueError("Blood pressure needs systolic and diastolic values")
            if not (60 <= self.systolic <= 250 and 40 <= self.diastolic <= 150):
                raise ValueError("Blood pressure must be between 60-250 / 40-150 mmHg")
            if self.systolic <= self.diastolic:
                raise ValueError("Systolic must be higher than diastolic")
        elif self.value is None:
            raise ValueError("A value is required")
        elif self.type == "glucose":
            unit = self.unit or "mg/dL"
            if unit == "mmol/L":
                if not 1.0 <= self.value <= 33.3:
                    raise ValueError("Glucose must be between 1.0 and 33.3 mmol/L")
            elif unit == "mg/dL":
                if not 20 <= self.value <= 600:
                    raise ValueError("Glucose must be between 20 and 600 mg/dL")
            else:
                raise ValueError("Glucose unit must be mg/dL or mmol/L")
        elif self.type == "weight":
            if self.unit not in (None, "kg"):
                raise ValueError("Weight unit must be kg")
            if not 20 <= self.value <= 300:
                raise ValueError("Weight must be between 20 and 300 kg")

        if self.timestamp is not None:
            ts = self.timestamp
            if ts.tzinfo is not None:
                ts = ts.astimezone(timezone.utc).replace(tzinfo=None)
            if ts > datetime.utcnow() + timedelta(minutes=5):
                raise ValueError("Reading time cannot be in the future")
            self.timestamp = ts
        return self

    def to_document(self) -> dict:
        ts = self.timestamp or datetime.utcnow()
        # MongoDB keeps millisecond precision
        doc = {"type": self.type, "timestamp": ts.replace(microsecond=ts.microsecond // 1000 * 1000)}
        if self.type == "bp":
            doc.update(value=f"{self.systolic}/{self.diastolic}", unit="mmHg",
                       systolic=self.systolic, diastolic=self.diastolic)
        elif self.type == "glucose":
            mg_dl = self.value * MMOL_TO_MG_DL if self.unit == "mmol/L" else self.value
            doc.update(value=round(mg_dl), unit="mg/dL")
        else:
            doc.update(value=round(self.value, 1), unit="kg")
        return doc


class LabValueUpdate(BaseModel):
    """A user's correction to one AI-extracted lab value."""
    test: Optional[ShortText] = None
    value: float | Annotated[str, Field(min_length=1, max_length=50)]
    unit: Optional[str] = Field(None, max_length=30)
    reference_range: Optional[str] = Field(None, max_length=100)
    status: Literal["normal", "high", "low", "critical"]


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
