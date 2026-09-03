# ActivityOS — Master QA Test Plan

> Synthesized from 10 area maps. This is the single source of truth for the human tester and the follow-up agent fleet. Read Section 1 first — the codebase geography and the "settings do nothing" traps change how almost every test below must be interpreted.

---

## 1. Overview & How To Test

### 1.1 The two repositories (read this first)

There are **two sibling working trees** with nearly identical names. Getting this wrong invalidates results.

| Path | Status | Use for |
|---|---|---|
| `/Users/kazjames/Downloads/activtyos-app-` (note the typo + trailing dash) | **The real tree.** All React `features/*` folders, `lib/settings.ts`, full parent/staff/operator/platform slices. | **All Next.js React testing.** |
| `/Users/kazjames/Downloads/activityos-app` (correct spelling) | **Stale strangler shell.** Only `features/bookings` + `features/timetable` migrated; most `features/*` and `lib/settings.ts` do NOT exist here. | Legacy prototype serving only. |

The map for **Money & finance** was written against the stale shell and correctly reports "lib/settings.ts does not exist / money features unmigrated." The other nine maps were written against the real tree where `lib/settings.ts` and the React features **do** exist. Both are true — of different trees. **Test money/finance against the legacy prototype; test everything else against `activtyos-app-`.**

### 1.2 Three architectural realities that gate every test

1. **Money & finance is 100% legacy + client-side demo.** All of it lives in the 7.6MB single-file `public/legacy/prototype.html` (17,666 lines), served via `app/legacy`. No backend, no persistence, resets on reload. `features/money`, `features/reconciliation`, `features/payments`, `features/payroll`, `features/dashboard`, `server/src/routes` do **not** exist as React.

2. **Feature gating is nav-only, never route-enforced.** `app/[portal]/[view]/page.tsx` renders any registered view with **no** feature-flag or role check. Turning a feature "off" only hides the Sidebar item — the page is still reachable by direct URL. This is a cross-cutting security note that applies to **every** page in the plan.

3. **Large swaths of "settings" are write-only or dead.** In legacy, `window.SETUPFLAGS` is never read by anything. In the React tree, many `TenantSettings` keys are defined + editable in Setup but never consumed at runtime. Section 3 is the authoritative list — it is the highest-value part of this plan.

### 1.3 Test-type legend

Every scenario is tagged:

- **[LIVE]** — needs a logged-in session against a running app + backend (Firebase auth + `/api/*`). Most portal flows.
- **[LIVE-LEGACY]** — needs the legacy prototype loaded via `app/legacy` in a browser; pure client-side, no backend, resets on reload.
- **[CODE]** — verifiable by reading source / assertions / grep, no running app needed (e.g. "slug X has a registry entry", "setting Y has no consumer").
- **[MIXED]** — behaviour spans a live UI action plus a code-level check of whether it actually persists/fires.

### 1.4 Auth & login preconditions

Most portals require a live logged-in session. Known demo identities and tenants:

- Freelancer operator dashboard under review: tenant `VOiiaTnDNd03MLbZaVcM` (seed via `serviceAccountKey` + firebase-admin; **not** apf-demo).
- Company: `kazjames80@gmail.co.uk` on the **SPORTS DIRECT COMPANY** tenant (`seedCompanyDemo.ts`).
- Two `kazjames80` accounts (.com vs .co.uk) live on **different tenants** — do not assume they share data.
- `regdemo` seed is date-stamped → the register looks wiped every next day; re-run `seedRegisterDemo` / `seedCompanyDemo`.
- **Staff & learning slice is hardcoded to identity `Marcus Bell`** (`ME`, `ME_ROLE='Camp Lead'/'Lead'`). Every staff user sees Marcus's data — multi-staff testing is impossible without code edits. Flag, do not retest per-user.

### 1.5 Login role-routing (`fetchRoleHome`)

`platform→/platform/providers`, `company→/company/bookings`, `franchise→/franchise/bookings`, `freelancer→/freelancer/bookings`, `staff→/staff/dash`, `parent→/custdash/browse`. Note: bare `/company` → `/company/dashboard` (middleware) but login lands on `/company/bookings` — two different "homes."

---

## 2. Per-Area Test Scenarios

### AREA A — Money & finance  [ALL LIVE-LEGACY unless noted]

> Reminder: nothing persists; all figures are hardcoded demo constants; **no** Setup toggle gates any money view.

**A1. Finance & Analytics hub** (`data-view=finance`; `renderFinance()` L7687)
1. Open Finance; switch period segment Quarter / YTD / Full year / Last 12mo; confirm revenue/bookings/fees/net KPIs + chart recompute.
2. Toggle Compare-to-last-year; confirm dashed comparison series appears/disappears.
3. Switch metric gross↔net; confirm series rescales (net = gross×0.94).
4. Franchise: change venue in operator switcher; confirm KPIs + HO split bar rescale.
5. Franchise: select venue = "all"; **confirm it silently forces to 'Milton Keynes' (L7689)** — an "all venues" total that does not aggregate all venues. [MIXED]
6. Admin: HO operator switcher — view Head Office vs a specific franchise; confirm `SPLIT.hoBar()`/flowCards render.
7. Click Finance↔Analytics `faTab` bar; confirm the correct `.view` toggles on.
8. Freelancer: confirm revenue×0.18 scaling produces no NaN/blank chart on empty periods.
9. [CODE] Confirm `renderFinance('admin')` targets non-existent `faMount_admin_finance` and no-ops; admin "finance" is the separate HO cockpit.
10. [CODE] Confirm argument-less `renderFinance()` calls resolve to `faMount_undefined_finance` (null) and are dead no-ops.
11. Confirm franchise/freelancer finance carry a "Phase 2" badge yet still render full demo charts.

**A2. Payouts** (declared in `SBMAP.admin`)
12. [CODE] Click "Payouts" in admin Money nav → **confirm it is unreachable**: `payouts` appears only in `SBMAP.admin` + one CSS selector, with no `nav`/`view` container. Dead nav reference.

**A3. Reconciliation** (`admin/fr/freelancer-reconciliation`; `recRender()` L8710)
13. Manual row: expand not-paid → set method (`recMethod`), enter childcare ref (`recCcref`), add note, click "Email parent — payment not received", mark reconciled → row shows "Reconciled ✓ · parent notified".
14. [MIXED] Confirm the chase email is fake: `recEmail()` only pushes a timestamp + toast; no email sent, "parent notified" is false.
15. TFC/auto row: confirm 3-step read-only flow (Account linked → Payment instructed → Cleared) with "No action needed".
16. Filters: Booked-from/to, Sort, Type (all/TFC/manual), Status; confirm KPI tiles recompute.
17. Search box: confirm focus retained after re-render (`REC._sfocus`).
18. Empty filter combo → "No bookings match…" (L8739).
19. Chase email log increments "N chase emails · last <ts>".
20. [MIXED] Turn TFC toggle OFF in Setup → confirm TFC auto rows **still render** (toggle not read).

**A4. Expenses** (`renderExp`/`EXP` L9389; staff `renderStaffExp` L9499)
21. Operator add: amount + description + category + method + flags → Save; confirm empty/≤0 amount + empty description rejected via `alert()`.
22. Edit (`EXP.edit`) / delete (`EXP.del`) → KPIs (total, reimburse owed) recompute.
23. Filters: range (month/last/quarter/year/all), category, staff, free-text row search.
24. Staff submit: date/amount/category/receipt/desc/reimburse → "Submit for approval" → status "submitted".
25. Manager approval queue: Approve / Reject-with-reason (required) / Archive / Restore; staff sees status + rejection reason.
26. [MIXED] Attach a receipt → confirm only a filename chip is kept; "View receipt" cannot show the file.
27. [MIXED] Set recurring flag → confirm it does **not** spawn future entries.
28. Empty states: no expenses in range; staff "No expenses submitted yet".

**A5. Purchasing & invoices** (`PURCH` L11760)
29. Invoices (AR): statuses draft/sent/overdue/part/paid, VAT 0/20%, due dates; "Send" + "Record payment" actions; part-payment tracking.
30. Bills (AP): statuses awaiting/approved/overdue/paid; approve then pay.
31. Create invoice/bill with line items (qty×unit), VAT, note; confirm net()/gross().
32. Switch AR↔AP tab + status filters.
33. [MIXED] Confirm "Send"/"Record payment" are no-ops AND **`TODAY` is pinned to `new Date(2026,5,15)` (L11770)** → all "days overdue" are frozen and wrong vs real clock (2026-09-02).

**A6. Split fees** (admin/HO only; `SPLIT` L13202)
34. Set each franchise's HO split % (`splitSetPct`, 0–100 clamp) → flow cards / owed figures update.
35. Toggle scope Yes/No (all income vs bookings only, `splitSetScope`).
36. Confirm HO switcher chip reflects selected franchise's split on Finance.
37. Edge: % = 0/100/invalid text → NaN guarded to 0; company-owned franchise (`own:true`) excluded from split list.
38. [CODE] Confirm page note admits **parent memberships are NOT in the split yet**; no empty-state for zero franchises.

**A7. Payroll** (`renderPayroll` L16327; franchise + orphaned admin)
39. Tabs: Timesheets / Run payroll / Employee records / Connect to Sage / Expenses / Reports.
40. Run payroll → estimated PAYE/NI/pension deductions (`recompute` L16400); `seedPayroll` demo employees.
41. Employee records: add/edit (`recordForm` L16594).
42. Confirm "Connect to Sage" (+ QuickBooks/Xero) are stubs, not OAuth.
43. Confirm Expenses subtab = single hardcoded row (24 May/Equipment/£42.00); Reports = static cards.
44. [CODE] Confirm the unprefixed `payroll` view sits in the admin DOM block but is **absent from `SBMAP.admin`** → orphan, unreachable from admin nav.

**A8. Customer Wallet** (`custdash-wallet`, `cdWalTop`)
45. View balance (£15 seed) + activity log.
46. **[HIGH] Top up +£10/+£25/+£50 → confirm balance increments with NO payment step / card / confirmation** — grants free credit; must route to Stripe in prod.
47. Reload → balance resets (in-memory only).

**A9. Customer Payments** (`rPayments()` L3065)
48. View outstanding due + payment history; open a payment → receipt (`cxReceiptHTML`).
49. Pay an unpaid booking → confirm whether it routes to checkout or is a no-op.
50. [CODE] Confirm "Amount due" regex-strips `b.pay` (`replace(/[^0-9.]/g,'')`) → fragile for "£1,200" / multi-dot / currency-word values.

**A10. Customer Memberships / Coupons / Subscription / Platform Billing**
51. Memberships: 3 tier cards; `cdMemChoose` → **confirm clicking only highlights, no subscribe/checkout action.**
52. Coupons: enter SUMMER10/REFER5 → held for checkout; invalid → error. [CODE] Confirm valid codes are a hardcoded client map (bypassable).
53. Subscription (freelancer/franchise): confirm `#subsMount_<portal>` actually populates (empty-mount risk); confirm change/upgrade is a stub.
54. Platform billing (Phase 2): switch Revenue/Subscriptions/Invoices tabs; confirm static hardcoded panels.

---

### AREA B — Listings & storefront

**B1. Listings list/manager** (`data-view=listings`)  [LIVE-LEGACY]
1. Open Listings; see counts (14 active/3 draft/28 archived); Edit → builder; View live → storefront.
2. Tab Listings↔Categories (`ltSwitch`); subtabs Published/Unpublished/Export/Templates (`lsTab`).
3. Filter text (`lsSearch`) + visibility chips All/Public/Hidden/Private (`lsVis`).
4. New listing (`admin-listing-build`); "From template" opens Templates.
5. Empty state per subtab; zero-match filter → message not blank grid.
6. Draft card "View live" on an unpublished listing → confirm no 404 / no public draft leak.
7. [CODE] Confirm counts/cards are hardcoded static markup; no CRUD wiring.
8. [CODE] Confirm operator list (`LBSET.savedCards`) and storefront (`CX.listings`) are **independent seed sources** → publish/hide does not gate customer Browse.
9. Export panel (steps 1–5 → Download): confirm the Download button produces a file or is a stub.

**B2. Listing builder wizard** (`admin-listing-build`, `LB` module)  [LIVE-LEGACY]
10. Full path Basics→…→Policy & publish → Publish.
11. Step 5 "When it runs": set from/to + weekdays; `genBlocks()` weekly blocks; hide/show day cells; `activeCount` updates.
12. Step 6 Tickets: flat vs per-day, whole-week vs flexible, free/funded, capacity, waiting list; presets; pro-rata (`applyProRata`); age badges.
13. `lbNext/lbPrev/lbGo` nav; save/start from template; save pass "as card".
14. Preview step 7 (`lbLive`).
15. Edge: ageMin>ageMax; capacity 0; price 0 → "Free"/"Funded".
16. **[HIGH] Publish is a dead-end**: `lbPublish()` only sets `step=length+1` and re-renders review; no persistence, no API, nothing pushed to list or `CX`. "Go live" doesn't.
17. **Copy/count mismatch**: header says "8-step" but `STEPS` has 10.
18. **`genBlocks()` hard-caps at 12 blocks** → listing spanning >12 weeks silently truncated, later sessions never generate/price/book, no warning.
19. No required-field validation before Publish (empty name/venue/dates reach review).

**B3. Categories manager** (`freelancer-categories`)  [LIVE-LEGACY]
20. Add/rename/remove category → appears in builder picker + Browse chips.
21. Edge: duplicate name; delete a category still used by a live listing → [CODE] confirm Browse builds chips from `CX.listings[].cat` so an orphaned category can appear customer-side while gone from master.

**B4. Blocks builder** (`admin-blocks`)  [LIVE-LEGACY]
22. Date range + weekdays → weekly blocks; toggle cells; single-day; month-boundary; all-hidden → activeCount 0.
23. [CODE] Confirm `admin-blocks` nav resolves only to a sidebar entry; verify it isn't a blank/dead view separate from the builder step.

**B5. Live preview / CustomerPage** (`admin-listing-preview`, `lbLive`)  [LIVE-LEGACY]
24. Hero (size/colour/image, moveable text), pass cards, calendar; "Back to builder".
25. Preview with no passes / no dates / missing hero image → placeholder handling.
26. [CODE] Slug URL `/l/summer-camp-2027` is illustrative; no `app/store`/`app/book` route serves it.

**B6. Provider public site** (`data-portal=psite`)  [LIVE-LEGACY]
27. View marketing site; kiosk CSS (`body.kiosk`) renders standalone.
28. **[MEDIUM] "Open in new tab" points at `app.activityos.co.uk/staff`** — wrong URL for a public storefront (copy/href bug).
29. [HIGH/CODE] No `app/store/[tenantId]` route exists; no real tenant-scoped storefront.

**B7. Customer Browse** (`custdash-browse`, `rBrowse`)  [LIVE-LEGACY]
30. Filter by category/age/venue/price band/funded-only; open listing (`goListing`); follow/unfollow provider.
31. Filters → zero results → confirm empty-state not blank list.
32. Age filter parsing where age string has no digits (`ageMM` → [0,18] fallback).
33. **[MEDIUM] Phase-1/Phase-2 leak**: `rBrowse` always renders the multi-provider "Providers/+Follow" strip and derives categories/venues across all `CX.listings`, but Phase-1 must be single-provider.

