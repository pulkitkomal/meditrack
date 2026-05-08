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

const categoryColors: Record<string, { bg: string; text: string; icon: string }> = {
  lab_results: { bg: "bg-blue-50", text: "text-blue-600", icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" },
  prescriptions: { bg: "bg-purple-50", text: "text-purple-600", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" },
  imaging: { bg: "bg-emerald-50", text: "text-emerald-600", icon: "M6.827 6.175A2.31 2.31 0 015.344 7.103c0 1.98.742 3.881 1.908 5.341a8.985 8.985 0 012.287 4.153c.45.467.7 1.089.7 1.757v.536c0 .945-.38 1.813-1.006 2.4l-1.415 1.414a1 1 0 01-1.414 0l-1.414-1.414a2.31 2.31 0 01-2.4-1.006v-.536c0-.668.25-1.29.7-1.757a8.985 8.985 0 012.287-4.153 5.318 5.318 0 011.908-5.34 2.31 2.31 0 011.483-.828h0M12 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" },
  vaccination_records: { bg: "bg-amber-50", text: "text-amber-600", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.02-1.068-.03-1.117z" },
  discharge_summaries: { bg: "bg-rose-50", text: "text-rose-600", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  insurance_documents: { bg: "bg-slate-100", text: "text-slate-600", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" }
};

const DocumentCard = ({ doc, onAnalyze, onDelete }: { doc: DocWithAnalysis; onAnalyze: () => void; onDelete: () => void }) => {
  const navigate = useNavigate();
  const colors = categoryColors[doc.category] || categoryColors.lab_results;
  
  return (
    <div className="group relative bg-white rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-all duration-300">
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 ${colors.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
          <svg className={`w-6 h-6 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={colors.icon} />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-slate-800 truncate">{doc.original_name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-0.5 ${colors.bg} ${colors.text} rounded-full text-xs font-medium capitalize`}>
              {doc.category.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
            {doc.upload_date && (
              <span>Uploaded {new Date(doc.upload_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
        <Button 
          variant="secondary" 
          size="sm"
          onClick={() => navigate(`/analysis/${doc.id}`)}
          className="flex-1"
        >
          View
        </Button>
        {!doc.analysis_id && (
          <Button 
            size="sm"
            onClick={onAnalyze}
            className="flex-1"
          >
            Analyze
          </Button>
        )}
        <Button 
          variant="ghost"
          size="sm"
          className="text-red-500 hover:bg-red-50 hover:text-red-600"
          onClick={onDelete}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </Button>
      </div>
    </div>
  );
};

const EmptyDocuments = ({ onUpload }: { onUpload: () => void }) => (
  <div className="text-center py-16 px-4">
    <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
      <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </div>
    <h3 className="text-xl font-semibold text-slate-800 mb-2">No Records Yet</h3>
    <p className="text-slate-500 mb-6 max-w-sm mx-auto">Start by uploading your first medical document to track and analyze your health data</p>
    <Button onClick={onUpload} className="btn-primary">
      Upload First Document
    </Button>
  </div>
);

const DocumentsTab = () => {
  const [docs, setDocs] = useState<DocWithAnalysis[]>([]);
  const [filter, setFilter] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [uploadRange] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchDocs = async (resetFilters = false) => {
    try {
      const params: any = {};
      
      if (!resetFilters) {
        if (filter) params.category = filter;
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

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        analysisService.processQueue(5).then(() => setRefreshTrigger(r => r + 1));
      } catch (e) {}
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAnalyze = async (docId: string) => {
    try {
      await analysisService.triggerAnalysis(docId);
      setRefreshTrigger(r => r + 1);
      setTimeout(() => fetchDocs(), 2000);
    } catch (error) {
      console.error("Analysis failed:", error);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Delete this document and its analysis?")) return;
    try {
      await analysisService.deleteAnalysis(docId);
      fetchDocs();
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const categories = [
    { value: "", label: "All" },
    { value: "lab_results", label: "Lab Results" },
    { value: "prescriptions", label: "Prescriptions" },
    { value: "imaging", label: "Imaging" },
    { value: "vaccination_records", label: "Vaccinations" },
    { value: "discharge_summaries", label: "Discharge" },
    { value: "insurance_documents", label: "Insurance" }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Upload Section */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card-premium">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Single Upload</h3>
              <p className="text-sm text-slate-500">Add one document at a time</p>
            </div>
          </div>
          <FileUpload onUpload={() => { fetchDocs(true); setRefreshTrigger(r => r + 1); }} />
        </div>
        <div className="card-premium">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Bulk Upload</h3>
              <p className="text-sm text-slate-500">Upload multiple files at once</p>
            </div>
          </div>
          <BulkUpload onUpload={() => { fetchDocs(true); setRefreshTrigger(r => r + 1); }} />
        </div>
      </div>

      {/* Analysis Queue Status */}
      <TaskQueueStatus refreshTrigger={refreshTrigger} />

      {/* Filter Bar */}
      <div className="card-premium !p-4">
        <div className="flex flex-col gap-4">
          {/* Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setFilter(cat.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  filter === cat.value
                    ? "bg-teal-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          
          {/* Date Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="">All Dates</option>
              <option value={`${new Date().toISOString().split('T')[0]}|${new Date().toISOString().split('T')[0]}`}>Today</option>
              <option value={`${new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]}|${new Date().toISOString().split('T')[0]}`}>Last 7 Days</option>
              <option value={`${new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0]}|${new Date().toISOString().split('T')[0]}`}>Last 30 Days</option>
              <option value={`${new Date(Date.now() - 365*24*60*60*1000).toISOString().split('T')[0]}|${new Date().toISOString().split('T')[0]}`}>This Year</option>
            </select>
            <span className="text-sm text-slate-400">{docs.length} documents</span>
          </div>
        </div>
      </div>

      {/* Documents Grid */}
      {docs.length === 0 ? (
        <EmptyDocuments onUpload={() => {}} />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {docs.map((doc) => (
            <DocumentCard 
              key={doc.id} 
              doc={doc} 
              onAnalyze={() => handleAnalyze(doc.id)}
              onDelete={() => handleDelete(doc.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentsTab;