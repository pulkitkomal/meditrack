import { useState } from "react";
import { Link } from "react-router-dom";
import { authService } from "../../services/api";
import type { User } from "../../types";

interface RegisterFormProps {
  setUser: (user: User) => void;
}

const RegisterForm = ({ setUser }: RegisterFormProps) => {
  const [form, setForm] = useState({ email: "", password: "", first_name: "", last_name: "", role: "patient" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const doRegister = async () => {
    setLoading(true);
    setError("");
    
    try {
      await authService.register(form);
      const loginRes = await authService.login({ email: form.email, password: form.password });
      localStorage.setItem("token", loginRes.data.access_token);
      
      const userRes = await authService.getCurrentUser();
      setUser(userRes.data);
      
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 100);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Registration failed");
      setLoading(false);
    }
  };

  const inputStyle = {
    height: "48px",
    padding: "0 16px",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    background: "#f9fafb",
    width: "100%",
    fontSize: "15px",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxSizing: "border-box" as const
  };

  return (
    <div style={{ 
      minHeight: "100vh", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 50%, #f3e8ff 100%)",
      padding: "20px"
    }}>
      <div style={{ width: "100%", maxWidth: "440px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ 
            width: "64px", 
            height: "64px", 
            background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)", 
            borderRadius: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: "0 4px 14px rgba(59, 130, 246, 0.4)"
          }}>
            <svg style={{ width: "32px", height: "32px", color: "white" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h1 style={{ 
            fontSize: "28px", 
            fontWeight: "800", 
            background: "linear-gradient(135deg, #2563eb 0%, #9333ea 100%)", 
            WebkitBackgroundClip: "text", 
            WebkitTextFillColor: "transparent",
            marginBottom: "4px"
          }}>MediTrack</h1>
          <p style={{ color: "#6b7280", fontSize: "15px" }}>Personal Health Records</p>
        </div>
        
        {/* Form Card */}
        <div style={{ 
          background: "white", 
          padding: "32px", 
          borderRadius: "16px", 
          boxShadow: "0 4px 24px -1px rgba(0, 0, 0, 0.08), 0 2px 8px -1px rgba(0, 0, 0, 0.04)",
          border: "1px solid #f3f4f6"
        }}>
          <h2 style={{ fontSize: "22px", fontWeight: "700", textAlign: "center", marginBottom: "8px", color: "#111827" }}>
            Create Account
          </h2>
          <p style={{ fontSize: "14px", textAlign: "center", color: "#6b7280", marginBottom: "28px" }}>
            Join MediTrack today
          </p>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#374151", marginBottom: "6px" }}>First Name</label>
              <input 
                placeholder="John"
                value={form.first_name} 
                onChange={e => setForm({...form, first_name: e.target.value})}
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)"; }}
                onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.boxShadow = "none"; }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#374151", marginBottom: "6px" }}>Last Name</label>
              <input 
                placeholder="Doe"
                value={form.last_name} 
                onChange={e => setForm({...form, last_name: e.target.value})}
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)"; }}
                onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.boxShadow = "none"; }}
              />
            </div>
          </div>
          
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#374151", marginBottom: "6px" }}>Email</label>
            <input 
              placeholder="john@example.com"
              type="email"
              value={form.email} 
              onChange={e => setForm({...form, email: e.target.value})}
              style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)"; }}
              onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.boxShadow = "none"; }}
            />
          </div>
          
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#374151", marginBottom: "6px" }}>Password</label>
            <input 
              placeholder="••••••••"
              type="password"
              value={form.password} 
              onChange={e => setForm({...form, password: e.target.value})}
              style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)"; }}
              onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.boxShadow = "none"; }}
            />
          </div>
          
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#374151", marginBottom: "6px" }}>Account Type</label>
            <select 
              value={form.role} 
              onChange={e => setForm({...form, role: e.target.value})}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
            </select>
          </div>
          
          {error && (
            <div style={{ 
              color: "#dc2626", 
              fontSize: "13px", 
              background: "#fef2f2", 
              padding: "12px", 
              borderRadius: "8px", 
              textAlign: "center", 
              marginBottom: "16px",
              border: "1px solid #fecaca"
            }}>
              {error}
            </div>
          )}
          
          <button
            type="button"
            onClick={doRegister}
            disabled={loading || !form.email || !form.password || !form.first_name || !form.last_name}
            style={{ 
              width: "100%", 
              height: "48px", 
              background: loading ? "#9ca3af" : "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)", 
              color: "white", 
              fontWeight: "600", 
              fontSize: "15px",
              borderRadius: "8px",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "transform 0.1s, box-shadow 0.2s",
              boxShadow: loading ? "none" : "0 4px 12px rgba(59, 130, 246, 0.3)"
            }}
            onMouseDown={(e) => !loading && (e.currentTarget.style.transform = "scale(0.98)")}
            onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
            onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <span style={{ width: "16px", height: "16px", border: "2px solid white", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}></span>
                Creating...
              </span>
            ) : "Create Account"}
          </button>
        </div>
        
        {/* Footer */}
        <p style={{ textAlign: "center", marginTop: "24px", color: "#6b7280", fontSize: "14px" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "#3b82f6", fontWeight: "600", textDecoration: "none" }}>
            Sign In
          </Link>
        </p>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default RegisterForm;