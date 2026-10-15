import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { analysisService, readingsService } from "../../services/api";
import { useReportDownload } from "./useReportDownload";
import { parseTimestamp } from "../../lib/dates";
import { latestOutOfRange, recordDate, type AnalysisRecord, type VitalRecord } from "../../lib/metrics";
import { CATEGORY_LABELS } from "./FileUpload";
import StatusBadge from "../ui/StatusBadge";
import { Skeleton } from "../ui/Skeleton";

interface OverviewTabProps {
  onNavigate?: (tab: string) => void;
  userConditions?: string[];
}

const ChevronIcon = () => (
  <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const AttentionRow = ({ tone, icon, children, onClick, href }: { tone: "red" | "amber" | "teal"; icon: string; children: React.ReactNode; onClick?: () => void; href?: string }) => {
  const toneClass = { red: "bg-red-50 text-red-700", amber: "bg-amber-50 text-amber-800", teal: "bg-teal-50 text-teal-700" }[tone];
  const body = (
    <>
      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${toneClass}`} aria-hidden="true">{icon}</span>
      <span className="flex-1 min-w-0 text-sm">{children}</span>
      <ChevronIcon />
    </>
  );
  const className = "w-full flex items-center gap-3 p-3 rounded-xl text-left hover:bg-slate-50 transition-colors";
  return href ? <Link to={href} className={className}>{body}</Link> : <button type="button" onClick={onClick} className={className}>{body}</button>;
};

const QuickAction = ({ icon, label, onClick, disabled }: { icon: string; label: string; onClick?: () => void; disabled?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="card-premium !p-4 flex flex-col items-center gap-2 text-center hover:border-teal-200 transition-colors disabled:opacity-60"
  >
    <span className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
      <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
      </svg>
    </span>
    <span className="text-sm font-medium text-slate-700">{label}</span>
  </button>
);

const OverviewTab = ({ onNavigate, userConditions = [] }: OverviewTabProps) => {
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [vitals, setVitals] = useState<VitalRecord[]>([]);
  const [activeTasks, setActiveTasks] = useState(0);
  const [failedTasks, setFailedTasks] = useState(0);
  const [loading, setLoading] = useState(true);
  const report = useReportDownload();

  useEffect(() => {
    Promise.allSettled([analysisService.getHistory(), readingsService.list(), analysisService.getTasks()]).then(([history, readings, tasks]) => {
      if (history.status === "fulfilled") setAnalyses(history.value.data || []);
      if (readings.status === "fulfilled") setVitals(readings.value.data || []);
      if (tasks.status === "fulfilled") {
        const list: Array<{ status: string }> = tasks.value.data.tasks || [];
        setActiveTasks(list.filter(t => t.status === "pending" || t.status === "processing").length);
        setFailedTasks(list.filter(t => t.status === "failed").length);
      }
      setLoading(false);
    });
  }, []);

  const flags = useMemo(() => latestOutOfRange(analyses), [analyses]);
  const lastReading = useMemo(() => {
    const times = vitals.map(v => parseTimestamp(v.timestamp)?.getTime() || 0);
    return times.length ? new Date(Math.max(...times)) : null;
  }, [vitals]);
  const recent = useMemo(() => [...analyses].sort((a, b) => recordDate(b).getTime() - recordDate(a).getTime()).slice(0, 4), [analyses]);

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto" role="status" aria-label="Loading">
        <div className="card-premium space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
        <div className="card-premium space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  const tracksVitals = userConditions.some(c => /diabet|hypertension|blood pressure|heart|kidney/i.test(c));
  const readingStale = !lastReading || Date.now() - lastReading.getTime() > 24 * 60 * 60 * 1000;
  const shownFlags = flags.slice(0, 4);
  const attentionCount = shownFlags.length + (activeTasks ? 1 : 0) + (failedTasks ? 1 : 0) + (tracksVitals && readingStale ? 1 : 0);

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <section className="card-premium" aria-labelledby="attention-heading">
        <div className="flex items-center justify-between mb-2">
          <h2 id="attention-heading" className="text-lg font-semibold text-slate-800">Needs attention</h2>
          {attentionCount > 0 && <span className="text-xs font-medium text-slate-500">{attentionCount} item{attentionCount === 1 ? "" : "s"}</span>}
        </div>

        {attentionCount === 0 ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50">
            <span className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-emerald-700 font-bold" aria-hidden="true">✓</span>
            <p className="text-sm text-emerald-800">
              {analyses.length ? "Nothing needs your attention right now." : "You're all set up. Add a record to start tracking."}
            </p>
          </div>
        ) : (
          <div className="-mx-1 space-y-0.5">
            {shownFlags.map(flag => (
              <AttentionRow key={`${flag.test}-${flag.documentId}`} tone={flag.status === "low" || flag.status === "abnormal" ? "amber" : "red"} icon={flag.status === "low" ? "↓" : flag.status === "high" ? "↑" : "!"} href={`/analysis/${flag.documentId}`}>
                <span className="flex flex-wrap items-center gap-x-2">
                  <span className="font-medium text-slate-800">{flag.test}</span>
                  <span className="text-slate-700">{flag.value} {flag.unit}</span>
                  <StatusBadge status={flag.status} />
                </span>
                <span className="block text-xs text-slate-500 truncate">
                  {flag.title} · {flag.date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </AttentionRow>
            ))}
            {flags.length > shownFlags.length && (
              <button type="button" onClick={() => onNavigate?.("insights")} className="ml-12 text-xs font-medium text-teal-700 hover:underline">
                +{flags.length - shownFlags.length} more out-of-range results in Insights
              </button>
            )}
            {activeTasks > 0 && (
              <AttentionRow tone="teal" icon="◷" onClick={() => onNavigate?.("documents")}>
                <span className="font-medium text-slate-800">Analysing {activeTasks} document{activeTasks === 1 ? "" : "s"}</span>
                <span className="block text-xs text-slate-500">Results appear in Records when ready</span>
              </AttentionRow>
            )}
            {failedTasks > 0 && (
              <AttentionRow tone="red" icon="✕" onClick={() => onNavigate?.("documents")}>
                <span className="font-medium text-slate-800">{failedTasks} analysis{failedTasks === 1 ? "" : "es"} failed</span>
                <span className="block text-xs text-slate-500">Open Records to retry</span>
              </AttentionRow>
            )}
            {tracksVitals && readingStale && (
              <AttentionRow tone="amber" icon="+" onClick={() => onNavigate?.("readings")}>
                <span className="font-medium text-slate-800">Log today's reading</span>
                <span className="block text-xs text-slate-500">
                  {lastReading ? `Last logged ${lastReading.toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : "No readings logged yet"}
                </span>
              </AttentionRow>
            )}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickAction icon="M12 4v16m8-8H4" label="Add record" onClick={() => onNavigate?.("documents")} />
        <QuickAction icon="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" label="Log reading" onClick={() => onNavigate?.("readings")} />
        <QuickAction icon="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" label="Ask assistant" onClick={() => onNavigate?.("chat")} />
        <QuickAction
          icon="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          label={report.downloading ? "Preparing…" : "Doctor report"}
          onClick={report.download}
          disabled={report.downloading}
        />
      </div>
      {report.error && <p role="alert" className="text-sm text-red-700 bg-red-50 p-3 rounded-xl">{report.error}</p>}

      <section className="card-premium" aria-labelledby="recent-heading">
        <div className="flex items-center justify-between mb-2">
          <h2 id="recent-heading" className="text-lg font-semibold text-slate-800">Recent records</h2>
          {analyses.length > 0 && (
            <button type="button" onClick={() => onNavigate?.("documents")} className="text-sm font-medium text-teal-700 hover:underline">
              View all
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-slate-500 mb-4">No analysed records yet.</p>
            <button type="button" onClick={() => onNavigate?.("documents")} className="btn-primary">Add your first record</button>
          </div>
        ) : (
          <ul className="-mx-1">
            {recent.map(a => {
              const abnormal = (a.extracted_data?.lab_values || []).filter(l => l.status && l.status.toLowerCase() !== "normal").length;
              return (
                <li key={a.id}>
                  <Link to={`/analysis/${a.document_id}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-800 truncate">{a.title || CATEGORY_LABELS[a.category] || "Record"}</span>
                      <span className="block text-xs text-slate-500">
                        {CATEGORY_LABELS[a.category] || a.category} · {recordDate(a).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                        {abnormal > 0 && <span className="text-amber-800"> · {abnormal} out of range</span>}
                      </span>
                    </span>
                    <ChevronIcon />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {userConditions.length === 0 && (
        <button type="button" onClick={() => onNavigate?.("profile")} className="w-full card-premium !p-4 text-left flex items-center gap-3 hover:border-teal-200">
          <span className="flex-1 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Add your conditions</span> to get metrics and reminders tailored to you.
          </span>
          <ChevronIcon />
        </button>
      )}
    </div>
  );
};

export default OverviewTab;
