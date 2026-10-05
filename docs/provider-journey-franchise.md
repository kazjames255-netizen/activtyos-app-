# Provider journey: brand-new FRANCHISE operator (4 Oct 2026)

Method: local stack (web :3000, API :4000), Playwright, desktop 1280 (Chromium) plus WebKit iPhone 13 for key screens. Fresh `@activityos-test.com` accounts: head office "Brightstar Camps" (company, unwalled with `e2e-unwall`), franchisee "Sunny Days Northampton" (via the real invite link, signed out), a sibling franchise "Rival Rovers Leicester" (for isolation probes) and one parent.
Spec: `e2e/zz-journey-franchise.spec.ts` (config `e2e/zz-journey-franchise.config.ts`; stages S1..S23 re-runnable, state in `e2e/review/shots/journey-franchise/state.json`). Screenshots: `e2e/review/shots/journey-franchise/NN-name.png` (117). Page texts: `.../texts/`. No product source was edited.

"Time" = measured page-load/wait time where recorded, otherwise an estimate for a human (marked ~). "Clicks" = clicks/keystroke groups a human needs from the previous step.

## 1. Step table

| # | Step | Screen (shot) | Time | Clicks | Verdict |
|---|------|---------------|------|--------|---------|
| HO-1 | Head office signs in | `/company/bookings` empty (01) | 5s | 3 | OK-ish. Lands on an empty Bookings list, no welcome or "what to do next" |
| HO-2 | Find invite page | sidebar groups all collapsed (02), Franchises > Invite franchises (03) | ~10s | 2 | Slight hunt: FRANCHISES group is collapsed, "Territories map" is not in the sidebar until a franchise exists |
| HO-3 | Invite a franchisee | name + area + email form (04, 05) | 3s | 4 | Works, but form has ONLY name/area/email. No royalty %, no feature toggles, no territory, no cost note (F7) |
| FR-1 | Franchisee opens link signed-out | `/signup?invite=` desktop (07), phone (06) | 5s | 1 | Name/area locked "set by head office" is good. Email not pre-filled, dark-purple panel is low contrast, phone layout overflows right edge (F9) |
| FR-2 | Create account | name, email, password -> `/franchise/bookings` (08, 09) | 17s | 2 | Fast. Lands on an empty Bookings list. No welcome, no checklist (F5) |
| FR-3 | Dashboard | (10) | 7s | 1 | Shows "Are you a tutor? Start here" banner but nothing about franchise onboarding |
| FR-4 | Setup & features | 30+ pill tabs (11, 18-24, 30-37) | 7s | 1 | Heavy: two-row tab wall. Yellow banner explains franchise vs head-office scope (good) |
| FR-5 | Company setup tab | pre-filled with HEAD OFFICE name/email (30) | 3s | 2 | Confusing: franchisee's "Display name (what customers see)" = Brightstar Camps, contact email = head office's (F4) |
| FR-6 | Onboarding info ("My account") | (12) | 7s | 1 | Not an onboarding checklist. Territory map is optional; "From your registration" shows head-office business name and contact email (F4, F5) |
| FR-7 | Subscription | "Your head office manages the plan" (13) | 7s | 1 | Clear: franchisee pays nothing. HO pays (see HO-4) |
| FR-8 | Get paid | (14) | 7s | 1 | Contradiction: subtitle says "land directly in your own Stripe account", card below says "head office's Stripe account"; raw dev error "no STRIPE_SECRET_KEY on the server" (F6) |
| FR-9 | Royalties page | "currently 10% of revenue" (15) | 7s | 1 | Clear on rate and "nothing is taken automatically". 10% is an unrequested default (F12) |
| FR-10 | Milestones (hidden from nav, URL only) | 39% complete, 6 overdue, invented names (16) | 7s | 1 | Fake data on a day-one account (F3) |
| FR-11 | Branding tab | logo + accent colour only (31) | 3s | 1 | No own display name here; public pages show head-office brand (F4) |
| FR-12 | Child questions tab | built-in details + "Add a question" (32) | 3s | 1 | No indicator whether questions are inherited from head office or own; banner only says "a few areas still follow head office" (F10) |
| FR-13 | Cancellations & payments tabs | (33, 34) | 3s each | 1 | OK. Payments methods: Card/Bank/Cash/TFC/vouchers/HAF all on by default |
| FR-14 | Add a location | Listings > Locations (41, 42) | 20s | 4 | OK. "Town/City — parents filter by this" left empty, not derived from address |
| FR-15 | Build a block | Periods, passes, block, library (43-45) | ~60s | 11 | Jargon-heavy "period/pass/block/Block Library" for a first listing (F8) |
| FR-16 | Price the block | "Needs pricing" -> Set prices -> £25 -> Save pricing (46-48, 61, 62) | ~30s | 4 | **P0: Save pricing makes the block vanish from the franchisee (F1)** |
| FR-17 | Listing wizard, 13 steps | (49-60, 63-66) | 35s run (~5 min human) | ~12 minimum | Good guidance ("Before this can be published (1)", links to the step); whole-row "Use this block" works; abandoned runs leave Unpublished drafts (F13) |
| FR-18 | Publish | Published, "Day pass £25.00", Owner label seen by HO (66, 71) | 5s | 1 | OK after F1 workaround (block created through the API) |
| HO-4 | HO sees franchise | Overview card, Feature control, Territories, Listings "Owner: …" (68-71) | 7s each | 2 each | Works; "Owner:" label present. HO card says "No venue set" while franchise card shows the venue (F14) |
| HO-5 | HO subscription | "Preview · you're on Company … £99 base + £39/franchise" (73) | 7s | 2 | Who pays is clear here, but only as a preview; nothing forces the plan switch at invite time (F7) |
| PA-1 | Parent opens booking link | public `/book/:id`, desktop + phone (76, 77) | 6s | 1 | Brand is HEAD OFFICE ("BRIGHTSTAR CAMPS"), not the franchise. Franchise name only in the title (F4) |
| PA-2 | Parent checkout | pass, day, child, pay (78-82) | ~25s | 12 | Pay select: Card / Cash on the day / Tax-Free Childcare. Children step shows "£0.00" per day until a child is assigned |
| PA-3 | Cash on the day | Confirmation `BRI-10312`, "Pay £25.00 in cash on the day" (83, 84) | 21s | 14 | OK. Reference prefix BRI = head-office name |
| PA-4 | Second booking, 2 days | `BRI-10313` £50 (86, 87) | 21s | 14 | OK |
| FR-19 | Franchisee sees bookings live | 2 bookings appear without reload (88, 89) | live | 0 | Good |
| FR-20 | Mark paid | one click, no confirm (90-93) | 2s | 3 | Fast. Statuses update (Paid) |
| FR-21 | Royalties after paid | £75.00 / £75.00 collected / £7.50 (94) | 7s | 2 | Correct |
| HO-6 | HO split fees after paid | £75.00 revenue, £7.50 owed (95) | 8s | 3 | Correct and agrees |
| FR-22 | Cancel one day (booking 2) | immediate, "Partially refunded", refund £25 (96) | 2s | 3 | **No confirmation for a destructive action (F11)**; wording "your payment provider" for a cash booking |
| FR-23 | Royalties after refund | franchise says £75.00 / £7.50 (97) | 7s | 2 | **P0/P1: not netted (F2)** |
| HO-7 | HO split fees after refund | £50.00 / £5.00 (98) | 8s | 3 | Correct (nets the refund) |
| HO-8 | HO Franchises overview after refund | £75.00 revenue, £75 collected, £7.50 royalty (99) | 7s | 2 | **Wrong, disagrees with HO's own Split fees (F2)** |
| HO-9 | Head-office-only views | Dashboard, Families, Find a child (per-franchise picker), Safeguarding & incidents oversight "view-only across the network" (102-105) | 7s each | 1-2 | Work and read well |
| ISO-1 | Franchise A vs franchise B by API | 27 probes (texts/isolation.json) | n/a | n/a | Isolation holds (see section 3) |
| ISO-2 | Franchise A types HO URLs | `/company/*` redirects to `/franchise/*`; HO-only slugs give a clean 404 (106-112) | 5s | 1 | Good |
| HO-10 | Feature control | per-franchise + ALL columns, one click (69, 113) | 5s | 2 | Easy. Teaching Hub off by default |
| FR-24 | Franchise Setup > Features after HO switch-off | franchise has its own On/Off for every feature, no "locked by head office" marker (115, 116) | 5s | 2 | HO copy admits "Franchises can still change their own features" so the "master switch" is advisory (F10). Re-enable end-to-end not confirmed |

