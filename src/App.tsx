import React, { useState, useEffect, useRef } from "react";
import {
  Share2, RefreshCw, Menu, Sparkles, SlidersHorizontal, CheckCircle2, Check,
} from "lucide-react";

import { Website, SocialChannel, ScheduledPost } from "./types";
import Sidebar from "./components/Sidebar";
import AskAiPanel from "./components/AskAiPanel";
import DashboardOverview from "./components/DashboardOverview";
import ContentPlanner from "./components/ContentPlanner";
import ChannelsManager from "./components/ChannelsManager";
import IntegrationsManager from "./components/IntegrationsManager";

// Welke dashboard-widgets de gebruiker kan tonen/verbergen via "Customize Widget".
export type WidgetKey = "metrics" | "calendar" | "chart" | "leads" | "retention" | "locations";

const WIDGET_OPTIONS: { key: WidgetKey; label: string }[] = [
  { key: "metrics", label: "Statistiek-kaarten" },
  { key: "calendar", label: "Kalender" },
  { key: "chart", label: "Verkeer-grafiek" },
  { key: "leads", label: "Content-status" },
  { key: "retention", label: "Bereik per kanaal" },
  { key: "locations", label: "Top kanalen" },
];

const DEFAULT_WIDGETS: Record<WidgetKey, boolean> = {
  metrics: true, calendar: true, chart: true, leads: true, retention: true, locations: true,
};

const TAB_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  planner: "Planner & Publiceren",
  channels: "Sites & Socials",
  integrations: "Integraties",
};

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>("all");

  // Ask AI + Customize Widget UI-status.
  const [askAiOpen, setAskAiOpen] = useState<boolean>(false);
  const [customizeOpen, setCustomizeOpen] = useState<boolean>(false);
  const customizeRef = useRef<HTMLDivElement>(null);
  const [widgets, setWidgets] = useState<Record<WidgetKey, boolean>>(() => {
    try {
      const saved = localStorage.getItem("dashboard-widgets");
      return saved ? { ...DEFAULT_WIDGETS, ...JSON.parse(saved) } : DEFAULT_WIDGETS;
    } catch {
      return DEFAULT_WIDGETS;
    }
  });

  // Inlogmuur: sessiestatus.
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [authed, setAuthed] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>("");

  // Global data storage loaded from backend
  const [websites, setWebsites] = useState<Website[]>([]);
  const [socials, setSocials] = useState<SocialChannel[]>([]);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);

  const fetchGlobalData = async () => {
    try {
      const res = await fetch("/api/data");
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      if (res.ok) {
        const data = await res.json() as { websites?: Website[]; socials?: SocialChannel[]; posts?: ScheduledPost[] };
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

  // Controleer bij het laden of er een geldige sessie is.
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json() as Promise<{ authenticated?: boolean; email?: string }>)
      .then((d) => {
        if (d?.authenticated) {
          setAuthed(true);
          setUserEmail(d.email || "");
        }
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (authed) fetchGlobalData();
  }, [authed]);

  // Pas het thema toe op de HTML body.
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Bewaar widget-voorkeuren.
  useEffect(() => {
    try {
      localStorage.setItem("dashboard-widgets", JSON.stringify(widgets));
    } catch {
      /* negeer opslag-fouten */
    }
  }, [widgets]);

  // Sluit de customize-popover bij klik buiten het menu.
  useEffect(() => {
    if (!customizeOpen) return;
    const handler = (e: MouseEvent) => {
      if (customizeRef.current && !customizeRef.current.contains(e.target as Node)) {
        setCustomizeOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [customizeOpen]);

  const toggleTheme = () => setDarkMode((d) => !d);
  const toggleWidget = (key: WidgetKey) => setWidgets((w) => ({ ...w, [key]: !w[key] }));

  // Korte context voor de AI-assistent op basis van de geladen data.
  const aiContext = `Aantal gekoppelde websites: ${websites.length}. ` +
    `Aantal social-kanalen: ${socials.length}. ` +
    `Aantal geplande/gepubliceerde posts: ${posts.length}. ` +
    `Actief project-filter: ${selectedWebsiteId === "all" ? "Alle Brands" : websites.find((w) => w.id === selectedWebsiteId)?.name ?? selectedWebsiteId}.`;

  // Sessie wordt nog gecontroleerd.
  if (!authChecked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mb-4" />
        <h3 className="text-sm font-semibold tracking-wide">Sessie controleren...</h3>
      </div>
    );
  }

  // Inlogmuur: niet ingelogd -> toon het loginscherm.
  if (!authed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-white">
            <Share2 className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white">WebPublish Dashboard</h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Dit dashboard is afgeschermd. Log in met je toegestane Google-account om verder te gaan.
          </p>
          <a
            href="/auth/google?flow=login"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-md transition-all hover:bg-slate-100 active:scale-[0.98]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
              <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
            </svg>
            <span>Inloggen met Google</span>
          </a>
          <p className="mt-4 text-[10px] text-slate-500">
            Alleen geautoriseerde accounts hebben toegang.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mb-4" />
        <h3 className="text-sm font-semibold tracking-wide">WebPublish Dashboard laden...</h3>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans antialiased ${darkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"}`}>
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        websites={websites}
        selectedWebsiteId={selectedWebsiteId}
        onSelectWebsite={setSelectedWebsiteId}
        darkMode={darkMode}
        onToggleTheme={toggleTheme}
        userEmail={userEmail}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <AskAiPanel open={askAiOpen} onClose={() => setAskAiOpen(false)} context={aiContext} />

      {/* Hoofdgebied (naast de sidebar) */}
      <div className="md:pl-64">
        {/* Bovenbalk */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-slate-950/80">
          <div className="flex flex-col gap-3 px-4 py-3.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 md:hidden dark:border-white/10"
              >
                <Menu className="h-4 w-4" />
              </button>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {TAB_TITLES[activeTab] ?? "Dashboard"}
              </h1>

              {/* Ask AI + Customize Widget */}
              <div className="ml-2 flex items-center gap-2">
                <button
                  id="ask-ai-btn"
                  onClick={() => setAskAiOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Ask AI</span>
                </button>

                {activeTab === "dashboard" && (
                  <div className="relative" ref={customizeRef}>
                    <button
                      id="customize-widget-btn"
                      onClick={() => setCustomizeOpen((o) => !o)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/5"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      <span>Customize Widget</span>
                    </button>

                    {customizeOpen && (
                      <div className="absolute left-0 top-full z-40 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-slate-850">
                        <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Widgets tonen
                        </div>
                        {WIDGET_OPTIONS.map((opt) => (
                          <button
                            key={opt.key}
                            onClick={() => toggleWidget(opt.key)}
                            className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
                          >
                            <span>{opt.label}</span>
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded border ${
                                widgets[opt.key]
                                  ? "border-emerald-500 bg-emerald-500 text-white"
                                  : "border-slate-300 dark:border-white/20"
                              }`}
                            >
                              {widgets[opt.key] && <Check className="h-3 w-3" />}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Statusindicator rechts */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Laatst bijgewerkt nu</span>
              </div>
            </div>
          </div>
        </header>

        {/* Inhoud */}
        <main className="animate-fadeIn px-4 py-6 sm:px-6">
          {activeTab === "dashboard" && (
            <DashboardOverview
              darkMode={darkMode}
              onNavigate={(tab) => {
                setActiveTab(tab);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              selectedWebsiteId={selectedWebsiteId}
              websites={websites}
              widgets={widgets}
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
  );
}
