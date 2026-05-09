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

LAB_WEIGHTS = {
    # Critical tests - higher weight
    "hba1c": {"high": 15, "low": 10, "critical": 25, "name": "HbA1c"},
    "glucose": {"high": 12, "low": 8, "critical": 20, "name": "Blood Glucose"},
    "fasting glucose": {"high": 12, "low": 8, "critical": 20, "name": "Fasting Glucose"},
    "creatinine": {"high": 15, "low": 8, "critical": 25, "name": "Creatinine"},
    "egfr": {"high": 5, "low": 15, "critical": 25, "name": "eGFR"},
    "bun": {"high": 10, "low": 5, "critical": 15, "name": "BUN"},
    
    # Important tests - medium weight
    "cholesterol": {"high": 8, "low": 3, "critical": 12, "name": "Cholesterol"},
    "ldl": {"high": 10, "low": 3, "critical": 15, "name": "LDL"},
    "hdl": {"high": 3, "low": 10, "critical": 15, "name": "HDL"},
    "triglycerides": {"high": 8, "low": 3, "critical": 12, "name": "Triglycerides"},
    "tsh": {"high": 8, "low": 8, "critical": 12, "name": "TSH"},
    "hemoglobin": {"high": 5, "low": 12, "critical": 20, "name": "Hemoglobin"},
    "hb": {"high": 5, "low": 12, "critical": 20, "name": "Hb"},
    "sodium": {"high": 8, "low": 10, "critical": 15, "name": "Sodium"},
    "potassium": {"high": 10, "low": 10, "critical": 15, "name": "Potassium"},
    
    # Other tests - lower weight
    "alt": {"high": 6, "low": 2, "critical": 10, "name": "ALT"},
    "ast": {"high": 6, "low": 2, "critical": 10, "name": "AST"},
    "bilirubin": {"high": 5, "low": 2, "critical": 8, "name": "Bilirubin"},
    "albumin": {"high": 3, "low": 5, "critical": 8, "name": "Albumin"},
    "wbc": {"high": 4, "low": 5, "critical": 8, "name": "WBC"},
    "rbc": {"high": 3, "low": 5, "critical": 8, "name": "RBC"},
    "platelets": {"high": 3, "low": 5, "critical": 8, "name": "Platelets"},
    "uric acid": {"high": 5, "low": 3, "critical": 8, "name": "Uric Acid"},
}