## 2. Ranked findings

### P0 (blocks the journey / money or data wrong)

**F1. A franchisee cannot price a block: "Save pricing" hands the block to head office and it disappears.**
Repro: franchise > Blocks > build "Summer Camp Day Pass" > Set prices > £25 > Save pricing. Block Library goes to "No blocks yet", the wizard says "You haven't built a block yet", the listing cannot be published. Head office's `/api/block-bundles` now lists the franchise's block (twice after repeating) with `priced:true`. Evidence: shots 45-48, 61-62, 54; `texts/probe.json`.
Cause: `server/src/routes/blockBundles.ts:306` `snap.ref.set(doc)` rebuilds the bundle from `{...parsed.data, listingIds, order, tenantId}`, dropping `franchiseId` and `createdBy` that POST stamped (line 276). `scopeRows`/`ownDoc` then hide it from the franchise. The same pattern drops them for periods (`:154`) and passes (`:216`): editing a period or pass would orphan it the same way.
Impact: the single required step of the first listing breaks for every franchisee; also leaks franchise data into head office's pool. Workaround used in this run: POST a pre-priced bundle through the API.
Fix: merge instead of replace: `snap.ref.set({ ...parsed.data, listingIds: existing.listingIds, order: existing.order, tenantId, franchiseId: existing.franchiseId ?? null, createdBy: existing.createdBy }, ...)` and `{ ...snap.data(), ...parsed.data, tenantId }` for periods/passes. Add an e2e: franchise prices a block, still sees it.

**F2. Refunds are not netted in the franchise's own Royalties page or head office's Franchises overview, so three screens disagree.**
After refunding one £25 day of a £50 booking: HO Split fees = £50.00 revenue / £5.00 royalty (correct), franchise Royalties = £75.00 / £7.50 (wrong), HO Franchises overview = £75.00 revenue, £75.00 collected, £7.50 royalty (wrong). Shots 97, 98, 99.
Cause: `server/src/routes/splitfees.ts:186-187` (`/mine`) uses `b.amount` / `b.amountPaid` without `refundedGross(b)` (the HQ route subtracts it, `:90-95`). `server/src/routes/hoOverview.ts:202-206` same.
Fix: share the netting helper (`refundedGross`) in `/mine` and `/api/ho/overview`; test that all three agree after a partial refund.

### P1

**F3. Day-one Milestones shows invented progress.** A franchise with zero activity sees "39% · 9/27 tasks complete", "Get set up 100%", "6 overdue", tasks ticked "Done" with assignees Alex Rivera / Sam Carter / Jamie Cole. Cause: `features/milestones/data.ts:66-89` `loadProgress` falls back to `seedProgress` (demo data) when no saved progress exists. Fix: fall back to empty progress (`steps:{}`) for real accounts; keep seed only for the HO builder preview. (Shot 16; the page is hidden from the nav but reachable.)

**F4. Whose name is it? Franchisee branding silently inherits head office.** (a) Setup > Company setup shows display name "Brightstar Camps", legal name and contact email = head office's (shot 30); My account says "Shown to parents as Brightstar Camps (business name)" (12). (b) Public booking page, header, footer, confirmation and booking reference prefix (`BRI-`) all use the head-office name; "Sunny Days" appears only in the listing title (76, 77, 84). (c) No obvious place to set the franchise's own customer-facing name; Branding only has logo + accent (31). The sidebar badge says "NORTHAMPTON FRANCHISE" and the doc text says "ActivityOS · Northampton franchise". The brief says head-office name shows on public pages; for a franchisee this needs to be stated up front ("Parents will see Brightstar Camps. You can change the display name here"), plus a "Sold by <franchise>" line on the booking page and email so the family knows who runs it. Also another brand slip: "Activly" vs "ActivityOS" in the same screen.

