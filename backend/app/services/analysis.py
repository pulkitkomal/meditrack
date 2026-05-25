import os
import json
import base64
import logging
import subprocess
import tempfile
from io import BytesIO
from pathlib import Path
from typing import Optional, List
from datetime import datetime
from openai import OpenAI
from app.config import settings
from app.models.analysis import AnalysisResult, ExtractedData, ChatbotContext, RiskAssessment

logger = logging.getLogger("medical-records-app")

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", settings.OPENAI_API_KEY if hasattr(settings, 'OPENAI_API_KEY') else ""))

# Store the last response usage for tracking
last_usage = None

LAB_DISPLAY_NAME_MAPPING = {
    "hba1c": "HbA1c",
    "hba1c (gmi)": "HbA1c",
    "glycosylated hemoglobin": "HbA1c",
    "glycosylated hb": "HbA1c",
    "hemoglobin a1c": "HbA1c",
    "hb a1c": "HbA1c",
    "hemoglobin": "Hemoglobin",
    "hb": "Hemoglobin",
    "hb-hemoglobin": "Hemoglobin",
    "glucose": "Glucose",
    "fasting glucose": "Fasting Glucose",
    "blood glucose": "Blood Glucose",
    "random blood sugar": "Blood Sugar",
    "rbs": "Blood Sugar",
    "creatinine": "Creatinine",
    "gfr estimated": "eGFR",
    "estimated gfr": "eGFR",
    "gfr": "eGFR",
    "urea": "Urea",
    "urea nitrogen blood": "BUN",
    "bun": "BUN",
    "tsh": "TSH",
    "thyroxine": "T4",
    "t4": "T4",
    "triiodothyronine": "T3",
    "t3": "T3",
    "cholesterol": "Cholesterol",
    "total cholesterol": "Cholesterol",
    "ldl": "LDL",
    "hdl": "HDL",
    "triglycerides": "Triglycerides",
    "uric acid": "Uric Acid",
    "bilirubin": "Bilirubin",
    "albumin": "Albumin",
    "alt": "ALT",
    "alt (sgpt)": "ALT",
    "sgpt": "ALT",
    "ast": "AST",
    "ast (sgot)": "AST",
    "sgot": "AST",
    "wbc": "WBC",
    "total leukocyte count": "WBC",
    "rbc count": "RBC",
    "rbc": "RBC",
    "platelet count": "Platelets",
    "platelets": "Platelets",
    "sodium": "Sodium",
    "na": "Sodium",
    "potassium": "Potassium",
    "k": "Potassium",
    "ferritin": "Ferritin",
    "iron": "Iron",
    "calcium": "Calcium",
    "phosphorus": "Phosphorus",
}

def normalize_lab_display_names(lab_values: list) -> list:
    """Normalize lab test names to proper display names"""
    for lab in lab_values:
        test_name = lab.get("test", "")
        if test_name:
            normalized = test_name.lower().strip()
            if normalized in LAB_DISPLAY_NAME_MAPPING:
                lab["display_name"] = LAB_DISPLAY_NAME_MAPPING[normalized]
            else:
                lab["display_name"] = test_name
        else:
            lab["display_name"] = lab.get("test", "Unknown")
    return lab_values

