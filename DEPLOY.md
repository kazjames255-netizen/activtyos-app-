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
   | `PORT` | injected by Railway automatically; the server reads it |

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
