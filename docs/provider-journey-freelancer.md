# Brand-new Freelancer provider journey (local stack, 4 Oct 2026)

Method: Playwright (desktop 1280 + WebKit iPhone 13), fresh `@activityos-test.com` accounts, local web :3000 / API :4000.
Screenshots: `e2e/review/shots/journey-freelancer/NN-*.png`. Partial spec: `e2e/zz-journey-freelancer.spec.ts`
(sign-up wizard, gate, first landing; the rest was driven by ad-hoc scripts). No product source edited, nothing committed.
Test data left behind: provider `e2e-journey-fl-muu5hj6f@...`, parent `e2e-journey-parent-muu5hj6f@...` (clean with `npm run e2e:cleanup`).
Local caveats: no Stripe keys (dummy card form, Stripe Connect disabled), Next dev overlay and "Compiling" pill appear in shots.
Time figures include dev-server compile; real users on prod will see less.

## Step table

| # | Step | Screen | Time | Clicks | Verdict |
|---|------|--------|------|--------|---------|
| 1 | Public site | `/` redirects straight to `/login` (no marketing page, no "Provider sign up" button; only "New here? Create an account") | 5s | 1 | Confusing: a provider arriving cold sees a bare sign-in box |
| 2 | Sign-up wizard (6 steps) | type (Freelancer pre-selected) / business / "how parents see you" / how did you hear / login / Get paid | ~2 min | ~14 | Works; validation fine; several wording/UX niggles (F7, F9, F14, F15) |
| 3 | Plan gate | "Pick your plan": Freelancer £29/mo, 7-day trial, dummy card form locally | 6s load | 1 (Start trial passes with an EMPTY form locally) | Clear price, trial wording incomplete (F3, F4) |
| 4 | First landing | `/freelancer/bookings`: empty list, "No bookings match this view." | 6s | 0 | Dead-end: no welcome/next step (F1) |
| 5 | Dashboard | Zero-state KPI wall, "Are you a tutor?" banner | 5s | 1 | Nothing says what to do next (F1) |
| 6 | Setup & features | 32 tabs, no order/required marker | 6s | 1 | Overwhelming (F2) |
| 7 | Onboarding info | Just your sign-up answers + password change | 5s | 1 | Misnamed: not an onboarding checklist |
| 8 | Get paid | "Finance - payments" + red "no STRIPE_SECRET_KEY" error | 5s | 1 | Developer text (F6, local only) |
| 9 | Policies/child questions/payment methods/age groups | Setup tabs; sensible defaults exist (Standard policy 100%/50%/0%) | ~8s each | 4 | Good defaults, unclear which matter (F2, F11) |
| 10 | Venue | Blocks & listings > Locations > Add location > Find (postcode) > name > Add | ~40s | 6 | OK; empty Add silently does nothing |
| 11 | Block | Blocks tab: period -> pass -> "+ Add to block" x2 -> name -> Move to Library -> Set prices (collapsed row) -> Save pricing | ~3 min | ~16 | Hidden price field, silent "Untitled block" (F8) |
| 12 | Listing wizard (13 steps) | Basics, Details, Capacity, Content, Provided, Safety, When, Tickets, Discounts, Add-ons, Staff, Preview, Policy & publish | ~4 min | ~30 | Nothing blocks you until step 13; block/venue prerequisites found late (F5, F10) |
| 13 | Publish | Wizard closes to list; no confirmation, no share link prompt | 4s | 1 | Silent (F12) |
| 14 | Public page (signed out) | Desktop + phone | 5.5s | 0 | Big empty hero, "HOLIDAY CAMP" tag on a football class (F13) |
| 15 | Visitor books | dates -> Add to basket -> Next -> child form -> Next -> Cash -> Confirm | ~1.5 min | ~12 | Dead end at the end: "Not signed in" (F1 P0/P1 list, see F1b) |
| 16 | Parent sign-up from page | Sign in > Create an account > search provider > email/password | ~40s | 7 | Provider not prefilled; basket lost (F1b) |
| 17 | Parent books + pays cash | Re-pick dates, add child, Cash on the day, confirm | ~1.5 min | ~12 | Success screen good. Bank transfer NOT offered (F10) |
| 18 | Provider sees booking | Bookings, bell (2), dashboard, Money in, Families | 6s each | 4 | Appears live; booker name = email prefix (F16) |
| 19 | Mark paid | One click, no confirmation | 2s | 1 | Fast but no record of when/how (F17) |
| 20 | Message family | Modal with templates; sent OK and shows in Messages | ~30s | 4 | Works; "Pro" / `{ParentName}` jargon (F18) |
| 21 | Cancel a day / refund | "Cancel this day" cancels instantly, books a refund | 2s | 1 | No confirm; refund must be moved by hand (F2b) |

## Findings (ranked)

### P0 / P1 - blocks the journey or money/state at risk

