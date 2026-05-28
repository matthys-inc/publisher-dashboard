import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;
const DATA_FILE = path.join(process.cwd(), "data_store.json");

// Define basic initial data if file doesn't exist
interface DataStore {
  websites: Array<{ id: string; name: string; url: string; cms: string; connected: boolean }>;
  socials: Array<{ id: string; name: string; handle: string; connected: boolean; followers: number; engagementRate: number; clicks: number; impressions: number }>;
  posts: any[];
  credentials: {
    googleAnalyticsConnected: boolean;
    googleAnalyticsPropertyId: string;
    searchConsoleConnected: boolean;
    searchConsoleSiteUrl: string;
    linkedinConnected: boolean;
    twitterConnected: boolean;
    wordpressConnected: boolean;
  };
}

const defaultData: DataStore = {
  websites: [
    { id: "web_1", name: "TechInzichten Blog", url: "https://techinzichten.nl", cms: "wordpress", connected: true },
    { id: "web_2", name: "Duurzaam Leven", url: "https://duurzaamleven.org", cms: "custom", connected: true }
  ],
  socials: [
    { id: "linkedin", name: "LinkedIn", handle: "@techinzichten", connected: true, followers: 1450, engagementRate: 4.8, clicks: 320, impressions: 8400 },
    { id: "twitter", name: "Twitter / X", handle: "@TechInzichtenNL", connected: true, followers: 820, engagementRate: 3.2, clicks: 190, impressions: 5300 },
    { id: "facebook", name: "Facebook", handle: "techinzichten.nl", connected: false, followers: 310, engagementRate: 1.5, clicks: 45, impressions: 1200 },
    { id: "instagram", name: "Instagram", handle: "@techinzichten_ig", connected: false, followers: 490, engagementRate: 2.1, clicks: 65, impressions: 1800 }
  ],
  credentials: {
    googleAnalyticsConnected: false,
    googleAnalyticsPropertyId: "",
    searchConsoleConnected: false,
    searchConsoleSiteUrl: "",
    linkedinConnected: true,
    twitterConnected: true,
    wordpressConnected: true
  },
  posts: [
    {
      id: "post_1",
      title: "De Opkomst van AI in Web Development in 2026",
      content: "Kunstmatige intelligentie transformeert de manier waarop we webervaringen bouwen. Van geavanceerde ontwerpen tot automatische codegeneratie met agents, AI-gedreven componenten worden steeds sneller de standaard. In dit artikel kijken we naar frameworks die AI direct integreren.",
      seoKeywords: ["web development", "kunstmatige intelligentie", "AI agents", "2026 tech"],
      scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      targetWebsites: ["web_1"],
      sendToSocials: true,
      socialPlatforms: ["linkedin", "twitter"],
      socialCaption: "Hoe zal AI de webontwikkeling in 2026 hervormen? 🌐 Lees in onze nieuwste blog over AI agents en de nieuwste ontwikkelingen! #AI #WebDev #Technology",
      status: "scheduled",
      readTime: 4,
      publishedUrl: "",
      seoScore: 84
    },
    {
      id: "post_2",
      title: "5 Stappen naar een Duurzamer Huishouden",
      content: "Kleine aanpassingen in je dagelijkse routine kunnen een enorme impact hebben op het milieu en je energierekening. In deze gids bespreken we waterbesparing, slim stroomverbruik en de vermindering van plasticgebruik in de keuken.",
      seoKeywords: ["duurzaam leven", "milieu", "energie besparen", "groen huishouden"],
      scheduledAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      targetWebsites: ["web_2"],
      sendToSocials: true,
      socialPlatforms: ["linkedin"],
      socialCaption: "Een groener leven begint thuis! 🌱 Ontdek 5 eenvoudige stappen waarmee je direct energie kunt besparen en je ecologische voetafdruk verkleint. #Duurzaam #Eco #GroenLeven",
      status: "published",
      readTime: 3,
      publishedUrl: "https://duurzaamleven.org/blog/5-stappen-duurzamer-huishouden",
      seoScore: 92
    }
  ]
};

