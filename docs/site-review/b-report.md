# Site review B: platform-bookings, platform-comms, platform-finance, platform-safeguarding, platform-staff, tour

Date 1 Oct 2026. Files touched: the six pages above, `public/v2/trim-b.css` (new), `docs/site-review/b-text-changes.md` (every wording change, 69 rows) and this report. Nothing committed. No scripts run against the shared i18n files.

## Phone page height at 390x844 (document scrollHeight, px)

| page | before | after | change |
|---|---|---|---|
| platform-bookings | 8450 | 5385 | -36% |
| platform-comms | 8784 | 5053 | -42% |
| platform-finance | 9168 | 6048 | -34% |
| platform-safeguarding | 8660 | 5449 | -37% |
| platform-staff | 9665 | 5562 | -42% |
| tour | 4005 | 2682 | -33% |

Also checked at 360, 430, 768 and 1440: no horizontal overflow on any page at any width. 768 and 1440 are unaffected by the trim CSS (every rule is inside `@media (max-width:759.98px)`); their heights moved by at most +/-5% purely from the wording edits (shorter or longer copy). comms and staff overshoot the 30-35% target slightly; I kept the rota mock hidden because it is a seven-column grid that gets cut off on a phone.

## What changed per page

All pages: `<body class="tb-xxx">` added (page-specific hooks) and `<link rel="stylesheet" href="/v2/trim-b.css">` after responsive.css. No HTML removed.

Phone trim (trim-b.css), shared: feature-card grids become compact icon + title + text rows (even spacing, no clipped text, no line clamps); the decorative "pwx" window bar is hidden; band padding and headings tightened; closing CTA card slimmer; decorative hero photo/phone pop-up hidden; footer drops the brand blurb and the placeholder (href="#") social icons but keeps Pages and Legal lists.
- bookings: third listing in the mock hidden (checkout strip kept).
- comms: duplicate phone mock in the first band hidden; parent-app mock keeps Messages and My bookings (other four panes hidden).
- finance: bar chart card hidden; TFC table keeps first three rows; side-rail cards 1 and 3 hidden (kept "How a payment lands").
- safeguarding: portal snippets keep Register, First aid log and Safeguarding concern (Ratios and Medication snippets hidden, both covered by cards above). All safeguarding/legal wording kept.
- staff: weekly rota mock hidden; Learning Centre mock keeps the course list, drops its rail.
- tour: video placeholder card shorter.

Wording (full old/new/why table in `b-text-changes.md`). Main themes: removed claims the product does not support (see below); removed H1/H2 repetition (bookings, finance); replaced three card duplicates in bookings with three verified features (one basket for the family, your logo and colours, child profiles that travel with the booking, with matching icons); fixed clumsy phrases ("no-time-what texts", "never us", "actually finishes", "Not a generic portal").

**i18n note for the lead:** every edited element that had a `data-i18n` key was given a fresh key (`pb.<page>.<n>`), not left on the old one, so other languages do not show the OLD translation of a claim I removed. Until you re-run `scripts/i18n-v2/convert.mjs` and add translations, those strings display in English. Tag counts per page are unchanged apart from the one added `<link>` and nothing was removed.

## Claims verified (file checked)

