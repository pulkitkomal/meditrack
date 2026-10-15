import { useEffect, useMemo, useState } from "react";
import { analysisService, readingsService } from "../../services/api";
import { PredictionsList } from "./PredictionsList";
import { DoctorQuestions } from "./DoctorQuestions";
import MetricSparkCard, { Sparkline } from "./MetricSparkCard";
import StatusBadge from "../ui/StatusBadge";
import { PageSkeleton } from "../ui/Skeleton";
import { parseTimestamp } from "../../lib/dates";
import { buildMetricSeries, type AnalysisRecord, type VitalRecord } from "../../lib/metrics";

interface Trend {
  test: string;
  current: number;
  unit: string;
  status: string;
  history: Array<{ value: number; date: string; status: string }>;
  trend: string;
}

interface LatestMetric {
  display_name: string;
  value: number | string;
  unit: string;
  status: string;
}

const formatDate = (value?: string | null) => {
  const date = parseTimestamp(value);
  return date ? date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex justify-between items-center gap-3 py-1.5">
    <span className="text-slate-500 text-sm">{label}</span>
    <span className="font-medium text-slate-800 text-sm text-right">{children}</span>
  </div>
);

const TREND_LABEL: Record<string, string> = { increasing: "↑ Rising", decreasing: "↓ Falling", stable: "→ Stable" };

interface InsightsTabProps {
  userConditions?: string[];
  glucoseUnit?: string;
  onNavigate?: (tab: string) => void;
}

const InsightsTab = ({ userConditions = [], glucoseUnit = "mg/dL", onNavigate }: InsightsTabProps) => {
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [vitals, setVitals] = useState<VitalRecord[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      analysisService.getSummary(),
      analysisService.getDoctorQuestions(),
      analysisService.getHistory(),
      readingsService.list(),
      analysisService.getTrends("lab_results"),
    ]).then(([summaryRes, questionsRes, historyRes, readingsRes, trendsRes]) => {
      if (summaryRes.status === "fulfilled") setSummary(summaryRes.value.data);
      if (questionsRes.status === "fulfilled") setQuestions(questionsRes.value.data.questions || []);
      if (historyRes.status === "fulfilled") setAnalyses(historyRes.value.data || []);
      if (readingsRes.status === "fulfilled") setVitals(readingsRes.value.data || []);
      if (trendsRes.status === "fulfilled") setTrends(trendsRes.value.data.trends || []);
      setLoading(false);
    });
  }, []);

  const series = useMemo(() => buildMetricSeries(analyses, vitals, userConditions, glucoseUnit), [analyses, vitals, userConditions, glucoseUnit]);

  if (loading) return <PageSkeleton cards={4} />;

  const hasData = summary && summary.total_analyses > 0;
  const latestMetrics: LatestMetric[] = summary?.latest_metrics || [];
  const profile = summary?.profile;
  const showProfile = profile && (profile.age || profile.blood_type || profile.gender || profile.allergies?.length || profile.medical_conditions?.length);

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {userConditions.length > 0 ? (
        series.length > 0 && (
          <section className="card-premium">
            <h3 className="font-semibold text-slate-800">Your key metrics</h3>
            <p className="text-sm text-slate-500 mb-4">Chosen for {userConditions.join(", ")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {series.map(s => <MetricSparkCard key={s.name} series={s} />)}
            </div>
          </section>
        )
      ) : (
        <button type="button" onClick={() => onNavigate?.("profile")} className="w-full card-premium !p-4 text-left text-sm text-slate-600 hover:border-teal-200">
          <span className="font-medium text-slate-800">Add your conditions in Settings</span> to see the metrics that matter most for you.
        </button>
      )}

      {latestMetrics.length > 0 && (
        <section className="card-premium">
          <h3 className="font-semibold text-slate-800 mb-4">Latest lab values</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {latestMetrics.slice(0, 8).map((metric, idx) => (
              <div key={idx} className="p-3 rounded-glass border border-slate-100 bg-surface">
                <p className="text-xs text-slate-500 mb-1 truncate">{metric.display_name}</p>
                <p className="text-xl font-bold text-slate-800">
                  {metric.value} <span className="text-xs font-normal text-slate-500">{metric.unit}</span>
                </p>
                <StatusBadge status={metric.status} className="mt-1" />
              </div>
            ))}
          </div>
        </section>
      )}

      {trends.length > 0 && (
        <section className="card-premium">
          <h3 className="font-semibold text-slate-800 mb-4">Lab trends</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {trends.slice(0, 6).map((trend, i) => (
              <div key={i} className="p-4 rounded-glass border border-slate-100 bg-surface">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <h4 className="font-medium text-slate-800 truncate">{trend.test}</h4>
                    <p className="text-xs text-slate-500">
                      {trend.history?.length > 1 ? `${trend.history.length} results` : "Single result"}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
                    {TREND_LABEL[trend.trend] || trend.trend}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-2xl font-bold text-slate-800">{trend.current}</span>
                  <span className="text-sm text-slate-500">{trend.unit}</span>
                  <StatusBadge status={trend.status} />
                </div>
                <Sparkline values={(trend.history || []).map(h => Number(h.value)).filter(Number.isFinite)} className="mt-2" />
              </div>
            ))}
          </div>
        </section>
      )}

      {summary && (
        <div className={`grid gap-4 ${showProfile ? "md:grid-cols-2" : ""}`}>
          <section className="card-premium">
            <h3 className="font-semibold text-slate-800 mb-2">Overview</h3>
            <Row label="Records analysed">{summary.total_analyses}</Row>
            <Row label="Latest analysis">{formatDate(summary.latest_analysis_date)}</Row>
            {typeof summary.health_score === "number" && hasData && <Row label="Health score">{summary.health_score} / 100</Row>}
            {summary.active_conditions?.length > 0 && (
              <div className="pt-2">
                <p className="text-sm text-slate-500 mb-1.5">Conditions found in records</p>
                <div className="flex flex-wrap gap-1.5">
                  {summary.active_conditions.map((c: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {showProfile && (
            <section className="card-premium">
              <h3 className="font-semibold text-slate-800 mb-2">Your profile</h3>
              {profile.age && <Row label="Age">{profile.age} years</Row>}
              {profile.gender && <Row label="Gender"><span className="capitalize">{profile.gender}</span></Row>}
              {profile.blood_type && <Row label="Blood type">{profile.blood_type}</Row>}
              {profile.allergies?.length > 0 && <Row label="Allergies">{profile.allergies.join(", ")}</Row>}
              {profile.medical_conditions?.length > 0 && <Row label="Conditions">{profile.medical_conditions.join(", ")}</Row>}
            </section>
          )}
        </div>
      )}

      {summary?.predictions?.length > 0 && <PredictionsList predictions={summary.predictions} />}

      {questions.length > 0 && <DoctorQuestions questions={questions} />}

      {!hasData && (
        <div className="card-premium text-center py-10">
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No insights yet</h3>
          <p className="text-slate-500 mb-4">Add and analyse a record to see trends and predictions.</p>
          <button type="button" onClick={() => onNavigate?.("documents")} className="btn-primary">Add a record</button>
        </div>
      )}
    </div>
  );
};

export default InsightsTab;
