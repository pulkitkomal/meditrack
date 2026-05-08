import { useEffect, useState } from "react";
import { analysisService } from "../../services/api";
import { PredictionsList } from "./PredictionsList";
import { DoctorQuestions } from "./DoctorQuestions";

interface Profile {
  age?: number;
  gender?: string;
  blood_type?: string;
  medical_conditions?: string[];
  allergies?: string[];
}

interface Summary {
  predictions: Array<{ condition: string; probability: number; reasoning: string }>;
  health_score: number;
  active_conditions: string[];
  total_analyses: number;
  latest_analysis_date?: string;
  profile: Profile;
}

interface Trend {
  test: string;
  current: number;
  unit: string;
  status: string;
  history: Array<{value: number; date: string; status: string}>;
  trend: string;
}

const InsightsTab = () => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryRes, questionsRes] = await Promise.all([
          analysisService.getSummary(),
          analysisService.getDoctorQuestions()
        ]);
        setSummary(summaryRes.data);
        setQuestions(questionsRes.data.questions || []);
        
        if (summaryRes.data.total_analyses > 0) {
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
      } catch (error) {
        console.error("Failed to fetch insights:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const hasData = summary && summary.total_analyses > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Health Score Card */}
        {summary && (
          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-blue-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Health Score</h2>
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="35"
                    stroke="#e5e7eb"
                    strokeWidth="6"
                    fill="none"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="35"
                    stroke={summary.health_score >= 70 ? "#10b981" : summary.health_score >= 40 ? "#f59e0b" : "#ef4444"}
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${(summary.health_score / 100) * 220} 220`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-gray-800">{summary.health_score}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">
                  {summary.health_score >= 70 
                    ? "Good health! Keep it up." 
                    : summary.health_score >= 40 
                    ? "Room for improvement."
                    : "Needs attention."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Statistics Card */}
        {summary && (
          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-blue-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Statistics</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Documents Analyzed</span>
                <span className="font-semibold text-gray-800">{summary.total_analyses}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Latest Analysis</span>
                <span className="font-semibold text-gray-800 text-sm">{formatDate(summary.latest_analysis_date)}</span>
              </div>
              {summary.active_conditions.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Active Conditions</span>
                  <span className="font-semibold text-red-600">{summary.active_conditions.length}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Profile Card */}
        {summary?.profile && (summary.profile.age || summary.profile.blood_type) && (
          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-blue-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Profile</h2>
            <div className="space-y-2">
              {summary.profile.age && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Age</span>
                  <span className="font-medium text-gray-800">{summary.profile.age} years</span>
                </div>
              )}
              {summary.profile.gender && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Gender</span>
                  <span className="font-medium text-gray-800 capitalize">{summary.profile.gender}</span>
                </div>
              )}
              {summary.profile.blood_type && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Blood Type</span>
                  <span className="font-medium text-gray-800">{summary.profile.blood_type}</span>
                </div>
              )}
              {summary.profile.allergies && summary.profile.allergies.length > 0 && (
                <div className="mt-2">
                  <span className="text-gray-600 text-sm">Allergies:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {summary.profile.allergies.map((allergy, i) => (
                      <span key={i} className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs">
                        {allergy}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {summary.profile.medical_conditions && summary.profile.medical_conditions.length > 0 && (
                <div className="mt-2">
                  <span className="text-gray-600 text-sm">Conditions:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {summary.profile.medical_conditions.map((condition, i) => (
                      <span key={i} className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">
                        {condition}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active Conditions Card */}
        {summary?.active_conditions && summary.active_conditions.length > 0 && (
          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-red-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Active Health Conditions</h2>
            <div className="flex flex-wrap gap-2">
              {summary.active_conditions.map((condition, i) => (
                <span key={i} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                  {condition}
                </span>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-3">
              Please consult with your healthcare provider to discuss these conditions.
            </p>
          </div>
        )}
      </div>

      {/* Lab Values Trends */}
      {trendsLoading ? (
        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-blue-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Lab Values Trends</h2>
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      ) : trends.length > 0 ? (
        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-blue-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Lab Values Trends</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {trends.slice(0, 6).map((trend, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-800">{trend.test}</h3>
                    <p className="text-sm text-gray-500">
                      {trend.history?.length > 0 ? `Last: ${trend.history[trend.history.length - 1]?.date || 'N/A'}` : 'Single test'}
                    </p>
                  </div>
                  <span className={`text-sm font-medium px-2 py-1 rounded ${
                    trend.trend === "increasing" ? "bg-red-100 text-red-700" :
                    trend.trend === "decreased" ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {trend.trend === "increasing" ? "↑" : trend.trend === "decreasing" ? "↓" : "→"} {trend.trend}
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-800">
                  {trend.current} <span className="text-sm font-normal text-gray-500">{trend.unit}</span>
                </div>
                <div className="text-xs mt-1">
                  Status: <span className={trend.status === "normal" ? "text-green-600" : "text-red-600"}>{trend.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Predictions */}
      {summary?.predictions && summary.predictions.length > 0 && (
        <PredictionsList predictions={summary.predictions} />
      )}

      {/* Doctor Questions */}
      {questions.length > 0 && (
        <DoctorQuestions questions={questions} />
      )}

      {!hasData && (
        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-8 shadow-lg border border-blue-100 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Insights Yet</h3>
          <p className="text-gray-600">Upload and analyze documents to see health predictions and trends</p>
        </div>
      )}
    </div>
  );
};

export default InsightsTab;