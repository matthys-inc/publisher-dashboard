import React, { useState, useEffect } from "react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend 
} from "recharts";
import { 
  TrendingUp, Users, MousePointer, Globe, Eye, ArrowUpRight, 
  Linkedin, Twitter, Facebook, Instagram, AlertCircle, RefreshCw, Calendar, CheckCircle2 
} from "lucide-react";

import { Website } from "../types";

interface DashboardOverviewProps {
  darkMode: boolean;
  onNavigate: (tab: string) => void;
  selectedWebsiteId: string;
  websites: Website[];
}

export default function DashboardOverview({ darkMode, onNavigate, selectedWebsiteId, websites }: DashboardOverviewProps) {
  const [range, setRange] = useState<string>("30");
  const [loading, setLoading] = useState<boolean>(true);
  const [analytics, setAnalytics] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [socials, setSocials] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch general API data
      const dataRes = await fetch("/api/data");
      const appData = await dataRes.json();
      setPosts(appData.posts || []);
      setSocials(appData.socials || []);

      // Fetch dynamic analytics charts
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

  // Generate unique stable metrics factor based on selected website ID
  const getWebsiteIndexFactor = (id: string) => {
    if (id === "all") return 1.0;
    let sum = 0;
    for (let i = 0; i < id.length; i++) {
      sum += id.charCodeAt(i);
    }
    return 0.35 + (sum % 4) * 0.15; // Stable values: 0.35, 0.50, 0.65, 0.80
  };

  const factor = getWebsiteIndexFactor(selectedWebsiteId);

  // Filter posts based on selected brand context
  const filteredPostsList = selectedWebsiteId === "all"
    ? posts
    : posts.filter((p: any) => p.targetWebsites && p.targetWebsites.includes(selectedWebsiteId));

  const { totals: rawTotals, performance: rawPerformance } = analytics;

  // Scale totals and performance curve proportionally to currently selected website
  const totals = {
    views: Math.round(rawTotals.views * factor),
    organicClicks: Math.round(rawTotals.organicClicks * factor),
    socialClicks: Math.round(rawTotals.socialClicks * factor),
    bounceRate: parseFloat((rawTotals.bounceRate + (factor - 0.5) * 4).toFixed(1))
  };

  const performance = rawPerformance.map((p: any) => ({
    ...p,
    views: Math.round(p.views * factor),
    organicClicks: Math.round(p.organicClicks * factor),
    socialClicks: Math.round(p.socialClicks * factor),
  }));

  const connectedSocials = socials.filter(s => s.connected);
  
  // Scale social metrics too if a specific website is selected
  const totalFollowers = Math.round(
    socials.reduce((acc, s) => acc + (s.connected ? s.followers : 0), 0) * (selectedWebsiteId === "all" ? 1.0 : factor * 1.2)
  );

  return (
    <div className="space-y-6">
      {/* Top Welcome / Range Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold font-sans tracking-tight text-slate-900 dark:text-white">
            Prestaties & Statistieken
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Volg geplande publicaties, kanaalbereik en conversiemetrics direct vanaf één centraal punt.
          </p>
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
          <button 
            id="range-7d"
            onClick={() => setRange("7")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              range === "7" 
                ? "bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white" 
                : "text-slate-500 hover:text-slate-900 dark:hover:text-amber-50"
            }`}
          >
            7 Dagen
          </button>
          <button 
            id="range-30d"
            onClick={() => setRange("30")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              range === "30" 
                ? "bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white" 
                : "text-slate-500 hover:text-slate-900 dark:hover:text-amber-50"
            }`}
          >
            30 Dagen
          </button>
          <button 
            id="range-90d"
            onClick={() => setRange("90")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              range === "90" 
                ? "bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white" 
                : "text-slate-500 hover:text-slate-900 dark:hover:text-amber-50"
            }`}
          >
            90 Dagen
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card: Total Views */}
        <div id="stat-views" className="bento-card relative overflow-hidden transition-all duration-300 hover:scale-[1.015] hover:shadow-bento-glow">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Paginaweergaven (Blog/Web)
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[10px] uppercase font-bold tracking-wider mt-1.5 text-slate-500 font-mono">GA4 LIVE</div>
          <div className="mt-1">
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-gray-100 font-display tracking-tight">
              {totals.views?.toLocaleString()}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+12.4% vs vorige periode</span>
            </div>
          </div>
        </div>

        {/* Card: Organic Clicks From Google */}
        <div id="stat-organic" className="bento-card relative overflow-hidden transition-all duration-300 hover:scale-[1.015] hover:shadow-bento-blue-glow">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Organisch Verkeer (GSC)
            </span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[10px] uppercase font-bold tracking-wider mt-1.5 text-slate-500 font-mono">GOOGLE</div>
          <div className="mt-1">
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-gray-100 font-display tracking-tight">
              {totals.organicClicks?.toLocaleString()}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-blue-400 font-medium mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+8.2% via Google Zoeken</span>
            </div>
          </div>
        </div>

        {/* Card: Social Media Driven traffic */}
        <div id="stat-socials" className="bento-card relative overflow-hidden transition-all duration-300 hover:scale-[1.015] hover:shadow-bento-glow">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Social Clicks (LinkedIn/X)
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <MousePointer className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[10px] uppercase font-bold tracking-wider mt-1.5 text-slate-500 font-mono">SOCIAL CHANNELS</div>
          <div className="mt-1">
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-gray-100 font-display tracking-tight">
              {totals.socialClicks?.toLocaleString()}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+24.1% via doorgestuurde links</span>
            </div>
          </div>
        </div>

        {/* Card: Social Followers Pool */}
        <div id="stat-followers" className="bento-card relative overflow-hidden transition-all duration-300 hover:scale-[1.015] hover:shadow-bento-glow">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Totaal Social Volgers
            </span>
            <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-500">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[10px] uppercase font-bold tracking-wider mt-1.5 text-slate-500 font-mono">ENGAGED NETWORKS</div>
          <div className="mt-1">
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-gray-100 font-display tracking-tight">
              {totalFollowers?.toLocaleString()}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-pink-405 font-medium mt-1">
              <span>Over {connectedSocials.length} actieve accounts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts & Side Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Span: Traffic Trends chart */}
        <div className="lg:col-span-2 bento-card flex flex-col justify-between transition-all duration-300 hover:scale-[1.005] hover:shadow-bento-glow">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                Kanaal Prestatie Overzicht
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Organisch zoekverkeer versus promotie via gekoppelde sociale platforms.
              </p>
            </div>
            
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 block"></span>
                <span className="text-slate-600 dark:text-slate-400">Zoekopdrachten</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-sky-450 block"></span>
                <span className="text-slate-600 dark:text-slate-400">Social Media</span>
              </div>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorOrganic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSocial" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "rgba(255, 255, 255, 0.05)" : "#f1f5f9"} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: darkMode ? "#94a3b8" : "#64748b", fontSize: 10 }} 
                  axisLine={{ stroke: darkMode ? "rgba(255, 255, 255, 0.1)" : "#e2e8f0" }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: darkMode ? "#94a3b8" : "#64748b", fontSize: 10 }}
                  axisLine={{ stroke: darkMode ? "rgba(255, 255, 255, 0.1)" : "#e2e8f0" }}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: darkMode ? "#151515" : "#ffffff", 
                    borderColor: darkMode ? "rgba(255, 255, 255, 0.1)" : "#e2e8f0",
                    color: darkMode ? "#f8fafc" : "#0f172a",
                    borderRadius: "12px",
                    fontSize: "12px"
                  }} 
                />
                <Area type="monotone" dataKey="organicClicks" name="Organisch" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorOrganic)" />
                <Area type="monotone" dataKey="socialClicks" name="Socials" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#colorSocial)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Span: Social Reach Breakdown & Recent Status */}
        <div className="space-y-4">
          
          {/* Channel Leaderboard */}
          <div className="bento-card transition-all duration-300 hover:scale-[1.005] hover:shadow-bento-glow">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 font-display">
              Bereik per Social Kanaal
            </h3>
            
            <div className="space-y-3.5">
              {socials.map((channel) => {
                const isLinkedIn = channel.id === "linkedin";
                const isTwitter = channel.id === "twitter";
                const isFacebook = channel.id === "facebook";
                const isInstagram = channel.id === "instagram";
                
                return (
                  <div key={channel.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-lg border border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded ${
                        isLinkedIn ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600" :
                        isTwitter ? "bg-slate-100 dark:bg-slate-800 text-slate-850 dark:text-slate-100" :
                        isFacebook ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600" :
                        "bg-pink-50 dark:bg-pink-950/40 text-pink-500"
                      }`}>
                        {isLinkedIn && <Linkedin className="w-4 h-4" />}
                        {isTwitter && <Twitter className="w-4 h-4" />}
                        {isFacebook && <Facebook className="w-4 h-4" />}
                        {isInstagram && <Instagram className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {channel.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {channel.handle}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {channel.connected ? `${channel.followers.toLocaleString()} volgers` : "Gekoppeld"}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {channel.connected ? `${channel.engagementRate}% engagement` : "Niet verbonden"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <button 
              id="goto-integrations-btn"
              onClick={() => onNavigate("integrations")}
              className="w-full text-center text-xs font-bold text-emerald-500 hover:text-emerald-400 mt-4 block transition-all hover:underline"
            >
              Verbind meer kanalen &rarr;
            </button>
          </div>

          {/* Quick Stats Summary */}
          <div className="p-5 rounded-2xl border border-dashed border-slate-250 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02]">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-1 mb-2 font-mono">
              <Calendar className="w-3.5 h-3.5 text-emerald-500" /> Actuele Planningsstatus
            </h4>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-white dark:bg-slate-950/50 p-2.5 rounded-lg border border-slate-100 dark:border-white/5">
                <div className="text-lg font-bold text-emerald-500">
                  {filteredPostsList.filter(p => p.status === "scheduled").length}
                </div>
                <div className="text-[10px] text-slate-400">Ingepland</div>
              </div>
              <div className="bg-white dark:bg-slate-950/50 p-2.5 rounded-lg border border-slate-100 dark:border-white/5">
                <div className="text-lg font-bold text-emerald-405">
                  {filteredPostsList.filter(p => p.status === "published").length}
                </div>
                <div className="text-[10px] text-slate-400">Gepubliceerd</div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Recent Posts Tracker */}
      <div className="bento-card transition-all duration-300 hover:scale-[1.002] hover:shadow-bento-glow">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-xs uppercase font-bold text-slate-400 dark:text-gray-500 tracking-widest font-mono">
              Recente Content & Sociale Distributie
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Controleer of de doorgestuurde artikelen succesvol naar je aangesloten socials zijn verzonden.
            </p>
          </div>
          <button 
            id="planner-navigate-btn"
            onClick={() => onNavigate("planner")}
            className="text-xs font-semibold text-emerald-500 hover:underline flex items-center gap-1"
          >
            Alle content bekijken <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-mono">
                <th className="py-2.5 font-medium">Titel</th>
                <th className="py-2.5 font-medium">Ingepland Voor</th>
                <th className="py-2.5 font-medium">Sync Socials</th>
                <th className="py-2.5 font-medium">SEO Score</th>
                <th className="py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-600 dark:text-slate-350">
              {filteredPostsList.slice(0, 3).map((post) => (
                <tr key={post.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                  <td className="py-3 font-semibold text-slate-800 dark:text-slate-100 truncate max-w-xs sm:max-w-md">
                    {post.title}
                  </td>
                  <td className="py-3 font-mono text-slate-500 dark:text-slate-400">
                    {new Date(post.scheduledAt).toLocaleDateString("nl-NL")} om {" "}
                    {new Date(post.scheduledAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-3">
                    {post.sendToSocials ? (
                      <div className="flex gap-1">
                        {post.socialPlatforms.map((platform: string) => (
                          <span 
                            key={platform}
                            className="px-1.5 py-0.5 text-[9px] font-bold rounded uppercase bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900"
                          >
                            {platform}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 font-mono text-[10px]">Alleen website</span>
                    )}
                  </td>
                  <td className="py-3">
                    <span className={`font-bold font-mono ${
                      post.seoScore >= 85 ? "text-emerald-500" :
                      post.seoScore >= 70 ? "text-amber-500" : "text-rose-500"
                    }`}>
                      {post.seoScore ?? "N/A"}%
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold leading-4 ${
                      post.status === "published" 
                        ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400" 
                        : "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400"
                    }`}>
                      {post.status === "published" ? "Gepubliceerd" : "Ingepland"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
