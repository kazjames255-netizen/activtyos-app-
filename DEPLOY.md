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

## 1. Deploy the API (do this first — the web app needs its URL)

On your chosen host (Railway shown):

1. New project → deploy from this GitHub repo, **root directory = `server`**.
2. Build command: *(none — `tsx` runs TypeScript directly)*
   Start command: `npm start`
3. Set environment variables:

   | Var | Value |
   |---|---|
   | `FIREBASE_SERVICE_ACCOUNT` | the base64 blob from step 0 |
   | `WEB_URL` | `https://app.activityos.uk` |
   | `API_URL` | `https://api.activityos.uk` |
   | `CORS_ORIGIN` | `https://app.activityos.uk` (comma-separate if more) |
   | `STRIPE_SECRET_KEY` | your **live** key (or test key for a test deploy) |
   | `STRIPE_WEBHOOK_SECRET` | from step 4 |
   | `PORT` | usually injected by the host; the server reads it |

4. Point `api.activityos.uk` at the host (its custom-domain UI → add a CNAME in
   Namecheap DNS to the value it gives you). Confirm `https://api.activityos.uk/health`
   returns `{"ok":true}`.

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

## What I (Claude) can and can't do here

**Ready in code:** every URL is env-driven (`WEB_URL`, `API_URL`,
`NEXT_PUBLIC_API_URL`, `CORS_ORIGIN`), and the API now accepts its Firebase key as
an inline env var (`FIREBASE_SERVICE_ACCOUNT`) so it runs on a secret-only host.

**Needs you (account/console access I don't have):** creating the Vercel + API-host
projects, pasting secrets, adding the Firebase authorized domain, and the Namecheap
DNS records. Give me a host and I'll tailor the exact commands/config file for it.