async def generate_document_title(file_path: str, category: str) -> Optional[str]:
    """Generate a predicted title for a document based on its content"""
    logger.info(f"[ANALYSIS] Generating title for file: {file_path}, category: {category}")
    
    if not client.api_key or client.api_key == "your_openai_api_key_here":
        logger.warning(f"[ANALYSIS] OpenAI API key not configured, cannot generate title")
        return None
    
    try:
        file_path_str = str(file_path)
        
        # Extract text from the document
        if file_path_str.lower().endswith('.pdf'):
            text = extract_text_from_pdf(file_path_str)
        elif file_path_str.lower().endswith(('.jpg', '.jpeg', '.png')):
            # For images, convert to base64 and use vision
            images = convert_pdf_to_images(file_path_str)
            if images:
                text = f"[Image document - {category}]"
            else:
                text = ""
        else:
            text = ""
        
        if not text:
            text = f"Document of type: {category}"
        
        # Truncate text to keep it manageable
        text = text[:3000] if len(text) > 3000 else text
        
        prompt = f"""Based on the following document content from a {category} document, generate a short, descriptive title (max 60 characters) that summarizes what this document is about.

Example titles:
- "Blood Test Results - CBC Panel"
- "Prescription - Metformin 500mg"
- "Chest X-Ray Report"
- "COVID-19 Vaccination Record"
- "Hospital Discharge Summary"

Document content (first 3000 chars):
{text}

Generate a concise title:"""
        
        response = client.chat.completions.create(
            model=getattr(settings, 'OPENAI_MODEL', 'gpt-4o-mini'),
            messages=[
                {"role": "system", "content": "You generate short, descriptive titles for medical documents."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=50
        )
        
        title = response.choices[0].message.content.strip()
        # Clean up the title - remove quotes if any
        title = title.strip('"').strip("'")
        
        logger.info(f"[ANALYSIS] Generated title: {title}")
        return title
        
    except Exception as e:
        logger.error(f"[ANALYSIS] Failed to generate title: {e}")
        return None

def _read_pdf_content(file_path: str):
    """Read PDF file and open via stream"""
    with open(file_path, "rb") as f:
        content = f.read()
    logger.info(f"[ANALYSIS] PDF file size: {len(content)} bytes, first bytes hex: {content[:20].hex()}")
    import pymupdf
    return pymupdf.open(stream=BytesIO(content), filetype="pdf")

def _pdf_to_images_poppler(file_path: str) -> list:
    """Convert PDF pages to base64 PNG images using pdftoppm"""
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            result = subprocess.run(
                ["pdftoppm", "-png", "-r", "200", file_path, f"{tmpdir}/page"],
                capture_output=True, timeout=30
            )
            if result.returncode != 0:
                logger.warning(f"[ANALYSIS] pdftoppm failed: {result.stderr.decode()}")
                return []
            page_files = sorted(Path(tmpdir).glob("page-*.png"))
            if not page_files:
                logger.warning("[ANALYSIS] pdftoppm produced no output files")
                return []
            images = []
            for pf in page_files:
                with open(pf, "rb") as f:
                    images.append(base64.b64encode(f.read()).decode("utf-8"))
            logger.info(f"[ANALYSIS] pdftoppm converted {len(images)} pages")
            return images
    except FileNotFoundError:
        logger.warning("[ANALYSIS] pdftoppm not installed")
        return []
    except Exception as e:
        logger.warning(f"[ANALYSIS] pdftoppm failed: {e}")
        return []

def _pdf_to_text_poppler(file_path: str) -> str:
    """Extract text from PDF using pdftotext"""
    try:
        result = subprocess.run(
            ["pdftotext", "-layout", file_path, "-"],
            capture_output=True, timeout=30
        )
        if result.returncode == 0 and result.stdout.strip():
            text = result.stdout.decode("utf-8", errors="replace")
            logger.info(f"[ANALYSIS] pdftotext extracted {len(text)} characters")
            return text
    except FileNotFoundError:
        logger.warning("[ANALYSIS] pdftotext not installed")
    except Exception as e:
        logger.warning(f"[ANALYSIS] pdftotext failed: {e}")
    return ""

def convert_pdf_to_images(file_path: str) -> list:
    logger.info(f"[ANALYSIS] Converting PDF to images: {file_path}")
    # Try pdftoppm first — handles more PDF variants than pymupdf
    poppler_images = _pdf_to_images_poppler(file_path)
    if poppler_images:
        logger.info(f"[ANALYSIS] pdftoppm converted {len(poppler_images)} pages")
        return poppler_images
    # Fall back to pymupdf
    logger.warning("[ANALYSIS] pdftoppm unavailable or failed, trying pymupdf...")
    try:
        import pymupdf
        doc = _read_pdf_content(file_path)
        images = []
        for page_num, page in enumerate(doc):
            pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2))
            img_data = pix.tobytes("png")
            images.append(base64.b64encode(img_data).decode('utf-8'))
            logger.info(f"[ANALYSIS] Converted page {page_num + 1}/{len(doc)} to image, size: {len(img_data)} bytes")
        logger.info(f"[ANALYSIS] Converted {len(images)} pages to images")
        return images
    except Exception as e:
        logger.warning(f"[ANALYSIS] pymupdf image conversion failed: {e}")
        return []

def extract_text_from_pdf(file_path: str) -> str:
    logger.info(f"[ANALYSIS] Extracting text from PDF: {file_path}")
    # Try pdftotext first
    poppler_text = _pdf_to_text_poppler(file_path)
    if poppler_text:
        return poppler_text
    # Fall back to pymupdf
    logger.warning("[ANALYSIS] pdftotext unavailable or failed, trying pymupdf...")
    try:
        import pymupdf
        doc = _read_pdf_content(file_path)
        text = ""
        for page in doc:
            text += page.get_text()
        logger.info(f"[ANALYSIS] Extracted {len(text)} characters from PDF with {len(doc)} pages")
        return text
    except Exception:
        logger.warning("[ANALYSIS] pymupdf text extraction failed, trying raw text fallback...")
        try:
            with open(file_path, "rb") as f:
                raw = f.read()
            text = raw.decode("utf-8", errors="replace")
            if text.strip():
                logger.info(f"[ANALYSIS] Extracted {len(text)} characters via raw text fallback")
                return text
        except Exception:
            pass
        return ""

