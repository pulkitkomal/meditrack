import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../../services/api";
import type { User } from "../../types";

interface LoginFormProps {
  setUser: (user: User) => void;
}

const TERMS_CONTENT = `Terms and Conditions

Effective Date: May 8, 2026

1. Acceptance of Terms

By accessing and using HealthSync ("the Service"), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our Service.

2. Description of Service

HealthSync provides a platform for managing personal health records with the following features:
- Upload and storage of medical documents (PDF, JPG, PNG)
- AI-powered analysis of medical documents
- Telegram bot integration for tracking blood glucose and blood pressure readings
- Health insights and trend analysis
- Medical advisor chatbot for general health information

3. User Accounts

- You must provide accurate information when creating an account
- You are responsible for maintaining the confidentiality of your login credentials
- You must be at least 18 years old to use this Service
- You are solely responsible for all activities under your account

4. Medical Document Storage

- HealthSync stores your medical documents securely using AWS S3 cloud storage
- Documents are encrypted and protected using industry-standard security measures
- You retain full ownership of all documents you upload
- We do not share your documents with third parties without your explicit consent

5. AI Health Advisor

- The AI-powered medical advisor provides general health information only
- This Service does NOT provide medical diagnoses, treatment recommendations, or professional medical advice
- Always consult a qualified healthcare professional for medical decisions
- HealthSync and its creators are not liable for any decisions made based on AI responses

6. Telegram Bot Usage

- When connecting Telegram, you authorize HealthSync to receive and process messages
- You can log blood glucose readings (e.g., "150") and blood pressure (e.g., "120/80")
- Photo submissions are analyzed for meter readings
- Reminder settings are stored for your convenience

7. Data Storage and Security

- Your data is stored on MongoDB database services
- Files are stored using AWS S3 with encryption
- We implement appropriate technical and organizational measures to protect your data
- You can request deletion of your data at any time

8. User Responsibilities

You agree to:
- Not use the Service for any illegal purposes
- Not upload malicious files or content
- Not attempt to gain unauthorized access to other accounts or systems
- Comply with all applicable laws and regulations
- Provide accurate and truthful information

9. Limitation of Liability

HealthSync is provided "as is" without warranties of any kind. We are not liable for:
- Any damages arising from the use of the Service
- Any inaccuracies in AI-generated health information
- Any loss of data (though we take reasonable precautions)
- Decisions made based on the Service's outputs

10. Termination

- We reserve the right to terminate accounts that violate these terms
- You may delete your account and request data removal at any time
- Upon termination, we will remove your data within 30 days

11. Changes to Terms

We may update these terms periodically. Changes will be effective upon posting on the Service. Continued use constitutes acceptance of updated terms.

12. Governing Law

These terms are governed by applicable laws. Any disputes shall be resolved through appropriate legal channels.

Contact: For questions about these terms, please contact support through the application.`;

const PRIVACY_CONTENT = `Privacy Policy

Effective Date: May 8, 2026

1. Information We Collect

Personal Information:
- Name and email address (provided during registration)
- Profile information (age, gender, blood type, medical conditions, allergies)
- Health readings data (blood glucose, blood pressure)
- Telegram chat ID (if connected)

Medical Documents:
- Uploaded files (PDF, images)
- Document metadata (upload date, category)
- AI analysis results

2. How We Use Your Information

We use collected information to:
- Provide and maintain the Service
- Process and analyze uploaded medical documents
- Generate health insights and trends
- Send reminders (if Telegram is connected)
- Improve our AI models and service quality
- Communicate important updates

3. Data Storage

Your data is stored using:
- MongoDB: User accounts, health readings, analysis history
- AWS S3: Medical documents and files (encrypted)

All medical data is encrypted at rest and in transit.

4. Third-Party Services

We use the following third-party services:
- OpenAI: For AI document analysis and chatbot functionality
- Telegram: For the health tracking bot (if you choose to connect)

These services have their own privacy policies. We encourage you to review them.

5. Data Security

We implement security measures including:
- SSL/TLS encryption for all data transmission
- Encrypted storage for documents on AWS S3
- Secure authentication using JWT tokens
- Regular security assessments

6. Your Rights

You have the right to:
- Access your personal data
- Request correction of inaccurate data
- Request deletion of your account and all associated data
- Export your data in a portable format
- Withdraw consent for Telegram integration

7. Data Retention

- Account data is retained while your account is active
- Medical documents are retained as long as you wish to keep them
- Upon account deletion, all data is removed within 30 days
- Health readings history can be deleted on request

8. Cookies

We use minimal cookies for:
- Authentication (session management)
- Remembering your preferences

No tracking or advertising cookies are used.

9. Children's Privacy

Our Service is not intended for users under 18 years of age. We do not knowingly collect information from minors.

10. Data Sharing

We do NOT:
- Sell your personal information
- Share medical documents with third parties
- Use your data for advertising purposes

We may share aggregated, non-identifiable data for service improvement.

11. Contact Information

For privacy-related concerns or data requests:
- Use the in-app support feature
- Contact us through the application

We will respond to requests within 30 days.

12. Data Breach Notification

In the event of a data breach that affects your personal information, we will notify you within 72 hours of discovery.`;

