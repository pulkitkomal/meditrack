import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { documentService, analysisService } from "../../services/api";
import UploadPanel, { CATEGORY_LABELS } from "./FileUpload";
import { TaskQueueStatus } from "./TaskQueueStatus";
import { PageSkeleton } from "../ui/Skeleton";
import { parseRecordDate } from "../../lib/dates";
import type { Document } from "../../types";

interface DocWithAnalysis extends Document {
  analysis_id?: string;
  predicted_title?: string;
}

const FILTERS = [{ value: "", label: "All" }, ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))];

const displayTitle = (doc: DocWithAnalysis) => doc.predicted_title || doc.original_name;

const DocumentsTab = () => {
  const [docs, setDocs] = useState<DocWithAnalysis[]>([]);
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [queued, setQueued] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const analysisId = searchParams.get("analysis");
  useEffect(() => {
    if (analysisId) navigate(`/analysis/${analysisId}`);
  }, [analysisId, navigate]);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await documentService.list();
      setDocs(res.data);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleAnalyze = async (docId: string) => {
    try {
      await analysisService.triggerAnalysis(docId);
      setRefreshTrigger(r => r + 1);
    } catch (error) {
      console.error("Analysis failed:", error);
    }
  };

  const handleDelete = async (doc: DocWithAnalysis) => {
    if (!confirm(`Delete "${displayTitle(doc)}" and its analysis?`)) return;
    try {
      await analysisService.deleteAnalysis(doc.id);
      fetchDocs();
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const titles = useMemo(() => Object.fromEntries(docs.map(d => [d.id, displayTitle(d)])), [docs]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = docs.filter(d =>
      (!filter || d.category === filter) &&
      (!q || `${displayTitle(d)} ${d.original_name} ${CATEGORY_LABELS[d.category] || ""}`.toLowerCase().includes(q))
    );
    const byMonth = new Map<string, DocWithAnalysis[]>();
    for (const doc of visible) {
      const date = parseRecordDate(doc.document_date) || parseRecordDate(doc.upload_date);
      const key = date ? date.toLocaleDateString(undefined, { month: "long", year: "numeric" }) : "Undated";
      byMonth.set(key, [...(byMonth.get(key) || []), doc]);
    }
    return Array.from(byMonth.entries());
  }, [docs, filter, query]);

  if (loading) return <PageSkeleton cards={3} />;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <TaskQueueStatus refreshTrigger={refreshTrigger} titles={titles} onComplete={fetchDocs} onActiveChange={setQueued} />

      <UploadPanel onUpload={() => { fetchDocs(); setRefreshTrigger(r => r + 1); }} />

      <div className="card-premium">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <h3 className="font-semibold text-slate-800 shrink-0">Your records <span className="text-slate-400 font-normal">({docs.length})</span></h3>
          <label className="relative flex-1">
            <span className="sr-only">Search records</span>
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by title or type"
              className="input-premium !pl-9"
            />
          </label>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 scrollbar-hide" role="group" aria-label="Filter by type">
          {FILTERS.map(cat => (
            <button
              key={cat.value}
              type="button"
              aria-pressed={filter === cat.value}
              onClick={() => setFilter(cat.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filter === cat.value ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {docs.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-8">No records yet. Add your first one above.</p>
        ) : groups.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-8">No records match your search.</p>
        ) : (
          <div className="space-y-5">
            {groups.map(([month, items]) => (
              <section key={month}>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{month}</h4>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
                  {items.map(doc => {
                    const date = parseRecordDate(doc.document_date);
                    return (
                      <li key={doc.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors">
                        <button
                          type="button"
                          onClick={() => navigate(`/analysis/${doc.id}`)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <p className="text-sm font-medium text-slate-800 line-clamp-2">{displayTitle(doc)}</p>
                          <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2">
                            <span>{CATEGORY_LABELS[doc.category] || doc.category}</span>
                            {date && <span>· {date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>}
                            {doc.analysis_id ? (
                              <span className="text-emerald-700">· ✓ Analysed</span>
                            ) : queued.has(doc.id) ? (
                              <span className="text-teal-700">· ◷ Analysing…</span>
                            ) : (
                              <span className="text-amber-700">· ◷ Not analysed yet</span>
                            )}
                          </p>
                        </button>
                        {!doc.analysis_id && !queued.has(doc.id) && (
                          <button
                            type="button"
                            onClick={() => handleAnalyze(doc.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-teal-50 text-teal-700 hover:bg-teal-100 shrink-0"
                          >
                            Analyse
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(doc)}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                          aria-label={`Delete ${displayTitle(doc)}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentsTab;