def encode_image_to_base64(file_path: str) -> str:
    logger.info(f"[ANALYSIS] Encoding image to base64: {file_path}")
    with open(file_path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode('utf-8')
    logger.info(f"[ANALYSIS] Image encoded, base64 length: {len(encoded)} characters")
    return encoded

def get_category_prompt(category: str) -> str:
    prompts = {
        "lab_results": """You are a medical AI assistant analyzing a laboratory results document. Extract ALL test results, including complete blood count (CBC), metabolic panel, lipid panel, liver function tests, kidney function tests, thyroid tests, urinalysis, and any other tests present.

For each lab test, extract:
- Test name (be specific, e.g., "Hemoglobin A1c" not just "HbA1c")
- Numeric value with units
- Reference range from the report
- Status: "normal", "high", "low", or "critical" (based on reference range and clinical significance)

Also extract:
- Patient name and demographics if visible
- Ordering physician
- Date of collection and report date (MOST IMPORTANT - extract the exact date of the lab report in YYYY-MM-DD format)
- Any notes or comments from the lab
- Abnormal findings flagged in the report

Provide as JSON:
{"document_date": "YYYY-MM-DD", "lab_values": [{"test": "name", "value": number, "unit": "unit", "reference_range": "range", "status": "normal|high|low|critical"}], "findings": ["abnormal findings"], "summary": "key findings and clinical significance", "medications": [], "diagnoses": [], "recommendations": ["follow-up suggestions"]}""",
        
        "prescriptions": """You are a medical AI assistant analyzing a prescription document. Extract ALL medication prescriptions, including current medications, new prescriptions, and refills.

For each medication, extract:
- Full medication name (brand and generic if available)
- Dosage strength (e.g., "500mg", "10mg")
- Form (tablet, capsule, injection, etc.)
- Frequency (e.g., "twice daily", "once daily", "every 8 hours")
- Duration (if specified: "30 days", "until finished", etc.)
- Quantity prescribed
- Refills authorized
- Special instructions (take with food, avoid alcohol, etc.)

Also extract:
- Patient name
- Prescribing physician
- Date of prescription (MOST IMPORTANT - extract the exact date in YYYY-MM-DD format)
- Pharmacy information if present
- Diagnosis or reason for prescription if noted

Provide as JSON:
{"document_date": "YYYY-MM-DD", "medications": [{"name": "name", "dosage": "strength", "frequency": "how often", "duration": "how long", "quantity": "number", "refills": "number"}], "diagnoses": [{"condition": "diagnosis", "icd_code": "code if present"}], "summary": "overview of medications and purpose", "recommendations": []}""",
        
        "imaging": """You are a medical AI assistant analyzing a medical imaging report (X-ray, MRI, CT scan, ultrasound, mammogram, etc.). 

Extract:
- Type of imaging study performed
- Body part/exam area
- All findings, both normal and abnormal
- Technical quality of the images
- Comparison with prior studies if mentioned
- Any incidental findings

For each finding, provide:
- Description of what was observed
- Clinical significance
- Whether it's acute or chronic
- Any recommendations for additional studies or follow-up

Also extract:
- Patient demographics
- Ordering physician
- Date of exam (MOST IMPORTANT - extract the exact date in YYYY-MM-DD format)
- Radiologist name
- Impression/conclusion section

Provide as JSON:
{"document_date": "YYYY-MM-DD", "findings": [{"description": "finding", "significance": "significant or incidental", "recommendation": "follow-up if any"}], "diagnoses": [], "summary": "overall impression and clinical correlation", "recommendations": ["additional studies or follow-up"]}""",
        
        "vaccination_records": """You are a medical AI assistant analyzing a vaccination/immunization record.

Extract:
- All vaccines administered with dates
- Vaccine lot numbers and manufacturers
- Administration site and route
- Any adverse reactions noted
- Next due dates for boosters
- Vaccine type (influenza, COVID, tetanus, etc.)

Provide as JSON:
{"document_date": "YYYY-MM-DD", "vaccinations": [{"vaccine": "name", "date": "YYYY-MM-DD", "lot": "number", "site": "location", "reaction": "any adverse reaction"}], "summary": "vaccination status overview", "recommendations": ["upcoming vaccines due"]}""",
        
        "discharge_summaries": """You are a medical AI assistant analyzing a hospital discharge summary.

Extract:
- Admission date and reason (MOST IMPORTANT - extract exact date in YYYY-MM-DD format)
- Discharge date and disposition
- Diagnoses (primary and secondary)
- Procedures performed
- Medications at discharge
- Follow-up instructions
- Patient education provided

Provide as JSON:
{"document_date": "YYYY-MM-DD", "diagnoses": [{"condition": "diagnosis", "icd_code": "code", "status": "primary|secondary"}], "procedures": ["list of procedures"], "medications": [{"name": "med", "dosage": "dose"}], "summary": "hospital course summary", "recommendations": ["follow-up instructions"]}""",
        
        "insurance_documents": """You are a medical AI assistant analyzing an insurance document (EOB, claim, etc.).

Extract:
- Provider information
- Patient information
- Services rendered with dates (MOST IMPORTANT - extract exact date in YYYY-MM-DD format)
- Billed amounts
- Covered amounts
- Patient responsibility
- Denial codes if any

Provide as JSON:
{"document_date": "YYYY-MM-DD", "provider": {"name": "name", "address": "address"}, "services": [{"code": "CPT code", "description": "service", "billed": amount, "covered": amount}], "summary": "claim overview", "recommendations": []}"""
    }
    return prompts.get(category, prompts["lab_results"])

async def analyze_with_openai(content: str, category: str, is_image: bool = False) -> dict:
    model = getattr(settings, 'OPENAI_MODEL', 'gpt-4o-mini')
    logger.info(f"[ANALYSIS] Calling OpenAI API - model: {model}, category: {category}, is_image: {is_image}")
    
    try:
        if is_image:
            logger.info(f"[ANALYSIS] Sending image(s) to OpenAI for analysis...")
            if isinstance(content, list):
                image_messages = [{"type": "text", "text": f"Analyze all {len(content)} pages of this medical document. Extract all information from each page and provide a comprehensive structured output."}]
                for img_data in content:
                    image_messages.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_data}"}})
                
                response = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": get_category_prompt(category)},
                        {"role": "user", "content": image_messages}
                    ],
                    response_format={"type": "json_object"}
                )
            else:
                response = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": get_category_prompt(category)},
                        {"role": "user", "content": [
                            {"type": "text", "text": "Extract medical data from this image:"},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{content}"}}
                        ]}
                    ],
                    response_format={"type": "json_object"}
                )
        else:
            logger.info(f"[ANALYSIS] Sending text to OpenAI for analysis...")
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": get_category_prompt(category)},
                    {"role": "user", "content": f"Extract medical data from this text:\n\n{content}"}
                ],
                response_format={"type": "json_object"}
            )
        
        # Capture usage for tracking
        global last_usage
        last_usage = response.usage.model_dump() if response.usage else {}
        logger.info(f"[ANALYSIS] OpenAI API call successful - tokens used: prompt={last_usage.get('prompt_tokens', 0)}, completion={last_usage.get('completion_tokens', 0)}")
        
        try:
            result = json.loads(response.choices[0].message.content)
            logger.info(f"[ANALYSIS] Parsed OpenAI response - keys: {list(result.keys())}")
            logger.info(f"[ANALYSIS] Analysis result summary: {result.get('summary', 'N/A')[:100]}")
            return result
        except Exception as e:
            logger.error(f"[ANALYSIS] Failed to parse OpenAI response: {e}")
            return {"lab_values": [], "findings": [], "summary": "Analysis failed", "medications": [], "diagnoses": []}
    except Exception as e:
        logger.error(f"[ANALYSIS] OpenAI API call failed: {e}", exc_info=True)
        return {"lab_values": [], "findings": [f"OpenAI API error: {str(e)}"], "summary": "Analysis failed", "medications": [], "diagnoses": []}

