# Backend handover — everything owed to Amir

**Compiled for Kaz to send to Amir.** One index over all outstanding backend
work. Front-end for every item below is built and on `main`; each links to a
detailed spec doc where one exists. Ordered roughly by priority.

> **Heads-up — endpoints I already built (do NOT rebuild).** Where a new feature
> had no backend, I wrote thin Express + Firestore routes (same pattern as the
> rest, read/aggregate or simple CRUD, nothing money- or security-critical) so
> the UI works. These EXIST on `main`:
> `subscription.ts`, `platform.ts`, `analytics.ts`, `calendarEvents.ts`,
> `inventory.ts`, plus small additions to `incidents.ts` (acknowledge/note),
> `trips.ts`, `my.ts` (/amend), `expenses.ts`, `income`, `suppliers`.
> What's genuinely yours is the money-movement, notifications, enforcement and
> scheduling below.

---

## 1. Blocking / broken real flows
1. **Firestore Storage bucket** — images still stored as Firestore docs via
   `/api/images/:id`. Enable Blaze + Storage and swap the backing store in
   `uploads.ts` before image volume grows. (Only "blocking for prod" item.)
2. **Operator-logged accidents & medication never reach the parent** — forms now
   have a booked-child picker that captures `childId`, but the notify layer isn't
   wired. See §3.
3. **Customer wallet has no backend** (§Z) — parent cancel offers "wallet credit
   (instant)" but nothing is credited; no balance store exists. Needed for §2
   partial-cancel wallet resolution and the dashboard liability tile.

## 2. Money — refunds, wallet, discounts, billing
- **Partial (per-day) cancellation** — `docs/partial-cancel-handoff.md`. Cancel
  endpoint partial path: add days to the right `cancelledDays` (keep Confirmed for
  the rest), resolve by `resolution` (refund = pro-rata per policy; wallet = full
  pro-rata to the wallet ledger; changedate = free + rebook), free ONLY those
  days' capacity, validate against the enabled resolutions, notify.
- **Per-day add-on refund attribution** — pro-rata is currently amount÷days (even
  split); wrong when a specific day carries its own add-on. Needs structured
  per-day add-on prices on the booking, then day-value = pass share + that day's
  add-ons at the policy %.
- **Wallet ledger + summary** — a real balance store + `GET /api/wallet/summary`
  → `{ outstanding }` so the provider dashboard can show unspent-credit liability.
- **Single-use discount code not released on cancel** — store the booking `ref`
  on the `discountRedemptions` doc at creation, and delete it on cancel (both
  `my.ts` cancel and operator `bookings.ts` applyCancel) so a code from a
  cancelled booking becomes usable again.
- **Subscription billing (Stripe)** — `docs/subscription-billing-handoff.md`.
  Real card capture (SetupIntent on the gate), subscription create with
  `trial_period_days: 7`, day-7 auto-charge + fail webhooks → past_due, swap the
  lightweight cancel/reactivate for Stripe (cancel_at_period_end, proration),
  **server-side access enforcement** (the client gate is UX only), staff/
  franchise-location metering + hard caps. `billingConfigured` is hard-false
  until done.
- **Setup stubs**: "Issue refunds automatically" / "credit note when no cash due"
  persist but nothing reads them.

## 3. Notifications (email + in-app bell)
The front-end + settings + child-linking exist; you own the actual sending +
any scheduler.
- **Accidents / safeguarding** — `docs/accidents-notify-handoff.md`. Email+bell to
  parent on log/edit (respect `notifyParentOfEdit` + mute), email+bell to staff on
  parent acknowledge (`safeguarding.notifyStaffAcknowledged`), reminder-chase when
  `requireAcknowledgement` is on. (I built acknowledge + notes endpoints.)
- **Medication** — `docs/medication-parent-notify-handoff.md`. Resolve `childId`
  from the picked child, surface the med + MAR to the parent, notify the parent on
  each dose. Add `given` (boolean) to administerSchema.
- **Trips & visits** — `docs/trips-notify-handoff.md`. Now the **full 7-step
  planner**. Owed: notify + **per-child consent** collection (resolve
  `childNames`→`childId`, store a per-child consent map), enforce `requireConsent`
  (block "completed" until all consented), a **parent-side "upcoming trips → Give
  consent"** view, and **paid consent** — Step 4 "Take payment" and the Step-4
  letter's pay link/consent-tick are front-end stubs; real payment runs through
  Stripe Connect and must show in the parent's profile. Persisted fields on the
  trip incl. `roster/attendees[]/checkpoints/signoff/hazards/parentMsg/payBy/
  askPay/askConsent/attendees[].sent`.
- **Calendar reminders** — `docs/calendar-handoff.md`. `reminderMinutes` before an
  event/session starts, email + bell the assigned staff. Reads
  `settings.calendar.reminderOn/reminderMinutes`; per-event override
  `remindMode` ("default"/"on"/"off") + `remindMinutes`. Needs a scheduler that
  scans upcoming starts and fires once (idempotent). Manual events are in the
  `calendarEvents` collection (CRUD built).
- **Inventory low-stock** (optional) — `settings.inventory.lowStockAlert`. When an
  item's `quantity ≤ minQty`, email/bell the operator. (The ⚠ Low badge is live;
  only the notify is yours.)

## 4. CRM / support / HQ (front-end built, backend spec'd)
- **Sales pipeline** — `docs/sales-crm-handoff.md`. Leads + activities collections,
  platform-only CRUD, convert-to-signup hook, future `sales` role. (Runs on a
  localStorage demo store now.)
- **Support & messages inbox** — `docs/support-inbox-handoff.md`.
  `supportThreads` collection + platform CRUD, and the **bug-report intake**
  (in-app capture of route/UA + inbound-email piping). (localStorage demo now.)

## 5. New areas I built end-to-end (FYI — nothing owed unless noted)
- **Calendar** — `calendarEvents.ts` CRUD (manual events). Only the reminder
  sending in §3 is yours.
- **Inventory / Operations** — `inventory.ts` full CRUD + `/:id/check`,
  `/:id/order` (creates a matching **expense**), `/:id/received`, `/carry-over`.
  Reusable lists in `settings.inventory`. Only the low-stock notify (§3) is a
  future nicety.
- **HQ analytics / engagement / at-risk** — real Firestore endpoints, working.
  Future nicety only: scheduled rollups instead of full-collection reads at scale.

## 6. Onboarding / data
- **Postcode** captured at signup (`tenant.postcode` + `settings.postcode`) — wire
  into browse-by-distance (your geocoding / §B side).

## 7. Docs & cleanup
- **OpenAPI** — the whole Money area is absent from `server/openapi.yaml`
  (invoices, expenses, POs); also document `/api/income`, `/api/suppliers`,
  purchasing fields, all subscription + platform routes, `/api/analytics/pageview`,
  and now `/api/calendar-events` + `/api/inventory`.
- **Dead routes / cleanup**: `locations` (registered, no nav), staff `compliance`
  (registered, not in nav), listing-wizard drafts localStorage-only, HowItWorks
  video slots, dead components (ListingsApp.tsx, storefront/BookingPanel.tsx,
  unused applyChangeDayMutation).

---
Detailed specs live alongside this file in `docs/`. Ping Kaz for anything unclear.
