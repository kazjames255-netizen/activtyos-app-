# Deploying ActivityOS

This app is **two services + Firebase**, so it needs two hosts, not one:

| Piece | What it is | Where it goes | Why |
|---|---|---|---|
| **Web** | Next.js 16 app (this repo root) | **Vercel** | First-class Next hosting, instant deploys from git |
| **API** | Express server (`/server`) | **An always-on Node host** (Railway / Render paid / Fly) | Runs background sweeps on `setInterval` — it must **never sleep** |
| **Data/Auth** | Firestore + Firebase Auth | Firebase (already hosted) | — |

> ⚠️ **Do not put the API on a free tier that sleeps** (e.g. Render Free). The
> reminder/register/medication sweeps and the Stripe backstop run on a persistent
> timer. A sleeping instance stops sending emails and stops reconciling billing.
> Railway (no idle sleep) or Render's paid Web Service are the safe picks.

Proposed URLs (adjust to taste):
- Web → `https://app.activityos.uk`
- API → `https://api.activityos.uk`
- (Marketing `activityos.uk` stays as-is.)

---

## 0. One-time: get the Firebase service-account key

Firebase console → Project settings → **Service accounts** → *Generate new private key*.
You get a JSON file. For a host that takes secrets as **values** (Railway/Render),
base64 it so newlines survive:

```bash
base64 -i serviceAccountKey.json | pbcopy   # now on your clipboard
```

You'll paste that as `FIREBASE_SERVICE_ACCOUNT` on the API host (step 2).

---

## 1. Deploy the API (Railway) — do this first, the web app needs its URL

Railway builds from the **repo root** (not `server/`) — the API imports pure
shared modules from `../../../features` and `../../../lib`, so the whole tree
must be present. A committed **`nixpacks.toml`** already tells Railway to install
and start only the server, so you don't set build/start commands by hand.

1. Railway → **New Project → Deploy from GitHub repo** → pick this repo. Leave
   **Root Directory blank** (repo root). `nixpacks.toml` does the rest:
   installs `server` deps, starts `npm --prefix server start`.
   *(`tsx` is in the server's runtime `dependencies` on purpose — Railway runs
   `NODE_ENV=production`, which skips devDependencies.)*
2. Set environment variables:

   | Var | Value |
   |---|---|
   | `FIREBASE_SERVICE_ACCOUNT` | the base64 blob from step 0 |
   | `WEB_URL` | `https://app.activityos.uk` |
   | `API_URL` | `https://api.activityos.uk` |
   | `CORS_ORIGIN` | `https://app.activityos.uk` (comma-separate if more) |
   | `STRIPE_SECRET_KEY` | your **live** key (or test key for a test deploy) |
   | `STRIPE_WEBHOOK_SECRET` | from step 4 |
   | `URL_SIGNING_SECRET` | a long random string — `openssl rand -hex 32`. Signs children's-photo links and unsubscribe links (`server/src/lib/signing.ts`). **Set it once and never change it**: without it every restart makes a new key, so every photo link and every unsubscribe link already emailed stops working |
   | `PORT` | injected by Railway automatically; the server reads it |

   > That is the **minimum**. It gets the API up, but with no outbound mail
   > (`SMTP_HOST`, `MAIL_FROM`, and `MAIL_LIVE=1` — mail is suppressed until
   > you opt in, deliberately), a public `dev-inbound` webhook secret, and
   > invoice links pointing at localhost (`PUBLIC_WEB_URL`). **Section 6
   > below lists every variable the server reads and what breaks without it** —
   > read it before you call the deploy done.

3. In Railway → the service → **Settings → Networking**, add the custom domain
   `api.activityos.uk`, then add the CNAME it gives you in Namecheap DNS. Confirm
   `https://api.activityos.uk/health` returns `{"ok":true}`.

---

## 2. Deploy the Web app (Vercel)

1. Import this repo into Vercel, **root directory = repo root** (not `server`).
   Framework: Next.js. Build/output are auto-detected.