async def analyze_document(file_path, category: str, user_id: str, document_id: str, db=None) -> dict:
    logger.info(f"[ANALYSIS] Starting document analysis - document_id: {document_id}, user_id: {user_id}, category: {category}")
    logger.info(f"[ANALYSIS] File path: {file_path}")
    
    # Ensure file_path is a string
    file_path_str = str(file_path)
    
    # Check if OpenAI API key is configured
    if not client.api_key or client.api_key == "your_openai_api_key_here" or not client.api_key.strip():
        logger.warning(f"[ANALYSIS] OpenAI API key not configured, skipping analysis for document: {document_id}")
        return {
            "lab_values": [],
            "findings": ["OpenAI API key not configured"],
            "summary": "Analysis skipped - API key missing",
            "medications": [],
            "diagnoses": []
        }
    
    logger.info(f"[ANALYSIS] OpenAI API key configured, proceeding with analysis")
    
    # Determine if image or PDF
    is_image = file_path_str.lower().endswith(('.jpg', '.jpeg', '.png'))
    logger.info(f"[ANALYSIS] File type detection - is_image: {is_image}")
    
    if is_image:
        logger.info(f"[ANALYSIS] Processing image file...")
        content = encode_image_to_base64(file_path_str)
        analysis_data = await analyze_with_openai(content, category, is_image=True)
    else:
        logger.info(f"[ANALYSIS] Converting PDF to images...")
        images = convert_pdf_to_images(file_path_str)
        if images:
            logger.info(f"[ANALYSIS] Converted PDF to {len(images)} images, processing with OpenAI...")
            analysis_data = await analyze_with_openai(images, category, is_image=True)
        else:
            logger.warning(f"[ANALYSIS] Failed to convert PDF to images, falling back to text extraction...")
            text = extract_text_from_pdf(file_path_str)
            if not text:
                text = "Unable to extract text from PDF"
                logger.warning(f"[ANALYSIS] No text extracted from PDF")
            analysis_data = await analyze_with_openai(text, category, is_image=False)
    
    logger.info(f"[ANALYSIS] Analysis data received - summary: {analysis_data.get('summary', 'N/A')[:100]}")
    logger.info(f"[ANALYSIS] Extracted {len(analysis_data.get('lab_values', []))} lab values, {len(analysis_data.get('medications', []))} medications, {len(analysis_data.get('diagnoses', []))} diagnoses")
    
    normalized_lab_values = normalize_lab_display_names(analysis_data.get("lab_values", []))
    
    # Extract document_date from analysis and update document record
    document_date_str = analysis_data.get("document_date")
    if document_date_str and db is not None:
        try:
            from datetime import datetime
            # Try to parse the date (expecting YYYY-MM-DD format from OpenAI)
            parsed_date = datetime.strptime(document_date_str, "%Y-%m-%d")
            # Update the document's document_date in MongoDB
            from bson import ObjectId
            await db.documents.update_one(
                {"_id": ObjectId(document_id)},
                {"$set": {"document_date": parsed_date}}
            )
            logger.info(f"[ANALYSIS] Updated document_date to {parsed_date} for document {document_id}")
        except Exception as e:
            logger.warning(f"[ANALYSIS] Failed to parse or update document_date: {e}")
    
    # Log token usage to MongoDB
    global last_usage
    if db is not None and last_usage:
        from app.services.token_tracker import log_usage_to_db
        await log_usage_to_db(db, user_id, last_usage, category)
        logger.info(f"[ANALYSIS] Token usage logged successfully")
    
    # Build chatbot context
    logger.info(f"[ANALYSIS] Building chatbot context...")
    chatbot_context = {
        "key_facts": [],
        "medical_history_summary": analysis_data.get("summary", ""),
        "current_medications_summary": ", ".join([m.get("name", "") for m in analysis_data.get("medications", [])]),
        "allergies": [],
        "surgical_history": []
    }
    
    # Add key facts
    for lab in normalized_lab_values:
        status = lab.get("status", "normal")
        display_name = lab.get("display_name", lab.get("test", "Unknown"))
        chatbot_context["key_facts"].append(f"{display_name}: {lab['value']} {lab.get('unit', '')} ({status})")
    
    for med in analysis_data.get("medications", []):
        chatbot_context["key_facts"].append(f"Medication: {med.get('name')} {med.get('dosage', '')}")
    
    logger.info(f"[ANALYSIS] Chatbot context built with {len(chatbot_context['key_facts'])} key facts")
    
    # Risk assessment (simple rule-based)
    risk_factors = []
    predicted_conditions = []
    
    for lab in normalized_lab_values:
        display_name = lab.get("display_name", lab.get("test", "Unknown"))
        if lab.get("status") == "high":
            risk_factors.append(f"Elevated {display_name}")
        elif lab.get("status") == "low":
            risk_factors.append(f"Low {display_name}")
    
    logger.info(f"[ANALYSIS] Risk assessment complete - {len(risk_factors)} risk factors identified")

    result = {
        "document_id": document_id,
        "user_id": user_id,
        "analysis_date": datetime.utcnow(),
        "document_date": document_date_str if document_date_str else None,
        "category": category,
        "extracted_data": {
            **analysis_data,
            "lab_values": normalized_lab_values
        },
        "chatbot_context": chatbot_context,
        "risk_assessment": {
            "risk_factors": risk_factors,
            "predicted_conditions": predicted_conditions
        }
    }
    
    logger.info(f"[ANALYSIS] Document analysis completed successfully for document: {document_id}")
    return result