**B8. Customer listing detail** (`custdash-listing`, `goListing`)  [LIVE-LEGACY]
34. Open from Browse → pick pass/dates → add to basket / Book.
35. Deep-link/refresh (SPA only) with `CX.listings[0]` undefined → no crash.
36. **[MEDIUM] `goListing()` hardcodes `l=CX.listings[0]`** in basket init → every "Book from basket" may resolve to the first listing regardless of the card clicked.

**B9. Booking widget / checkout** (`custdash-book`, `rBook`)  [LIVE-LEGACY]
37. From basket: children (`CX.fChild`, keeps ≥1) → add-ons → review & pay (Card/TFC or HAF-only) → confirmation with ref + status.
38. Approval-required listing → "Approval needed / Request sent"; TFC → "Unpaid".
39. Processing fee when `RP.feeMode='customer'`.
40. Empty: no `CX._flow` → "Pick an activity to get started".
41. HAF/funded → methods=['HAF'], price "Funded", total 0.
42. **[HIGH] Multi-child pricing bug**: `flowTotal()` non-basket branch returns single pass price with **no ×kids multiplier**, while the review step says "prices per child" — direct-book undercharges for extra children.
43. **[HIGH] Payment methods hardcoded** (`['Card','TFC']` / `['HAF']`), ignore Setup toggles → TFC shows even when off / for providers without it; PayPal/Card toggles never surface.
44. **[HIGH] No coupon/discount entry anywhere in checkout** despite the Setup toggle and completed tasks — parents cannot redeem a code.
45. **[MEDIUM] No child/booking questions step** — `QB.questions` never surfaced in `rBook`.
46. **[MEDIUM] Direct-book entry appears dead**: only the fromBasket flow initializer exists; step-1 "Choose a pass" UI creates no flow.
47. TFC/HAF are stubs (free-text ref, no reconciliation/validation).

**B10. Setup & features (legacy)** (`admin-setup`; `SETUPFLAGS`)  [MIXED]
48. Toggle a feature On↔Off → badge flips, row dims, value persists to `SETUPFLAGS[label]`.
49. Edit `LBFEAT` lists (categories/sections/outcomes/provided/safety) → reflected in builder.
50. **[HIGH] `SETUPFLAGS` is WRITE-ONLY** — the only reference is the assignment; nothing reads it. Every legacy Setup toggle is cosmetic despite the on-screen "server re-checks the flag" claim.
51. [CODE] `SETUPFLAGS` keyed by visible label text → i18n/reword silently orphans stored flags.
52. [CODE] Real gating (`LBFEAT.meta.on`, `LBSET.showAge`, `RP.feeMode`, `l.approval`, `l.funded`) lives in **separate** globals disconnected from the Setup screen.

**B11. Saved ticket cards / Locations**  [LIVE-LEGACY]
53. Save pass as card → reuse; empty "No saved tickets yet"; seed guard `LBSET._stSeed`.
54. Locations: builder picks venue; `qbLoc` mapping. [CODE] Confirm `admin-locations` isn't just a sidebar entry with a hardcoded `qbLoc` map duplicated from a real source.

---

### AREA C — Bookings & ops (Next.js React)  [ALL LIVE unless noted]

> Only Admin Bookings (`features/bookings`) + Activity Timetable (`features/timetable`) are real React. Registers/Ratios/Schedule are legacy. Neither React feature reads any tenant setting. In-memory Zustand only → **reload discards all state.**

**C1. Admin Bookings list** (`features/bookings/BookingsList.tsx`; admin portal only)
1. Load → 11 seed rows; click row → BookingDetail opens.
2. Filter chips All/Approval needed/Confirmed/Waitlisted/Unpaid+invoiced/Cancelled/Refunds; confirm badge counts match `matchesFilter` (cancelled includes Declined; refunds includes `cancel.refund`).
3. Search booker/child/ref/bid/email/listing; combine with active filter (AND); whitespace-only search → all rows.
4. Single shared empty state for both "no bookings" and "no results".
5. Bulk select (checkbox `stopPropagation`) → Approve→Confirmed / Waitlist→Waitlisted / Cancel→Cancelled; **Email/Export fire `alert()` only after 40ms, export nothing.**
6. Checkbox click must NOT open detail; row-body click does.
7. Take booking (＋) opens modal; header ⬇ Export is `alert()` stub.
8. Compact left-rail mode when a booking is open; selected-row highlight.
9. Amount 0 (HAF) → £0.00.
10. **[HIGH] Refund-request dead-end**: `cancel.refund==='pending'` renders a "Refund pending" badge but **no UI approves/declines it**; `store.act(ref,'refund-approve'|'refund-decline')` exists but is never called.
11. **[MEDIUM] Cross-portal divergence**: `mountBookings` only carves the **admin** portal; franchise/freelancer bookings run the legacy `pbRender` path → test bulk/cancel/refund separately there. Staff has no bookings view.
12. [CODE] No persistence — reload reverts every created booking/cancel/refund/note.
13. [CODE] No season filter present despite MEMORY/task #48 claim.

**C2. Booking detail / cancellation & refunds** (`BookingDetail.tsx`)
14. Multi-kid booking (APF-10293) → AttendeeCards, per-day Change/Cancel.
15. Approve/Decline (Approval needed only); Waitlist promote (Waitlisted); Mark paid / Resend invoice (Invoice sent/Unpaid — resend is `alert()`).
16. Cancel future booking → CancelPanel Full/Partial/No-refund; Issue refund on past booking (`refundOnly`).
17. Partial refund → number input prefilled to amount/2.
18. Per-child cancel → whole child cancelled + refundLog; per-day cancel → struck-through date + per-day refund; per-day change → move to `altDates`.
19. TFC recon toggle (Yes/No); HAF evidence badge (read-only).
20. Notes onBlur/Save; "Change date"/"Message" → `alert()` stubs.
21. **[HIGH] Double-refund math**: a child partly day-refunded then whole-place cancelled adds a fresh "whole place" `refundLog` entry without subtracting prior per-day refunds → `refundedTotal` can exceed the child's share of `b.amount`.
22. **[MEDIUM] Unvalidated partial-refund input**: accepts values > booking total or negative; `doCancel` uses it verbatim, no clamp.
23. **[MEDIUM]** No way to change HAF evidence "Awaiting"→"Received" (APF-10302 stuck forever).
24. [LOW] Partial refund equal to full still labels pay "Partially refunded" not "Refunded".

**C3. Take a booking modal** (`TakeBookingModal.tsx`)
25. Backdrop/×/Cancel dismiss (also `close()` nulls openRef — **side effect closes any open detail**).
26. Happy: booker name (required) + fields → "Send payment link" → new Confirmed booking, filter resets to all.
27. Empty booker → alert, no creation; non-numeric age/amount → 0 fallback; multiple creates → `nextBid` increments.
28. **[MEDIUM] `createBooking` always sets status "Confirmed"** regardless of method (even unpaid/approval cases); no date/overlap/capacity checks.
29. [CODE] Listings/passes/blocks/methods are hardcoded arrays, not from settings/listings; free "Amount" field can disagree with chosen pass price.

**C4. Timetable Setup wizard** (`SetupWizard.tsx`) — shared store across admin+franchise+freelancer hosts
30. Step 1 Dates: pick listing (pulls from `data.ts LISTINGS`) or edit From/To; DayCalendar include/exclude.
31. Steps 2–6: day times/breaks/lunch, arrivals chips, facilities + custom space, groups (name+age band), categories in rotation, Activity bank.
32. Step 7 Build: Automatic vs Manual → `generate(mode)` → grid tab.
33. Pill jump-nav; To<From or empty dates → "Pick a date range above."
34. **[MEDIUM] Inconsistent auto-regen**: `setField/toggleDate/addWhole/delWhole` call `regenIfAuto()` but `toggleCat/toggleFac/addGroup/delGroup/toggleAct*/addAct/delAct` do NOT → auto grid goes stale until manual Rebuild.
35. **[MEDIUM] Partial persistence**: only the activity-category bank persists (`localStorage aos_ttb_cats_v3`); dates/groups/facilities/times/plan lost on reload.
36. [LOW] `toggleFac` three-valued logic (`undefined/true/false`) is easy to mis-test.

**C5. Timetable grid** (`TimetableGrid.tsx`)
37. Auto-fill → Day view drag-swap; Manual → click cell → CellEditor; drag from Activity bank onto cell.
38. Day selector; Rebuild (`seed++`) reshuffles; Week view; Month view chips (excludes Free Play) → click day → Day view.
39. Legend shows facilities `facOn[f]!==false`; Download PDF; Publish → tab 2.
40. No plan → "No days yet." / "No dates yet…".
41. **[MEDIUM] Shared store across all three portal hosts** (`ttbHost_admin/_fr/_fl`) → HO, franchise, freelancer see the *same* timetable data; edits in one appear in another.
42. [LOW] "Phase 2" pill; verify drag-vs-click don't conflict on touch; stale `edit` ref after Rebuild indexing risk in `dropOnCell` swap branch.

**C6. Timetable publish** (`PublishPanel.tsx`)
43. Toggle Staff/Parents audiences; parent audience radio (Booked-only vs Everyone); Publish → `pubStatus` summary; no-audience → "Pick at least one audience."
44. **[HIGH] Publish is a pure mock**: `publish()` only builds a string; nothing persisted, no staff/parent portal receives it, no backend, **no notify toggles** despite task #50 marked complete. Any end-to-end "parent sees published timetable" test fails.

**C7. Activity library** (`ActivityLibrary.tsx`)
45. Per-category enable/place/whole-camp/exclude-groups/add/delete; persists to `aos_ttb_cats_v3`; drag onto grid.
46. **[LOW] `toggleActGroup` stores group INDICES not ids** and persists while `groupsList` does not → re-adding groups in a different order silently mis-excludes on next session.

**C8–C10. LEGACY Registers / Ratios / Schedule**  [LIVE-LEGACY, manual QA only]
47. **[HIGH] Registers unmigrated** + Register v2 (toilet-training question + "On-site now" card) sits **uncommitted** in a legacy tree → out-of-scope for React harness; exercise only via `LegacyPrototype` injection. `secRegister` (L8240) pulls kids + allergy/diet for a listing+week — verify allergy shown to staff.
48. Phase-2 register backlog (group/room allocation, offline mode, collection PIN, register messaging, incident deep-link) **unbuilt** — any assertion dead-ends.
49. **[MEDIUM] Ratios read-only** (markers ~L10247/12034/14527); company staff-to-group assignment gated by a role setting that doesn't exist in code; freelancer edits inline → cross-portal inconsistency, manual verify only.
50. **[HIGH] Schedule/rota split-brain**: availability requests hit a **real** `/api/availability` (kazj181 seeded on SPORTS DIRECT COMPANY) but the rota grid is pure client-side `window.ROTA` (L15483) → "my availability saved but the rota still shows me off" is a prime bug class. Parent `custdash-schedule` (`rSchedule` L3018) + staff-schedule read the same legacy globals; noop guards (`rSchedule_` L3345) suggest half-wired paths.

---

### AREA D — Parent / customer portal (custdash)  [ALL LIVE unless noted]

**D1. Browse** (`BrowseApp.tsx`)
1. Land → listings from `/api/listings`, providers from `/api/my/providers`, scope to own; More info → `/book/{id}`; Quick book → modal.
2. All filters (search/category/location/season/age/my-kids-ages/max price/length/when/on-date/places-left/sort); Clear all; fold state persists (`aos.browse.filters`).
3. Distance: `/api/me` postcode → `/api/geo/search`; radius dropdown only when located; per-listing venue geocoded from address; nearest-first default.
4. Empty states: provider has no listings; filters match nothing (two distinct messages).
5. **[MEDIUM] New-family dead-end**: `visible = listings.filter(providerIds.has(tenantId))` with no show-everything fallback → a freshly-invited parent whose provider link hasn't resolved sees empty state, not the catalogue.
6. [LOW] One `/api/geo/search` per un-geocoded venue on every load (no cross-mount cache).
7. [LOW] Length filter mis-buckets listings with no session times (4h default).

**D2. Quick Book modal** (`QuickBookModal.tsx`)
8. Open → `/api/listings/{id}` → CustomerPage bookingOnly; Esc/× closes; load fail → error, no retry; booking completes inside modal (no auto-close/refresh of grid).

**D3. Book / checkout** (`checkout.tsx` + `ListingWizard.tsx` + `BookPage.tsx`)
9. Signed-in happy path: pass → dates → children per pass/day → extras → meals → pay stage (phone required, method, discount code, wallet) → "Confirm & pay £X" → `POST /api/my/bookings` (one call per block) → success with refs.
10. Discount codes: type or one-tap coupon; `/api/discounts/validate`; stacking unless exclusive; referral `?ref=` auto-applies; membership % auto; order automatic→code→wallet.
11. Wallet: `/api/my/wallet`; auto-apply-all default, dial back; amountDue recomputes.
12. Voucher/TFC: pick scheme, per-child ref (required), "awaiting voucher payment".
13. Waitlist (full + waitlist on); `opensAt` future → locked; age gate (`allowOutOfRange` → approval request); manual-approval → "Request received".
14. Empty basket disables checkout; short pass / unassigned day / same-child same-time clash → blocked with explanation.
15. Block closed mid-flow → "Those dates aren't open…"; POST failure surfaced.
16. **[HIGH] "Confirm & pay £X" takes NO card details anywhere** — just POSTs; Stripe unbuilt; booking lands unpaid, settled later via PayModal.
17. **[MEDIUM] No sign-in gate on public `/book/[id]`** → signed-out visitor reaches pay button → Confirm → 401 surfaced as raw booking error, not a sign-in prompt.
18. **[MEDIUM] Wallet is dead** — `/api/my/wallet` not built → balance always 0.
19. **[LOW] Multi-block partial-booking risk**: codes/wallet ride only the first POST; if a later block POST fails, family left with partial booking + consumed codes.

**D4. My bookings** (`MyBookingsApp.tsx`)
20. Load `/api/my/bookings`; filters (child pill/activity/date); tabs all/upcoming/past/cancelled; deep-links `?pay/?amend/?cancel/?open`.
21. Pay → PayModal; Amend (per-date move, week-rule, timing change, multi-child); Cancel (whole vs choose-days, entitlement from policy, refund dest, reason); Waitlist leave; Offer accept/decline.
22. Clash warning (same child same day across bookings); empty + no-match states.
23. **[HIGH] `DATE_CHANGES_LIVE` hardcoded true but amend endpoint isn't live** → on 404 it writes optimistic `aos.pendingMove.{ref}` to localStorage and shows "pending" forever, per-device, never resolves.
24. **[MEDIUM] CancelRequest change-date resolution** swallows amend 404s the same way → appears to succeed, nothing queued server-side.
25. [LOW] Pending-move reconstructed from localStorage (per-device); withdraw clears only local marker.
26. [LOW] Amend `moneyBack` hardcoded false → refund-destination question never appears even when `amendAllowCheaper` on.

**D5. My timetable** (`MyTimetableApp.tsx`)
27. `/api/my/bookings` grouped by date + listing detail for venue/staff; child pills; Today badge; empty/error.
28. [LOW] Two "timetable" surfaces (BookingsHub Schedule tab vs `custdash/timetable` ParentTimetableApp) — only the latter gated by `customerArea.timetable`; confirm no user confusion.

**D6. My payments** (`PaymentsApp.tsx`)
29. Totals owed/paid/refunded; filter child/activity/date; pay via PayModal; select paid rows → download receipts PDF (branded).
30. Receipts only on Paid/Funded; empty states.
31. [LOW] Owed set = {Unpaid, Invoice sent} only; confirm no legitimately-owed state (other than voucher "Awaiting", intentionally excluded) is missed.

