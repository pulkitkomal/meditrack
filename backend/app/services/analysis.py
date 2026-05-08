import os
import json
import base64
import logging
from typing import Optional
from datetime import datetime
from openai import OpenAI
from app.config import settings
from app.models.analysis import AnalysisResult, ExtractedData, ChatbotContext, RiskAssessment

logger = logging.getLogger("medical-records-app")

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", settings.OPENAI_API_KEY if hasattr(settings, 'OPENAI_API_KEY') else ""))

# Store the last response usage for tracking
last_usage = None

def convert_pdf_to_images(file_path: str) -> list:
    logger.info(f"[ANALYSIS] Converting PDF to images: {file_path}")
    try:
        import pymupdf
        doc = pymupdf.open(file_path)
        images = []
        for page_num, page in enumerate(doc):
            pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2))
            img_data = pix.tobytes("png")
            images.append(base64.b64encode(img_data).decode('utf-8'))
            logger.info(f"[ANALYSIS] Converted page {page_num + 1}/{len(doc)} to image, size: {len(img_data)} bytes")
        logger.info(f"[ANALYSIS] Converted {len(images)} pages to images")
        return images
    except Exception as e:
        logger.error(f"[ANALYSIS] Failed to convert PDF to images: {e}", exc_info=True)
        return []

def extract_text_from_pdf(file_path: str) -> str:
    logger.info(f"[ANALYSIS] Extracting text from PDF: {file_path}")
    try:
        import pymupdf
        doc = pymupdf.open(file_path)
        text = ""
        for page in doc:
            text += page.get_text()
        logger.info(f"[ANALYSIS] Extracted {len(text)} characters from PDF with {len(doc)} pages")
        return text
    except Exception as e:
        logger.error(f"[ANALYSIS] Failed to extract text from PDF: {e}", exc_info=True)
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
- Date of collection and report date
- Any notes or comments from the lab
- Abnormal findings flagged in the report

Provide as JSON:
{"lab_values": [{"test": "name", "value": number, "unit": "unit", "reference_range": "range", "status": "normal|high|low|critical"}], "findings": ["abnormal findings"], "summary": "key findings and clinical significance", "medications": [], "diagnoses": [], "recommendations": ["follow-up suggestions"]}""",
        
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
- Date of prescription
- Pharmacy information if present
- Diagnosis or reason for prescription if noted

Provide as JSON:
{"medications": [{"name": "name", "dosage": "strength", "frequency": "how often", "duration": "how long", "quantity": "number", "refills": "number"}], "diagnoses": [{"condition": "diagnosis", "icd_code": "code if present"}], "summary": "overview of medications and purpose", "recommendations": []}""",
        
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
- Date of exam
- Radiologist name
- Impression/conclusion section

Provide as JSON:
{"findings": [{"description": "finding", "significance": "significant or incidental", "recommendation": "follow-up if any"}], "diagnoses": [], "summary": "overall impression and clinical correlation", "recommendations": ["additional studies or follow-up"]}""",
        
        "vaccination_records": """You are a medical AI assistant analyzing a vaccination/immunization record.

Extract:
- All vaccines administered with dates
- Vaccine lot numbers and manufacturers
- Administration site and route
- Any adverse reactions noted
- Next due dates for boosters
- Vaccine type (influenza, COVID, tetanus, etc.)

Provide as JSON:
{"vaccinations": [{"vaccine": "name", "date": "YYYY-MM-DD", "lot": "number", "site": "location", "reaction": "any adverse reaction"}], "summary": "vaccination status overview", "recommendations": ["upcoming vaccines due"]}""",
        
        "discharge_summaries": """You are a medical AI assistant analyzing a hospital discharge summary.

Extract:
- Admission date and reason
- Discharge date and disposition
- Diagnoses (primary and secondary)
- Procedures performed
- Medications at discharge
- Follow-up instructions
- Patient education provided

Provide as JSON:
{"diagnoses": [{"condition": "diagnosis", "icd_code": "code", "status": "primary|secondary"}], "procedures": ["list of procedures"], "medications": [{"name": "med", "dosage": "dose"}], "summary": "hospital course summary", "recommendations": ["follow-up instructions"]}""",
        
        "insurance_documents": """You are a medical AI assistant analyzing an insurance document (EOB, claim, etc.).

Extract:
- Provider information
- Patient information
- Services rendered with dates
- Billed amounts
- Covered amounts
- Patient responsibility
- Denial codes if any

