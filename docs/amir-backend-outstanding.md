# ActivityOS — Backend still outstanding (handover for Amir)

_Compiled from the running handoff log. Front-end for all of the below is built and live; these are the server-side pieces owed. Detailed specs live in the referenced `docs/*.md`._

**Read first — endpoints already built (do NOT rebuild):** for features that had no backend, thin Express+Firestore routes were written so they'd work (read/aggregate only, nothing money- or security-critical): `subscription.ts`, `platform.ts`, `analytics.ts` (pageview ingest), `inventory.ts`, plus route additions noted per item. Genuinely yours = real Stripe, server-side enforcement, schedulers/notifications, and the collections listed below.

---

## 0. Production blockers (do these first)

1. **Move Firestore project to Blaze** — free-tier daily read cap has been hit in the day (`8 RESOURCE_EXHAUSTED`), blanking registers/bookings. This is the real fix and also unblocks Storage (#2). Add backoff/circuit-break so the scheduler sweeps stop hammering reads while quota is blown.
2. **Firestore Storage bucket** — images/PDFs/signatures/video are still stored as Firestore docs via `/api/images/:id` (≤900 KB, image only; **video upload is impossible today**). Enable Storage, add a real upload endpoint (image + video), swap the backing store in `uploads.ts`. Everything tagged "ties to Storage #1" depends on this.
3. **Real Stripe Billing (subscriptions)** — spec: `docs/subscription-billing-handoff.md`. Card capture on the plans page (Stripe Elements), subscription create w/ `trial_period_days:7`, day-7 auto-charge + `payment_failed` webhooks → past_due, swap the lightweight cancel/reactivate for Stripe, **server-side access enforcement** (client `SubscriptionGate` is UX only), staff/franchise metering + hard caps. `billingConfigured` is hard-false until done.
4. **Deployment** — guide: repo-root `DEPLOY.md`. Code is deploy-ready (all URLs env-driven, `nixpacks.toml`, service-account via secret). Amir does the accounts/console/DNS: Railway (always-on — background sweeps), Vercel, secrets, **Firebase Authorized domain** (this is what broke Susan's signup link on mobile), Stripe webhook, Namecheap DNS.
5. **Franchise data isolation — finish it** — spec: `docs/franchise-isolation-handoff.md`. A `role:"franchise"` account currently sees the WHOLE company tenant (privacy breach between franchisees). Scoped so far: bookings, reconciliation, dashboard events. **Not scoped: listings, customers/families, registers, medication/incidents/accidents, meals, moments, staff, money.** Needs a franchise-ownership key on listings (HO assigns listing/location → franchise), the read filter applied everywhere, and assignment tooling to tag existing data. Until then the franchise portal is cosmetically branded but data-wide-open.

## 1. Money & payments

6. **Customer wallet backend (§Z)** — still front-end only. Parent cancel offers "wallet credit (instant)" but credits nothing. Needs a wallet ledger + aggregate endpoint (`GET /api/wallet/summary → {outstanding}`) so the provider Dashboard can show total unspent credit (liability tile). Blocks memberships credit + partial-cancel-to-wallet.
7. **Customer memberships — recurring charge** — spec: `docs/memberships-handoff.md`. Phase 1 delivers benefits on JOIN with no money collected. Owed: Stripe subscription per member on the provider's connected account; `invoice.paid` webhook → call existing `deliverMembershipBenefit()`; `payment_failed` → dunning → suspend perks; cancel → cancel sub. **Idempotency**: dedupe credit path on `lastDeliveredAt` (double-credits on duplicate webhooks). Do NOT ship to real money without gating delivery behind a successful charge.
8. **Reconciliation — Tax-Free Childcare auto-reconcile** — wire the HMRC EPP integration (parents pay by Ofsted no.) to match TFC money to bookings and flip them Paid. TFC tab is deliberately blank pending this. (`docs/listings-backend-handoff.md` §S.)
9. **Reconciliation — `cardFailed` trigger** — field + banner exist; set `cardFailed:true` from the Stripe `payment_intent.payment_failed` webhook, clear on success.
10. **Reconciliation phase 2** — split payments (a booking paid across card + TFC/voucher — needs a payment-portions model `[{method,amount,status,ref}]` on the booking, reflected parent + provider), per-child sibling references, parent enters their reference once at checkout. Ripples through parent checkout, booking display, reconciliation — build carefully.
11. **Per-day (partial) booking cancellation** — spec: `docs/partial-cancel-handoff.md`. Cancel endpoint's partial path: add released days to `cancelledDays` (keep rest Confirmed), handle by `resolution` (refund pro-rata per policy / wallet full pro-rata / changedate free+rebook), free only those days' capacity, validate against disabled resolutions, notify. FE also needs a replacement-date picker for changedate.
12. **Add-ons in partial refunds** — per-day add-ons need structured per-day prices on the booking (currently flattened strings); partial-refund calc should = that day's pass share + that day's add-ons at policy %. Refund engine + data model.
13. **Single-use discount code not released on cancel** — cancelling a booking doesn't delete the `discountRedemptions` doc, so the family permanently loses a once-only code for a booking that never happened. Store booking `ref` on the redemption at creation; on cancel (`my.ts` + operator `bookings.ts` applyCancel) delete the redemption(s) for that ref.
14. **`paymentMethod` on bookings** — the Email→Audiences "💳 Payment method" filter is wired FE but `/api/bookings` has no `paymentMethod` field. Add it (method captured at checkout) to the doc + projection.
15. **Rota labour cost → Money/Dashboard/Finance/Payroll** — the Schedule's "Total wages" figure is display-only, wired nowhere. Persist the rota server-side, then roll up labour cost (shift hours × `users.pay_rate` × on-cost) into an Expenses/Money-out line, Dashboard profit, Finance Payouts/Debts, and Payroll. FE reads e.g. `GET /api/labour-cost?from=&to=`.
16. **Setup money toggles that persist but nothing reads** — "Issue refunds automatically" / "credit note when no cash due" / "Ask about dietary needs".

## 2. Notifications & schedulers (the big theme — most FE flows send nothing yet)

17. **Accidents/Incidents → parent** — spec: `docs/accidents-notify-handoff.md`. Email+bell to parent on log/edit (respect `notifyParentOfEdit` + mute), email+bell to staff on acknowledge, reminder-chase cadence when `requireAcknowledgement` on. (Acknowledge + notes-thread routes already built.)
18. **Medication → parent** — spec: `docs/medication-parent-notify-handoff.md`. Resolve `childId` from the picked name on the operator flow, surface med+MAR to the parent, notify parent on each dose. Add `given` boolean to `administerSchema`.
19. **Booked-child picker link** (underlies 17–18) — operator incident/medication forms are free-text with no child link; parent views match on `childId`.
20. **Trips & visits — consent + notify** — spec: `docs/trips-notify-handoff.md`. Notify+consent-request per child, resolve names→childId + per-child consent map, enforce `requireConsent` (block "completed" until consented), parent-side "give consent" view.
21. **Calendar reminders** — spec: `docs/calendar-handoff.md`. Scheduler that, `reminderMinutes` before an event, emails+bells assigned staff (idempotent), honouring per-event override vs tenant default.
22. **Timetable publish → notify parents** — `publishSchema` accepts `notifyEmail`/`notifyPush` but does nothing; on publish-to-parents send an email digest + in-app notifications to the audience.
23. **Meal-order notifications** — parent books/changes/cancels a meal → bell/email provider; when `settings.meals.changeApproval==="review"`, notify provider of the request and notify parent on approve/decline (endpoints exist).
24. **Caterer digest cron** (#32a) — email `listing.mealConfig.catererEmail` a digest of that listing's meal orders daily/weekly at `catererAt`. Also enforce meal cut-off on the booking-checkout meal picker (parent-Meals path already enforces).
25. **Schedule — availability requests + shift sends** — actually send the "Request staff to confirm availability" (email+bell scoped to week(s), per-staff submit screen, flip `avail`→confirmed). Plus the `settings.scheduling` sends: notify-on-publish, `autoRemindUnconfirmed` cron, `shiftReminder` (24h/2h before), `autoRequestAvailability` on new week/season. All toggles already persisted.
26. **Learning reminders** — course-due/overdue/renewal-due/unread-policy emails+bells + weekly manager digest, reading `aos.learn.reminders` prefs; real completion dates → expiry computation.
27. **Holiday approvals** — spec: `docs/holiday-planner-handoff.md`. Bell/email to approver on request, to requester on decision; server-side schedule block + needs-covering alerts.
28. **Staff announcements delivery** — real `staffAnnouncements` collection scoped **server-side to the staffer's site/deployment** (today `notify()` audience is only parent | whole-tenant — no sub-tenant/lead scoping); in-app bell + email; read receipts; who-can-send RBAC (managers + leads).
29. **Message merge-fields — resolve server-side** — resolve `{ChildName}`/`{ParentName}`/`{SessionDate}` etc. in the `POST /api/messages` handler (and message-family email sends) from thread family+booking context, so tokens fill for any caller (system/automated messages), not just the compose screen.

## 3. Staff, RBAC & per-user identity (many items share these roots)

30. **Roles & permissions enforcement** — spec: `docs/roles-permissions-handoff.md`. `role_id` on invites + users (assign on activation, existing = Owner); add `role`+resolved `caps` to `/api/me` (unblocks FE sidebar/action gating); **server-side capability enforcement** per area; Phase 2b sensitive-data hard-enforce (medical/SEND/payroll/finances) + audit log.
31. **Team & invites store** — spec: `docs/team-invites-handoff.md`. Store `staffRole`+`assignment` on invite (client sends, currently stripped); return on `GET /api/invites`; on activation → `users.role_id` + `assigned_listings[]`; `PATCH /api/invites/:token/status`; resend-invite endpoint; keep `staffLimit/staffUsed` accurate.
32. **Deployment / assignment scoping** — accepted invite → person appears in Deployment under assigned location/listings; assignment scopes registers/attendance (assigned staff see only their listings); availability → schedule. Persist `staff_assignments(user_id, venue_id, tenant_id)`.
33. **Staff-onboarding invite pre-fill** — feed the real invite record's captured name/email/role into the onboarding form (demo uses a hardcoded const).
34. **Per-user identity** — several staff views use a hardcoded "me" (Marcus Bell): StaffDash "at my site", My certificates, My payslips, My learning. Needs real per-user scoping.
35. **Register — edit a child's SEND/allergy/medical** — add `childId` to the `/api/registers` attendee projection; add a manager/lead-gated `PUT /api/children/:id` (children.ts is read-only) patching safeguarding fields with an audit stamp; add a lead flag. Also a real `registerNotes` collection (with `shareParent` → parent-app delivery) with role-gated hard-delete + audit.
36. **Listing wizard staff picker** — feed from the tenant's real onboarded/invited team (name+role+bio) instead of the separate `local.staff` localStorage list, so onboarding a person makes them available to tick on every listing. (Model is by-reference via `d.staffIds` already.)

## 4. Big feature collections (front-end complete, need real persistence)

37. **Learning Centre (LMS)** — real collections: courses/quizzes (+ items, questions, pass mark), assignments (scope→audience, due, required), per-staff completion + attempts/scores, certificate store; media uploads (video/image lesson content — ties to Storage); build the staff-side LMS collections; register `learning` for franchise too. Policies read-and-confirm: `policies` + `policyAcks` collections, PDF in object storage, notify-until-confirmed.
38. **Staff credentials/certificates** — real file storage for cert uploads (Storage), persist records + verify state, per-user identity, expiry/renewal reminder sends. Build the public **`/v/<ref>` certificate verification page** the QR points to; persist issued certs + ref lookup.
39. **Payroll** — spec: `docs/payroll-integrations-handoff.md`. RTI (FPS/EPS), per-employee YTD store (P60/P45), proper tax-code/NI (incl. Scottish/Welsh, W1/M1), actual hours from rota, statutory pay + student loans + starters/leavers, real OAuth to QuickBooks/Xero/Sage posting the wages journal, persisted payslips + real PDF + email, payroll-admin RBAC + field-level encryption + audit. **Never store payroll/bank/NI in localStorage in prod.**
40. **Holiday & absence** — spec: `docs/holiday-planner-handoff.md`. Real collections + per-user identity + approval RBAC; carry-over rollover; gov.uk bank-holidays feed by division; holiday-pay → payroll link + SSP from sickness; DP for sickness data.

## 5. Data-model gaps & smaller items

41. **Parent/customer postcode** — no customer postcode exists anywhere; capture at checkout (`booking.postcode`) and/or on the customer record, add to `/api/bookings` projection (Task Manager parent picker + browse-by-distance both read it defensively already).
42. **Provider postcode → browse-by-distance** — postcode captured at signup; wire into browse-by-distance (geocoding/§B).
43. **Listing auto-expire** — scheduled job to flip stored `status` to ended once the last date passes (feed already gates on dates, so nothing leaks — this is for counts/exports/HQ analytics accuracy). Optionally notify the provider.
44. **Newsletter → HTML email** — spec: `docs/newsletter-email-handoff.md`. `postToHtml`/`newsletterToHtml` + `html` field already shipped; remaining: real **PDF/file attachments** (server-side PDF render + nodemailer attachments) and broader email build-out (templates, scheduling, open/click tracking). Campaign builder gaps: video storage (ties to Storage), live countdown (per-open GIF), scheduled sends + tracking.
45. **Marketing consent unsub token** — HMAC-sign the base64url unsubscribe token before prod (currently tamper-evident not signed); surface the suppression list in the UI. (Consent filtering itself is built.)
46. **Seasons — Dashboard date param** — `GET /api/dashboard` (and server-aggregated analytics) should accept `?from=&to=` to scope to a season. Low priority.

## 6. AI, voice & niceties

47. **AI co-pilot tool-use** — spec: `docs/ai-assistant-tooluse-handoff.md` (greenlit; FE contract shipped). Build `/api/ai/chat` returning `{reply?, action?}` + `POST /api/ai/act {tool,args}` executing against existing authed endpoints with server-side perm re-check + mandatory confirm for mail/money/irreversible. Then: structured/typed answers, SSE streaming, server-side saved threads.
48. **Server-side TTS** (#34) — one consistent British female narration voice for the guided walkthroughs + LMS read-aloud (browser `speechSynthesis` varies per browser). TTS endpoint + cached clips; FE swap is small.
49. **AI compose lesson tone** — add a course/e-learning `kind` to `/api/ai/compose` (current prompt is tuned for parent posts); one-line FE swap.

## 7. API docs & cleanup before launch

50. **OpenAPI** — Money area absent from `server/openapi.yaml` (invoices, expenses, POs); document `/api/income`, `/api/suppliers`, purchasing fields, all subscription routes, new platform routes + `/api/analytics/pageview` + register-role fields.
51. **Dead routes / code** — `locations` registered for 3 portals with no nav entry; staff `compliance` registered but absent from staff nav; listing-wizard drafts localStorage-only (don't follow across devices); HowItWorks walkthrough video slots (record or hide); dead code (`ListingsApp.tsx`, `storefront/BookingPanel.tsx`, unused `applyChangeDayMutation`).

---

_Already resolved (for reference, don't redo): Stripe test key e2e, SMTP (Gmail), real StaffDashApp, HQ analytics/engagement/at-risk endpoints, marketing-consent filtering + unsubscribe, meal-order Stripe charge, signup attribution surfacing, `seasonId` listing persistence._
