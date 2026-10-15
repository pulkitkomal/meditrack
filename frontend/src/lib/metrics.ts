import { parseRecordDate, parseTimestamp } from "./dates";

export type LabStatus = "normal" | "high" | "low" | "critical" | "abnormal";

export interface LabValue {
  test: string;
  value: number | string;
  unit?: string;
  status?: string;
  reference_range?: string;
}

export interface AnalysisRecord {
  id: string;
  document_id: string;
  category: string;
  title?: string | null;
  analysis_date: string;
  document_date?: string;
  extracted_data?: {
    summary?: string;
    lab_values?: LabValue[];
  };
}

export interface VitalRecord {
  id: string;
  type: string;
  value: number | string;
  unit: string;
  timestamp: string;
  systolic?: number;
  diastolic?: number;
}

export interface MetricPoint {
  value: number;
  display: string;
  unit: string;
  date: Date;
  status: LabStatus | null;
  sourceId: string;
  sourceType: "lab" | "vital";
}

export interface MetricSeries {
  name: string;
  points: MetricPoint[];
}

const DISEASE_METRICS: Record<string, string[]> = {
  diabetes: ["Blood Glucose", "HbA1c", "Fasting Glucose", "Total Cholesterol"],
  hypertension: ["Systolic BP", "Diastolic BP", "Sodium", "Potassium"],
  heart_disease: ["Total Cholesterol", "LDL", "HDL", "Triglycerides", "Systolic BP", "Diastolic BP"],
  thyroid_disorder: ["TSH", "T3", "T4"],
  kidney_disease: ["Creatinine", "eGFR", "BUN", "Albumin"],
  anemia: ["Hemoglobin", "RBC", "Iron", "Ferritin"],
  liver_disease: ["ALT", "AST", "Bilirubin", "Albumin"],
};

const METRIC_KEY_MAP: Record<string, string[]> = {
  "Blood Glucose": ["blood glucose", "glucose (random)", "random blood sugar", "blood glucose level"],
  "HbA1c": ["hba1c", "hemoglobin a1c", "glycated hemoglobin", "glycosylated hemoglobin", "hba1c (gmi)", "hba1c test", "glycosylated hb a1c"],
  "Fasting Glucose": ["fasting glucose", "fasting blood sugar", "fasting plasma glucose", "fbg", "fpg"],
  "Total Cholesterol": ["total cholesterol", "cholesterol total", "cholesterol, total", "tc"],
  "Systolic BP": ["systolic", "systolic bp", "systolic blood pressure"],
  "Diastolic BP": ["diastolic", "diastolic bp", "diastolic blood pressure"],
  "Sodium": ["sodium", "sodium, serum", "serum sodium"],
  "Potassium": ["potassium", "potassium, serum", "serum potassium"],
  "LDL": ["ldl", "ldl cholesterol", "low density lipoprotein", "ldl-c"],
  "HDL": ["hdl", "hdl cholesterol", "high density lipoprotein", "hdl-c"],
  "Triglycerides": ["triglycerides", "triglyceride", "tg", "trig"],
  "TSH": ["tsh", "thyroid stimulating hormone", "thyrotropin"],
  "T3": ["t3", "triiodothyronine", "t3 total"],
  "T4": ["t4", "thyroxine", "t4 total"],
  "Creatinine": ["creatinine", "creatinine, serum", "serum creatinine", "cre"],
  "eGFR": ["egfr", "estimated gfr", "gfr", "glomerular filtration rate"],
  "BUN": ["bun", "blood urea nitrogen", "urea nitrogen"],
  "Albumin": ["albumin", "albumin, serum", "serum albumin", "alb"],
  "Hemoglobin": ["hemoglobin", "hemoglobin, blood", "hgb", "hemoglobin level"],
  "RBC": ["rbc", "red blood cells", "red blood cell count", "erythrocytes"],
  "Iron": ["iron", "iron, serum", "serum iron", "fe"],
  "Ferritin": ["ferritin", "ferritin, serum", "serum ferritin"],
  "ALT": ["alt", "alanine aminotransferase", "alanine transaminase", "sgpt"],
  "AST": ["ast", "aspartate aminotransferase", "aspartate transaminase", "sgot"],
  "Bilirubin": ["bilirubin", "bilirubin, total", "total bilirubin", "tbil"],
};

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeCondition = (condition: string): string => {
  const c = condition.toLowerCase();
  if (c.includes("diabetes") || c.includes("diabetic")) return "diabetes";
  if (c.includes("hypertension") || c.includes("high blood pressure")) return "hypertension";
  if (c.includes("heart") || c.includes("cardiac") || c.includes("coronary")) return "heart_disease";
  if (c.includes("thyroid")) return "thyroid_disorder";
  if (c.includes("kidney") || c.includes("renal")) return "kidney_disease";
  if (c.includes("anemia") || c.includes("anaemia")) return "anemia";
  if (c.includes("liver") || c.includes("hepatic")) return "liver_disease";
  return c.replace(/\s+/g, "_");
};