async def save_analysis_result(db, analysis_data: dict) -> str:
    logger.info(f"[ANALYSIS] Saving analysis result to MongoDB - document_id: {analysis_data.get('document_id')}")
    result = await db.analysis_results.insert_one(analysis_data)
    analysis_id = str(result.inserted_id)
    logger.info(f"[ANALYSIS] Analysis result saved with ID: {analysis_id}")
    return analysis_id

async def generate_chunks_from_analysis(analysis_data: dict) -> List[dict]:
    chunks = []
    user_id = analysis_data.get("user_id")
    document_id = analysis_data.get("document_id")
    extracted = analysis_data.get("extracted_data", {})
    
    labs = extracted.get("lab_values", [])
    if labs:
        labs_content = "Lab Results: " + "; ".join([
            f"{lab.get('test', 'Unknown')}: {lab.get('value', 'N/A')} {lab.get('unit', '')} ({lab.get('status', 'normal')})"
            for lab in labs
        ])
        chunks.append({
            "user_id": user_id,
            "document_id": document_id,
            "chunk_type": "labs",
            "content": labs_content
        })
    
    medications = extracted.get("medications", [])
    if medications:
        meds_content = "Medications: " + "; ".join([
            f"{med.get('name', 'Unknown')}" + (f" {med.get('dosage', '')}" if med.get('dosage') else "")
            for med in medications
        ])
        chunks.append({
            "user_id": user_id,
            "document_id": document_id,
            "chunk_type": "medications",
            "content": meds_content
        })
    
    diagnoses = extracted.get("diagnoses", [])
    if diagnoses:
        diag_content = "Diagnoses: " + "; ".join([
            f"{d.get('condition', 'Unknown')}" + (f" ({d.get('icd_code', '')})" if d.get('icd_code') else "")
            for d in diagnoses
        ])
        chunks.append({
            "user_id": user_id,
            "document_id": document_id,
            "chunk_type": "diagnoses",
            "content": diag_content
        })
    
    findings = extracted.get("findings", [])
    if findings:
        findings_content = "Findings: " + "; ".join(findings)
        chunks.append({
            "user_id": user_id,
            "document_id": document_id,
            "chunk_type": "findings",
            "content": findings_content
        })
    
    vitals = extracted.get("vitals")
    if vitals:
        vitals_parts = []
        if vitals.get("blood_pressure"):
            vitals_parts.append(f"BP: {vitals['blood_pressure']}")
        if vitals.get("heart_rate"):
            vitals_parts.append(f"HR: {vitals['heart_rate']} bpm")
        if vitals.get("weight"):
            vitals_parts.append(f"Weight: {vitals['weight']} kg")
        if vitals.get("bmi"):
            vitals_parts.append(f"BMI: {vitals['bmi']}")
        if vitals_parts:
            chunks.append({
                "user_id": user_id,
                "document_id": document_id,
                "chunk_type": "vitals",
                "content": "Vitals: " + ", ".join(vitals_parts)
            })
    
    logger.info(f"[ANALYSIS] Generated {len(chunks)} chunks for document {document_id}")
    return chunks

