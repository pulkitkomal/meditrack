import { useState } from "react";
import { Link } from "react-router-dom";
import { authService } from "../../services/api";
import type { User } from "../../types";
import LegalModal from "../legal/LegalModal";

const MIN_PASSWORD_LENGTH = 8;

interface RegisterFormProps {
  setUser: (user: User) => void;
}

const RegisterForm = ({ setUser }: RegisterFormProps) => {
  const [form, setForm] = useState({ email: "", password: "", first_name: "", last_name: "" });
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const doRegister = async () => {
    setLoading(true);
    setError("");
    
    try {
      await authService.register({ ...form, accept_privacy_policy: acceptedPrivacy });
      await authService.login({ email: form.email, password: form.password });
      
      const userRes = await authService.getCurrentUser();
      setUser(userRes.data);
      
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 100);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Registration failed. Please check your details and try again.");
      setLoading(false);
    }
  };

  const inputStyle = "w-full px-4 py-3.5 rounded-glass border border-slate-200 bg-glass-light backdrop-blur-[8px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all";

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-[#f2f2f7]">
      {showPrivacy && <LegalModal document="privacy" onClose={() => setShowPrivacy(false)} />}
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-teal-600 rounded-glass-xl flex items-center justify-center mx-auto mb-4 shadow-glass-elevated">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-800">HealthSync</h1>
          <p className="text-slate-500 mt-1">Personal Health Records</p>
        </div>
        
        {/* Form Card */}
        <div className="glass-surface-xl p-8">
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
              placeholder="At least 8 characters"
              type="password"
              minLength={MIN_PASSWORD_LENGTH}
              value={form.password} 
              onChange={e => setForm({...form, password: e.target.value})}
              className={inputStyle}
            />
          </div>
          
          <label className="flex items-start gap-2 mb-6 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedPrivacy}
              onChange={e => setAcceptedPrivacy(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
            />
            <span>
              I agree to the{" "}
              <button type="button" onClick={() => setShowPrivacy(true)} className="text-teal-600 hover:underline">
                Privacy Policy
              </button>
              , including that my uploaded documents and assistant messages are processed by OpenAI to generate analyses.
            </span>
          </label>

          {error && (
            <div className="bg-red-50/80 text-red-600 p-3 rounded-glass text-sm text-center mb-4">
              {error}
            </div>
          )}
          
          <button
            type="button"
            onClick={doRegister}
            disabled={loading || !acceptedPrivacy || !form.email || form.password.length < MIN_PASSWORD_LENGTH || !form.first_name || !form.last_name}
            className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-glass shadow-glass hover:shadow-glass-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
