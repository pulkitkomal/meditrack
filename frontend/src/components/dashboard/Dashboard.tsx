import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authService } from "../../services/api";
import type { User } from "../../types";
import { Button } from "../ui/button";
import OverviewTab from "./OverviewTab";
import DocumentsTab from "./DocumentsTab";
import InsightsTab from "./InsightsTab";
import ChatPage from "./ChatPage";
import ChatWidget from "./ChatWidget";
import ProfilePage from "./ProfilePage";
import ReadingsTab from "./ReadingsTab";

type TabId = "overview" | "documents" | "insights" | "chat" | "profile" | "readings";

const baseNavItems: { id: TabId; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { id: "readings", label: "Readings", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { id: "documents", label: "Documents", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { id: "insights", label: "Insights", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" }
];

const mobileBaseNavItems: { id: TabId; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { id: "readings", label: "Readings", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { id: "documents", label: "Documents", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { id: "insights", label: "Insights", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { id: "chat", label: "Chat", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" }
];

const getNavItems = (telegramConnected: boolean) => {
  if (telegramConnected) return baseNavItems;
  return baseNavItems.filter(item => item.id !== "readings");
};

const getMobileNavItems = (telegramConnected: boolean) => {
  if (telegramConnected) return mobileBaseNavItems;
  return mobileBaseNavItems.filter(item => item.id !== "readings");
};

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

const Footer = ({ onShowTerms, onShowPrivacy }: { onShowTerms: () => void; onShowPrivacy: () => void }) => (
  <footer className="bg-white/60 backdrop-blur-sm border-t border-blue-100 px-6 py-4">
    <div className="flex flex-col md:flex-row items-center justify-between gap-2">
      <p className="text-sm text-gray-500">© {new Date().getFullYear()} HealthSync. All rights reserved.</p>
      <div className="flex gap-4 text-sm">
        <button onClick={onShowTerms} className="text-gray-500 hover:text-blue-600 transition-colors">Terms & Conditions</button>
        <span className="text-gray-300">|</span>
        <button onClick={onShowPrivacy} className="text-gray-500 hover:text-blue-600 transition-colors">Privacy Policy</button>
      </div>
    </div>
  </footer>
);

const Dashboard = ({ user, setUser }: { user: User; setUser: (u: User | null) => void }) => {
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabId) || "overview";
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [chatOpen, setChatOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && (tab === "overview" || tab === "readings" || tab === "documents" || tab === "insights" || tab === "chat" || tab === "profile")) {
      setActiveTab(tab as TabId);
    }
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabId);
    navigate(`?tab=${tab}`, { replace: true });
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    navigate("/login");
  };

  const handleUserUpdate = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const renderTabContent = () => {
    if (activeTab === "profile") {
      return <ProfilePage user={user} onBack={() => handleTabChange("overview")} onUpdate={handleUserUpdate} />;
    }

    switch (activeTab) {
      case "overview":
        return <OverviewTab onNavigate={handleTabChange} />;
      case "readings":
        return <ReadingsTab />;
      case "documents":
        return <DocumentsTab />;
      case "insights":
        return <InsightsTab />;
      case "chat":
        if (isMobile) {
          return <ChatPage />;
        }
        return null;
      default:
        return <OverviewTab onNavigate={handleTabChange} />;
    }
  };

  if (activeTab === "chat" && isMobile) {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <ChatPage />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Main Content */}
      <div className="flex flex-col min-h-screen">
        {/* Top Bar - Mobile only */}
        <header className="md:hidden flex flex-col bg-white/80 backdrop-blur-sm border-b border-blue-100">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <span className="font-bold text-gray-800">HealthSync</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleTabChange("profile")}
                className="p-2 hover:bg-blue-50 rounded-lg"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
              <button onClick={logout} className="text-gray-600 hover:text-red-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
          {/* Mobile Nav Tabs */}
          <div className="flex overflow-x-auto px-2 pb-2 gap-1">
            {getMobileNavItems(!!user.telegram_chat_id).map((item) => (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${
                  activeTab === item.id 
                    ? "bg-blue-500 text-white" 
                    : "text-gray-600 hover:bg-blue-50"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                {item.label}
              </button>
            ))}
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex flex-col bg-white/80 backdrop-blur-sm border-b border-blue-100">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">HealthSync</h1>
                <p className="text-xs text-gray-400">Personal Health Records</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => handleTabChange("profile")}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-sm text-gray-700">Profile</span>
              </button>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full">
                <div className="w-7 h-7 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {user.first_name?.[0]?.toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-700">{user.first_name}</span>
              </div>
              <Button variant="outline" onClick={logout} className="border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200">
                Logout
              </Button>
            </div>
          </div>
          {/* Desktop Nav Tabs */}
          <div className="flex px-6 pb-3 gap-2 border-t border-gray-100">
            {getNavItems(!!user.telegram_chat_id).map((item) => (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === item.id 
                    ? "bg-blue-500 text-white" 
                    : "text-gray-600 hover:bg-blue-50"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                {item.label}
              </button>
            ))}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-8 overflow-auto pb-20">
          {renderTabContent()}
        </main>

        <Footer onShowTerms={() => setShowTerms(true)} onShowPrivacy={() => setShowPrivacy(true)} />
      </div>

      {/* Chat Widget (Desktop only) */}
      {!isMobile && activeTab !== "chat" && activeTab !== "profile" && (
        <ChatWidget isOpen={chatOpen} onToggle={() => setChatOpen(!chatOpen)} />
      )}

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
    </div>
  );
};

export default Dashboard;