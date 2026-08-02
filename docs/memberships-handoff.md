# Customer memberships — backend handoff (Phase 2: recurring billing)

## What's built (Phase 1 — front-end + benefit delivery, no recurring charge)

A provider offers up to **three monthly tiers**. Each tier gives **either**:
- **credit** — £X of wallet credit every month, or
- **percent** — Y% off *every* booking (a standing discount code, auto-applied at
  checkout, **stacking** with any coupon).

Already live:
- **Config**: `settings.memberships = { enabled, tiers: MembershipTier[] }`
  (`lib/settings.ts`). Operator builder in **Setup → Memberships**.
- **Data**: a `memberships` Firestore collection, doc id `${tenantId}__${email}`:
  `{ tenantId, email, tierId, tierName, benefitType, benefitValue, priceMonthly,
  status: "active" | "cancelled", startedAt, renewsAt, lastDeliveredAt, cancelledAt? }`.
- **Routes** (`server/src/routes/memberships.ts`):
  - `GET  /api/my/memberships?tenantId=` — tiers on offer + the family's membership.
  - `POST /api/my/memberships/join   { tenantId, tierId }`
  - `POST /api/my/memberships/cancel { tenantId }`
  - `GET  /api/memberships` (operator) — active members + `mrr`.
- **Benefit delivery**: `deliverMembershipBenefit(tenantId, email, tier)` —
  credit → `creditWallet`; percent → upsert an active `discountCodes` doc flagged
  `membership: true` (`membershipTierId`), auto-applied by the checkout.
- **Customer page**: `features/parent/MembershipsApp.tsx` (custdash → Memberships).
- **Nav gating**: shown only when memberships are enabled with ≥1 live tier.

## The ONLY missing piece: recurring billing

Phase 1 delivers the benefit **on join, with no charge collected** — see the
`// Phase 1` comment in `memberships.post("/join")`. **Do not ship to real money
without gating benefit delivery behind a successful payment.**

### What to build
1. **Subscribe on join** — create a Stripe subscription (monthly, `priceMonthly`)
   on the **provider's connected account** (same account bookings charge on;
   reuse the connect plumbing in `server/src/routes/payments.ts` /
   `lib/stripe.ts`). Set membership `status: "pending"` until the first invoice
   is paid.
2. **Webhook — `invoice.paid` (or `payment_intent.succeeded`)**: on each
   successful monthly charge, look up the membership and call the existing
   **`deliverMembershipBenefit(tenantId, email, tier)`** — that's the whole
   integration point; nothing else changes. Set `status: "active"`, bump
   `renewsAt` + `lastDeliveredAt`.
3. **Webhook — `invoice.payment_failed`**: dunning; after final retry, set
   `status: "past_due"` → suspend perks (deactivate the percent code /
   stop crediting) and notify the family.
4. **Cancel** — `POST /cancel` currently just flips status + deactivates the
   percent code. Also cancel the Stripe subscription (at period end).
5. **Proration / switching tiers** — `join` on a different tier while active
   should swap the subscription item (proration is your call).
6. **Idempotency** — guard `deliverMembershipBenefit` against duplicate webhook
   deliveries (e.g. skip if `lastDeliveredAt` is within this billing period). The
   percent path is already idempotent (merges the code); the **credit path is
   not** — a double `invoice.paid` would double-credit, so dedupe there.

### Notes
- Percent tiers **stack** (deliberate — `exclusive: false`). If you ever want a
  cap, the discount engine already supports `maxOff`.
- Wallet credit already given on cancel/refund is the family's to keep (Phase 1
  cancel does not claw back).
- `mrr` in the operator endpoint is a simple sum of `priceMonthly` over active
  members — replace with Stripe's figure once subscriptions exist.
