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

## Known gaps the tests can't paper over

- [ ] **Operator-logged accidents/medication never reach the parent** — the
  operator forms are free-text with no child link, but the parent views match
  on `childId`. Needs a booked-child picker on the incident/medication forms
  (safeguarding.spec covers the API-level record a picker would create).
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
- `ai` ×6 — an AI assistant is a product decision, not a stub.
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
