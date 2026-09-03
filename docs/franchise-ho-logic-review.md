# Head-office vs Franchise — full platform logic review (2026-09-03)

Six parallel audits (Communication, Money, Sell & Families, Pupils/Safeguarding, Team/Staff/Settings, Marketing/Nav). Verdict below, most severe first. **Root cause is singular:** the franchise portal reuses the company/operator views hitting the same endpoints, and `operatorScope()` returns `franchiseId` but **the routes don't enforce it** (`server/src/middleware/role.ts:97-113`). Only `bookings.ts:193`, `reconciliation.ts:45`, `events.ts`, and split-fees/dashboard (via listing-ownership) actually narrow by franchise. **Everything else filters by `tenantId` only — so a franchise reads *and mutates* the entire head-office tenant** (all sibling franchises + HO).

## 🛠 FIXED THIS SESSION (2026-09-03, franchise-guarded — company/freelancer/platform paths untouched)
All changes narrow ONLY the `role === "franchise"` path via a shared helper (`server/src/lib/franchiseScope.ts`: `franchiseListingIds`, `franchiseFamilyEmails`). Server typecheck 0. Nothing pushed.
- **Capability gating:** franchise blocked from `/api/payments/connect` + `/dashboard` (Stripe-hijack CRITICAL) and from the whole `/api/subscription` router (HO billing CRITICAL).
- **Listings:** `ownListing()` now blocks a franchise editing/deleting HO's or siblings' listings (mutation CRITICAL); `?mine=1` returns only the franchise's own listings; **HO/platform can assign/reassign a listing to a franchise** via `PUT` `franchiseId`.
- **Money:** `expenses`/`income`/`invoices`/`purchasing` — franchise read-filtered to its own, `franchiseId` stamped on create, edit/delete `own()` guarded.
- **Bookings:** `franchiseId` now stamped from the **listing's owner** at parent checkout (`my.ts`) AND operator create (`bookings.ts`) — attribution consistency fix, so franchise Bookings/Calendar/Reconciliation match split-fees.
- **Safeguarding:** `registers` + `meals` boards narrowed to the franchise's own listings' children (cross-franchise child-data CRITICAL).
- **Comms:** message thread list + single-thread open + `broadcast` recipients narrowed to the franchise's own families (the user's example).
- **Marketing:** `discounts` read-filtered + stamped + `own()` guarded.
- **Families:** `customers` list narrowed to the franchise's own families.
- **Safeguarding records (batch 2):** incidents, medication, moments now narrowed via `franchiseChildIds` (children booked on the franchise's listings) — **shows every record for the franchise's own children whoever logged it, never hides one**; HO sees all.
- **Payments records** GET narrowed to the franchise's own bookings.
- **Per-franchise SETTINGS (batch 2):** a franchise now reads/writes its OWN `libraries/{tenantId}__fr__{franchiseId}` doc (seeded from the HO on first load, then independent) — its Setup no longer clobbers the head office's. *Franchise-managed, separate.*
- **HO assign-listing UI:** "Who runs each listing" table on the Territories hub — HO assigns any listing to a franchise (or keeps it Head-office-own); this POPULATES the ownership model everything scopes on.

**Still owed (backend, same pattern):** referrals + reviews scoping/settings; staff/team + availability (needs `franchiseId` on staff); newsfeed posts; email audiences; consumer-wiring so a franchise's OWN listings use the FRANCHISE settings at checkout/registers (public storefront + those readers still read the HO `libraries` doc). **Existing pre-fix bookings/records lack `franchiseId` → a backfill (or resolve-via-listing on read) is still needed for historical data** — newly-assigned/created data is correct. FE still to wire: `useHoScope` into Finance & Analytics (HO drill; Dashboard already does it), franchise comms "your families only" note.

## ✅ What IS correct today (don't break these)
- **Split fees** is HO-only: server 403s non-company (`splitfees.ts:22-31`) + not registered in the franchise portal; franchise gets its own read-only "what I owe HQ" (`GET /splitfees/mine` → `FranchiseRoyaltiesApp`).
- **Territories map** HO-only (`franchises.ts:10` role check); `/franchise/territories` + `/franchise/splitfees` 404 (per-portal registry — this is the *only* thing gating HO tools from franchises; make it intentional).
- **Reconciliation** franchise-scoped (`reconciliation.ts:43-46`); **Bookings LIST** franchise-scoped (`bookings.ts:193`).
- **Dashboard** HO "view as" switcher (company-only) + "Head office — own locations" (`__ho__` → unowned listings) — HO can drill down; HO's own direct trade is distinguishable here + in split-fees' `direct` bucket.

## 🔴 CRITICAL
1. **Cross-franchise SAFEGUARDING leak.** Registers (`registers.ts:81,94-146`), incident/DSL logs (`incidents.ts:176,471`), medication + MAR (`medications.ts:123,323`), meals dietary board (`meals.ts:94,133-163`), moments/child-photos (`moments.ts:150,172`), find-a-child (`children.ts:15-46`), and customer child records (`customers.ts:400-407,325-340`) are **all tenant-wide**. A franchise sees **every other franchise's children** incl. allergies, medical, SEND plans, **collection passwords**, emergency contacts. Highest-priority privacy/safeguarding breach.
2. **Franchise can hijack the HO's Stripe account.** `canWrite` includes franchise (`role.ts:86`); `/connect` + `/dashboard` act on the tenant-level `stripeAccountId` (`payments.ts:56-151`). A franchise can create the company's Stripe account under its own email, or mint a login link into HO's Stripe Express dashboard (bank details, all payouts). → HO-only.
3. **Franchise can edit/delete HO's & siblings' listings.** `ownListing()` checks only `tenantId` (`listings.ts:540-547`); PUT/DELETE gate on it alone.
4. **Franchise can overwrite HO's tenant-wide settings.** Setup saves via `PUT /api/library` → the single shared `libraries/{tenantId}` doc (`library.ts:56-88`, `lib/settings.ts:1505`); `canWrite` includes franchise. A franchise editing Setup/roles/child-questions/venues/referral clobbers HO **and every sibling**. There is no per-franchise settings record.
5. **Franchise can message/broadcast/email/post company-wide.** Threads, broadcast, email audiences, newsfeed all tenant-wide (`messages.ts:73,410-433`; `emails.ts:74-204`; `posts.ts:91,100`). A franchise reads every family's messages and mass-mails the whole company; can even edit/delete HO's newsfeed posts (`posts.ts:129-135`). **This is the user's exact example** — no capability difference from HO today.

## 🟠 HIGH — whole-tenant leaks (read, usually write too)
- **Money:** expenses (`expenses.ts:57`), income (`income.ts:50`), purchasing (`purchasing.ts:84`), invoices (`invoices.ts:76`), payment records (`payments.ts:187`), customers/learners (`customers.ts:88`) — all tenant-wide for a franchise; Finance & Analytics tiles show whole-company money as if the franchise's own. **Franchise can change the HO's ActivityOS subscription** (`subscription.ts:12,120,161`).
- **Marketing:** discount codes (`discounts.ts:218-252`), referrals + tenant-level referral settings (`referral.ts:21-31,126`), reviews + Google/Trustpilot OAuth bound at tenant level (`reviews.ts:97,172`), families pickers — all tenant-wide; a franchise can edit HO's/siblings' codes and reply to any review.
- **Team/Staff:** staff + invite list tenant-wide (`invites.ts:102-113`); availability tenant-wide (`availability.ts:88-177`). No `franchiseId` on staff at all (`invites.ts:158-172`) — so franchise-scoped staff is impossible without a model change.
- **Listings:** `?mine=1` returns the whole tenant's listings to a franchise (`listings.ts:249-255`).

## 🟡 MEDIUM — inconsistencies, attribution, missing HO capability
- **THE key inconsistency:** operational reads (Bookings/Calendar/Reconciliation) scope by the booking's own `franchiseId` field; money reads (Split-fees/Dashboard) scope by the **listing's** owner. Parent checkout never stamps `franchiseId` on the booking (`my.ts` — none). So **a parent booking on a franchise's listing counts in that franchise's royalties but is invisible in its Bookings/Calendar/Reconciliation** — the royalty owed won't reconcile against what it can see it collected.
- **Manual bookings** attributed by operator role not listing owner (`bookings.ts:316`) — HO phone-booking on a franchise listing → stamped null; franchise booking on HO listing → wrongly counted as the franchise's.
- **HO can't assign a listing to a franchise** — `franchiseId` only set at create from creator role; absent from the schema so PUT can't change it; no assign UI. So HO-created listings can never be handed to a franchise.
- **Create paths don't stamp `franchiseId`** (expenses/income/invoices/incidents/medication/moments/customers) → franchise data is unattributable even after read-scoping is added. Customers have **no** franchise model at all.
- **Meal menu is one tenant doc** (`meals.ts:24,194`) — franchises overwrite each other's daily menu.
- **Payroll/leave/timesheets** are browser-localStorage with no tenant *or* franchise key (`PayrollApp.tsx`, `aos.rota.v5`) — no shared source of truth.
- **HO can't drill into one franchise's P&L in Finance** — `useHoScope` is wired only into the Dashboard, not Finance/Expenses/Invoices.
- **Milestones** orphaned from the franchise nav (view registered, no nav item — `config.ts:184-298`).
- **No route-level role/feature enforcement** — any registered view loads by URL for its portal regardless of role or feature-off (`app/[portal]/[view]/page.tsx:19-24`); disabled marketing views still function.

## The fix — 6 structural changes that resolve most findings
1. **Enforce `franchiseId` on every list READ** (shared helper): when `role === "franchise"`, narrow by the franchise — and do it via **LISTING ownership** (a booking/record belongs to whoever owns its listing), matching split-fees, so it's consistent everywhere. HO/company keeps tenant-wide + the `?franchiseId=` lens.
2. **Stamp `franchiseId` on every WRITE** (expenses/income/invoices/incidents/medication/moments/customers/bookings) — derive from the target **listing's** owner (or creator's franchise) so records are attributable.
3. **Per-franchise settings** — franchise Setup inherits HO's `libraries` doc read-only OR gets a per-franchise overlay; a franchise must not `PUT /api/library`.
4. **Capability differentiation (HO-only)** — Stripe connect/dashboard, ActivityOS subscription, company-wide broadcast/email/newsfeed, review-platform OAuth, roles editor. Franchise limited to its own scope (or read-only).
5. **HO assign-a-listing-to-a-franchise** — schema field + `company`-only endpoint + a picker in Listings; enables the whole ownership model.
6. **Route-level enforcement** — gate `/[portal]/[view]` by role + feature, not just nav visibility.

**Ownership:** #1–#4 are backend data-access/security = **Amir's** domain (systematic, ~20 routes, high-risk — must not be blitzed). Front-end capability gating (hide/disable Stripe-connect, subscription, broadcast for franchise), the **booking-attribution consistency** (#2 via listing owner), the **HO assign-listing** UI, wiring **`useHoScope` into Finance**, and adding the **Milestones franchise nav** are pieces I can do. See also [franchise-isolation-handoff.md](franchise-isolation-handoff.md).
