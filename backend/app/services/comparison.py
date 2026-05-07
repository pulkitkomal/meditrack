import logging
from typing import List, Dict, Any
from datetime import datetime

logger = logging.getLogger("medical-records-app")

def compare_lab_values(current_analysis: Dict[str, Any], previous_analyses: List[Dict[str, Any]]) -> List[Dict]:
    logger.info(f"[COMPARISON] Comparing lab values - current analysis date: {current_analysis.get('analysis_date')}, previous analyses: {len(previous_analyses)}")
    trends = []
    current_labs = {lab["test"]: lab for lab in current_analysis.get("extracted_data", {}).get("lab_values", [])}
    logger.info(f"[COMPARISON] Current analysis has {len(current_labs)} lab values")
    
    for test_name, current_lab in current_labs.items():
        history = []
        for prev in previous_analyses:
            prev_labs = prev.get("extracted_data", {}).get("lab_values", [])
            for lab in prev_labs:
                if lab["test"] == test_name:
                    history.append({
                        "value": lab["value"],
                        "date": prev["analysis_date"],
                        "status": lab.get("status", "normal")
                    })
        
        trend = "stable"
        if len(history) >= 2:
            recent = history[0]["value"]
            older = history[-1]["value"]
            if current_lab["value"] > recent and current_lab["value"] > older:
                trend = "increasing"
            elif current_lab["value"] < recent and current_lab["value"] < older:
                trend = "decreasing"
        
        trends.append({
            "test": test_name,
            "current": current_lab["value"],
            "unit": current_lab.get("unit", ""),
            "status": current_lab.get("status", "normal"),
            "history": history[:5],  # Last 5 values
            "trend": trend
        })
    
    logger.info(f"[COMPARISON] Generated {len(trends)} trend entries")
    return trends

def calculate_health_score(analyses: List[Dict[str, Any]]) -> float:
    logger.info(f"[COMPARISON] Calculating health score - number of analyses: {len(analyses)}")
    score = 100.0
    
    if not analyses:
        logger.info(f"[COMPARISON] No analyses available, returning default score: {score}")
        return score
    
    latest = analyses[0]
    lab_values = latest.get("extracted_data", {}).get("lab_values", [])
    logger.info(f"[COMPARISON] Latest analysis has {len(lab_values)} lab values")
    
    # Deduct for abnormal values
    abnormal_count = sum(1 for lab in lab_values if lab.get("status") in ["high", "low"])
    score -= abnormal_count * 5
    logger.info(f"[COMPARISON] Deducted {abnormal_count * 5} for {abnormal_count} abnormal lab values")
    
    # Deduct for risk factors
    risk_factors = latest.get("risk_assessment", {}).get("risk_factors", [])
    score -= len(risk_factors) * 3
    logger.info(f"[COMPARISON] Deducted {len(risk_factors) * 3} for {len(risk_factors)} risk factors")
    
    # Deduct for active conditions
    diagnoses = latest.get("extracted_data", {}).get("diagnoses", [])
    active_conditions = [d for d in diagnoses if d.get("status") == "active"]
    score -= len(active_conditions) * 10
    logger.info(f"[COMPARISON] Deducted {len(active_conditions) * 10} for {len(active_conditions)} active conditions")
    
    final_score = max(0, min(100, score))
    logger.info(f"[COMPARISON] Final health score: {final_score}")
    return final_score

def get_active_conditions(analyses: List[Dict[str, Any]]) -> List[str]:
    logger.info(f"[COMPARISON] Getting active conditions from {len(analyses[:10])} analyses")
    conditions = set()
    for analysis in analyses[:10]:  # Last 10 analyses
        diagnoses = analysis.get("extracted_data", {}).get("diagnoses", [])
        for d in diagnoses:
            if d.get("status") == "active":
                conditions.add(d["condition"])
    logger.info(f"[COMPARISON] Found {len(conditions)} active conditions: {list(conditions)}")
    return list(conditions)

def predict_conditions(analyses: List[Dict[str, Any]]) -> List[Dict]:
    logger.info(f"[COMPARISON] Predicting conditions from {len(analyses)} analyses")
    predictions = []
    
    if not analyses:
        logger.info(f"[COMPARISON] No analyses available for predictions")
        return predictions
    
    latest = analyses[0]
    lab_values = latest.get("extracted_data", {}).get("lab_values", [])
    logger.info(f"[COMPARISON] Latest analysis has {len(lab_values)} lab values")
    
    # Simple rule-based predictions
    lab_dict = {lab["test"].lower(): lab for lab in lab_values}
    
    # Diabetes prediction
    if "hba1c" in lab_dict or "glucose" in lab_dict:
        hba1c = lab_dict.get("hba1c", {})
        glucose = lab_dict.get("glucose", {})
        if hba1c.get("value", 0) > 6.5 or glucose.get("value", 0) > 126:
            predictions.append({
                "condition": "Diabetes",
                "probability": 0.8,
                "reasoning": f"HbA1c: {hba1c.get('value')}%, Glucose: {glucose.get('value')} mg/dL"
            })
            logger.info(f"[COMPARISON] Diabetes prediction added - HbA1c: {hba1c.get('value')}, Glucose: {glucose.get('value')}")
    
    # Hypertension prediction
    vitals = latest.get("extracted_data", {}).get("vitals", {})
    bp = vitals.get("blood_pressure", "")
    if bp and any(x > 140 for x in [int(v) for v in bp.split('/') if v.isdigit()]):
        predictions.append({
            "condition": "Hypertension",
            "probability": 0.7,
            "reasoning": f"Blood pressure: {bp}"
        })
        logger.info(f"[COMPARISON] Hypertension prediction added - BP: {bp}")
    
    logger.info(f"[COMPARISON] Total predictions: {len(predictions)}")
    return predictions
