import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { analysisService } from "../../services/api";
import { HealthScore } from "../dashboard/HealthScore";
import { PredictionsList } from "../dashboard/PredictionsList";
import { DoctorQuestions } from "../dashboard/DoctorQuestions";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";

interface SummaryData {
  health_score: number;
  active_conditions: string[];
  total_analyses: number;
  predictions: Array<{condition: string; probability: number; reasoning: string}>;
  latest_analysis_date: string;
}

interface TokenUsage {
  total_tokens: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  request_count: number;
}

const Summary = () => {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    console.log(`[FRONTEND-SUMMARY] SummaryPage mounted, fetching data...`);
    const fetchData = async () => {
      try {
        console.log(`[FRONTEND-SUMMARY] Fetching summary, questions, and token usage...`);
        const [summaryRes, questionsRes, usageRes] = await Promise.all([
          analysisService.getSummary(),
          analysisService.getDoctorQuestions(),
          analysisService.getUsageStats()
        ]);
        console.log(`[FRONTEND-SUMMARY] Summary data:`, summaryRes.data);
        console.log(`[FRONTEND-SUMMARY] Questions count:`, questionsRes.data?.questions?.length || 0);
        console.log(`[FRONTEND-SUMMARY] Token usage:`, usageRes.data);
        
        setSummary(summaryRes.data);
        setQuestions(questionsRes.data.questions);
        setTokenUsage(usageRes.data);
      } catch (error) {
        console.error("[FRONTEND-SUMMARY] Failed to fetch summary:", error);
      } finally {
        setLoading(false);
        console.log(`[FRONTEND-SUMMARY] Loading complete`);
      }
    };
    fetchData();
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500">Loading your health summary...</p>
      </div>
    </div>
  );
  
  if (!summary) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-gray-500 text-lg mb-2">No data available</p>
        <p className="text-gray-400 text-sm mb-4">Upload some documents to see your health summary</p>
        <button onClick={() => navigate("/dashboard?tab=overview")} className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700">
          Go to Dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <nav className="bg-white/80 backdrop-blur-sm border-b border-blue-100 px-6 py-4 flex justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.02-1.068-.03-1.117z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Health Summary</h1>
            <p className="text-xs text-gray-400">Your comprehensive health overview</p>
          </div>
        </div>
        <button onClick={() => navigate("/dashboard?tab=overview")} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          Back to Dashboard →
        </button>
      </nav>
      <main className="container mx-auto p-8">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Health Score */}
          <div className="md:col-span-2">
            <HealthScore score={summary.health_score} />
          </div>
          
          {/* Active Conditions */}
          <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-lg border-b border-gray-100">
              <CardTitle className="text-gray-800 flex items-center gap-2">
                <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </span>
                Active Conditions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {summary.active_conditions.length > 0 ? (
                <div className="space-y-2">
                  {summary.active_conditions.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                      <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                      <span className="text-gray-700">{c}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <span className="text-2xl mb-2 block">✓</span>
                  No active conditions detected
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Statistics */}
          <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-t-lg border-b border-gray-100">
              <CardTitle className="text-gray-800 flex items-center gap-2">
                <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </span>
                Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-xl">
                  <p className="text-3xl font-bold text-blue-600">{summary.total_analyses}</p>
                  <p className="text-sm text-gray-500">Total Analyses</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-xl">
                  <p className="text-3xl font-bold text-purple-600">{summary.predictions.length}</p>
                  <p className="text-sm text-gray-500">Predictions</p>
                </div>
              </div>
              {summary.latest_analysis_date && (
                <p className="text-sm text-gray-500 text-center mt-4">
                  Latest analysis: {new Date(summary.latest_analysis_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </CardContent>
          </Card>
          
          {/* Predictions */}
          <div className="md:col-span-2">
            <PredictionsList predictions={summary.predictions} />
          </div>
          
          {/* Doctor Questions */}
          <div className="md:col-span-2">
            <DoctorQuestions questions={questions} />
          </div>
          
          {/* Token Usage */}
          {tokenUsage && (
            <div className="md:col-span-2">
              <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-t-lg border-b border-gray-100">
                  <CardTitle className="text-gray-800 flex items-center gap-2">
                    <span className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </span>
                    API Usage Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-xl font-bold text-gray-700">{tokenUsage.total_tokens?.toLocaleString() || 0}</p>
                      <p className="text-xs text-gray-500">Total Tokens</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-xl font-bold text-gray-700">{tokenUsage.total_prompt_tokens?.toLocaleString() || 0}</p>
                      <p className="text-xs text-gray-500">Prompt Tokens</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-xl font-bold text-gray-700">{tokenUsage.total_completion_tokens?.toLocaleString() || 0}</p>
                      <p className="text-xs text-gray-500">Completion Tokens</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-xl font-bold text-gray-700">{tokenUsage.request_count || 0}</p>
                      <p className="text-xs text-gray-500">Total Requests</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Summary;
