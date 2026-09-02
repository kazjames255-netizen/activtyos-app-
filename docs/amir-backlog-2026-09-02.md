# Backend backlog for Amir — as of 2026-09-02

Hi Amir — full list of what's outstanding on the backend, in priority order.
The front-end for all of this is built and live; each area has a detailed
`docs/*-handoff.md` with the data model + endpoints. This file is the index.

**Ground rule (Kaz, 2026-07-25):** for new features with no backend, Claude wrote
thin read/aggregate Express+Firestore routes so they'd work — these EXIST on the
branch and follow the existing route pattern. Don't rebuild them. Anything
money-, auth-, or notification-critical was left for you and is listed below.

---

## 🚨 P0 — Blockers / can't go live without these

1. **Deployment** — the app only runs on localhost, so customers can't reach it
   (an invited parent hit `ERR_CONNECTION_REFUSED` on her phone). Code is
   deploy-ready. **`DEPLOY.md`** (repo root): Railway API (always-on — background
   sweeps), Vercel web, paste secrets, Firebase **authorized domain** (the exact
   thing that broke her phone), Stripe webhook, Namecheap DNS. Assumed
   `app.activityos.uk` / `api.activityos.uk` — confirm/change.
2. **Blaze + Firestore Storage** — images/files are still stored as Firestore
   docs (`uploads.ts`); on 2026-07-27 we blew the free-tier daily read cap and
   the whole backend returned `RESOURCE_EXHAUSTED` mid-day. Move to Blaze (near-
   free at demo traffic) + real object storage, and swap the backing store.
   Unblocks every file-upload feature below. Also add backoff/circuit-break to the
   scheduler sweeps so they stop hammering reads while quota is blown.

## 💳 P1 — Money (front-end delivers value but collects/settles no money)

3. **Subscription billing (Stripe)** — `docs/subscription-billing-handoff.md`.
   Front-of-house fully shipped (gate, plans, 7-day trial, HQ billing/pricing).
   Owed: SetupIntent card capture on the gate, subscription create w/
   `trial_period_days:7`, day-7 auto-charge + `payment_failed` webhooks → past_due,
   swap the lightweight cancel/reactivate for Stripe (cancel_at_period_end,
   proration), **server-side access enforcement** (client gate is UX only), and
   staff/franchise-location metering + hard caps. `billingConfigured` is false
   until then.
4. **Customer wallet backend (§Z)** — still front-end only. Parent cancel offers
   "wallet credit (instant)" but nothing is credited. Needs a wallet ledger +
   aggregate endpoint (`GET /api/wallet/summary → {outstanding}`) so the provider
   dashboard can show total unspent liability. [[customer-wallet]]
5. **Membership recurring billing** — `docs/memberships-handoff.md`. Phase 1
   delivers benefits on JOIN with no money collected. Owed: Stripe subscription
   per member on the provider's connected account; `invoice.paid` webhook →
   existing `deliverMembershipBenefit()`; `payment_failed` → dunning → suspend;
   cancel → cancel sub. **Idempotency:** dedupe on `lastDeliveredAt` (credit path
   double-credits on duplicate webhooks). Do NOT ship Phase 1 to real money.
6. **Partial (per-day) cancellation refunds** — `docs/partial-cancel-handoff.md`.
   FE picks (child,day) slots + resolution (refund / wallet / change-date). Owed:
   cancel endpoint partial path — add days to `cancelledDays`, keep Confirmed for
   the rest, handle each resolution, free ONLY those days' capacity, reject a
   disabled resolution, notify. Change-date needs a replacement-date picker
   (FE todo, flagged).
7. **Per-day add-ons in refunds** — pro-rata is currently `amount ÷ totalDays`
   (even split), wrong when a specific day carries its own add-on. Needs
   structured per-day add-on prices on the booking, then partial refund = that
   day's pass share + that day's add-ons at policy %.
8. **Discount-code not released on cancel** — a "redeemable once" code writes a
   `discountRedemptions` doc on booking create and is then filtered out of the
   family's usable codes; cancelling does NOT delete it, so they permanently lose
   a code for a booking that never happened. Store the booking `ref` on the
   redemption; delete it on cancel (both `my.ts` and operator `bookings.ts`).
9. **Reconciliation — TFC auto-reconcile + split payments** —
   `docs/partial-cancel-handoff.md` / reconciliation notes. (a) Tax-Free Childcare
   tab is blank — wire the HMRC EPP integration to match TFC money → bookings and
   flip Paid. (b) `cardFailed` — set from the Stripe `payment_intent.payment_failed`
   webhook (field + banner already exist). (c) Phase 2: split payments (a booking
   paid across card + voucher/TFC — needs a payment-portions model), per-child
   sibling references, parent enters their reference once at checkout.

