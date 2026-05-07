import { useEffect, useState } from "react";
import { analysisService } from "../../services/api";
import { PredictionsList } from "./PredictionsList";
import { DoctorQuestions } from "./DoctorQuestions";

interface Summary {
  predictions: Array<{ condition: string; probability: number; reasoning: string }>;
  health_score: number;
  active_conditions: string[];
}

const InsightsTab = () => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
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
      } catch (error) {
        console.error("Failed to fetch insights:", error);
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

  return (
    <div className="space-y-6">
      {/* Health Score Summary */}
      {summary && (
        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-blue-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Health Score</h2>
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke={summary.health_score >= 70 ? "#10b981" : summary.health_score >= 40 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${(summary.health_score / 100) * 251.2} 251.2`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-800">{summary.health_score}</span>
              </div>
            </div>
            <div>
              <p className="text-gray-600 mb-2">
                {summary.health_score >= 70 
                  ? "Your health score is good! Keep up the healthy habits." 
                  : summary.health_score >= 40 
                  ? "Your health score could use some improvement. Consider consulting a doctor."
                  : "Your health score needs attention. Please consult a healthcare professional."}
              </p>
              {summary.active_conditions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-sm text-gray-500">Active Conditions:</span>
                  {summary.active_conditions.map((condition, i) => (
                    <span key={i} className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-sm">
                      {condition}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Predictions */}
      {summary?.predictions && summary.predictions.length > 0 && (
        <PredictionsList predictions={summary.predictions} />
      )}

      {/* Doctor Questions */}
      {questions.length > 0 && (
        <DoctorQuestions questions={questions} />
      )}

      {(!summary?.predictions || summary.predictions.length === 0) && questions.length === 0 && (
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