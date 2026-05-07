from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class LabValue(BaseModel):
    test: str
    value: float
    unit: str
    reference_range: Optional[str] = None
    status: str = "normal"  # normal, high, low

class Medication(BaseModel):
    name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None

class Diagnosis(BaseModel):
    condition: str
    icd_code: Optional[str] = None
    status: str = "active"  # active, resolved

class Vitals(BaseModel):
    blood_pressure: Optional[str] = None
    heart_rate: Optional[int] = None
    temperature: Optional[float] = None
    weight: Optional[float] = None
    bmi: Optional[float] = None

class ExtractedData(BaseModel):
    lab_values: List[LabValue] = []
    medications: List[Medication] = []
    diagnoses: List[Diagnosis] = []
    vitals: Optional[Vitals] = None
    findings: List[str] = []
    summary: Optional[str] = None
    recommendations: List[str] = []

class ChatbotContext(BaseModel):
    key_facts: List[str] = []
    medical_history_summary: Optional[str] = None
    current_medications_summary: Optional[str] = None
    allergies: List[str] = []
    surgical_history: List[str] = []

class RiskAssessment(BaseModel):
    risk_factors: List[str] = []
    predicted_conditions: List[dict] = []  # [{"condition": str, "probability": float, "reasoning": str}]

class AnalysisResult(BaseModel):
    document_id: str
    user_id: str
    analysis_date: datetime
    category: str
    extracted_data: ExtractedData
    chatbot_context: ChatbotContext
    risk_assessment: RiskAssessment