function readData(): DataStore {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const text = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(text);
    }
  } catch (e) {
    console.error("Error reading data store, returning default", e);
  }
  // Write default data
  writeData(defaultData);
  return defaultData;
}

function writeData(data: DataStore) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing data store", e);
  }
}

// Setup Gemini Client if Key exists
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  aiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// API Routes

// Retrieve layout data and settings
app.get("/api/data", (req, res) => {
  const data = readData();
  res.json(data);
});

// Update websites
app.post("/api/websites", (req, res) => {
  const data = readData();
  const newWebsite = req.body;
  newWebsite.id = "web_" + Date.now();
  data.websites.push(newWebsite);
  writeData(data);
  res.json(newWebsite);
});

// Update credentials
app.post("/api/credentials", (req, res) => {
  const data = readData();
  data.credentials = { ...data.credentials, ...req.body };
  // Sync connected platforms based on credential fields
  data.credentials.googleAnalyticsConnected = !!data.credentials.googleAnalyticsPropertyId;
  data.credentials.searchConsoleConnected = !!data.credentials.searchConsoleSiteUrl;
  writeData(data);
  res.json({ success: true, credentials: data.credentials });
});

// Manage Posts
app.get("/api/posts", (req, res) => {
  const data = readData();
  res.json(data.posts);
});

app.post("/api/posts", (req, res) => {
  const data = readData();
  const post = req.body;
  post.id = "post_" + Date.now();
  if (!post.seoKeywords) post.seoKeywords = [];
  if (!post.status) post.status = "scheduled";
  if (!post.seoScore) post.seoScore = Math.floor(Math.random() * 30) + 60;
  post.readTime = Math.max(1, Math.ceil(post.content.split(/\s+/).length / 200));
  data.posts.unshift(post);
  writeData(data);
  res.json(post);
});

app.put("/api/posts/:id", (req, res) => {
  const data = readData();
  const id = req.params.id;
  const index = data.posts.findIndex((p: any) => p.id === id);
  if (index !== -1) {
    const updatedPost = { ...data.posts[index], ...req.body };
    updatedPost.readTime = Math.max(1, Math.ceil(updatedPost.content.split(/\s+/).length / 200));
    data.posts[index] = updatedPost;
    writeData(data);
    res.json(updatedPost);
  } else {
    res.status(404).json({ error: "Post not found" });
  }
});

app.delete("/api/posts/:id", (req, res) => {
  const data = readData();
  const id = req.params.id;
  data.posts = data.posts.filter((p: any) => p.id !== id);
  writeData(data);
  res.json({ success: true });
});

app.post("/api/posts/:id/publish", (req, res) => {
  const data = readData();
  const id = req.params.id;
  const index = data.posts.findIndex((p: any) => p.id === id);
  if (index !== -1) {
    const post = data.posts[index];
    post.status = "published";
    // Find target website URL if any
    const website = data.websites.find(w => post.targetWebsites.includes(w.id));
    const domain = website ? website.url : "https://mijnwebsite.nl";
    const slug = post.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    post.publishedUrl = `${domain}/blog/${slug}`;
    
    // Simulate social reach increment
    if (post.sendToSocials && post.socialPlatforms.length > 0) {
      post.socialPlatforms.forEach((pId: string) => {
        const social = data.socials.find(s => s.id === pId);
        if (social && social.connected) {
          social.clicks += Math.floor(Math.random() * 40) + 10;
          social.impressions += Math.floor(Math.random() * 300) + 100;
        }
      });
    }

    data.posts[index] = post;
    writeData(data);
    res.json({ success: true, post });
  } else {
    res.status(404).json({ error: "Post not found" });
  }
});