def calculate_health_score(analyses: List[Dict[str, Any]], user_conditions: List[str] = None) -> float:
    logger.info(f"[COMPARISON] Calculating health score - number of analyses: {len(analyses)}")
    score = 100.0
    
    if not analyses:
        logger.info(f"[COMPARISON] No analyses available, returning default score: {score}")
        return score
    
    # Get lab values from the most recent analysis with data
    latest_with_labs = None
    for analysis in analyses:
        lab_values = analysis.get("extracted_data", {}).get("lab_values", [])
        if lab_values:
            latest_with_labs = analysis
            break
    
    if not latest_with_labs:
        logger.info(f"[COMPARISON] No analysis with lab values found")
        return score
    
    lab_values = latest_with_labs.get("extracted_data", {}).get("lab_values", [])
    logger.info(f"[COMPARISON] Latest analysis has {len(lab_values)} lab values")
    
    # Create lookup for lab values
    lab_dict = {lab.get("test", "").lower(): lab for lab in lab_values}
    
    # Calculate deductions based on specific lab tests
    total_deduction = 0
    affected_tests = []
    
    for test_name, weights in LAB_WEIGHTS.items():
        if test_name in lab_dict:
            lab = lab_dict[test_name]
            status = lab.get("status", "normal")
            test_display = lab.get("test", weights.get("name", test_name))
            
            if status == "critical":
                deduction = weights.get("critical", 15)
                affected_tests.append(f"{test_display} (critical)")
            elif status == "high":
                deduction = weights.get("high", 8)
                affected_tests.append(f"{test_display} (high)")
            elif status == "low":
                deduction = weights.get("low", 8)
                affected_tests.append(f"{test_display} (low)")
            
            if deduction:
                total_deduction += deduction
                logger.info(f"[COMPARISON] {test_display}: {status}, deduct {deduction}")
    
    score -= total_deduction
    
    # Check for trends - if multiple recent analyses show worsening, deduct more
    if len(analyses) >= 2:
        trend_deduction = 0
        for test_name in ["hba1c", "glucose", "cholesterol", "creatinine"]:
            if test_name in lab_dict:
                current = lab_dict[test_name].get("value", 0)
                # Check previous analysis
                prev_labs = analyses[1].get("extracted_data", {}).get("lab_values", [])
                prev_dict = {l.get("test", "").lower(): l for l in prev_labs}
                if test_name in prev_dict:
                    prev_value = prev_dict[test_name].get("value", 0)
                    if prev_value > 0:
                        # Worsening trend
                        if current > prev_value * 1.1:  # 10% increase
                            trend_deduction += 5
                            logger.info(f"[COMPARISON] Worsening trend for {test_name}: {prev_value} -> {current}")
        
        score -= trend_deduction
        logger.info(f"[COMPARISON] Trend deduction: {trend_deduction}")
    
    # Factor in user conditions if provided
    if user_conditions and len(user_conditions) > 0:
        condition_penalty = min(len(user_conditions) * 3, 15)  # Max 15 points
        score -= condition_penalty
        logger.info(f"[COMPARISON] Condition penalty: {condition_penalty} for {len(user_conditions)} conditions")
    
    # Risk factors
    risk_factors = latest_with_labs.get("risk_assessment", {}).get("risk_factors", [])
    score -= len(risk_factors) * 2
    logger.info(f"[COMPARISON] Risk factor deduction: {len(risk_factors) * 2}")
    
    # Active diagnoses
    diagnoses = latest_with_labs.get("extracted_data", {}).get("diagnoses", [])
    active_conditions_count = sum(1 for d in diagnoses if d.get("status") == "active")
    score -= active_conditions_count * 8
    logger.info(f"[COMPARISON] Active conditions deduction: {active_conditions_count * 8}")
    
    final_score = max(0, min(100, score))
    logger.info(f"[COMPARISON] Final health score: {final_score}, affected tests: {affected_tests[:5]}")
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

