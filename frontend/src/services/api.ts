import axios from "axios";

const api = axios.create({ baseURL: "/api" });

// Add request logging interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  
  console.log(`[FRONTEND-API] Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {
    data: config.data,
    params: config.params,
    headers: config.headers
  });
  return config;
});

// Add response logging interceptor
api.interceptors.response.use((response) => {
  console.log(`[FRONTEND-API] Response: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`, {
    data: response.data,
    status: response.status
  });
  return response;
}, (error) => {
  console.error(`[FRONTEND-API] Error: ${error.response?.status || 'NETWORK_ERROR'} ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
    error: error.response?.data || error.message
  });
  return Promise.reject(error);
});

export const authService = {
  register: (data: any) => api.post("/auth/register", data),
  login: (data: any) => api.post("/auth/login", data),
  logout: () => localStorage.removeItem("token"),
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
  chat: (message: string) => api.post("/analysis/chat", { message })
};

export const telegramService = {
  getConfig: () => api.get("/telegram/config"),
  updateConfig: (data: any) => api.put("/telegram/config", data),
  disconnect: () => api.post("/telegram/disconnect"),
  getReadings: (type?: string) => api.get("/telegram/readings", { params: type ? { type } : {} }),
  getSummary: () => api.get("/telegram/readings/summary"),
  generateLink: () => api.post("/users/telegram/generate-link")
};