async def save_document_chunks(db, chunks: List[dict]):
    if not chunks:
        return
    
    try:
        from app.services.embeddings import embed_texts
        
        contents = [chunk["content"] for chunk in chunks]
        embeddings = await embed_texts(contents)
        
        for i, chunk in enumerate(chunks):
            chunk["embedding"] = embeddings[i]
            chunk["created_at"] = datetime.utcnow()
        
        await db.document_chunks.insert_many(chunks)
        logger.info(f"[ANALYSIS] Saved {len(chunks)} chunks with embeddings")
    except Exception as e:
        logger.error(f"[ANALYSIS] Failed to save chunks: {e}", exc_info=True)

async def get_user_chunks(db, user_id: str) -> List[dict]:
    cursor = db.document_chunks.find({"user_id": user_id})
    chunks = []
    async for chunk in cursor:
        chunks.append(chunk)
    return chunks

async def get_analysis_for_document(db, document_id: str):
    logger.info(f"[ANALYSIS] Fetching analysis for document_id: {document_id}")
    result = await db.analysis_results.find_one({"document_id": document_id})
    if result is not None:
        logger.info(f"[ANALYSIS] Found analysis result for document: {document_id}")
    else:
        logger.warning(f"[ANALYSIS] No analysis found for document: {document_id}")
    return result

async def get_user_analyses(db, user_id: str, category: str = None):
    logger.info(f"[ANALYSIS] Fetching analyses for user_id: {user_id}, category filter: {category}")
    query = {"user_id": user_id}
    if category:
        query["category"] = category
    cursor = db.analysis_results.find(query).sort("document_date", -1)
    analyses = []
    async for doc in cursor:
        analyses.append({
            "id": str(doc["_id"]),
            **{k: v for k, v in doc.items() if k != "_id"}
        })
    logger.info(f"[ANALYSIS] Found {len(analyses)} analyses for user: {user_id}")
    return analyses

async def generate_doctor_questions(db, user_id: str, user_profile: dict = None) -> list:
    logger.info(f"[ANALYSIS] Generating doctor questions for user: {user_id}")
    analyses = await get_user_analyses(db, user_id)
    questions = []
    
    for analysis in analyses[:5]:  # Last 5 analyses
        for lab in analysis.get("extracted_data", {}).get("lab_values", []):
            if lab.get("status") in ["high", "low"]:
                questions.append(f"My {lab['test']} is {lab['value']} {lab.get('unit', '')}, which is {lab['status']}. Should we adjust my treatment?")
        
        if analysis.get("extracted_data", {}).get("diagnoses"):
            questions.append("Based on my recent results, do I need any medication adjustments?")
    
    # Add profile-based questions
    if user_profile:
        age = user_profile.get("age")
        gender = user_profile.get("gender")
        medical_conditions = user_profile.get("medical_conditions", [])
        
        if age:
            if age < 30:
                questions.append("What preventive screenings should I consider at my age?")
            elif age >= 50:
                questions.append("Are there any age-specific health screenings I should schedule?")
        
        if gender == "female":
            questions.append("Should I schedule a mammogram or Pap smear?")
        elif gender == "male":
            questions.append("Should I have a prostate screening exam?")
        
        if medical_conditions:
            for condition in medical_conditions:
                questions.append(f"What lifestyle changes can help manage my {condition}?")
    
    if not questions:
        questions.append("Should I schedule any follow-up tests based on my recent results?")
    
    unique_questions = list(set(questions))[:10]  # Unique questions, max 10
    logger.info(f"[ANALYSIS] Generated {len(unique_questions)} doctor questions")
    return unique_questions

