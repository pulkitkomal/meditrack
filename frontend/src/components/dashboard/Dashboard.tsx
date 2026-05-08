import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authService } from "../../services/api";
import type { User } from "../../types";
import OverviewTab from "./OverviewTab";
import DocumentsTab from "./DocumentsTab";
import InsightsTab from "./InsightsTab";
import ChatPage from "./ChatPage";
import ProfilePage from "./ProfilePage";
import ReadingsTab from "./ReadingsTab";
import BottomNav from "../ui/BottomNav";
import ChatWidget from "./ChatWidget";

type TabId = "overview" | "documents" | "insights" | "chat" | "profile" | "readings" | "add";

const getNavItems = (telegramConnected: boolean) => {
  const items = [
    { id: "overview", label: "Home", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { id: "readings", label: "Vitals", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    { id: "documents", label: "Records", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
    { id: "insights", label: "Insights", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    { id: "chat", label: "Assistant", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
    { id: "profile", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" }
  ];
  if (telegramConnected) return items;
  return items.filter(item => item.id !== "readings");
};

const Dashboard = ({ user, setUser }: { user: User; setUser: (u: User | null) => void }) => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>((searchParams.get("tab") as TabId) || "overview");
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
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
    if (tab && ["overview", "readings", "documents", "insights", "chat", "profile"].includes(tab)) {
      setActiveTab(tab as TabId);
    }
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    if (tab === "add") {
      setActiveTab("documents");
      navigate("?tab=documents", { replace: true });
      return;
    }
    if (tab === "chat" && !isMobile) {
      setChatOpen(true);
      return;
    }
    setActiveTab(tab as TabId);
    navigate(`?tab=${tab}`, { replace: true });
    setSidebarOpen(false);
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
        return isMobile ? <ChatPage /> : null;
      default:
        return <OverviewTab onNavigate={handleTabChange} />;
    }
  };

  const navItems = getNavItems(!!user.telegram_chat_id);

  if (activeTab === "chat" && isMobile) {
    return (
      <div className="h-screen flex flex-col bg-white">
        <ChatPage />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex w-full max-w-full overflow-x-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-100 flex-col fixed h-screen left-0 top-0 z-40">
        {/* Logo */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">HealthSync</h1>
              <p className="text-xs text-slate-400">Personal Health</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === item.id 
                  ? "bg-teal-50 text-teal-700" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
              </svg>
              {item.label}
            </button>
          ))}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
            <div className="w-9 h-9 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 font-semibold text-sm">
              {user.first_name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{user.first_name}</p>
              <button onClick={logout} className="text-xs text-slate-400 hover:text-red-500">Sign out</button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:ml-64 min-h-screen w-full max-w-full overflow-x-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-slate-100 sticky top-0 z-20">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <span className="font-bold text-slate-800">HealthSync</span>
            </div>
            <button 
              onClick={logout}
              className="p-2 hover:bg-slate-50 rounded-lg"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-white border-b border-slate-100">
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              {activeTab === "overview" && "Health at a Glance"}
              {activeTab === "readings" && "Your Vitals"}
              {activeTab === "documents" && "My Records"}
              {activeTab === "insights" && "Health Insights"}
              {activeTab === "chat" && "Health Assistant"}
              {activeTab === "profile" && "Settings"}
            </h1>
            <p className="text-sm text-slate-500">Welcome back, {user.first_name}</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setChatOpen(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Ask AI
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 w-full overflow-auto pb-20 md:pb-8">
          <div className="animate-fade-in w-full px-3 md:px-6 py-4 md:py-6">
            {renderTabContent()}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />}

      {/* Chat Widget - Desktop only */}
      {!isMobile && <ChatWidget isOpen={chatOpen} onToggle={() => setChatOpen(!chatOpen)} />}
    </div>
  );
};

export default Dashboard;