**F5. No onboarding checklist for the franchisee.** After sign-up they land on an empty Bookings list. "Onboarding info" is an account page, not a checklist; the Dashboard shows a tutor banner. A newcomer is not told the 6 things needed to publish: location, block (period+pass+block), price, listing, territory (optional), payment info. Fix: first-run checklist card on the franchise Dashboard (location -> block -> price -> listing -> share link), plus a landing on that card instead of Bookings.

**F6. Get paid page contradicts itself and shows developer text.** Subtitle: "Card payments land directly in your own Stripe account — ActivityOS never holds your money." Card below: "received into your head office's Stripe account, so there's nothing for you to connect". Also a red banner "Payments aren't configured (no STRIPE_SECRET_KEY on the server)" from `server/src/routes/payments.ts:40` is shown raw to a franchisee. Fix: franchise variant of the subtitle (copy key `p8lst.payIntro`, `lib/i18n/messages/areas/p8lst-parts/core.ts:99`); map the 503 to "Card payments aren't switched on yet - ask your head office" for franchise users.

**F11. "Cancel this day" cancels immediately with no confirmation** (`features/bookings/BookingDetail.tsx:227` calls `cancelDay(...)` directly) and creates a £25 refund obligation. Add a confirm step stating the refund amount. Also "Action these refunds in your payment provider" is wrong for a cash booking (it should say hand £25 back in cash).

**F7. The head office is never told, at invite time, what a franchisee costs or that royalty/features/territory exist.** Invite form = name/area/email (`features/franchise/FranchiseInvitesApp.tsx`), no royalty %, no feature set, no territory. Royalty (10%) is a silent tenant default (`splitfees.ts` default `rate: 10`). Billing: HO on "Company £49" sees only a "Preview · you're on Company … Franchise plan £99 + £39/franchise (1-5), £31 (6-15), £25 (16+)" (shot 73) while already inviting franchisees; nothing prompts the plan switch. Who pays is clear on the franchisee's side ("Your head office manages the plan") but the HO should see "Each accepted franchisee adds £39/mo" next to the Create invite button, and the royalty rate on the same form. The invite email also promises "nothing to configure" (`server/src/lib/emails.ts:781`) which is not true (location, block, price, listing) and does not name the franchise/territory or say who pays.

### P2

**F8. First listing needs five concepts before the wizard** (location, period, pass, block, pricing calculator, Block Library) and the wizard step 8 says "You haven't built a block yet" with only a link out. It is ~11 clicks to a block and ~30 to a published listing. Offer a "Quick start: one price, one day pass" in the wizard step 8 that creates period+pass+block in place. Pricing sits behind an unlabelled "£0.00 ▾" row inside a collapsed card (46, 47).

**F9. Invite landing page polish.** Email field not pre-filled from the invite (`app/signup/page.tsx`, invite form); franchise panel uses dark purple `#392B73` with grey text (low contrast, shot 07) and violates "no hard-coded colours"; on iPhone 13 the form and button are clipped at the right edge (06). Locked name shows the full test string; fine.

**F10. Inherited vs own settings are not labelled.** Setup banner says "A few areas still follow head office's settings for now" but each tab (Child questions, Cancellations, Branding, Company setup) does not say "inherited from Brightstar" vs "yours". Feature control: HO copy says franchises can still change their own features, so HO's switch is not authoritative and the franchise Setup shows no "turned off by head office" lock.

**F12. Royalty basis 10% is shown as fact, "Royalty settings" is a small button.** Neither side has agreed it; cash bookings accrue royalty before any money reaches head office, and the note "Card payments... received into head office's payout account" does not apply to cash. Say "10% of revenue, incl. cash you collect yourself".

**F14. HO listing card says "No venue set"** for the franchise's listing, which has a venue (shot 71 vs 60); HO territory text still says "Team & invites" (old name; `lib/i18n/messages/areas/franchise.ts:202` and Territories empty state).