## 🛡️ P1 — Compliance / safeguarding

10. **Accidents/incidents → parent notify** — `docs/accidents-notify-handoff.md`.
    Child-link, acknowledge, notes thread, enforce-ack setting all built. Owed:
    the outbound notifications — email+bell to parent on log/edit (respect
    `notifyParentOfEdit` + mute), email+bell to staff on acknowledge, reminder-
    chase when `requireAcknowledgement` on.
11. **Medication → parent** — `docs/medication-parent-notify-handoff.md`. Owed:
    resolve `childId` from the picked name, surface the med + MAR to the parent,
    notify the parent on each dose; add `given` boolean to `administerSchema`.
12. **Trips notify + consent** — `docs/trips-notify-handoff.md`. Owed: notify +
    consent-request per child, per-child consent map, enforce `requireConsent`
    (block "completed" until all consented), parent-side "give consent" view.
13. **Marketing consent** — mostly BUILT (PECR filtering on sends + unsubscribe).
    Owed: **HMAC the unsubscribe token** before prod (currently tamper-evident,
    not signed), and surface the suppression list in the UI.

## 🔔 P2 — Notifications & schedulers (toggles built, no sends behind them)

All per-tenant settings are persisted; just read them in the schedulers.
14. **Availability requests** — "Request staff to confirm availability" marks
    staff `requested` in the rota store; owed: actually email/bell each un-confirmed
    staffer scoped to the week(s)/season + flip to confirmed on submit.
15. **Schedule automation** (`settings.scheduling`) — on publish, email/push
    assigned staff their shifts (`notifyOnPublish`); `autoRemindUnconfirmed`
    24/48h cron; `shiftReminder` 24h/2h before; `autoRequestAvailability` on new
    week/season; overdue check-in alert.
16. **Calendar reminders** — `docs/calendar-handoff.md`. Scheduler to email+bell
    assigned staff `reminderMinutes` before an event (idempotent, honour per-event
    override).
17. **Timetable publish → notify parents** — `publishSchema` accepts
    `notifyEmail`/`notifyPush` but does nothing; fan out email digest + in-app
    notifications to the audience on publish-to-parents.
18. **Staff announcements** — real `staffAnnouncements` collection scoped
    server-side to the staffer's site/deployment; delivery = bell + email (needs
    sub-tenant/lead scoping — today `notify()` audience is only parent|whole-tenant);
    read receipts; who-can-send RBAC (managers + leads).
19. **Meal-order notifications** — bell/email to provider on order/change/cancel;
    approve/decline back to the parent; endpoints exist (`/change`, `/cancel`,
    `/request`). Plus caterer digest cron (email the listing's orders each day/week
    at `catererAt`). **NOTE:** meal ordering itself is fully wired incl. the real
    Stripe charge (`/api/payments/checkout` w/ `mealOrderIds`) — do NOT rebuild
    that; only the notifications + caterer cron are owed.
20. **Low-stock alert** — email/bell when inventory qty ≤ minQty (the ⚠ badge is
    already live).
21. **Course / policy / certificate reminders** — course-due/overdue/renewal/
    unread-policy emails + weekly manager digest, reading the saved reminder prefs;
    expiry computation from renewal interval.

## 🧱 P2/P3 — Bigger areas: front-end done, backend owed

22. **Roles & permissions enforcement** — `docs/roles-permissions-handoff.md`.
    Access matrix built (config only). Owed: `role_id` on invites+users, `role`+
    resolved `caps` on `/api/me` (unblocks sidebar/action gating), server-side
    capability enforcement, Phase 2b sensitive-data hard-enforce + audit log.
23. **Team & invites / deployment** — `docs/team-invites-handoff.md`. Persist
    `staffRole`+`assignment` on invites, return on GET, on activation →
    `users.role_id`+`assigned_listings[]`, PATCH status (deactivate/reactivate),
    resend-invite, keep staff seat metering accurate. Then: accepted invite →
    person appears in Deployment; assignment scopes registers/attendance;
    availability → the right location's schedule; staff dashboard "at my site"
    filters to assigned listings. Invite pre-fill for onboarding from the real
    invite record. `staff_assignments(user_id, venue_id, tenant_id)` store.
24. **Register child edits** — add `childId` to the `/api/registers` attendee
    projection; manager/lead-gated `PUT /api/children/:id` to patch SEND/allergy/
    medical with an audit stamp (children.ts is read-only today); real
    `registerNotes` collection (incl. `shareParent` → surface to family); lead flag
    so staff-leads can edit.
