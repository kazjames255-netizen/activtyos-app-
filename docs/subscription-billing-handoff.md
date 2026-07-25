# Subscription & billing — backend handoff (for Amir)

**From:** Kaz · **Date:** 2026-07-25 · **Decisions locked with Kaz.**

The front-end for onboarding → gate → plan choice → trial is built; this spec is
the **Stripe billing engine + server-side enforcement** it needs behind it. The
client gate (`components/auth/SubscriptionGate.tsx`) is **UX only** — the API
must be the real wall.

## Decisions (locked)
1. **Payment = Stripe Card** (debit/credit via Stripe). No Direct Debit for now.
2. **7-day free trial, card captured upfront**, auto-charge on day 7 unless cancelled.
3. **Cancel = access until end of the paid period, no refund** (`cancel_at_period_end`). Then locked out until they reactivate + pay.
4. **Staff over band cap = hard block + "upgrade" prompt.** Only the 76+ tier meters at **+£1/staff**.
5. Everything visible to Kaz in the **Platform (HQ) portal** ("what have they purchased").

## Plans & limits (source of truth: `server/src/routes/subscription.ts` `PLANS`)
- **Freelancer** — £29/mo. (Solo; staff cap TBD — confirm with Kaz, default no team.)
- **Company** — bands: Starter ≤10 £49 · Growth ≤30 £69 · Scale ≤75 £89 · **76+ £89 +£1/staff** (`staffMax:null, perStaffOver:1`).
- **Franchise** — a Company band (same staff caps per site) **+75% of that band per extra franchisee location** (`perLocationPct:75`). A "location" = one **accepted franchisee invite** (`/api/invites` role "franchise"). Base band covers 1 site.
- **Annual** cadence bills 10 months (2 free).

## Editable pricing config (DONE front-of-house — Amir must honour it)
Pricing is **not hardcoded**. The live catalogue is `platform/pricing.plans` (edited
in the HQ area via `GET/PUT /api/subscription/pricing`, platform-only), falling back
to `DEFAULT_PLANS`. `GET /api/subscription` already serves the live catalogue, so an
HQ price/limit/description edit **auto-applies to new signups**. **Grandfathering
(required):** existing subscribers must NOT move when pricing changes — so at
**trial-start**, snapshot the price + `staffLimit` + `locationLimit` (+ the Stripe
Price id) onto that tenant's `subscription` record, and bill/enforce from the
snapshot, never from live config. `current.details` shown to an existing customer
should reflect their snapshot, not the live catalogue.

## Data model — `tenants/{id}.subscription` (extend what register-role seeds)
Currently seeded `{ status:"none", plan, since:null }`. Target shape:
```
subscription: {
  plan: "freelancer"|"company"|"franchise",
  band: "starter"|"growth"|"scale"|"enterprise"|null,
  cadence: "month"|"year",
  status: "none"|"trialing"|"active"|"canceling"|"canceled"|"past_due",
  trialEndsAt: ISO, currentPeriodEnd: ISO,
  staffLimit: number|null, locationLimit: number|null,   // derived from band/plan
  staffUsed: number, locationsUsed: number,              // metered
  stripeCustomerId, stripeSubscriptionId, stripePriceId,
  cardLast4, cardBrand,
  since: ISO, canceledAt: ISO|null,
}
```

## Endpoints to build
- `POST /api/subscription/checkout` — body `{plan, band?, cadence}`. Create/lookup Stripe Customer, create a **SetupIntent** (or PaymentIntent) so the client's Stripe Elements can capture the card; return `clientSecret`. (Client uses `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.)
- `POST /api/subscription/start` — after the card is attached, create the Stripe Subscription with `trial_period_days: 7` on the right Price; write the model above; status → `trialing`.
- `PUT /api/subscription` (exists) — plan/band change → Stripe proration; recompute limits.
- `POST /api/subscription/cancel` — `cancel_at_period_end: true`; status → `canceling`.
- `POST /api/subscription/reactivate` — resume/new sub, charge, status → `active`.
- Webhook `POST /api/stripe/webhook` — handle `customer.subscription.updated|deleted`, `invoice.payment_succeeded|failed`, `customer.subscription.trial_will_end`; keep `status`/period dates in sync (trial end → charge → `active`; fail → `past_due`).

## Server-side ENFORCEMENT (the important part — client gate is not security)
- **Access:** middleware on operator routes → if `subscription.status` ∉ {`trialing`,`active`} return 402/403 so a lapsed/canceled tenant can't use the API. (Mirror `SubscriptionGate`'s allow-list: gates `freelancer`+`company` owner tenants; pre-existing tenants with no `subscription` field stay allowed.)
- **Staff cap:** on staff/invite create, count active staff; if `>= staffLimit` and band isn't the metered 76+ → block with an "upgrade" error. 76+ → allow + add metered quantity (+£1/staff) to the Stripe subscription.
- **Franchise locations:** on accepting a franchise invite, if `>= locationLimit` → block/upgrade; otherwise add +75%-of-band metered quantity.

## Env / config
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`; create Products/Prices for each plan·band·cadence (or use a base price + metered items for staff-overage & franchise-locations).

## Open questions for Kaz
- Freelancer staff cap? (default: solo, no team management.)
- Franchise base-band choice — does the HQ pick one band that applies to all sites, or per-site?
- "76+ +£1/staff" — is that £1 on top of the £89 Scale price per extra head above 75, billed monthly? (assumed yes.)