- 0% commission, payouts to the provider's own Stripe, "Activly never holds your cash": Stripe Connect Express, charges made on the provider's connected account (docs/splitfees-payout-handoff.md, server/src/routes/payments.ts, settlePayment.ts).
- Memberships (wallet credit or standing % discount, up to three tiers): docs/memberships-handoff.md, server/src/routes/memberships.ts.
- Referral rewards, discount codes: server/src/lib/discountCodes.ts, routes/referral.ts.
- Waitlists and offered places, session reminders, add-ons per child, single day / week / block, one basket for several children: server/src/lib/sweeps.ts, features/listings/booking.ts.
- Branded storefront and checkout (logo + brand colour): features/storefront/BookPage.tsx, lib/brand-theme.ts, components/shell/ParentBrandTheme.tsx.
- Email: audiences, opens tracked, unsubscribe/PECR consent, merge fields {ParentName} {ChildName} {ListingName} {SessionDate} {VenueName}, AI compose: server/src/routes/emails.ts, lib/emailSend.ts, routes/ai.ts. Broadcast and 1:1 messages: routes/messages.ts.
- 11 languages (en + 10): lib/i18n/config.ts.
- Moments with photo-consent: features/moments/MomentsApp.tsx. Newsfeed: routes/posts.ts.
- Registers with allergy/medical/SEND flags, collection PIN, ratio groups and "staff short": features/registers, features/ratios/RatiosApp.tsx.
- Incidents/accidents with body map, DSL concern log with chronology and PDF export, medication MAR with parent notify default on, DBS and credential expiry sweeps, read-and-confirm documents, trips (consent, headcount): features/incidents, features/medication, routes/medications.ts, routes/documents.ts, lib/sweeps.ts, features/trips.
- Rota, availability requests, clock in/out with "scheduled less late" pay policy, holiday and leave, two-sided appraisals, safer-recruitment record incl. right to work, roles and permissions: routes/rota.ts, availability.ts, timeclock.ts, docs/appraisals-handoff.md, routes/onboarding.ts, docs/roles-permissions-handoff.md.
- Payroll estimates (PAYE, NI, pension), branded payslip PDFs, journal posting to Xero/QuickBooks/Sage: server/src/routes/payroll.ts, lib/payslipPdf.ts, routes/accounting.ts, docs/payroll-integrations-handoff.md.
- CSV export on finance views: features/money/*. Invoices, purchase orders, expenses, suppliers, income: routes/invoices.ts, purchasing.ts, expenses.ts, income.ts.

## Claims I corrected (the page overstated the product)

- Custom domain ("a page on your own domain"): not live; the store page is on the platform domain and a subdomain "will point at" it later (app/store/[tenantId]/page.tsx). Now "your own branded booking page".
- Rolling subscriptions / listings that renew themselves: no such listing type; memberships deliver credit/discount on join and have no recurring charge yet (routes/memberships.ts header). Removed from the cards, bullets and the mock listing.
- Gift vouchers: not found in product. Removed. "Voucher" payment now says "childcare vouchers".
- Parent app "installed to the home screen like a native app": no manifest or PWA found. Now "works on any phone, no app store".
- Wallet "top up and save 5%": parents cannot top up; credit comes from refunds, cancellations, credit notes and memberships (server/src/lib/wallet.ts). Reworded in text and mock.
- TFC "auto-matched / auto-split / reconciled for you / Ofsted-ready": auto-reconciliation is pending the HMRC EPP integration (lib/i18n/messages/areas/p8fin.ts recTfcAmirNote); today each booking gets its own payment reference and the operator ticks it off against the bank statement (routes/reconciliation.ts bank-match). Text and the mock status labels now say that. Also removed "reconciled for you" from the finance hero, final CTA and the tour card.
- "Syncs to Sage / Xero / QuickBooks, keep the numbers in step": the integration posts the payroll wages journal only. Now "Payroll journals to Xero, QuickBooks and Sage".
- "HMRC-ready" payroll: figures are estimates and RTI filing is not in the product (routes/payroll.ts line 27). Hero and pay copy now say estimated PAYE, NI and pension.
- Safeguarding mock: "RIDDOR check", "read receipt", "Chronology linked to 2 earlier entries", "audit trail on", "Export for LADO": none found; replaced with Body map, plain DSL notified, DSL chronology entry, "Restricted to the DSL", "Export as PDF". "Amber warning before you breach": not found; now "shows at once when a group is short".
- Learning Centre "39 courses": library has 66 platform courses (features/learning/courseMeta.tsx), docs/website-content-plan-v2.md already said use 60+. Now "60+".
- Card payments only are auto-matched to bookings; bank/TFC are manual. "Card and bank payments land automatically" corrected.

## Needs Kaz (not changed, or changed only as noted)

1. TFC: is Tax-Free Childcare payment live with production HMRC credentials (code defaults to sandbox; docs/tfc/audit-findings.md), and when does the EPP feed (auto-reconcile) land? The pages still advertise TFC as a payment method and a tracked flow. If auto-match ships, the mock labels can go back.
2. Sage: code exists but the live Sage test is still outstanding (memory note). The pages name Sage next to Xero and QuickBooks (finance and staff). Keep, or drop to Xero and QuickBooks until Sage is tested?
3. "CPD-certified" courses (staff page, several places): I cannot verify any CPD accreditation from the repo. Also confirm the live course count behind "60+".
4. Payroll positioning: HMRC RTI submission is not built. I softened "HMRC-ready" to estimates; decide whether to state plainly that filing stays in the customer's payroll provider.
5. Tour page: H1 promises "Your 2-minute tour" but the video is "coming soon". Either record it or rename the page/H1.
6. Stripe 0% commission: franchise royalties (split fees) are a separate feature; the "0% booking commission" claim reads correctly for providers but check wording for franchise HQs.
7. Subscription recurring billing for memberships is still "Phase 2 (Amir)". Page says "monthly membership tiers that give wallet credit or a discount", which is accurate today.
8. "Book a 20-minute walkthrough" (staff CTA) and "Set up in an afternoon, no card needed" (bookings CTA): operational promises I could not verify.
9. Parent-app "11 languages" counts English; the parent portal list matches lib/i18n/config.ts.

## Still looking wrong or not done

- The shared header mega-menu (on all six pages, also all other pages) still says "0% commission, reconciled for you" under Finance & payouts (shared key g.0-commission-reconciled-for-3vim). I did not edit it because it belongs to every page; the lead should change it centrally.
- The shared footer text "your brand, your bank account, zero booking commission" is untouched (true).
- Phone: a ~100px gap sits between the last card and the footer on every page (band padding plus footer margin); tidy and even but could be trimmed further.
- Phone: bookings "Sold out, reminded, refunded" section overlaps in topic with "Ways to sell" (waitlist, cancellations, discount codes); I deduplicated the first grid but left this one because its cards are the primary mention.
- Page-level mocks use illustrative numbers (names, prices, 94% match rate); not verified as they are mock data. The "£500 per quarter per child, HMRC adds 20%" TFC fact is correct as stated by HMRC and was not changed.
- Not tested: dark/Arabic RTL rendering of the new compact rows; translated strings for the re-keyed text (they show English until the lead re-runs the converter and translates).
- Scratch specs `e2e/zz-site-review-b*.spec.ts` deleted, port 8102 server killed.