Provide as JSON:
{"provider": {"name": "name", "address": "address"}, "services": [{"code": "CPT code", "description": "service", "billed": amount, "covered": amount}], "summary": "claim overview", "recommendations": []}"""
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
    for lab in analysis_data.get("lab_values", []):
        status = lab.get("status", "normal")
        chatbot_context["key_facts"].append(f"{lab['test']}: {lab['value']} {lab.get('unit', '')} ({status})")
    
    for med in analysis_data.get("medications", []):
        chatbot_context["key_facts"].append(f"Medication: {med.get('name')} {med.get('dosage', '')}")
    
    logger.info(f"[ANALYSIS] Chatbot context built with {len(chatbot_context['key_facts'])} key facts")
    
    # Risk assessment (simple rule-based)
    risk_factors = []
    predicted_conditions = []
    
    for lab in analysis_data.get("lab_values", []):
        if lab.get("status") == "high":
            risk_factors.append(f"Elevated {lab['test']}")
        elif lab.get("status") == "low":
            risk_factors.append(f"Low {lab['test']}")
    
    logger.info(f"[ANALYSIS] Risk assessment complete - {len(risk_factors)} risk factors identified")
    
    result = {
        "document_id": document_id,
        "user_id": user_id,
        "analysis_date": datetime.utcnow(),
        "category": category,
        "extracted_data": analysis_data,
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
    cursor = db.analysis_results.find(query).sort("analysis_date", -1)
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

async def build_chatbot_context(db, user_id: str) -> tuple:
    logger.info(f"[ANALYSIS] Building chatbot context for user: {user_id}")
    context_parts = []
    sources = []
    
    # Get all documents (both analyzed and not analyzed)
    cursor = db.documents.find({"user_id": user_id}).sort("upload_date", -1)
    async for doc in cursor:
        doc_info = {
            "id": str(doc["_id"]),
            "name": doc.get("original_name", "Unknown"),
            "category": doc.get("category", "unknown"),
            "document_date": doc.get("document_date", str(doc.get("upload_date", ""))[:10]),
            "upload_date": str(doc.get("upload_date", ""))[:10]
        }
        
        # Get analysis if available
        analysis = await db.analysis_results.find_one({"document_id": doc_info["id"]})
        
        if analysis and analysis.get("extracted_data"):
            extracted = analysis["extracted_data"]
            
            # Lab values
            lab_values = extracted.get("lab_values", [])
            if lab_values:
                lab_text = f"Lab Results from {doc_info['document_date']}:\n"
                for lab in lab_values[:20]:  # Limit to 20 to keep context manageable
                    lab_text += f"  - {lab.get('test', 'Unknown')}: {lab.get('value', 'N/A')} {lab.get('unit', '')} ({lab.get('status', 'unknown').upper()})\n"
                context_parts.append(lab_text)
            
            # Medications
            medications = extracted.get("medications", [])
            if medications:
                med_text = f"Medications from {doc_info['document_date']}:\n"
                for med in medications:
                    med_text += f"  - {med.get('name', 'Unknown')}: {med.get('dosage', 'N/A')} ({med.get('frequency', 'N/A')})\n"
                context_parts.append(med_text)
            
            # Diagnoses
            diagnoses = extracted.get("diagnoses", [])
            if diagnoses:
                diag_text = f"Diagnoses from {doc_info['document_date']}:\n"
                for diag in diagnoses:
                    diag_text += f"  - {diag.get('condition', 'Unknown')}\n"
                context_parts.append(diag_text)
            
            # Findings
            findings = extracted.get("findings", [])
            if findings:
                findings_text = f"Findings from {doc_info['document_date']} ({doc_info['category']}):\n"
                for finding in findings[:10]:
                    if isinstance(finding, dict):
                        findings_text += f"  - {finding.get('description', str(finding))}\n"
                    else:
                        findings_text += f"  - {finding}\n"
                context_parts.append(findings_text)
            
            # Vaccinations
            vaccinations = extracted.get("vaccinations", [])
            if vaccinations:
                vac_text = f"Vaccinations from {doc_info['document_date']}:\n"
                for vac in vaccinations:
                    vac_text += f"  - {vac.get('vaccine', 'Unknown')} ({vac.get('date', 'N/A')})\n"
                context_parts.append(vac_text)
            
            sources.append({"doc_id": doc_info["id"], "doc_name": doc_info["name"], "category": doc_info["category"], "analyzed": True})
        else:
            # Document not analyzed yet
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
    context, sources = await build_chatbot_context(db, user_id)
    
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
    system_prompt = f"""You are HealthSync, a helpful medical health assistant. The user has uploaded medical documents and may ask questions about their health data.

IMPORTANT RULES:
1. You are NOT a doctor - always recommend consulting a healthcare professional for medical decisions
2. Never provide specific medical diagnoses - only discuss what's in the documents
3. Never suggest changing medications without advising to consult a doctor first
4. If the user expresses concerning symptoms, encourage them to seek medical attention
5. Be helpful, clear, and compassionate
6. If you don't have enough information to answer, say so honestly
7. Take the user's age, gender, and medical conditions into account when providing responses

{profile_info}The user's medical data:
""" + context

    try:
        response = client.chat.completions.create(
            model=getattr(settings, 'OPENAI_MODEL', 'gpt-4o-mini'),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ],
            max_tokens=800
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