const TermsModal = ({ onClose }: { onClose: () => void }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-500 to-purple-600">
        <h2 className="text-xl font-bold text-white">Terms & Conditions</h2>
        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="p-6 overflow-y-auto max-h-[60vh]">
        <pre className="text-gray-700 text-sm whitespace-pre-wrap font-sans leading-relaxed">{TERMS_CONTENT}</pre>
      </div>
    </div>
  </div>
);

const PrivacyModal = ({ onClose }: { onClose: () => void }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-500 to-purple-600">
        <h2 className="text-xl font-bold text-white">Privacy Policy</h2>
        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="p-6 overflow-y-auto max-h-[60vh]">
        <pre className="text-gray-700 text-sm whitespace-pre-wrap font-sans leading-relaxed">{PRIVACY_CONTENT}</pre>
      </div>
    </div>
  </div>
);

const LoginForm = ({ setUser }: LoginFormProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await authService.login({ email, password });
      localStorage.setItem("token", res.data.access_token);
      const userRes = await authService.getCurrentUser();
      setUser(userRes.data);
      navigate("/dashboard");
    } catch {
      setError("Invalid credentials");
    }
  };

  return (
    <div className="min-h-screen flex">
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}

      {/* Left Side - Graphics */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-32 right-16 w-48 h-48 bg-purple-300/20 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-blue-300/20 rounded-full blur-2xl"></div>
        </div>
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          <div className="w-32 h-32 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-8 shadow-2xl">
            <svg className="w-20 h-20 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h2 className="text-4xl font-bold mb-4 text-center">HealthSync</h2>
          <p className="text-xl text-white/80 text-center max-w-md mb-8">Your personal health companion for managing medical records intelligently</p>
          <div className="flex gap-6">
            <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.02-1.068-.03-1.117z" />
              </svg>
              <span className="text-sm">AI Analysis</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-sm">Secure</span>
            </div>
          </div>
        </div>
        <svg className="absolute bottom-0 left-0 w-full text-white/5" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path fill="currentColor" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,250.7C960,235,1056,181,1152,165.3C1248,149,1344,171,1392,181.3L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">HealthSync</h1>
            <p className="text-gray-500 mt-1">Personal Health Records</p>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/50">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800">Welcome Back</h2>
              <p className="text-gray-500 mt-2">Sign in to access your health records</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 011-.908 6 6 0 011.908 0" />
                </svg>
                <input 
                  placeholder="Email address" 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                />
              </div>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input 
                  placeholder="Password" 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
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
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/40"
              >
                Sign In
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-gray-500">Don't have an account? <Link to="/register" className="text-blue-600 font-semibold hover:underline">Create Account</Link></p>
            </div>

            {/* Footer inside form card */}
            <div className="mt-8 pt-6 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-500">© {new Date().getFullYear()} HealthSync. All rights reserved.</p>
              <div className="flex justify-center gap-4 mt-2 text-sm">
                <button onClick={() => setShowTerms(true)} className="text-gray-500 hover:text-blue-600 transition-colors">Terms & Conditions</button>
                <span className="text-gray-300">|</span>
                <button onClick={() => setShowPrivacy(true)} className="text-gray-500 hover:text-blue-600 transition-colors">Privacy Policy</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;