import axios from "axios";

// Auth uses an httpOnly cookie set by the backend; never put tokens or response bodies in the console.
const api = axios.create({ baseURL: "/api", withCredentials: true });

api.interceptors.response.use((response) => response, (error) => {
  console.error(`[FRONTEND-API] Error: ${error.response?.status || 'NETWORK_ERROR'} ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
  return Promise.reject(error);
});

export const authService = {
  register: (data: any) => api.post("/auth/register", data),
  login: (data: any) => api.post("/auth/login", data),
  logout: () => api.post("/auth/logout"),
  logoutAll: () => api.post("/auth/logout-all"),
  exportData: () => api.get("/users/me/export", { responseType: "blob" }),
  downloadReport: () => api.get("/users/me/report", { responseType: "blob" }),
  deleteAccount: (password: string) => api.delete("/users/me", { data: { password } }),
  getCurrentUser: () => api.get("/users/me"),
  updateProfile: (data: any) => api.patch("/users/me", data)
};

export const documentService = {
  upload: (data: FormData) => api.post("/documents/upload", data),
  bulkUpload: (files: File[], category: string) => {
    const formData = new FormData();
    files.forEach(file => formData.append("files", file));
    formData.append("category", category);
    return api.post("/documents/bulk-upload", formData);
  },
  list: (params?: { category?: string; date_from?: string; date_to?: string; upload_from?: string; upload_to?: string }) => api.get("/documents/", { params: params || {} }),
  getFile: (docId: string) => api.get(`/documents/file/${docId}`, { responseType: 'blob' })
};

export const analysisService = {
  triggerAnalysis: (docId: string) => api.post(`/analysis/analyze/${docId}`),
  getAnalysis: (docId: string) => api.get(`/analysis/${docId}`),
  deleteAnalysis: (docId: string) => api.delete(`/analysis/${docId}`),
  getHistory: () => api.get("/analysis/history"),
  getSummary: () => api.get("/analysis/summary"),
  getDoctorQuestions: () => api.get("/analysis/doctor-questions"),
  getTrends: (category: string) => api.get(`/analysis/trends/${category}`),
  getUsageStats: () => api.get("/analysis/usage"),
  getUsageHistory: () => api.get("/analysis/usage/history"),
  getTasks: () => api.get("/analysis/tasks"),
  getTask: (taskId: string) => api.get(`/analysis/tasks/${taskId}`),
  deleteTask: (taskId: string) => api.delete(`/analysis/tasks/${taskId}`),
  processQueue: (maxTasks?: number) => api.post("/analysis/process-queue", { max_tasks: maxTasks }),
  chat: (message: string) => api.post("/analysis/chat", { message }),
  correctLabValue: (docId: string, index: number, data: LabValueUpdate) => api.put(`/analysis/${docId}/lab-values/${index}`, data)
};

export type ReadingType = "glucose" | "bp" | "weight";

export interface ReadingInput {
  type: ReadingType;
  value?: number;
  unit?: "mg/dL" | "mmol/L" | "kg";
  systolic?: number;
  diastolic?: number;
  timestamp?: string;
}

export interface LabValueUpdate {
  test?: string;
  value: number | string;
  unit?: string;
  reference_range?: string;
  status: "normal" | "high" | "low" | "critical";
}

export const readingsService = {
  list: (type?: ReadingType) => api.get("/readings/", { params: type ? { type } : {} }),
  summary: () => api.get("/readings/summary"),
  create: (data: ReadingInput) => api.post("/readings/", data),
  update: (id: string, data: ReadingInput) => api.put(`/readings/${id}`, data),
  remove: (id: string) => api.delete(`/readings/${id}`)
};

export const telegramService = {
  getConfig: () => api.get("/telegram/config"),
  updateConfig: (data: any) => api.put("/telegram/config", data),
  disconnect: () => api.post("/telegram/disconnect"),
  generateLink: () => api.post("/users/telegram/generate-link")
};
