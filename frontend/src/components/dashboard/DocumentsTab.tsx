import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { documentService, analysisService } from "../../services/api";
import FileUpload from "./FileUpload";
import { Button } from "../ui/button";
import type { Document } from "../../types";

interface DocWithAnalysis extends Document {
  analysis_id?: string;
}

const categoryIcons: Record<string, string> = {
  lab_results: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z",
  prescriptions: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  imaging: "M6.827 6.175A2.31 2.31 0 015.344 7.103c0 1.98.742 3.881 1.908 5.341a8.985 8.985 0 012.287 4.153c.45.467.7 1.089.7 1.757v.536c0 .945-.38 1.813-1.006 2.4l-1.415 1.414a1 1 0 01-1.414 0l-1.414-1.414a2.31 2.31 0 01-2.4-1.006v-.536c0-.668.25-1.29.7-1.757a8.985 8.985 0 012.287-4.153 5.318 5.318 0 011.908-5.34 2.31 2.31 0 011.483-.828h0M12 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
  vaccination_records: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.02-1.068-.03-1.117z",
  discharge_summaries: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  insurance_documents: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
};

const DocumentsTab = () => {
  const [docs, setDocs] = useState<DocWithAnalysis[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchDocs = async () => {
    try {
      const res = await documentService.list(filter || undefined);
      setDocs(res.data);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [filter]);

  const handleAnalyze = async (docId: string) => {
    try {
      await analysisService.triggerAnalysis(docId);
      fetchDocs();
    } catch (error) {
      console.error("Analysis failed:", error);
    }
  };

  const categories = [
    { value: "", label: "All Documents" },
    { value: "lab_results", label: "Lab Results" },
    { value: "prescriptions", label: "Prescriptions" },
    { value: "imaging", label: "Imaging" },
    { value: "vaccination_records", label: "Vaccinations" },
    { value: "discharge_summaries", label: "Discharge Summaries" },
    { value: "insurance_documents", label: "Insurance" }
  ];

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-blue-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Upload Document</h2>
        <FileUpload onUpload={fetchDocs} />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setFilter(cat.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === cat.value
                ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                : "bg-white/90 text-gray-600 hover:bg-gray-50 border border-gray-200"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Documents List */}
      <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-blue-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : docs.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Documents Found</h3>
            <p className="text-gray-600">
              {filter ? `No ${filter.replace('_', ' ')} documents yet` : "Upload your first document to get started"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {docs.map((doc) => (
              <div key={doc.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      doc.category === 'lab_results' ? 'bg-blue-100' :
                      doc.category === 'prescriptions' ? 'bg-purple-100' :
                      doc.category === 'imaging' ? 'bg-green-100' :
                      doc.category === 'vaccination_records' ? 'bg-amber-100' :
                      'bg-gray-100'
                    }`}>
                      <svg className={`w-5 h-5 ${
                        doc.category === 'lab_results' ? 'text-blue-600' :
                        doc.category === 'prescriptions' ? 'text-purple-600' :
                        doc.category === 'imaging' ? 'text-green-600' :
                        doc.category === 'vaccination_records' ? 'text-amber-600' :
                        'text-gray-600'
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={categoryIcons[doc.category] || categoryIcons.lab_results} />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{doc.original_name}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span className="capitalize">{doc.category.replace('_', ' ')}</span>
                        {doc.document_date && (
                          <>
                            <span>•</span>
                            <span>{new Date(doc.document_date).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate(`/analysis/${doc.id}`)}
                    >
                      View
                    </Button>
                    {!doc.analysis_id && (
                      <Button 
                        size="sm"
                        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                        onClick={() => handleAnalyze(doc.id)}
                      >
                        Analyze
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentsTab;