import { useEffect, useState } from "react";
import { analysisService } from "../../services/api";

interface Task {
  id: string;
  document_id: string;
  user_id: string;
  category: string;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
}

interface TaskQueueProps {
  refreshTrigger?: number;
}

const STAGES = [
  { key: "queued", label: "Queued", percent: 10 },
  { key: "textraction", label: "Extracting Text", percent: 30 },
  { key: "imageconv", label: "Converting to Images", percent: 50 },
  { key: "aianalysis", label: "AI Analysis", percent: 75 },
  { key: "saving", label: "Saving Results", percent: 90 },
  { key: "complete", label: "Complete", percent: 100 },
];

export const TaskQueueStatus = ({ refreshTrigger }: TaskQueueProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      const res = await analysisService.getTasks();
      setTasks(res.data.tasks || []);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 3000);
    return () => clearInterval(interval);
  }, [refreshTrigger]);

  const processQueue = async () => {
    try {
      await analysisService.processQueue(5);
      fetchTasks();
    } catch (error) {
      console.error("Failed to process queue:", error);
    }
  };

const deleteTask = async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    try {
      await analysisService.deleteTask(taskId);
      fetchTasks();
    } catch (error: any) {
      console.error("Delete failed:", error.response?.data || error.message);
      alert("Failed to delete task");
    }
  };

  if (loading) {
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-blue-100">
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  const pendingTasks = tasks.filter(t => t.status === "pending");
  const processingTasks = tasks.filter(t => t.status === "processing");
  const failedTasks = tasks.filter(t => t.status === "failed");
  const completedTasks = tasks.filter(t => t.status === "completed");

  const getStageInfo = (status: string) => {
    switch (status) {
      case "pending":
        return STAGES[0];
      case "processing":
        return STAGES[3];
      case "completed":
        return STAGES[5];
      case "failed":
        return STAGES[4];
      default:
        return STAGES[0];
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-blue-100 overflow-hidden">
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-amber-500 to-orange-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Analysis Queue</h2>
              <p className="text-white/80 text-sm">{tasks.length} total</p>
            </div>
          </div>
          {(pendingTasks.length > 0 || processingTasks.length > 0) && (
            <button
              onClick={processQueue}
              className="px-4 py-2 bg-white text-amber-600 rounded-lg font-medium text-sm hover:bg-amber-50 transition-colors"
            >
              Process Now
            </button>
          )}
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">All Caught Up</h3>
          <p className="text-gray-600">No pending analyses</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {processingTasks.map(task => {
            const stage = getStageInfo(task.status);
            return (
              <div key={task.id} className="p-4 bg-blue-50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-blue-700">Processing</span>
                  </div>
                  <span className="text-sm font-bold text-blue-700">{stage.percent}%</span>
                </div>
                <div className="mb-2">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600 capitalize">{task.category.replace(/_/g, " ")}</span>
                    <span className="text-blue-600 font-medium">{stage.label}</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-500" 
                      style={{ width: `${stage.percent}%` }}
                    ></div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                  <span>Document: {task.document_id.slice(-8)}...</span>
                  <span>Started: {task.started_at ? new Date(task.started_at).toLocaleTimeString() : 'N/A'}</span>
                </div>
              </div>
            );
          })}

          {pendingTasks.length > 0 && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-600">Pending ({pendingTasks.length})</span>
              </div>
              <div className="space-y-2">
                {pendingTasks.map(task => (
                  <div key={task.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800 capitalize">{task.category.replace(/_/g, " ")}</p>
                        <p className="text-xs text-gray-500">Document ID: {task.document_id.slice(-8)}...</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">In queue</span>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {failedTasks.length > 0 && (
            <div className="p-4 bg-red-50">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-sm font-medium text-red-700">Failed ({failedTasks.length})</span>
              </div>
              <div className="space-y-2">
                {failedTasks.map(task => (
                  <div key={task.id} className="flex items-center justify-between py-2 border-b border-red-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800 capitalize">{task.category.replace(/_/g, " ")}</p>
                        <p className="text-xs text-red-600">{task.error || "Analysis failed"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => analysisService.triggerAnalysis(task.document_id)}
                        className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                      >
                        Retry
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {completedTasks.length > 0 && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-600">Completed ({completedTasks.length})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {completedTasks.slice(0, 5).map(task => (
                  <div key={task.id} className="flex items-center gap-1 px-2 py-1 bg-emerald-100 rounded-full">
                    <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-xs text-emerald-700 capitalize">{task.category.replace(/_/g, " ")}</span>
                  </div>
                ))}
                {completedTasks.length > 5 && (
                  <span className="text-xs text-gray-500">+{completedTasks.length - 5} more</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};