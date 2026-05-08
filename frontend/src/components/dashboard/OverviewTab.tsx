import { useEffect, useState } from "react";
import { analysisService, documentService } from "../../services/api";

interface Summary {
  health_score: number;
  active_conditions: string[];
  total_analyses: number;
  predictions: Array<{ condition: string; probability: number; reasoning: string }>;
  latest_analysis_date: string;
}

interface Analysis {
  id: string;
  category: string;
  analysis_date: string;
  document_date?: string;
  extracted_data: {
    summary: string;
    lab_values?: Array<{ test: string; value: number; unit: string; status: string }>;
    medications?: Array<{ name: string; dosage: string }>;
    diagnoses?: Array<{ condition: string }>;
  };
  comparison?: { test: string; current: number; previous: number; change: string }[];
}

interface OverviewTabProps {
  onNavigate?: (tab: string) => void;
}

const HealthScoreCircle = ({ score }: { score: number }) => {
  const getColor = (score: number) => {
    if (score >= 80) return { stroke: "#10b981", bg: "bg-emerald-50", text: "text-emerald-600" };
    if (score >= 60) return { stroke: "#f59e0b", bg: "bg-amber-50", text: "text-amber-600" };
    return { stroke: "#ef4444", bg: "bg-red-50", text: "text-red-600" };
  };

  const getLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    return "Needs Attention";
  };

  const colors = getColor(score);
  const circumference = 2 * Math.PI * 45;
  const progress = (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 -rotate-90">
          <circle cx="64" cy="64" r="45" fill="none" stroke="#e2e8f0" strokeWidth="8" />
          <circle 
            cx="64" cy="64" r="45" fill="none" 
            stroke={colors.stroke} 
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-slate-800">{score}</span>
          <span className="text-xs text-slate-400">out of 100</span>
        </div>
      </div>
      <span className={`mt-3 text-sm font-medium ${colors.text}`}>{getLabel(score)}</span>
    </div>
  );
};

const StatCard = ({ icon, label, value, trend }: { icon: string; label: string; value: string | number; trend?: "up" | "down" | "neutral" }) => (
  <div className="card-premium flex items-center gap-4">
    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
      <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
      </svg>
    </div>
    <div className="flex-1">
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
    {trend && (
      <div className={`p-1.5 rounded-lg ${trend === 'up' ? 'bg-emerald-50' : trend === 'down' ? 'bg-red-50' : 'bg-slate-100'}`}>
        <svg className={`w-4 h-4 ${trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {trend === 'up' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />}
          {trend === 'down' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />}
          {trend === 'neutral' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />}
        </svg>
      </div>
    )}
  </div>
);

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
  <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors">
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
      <p className="font-medium text-slate-800 truncate">{analysis.extracted_data.summary.slice(0, 50)}...</p>
      <p className="text-sm text-slate-400">{new Date(analysis.analysis_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
    </div>
    <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  </div>
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
    <button 
      onClick={() => onNavigate?.('documents')}
      className="btn-primary"
    >
      Upload Document
    </button>
  </div>
);

const OverviewTab = ({ onNavigate }: OverviewTabProps) => {
  // const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [docCount, setDocCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryRes, analysesRes, docsRes] = await Promise.all([
          analysisService.getSummary(),
          analysisService.getHistory(),
          documentService.list()
        ]);
        setSummary(summaryRes.data);
        setAnalyses(analysesRes.data.slice(0, 3));
        setDocCount(docsRes.data?.length || 0);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Hero Section - Health Score */}
      <div className="card-premium">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">Your Health Score</h2>
            <p className="text-sm text-slate-500">Based on your latest health data</p>
          </div>
          <HealthScoreCircle score={summary?.health_score || 0} />
        </div>
        
        {summary?.active_conditions && summary.active_conditions.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-sm font-medium text-slate-600 mb-3">Active conditions being monitored</p>
            <div className="flex flex-wrap gap-2">
              {summary.active_conditions.map((condition, i) => (
                <span key={i} className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-sm font-medium">
                  {condition}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard 
          icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          label="Documents"
          value={docCount}
        />
        <StatCard 
          icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          label="Analyses"
          value={summary?.total_analyses || 0}
        />
        <StatCard 
          icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          label="Last Analysis"
          value={summary?.latest_analysis_date 
            ? new Date(summary.latest_analysis_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : 'N/A'
          }
        />
      </div>

      {/* Quick Actions */}
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

      {/* Recent Analyses */}
      {analyses.length > 0 ? (
        <div className="card-premium">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Recent Analyses</h2>
            <button 
              onClick={() => onNavigate?.('insights')}
              className="text-sm font-medium text-teal-600 hover:text-teal-700"
            >
              View All →
            </button>
          </div>
          <div className="space-y-1">
            {analyses.map((analysis) => (
              <AnalysisItem key={analysis.id} analysis={analysis} />
            ))}
          </div>
        </div>
      ) : (
        <EmptyState onNavigate={onNavigate} />
      )}

      {/* Predictions (if any) */}
      {summary?.predictions && summary.predictions.length > 0 && (
        <div className="card-premium">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Health Predictions</h2>
              <p className="text-sm text-slate-500">AI-generated risk assessments</p>
            </div>
          </div>
          <div className="space-y-3">
            {summary.predictions.map((pred, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <span className="font-medium text-slate-700">{pred.condition}</span>
                <span className={`text-sm font-medium ${pred.probability > 60 ? 'text-amber-600' : 'text-slate-500'}`}>
                  {pred.probability}% risk
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OverviewTab;