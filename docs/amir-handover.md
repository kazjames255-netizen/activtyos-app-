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
2. ~~**Operator-logged accidents & medication never reach the parent**~~ —
   **DONE (Amir, 27 Jul).** The notify layer exists and both are wired; medication
   also resolves `childId` server-side rather than trusting the form. See §3.
3. ~~**Customer wallet has no backend** (§Z)~~ — **DONE (Amir, 27 Jul).**
   `server/src/lib/wallet.ts`; collections `wallet` (balance per tenant+family)
   + `walletEntries` (ledger). `GET /api/my/wallet` returns the
   `{ balances: [{ tenantId, provider, balance, transactions[] }] }` the Wallet
   page and checkout already expect; `GET /api/wallet/summary` →
   `{ outstanding }` for the liability tile (front-end tile still to build).
   Credit is spent automatically at checkout inside the booking transaction,
   only on places actually taken; `refundPref: "wallet"` on a parent cancel is
   recorded and honoured when the operator approves. `wallet` is wired into the
   SSE realtime channel both sides.

## 2. Money — refunds, wallet, discounts, billing
- ~~**Partial (per-day) cancellation**~~ — **DONE (27 Jul)**, except the notify
  (folded into §3). `POST /api/my/bookings/:ref/cancel` now takes `days[]` or
  `kids[]` + `resolution`. Field meanings after a release, which the parent's
  per-day price depends on: `kids[].dates` = what was BOOKED (never shrinks, or
  `amount ÷ child-days` inflates), `kids[].cancelledDays` = released,
  `days`/`sessions` = what's still on (shrinks, so registers and capacity are
  right), `amount` untouched. Only days NO child is left on free capacity, and
  only that day's count — the seat is held until the booking itself goes.
  Wallet = full pro-rata, instant. Refund = each day judged on its OWN date
  against the policy, recorded as a pending request on `cancel` with
  `refundOnly: true` so the booking still reads Confirmed.
  **Two deliberate divergences from the front-end preview**, both because the
  server won't hand back money it never took: pro-rata is computed on
  `amountPaid` (the preview uses `amount`), so an unpaid booking releases days
  for £0; and `partialAllowChangeDate` stays a UI-only gate, since the amend
  modal and the release-a-day flow post identical payloads to `/amend` and
  enforcing it server-side would break the former. `/amend` now validates
  properly (target must be a session the block runs, with space; `from` must be
  on the booking; honours `allowDateChanges`) — it previously accepted anything.
- **Per-day add-on refund attribution** — pro-rata is currently amount÷days (even
  split); wrong when a specific day carries its own add-on. Needs structured
  per-day add-on prices on the booking, then day-value = pass share + that day's
  add-ons at the policy %.
- ~~**Wallet ledger + summary**~~ — **DONE (27 Jul).** See §1.3. The provider
  dashboard TILE is front-end work: `GET /api/wallet/summary` is live.
- ~~**Single-use discount code not released on cancel**~~ — **DONE (27 Jul).**
  `server/src/lib/discountRedemptions.ts`. Redemptions are written once per
  BASKET carrying the refs they paid for, and released when every one of those
  bookings is cancelled (a single sibling dropping out doesn't free the code).
  Both cancel paths call it. Codes are also only consumed after the booking
  transaction commits, so a basket that fails on capacity no longer burns one.
  Note: redemption docs written before this date have no `refs` and so can't be
  released — only new bookings are covered.
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
**Infrastructure DONE (27 Jul), events partly done.** `server/src/lib/notify.ts`
— one `notify()` call raises the bell AND sends the email. Collections:
`notifications` (audience `"parent"` matched by email, or `"tenant"` for the
whole team) and `notificationPrefs` (a family's per-category mutes). API:
`GET /api/notifications` (list + unread count, audience decided by role, never
by a query param), `POST /api/notifications/read`, `GET|PUT
/api/notifications/prefs`. Wired into the SSE channel `notifications` both
sides. **The bell UI itself is front-end work — the API is live and waiting.**
Muting silences the EMAIL only; the bell still records it, so a family who
opted out of being chased isn't kept in the dark.
Provider Setup toggles are checked by each caller (they already hold the
settings); the parent mute is enforced centrally so no caller can forget it.
- ~~**Accidents / safeguarding**~~ — **DONE (27 Jul)** except the chase. Parent is
  notified on log (`notifyParentAccident` default on / `notifyParentIncident`
  default off) and on edit — but only when staff tick `notifyParentOfEdit` AND a
  field actually changed, so re-saving a form doesn't email the family again.
  Staff are told on the parent's FIRST acknowledgement only
  (`notifyStaffAcknowledged`). **Still owed:** the reminder-chase for
  `requireAcknowledgement`, which needs the scheduler below.
- ~~**Medication**~~ — **DONE (27 Jul).** `given` is on `administerSchema` and
  persisted (the old inference from the free-text `doseGiven` is only a fallback).
  `childId` is resolved SERVER-side by matching the child's name against this
  tenant's bookings, on both authorise and administer — and backfilled onto older
  medications when a dose is logged, or their doses would never reach the parent's
  MAR. Parent notified per dose (`informParentGiven`/`informParentMissed`, worded
  differently for a missed one); provider notified on a parent note
  (`notifyParentNote`) and a self-serve authorisation (`notifyParentAuthorise`).
  Note the name→booking match is a per-tenant collection scan — fine now, wants an
  index if medication volume grows.
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
- **Moments** — when a moment is posted, **notify + email the tagged children's
  parents with a direct deep link** to view it in their area (the front-end
  already shows "parents are notified & emailed"). The parent feed
  (`GET /api/moments` for role=parent) already works; only the outbound
  notification/email + link is owed. Consent is enforced server-side (child
  photos require `photoConsent`; work photos don't). **Built by me** (FYI):
  parent↔provider **comments** (`POST /:id/comment`), operator **marketing-star**
  on a comment (`POST /:id/comment/:idx/marketing`), parent folders (photos /
  their work), and a plain photo **download**. **Future/nice-to-have (noted for
  later):** a "download **with comments**" composite (photo + caption + the
  starred parent quote baked in) for marketing, and **surfacing the
  marketing-starred quotes into the Email/Marketing area** as ready-made
  testimonials.
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
