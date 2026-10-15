import { PageSkeleton } from "../ui/Skeleton";
import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authService } from "../../services/api";
import type { User } from "../../types";
import { useReportDownload } from "./useReportDownload";

const OverviewTab = lazy(() => import("./OverviewTab"));
const DocumentsTab = lazy(() => import("./DocumentsTab"));
const InsightsTab = lazy(() => import("./InsightsTab"));
const ChatPage = lazy(() => import("./ChatPage"));
const ProfilePage = lazy(() => import("./ProfilePage"));
const ReadingsTab = lazy(() => import("./ReadingsTab"));
import BottomNav from "../ui/BottomNav";
import ChatWidget from "./ChatWidget";

type TabId = "overview" | "documents" | "insights" | "chat" | "profile" | "readings" | "add";

const NAV_ITEMS = [
    { id: "overview", label: "Home", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { id: "readings", label: "Vitals", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
    { id: "documents", label: "Records", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
    { id: "insights", label: "Insights", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    { id: "chat", label: "Assistant", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
    { id: "profile", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" }
];

const Dashboard = ({ user, setUser }: { user: User; setUser: (u: User | null) => void }) => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>((searchParams.get("tab") as TabId) || "overview");
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const report = useReportDownload();
  const navigate = useNavigate();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
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

  const logout = async () => {
    await authService.logout().catch(() => {});
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
        return <OverviewTab onNavigate={handleTabChange} userConditions={user.medical_conditions || []} />;
      case "readings":
        return <ReadingsTab />;
      case "documents":
        return <DocumentsTab />;
      case "insights":
        return <InsightsTab userConditions={user.medical_conditions || []} glucoseUnit={user.glucose_unit} onNavigate={handleTabChange} />;
      case "chat":
        return isMobile ? <ChatPage onBack={() => handleTabChange("overview")} /> : null;
      default:
        return <OverviewTab onNavigate={handleTabChange} />;
    }
  };

  const navItems = NAV_ITEMS;

  if (activeTab === "chat" && isMobile) {
    return (
      <div className="h-[100dvh] flex flex-col bg-surface">
        <ChatPage onBack={() => handleTabChange("overview")} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex w-full max-w-full overflow-x-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col fixed h-screen left-0 top-0 z-40">
        <div className="glass-surface-xl rounded-none rounded-r-glass-xl border-l-0 border-glass-border my-2 ml-2 h-[calc(100vh-16px)] w-64 flex flex-col">
          {/* Logo */}
          <div className="p-5 border-b border-glass-border-subtle">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-600 rounded-glass flex items-center justify-center shadow-glass">
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
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-glass text-sm font-medium transition-all duration-200 ${
                  activeTab === item.id 
                    ? "bg-glass-tint-hover text-teal-700 shadow-glass-inset" 
                    : "text-slate-500 hover:bg-glass-tint hover:text-slate-700"
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
          <div className="p-3 border-t border-glass-border-subtle">
            <div className="flex items-center gap-3 p-3 rounded-glass bg-glass-tint">
              <div className="w-9 h-9 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 font-semibold text-sm">
                {user.first_name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{user.first_name}</p>
                <button onClick={logout} className="text-xs text-slate-400 hover:text-red-500">Sign out</button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-[272px] min-h-screen w-full max-w-full overflow-x-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-20">
          <div className="glass-surface-xl rounded-none mx-0 mt-0 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-teal-600 rounded-glass-sm flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <span className="font-bold text-slate-800">HealthSync</span>
              </div>
              <button
                onClick={() => handleTabChange("profile")}
                className="p-2 hover:bg-glass-tint rounded-glass-sm"
                aria-label="Settings and account"
              >
                <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-between px-8 py-4">
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
          <div className="flex items-center gap-3">
            {report.error && <span role="alert" className="text-sm text-red-500">{report.error}</span>}
            <button
              onClick={report.download}
              disabled={report.downloading}
              className="btn-secondary flex items-center gap-2 disabled:opacity-60"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {report.downloading ? "Preparing..." : "Doctor report"}
            </button>
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
        <main className="flex-1 w-full overflow-auto pb-[calc(6rem+env(safe-area-inset-bottom))] scroll-pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8 md:scroll-pb-0">
          <div className="animate-fade-in w-full px-3 md:px-6 py-4 md:py-6">
            <Suspense fallback={<PageSkeleton cards={2} />}>
              {renderTabContent()}
            </Suspense>
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
