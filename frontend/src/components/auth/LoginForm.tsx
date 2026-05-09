import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../../services/api";
import type { User } from "../../types";

interface LoginFormProps {
  setUser: (user: User) => void;
}

const LoginForm = ({ setUser }: LoginFormProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await authService.login({ email, password });
      localStorage.setItem("token", res.data.access_token);
      const userRes = await authService.getCurrentUser();
      setUser(userRes.data);
      navigate("/dashboard");
    } catch {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Terms Modal */}
      {showTerms && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Terms & Conditions</h2>
              <button onClick={() => setShowTerms(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh] text-sm text-slate-600 space-y-4">
              <p className="text-slate-500 text-xs">Effective Date: May 8, 2026</p>
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">1. Acceptance of Terms</h3>
                <p>By accessing and using HealthSync, you agree to be bound by these Terms and Conditions.</p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">2. Description of Service</h3>
                <p>HealthSync provides a platform for managing personal health records with AI-powered document analysis, Telegram bot integration, and medical advisor chatbot.</p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">3. AI Health Advisor</h3>
                <p>The AI-powered medical advisor provides general health information only. <span className="font-semibold text-red-600">NOT a replacement for professional medical advice.</span></p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">4. Limitation of Liability</h3>
                <p>HealthSync is provided "as is" without warranties.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Privacy Policy</h2>
              <button onClick={() => setShowPrivacy(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh] text-sm text-slate-600 space-y-4">
              <p className="text-slate-500 text-xs">Effective Date: May 8, 2026</p>
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">1. Information We Collect</h3>
                <p>We collect name, email, profile information, health readings, and medical documents.</p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">2. How We Use Your Information</h3>
                <p>We use collected information to provide and maintain the Service, process documents, and generate health insights.</p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">3. Data Storage</h3>
                <p>Your data is stored on MongoDB with encryption. Medical documents use AWS S3 with encryption.</p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">4. Your Rights</h3>
                <p>You have the right to access, correct, delete your data, and withdraw consent.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Left Side - Premium Design */}
      <div className="hidden lg:flex lg:w-1/2 bg-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-white"></div>
        <div className="absolute top-20 left-20 w-32 h-32 bg-teal-100/50 rounded-full blur-3xl"></div>
        <div className="absolute bottom-32 right-16 w-48 h-48 bg-teal-50/50 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12">
          <div className="w-24 h-24 bg-teal-600 rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-teal-600/20">
            <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h2 className="text-4xl font-bold text-slate-800 mb-4">HealthSync</h2>
          <p className="text-lg text-slate-500 text-center max-w-md mb-8">Your personal health companion for managing medical records intelligently</p>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full">
              <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="text-sm text-slate-600">AI Analysis</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full">
              <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-sm text-slate-600">Secure</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
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
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-800">Welcome Back</h2>
              <p className="text-slate-500 mt-2">Sign in to access your health records</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 011-.908 6 6 0 011.908 0" />
                </svg>
                <input 
                  placeholder="Email address" 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none"
                />
              </div>
              <div className="relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input 
                  placeholder="Password" 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 bg-red-50 text-red-600 p-3 rounded-xl text-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}
              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl shadow-lg shadow-teal-600/20 transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-slate-500">Don't have an account? <Link to="/register" className="text-teal-600 font-semibold hover:underline">Create Account</Link></p>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-400">© {new Date().getFullYear()} HealthSync. All rights reserved.</p>
              <div className="flex justify-center gap-4 mt-2">
                <button onClick={() => setShowTerms(true)} className="text-sm text-slate-500 hover:text-teal-600">Terms & Conditions</button>
                <span className="text-slate-200">|</span>
                <button onClick={() => setShowPrivacy(true)} className="text-sm text-slate-500 hover:text-teal-600">Privacy Policy</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;