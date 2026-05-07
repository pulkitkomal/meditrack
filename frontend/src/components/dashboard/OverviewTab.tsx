import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { analysisService, documentService } from "../../services/api";
import { HealthScore } from "./HealthScore";
import { AnalysisCard } from "./AnalysisCard";

interface OverviewTabProps {
  onNavigate?: (tab: string) => void;
}

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

const OverviewTab = ({ onNavigate }: OverviewTabProps) => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [docCount, setDocCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      console.log("[Overview] Fetching data...");
      try {
        const [summaryRes, analysesRes, docsRes] = await Promise.all([
          analysisService.getSummary(),
          analysisService.getHistory(),
          documentService.list()
        ]);
        console.log("[Overview] Summary:", summaryRes.data);
        console.log("[Overview] Docs:", docsRes.data);
        setSummary(summaryRes.data);
        setAnalyses(analysesRes.data.slice(0, 3));
        setDocCount(docsRes.data?.length || 0);
      } catch (error: any) {
        console.error("[Overview] Error:", error.response?.status, error.response?.data || error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  console.log("[Overview] Rendering with - summary:", summary, "docCount:", docCount, "analyses:", analyses.length);

  return (
    <div className="space-y-6">
      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{docCount}</p>
              <p className="text-sm text-gray-500">Documents</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{summary?.total_analyses || 0}</p>
              <p className="text-sm text-gray-500">Analyses</p>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.02-1.068-.03-1.117z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{summary?.health_score || 0}</p>
              <p className="text-sm text-gray-500">Health Score</p>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-800">
                {summary?.latest_analysis_date 
                  ? new Date(summary.latest_analysis_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : 'N/A'
                }
              </p>
              <p className="text-sm text-gray-500">Last Analysis</p>
            </div>
          </div>
        </div>
      </div>

      {/* Health Score */}
      {summary && (
        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-blue-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Health Overview</h2>
          <HealthScore score={summary.health_score} />
          {summary.active_conditions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-600 mb-2">Active Conditions:</p>
              <div className="flex flex-wrap gap-2">
                {summary.active_conditions.map((condition, i) => (
                  <span key={i} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                    {condition}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Upload */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Upload New Document</h3>
            <p className="text-gray-600 text-sm">Add a new medical document to analyze</p>
          </div>
          <button 
            onClick={() => onNavigate?.('documents')}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all"
          >
            Upload
          </button>
        </div>
      </div>

      {/* Recent Analyses */}
      {analyses.length > 0 && (
        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-blue-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Recent Analyses</h2>
            <button 
              onClick={() => onNavigate?.('insights')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View All →
            </button>
          </div>
          <div className="space-y-3">
            {analyses.map((analysis) => (
              <AnalysisCard 
                key={analysis.id} 
                analysis={analysis} 
                onView={(id) => navigate(`/analysis/${id}`)} 
              />
            ))}
          </div>
        </div>
      )}

      {docCount === 0 && (
        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-8 shadow-lg border border-blue-100 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Documents Yet</h3>
          <p className="text-gray-600 mb-4">Upload your first medical document to get started</p>
          <button 
            onClick={() => onNavigate?.('documents')}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700"
          >
            Upload Document
          </button>
        </div>
      )}
    </div>
  );
};

export default OverviewTab;