# One reference per checkout (multi-week bookings) - for Amir

Today a checkout that spans weeks creates one booking per week (server/src/routes/my.ts, "One booking doc per block"), each with its own ref, amount and row everywhere. A 10-week Term pass is 10 rows of GBP12 for the parent and the operator; Kaz wants the family to see ONE reference, ONE total, ONE email.

Already shipped (c2ab761a, 19efec17): one confirmation email and one payment-received email per checkout, listing every ref.

## Proposal
1. Add `checkoutRef` (and `weekNo`, `weekCount`) on every booking row created in one POST /api/my/bookings. Keep the per-week rows and per-week refs underneath - capacity, registers, waitlists, cancellations and refunds all key on one blockId and must not change.
2. Parent screens (My bookings, My payments, dashboard "to pay"): group rows by checkoutRef into one card: "Term pass - 10 weeks - GBP120 - ref XYZ", expandable to the weeks. "Pay all" pays the group total. Dashboard counts checkouts, not rows.
3. Operator Bookings list: same grouping with "week n of N"; search by checkoutRef or any week ref; status counts count checkouts.
4. Cancel: offer "cancel the whole checkout" (cancels every unpaid/paid row with the normal refund rule per row) as well as one week.
5. Emails/receipts show checkoutRef first and the week refs below.

## Risks
- Refund maths is per row (features/bookings/helpers.ts, lib/cancellation.ts): a whole-checkout cancel must sum per-row refunds, never recompute from the total.
- Payment settle (server/src/lib/settlePayment.ts) already groups by family+listing; pay-all should reuse it.
- Existing bookings have no checkoutRef: group them by (email, listing, createdAt within 5s) as a fallback or leave ungrouped.
- Search index / exports / Reconciliation must keep working on per-row data.