**D7. Children** (`ChildrenApp.tsx` + `ChildModal`)
32. Add wizard (About→Health&diet→Contact&comfort→[Questions]→[Safeguarding]); required name/DOB/gender/emergency contact; `POST /api/my/children`.
33. Edit quick-save; delete guarded for children with bookings.
34. Provider settings drive form (`collectGender/collectPhoto/collectSend/collectSendPlan/askPhotoConsent/collectionCheck/dobRequired` + custom questions + SEND plan upload).
35. Emergency contact inherited from account; collection PIN inherited from siblings.
36. **[MEDIUM] Remove-guard matches booked children by lowercased NAME** → two same-named siblings both locked from removal.
37. **[LOW] `ChildModal` reads only the FIRST provider's** child-question config even when adding a child for another provider.

**D8. Wallet / Memberships / Coupons / Ticker / Refer / Feedback**
38. **[MEDIUM] Wallet** (`WalletApp`): `/api/my/wallet` not built → always "no credit yet"; errors swallowed to empty → whole feature non-functional while nav/toggle imply it works.
39. **[MEDIUM] Memberships API contract mismatch**: `MembershipsApp`/`WalletApp` read `{enabled,current,tiers}` but `AccountApp` CloseAccount reads `{mine:{status,tierName}}` → CloseAccount may fail to detect/cancel active memberships. [CODE + LIVE]
40. Memberships: join/switch/cancel; not-enabled card; switch has no proration/confirmation.
41. Coupons (`CouponsApp`): cards from `/api/my/coupons`; realtime refresh; [LOW] no error state (network fail looks like "no codes").
42. Coupon ticker (`CouponTicker`): marquee, pause/hide persisted; gated by `codesBanner` && `!simpleMode`; [LOW] `codesBanner` on + `coupons` off scrolls codes with no page to open.
43. Refer (`ReferApp`): code/link/share/reward tracker; [LOW] any `/api/my/referral` error collapses to "not available yet".
44. Feedback (`FeedbackApp`): stars (required) + comment → `POST /api/my/feedback` → Google invite (inhouse/external/multi-place); [LOW] "which activity" is free-text not tied to bookings; [LOW] Google-invite fetch fire-and-forget (silent omit on failure).

