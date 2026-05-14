import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { analysisService, telegramService } from "../../services/api";
import { formatDateLocal } from "../../lib/utils";

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface Reading {
  value: string;
  unit: string;
  date: string;
  status: "normal" | "high" | "low" | "critical" | null;
  sourceId: string;
  sourceType: "lab" | "vital";
}

interface MetricCard {
  name: string;
  readings: Reading[];
}

interface Analysis {
  id: string;
  document_id: string;
  category: string;
  analysis_date: string;
  document_date?: string;
  extracted_data: {
    summary: string;
    lab_values?: Array<{ test: string; value: number; unit: string; status: string }>;
  };
}

interface VitalReading {
  id: string;
  type: string;
  value: number;
  unit: string;
  timestamp: string;
  systolic?: number;
  diastolic?: number;
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

const getStatusColors = (status: string | null) => {
  const map: Record<string, string> = {
    normal: "bg-green-50 border-green-200 text-green-700",
    high: "bg-red-50 border-red-200 text-red-700",
    low: "bg-amber-50 border-amber-200 text-amber-700",
    critical: "bg-red-100 border-red-300 text-red-800",
  };
  return status ? map[status] || "bg-slate-50 border-slate-200" : "bg-slate-50 border-slate-200";
};

const MetricCarousel = ({ card }: { card: MetricCard }) => {
  const [current, setCurrent] = useState(0);
  const readings = card.readings;

  if (readings.length === 0) {
    return (
      <div className="p-4 rounded-xl border bg-slate-50 border-slate-200 min-h-[120px] flex flex-col justify-center">
        <p className="text-xs text-slate-500 mb-1">{card.name}</p>
        <p className="text-lg font-bold text-slate-400"></p>
      </div>
    );
  }

  const reading = readings[current];
  const statusClass = getStatusColors(reading.status);

  return (
    <div className={`p-4 rounded-xl border min-h-[120px] flex flex-col justify-between ${statusClass}`}>
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-slate-700">{card.name}</p>
          {readings.length > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrent(prev => (prev > 0 ? prev - 1 : readings.length - 1))}
                className="w-6 h-6 rounded-full bg-white/60 hover:bg-white/80 flex items-center justify-center transition-colors"
              >
                <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => setCurrent(prev => (prev < readings.length - 1 ? prev + 1 : 0))}
                className="w-6 h-6 rounded-full bg-white/60 hover:bg-white/80 flex items-center justify-center transition-colors"
              >
                <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
        <p className="text-2xl font-bold text-slate-800">
          {reading.value} <span className="text-sm font-normal text-slate-500">{reading.unit}</span>
        </p>
      </div>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-slate-500">{reading.date}</p>
        {reading.sourceType === "lab" && (
          <Link
            to={`/analysis/${reading.sourceId}`}
            className="text-xs text-teal-600 hover:text-teal-700 font-medium"
          >
            View Record
          </Link>
        )}
        {reading.sourceType === "vital" && (
          <Link
            to="?tab=readings"
            className="text-xs text-teal-600 hover:text-teal-700 font-medium"
          >
            View Record
          </Link>
        )}
      </div>
      {readings.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {readings.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === current ? "bg-teal-600" : "bg-slate-300"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const QuickActionCard = ({ icon, title, description, action, onClick }: { icon: string; title: string; description: string; action: string; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className="card-premium text-left hover:-translate-y-1 transition-transform duration-300"
  >
    <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center mb-3">
      <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
      </svg>
    </div>
    <h3 className="font-semibold text-slate-800">{title}</h3>
    <p className="text-sm text-slate-500 mt-1">{description}</p>
    <span className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 mt-3">
      {action}
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </span>
  </button>
);

const AnalysisItem = ({ analysis }: { analysis: Analysis }) => (
  <Link to={`/analysis/${analysis.document_id}`} className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
      analysis.category === 'lab_results' ? 'bg-blue-50' :
      analysis.category === 'prescriptions' ? 'bg-purple-50' :
      analysis.category === 'imaging' ? 'bg-emerald-50' : 'bg-slate-100'
    }`}>
      <svg className={`w-5 h-5 ${
        analysis.category === 'lab_results' ? 'text-blue-500' :
        analysis.category === 'prescriptions' ? 'text-purple-500' :
        analysis.category === 'imaging' ? 'text-emerald-500' : 'text-slate-500'
      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-slate-800 truncate">{analysis.extracted_data?.summary?.slice(0, 50) || 'Document'}...</p>
      <p className="text-sm text-slate-400">{new Date(analysis.analysis_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
    </div>
    <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  </Link>
);

const EmptyState = ({ onNavigate }: { onNavigate?: (tab: string) => void }) => (
  <div className="card-premium text-center py-12">
    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
      <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-slate-800 mb-2">No Documents Yet</h3>
    <p className="text-slate-500 mb-6">Upload your first medical document to get started with health tracking</p>
    <button onClick={() => onNavigate?.('documents')} className="btn-primary">
      Upload Document
    </button>
  </div>
);

interface OverviewTabProps {
  onNavigate?: (tab: string) => void;
  userConditions?: string[];
}

const formatDate = (dateStr: string | null): string => {
  return formatDateLocal(dateStr);
};

const OverviewTab = ({ onNavigate, userConditions = [] }: OverviewTabProps) => {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [analysesRes, vitalsRes] = await Promise.all([
          analysisService.getHistory(),
          telegramService.getReadings()
        ]);
        setAnalyses(analysesRes.data || []);
        setVitals(vitalsRes.data || []);
      } catch (error) {
        console.error("Error fetching data:", error);
        try {
          const analysesRes = await analysisService.getHistory();
          setAnalyses(analysesRes.data || []);
        } catch (e) {
          console.error("Failed to fetch analyses:", e);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const normalizeCondition = (condition: string): string => {
    const c = condition.toLowerCase();
    if (c.includes('diabetes') || c.includes('diabetic')) return 'diabetes';
    if (c.includes('hypertension') || c.includes('high blood pressure')) return 'hypertension';
    if (c.includes('heart') || c.includes('cardiac') || c.includes('coronary')) return 'heart_disease';
    if (c.includes('thyroid')) return 'thyroid_disorder';
    if (c.includes('kidney') || c.includes('renal')) return 'kidney_disease';
    if (c.includes('anemia')) return 'anemia';
    if (c.includes('liver') || c.includes('hepatic')) return 'liver_disease';
    return c.replace(/\s+/g, '_');
  };

  const getAllRelevantMetrics = (): string[] => {
    const metrics = new Set<string>();
    const normalizedConditions = userConditions.map(normalizeCondition);
    for (const condition of normalizedConditions) {
      const conditionMetrics = DISEASE_METRICS[condition];
      if (conditionMetrics) {
        conditionMetrics.forEach(m => metrics.add(m));
      }
    }
    return Array.from(metrics);
  };

  const findLabReadings = (metricName: string): Reading[] => {
    const searchTerms = METRIC_KEY_MAP[metricName] || [metricName.toLowerCase()];
    const readings: Reading[] = [];

    for (const analysis of analyses) {
      const labValues = analysis.extracted_data?.lab_values || [];
      for (const lab of labValues) {
        const labName = (lab.test || '').toLowerCase().trim();
        
        for (const term of searchTerms) {
          const termLower = term.toLowerCase().trim();
          
          const isExactMatch = labName === termLower;
          const isWordBoundaryMatch = new RegExp(`\\b${escapeRegex(termLower)}\\b`, 'i').test(labName);
          const isFullWordMatch = new RegExp(`^${escapeRegex(termLower)}$`, 'i').test(labName);
          
          if (isExactMatch || isFullWordMatch || isWordBoundaryMatch) {
            readings.push({
              value: String(lab.value),
              unit: lab.unit || '',
              date: formatDate(analysis.document_date || analysis.analysis_date),
              status: lab.status as Reading["status"] || null,
              sourceId: analysis.document_id,
              sourceType: "lab"
            });
            break;
          }
        }
      }
    }
    return readings;
  };

  const findVitalReadings = (metricName: string): Reading[] => {
    const readings: Reading[] = [];
    const lowerName = metricName.toLowerCase();

    for (const vital of vitals) {
      if (lowerName.includes('glucose') && vital.type === 'glucose') {
        readings.push({
          value: String(vital.value),
          unit: vital.unit || 'mg/dL',
          date: formatDate(vital.timestamp),
          status: null,
          sourceId: vital.id,
          sourceType: "vital"
        });
      }
      if (lowerName.includes('systolic') && vital.systolic) {
        readings.push({
          value: String(vital.systolic),
          unit: 'mmHg',
          date: formatDate(vital.timestamp),
          status: null,
          sourceId: vital.id,
          sourceType: "vital"
        });
      }
      if (lowerName.includes('diastolic') && vital.diastolic) {
        readings.push({
          value: String(vital.diastolic),
          unit: 'mmHg',
          date: formatDate(vital.timestamp),
          status: null,
          sourceId: vital.id,
          sourceType: "vital"
        });
      }
    }
    return readings;
  };

  const getMetricCards = (): MetricCard[] => {
    const relevantMetrics = getAllRelevantMetrics();
    const cards: MetricCard[] = [];

    for (const metric of relevantMetrics) {
      const labReadings = findLabReadings(metric);
      const vitalReadings = findVitalReadings(metric);
      const allReadings = [...labReadings, ...vitalReadings];

      if (allReadings.length > 0) {
        cards.push({ name: metric, readings: allReadings });
      }
    }
    return cards;
  };

  const getLatestDate = (): string | null => {
    const allDates: string[] = [];
    for (const analysis of analyses) {
      const date = analysis.document_date || analysis.analysis_date;
      if (date) allDates.push(date);
    }
    for (const vital of vitals) {
      if (vital.timestamp) allDates.push(vital.timestamp);
    }
    if (allDates.length === 0) return null;
    allDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return allDates[0];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const metricCards = getMetricCards();
  const latestDate = getLatestDate();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {userConditions.length > 0 && metricCards.length > 0 && (
        <div className="card-premium">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">Health Metrics</h2>
            {latestDate ? (
              <p className="text-sm text-slate-500">
                <Link to="/documents" className="text-teal-600 hover:underline">{formatDate(latestDate)}</Link>
              </p>
            ) : (
              <p className="text-sm text-slate-500">Upload documents to populate metrics</p>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {metricCards.map((card, idx) => (
              <MetricCarousel key={idx} card={card} />
            ))}
          </div>
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-sm font-medium text-slate-600 mb-3">Conditions being monitored</p>
            <div className="flex flex-wrap gap-2">
              {userConditions.map((condition, i) => (
                <span key={i} className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-sm font-medium">
                  {condition}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {userConditions.length === 0 && (
        <div className="card-premium text-center py-8">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Add Conditions to See Metrics</h3>
          <p className="text-slate-500 mb-4">Add your medical conditions in Settings to see relevant health metrics</p>
          <button onClick={() => onNavigate?.('profile')} className="btn-primary">
            Go to Settings
          </button>
        </div>
      )}

      {userConditions.length > 0 && metricCards.length === 0 && (
        <div className="card-premium text-center py-8">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No Data for Your Conditions</h3>
          <p className="text-slate-500 mb-4">Upload documents or log vitals to see health metrics for your conditions</p>
          <button onClick={() => onNavigate?.('documents')} className="btn-primary">
            Upload Document
          </button>
        </div>
      )}

      {analyses.length > 0 ? (
        <div className="card-premium">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Recent Analyses</h2>
            <button
              onClick={() => onNavigate?.('documents')}
              className="text-sm font-medium text-teal-600 hover:text-teal-700"
            >
              View All →
            </button>
          </div>
          <div className="space-y-1">
            {analyses.slice(0, 3).map((analysis) => (
              <AnalysisItem key={analysis.id} analysis={analysis} />
            ))}
          </div>
        </div>
      ) : (
        <EmptyState onNavigate={onNavigate} />
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <QuickActionCard
          icon="M12 4v16m8-8H4"
          title="Upload Document"
          description="Add a new medical document to analyze"
          action="Get Started"
          onClick={() => onNavigate?.('documents')}
        />
        <QuickActionCard
          icon="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          title="Ask Health Assistant"
          description="Get answers about your health data"
          action="Ask Now"
          onClick={() => onNavigate?.('chat')}
        />
      </div>
    </div>
  );
};

export default OverviewTab;