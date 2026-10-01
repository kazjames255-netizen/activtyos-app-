# Agent A report: activly.html (home) + pricing.html

Files touched: public/v2/activly.html, public/v2/pricing.html, public/v2/trim-a.css (new, linked after responsive.css in both pages), docs/site-review/a-text-changes.md, this report. Nothing committed. Scratch specs deleted, port 8101 server stopped.

## Phone height (document scrollHeight)
| page | width | before | after | change |
| --- | --- | --- | --- | --- |
| activly | 390 | 18669 | 12285 | -34.2% |
| activly | 360 / 430 | 19449 / 18045 | 12859 / 11818 | -33.9% / -34.5% |
| pricing | 390 | 7651 | 5312 | -30.6% |
| pricing | 360 / 430 | 8725 / 7027 | 5505 / 5019 | -36.9% / -28.6% |
| both | 768 | 14077 / 5384 | 14052 / 5384 | unchanged (trim is <760px only) |
| both | 1440 | 11355 / 4862 | 11329 / 4862 | trim CSS has no effect; activly -26px is from text edits |
No horizontal overflow at any width (scrollWidth = viewport).

## What changed
Phone trim (trim-a.css, nothing deleted from HTML):
- activly: hid hero audience chips, the 3 persona mock-ups (text and links stay), orbit diagram and logo marquee (duplicate of the platform grid), the "what you'll save" teaser (duplicate of the calculator), carousel slide mock-ups (text stays), the TFC mock-up and the chart part of the finance mock (KPI cards stay), testimonials 3 and 4, the "Help & resources" section (3 of 4 cards were "Coming soon"), the anonymous logo strip.
- pricing: hid the compare table (duplicates the plan cards), the chips row, the second "Book a demo" button per card and the hero add-on link. Fixed an existing phone bug: the add-on header collapsed into a one-letter-wide column.
Text and truth fixes: see docs/site-review/a-text-changes.md (30 edits). Main ones:
- "No card needed" was false. Sign-up takes a card, 7-day trial, charged day 7 (server/src/routes/subscription.ts). Reworded on pricing (FAQ, CTA, chip, intro) and home hero.
- "Booking page on your own domain" appears nowhere in the product (no custom-domain feature; storefront takes logo + accent colour: features/setup/SetupApp.tsx). Reworded to "your own logo and colours" in about 8 places, including the "100%" stat, step 1, comparison row.
- "Next day" payouts removed (timing is Stripe's).
- "8 assistants" / "AI team" changed to "AI assistant built in"; only the live-data assistant and message writer exist (docs/website-content-plan-v2.md:582, server/src/routes/ai.ts).
- Testimonial quote about an "AI Front Desk" (not shipped) shortened to its first half.
- "HMRC-ready payroll" softened: payroll.ts says figures are estimates and the RTI/HMRC submission is the provider's. Payroll supports weekly to monthly runs, not only monthly.
- "Locked collection" softened to optional collection PIN/password (a setting).
- "Installed to the home screen" removed (no manifest or install support found).
- "Import your activities" changed (only a family import exists; features/customers/FamilyImport.tsx). "Most providers live within days" removed.
- Wording: duplicate eyebrow and heading ("Everything...") varied; pricing intro de-duplicated.

## Claims verified (file)
Prices, bands, franchise tiers, annual = 10 months: subscription.ts DEFAULT_PLANS. Plan feature split (staff/payroll/learning company+, territories/split fees/white-label franchise): lib/nav/config.ts, features/franchise/*. Payroll, payslips, leave, appraisals, timeclock: nav config + routes. Waitlist, discounts, referrals, wallet, memberships, meals shop, trips headcount, medication, incidents, newsfeed/moments, email campaigns: server/src/routes + lib. Xero/QuickBooks/Sage connectors exist: routes/accounting.ts. League table: HoDashboardApp.tsx. Territory map/overlaps: FranchiseTerritoriesApp.tsx, franchises.ts. Parent portal themed by brand colour: components/shell/ParentBrandTheme.tsx. TFC reconciliation: routes/tfc.ts, reconciliation.

## Needs Kaz (not changed)
- Custom domains: confirm whether the website add-on delivers this; if so, restore "own domain" wording (mock still shows book.yourclub.co.uk).
- Testimonials (4 named customers, "paid for itself in the first week"): permission and truth. Also the Combat Zone quote I shortened.
- "Around 545,000 UK families use TFC", "25+ tools", "£300+/month ... saving roughly £4,000 a year" (arithmetic gives about £3,250), "Live in an afternoon / no migration project", "Trusted by ... across the UK" strip (hidden on phone).
- Competitor names in the marquee (Bookwhen, Famly, Deputy, etc.), and "typical platform 1-3%+ / held and paid later" comparison.
- Sage sync: live test is still outstanding per memory; page says "Syncs to Sage / Xero / QuickBooks".
- TFC "no HMRC portal login needed" and direct HMRC verification (page says "rolling out"; tfc.ts needs HMRC credentials).
- Pricing page: "Priority onboarding & support", the website add-on (AI edit bot, hosting, prices), "Stripe fee ~1.5% + 20p", "cancel anytime" vs annual plans.
- "Branded parent app" naming: it is a themed web portal, not an installable app.

## Still looking wrong / not verified
- Translations: edited strings keep old data-i18n keys, so other languages show old text (including false "no card") until convert.mjs and dictionaries are refreshed. Hero "Free to start" key is now "7-day free trial".
- Money-section intro still says "exactly as it looks inside the platform"; on phones only the KPI cards of the mock show.
- Carousel arrows overlap card edges on phones (existing).
- I did not check 768 for activly visually, and did not test non-English layouts.