// Single Sign-On (SSO) Support for GA4, GSC, and Socials
app.post("/api/auth/sso-complete", (req, res) => {
  const { gaPropertyId, gscSiteUrl, selectedSocials } = req.body;
  const data = readData();
  
  // Update Google credentials
  data.credentials.googleAnalyticsPropertyId = gaPropertyId || "GA4-94827150";
  data.credentials.googleAnalyticsConnected = true;
  data.credentials.searchConsoleSiteUrl = gscSiteUrl || "https://techinzichten.nl";
  data.credentials.searchConsoleConnected = true;
  
  // Update connected status for selected socials
  data.socials = data.socials.map((social) => {
    const isSelected = selectedSocials.includes(social.id);
    return {
      ...social,
      connected: isSelected,
      handle: isSelected && social.handle === "Niet Gekoppeld" ? `@${social.id}_sso` : social.handle
    };
  });
  
  writeData(data);
  res.json({ success: true, credentials: data.credentials, socials: data.socials });
});

app.get("/auth/sso", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="nl">
    <head>
      <meta charset="UTF-8">
      <title>Google & Socials Single Sign-On (SSO)</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        body { background-color: #0f172a; color: #f1f5f9; font-family: system-ui, -apple-system, sans-serif; }
      </style>
    </head>
    <body class="flex items-center justify-center min-h-screen p-4">
      <div class="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
        <div class="text-center space-y-2">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <h2 class="text-lg font-bold">Machtigingsportaal (SSO)</h2>
          <p class="text-xs text-slate-400">Verleen met één klik toegang tot Google Analytics 4, Search Console en sociale media accounts.</p>
        </div>

        <div class="space-y-4">
          <div class="bg-slate-950/40 p-3 rounded-lg border border-slate-800 text-xs flex justify-between">
            <span class="text-slate-400">Geverifieerd Account:</span>
            <span class="font-bold text-emerald-400">info@nordwaartszweden.nl</span>
          </div>

          <div class="space-y-3">
            <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">Selecteer te koppelen datastromen:</label>
            
            <!-- Google Block -->
            <div class="p-3 bg-slate-950/20 rounded-lg border border-slate-800 space-y-2">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                <span class="text-xs font-bold">Google Workspace & Search accounts</span>
              </div>
              
              <div class="space-y-2 pl-4 pt-1">
                <label class="flex items-center gap-2.5 text-xs text-slate-300">
                  <input type="checkbox" id="chk-ga4" checked disabled class="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-emerald-500 w-4 h-4" />
                  <span>Google Analytics 4 (GA4)</span>
                </label>
                <div class="pl-6">
                  <input type="text" id="property-id" value="GA4-94827150" class="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-slate-700" placeholder="Property ID" />
                </div>

                <label class="flex items-center gap-2.5 text-xs text-slate-300 pt-1">
                  <input type="checkbox" id="chk-gsc" checked disabled class="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-emerald-500 w-4 h-4" />
                  <span>Google Search Console (GSC)</span>
                </label>
                <div class="pl-6">
                  <input type="text" id="site-url" value="https://techinzichten.nl" class="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-slate-700" placeholder="Domain URL" />
                </div>
              </div>
            </div>

            <!-- Socials Block -->
            <div class="p-3 bg-slate-950/20 rounded-lg border border-slate-800 space-y-2.5">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-pink-500"></span>
                <span class="text-xs font-bold">Social Media Accounts (OAuth 2.0)</span>
              </div>
              
              <div class="grid grid-cols-2 gap-2 pl-4">
                <label class="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" id="chk-linkedin" checked class="social-chk rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-emerald-500 w-4 h-4" value="linkedin" />
                  <span>LinkedIn</span>
                </label>
                <label class="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" id="chk-twitter" checked class="social-chk rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-emerald-500 w-4 h-4" value="twitter" />
                  <span>Twitter / X</span>
                </label>
                <label class="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" id="chk-facebook" checked class="social-chk rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-emerald-500 w-4 h-4" value="facebook" />
                  <span>Facebook</span>
                </label>
                <label class="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" id="chk-instagram" checked class="social-chk rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-emerald-500 w-4 h-4" value="instagram" />
                  <span>Instagram</span>
                </label>
              </div>
            </div>

          </div>
        </div>

        <div class="pt-4 border-t border-slate-800 flex justify-end gap-3">
          <button id="cancel-btn" onclick="window.close()" class="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all">
            Annuleer
          </button>
          <button id="authorize-btn" onclick="confirmSSO()" class="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-[11px] font-bold text-slate-955 shadow-lg shadow-emerald-500/10 flex items-center gap-1">
            Machtiging Verlenen
          </button>
        </div>
      </div>

      <script>
        async function confirmSSO() {
          const authBtn = document.getElementById('authorize-btn');
          authBtn.disabled = true;
          authBtn.innerText = 'Verifiëren...';
          
          const gaPropertyId = document.getElementById('property-id').value;
          const gscSiteUrl = document.getElementById('site-url').value;
          
          const selectedSocials = [];
          document.querySelectorAll('.social-chk:checked').forEach(el => {
            selectedSocials.push(el.value);
          });
          
          try {
            const response = await fetch('/api/auth/sso-complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ gaPropertyId, gscSiteUrl, selectedSocials })
            });
            const data = await response.json();
            
            if (data.success) {
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              }
              window.close();
            } else {
              alert('Koppeling SSO mislukt.');
              authBtn.disabled = false;
              authBtn.innerText = 'Machtiging Verlenen';
            }
          } catch (e) {
            console.error(e);
            alert('Fout bij SSO verwerking.');
            authBtn.disabled = false;
            authBtn.innerText = 'Machtiging Verlenen';
          }
        }
      </script>
    </body>
    </html>
  `);
});

// Gemini Content Optimizer
app.post("/api/gemini/optimize", async (req, res) => {
  const { title, content, targetKeywords } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: "Title and Content are required." });
  }

  // Fallback if API key missing
  if (!process.env.GEMINI_API_KEY || !aiClient) {
    // Generate simulated high-quality SEO suggestions and write social texts elegantly in Dutch
    const derivedKeywords = targetKeywords && targetKeywords.length > 0
      ? targetKeywords
      : title.toLowerCase().split(" ").filter((w: string) => w.length > 4).slice(0, 4);

    const score = Math.min(100, Math.max(65, 75 + (derivedKeywords.length * 5) + Math.floor(Math.random() * 8)));

    const summary = content.substring(0, 100) + "...";
    const linkedinCaption = `📢 Interessant artikel: ${title}!\n\nWe delen de sleutelinzichten en bespreken praktische tips. Perfect voor iedereen die hiermee aan de slag wil gaan.\n\nLees de volledige post hier 👇\n#WebPublish #KennisDelen #Innovatie`;
    const twitterCaption = `Nieuw bericht gepland: "${title}" 🚀 Ontdek wat dit betekent voor jouw website en socials. Mis het niet! 👇 #Technology #Webdev`;

    return res.json({
      title,
      optimizedContent: content,
      seoScore: score,
      seoKeywords: derivedKeywords,
      socialCaptions: {
        linkedin: linkedinCaption,
        twitter: twitterCaption,
        facebook: `Nieuwe blogalert! 🌟 Lees nu onze nieuwste post over: en laat weten wat je ervan vindt! 💬`,
        instagram: `Nieuwe blog geüpload! 📈 Bekijk de link in onze bio voor de volledige details over "${title}"! #blogger #nieuweupdate`
      },
      suggestions: [
        "Voeg meer subkoppen (H2/H3) toe om de leesbaarheid te verbeteren.",
        "Integreer meer interne en externe links om zoekmachines te helpen.",
        "De inleiding is sterk, maar overweeg een duidelijke 'Call to Action' aan het einde van het artikel.",
        `Zorg dat de zoekterm '${derivedKeywords[0] || "artikel"}' ook in de eerste alinea voorkomt.`
      ]
    });
  }

  try {
    const prompt = `Je bent een professionele content publisher en SEO expert.
De klant wil dit artikel publiceren:
Titel: "${title}"
Inhoud:
"${content}"

Gewenste zoekwoorden (optioneel): ${targetKeywords ? targetKeywords.join(", ") : "geen opgegeven"}

Analyseer het artikel en retourneer een gecureerde JSON-respons die helpt bij het publiceren en kruisbestuiven op sociale media. Schrijf alles in natuurlijk, professioneel Nederlands.

Je MOET exact een JSON-object retourneren met de volgende structuur:
{
  "seoScore": <getal tussen 40 en 100 dat de SEO prestatie weergeeft>,
  "seoKeywords": [<array van 3 tot 5 meest relevante zoekwoorden die in de tekst moeten worden geoptimaliseerd>],
  "socialCaptions": {
    "linkedin": "<een professionele, pakkende LinkedIn post om de blog te splitsen en lezers te lokken, inclusief relevante hash-tags>",
    "twitter": "<een beknopte en overtuigende Twitter/X tweet van max 240 tekens met activeerwoorden en hashtags>",
    "facebook": "<een vriendelijke en deelbare Facebook post>",
    "instagram": "<een opvallende Instagram caption met sfeer en hashtags>"
  },
  "suggestions": [
    "<ten minste 3 specifieke constructieve aanbevelingen om het artikel aantrekkelijker te maken voor zoekmachines en bezoekers>"
  ]
}

Retourneer ALLEEN de pure JSON. Geen markdown formatting, geen andere tekst.`;

    const response = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const resultText = response.text || "";
    const cleanJson = resultText.trim().replace(/^```json/, "").replace(/```$/, "").trim();
    const resultObj = JSON.parse(cleanJson);

    return res.json({
      title,
      optimizedContent: content,
      ...resultObj
    });
  } catch (error: any) {
    console.error("Gemini optimization error:", error);
    res.status(500).json({ error: "Gemini kon de content niet optimaliseren. Probeer het later opnieuw." });
  }
});