KEY_METRICS_MAPPING = {
    # HbA1c variations
    "hba1c": {"display_name": "HbA1c", "category": "Diabetes", "priority": 1},
    "glycosylated hb": {"display_name": "HbA1c", "category": "Diabetes", "priority": 1},
    "glycosylated hemoglobin": {"display_name": "HbA1c", "category": "Diabetes", "priority": 1},
    "hba1c (gmi)": {"display_name": "HbA1c", "category": "Diabetes", "priority": 1},
    
    # Hemoglobin variations
    "hemoglobin": {"display_name": "Hemoglobin", "category": "Blood", "priority": 1},
    "hb": {"display_name": "Hemoglobin", "category": "Blood", "priority": 1},
    "hb-hemoglobin": {"display_name": "Hemoglobin", "category": "Blood", "priority": 1},
    
    # Glucose
    "glucose": {"display_name": "Glucose", "category": "Diabetes", "priority": 1},
    "fasting glucose": {"display_name": "Fasting Glucose", "category": "Diabetes", "priority": 1},
    "blood glucose": {"display_name": "Blood Glucose", "category": "Diabetes", "priority": 1},
    "random blood sugar": {"display_name": "Blood Sugar", "category": "Diabetes", "priority": 1},
    "rbs": {"display_name": "Blood Sugar", "category": "Diabetes", "priority": 1},
    
    # Kidney
    "creatinine": {"display_name": "Creatinine", "category": "Kidney", "priority": 1},
    "gfr estimated": {"display_name": "eGFR", "category": "Kidney", "priority": 1},
    "gfr": {"display_name": "eGFR", "category": "Kidney", "priority": 1},
    "urea": {"display_name": "Urea", "category": "Kidney", "priority": 2},
    "urea nitrogen blood": {"display_name": "BUN", "category": "Kidney", "priority": 2},
    "bun": {"display_name": "BUN", "category": "Kidney", "priority": 2},
    
    # Thyroid
    "tsh": {"display_name": "TSH", "category": "Thyroid", "priority": 1},
    "thyroxine": {"display_name": "T4", "category": "Thyroid", "priority": 2},
    "t4": {"display_name": "T4", "category": "Thyroid", "priority": 2},
    "triiodothyronine": {"display_name": "T3", "category": "Thyroid", "priority": 2},
    "t3": {"display_name": "T3", "category": "Thyroid", "priority": 2},
    
    # Cholesterol
    "cholesterol": {"display_name": "Cholesterol", "category": "Heart", "priority": 1},
    "total cholesterol": {"display_name": "Cholesterol", "category": "Heart", "priority": 1},
    "ldl": {"display_name": "LDL", "category": "Heart", "priority": 1},
    "hdl": {"display_name": "HDL", "category": "Heart", "priority": 1},
    "triglycerides": {"display_name": "Triglycerides", "category": "Heart", "priority": 2},
    
    # Other
    "uric acid": {"display_name": "Uric Acid", "category": "Metabolism", "priority": 2},
    "bilirubin": {"display_name": "Bilirubin", "category": "Liver", "priority": 2},
    "albumin": {"display_name": "Albumin", "category": "Liver", "priority": 2},
    "alt": {"display_name": "ALT", "category": "Liver", "priority": 2},
    "alt (sgpt)": {"display_name": "ALT", "category": "Liver", "priority": 2},
    "ast": {"display_name": "AST", "category": "Liver", "priority": 2},
    "ast (sgot)": {"display_name": "AST", "category": "Liver", "priority": 2},
    "wbc": {"display_name": "WBC", "category": "Blood", "priority": 2},
    "total leukocyte count": {"display_name": "WBC", "category": "Blood", "priority": 2},
    "rbc count": {"display_name": "RBC", "category": "Blood", "priority": 2},
    "rbc": {"display_name": "RBC", "category": "Blood", "priority": 2},
    "platelet count": {"display_name": "Platelets", "category": "Blood", "priority": 2},
    "platelets": {"display_name": "Platelets", "category": "Blood", "priority": 2},
    "electrolytes (na)": {"display_name": "Sodium", "category": "Electrolytes", "priority": 2},
    "sodium": {"display_name": "Sodium", "category": "Electrolytes", "priority": 2},
    "electrolytes (k)": {"display_name": "Potassium", "category": "Electrolytes", "priority": 2},
    "potassium": {"display_name": "Potassium", "category": "Electrolytes", "priority": 2},
    "ferritin": {"display_name": "Ferritin", "category": "Blood", "priority": 2},
    "iron": {"display_name": "Iron", "category": "Blood", "priority": 2},
    "calcium": {"display_name": "Calcium", "category": "Minerals", "priority": 2},
    "phosphorus": {"display_name": "Phosphorus", "category": "Minerals", "priority": 2},
}

def get_latest_key_metrics(analyses: List[Dict[str, Any]]) -> List[Dict]:
    logger.info(f"[COMPARISON] Extracting key metrics from {len(analyses)} analyses")
    metrics = []
    
    if not analyses:
        return metrics
    
    # Find the latest analysis that has lab values
    analysis_with_labs = None
    for analysis in analyses:
        lab_values = analysis.get("extracted_data", {}).get("lab_values", [])
        if lab_values and len(lab_values) >= 2:
            # Check if it has any numeric values that might match our metrics
            analysis_with_labs = analysis
            logger.info(f"[COMPARISON] Found analysis with {len(lab_values)} lab values")
            break
    
    if not analysis_with_labs:
        logger.info(f"[COMPARISON] No suitable analysis with lab values found")
        return metrics
    
    latest = analysis_with_labs
    lab_values = latest.get("extracted_data", {}).get("lab_values", [])
    
    lab_dict = {}
    for lab in lab_values:
        test_name_lower = lab.get("test", "").lower().strip()
        lab_dict[test_name_lower] = lab
    
    for test_lower, mapping in KEY_METRICS_MAPPING.items():
        if test_lower in lab_dict:
            lab = lab_dict[test_lower]
            metrics.append({
                "test": lab.get("test", mapping["display_name"]),
                "display_name": mapping["display_name"],
                "value": lab.get("value"),
                "unit": lab.get("unit", ""),
                "status": lab.get("status", "normal"),
                "category": mapping["category"],
                "priority": mapping["priority"],
                "reference_range": lab.get("reference_range", ""),
                "analysis_date": latest.get("analysis_date")
            })
    
    metrics.sort(key=lambda x: (x["priority"], x["category"]))
    logger.info(f"[COMPARISON] Found {len(metrics)} key metrics")
    return metrics
