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

## Blocking for prod

- [ ] **SMTP_HOST unset → all email goes to a throwaway Ethereal inbox.**
  Every "email sent" confirmation (bookings, invoices, broadcasts, POs,
  invites) currently delivers nothing. Configure real SMTP + SPF/DKIM.
  (`server/src/lib/mailer.ts:34-44`)
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

**Removed from nav until genuinely built** (restore each by building the
feature, registering it, re-adding the nav item):
- `ai` ×6 — an AI assistant is a product decision, not a stub.
- `payroll` (company, franchise), staff `pay` — payroll domain not built.
- `moments2` ×4 — duplicate of the real `moments`.
- company `children`, staff `children` — covered by Customers & families.
- company `company-setup` — covered by Setup & features + Account.
- company `ho-framework` — prototype-only concept.
- company `registers` — duplicate of the real `admin-registers`.
- staff `availability`, `holiday` — no shifts-backend support yet; fold
  into Schedule when built.
- staff `expenses` — staff expense *claims* don't exist server-side
  (tenant expenses are the operator's money view).
- staff `training` — no learning-content backend.
- custdash `dash` — parents land on Browse; `memberships` — no backend.
- platform `features`, `billing`, `support`, `messages`, `email`,
  `privacy` — need platform-scoped backends (tenant components won't run
  for tenant-less platform accounts). Platform keeps Overview + Providers.

Also: 5 duplicate nav entries removed (`marketing` ×3 portals, custdash
`account` + `refer`); bare `/custdash` now lands on Browse; `legacyView`
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