export const toStatus = (status?: string | null): LabStatus | null => {
  const s = (status || "").toLowerCase();
  return s === "normal" || s === "high" || s === "low" || s === "critical" || s === "abnormal" ? s : null;
};

export const isOutOfRange = (status?: string | null) => {
  const s = toStatus(status);
  return s !== null && s !== "normal";
};

export const recordDate = (a: AnalysisRecord) => parseRecordDate(a.document_date) || parseTimestamp(a.analysis_date) || new Date(0);

const matchesTerm = (labName: string, terms: string[]) =>
  terms.some(term => labName === term || new RegExp(`\\b${escapeRegex(term)}\\b`, "i").test(labName));

export const glucoseDisplay = (mgdl: number, unit: string) =>
  unit === "mmol/L" ? { value: (mgdl / 18.0182).toFixed(1), unit: "mmol/L" } : { value: String(Math.round(mgdl)), unit: "mg/dL" };

export const buildMetricSeries = (
  analyses: AnalysisRecord[],
  vitals: VitalRecord[],
  conditions: string[],
  glucoseUnit = "mg/dL",
): MetricSeries[] => {
  const names = new Set<string>();
  conditions.map(normalizeCondition).forEach(c => DISEASE_METRICS[c]?.forEach(m => names.add(m)));

  const series: MetricSeries[] = [];
  for (const name of names) {
    const terms = (METRIC_KEY_MAP[name] || [name.toLowerCase()]).map(t => t.toLowerCase());
    const points: MetricPoint[] = [];

    for (const analysis of analyses) {
      const lab = (analysis.extracted_data?.lab_values || []).find(l => matchesTerm((l.test || "").toLowerCase().trim(), terms));
      if (!lab) continue;
      const num = Number(lab.value);
      if (!Number.isFinite(num)) continue;
      points.push({
        value: num,
        display: String(lab.value),
        unit: lab.unit || "",
        date: recordDate(analysis),
        status: toStatus(lab.status),
        sourceId: analysis.document_id,
        sourceType: "lab",
      });
    }

    const lower = name.toLowerCase();
    for (const vital of vitals) {
      const date = parseTimestamp(vital.timestamp);
      if (!date) continue;
      if (lower.includes("glucose") && !lower.includes("fasting") && vital.type === "glucose") {
        const mg = Number(vital.value);
        const shown = glucoseDisplay(mg, glucoseUnit);
        points.push({ value: Number(shown.value), display: shown.value, unit: shown.unit, date, status: null, sourceId: vital.id, sourceType: "vital" });
      } else if (lower.includes("systolic") && vital.systolic) {
        points.push({ value: vital.systolic, display: String(vital.systolic), unit: "mmHg", date, status: null, sourceId: vital.id, sourceType: "vital" });
      } else if (lower.includes("diastolic") && vital.diastolic) {
        points.push({ value: vital.diastolic, display: String(vital.diastolic), unit: "mmHg", date, status: null, sourceId: vital.id, sourceType: "vital" });
      }
    }

    if (points.length) {
      points.sort((a, b) => a.date.getTime() - b.date.getTime());
      series.push({ name, points });
    }
  }
  return series;
};

export interface Flag {
  test: string;
  value: string;
  unit: string;
  status: LabStatus;
  date: Date;
  documentId: string;
  title: string;
}

/** Latest result per test that is outside its reference range. */
export const latestOutOfRange = (analyses: AnalysisRecord[]): Flag[] => {
  const latest = new Map<string, Flag & { inRange: boolean }>();
  for (const analysis of analyses) {
    const date = recordDate(analysis);
    for (const lab of analysis.extracted_data?.lab_values || []) {
      const key = (lab.test || "").toLowerCase().trim();
      if (!key) continue;
      const existing = latest.get(key);
      if (existing && existing.date >= date) continue;
      latest.set(key, {
        test: lab.test,
        value: String(lab.value),
        unit: lab.unit || "",
        status: toStatus(lab.status) || "normal",
        date,
        documentId: analysis.document_id,
        title: analysis.title || "Lab report",
        inRange: !isOutOfRange(lab.status),
      });
    }
  }
  const rank = (s: LabStatus) => (s === "critical" ? 0 : 1);
  return Array.from(latest.values())
    .filter(f => !f.inRange)
    .sort((a, b) => rank(a.status) - rank(b.status) || b.date.getTime() - a.date.getTime());
};

export const STATUS_STYLES: Record<LabStatus, { label: string; icon: string; className: string }> = {
  normal: { label: "Normal", icon: "✓", className: "bg-emerald-50 text-emerald-700" },
  high: { label: "High", icon: "↑", className: "bg-red-50 text-red-700" },
  low: { label: "Low", icon: "↓", className: "bg-amber-50 text-amber-800" },
  critical: { label: "Critical", icon: "!", className: "bg-red-100 text-red-800" },
  abnormal: { label: "Abnormal", icon: "!", className: "bg-amber-50 text-amber-800" },
};
