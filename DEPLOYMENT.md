# Deployment

CourtPlay is a static **PWA** (Vite → `dist/`) with a **Supabase** backend. There is no
app server to run — the frontend is hosted as static files on **Vercel**, and Supabase
(Postgres + Auth + Edge Functions) is already provisioned.

- **Frontend host:** Vercel (static build + CDN)
- **Backend:** Supabase project `uheeddmtntnlgrpzfjph`
- **Production domain:** `courtplay.app` (registered at Namecheap)

The app reads its own origin at runtime (`window.location.origin` for share links and the
OAuth redirect), so **no code changes are needed** to switch domains.

---

## The `.app` TLD: HTTPS is mandatory (but automatic)

`.app` is a Google-operated TLD and the **entire TLD is on the HSTS preload list** —
browsers will only ever load it over **HTTPS**, with no `http://` fallback.

**You do not need to buy or install a certificate.** Vercel auto-provisions a free
Let's Encrypt TLS certificate for the custom domain as soon as DNS points at it.
Consequences: only test over `https://`, and keep all resources HTTPS (already the case).

---

## First-time production setup

### 1. Vercel project
1. Import the GitHub repo (`garvey153/CourtPlay`) at vercel.com, or run `npx vercel` from
   the repo root. Framework is auto-detected as **Vite** (build `npm run build`, output `dist`).
2. Add **Environment Variables** (Settings → Environment Variables), values from `.env.local`:
   | Key | Purpose |
   |-----|---------|
   | `VITE_SUPABASE_URL` | Supabase REST/Auth endpoint |
   | `VITE_SUPABASE_ANON_KEY` | Supabase public anon key |
   | `VITE_CRYPTO_KEY` | App-layer encryption for phone/Venmo |
   | `VITE_ONESIGNAL_APP_ID` | OneSignal web push |
3. SPA routing is handled by `vercel.json` (rewrites all paths to `index.html`) so deep-link
   refreshes (`/post/:id`, `/admin`, `/auth/callback`) don't 404.

### 2. Custom domain (Vercel)
Settings → Domains → add `courtplay.app` and `www.courtplay.app`. Vercel shows the exact DNS
records and **auto-issues the TLS cert** once DNS resolves.

### 3. DNS (Namecheap)
The domain currently serves Namecheap's **parking page** — remove those records.
Namecheap → Domain List → courtplay.app → **Advanced DNS**:
| Type | Host | Value |
|------|------|-------|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

Keep nameservers on Namecheap BasicDNS (`dns1/dns2.registrar-servers.com`). Propagation
takes minutes to a couple of hours.

### 4. Supabase Auth (required — login is Google OAuth)
Supabase Dashboard → Authentication → **URL Configuration**:
- **Site URL:** `https://courtplay.app`
- **Redirect URLs:** add `https://courtplay.app/**` (covers `/auth/callback`)

Without this, Google sign-in fails on the production domain.

### 5. OneSignal (optional — web push)
In the OneSignal dashboard, set the site's allowed origin to `https://courtplay.app`.
The app works without this; only push notifications depend on it.

---

## Ongoing deploys

- Pushing to the default branch (or merging a PR) triggers a Vercel production deploy.
- Preview deploys are created automatically for other branches / PRs.

## Backend changes (not automatic)

Frontend deploys do **not** apply backend changes. Apply these manually:

- **DB migrations** (`supabase/migrations/*.sql`): paste into the Supabase **SQL editor**
  (no local service key). Migrations are applied in filename order; several are idempotent
  (`create or replace`, `add column if not exists`).
- **Edge functions** (`supabase/functions/*`): `npx supabase functions deploy <name>` from
  the repo root.

## Verify a production build locally

```bash
npm run build     # tsc + vite build → dist/
npm run preview   # serve dist/ locally
```