async def build_chatbot_context(db, user_id: str, message: str = "") -> tuple:
    logger.info(f"[ANALYSIS] Building chatbot context for user: {user_id}")
    
    context_parts = []
    sources = []
    
    chunks = await get_user_chunks(db, user_id)
    
    if chunks and message:
        try:
            from app.services.embeddings import embed_text, find_similar_chunks
            from app.services.reranker import rerank_chunks
            
            logger.info(f"[ANALYSIS] Using semantic search with {len(chunks)} chunks")
            
            query_embedding = await embed_text(message)
            similar_chunks = await find_similar_chunks(query_embedding, chunks, top_k=20)
            
            if similar_chunks:
                reranked_chunks = await rerank_chunks(message, similar_chunks, top_k=5)
                
                logger.info(f"[ANALYSIS] Semantic search: {len(similar_chunks)} similar, {len(reranked_chunks)} after reranking")
                
                for chunk in reranked_chunks:
                    chunk_type = chunk.get("chunk_type", "unknown")
                    doc_id = chunk.get("document_id", "")
                    
                    content = chunk.get("content", "")
                    if content:
                        context_parts.append(f"[{chunk_type.upper()}] {content}")
                    
                    if doc_id and doc_id not in [s.get("doc_id") for s in sources]:
                        doc = await db.documents.find_one({"_id": doc_id})
                        if doc:
                            sources.append({
                                "doc_id": doc_id,
                                "doc_name": doc.get("original_name", "Unknown"),
                                "category": doc.get("category", "unknown"),
                                "analyzed": True
                            })
        except Exception as e:
            logger.warning(f"[ANALYSIS] Semantic search failed, falling back to traditional: {e}")
            chunks = []
    
    if not context_parts:
        cursor = db.documents.find({"user_id": user_id}).sort("upload_date", -1)
        async for doc in cursor:
            doc_info = {
                "id": str(doc["_id"]),
                "name": doc.get("original_name", "Unknown"),
                "category": doc.get("category", "unknown"),
                "document_date": doc.get("document_date", str(doc.get("upload_date", ""))[:10]),
                "upload_date": str(doc.get("upload_date", ""))[:10]
            }
            
            analysis = await db.analysis_results.find_one({"document_id": doc_info["id"]})
            
            if analysis and analysis.get("extracted_data"):
                extracted = analysis["extracted_data"]
                
                lab_values = extracted.get("lab_values", [])
                if lab_values:
                    lab_text = f"Lab Results from {doc_info['document_date']}:\n"
                    for lab in lab_values[:20]:
                        lab_text += f"  - {lab.get('test', 'Unknown')}: {lab.get('value', 'N/A')} {lab.get('unit', '')} ({(lab.get('status') or 'unknown').upper()})\n"
                    context_parts.append(lab_text)
                
                medications = extracted.get("medications", [])
                if medications:
                    med_text = f"Medications from {doc_info['document_date']}:\n"
                    for med in medications:
                        med_text += f"  - {med.get('name', 'Unknown')}: {med.get('dosage', 'N/A')} ({med.get('frequency', 'N/A')})\n"
                    context_parts.append(med_text)
                
                diagnoses = extracted.get("diagnoses", [])
                if diagnoses:
                    diag_text = f"Diagnoses from {doc_info['document_date']}:\n"
                    for diag in diagnoses:
                        diag_text += f"  - {diag.get('condition', 'Unknown')}\n"
                    context_parts.append(diag_text)
                
                findings = extracted.get("findings", [])
                if findings:
                    findings_text = f"Findings from {doc_info['document_date']} ({doc_info['category']}):\n"
                    for finding in findings[:10]:
                        if isinstance(finding, dict):
                            findings_text += f"  - {finding.get('description', str(finding))}\n"
                        else:
                            findings_text += f"  - {finding}\n"
                    context_parts.append(findings_text)
                
                vaccinations = extracted.get("vaccinations", [])
                if vaccinations:
                    vac_text = f"Vaccinations from {doc_info['document_date']}:\n"
                    for vac in vaccinations:
                        vac_text += f"  - {vac.get('vaccine', 'Unknown')} ({vac.get('date', 'N/A')})\n"
                    context_parts.append(vac_text)
                
                sources.append({"doc_id": doc_info["id"], "doc_name": doc_info["name"], "category": doc_info["category"], "analyzed": True})
            else:
                context_parts.append(f"Document: {doc_info['name']} (Category: {doc_info['category']}, Date: {doc_info['document_date']}) - Not yet analyzed")
                sources.append({"doc_id": doc_info["id"], "doc_name": doc_info["name"], "category": doc_info["category"], "analyzed": False})
    
    # Get health predictions from summary
    try:
        from app.services.comparison import calculate_health_score, get_active_conditions, predict_conditions
        analyses = await get_user_analyses(db, user_id)
        if analyses:
            health_score = calculate_health_score(analyses)
            active_conditions = get_active_conditions(analyses)
            predictions = predict_conditions(analyses)
            
            context_parts.append(f"Overall Health Score: {health_score}/100")
            if active_conditions:
                context_parts.append(f"Active Conditions: {', '.join(active_conditions)}")
            if predictions:
                pred_text = "Health Predictions:\n"
                for p in predictions[:5]:
                    pred_text += f"  - {p.get('condition', 'Unknown')}: {int(p.get('probability', 0) * 100)}% probability\n"
                context_parts.append(pred_text)
    except Exception as e:
        logger.warning(f"[ANALYSIS] Could not add health predictions to context: {e}")
    
    context = "\n\n".join(context_parts)
    logger.info(f"[ANALYSIS] Built context with {len(context_parts)} parts, {len(sources)} sources")
    return context, sources

