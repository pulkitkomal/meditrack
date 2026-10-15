import asyncio
import logging

from app.utils.age import user_age
from app.config import settings
from app.services.analysis import client, get_user_analyses, get_user_chunks

logger = logging.getLogger("medical-records-app")

async def generate_doctor_questions(db, user_id: str, user_profile: dict = None) -> list:
    logger.info(f"[ANALYSIS] Generating doctor questions for user: {user_id}")
    analyses = await get_user_analyses(db, user_id)
    questions = []
    seen_tests = set()
    
    for analysis in analyses[:5]:  # Last 5 analyses, newest first
        for lab in analysis.get("extracted_data", {}).get("lab_values", []):
            name = lab.get("display_name") or lab.get("test", "")
            if name.lower() in seen_tests:
                continue
            seen_tests.add(name.lower())
            if lab.get("status") in ["high", "low", "critical"]:
                questions.append(f"My {name} is {lab['value']} {lab.get('unit', '')}, which is {lab['status']}. Should we adjust my treatment?")
        
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
    
    unique_questions = list(dict.fromkeys(questions))[:10]
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
        if user_age(user):
            profile_parts.append(f"Age: {user_age(user)}")
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
        model = getattr(settings, 'OPENAI_MODEL', 'gpt-4o-mini')
        response = await asyncio.to_thread(
            client.chat.completions.create,
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ],
            max_tokens=1200
        )
        
        if response.usage:
            from app.services.token_tracker import log_usage_to_db
            await log_usage_to_db(db, user_id, response.usage.model_dump(), "chat", model)
        
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
