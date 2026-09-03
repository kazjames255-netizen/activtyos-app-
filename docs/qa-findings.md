# ActivityOS — QA findings log

## ⏳ TO VERIFY LATER (not done yet — deferred by user)
- **#28 booking-hold live test:** log in as a **parent**, book a listing whose provider has a child question flagged **"hold if answered No"** (with that toggle on), answer **"No"**, and confirm the booking lands **"Approval needed"** (not auto-Confirmed) in the operator Bookings list. Code is wired + typechecks; only the live end-to-end check remains. _(User: "won't do it today.")_
- **Messages New-tab/ordering fix:** confirm live on the **company** account — "New"/"Needs reply" hide broadcasts, unread conversations sit at the top, "Sent to groups" now below.


## Session summary (overnight)
**Fixed + verified (typecheck 0, nothing pushed):** F1 bookings dup-key · F3 slow auth gate (session-cached `/api/me` → app-wide speedup) · F4 meals wrong-message flash · F5 sidebar brand flash · shared `getMe()` cache (PortalGuard/Meals/Sidebar).
**Confirmed:** A1 — `amirthedad@gmail.com` login works (earlier fail = wrong password).
**Root-cause for backend (Amir):** P3 — `/api/me`, `/api/my/children`, `/api/my/providers` are slow (seconds); the `getMe` cache mitigates `/api/me` to one fetch/session but the cold fetch still stalls, and the parent lookups flicker (P1 brand, P2 pluralization). Real fix = speed up those Firestore reads server-side.
**Deliberately NOT done blind (would risk breaking flows while unattended):** converting the other ~23 `/api/me` callers to the cache (some need fresh data, e.g. `ParentWelcome.welcomed`).
**Code audit DONE** → full master plan saved to [docs/qa-test-plan.md](qa-test-plan.md) (118K; Section 3 = settings on/off matrix, Section 5 = prioritised bug list). From it I fixed the safe, localized, typecheck-verified ones:
- **#34** support "Report a problem": customer topics `error`/`account`/`other` were rejected by the server enum → 400. Widened `supportTopics` (server/src/routes/messages.ts). Client+server tsc 0.
- **#24** staff reminder "N courses to complete" linked to `training` (unregistered → 404) → now `certificates` (the real staff courses view). features/staff/StaffReminderBanner.tsx.
- **#89** franchise sidebar typo "Learning Centre1" → "Learning Centre". lib/nav/config.ts.
- **#61** Reviews hub couldn't tell loading / failed-fetch / genuinely-empty apart (a failed load looked like "0 reviews") → added loading + error states. features/reviews/ReviewsApp.tsx.

