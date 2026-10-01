# Site review C: freelancers, companies, franchises, schools

## What changed
- Link to /v2/trim-c.css added after responsive.css in all four pages; each `<body>` got a class (trim-fl / trim-co / trim-fr / trim-sc) so one shared CSS file can scope per page. No HTML removed; all rules sit inside `@media (max-width:759.98px)`.
- Text and truth fixes: 15 edits, all logged in docs/site-review/c-text-changes.md (HTML only, data-i18n keys untouched; the lead must re-run the i18n converter).
- Phone trim (hidden on phones only): freelancers hero mock-up, the 3-card intro band, photo card, 2 of 6 feature cards, parent-app phone mock; companies intro band, filmstrip photos, 2 of 6 feature cards, parent-app mock, a long paragraph; franchises hero mock, intro band, 3-photo filmstrip, two dashboard chart cards; schools hero mock, 3rd "why" card, filmstrip and tick-list, 2 of 4 day slots, 3 of 6 payment cards hidden, 2 of 6 safeguarding cards (the 4 safeguarding cards that stay are incidents, medication, safer recruitment, policies), 2 of 6 FAQs, bullets 4+ in the trust panels.

## Phone height at 390px (scrollHeight, before -> after)
| page | before | after | change |
|---|---|---|---|
| freelancers | 8374 | 5167 | -38% |
| companies | 8228 | 5471 | -33% |
| franchises | 6859 | 4292 | -37% |
| schools | 11792 | 8298 | -30% |

Also measured after: 360px 5325/5840/4675/8724, 430px 4918/5163/4140/8008. No horizontal scroll at 360/390/430/768. 768 and 1440 are unaffected (1440 heights identical before/after: 4493/4562/4330/6683). Screenshots viewed for schools and freelancers at 390; companies and franchises were measured and rendered but I did not eyeball their screenshots. Full-page captures show blank gaps where scroll-reveal animations had not fired; that is a capture artefact.
Method note: Playwright was driven through a standalone node script (not e2e-locked.sh) because the runner's webServer config would have started `npm run dev` on :3000. No spec file was created. Port 8103 server was killed.

## Claims verified (files checked)
- Territories map, HQ read-only oversight of incidents/medication, feature control per franchise, royalties/split fees (server/src/routes/splitfees.ts, features/franchise/*).
- Registers, ratios, meals, trips with consent and headcount, calendar, timetable, tasks, inventory, leave, clock-in/out with late-deduct pay policy (lib/nav/config.ts, routes/timeclock.ts, trips.ts).
- Memberships (wallet credit or discount), referrals, wallet, waitlist auto-offer (lib/waitlist), TFC (routes/tfc.ts), sibling discounts, funded/free places, late-collection alert (lib/sweeps.ts), cleared-to-start gate (lib/staffPolicy.ts), CSV export, 11 parent languages (lib/i18n/config.ts), Xero/QuickBooks exist.
- Stripe Connect payouts; flat monthly subscription (routes/subscription.ts).

## Corrected (contradicted the product)
Own domain (not live), franchisee "own account/own bank" (franchises share HQ's Stripe payout), "postcode-accurate" and "overlap protection" (hand-drawn polygons, warning only), roll-out of listings/policies/prices (only feature switches exist), staff-discounted places, charging for late collections. See c-text-changes.md.

## Needs Kaz
- Unsupported stats on companies.html: "about six hours a week per site", "four minutes from listing to first booking", "94% of HMRC payments land on their own", "two days a month back", "close the month in an hour". Also "Ratios cap numbers at checkout" and "swap a date" (parents) not verified.
- "HMRC-ready payroll" (payroll exists; HMRC RTI submission not verified).
- Schools: there is no dedicated trust/schools portal; trusts map to company + franchise portals. The schools hero mock nav shows "Term dates" and "Take-up" tabs that do not exist in the real portal; "Own listings, prices and term dates" and "a receipt in the parent's account" not verified; the data-controller / encryption FAQ is legal text left untouched.
- Franchises mock shows "Settled 1 Sept" per franchise and "own brand" storefronts for franchisees (not verified). Pricing/plan text untouched.
- Custom domains: if planned, restore "your own domain".

## Still looking off
- Schools footer "Pages" list lacks Schools & academies on that page (shared footer, not changed).
- Schools ended at -30%, slightly under target; further cuts would remove safeguarding or payments content.
- Duplicate heading "One booking engine, everything built in" (eyebrow plus window bar) remains on freelancers and companies; the eyebrow is hidden on phones only.
