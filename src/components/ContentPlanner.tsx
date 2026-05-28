import React, { useState, useEffect } from "react";
import { 
  Plus, Calendar, Eye, Send, Sparkles, Check, Trash2, Globe, Share2, 
  Linkedin, Twitter, Facebook, Instagram, AlertCircle, FileText, Bot, Compass, RefreshCw,
  ChevronLeft, ChevronRight, List, Info, Clock, CheckCircle2
} from "lucide-react";
import { ScheduledPost, Website, SocialChannel } from "../types";

const dutchMonths = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December"
];

interface ContentPlannerProps {
  darkMode: boolean;
  websites: Website[];
  socials: SocialChannel[];
  posts: ScheduledPost[];
  onPostsUpdated: () => void;
  selectedWebsiteId: string;
}

export default function ContentPlanner({ 
  darkMode, websites, socials, posts, onPostsUpdated, selectedWebsiteId 
}: ContentPlannerProps) {
  // View Switcher: list or calendar
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  
  // Calendar Dates state
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(new Date(2026, 4, 1)); // Initialize to May 2026 (matches general metadata)
  
  // New Post Form State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetKeywords, setTargetKeywords] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [targetWebsites, setTargetWebsites] = useState<string[]>([]);
  const [sendToSocials, setSendToSocials] = useState(true);
  const [selectedSocials, setSelectedSocials] = useState<string[]>(["linkedin", "twitter"]);
  const [socialCaption, setSocialCaption] = useState("");
  
  // SEO suggestions from Gemini
  const [optimizing, setOptimizing] = useState(false);
  const [seoResult, setSeoResult] = useState<{
    seoScore?: number;
    seoKeywords?: string[];
    socialCaptions?: Record<string, string>;
    suggestions?: string[];
  } | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Quick Action feedback
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);

  // Initialize form default dates
  useEffect(() => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 3);
    defaultDate.setHours(10, 0, 0, 0);
    // Format to datetime-local friendly format
    const offset = defaultDate.getTimezoneOffset();
    const formatted = new Date(defaultDate.getTime() - offset * 60000).toISOString().slice(0, 16);
    setScheduledAt(formatted);
  }, [showCreateForm]);

  // Pre-fill target websites if a website is filtered globally
  useEffect(() => {
    if (selectedWebsiteId && selectedWebsiteId !== "all") {
      setTargetWebsites([selectedWebsiteId]);
    } else {
      setTargetWebsites([]);
    }
  }, [selectedWebsiteId, showCreateForm]);

  // Handle direct toggle of socials on existing post
  const handleToggleSocials = async (post: ScheduledPost) => {
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendToSocials: !post.sendToSocials })
      });
      if (res.ok) {
        onPostsUpdated();
        showNotification(`Social media doorsturen voor "${post.title}" ${!post.sendToSocials ? "ingeschakeld" : "uitgeschakeld"}.`, "success");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Optimize Content Draft via Gemini Hook
  const handleAiOptimize = async () => {
    if (!title || !content) {
      showNotification("Vul eerst een titel en inhoud in om door de AI te analyseren.", "error");
      return;
    }

    setOptimizing(true);
    setSeoResult(null);
    try {
      const res = await fetch("/api/gemini/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          targetKeywords: targetKeywords ? targetKeywords.split(',').map(s => s.trim()) : []
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setSeoResult(data);
        if (data.socialCaptions) {
          // Put together captions based on active selected platforms
          const primaryCaption = data.socialCaptions.linkedin || data.socialCaptions.twitter || "";
          setSocialCaption(primaryCaption);
        }
        showNotification("AI SEO-scan en social post generatie succesvol voltooid!", "success");
      } else {
        showNotification("Fout bij het laden van AI-gegevens.", "error");
      }
    } catch (e) {
      console.error(e);
      showNotification("Netwerkfout bij AI optimalisatie.", "error");
    } finally {
      setOptimizing(false);
    }
  };

  // Submit new scheduled post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content || targetWebsites.length === 0) {
      showNotification("Voer ten minste een titel, inhoud en één doelsite in.", "error");
      return;
    }

    try {
      const payload = {
        title,
        content,
        seoKeywords: seoResult?.seoKeywords || targetKeywords.split(",").map(k => k.trim()).filter(Boolean),
        scheduledAt: new Date(scheduledAt).toISOString(),
        targetWebsites,
        sendToSocials,
        socialPlatforms: selectedSocials,
        socialCaption: socialCaption || undefined,
        status: "scheduled",
        seoScore: seoResult?.seoScore || Math.floor(Math.random() * 20) + 70
      };

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showNotification("Nieuw bericht succesvol ingepland!", "success");
        // Reset form
        setTitle("");
        setContent("");
        setTargetKeywords("");
        setTargetWebsites([]);
        setSocialCaption("");
        setSeoResult(null);
        setShowCreateForm(false);
        onPostsUpdated();
      }
    } catch (err) {
      console.error(err);
      showNotification("Inplannen mislukt.", "error");
    }
  };

  // Set social choice
  const toggleSocialPlatform = (plat: string) => {
    if (selectedSocials.includes(plat)) {
      setSelectedSocials(selectedSocials.filter(s => s !== plat));
    } else {
      setSelectedSocials([...selectedSocials, plat]);
    }
  };

  // Action: Publish directly
  const handlePublishNow = async (id: string) => {
    setPublishingId(id);
    try {
      const res = await fetch(`/api/posts/${id}/publish`, {
        method: "POST"
      });
      if (res.ok) {
        showNotification("Bericht direct gepubliceerd naar aangesloten website en doorgestuurd naar social API's!", "success");
        onPostsUpdated();
      } else {
        showNotification("Fout bij publiceren naar de CMS API.", "error");
      }
    } catch (e) {
      showNotification("Netwerkfout tijdens live publiceren.", "error");
    } finally {
      setPublishingId(null);
    }
  };

  // Action: Delete Post
  const handleDeletePost = async (id: string) => {
    if (!confirm("Weet je zeker dat je deze geplande publicatie wilt verwijderen?")) return;
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        showNotification("Geplande publicatie succesvol verwijderd.", "success");
        onPostsUpdated();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const showNotification = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // Filter & Search Logic
  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          post.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || 
                         (filterStatus === "scheduled" && post.status === "scheduled") ||
                         (filterStatus === "published" && post.status === "published");
    const matchesWebsite = selectedWebsiteId === "all" || 
                           (post.targetWebsites && post.targetWebsites.includes(selectedWebsiteId));
    return matchesSearch && matchesStatus && matchesWebsite;
  });

  return (
    <div className="space-y-6">
      
      {/* Toast feedback */}
      {message && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 max-w-sm animate-bounce ${
          message.type === "success" 
            ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-900 text-emerald-850 dark:text-emerald-300" 
            : "bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-900 text-rose-850 dark:text-rose-300"
        }`}>
          <AlertCircle className="w-4 h-4" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Header / Trigger */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Content Planner & Publicatiecentrum
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Plan blogs voor je websites, optimaliseer met Gemini AI en beheer syndicatie naar aangesloten socials.
          </p>
        </div>

        <button 
          id="btn-show-create-form"
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 dark:bg-indigo-505 hover:bg-indigo-700 text-white shadow-sm transition-all text-nowrap"
        >
          {showCreateForm ? "Planner Weergave" : "Nieuw Bericht Inplannen"}
          {!showCreateForm ? <Plus className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
        </button>
      </div>

      {showCreateForm ? (
        /* Create and Optimize Form Area */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          
          <form onSubmit={handleCreatePost} className="lg:col-span-7 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200/50 dark:border-slate-800/80 p-6 space-y-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              Schrijf een Nieuw Bericht
            </h3>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Artikel Titel
              </label>
              <input 
                id="input-title"
                type="text"
                required
                placeholder="bv. 10 Onmisbare SEO Tips voor Blogs in 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Inhoud / Body Tekst
              </label>
              <textarea 
                id="input-content"
                required
                rows={8}
                placeholder="Schrijf hier je ruwe blogtekst, structuur of bullet points. Je kunt daarna op de AI knop klikken om te optimaliseren..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Zoekwoorden (komma-gescheiden)
                </label>
                <input 
                  id="input-keywords"
                  type="text"
                  placeholder="bv. SEO, Content Marketing, Google"
                  value={targetKeywords}
                  onChange={(e) => setTargetKeywords(e.target.value)}
                  className="w-full text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Publicatiedatum & Tijdstip
                </label>
                <input 
                  id="input-datetime"
                  type="datetime-local"
                  required
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>

            {/* Target Websites Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Publiceer naar website(s):
              </label>
              <div className="flex flex-wrap gap-2">
                {websites.map(web => (
                  <button
                    id={`target-web-${web.id}`}
                    key={web.id}
                    type="button"
                    onClick={() => {
                      if (targetWebsites.includes(web.id)) {
                        setTargetWebsites(targetWebsites.filter(id => id !== web.id));
                      } else {
                        setTargetWebsites([...targetWebsites, web.id]);
                      }
                    }}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 ${
                      targetWebsites.includes(web.id)
                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-slate-900 dark:border-white"
                        : "bg-transparent text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{web.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Doorgestuurd naar Socials Trigger */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-950 dark:text-white">
                    Direct doorsturen naar sociale media
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Wanneer het artikel live gaat, sturen de API's automatisch tweets en updates uit.
                  </p>
                </div>
                
                {/* Single button toggle as requested */}
                <button
                  id="single-toggle-socials"
                  type="button"
                  onClick={() => setSendToSocials(!sendToSocials)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    sendToSocials ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-800"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      sendToSocials ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {sendToSocials && (
                <div className="space-y-3.5 animate-fadeIn">
                  <div className="flex gap-2">
                    {socials.map((platform) => {
                      const isLinkedIn = platform.id === "linkedin";
                      const isTwitter = platform.id === "twitter";
                      const isFacebook = platform.id === "facebook";
                      const isInstagram = platform.id === "instagram";
                      
                      return (
                        <button
                          id={`target-social-${platform.id}`}
                          key={platform.id}
                          type="button"
                          onClick={() => toggleSocialPlatform(platform.id)}
                          className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 ${
                            selectedSocials.includes(platform.id)
                              ? "bg-indigo-550/10 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border-indigo-500/50"
                              : "bg-transparent text-slate-400 border-slate-250 dark:border-slate-800/60"
                          } ${!platform.connected ? "opacity-40 cursor-not-allowed" : ""}`}
                          disabled={!platform.connected}
                          title={!platform.connected ? "Koppel dit kanaal in de instellingen om te selecteren" : ""}
                        >
                          {isLinkedIn && <Linkedin className="w-3.5 h-3.5" />}
                          {isTwitter && <Twitter className="w-3.5 h-3.5" />}
                          {isFacebook && <Facebook className="w-3.5 h-3.5" />}
                          {isInstagram && <Instagram className="w-3.5 h-3.5" />}
                          <span>{platform.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Social Media Post Tekst / Caption
                    </label>
                    <textarea 
                      id="input-social-caption"
                      rows={3}
                      placeholder="Schrijf een opvallende tweet of update voor je geselecteerde kanalen, met nuttige hashtags."
                      value={socialCaption}
                      onChange={(e) => setSocialCaption(e.target.value)}
                      className="w-full text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action Triggers */}
            <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <button
                id="btn-ai-optimize"
                type="button"
                onClick={handleAiOptimize}
                disabled={optimizing}
                className="inline-flex flex-1 items-center justify-center gap-2 px-4 py-3 text-xs font-bold rounded-lg border border-sky-300/35 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 transition-all font-mono"
              >
                {optimizing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Gemini analiseert...</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-4 h-4 text-sky-500 animate-pulse" />
                    <span>Door Gemini laten Scannen &amp; Ontwerpen</span>
                  </>
                )}
              </button>

              <button
                id="btn-submit-post"
                type="submit"
                className="inline-flex flex-1 justify-center items-center gap-2 px-4 py-3 text-xs font-bold rounded-lg bg-indigo-600 dark:bg-indigo-505 hover:bg-indigo-700 text-white shadow-sm transition-all"
              >
                <span>Sla op in Planner</span>
                <Check className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* AI Output / Optimization Panel */}
          <div className="lg:col-span-5 space-y-5">
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 space-y-4">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                <span>SEO &amp; Social Media Analyse resultaten</span>
              </div>

              {!seoResult ? (
                <div className="py-12 text-center space-y-2">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-slate-400 dark:text-slate-500">
                    <Compass className="w-6 h-6" />
                  </div>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Krijg direct een SEO Score, aanbevolen zoekwoorden en automatische posts voor LinkedIn, Facebook of Twitter via Gemini.
                  </p>
                </div>
              ) : (
                <div className="space-y-5 animate-fadeIn">
                  
                  {/* Score Indicator */}
                  <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Metrische SEO Score</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">Perfect geoptimaliseerd</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-black ${
                        seoResult.seoScore && seoResult.seoScore >= 80 ? "text-emerald-500" : "text-amber-500"
                      }`}>{seoResult.seoScore}%</div>
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      Zoekmachine (SEO) Tips:
                    </span>
                    <ul className="space-y-1.5">
                      {seoResult.suggestions?.map((s, idx) => (
                        <li key={idx} className="text-xs text-slate-600 dark:text-slate-350 flex items-start gap-1.5 leading-relaxed bg-slate-50/50 dark:bg-slate-900/10 p-2 rounded">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* AI Extracted Keywords */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
                      Gevonden Trefwoorden:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {seoResult.seoKeywords?.map((k) => (
                        <span 
                          key={k} 
                          className="px-2 py-1 text-xs font-medium rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900"
                        >
                          #{k}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Autogenerated Social Feeds */}
                  {seoResult.socialCaptions && (
                    <div className="space-y-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block border-t border-slate-100 dark:border-slate-800 pt-3">
                        Gegenereerde Social Captions:
                      </span>
                      
                      {/* LinkedIn feed card */}
                      <div className="p-3 rounded-lg border border-slate-150 bg-slate-50/50 dark:bg-slate-900/20 text-xs text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1.5 font-bold mb-1.5 text-[11px] text-blue-600">
                          <Linkedin className="w-3.5 h-3.5" /> LinkedIn Post
                        </div>
                        <p className="whitespace-pre-line leading-relaxed font-sans">{seoResult.socialCaptions.linkedin}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setSocialCaption(seoResult.socialCaptions?.linkedin || "");
                            showNotification("LinkedIn caption gekopieerd naar de editor!", "success");
                          }}
                          className="text-[10px] font-bold hover:underline text-indigo-500 mt-2 block"
                        >
                          Gebruik deze social post &uarr;
                        </button>
                      </div>

                      {/* Twitter feed card */}
                      <div className="p-3 rounded-lg border border-slate-150 bg-slate-50/50 dark:bg-slate-900/20 text-xs text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1.5 font-bold mb-1.5 text-[11px] text-slate-900 dark:text-slate-200">
                          <Twitter className="w-3.5 h-3.5" /> Twitter / X Tweet
                        </div>
                        <p className="whitespace-pre-line leading-relaxed font-mono text-[11px]">{seoResult.socialCaptions.twitter}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setSocialCaption(seoResult.socialCaptions?.twitter || "");
                            showNotification("Twitter caption gekopieerd naar de editor!", "success");
                          }}
                          className="text-[10px] font-bold hover:underline text-indigo-500 mt-2 block"
                        >
                          Gebruik deze social post &uarr;
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>

        </div>
      ) : (
        /* Planner Posts Interactive Grid / List */
        <div className="space-y-4">
          
          {/* Filters Row */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/80">
            <div className="flex flex-col sm:flex-row gap-2 flex-1 max-w-xl">
              <input 
                id="search-posts"
                type="text"
                placeholder="Zoek in geplande content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              
              <select
                id="filter-status-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="all">Alle publicaties</option>
                <option value="scheduled">Alleen Ingepland</option>
                <option value="published">Alleen Gepubliceerd</option>
              </select>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <span className="text-slate-500 font-mono hidden sm:inline">
                Dashboard toont <span className="text-indigo-650 dark:text-indigo-400 font-bold">{filteredPosts.length}</span> resultaten
              </span>
              
              <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200/40 dark:border-white/5">
                <button
                  id="view-list-btn"
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-md flex items-center gap-1 text-[11px] font-semibold transition-all ${
                    viewMode === "list"
                      ? "bg-white dark:bg-slate-900 shadow-sm text-indigo-600 dark:text-indigo-400"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Lijst</span>
                </button>
                <button
                  id="view-calendar-btn"
                  onClick={() => setViewMode("calendar")}
                  className={`p-1.5 rounded-md flex items-center gap-1 text-[11px] font-semibold transition-all ${
                    viewMode === "calendar"
                      ? "bg-white dark:bg-slate-900 shadow-sm text-indigo-600 dark:text-indigo-400"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Kalender</span>
                </button>
              </div>
            </div>
          </div>

          {viewMode === "calendar" ? (
            /* Month Selector Controls & Month Grid */
            <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm space-y-6">
              
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-slate-100 dark:border-slate-800/60 pb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    <span>{dutchMonths[currentCalendarDate.getMonth()]} {currentCalendarDate.getFullYear()}</span>
                  </h3>
                  <span className="text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    Kalender Weergave
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    id="prev-month-btn"
                    onClick={() => {
                      const prev = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1);
                      setCurrentCalendarDate(prev);
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    id="today-btn"
                    onClick={() => {
                      setCurrentCalendarDate(new Date(2026, 4, 1)); // Back to May 2026
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
                  >
                    Mei 2026
                  </button>
                  <button
                    id="next-month-btn"
                    onClick={() => {
                      const next = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1);
                      setCurrentCalendarDate(next);
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-bold uppercase font-mono text-slate-400 dark:text-slate-500 tracking-wider">
                <div>Ma</div>
                <div>Di</div>
                <div>Wo</div>
                <div>Do</div>
                <div>Vr</div>
                <div>Za</div>
                <div>Zo</div>
              </div>

              {/* Month calendar grid cells */}
              <div className="grid grid-cols-7 gap-2 min-h-[380px]">
                {(() => {
                  const cells = [];
                  const year = currentCalendarDate.getFullYear();
                  const month = currentCalendarDate.getMonth();
                  const firstDayIndex = new Date(year, month, 1).getDay();
                  const adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
                  const totalDays = new Date(year, month + 1, 0).getDate();
                  const prevMonthTotalDays = new Date(year, month, 0).getDate();
                  
                  // Empty spots before first day
                  for (let i = adjustedFirstDay - 1; i >= 0; i--) {
                    cells.push({
                      day: prevMonthTotalDays - i,
                      isCurrentMonth: false,
                      month: month === 0 ? 11 : month - 1,
                      year: month === 0 ? year - 1 : year
                    });
                  }
                  
                  // Days of active month
                  for (let i = 1; i <= totalDays; i++) {
                    cells.push({
                      day: i,
                      isCurrentMonth: true,
                      month: month,
                      year: year
                    });
                  }
                  
                  // Padding cells at the end
                  const extraSlots = 42 - cells.length;
                  for (let i = 1; i <= extraSlots; i++) {
                    cells.push({
                      day: i,
                      isCurrentMonth: false,
                      month: month === 11 ? 0 : month + 1,
                      year: month === 11 ? year + 1 : year
                    });
                  }
                  
                  const getPostsForDate2 = (cellDay: number, cellMonth: number, cellYear: number) => {
                    return filteredPosts.filter(post => {
                      const postDate = new Date(post.scheduledAt);
                      return postDate.getDate() === cellDay && 
                             postDate.getMonth() === cellMonth && 
                             postDate.getFullYear() === cellYear;
                    });
                  };
                  
                  return cells.map((cell, idx) => {
                    const cellPosts = getPostsForDate2(cell.day, cell.month, cell.year);
                    const isToday = cell.day === 28 && cell.month === 4 && cell.year === 2026;
                    
                    return (
                      <div
                        id={`calendar-cell-${idx}`}
                        key={idx}
                        className={`group min-h-[75px] sm:min-h-[85px] p-1.5 rounded-xl border flex flex-col justify-between transition-all select-none hover:border-slate-350 dark:hover:border-slate-650 relative ${
                          cell.isCurrentMonth
                            ? "bg-slate-50/25 dark:bg-white/[0.015] border-slate-100 dark:border-slate-805/60"
                            : "bg-slate-50/15 dark:bg-white/[0.002] border-slate-100/30 dark:border-slate-905/10 opacity-40"
                        } ${isToday ? "ring-2 ring-emerald-500/30 border-emerald-500/40 bg-emerald-500/[0.03]" : ""}`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span
                            className={`text-[10px] sm:text-xs font-bold font-mono px-1 sm:px-1.5 py-0.5 rounded-md ${
                              isToday
                                ? "bg-emerald-500 text-white shadow-sm"
                                : cell.isCurrentMonth
                                ? "text-slate-700 dark:text-slate-200"
                                : "text-slate-400 dark:text-slate-600"
                            }`}
                          >
                            {cell.day}
                          </span>
                          
                          {cell.isCurrentMonth && (
                            <button
                              id={`add-post-cell-btn-${cell.day}`}
                              title="Plan bericht voor deze dag"
                              onClick={() => {
                                const formattedMonth = String(cell.month + 1).padStart(2, "0");
                                const formattedDay = String(cell.day).padStart(2, "0");
                                setScheduledAt(`${cell.year}-${formattedMonth}-${formattedDay}T10:00`);
                                setShowCreateForm(true);
                              }}
                              className="opacity-0 group-hover:opacity-100 hover:opacity-100 text-slate-450 dark:text-slate-505 hover:text-indigo-505 p-0.5 rounded transition-all cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        
                        <div className="space-y-1 flex-1 overflow-y-auto max-h-[42px] sm:max-h-[50px] scrollbar-thin">
                          {cellPosts.map((post) => (
                            <button
                              id={`calendar-post-pill-${post.id}`}
                              key={post.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPost(post);
                              }}
                              className={`w-full text-left truncate text-[9px] font-bold rounded-md px-1 py-0.5 border flex items-center gap-1 transition-all hover:scale-[1.02] cursor-pointer ${
                                post.status === "published"
                                  ? "bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  : "bg-indigo-500/10 hover:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
                              }`}
                            >
                              <span className={`w-1 h-1 rounded-full shrink-0 ${post.status === "published" ? "bg-emerald-500" : "bg-indigo-500"}`} />
                              <span className="truncate">{post.title}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPosts.length === 0 ? (
              <div className="p-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center">
                <p className="text-slate-450 dark:text-slate-500 text-xs">Geen publicaties gevonden voor deze filters.</p>
              </div>
            ) : (
              filteredPosts.map((post) => (
                <div 
                  id={`post-card-${post.id}`}
                  key={post.id} 
                  className={`p-5 rounded-xl border bg-white dark:bg-slate-900/50 shadow-sm transition-all hover:shadow-md ${
                    post.status === "published" 
                      ? "border-slate-200 dark:border-slate-800/80" 
                      : "border-indigo-100 dark:border-indigo-900/40"
                  }`}
                >
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold leading-4 tracking-wider uppercase ${
                          post.status === "published" 
                            ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400" 
                            : "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400"
                        }`}>
                          {post.status === "published" ? "Gepubliceerd" : "Ingepland"}
                        </span>
                        
                        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{new Date(post.scheduledAt).toLocaleDateString("nl-NL")} om {" "}
                          {new Date(post.scheduledAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>

                      <h4 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                        {post.title}
                      </h4>
                      
                      <p className="text-xs text-slate-550 dark:text-slate-400 line-clamp-2 leading-relaxed max-w-3xl">
                        {post.content}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                        {post.seoKeywords && post.seoKeywords.length > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold font-mono text-slate-400 uppercase">Tags:</span>
                            <div className="flex gap-1 flex-wrap">
                              {post.seoKeywords.slice(0, 3).map(k => (
                                <span key={k} className="text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">
                                  #{k}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-800 pl-3.5 text-slate-400">
                          <span className="text-[10px] font-bold font-mono uppercase">Leestijd:</span>
                          <span className="font-mono">{post.readTime} min</span>
                        </div>

                        {post.seoScore !== undefined && (
                          <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-800 pl-3.5">
                            <span className="text-[10px] font-bold font-mono uppercase text-slate-400">SEO:</span>
                            <span className={`font-mono font-bold ${
                              post.seoScore >= 80 ? "text-emerald-500" : "text-amber-500"
                            }`}>{post.seoScore}%</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Single Actions & Controls */}
                    <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 w-full lg:w-auto pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800/80">
                      
                      {post.status === "scheduled" && (
                        <button
                          id={`pub-now-btn-${post.id}`}
                          onClick={() => handlePublishNow(post.id)}
                          disabled={publishingId === post.id}
                          className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm inline-flex items-center justify-center gap-1.5"
                        >
                          {publishingId === post.id ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Publiceren...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>Direct Publiceren</span>
                            </>
                          )}
                        </button>
                      )}

                      {post.status === "published" && post.publishedUrl && (
                        <a
                          href={post.publishedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900/60 text-slate-700 dark:text-slate-350 text-xs font-semibold text-center inline-flex items-center justify-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Bekijken</span>
                        </a>
                      )}

                      {/* Single button toggle as requested */}
                      <div className="flex items-center justify-between sm:justify-start lg:justify-between gap-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-800/60 p-2 rounded-lg">
                        <span className="text-[10px] font-bold text-slate-500 uppercase font-mono">Socials:</span>
                        
                        {/* Quick toggle check indicator */}
                        <button
                          id={`toggle-socials-${post.id}`}
                          onClick={() => handleToggleSocials(post)}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                            post.sendToSocials ? "bg-indigo-600" : "bg-slate-250 dark:bg-slate-850"
                          }`}
                        >
                          <span
                            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                              post.sendToSocials ? "translate-x-5" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>

                      <button
                        id={`delete-btn-${post.id}`}
                        onClick={() => handleDeletePost(post.id)}
                        className="px-3 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 hover:text-rose-700 dark:hover:text-rose-450 border border-transparent hover:border-rose-100 dark:hover:border-rose-900 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Verwijder</span>
                      </button>

                    </div>
                  </div>

                  {/* Social Syndication Status Line */}
                  {post.sendToSocials && post.socialPlatforms && post.socialPlatforms.length > 0 && (
                    <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-900/60 flex items-center justify-between text-[11px] text-slate-450 dark:text-slate-505 bg-slate-50/50 dark:bg-slate-950/20 px-3 py-2 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Share2 className="w-3.5 h-3.5 text-indigo-550 shrink-0" />
                        <span>Kruisbestuivend gepland op:</span>
                        <div className="flex gap-1.5">
                          {post.socialPlatforms.map(p => (
                            <span key={p} className="text-[9px] font-bold uppercase rounded px-1.5 py-0.5 bg-indigo-100/60 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      {post.status === "published" ? (
                        <span className="text-emerald-500 font-bold flex items-center gap-0.5">
                          <Check className="w-3.5 h-3.5" /> Verzonden naar API
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">In wachtrij</span>
                      )}
                    </div>
                  )}

                  {/* Social Caption Preview Box */}
                  {post.sendToSocials && post.socialCaption && (
                    <div className="mt-2.5 p-3 rounded-lg bg-slate-100/35 dark:bg-slate-950/30 border border-slate-150/40 text-[11px] text-slate-600 dark:text-slate-350 italic">
                      &ldquo;{post.socialCaption}&rdquo;
                    </div>
                  )}

                </div>
              ))
            )}
          </div>
          )}
        </div>
      )}

      {/* Detailed Post Dialog Hover / Modal */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative animate-fadeIn text-slate-800 dark:text-slate-101">
            
            <div className="flex justify-between items-start">
              <div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold leading-4 tracking-wider uppercase ${
                  selectedPost.status === "published" 
                    ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400" 
                    : "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400"
                }`}>
                  {selectedPost.status === "published" ? "Gepubliceerd" : "Ingepland"}
                </span>
                
                <h4 className="text-sm font-bold mt-2 text-slate-900 dark:text-white leading-snug">
                  {selectedPost.title}
                </h4>
              </div>
              <button
                id="close-post-modal"
                onClick={() => setSelectedPost(null)}
                className="text-slate-450 hover:text-slate-650 dark:hover:text-white p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-804 transition-all font-semibold cursor-pointer text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-h-[140px] overflow-y-auto bg-slate-50 dark:bg-slate-950/35 p-3 rounded-lg border border-slate-100 dark:border-white/5">
              {selectedPost.content}
            </div>

            <div className="grid grid-cols-2 gap-4 text-[11px] font-mono border-t border-slate-101 dark:border-slate-801 pt-3">
              <div>
                <span className="text-slate-400 uppercase tracking-widest text-[9px] block">Publicatiedatum</span>
                <span className="text-slate-705 dark:text-slate-300 font-semibold flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  {new Date(selectedPost.scheduledAt).toLocaleDateString("nl-NL")} om {" "}
                  {new Date(selectedPost.scheduledAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div>
                <span className="text-slate-400 uppercase tracking-widest text-[9px] block">SEO Optimalisatie</span>
                <span className={`font-bold flex items-center gap-1 mt-0.5 ${
                  selectedPost.seoScore && selectedPost.seoScore >= 85 ? "text-emerald-500" :
                  selectedPost.seoScore && selectedPost.seoScore >= 70 ? "text-amber-500" : "text-rose-500"
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {selectedPost.seoScore ?? 85}%
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 uppercase tracking-widest text-[9px] block">Doelwebsites ({selectedPost.targetWebsites?.length})</span>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {selectedPost.targetWebsites?.map((webId: string) => {
                    const web = websites.find(w => w.id === webId);
                    return (
                      <span key={webId} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300 text-[10px] font-semibold flex items-center gap-1 border border-slate-150 dark:border-slate-700/60">
                        <Globe className="w-3 h-3 text-slate-450" />
                        {web ? web.name : "Extern CMS"}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {selectedPost.sendToSocials && selectedPost.socialCaption && (
              <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="flex items-center gap-1.5 text-xs text-indigo-650 dark:text-indigo-405 font-bold uppercase tracking-wider font-mono">
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Geplande Social Post</span>
                </div>
                <div className="bg-indigo-50/50 dark:bg-indigo-950/25 p-3 rounded-lg border border-indigo-150/40 text-[11px] text-slate-655 dark:text-slate-300 italic">
                  &ldquo;{selectedPost.socialCaption}&rdquo;
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                id="modal-delete-btn"
                onClick={() => {
                  handleDeletePost(selectedPost.id);
                  setSelectedPost(null);
                }}
                className="px-3 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/10 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Verwijder</span>
              </button>

              {selectedPost.status === "scheduled" && (
                <button
                  id="modal-publish-btn"
                  onClick={async () => {
                    setSelectedPost(null);
                    handlePublishNow(selectedPost.id);
                  }}
                  className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-all shadow-emerald-500/10 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Direct Publiceren</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
