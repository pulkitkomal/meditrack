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

const Dashboard = ({ user, setUser }: { user: User; setUser: (u: User | null) => void }) => {
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
              <span className="font-bold text-gray-800">MediTrack</span>
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
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">MediTrack</h1>
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
        <main className="flex-1 p-4 md:p-8 overflow-auto">
          {renderTabContent()}
        </main>
      </div>

      {/* Chat Widget (Desktop only) */}
      {!isMobile && activeTab !== "chat" && activeTab !== "profile" && (
        <ChatWidget isOpen={chatOpen} onToggle={() => setChatOpen(!chatOpen)} />
      )}
    </div>
  );
};

export default Dashboard;