### P3

**F13.** Each wizard start autosaves a draft; abandoned runs leave several identical "Unpublished £0.00 Standard" cards (I cleaned 5 by API). Offer "discard draft" on close.
**F15.** Booking detail section is labelled "MENTOR NOTES" (tutor-product wording) for a camp (`features/bookings/BookingDetail.tsx:958`).
**F16.** Checkout children step shows "£0.00" against each chosen day before a child is assigned.
**F17.** HO invite list: pending invite has only "Copy link" (no resend/revoke), success banner is the only confirmation of the email.
**F18.** Dev server "Compiling…" overlay was visible in many screenshots (local only, ignore).

## 3. Data isolation (franchise A vs sibling franchise B and head office)

27 API probes plus 7 URL tries as franchise A (`texts/isolation.json`, shots 106-112):

- Cannot read/modify B: booking by id 404, PUT B's bundle 404, PUT/DELETE B's listing 404, `?franchiseId=B` on listings/bundles returns only A's rows, milestones of B 403 ("another franchise's progress"), invites list shows only A's own (token credential not exposed), preview of B's used token 410.
- HO-only APIs all 403: `/api/franchises`, `/features`, `/territory`, `/api/ho/overview`, `/api/splitfees` (+settings, so A cannot set its own royalty), `/api/milestones/franchises`, `/api/subscription`.
- `GET /api/listings/:id` returns B's LIVE public listing (200): expected, it is a public page; draft/unpublished B listing not tested.
- Web: `/company/splitfees` and `/company/franchise-overview` are rewritten to `/franchise/...` which gives a friendly "We couldn't find that page"; no data shown.
- Result: **no leak found franchise to franchise**, apart from F1 (a franchise's own block leaking into head office's pool, a mild cross-tenant-role mix-up).
- Head office sees all: Franchises overview, Families (one family with 3 bookings across franchises), Find a child (per-franchise picker, All = 2 children), Safeguarding "view-only across the network", Milestones template builder, Territories ("1 franchise hasn't got a border yet - it can create listings anywhere until you draw & approve one"). All read clearly.

## 4. "First day" summary

**Head office, first day.** Sign in -> empty Bookings -> (hunt) FRANCHISES group -> Invite franchises: type name, area, email, click Create (4 clicks, 3 seconds); a green "Invite emailed" banner and a Pending row with Copy link. Then wait. After the franchisee joins: the sidebar changes (dark "all franchises" scope, Overview, Safeguarding oversight, Find a child). Franchises cards show zero. HO must discover on its own: Split fees (10% default, "Royalty settings" button), Feature control (one-click per franchise), Territories (waits for the franchisee to draw a border), Subscription (preview of £99 + £39/franchise). Nothing guides these. Pain: nobody tells HO the cost per franchise or that royalty is pre-set at 10% when inviting.

**Franchisee, first day.** Email -> "Accept the invite" -> sign-up page with locked name/area (good) -> 17 seconds to a landing page that is an empty Bookings list with no guidance. Pre-configured by head office: name, area, plan (HO pays), royalty rate, payout account (head office's Stripe), customer-facing name/contact (inherited, confusingly). Must set up: location, period/pass/block, price, listing (13-step wizard), optionally territory, logo/colour. Realistic time to first published listing: 15-25 minutes for a careful newcomer, and today it is blocked at the pricing step (F1). Once a listing is live (with the API workaround), the loop works well: parent books in ~20 seconds, the franchisee sees it live, Mark paid is one click, royalty shows £7.50 on £75 (but not netted after refund, F2).

## 5. Recommended fix order

1. F1 (block PUT drops franchiseId; periods/passes too). 2. F2 (net refunds in `/mine` and `/api/ho/overview`). 3. F3 (empty milestones, not demo). 4. F5+F4 (first-run checklist; state clearly whose name parents see and let franchisee set a display name; "run by" line on booking page/email). 5. F6 (franchise Get paid copy; hide raw STRIPE error). 6. F11 (confirm cancel day). 7. F7 (cost + royalty on invite form, email wording). 8. F8, F9, F10, then P3.
