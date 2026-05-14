import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { analysisService, telegramService } from "../../services/api";
import { PredictionsList } from "./PredictionsList";
import { DoctorQuestions } from "./DoctorQuestions";

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
    medications?: Array<{ name: string; dosage: string }>;
    diagnoses?: Array<{ condition: string }>;
  };
  comparison?: Array<{ test: string; current: number; previous: number; change: string }>;
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

interface Trend {
  test: string;
  current: number;
  unit: string;
  status: string;
  history: Array<{ value: number; date: string; status: string }>;
  trend: string;
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

const StatCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="card-premium">
    <h3 className="font-semibold text-slate-800 mb-4">{title}</h3>
    {children}
  </div>
);

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

interface InsightsTabProps {
  userConditions?: string[];
}

const InsightsTab = ({ userConditions = [] }: InsightsTabProps) => {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryRes, questionsRes, analysesRes] = await Promise.all([
          analysisService.getSummary(),
          analysisService.getDoctorQuestions(),
          analysisService.getHistory()
        ]);
        setSummary(summaryRes.data);
        setQuestions(questionsRes.data.questions || []);
        setAnalyses(analysesRes.data || []);
      } catch (error) {
        console.error("Failed to fetch insights:", error);
      }

      try {
        const vitalsRes = await telegramService.getReadings();
        setVitals(vitalsRes.data || []);
      } catch (e) {
        console.log("Vitals not available (Telegram not connected)");
      }

      try {
        const historyRes = await analysisService.getHistory();
        if (historyRes.data?.length > 0) {
          setTrendsLoading(true);
          try {
            const trendsRes = await analysisService.getTrends("blood");
            setTrends(trendsRes.data.trends || []);
          } catch (e) {
            console.error("Failed to fetch trends:", e);
          } finally {
            setTrendsLoading(false);
          }
        }
      } catch (e) {
        console.error("Failed to fetch history for trends:", e);
      }

      setLoading(false);
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
  const hasData = summary && summary.total_analyses > 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {userConditions.length > 0 && metricCards.length > 0 && (
        <div className="card-premium">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Health Metrics</h3>
            {latestDate ? (
              <p className="text-sm text-slate-500">
                <Link to="/documents" className="text-teal-600 hover:underline">{formatDate(latestDate)}</Link>
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {metricCards.map((card, idx) => (
              <MetricCarousel key={idx} card={card} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summary && summary.latest_metrics && summary.latest_metrics.length > 0 ? (
          <div className="md:col-span-2 lg:col-span-3 card-premium">
            <h3 className="font-semibold text-slate-800 mb-4">Latest Lab Values</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {summary.latest_metrics.slice(0, 8).map((metric: any, idx: number) => {
                const statusColors: Record<string, string> = {
                  normal: "bg-green-50 border-green-200",
                  high: "bg-red-50 border-red-200",
                  low: "bg-amber-50 border-amber-200",
                  critical: "bg-red-100 border-red-300"
                };
                const textColors: Record<string, string> = {
                  normal: "text-green-700",
                  high: "text-red-700",
                  low: "text-amber-700",
                  critical: "text-red-800"
                };
                return (
                  <div key={idx} className={`p-4 rounded-xl border ${statusColors[metric.status] || statusColors.normal}`}>
                    <p className="text-xs text-slate-500 mb-1">{metric.display_name}</p>
                    <p className="text-2xl font-bold text-slate-800">
                      {metric.value} <span className="text-sm font-normal text-slate-500">{metric.unit}</span>
                    </p>
                    <span className={`text-xs font-medium ${textColors[metric.status] || textColors.normal}`}>
                      {metric.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : summary && (
          <StatCard title="Health Score">
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle cx="40" cy="40" r="35" stroke="#e2e8f0" strokeWidth="6" fill="none" />
                  <circle
                    cx="40" cy="40" r="35"
                    stroke={summary.health_score >= 70 ? "#10b981" : summary.health_score >= 40 ? "#f59e0b" : "#ef4444"}
                    strokeWidth="6" fill="none" strokeLinecap="round"
                    strokeDasharray={`${(summary.health_score / 100) * 220} 220`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-slate-800">{summary.health_score}</span>
                </div>
              </div>
              <p className="text-sm text-slate-600">
                {summary.health_score >= 70 ? "Good health! Keep it up." : summary.health_score >= 40 ? "Room for improvement." : "Needs attention."}
              </p>
            </div>
          </StatCard>
        )}

        {summary && (
          <StatCard title="Statistics">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Documents Analyzed</span>
                <span className="font-semibold text-slate-800">{summary.total_analyses}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Latest Analysis</span>
                <span className="font-semibold text-slate-800 text-sm">{formatDate(summary.latest_analysis_date)}</span>
              </div>
              {summary.active_conditions?.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Active Conditions</span>
                  <span className="font-semibold text-red-600">{summary.active_conditions.length}</span>
                </div>
              )}
            </div>
          </StatCard>
        )}

        {summary?.profile && (summary.profile.age || summary.profile.blood_type) && (
          <StatCard title="Your Profile">
            <div className="space-y-2">
              {summary.profile.age && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Age</span>
                  <span className="font-medium text-slate-800">{summary.profile.age} years</span>
                </div>
              )}
              {summary.profile.gender && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Gender</span>
                  <span className="font-medium text-slate-800 capitalize">{summary.profile.gender}</span>
                </div>
              )}
              {summary.profile.blood_type && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Blood Type</span>
                  <span className="font-medium text-slate-800 uppercase">{summary.profile.blood_type.replace('_', '')}</span>
                </div>
              )}
              {summary.profile.allergies?.length > 0 && (
                <div className="mt-2">
                  <span className="text-slate-500 text-sm">Allergies:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {summary.profile.allergies.map((allergy: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full text-xs">{allergy}</span>
                    ))}
                  </div>
                </div>
              )}
              {summary.profile.medical_conditions?.length > 0 && (
                <div className="mt-2">
                  <span className="text-slate-500 text-sm">Conditions:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {summary.profile.medical_conditions.map((condition: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-red-50 text-red-700 rounded-full text-xs">{condition}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </StatCard>
        )}

        {summary?.active_conditions?.length > 0 && (
          <div className="card-premium border-red-100">
            <h3 className="font-semibold text-slate-800 mb-4">Active Health Conditions</h3>
            <div className="flex flex-wrap gap-2">
              {summary.active_conditions.map((condition: string, i: number) => (
                <span key={i} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm font-medium">{condition}</span>
              ))}
            </div>
            <p className="text-sm text-slate-500 mt-3">Please consult with your healthcare provider.</p>
          </div>
        )}
      </div>

      {trendsLoading ? (
        <div className="card-premium">
          <h3 className="font-semibold text-slate-800 mb-4">Lab Values Trends</h3>
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      ) : trends.length > 0 ? (
        <div className="card-premium">
          <h3 className="font-semibold text-slate-800 mb-4">Lab Values Trends</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {trends.slice(0, 6).map((trend, i) => (
              <div key={i} className="p-4 rounded-xl bg-slate-50">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold text-slate-800">{trend.test}</h4>
                    <p className="text-xs text-slate-400">{trend.history?.length > 0 ? `Last: ${trend.history[trend.history.length - 1]?.date || 'N/A'}` : 'Single test'}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    trend.trend === "increasing" ? "bg-red-50 text-red-600" :
                    trend.trend === "decreasing" ? "bg-blue-50 text-blue-600" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {trend.trend === "increasing" ? "↑" : trend.trend === "decreasing" ? "↓" : "→"} {trend.trend}
                  </span>
                </div>
                <div className="text-2xl font-bold text-slate-800">
                  {trend.current} <span className="text-sm font-normal text-slate-500">{trend.unit}</span>
                </div>
                <div className="text-xs mt-1">
                  Status: <span className={trend.status === "normal" ? "text-emerald-600" : "text-red-600"}>{trend.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {summary?.predictions?.length > 0 && (
        <PredictionsList predictions={summary.predictions} />
      )}

      {questions.length > 0 && (
        <DoctorQuestions questions={questions} />
      )}

      {!hasData && (
        <div className="card-premium text-center py-12">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No Insights Yet</h3>
          <p className="text-slate-500">Upload and analyze documents to see health predictions</p>
        </div>
      )}
    </div>
  );
};

export default InsightsTab;