**D9. Account** (`AccountApp` + `CloseAccount`)
45. Load `/api/account`; edit profile + emergency contact; marketing toggle; header updates via `aos:me-updated`.
46. Password: reauth + updatePassword; wrong-password message; forgot → reset email.
47. Close account: outstanding-payments block, active-membership cancel, wallet-credit warning, 30-day reactivation, ack required → deactivate → sign out.
48. **[MEDIUM] Close-account membership contract mismatch** (see D39) → active memberships may not be cancelled at close.
49. **[MEDIUM] `/api/account/deactivate` may be a stub** (Amir's) → a "closed" account might still allow login.
50. [LOW] Wallet-credit warning reads unbuilt `/api/my/wallet` → shows £0, no warning about losing credit.

**D10. Welcome / Newsflash**
51. ParentWelcome: one-time (role=parent, not welcomed, zero children); `?welcome=1` re-opens; details form → `PUT /api/account` → add-children/browse → `POST /api/me/welcome`.
52. **[MEDIUM] NewsflashBanner NOT gated by `customerArea.newsfeed`** → provider who turned Newsfeed off still shows parents newsflash popups from `/api/posts`. [LOW] seen-state per-device.

**D11. Referrals (operator, mis-filed)** (`features/referrals/ReferralsApp`)
53. [CODE] Confirm QA routes this to **operator** portals (company/franchise/freelancer), not custdash — it's an operator analytics page, not the parent `ReferApp`.

---

### AREA E — Staff & team  [ALL LIVE unless noted; whole slice is localStorage demo keyed to `Marcus Bell` / `DEMO_STAFF`]

**E1. Team & invites** (`TeamApp`; company/franchise)
1. 5-step invite (name+email→role→job title→deployment→review) → `POST /api/invites`, note, reset.
2. Invite as "None (office/admin)" → not rostered; invite a franchise (company only).
3. Invalid email → step-1 Next disabled; progress dots forward-only when `emailOk`.
4. Plan cap → amber banner + 409 via `capNote`.
5. Manage: filter All/Pending/Activated, search, copy link, deactivate↔reactivate, delete (optimistic local + best-effort PATCH/DELETE that 404s silently).
6. Step-3 add job title → writes `settings.staffRoles` (persists).
7. **[HIGH] Invite ↔ rest-of-slice DISCONNECT**: invites go to `/api/invites` but Onboarding/SCR/Appraisals/Holiday/Timeclock iterate hardcoded `DEMO_STAFF` → an invited person never appears in those tabs.
8. **[MEDIUM] `settings.staff.inviteMessage/assignByLeads/requireDBS/requireCompliance` never consumed** anywhere in this slice.
9. [LOW] `roles` filter `!r.owner||true` is dead code → Owner selectable as invite role (likely unintended).

**E2. Applications / recruitment** (`ApplicationsApp`)
10. Review seeded applications (cards/table); Accept → Send onboarding link (`carryOver` → `aos.team.onboardrecords.v1`); Reject w/ reason; Undo.
11. Forms tab: new/edit/duplicate/delete/reset; per-field type/required/mapsTo; branding+pay; Preview (new window).
12. Send modal: copy `/apply/:id` link OR email (demo toast); location filter; empty state.
13. **[HIGH] Recruitment→onboarding dead-end**: carryOver keys by applicant NAME but Onboarding iterates only `DEMO_STAFF` → accepted applicant never appears there.
14. [LOW] `/apply/:id` public route is outside the slice — verify it resolves (else shared link 404s).

**E3. Onboarding + Single Central Record** (`OnboardingApp`)
15. Select `DEMO_STAFF` person → per-section slideshow; fill fields; progress% + "cleared to start" gate.
16. Set gate fields (`rtwCheck/dbsCheck/refsCheck='verified'`) → "Cleared to start"; Export pack (print w/ embedded docs).
17. SCR matrix: DEMO_STAFF × Ofsted columns; toggle dates & methods; Print/Export.
18. Requirements modal: required + applyKind (all/roles/named) + custom fields; DBS >36mo warning.
19. **[MEDIUM] Operates entirely on 6 hardcoded `DEMO_STAFF`** → real starters can't be onboarded.
20. **[MEDIUM] Sensitive data (bank/NI/DBS) in plain localStorage** (`aos.team.onboardrecords.v1`), no server/retention — data-protection blocker.
21. [LOW] "Cleared to start" is informational only — nothing blocks an un-cleared person from being rostered.

**E4. Deployment** (`LocationsApp` embedded)
22. Per-location Staff-assignment; verify a listing-scoped Document reaches only staff deployed to that listing.
23. **[MEDIUM] Documents visibility uses hardcoded `DEMO_DEPLOY`** (DocumentsApp) + separate hardcoded `MY_LISTINGS` (StaffDocs) — neither reads real Deployment.

**E5. Appraisals (operator)** (`AppraisalsApp`)
24. Reviews (filter appraiser/location; New review; scores; overdue tiles); Feedback (kudos/concern/supervision); Talent 9-box (drag/click, mismatch flag); Templates; PIPs (targets/support/check-ins/30-60-90).
25. Signals pulled live from `aos.timeclock.v1`, `aos.holiday.absences.v1`, DBS/PFA from DEMO_STAFF.
26. **[MEDIUM] No operator Appraisals/Onboarding/Applications/Deployment for FREELANCER** (TeamApp only company+franchise) yet staff portal exposes "My appraisals"/"My onboarding" → operator-with-no-counterpart gap.
27. [LOW] `signalsFor()` collapses lateness to boolean not count.

**E6. Leave & absence (operator)** (`HolidayApp`; company/franchise/freelancer)
28. Requests: approve/edit/decline (reason); conflict detection → "Approve anyway"; allowance-after shown.
29. Add leave modal: employee/type/dates/half-day/pay treatment; sickness → SSP eligibility + AWE → weekly SSP.
30. Who's off: week grid, bank-holiday columns, red "COVER" where off person is rostered (`aos.rota.v5`).
31. Allowances: per-person table (statutory 5.6wk cap 28, part-time, carry-over, rolled-up 12.07%); ProfileEditor.
32. Settings: leave-year/region/sick pay/reporting rule.
33. **[MEDIUM] Policy in localStorage** (`aos.holiday.policy.v1`) not TenantSettings → per-device; a second manager/device sees DEFAULT_POLICY → approvals/SSP silently disagree.
34. **[MEDIUM] "Add leave" can set status directly to "approved"** bypassing the approval flow (no requester audit).
35. [LOW] `conflicts()` flags any date-overlap org-wide, ignoring shared site/listing → over-warns multi-site.

**E7. Leave & absence (staff)** (`MyHolidayApp`)
36. Request time off (fraction for single-day); Report sick (no SSP amount); rolled-up staff → "holiday included in wages" + book-unpaid.
37. Overview tabs (My summary ring / Working status / Who's clocked in — gated); history filter; cancel pending.
38. **[HIGH] Hardcoded `ME='Marcus Bell'`** → every staff user sees Marcus's allowance/history/lead-visibility.
39. `scheduling.staffSeeTeamAbsence` (REAL) hides team strip; `scheduling.coworkerVisibility` (REAL: all/team/leads/none) gates "Who's clocked in".
40. [LOW] Lateness card `lateMin?1:0` mislabelled as count; `iAmLead` from hardcoded role.

**E8. Clock in/out & timesheets (operator)** (`TimesheetsApp`)
41. Who's-in board (in/break/out/off + hero + avatars); status filter pills; Clock out / nudge; Off-today from holiday store.
42. Timesheets: per-person (worked/sched/late/overtime/pay hrs); edit recomputes `lateMin`; Approve→payroll.
43. Settings: pay policy, auto-pay overtime (actual only), grace, rounding, lead label.
44. **[MEDIUM] Hard daily reset**: `loadClock()` discards + re-seeds when stored day ≠ today → only "today" ever shows; yesterday's hours/approvals vanish at midnight; no history/retro-approval.
45. **[MEDIUM] Two grace settings**: `ClockSettings.graceMin` (used) vs `scheduling.checkinGraceMin` (Setup, ignored) → can drift.
46. [LOW] Approve→payroll only stamps rota locally, no real posting.

**E9. Clock in/out (staff)** (`TimeClockApp`; no direct nav item)
47. Clock in (attempts geolocation) → total ticks (30s); breaks; who's-in-now; lead view when role matches leadLabel.
48. **[HIGH] Hardcoded `ME='Marcus Bell'`** → everyone clocks in as Marcus.
49. **[MEDIUM] Geolocation race**: `doIn()` calls async `captureLocation()` then immediately `clockIn(...,loc)` with the STALE closure value → location never captured on the clock-in it's meant for.
50. **[MEDIUM] No staff nav item for `clockinout`** — reachable only via schedule/"My shifts & clock" or deep link; verify reachability end-to-end.

**E10. On-site-now + Live clock cards** (dashboard)
51. `/api/registers` + `/api/listings?mine=1` + `/api/library` venues → per-listing children ring + staff avatars by venue; case-insensitive venue match; "Nothing running today"; "no venue → can't match staff".
52. [LOW] Verify header "staff on site" figure matches the selected tab when listings share a venue.

**E11. Documents (operator)** (`DocumentsApp`; company only)
53. Library: add/edit doc (title/category/expiry/upload→new version, assignment chips); status chips; filter; view; delete.
54. Read receipts: DEMO_STAFF × docs matrix; chase unread (toast).
55. **[MEDIUM] Registered ONLY for company** (not franchise/freelancer) yet StaffDocs exists for all staff → franchise/freelancer can't manage docs their staff must read.
56. **[MEDIUM] Read-receipts use hardcoded `DEMO_DEPLOY`+`DEMO_STAFF`** → fictional coverage/unread counts.
57. [LOW] Library + uploaded files (data-URLs) in localStorage (size-limited, per-device).

**E12. My documents (staff)** (`StaffDocsApp`)
58. Policies (all/role/title) + listing-scoped (once deployed); Read → tick "I've read this" → `aos.docs.read.v1[ME]` → operator receipts; progress %.
59. **[MEDIUM] Hardcoded `ME/ME_ROLE/ME_TITLE`+`MY_LISTINGS`** → every staffer is Marcus; doesn't read real Deployment.
60. [LOW] "Read & confirm" ungated — no enforcement before starting.

**E13. My onboarding (staff)** (`StaffOnboardingApp`)
61. Slide wizard: 5-year address history, RTW evidence/share-code, DBS-if-held, HMRC starter checklist, pension opt-out, role quals, references; save-as-you-go; submit-with-outstanding.
62. Conditional fields (DBS only if Yes; P45 vs starter checklist; loan plan; pension trio+signature); edit-after-submit sets `lastEditedAt`.
63. **[HIGH] Hardcoded `ME='Marcus Bell'` + demo INVITE map** → always Marcus; real new starters can't onboard.
64. [LOW] Sensitive fields to plain localStorage.

**E14. My appraisals (staff)** (`MyAppraisalsApp`)
65. Self-assessment (ratings + comment) → Submit; my goals; upcoming; past reviews w/ score.
66. **[MEDIUM] Hardcoded `ME='Marcus Bell'`** → staff only see Marcus's reviews.

**E15. Announcements (staff)** (`StaffAnnouncementsApp`; hidden nav)
67. Read (pinned first); mark read/all; unread badge; lead composer (if allowed).
68. `announcements.leadsCanPost` (REAL) gates composer.
69. **[MEDIUM] `announcements.enabled/requireAck/dashboardDays/defaultAudience/defaultImportant` NOT read** — board shows regardless of enabled; requireAck not enforced.
70. [LOW] `canPost` depends on hardcoded `ME_ROLE='Camp Lead'`.

**E16. Staff shell — Welcome + Reminder banner**
71. Welcome modal (first login / `?welcome=1`) gates availability→compliance; reminder bar aggregates availability/compliance/courses/documents.
72. **[HIGH] Reminder bar "N courses" navigates to `/{portal}/training` but there is NO `training` view** (it's `certificates`) → unregistered slug 404s → guaranteed dead-end for any staffer with outstanding courses.
73. **[MEDIUM] All "still to do" logic keyed to hardcoded `ME='Marcus Bell'`.**

**E17. Cross-cutting: nav feature-gating & roles**  [MIXED]
74. Toggle Setup→Features off for staff/holiday/timesheets/documents → operator nav item hides; reappears on.
75. **[MEDIUM] Setup→Features does NOT cascade to staff portal** (`useOperatorFeatures` no-op for `portal==='staff'`); staff nav items have no feature/role gating.
76. **[MEDIUM] `ROLE_CAPS` (staff/schedule/learning/documents) never enforced** — any staff role can reach any page.

---

### AREA F — Comms & marketing  [ALL LIVE unless noted; tree `activtyos-app-`]

**F1. Discount codes** (`MarketingApp`)
1. Create code: type/value → Generate (random SAVE… or SURNAME+year when family reserved) → save → active badge + KPIs.
2. Validation: empty code/value≤0 → error; percent>100 blocked; amount/perAttendee huge value NOT validated here (relies on engine clamp).
3. Reserve-for-one-family / reserve-for-a-group → auto-seed code, message+email members (verify actually sends), lands in Coupons.
4. **Edit a reserved code then DESELECT the family** ("Anyone can use it") → **verify reservation actually clears**.
5. Public code: NOT emailed, DOES appear in every family's Coupons + dashboard banner.
6. Pause/Resume; Delete; status badges (paused/expired/used-up/active); usage bar.
7. Parent groups: create/edit/delete, select-all/clear (only families with valid email); delete-group warns sent codes unaffected.
8. Empty/loading states; end-to-end redemption at checkout (per-customer limit, exclusive, stacking).
9. **[MEDIUM] Reservation-clear inconsistency**: `assignedGroupId` sent as `''` (clears) but `assignedTo/assignedName` sent as `x||undefined`; with PUT-merge, an absent key may NOT clear → removing a family reservation on edit may leave the code locked to that family.
10. [LOW] No upper bound on amount/perAttendee (£999 code relies entirely on engine clamp — confirm no negative totals).
11. [LOW] "sends by message + email" is a backend action; unsent silently if messaging not wired.

**F2. Referrals (operator)** (`ReferralsApp`)
12. Programme OFF vs empty vs populated; search/sort recent; leaderboard; outstanding liability; £ vs % rendering; cross-check parent `ReferApp` reward mint + cap.
13. [LOW] Operator nav item always present (not gated by `referral.enabled`) → disabled state must read clearly not "broken/zero".

**F3. Reviews hub** (`ReviewsApp`)
14. `/api/reviews` → blended score + by-source tiles + filter tabs; reply to in-house; external → "Reply on Google/Trustpilot ↗"; connect Google (only when configured) → OAuth redirect (graceful alert when unavailable); empty state; verified-booking badge.
15. **[MEDIUM] No loading state** — pre-resolve shows "—"/0, indistinguishable from empty; failed fetch silently swallowed.
16. [LOW] Google/Trustpilot connect is P2/P3; verify the external-connect path isn't a dead stub and `publicWidget` isn't a no-op.

**F4. Marketing strategies** (`MarketingStrategiesApp`)
17. [LOW] Nav item clickable in all three operator portals but page is a "Coming soon" stub — confirm intended (parked), not broken.

**F5. Newsfeed (operator)** (`NewsfeedApp`) + To-staff switch
18. Compose each template type (announce/event/reminder/urgent/celebrate/booking); urgent auto pin+ack+priority; booking auto CTA.
19. Publish "now" → 5s cancellable countdown then commit; editing live post also counts down; draft/scheduled skip.
20. Schedule (`when='later'`+publishAt → "scheduled"); Email hand-off (channel email/both → `aos.email.draft.v1` → `/{portal}/email`); Newsletter builder; audience All vs Listings.
21. Folders (create via `post.folder`, delete un-files); card actions edit/duplicate(fresh draft)/pin/archive/delete; filters/search; read-only role (`canManage=false`); download/print single post.
22. **[MEDIUM] Scheduled posts rely on a backend scheduler** to flip to published — verify the job runs, else scheduled posts silently never reach families.
23. [LOW] Listing-scoped post with zero `audIds` not blocked → ambiguous "Listings: —" audience.
24. [LOW] Email hand-off overwrites `aos.email.draft.v1`; EmailApp removeItem's it on mount → second tab / prior draft can be lost.

**F6. To-staff composer** (`StaffNotifyComposer`)
25. Compose notice (title+body required); audience All/per-listing; Important/Pinned; Send → `addAnnouncement`; defaults from `defaultImportant`/`defaultAudience`.
26. **[MEDIUM] Does NOT gate on `announcements.enabled`** — sends even when staff announcements OFF.
27. **[MEDIUM] `announcements.requireAck` never read here** — no ack requirement can be enforced from this composer.
28. [LOW] Audience uses listing TITLE as value (collision); localStorage-only.

**F7. Messages (operator)** (`MessagesApp` mode=operator)
29. Open thread → reply (Enter send / Shift+Enter newline); merge `{ParentName}/{ProviderName}/{ChildName}` client-side.
30. New 1:1; broadcast to families (>1 ticked) → `/api/messages/broadcast`; broadcast to listings (review/untick recipients).
31. Folders (create/rename/delete, move-to); Pro composer (templates, merge fields, save-as-template, live preview); deep-link `?compose&emails=`.
32. **[MEDIUM] Enter sends with NO confirmation** — in broadcast/group mode a stray Enter mass-sends instantly.
33. **[MEDIUM] Merge-field gap**: only `{ParentName}/{ProviderName}` filled server-side on broadcast → `{ChildName}`/booking tokens can go out literally to parents.
34. **[MEDIUM] Staff portal maps messages→operator mode** → staff get folders + broadcast-to-all-families + broadcast-to-listings with no per-staff scoping.

**F8. Message templates** (`TemplatesApp`)
35. List (presets = read-only badge + Duplicate only); New/Edit (name+body required, insert merge fields, booking-scoped marked "needs a booking"); duplicate; delete own; highlight `{Token}` chips.
36. [LOW] No empty state when templates = [] (blank/broken look); highlight regex `/\{[A-Za-z]+\}/` misses tokens with digits/spaces.

**F9. Moments (operator)** (`MomentsApp`)
37. Post child photo (only `photoConsent` children taggable; AI caption); post "work" photo (no consent, all bookees, warning if no-consent tagged); add activity tag → `settings.moments.activities`; reply to comment; star quote.
38. Push to Email library (save one / move all; `autoAddPhotos` mirror; edit ratio/fit/colour/caption).
39. **[LOW] "Work" photos bypass photo-consent entirely** (soft warning only) → safeguarding edge worth an explicit test.
40. [LOW] Folder-count vs filter mismatch (child folder counts require photoUrl, filter doesn't) → caption-only child moments under-report.

**F10. Email hub** (`EmailApp`; 8 tabs)
41. Inbox: real `/api/emails/messages` else `DEMO_INBOX`; reply/quick-reply/forward → Compose pre-filled; star/snooze/archive/spam/trash/restore; "Add to enquiries" w/ 5s undo.
42. Compose: subject+body required; audience one/listing/all/none; extra To/CC/BCC (validated); merge fields; attach; signature; embed-vs-PDF; undo-send window; Send now / Schedule.
43. Campaigns wizard (name→subject→audience→content, AI help, designer, send/schedule); status list; Audiences; designed Templates; Automatic emails toggles; Analytics; Settings.
44. **[MEDIUM] Inbox falls back to 5 fabricated `DEMO_INBOX` enquiries** whenever `/api/emails/messages` is empty → real provider sees fake families, can reply/add-to-enquiries → pollutes enquiry board.
45. **[MEDIUM] Auto-emails + scheduled sends inert without backend engine**: Analytics defaults delivered=recipientCount/opened=0 → 0% open rate; Click rate hardcoded "—"; unsubscribe "to come".
46. [LOW] Designed-doc "Attach as PDF" doesn't actually attach — families get the note without the promised PDF.

**F11. Parent Newsfeed / Moments / Messages / Feedback**
47. ParentNewsfeed: `/api/posts` cards; react/RSVP/ack/CTA; "Message us for more info" → compose; per-parent state in `aos.news.mine.v1`. **[MEDIUM] state localStorage-only** → switching device loses acked/reacted; counters drift, double-count possible. [LOW] "Message us" button renders even when messaging off → dead-end route.
48. ParentMoments: `/api/moments` grid; folder tabs; lightbox; reply; only consented children; [LOW] child-folder count under-reports caption-only.
49. Parent Messages (mode=parent): auto-pick single provider; deep-link `?compose&tenant&subject`; reply; coupon chips. [LOW] `?tenant=` forged/stale link posts anyway → verify server rejects messaging an un-booked provider.
50. Parent Feedback: stars + comment → invite per captureMode; [LOW] Google-invite `.catch`-swallowed → silent no-CTA even when external intended.

**F12. Cross-cutting gating & platform stubs**  [MIXED/CODE]
51. Toggle each `features[view]`/`customerArea[key]` → correct nav item hides on operator AND cascaded parent sides.
52. **[MEDIUM] Portal parity**: company + freelancer mark newsfeed/messages/email `hidden:true` (company also hides moments); franchise surfaces all — all remain URL-routable. Confirm staged-rollout hiding is intended, no deep-link leaks.
53. **[MEDIUM] Gating is nav-only** — slice components don't self-check the toggle → disabled feature fully functional via direct URL; `ROLE_CAPS` (marketing/messaging/email) not applied.
54. [LOW] Platform "email" = `planned()` stub; platform "messages" = `SupportInboxApp` (support, not family messaging).

---

### AREA G — Setup & settings backbone  [ALL LIVE/MIXED unless noted]

**G1. Features & Customer-area tab** (`SetupApp` features)
1. Toggle an optional feature (e.g. `tasks`) off → disappears from operator Sidebar (optimistic + after realtime); on → returns.
2. Family-facing feature On + nested "Show to families" Hidden → operator keeps view, family loses it (verify on custdash).
3. Simple mode On → every custdash view except home/browse/bookings/children/account/privacy/support disappears + codes ticker vanishes; Off → prior per-key values restored (not wiped).
4. Toggle a feature Off while a family is mid-session on that page → confirm no crash on now-hidden route (route still resolves?).
5. CORE view → locked "🔒 Always on" pill, no toggle.
6. Repeat matrix company vs freelancer (row set differs).
7. Library fetch failure → `useSettings.error` in header strip; tab still renders on DEFAULT_SETTINGS.
8. **[HIGH] Features grid filters out `hidden` nav items** → messages/newsfeed/moments/email are `hidden:true` in EVERY operator portal → their On/Off row **never renders**, and their "Show to families" sub-toggle is **unreachable** → an operator cannot disable Moments/Newsfeed/Messaging, and `customerArea.messaging/.newsfeed/.moments` have **no reachable UI control** (permanently default true unless edited via API).
9. **[MEDIUM]** No single source of truth for family visibility of these views (feature-off cascade vs direct customerArea sub-toggle can disagree).

**G2. Roles & permissions** (company only; `RolesPermissions`)
10. Rename role inline; set caps None/View/Edit; scope all↔assigned; add custom role (seeds from Coach); delete custom; Reset.
11. Owner locked to Edit + all + no delete; builtins non-deletable; blank name → Add disabled; delete all custom → falls back to DEFAULT_ROLES.
12. **[MEDIUM] Matrix is saved-but-inert**: no code consumes `caps`/`scope` to gate nav, hide money tiles, or restrict assigned-only views. Intro copy ("money tiles show only to roles with Finances access") is untrue in current build.
13. **[LOW]** Roles tab is company-only; franchise with sub-sites has no roles editor.

**G3. Notifications tab** (`NotificationsTab`)
14. Toggle a Bookings&money alert off → server `notify()` skips it; switch on a default-off alert (Med due); email-delivery off → bell fires, no email.
15. Brand-new tenant `notifications:{}` → default-off keys stay off, rest on.
16. [CODE] **`notificationOn()` + `PROVIDER_NOTIFICATIONS` duplicated in `lib/settings.ts` AND `server/src/lib/notify.ts`** → assert the two lists are identical (drift risk).

**G4. Childcare vouchers tab**
17. Add scheme + fill account number → offerable at checkout; leave blank → not offered.
18. Scoped detail: listingId wins over locationId wins over unscoped (`detailsForListing`).
19. Timing: `voucherClearDays=5`, book start in 3 days → not offered; 10 days → offered.
20. `voucherWhenClose='approve'` → **verify checkout doesn't silently fall through to "normal"** (hold-for-approval unbuilt).
21. Migration: legacy single `reference` string → lifted into `details[]`.
22. [LOW] Confirm 'approve' doesn't confirm an unpayable booking.

**G5. Child questions tab** (`QuestionsEditor`)
23. Add text/choice/yesno question; scope to listings; age-gate 8+ → appears only for in-scope + ≥8 at checkout.
24. Age-gate ↔ DOB: age-gate a question then try requireDob off → `dobRequired()` keeps DOB compulsory.
25. Hide vs delete (hidden retains answers); `ask:'every'` re-asks each booking; char limits enforce `maxLength`.
26. **[HIGH] `reviewIfNo` NOT wired**: `heldForReview()` has ZERO callers in `features/` or `server/src`; `checkout.tsx` has no reference → a "No" answer (incl. toilet-training) never holds a booking; those bookings auto-confirm. `needsNappies` (register badge) IS wired → makes it look like the feature works while the hold-for-review half silently doesn't.

**G6. Memberships & Refer tabs**
27. Memberships: enable programme + one tier + benefit → live `MembershipTierCard`; family page appears.
28. **Enable programme but all tiers off → family page must NOT show** (empty-page guard).
29. Credit tier with `benefitValue ≤ priceMonthly` → amber "not worth joining" warning.
30. Refer: £off vs %off (reveals `capToFriendSpend`); verify reward not larger than friend spend when cap ON; both disabled → no family pages, no errors.
31. [LOW] Recurring billing is Stripe/backend — enabling a tier shouldn't expect real charges; confirm "Join" CTA doesn't dead-end.

**G7. Settings persistence engine** (`useSettings`/`withDefaults`)
32. Type provider name → chars persist (no vanish) via `quietUntil` echo suppression.
33. Rapid toggling → single coalesced PUT after 500ms.
34. Change field then navigate away before 500ms → unmount flush fires the pending write.
35. Force PUT failure → error set, `load()` restores stored values, error strip shows.
36. Two tabs editing different sections → library PUT MERGES (regression-test task #9 fix).
37. Migration: ancient library (single voucher ref, string cancel reasons, "Free place" pay method, missing nested objects) → `withDefaults` fully populates, no undefined reads.
38. Parent read: `useTenantSettings` falls back `/api/public/library/:tenantId` on 401 then DEFAULT_SETTINGS on error → parent never blocked from booking.
39. **[MEDIUM] Silent lost save**: if the unmount-flush PUT rejects, the component is gone → error strip can't show, rollback runs on an unmounted tree. Test rapid edit-then-immediate-navigate under a failing network.
40. [LOW] `quietUntil` 10s/2s window can drop a legitimate concurrent edit from another device.

**G8–G12. Sidebar / useCustomerArea / useBookingFlags / view-registry / dead toggles**  [MIXED/CODE]
41. Sidebar: feature-off + `money.show` hiding; custdash `customerArea` + `simpleMode` hiding + empty-section fade; live badges; plural child labels.
42. **[MEDIUM] `money.show='outgoing'` hides nothing on incoming side** (`MONEY_INCOMING_VIEWS` is []) → asymmetric; only expenses hidden for incoming-only.
43. **[MEDIUM] Simple-mode stripping lives ONLY in Sidebar** + re-checked in Header + CouponTicker; `useCustomerArea()` never applies `simpleMode` → any future surface reading `useCustomerArea` without `&& !ca.simpleMode` leaks hidden sections.
44. **[MEDIUM] `useCustomerArea` cascade incomplete**: covers messaging/coupons/codesBanner/newsfeed/moments/meals/memberships/refer only; wallet/browse/timetable/trips/accidents/medication NOT re-derived from operator features → verify a provider can actually hide Medication/Trips tabs.
45. **[LOW] Phase-1 single-provider**: `ps?.[0]?.tenantId` reads only the FIRST linked provider → family booked across two providers gets the first's customer-area for the whole app.
46. useBookingFlags: operator badge = to-approve + date-change + cancellation + failed-card; parent = unpaid. [LOW] `approve/cancel/card` computed off RAW `bs` while `change` off `live` → a Cancelled/Declined booking still carrying "Approval needed" or `refund:'pending'` keeps inflating the badge; fetch failure silently swallowed → stale badge.
47. view-registry: **[CODE] enumerate all nav slugs per portal and assert `getRegisteredView` is defined for each** (unregistered slug 404s, no fallback; singular/plural `incident(s)` split is exactly the drift this catches).
48. **Dead toggles audit** [MIXED — flip each, exercise the feature, confirm nothing changes]:
    - `refundApproval='auto'` — read only in SetupApp; every refund stays manual.
    - `inventory.lowStockAlert` — never read; low-stock badge always shows.
    - `learning.selfEnrol` — never enforced; staff self-enrol un-gated.
    - `scheduling.autoRequestAvailability` — no consumer.
    - `DEFAULT_SETTINGS.registers.actions` omits `meals` → `registers.actions.meals` defaults undefined not true.

---

### AREA H — Safeguarding & extras  [ALL LIVE unless noted]

**H1. Learning Centre (operator)** (`LearningCentreApp`; company/franchise)
1. Browse catalogue (platform + company grouped); filter category/level/keyword; empty state.
2. Create/edit company course (seeds pass mark + renewMonths); persists `aos.learn.courses.v10`.
3. Assign course (all/roles/named + due + required + quiz version + renewal) → "Assigned — they'll be notified" (fake); quick-assign all as Optional.
4. Completions/compliance tab (overdue counts, avg score, activity feed); Policies (read-and-confirm, speech synth, scroll-gate, PDF attach, ack); Certificates (download, branding).
5. **[HIGH] Entire app is front-end demo** — courses/assignments/policies/acks/progress in localStorage + SEED constants; no sync across users/devices; "they'll be notified"/"Reminder sent" cosmetic.
6. **[MEDIUM] Dead settings**: `learning.trackTraining/observations/autoCert/selfEnrol/framework` editable in Setup, never read/enforced (autoCert especially misleading — certs are always manual downloads).
7. **[MEDIUM] Compliance figures from hardcoded SEED_STAFF** + `courseScore()` deterministic hash placeholder → fabricated numbers in any real tenant.

**H2. Staff certificates (operator)** (`CredentialsApp`)
8. Filter location/type/status; profile drawer (compliance %, outstanding, per-cert files, verify/edit/add); verify/reject/delete; export CSV/PDF/evidence pack; internal-courses column.
9. **[HIGH] Uses DEMO_STAFF + demo credentials store** — verify/reject/add local-only; matrix fictitious in a real tenant.
10. **[HIGH] THREE overlapping staff-cert surfaces with no shared store**: `ComplianceApp` reads real `/api/compliance`; `CredentialsApp` + `StaffCertsApp` use the demo store → a DBS added in Compliance won't appear in Credentials (and vice-versa).

**H3. My learning (staff)** (`StaffCertsApp`)
11. Certificates tab (upload/renew, expiry countdown); My courses (assigned by role, play, completion); download cert.
12. **[MEDIUM] Demo store + hardcoded `ME='Marcus Bell'`** → everyone sees Marcus.
13. [MEDIUM] Completions feed manager view only via demo store → won't reliably reach oversight across sessions/devices.

**H4. Course player & authoring** (`CoursePlayer`/`MotionPlayer`/`CourseEditor`)
14. Play lessons + quiz + motion (SVG scenes, narration/caption sync, reduced-motion fallback, text mode); pass/fail vs pass mark → cert on pass; author blocks + AI text.
15. [LOW] Quiz progress only in `aos.learn.progress.v1`; pass/cert doesn't write a server record.

**H5. Compliance** (`ComplianceApp`; real backend)
16. `/api/compliance` → summary tiles + list; realtime; add cert (name+type+ref+issued+expiry+notes, validation); delete; role gate `canManage`; empty/error/loading.
17. **[MEDIUM] `staff.requireDBS`/`staff.requireCompliance` never read on front-end** → toggling "require DBS" on still never blocks a staff member with no DBS (enforcement is backend).
18. [LOW] `canManage` fails safe (hidden) on `/api/me` failure but no explanatory error; overlaps Credentials/StaffCerts with no cross-linking.

**H6. Medication** (`MedicationApp`; operator+staff)
19. Add medication (3-step; child must be booked — warns if unmatched); record dose (quick Yes/No or detailed w/ day/time/witness/back-date); schedule-approval warning.
20. Witness enforced when `requireWitness`; leads-only blocks staff when `leadsOnly`; consent states (on file / none blocks / withdrawn); filter+search; Active/Archived; deep-link `?child=`.
21. **[MEDIUM] `remindWhenDue` is a dead toggle** — add form promises "a bell reminds staff at each time" but flag never read, no reminder fires.
22. **[MEDIUM] "parent informed"** asserted purely from `informParentGiven/Missed` text; actual email/bell unbuilt → staff see "parent informed" though nothing sent.
23. **[LOW] `leadsOnly` fails OPEN**: `/api/me` failure → role='' → `canRecord` stays true → staff could record when leads-only intended.
24. [LOW] Med for a child with no matching booking saves but silently never reaches parent (soft amber warning only).

**H7. Parent medication** (`ParentMedicationApp`)
25. Authorise (3-step, one/both children); see doses; add note; withdraw consent; notify mute/unmute; empty gates.
26. **[MEDIUM] Notify mute in localStorage (`aos.medNotifyMuted`), per-device, drives no real behaviour**; bar claims "We'll email you and ring the bell" which may be untrue.

**H8. First aid & Behaviour** (`IncidentsApp`; `accidents`+`incidents`)
27. Log accident (3-step, child must be booked, injury/treatment bank); log behaviour (bank, action, share-vs-internal, attachment only if shared); edit → notify-vs-just-update; filters; delete; deep-link `?child=`.
28. [LOW] Inconsistency: shared behaviour incident's "parent will be emailed" banner gated on `notifyParentIncident` (default OFF) → shared incident shows no confirmation, unlike accidents.
29. [LOW] Delete offered with only confirm() despite "records usually kept" — no soft-delete/retention lock.
30. [LOW] "parent will be emailed" depends on unbuilt notify backend — can't verify.

**H9. Log a concern / Safeguarding** (`LogConcernApp`+`SafeguardingApp`)
31. Log safeguarding concern (category → auto risk+protocol, child/staff subject, body map, LA contacts, attachments); DSL action chronology; download confidential PDF; filter by risk; edit; delete.
32. **[MEDIUM] `safeguarding.dslEmail` read nowhere** — provider sets a DSL email expecting concerns emailed there; nothing consumes it.
33. [LOW] "Log & notify company" only writes the record (notify backend); staff-subject concern PDF (`/dossier`) may 404 → pack has only the concern body.

**H10. Parent first aid & incidents** (`ParentAccidentsApp`)
34. Tabs Accidents/Incidents; details, attachments, reply thread, acknowledge; outstanding-ack nag (`requireAck`); notify mute.
35. **[MEDIUM] Notify mute localStorage-only** (`aos.accidentNotifyMuted`), does nothing to real notifications.
36. [LOW] Per-record "I acknowledge" renders for every un-acked record even where `requireAck` false → parents asked to ack records not required.

**H11. Trips & visits** (`TripsApp`)
37. 7-step planner; readiness ring gates status; pull children/staff/venue from listing; RA + hazard bank (edit un-signs); track changes; parent message merge; quick head-count; cancel/reinstate; staff-portal plan gate.
38. **[MEDIUM] `trips.whoCanPlan` only checks `==='all'`** → both 'leads' and 'managers' collapse to "block all staff" → a Lead can't plan when setting says leads may; three options behave as two.
39. **[MEDIUM] `trips.requireConsent` is a dead toggle** — never read; readiness always consent-gates via `permsOk()` regardless.
40. [LOW] Parent pay/consent + Stripe are Amir's — Paid/Consent chips are manual operator flags.

**H12. Parent trips & consent** (`ParentTripsApp`)
41. List trips; per-child consent give/decline (only planned + upcoming + pending); outstanding banner; completed read-only.
42. [LOW] Late/past-status pending consents show state but no action button, no explanation → dead-end.

**H13. Meals (operator)** (`MealsApp`/`MenuPlanner`/`SavedMenus`/`MenuSharing`/`MealReport`)
43. Plan season→menu→days; capacity; per-day cutoff; saved menus; menu-sharing (booked vs paid, default cutoff, allergen disclaimer, change approval); meal report; role gate.
44. **[MEDIUM] Four dead meal settings**: `meals.ordering`, `meals.showAllergens`, `meals.orderCutoffHours`, `meals.menuNote` editable in Setup but read nowhere → turning off "pre-order" or "show allergens" has no effect.
45. [LOW] `menuShare/cutoff/changeApproval` enforced server-side — front-end tester can't confirm "paid-only" visibility or cutoff without backend.

**H14. Parent meals** (`ParentMealsApp`)
46. Menu tab (dish per child/day, allergen+diet clash confirm, capacity/sold-out) → basket → pay (real Stripe PayModal); Kids tab (gaps); change/cancel (auto vs request); cutoff/closed cells; diet filter; i18n.
47. [LOW] Closing PayModal without paying leaves meal orders created-but-unpaid holding a cell/capacity → verify reconciliation/expiry.
48. [LOW] Allergen clash uses synonym keyword match on free-text → false negatives (brand names/misspellings).

**H15. Inventory** (`InventoryApp`)
49. Add/edit item; add category/location/season inline; stock-check mode (real counts, timestamp+who, last-5 history); order-more → Expenses; carry season over; filters; role gate.
50. **[LOW] `inventory.lowStockAlert` dead** — low-stock badge always active.
51. [LOW] "Order more" immediately posts a real Expense with no undo; marking received irreversible.
52. [LOW] Carry-over silently sets tenant-wide `currentSeason` as a side-effect.

---

### AREA I — Platform HQ & tasks  [ALL LIVE unless noted; tree `activtyos-app-`]

**I1. Sales pipeline** (`SalesApp`)
1. Load pipeline; legacy-stage lead folds into 'new' (verify not lost); add lead (plan auto-sets estMrr; blank → 'Untitled'); edit + log activity (pending queue → POST on Save; local placeholder reconciles); drag between columns (optimistic + PUT, revert on failure); delete; search (biz/contact/email/location/owner/phone≥3); dashboard periods; CSV import (header aliases, preview 25, template).
2. **[MEDIUM] CSV import dedupes ONLY by email** → emailless rows never dedupe → re-import creates duplicates every time.
3. [LOW] Dashboard 'today' cutoff local-midnight vs UTC createdAt → timezone edge; locally-logged activity `by='—'` until server restamp.

**I2. Providers & billing + Pricing** (`ProvidersApp`/`PlatformPricingApp`)
4. Load providers+subscriptions → tiles + list; filter chips All/Freelancer/Company/Franchise; expand row (signup + subscription); Invite panel (copy link, mailto); Pricing tab (edit plans/bands/franchise pct, Save applies to new signups, Reset).
5. [LOW] Row "since" hardcodes `.replace(', 2026','')` → breaks for 2025/2027; `/platform/pricing`+`/billing` alias to ProvidersApp with no nav item → don't preselect Pricing tab; no empty-state for zero providers.

**I3. Provider analytics** (`PlatformAnalyticsApp`) — `/platform/analytics`, `/dash`
6. MRR/ARR, growth, churn, trial conversion, GMV, projections; incl-trials vs paying-only toggle; period 3/6/12; charts + donut + attribution + newest/top; empty states.
7. [LOW] Straight-line projection misleads with tiny samples.

**I4. At risk** (`PlatformAtRiskApp`)
8. Load → To-contact vs Contacted; header £/mo at risk; mark contacted / reopen (busy state); mailto/tel; empty states.
9. [LOW] Unknown reason key → grey generic chip with empty hint.

**I5. Page engagement** (`PlatformEngagementApp`)
10. Load `/page-engagement?type=`; metric Visits/Time; order; per-row delta; depends on PageTracker.
11. [LOW] Filter omits Franchise (inconsistent with other filters); no realtime refresh.

**I6. Provider features** (`PlatformFeaturesApp`)
12. Load providers → cards; type tabs + search; expand → 25 toggles (`isOn = features[view]!==false`); flip → optimistic + PATCH; rollback+alert on failure; "N/25 on".
13. **[HIGH] Turning a page OFF only hides Sidebar** — `app/[portal]/[view]/page.tsx` renders any registered view with no flag check → provider can still open `/company/tasks`, `/company/calendar`, `/company/ai` by URL after HQ "disabled" them.
14. **[MEDIUM] PAGES list can drift** from `nav/config.ts` + view-registry → verify each toggled slug both exists in nav (so hiding has effect) and is registered (so "on" resolves).
15. [LOW] `window.alert()` on save-failure (inconsistent with inline banners elsewhere).

**I7. Support inbox (HQ)** (`SupportInboxApp`) — `/platform/support`, `/messages`
16. Load `/api/platform/support` (+providers); filters incl. 🐞Bugs/Resolved; open thread → marks read; bug report card; reply (⌘/Ctrl+Enter); mark resolved/reopen; deep-link `?thread=`; new-message composer (to provider by tier OR to customer); stats header.
17. **[HIGH] HQ inbox reads/writes `supportThreads` but operator/customer SupportApp uses a DIFFERENT collection `supportMessages`** → the two support surfaces are **not bridged**: a provider's "Message ActivityOS" note never reaches HQ inbox, and HQ threads never appear in the provider's SupportApp.
18. **[MEDIUM] Bug-triage UI expects `report={channel,page,severity,device,steps}`** but the customer "Report a problem" form captures none of that + posts to the other collection → the rich bug fields have no populating client.

**I8. Support / Message ActivityOS** (`SupportApp`; operator + custdash)
19. Load `/api/messages/support`; operator topics general/billing/bug/feature/onboarding/compliance; customer topics bug/error/account/other; send (topic+subject+body, Enter sends); back-to-messages; empty/error states.
20. **[HIGH] Server `supportSchema` enum = ['general','billing','bug','feature','onboarding','compliance']** but CUSTOMER SupportApp sends 'error'/'account'/'other' (NOT in enum) → safeParse fails → **400**; customer "Report a problem" with those topics is rejected.
21. [CODE] Verify both `support` + hidden `activityos` slugs render and the isCustomer branch shows correct copy/topics.

**I9. Task manager** (`TasksApp`)
22. Load `/api/tasks`+`/api/me`+`/api/listings?mine=1`+`/api/bookings`; role shaping (freelancer no assignee; company/franchise get Milestones tab); quick-add NL parse (`@assignee !prio #camp today`); New task modal (linked-record combobox over real records + labels + calendar-mirror); KPI tiles + When/Priority filters; My tasks grouped; Board kanban drag; Calendar Day/Week/Month; Team view; drawer (subtasks/labels/comments/attachments-stub/calendar sync); empty states.
23. **[MEDIUM] Deleting a mirrored task does NOT remove its calendar event** — `remove()` only DELETEs the task; orphaned `/api/calendar-events` entry left behind (archiving too).
24. [LOW] Quick-add `#` creates `{k:'camp'}` but 'camp' excluded from LINK_TYPES → shows blank in the picker; attachments permanent stub; task↔calendar mirror is one-way.

**I10. Milestones** (`MilestonesApp`) — HO template + per-franchise progress
25. Load template+progress (localStorage, seeds defaults); HO builder (add/edit/reorder phases/steps/actions, reset); franchise Slides + Timeline/Gantt + traffic-light; set dates/%/status/assignee; confetti on phase complete; add/push action → POST `/api/tasks`; export season plan (branded print); new season (snapshot + reset recurring); embedded in Tasks tab.
26. **[HIGH] All data localStorage only** (`aos.milestones.template/progress/history`) → HO master template + per-franchise live progress does NOT work across tenants/devices; HO and franchise read the same browser's localStorage; no per-franchise isolation; data lost on cache clear.
27. **[MEDIUM] addTask/pushAction POST to `/api/tasks` but taskId/state in localStorage** → deleting the task in Task Manager leaves the milestone showing "↗ N in Tasks"; no reconciliation.
28. **[MEDIUM] Company (non-franchise) Tasks Milestones tab embeds `mode='ho'`** (editable master template) → a plain company operator edits the HO template rather than tracking progress — confirm intended.
29. [LOW] STAFF/DEMO_STAFF assignee lists hardcoded demo names.

**I11. Events calendar** (`CalendarApp`)
30. Load `/api/listings?mine=1` (sessions) + `/api/calendar-events`; auto-jump to first month with sessions; Month/Week/Day; filters (Booking info, My events, Full month, listing legend); sessions solid vs events dashed 📌; click event → edit; add event (title/dates/all-day/category(+create → `settings.calendar.categories`)/notes/reminder); Day hourly timeline; empty/error; realtime.
31. **[MEDIUM] Reminders are a stub** — `remindMode/remindMinutes` + `calendar.reminderOn` exist but nothing sends them (Amir-owed) → confirm expected, not silently broken.
32. [LOW] Two competing reminder settings (`calendar.reminderOn` read vs ProviderNotifications `calendar-reminder` never read here); sessions read-only (click drills to Day, could read as dead click).

**I12. AI co-pilot** (`AiApp`/`AiAssistant`) — operator/staff/parent/platform
33. Empty state role greeting + starters + "Brief me on today" (operator/staff); send → `POST /api/ai/chat` (last 20, portal) → markdown reply + inferred deep-links + follow-ups; client action detection ("add a task/remind me/add to calendar") → confirm card → POST `/api/tasks` or `/api/calendar-events`; server-proposed action → `/api/ai/act`; voice TTS/mic/hands-free; per-browser history (`aos.ai.chats.v1.{kind}`, 40-cap); error restores draft.
34. **[MEDIUM] Client-side action execution** (operator/staff) can POST tasks/calendar-events on confirm → safety relies entirely on server re-checking perms → **verify `/api/tasks` + `/api/calendar-events` enforce role/scope.**
35. [LOW] Heuristic `detectAction` false-positives ("how do I set up a meeting?"); RichText `dangerouslySetInnerHTML` — verify no `javascript:`/`data:` href slips through the link regex.

**I13. Planned stubs** (`PlannedApp`) — `/platform/email`, `/platform/privacy`
36. [LOW] Render title/blurb/until-then links; confirm HQ users understand these are unbuilt (nav gives no hint though page copy is honest).

---

### AREA J — Shell, auth & i18n  [ALL LIVE unless noted]

**J1. Login** (`app/login/page.tsx`)
1. Valid email+password → `goHome()` role-routes (see 1.5).
2. `?next=` deep-link (set by RequireAuth) → after sign-in uses `next` verbatim, bypassing role lookup; verify `next` with its own query string survives.
3. Already-signed-in revisit → `useEffect` fires `goHome()` (guarded `!busy`); verify no flash of form.
4. Wrong password → generic error; ad-blocker/`network-request-failed` → distinct "Couldn't reach the sign-in service" (must NOT read as wrong password); `too-many-requests` → rate-limit message.
5. Forgot password: empty → inline; with email → reset email success/failure; show/hide toggle; link to `/signup`.
6. **[MEDIUM] `fetchRoleHome()` swallows ALL errors → returns `/custdash/browse`** → if `/api/me` briefly unreachable, a company/freelancer/platform user is sent to PARENT home, then PortalGuard bounces again → confusing double redirect on flaky networks.
7. [LOW] Reset-success message can mislead under email-enumeration protection (Firebase resolves without sending for unknown addresses).

**J2. Signup wizard** (`app/signup/page.tsx`)
8. Operator happy path (freelancer/company/franchise): type→business→identity→hear→login→payments → create Firebase user + `POST /api/register-role` → Stripe connect / bank / skip → home.
9. Per-step validation (`stepProblem`) messages; `?plan=` preselect; invite flow (`?invite=TOKEN` → preview → single form → accept → `INVITE_HOME[role]`); invite error card; `?ref=` attribution; logo upload+compress; email-already-in-use/weak-password branches.
10. **[HIGH] Orphaned-account risk**: user created in Firebase FIRST, then `/api/register-role`. If register-role fails, the Firebase account exists but tenant never provisioned; retry throws `email-already-in-use`; signing in hits `/api/me` with no tenant/role → dead-end. No cleanup/resume.
11. **[MEDIUM] Bank-details data loss**: `connectStripe()` does NOT persist bankName/sortCode/accountNumber (only `finishPayments()` does) → typing bank details then clicking "Connect with Stripe" navigates away and loses them.
12. **[MEDIUM] Invite preview uses raw `fetch(NEXT_PUBLIC_API_URL||'http://localhost:4000'…)`** → unset in a deployed build → every invite reads invalid (localhost:4000).
13. [LOW] Dead 'parent' branch (never reachable via UI); franchise signup submits role 'company' + plan 'franchise' + lands in `/company` — confirm tenant is on Franchise plan.

**J3. Root redirect** (`app/page.tsx`)
14. `GET /` → `/login` unconditionally → signed-in users bounce again (double navigation visible). [LOW] Comment claims login routes signed-in visitors, but role routing is entirely client-side.

**J4. Portal shell / layout** (`app/[portal]/layout.tsx`)
15. Unknown portal → `notFound()`; RequireAuth ("Checking session…" → redirect to `/login`, cold arrival keeps `?next`, intentional sign-out drops `?next`); PortalGuard (cached `/api/me` sync allow, cold "Checking access…", wrong operator↔operator portal swaps segment keeping view+query, 401→login, other error→fail-open); SubscriptionGate (freelancer/company); palette (light custdash/platform vs dark operator); overlays (ParentWelcome/Newsflash/Ticker for custdash; StaffWelcome/Reminder for staff); mobile drawer.
16. **[MEDIUM] SubscriptionGate gates ONLY freelancer & company**; client `isLapsed()` duplicated from server middleware with a "must not drift" warning → if server lapsed logic changes, tenant gets 402s while UI shows empty states reading as data loss. Regression-test whenever billing statuses change.
17. [LOW] PortalGuard + SubscriptionGate both fail OPEN on API error → with API down a parent sees operator shell / lapsed operator sees full app → verify downstream screens degrade gracefully.
18. [LOW] `getMe()` cached process-wide, cleared only on uid change → role/tenant/plan change mid-session (accept invite, subscription starts) shows stale until reload.

**J5. Bare-portal + View router**
19. `/company` → 307 → `/company/dashboard`; `/custdash` → `/custdash/browse`; force-dynamic page-level fallback. [LOW] Landing inconsistency (`dashboard` vs ROLE_HOME `bookings`).
20. Valid slug → `getRegisteredView`; `view='auth'` → notFound; unknown → notFound (iframe fallback removed); aliases resolve.
21. **[MEDIUM] company & freelancer register `privacy` in VIEW_REGISTRY but have NO `privacy` nav item** → GDPR "Data & privacy" reachable only by URL for those operators (discoverability/compliance gap).
22. [CODE] Cross-check `NAV_CONFIG` slugs ⊆ `VIEW_REGISTRY` keys per portal (no build-time assertion exists).

**J6. Header** (`Header.tsx`)
23. custdash tabs (Messages if messaging && !simpleMode; Browse if browse; My bookings always; Memberships if memberships+tier); operator tabs (Bookings/Announcements/Messages/Families gated); Contact-parents dropdown (Newsfeed/Messages/Email `featureOff`-filtered); Find-a-child; language selector; bug report; bell/PlatformBell; portal switcher; sign-out; `meName` live-updates via `aos:me-updated`; mobile drawer.
24. [LOW] Header issues its own `/api/me` separately from PortalGuard + Sidebar → three lookups on first paint (can briefly disagree); "My bookings" always rendered even in simpleMode — verify sensible empty state.

**J7. Sidebar** (`Sidebar.tsx`)
25. NAV_GROUPS render; hidden/caHidden filtered; empty group renders no header; brand from `getMe().tenantName` / provider; active highlight; rail collapse; live badges (messages/coupons); operator feature-off + `money.show`; custdash simpleMode + customerArea hiding + FADE fade; plural child labels; real sign-out.
26. **[MEDIUM] Franchise nav label "Learning Centre1"** (stray '1') for the `compliance` view — visible shipped typo.
27. [LOW] custdash `privacy` nav item is `hidden:true` → parents cannot reach "Data & privacy" (DSAR export/delete) from sidebar — the audience that most needs GDPR self-service has the entry point hidden.
28. [LOW] 8+ probe fetches per custdash mount to compute fading — verify no thrash on realtime 'library' events; confirm `CORE_VIEWS`/`SIMPLE_ALLOWED` never hides the parent's real landing view.

**J8. Language selector & i18n** (`LanguageSelector`, `lib/i18n/*`)
29. Pick locale → context instant + `localStorage(aos.locale)` + best-effort `PUT /api/account {locale}`; restore on load from localStorage only; RTL (Arabic/Urdu → `dir='rtl'`); fallback chain locale→English→key; `{var}` interpolation; outside-click closes; storage-blocked private mode.
30. **[MEDIUM] Locale written to account but NEVER read back** — `LanguageProvider` restores only from localStorage; `Me` has no locale field → on a new device the user always starts in English despite the "follows the user" claim. Server write is dead.
31. **[MEDIUM] 11 languages offered but only 7 base catalogs exist** — pa/bn/pt/cy map to `enBase` → selecting Panjabi/Bengali/Portuguese/Welsh renders the shell entirely in English.
32. **[MEDIUM] Only a handful of areas translated** at all; the vast majority of every screen is hardcoded English regardless of locale; RTL is set on `<html>` but layout is LTR-fixed Tailwind → Arabic/Urdu render mirrored-text in an un-mirrored layout (flag RTL visual breakage).
33. [LOW] Initial render always DEFAULT_LOCALE → flash of English/LTR then flip to saved RTL on every load.

**J9. Data & privacy** (`PrivacyApp`)
34. Load `/api/privacy` → summary counts (non-zero via LABELS); Export → `/api/privacy/export` → download JSON; Delete request → confirm() → `POST /api/privacy/delete-request` (success / "already on file"); empty/error states.
35. **[MEDIUM] Entry-point discoverability**: nav-linked only for franchise + platform (platform's is a Coming-soon stub) → company/freelancer operators and parents reach it solely by URL — a real GDPR/DSAR gap.
36. [LOW] Fully English/hardcoded (no i18n) despite legally-sensitive consent/deletion wording for non-English parents; re-request repeatable (server returns alreadyRequested — verify surfaced).

**J10. Subscription gate** (`SubscriptionGate` → `SubscriptionApp`)
37. Fresh signup (status none) → plan picker → `onStarted` reveals shell; lapsed (canceled/past_due/canceling) → gated; active/no-subscription-field → pass through; loading spinner; API error → fail-open; non-gated portals never call `/api/subscription`.
38. **[MEDIUM] Client `isLapsed()` must stay byte-for-byte with `server/src/middleware/subscription.ts`** — drift → API 402s everything while shell shows empty states as data loss. Recommend a shared source or contract test.

---

## 3. SETTINGS ON/OFF MATRIX (highest-value section)

> Verify column: **[dead]** = flip it and confirm NOTHING changes (proves the bug). **[real]** = flip it and confirm the described change. **[cosmetic-legacy]** = legacy `SETUPFLAGS`, always dead.

### 3.1 Legacy `window.SETUPFLAGS` (prototype.html) — ALL cosmetic/write-only

| Toggle | Claims to control | Actual | Verify |
|---|---|---|---|
| Take payments online? | Whether takings/payout figures + checkout show | **Never read** — write-only (L8761) | [cosmetic-legacy] Finance renders identically on/off |
| Payments settle to your own Stripe | Purchasing "records-only" behaviour | Never read | [cosmetic-legacy] Purchasing identical |
| Tax-Free Childcare (TFC)? | Show/hide TFC reconcile rows + checkout TFC method + parent TFC card | Never read | [cosmetic-legacy] TFC rows/method/card always render (A3.20, A9, B9.43) |
| Card / Apple Pay / Google Pay? | Show card method in checkout | Never read; methods hardcoded | [cosmetic-legacy] B9.43 |
| PayPal? | Show PayPal method | Never read; no PayPal option ever surfaces | [cosmetic-legacy] |
| HAF? | HAF funded method | Never read; hardcoded when `l.funded` | [cosmetic-legacy] |
| Discount codes & coupons | Enable coupon entry | Never read; no coupon box in checkout at all | [cosmetic-legacy] B9.44 |

**Legacy globals that DO gate** (separate from SETUPFLAGS): `LBFEAT.meta[k].on` (builder sections), `LBSET.showAge` (age badges off/always/diff), `LBSET.presetTimes`, `S.proRata`, `LBSET.savedCards`, `RP.feeMode` (customer/provider fee line), `RP.tiers/allowDayCancel/autoReleaseWaitlist/offerCredit`, `l.approval`, `l.funded`, `SPLIT.fr[].scope` (all/bookings). [real, verify each per B2/A6/B9.]

### 3.2 TenantSettings `features[view]` (real tree)

| Key | Effect | Verify |
|---|---|---|
| `features[view]` (non-CORE) | Hides operator Sidebar item; for family-facing, cascades to custdash | [real] nav hides — **but route still resolves by URL (never enforced)** (I6.13, F53) |
| `features['staff'/'documents'/etc.]` | Hides operator nav | [real] nav-only; NOT applied to staff portal (E75) |
| `features['messages'/'newsfeed'/'moments'/'email']` | Should be toggleable | **[dead UI]** — these are `hidden:true` so their Features row never renders → cannot be toggled from Setup at all (G8) |

### 3.3 `customerArea.*` (parent cascade)

| Key | Effect | Verify |
|---|---|---|
| `simpleMode` | Strips custdash to home/browse/bookings/children/account/privacy/support; hides ticker | [real] — but applied only in Sidebar/Header/Ticker, NOT in `useCustomerArea` (G43) |
| `wallet` | Drops Wallet tab + removes as refund destination | [real] nav; wallet itself dead (D38) |
| `browse` | Drops Browse tab | [real] |
| `messaging` | Hides parent Messages tab | [real] nav — **no reachable Setup control** (hidden feature row, G8); component doesn't self-gate (URL-reachable) |
| `newsfeed` | Hides parent Newsfeed | [real] nav — but **NewsflashBanner ignores it** (D52); no reachable Setup control |
| `moments` | Hides "My child's day" | [real] (FADE) — no reachable Setup control |
| `coupons` | Hides Coupons page | [real]; cascaded off by `features.marketing` |
| `codesBanner` | Hides coupon ticker | [real]; independent of `coupons` (can scroll codes with no page, F42) |
| `memberships` | Hides Memberships (requires `memberships.enabled`+tier) | [real] |
| `refer` | Hides Refer (requires `referral.enabled`) | [real] |
| `timetable` | Gates `custdash/timetable` (ParentTimetableApp), NOT the BookingsHub Schedule tab | [real] (D28) |
| `trips` / `accidents` / `medication` | Hide those parent tabs | **[verify]** — NOT re-derived from operator features in `useCustomerArea` (G44); confirm round-trip works |

### 3.4 Money / roles / notifications

| Key | Effect | Verify |
|---|---|---|
| `money.show='incoming'` | Hides Money-out (Expenses) | [real] |
| `money.show='outgoing'` | Should hide incoming views | **[dead half]** — `MONEY_INCOMING_VIEWS` is [] → hides nothing (G42) |
| `roles[].caps[area]` (None/View/Edit) | Gate nav/actions/money tiles per role | **[dead]** — saved but no consumer; intro copy untrue (G12) |
| `roles[].scope` (all/assigned) | Scope registers/ratios/listings | **[dead]** — not enforced |
| `staff.inviteMessage/assignByLeads/requireDBS/requireCompliance` | Invite message + DBS/compliance gates | **[dead]** — never consumed (E8) |
| `staff.requireDBS/requireCompliance` (safeguarding view) | Block out-of-date DBS from working | **[dead front-end]** — never read; enforcement backend (H17) |
| `notifications[key]` | Suppress bell+email for that alert | [real] — server `notify()` reads it |
| `notifications['email-delivery']` | Bell fires, no email | [real] — **but assert `lib/settings.ts` and `server/src/lib/notify.ts` default lists identical** (G16) |

### 3.5 Booking / checkout / voucher

| Key | Effect | Verify |
|---|---|---|
| `RP.feeMode` (customer/provider) | Adds processing-fee line | [real legacy] |
| `listing.allowOutOfRange` | Out-of-range child books as approval request | [real] |
| `listing.waitlist/waitlistMode/waitlistSize` | Sold-out vs join-waitlist wording | [real] |
| `listing.opensAt` / `bookingType` | Locks booking / approval copy | [real] |
| `settings.payMethods` / `listing.payMethods` | Checkout methods (real tree) | [real] — but **legacy `rBook` ignores them** (B9.43) |
| `voucherProviders[].details[]` | Scheme offerable only if a detail is filled | [real] |
| `voucherClearDays` / `voucherDueByDays` | Hide vouchers when booking too soon | [real] |
| `voucherWhenClose='approve'` | Hold-for-approval | **[stub]** — unbuilt; verify no silent fall-through to normal (G20) |
| `voucherHoldDays` | Dashboard-flag overdue vouchers | [real] |
| `refundApproval='auto'` | Auto Stripe refund without approval | **[dead]** — read only in SetupApp; every refund manual (G48) |
| `cancellationPolicies/allowCardRefund/refundLetCustomerChoose/allowPartialCancel/...` | Cancel/refund options + destinations | [real] (D21) |
| `allowDateChanges/amendSelfService/amendNoticeHours/amendFee/amendAllowCheaper` | Amend rules | [real UI] — but amend endpoint not live → optimistic-pending dead-end (D23) |

### 3.6 Child questions / people

| Key | Effect | Verify |
|---|---|---|
| `childQuestions[]` (scope/age/ask/hidden) | Which questions at checkout/Families | [real] |
| `requireDob` | DOB mandatory (forced on if any age-gated question) | [real] |
| `question.reviewIfNo` / `kind:'toilet'` | "No" holds booking for manual acceptance | **[dead half]** — `heldForReview()` has ZERO callers → never holds; `needsNappies` register badge IS wired (G26) |
| `collectGender/collectPhoto/collectSend/collectSendPlan/askPhotoConsent/collectionCheck/dobRequired` | Drive add-child form | [real] |
| `charLimits.{allergies,medical,dietary,send,likes,dislikes}` | Free-text maxLength | [real] |

### 3.7 Memberships / referral

| Key | Effect | Verify |
|---|---|---|
| `memberships.enabled + tiers[].enabled` | Family page shows only if enabled AND ≥1 tier | [real] (empty-page guard) |
| `membership tier benefitType/benefitValue` | credit→wallet / percent→standing % | [real] (billing Stripe stub) |
| `referral.enabled` | Gates parent Refer page (+`!featureOff`) | [real]; operator Referrals dashboard NOT gated (F13) |
| `referral.type/friendOff/referrerReward/minSpend/capToFriendSpend` | Reward math | [real] |

### 3.8 Staff-slice (separate localStorage, not TenantSettings)

| Key | Store | Effect | Verify |
|---|---|---|---|
| Holiday policy | `aos.holiday.policy.v1` | ALL entitlement/SSP/region maths | [real but per-device] — invisible to Setup; second device sees DEFAULT (E33) |
| ClockSettings (`payPolicy/autoPayOvertime/graceMin/rounding/leadLabel`) | `aos.timeclock.settings.v1` | Pay hours / lateness / lead visibility | [real but per-device]; `graceMin` competes with `scheduling.checkinGraceMin` (E45) |
| `scheduling.staffSeeTeamAbsence` | TenantSettings | Hide team week strip | [real] |
| `scheduling.coworkerVisibility` (all/team/leads/none) | TenantSettings | Gate "Who's clocked in" | [real] |
| `scheduling.autoRequestAvailability` | TenantSettings | Auto-request availability | **[dead]** — no consumer (G48) |
| `announcements.leadsCanPost` | TenantSettings | Lead composer | [real] |
| `announcements.enabled/requireAck/dashboardDays/defaultAudience/defaultImportant` | TenantSettings | Board on/off, must-confirm-read | **[partly dead]** — enabled/requireAck never read by board or composer (E69, F27); default* read by composer |

### 3.9 Safeguarding & extras

| Key | Effect | Verify |
|---|---|---|
| `medication.requireWitness` | Witness mandatory per dose | [real] |
| `medication.leadsOnly` | Staff can't record | [real] — **fails OPEN on `/api/me` failure** (H23) |
| `medication.informParentGiven/Missed` | Only the "parent informed" TEXT | [real text, no actual send] (H22) |
| `medication.remindWhenDue` | Bell staff when dose due | **[dead]** — never read; UI promises a bell (H21) |
| `medication.notifyParentNote/notifyParentAuthorise` | Backend notify | [not front-end] |
| `safeguarding.notifyParentAccident/notifyParentIncident` | "Parent will be emailed" banner | [real banner]; incident default OFF causes inconsistency (H28) |
| `safeguarding.requireAcknowledgement` | Parent ack nag | [real via per-record `requireAck`]; per-record ack renders even when false (H36) |
| `safeguarding.dslTitle/dslName/categories/protocol/contacts` | Concern form routing/labels/steps/numbers | [real] |
| `safeguarding.dslEmail` | Email concerns to DSL | **[dead]** — 0 references (H32) |
| `trips.whoCanPlan` (all/leads/managers) | Who can plan on staff portal | **[partly dead]** — only `='all'` checked; leads/managers both block all staff (H38) |
| `trips.ratioTarget/notifyParent` | Ratio default / chase banner | [real] |
| `trips.requireConsent` | Block "mark ready" until all consented | **[dead]** — never read; always consent-gates anyway (H39) |
| `meals.menuShare/cutoffWhen/cutoffTime/allergenNote/changeApproval` | Menu visibility/cutoff/disclaimer/approval | [real, enforced server-side] |
| `meals.ordering/showAllergens/orderCutoffHours/menuNote` | Pre-order / show allergens / cutoff / note | **[dead ×4]** — read nowhere (H44) |
| `learning.passMark/renewMonths/requirePolicyConfirm/cert*` | Course/cert config | [real] |
| `learning.trackTraining/observations/autoCert/selfEnrol/framework` | Various | **[dead ×5]** — never enforced (H6) |
| `inventory.categories/locations/seasons/currentSeason/checkEveryDays/orderExpenseStatus/orderCategory` | Pickers / stale flag / order defaults | [real] |
| `inventory.lowStockAlert` | Warn at reorder level | **[dead]** — badge always shows (H50) |

### 3.10 Calendar / privacy / i18n / subscription

| Key | Effect | Verify |
|---|---|---|
| `calendar.reminderOn/reminderMinutes` | Default reminder mode/timing | [real UI, no send] — reminders unbuilt (I31) |
| `calendar.categories` | Event categories/colours | [real] |
| ProviderNotifications `calendar-reminder` | Reminder pref | **[dead here]** — CalendarApp never reads it; competes with `calendar.reminderOn` (I32) |
| `account.locale` (per-user) | Language follows user across devices | **[dead read-back]** — written but never read; localStorage only (J30) |
| `GATED_PORTALS` (code const) | Only freelancer+company walled by subscription | [real] — franchise/staff inherit via invite |

---

## 4. Cross-Portal / Cross-Flow Scenarios

> These exercise data flowing between portals. Because most slices are demo/localStorage/unmigrated, **most of these will FAIL or dead-end** — the point is to confirm exactly where the break is.

**X1. Operator creates listing → parent books → registers → money → payroll (the headline E2E).**
Expected to break at step 1: legacy `lbPublish()` doesn't persist and doesn't push to `CX.listings` (B16), and there's no `app/store`/`app/book` route serving the slug (B26). Verify each hop: (a) publish a listing in the legacy builder; (b) confirm it does NOT appear in the operator list or Customer Browse; (c) separately, book a *seeded* `CX` listing via `rBook`; (d) confirm the booking does NOT flow to any register/money/payroll (all independent demo datasets). **This is the single most important "does the product hang together" test — document every broken hop.**

**X2. Operator (real tree) takes a booking → appears in list → detail → refund.**
`TakeBookingModal` → new Confirmed booking in the Zustand list (C26) → open detail → issue refund. Confirm: refund math doesn't double-count (C21), and a reload wipes everything (C12). Then confirm the same booking does NOT appear in franchise/freelancer bookings (separate legacy `pbRender` path, C11).

**X3. Discount code reserved to a family → parent redemption.**
Operator reserves code to a family (F3) → confirm it lands in that family's Coupons (`CouponsApp`) + ticker → parent enters it at checkout → `/api/discounts/validate` (D10). In the **legacy** checkout there is no coupon entry at all (B44), so this only works in the real-tree `checkout.tsx`. Cross-check exclusivity/stacking.

**X4. Referral: friend books with `?ref=CODE` → referrer reward → operator Referrals dashboard.**
Parent A shares code (`ReferApp`) → Parent B books with `?ref=` auto-applied (D10) → confirm friendOff applied + referrer code issued into A's Coupons + `capToFriendSpend` cap → confirm operator `ReferralsApp` (I/F2) reflects it. Note reward mint is server-side.

**X5. Membership join → benefit at checkout → wallet/discount delivery → account close.**
Enable membership tier in Setup (G27) → parent joins (`MembershipsApp`) → confirm % perk auto-applies at checkout (D10) OR credit tops up wallet (dead — D38) → then close account (`CloseAccount`) → **confirm the contract mismatch** (`{current}` vs `{mine}`) doesn't leave an active membership uncancelled (D39/D48).

**X6. Staff invite → onboarding → SCR → deployment → documents → appraisal.**
Invite a staffer (`TeamApp`, E1) → **confirm they NEVER appear** in Onboarding/SCR/Appraisals/Deployment (all iterate `DEMO_STAFF`, E7). Accept an application → same dead-end (E13). This is the staff-slice equivalent of X1 — the invite pipeline and the management tabs are disconnected.

**X7. Staff clocks in → timesheet → approve → payroll → holiday "who's off" cover.**
Staff clocks in as Marcus (E48) → operator Timesheets shows today only (daily reset, E44) → Approve→payroll (local stamp only, E46) → book leave (`HolidayApp`) → confirm "COVER" flag appears in Who's-off where Marcus is rostered (`aos.rota.v5`, E30). All Marcus, all per-device.

**X8. Toilet-training / reviewIfNo hold-for-review.**
Configure the toilet question `reviewIfNo=true` in Setup (G23) → parent answers "No" at checkout → **confirm the booking auto-confirms (bug, G26)** rather than being held → confirm the register nappy badge (`needsNappies`) DOES show (the wired half). Demonstrates the half-built feature.

**X9. Operator publishes timetable → staff portal + parents.**
`PublishPanel` publish (C44) → confirm staff portal and parent `ParentTimetableApp` receive **nothing** (pure mock). Cross-check parent `customerArea.timetable` gating (D28).

**X10. Provider posts a Moment / Newsfeed → parent sees it → replies.**
Operator posts child photo (consent-gated) / newsfeed post → parent `ParentMomentsApp`/`ParentNewsfeedApp` reflects it + notification. Confirm NewsflashBanner shows even when `customerArea.newsfeed` off (D52). Confirm per-parent react/RSVP state is localStorage-only (F47).

**X11. Provider ↔ HQ support round-trip.**
Provider sends "Message ActivityOS" (`SupportApp`, `supportMessages` collection) → **confirm it NEVER appears in HQ `SupportInboxApp`** (`supportThreads` collection) and vice-versa (I17). Then submit a customer "Report a problem" with topic 'error'/'account'/'other' → **confirm 400** (server enum rejects, I20).

**X12. HQ disables a feature for a provider → provider still reaches it by URL.**
`PlatformFeaturesApp` toggle `tasks`/`calendar`/`ai` off for a tenant → confirm nav item hides in that provider's Sidebar but `/company/tasks` etc. still render (I13). Applies to every feature.

**X13. Milestones HO template → per-franchise progress.**
Edit HO master template → confirm a "franchise" (different browser/tenant) does NOT see it (localStorage-only, I26). Confirm a company operator's Tasks Milestones tab edits the HO template (`mode='ho'`, I28).

**X14. Task → calendar mirror → delete.**
Create a task with "also show in Events calendar" → confirm event appears in `CalendarApp` → delete the task → **confirm the calendar event is orphaned** (I23).

**X15. Signup → tenant provisioning → first login role-routing.**
Complete signup (J8) → confirm `/api/register-role` provisioned the tenant → sign out → sign in → confirm role-routing lands correctly. Then simulate register-role failure → **confirm orphaned Firebase account dead-end** (J10). Also test franchise-plan signup lands in `/company` on the Franchise plan (J13).

**X16. Subscription lapse gate.**
Set a freelancer/company tenant to `past_due`/`canceled` → confirm SubscriptionGate walls the shell (J37) → confirm client `isLapsed()` matches server middleware (J38). Confirm franchise/staff/custdash are never gated.

**X17. Language change across devices.**
Set locale to Polish on device A → confirm shell strings change (7 catalogs) → sign in on device B → **confirm it reverts to English** (locale not read back, J30). Select Welsh/Bengali → confirm shell stays English (no catalog, J31). Select Arabic → confirm mirrored-text-in-LTR-layout breakage (J32).

**X18. GDPR/DSAR discoverability.**
As a parent and as a company/freelancer operator, try to reach "Data & privacy" from the sidebar → **confirm it's unreachable except by URL** (J21/J27/J35).

**X19. Settings persistence under concurrency + network failure.**
Two operator tabs edit different Setup sections → confirm PUT merges, not clobbers (G36). Edit a field then immediately navigate away under a failing network → confirm the silent-lost-save risk (G39).

**X20. Franchise venue aggregation (money).**
On franchise Finance select venue "all" → confirm it silently shows only Milton Keynes (A5) — a misleading cross-venue total.

---

## 5. Prioritised Suspected Issues / Likely Bugs (deduped, aggregated)

### CRITICAL / HIGH (fix or gate before any pilot)

**Money & finance (all legacy, unmigrated, client-side demo — `public/legacy/prototype.html`)**
1. **No settings gate any money view** — `SETUPFLAGS` is write-only; the four money toggles are cosmetic. Single biggest settings gap. `prototype.html`
2. **Entire Money slice unmigrated** — `features/money/reconciliation/payments/payroll` + `server/src/routes` don't exist as React; no backend/persistence. `prototype.html`
3. **Customer wallet grants free credit** — `cdWalTop()` increments balance with no payment/card/confirmation. `prototype.html`
4. **Payouts is a dead nav reference** — declared in `SBMAP.admin`, no view/container exists → unreachable. `prototype.html`
5. **`renderFinance('admin')` no-ops** (targets non-existent `faMount_admin_finance`); arg-less calls hit `faMount_undefined_finance`. `prototype.html`
6. **Admin payroll is an orphan** — built in the admin DOM block but absent from `SBMAP.admin` → unreachable from admin nav. `prototype.html`
7. **Frozen clocks** — Purchasing pins `TODAY=2026-06-15`; reconciliation/finance use fixed demo dates → all overdue/days-to math wrong vs 2026-09-02. `prototype.html`

**Listings & storefront (legacy)**
8. **Publish is a dead-end** — `lbPublish()` only re-renders a review; no persistence, nothing reaches the operator list or `CX` storefront. `prototype.html`
9. **No `app/store/[tenantId]` route** — no real tenant-scoped storefront exists. `app/legacy/LegacyPrototype.tsx`
10. **Multi-child checkout undercharges** — `flowTotal()` non-basket branch has no ×kids multiplier while UI says "prices per child". `prototype.html`
11. **Checkout payment methods hardcoded**, ignore Setup toggles (TFC shows when off; PayPal/Card never surface). `prototype.html`
12. **No coupon entry in checkout** despite the Discount-codes toggle + completed tasks. `prototype.html`
13. **`SETUPFLAGS` write-only** (Setup & features screen claims "server re-checks the flag"). `prototype.html`

**Bookings & ops (real tree)**
14. **Refund requests dead-end** — "Refund pending" badge with no approve/decline UI; `act(ref,'refund-approve'|'refund-decline')` never called. `features/bookings/BookingsList.tsx` / `store.ts`
15. **Per-day/per-child refund double-refund** — `cancelChild` adds a whole-place refundLog entry without subtracting prior per-day refunds. `features/bookings/store.ts`
16. **Timetable Publish is a pure mock** — no persistence, no staff/parent delivery, no notify toggles despite task marked complete. `features/timetable/store.ts`
17. **Registers unmigrated + uncommitted** (Register v2 in a legacy working tree) — out of scope for the React harness. `prototype.html`
18. **Schedule/rota split-brain** — availability requests hit real `/api/availability` but rota grid is client-side `window.ROTA`. `prototype.html`

**Parent portal**
19. **"Confirm & pay" takes no card details** — Stripe unbuilt; booking lands unpaid. `features/listings/checkout.tsx`
20. **`DATE_CHANGES_LIVE` hardcoded true but amend endpoint not live** — optimistic `aos.pendingMove` in localStorage shows "pending" forever, per-device. `features/parent/MyBookingsApp.tsx`
21. **No sign-in gate on public `/book/[id]`** — Confirm → 401 raw error. `features/storefront/BookPage.tsx`

**Staff & team (all hardcoded `Marcus Bell` / `DEMO_STAFF`, localStorage)**
22. **Invite pipeline disconnected from all management tabs** — invited staff never appear in Onboarding/SCR/Appraisals/Deployment/Holiday/Timeclock. `features/team/TeamApp.tsx`
23. **Recruitment→onboarding dead-end** — accepted applicant carried over by name, never appears (roster iterates `DEMO_STAFF`). `features/team/ApplicationsApp.tsx`
24. **Staff reminder "N courses" → `/{portal}/training` which is unregistered → 404** for any staffer with outstanding courses. `features/staff/StaffReminderBanner.tsx`
25. **Hardcoded `ME='Marcus Bell'`** across clock/holiday/onboarding/appraisals/docs → every staff user sees Marcus; multi-user QA impossible without code edits.
26. **Sensitive data (bank/NI/DBS) in plain localStorage** — data-protection blocker. `features/team/OnboardingApp.tsx`, `StaffOnboardingApp.tsx`

**Comms & marketing**
27. (see #40 below — HQ/provider support disconnect and customer topic 400 are HIGH)

**Setup backbone**
28. **`reviewIfNo`/`heldForReview()` not wired** — "No" answers (incl. toilet-training) never hold a booking; auto-confirm. The wired `needsNappies` badge masks it. `lib/settings.ts`
29. **Features grid hides `messages/newsfeed/moments/email` rows** — operator cannot disable them, and `customerArea.messaging/.newsfeed/.moments` have NO reachable Setup control (permanently default true). `features/setup/SetupApp.tsx`

**Safeguarding & extras**
30. **Learning Centre entirely front-end demo** — courses/assignments/completions/certs in localStorage + SEED; "notified"/"reminder sent" cosmetic; compliance figures fabricated. `features/learning/LearningCentreApp.tsx`
31. **Three overlapping, unbridged staff-certificate stores** — `ComplianceApp` (real `/api/compliance`) vs `CredentialsApp`/`StaffCertsApp` (demo) → a DBS added in one never appears in the other. `features/compliance/ComplianceApp.tsx`

**Platform HQ**
32. **Feature-off is nav-only, never route-enforced** — any "disabled" page reachable by direct URL (system-wide). `app/[portal]/[view]/page.tsx`
33. **HQ support inbox (`supportThreads`) and provider/customer SupportApp (`supportMessages`) are different collections** — messages never cross between them. `server/src/routes/platformSupport.ts`
34. **Customer "Report a problem" topics 'error'/'account'/'other' rejected by server enum → 400.** `features/support/SupportApp.tsx` / `server/src/routes/messages.ts`
35. **Milestones HO↔franchise is localStorage-only** — no per-franchise isolation, no cross-tenant/device sync; core promise broken. `features/milestones/data.ts`

**Shell / auth**
36. **Signup orphaned-account risk** — Firebase user created before `/api/register-role`; on failure the account exists with no tenant → login dead-end, no cleanup. `app/signup/page.tsx`

### MEDIUM

37. Franchise Finance forces venue "all"→"Milton Keynes" — misleading totals. `prototype.html`
38. `TakeBookingModal.createBooking` always "Confirmed" regardless of method/approval; no capacity checks. `features/bookings/store.ts`
39. Bookings admin-only React carve-out — franchise/freelancer run divergent legacy `pbRender`. `app/legacy/mountBookings.tsx`
40. Timetable auto-regen inconsistent (category/facility/group/activity edits don't regen). `features/timetable/store.ts`
41. Timetable shared Zustand store across all three portal hosts — HO/franchise/freelancer share identical data. `app/legacy/mountTimetable.tsx`
42. Partial-refund input unvalidated (over/negative refund). `features/bookings/BookingDetail.tsx`
43. Browse Phase-1 scoping dead-ends new families (no show-everything fallback). `features/parent/BrowseApp.tsx`
44. Wallet non-functional (`/api/my/wallet` not built) while nav/toggle imply it works. `features/parent/WalletApp.tsx`, `checkout.tsx`, `AccountApp.tsx`
45. Membership API contract mismatch (`{current}` vs `{mine}`) → CloseAccount may not cancel active memberships. `features/account/AccountApp.tsx`
46. `/api/account/deactivate` may be a stub → "closed" account might still allow login. `features/account/AccountApp.tsx`
47. Remove-child guard matches by lowercased NAME → same-named siblings both locked. `features/parent/ChildrenApp.tsx`
48. NewsflashBanner not gated by `customerArea.newsfeed`. `features/parent/NewsflashBanner.tsx`
49. `settings.staff.*` (inviteMessage/assignByLeads/requireDBS/requireCompliance) never consumed. `lib/settings.ts`
50. Holiday policy + ClockSettings in per-device localStorage, not TenantSettings → managers/devices disagree; daily timesheet reset wipes history. `features/holiday/data.ts`, `features/timeclock/data.ts`
51. Geolocation race — first staff clock-in never captures location (stale closure). `features/timeclock/TimeClockApp.tsx`
52. `ROLE_CAPS` defined but never enforced; Setup→Features doesn't cascade to staff portal. `lib/settings.ts`, `lib/use-customer-area.ts`
53. Operator Documents/Appraisals/Onboarding registered only for company/some portals → franchise/freelancer gaps. `lib/view-registry.tsx`
54. Messages Enter-sends with no confirmation in broadcast/group mode. `features/messages/MessagesApp.tsx`
55. Broadcast merge-field gap — `{ChildName}`/booking tokens go out literally. `features/messages/MessagesApp.tsx`
56. Staff portal gets full operator Messages inbox (broadcast to all families/listings) with no scoping. `lib/view-registry.tsx`
57. Scheduled newsfeed posts / emails rely on an unverified backend scheduler. `features/newsfeed/NewsfeedApp.tsx`, `features/email/EmailApp.tsx`
58. StaffNotifyComposer ignores `announcements.enabled`/`requireAck`. `features/newsfeed/StaffNotifyComposer.tsx`
59. Email Inbox falls back to 5 fabricated `DEMO_INBOX` enquiries → pollutes enquiry board. `features/email/EmailApp.tsx`
60. Auto-emails + analytics inert without backend engine (0% open rate, "—" click, no unsubscribe). `features/email/EmailApp.tsx`
61. Reviews hub has no loading state; failed fetch swallowed → looks like zero reviews. `features/reviews/ReviewsApp.tsx`
62. Discount-code reservation-clear inconsistency (`assignedTo` sent as undefined may not clear via PUT-merge). `features/marketing/MarketingApp.tsx`
63. Roles matrix saved-but-inert (caps/scope no consumer); intro copy untrue. `features/setup/RolesPermissions.tsx`
64. Silent lost save on unmount-flush PUT failure. `lib/settings.ts`
65. `money.show='outgoing'` hides nothing (empty `MONEY_INCOMING_VIEWS`). `lib/use-customer-area.ts`
66. Simple-mode enforced only in Sidebar/Header/Ticker, not `useCustomerArea` (fragile). `lib/use-customer-area.ts`
67. `useCustomerArea` cascade incomplete (wallet/browse/timetable/trips/accidents/medication not re-derived). `lib/use-customer-area.ts`
68. `staff.requireDBS/requireCompliance` never enforced front-end. `lib/settings.ts`
69. `medication.remindWhenDue` dead toggle (UI promises a bell). `lib/settings.ts`
70. Medication `leadsOnly` fails OPEN on `/api/me` failure. `features/medication/MedicationApp.tsx`
71. Medication/accident parent notify-mute localStorage-only, drives no real behaviour. `features/medication/ParentMedicationApp.tsx`, `features/incidents/ParentAccidentsApp.tsx`
72. `safeguarding.dslEmail` dead (0 references). `lib/settings.ts`
73. `trips.whoCanPlan` only checks `='all'` (leads/managers collapse to block-all). `features/trips/TripsApp.tsx`
74. `trips.requireConsent` dead toggle. `lib/settings.ts`
75. Four dead meal settings (ordering/showAllergens/orderCutoffHours/menuNote). `features/setup/SetupApp.tsx`
76. Five dead learning settings (trackTraining/observations/autoCert/selfEnrol/framework). `lib/settings.ts`
77. `refundApproval='auto'`, `inventory.lowStockAlert`, `scheduling.autoRequestAvailability` dead toggles. `lib/settings.ts`, `features/setup/SetupApp.tsx`
78. Notification defaults duplicated in `lib/settings.ts` + `server/src/lib/notify.ts` — drift risk. `lib/settings.ts`
79. Task delete orphans mirrored calendar event. `features/tasks/TasksApp.tsx`
80. CSV lead import dedupes only by email → duplicate emailless rows. `features/platform/SalesApp.tsx`
81. `PlatformFeaturesApp` PAGES list can drift from nav/registry (no-op toggles). `features/platform/PlatformFeaturesApp.tsx`
82. AI client-side action execution (POST tasks/calendar) — safety depends entirely on server perms recheck; verify. `features/ai/AiApp.tsx`
83. Calendar reminders stub + two competing reminder settings. `features/calendar/CalendarApp.tsx`, `lib/settings.ts`
84. `fetchRoleHome()` swallows errors → operators sent to parent home on flaky `/api/me`. `lib/roles.ts`
85. Signup bank-details lost on "Connect with Stripe"; invite preview uses raw fetch → localhost fallback in prod. `app/signup/page.tsx`
86. SubscriptionGate client `isLapsed()` must not drift from server middleware. `components/auth/SubscriptionGate.tsx`
87. Locale written to account but never read back; 11 languages offered / 7 catalogs; RTL-in-LTR layout breakage. `lib/i18n/provider.tsx`, `messages/index.ts`, `config.ts`
88. company/freelancer `privacy` reachable only by URL (GDPR discoverability gap); custdash `privacy` hidden from parents. `lib/nav/config.ts`
89. Sidebar typo "Learning Centre1" (franchise, `compliance` view). `lib/nav/config.ts`

### LOW (representative — full list in the per-area sections)

Legacy: recEmail/TFC mocked; expenses recurring flag cosmetic; receipt uploads not stored; blocking `alert()` validation; frozen scoping copy per portal; split excludes memberships; subscription mount-empty risk; coupon map bypassable. Real tree: `unpaid` filter gaps; PayStatus widened to string; `bs` vs `live` badge filtering inconsistency; empty-state omissions (Templates, Providers, Coupons, Wallet); highlight regex letter-only; folder-count mismatches (Moments); geocoding per-load; length-filter mis-bucket; `dashboard` vs `bookings` landing inconsistency; three redundant `/api/me` lookups on first paint; 8+ Sidebar probe fetches; platform planned() stubs presented as live nav items; PrivacyApp/hardcoded-English no-i18n; straight-line projections; "since 2026" hardcoded date replace; engagement filter omits Franchise; `at-risk` unknown-reason grey chip; `toggleActGroup` index-vs-id drift; `savedCards` seed guard; inventory carry-over side-effect on `currentSeason`; meal unpaid-order cell hold; allergen synonym false-negatives.

---

### Appendix — Testing order recommendation for the agent fleet

1. **[CODE] first** (no running app): nav-slug ⊆ registry assertion (G47); notification default-list parity (G16); dead-toggle grep audit (Section 3 `[dead]` rows); the two-repo confirmation (1.1).
2. **[LIVE real-tree] second**: auth/shell/subscription (Area J), Setup persistence + Features/customerArea gating (Area G), then parent checkout + bookings admin (Areas D, C) — these have real backends and the highest-value functional bugs.
3. **[LIVE-LEGACY] third**: Money (Area A), legacy Listings/checkout (Area B), Registers/Ratios/Schedule (C8–C10) — manual only, expect demo/reset behaviour throughout.
4. **Cross-flow (Section 4) last** — they depend on the per-area results and mostly document *where* the product doesn't yet hang together.

Key files to keep open: `public/legacy/prototype.html` (all money + legacy listings/registers/ratios/schedule), `lib/settings.ts` (settings backbone + dead toggles), `lib/use-customer-area.ts` + `components/shell/Sidebar.tsx` (gating), `lib/view-registry.tsx` + `lib/nav/config.ts` (routing/parity), `features/bookings/store.ts` (refund math), `features/setup/SetupApp.tsx` (features grid + reviewIfNo).