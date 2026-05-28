import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import { GoogleGenAI } from "@google/genai";

type Env = {
  DB: D1Database;
  GEMINI_API_KEY?: string;
};

type Variables = {};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

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
              linkedin_connected, twitter_connected, wordpress_connected
       FROM settings WHERE id = 1`
    )
    .first<Record<string, number | string>>();
  return {
    googleAnalyticsConnected: !!row?.google_analytics_connected,
    googleAnalyticsPropertyId: (row?.google_analytics_property_id as string) || "",
    searchConsoleConnected: !!row?.search_console_connected,
    searchConsoleSiteUrl: (row?.search_console_site_url as string) || "",
    linkedinConnected: !!row?.linkedin_connected,
    twitterConnected: !!row?.twitter_connected,
    wordpressConnected: !!row?.wordpress_connected,
  };
};

const computeReadTime = (content: string) =>
  Math.max(1, Math.ceil(content.split(/\s+/).filter(Boolean).length / 200));

// ---------- routes ----------

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

app.post("/api/credentials", async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  const current = await readSettings(c.env.DB);
  const merged = { ...current, ...body };

  const gaPropId = String(merged.googleAnalyticsPropertyId ?? "");
  const gscUrl = String(merged.searchConsoleSiteUrl ?? "");

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
      gaPropId ? 1 : 0,
      gaPropId,
      gscUrl ? 1 : 0,
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

app.post("/api/auth/sso-complete", async (c) => {
  const body = await c.req.json<{ gaPropertyId?: string; gscSiteUrl?: string; selectedSocials?: string[] }>();
  const gaPropId = body.gaPropertyId || "GA4-94827150";
  const gscUrl = body.gscSiteUrl || "https://techinzichten.nl";
  const selected = body.selectedSocials ?? [];

  await c.env.DB.prepare(
    `UPDATE settings SET
       google_analytics_property_id = ?,
       google_analytics_connected = 1,
       search_console_site_url = ?,
       search_console_connected = 1
     WHERE id = 1`
  )
    .bind(gaPropId, gscUrl)
    .run();

  const allSocials = await c.env.DB.prepare(`SELECT * FROM socials`).all<SocialRow>();
  for (const s of allSocials.results ?? []) {
    const isSelected = selected.includes(s.id);
    const newHandle = isSelected && s.handle === "Niet Gekoppeld" ? `@${s.id}_sso` : s.handle;
    await c.env.DB.prepare(`UPDATE socials SET connected = ?, handle = ? WHERE id = ?`)
      .bind(isSelected ? 1 : 0, newHandle, s.id)
      .run();
  }

  const [credentials, socials] = await Promise.all([
    readSettings(c.env.DB),
    c.env.DB.prepare(`SELECT * FROM socials ORDER BY id ASC`).all<SocialRow>(),
  ]);

  return c.json({
    success: true,
    credentials,
    socials: (socials.results ?? []).map(socialToApi),
  });
});

app.get("/auth/sso", (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <title>Single Sign-On (SSO)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body { background-color: #0f172a; color: #f1f5f9; font-family: system-ui, -apple-system, sans-serif; }</style>
</head>
<body class="flex items-center justify-center min-h-screen p-4">
  <div class="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
    <div class="text-center space-y-2">
      <h2 class="text-lg font-bold">Machtigingsportaal (SSO)</h2>
      <p class="text-xs text-slate-400">Verleen toegang tot GA4, Search Console en sociale media.</p>
    </div>
    <div class="space-y-3">
      <input id="property-id" value="GA4-94827150" class="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono" placeholder="GA4 Property ID" />
      <input id="site-url" value="https://techinzichten.nl" class="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono" placeholder="Search Console site URL" />
      <div class="grid grid-cols-2 gap-2 text-xs">
        <label class="flex items-center gap-2"><input type="checkbox" class="social-chk" value="linkedin" checked /> LinkedIn</label>
        <label class="flex items-center gap-2"><input type="checkbox" class="social-chk" value="twitter" checked /> Twitter / X</label>
        <label class="flex items-center gap-2"><input type="checkbox" class="social-chk" value="facebook" /> Facebook</label>
        <label class="flex items-center gap-2"><input type="checkbox" class="social-chk" value="instagram" /> Instagram</label>
      </div>
    </div>
    <div class="flex justify-end gap-3 pt-4 border-t border-slate-800">
      <button onclick="window.close()" class="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white">Annuleer</button>
      <button id="authorize-btn" onclick="confirmSSO()" class="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-xs font-bold">Machtiging Verlenen</button>
    </div>
  </div>
  <script>
    async function confirmSSO() {
      const btn = document.getElementById('authorize-btn');
      btn.disabled = true;
      btn.innerText = 'Verifiëren...';
      const gaPropertyId = document.getElementById('property-id').value;
      const gscSiteUrl = document.getElementById('site-url').value;
      const selectedSocials = Array.from(document.querySelectorAll('.social-chk:checked')).map(el => el.value);
      try {
        const res = await fetch('/api/auth/sso-complete', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ gaPropertyId, gscSiteUrl, selectedSocials })
        });
        const data = await res.json();
        if (data.success) {
          if (window.opener) window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
          window.close();
        } else {
          alert('Koppeling SSO mislukt.');
          btn.disabled = false; btn.innerText = 'Machtiging Verlenen';
        }
      } catch (e) {
        alert('Fout bij SSO verwerking.');
        btn.disabled = false; btn.innerText = 'Machtiging Verlenen';
      }
    }
  </script>
</body>
</html>`);
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