// Aggregate Analytics over timelines
app.get("/api/analytics", (req, res) => {
  const range = req.query.range || "30"; // "7", "30", "90"
  const rangeNum = parseInt(range as string) || 30;
  
  // Generate highly robust organic search and analytics trend data
  const data = readData();
  const performance: any[] = [];
  
  // Base numbers
  let baseViews = data.credentials.googleAnalyticsConnected ? 650 : 350;
  let baseOrganic = data.credentials.searchConsoleConnected ? 120 : 70;
  
  const now = new Date();
  
  for (let i = rangeNum - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const dateStr = d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
    
    // Day of week modifier to make it look realistic (weekend dip)
    const dayOfWeek = d.getDay();
    const multiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.7 : 1.1;
    
    // Add random fluctuations
    const trendFactor = 1 + (rangeNum - i) * 0.003; // slight upward trend
    const views = Math.floor((baseViews + Math.sin(i / 2) * 60 + Math.random() * 80) * multiplier * trendFactor);
    const organicClicks = Math.floor((baseOrganic + Math.sin(i / 1.5) * 15 + Math.random() * 25) * multiplier * trendFactor);
    
    let socialClicks = 0;
    data.socials.forEach(s => {
      if (s.connected) {
        socialClicks += Math.floor(s.clicks / rangeNum + Math.random() * 4);
      }
    });
    // Add residual channel clicks
    socialClicks = Math.floor(socialClicks + Math.random() * 5 + 2);

    const bounceRate = parseFloat((42 + Math.sin(i / 4) * 3 + Math.random() * 4).toFixed(1));

    performance.push({
      date: dateStr,
      views,
      organicClicks,
      socialClicks,
      bounceRate
    });
  }

  res.json({
    performance,
    totals: {
      views: performance.reduce((acc, p) => acc + p.views, 0),
      organicClicks: performance.reduce((acc, p) => acc + p.organicClicks, 0),
      socialClicks: performance.reduce((acc, p) => acc + p.socialClicks, 0),
      bounceRate: parseFloat((performance.reduce((acc, p) => acc + p.bounceRate, 0) / performance.length).toFixed(1))
    }
  });
});

// Boot infrastructure
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://localhost:${PORT}`);
  });
}

startServer();
