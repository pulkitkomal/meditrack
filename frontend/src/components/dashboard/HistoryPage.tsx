import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { analysisService } from "../../services/api";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";

const History = () => {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    console.log(`[FRONTEND-HISTORY] HistoryPage mounted, fetching history...`);
    const fetchHistory = async () => {
      try {
        const res = await analysisService.getHistory();
        console.log(`[FRONTEND-HISTORY] Fetched ${res.data?.length || 0} analyses`);
        setAnalyses(res.data);
      } catch (error) {
        console.error("[FRONTEND-HISTORY] Failed to fetch history:", error);
      } finally {
        setLoading(false);
        console.log(`[FRONTEND-HISTORY] Loading complete`);
      }
    };
    fetchHistory();
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500">Loading...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <nav className="bg-white/80 backdrop-blur-sm border-b border-blue-100 px-6 py-4 flex justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Analysis History</h1>
            <p className="text-xs text-gray-400">Your medical document analyses</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate("/dashboard?tab=overview")} className="border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200">
          Back to Dashboard
        </Button>
      </nav>
      <main className="container mx-auto p-8">
        <div className="grid gap-6">
          {analyses.map((analysis) => {
            const labCount = analysis.extracted_data?.lab_values?.length || 0;
            const hasIssues = analysis.risk_assessment?.risk_factors?.length > 0;
            
            return (
              <Card key={analysis.id} className="border-0 shadow-lg bg-white/90 backdrop-blur-sm hover:shadow-xl transition-all">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-t-lg border-b border-gray-100 pb-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        analysis.category === 'lab_results' ? 'bg-blue-100' :
                        analysis.category === 'prescriptions' ? 'bg-purple-100' :
                        analysis.category === 'imaging' ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <svg className={`w-6 h-6 ${
                          analysis.category === 'lab_results' ? 'text-blue-600' :
                          analysis.category === 'prescriptions' ? 'text-purple-600' :
                          analysis.category === 'imaging' ? 'text-green-600' : 'text-gray-600'
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <div>
                        <CardTitle className="text-lg font-semibold text-gray-800">
                          {analysis.category.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </CardTitle>
                        <p className="text-sm text-gray-500">
                          {new Date(analysis.document_date || analysis.analysis_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">{labCount} tests</span>
                        {hasIssues && (
                          <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            {analysis.risk_assessment.risk_factors.length} alerts
                          </span>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => navigate(`/analysis/${analysis.document_id}`)} 
                        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0"
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <p className="text-gray-600 mb-4">{analysis.extracted_data?.summary || "No summary available"}</p>
                  
                  {analysis.comparison && analysis.comparison.length > 0 && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        Lab Value Trends
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {analysis.comparison.slice(0, 6).map((trend: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-100">
                            <span className="text-sm font-medium text-gray-700 truncate">{trend.display_name || trend.test}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600">{trend.current} {trend.unit}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                trend.trend === 'increasing' ? 'bg-red-100 text-red-700' :
                                trend.trend === 'decreasing' ? 'bg-green-100 text-green-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {trend.trend === 'increasing' ? '↑' : trend.trend === 'decreasing' ? '↓' : '→'} {trend.trend}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {analysis.comparison.length > 6 && (
                        <p className="text-sm text-gray-500 mt-2 text-center">+{analysis.comparison.length - 6} more trends</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {analyses.length === 0 && (
            <div className="text-center py-16 bg-white/50 rounded-xl border-2 border-dashed border-gray-200">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-500 text-lg mb-2">No analysis history yet</p>
              <p className="text-gray-400 text-sm mb-4">Upload a document to get started with analysis</p>
              <Button onClick={() => navigate("/dashboard?tab=overview")} className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white">
                Go to Dashboard
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default History;
