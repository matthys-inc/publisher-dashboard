import React, { useState, useEffect } from "react";
import {
  Globe, Plus, Trash2, CheckCircle2, AlertCircle, Linkedin, Twitter, Facebook, Instagram, ShieldCheck, HelpCircle, Sparkles, Key, X
} from "lucide-react";
import { Website, SocialChannel, ScheduledPost } from "../types";

interface ChannelsManagerProps {
  darkMode: boolean;
  websites: Website[];
  socials: SocialChannel[];
  posts: ScheduledPost[];
  onWebsitesUpdated: () => void;
}

export default function ChannelsManager({ darkMode, websites, socials, posts, onWebsitesUpdated }: ChannelsManagerProps) {
  const [newWebName, setNewWebName] = useState("");
  const [newWebUrl, setNewWebUrl] = useState("");
  const [newWebCms, setNewWebCms] = useState<"wordpress" | "custom" | "shopify">("wordpress");
  const [addingWebsite, setAddingWebsite] = useState(false);
  const [ssoFeedback, setSsoFeedback] = useState<string | null>(null);
  const [webFeedback, setWebFeedback] = useState<string | null>(null);
  // Website die op verwijderen wacht (bevestigingsdialoog).
  const [pendingDelete, setPendingDelete] = useState<Website | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Listen for success message from the OAuth popup (after callback completes).
  // De popup draait op hetzelfde domein, dus we accepteren alleen same-origin berichten.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setSsoFeedback("Google succesvol gekoppeld via Single Sign-On!");
        onWebsitesUpdated();
        setTimeout(() => setSsoFeedback(null), 5000);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onWebsitesUpdated]);

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
      alert("Schakel je popupblocker uit om het Single Sign-On machtigingsportaal te openen.");
    }
  };

  // Aantal geplande/gepubliceerde posts dat nog naar een site verwijst.
  const postsTargeting = (websiteId: string) =>
    posts.filter((p) => Array.isArray(p.targetWebsites) && p.targetWebsites.includes(websiteId)).length;

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/websites/${pendingDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { affectedPosts?: number };
        const affected = typeof data.affectedPosts === "number" ? data.affectedPosts : 0;
        setWebFeedback(
          affected > 0
            ? `Website "${pendingDelete.name}" verwijderd. Let op: ${affected} geplande post(s) verwezen nog naar deze site.`
            : `Website "${pendingDelete.name}" verwijderd.`
        );
        setPendingDelete(null);
        onWebsitesUpdated();
        setTimeout(() => setWebFeedback(null), 6000);
      } else {
        alert("Verwijderen mislukt. Probeer het opnieuw.");
      }
    } catch (err) {
      console.error(err);
      alert("Netwerkfout bij het verwijderen.");
    } finally {
      setDeleting(false);
    }
  };

  const handleAddWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebName || !newWebUrl) return;

    try {
      const res = await fetch("/api/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWebName,
          url: newWebUrl,
          cms: newWebCms,
          connected: true
        })
      });

      if (res.ok) {
        setNewWebName("");
        setNewWebUrl("");
        setAddingWebsite(false);
        onWebsitesUpdated();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="border-b border-slate-100 dark:border-slate-800 pb-5">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
          Mijn Kanalen &amp; Gekoppelde Websites
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Beheer de websites waarop je blogt en de social media accounts waarnaar content gesynchroniseerd wordt.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Websites Management */}
        <div className="p-5 rounded-xl border border-slate-200/50 dark:border-slate-800/80 bg-white dark:bg-slate-900/40 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Gekoppelde Websites
              </h3>
              <p className="text-xs text-slate-400">
                Websites geconfigureerd voor geautomatiseerde WordPress of Custom Webhook publicatie.
              </p>
            </div>
            
            <button
              id="btn-add-web-toggle"
              onClick={() => setAddingWebsite(!addingWebsite)}
              className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-indigo-50 border border-indigo-200 dark:border-indigo-900 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 flex items-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Website Toevoegen
            </button>
          </div>

          {addingWebsite && (
            <form onSubmit={handleAddWebsite} className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 p-4 rounded-xl space-y-3 animate-fadeIn">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Nieuwe Website Gevings-form</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">Site Naam</label>
                  <input
                    id="add-web-name"
                    type="text"
                    required
                    placeholder="bv. Mijn Webwinkel"
                    value={newWebName}
                    onChange={e => setNewWebName(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">Volledige URL</label>
                  <input
                    id="add-web-url"
                    type="url"
                    required
                    placeholder="https://mijnwebsite.nl"
                    value={newWebUrl}
                    onChange={e => setNewWebUrl(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <div className="flex gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <input 
                      type="radio" 
                      name="cms" 
                      checked={newWebCms === "wordpress"}
                      onChange={() => setNewWebCms("wordpress")}
                      className="text-indigo-650"
                    />
                    <span>Wordpress CMS</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <input 
                      type="radio" 
                      name="cms" 
                      checked={newWebCms === "custom"}
                      onChange={() => setNewWebCms("custom")}
                      className="text-indigo-650"
                    />
                    <span>Custom Webhook</span>
                  </label>
                </div>

                <div className="flex gap-2">
                  <button 
                    id="btn-cancel-add-web"
                    type="button" 
                    onClick={() => setAddingWebsite(false)} 
                    className="text-xs text-slate-400 hover:text-slate-600 font-semibold px-2 py-1"
                  >
                    Annuleer
                  </button>
                  <button 
                    id="btn-save-web"
                    type="submit" 
                    className="px-3 py-1 text-xs font-bold rounded bg-indigo-600 text-white"
                  >
                    Opslaan
                  </button>
                </div>
              </div>
            </form>
          )}

          {webFeedback && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-900/40 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 animate-fadeIn">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{webFeedback}</span>
            </div>
          )}

          <div className="space-y-3">
            {websites.map(web => (
              <div key={web.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/15 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{web.name}</h4>
                    <span className="text-[10px] font-mono text-slate-400 block">{web.url}</span>
                    <span className="px-1.5 py-0.5 text-[8px] font-black uppercase rounded mt-1 inline-block bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      CMS: {web.cms}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> API Verbonden
                  </span>
                  <button
                    id={`btn-delete-web-${web.id}`}
                    onClick={() => setPendingDelete(web)}
                    title={`Verwijder ${web.name}`}
                    aria-label={`Verwijder ${web.name}`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200/60 dark:hover:border-red-900/50 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {websites.length === 0 && (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                Nog geen websites gekoppeld. Voeg je eerste website toe met de knop hierboven.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Social Media Connections List */}
        <div className="p-5 rounded-xl border border-slate-200/50 dark:border-slate-800/80 bg-white dark:bg-slate-900/40 space-y-4">
          <div className="flex justify-between items-start gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Social Media API Kanalen
              </h3>
              <p className="text-xs text-slate-400">
                Automatische publicatie feeds en engagement monitors per platform.
              </p>
            </div>
            
            <button
              id="btn-sso-channels-link"
              onClick={handleSSOConnect}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] uppercase font-mono tracking-wider flex items-center gap-1 transition-all cursor-pointer"
            >
              <Key className="w-3 h-3" />
              <span>SSO KOPPELING</span>
            </button>
          </div>

          {ssoFeedback && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-900/40 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 animate-fadeIn">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{ssoFeedback}</span>
            </div>
          )}

          <div className="space-y-3.5">
            {socials.map(plat => {
              const isLinkedIn = plat.id === "linkedin";
              const isTwitter = plat.id === "twitter";
              const isFacebook = plat.id === "facebook";
              const isInstagram = plat.id === "instagram";
              
              return (
                <div key={plat.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/15 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${
                      isLinkedIn ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600" :
                      isTwitter ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" :
                      isFacebook ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600" :
                      "bg-pink-50 dark:bg-pink-950/40 text-pink-500"
                    }`}>
                      {isLinkedIn && <Linkedin className="w-4 h-4" />}
                      {isTwitter && <Twitter className="w-4 h-4" />}
                      {isFacebook && <Facebook className="w-4 h-4" />}
                      {isInstagram && <Instagram className="w-4 h-4" />}
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{plat.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono">{plat.connected ? plat.handle : "Niet Gekoppeld"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {plat.connected ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/50 shadow-sm">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Connected</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-800">
                        <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Disconnected</span>
                      </span>
                    )}
                  </div>

                </div>
              );
            })}
          </div>

          <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Geautomatiseerd publiceren naar deze socials loopt binnenkort via een <strong>Buffer</strong>-koppeling.
              De SSO-knop hierboven koppelt nu je <strong>Google</strong>-account (Analytics &amp; Search Console).
            </span>
          </div>

          <div className="p-4 rounded-xl bg-indigo-50/45 dark:bg-indigo-950/20 border border-indigo-100/40 dark:border-indigo-900/40 text-xs text-indigo-700 dark:text-indigo-400 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 mt-0.5 text-indigo-650 shrink-0" />
            <div className="space-y-1">
              <span className="font-bold">Beveiligde Sleutels</span>
              <p className="text-[11px] leading-relaxed text-slate-550 dark:text-slate-400">
                Al je tokens en private API keys worden server-side behandeld. Geen enkele sleutel of OAuth cookie lekt uit naar de browser bundle.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Bevestigingsdialoog voor verwijderen */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => !deleting && setPendingDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Website verwijderen</h3>
              </div>
              <button
                onClick={() => !deleting && setPendingDelete(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Sluiten"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Weet je zeker dat je <strong className="text-slate-900 dark:text-white">{pendingDelete.name}</strong>{" "}
              (<span className="font-mono">{pendingDelete.url}</span>) wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </p>

            {postsTargeting(pendingDelete.id) > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/50 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  Let op: <strong>{postsTargeting(pendingDelete.id)}</strong> geplande post(s) verwijzen nog naar deze site.
                  Het verwijderen gaat door, maar controleer daarna je planner.
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                className="px-3 py-2 text-xs font-semibold rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Annuleer
              </button>
              <button
                id="btn-confirm-delete-web"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-3.5 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-sm disabled:opacity-60 flex items-center gap-1.5"
              >
                {deleting ? "Verwijderen..." : "Definitief verwijderen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
