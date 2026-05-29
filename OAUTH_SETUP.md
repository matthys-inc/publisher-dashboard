# Google OAuth koppelen (GA4 + Search Console)

Deze handleiding zet de **echte** Google Single Sign-On aan voor het dashboard.
Zolang de secrets hieronder niet zijn ingesteld, toont de SSO-popup netjes een
"configuratie vereist"-scherm in plaats van te crashen.

> Social media (LinkedIn / X / Facebook / Instagram) loopt straks via een aparte
> **Buffer**-koppeling en valt buiten deze handleiding.

---

## 0. Bepaal je vaste domein

OAuth-redirects moeten naar een **vast** domein wijzen. Gebruik **niet** het
per-deploy hash-adres (bv. `https://13a24df5.publisher-dashboard.pages.dev`),
want dat verandert bij elke deploy.

- Productie (stabiel): `https://publisher-dashboard.pages.dev`
- Eventueel later: je eigen custom domein.

De callback-URL die je nodig hebt is dus:

```
https://publisher-dashboard.pages.dev/auth/google/callback
```

Gebruik je een custom domein, vervang dan het domein-gedeelte en zet
`APP_BASE_URL` op datzelfde domein (zie stap 3).

---

## 1. Google Cloud project + OAuth consent screen

1. Ga naar <https://console.cloud.google.com/> en maak (of kies) een project.
2. **APIs & Services → Enabled APIs & Services → + Enable APIs**. Schakel in:
   - **Google Analytics Data API** (GA4)
   - **Google Search Console API**
