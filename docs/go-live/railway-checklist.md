# ActivityOS go-live runbook (Railway API + Vercel web)

Status of this document: it is a **checklist written from the code**, not a record of work done. Nothing in it has been done on any console by the author. Live URLs:

- Web (Vercel, deploys `main`): `https://activtyos-app-zayoxs-projects.vercel.app`
- API (Railway): `https://activtyos-app-production.up.railway.app` (whether Railway deploys from `main` is **unconfirmed**; check Railway, Settings, Source)

Rule of the repo: nothing is pushed to `main` without Kaz saying so, because a push deploys to real customers.

## Railway variables

Set these on the **API service** (`server/`). "Required" means the feature named is broken or unsafe without it. Source of truth is the code; `server/.env.example` has the same list with comments.

### Required

| Variable | What breaks without it | Used in |
| --- | --- | --- |
| `NODE_ENV` | Must be `production`. Turns on the production guards (Stripe fallback forced off, random signing key warnings, API docs hidden, sends scheduler namespace `prod`, one-hop proxy trust). Railway does not always set it for you. | `server/src/index.ts`, `server/src/lib/scheduler.ts`, `server/src/lib/stripe.ts` |
| `FIREBASE_SERVICE_ACCOUNT` | API cannot reach Firestore or verify logins: nothing works. Raw JSON or base64 of the JSON (base64 is easier in a single-line field). | `server/src/firebase.ts:26` |
| `FIELD_ENCRYPTION_SECRET` | Encrypts staff National Insurance numbers. If unset it is derived from the service account, so **rotating the service account would make every stored NI number unreadable**. Set it explicitly now (`openssl rand -hex 32`), keep a copy in a password manager, never change it casually. In production the API throws if there is no key material at all. | `server/src/lib/fieldCrypto.ts:22` |
| `URL_SIGNING_SECRET` | Signs private image links (children's and injury photos) and unsubscribe links. Unset in production: a random per-process key is used, so every signed link breaks on each restart or redeploy. Set once (`openssl rand -hex 32`), do not rotate casually. | `server/src/lib/signing.ts:16` |
| `WEB_URL` | Origin of the web app: `https://activtyos-app-zayoxs-projects.vercel.app` (no trailing slash; change when the real domain arrives). Used in emailed links, Stripe Connect return URLs, payment finance links and digests. Unset: they point at localhost. The API now logs a boot error (does not crash) if this is missing in production. | `server/src/lib/stripe.ts`, `server/src/routes/payments.ts`, `server/src/routes/customers.ts`, `server/src/lib/hubDigest.ts` |
| `API_URL` | Public origin of the API: `https://activtyos-app-production.up.railway.app`. Used to build emailed links, the accounting (Sage/Xero/QuickBooks) OAuth callbacks and the HMRC Tax-Free Childcare callback. Unset: OAuth callbacks point at localhost and provider sign-ins fail. Boot error logged if missing in production. | `server/src/lib/accounting.ts:29`, `server/src/lib/tfc.ts:66`, `server/src/lib/emailSend.ts`, `server/src/lib/hubDigest.ts` |
| `CORS_ORIGIN` | Comma-separated list of allowed web origins. Must include the Vercel origin (and later the custom domain), exact, no trailing slash. Unset: only localhost is allowed, so **the live site cannot call the API from a browser**. | `server/src/index.ts:124` |
| `STRIPE_SECRET_KEY` | Live key of Kaz's platform account (`sk_live...`). Unset: every payment, pay-link, Connect onboarding and subscription route is dead. Use live keys here and live keys in `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (same account, same mode). | `server/src/lib/stripe.ts:11` |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the webhook endpoint you create in Stripe (see Stripe section). Unset: endpoint answers 503; subscription status falls back to the 6-hourly sweep and **parents' card payments may be taken without being marked paid** (the Connect half has no backstop). | `server/src/routes/stripeWebhook.ts:45` |
| `RESEND_API_KEY` | Sends all transactional mail through Resend (otherwise SMTP is used, otherwise mail is not sent). Also fetches inbound message bodies. | `server/src/lib/mailer.ts:215`, `server/src/routes/emails.ts:849` |
| `MAIL_LIVE` | Must be `1` for mail to reach real recipients. Without it only `MAIL_ALLOWLIST` addresses get mail ("NOT LIVE" is logged at boot). Opt-in on purpose: the sweeps email real parents the moment it is on, so turn it on only when Kaz decides. | `server/src/lib/mailer.ts:99` |
| `MAIL_FROM` | From address, e.g. `ActivityOS <no-reply@yourdomain>` on a domain verified in Resend. Default is `no-reply@activityos.local`, which Resend will reject. | `server/src/lib/mailer.ts:63` |
| `INBOUND_EMAIL_SECRET` | Shared secret on the generic inbound-mail endpoint. In production an unset value means the endpoint refuses (no default), but set a long random value anyway. | `server/src/routes/emails.ts:550` |

### Required only if you use the feature

| Variable | Feature and what breaks | Used in |
| --- | --- | --- |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Second accepted signing secret, needed only if Connect events are registered as a **separate** Stripe endpoint. | `server/src/routes/stripeWebhook.ts:45` |
| `RESEND_WEBHOOK_SECRET` | Verifies Resend's Svix signature on inbound mail (`/api/emails/inbound/resend`). Without it real inbound replies are not accepted. | `server/src/routes/emails.ts:848` |
| `INBOUND_EMAIL_DOMAIN` | Domain for per-provider inbound addresses (`slug@domain`). | `server/src/lib/sender.ts:103` |
| `SAGE_CLIENT_ID`, `SAGE_CLIENT_SECRET`, `SAGE_REDIRECT_URI` | Sage accounting connect. Unset: the Sage connect button reports not configured. The redirect override defaults to `API_URL` + `/api/accounting/callback/sage`; set it only if Sage needs a different registered value. | `server/src/lib/accounting.ts:450` |
| `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI` | Xero connect (same shape; callback default ends `/xero`). | `server/src/lib/accounting.ts:323` |
| `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REDIRECT_URI`, `QBO_ENV` | QuickBooks connect. `QBO_ENV=production` is required for real companies; anything else means the **sandbox** API. Intuit development keys are sandbox-only: real customers need production keys, which need Intuit's app assessment. | `server/src/lib/accounting.ts:229-232` |
| `HMRC_TFC_CLIENT_ID`, `HMRC_TFC_CLIENT_SECRET`, `HMRC_TFC_EPP_UNIQUE_CUSTOMER_ID`, `HMRC_TFC_EPP_REG_REFERENCE` | Tax-Free Childcare. **All four are needed** or the integration counts as not configured and the checkout uses the manual reference path. Plus `HMRC_TFC_BASE_URL` (defaults to the HMRC **test** API, so set the production URL when HMRC approves production) and optional `HMRC_TFC_REDIRECT_URI`. Also set `NEXT_PUBLIC_HMRC_TFC=1` on Vercel only when these are in place. | `server/src/lib/tfc.ts:56-66`, `server/src/routes/tfc.ts` |
| `DAILY_API_KEY` | Live video rooms for lessons. Unset: video lessons cannot start. | `server/src/lib/hubVideo.ts:60`, `server/src/lib/emails.ts:51` |
| `GROQ_API_KEY`, `GROQ_MODEL` | AI writer/assistant and support triage. Unset: those routes answer 503 "isn't configured". | `server/src/routes/ai.ts`, `server/src/routes/platformSupport.ts` |
| `ANTHROPIC_API_KEY` | Only the curriculum/worksheet QA scripts; the running API does not need it. Leave it off the live service. | `server/src/oak/worksheetQuiz.ts:230` |
| `OPS_ALERT_EMAIL`, `OPS_ALERT_MUTE_MINUTES` | Where fault/watchdog alerts are mailed (mute default 60 min). Unset: faults are only logged. | `server/src/lib/monitor.ts:28` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Bootstraps the HQ super-admin at boot (idempotent). Remove `ADMIN_PASSWORD` from the environment once the account exists. | `server/src/index.ts:469` |
| `GOOGLE_PLACES_KEY`, `TRUSTPILOT_API_KEY`, `GOOGLE_BP_CLIENT_ID`, `GOOGLE_BP_REDIRECT` | Reviews integrations. Unset: those sources show as not connected. | `server/src/routes/reviews.ts` |
| `OS_API_KEY` | Ordnance Survey geocoding. Unset: address lookup disabled. | `server/src/routes/geo.ts:16` |
| `HUB_CACHE_ADMIN_KEY`, `READ_STATS_KEY` | Header keys guarding the hub-cache admin endpoint and the Firestore read-meter endpoint. Unset: those endpoints stay closed to remote callers. | `server/src/index.ts:139`, `server/src/index.ts:179` |
| `STORAGE_BUCKET` | Firebase Storage bucket for slide images; default is the project's own bucket. | `server/src/lib/slideStorage.ts:25` |

### Optional / tuning

| Variable | Note | Used in |
| --- | --- | --- |
| `TRUST_PROXY` | Hop count of proxies in front of the API (default `1` in production, which is right for Railway; `false` disables). Wrong value makes rate limits key on the proxy IP. | `server/src/index.ts:112` |
| `PORT` | Railway injects this; do not set it. | `server/src/index.ts:425` |
| `STRIPE_PLATFORM_FALLBACK` | **Must be unset or `0` live.** Dev-only: charges the platform account when a provider has not finished Stripe onboarding. The API now forces it off when `NODE_ENV=production` and logs a loud error. Still delete the variable. | `server/src/lib/stripe.ts` |
| `PUBLIC_API_DOCS` | `1` exposes the interactive API docs in production. Leave unset. | `server/src/index.ts:192` |
| `MAIL_ALLOWLIST`, `MAIL_PER_TENANT_FROM` | Allowlist for not-live mode; per-tenant From addresses (does not work on Gmail SMTP). | `server/src/lib/mailer.ts:101`, `server/src/lib/sender.ts:34` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | SMTP fallback when `RESEND_API_KEY` is not set. | `server/src/lib/mailer.ts:24` |
| `LOW_COST_DEV`, `READ_METER`, `HUB_READ_BUDGET_PER_HOUR`, `HUB_INDEX_TTL_MIN`, `HUB_SNAPSHOT_TRUST_MIN` | Firestore read-cost controls (a past bill came from Firestore reads). Defaults are production-safe: `LOW_COST_DEV` is off in production. | `server/src/lib/readMeter.ts:141`, `server/src/lib/hubIndex.ts:49`, `server/src/lib/hubCache.ts:35` |
| `SCHEDULER_NAMESPACE` | Lock namespace for the sweeps; defaults to `prod` in production. Two environments sharing one Firestore must differ. | `server/src/lib/scheduler.ts:44` |
| `INBOUND_EMAIL_DOMAIN`, `LEADS_WARM`, `LEADS_FRESH_MIN`, `HUB_DIGEST_ENABLED` | Lead cache warming and the weekly hub digest (off unless `1`). | `server/src/routes/leads.ts:216`, `server/src/lib/hubDigestStore.ts:158` |

Not set on Railway: `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST` (if present the API talks to an emulator instead of production Firestore).

## Vercel variables

All `NEXT_PUBLIC_` values are **baked in at build time**: change one, then redeploy (a rebuild, not just a restart). Scope them to Production.

| Variable | Required | What breaks without it | Used in |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Required | Defaults to `http://localhost:4000`: the live site would try to call the visitor's own machine. Set to the Railway origin, no trailing slash. | `lib/api.ts:5`, `lib/realtime.ts:7` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Required | Login and signup cannot start. | `lib/firebase/client.ts:8` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Required | Firebase Auth redirects fail. | `lib/firebase/client.ts:9` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Required | Firebase client cannot initialise. | `lib/firebase/client.ts:10` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Required | Firebase client cannot initialise. | `lib/firebase/client.ts:11` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Required for payments | Card forms (parent pay, invoice pay page, subscription gate) do not mount; no card can be taken. Live `pk_live` key from the same account as `STRIPE_SECRET_KEY`. | `features/payments/PayModal.tsx:18`, `features/money/PayPage.tsx:14`, `features/money/SubscriptionApp.tsx:16` |
| `NEXT_PUBLIC_HMRC_TFC` | Optional | `1` only once the four `HMRC_TFC_*` values are live on Railway. Unset: simulated Tax-Free Childcare step. | `features/listings/tfc.ts:238` |
| `NEXT_PUBLIC_FIREBASE_EMULATOR` | Must be unset | `1` points the browser at a local auth emulator. | `lib/firebase/client.ts:21` |

`NEXT_PUBLIC_BUILD_ID` (`lib/i18n/hubMessages.ts:47`) is optional cache-busting. The site is deployed from `main`; the bundle for the working branch is not live until `main` changes.

## Developer console redirect URIs

The API builds every callback as the `API_URL` origin plus a fixed path (or the matching `*_REDIRECT_URI` override, which must then equal what you register). With the current API host, register **exactly**:

| Console | Redirect / callback URL to register | Composed in |
| --- | --- | --- |
| Sage (Sage Developer, app's callback URL) | `https://activtyos-app-production.up.railway.app/api/accounting/callback/sage` | `server/src/lib/accounting.ts:452` |
| Xero (developer.xero.com, app's redirect URI) | `https://activtyos-app-production.up.railway.app/api/accounting/callback/xero` | `server/src/lib/accounting.ts:325` |
| QuickBooks / Intuit (developer.intuit.com, Keys and credentials, Redirect URIs, **Production** tab) | `https://activtyos-app-production.up.railway.app/api/accounting/callback/quickbooks` | `server/src/lib/accounting.ts:232` |
| HMRC Developer Hub (Tax-Free Childcare application) | `https://activtyos-app-production.up.railway.app/api/tfc/callback` | `server/src/lib/tfc.ts:66` |
| Stripe webhook endpoint (not a redirect, same idea) | `https://activtyos-app-production.up.railway.app/api/stripe/webhook` | `server/src/index.ts:155` |

Notes:

- The path is public on purpose (it arrives as a plain browser navigation with no login header); a single-use `state` ties it to the user (`server/src/routes/accounting.ts`, `server/src/routes/tfc.ts`, mounted in `server/src/index.ts:267-273`). These callbacks therefore do **not** return the blanket 401.
- Redirect URIs must match character for character, including `https` and no trailing slash. If the API moves to a custom domain, update `API_URL` **and** every URI above.
- Intuit: development keys only work against sandbox companies. To connect real customers, Kaz must complete Intuit's production questionnaire/app review, get production keys and set `QBO_ENV=production`. Until then QuickBooks live connections will not work.
- HMRC: the code defaults to the HMRC test API. Production access needs HMRC's approval and `HMRC_TFC_BASE_URL` changed.

## Firebase

Project id (from the bucket default in `server/src/lib/slideStorage.ts:18`): `activityos-bef89`. Confirm in the console.

1. **Authorized domains.** Firebase console, Authentication, Settings, Authorized domains: add `activtyos-app-zayoxs-projects.vercel.app` (and the custom domain when it exists). Without it, sign-in flows that redirect or send links from the live origin are rejected.
2. **Service account for Railway.** Console, Project settings, Service accounts, Generate new private key; paste the JSON (or its base64) into `FIREBASE_SERVICE_ACCOUNT` on Railway. Do not commit or paste the file anywhere else. Because of `FIELD_ENCRYPTION_SECRET` (set first) this can be rotated later without losing NI numbers.
3. **Web app config.** Project settings, General, Your apps: copy the four web values into the `NEXT_PUBLIC_FIREBASE_*` Vercel variables.
4. **Composite indexes.** `firestore.indexes.json` holds 9 indexes (verified by reading the file): `blocks` (`tenantId`, `endDate`), `bookings` (`tenantId`, `createdAt`), `emailMessages` (`tenantId`, `at`), `hubAttempts` x2 (`tenantId`, `childId`, `submittedAt`), `hubFlashcardReviews` (`tenantId`, `childId`, `nextDueAt`), `hubLessons` (`tenantId`, `startsAt`), `payments` x2 (`tenantId` with `paidAt` / `createdAt`). A query needing a missing index fails with a Firestore error. Deploy them:
   - CLI (Firebase CLI is **not installed** on Kaz's Mac): `npm install -g firebase-tools`, then `firebase login`, then from the repo root `firebase deploy --only firestore:indexes --project activityos-bef89`. `firebase.json` already points at `firestore.indexes.json`; there is no `.firebaserc`, so pass `--project`. Amir can do this instead.
   - Console, no CLI: Firestore Database, Indexes, Composite, Add index for each row above (collection id, fields in the listed order ascending, query scope Collection). When a query fails, the error message contains a one-click create link.
   - Indexes build in the background; wait for status Enabled before judging the app.
5. **Firestore rules.** The browser must not touch Firestore directly (`AGENTS.md`); confirm the production rules deny client access.

## Stripe

1. Use the **live** mode toggle. Put the live secret key in `STRIPE_SECRET_KEY` (Railway) and the live publishable key in `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (Vercel, then redeploy).
2. Charges are **direct charges on each provider's Express account** (`server/src/routes/payments.ts`). Connect must be enabled on Kaz's platform account (Settings, Connect) with Express accounts and branding completed, or provider onboarding fails.
3. Webhooks, Add endpoint: URL `https://activtyos-app-production.up.railway.app/api/stripe/webhook`. Enable "Listen to events on connected accounts" (the Connect payment events arrive with an account id). Events handled in `server/src/routes/stripeWebhook.ts`: `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`, `invoice.payment_succeeded`, `invoice.payment_failed`, `payment_intent.succeeded`, `payment_intent.payment_failed`. Copy the endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`. If you create a second, Connect-only endpoint, its secret goes in `STRIPE_CONNECT_WEBHOOK_SECRET`.
4. Confirm `STRIPE_PLATFORM_FALLBACK` is **absent** on Railway. The code forces it off in production regardless and logs `FATAL CONFIG` if it is set (`server/src/lib/stripe.ts`, tested in `server/src/lib/stripe.selftest.ts`), but do not rely on a guard for a setting that should not exist.
5. Do a real small payment with a provider who has finished onboarding, then refund it.

## Smoke test

Automated, polite, read-only: `node scripts/check-live.mjs` (optional `--web URL --api URL`). It makes 5 requests, at least 1.5 s apart, with a browser User-Agent, never more than 8: web `/login` is 200, a bogus path is 404 with the app's not-found page, an API path answers 401 JSON without auth, the CORS preflight allows the web origin, and no `localhost` appears in responses. It stops at once on HTTP 403 with a "Vercel bot challenge, try again later / check in a browser" message. Run it by hand only; do not loop it. `node scripts/check-live.mjs --selftest` tests the script against a local fixture.

Reading results: the API returns 401 for **every** `/api` path before routing (except the public callbacks and webhooks), so a 401 proves the API is up and guarded, not that a particular route exists.

Manual, in a browser (each needs a human):

1. Sign up a throwaway parent and a provider; log in and out; confirm no request goes to `localhost` (browser dev tools, Network).
2. Provider: Stripe Connect onboarding returns to `WEB_URL`.
3. Parent books and pays a small amount; the payment shows paid (webhook working); refund it.
4. Trigger one email to a known address; confirm the link host is the live API/web, not localhost.
5. Connect Sage/Xero/QuickBooks from Money, Accounting and confirm the provider's sign-in returns to the API callback and shows the success page.
6. Railway logs: no `[config]` or `[stripe] FATAL CONFIG` lines, `[mail] LIVE` only if intended, no Firestore "requires an index" errors.

## Rollback

Previous `main` sha before this release: `2a809a02`.

- **Web (Vercel):** Project, Deployments, pick the last good production deployment, menu, **Promote to Production** / Instant Rollback. Takes effect immediately, no rebuild. Environment variable changes need a redeploy, and a rollback keeps the old build's baked `NEXT_PUBLIC_` values.
- **API (Railway):** service, Deployments, open the last good deployment, **Redeploy** (or Rollback where offered). Variable edits also redeploy; revert the variable to undo.
- **Code:** a revert commit on `main` (`git revert`) or redeploying `2a809a02`. Never force-push `main`.
- **Indexes:** adding composite indexes is non-breaking; there is nothing to roll back.
- If payments misbehave, the fastest kill switch is removing `STRIPE_SECRET_KEY` from Railway (payment routes go dead, the rest of the app keeps working).

## What only Kaz can do

Nothing below has been done by the author; every box is open. Kaz owns the accounts; Amir can do the ones marked (Amir).

- [ ] Confirm whether Railway deploys from `main` (Railway, service, Settings, Source) and which branch is live.
- [ ] Railway: set `NODE_ENV=production`, `FIREBASE_SERVICE_ACCOUNT`, `FIELD_ENCRYPTION_SECRET`, `URL_SIGNING_SECRET`, `WEB_URL`, `API_URL`, `CORS_ORIGIN`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`, `INBOUND_EMAIL_SECRET` (generate the secrets yourself; store copies safely) (Amir).
- [ ] Railway: make sure `STRIPE_PLATFORM_FALLBACK` is not set; decide and set `MAIL_LIVE=1` when ready to email real parents.
- [ ] Vercel: set the `NEXT_PUBLIC_*` variables above, then redeploy.
- [ ] Firebase: add the Vercel domain to Authorized domains; generate the service-account key; deploy the 9 indexes (CLI or console) (Amir).
- [ ] Stripe: switch to live mode, enable Connect, create the webhook endpoint with connected-account events, copy its signing secret to Railway.
- [ ] Resend: verify the sending domain; add the inbound webhook and `RESEND_WEBHOOK_SECRET` if inbound mail is wanted.
- [ ] Sage, Xero: register the redirect URIs above and supply the client id/secret.
- [ ] Intuit: complete production app review for QuickBooks, register the production redirect URI, set `QBO_ENV=production`. Until then QuickBooks is sandbox-only.
- [ ] HMRC: Developer Hub application and the four `HMRC_TFC_*` values; production approval before changing `HMRC_TFC_BASE_URL`.
- [ ] Run `node scripts/check-live.mjs` once after the variables are in, then the manual smoke test, including one real small payment and refund.
- [ ] Decide when `main` is pushed (a push is a live release).