**F1 (P1) New provider has no "what next".** First landing is an empty Bookings table; dashboard is a wall of zeros; the Setup page has 32 tabs; "Onboarding info" is only the sign-up answers. The required chain (venue -> block with prices -> listing) is nowhere stated. A real user needs to guess "Blocks & listings > Locations".
Cause: `app/signup/page.tsx:24-27` (`home: "/freelancer/bookings"`), `lib/nav/config.ts:162` ("Onboarding info" = account page), no checklist component on `features/dashboard`.
Fix: land new tenants on the dashboard with a 5-item checklist (Add venue, Build a block & price it, Create listing, Get paid, Share link) driven by the same server data; rename "Onboarding info" to "My details".

**F1b (P1) Signed-out visitor is only told "Not signed in" at the very last click.** The booking page lets a visitor pick dates, type a full child record (allergies, medical...) and choose payment, then "Confirm booking" shows a raw red "Not signed in" with no link. The Children step also shows £0.00 per pass until a child is added. After sign-up the parent lands back on the page with an EMPTY basket and must redo everything. The sign-up form does not pre-select the provider they were just looking at (searches by name).
Cause: `lib/api.ts:187` throws `ApiError(401,"Not signed in")`, surfaced raw in checkout (`features/storefront/BookPage.tsx`).
Fix: gate at "Next - add children" (or show inline "Sign in / Create account to continue" that keeps the basket in sessionStorage and returns to step 2); pre-fill `?provider=<tenant>` in the sign-up link; map 401 to friendly copy.

**F2b (P1) "Cancel this day" and "Mark paid" act instantly.** One mis-click cancels a session and creates a refund owed (here £8 on a paid cash booking); no confirm, no undo. Refund screen then says "Action these refunds in your payment provider - ActivityOS does not move money", which for cash/bank bookings reads as a dead end; status becomes "Partially refunded" with no "mark refund as sent" button seen.
Cause: `features/bookings/BookingDetail.tsx:227` -> `store.ts:348` `cancelDay` posts immediately.
Fix: confirm dialog stating the refund amount and who is emailed; add "Mark refund as paid" for non-card methods.

### P2 - confusing, wrong or misleading

**F3 (P2) Annual plan footer wrong.** With "Annual" selected the card says £290/yr, but the line under the button still says "Then £29/mo after your free trial". `features/money/SubscriptionApp.tsx:516` (the `status === "none"` branch always uses `monthlyPrice`). Fix: use the same annual/monthly branch as the else-case.

**F4 (P2) Trial wording incomplete.** Gate says "Free for 7 days - cancel anytime before then" and "Then £29/mo after your free trial". It never says the card is taken NOW, the date of the first charge (the Subscription page does later: "billed from 11 Oct 2026"), or that +VAT is added. Plan limits are a feature list only ("150 SMS a month"); nothing about staff/listing/booking caps. Locally the only message is "Card billing is being connected - you won't be charged yet" (dev copy; would be seen if Stripe keys fail in prod). Fix: line "Card needed today. First charge Sun 11 Oct 2026, £29 + VAT/mo. Cancel before then and pay nothing." (`money.ts:83-89`).

**F5 (P2) Listing wizard prerequisites discovered late.** Steps 1-7 never block; you only learn at step 8 ("You haven't built a block yet", "Build a block in Blocks" which leaves the wizard) and at step 13 ("Before this can be published (4)": name, venue, dates, block). The Details step has a Venue dropdown that is empty for a new provider with no "Add venue" inline. Fix: pre-flight screen on "New listing" listing missing prerequisites with direct buttons; inline "Add venue".

**F6 (P2) Get paid page shows developer text.** "Payments aren't configured (no STRIPE_SECRET_KEY on the server)" in red, title "Finance - payments" for a menu item called "Get paid", and a greyed Connect button. `server/src/routes/payments.ts:40`. Fix: generic "Card payments are temporarily unavailable, try again shortly" + log the detail; match title to menu label. Also the white-on-pale-blue notice on the sign-up Get paid step (`app/signup/page.tsx:593-595`, text barely legible in `15-signup-getpaid-step.png`).

**F7 (P2) Sign-up validation gaps.** Contact email is not validated (`not-an-email` accepted, shown on public pages and Onboarding info, and then pre-fills the LOGIN email field - `page.tsx:188-192`). "Create account" is silently disabled until the terms box is ticked, with no hint (`page.tsx:645`). Fix: validate contact email in `stepProblem("business")`; keep button enabled and show "Tick the box to agree".