async def chat_with_medical_advisor(db, user_id: str, message: str) -> dict:
    logger.info(f"[ANALYSIS] Processing chat message from user: {user_id}")
    
    # Build context from user's documents
    context, sources = await build_chatbot_context(db, user_id, message)
    
    # Get user profile for additional context
    from bson import ObjectId
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    profile_info = ""
    if user:
        profile_parts = []
        if user.get("age"):
            profile_parts.append(f"Age: {user['age']}")
        if user.get("gender"):
            profile_parts.append(f"Gender: {user['gender']}")
        if user.get("blood_type"):
            profile_parts.append(f"Blood Type: {user['blood_type']}")
        if user.get("height"):
            profile_parts.append(f"Height: {user['height']} cm")
        if user.get("weight"):
            profile_parts.append(f"Weight: {user['weight']} kg")
        if user.get("medical_conditions"):
            profile_parts.append(f"Medical Conditions: {', '.join(user['medical_conditions'])}")
        if user.get("allergies"):
            profile_parts.append(f"Allergies: {', '.join(user['allergies'])}")
        if profile_parts:
            profile_info = "User Profile:\n" + "\n".join(profile_parts) + "\n\n"
    
    if not context:
        context = "No medical documents have been uploaded yet."
    
    # Build the prompt with user profile
    system_prompt = f"""You are HealthSync, a knowledgeable and empathetic medical health assistant with clinical reasoning capabilities. You MUST follow these rules strictly:

RULES:
1. CLINICAL REASONING: For each abnormal lab value, explain the clinical significance - why this value matters, what it could indicate, and how it relates to the user's known conditions.
2. Use actual lab values from the provided documents. Give specific numbers with reference ranges, not generic information.
3. For each metric, include: what the value means, whether it's normal/abnormal, and what clinical actions to consider.
4. Format responses with: Brief Summary, Clinical Findings (explain WHY values matter), Specific Recommendations, When to Consult a Provider.
5. If a metric is out of range, explain the pathophysiology - what this could mean for their health.
6. EMPATHETIC COMMUNICATION: Acknowledge concerns empathetically. Use phrases like "I understand this may be concerning" or "It's normal to feel concerned about..."
7. Never be vague. Provide specific numbers, reference ranges, and actionable next steps.
8. Reference the user's actual values, conditions, and medications from their documents.
9. Consider their age, gender, and existing conditions when giving advice.
10. You ARE allowed and ENCOURAGED to give health advice based on the provided documents.
11. If discussing a condition, explain it in the context of their own lab results and trends.
12. End every response with: "Consult your healthcare provider for personalized medical advice. This information is for educational purposes only and does not replace professional medical care."

IMPORTANT: Do not say "I don't have enough information" - you have access to their medical data. Use it to give specific, clinically relevant advice.

Keep responses concise but informative (max 350 words). Use markdown formatting with bullet points and clear sections.

{profile_info}The user's relevant medical data:
""" + context

    try:
        response = client.chat.completions.create(
            model=getattr(settings, 'OPENAI_MODEL', 'gpt-4o-mini'),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ],
            max_tokens=1200
        )
        
        # Track usage
        global last_usage
        last_usage = response.usage.model_dump() if response.usage else {}
        
        bot_response = response.choices[0].message.content
        logger.info(f"[ANALYSIS] Chat response generated, {len(bot_response)} characters")
        
        return {
            "response": bot_response,
            "sources": sources
        }
    except Exception as e:
        logger.error(f"[ANALYSIS] Chat API error: {e}", exc_info=True)
        return {
            "response": "I apologize, but I'm having trouble processing your request right now. Please try again or consult your healthcare provider for medical questions.",
            "sources": sources
        }