**Left for the user to prioritise (NOT fixed — need judgment/verification):** the rest of Section 5 — legacy-prototype money/listings items (being strangler-replaced), backend-not-built (Stripe/wallet/deactivate — Amir), and the big one: **feature "off" is nav-only, never route-enforced (#32)** + ~30 **dead/write-only settings toggles (#49, #52, #68-#77 etc.)**. Wiring those changes real behaviour, so they need sign-off, not a blind overnight edit.

**Live sweeps still needed:** company / staff / platform — log those accounts into `localhost:3000` and I'll run them.

### Child-safety toggles (signed off "go all") — verified each before wiring
- **#28 "hold booking if parent answers No" (reviewIfNo) — ✅ WIRED.** `heldForReview` had zero callers → parents' "No" answers (incl. toilet-training) auto-confirmed. Now the booking-create handler (`server/src/routes/my.ts`) loads the tenant's review-if-No question ids + each child's stored answers (already-loaded, no extra reads) and forces **"Approval needed"** on any held child — even on an auto-confirm listing, and only for parent self-bookings (operator on-behalf still stands). Fail-safe (guarded load; worst case = more approvals, never a money/crash risk). Flows into the existing approval-request pipeline. Server tsc 0. **Needs a live "answer No → booking holds" test when a portal's up.**
- **⚠️ Audit false positives (already working — do NOT re-wire):** **#74 trips.requireConsent** (server 409-blocks completing a trip with pending consent, `trips.ts:236`), **#69 medication.remindWhenDue** (respected by the server sweep, `sweeps.ts:129`). The per-area agents only read the demo front-ends and missed the server consumers — so the "~30 dead toggles" count is inflated; **verify each has no server consumer before wiring.**
- **Still genuinely dead but low-value/backend:** #68 staff requireDBS/requireCompliance (rostering is the localStorage demo — nothing real to gate), #72 safeguarding.dslEmail (needs backend notify routing — Amir).

---


Live testing via Claude-in-Chrome, one portal at a time. Each finding: severity · page · what's wrong · repro.

## Freelancer / operator portal (`amircoaching@gmail.com`, tenant VOiiaTnDNd03MLbZaVcM)

| # | Sev | Page | Finding | Repro / notes |
|---|-----|------|---------|---------------|
| F1 | med **✅FIXED** | /freelancer/bookings | React **duplicate key** — used `key={b.ref}` (refs repeat). | **FIXED:** both list keys → `key={b.bid}` (unique doc id) in `BookingsList.tsx`. Verified: no key errors in console. |
| F2 | low | /freelancer/listings | Next.js dev exception: `Failed to execute 'measure'… 'ViewPage' cannot have a negative time stamp` (×2). Dev-tooling perf artifact, not user-facing. Odd zero-width char in "ViewPage" label. | Only on listings so far; dev mode only. |
| — | ok | /freelancer/{dash,customers,registers,ratios,setup} | Load clean, no console errors. | |
| — | ok | /freelancer/dashboard | Not a bug: correct slug is `dash`; typing `dashboard` gives a raw 404 (minor UX — no friendly redirect). | |
| **F3** | **HIGH ✅FIXED** | ALL operator pages | **PortalGuard re-fetched `/api/me` and BLOCKED render on every navigation, uncached** → "Checking access…" blank spinner for seconds on every page load. | **FIXED:** session cache of `Me` in `PortalGuard.tsx` (fetch once, synchronous cache-hit = no spinner on revisits) + invalidation in `AuthProvider` when the signed-in uid changes. Verified live: expenses/invoices/reconciliation now render instantly at 0.6s. Benefits every portal. |
| F4 | med **✅FIXED** | /freelancer/meals | Operators flashed *"Menus are managed by your provider's admins"* because `canManage` defaulted to `false` during an async `/api/me` fetch. | **FIXED:** `MealsApp` now starts in a loading state (no wrong message) and uses the shared `getMe()` cache → planner renders instantly. Verified live. |
| F5 | low **✅FIXED** | Sidebar (any page) | Brand flashed **"ActivityOS"** before the tenant name loaded (async `/api/me`, `brand` defaulted null → "ActivityOS"). | **FIXED:** Sidebar now reads the shared `getMe()` cache → tenant name resolves instantly, no flash. |
| — | ok | /freelancer/{newsfeed,email,holiday,timesheets,tasks,reviews,blocks(after load),finance(shell)} | Load fine. | finance shows "Loading your figures…" then data. |
| — | ok | /freelancer/{messages,calendar,timetable,marketing,referrals,purchasing,inventory,ai} | Swept — all load fine (timetable/marketing/purchasing show normal data "Loading…"). No new bugs. | |
| — | note | i18n | Shell renders in Romanian (account language = RO) but page bodies are English — expected: only shell + a few areas are translated so far (parent/team catalogs English-only pending re-translate). Not a defect. | |

## Parent / custdash portal (`amirthedad@gmail.com`)
| # | Sev | Page | Finding | Repro / notes |
|---|-----|------|---------|---------------|
| — | ok | /custdash/{browse,children,bookings,memberships,wallet,account,medication} | All load. Content data "Loading…" is normal. memberships' first "Checking access…" was the cold `/api/me` fetch (account just switched → cache cleared, as designed) — instant on re-hit. | |
| P1 | med | Sidebar (parent) | Brand shows **"ActivityOS"** instead of the provider name "Amir Coaching" (top tab resolves it correctly). Sidebar's parent path (`/api/my/providers`[0].name) not resolving. | components/shell/Sidebar.tsx:214 — check whether /api/my/providers returns the linked provider for this parent (could be data: parent not linked) vs a different name source than the top bar. |
| P2 | low | Sidebar (parent) | "MY CHILDREN" group header flips to **"MY CHILD"** across pages — pluralization changes with async child count (flicker/inconsistent). | nav label pluralization; pin to a stable count or default plural. |
| — | ok | /custdash/{coupons,refer} | Load fine. | |
| P3 | med | ROOT PERF | **`/api/me` is slow** (esp. this parent) — the F3 cache reduces it to one fetch/session but the first cold fetch still stalls with "Checking access…" (seen intermittently on parent meals/timetable). Real fix is server-side: speed up `/api/me`, and/or PortalGuard could render optimistically for operator portals. | server/src/routes for /api/me — likely doing sequential Firestore reads. Backend (Amir) candidate. |
| — | ok | A1 RESOLVED | `amirthedad@gmail.com` now signs in fine (earlier failure was a bad password, not a bug). Account switch also confirmed the `getMe` cache invalidation works cleanly. | |

## Company portal (`kazjames80@gmail.com`, SPORTS DIRECT COMPANY)
| # | Sev | Page | Finding | Repro / notes |
|---|-----|------|---------|---------------|
| CO-1 | med **✅FIXED** | Header (all pages) | Top-bar username **flipped per page** ("Kaz Preston" on some, "Kaz James" on others) — the Header did its own uncached `/api/me` and fell back to the Firebase `displayName` while it loaded. | **FIXED:** Header now reads the shared `getMe()` cache (+ added `name` to the `Me` type). Verified: consistent "Kaz Preston" across dashboard/payroll. `components/shell/Header.tsx`, `lib/roles.ts`. |
| — | ok | /company/{dashboard,bookings,staff,payroll,admin-registers,credentials,ho-framework,subscription,holiday,documents} | All load & work (rich data — 4 locations, payroll estimates w/ disclaimer, staff certs matrix, HO milestones roadmap, subscription plans, 10 policy docs). Several sat on "Checking access…" 4-6s = **P3 slow /api/me** (worsened by my Header/roles HMR clearing the cache); loads fine once warm. Shared views (listings/money/marketing/etc.) already covered in the freelancer sweep. | **Company sweep complete.** |

## Franchise portal (`franchisetest@gmail.com`, franchise role on SPORTS DIRECT COMPANY tenant `x4goY84cslX4mBV4LNtG`)
Provisioned for QA: signed-up account promoted via `npm run set-role -- franchisetest@gmail.com franchise x4goY84cslX4mBV4LNtG` (uid `TyxJKJ5UpAMtJqXzLAnbLWp7nIB3`).

| # | Sev | Page | Finding | Repro / notes |
|---|-----|------|---------|---------------|
| **FR1** | **HIGH ✅FIXED** | /franchise/schedule (all portals) | **Full-page crash** — `Runtime TypeError: Cannot read properties of undefined (reading 'toFixed')` at `ScheduleApp.tsx:600` (`st.rate.toFixed(2)`). The `Staff` type declares `rate: number`, but staff loaded from localStorage (`aos.rota.v5`) can lack a numeric `rate` (pre-dates the field / partial data) → the whole Schedule view white-screened. Affects every operator portal (shared component), not just franchise. | **FIXED:** (1) `load()` now normalises every staff's `rate` to a finite number (0 fallback) — kills the crash **and** the downstream NaN wage maths in one place; (2) defensive `(st.rate ?? 0).toFixed(2)` at all 4 render sites. Client tsc 0. Verified live: Schedule renders (payroll forecast £1356 / £1519.67, rota grid, 12 shifts). |
| — | ok | /franchise/{dash,compliance,privacy,registers,bookings,staff,finance,setup,messages,listings,schedule} | **All load & work** — franchise portal is the full operator portal (shared components) under the `franchise` role/path, resolving the SPORTS DIRECT COMPANY tenant's rich data (locations, sessions, listings, 7 message threads, feature rail). Franchise-distinctive views clean: dash (live KPIs/on-site-now), compliance (empty-state "No certificates tracked yet"), privacy (data/download/delete), registers (roster + roll call). Messages carries the company "Needs reply/New" tab fix (shared). **No console errors.** | **Franchise sweep complete.** |
| — | note | Data scope | Franchise (`franchiseId` = own uid) sees the **whole tenant's** data here, not an isolated per-franchisee scope. Fine for this QA (rich data to render); flag for later if true per-franchisee isolation is intended. | Backend data-scoping question for Amir, not a UI bug. |
| — | note | P3 (known) | Every **hard reload** shows "Checking access…" for 2–4s = the known slow cold `/api/me` (P3). A testing artifact of `navigate()` full-reloads resetting the `getMe()` module cache; real SPA sidebar-nav keeps the cache warm. Not a franchise regression. | Same root cause as freelancer F3 / company. Backend (Amir). |

Remaining franchise views (payroll, holiday, timesheets, marketing, referrals, reviews, expenses, purchasing, reconciliation, subscription, ai, tasks, calendar, timetable, schedule, ratios, trips, incidents, medication, accidents, meals, moments, newsfeed, email, account, support) are the **same shared operator components** already verified in the freelancer + company sweeps — not re-tested individually.

## Auth / cross-cutting
| # | Sev | Area | Finding | Repro / notes |
|---|-----|------|---------|---------------|
| A1 | high? | Login | `amirthedad@gmail.com` sign-in fails ("check your email and password"). | Either wrong pw or account missing / auth bug. Investigate: does the account exist in the DB? |
| A2 | info | Dev CORS | Widened dev CORS to allow localhost/127.0.0.1/*.localhost (server/src/index.ts) to try multi-origin logins — moot (Firebase API key is referrer-restricted to localhost:3000). Harmless, can revert. |
