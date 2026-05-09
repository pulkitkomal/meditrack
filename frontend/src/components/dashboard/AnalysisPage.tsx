import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { analysisService, documentService } from "../../services/api";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";

const AnalysisPage = () => {
  const { docId } = useParams<{ docId: string }>();
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showExtracted, setShowExtracted] = useState(true);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [loadingOriginal, setLoadingOriginal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!showExtracted && docId && !originalUrl) {
      setLoadingOriginal(true);
      documentService.getFile(docId)
        .then(res => {
          const url = URL.createObjectURL(res.data);
          setOriginalUrl(url);
        })
        .catch(err => {
          console.error("Failed to load original document:", err);
        })
        .finally(() => setLoadingOriginal(false));
    }
    if (showExtracted && originalUrl) {
      URL.revokeObjectURL(originalUrl);
      setOriginalUrl(null);
    }
  }, [showExtracted, docId]);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const res = await analysisService.getAnalysis(docId!);
        setAnalysis(res.data);
      } catch (error: any) {
        if (error.response?.status === 404) {
          alert("Analysis not found. Triggering analysis...");
          await analysisService.triggerAnalysis(docId!);
          const res = await analysisService.getAnalysis(docId!);
          setAnalysis(res.data);
        }
      } finally {
        setLoading(false);
      }
    };
    if (docId) fetchAnalysis();
  }, [docId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Analysis Not Found</h2>
        <p className="text-gray-600 mb-6">The requested analysis could not be found.</p>
        <Button onClick={() => navigate("/dashboard?tab=overview")}>Go to Dashboard</Button>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <nav className="bg-white/80 backdrop-blur-sm border-b border-blue-100 px-4 md:px-8 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Analysis Details</h1>
              <p className="text-sm text-gray-500">
                {analysis.category} • {formatDate(analysis.analysis_date || analysis.document_date)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle Button */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setShowExtracted(true)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  showExtracted 
                    ? "bg-white text-blue-600 shadow-sm" 
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Extracted
              </button>
              <button
                onClick={() => setShowExtracted(false)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  !showExtracted 
                    ? "bg-white text-purple-600 shadow-sm" 
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Original
              </button>
            </div>
            <Button variant="outline" onClick={() => navigate("/dashboard?tab=overview")} className="hidden md:flex">
              Back to Dashboard
            </Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto p-4 md:p-8 space-y-6">
        {showExtracted ? (
          <>
          {analysis.extracted_data?.summary && (
          <Card className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-blue-100">
            <CardHeader className="border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <CardTitle className="text-lg">Document Summary</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-gray-700 leading-relaxed">{analysis.extracted_data.summary}</p>
            </CardContent>
          </Card>
        )}

        {analysis.extracted_data?.lab_values?.length > 0 && (
          <Card className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-blue-100">
            <CardHeader className="border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <CardTitle className="text-lg">Lab Values</CardTitle>
                </div>
                <span className="text-sm text-gray-500">{analysis.extracted_data.lab_values.length} tests</span>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Test</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Value</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Reference Range</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.extracted_data.lab_values.map((lab: any, idx: number) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors">
                        <td className="py-4 px-4 text-gray-800 font-medium">{lab.test}</td>
                        <td className="py-4 px-4 text-gray-700">
                          <span className="font-semibold">{lab.value}</span> {lab.unit}
                        </td>
                        <td className="py-4 px-4 text-gray-500">{lab.reference_range || "N/A"}</td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            lab.status === "high"
                              ? "bg-red-100 text-red-700 border border-red-200"
                              : lab.status === "low"
                              ? "bg-blue-100 text-blue-700 border border-blue-200"
                              : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                          }`}>
                            {lab.status === "high" && (
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            )}
                            {lab.status === "low" && (
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                            {lab.status === "normal" && (
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                            {lab.status ? lab.status.charAt(0).toUpperCase() + lab.status.slice(1) : 'Unknown'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {analysis.extracted_data?.medications?.length > 0 && (
          <Card className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-blue-100">
            <CardHeader className="border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </div>
                  <CardTitle className="text-lg">Medications</CardTitle>
                </div>
                <span className="text-sm text-gray-500">{analysis.extracted_data.medications.length} prescriptions</span>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                {analysis.extracted_data.medications.map((med: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-amber-200 transition-colors">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">{med.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">{med.dosage}</span>
                        {med.frequency && ` • ${med.frequency}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {analysis.extracted_data?.diagnoses?.length > 0 && (
          <Card className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-blue-100">
            <CardHeader className="border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-600 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <CardTitle className="text-lg">Diagnoses</CardTitle>
                </div>
                <span className="text-sm text-gray-500">{analysis.extracted_data.diagnoses.length} conditions</span>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {analysis.extracted_data.diagnoses.map((d: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-4 p-4 bg-red-50 rounded-lg border border-red-100">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">{d.condition}</h4>
                      {d.icd_code && (
                        <p className="text-sm text-gray-500">ICD-10: {d.icd_code}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {(!analysis.extracted_data?.lab_values?.length && !analysis.extracted_data?.medications?.length && !analysis.extracted_data?.diagnoses?.length) && (
          <Card className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-blue-100">
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">No Detailed Data</h3>
              <p className="text-gray-600">No lab values, medications, or diagnoses were extracted from this document.</p>
            </CardContent>
          </Card>
        )}
          </>
        ) : (
          <>
            {/* Original Document View */}
            <Card className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-blue-100">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <CardTitle className="text-lg">Original Document</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {loadingOriginal ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : analysis.file_path && originalUrl ? (
                  (() => {
                    const mimeType = analysis.mime_type || analysis.file_type || '';
                    const isPdf = mimeType === 'application/pdf' || mimeType.endsWith('.pdf');
                    return isPdf ? (
                      <iframe 
                        src={originalUrl}
                        className="w-full h-[600px] rounded-lg border border-gray-200"
                        title="Original Document"
                      />
                    ) : (
                      <div className="text-center">
                        <img 
                          src={originalUrl}
                          alt="Original Document"
                          className="max-w-full h-auto rounded-lg border border-gray-200 mx-auto"
                        />
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No original document available.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default AnalysisPage;