2. Environment variables:

   | Var | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://api.activityos.uk` |

   > This is read at **build time** and baked into the client bundle, so set it
   > before the first build. Changing it later requires a redeploy.

   The four `NEXT_PUBLIC_FIREBASE_*` values (sign-in won't work without them)
   and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (no card form mounts without it)
   are needed too — see section 6.8.

3. Add the custom domain `app.activityos.uk` (Vercel gives you the DNS record to
   add in Namecheap).

---

## 3. Firebase — authorise the live domain

Firebase console → **Authentication → Settings → Authorized domains** → add:
- `app.activityos.uk`

Without this, sign-in and the password-reset **continue URL** (which now points at
`WEB_URL`) are rejected — this is exactly what broke on Susan's phone against
`localhost`.

---

## 4. Stripe webhook (billing)

Stripe dashboard → Developers → **Webhooks** → add endpoint:
- URL: `https://api.activityos.uk/api/stripe/webhook`
- Events: subscription + invoice events (the app also self-heals via its sweep).

Copy the signing secret into the API's `STRIPE_WEBHOOK_SECRET` and redeploy.

---

## 5. Smoke test the real flow

1. As an operator: upload a logo, publish a listing.
2. Add a family with **your own** phone/email, send the sign-up link.
3. On a **different device / phone**, open the email link, set a password → you
   should land in the parent portal at `app.activityos.uk` (not a refused
   connection), branded with the provider.
4. Book a session; confirm the confirmation email arrives with real (non-localhost)
   links.

---

## 6. Environment variables — the complete reference

Steps 1–2 above list only the handful you cannot go live without. This is
**every** variable the code actually reads, with the behaviour when it is unset
(read from the source, not assumed). Nothing here is optional *and* silent:
where a missing value degrades a feature, the row says how.

Two files, two scopes: the API reads `server/.env` (template:
`server/.env.example`); the web app reads `.env.local` at the repo root and
bakes `NEXT_PUBLIC_*` into the client bundle at **build** time (template:
`.env.local.example`).

### 6.1 API — core / hosting

| Var | What it's for | Required? | If unset |
|---|---|---|---|
| `PORT` | Port the API listens on (`server/src/index.ts`). | Optional | Defaults to `4000`. Railway/Render inject their own — leave it alone there. |
| `NODE_ENV` | Standard Node mode. Gates three things: proxy trust (below), whether `/docs` is served, and whether `URL_SIGNING_SECRET` may fall back to a dev key. | Optional | Treated as non-production: `/docs` is public, trust-proxy off, signing key derived from the service account. Every PaaS sets `production` for you. |
| `CORS_ORIGIN` | Comma-separated extra allowed browser origins. Any `localhost` / `127.0.0.1` / `*.localhost` origin is **always** allowed regardless of this. | **Yes in production** | Falls back to `http://localhost:3000,http://localhost:3001`, so the real web domain is refused by CORS and every API call from it fails. |
| `WEB_URL` | The web app's origin. Used for Stripe onboarding/return redirects and for every link the server puts in an email or a bell notification. | **Yes in production** | `http://localhost:3000` — emails and Stripe returns point at the recipient's own machine (this is what broke on a real phone). |
| `API_URL` | The API's own public origin. Used to build the email open-tracking pixel and unsubscribe links (`lib/emailSend.ts`). | **Yes in production** | `http://localhost:4000` — open tracking and one-click unsubscribe stop working for anyone but you. |
| `PUBLIC_WEB_URL` | ⚠️ **Read only by `routes/invoices.ts`**, for links on invoice pay emails. A second name for the same thing as `WEB_URL`. | **Yes in production** | Falls back to `APP_URL`, then `http://localhost:3000`. Setting only `WEB_URL` leaves invoice links pointing at localhost. Set all three to the same value until the code is unified. |
| `APP_URL` | Fallback for `PUBLIC_WEB_URL`. Same caveat. | Optional | See above. |
| `TRUST_PROXY` | Express `trust proxy` — hop count (e.g. `1`), or the literal `false`. Public rate limits key on `req.ip`, which is the proxy's unless this is right. | Optional | `1` when `NODE_ENV=production`, otherwise off. Correct for Railway/Render/Vercel (one hop). Only change it behind a second proxy or a CDN. |
| `PUBLIC_API_DOCS` | Set to `1` to serve `/docs` and `/openapi.json` in production. | Optional | In production the docs are **not** served (the whole API surface is a map for an attacker). Always available outside production. |

### 6.2 API — Firebase credentials

Resolution order is: emulator → `FIREBASE_SERVICE_ACCOUNT` → `GOOGLE_APPLICATION_CREDENTIALS` → `server/serviceAccountKey.json`. If none match, the API **throws on startup**.

| Var | What it's for | Required? | If unset |
|---|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | The service-account JSON **inline** — raw JSON or base64 (base64 survives a secret store that mangles newlines). The way a hosted API gets credentials. | **Yes on a hosted API** | Falls through to the next credential source; if there is none, startup fails with "No Firebase credentials found". |
| `GOOGLE_APPLICATION_CREDENTIALS` | Absolute path to a service-account JSON file (the Admin SDK's own standard var). Also used as signing-key material. | Optional | As above. |
| `FIRESTORE_EMULATOR_HOST` | e.g. `127.0.0.1:8080`. Its presence switches the whole app to **emulator mode**: no real credentials are loaded even if a key exists, so an emulator run can never touch the live project. | Optional | Real project. |
| `FIREBASE_AUTH_EMULATOR_HOST` | e.g. `127.0.0.1:9099`. Read by the Admin SDK itself (and by `src/isolationTest.mts`). | Optional | Real Firebase Auth. |
| `FIREBASE_PROJECT_ID` | Project id to use **in emulator mode only**. | Optional | `demo-activityos`. Ignored outside emulator mode (the project id comes from the key). |

### 6.3 API — security & bootstrap

| Var | What it's for | Required? | If unset |
|---|---|---|---|
| `URL_SIGNING_SECRET` | HMAC key for everything handed out as an unforgeable URL: children's / injury photos, receipts, and email unsubscribe links (`lib/signing.ts`). | **Yes in production** | Derives a stable key from the service account when one is readable. With **no** service-account material and `NODE_ENV=production` it logs an error and uses a **random per-process key** — every photo link and every unsubscribe link already emailed breaks on each restart. Generate once (`openssl rand -hex 32`) and never rotate casually. |
| `ADMIN_EMAIL` | Bootstraps the Platform (HQ) super-admin on startup. Needs `ADMIN_PASSWORD` too — either alone does nothing. Idempotent: an existing admin's password is never touched. | Optional | No admin is created. Use a temp password and change it via "Forgot password?". |
| `ADMIN_PASSWORD` | See above. | Optional | See above. |

### 6.4 API — outbound email

| Var | What it's for | Required? | If unset |
|---|---|---|---|
| `SMTP_HOST` | Any SMTP provider (Resend, Mailgun, SendGrid, a Gmail app password…). Its presence is what switches on real delivery. | **Yes in production** | Mail goes to a throwaway **Ethereal** inbox instead — nothing is delivered, but each send logs a clickable preview URL. |
| `SMTP_PORT` | SMTP port. `465` implies TLS-on-connect. | Optional | `587`. |
| `SMTP_USER` | SMTP username. Its presence is what enables auth at all. | Usually | The transport connects **without authentication**. |
| `SMTP_PASS` | SMTP password / API key. Only used when `SMTP_USER` is set. | Usually | Empty password. |
| `MAIL_FROM` | The one authenticated From identity — `"Name <addr@domain>"` or a bare address. Its **domain** is fixed (that's what DKIM/SPF authenticate); tenants may only vary the display name. | **Yes in production** | `ActivityOS <no-reply@activityos.local>`, which is not a real domain — every send is a bounce. |
| `MAIL_LIVE` | `1` = actually transmit to real recipients. **Deliberately not implied by `NODE_ENV`**, because every host sets `NODE_ENV=production` and the first staging deploy would otherwise start emailing real parents from the scheduler sweeps. | **Yes in production** | Non-live mode: only `MAIL_ALLOWLIST` addresses receive anything; everything else is logged and skipped, and honestly reported as *suppressed* (not as a delivery). The startup log states which mode is active. |
| `MAIL_ALLOWLIST` | Comma/space-separated addresses that still receive mail when `MAIL_LIVE` is off. The safe way to test on a dev machine. | Optional | Nobody receives mail in non-live mode. |
| `MAIL_PER_TENANT_FROM` | `1` = send as `<tenant-slug>@<your domain>` instead of the single `MAIL_FROM` local part. **Cannot work on Gmail SMTP**, which rewrites `From` to the authenticated account. Only turn on with an ESP that does domain authentication. | Optional | Everything sends from the `MAIL_FROM` address, varying only the display name. |

### 6.5 API — inbound email (parent replies → in-app Inbox)

| Var | What it's for | Required? | If unset |
|---|---|---|---|
| `INBOUND_EMAIL_DOMAIN` | The domain providers forward their mailbox to (`<slug>@<domain>`). Must genuinely receive mail (a Resend-managed receiving domain, or your own subdomain with MX pointed at the inbound provider). | Optional (feature flag) | The whole feature **hides itself**: the "connect your mailbox" panel doesn't render and no address is handed out. |
| `INBOUND_EMAIL_SECRET` | Shared secret for `POST /api/emails/inbound` (the generic endpoint used by curl and the e2e suite), sent as `x-inbound-secret`. | **Yes wherever the API is publicly reachable** | Falls back to the literal `dev-inbound` — i.e. anyone who reads this repo can inject mail into any tenant's inbox. |
| `RESEND_API_KEY` | Fetches the message body for `POST /api/emails/inbound/resend` (Resend's webhook carries metadata only). Same key as `SMTP_PASS` when you send through Resend. | Only for real inbound mail | Together with the next var missing, that endpoint returns **503 "Resend inbound not configured"**. Simulating inbound mail with curl needs neither. |
| `RESEND_WEBHOOK_SECRET` | The Svix signing secret that verifies Resend's webhook (Resend → Webhooks → add your public URL + the `email.received` event). | Only for real inbound mail | As above — 503. |

### 6.6 API — Stripe

| Var | What it's for | Required? | If unset |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | The **platform** account's secret key. Parents' payments are direct charges on each provider's connected Express account; the platform key only orchestrates. | **Yes** (for any payments) | The Stripe client is `null` — every payment, pay-link, Connect-onboarding and subscription route is dead, and the webhook answers 503. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `POST /api/stripe/webhook` (Billing/subscription events). | **Yes in production** | The webhook rejects everything with 503. The 6-hourly subscription-sync sweep still keeps statuses truthful, just slower. |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | A **second** accepted signing secret, for when Connect events are configured as their own Stripe endpoint. Both secrets are tried before a signature is rejected. | Optional | Only `STRIPE_WEBHOOK_SECRET` is accepted — fine when one endpoint carries both event sets. |
| `STRIPE_PLATFORM_FALLBACK` | **DEV ONLY.** `1` = a provider who hasn't finished Express onboarding takes payments on the *platform* account instead (flagged on the payment record), so payment testing isn't blocked. | No — **remove in production** | Off: an unonboarded provider cannot take money, which is the correct production behaviour. |

### 6.7 API — optional integrations

| Var | What it's for | Required? | If unset |
|---|---|---|---|
| `GROQ_API_KEY` | The in-app AI assistant and AI writer, and HQ support-ticket triage. Key stays server-side. | Optional | Those endpoints return **503** with a "not configured" message and the views say so; `aiConfigured` is reported as false. |
| `GROQ_MODEL` | Model id for the above. | Optional | `openai/gpt-oss-120b`. |
| `OS_API_KEY` | Ordnance Survey key for address search and map tiles (server-side, so no map key reaches the browser). | Optional | Falls back to OpenStreetMap / Nominatim, which is keyless but rate-limited — fine for dev, not for production traffic. |
| `GOOGLE_PLACES_KEY` | Pulls live Google reviews via the Places API (needs the tenant's Place ID too). Not stored, per Google's terms. | Optional | The Google source is simply absent from the reviews board. |
| `TRUSTPILOT_API_KEY` | Trustpilot service reviews (needs the tenant's Business Unit ID too). | Optional | The Trustpilot source is absent; `trustpilotConfigured` is false. |
| `GOOGLE_BP_CLIENT_ID` | OAuth client for "connect your Google Business Profile". Needs `GOOGLE_BP_REDIRECT` as well. | Optional | `GET /api/reviews/google/connect` returns **501** with `needsPlatformSetup: true`, and the UI shows the connect button as unavailable. |
| `GOOGLE_BP_REDIRECT` | The OAuth redirect URI registered with that client. | Optional | As above. |

> **Not read by any code:** `OS_API_SECRET` appears in some local `server/.env`
> files. Nothing reads it — it is a leftover and can be deleted.

### 6.8 Web app (Next.js) — `.env.local` / Vercel

All are inlined into the client bundle at **build** time; changing one needs a redeploy.

| Var | What it's for | Required? | If unset |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Origin of the Express API — every fetch and the realtime (SSE) stream. | **Yes** | `http://localhost:4000`, so a deployed site talks to the visitor's own machine and nothing loads. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web SDK config (client-side **auth only** — the browser never touches Firestore). | **Yes** | Firebase Auth cannot initialise; sign-in and signup fail. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | As above. | **Yes** | As above. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | As above. | **Yes** | As above. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | As above. | **Yes** | As above. |
| `NEXT_PUBLIC_FIREBASE_EMULATOR` | `1` = point the web SDK at the local Auth emulator on `127.0.0.1:9099`. | Optional | Real Firebase Auth. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Publishable key for Stripe Elements: the parent pay modal, the invoice pay page and the subscription-billing gate. Must be from the same Stripe account as `STRIPE_SECRET_KEY`. | **Yes** (for any payments) | The card forms don't mount — the pay modal shows its "payments aren't configured" state and the subscription gate cannot collect a card. |

### 6.9 Read only by scripts and the test harness

Not needed to run or deploy the app.

| Var | Where | Notes |
|---|---|---|
| `BRAVE_SEARCH_API_KEY` | `server/scripts/leads/*`, `server/scripts/ventureLakes/*` | Lead-enrichment website lookup. Unset = works anyway, but throttled to one request per 2.5s instead of 4 concurrent. |
| `E2E_BASE_URL` | `playwright.config.ts`, `e2e/helpers/env.ts` | Web origin the Playwright suite drives. Default `http://localhost:3000`. |
| `CI` | `playwright.config.ts` | Truthy = 2 workers + 1 retry, instead of 4 workers + no retry. |
| `P2_RUN` | `server/scripts/plan2/p2_lib.*` | Fixes the acceptance-run id so a run can be resumed. Default is time-based. |
| `S` | `server/scripts/leads/merge_*.mjs` | Directory holding that script's input/output `.jsonl` files. No default — required by those scripts. |
| `NET`, `FIX` | `server/scripts/leads/merge_deep.mjs`, `merge_crawl.mjs` | Set to anything to run that script's one-off repair/report branch instead of the normal merge. |

---

## Handover notes (for Amir)

The code side is done and committed — nothing more to change in the repo to go
live:

- All URLs are env-driven: `WEB_URL`, `API_URL`, `NEXT_PUBLIC_API_URL`,
  `CORS_ORIGIN`.
- The API takes its Firebase key inline via `FIREBASE_SERVICE_ACCOUNT` (raw JSON
  or base64), so it runs on a secret-only host — no key file needed.
- `nixpacks.toml` builds the API from the repo root (its `../../../features` /
  `../../../lib` imports need the whole tree) and starts only the server; `tsx`
  is a runtime dependency so `NODE_ENV=production` installs it.

What's left is all account / console / DNS work (steps 0–5 above): the Railway +
Vercel projects, the secrets, the Firebase **Authorized domains** entry (this is
what caused the `ERR_CONNECTION_REFUSED` on a real phone against `localhost`), the
Stripe webhook, and the Namecheap DNS records.

Open question for Amir: final web address — `app.activityos.uk` is assumed
throughout; change it in one place (`WEB_URL` / the Vercel domain / the Firebase
authorized domain) if it should be different.
