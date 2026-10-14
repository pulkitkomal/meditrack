import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import Login from "./components/auth/LoginForm";
import Register from "./components/auth/RegisterForm";

const Dashboard = lazy(() => import("./components/dashboard/Dashboard"));
const AnalysisPage = lazy(() => import("./components/dashboard/AnalysisPage"));
import type { User } from "./types";
import { authService } from "./services/api";

const AppContent = ({ user, setUser }: { user: User | null; setUser: (u: User | null) => void }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // Restore the session from the auth cookie on load
  useEffect(() => {
    localStorage.removeItem("token"); // tokens from before cookie auth
    authService.getCurrentUser()
      .then(res => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // Redirect if needed
  useEffect(() => {
    if (loading) return;
    
    // Get current path
    const path = window.location.pathname;
    
    // If no user and not on login/register, go to login
    if (!user && path !== "/login" && path !== "/register") {
      navigate("/login", { replace: true });
    }
  }, [user, loading, navigate]);

  const loadingScreen = (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      Loading...
    </div>
  );

  if (loading) {
    return loadingScreen;
  }

  return (
    <Suspense fallback={loadingScreen}>
    <Routes>
      <Route path="/login" element={!user ? <Login setUser={setUser} /> : <Navigate to="/dashboard" />} />
      <Route path="/register" element={!user ? <Register setUser={setUser} /> : <Navigate to="/dashboard" />} />
      <Route path="/dashboard" element={user ? <Dashboard user={user} setUser={setUser} /> : <Navigate to="/login" />} />
      <Route path="/analysis/:docId" element={user ? <AnalysisPage /> : <Navigate to="/login" />} />
      <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
    </Routes>
    </Suspense>
  );
};

function App() {
  const [user, setUser] = useState<User | null>(null);

  return (
    <BrowserRouter>
      <AppContent user={user} setUser={setUser} />
    </BrowserRouter>
  );
}

export default App;