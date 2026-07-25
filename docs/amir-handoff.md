# Handoff to Amir — 2026-07-25

Hi Amir — a big batch of front-end landed on `main`. This is the "so we're all
up to date" summary: what shipped, **what I already built so you don't rebuild
it**, and **what's genuinely yours**. Detailed specs are linked.

## New working rule (from Kaz)
Claude (front-end) **does not build backend** going forward — you own it. For
new features with no backend, I build the UI on a thin demo layer + write you a
spec. A couple of recent features already have thin Firestore routes from me
(listed below as "don't rebuild"); everything money-/security-critical was left
for you.

## Endpoints I already built — DO NOT rebuild (read/lightweight, existing pattern)
- **Subscription** (`server/src/routes/subscription.ts`): `GET/PUT /api/subscription`
  (start trial + snapshot price/limits), `POST /cancel` + `/reactivate` (status
  flips, **no Stripe**), `GET/PUT /api/subscription/pricing` (platform pricing
  config stored in `platform/pricing`).
- **Platform HQ** (`server/src/routes/platform.ts`): `GET /api/platform/subscriptions`,
  `/providers`, `/analytics`, `/page-engagement`, `/at-risk`; `POST /at-risk/:id/contacted`.
- **Ingest** (`server/src/routes/analytics.ts`): `POST /api/analytics/pageview`
  (client `PageTracker` writes page-time to `pageViews`).
- **register-role**: now seeds `tenant.subscription` + settings (business, contact
  email/phone, activityKinds, address, postcode, heardAbout, referredBy).

## What's genuinely yours (backend)
1. **Stripe billing** — the big one. Front-of-house (gate, trial, plans, config
   pricing, cancel/reactivate stubs) is done. You wire: Stripe card capture
   (Elements), subscription create w/ `trial_period_days:7`, day-7 auto-charge +
   payment-fail webhooks → `past_due`, real cancel/reactivate (proration),
   **server-side access enforcement** (client gate is UX only), staff/franchise
   metering. Spec: `docs/subscription-billing-handoff.md`.
2. **Sales CRM** — new HQ pipeline UI runs on localStorage for now. Build the
   `leads` + `activities` collections, platform CRUD, **bulk CSV import**, a
   **phone/email lookup** (inbound callers), and the **auto-convert on signup**
   (match a lead by email/phone/business in `register-role` → move to "New
   customer" + link tenantId). Spec: `docs/sales-crm-handoff.md`.
3. **HQ Support & messages inbox** — new inbox UI (providers by tier + a
   provider's customers + reported bugs) runs on localStorage; the composer's
   provider directory already reads your live `/api/platform/providers`. Build the
   `supportThreads` collection + platform CRUD, and the **bug-report intake** that
   auto-captures page/device/steps (in-app + inbound email). Spec:
   `docs/support-inbox-handoff.md`.
4. **Medication → link child + notify parent** — operator Medication page is
   fully built (frequency/repeat, instructions [I added `instructions` to
   `medSchema`], one-tap **Given? Yes/No** + confirm + timestamp, child/family
   search picker, Active/Archived + Restore, and a **Setup → Medication** tab of
   policy toggles: inform-parent-when-given / when-missed / require-witness /
   leads-only). What's yours: resolve `childId` from the picked child so a dose
   reaches the parent, surface it in `ParentMedicationApp`, and **notify** the
   parent in the customer area (gated by the new settings). Also add `given`
   (bool) to `administerSchema` so the outcome persists first-class. Spec:
   `docs/medication-parent-notify-handoff.md`. (This is the same "child-link on
   safeguarding/medication forms" item — now with the UI + settings ready.)
5. **API docs** — `server/openapi.yaml` is missing the whole Money area + all the
   routes above (subscription, pricing, analytics, page-engagement, at-risk,
   providers, subscriptions, pageview, income, suppliers) + register-role's new
   fields.
6. **Postcode → browse-by-distance** — signup now captures it; wire into your
   geocoding (§B).
7. **(Perf, later)** the HQ analytics endpoints do full-collection reads — fine
   now, swap for scheduled rollups as volume grows.

## Still standing from before (not from this batch)
- Firestore **Storage bucket** (images still Firestore docs via `/api/images/:id`).
- **Customer wallet backend** (§Z) — front-end only.
- **Child-link on safeguarding/medication forms** so they reach parents (your
  tier-3 finding).

## What I closed off (no longer yours)
Surfacing signup attribution (heardAbout/referredBy/activityKinds) — now the HQ
"How they heard" breakdown + Providers detail.

Shout if any of the "already built" routes clash with something you're mid-way
on and we'll reconcile.
