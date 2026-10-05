# Provider journey: brand-new COMPANY (multi-staff holiday camp operator)

Walked on the local stack (web :3000, API :4000) as a first-time user, Chromium 1280 plus WebKit iPhone 13 for key screens, fresh `@activityos-test.com` account.
Screenshots: `e2e/review/shots/journey-company/` (NN-name.png desktop; `P01`-`P10` phone). Spec: `e2e/zz-journey-company.spec.ts` (steps 1-4; steps 5-6 were ad-hoc scripts, shots 100-130).
Times are wall-clock for an automated run with no thinking time, so read them as a lower bound. "Clicks" is the minimum a person needs.

Not exercised: `e2e-unwall` (not needed: with no Stripe keys the gate's "Start 7-day free trial" passes with an EMPTY card form), real Stripe PaymentElement, register/ratios with live children (the camp starts 26 Oct, nothing runs "today"), staff register and ratio screens, a message send, refund approval beyond what the cancel produced.

## Step table

| # | Step | Screen | Time | Clicks | Verdict |
|---|------|--------|------|--------|---------|
| 1a | Public site -> Provider sign up | `/activly.html`, `/pricing.html` | 5s | 1 | OK. Header "Provider sign up" lands on `/signup` with Freelancer preselected; the pricing page's Company button uses `?plan=company`. A company user coming from the home page must notice and switch. |
| 1b | Signup wizard (type, business, identity, hear, login) | `/signup` | ~60s | 14 + typing | Works, good inline errors per step. Stale errors, disabled Create button with no reason, brand name flips Activly -> ActivityOS. |
| 1c | "Get paid" step | `/signup` step 6 | 3s | 1-2 | Banner text unreadable (white on pale blue). Stripe button errors locally (expected). Bank details optional. |
| 2 | Billing gate | "Pick your plan" | 10s | 3 | Bands £49/£69/£89 (+£1/staff over 75) selectable, annual £890 shown. Local: card form is a dummy and an empty submit starts the trial. |
| 3a | Landing after gate | `/company/bookings` | 4s | 0 | Lands on an EMPTY Bookings page with 8 zero filter pills. No welcome, no checklist. |
| 3b | Dashboard | `/company/dashboard` | 4s | 1 | "Are you a tutor? Start here" banner is the first thing a camp operator sees; no first-run guidance. |
| 3c | Onboarding info / Setup & features / Get paid | `/account`, `/setup`, `/getpaid` | 12s | 3 | "Onboarding info" is really "My account". "Setup & features" is 28 pill tabs, no order, no progress. |
| 3d | Branding, child questions, safeguarding, age groups, cancellations, payments tabs | `/setup` tabs | 25s | 12 | All reachable. Several developer-facing strings (see findings). |
| 3e | Venue | Blocks & listings -> Locations | 20s | 6 | Postcode lookup works. Empty Add does nothing and says nothing. |
| 3f | Invite staff (5-step wizard) | `/company/staff` | 30s | 8 | Works; step 5 shows a stray "Invite a franchise" button. Invite link only via "Copy invite link". |
| 3g | Staff accepts invite | `/signup?invite=` | 27s | 5 | Clean single form. Lands on staff dashboard with a "Let's get you started" welcome (availability, compliance 0/25), clock in works. Titles in the welcome modal are near-invisible. |
| 3h | Staff onboarding | `/staff/onboarding` | 4s | 1 | 8 steps, 39 details, autosave. Good. |
| 4a | Build block (period, 3 passes, add to block, name, move) | `/company/blocks` | 40s | 17 | Jargon (period / pass / block / library). Not in the sidebar. Must be done BEFORE listing step 8. |
| 4b | Set prices | block library | 15s | 8 | Expand each pass to price it; "Sort pricing" label after priced. |
| 4c | 13-step listing wizard | New listing | ~120s | ~45 | Long but guided. Dead end at step 8 for first-timers (see P1). Publish gives no confirmation. |
| 5a | Public page | `/book/<id>` | 4s | 0 | Clear passes, discounts, dates. Hero image block is 670px of blank gradient when no photo. |
| 5b | Build basket, add two children, extras, pay step | checkout | 60s | 12 | Works; discounts shown line by line. |
| 5c | Confirm as guest | checkout | 3s | 1 | DEAD END: only a tiny red "Not signed in". |
| 5d | Parent sign up (provider picker) | `/parent?tab=up` | 20s | 6 | Must search for the provider although arriving from its link. No name field. Returns to the listing, basket and children lost. |
| 5e | Re-book, Cash on the day | checkout | 45s | 12 | Booking confirmed, ref SUN-10312, £210. |
| 6a | Bookings list / detail | `/company/bookings` | 5s | 2 | Updated live. Booker is shown as the email handle. |
| 6b | Mark paid | detail | 2s | 1 | One click, no confirm, no method/date. |
| 6c | Cancel one child | detail | 3s | 1 | Cancels instantly, no confirmation; £105 refund recorded straight away. |
| 6d | Money in / registers / ratios / messages | various | 20s | 4 | Money in counts the refund as done. Empty states fine. |

## Findings, ranked

### P0
1. **Refund is booked as "Refunded" the moment a place is cancelled; there is no approval step and no money has moved.** Cancelling Leo (whole place) in booking SUN-10312 immediately set the booking to "Partially refunded", recorded a £105.00 refund, and Money in now says "Received £210.00 · Refunded £105.00" and income "£105.00 after refunds". The Refunds tab stays at 0 and the Bookings counters never show anything to approve. The same screen says "Action these refunds in your payment provider - ActivityOS does not move money", so the books say refunded while the provider still owes it. For a cash booking this is only a ledger entry, but the wording and the totals imply it happened. Files: `features/bookings/BookingDetail.tsx` (cancel and refund panel), `features/money/bookingIncome.ts`. Fix: create a pending refund (appears in the Refunds tab, "to action") on cancel, and only count it in Money in once the provider marks it sent/approved. Add a confirm dialog showing the amount and the policy rule applied.
2. **Cancelling a child or a whole booking has no confirmation.** One click on "Cancel all 5 days" cancelled Leo irreversibly, released the places and calculated a refund. Same for "Mark paid" (no confirm, method, or date). Fix: confirm modal with who/which dates/refund amount, and an Undo toast for Mark paid.

### P1
3. **Guest "Confirm booking" is a dead end.** A not-signed-in parent who completes children and payment and presses the big confirm button only gets a small red "Not signed in" (copy from `lib/i18n/messages/areas/account.ts:98`). No sign-in/sign-up prompt, no inline account creation. Fix: on the pay step show "Sign in or create an account to finish" up front (inline), or open the auth modal on confirm and return with the basket intact.
4. **The first-time parent signup loses context and asks for the wrong thing.** (a) Arriving from a provider's booking link, the parent still has to search for the provider (`/parent?tab=up`, error "Choose your provider from the list"); preselect it from `next=/book/...`. (b) There is no name field, so the provider sees the booker as the email handle ("e2e-jc-parent-muu6zxe5" on the booking list, detail and Booker contact name). Ask for name at signup or at checkout and store it. (c) After signup the basket and the children typed as a guest are gone; the parent redoes the whole booking.
5. **No first-run guidance for a company after signup.** After the gate the user lands on an empty Bookings page (8 zero-count filter pills). The dashboard shows a "Are you a tutor? Start here" promo (`lib/i18n/messages/areas/hubshell-parts/home.ts:501`) and zeros, but no "Next steps" checklist (venue, block, listing, payments, invite staff). AGENTS.md mentions a Setup checklist; it does not exist (Setup is a 28-tab settings page). The staff side has a good welcome; the owner has none. Fix: a dismissible "Get your first camp live" card with 5 steps and progress, shown on the dashboard and as the landing page for new tenants; show the tutor promo only to providers who chose Tuition/Other.
6. **Listing wizard forces you out to build a block, but only tells you at step 8.** The checklist of blockers appears only at step 13 ("Before this can be published (3)"), and the "Publish (3)" button looks active. A first-timer finds out at step 8 ("You haven't built a block yet", "Build a block in Blocks") and leaves mid-wizard. Blocks, periods and passes are also hidden from the sidebar (reached via a tab). Fix: offer "Create passes now" inline in step 8 (a mini block builder), or run the block step first; show the blockers list from step 1; rename "Publish (3)" to "3 things left".
7. **Company-wide settings pages leak build-state and developer text to customers:** "The checks are enforced by the backend (handed over)" and "Enforcement: backend" (`lib/i18n/messages/areas/setup.ts:141`, `:41`, `p8set.ts:421`); "(The 4-digit PIN itself is Phase 2 - for now use the collection password.)" on Register; "Not shown in the forms yet - they still offer Boy/Girl" (`p8set.ts:466`); "Payments aren't configured (no STRIPE_SECRET_KEY on the server)" on Get paid (`server/src/routes/payments.ts:40`). Fix: remove or replace with plain wording.
8. **Staff compliance page shows locations the company never created** (Compliance & certs "Location" filter lists "Milton Keynes / Northampton / Bedford"; hardcoded in `features/learning/CredentialsApp.tsx:18`). Fix: build the filter from the tenant's own locations only.

### P2
9. **Unreadable text on two key onboarding surfaces:** signup "Get paid" banner "Your account's ready..." (white on pale blue, `app/signup/page.tsx:592-594`, token `--brand-ink` fallback) and the staff "Let's get you started" modal where step titles "Set your availability" and "Complete your compliance details" render almost white (`features/staff/StaffWelcome.tsx:72`, `text-[var(--ink)]` resolving light inside the overlay).
10. **Billing gate wording and trust.** Annual selected still says "Then £89 +/mo after your free trial" (`features/money/SubscriptionApp.tsx:306`; `/mo` and stray "+" wrong for annual and for non-banded). Band picker needs a staff count the user does not have yet; no hint "you can change later / billed automatically by staff count". Locally, the card form is a dummy ("Card billing is being connected") and an EMPTY submit passes; confirm production cannot run in this mode when Stripe keys are missing. Brand also changes to "ActivityOS" here while signup says "Activly".
11. **Brand inconsistency:** "Activly" (site, signup, login, sidebar footer), "ActivityOS" (gate, copy "Choose how you'll use ActivityOS", booking footer, email). Pick one.
12. **Odd numbers.** Listing capacity: "Maximum attendees: 60 per day" shows as "0 of 120 booked / 120 left" on the card and "120 OF 120 LEFT" on the public page for a 2-week, 10-day camp (what is 120?). Dashboard "SPACES LEFT · LIVE LISTINGS 0 - 100% not filled - 0/0 taken". Checkout shows a pass at "£0.00" before a child is added. Early bird is taken once per pass (-£10 for two children) while sibling is per child; both look equal on the page ("-£10.00"); state "per booking" vs "per child" on the discount cards. Block library card says "Sort pricing" after pricing is done.
13. **Team & invites overview card "ON YOUR PLAN - COMPANY | 0 | extra bill monthly"** is cryptic. Invite step 2 copy "Coach / Staff is what Jamie will be able to see & do" reads as a fragment. Invite confirm step has "Invite a franchise" next to "Send invite" (`features/team/TeamApp.tsx`).
14. **Public booking page when no photo:** a 670px blank gradient hero pushes checkout below the fold on desktop and phone; on iPhone 13 the language chip overlaps the business name and the three nav links stack into tall caps (P10). Show the hero only when a photo exists or cap its height in checkout steps.
15. **Silent validation:** Add location with empty fields does nothing; step 1 of the wizard allows Next with an empty title and the draft POST returns 400 (raw zod JSON visible in the network tab; user sees nothing and the next step continues); signup shows stale errors after the field is fixed ("Add your postcode." stays, "Enter a valid email address." stays); signup "Create account" is disabled until the terms box is ticked with no explanation (the intended error `suVAgree` never shows because the button is disabled, `app/signup/page.tsx:648`).
16. **Typing inside ~1s of pressing Next on step 1 is lost** (draft creation re-hydrates the form). Real users rarely hit it, but a fast typist on step 2 will lose ages/venue.
17. **Bookings list shows the child names as the title and the booker only on open**; no parent name/phone at a glance; the Mentor notes block in booking detail uses "Mentor" (`features/bookings/BookingDetail.tsx:958`) for what is a private provider note.
18. **Age groups come pre-filled with Cubs 5-7 / Explorers 8-10 / Adventurers 11-14 / Trailblazers 15-17.** A holiday-camp provider with 4-year-olds gets silently uncovered ratios (no 0-4 group); label them "example groups - edit" and include under-5 EYFS ratios.

### P3
19. Wizard on phone: Publish and close button clipped at the right edge (P09); phone top bar shows unlabeled icons (P03).
20. "Signup step 1 of 6" counts the post-signup "Get paid" step (fine) but the checkbox/terms step appears last; the home-page "Provider sign up" defaults to Freelancer.
21. Cancellations tab: "Less than 48 hoursincluding after it has started" (missing space), the notice dropdown lists every hour 1-23 plus days/weeks (long), policy text starts lowercase "cancel at least...", and listing step 13 says "Written from the rules in Setup & features -> Bookings & payments" but the tab is "Cancellations & refunds".
22. Safeguarding tab copy "As a sole provider you are the DSL" on a multi-staff Company account; shows a warning until a DSL is named, good, but the copy assumes freelancer.
23. Sidebar for a plain company shows an unused FRANCHISES group; Setup has 28 pills with no grouping.
24. Dashboard on first load: after-hours greeting says "Good evening" at 23:00, fine; "How it works" video links everywhere but nothing for "first week".

## First hour summary

0-5 min: homepage -> sign-up wizard, six short screens, easy; the first snag is the unreadable "Account ready" banner. 5-10 min: "Pick your plan" gate; the user must guess a staff band; trial starts. Then **nothing tells them what to do**: an empty Bookings page and a dashboard of zeros with a tutor promo. A real person opens Setup & features and finds 28 tabs, some with internal build notes. 10-30 min: they work out Locations (add a venue), then try New listing; after ~8 steps they discover they must leave and build a block (periods, passes, prices), which is the least obvious part of the product. 30-45 min: price, return, set dates, discounts, publish (no confirmation). 45-60 min: they invite staff (smooth), open the public link, and book as a parent to test it; the guest checkout dead-ends at "Not signed in", the parent signup asks for the provider again and drops the basket, and the provider then sees the booking under an email handle. If they test a cancellation, the money screens report the refund as done. Total realistic time to a published, bookable camp: 45-60 minutes with the dead ends above; with a checklist and inline pass creation it could be ~20.

## Quick-win fix order

1. Pending-refund state and confirm dialogs (P0 1-2).
2. Guest checkout sign-in prompt, provider preselect, name capture, keep basket (P1 3-4).
3. First-run checklist card and landing (P1 5); inline "create passes" in wizard step 8 (P1 6).
4. Strip developer strings and hardcoded demo locations (P1 7-8); fix the two unreadable text bugs (P2 9).