**F8 (P2) Block builder.** Price is hidden inside a collapsed row that shows "£0.00 v" - nobody knows to click it. "Move to Block Library" with an empty name silently creates "Untitled block" (and unpriced blocks are still offered in the wizard's step 8). Rerunning the flow created duplicates. Fix: expand price rows by default for new blocks; require a name; hide unpriced blocks (or tag "needs price") in the wizard picker.

**F9 (P2) Weekly block defaults to Mon-Fri, locked.** A Tuesday football class has to discover "Custom days" and untick four days (46 dates become 10). Also public date chips show "Tue 3" and "Tue 1" with no month. Fix: default to single weekday from the start date, show month on chips.

**F10 (P2) Payment methods mismatch.** Setup > Payments and wizard step 2 show Bank transfer, Cash, Tax-Free Childcare, Childcare vouchers and HAF all switched ON by default. A parent's checkout only offered Card, Cash, Tax-Free Childcare (bank transfer needs bank details that the provider skipped; no warning anywhere). The Setup copy "How you record payment when you take a booking yourself" also hides that it controls what parents see. Fix: default only Card+Cash; if Bank transfer is ticked without details show an inline "Add bank details".

**F11 (P2) Hard-coded step references are stale.** Wizard policy note says "Setup & features -> Bookings & payments" (`lib/i18n/messages/areas/p8lst-parts/wiz2.ts:219`) but the tab is "Cancellations & refunds". Location form says accessibility is "set per listing (steps 3 & 4)" but it is steps 5-6.

**F12 (P2) Publish is silent.** After "Publish" the wizard just closes onto the list; no "Your listing is live" with the share link, QR or "View as parent". Draft clutter: opening "New listing" auto-saves drafts (4 duplicate "Tuesday Football Skills" drafts remained after repeated attempts). Fix: success dialog with copy-link; draft only on explicit save or after title+one more field.

**F13 (P2) Public page quality.** Category tag reads "HOLIDAY CAMP" for a weekly football class (default category, wizard categories list is camp-centric); no-photo listings get a huge blue gradient hero; "WHERE IS IT / LOCATION +" is collapsed; phone page is 7,500px tall. Confirmation says "Starts Tue 13 Oct - Tue 20 Oct" for two separate Tuesdays (reads like a range) and omits the time.

### P3 - polish

- **F14** Brand inconsistency: "Activly" on login/signup/sidebar, "ActivityOS" on gate, public footer, hero copy. Root `/` redirect to `/login`.
- **F15** Signup: "How did you hear about us" is mandatory ("Pick one - it really helps us"); Freelancer pre-selected so first Continue with no choice proceeds; Get paid step has both "Skip for now" and "Go to dashboard".
- **F16** Booker name falls back to email prefix (`e2e-journey-parent-muu5hj6f`) everywhere (booking title, Families, notification) because the parent's welcome modal (name, address, emergency contact) is skippable; the child's name appears as the booker in the list row.
- **F17** Mark paid: no method/date/amount; PAYMENT block just says "Cash on the day". "MENTOR NOTES" label is tutoring jargon for a sports coach.
- **F18** Message modal: "Merge fields fill from this booking: {ParentName}, ..." is developer-ish; Messages page says "Switch on Pro for templates & merge fields" while templates are already offered.
- **F19** Dashboard: "100% not filled . 0/0 taken" on an empty account; "Are you a tutor? Start here" banner and "Teach online?" card repeated; greeting lacks the provider's name; "Compiling" pill is dev only.
- **F20** Child form asks "Boy or girl? *" (mandatory); error wording "we still need their name, their date of birth and boy or girl" is fine but the question is exclusionary - make optional or "Gender (for register colour)".
- **F21** "Midnight" theme swatch is neon lime; empty "Add" in Locations does nothing (no error).
- **F22** WebKit console shows repeated CSP "Refused to apply a stylesheet ... style-src" errors (dev, check prod headers). Typing into login before hydration (<~3s locally) clears the fields.
- **F23** Phone: all key screens fit 390px with no horizontal scroll; top bar is icon-only (calendar, people, chat, search, flag, bug, bell) with no labels; wizard footer Back button overlapped by dev badge only.

## Numbers checked

Booking 2 x £8 = £16, cash, unpaid -> Mark paid -> cancel 1 day -> refund £8; Money in: Received £16, Refunded £8, net £8 (consistent). Dashboard "Taken this week £16.00" is gross while "Collected" chart shows £8 (net) - label the difference. Spaces: "58 left, 2/60 taken" counts the cancelled day's place and mixes per-day capacity with total (a 46-day draft showed "0 of 600"). Default capacity 60 per day for a solo coach (Setup > New listing defaults says tutors 8, camps 60) - a 1-coach class would normally be 8-20.

## First 10 minutes - how a real provider would feel

Minute 0-2: sign-up is friendly and quick; the wizard asks sensible things. Slight irritation at forced "how did you hear".
Minute 2-3: the plan gate is clear on price and the 7-day trial but not on *when* the card is charged; a nervous sole trader hesitates at the card field.
Minute 3-5: lands on an empty Bookings table. No welcome, no checklist. Opens the dashboard: zeros. Opens Setup: 32 tabs. Feels lost; will probably click "Blocks & listings > New listing" because that is the obvious verb.
Minute 5-9: the 13-step wizard looks polished but the venue box is empty, the block step says "go build a block elsewhere", and block pricing hides behind a collapsed row. Competent users get through in ~10 minutes, many will leave a draft behind.
Minute 10: publish succeeds silently; they must find the "Link" button to share. First real parent hits "Not signed in" at the end if they are not logged in - the single biggest conversion risk found.

## Recommended order of fixes

1. F1b checkout sign-in gate and basket persistence. 2. F2b confirm on cancel-day / refund tracking. 3. F1 new-provider checklist + landing. 4. F3/F4 gate copy. 5. F5/F8 listing prerequisites and block pricing. 6. F10 payment-method defaults. 7. F6/F7/F11/F12 copy and validation fixes.
