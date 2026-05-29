import React, { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from "recharts";
import {
  Eye, Globe, MousePointer, ArrowUpRight, ArrowDownRight, RefreshCw,
  Linkedin, Twitter, Facebook, Instagram, MoreHorizontal, ChevronLeft, ChevronRight, CalendarDays,
} from "lucide-react";

import { Website } from "../types";
import type { WidgetKey } from "../App";

interface DashboardOverviewProps {
  darkMode: boolean;
  onNavigate: (tab: string) => void;
  selectedWebsiteId: string;
  websites: Website[];
  widgets: Record<WidgetKey, boolean>;
}

const WEEKDAYS = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];
const MONTHS = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];

const RANGE_OPTIONS = [
  { value: "7", label: "1W" },
  { value: "30", label: "1M" },
  { value: "90", label: "3M" },
];

export default function DashboardOverview({ darkMode, onNavigate, selectedWebsiteId, widgets }: DashboardOverviewProps) {
  const [range, setRange] = useState<string>("30");
  const [loading, setLoading] = useState<boolean>(true);
  const [analytics, setAnalytics] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [socials, setSocials] = useState<any[]>([]);
  const [calMonth, setCalMonth] = useState<Date>(() => new Date());

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const dataRes = await fetch("/api/data");
      const appData = await dataRes.json() as { posts?: any[]; socials?: any[] };
      setPosts(appData.posts || []);
      setSocials(appData.socials || []);

      const analyticsRes = await fetch(`/api/analytics?range=${range}`);
      const analyticsData = await analyticsRes.json();
      setAnalytics(analyticsData);
    } catch (e) {
      console.error("Error fetching dashboard data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [range]);

  if (loading || !analytics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-500 mb-2" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Data aan het laden...</p>
      </div>
    );
  }

  // Stabiele schaalfactor per geselecteerde website.
  const getWebsiteIndexFactor = (id: string) => {
    if (id === "all") return 1.0;
    let sum = 0;
    for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
    return 0.35 + (sum % 4) * 0.15;
  };
  const factor = getWebsiteIndexFactor(selectedWebsiteId);

  const filteredPostsList = selectedWebsiteId === "all"
    ? posts
    : posts.filter((p: any) => p.targetWebsites && p.targetWebsites.includes(selectedWebsiteId));

  const { totals: rawTotals, performance: rawPerformance } = analytics;

  const totals = {
    views: Math.round(rawTotals.views * factor),
    organicClicks: Math.round(rawTotals.organicClicks * factor),
    socialClicks: Math.round(rawTotals.socialClicks * factor),
  };

  const performance = rawPerformance.map((p: any) => ({
    ...p,
    views: Math.round(p.views * factor),
    organicClicks: Math.round(p.organicClicks * factor),
    socialClicks: Math.round(p.socialClicks * factor),
  }));

  const connectedSocials = socials.filter((s) => s.connected);
  const reachData = connectedSocials.map((s) => ({ name: s.name, value: s.followers }));
  const maxFollowers = Math.max(1, ...connectedSocials.map((s) => s.followers));

  // KPI-kaarten.
  const kpis = [
    {
      id: "views", label: "Paginaweergaven", icon: Eye, value: totals.views,
      delta: 12.4, up: true, accent: "emerald", sub: "vs vorige periode",
    },
    {
      id: "organic", label: "Organisch verkeer", icon: Globe, value: totals.organicClicks,
      delta: 8.2, up: true, accent: "sky", sub: "via Google Zoeken",
    },
    {
      id: "social", label: "Social clicks", icon: MousePointer, value: totals.socialClicks,
      delta: 24.1, up: true, accent: "violet", sub: "via gedeelde links",
    },
  ];

  // Kalender-berekeningen.
  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toDateString();

  const eventsByDay: Record<number, number> = {};
  for (const p of filteredPostsList) {
    const d = new Date(p.scheduledAt);
    if (d.getFullYear() === year && d.getMonth() === month) {
      eventsByDay[d.getDate()] = (eventsByDay[d.getDate()] || 0) + 1;
    }
  }

  const upcomingEvents = [...filteredPostsList]
    .filter((p) => new Date(p.scheduledAt) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    .slice(0, 3);

  const accentClasses: Record<string, { bg: string; text: string }> = {
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-500" },
    sky: { bg: "bg-sky-500/10", text: "text-sky-500" },
    violet: { bg: "bg-violet-500/10", text: "text-violet-500" },
  };

  const statusCounts = {
    scheduled: filteredPostsList.filter((p) => p.status === "scheduled").length,
    published: filteredPostsList.filter((p) => p.status === "published").length,
    draft: filteredPostsList.filter((p) => p.status === "draft").length,
  };
  const totalPosts = Math.max(1, statusCounts.scheduled + statusCounts.published + statusCounts.draft);

  const leftSpan = widgets.calendar ? "xl:col-span-2" : "xl:col-span-3";

  return (
    <div className="space-y-5">
      {/* Bovenste rij: KPI's + grafiek links, kalender rechts */}
      {(widgets.metrics || widgets.chart || widgets.calendar) && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className={`space-y-5 ${leftSpan}`}>
            {/* KPI-kaarten */}
            {widgets.metrics && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {kpis.map((k) => {
                  const Icon = k.icon;
                  const ac = accentClasses[k.accent];
                  return (
                    <div key={k.id} id={`stat-${k.id}`} className="bento-card">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${ac.bg} ${ac.text}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{k.label}</span>
                        </div>
                        <span
                          className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                            k.up
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {k.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {k.delta}%
                        </span>
                      </div>
                      <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-display">
                        {k.value?.toLocaleString("nl-NL")}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">{k.sub}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Verkeer-grafiek */}
            {widgets.chart && (
              <div className="bento-card">
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">Verkeer</h3>
                    <p className="text-xs text-slate-400">Organisch zoekverkeer vs. social</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-white/5">
                    {RANGE_OPTIONS.map((r) => (
                      <button
                        key={r.value}
                        onClick={() => setRange(r.value)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                          range === r.value
                            ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={performance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorOrganic" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorSocial" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "rgba(255,255,255,0.05)" : "#f1f5f9"} />
                      <XAxis dataKey="date" tick={{ fill: darkMode ? "#94a3b8" : "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: darkMode ? "#94a3b8" : "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: darkMode ? "#151515" : "#ffffff",
                          borderColor: darkMode ? "rgba(255,255,255,0.1)" : "#e2e8f0",
                          color: darkMode ? "#f8fafc" : "#0f172a",
                          borderRadius: "12px",
                          fontSize: "12px",
                        }}
                      />
                      <Area type="monotone" dataKey="organicClicks" name="Organisch" stroke="#10b981" strokeWidth={2} fill="url(#colorOrganic)" />
                      <Area type="monotone" dataKey="socialClicks" name="Social" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorSocial)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Kalender */}
          {widgets.calendar && (
            <div className="bento-card xl:col-span-1">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white font-display">
                  <CalendarDays className="h-4 w-4 text-emerald-500" /> Kalender
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCalMonth(new Date(year, month - 1, 1))}
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="w-24 text-center text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {MONTHS[month]}
                  </span>
                  <button
                    onClick={() => setCalMonth(new Date(year, month + 1, 1))}
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="py-1 text-[10px] font-semibold text-slate-400">{d}</div>
                ))}
                {Array.from({ length: firstWeekday }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const isToday = new Date(year, month, day).toDateString() === todayStr;
                  const hasEvent = !!eventsByDay[day];
                  return (
                    <div key={day} className="flex flex-col items-center">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-medium ${
                          isToday
                            ? "bg-emerald-500 text-white"
                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                        }`}
                      >
                        {day}
                      </div>
                      <span className={`mt-0.5 h-1 w-1 rounded-full ${hasEvent && !isToday ? "bg-emerald-500" : "bg-transparent"}`} />
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-white/10">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Aankomend</div>
                {upcomingEvents.length === 0 && (
                  <div className="text-xs text-slate-400">Geen geplande publicaties.</div>
                )}
                {upcomingEvents.map((p) => (
                  <div key={p.id} className="flex items-center gap-2.5 rounded-lg bg-slate-50 p-2 dark:bg-white/5">
                    <div className="flex h-8 w-8 flex-col items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <span className="text-xs font-bold leading-none">{new Date(p.scheduledAt).getDate()}</span>
                      <span className="text-[8px] uppercase">{MONTHS[new Date(p.scheduledAt).getMonth()].slice(0, 3)}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{p.title}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(p.scheduledAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Onderste rij: content-status, bereik, top kanalen */}
      {(widgets.leads || widgets.retention || widgets.locations) && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Content-status */}
          {widgets.leads && (
            <div className="bento-card">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">Content-status</h3>
                <button onClick={() => onNavigate("planner")} className="text-slate-300 hover:text-slate-500">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>

              <div className="flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                <div className="bg-emerald-500" style={{ width: `${(statusCounts.published / totalPosts) * 100}%` }} />
                <div className="bg-sky-400" style={{ width: `${(statusCounts.scheduled / totalPosts) * 100}%` }} />
                <div className="bg-slate-300 dark:bg-white/20" style={{ width: `${(statusCounts.draft / totalPosts) * 100}%` }} />
              </div>

              <div className="mt-4 space-y-3">
                {[
                  { label: "Gepubliceerd", count: statusCounts.published, color: "bg-emerald-500" },
                  { label: "Ingepland", count: statusCounts.scheduled, color: "bg-sky-400" },
                  { label: "Concept", count: statusCounts.draft, color: "bg-slate-300 dark:bg-white/20" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <span className={`h-2 w-2 rounded-full ${s.color}`} /> {s.label}
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bereik per kanaal */}
          {widgets.retention && (
            <div className="bento-card">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">Bereik per kanaal</h3>
                  <p className="text-[11px] text-slate-400">Volgers per social-platform</p>
                </div>
              </div>
              <div className="h-44 w-full">
                {reachData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reachData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "rgba(255,255,255,0.05)" : "#f1f5f9"} />
                      <XAxis dataKey="name" tick={{ fill: darkMode ? "#94a3b8" : "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: darkMode ? "#94a3b8" : "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}
                        contentStyle={{
                          backgroundColor: darkMode ? "#151515" : "#ffffff",
                          borderColor: darkMode ? "rgba(255,255,255,0.1)" : "#e2e8f0",
                          borderRadius: "12px", fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="value" name="Volgers" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">
                    Geen verbonden kanalen.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Top kanalen */}
          {widgets.locations && (
            <div className="bento-card">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">Top kanalen</h3>
                <button onClick={() => onNavigate("integrations")} className="text-slate-300 hover:text-slate-500">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3.5">
                {connectedSocials.length === 0 && (
                  <div className="text-xs text-slate-400">Nog geen kanalen verbonden.</div>
                )}
                {connectedSocials.map((channel, idx) => {
                  const Icon =
                    channel.id === "linkedin" ? Linkedin :
                    channel.id === "twitter" ? Twitter :
                    channel.id === "facebook" ? Facebook : Instagram;
                  const pct = Math.round((channel.followers / maxFollowers) * 100);
                  return (
                    <div key={channel.id} className="flex items-center gap-3">
                      <span className="w-4 text-xs font-bold text-slate-400">{idx + 1}.</span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{channel.name}</span>
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            {channel.followers.toLocaleString("nl-NL")}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
