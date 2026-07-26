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

## Model: release a day → choose what happens to it
No penalty (that idea + reprice were dropped — a single-day price a listing may
not sell can't be reliably derived). Instead a released day's **pro-rata value**
(`amountPaid ÷ total booked child-days`) is handled one of three ways, and the
parent picks **one resolution for the whole request** (`resolution` field):
`"refund"` | `"wallet"` | `"changedate"`.

## Settings (done, exposed publicly)
`lib/settings.ts` + Setup → Cancellations & refunds:
- **`allowPartialCancel`** (bool, default **true**) — master gate.
- **`partialAllowRefund`** (default **true**) — cash back, per the cancellation
  policy (the only leaky one).
- **`partialAllowWallet`** (default **true**) — pro-rata value → the family's
  wallet, instant, stays in-house.
- **`partialAllowChangeDate`** (default **false**) — move the day to another of
  the listing's dates. Provider opts in (only sensible when the listing lets
  families pick days across dates, not a fixed week).
At least one must be on for the option to appear. All whitelisted in
`GET /api/public/library/:tenantId`.

## What's yours (backend)
When `POST /api/my/bookings/:ref/cancel` arrives **with `days`/`kids`** (a strict
subset of the booking's remaining days) plus a **`resolution`**:
1. **Release the days.** For `days` (single child), add them to the booking's
   `cancelledDays`. For `kids` (multi-child), add each child's days to *that*
   `kids[].cancelledDays` (match by `childId` then `name`). Keep
   `status: "Confirmed"` for what remains. If the request releases *all*
   remaining child-days **and** resolution isn't `changedate`, treat as a normal
   full cancellation (existing path).
2. **Handle the value** by `resolution`:
   - **`refund`**: pro-rata cash — `Σ refundFor(day, amountPaid ÷ totalChildDays)`
     over the released days (each on its own start), a partial refund request in
     the same shape as a full cancel's `cancel.amount`/`cancel.refund`. Only
     valid if `partialAllowRefund`.
   - **`wallet`**: credit `releasedDays × (amountPaid ÷ totalChildDays)` to the
     family's wallet (full pro-rata value, no policy cut, instant). Ties into the
     wallet backend (§Z). Only valid if `partialAllowWallet`.
   - **`changedate`**: don't refund — the family is moving those days. Either
     free them and let the family rebook the replacement date(s) through the
     amend flow, or accept new dates alongside (your call). Only valid if
     `partialAllowChangeDate`; front-end still needs a "pick the new date" step
     (see note below).
3. **Capacity.** Free the block/session places for **only** the released days
   (reuse the per-date freeing you already do on a full cancel).
4. **Validation.** Reject dates not in the booking / already cancelled / past;
   reject a `resolution` the provider hasn't enabled; respect
   `allowPartialCancel = false`.
5. **Notify** the provider — which days, which child(ren), and the resolution
   (refund £, wallet £, or move).

**Front-end still to do once you're ready:** the `changedate` path currently
sends `resolution:"changedate"` but doesn't yet collect the *replacement* dates —
that wants a small "pick new date(s)" step (can reuse the AmendModal's available-
date picker). Flagged so it's not mistaken for done.

Nothing changes for a whole-booking cancel (no `days`/`resolution`).
