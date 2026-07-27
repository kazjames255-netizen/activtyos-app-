# Production readiness — what's real, what isn't yet

Living checklist from the July 2026 full-app audit (Amir + Claude). Rule of
thumb: nothing visible to a signed-in user may be canned data, a dead
button, or the legacy prototype iframe. Tick items here as they land; add
new fakes the moment they're spotted.

## Done (since the audit)

- [x] **Timetable is real end-to-end** — `/api/timetables` (draft + frozen
  published snapshot), builder on real listings/library/ratio-groups with
  autosave, staff portal Timetable view, parent Schedule "Day plan",
  parents trimmed to booked days.
- [x] Hardcoded sidebar badge counts removed (27 of them — only live
  Messages/Coupons counts remain).
- [x] Staff `incident` slug mismatch — staff now reach the real IncidentsApp.
- [x] Blocks view registered for company + franchise portals.
- [x] `app/dev-capacity` scratch page (fake listings, routable) deleted.
- [x] Cross-block basket bookings accepted server-side (`7a76216`).
- [x] Bookings bulk "Email" composes a real Messages broadcast to the
  selected families (was an `alert()`).
- [x] Booking "Move" (change-day) is real: target must be a session the
  block runs, capacity checked (day scope), per-day counts move with the
  child — the fake hardcoded date pool in `altDates` is gone, chips come
  from live block availability. The redundant "Change date" alert button
  was removed (per-day Move covers it).
- [x] Team invites can be emailed directly (`POST /api/invites` takes
  `email`); link-only flow still works.
- [x] Ratios cover board persists per day (`/api/ratios/board/:date`) —
  staff assignments and drag overrides survive refresh, shared team-wide.
- [x] Public invoice pay-link takes real card payments (Stripe direct
  charge on the provider's connected account, same rules as booking
  checkout; invoice flips to paid on confirmation).

- [x] **Playwright UI e2e suite** (`npm run e2e`, July 2026) — 29 tests: auth,
  signup, portal guard, every nav view in all 6 portals, blocks→wizard→publish,
  browse→book→live operator row, parent cancellation, the full waitlist loop
  (full day → queued → operator offers → parent accepts), a REAL Stripe
  test-card payment through the public pay-link, discount codes end to end,
  child profiles, registers check-in, newsfeed to booked families, tasks,
  staff invite join, operator↔parent messaging, invoice drafting.
  Found & fixed: parents got a 403 replying to a provider
  message unless they had a booking (`server/src/routes/messages.ts`); the API
  allowed publishing a listing with no block bundle → dead booking widget
  (`server/src/routes/listings.ts` publishProblems); form labels were `<div>`s
  (no a11y association) — `FieldLabel` is now a real `<label htmlFor>`.

