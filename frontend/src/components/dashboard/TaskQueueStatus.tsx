import { useCallback, useEffect, useRef, useState } from "react";
import { analysisService } from "../../services/api";

interface Task {
  id: string;
  document_id: string;
  category: string;
  status: "pending" | "processing" | "completed" | "failed";
  error: string | null;
}

interface TaskQueueProps {
  refreshTrigger?: number;
  titles?: Record<string, string>;
  onComplete?: () => void;
  onActiveChange?: (documentIds: Set<string>) => void;
}

export const TaskQueueStatus = ({ refreshTrigger, titles = {}, onComplete, onActiveChange }: TaskQueueProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const activeCount = useRef(0);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await analysisService.getTasks();
      const next: Task[] = res.data.tasks || [];
      const activeTasks = next.filter(t => t.status === "pending" || t.status === "processing");
      if (activeTasks.length < activeCount.current) onComplete?.();
      activeCount.current = activeTasks.length;
      onActiveChange?.(new Set(activeTasks.map(t => t.document_id)));
      setTasks(next);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    }
  }, [onComplete, onActiveChange]);

  const active = tasks.filter(t => t.status === "pending" || t.status === "processing");
  const failed = tasks.filter(t => t.status === "failed");

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks, refreshTrigger]);

  useEffect(() => {
    if (!active.length) return;
    const poll = setInterval(fetchTasks, 4000);
    const kick = setInterval(() => analysisService.processQueue(5).catch(() => {}), 15000);
    return () => { clearInterval(poll); clearInterval(kick); };
  }, [active.length, fetchTasks]);

  const retry = async (task: Task) => {
    await analysisService.triggerAnalysis(task.document_id).catch(() => {});
    fetchTasks();
  };

  const dismiss = async (task: Task) => {
    await analysisService.deleteTask(task.id).catch(() => {});
    fetchTasks();
  };

  if (!active.length && !failed.length) return null;

  const name = (t: Task) => titles[t.document_id] || t.category.replace(/_/g, " ");
  const processing = active.filter(t => t.status === "processing");

  return (
    <div className="card-premium !p-4 space-y-3" role="status" aria-live="polite">
      {active.length > 0 && (
        <div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 font-medium text-slate-800">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" aria-hidden="true" />
              Analysing {active.length} document{active.length === 1 ? "" : "s"}
            </span>
            <span className="text-xs text-slate-500">{processing.length} in progress · {active.length - processing.length} waiting</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-teal-500 animate-[progress_1.6s_ease-in-out_infinite]" />
          </div>
          <p className="mt-2 text-xs text-slate-500 truncate">{active.map(name).join(" · ")}</p>
        </div>
      )}

      {failed.map(task => (
        <div key={task.id} className="flex items-center justify-between gap-3 text-sm p-3 rounded-xl bg-red-50">
          <span className="min-w-0">
            <span className="font-medium text-red-700">✕ Analysis failed</span>
            <span className="text-slate-600"> — {name(task)}</span>
          </span>
          <span className="flex gap-2 shrink-0">
            <button type="button" onClick={() => retry(task)} className="px-3 py-1 text-xs font-medium rounded-lg bg-surface text-red-700 hover:bg-red-100">Retry</button>
            <button type="button" onClick={() => dismiss(task)} className="px-3 py-1 text-xs rounded-lg text-slate-500 hover:bg-red-100">Dismiss</button>
          </span>
        </div>
      ))}
    </div>
  );
};
