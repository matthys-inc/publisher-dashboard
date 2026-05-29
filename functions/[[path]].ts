import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { GoogleGenAI } from "@google/genai";

type Env = {
  DB: D1Database;
  GEMINI_API_KEY?: string;
  // Google OAuth (zie OAUTH_SETUP.md). Server-side secrets, nooit in de bundle.
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  // Vast basis-domein voor OAuth redirects, bv. https://publisher-dashboard.pages.dev
  // (geen per-deploy hash-subdomein gebruiken). Valt terug op de request-origin.
  APP_BASE_URL?: string;
  // Inlogmuur: geheim om de sessie-cookie te ondertekenen (HMAC). Verplicht om in
  // te kunnen loggen. Zet als Secret in Cloudflare, nooit committen.
  SESSION_SECRET?: string;
  // Komma-gescheiden allowlist van e-mailadressen die toegang krijgen tot het
  // dashboard. Alleen accounts op deze lijst mogen na Google-login naar binnen.
  ALLOWED_EMAILS?: string;
};

// Google OAuth constanten
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
].join(" ");
const OAUTH_STATE_COOKIE = "g_oauth_state";
// Onthoudt of de lopende OAuth-flow een volledige login (full-page) is of de
// popup-koppeling vanuit "Sleutels & Integraties".
const OAUTH_FLOW_COOKIE = "g_oauth_flow";
// Ondertekende sessie-cookie van de inlogmuur.
const SESSION_COOKIE = "pd_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dagen (in seconden)

// Bepaalt het basis-domein voor de redirect_uri. Voorkeur: APP_BASE_URL env-var,
// anders de origin van het inkomende request.
const getBaseUrl = (c: { env: Env; req: { url: string } }) => {
  const configured = c.env.APP_BASE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  return new URL(c.req.url).origin;
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------- inlogmuur: allowlist + ondertekende sessie ----------

const textEncoder = new TextEncoder();

// Allowlist uit env (komma-gescheiden), genormaliseerd naar lowercase.
const allowedEmails = (env: Env): string[] =>
  (env.ALLOWED_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const isAllowedEmail = (env: Env, email: string): boolean => {
  const e = (email || "").trim().toLowerCase();
  return !!e && allowedEmails(env).includes(e);
};

// base64url-helpers (Workers heeft geen Buffer; btoa/atob werken op binaire strings).
const bytesToB64url = (bytes: ArrayBuffer | Uint8Array): string => {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const strToB64url = (s: string): string => bytesToB64url(textEncoder.encode(s));
const b64urlToStr = (s: string): string => {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
};

const hmacKey = (secret: string) =>
  crypto.subtle.importKey("raw", textEncoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);

// Sessietoken: <payload>.<signature>, payload = base64url(JSON{ email, exp }).
const signSessionToken = async (secret: string, email: string, exp: number): Promise<string> => {
  const payload = strToB64url(JSON.stringify({ email, exp }));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));
  return `${payload}.${bytesToB64url(sig)}`;
};

const verifySessionToken = async (
  secret: string,
  token: string
): Promise<{ email: string; exp: number } | null> => {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const key = await hmacKey(secret);
  const expected = bytesToB64url(await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload)));
  if (expected !== sig) return null;
  try {
    const data = JSON.parse(b64urlToStr(payload)) as { email?: string; exp?: number };
    if (!data.email || !data.exp || Date.now() > data.exp) return null;
    return { email: data.email, exp: data.exp };
  } catch {
    return null;
  }
};

// Leest de huidige geldige sessie uit de cookie (of null). Controleert ook of de
// e-mail nog op de allowlist staat, zodat verwijderen uit de lijst direct werkt.
const getSession = async (c: {
  env: Env;
  req: { url: string };
  // hono-context bevat de cookie-helper via getCookie(c, ...)
  [k: string]: unknown;
}): Promise<{ email: string } | null> => {
  const env = c.env;
  if (!env.SESSION_SECRET) return null;
  const token = getCookie(c as any, SESSION_COOKIE);
  if (!token) return null;
  const payload = await verifySessionToken(env.SESSION_SECRET, token);
  if (!payload) return null;
  if (!isAllowedEmail(env, payload.email)) return null;
  return { email: payload.email };
};