- [x] **Tier-3 e2e specs** (July 2026, 39 tests total) — safeguarding
  (accidents, medication consent→dose loop, meal shop, photo moments with
  consent), setup→checkout round trip, timetable publish→staff, rota→staff,
  ratio groups, storefront, broadcasts. Bugs found & FIXED this pass:
  - **"Take a booking" never created a booking** — the operator checkout only
    submitted in parent mode; the modal showed "Booked! 🎉" with no API call.
    Wired `onBook` through for operators (`TakeBookingModal` posts the basket
    with `onBehalfOf`; real success panel with the refs).
  - **Timetable day grid hung in an infinite render loop** — zustand selector
    `s.groups()` returned a fresh array per snapshot (React "getSnapshot
    should be cached"). Components now select `groupsList` + useMemo.
  - **Operator Finance page crashed after an invoice card payment** —
    `p.refs.join()` on pay-link records that have no `refs`.
  - **PageHero rendered titles as divs** — pages migrated to it lost their
    headings (a11y); now a real `<h2>`.

- [x] **Customer wallet is real** (§Z) — `server/src/lib/wallet.ts` + the
  `wallet` (balance per tenant+family) and `walletEntries` (ledger)
  collections. `GET /api/my/wallet` feeds the parent Wallet page and the
  checkout preview; `GET /api/wallet/summary` gives the provider its unspent-
  credit liability. Credit is spent automatically at checkout **inside the
  booking transaction** (so two baskets can't spend the same pound) and only
  against places actually taken, never a waitlisted line; the booking records
  `walletApplied` and its `pay` state is judged on what's left to pay. A
  parent's cancel can ask for `refundPref: "wallet"` — recorded on the request
  and honoured on operator approval (credit instead of a Stripe refund).
- [x] **Partial (per-day) cancellation is real** — `/api/my/bookings/:ref/cancel`
  takes `days[]`/`kids[]` + `resolution` ("wallet" credits full pro-rata
  instantly; "refund" judges each day on its own date against the policy and
  files a pending request). The booking stays Confirmed for what remains, only
  fully-released days free capacity, and the seat is held until the whole
  booking goes. `/amend` now validates the target date against the block
  instead of accepting anything. Notifying the provider is still owed (see the
  notifications gap below).
- [x] **Single-use discount codes are released on cancel** — redemptions are
  now written once per BASKET with the refs they paid for
  (`server/src/lib/discountRedemptions.ts`), and handed back when every
  booking they paid for is cancelled. Codes are also only consumed once the
  booking transaction has committed, so a basket that fails on capacity no
  longer burns the code.

- [x] **Notifications are real** — `server/src/lib/notify.ts`: one call raises
  the in-app bell and sends the email. `notifications` (per-family by email, or
  per-team) + `notificationPrefs` (a family's mutes; muting silences the email,
  never the bell). `GET /api/notifications` + `/read` + `/prefs`, on the
  `notifications` SSE channel. **The bell UI is built** —
  `components/shell/Bell.tsx` in the header of every portal except platform
  (no tenant → no bell): live unread badge, dropdown, opening marks read,
  entries deep-link. Wired so far: accidents/incidents (log, edit, parent acknowledgement),
  medication (each dose, parent notes, self-serve authorisations), and a
  provider alert when a family releases days. Still owed: trips, calendar
  reminders, low stock — and the acknowledgement chase, all of which need a
  scheduler that doesn't exist yet.
- [x] **Operator-logged accidents/medication reach the parent** — the forms
  carry a booked-child picker, and medication additionally resolves `childId`
  server-side from the tenant's bookings (and backfills it onto older
  medications when a dose is logged). safeguarding.spec drives the whole path
  through the UI and asserts the parent's bell.

## Known gaps the tests can't paper over

- [x] **Scheduler is real** (27 Jul) — `server/src/lib/scheduler.ts`:
  `sweep()` (recurring scans; a Firestore-transaction lock on
  `schedulerLocks` means exactly one instance runs each interval) +
  `fireOnce()` (exactly-once delivery via `schedulerFired` markers with
  lease-based crash recovery). Wall clock is Europe/London. Running sweeps
  (`lib/sweeps.ts`): calendar reminders (Setup → Calendar + per-event
  override), medication due-times ("· at HH:MM", only on days the child is
  booked), the acknowledgement chase (daily while unacknowledged, capped at
  a week), and waitlist expiry (migrated off the old unsafe `setInterval`).
- [ ] Setup → "Ask about dietary needs" is read by nothing outside Setup
  (the parent child form shows Dietary unconditionally).

## Blocking for prod

- [x] ~~SMTP_HOST unset → Ethereal inbox~~ — Gmail SMTP configured in
  `server/.env` (app password); real delivery works. Remaining niceties:
  Gmail caps ~500 sends/day and mails come "from" the Gmail address —
  switch to a transactional provider + custom domain SPF/DKIM when volume
  or branding demands it. (`server/src/lib/mailer.ts`)
- [x] ~~Staff portal landing page is the legacy iframe~~ — real
  StaffDashApp now (today's sessions, open tasks, day-plan link).
- [ ] **Firestore has no Storage bucket** — images live as Firestore docs
  served via `/api/images/:id`. Enable Blaze/Storage and swap the backing
  store in `server/src/routes/uploads.ts` before image volume grows.

## Stub actions (button exists, nothing behind it)

- [ ] Setup → "Issue refunds automatically" persists but nothing reads it;
  same for "credit note when no cash refund due".
  (`features/setup/SetupApp.tsx:1291-1313`)
- [ ] Subscription: plan choice is recorded (PUT `/api/subscription`) but
  no billing is taken. (`features/money/SubscriptionApp.tsx:43`)

## Legacy prototype iframes — GONE (July 2026)

The iframe bridge (`LegacyViewFrame`) and the 8 MB `public/legacy/
prototype.html` are **deleted**. Every nav slug now maps to a real
component; an unregistered slug 404s. How each of the ~38 was resolved:

**Built real:** staff `dash` (StaffDashApp — today's sessions, tasks, day
plan, live), custdash `payments` (ParentPaymentsApp — owed/paid/refunds
with in-page card payment), staff `timetable` (earlier), company/franchise
`blocks` (earlier).

**Mapped to existing real components:** `support` → SupportApp for
company/franchise/freelancer.

**Honest "Planned" pages** (`features/planned/PlannedApp.tsx` — a clearly
labelled roadmap page with "use this today" links; swap the `planned()`
entry in `lib/view-registry.tsx` for the real component when each lands):
- ~~`ai` ×6~~ — **built (July 2026)**: real chat over live, role-scoped data
  (`features/ai/AiApp.tsx` + `POST /api/ai/chat`, Groq server-side). Needs
  `GROQ_API_KEY` in `server/.env` — unset, the view surfaces a clear 503.
- `payroll` (company, franchise), staff `pay` — payroll domain not built.
- staff `availability`, `holiday` — no shifts-backend support yet.
- staff `expenses` — staff expense *claims* don't exist server-side.
- staff `training` — no learning-content backend.
- custdash `memberships` — no recurring-plan backend.
- platform `features`, `billing`, `support`, `messages`, `email`,
  `privacy` — need platform-scoped backends (tenant components won't run
  for tenant-less platform accounts).

**Routable aliases** (slug resolves so old links don't 404, but only the
canonical item is in the sidebar): company `registers`→Registers,
`children`→Families, `company-setup`→Setup, `moments2`→Moments (also on
franchise/freelancer/staff), staff `children`→Families, custdash
`dash`→Browse.

Also: 5 literal duplicate nav entries removed (`marketing` ×3 portals,
custdash `account` + `refer`); bare `/custdash` lands on Browse; the
registry — not nav membership — now decides what's routable; `legacyView`
fields in nav config are inert metadata to strip in a later cleanup.

## Cleanup (doesn't lie to users, but should go)

- [ ] Dead code: `features/listings/ListingsApp.tsx`,
  `features/storefront/BookingPanel.tsx` (both imported by nothing —
  NB AGENTS.md cites ListingsApp as the CRUD reference pattern; update it too).
- [x] ~~Duplicate nav slugs render twice~~ — deduped with the nav prune.
- [ ] `locations` is registered for the three operator portals but has no
  nav entry → dead route. Add nav item or drop registrations.
- [ ] Staff `compliance` registered but absent from staff nav.
- [ ] Listing wizard *drafts* live only in localStorage
  (`ListingWizard.tsx:401-465`) — published listings are server-truth, but
  drafts don't follow the operator across devices.
- [ ] HowItWorks "Walkthrough — to record" video slots (honest placeholder,
  but record or hide before launch).
- [ ] `features/bookings/data.ts` demo bookings only feed `server/src/seed.ts`
  (demo tenant) — fine, but keep it that way.
- [ ] The whole Money area (invoices, expenses, POs) is absent from
  `server/openapi.yaml` — document it (the spec is supposed to be THE
  contract).
- [ ] `applyChangeDayMutation` in `features/bookings/mutations.ts` is now
  unused (the server's change-day is block-aware in `routes/bookings.ts`).
