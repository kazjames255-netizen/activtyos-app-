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

---

## Addendum — 2026-08 (customer memberships + more)

### Customer memberships — Phase 2 is YOURS (recurring billing)
Phase 1 is fully built and on `main`: 3 tiers per provider (% off / £ credit),
operator builder in Setup, customer Memberships page (a gold tab in the custdash
top bar), benefit delivery reusing existing primitives (`creditWallet` /
per-member `membership` discount code that the checkout auto-applies + stacks),
switch-cancels-previous, and a `memberships` Firestore collection.

**What's left is the recurring monthly charge** — the one thing Phase 1 fakes
(it delivers benefits on join with **no money collected**). Full spec:
**`docs/memberships-handoff.md`**. In short:
- Stripe subscription per member on the **provider's connected account** (reuse
  the connect plumbing in `routes/payments.ts` / `lib/stripe.ts`).
- Webhook `invoice.paid` → call the existing **`deliverMembershipBenefit()`**
  (in `routes/memberships.ts`) — that's the single integration point.
- `invoice.payment_failed` → dunning → suspend perks; cancel → cancel the sub.
- **Idempotency**: the credit path double-credits on duplicate webhooks — dedupe
  on `lastDeliveredAt` within the billing period (percent path is already safe).
- **DO NOT ship Phase 1 to real money** without gating benefit delivery behind a
  successful charge.

### Wallet backend (§Z) — still yours, now with more callers
`creditWallet` / `spendWalletInTx` are live and used by memberships + refunds;
the read endpoint `GET /api/my/wallet` returns `{balances:[{tenantId,provider,
balance,transactions}]}`. If that's still my thin layer, harden it.

### Dashboard/analytics date param (small)
`GET /api/dashboard` has **no date param** — the 3/6/12-month toggle only
rescopes the client-side windows, so the server KPI tiles (takenThisWeek,
newThisWeek, occupancy) are fixed windows. Also `newThisWeek` counts bookings
created-then-cancelled in the window. Add a `?from&to` (or `?months=`) param and
have those tiles honour it. (Revenue-math correctness bugs were already fixed
front-end — see the analytics commit.)

---

## Back to Kaz — connecting Stripe is hard to find (front-end, 3 Aug 2026)

Backend is fine and unchanged; this is purely where the entry point lives.
Raising rather than editing, since `FinanceAnalyticsApp.tsx` is yours.

**The symptom:** looking for "where do I link my bank details / Stripe
account", I couldn't find it, and neither could a fresh pair of eyes. It is
there — sidebar **MONEY → Finance & analytics → Payouts tab → "Connect
payouts"** — and it works (`POST /api/payments/connect` → Stripe hosted
onboarding). Three things hide it:

1. **The MONEY sidebar group starts collapsed**, so the page itself is one
   expand away.
2. **`/…/finance` lands on Overview** (`FinanceAnalyticsApp.tsx:41`), and
   nothing on Overview hints that payouts need connecting. The entry point is
   on a tab most people won't click when they're hunting for "bank details".
3. **The words "Stripe" and "bank" appear nowhere** on the page — it's
   "Connect payouts" under "Finance & analytics". Searching the UI for either
   term finds nothing.

**The bigger one — it disappears forever once connected.** The banner renders
only while `status && !status.payoutsEnabled`. After onboarding there is no
route in the product to review or change payout settings, so a provider
switching bank accounts has to go to Stripe directly and would reasonably file
that as a bug.

Two cheap fixes, both yours to shape:

- **Default to the Payouts tab when not connected.** One line — `useState`
  seeded from the `/api/payments/status` result. A provider who hasn't set up
  payouts almost certainly opened Finance for exactly that.
- **Keep a permanent, quiet row after onboarding** — "Payout account:
  connected ✓ · Manage" linking to a fresh account link. `GET
  /api/payments/status` already returns `connected` / `chargesEnabled` /
  `detailsSubmitted` / `payoutsEnabled`, so all four states are renderable
  today with no backend change.

Your new signup **"Get paid"** step (`app/signup/page.tsx:57`) covers new
operators nicely — this is about everyone who signed up before it, and about
life after onboarding.

**Unrelated, while I was in there:** `BookingCard` in `MyBookingsApp.tsx` lost
its `data-ui="card"` attribute in the parent rebuild, so `cardWith()` can't
anchor parent booking rows in e2e any more. I worked around it in the specs,
but that attribute is what the suite's anchoring convention rests on — worth
putting back.
