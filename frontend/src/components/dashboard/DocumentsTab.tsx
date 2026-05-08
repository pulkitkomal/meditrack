import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { documentService, analysisService } from "../../services/api";
import FileUpload, { BulkUpload } from "./FileUpload";
import { TaskQueueStatus } from "./TaskQueueStatus";
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
  const [dateRange, setDateRange] = useState("");
  const [uploadRange, setUploadRange] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const navigate = useNavigate();

  const fetchDocs = async (resetFilters = false) => {
    try {
      const params: any = {};
      
      if (!resetFilters) {
        if (filter) params.category = filter;
        
        // Parse date range (format: "from|to")
        if (dateRange) {
          const [from, to] = dateRange.split("|");
          if (from) params.date_from = from;
          if (to) params.date_to = to;
        }
        if (uploadRange) {
          const [from, to] = uploadRange.split("|");
          if (from) params.upload_from = from;
          if (to) params.upload_to = to;
        }
      }
      
      const res = await documentService.list(params);
      setDocs(res.data);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [filter, dateRange, uploadRange]);

  const processQueue = async () => {
    try {
      await analysisService.processQueue(5);
      setRefreshTrigger(r => r + 1);
    } catch (error) {
      console.error("Failed to process queue:", error);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      processQueue();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAnalyze = async (docId: string) => {
    try {
      await analysisService.triggerAnalysis(docId);
      setRefreshTrigger(r => r + 1);
    } catch (error) {
      console.error("Analysis failed:", error);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Delete this analysis and document?")) return;
    try {
      await analysisService.deleteAnalysis(docId);
      fetchDocs();
      setRefreshTrigger(r => r + 1);
    } catch (error) {
      console.error("Delete failed:", error);
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
    <div className="space-y-4 md:space-y-6">
      {/* Upload Section - Stack on mobile, grid on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 md:p-6 shadow-lg border border-blue-100">
          <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4">Single Upload</h2>
          <FileUpload onUpload={() => { 
            fetchDocs(true); 
            setRefreshTrigger(r => r + 1); 
          }} />
        </div>
        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 md:p-6 shadow-lg border border-blue-100">
          <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4">Bulk Upload</h2>
          <BulkUpload onUpload={() => { 
            fetchDocs(true); 
            setRefreshTrigger(r => r + 1); 
          }} />
        </div>
      </div>

      {/* Analysis Queue Status */}
      <TaskQueueStatus refreshTrigger={refreshTrigger} />

      {/* Filter */}
      <div className="bg-white/90 backdrop-blur-sm rounded-xl p-3 md:p-4 shadow-lg border border-blue-100">
        <div className="flex flex-col gap-3">
          {/* Category Filter - Horizontal scroll on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 -mx-2 px-2 md:px-0">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setFilter(cat.value)}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-colors ${
                  filter === cat.value
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                    : "bg-white/90 text-gray-600 hover:bg-gray-50 border border-gray-200"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          
          {/* Date Filters - Stack on mobile */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full sm:w-auto px-2 md:px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Doc Date: All</option>
              <option value={`${new Date().toISOString().split('T')[0]}|${new Date().toISOString().split('T')[0]}`}>Today</option>
              <option value={`${new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]}|${new Date().toISOString().split('T')[0]}`}>Last 7 Days</option>
              <option value={`${new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0]}|${new Date().toISOString().split('T')[0]}`}>Last 30 Days</option>
              <option value={`${new Date(Date.now() - 90*24*60*60*1000).toISOString().split('T')[0]}|${new Date().toISOString().split('T')[0]}`}>Last 90 Days</option>
              <option value={`${new Date(Date.now() - 365*24*60*60*1000).toISOString().split('T')[0]}|${new Date().toISOString().split('T')[0]}`}>This Year</option>
            </select>
            <select
              value={uploadRange}
              onChange={(e) => setUploadRange(e.target.value)}
              className="w-full sm:w-auto px-2 md:px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Upload: All</option>
              <option value={`${new Date().toISOString().split('T')[0]}|${new Date().toISOString().split('T')[0]}`}>Today</option>
              <option value={`${new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]}|${new Date().toISOString().split('T')[0]}`}>Last 7 Days</option>
              <option value={`${new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0]}|${new Date().toISOString().split('T')[0]}`}>Last 30 Days</option>
              <option value={`${new Date(Date.now() - 90*24*60*60*1000).toISOString().split('T')[0]}|${new Date().toISOString().split('T')[0]}`}>Last 90 Days</option>
              <option value={`${new Date(Date.now() - 365*24*60*60*1000).toISOString().split('T')[0]}|${new Date().toISOString().split('T')[0]}`}>This Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-blue-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : docs.length === 0 ? (
          <div className="p-6 md:p-8 text-center">
            <div className="w-12 md:w-16 h-12 md:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
              <svg className="w-6 md:w-8 h-6 md:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-2">No Documents Found</h3>
            <p className="text-sm md:text-base text-gray-600">
              {filter ? `No ${filter.replace('_', ' ')} documents yet` : "Upload your first document to get started"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {docs.map((doc) => (
              <div key={doc.id} className="p-3 md:p-4 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Document Info */}
                  <div className="flex items-start gap-3 md:gap-4 min-w-0">
                    <div className={`w-8 md:w-10 h-8 md:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      doc.category === 'lab_results' ? 'bg-blue-100' :
                      doc.category === 'prescriptions' ? 'bg-purple-100' :
                      doc.category === 'imaging' ? 'bg-green-100' :
                      doc.category === 'vaccination_records' ? 'bg-amber-100' :
                      'bg-gray-100'
                    }`}>
                      <svg className={`w-4 md:w-5 h-4 md:h-5 ${
                        doc.category === 'lab_results' ? 'text-blue-600' :
                        doc.category === 'prescriptions' ? 'text-purple-600' :
                        doc.category === 'imaging' ? 'text-green-600' :
                        doc.category === 'vaccination_records' ? 'text-amber-600' :
                        'text-gray-600'
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={categoryIcons[doc.category] || categoryIcons.lab_results} />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 text-sm md:text-base truncate">{doc.original_name}</p>
                      <div className="flex flex-wrap items-center gap-1 md:gap-2 text-xs md:text-sm text-gray-500">
                        <span className="capitalize">{doc.category.replace('_', ' ')}</span>
                        {doc.upload_date && (
                          <>
                            <span>•</span>
                            <span className="truncate">Uploaded: {new Date(doc.upload_date).toLocaleDateString()}</span>
                          </>
                        )}
                        {doc.document_date && (
                          <>
                            <span>•</span>
                            <span className="truncate">Doc: {new Date(doc.document_date).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 ml-11 sm:ml-0">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate(`/analysis/${doc.id}`)}
                      className="text-xs md:text-sm"
                    >
                      View
                    </Button>
                    {!doc.analysis_id && (
                      <Button 
                        size="sm"
                        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-xs md:text-sm"
                        onClick={() => handleAnalyze(doc.id)}
                      >
                        Analyze
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                      onClick={() => handleDelete(doc.id)}
                    >
                      <svg className="w-3 md:w-4 h-3 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </Button>
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