import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Login from "./components/auth/LoginForm";
import Register from "./components/auth/RegisterForm";
import Dashboard from "./components/dashboard/Dashboard";
import AnalysisPage from "./components/dashboard/AnalysisPage";
import type { User } from "./types";
import { authService } from "./services/api";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      authService.getCurrentUser()
        .then(res => setUser(res.data))
        .catch(() => localStorage.removeItem("token"))
        .finally(() => setLoading(false));
    } else setLoading(false);
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login setUser={setUser} />} />
        <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register setUser={setUser} />} />
        <Route path="/dashboard" element={user ? <Dashboard user={user} setUser={setUser} /> : <Navigate to="/login" />} />
        <Route path="/analysis/:docId" element={user ? <AnalysisPage /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;