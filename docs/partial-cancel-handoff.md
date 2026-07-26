# Handoff — per-day (partial) cancellation

**From:** Kaz · **Date:** 2026-07-26.

Families can now ask to cancel **individual days** of a multi-day pass, not just
the whole booking. Front-end is built (`features/parent/MyBookingsApp.tsx`,
`CancelRequest`); the backend cancel path is yours.

## Front-end (done)
- The cancel panel shows a **Whole booking / Choose days** toggle when the
  booking has >1 day and the provider allows partial cancel.
- "Choose days" lists the booking's remaining (today-or-later) days as
  checkboxes with a **per-day refund preview**: each day is valued pro-rata
  (`amount ÷ total days`) and run through the provider's cancellation policy
  using **that day's own start date**, so a later day can refund while
  tomorrow's doesn't. The preview sums the ticked days.
- On submit it POSTs the existing `/api/my/bookings/:ref/cancel` with:
  - **`days: string[]`** (ISO dates) for a **single-child** booking, OR
  - **`kids: [{ name, childId?, days: string[] }]`** for a **multi-child**
    booking (each child on their own dates — the picker groups the day
    checkboxes per child, and only the ticked child-days for each child are
    sent). Omitted / empty = whole booking (unchanged behaviour).
- Slots are valued at a share of `amount ÷ (total booked child-days)`, so the
  pro-rata denominator already accounts for every child's days.

## Settings (done, exposed publicly)
`lib/settings.ts` + Setup → Cancellations & refunds:
- **`allowPartialCancel`** (bool, default **true**) — gates the whole feature.
- **`partialCancelPenalty`** (number, default **0**) + **`partialCancelPenaltyUnit`**
  (`"flat"` default | `"percent"`) — an optional penalty for breaking a
  multi-day pass, deducted **once** from the pro-rata refund (never below £0).
  Flat = £X; percent = X% of the cancelled days' pro-rata value. This replaces
  the earlier "reprice" idea, which needed a single-day price that a listing may
  not have and can't be reliably derived.
All whitelisted in `GET /api/public/library/:tenantId`.

**Refund maths (authoritative on your side):**
`grossRefund = Σ policyRefund(day, amountPaid ÷ totalChildDays)` over the
cancelled slots; `penalty = unit==="percent" ? partialCancelPenalty% × Σ(perSlotPaid) : partialCancelPenalty`;
`netRefund = max(0, grossRefund − penalty)`. The front-end previews exactly this;
recompute server-side (don't trust the client figure).

## What's yours (backend)
When `POST /api/my/bookings/:ref/cancel` arrives **with `days`** (a strict
subset of the booking's remaining days):
1. **Partial, not full.** For `days` (single child), add them to the booking's
   `cancelledDays`. For `kids` (multi-child), add each child's days to *that*
   `kids[].cancelledDays` (match by `childId` then `name`). Keep
   `status: "Confirmed"` for what remains. If the request cancels *all*
   remaining child-days, treat it as a normal full cancellation (existing path).
2. **Refund.** Compute per the "Refund maths" above: pro-rata over the cancelled
   slots (same `refundFor` you already use, once per day on that day's start),
   then subtract the single `partialCancelPenalty` (flat or %), floored at £0.
   Record it as a partial refund request (pending your approval / Stripe), the
   same shape as a full cancel's `cancel.amount` / `cancel.refund`.
3. **Capacity.** Free the block/session places for **only** the cancelled days
   (you already free per-day places on a full cancel — reuse that per date).
4. **Validation.** Reject dates that aren't in the booking, are already
   cancelled, or are in the past. Respect `allowPartialCancel = false`
   (reject `days` and tell them to cancel the whole booking).
5. **Notify** the provider as a cancellation request as usual, noting it's a
   partial (which days, the refund figure).

Nothing changes for a whole-booking cancel (no `days` field).
