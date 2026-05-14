import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { documentService, analysisService } from "../../services/api";
import FileUpload, { BulkUpload } from "./FileUpload";
import { TaskQueueStatus } from "./TaskQueueStatus";
import type { Document } from "../../types";

interface DocWithAnalysis extends Document {
  analysis_id?: string;
  predicted_title?: string;
}

const categories = [
  { value: "", label: "All" },
  { value: "lab_results", label: "Lab Results" },
  { value: "prescriptions", label: "Prescriptions" },
  { value: "imaging", label: "Imaging" },
  { value: "vaccination_records", label: "Vaccinations" },
  { value: "discharge_summaries", label: "Discharge" },
  { value: "insurance_documents", label: "Insurance" }
];

const DocumentsTab = () => {
  const [docs, setDocs] = useState<DocWithAnalysis[]>([]);
  const [filter, setFilter] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [uploadRange] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const carouselRef = React.useRef<HTMLDivElement>(null);

  const analysisId = searchParams.get("analysis");
  useEffect(() => {
    if (analysisId) {
      navigate(`/analysis/${analysisId}`);
    }
  }, [analysisId, navigate]);

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

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 300;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Documents Carousel */}
      {docs.length > 0 && (
        <div className="card-premium">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Your Documents ({docs.length})</h3>
          </div>
          
          {/* Filters in Carousel */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setFilter(cat.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    filter === cat.value
                      ? "bg-teal-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-600"
            >
              <option value="">All Dates</option>
              <option value={`${new Date().toISOString().split('T')[0]}|${new Date().toISOString().split('T')[0]}`}>Today</option>
              <option value={`${new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]}|${new Date().toISOString().split('T')[0]}`}>7 Days</option>
              <option value={`${new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0]}|${new Date().toISOString().split('T')[0]}`}>30 Days</option>
            </select>
          </div>
          
          {/* Documents in Carousel */}
          <div className="relative">
            {/* Left Arrow - Desktop Only */}
            <button 
              onClick={() => scrollCarousel('left')}
              className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white border border-slate-200 rounded-full items-center justify-center shadow-md hover:bg-slate-50"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div ref={carouselRef} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide px-8">
              {docs.map((doc) => (
              <div 
                key={doc.id} 
                className="flex-shrink-0 w-56 p-4 bg-slate-50 rounded-xl border border-slate-100"
              >
                <div className="flex items-center justify-between mb-2">
                  {doc.analysis_id ? (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">Analyzed</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">Pending</span>
                  )}
                  <span className="text-xs text-slate-400 capitalize">{doc.category.replace('_', ' ')}</span>
                </div>
                <p className="text-sm font-medium text-slate-800 truncate mb-1">
                  {doc.predicted_title || doc.original_name}
                </p>
                <p className="text-xs text-slate-500 mb-3">
                  {doc.document_date ? new Date(doc.document_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                </p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => navigate(`/analysis/${doc.id}`)}
                    className="flex-1 px-2 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700"
                  >
                    View
                  </button>
                  {!doc.analysis_id && (
                    <button 
                      onClick={() => handleAnalyze(doc.id)}
                      className="flex-1 px-2 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700"
                    >
                      Analyze
                    </button>
                  )}
                  <button 
                    onClick={() => handleDelete(doc.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            </div>
            
            {/* Right Arrow - Desktop Only */}
            <button 
              onClick={() => scrollCarousel('right')}
              className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white border border-slate-200 rounded-full items-center justify-center shadow-md hover:bg-slate-50"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

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
    </div>
  );
};

export default DocumentsTab;