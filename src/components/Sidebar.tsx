import React, { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard, CalendarDays, Globe, KeyRound, Settings, HelpCircle,
  ChevronsUpDown, Check, Sun, Moon, LogOut, Share2, Folder, X,
} from "lucide-react";

import { Website } from "../types";

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "planner", label: "Planner", icon: CalendarDays },
  { id: "channels", label: "Sites & Socials", icon: Globe },
  { id: "integrations", label: "Integraties", icon: KeyRound },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  websites: Website[];
  selectedWebsiteId: string;
  onSelectWebsite: (id: string) => void;
  darkMode: boolean;
  onToggleTheme: () => void;
  userEmail: string;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({
  activeTab, onTabChange, websites, selectedWebsiteId, onSelectWebsite,
  darkMode, onToggleTheme, userEmail, mobileOpen, onCloseMobile,
}: SidebarProps) {
  const [projectOpen, setProjectOpen] = useState(false);
  const projectRef = useRef<HTMLDivElement>(null);

  const activeWebsite = websites.find((w) => w.id === selectedWebsiteId);
  const projectLabel = selectedWebsiteId === "all" ? "Alle Brands" : activeWebsite?.name ?? "Selecteer";

  // Sluit de project-dropdown bij klik buiten het menu.
  useEffect(() => {
    if (!projectOpen) return;
    const handler = (e: MouseEvent) => {
      if (projectRef.current && !projectRef.current.contains(e.target as Node)) {
        setProjectOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [projectOpen]);

  const selectProject = (id: string) => {
    onSelectWebsite(id);
    setProjectOpen(false);
  };

  return (
    <>
      {/* Mobiele overlay */}
      <div
        onClick={onCloseMobile}
        className={`fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm transition-opacity md:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-300 dark:border-white/10 dark:bg-slate-900 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand-koptekst */}
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white">
              <Share2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-sm font-bold leading-tight text-slate-900 dark:text-white">WebPublish</div>
              <div className="text-[11px] leading-tight text-slate-400">Publisher Suite</div>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 md:hidden dark:hover:bg-white/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Project-toggle (vervangt de "Mesh"-knop) */}
        <div className="px-3 pb-3" ref={projectRef}>
          <div className="relative">
            <button
              id="project-toggle"
              onClick={() => setProjectOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition hover:border-slate-300 dark:border-white/10 dark:bg-slate-950/40 dark:hover:border-white/20"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
                  <Folder className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-400">Project</span>
                  <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {projectLabel}
                  </span>
                </span>
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
            </button>

            {projectOpen && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-slate-850">
                <button
                  onClick={() => selectProject("all")}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
                >
                  <span className="flex items-center gap-2">
                    <Folder className="h-3.5 w-3.5 text-slate-400" /> Alle Brands ({websites.length})
                  </span>
                  {selectedWebsiteId === "all" && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                </button>
                {websites.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => selectProject(w.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Globe className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{w.name}</span>
                    </span>
                    {selectedWebsiteId === w.id && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                  </button>
                ))}
                {websites.length === 0 && (
                  <div className="px-2.5 py-2 text-[11px] text-slate-400">Nog geen brands gekoppeld.</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigatie */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          <div className="px-2 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Menu
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => {
                  onTabChange(item.id);
                  onCloseMobile();
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Onderkant: thema, account, hulp */}
        <div className="space-y-1 border-t border-slate-100 p-3 dark:border-white/10">
          <button
            onClick={onToggleTheme}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
          >
            {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            <span>{darkMode ? "Licht thema" : "Donker thema"}</span>
          </button>
          <button
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
          >
            <Settings className="h-4 w-4" />
            <span>Instellingen</span>
          </button>
          <button
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
          >
            <HelpCircle className="h-4 w-4" />
            <span>Help Center</span>
          </button>

          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-white/10 dark:bg-slate-950/40">
            <div className="min-w-0">
              <div className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200" title={userEmail}>
                {userEmail || "Ingelogd"}
              </div>
              <div className="text-[10px] text-slate-400">Geautoriseerd account</div>
            </div>
            <a
              href="/auth/logout"
              title="Uitloggen"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-rose-500 dark:hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
            </a>
          </div>
        </div>
      </aside>
    </>
  );
}
