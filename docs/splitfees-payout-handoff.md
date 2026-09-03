# Split-fees / royalty PAYOUT execution — handoff (Amir)

**Status:** the royalty **calc + report** is done (`GET /api/splitfees`, now attributed by listing ownership). This doc is the **money-movement** piece — actually collecting the head office's royalty from its franchises. It's the deferred "Stripe Connect transfer" milestone.

## What already exists (the foundation — good news)
Stripe **Connect Express** onboarding is already built and self-serve:
- `POST /api/payments/connect` — starts/resumes Stripe-hosted Express onboarding (`payments.ts:54`). Money lands in the **provider's own** connected account, never ActivityOS.
- `GET /api/payments/status` — `{connected, chargesEnabled, payoutsEnabled, accountId, platformFallback}`.
- `POST /api/payments/checkout` — charges the parent **on the provider's connected account** (`b.stripeAccount`).
- `PaymentsApp.tsx` — the operator "connect / resume / see records" UI. (**Now surfaced in the operator nav as "Get paid" — company/franchise/freelancer** so HO *and* each franchise self-connect independently. No developer needed per provider.)

So every HO and every franchise can already connect their own Stripe account in a few minutes. **What's missing is only the royalty split on top.**

## The decision to make: WHERE the royalty is taken
A franchise here is a `franchiseId`-scoped role **inside the HO's tenant** — but for money it needs its **own** Stripe connected account (the money for its bookings should land with *it*, and the HO takes a cut). Two models:

**Option A — split at source (destination charge + `application_fee_amount`).**
At checkout for a franchise's listing, create the PaymentIntent **on the franchise's connected account** with `application_fee_amount` = the royalty, routed to the HO (or platform → HO). Royalty is collected automatically, per booking, no reconciliation.
- Needs: each franchise connected; the HO/platform as the fee destination; checkout to pick the right connected account + fee from the listing's `franchiseId` + `tenant.splitFees`.
- Cleanest long-term; requires the checkout path to branch by listing owner.

**Option B — periodic transfer / invoice (report-then-settle).**
Keep charging as today; on a schedule (monthly), read `GET /api/splitfees` per franchise and move the royalty from the franchise's balance to the HO via the **Transfer API**, or raise a Stripe **Invoice** to the franchise.
- Needs: a scheduled job + `stripe.transfers.create({ amount: fee, destination: HO_account, source_transaction/... })` or Billing invoices; idempotency per period.
- Less invasive to checkout; matches the existing report exactly; a settlement lag.

**Recommendation:** ship **Option B first** (it sits directly on the finished report + existing Connect accounts — least risk), then move to **Option A** for real-time splitting once franchises are reliably onboarded.

## Owed for either option
1. A franchise gets its **own connected account** (already possible via the surfaced Get-paid page) and the HO is a valid **fee/transfer destination**.
2. Checkout (Option A) or a scheduler (Option B) applies `tenant.splitFees` (`basis: revenue|perBooking`, `rate`/`perBookingFee`) to each franchise's attributed bookings.
3. Idempotency (don't double-charge/transfer a period), failure handling, and a **payout/settlement record** so both sides see "royalty collected" (today `splitfees.collected` is customer revenue paid, NOT royalty collected — add a real royalty-settled figure).
4. Surface status on both the HO **Split fees** page and the franchise **Royalties** page (both now carry a "how this pays out" note pointing here).

Ties to the same Stripe Connect foundation as [subscription billing](subscription-billing-handoff.md) and the [wallet](../). Until this lands, Split fees is an accurate **report of what's owed**, settled off-platform.
