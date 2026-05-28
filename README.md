# Publisher Dashboard

Intern dashboard voor multi-site publishing (Vite + React 19 + Tailwind 4). Backend draait als Cloudflare Pages Functions met Hono en D1 (SQLite at edge). Gemini API server-side voor SEO/social-caption-suggesties.

## Stack

- **Frontend:** Vite, React 19, Tailwind 4, Recharts, Lucide, Motion
- **Backend:** Cloudflare Pages Functions + Hono
- **Database:** Cloudflare D1
- **AI:** Google Gemini via `@google/genai`
- **Auth (productie):** Cloudflare Access (Zero Trust) — geen app-side auth

## Lokale ontwikkeling

```bash
npm install
cp .dev.vars.example .dev.vars   # vul GEMINI_API_KEY in (optioneel)
npm run db:create                 # eenmalig: maakt D1 db; kopieer database_id naar wrangler.toml
npm run db:migrate:local          # past migrations toe op lokale D1
npm run build                     # bouwt dist/
npx wrangler pages dev            # frontend + Functions lokaal op http://localhost:8788
```

Voor pure frontend dev zonder Functions: `npm run dev` (Vite op :5173, geen API).

## Deploy naar Cloudflare

### Eenmalige setup — lokaal

1. `npm install`
2. `npx wrangler login` (CF-account koppelen)
3. `npm run db:create` — kopieer `database_id` uit output naar `wrangler.toml`
4. `npm run db:migrate:remote` — past schema + seed toe op productie D1

### Eenmalige setup — CF Dashboard (Git-integratie)

Primaire deploy gaat via CF's GitHub-koppeling. CF pikt elke push automatisch op.

1. CF Dashboard → **Workers & Pages** → Create application → Pages → **Connect to Git**
2. Autoriseer de Cloudflare GitHub App → selecteer `matthys-inc/publisher-dashboard`
3. Production branch: `main`
4. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `/`
5. Environment variables (Production + Preview):
   - `NODE_VERSION` = `20`
6. Klik **Save and Deploy**
7. Na eerste deploy → Settings → **Functions** → Bindings:
   - D1 database: variable name `DB` → database `publisher-dashboard-db`
8. Settings → Environment variables → **Encrypt** `GEMINI_API_KEY` (production + preview)

Vanaf nu: push naar feature-branch = preview-URL, merge naar `main` = productie. Geen GitHub Actions secrets nodig.

### D1 migrations

CF's Git-integratie raakt de DB niet aan. Bij elke schema-wijziging:

```bash
npm run db:migrate:remote
```

### Backup deploy (handmatig)

Twee opties als CF's Git-integratie faalt:

1. **Lokaal:** `npm run deploy`
2. **GitHub Actions:** repo → Actions → "Deploy to Cloudflare Pages (backup)" → Run workflow. Vereist secrets `CLOUDFLARE_API_TOKEN` (met `Pages: Edit` + `D1: Edit`) en `CLOUDFLARE_ACCOUNT_ID`.

### Toegang beperken (Cloudflare Access)

Na de eerste deploy:

1. CF Dashboard → Zero Trust → Access → Applications → Add → Self-hosted
2. Application domain: `publisher-dashboard.pages.dev` (of het Pages-domein)
3. Identity provider: Google (één klik)
4. Policy: emails-allowlist met jouw mailadres(sen)

Dashboard is daarna alleen bereikbaar na Google-login bij Cloudflare.

## Bestandsstructuur

```
publisher-dashboard/
  functions/
    [[path]].ts          # Hono app: /api/* + /auth/sso
  migrations/
    0001_init.sql        # schema
    0002_seed.sql        # demo-data (verwijder voor clean start)
  public/
    _routes.json         # Functions alleen op /api/* en /auth/sso
  src/                   # Vite + React frontend
  wrangler.toml
  .dev.vars.example      # secrets voor lokaal
```

## Wat hier nog niet zit (roadmap)

- Echte GA4 / Search Console koppeling (nu mock-data via `/api/analytics`)
- Echte OAuth voor social platforms (nu checkbox-stub)
- Publish-flow naar Webflow / Astro repo's (nu alleen status-update + URL-generatie)
- Rate-limiting op `/api/gemini/optimize`
