import React, { useState, useEffect } from "react";
import { 
  Settings, Key, Globe, Shield, RefreshCw, CheckCircle2, AlertCircle, Sparkles, 
  HelpCircle, Linkedin, Twitter, Eye, EyeOff, Calendar 
} from "lucide-react";
import { IntegrationCredentials } from "../types";

interface IntegrationsManagerProps {
  darkMode: boolean;
  onCredentialsUpdated: () => void;
}

export default function IntegrationsManager({ darkMode, onCredentialsUpdated }: IntegrationsManagerProps) {
  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState<IntegrationCredentials>({
    googleConnected: false,
    googleEmail: "",
    googleAnalyticsConnected: false,
    googleAnalyticsPropertyId: "",
    searchConsoleConnected: false,
    searchConsoleSiteUrl: "",
    linkedinConnected: false,
    twitterConnected: false,
    wordpressConnected: false,
  });

  // Form states
  const [gaPropertyId, setGaPropertyId] = useState("");
  const [gscSiteUrl, setGscSiteUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchCredentials = async () => {
    try {
      const res = await fetch("/api/data");
      const data = await res.json();
      if (data.credentials) {
        setCredentials(data.credentials);
        setGaPropertyId(data.credentials.googleAnalyticsPropertyId || "");
        setGscSiteUrl(data.credentials.searchConsoleSiteUrl || "");
      }
    } catch (e) {
      console.error("Error loading credentials:", e);
    } finally {
      setLoading(false);
    }
  };

  // Load current credential states
  useEffect(() => {
    fetchCredentials();
  }, []);

  // Listen for success message from the OAuth popup (after callback completes).
  // De popup draait op hetzelfde domein -> alleen same-origin berichten accepteren.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setFeedback("Google succesvol gekoppeld! Analytics en Search Console zijn nu verbonden.");
        fetchCredentials();
        onCredentialsUpdated();
        setTimeout(() => setFeedback(null), 6000);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onCredentialsUpdated]);

  const handleSSOConnect = () => {
    const width = 500;
    const height = 650;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      "/auth/google",
      "sso_popup",
      `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
    );

    if (!popup) {
      alert("Schakel je popupblocker uit om het Google machtigingsportaal te openen.");
    }
  };

  const handleDisconnect = async () => {
    try {
      const res = await fetch("/api/auth/google/disconnect", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.credentials) setCredentials(data.credentials);
        setFeedback("Google-koppeling verbroken.");
        onCredentialsUpdated();
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch (e) {
      console.error("Disconnect failed:", e);
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleAnalyticsPropertyId: gaPropertyId,
          searchConsoleSiteUrl: gscSiteUrl,
        })
      });

      if (res.ok) {
        setFeedback("Koppelingsinstellingen succesvol bijgewerkt!");
        const data = await res.json();
        if (data.credentials) {
          setCredentials(data.credentials);
        }
        onCredentialsUpdated();
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback("Fout bij het updaten van de API-instellingen.");
      }
    } catch (err) {
      setFeedback("Netwerkprobleem bij het opslaan.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-500 mb-2" />
        <p className="text-sm text-slate-500 font-mono">Gegevens ophalen...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="border-b border-slate-100 dark:border-slate-800 pb-5">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
          Google &amp; Social API Integraties
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Koppel je Google Analytics 4, Google Search Console en social media API-sleutels om prestaties in één dashboard te synchroniseren.
        </p>
      </div>

      {/* Single Sign-On Fast Path Banner */}
      <div className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
        <div className="space-y-1 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              Aanbevolen Methode
            </span>
            <span className="text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <Shield className="w-3 h-3" /> Secure SSO
            </span>
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span>Koppel je Google-account met Single Sign-On</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Maak via de beveiligde Google OAuth-flow direct verbinding met <strong>Google Analytics 4</strong> en <strong>Google Search Console</strong>. Je tokens worden server-side opgeslagen. Automatisch publiceren naar socials volgt binnenkort via een Buffer-koppeling.
          </p>
          {credentials.googleConnected && (
            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verbonden{credentials.googleEmail ? ` als ${credentials.googleEmail}` : ""}</span>
            </p>
          )}
        </div>

        {credentials.googleConnected ? (
          <div className="flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-auto shrink-0">
            <button
              id="btn-sso-reconnect"
              onClick={handleSSOConnect}
              className="px-5 py-3 rounded-xl bg-emerald-550 hover:bg-emerald-600 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Key className="w-4 h-4" />
              <span>Opnieuw koppelen</span>
            </button>
            <button
              id="btn-sso-disconnect"
              onClick={handleDisconnect}
              className="px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Ontkoppelen</span>
            </button>
          </div>
        ) : (
          <button
            id="btn-sso-connect-launch"
            onClick={handleSSOConnect}
            className="w-full md:w-auto px-5 py-3 rounded-xl bg-emerald-550 hover:bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-500/10 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Key className="w-4 h-4" />
            <span>Koppel met Google</span>
          </button>
        )}
      </div>

      {feedback && (
        <div className="p-4 rounded-xl border border-indigo-200/50 bg-indigo-50/70 dark:bg-indigo-950 dark:border-indigo-900 text-xs font-semibold text-indigo-850 dark:text-indigo-300 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-indigo-650" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* API Connection Form (Left Column) */}
        <div className="lg:col-span-7 bento-card space-y-6">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 leading-none font-display">
            <Key className="w-4 h-4 text-emerald-500" />
            <span>Koppel Google API's</span>
          </h3>

          <form onSubmit={handleSaveCredentials} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-450 mb-1.5 flex justify-between items-center">
                <span>Google Analytics 4 (GA4) Property ID</span>
                <span className="text-[10px] text-indigo-550 underline hover:cursor-pointer">Waar vind ik dit?</span>
              </label>
              <input 
                id="input-ga4-property"
                type="text"
                placeholder="bv. 394850123"
                value={gaPropertyId}
                onChange={e => setGaPropertyId(e.target.value)}
                className="w-full text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1.5">
                Laat leeg of vul je GA4 Property ID in om live bezoekersaantallen en bounces te laden in je statistieken.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-455 mb-1.5 flex justify-between items-center">
                <span>Google Search Console (GSC) Domain URL</span>
              </label>
              <input 
                id="input-gsc-domain"
                type="url"
                placeholder="bv. https://techinzichten.nl"
                value={gscSiteUrl}
                onChange={e => setGscSiteUrl(e.target.value)}
                className="w-full text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1.5">
                Koppel je geverifieerde Search Console URL om de organische clicks, Google impressies en rankings te laden.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex justify-end">
              <button
                id="btn-save-credentials"
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Koppelen...</span>
                  </>
                ) : (
                  <>
                    <span>Instellingen Opslaan &amp; Synchroniseren</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Social Web API tokens guidance */}
          <div className="pt-5 border-t border-slate-100 dark:border-slate-800/80 space-y-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-450" />
              <span>Social Media Publicatie (via Buffer)</span>
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Automatisch posten naar LinkedIn, Twitter/X, Facebook en Instagram loopt binnenkort via één Buffer-koppeling. Daarmee is geen aparte app-review per platform nodig.
            </p>

            <div className="space-y-3.5">
              <div className="p-3.5 rounded-lg border border-slate-200/50 bg-slate-50/50 dark:bg-slate-950/20 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600">
                    <Linkedin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">LinkedIn</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Posten via Buffer</span>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-800">
                  <AlertCircle className="w-3 h-3" /> Binnenkort
                </span>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200/50 bg-slate-50/50 dark:bg-slate-950/20 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
                    <Twitter className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Twitter / X</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Posten via Buffer</span>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-800">
                  <AlertCircle className="w-3 h-3" /> Binnenkort
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Integration Instructions Sidebar (Right Column) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bento-card space-y-4">
            <h4 className="text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1.5 font-mono">
              <Sparkles className="text-yellow-500 w-4 h-4" /> Handleiding API Koppeling
            </h4>
            
            <div className="space-y-4 text-xs text-slate-600 dark:text-slate-350 leading-relaxed">
              <p>
                Om je Google-account te koppelen registreer je eenmalig een OAuth-client. De volledige stappen staan in <code>OAUTH_SETUP.md</code> in de repo.
              </p>

              <div className="space-y-3">
                <div className="flex gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center font-bold text-[10px] text-slate-500 shrink-0">1</div>
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-150">Maak een Google OAuth-client</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">In Google Cloud Console &gt; <strong>APIs &amp; Services &gt; Credentials</strong>, type <strong>Web application</strong>.</p>
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center font-bold text-[10px] text-slate-500 shrink-0">2</div>
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-150">Zet de secrets in Cloudflare</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">Cloudflare Pages &gt; je project &gt; <strong>Settings &gt; Environment variables</strong>: <code>GOOGLE_CLIENT_ID</code> en <code>GOOGLE_CLIENT_SECRET</code>.</p>
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center font-bold text-[10px] text-slate-500 shrink-0">3</div>
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-150">Koppel via Single Sign-On</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">Klik hierboven op <strong>Koppel met Google</strong> en verleen toegang. De status hieronder springt op CONNECTED.</p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-900/80">
                <span className="font-bold text-[11px] text-slate-400 uppercase tracking-wider block mb-1">Actuele Status</span>
                <div className="space-y-2 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span>Google OAuth:</span>
                    <span className={credentials.googleConnected ? "text-emerald-500 font-bold" : "text-slate-400"}>
                      {credentials.googleConnected ? "CONNECTED" : "NOT CONNECTED"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Google Analytics:</span>
                    <span className={credentials.googleAnalyticsConnected ? "text-emerald-500 font-bold" : "text-slate-400"}>
                      {credentials.googleAnalyticsConnected ? "CONNECTED" : "NOT CONNECTED"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Search Console:</span>
                    <span className={credentials.searchConsoleConnected ? "text-emerald-500 font-bold" : "text-slate-400"}>
                      {credentials.searchConsoleConnected ? "CONNECTED" : "NOT CONNECTED"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Socials (Buffer):</span>
                    <span className="text-slate-400">BINNENKORT</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
