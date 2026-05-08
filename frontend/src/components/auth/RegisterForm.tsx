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
      setError(err.response?.data?.detail || "Registration failed. Please try again.");
      setLoading(false);
    }
  };

  const inputStyle = "w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none";

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-600/20">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-800">HealthSync</h1>
          <p className="text-slate-500 mt-1">Personal Health Records</p>
        </div>
        
        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-card p-8">
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">
            Create Account
          </h2>
          <p className="text-sm text-center text-slate-500 mb-6">
            Join HealthSync today
          </p>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">First Name</label>
              <input 
                placeholder="John"
                value={form.first_name} 
                onChange={e => setForm({...form, first_name: e.target.value})}
                className={inputStyle}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Last Name</label>
              <input 
                placeholder="Doe"
                value={form.last_name} 
                onChange={e => setForm({...form, last_name: e.target.value})}
                className={inputStyle}
              />
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input 
              placeholder="john@example.com"
              type="email"
              value={form.email} 
              onChange={e => setForm({...form, email: e.target.value})}
              className={inputStyle}
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <input 
              placeholder="••••••••"
              type="password"
              value={form.password} 
              onChange={e => setForm({...form, password: e.target.value})}
              className={inputStyle}
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Account Type</label>
            <select 
              value={form.role} 
              onChange={e => setForm({...form, role: e.target.value})}
              className={inputStyle}
            >
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
            </select>
          </div>
          
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm text-center mb-4">
              {error}
            </div>
          )}
          
          <button
            type="button"
            onClick={doRegister}
            disabled={loading || !form.email || !form.password || !form.first_name || !form.last_name}
            className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl shadow-lg shadow-teal-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </div>
        
        {/* Footer */}
        <p className="text-center mt-6 text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="text-teal-600 font-semibold hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterForm;