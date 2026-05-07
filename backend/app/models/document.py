from pydantic import BaseModel
from typing import Optional
from datetime import datetime

ALLOWED_CATEGORIES = [
    "lab_results", "prescriptions", "imaging", 
    "vaccination_records", "discharge_summaries",
    "insurance_documents", "other"
]

class DocumentUpload(BaseModel):
    category: str
    description: Optional[str] = None