const setSessionCookie = async (c: any, email: string, baseUrl: string): Promise<boolean> => {
  if (!c.env.SESSION_SECRET) return false;
  const exp = Date.now() + SESSION_MAX_AGE * 1000;
  const token = await signSessionToken(c.env.SESSION_SECRET, email, exp);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: baseUrl.startsWith("https://"),
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return true;
};

type Variables = {};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ---------- inlogmuur: bescherm alle /api/* endpoints ----------
// Alles onder /api/* vereist een geldige sessie, behalve /api/me (die rapporteert
// juist of je ingelogd bent). De /auth/* routes blijven publiek: dat is de login
// zelf. De statische SPA-shell bevat geen data of secrets; alle gegevens komen
// uitsluitend via deze beveiligde endpoints.
app.use("/api/*", async (c, next) => {
  if (c.req.path === "/api/me") return next();
  const session = await getSession(c as any);
  if (!session) return c.json({ error: "unauthorized" }, 401);
  return next();
});

// ---------- helpers ----------

type SocialRow = {
  id: string;
  name: string;
  handle: string;
  connected: number;
  followers: number;
  engagement_rate: number;
  clicks: number;
  impressions: number;
};

type PostRow = {
  id: string;
  title: string;
  content: string;
  seo_keywords: string;
  scheduled_at: string | null;
  target_websites: string;
  send_to_socials: number;
  social_platforms: string;
  social_caption: string;
  status: string;
  read_time: number;
  published_url: string;
  seo_score: number;
};

const parseJsonArray = (s: string | null | undefined): unknown[] => {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const socialToApi = (r: SocialRow) => ({
  id: r.id,
  name: r.name,
  handle: r.handle,
  connected: !!r.connected,
  followers: r.followers,
  engagementRate: r.engagement_rate,
  clicks: r.clicks,
  impressions: r.impressions,
});

const postToApi = (r: PostRow) => ({
  id: r.id,
  title: r.title,
  content: r.content,
  seoKeywords: parseJsonArray(r.seo_keywords),
  scheduledAt: r.scheduled_at ?? "",
  targetWebsites: parseJsonArray(r.target_websites),
  sendToSocials: !!r.send_to_socials,
  socialPlatforms: parseJsonArray(r.social_platforms),
  socialCaption: r.social_caption,
  status: r.status,
  readTime: r.read_time,
  publishedUrl: r.published_url,
  seoScore: r.seo_score,
});

const readSettings = async (db: D1Database) => {
  const row = await db
    .prepare(
      `SELECT google_analytics_connected, google_analytics_property_id,
              search_console_connected, search_console_site_url,
              linkedin_connected, twitter_connected, wordpress_connected,
              google_refresh_token, google_email
       FROM settings WHERE id = 1`
    )
    .first<Record<string, number | string>>();
  const googleConnected = !!(row?.google_refresh_token as string);
  return {
    // googleConnected = er is een geldige OAuth-koppeling (refresh token aanwezig).
    googleConnected,
    googleEmail: (row?.google_email as string) || "",
    googleAnalyticsConnected: !!row?.google_analytics_connected,
    googleAnalyticsPropertyId: (row?.google_analytics_property_id as string) || "",
    searchConsoleConnected: !!row?.search_console_connected,
    searchConsoleSiteUrl: (row?.search_console_site_url as string) || "",
    linkedinConnected: !!row?.linkedin_connected,
    twitterConnected: !!row?.twitter_connected,
    wordpressConnected: !!row?.wordpress_connected,
  };
};

// Volledige (interne) tokenstatus - bevat secrets, nooit naar de client sturen.
const readGoogleTokens = async (db: D1Database) => {
  const row = await db
    .prepare(
      `SELECT google_access_token, google_refresh_token, google_token_expiry, google_email
       FROM settings WHERE id = 1`
    )
    .first<Record<string, number | string>>();
  return {
    accessToken: (row?.google_access_token as string) || "",
    refreshToken: (row?.google_refresh_token as string) || "",
    expiry: Number(row?.google_token_expiry || 0),
    email: (row?.google_email as string) || "",
  };
};

const computeReadTime = (content: string) =>
  Math.max(1, Math.ceil(content.split(/\s+/).filter(Boolean).length / 200));

// ---------- routes ----------

// Sessiestatus voor de frontend-inlogmuur. Publiek bereikbaar (geen 401), zodat de
// app kan bepalen of het loginscherm of het dashboard getoond moet worden.
app.get("/api/me", async (c) => {
  const session = await getSession(c as any);
  if (session) return c.json({ authenticated: true, email: session.email });
  return c.json({ authenticated: false });
});

app.get("/api/data", async (c) => {
  const db = c.env.DB;
  const [websites, socials, posts, credentials] = await Promise.all([
    db.prepare(`SELECT id, name, url, cms, connected FROM websites ORDER BY created_at ASC`).all(),
    db.prepare(`SELECT * FROM socials ORDER BY id ASC`).all<SocialRow>(),
    db.prepare(`SELECT * FROM posts ORDER BY created_at DESC`).all<PostRow>(),
    readSettings(db),
  ]);

  return c.json({
    websites: (websites.results ?? []).map((w: any) => ({ ...w, connected: !!w.connected })),
    socials: (socials.results ?? []).map(socialToApi),
    posts: (posts.results ?? []).map(postToApi),
    credentials,
  });
});

app.post("/api/websites", async (c) => {
  const body = await c.req.json<{ name: string; url: string; cms?: string; connected?: boolean }>();
  const id = "web_" + Date.now();
  await c.env.DB.prepare(
    `INSERT INTO websites (id, name, url, cms, connected) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, body.name, body.url, body.cms ?? "custom", body.connected ? 1 : 0)
    .run();
  return c.json({ id, name: body.name, url: body.url, cms: body.cms ?? "custom", connected: !!body.connected });
});

app.delete("/api/websites/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare(`SELECT id FROM websites WHERE id = ?`).bind(id).first();
  if (!existing) return c.json({ error: "Website not found" }, 404);

  // Tel hoeveel geplande/gepubliceerde posts nog naar deze site verwijzen.
  // We blokkeren niet, maar geven het aantal terug zodat de UI kan waarschuwen.
  const postsRes = await c.env.DB.prepare(`SELECT target_websites FROM posts`).all<{ target_websites: string }>();
  let affectedPosts = 0;
  for (const p of postsRes.results ?? []) {
    const targets = parseJsonArray(p.target_websites) as string[];
    if (targets.includes(id)) affectedPosts++;
  }

  await c.env.DB.prepare(`DELETE FROM websites WHERE id = ?`).bind(id).run();

  return c.json({ success: true, affectedPosts });
});

app.post("/api/credentials", async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  const current = await readSettings(c.env.DB);
  const merged = { ...current, ...body };

  const gaPropId = String(merged.googleAnalyticsPropertyId ?? "");
  const gscUrl = String(merged.searchConsoleSiteUrl ?? "");

  // Bij een echte OAuth-koppeling blijft de status "connected", ook als de
  // gebruiker (nog) geen property id / site url heeft ingevuld.
  const gaConnected = current.googleConnected || !!gaPropId;
  const gscConnected = current.googleConnected || !!gscUrl;

  await c.env.DB.prepare(
    `UPDATE settings SET
       google_analytics_connected = ?,
       google_analytics_property_id = ?,
       search_console_connected = ?,
       search_console_site_url = ?,
       linkedin_connected = ?,
       twitter_connected = ?,
       wordpress_connected = ?
     WHERE id = 1`
  )
    .bind(
      gaConnected ? 1 : 0,
      gaPropId,
      gscConnected ? 1 : 0,
      gscUrl,
      merged.linkedinConnected ? 1 : 0,
      merged.twitterConnected ? 1 : 0,
      merged.wordpressConnected ? 1 : 0
    )
    .run();

  return c.json({ success: true, credentials: await readSettings(c.env.DB) });
});

app.get("/api/posts", async (c) => {
  const rows = await c.env.DB.prepare(`SELECT * FROM posts ORDER BY created_at DESC`).all<PostRow>();
  return c.json((rows.results ?? []).map(postToApi));
});

app.post("/api/posts", async (c) => {
  const body = await c.req.json<any>();
  const id = "post_" + Date.now();
  const seoKeywords = Array.isArray(body.seoKeywords) ? body.seoKeywords : [];
  const targetWebsites = Array.isArray(body.targetWebsites) ? body.targetWebsites : [];
  const socialPlatforms = Array.isArray(body.socialPlatforms) ? body.socialPlatforms : [];
  const status = body.status ?? "scheduled";
  const seoScore =
    typeof body.seoScore === "number" ? body.seoScore : Math.floor(Math.random() * 30) + 60;
  const readTime = computeReadTime(String(body.content ?? ""));

  await c.env.DB.prepare(
    `INSERT INTO posts (id, title, content, seo_keywords, scheduled_at, target_websites,
       send_to_socials, social_platforms, social_caption, status, read_time, published_url, seo_score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      body.title ?? "",
      body.content ?? "",
      JSON.stringify(seoKeywords),
      body.scheduledAt ?? null,
      JSON.stringify(targetWebsites),
      body.sendToSocials ? 1 : 0,
      JSON.stringify(socialPlatforms),
      body.socialCaption ?? "",
      status,
      readTime,
      body.publishedUrl ?? "",
      seoScore
    )
    .run();

  const row = await c.env.DB.prepare(`SELECT * FROM posts WHERE id = ?`).bind(id).first<PostRow>();
  return c.json(row ? postToApi(row) : { id });
});

app.put("/api/posts/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(`SELECT * FROM posts WHERE id = ?`).bind(id).first<PostRow>();
  if (!existing) return c.json({ error: "Post not found" }, 404);

  const body = await c.req.json<any>();
  const merged = { ...postToApi(existing), ...body };
  const readTime = computeReadTime(String(merged.content ?? ""));

  await c.env.DB.prepare(
    `UPDATE posts SET
       title = ?, content = ?, seo_keywords = ?, scheduled_at = ?, target_websites = ?,
       send_to_socials = ?, social_platforms = ?, social_caption = ?, status = ?,
       read_time = ?, published_url = ?, seo_score = ?
     WHERE id = ?`
  )
    .bind(
      merged.title ?? "",
      merged.content ?? "",
      JSON.stringify(merged.seoKeywords ?? []),
      merged.scheduledAt ?? null,
      JSON.stringify(merged.targetWebsites ?? []),
      merged.sendToSocials ? 1 : 0,
      JSON.stringify(merged.socialPlatforms ?? []),
      merged.socialCaption ?? "",
      merged.status ?? "scheduled",
      readTime,
      merged.publishedUrl ?? "",
      merged.seoScore ?? 0,
      id
    )
    .run();

  const row = await c.env.DB.prepare(`SELECT * FROM posts WHERE id = ?`).bind(id).first<PostRow>();
  return c.json(row ? postToApi(row) : { id });
});

app.delete("/api/posts/:id", async (c) => {
  await c.env.DB.prepare(`DELETE FROM posts WHERE id = ?`).bind(c.req.param("id")).run();
  return c.json({ success: true });
});

app.post("/api/posts/:id/publish", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(`SELECT * FROM posts WHERE id = ?`).bind(id).first<PostRow>();
  if (!existing) return c.json({ error: "Post not found" }, 404);

  const post = postToApi(existing);
  const targets = post.targetWebsites as string[];
  const website = targets.length
    ? await c.env.DB.prepare(`SELECT url FROM websites WHERE id = ? LIMIT 1`).bind(targets[0]).first<{ url: string }>()
    : null;
  const domain = website?.url || "https://mijnwebsite.nl";
  const slug = (post.title || "post")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const publishedUrl = `${domain}/blog/${slug}`;

  await c.env.DB.prepare(`UPDATE posts SET status = 'published', published_url = ? WHERE id = ?`)
    .bind(publishedUrl, id)
    .run();

  if (post.sendToSocials && Array.isArray(post.socialPlatforms) && post.socialPlatforms.length) {
    for (const pid of post.socialPlatforms as string[]) {
      const social = await c.env.DB.prepare(`SELECT connected, clicks, impressions FROM socials WHERE id = ?`)
        .bind(pid)
        .first<{ connected: number; clicks: number; impressions: number }>();
      if (social?.connected) {
        const clicks = social.clicks + Math.floor(Math.random() * 40) + 10;
        const impressions = social.impressions + Math.floor(Math.random() * 300) + 100;
        await c.env.DB.prepare(`UPDATE socials SET clicks = ?, impressions = ? WHERE id = ?`)
          .bind(clicks, impressions, pid)
          .run();
      }
    }
  }

  const updated = await c.env.DB.prepare(`SELECT * FROM posts WHERE id = ?`).bind(id).first<PostRow>();
  return c.json({ success: true, post: updated ? postToApi(updated) : null });
});

// ---------- Google OAuth (echte koppeling) ----------

// Klein HTML-paginaatje voor de popup. Sluit zichzelf en seint het hoofdvenster
// in via postMessage (same-origin, dus targetOrigin = eigen origin).
const oauthResultPage = (opts: {
  baseUrl: string;
  ok: boolean;
  title: string;
  message: string;
}) => `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.title)}</title>
  <style>
    body { background:#0f172a; color:#f1f5f9; font-family: system-ui, -apple-system, sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:1rem; }
    .card { max-width:420px; width:100%; background:#1e293b; border:1px solid #334155; border-radius:1rem; padding:1.75rem; box-shadow:0 10px 40px rgba(0,0,0,.4); }
    h2 { font-size:1rem; margin:0 0 .5rem; }
    p { font-size:.8rem; color:#94a3b8; line-height:1.5; margin:.25rem 0; }
    .ok { color:#34d399; } .err { color:#f87171; }
    button { margin-top:1.25rem; width:100%; padding:.6rem; border:none; border-radius:.6rem; background:#334155; color:#e2e8f0; font-size:.8rem; font-weight:600; cursor:pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h2 class="${opts.ok ? "ok" : "err"}">${escapeHtml(opts.title)}</h2>
    <p>${escapeHtml(opts.message)}</p>
    <button onclick="closeNow()">Venster sluiten</button>
  </div>
  <script>
    var TARGET = ${JSON.stringify(opts.baseUrl)};
    var OK = ${opts.ok ? "true" : "false"};
    function notifyAndClose() {
      try {
        if (window.opener && OK) {
          window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider: 'google' }, TARGET);
        }
      } catch (e) {}
    }
    function closeNow() { notifyAndClose(); window.close(); }
    if (OK) { notifyAndClose(); setTimeout(function(){ window.close(); }, 1200); }
  </script>
</body>
</html>`;

// Instructiepagina wanneer de OAuth-secrets nog niet zijn ingesteld.
const oauthSetupNeededPage = (redirectUri: string) => `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Google-koppeling nog niet geconfigureerd</title>
  <style>
    body { background:#0f172a; color:#f1f5f9; font-family: system-ui, -apple-system, sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:1rem; }
    .card { max-width:460px; width:100%; background:#1e293b; border:1px solid #334155; border-radius:1rem; padding:1.75rem; box-shadow:0 10px 40px rgba(0,0,0,.4); }
    h2 { font-size:1rem; margin:0 0 .5rem; color:#fbbf24; }
    p { font-size:.8rem; color:#94a3b8; line-height:1.55; }
    ol { font-size:.78rem; color:#cbd5e1; line-height:1.6; padding-left:1.1rem; }
    code { background:#0f172a; border:1px solid #334155; border-radius:.3rem; padding:.05rem .3rem; font-size:.72rem; word-break:break-all; }
    button { margin-top:1.25rem; width:100%; padding:.6rem; border:none; border-radius:.6rem; background:#334155; color:#e2e8f0; font-size:.8rem; font-weight:600; cursor:pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Google-koppeling nog niet geconfigureerd</h2>
    <p>De OAuth-secrets ontbreken nog op de server. Registreer eenmalig een Google OAuth-client en vul de secrets in bij Cloudflare. Zie <code>OAUTH_SETUP.md</code> voor de volledige stappen.</p>
    <ol>
      <li>Maak in Google Cloud Console een OAuth client (type: Web).</li>
      <li>Voeg deze redirect-URI exact toe:<br><code>${escapeHtml(redirectUri)}</code></li>
      <li>Zet in Cloudflare Pages de secrets <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code> en <code>SESSION_SECRET</code> (voor de inlogmuur).</li>
      <li>Zet <code>ALLOWED_EMAILS</code> (komma-gescheiden) met de toegestane accounts.</li>
      <li>Optioneel: zet <code>APP_BASE_URL</code> op je vaste domein.</li>
    </ol>
    <button onclick="window.close()">Venster sluiten</button>
  </div>
</body>
</html>`;

// Volledig-scherm pagina: ingelogd Google-account staat niet op de allowlist.
const accessDeniedPage = (email: string) => `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Geen toegang</title>
  <style>
    body { background:#0f172a; color:#f1f5f9; font-family: system-ui, -apple-system, sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:1rem; }
    .card { max-width:440px; width:100%; background:#1e293b; border:1px solid #334155; border-radius:1rem; padding:1.75rem; box-shadow:0 10px 40px rgba(0,0,0,.4); text-align:center; }
    h2 { font-size:1.05rem; margin:0 0 .5rem; color:#f87171; }
    p { font-size:.82rem; color:#94a3b8; line-height:1.55; }
    code { background:#0f172a; border:1px solid #334155; border-radius:.3rem; padding:.05rem .35rem; font-size:.78rem; }
    a { display:inline-block; margin-top:1.25rem; padding:.6rem 1rem; border-radius:.6rem; background:#334155; color:#e2e8f0; font-size:.8rem; font-weight:600; text-decoration:none; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Geen toegang</h2>
    <p>${email ? `Het account <code>${escapeHtml(email)}</code> staat niet op de toegangslijst van dit dashboard.` : "Dit account staat niet op de toegangslijst van dit dashboard."}</p>
    <p>Log in met een toegestaan account, of vraag de beheerder om je e-mailadres toe te voegen.</p>
    <a href="/auth/logout">Opnieuw proberen met een ander account</a>
  </div>
</body>
</html>`;

// Logout: sessie wissen en terug naar het loginscherm.
app.get("/auth/logout", (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.redirect("/");
});

// Stap 1: redirect de gebruiker naar de Google consent screen.
app.get("/auth/google", (c) => {
  const baseUrl = getBaseUrl(c);
  const redirectUri = `${baseUrl}/auth/google/callback`;

  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET || !c.env.SESSION_SECRET) {
    return c.html(oauthSetupNeededPage(redirectUri));
  }

  // ?flow=login = volledige inlog (full-page redirect terug naar het dashboard);
  // anders = popup-koppeling vanuit "Sleutels & Integraties".
  const isLogin = new URL(c.req.url).searchParams.get("flow") === "login";
  setCookie(c, OAUTH_FLOW_COOKIE, isLogin ? "login" : "popup", {
    httpOnly: true,
    secure: baseUrl.startsWith("https://"),
    sameSite: "Lax",
    path: "/",
    maxAge: 600,
  });

  // CSRF-bescherming: random state in een HttpOnly cookie, terug te vergelijken
  // in de callback.
  const state = crypto.randomUUID();
  setCookie(c, OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: baseUrl.startsWith("https://"),
    sameSite: "Lax",
    path: "/",
    maxAge: 600,
  });

  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPES,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });

  return c.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
});

// Stap 2: Google stuurt terug met ?code. Wissel code om voor tokens en sla op.
app.get("/auth/google/callback", async (c) => {
  const baseUrl = getBaseUrl(c);
  const redirectUri = `${baseUrl}/auth/google/callback`;
  const url = new URL(c.req.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = getCookie(c, OAUTH_STATE_COOKIE);
  const isLogin = getCookie(c, OAUTH_FLOW_COOKIE) === "login";

  // State- en flow-cookies zijn eenmalig - altijd opruimen.
  deleteCookie(c, OAUTH_STATE_COOKIE, { path: "/" });
  deleteCookie(c, OAUTH_FLOW_COOKIE, { path: "/" });

  if (error) {
    return c.html(oauthResultPage({ baseUrl, ok: false, title: "Koppeling geannuleerd", message: `Google gaf terug: ${error}` }));
  }
  if (!code || !state || !cookieState || state !== cookieState) {
    return c.html(oauthResultPage({ baseUrl, ok: false, title: "Koppeling mislukt", message: "Ongeldige of verlopen sessie (state-controle). Probeer opnieuw." }));
  }
  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET || !c.env.SESSION_SECRET) {
    return c.html(oauthSetupNeededPage(redirectUri));
  }

  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenRes.ok) {
      const detail = await tokenRes.text();
      console.error("Google token exchange failed:", detail);
      return c.html(oauthResultPage({ baseUrl, ok: false, title: "Koppeling mislukt", message: "Token-uitwisseling met Google is mislukt. Controleer client ID/secret en redirect-URI." }));
    }

    const token = await tokenRes.json<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    }>();

    // E-mail van het gekoppelde account ophalen (puur informatief in de UI).
    let email = "";
    try {
      const infoRes = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (infoRes.ok) {
        const info = await infoRes.json<{ email?: string }>();
        email = info.email || "";
      }
    } catch (e) {
      console.error("Userinfo fetch failed:", e);
    }

    // Inlogmuur: alleen accounts op de allowlist mogen naar binnen. Bij weigering
    // geen tokens opslaan en geen sessie zetten.
    if (!isAllowedEmail(c.env, email)) {
      if (isLogin) return c.html(accessDeniedPage(email));
      return c.html(
        oauthResultPage({
          baseUrl,
          ok: false,
          title: "Geen toegang",
          message: email
            ? `${email} staat niet op de toegangslijst van dit dashboard.`
            : "Dit account staat niet op de toegangslijst van dit dashboard.",
        })
      );
    }

    const expiry = Date.now() + (token.expires_in ?? 3600) * 1000;

    // Bestaande refresh token behouden als Google er deze keer geen meegeeft
    // (Google stuurt 'm alleen bij de eerste consent).
    const existing = await readGoogleTokens(c.env.DB);
    const refreshToken = token.refresh_token || existing.refreshToken;

    await c.env.DB.prepare(
      `UPDATE settings SET
         google_access_token = ?,
         google_refresh_token = ?,
         google_token_expiry = ?,
         google_email = ?,
         google_analytics_connected = 1,
         search_console_connected = 1
       WHERE id = 1`
    )
      .bind(token.access_token, refreshToken, expiry, email)
      .run();

    // Inlogmuur: zet de ondertekende sessie-cookie (30 dagen).
    await setSessionCookie(c, email, baseUrl);

    // Volledige login -> terug naar het dashboard. Popup-koppeling -> sluit zichzelf.
    if (isLogin) return c.redirect("/");

    return c.html(
      oauthResultPage({
        baseUrl,
        ok: true,
        title: "Google succesvol gekoppeld",
        message: email ? `Verbonden als ${email}. Je kunt dit venster sluiten.` : "De koppeling is gelukt. Je kunt dit venster sluiten.",
      })
    );
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return c.html(oauthResultPage({ baseUrl, ok: false, title: "Koppeling mislukt", message: "Er ging iets mis bij het verwerken van de Google-koppeling." }));
  }
});

// Koppeling verbreken: tokens wissen, status terug naar niet-verbonden.
app.post("/api/auth/google/disconnect", async (c) => {
  await c.env.DB.prepare(
    `UPDATE settings SET
       google_access_token = '',
       google_refresh_token = '',
       google_token_expiry = 0,
       google_email = '',
       google_analytics_connected = 0,
       search_console_connected = 0
     WHERE id = 1`
  ).run();
  return c.json({ success: true, credentials: await readSettings(c.env.DB) });
});

app.post("/api/gemini/optimize", async (c) => {
  const { title, content, targetKeywords } = await c.req.json<{
    title?: string;
    content?: string;
    targetKeywords?: string[];
  }>();

  if (!title || !content) {
    return c.json({ error: "Title and Content are required." }, 400);
  }

  const apiKey = c.env.GEMINI_API_KEY;

  if (!apiKey) {
    const derivedKeywords =
      targetKeywords && targetKeywords.length > 0
        ? targetKeywords
        : title.toLowerCase().split(" ").filter((w) => w.length > 4).slice(0, 4);
    const score = Math.min(100, Math.max(65, 75 + derivedKeywords.length * 5 + Math.floor(Math.random() * 8)));
    return c.json({
      title,
      optimizedContent: content,
      seoScore: score,
      seoKeywords: derivedKeywords,
      socialCaptions: {
        linkedin: `Interessant artikel: ${title}. Sleutelinzichten en praktische tips. #WebPublish #KennisDelen`,
        twitter: `Nieuw bericht: "${title}". #Technology #Webdev`,
        facebook: `Nieuwe blog: ${title}. Lees nu.`,
        instagram: `Nieuwe blog over "${title}". Link in bio.`,
      },
      suggestions: [
        "Voeg meer subkoppen (H2/H3) toe.",
        "Integreer interne en externe links.",
        "Sluit af met een duidelijke call-to-action.",
        `Zorg dat '${derivedKeywords[0] || "artikel"}' in de eerste alinea voorkomt.`,
      ],
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Je bent een professionele content publisher en SEO expert.
De klant wil dit artikel publiceren:
Titel: "${title}"
Inhoud:
"${content}"

Gewenste zoekwoorden: ${targetKeywords?.length ? targetKeywords.join(", ") : "geen opgegeven"}

Retourneer ALLEEN een JSON-object met deze structuur:
{
  "seoScore": <getal 40-100>,
  "seoKeywords": [<3-5 zoekwoorden>],
  "socialCaptions": {
    "linkedin": "<LinkedIn post>",
    "twitter": "<Twitter post max 240>",
    "facebook": "<Facebook post>",
    "instagram": "<Instagram caption>"
  },
  "suggestions": [<minimaal 3 aanbevelingen>]
}
Geen markdown, geen andere tekst.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const text = (response.text || "").trim().replace(/^```json/, "").replace(/```$/, "").trim();
    const result = JSON.parse(text);
    return c.json({ title, optimizedContent: content, ...result });
  } catch (err) {
    console.error("Gemini optimization error:", err);
    return c.json({ error: "Gemini kon de content niet optimaliseren. Probeer het later opnieuw." }, 500);
  }
});

// Algemene "Ask AI" chat-endpoint voor de dashboard-assistent.
app.post("/api/gemini/ask", async (c) => {
  const { question, context } = await c.req.json<{
    question?: string;
    context?: string;
  }>();

  if (!question || !question.trim()) {
    return c.json({ error: "Stel een vraag." }, 400);
  }

  const apiKey = c.env.GEMINI_API_KEY;

  if (!apiKey) {
    return c.json({
      answer:
        "De AI-assistent is nog niet geconfigureerd (geen GEMINI_API_KEY ingesteld). " +
        "Voeg een Gemini API-sleutel toe bij Integraties om live antwoorden te krijgen. " +
        "Tip: gebruik de Planner-tab om met AI SEO-titels en social previews te genereren.",
      fallback: true,
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Je bent de ingebouwde AI-assistent van het WebPublish publisher-dashboard.
Je helpt de gebruiker met content publiceren, SEO, social media planning en het interpreteren van analytics.
Antwoord beknopt en praktisch in het Nederlands (tenzij de gebruiker een andere taal gebruikt).
${context ? `\nContext over het dashboard:\n${context}\n` : ""}
Vraag van de gebruiker:
"${question}"`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return c.json({ answer: (response.text || "").trim() || "Ik kon geen antwoord genereren." });
  } catch (err) {
    console.error("Gemini ask error:", err);
    return c.json({ error: "De AI-assistent is tijdelijk niet beschikbaar. Probeer het later opnieuw." }, 500);
  }
});

app.get("/api/analytics", async (c) => {
  const range = c.req.query("range") || "30";
  const rangeNum = parseInt(range, 10) || 30;

  const credentials = await readSettings(c.env.DB);
  const socialsRes = await c.env.DB.prepare(`SELECT * FROM socials`).all<SocialRow>();
  const socials = (socialsRes.results ?? []).map(socialToApi);

  const baseViews = credentials.googleAnalyticsConnected ? 650 : 350;
  const baseOrganic = credentials.searchConsoleConnected ? 120 : 70;
  const now = new Date();
  const performance: Array<{ date: string; views: number; organicClicks: number; socialClicks: number; bounceRate: number }> = [];

  for (let i = rangeNum - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const dateStr = d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
    const dayOfWeek = d.getDay();
    const multiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 0.7 : 1.1;
    const trendFactor = 1 + (rangeNum - i) * 0.003;
    const views = Math.floor((baseViews + Math.sin(i / 2) * 60 + Math.random() * 80) * multiplier * trendFactor);
    const organicClicks = Math.floor((baseOrganic + Math.sin(i / 1.5) * 15 + Math.random() * 25) * multiplier * trendFactor);
    let socialClicks = 0;
    for (const s of socials) {
      if (s.connected) socialClicks += Math.floor(s.clicks / rangeNum + Math.random() * 4);
    }
    socialClicks = Math.floor(socialClicks + Math.random() * 5 + 2);
    const bounceRate = parseFloat((42 + Math.sin(i / 4) * 3 + Math.random() * 4).toFixed(1));
    performance.push({ date: dateStr, views, organicClicks, socialClicks, bounceRate });
  }

  return c.json({
    performance,
    totals: {
      views: performance.reduce((acc, p) => acc + p.views, 0),
      organicClicks: performance.reduce((acc, p) => acc + p.organicClicks, 0),
      socialClicks: performance.reduce((acc, p) => acc + p.socialClicks, 0),
      bounceRate: parseFloat((performance.reduce((acc, p) => acc + p.bounceRate, 0) / performance.length).toFixed(1)),
    },
  });
});

export const onRequest = handle(app);