3. **APIs & Services → OAuth consent screen**:
   - User type: **External** (of Internal als je Google Workspace hebt).
   - Vul app-naam, support-e-mail en developer-e-mail in.
   - **Scopes** toevoegen:
     - `.../auth/analytics.readonly`
     - `.../auth/webmasters.readonly`
     - `openid`, `email`
   - Voeg jezelf (en eventuele collega's) toe als **Test users** zolang de app
     in "Testing" staat. (In Testing-modus krijgen alleen test-users toegang en
     verlopen refresh tokens na 7 dagen — voor productie zet je de app op
     "In production".)

---

## 2. OAuth client aanmaken

1. **APIs & Services → Credentials → + Create credentials → OAuth client ID**.
2. Application type: **Web application**.
3. **Authorized redirect URIs** → voeg exact toe:
   ```
   https://publisher-dashboard.pages.dev/auth/google/callback
   ```
   (en eventueel `http://localhost:8788/auth/google/callback` voor lokaal testen)
4. Maak aan en noteer de **Client ID** en **Client secret**.

> De redirect-URI moet **exact** matchen (inclusief https en zonder trailing
> slash), anders weigert Google met `redirect_uri_mismatch`.

---

## 3. Secrets instellen in Cloudflare

In het Cloudflare dashboard: **Workers & Pages → publisher-dashboard →
Settings → Environment variables** (voor zowel Production als Preview):

| Naam                   | Waarde                                                       |
| ---------------------- | ------------------------------------------------------------ |
| `GOOGLE_CLIENT_ID`     | je client ID                                                 |
| `GOOGLE_CLIENT_SECRET` | je client secret (markeer als **Secret/encrypt**)            |
| `APP_BASE_URL`         | `https://publisher-dashboard.pages.dev`                      |
| `SESSION_SECRET`       | lange willekeurige string (markeer als **Secret/encrypt**)   |
| `ALLOWED_EMAILS`       | komma-gescheiden toegestane accounts (zie §9 Inlogmuur)      |

Of via de CLI:

```bash
wrangler pages secret put GOOGLE_CLIENT_ID
wrangler pages secret put GOOGLE_CLIENT_SECRET
wrangler pages secret put SESSION_SECRET
# APP_BASE_URL en ALLOWED_EMAILS mogen gewone (niet-secret) variabelen zijn.
# ALLOWED_EMAILS staat ook als baseline in wrangler.toml.
```

Na het wijzigen van variabelen: een nieuwe deploy (of "Retry deployment")
zodat de Functions de waarden oppikken.

---

## 4. Database-migratie

De tokenkolommen zitten in migratie `0003_google_oauth.sql`. Toepassen:

```bash
# lokaal
npm run db:migrate:local
# productie (remote D1)
npm run db:migrate:remote
```

(De backup GitHub Action `deploy.yml` past remote migraties ook automatisch toe.)

---

## 5. Lokaal testen

```bash
# 1. Vul .dev.vars in (kopie van .dev.vars.example) met je client ID/secret
#    en APP_BASE_URL=http://localhost:8788
# 2. Build + Pages dev:
npm run build
npm run preview   # = wrangler pages dev  (draait op http://localhost:8788)
```

Open de app → **Sleutels & Integraties** → **Koppel met Google**.

---

## 6. Hoe de flow werkt (kort)

1. Frontend opent een popup naar `/auth/google`.
2. `/auth/google` zet een CSRF-`state` cookie en redirect naar Google.
3. Google stuurt terug naar `/auth/google/callback?code=...&state=...`.
4. De callback controleert de state, wisselt de code om voor tokens en slaat
   `access_token` + `refresh_token` server-side op in D1.
5. De popup seint het hoofdvenster (`postMessage`, same-origin) en sluit.
6. De UI ververst de status → **CONNECTED**.

Tokens staan uitsluitend server-side; ze komen nooit in de browser-bundle.

---

## 7. Veelvoorkomende fouten

- **`redirect_uri_mismatch`** → de redirect-URI in Google ≠ `APP_BASE_URL` +
  `/auth/google/callback`. Maak ze exact gelijk.
- **Popup toont "configuratie vereist"** → `GOOGLE_CLIENT_ID`/`SECRET` ontbreken
  of de deploy is van vóór het instellen ervan.
- **Geen refresh token** → gebeurt als je al eerder consent gaf. De flow gebruikt
  `prompt=consent`, dus dit zou steeds een refresh token moeten opleveren; lukt
  het niet, trek dan de toegang in via <https://myaccount.google.com/permissions>
  en koppel opnieuw.

---

## 8. Inlogmuur (Google SSO + allowlist)

Het hele dashboard zit achter een login. De inlog hergebruikt **dezelfde** Google
OAuth-flow en callback als de GA4/Search Console-koppeling (samengevoegd), dus in
Google Cloud hoef je niets extra's te configureren.

**Hoe het werkt:**

1. Open je het dashboard zonder geldige sessie, dan zie je een loginscherm met
   **"Inloggen met Google"**.
2. Google vraagt in één keer toestemming voor je identiteit (e-mail) én GA4/Search
   Console.
3. Staat je e-mail op de allowlist (`ALLOWED_EMAILS`) → je krijgt een ondertekende
   sessie-cookie van **30 dagen** en bent meteen met analytics gekoppeld.
4. Staat je e-mail er niet op → "Geen toegang", geen sessie.
5. Rechtsboven in de header zit een **Uitloggen**-knop.

**Server-side bescherming:** alle `/api/*`-endpoints weigeren met `401` zonder
geldige sessie. De statische app-shell bevat geen data of secrets; alle gegevens
komen uitsluitend via die beveiligde endpoints.

**Benodigde variabelen** (zie §3):

| Naam             | Voorbeeld                                              | Opmerking                                  |
| ---------------- | ------------------------------------------------------ | ------------------------------------------ |
| `SESSION_SECRET` | lange willekeurige hex-string                          | **Secret.** Genereer met onderstaand commando. |
| `ALLOWED_EMAILS` | `sm.vanderv33n@gmail.com, info@nordwaartszweden.nl`    | Komma-gescheiden. Baseline in `wrangler.toml`; te overschrijven in het dashboard. |

`SESSION_SECRET` genereren:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> Adressen toevoegen/verwijderen kan in het Cloudflare-dashboard (`ALLOWED_EMAILS`)
> zonder code-aanpassing; één nieuwe deploy/"Retry deployment" volstaat. Wijzig je
> `SESSION_SECRET`, dan worden alle bestaande sessies ongeldig (iedereen moet
> opnieuw inloggen).

---

## 9. Nog te doen (volgende ronde)

- Live GA4- en Search Console-data daadwerkelijk inladen met deze tokens
  (incl. automatische refresh van verlopen access tokens) in `/api/analytics`.
- Buffer-OAuth voor automatisch posten naar de socials.