25. **Learning Centre / LMS** — real collections: courses/quizzes (+items),
    assignments (scope→audience, due, required), per-staff completion + quiz
    attempts/scores, certificate store; media (video/image) uploads (ties to #2);
    staff-side Learning Centre; register `learning` for franchise too. **Certificate
    verification:** build the public `/v/<ref>` page (QR points there) + persist
    issued certs; real completion date drives expiry.
26. **Staff credentials/certificates** — real file storage (ties #2), persist
    records + verify state, real per-user identity, expiry/renewal reminder sends.
27. **Payroll** — `docs/payroll-integrations-handoff.md`. RTI (FPS/EPS), YTD/
    cumulative store (P60/P45), proper tax-code/NI incl. Scottish/Welsh + W1/M1,
    **actual hours from the rota** (ties #30), statutory pay + student loans +
    starters/leavers, real OAuth to QuickBooks/Xero/Sage posting the wages journal,
    payslip persistence + real PDF + email/bulk-send + staff view, payroll-admin
    RBAC + field-level encryption + audit. **Never store payroll/bank/NI in
    localStorage in prod.**
28. **Holiday & absence planner** — `docs/holiday-planner-handoff.md`. Real
    collections + per-user identity + RBAC; approval notifications; server-side
    schedule block + needs-covering; year-end carry-over; gov.uk bank-holidays
    feed by division; holiday-pay → payroll; SSP from sickness.
29. **Sales CRM** (`docs/sales-crm-handoff.md`) and **HQ Support inbox**
    (`docs/support-inbox-handoff.md`) — both run on localStorage demo stores;
    specs written; leads/threads collections + platform CRUD + bug-report intake.
30. **Rota labour cost → Money/Dashboard/Finance/Payroll** — the Schedule's live
    "Total wages" is display-only and wired nowhere else. Needs the rota persisted
    server-side, then roll up labour cost (prefer check-in/out hours × `pay_rate` ×
    on-cost) into a Money-out/Expenses line, the Dashboard cost/profit, Finance
    Payouts/Debts, and Payroll. Expose e.g. `GET /api/labour-cost?from=&to=`.

## 📧 Email / campaigns / AI

31. **Newsletter/campaign email** — HTML embed works. Owed: real PDF/file
    **attachments** (server-side PDF render + nodemailer attachments), image+video
    **storage** for blocks (ties #2 — video upload impossible today), live
    countdown (per-open GIF service), **scheduled sends + open/click tracking**.
    `docs/newsletter-email-handoff.md`.
32. **Server-side merge-fields** — `{ChildName}` etc. are resolved client-side at
    send; any message NOT through the compose screen won't resolve them. Resolve
    server-side in `POST /api/messages` + message-family email sends.
    [[messaging-merge-fields]]
33. **AI co-pilot tool-use** — `docs/ai-assistant-tooluse-handoff.md`. Greenlit;
    FE contract shipped. Build `POST /api/ai/act` (execute a confirmed action
    against existing authed endpoints, re-check role server-side, mandatory confirm
    for mail/money) + let `/api/ai/chat` return an `action` payload; then structured
    answers, SSE streaming, server-side saved threads. Also a course/e-learning
    `kind` on `/api/ai/compose` for on-tone training copy.
34. **Guided-walkthrough + read-aloud TTS** — narration uses the browser Web
    Speech API (voice varies per browser/OS). Add a server-side TTS endpoint (warm
    British female), cache clips by text hash; FE swap is small. Shared by the tours
    + Learning Centre read-aloud.

## 🧹 API docs + cleanup before launch

35. **OpenAPI** — the whole Money area is absent from `server/openapi.yaml`
    (invoices, expenses, POs); also document `/api/income`, `/api/suppliers`,
    purchasing fields, all subscription routes, platform routes, `/api/analytics/
    pageview`, register-role's new fields.
36. **Data capture to surface:** parent/customer **postcode** at checkout
    (`booking.postcode` + projection — the Task Manager & browse-by-distance want
    it); **payment method** on bookings (Audiences 💳 filter returns 0 until the
    field exists); provider postcode → browse-by-distance geocoding.
37. **Dead routes / code:** `locations` registered for 3 portals with no nav entry;
    staff `compliance` registered but absent from staff nav; listing-wizard drafts
    localStorage-only; HowItWorks walkthrough video slots (record or hide);
    dead code (`ListingsApp.tsx`, `storefront/BookingPanel.tsx`, unused
    `applyChangeDayMutation`).
38. **Listing wizard staff picker** should pull the onboarded/invited team
    (name+role+bio) rather than the separate localStorage `local.staff` list — so
    a later hire appears in the picker on every listing (assign per listing).
    [[company-staff-invites]]

---

*Priorities from Kaz: get #1 and #2 done first — nothing can go in front of real
customers until the app is deployed and off the free-tier read cap. Everything
else can follow once those two land. Happy to grab 20 mins to plan the order.*
