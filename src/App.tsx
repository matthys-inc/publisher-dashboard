import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, Calendar, Globe, Settings, Sun, Moon, Menu, X, 
  Share2, ArrowUpRight, CheckCircle2, Bot, Sliders, RefreshCw 
} from "lucide-react";

import { Website, SocialChannel, ScheduledPost } from "./types";
import DashboardOverview from "./components/DashboardOverview";
import ContentPlanner from "./components/ContentPlanner";
import ChannelsManager from "./components/ChannelsManager";
import IntegrationsManager from "./components/IntegrationsManager";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>("all");

  // Global data storage loaded from backend
  const [websites, setWebsites] = useState<Website[]>([]);
  const [socials, setSocials] = useState<SocialChannel[]>([]);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);

  const fetchGlobalData = async () => {
    try {
      const res = await fetch("/api/data");
      if (res.ok) {
        const data = await res.json();
        setWebsites(data.websites || []);
        setSocials(data.socials || []);
        setPosts(data.posts || []);
      }
    } catch (e) {
      console.error("Error reading global publishing data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalData();
    
    // Apply initial theme class to HTML body
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-505 mb-4" />
        <h3 className="text-sm font-semibold tracking-wide">WebPublish Dashboard laden...</h3>
        <p className="text-xs text-slate-500 font-mono mt-1">Systeem is aan het booten op poort 3000</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors ${
      darkMode ? "bg-slate-950 text-slate-100 dark" : "bg-slate-50/50 text-slate-800"
    }`}>
      
      {/* Upper Navigation Header bar */}
      <header className="sticky top-0 z-40 w-full border-b backdrop-blur-md bg-white/70 dark:bg-slate-950/70 border-slate-200/60 dark:border-slate-800/85">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-600 dark:bg-indigo-505 text-white flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                WebPublish
              </span>
              <span className="text-[9px] font-mono leading-none border border-slate-200 dark:border-slate-850 px-1 py-0.5 rounded ml-1.5 uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900">
                PRO v1.8
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick theme toggler */}
            <button
              id="theme-toggle-btn"
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-slate-205 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-500 dark:text-slate-400 transition-all shadow-sm"
              title={darkMode ? "Schakel over naar Licht Ontwerp" : "Schakel over naar Donker Ontwerp"}
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-550" />}
            </button>

            {/* Micro layout status indicator */}
            <div className="hidden md:flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/45 border border-emerald-100/50 dark:border-emerald-900/50 px-3 py-1.5 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-550 block animate-pulse"></span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-mono">
                API Engines Live
              </span>
            </div>

            {/* Mobile menu panel toggle */}
            <button
              id="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850 transition-all text-slate-700 dark:text-slate-355"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Framework Shell */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 transition-all">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          
          {/* Permanent Desktop Sidebar Selector */}
          <aside className="hidden md:block md:col-span-3 rounded-2xl border border-slate-205/50 dark:border-white/10 bg-white dark:bg-slate-900 p-5 space-y-2 select-none shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-gray-500 tracking-widest px-3 block mb-2 font-mono">
              Dashboard Menu
            </span>
            
            <button
              id="nav-tab-dashboard"
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all border ${
                activeTab === "dashboard"
                  ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-500/20 shadow-sm"
                  : "text-slate-500 dark:text-gray-400 hover:bg-slate-100/60 dark:hover:bg-white/5 border-transparent"
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Analyses &amp; Prestaties</span>
            </button>

            <button
              id="nav-tab-planner"
              onClick={() => setActiveTab("planner")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all border ${
                activeTab === "planner"
                  ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-500/20 shadow-sm"
                  : "text-slate-500 dark:text-gray-400 hover:bg-slate-100/60 dark:hover:bg-white/5 border-transparent"
              }`}
            >
              <Calendar className="w-4 h-4 shrink-0" />
              <span>Planner &amp; Publiceren</span>
            </button>

            <button
              id="nav-tab-channels"
              onClick={() => setActiveTab("channels")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all border ${
                activeTab === "channels"
                  ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-500/20 shadow-sm"
                  : "text-slate-500 dark:text-gray-400 hover:bg-slate-100/60 dark:hover:bg-white/5 border-transparent"
              }`}
            >
              <Globe className="w-4 h-4 shrink-0" />
              <span>Gekoppelde Sites &amp; Socials</span>
            </button>

            <button
              id="nav-tab-integrations"
              onClick={() => setActiveTab("integrations")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all border ${
                activeTab === "integrations"
                  ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-500/20 shadow-sm"
                  : "text-slate-500 dark:text-gray-400 hover:bg-slate-100/60 dark:hover:bg-white/5 border-transparent"
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>Sleutels &amp; Integraties</span>
            </button>

            {/* Embedded Mini Helper Section */}
            <div className="pt-4 border-t border-slate-150 dark:border-white/5 mt-4 px-1.5 space-y-2.5">
              <div className="flex items-center gap-1.5 text-slate-800 dark:text-gray-200 font-bold text-[11px]">
                <Bot className="w-3.5 h-3.5 text-emerald-400" />
                <span>Gemini Planner AI (Dutch)</span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-gray-500 leading-normal">
                Genereer SEO titels, sitemap keywords en geoptimaliseerde Twitter/LinkedIn previews direct in de planner tab!
              </p>
            </div>
          </aside>

          {/* Mobile Overlay Menu panel */}
          {mobileMenuOpen && (
            <div className="md:hidden col-span-1 border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 rounded-xl space-y-2 shadow-md animate-fadeIn">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider px-3 block">Menu</span>
              
              <button
                id="mob-tab-dashboard"
                onClick={() => { setActiveTab("dashboard"); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold ${
                  activeTab === "dashboard" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Analyses &amp; Prestaties</span>
              </button>

              <button
                id="mob-tab-planner"
                onClick={() => { setActiveTab("planner"); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold ${
                  activeTab === "planner" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Planner &amp; Publiceren</span>
              </button>

              <button
                id="mob-tab-channels"
                onClick={() => { setActiveTab("channels"); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold ${
                  activeTab === "channels" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>Gekoppelde Sites &amp; Socials</span>
              </button>

              <button
                id="mob-tab-integrations"
                onClick={() => { setActiveTab("integrations"); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold ${
                  activeTab === "integrations" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Sleutels &amp; Integraties</span>
              </button>
            </div>
          )}

          {/* Active Content Module (Right Area, spans 9 columns) */}
          <main className="md:col-span-9 animate-fadeIn">
            {/* Website / Brand Filter Ribbon */}
            <div className="mb-6 p-4 rounded-2xl border border-slate-205/60 dark:border-white/10 bg-white dark:bg-slate-900 select-none shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="space-y-0.5">
                  <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-gray-500 font-mono tracking-widest">
                    Actief Website / Brand Filter
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    Filter prestaties en geplande publicaties per gekoppeld domein.
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <button
                    id="brand-filter-all"
                    onClick={() => setSelectedWebsiteId("all")}
                    className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      selectedWebsiteId === "all"
                        ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-500/20 shadow-sm"
                        : "text-slate-500 bg-transparent border-slate-200 dark:border-white/5 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-white/5"
                    }`}
                  >
                    Alle Brands ({websites.length})
                  </button>
                  {websites.map((web) => (
                    <button
                      id={`brand-filter-${web.id}`}
                      key={web.id}
                      onClick={() => setSelectedWebsiteId(web.id)}
                      className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                        selectedWebsiteId === web.id
                          ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-500/20 shadow-sm"
                          : "text-slate-500 bg-transparent border-slate-200 dark:border-white/5 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5 shrink-0" />
                      <span>{web.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {activeTab === "dashboard" && (
              <DashboardOverview 
                darkMode={darkMode} 
                onNavigate={(tab) => {
                  setActiveTab(tab);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }} 
                selectedWebsiteId={selectedWebsiteId}
                websites={websites}
              />
            )}
            
            {activeTab === "planner" && (
              <ContentPlanner 
                darkMode={darkMode}
                websites={websites}
                socials={socials}
                posts={posts}
                onPostsUpdated={fetchGlobalData}
                selectedWebsiteId={selectedWebsiteId}
              />
            )}

            {activeTab === "channels" && (
              <ChannelsManager
                darkMode={darkMode}
                websites={websites}
                socials={socials}
                posts={posts}
                onWebsitesUpdated={fetchGlobalData}
              />
            )}

            {activeTab === "integrations" && (
              <IntegrationsManager 
                darkMode={darkMode}
                onCredentialsUpdated={fetchGlobalData}
              />
            )}
          </main>

        </div>
      </div>
    </div>
  );
}
