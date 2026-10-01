# E - Independent claims audit: public/v2 website vs the real product

Auditor: agent E (read-only). Tally: 296 claim rows checked - SUPPORTED 151, PARTIAL 79, NOT FOUND/contradicted 29, UNVERIFIABLE 34 (3 mixed rows counted separately). Date: 1 Oct 2026 (Mac clock ~18:30-19:15). Snapshot of pages as they stood when read; agents A-D may have edited pages since, so quotes can drift. Ground truth and file references: see `docs/site-review/e-feature-inventory.md` (cited below as INV). `ev:` = evidence. Verdict key: **S** SUPPORTED (concrete file/route), **P** PARTIAL (true in part, or only under conditions), **N** NOT FOUND IN PRODUCT (or contradicted), **U** UNVERIFIABLE (cannot be proven from the repo).

Pages with demo dashboards (figures such as "£4,315 collected", "312 bookings") are illustrative mock-ups; I treat a number as a claim only when the copy presents it as a fact about results or the product. Pages in scope: activly, parents, companies, freelancers, franchises, schools, pricing, tour, safeguarding, security, dpa, privacy, terms, platform-bookings, platform-comms, platform-finance, platform-safeguarding, platform-staff.

---

## 1. activly.html (home)

| # | Claim | Verdict | Evidence | Suggested wording if not fully supported |
|---|---|---|---|---|
| H1 | "Everything you run - bookings, staff, finance, safeguarding and comms - in one login" | S | nav groups in `lib/nav/config.ts` (INV s1) | - |
| H2 | "Free 1-on-1 demo - no obligation" | S | demo slot booking `server/src/routes/demoSlots.ts`, `app/demo` | - |
| H3 | "Every payment lands in your own account. One flat fee - never a cut of your bookings" | S | direct charges, no application_fee: `server/src/routes/payments.ts:322-352`, `docs/tfc/security-evidence.md` | - |
| H4 | "Free to start" / "Start free" (CTAs) | P | trial is 7 days with a card captured up front, then auto-charges: `server/src/routes/subscription.ts:104`, `/checkout` | "7-day free trial (card required, cancel any time before day 7)" |
| H5 | "Built for the UK" / "Safeguarding built in" | S | UK tax maths, UK ratios, LADO/MASH, DBS; `features/payroll/ukStatutory.ts`, `lib/ratios.ts` | - |
| H6 | "A polished booking page on your own domain" (Freelancer card); "100% Your brand - a booking page on your own domain" | N | custom domains not live: `features/storefront/StorePage.tsx` header ("what their subdomain will serve once hosting/domains exist"), `docs/website-content-plan-v2.md:589` | "A branded booking page with your logo and colours, plus an embed for your own website" |
| H7 | "Payments land in your own account next day" | U | Stripe sets payout timing (new UK accounts usually have a longer first-payout hold); no payout schedule configured in `payments.ts` | "Payouts go to your own bank on Stripe's schedule" |
| H8 | "0% commission on every booking" | S | as H3; `subscription.ts` plans are flat | - |
| H9 | "25+ separate tools replaced by one login" | U | marketing number, no source | drop the number or "replaces many separate tools" |
| H10 | "AI that clears the admin for you" / "AI writes your emails" | P | comms drafter and live-data copilot exist: `server/src/routes/ai.ts` (draft kinds announce/event/reminder/urgent/celebrate/booking) | "AI drafts your messages and answers questions from your live data" |
| H11 | "An AI team built in - 8 assistants" (comparison table) | N | one copilot + one drafter; no other assistants: `server/src/routes/ai.ts`, `features/ai/AiApp.tsx`; plan doc line 589 area lists Front Desk etc. as "coming" | "A built-in AI assistant and message writer" |
| H12 | Testimonial: "the AI Front Desk answers the calls we used to miss" (Combat Zone MK) | N | no phone-answering feature anywhere (grep telephony/front desk in `server/src`, `features` found nothing relevant) | remove quote or replace with a real, approved one |
| H13 | Testimonials from APF Activity Camps, Keeping Kids Off The Street, Combat Zone MK, Kick-Off Sports; "paid for itself in the first week" | U | no customer/consent records in repo; the product is only just live (memory: live 30 Sep) | keep only quotes with written permission on file; otherwise remove |
| H14 | "Trusted by camps, clubs, coaches & childcare providers across the UK" | U | no customer count evidenced | remove or say "built with UK camps and clubs" |
| H15 | Money "£300+ a month in separate subscriptions ... from £29/mo, saving roughly £4,000 a year" | U | arithmetic does not tie (£300x12 = £3,600 gross, before paying £29-£99); illustrative | "Many providers pay for several separate tools; see what you could save" |
| H16 | Calculator: "A 5% commission platform would take..." vs table "1-3%+ per booking" | P | internal inconsistency (5% vs 1-3%); no competitor data in repo | pick one, label it "example rate" |
| H17 | "Passes, blocks, dates & add-ons"; "Single sessions, whole weeks, discounted blocks or subscriptions - plus paid extras" | P | blocks/passes/add-ons real: `features/listings/ListingWizard.tsx`, `routes/listings.ts`; "subscriptions" are not auto-billed (see M1) | "...or subscription-style listings" |
| H18 | "Real basket & card checkout - several children and dates in one basket" | S | `features/listings/checkout.tsx`, `routes/my.ts`; e2e `booking.spec.ts`, `family.spec.ts` | - |
| H19 | "Waitlists ... the next family is offered a freed spot automatically" | S | `server/src/lib/waitlist.ts` (auto mode offers to position 1; 2-hour hold; manual mode exists) | note: "auto mode" is a setting |
| H20 | "Discount codes: percentage or fixed, limited per family, stacking the way you choose" | S | `server/src/lib/discountCodes.ts`, `discountRedemptions.ts`; e2e `coupons.spec.ts` | - |
| H21 | "Tax-Free Childcare & funding accepted ... reconciled back to the booking" | P | TFC is a selectable method with a minted per-child reference and a manual reconcile tick; no live HMRC link: `routes/reconciliation.ts`, `routes/tfc.ts` ("not connected" without credentials) | "Accept Tax-Free Childcare at checkout and track every payment against the booking with a unique reference" |
| H22 | "Message centre - 1:1 & group chat"; "Email campaigns to booked families, a listing, or your whole list" | S | `routes/messages.ts`, `routes/emails.ts`; e2e `messages-broadcast.spec.ts`, `email-audiences.spec.ts` | - |
| H23 | "Your own branded parent app ... installed to the home screen" | P | branded responsive web app; no web manifest/service worker in repo; plan doc: "not yet a home-screen PWA" | "Your logo and colours in a mobile web app parents log in to from any browser" |
| H24 | "Newsfeed, moments & receipts - receipts go out automatically after every payment" | S | `routes/posts.ts`, `routes/moments.ts`, receipts `features/parent/paymentReceipt.ts`, `lib/emails.ts` | - |
| H25 | "Rota, availability & clock in/out ... everyone clocks in and out from their phone" | S | `routes/rota.ts`, `availability.ts`, `timeclock.ts`; staff portal "My shifts & clock" | - |
| H26 | "Timesheets straight into payroll" | S | `features/payroll/PayrollApp.tsx` header (pay runs from APPROVED timesheets) | - |
| H27 | "PAYE payroll ... estimated PAYE, NI and pension, and payslips in your brand" | S | `features/payroll/ukStatutory.ts`, `lib/payslipPdf.ts`; honest "estimated" | - |
| H28 | "Monthly pay with estimated PAYE" | P | engine also supports weekly/fortnightly/4-weekly (`payCalc.ts` PPY) - site undersells | "Weekly, fortnightly, 4-weekly or monthly pay runs" |
| H29 | "HMRC-ready" payroll (also on platform-staff, companies) | N | no RTI/FPS/EPS submission; figures labelled estimates: `ukStatutory.ts` header, `PayrollApp.tsx` header; run lines partly browser-computed | "UK PAYE, NI, pension and student-loan calculations and payslips; export to your accounts package. HMRC filing stays with your payroll provider" |
| H30 | "Holiday, absence & appraisals - UK entitlement worked out" | S | `lib/holiday.ts` (5.6 weeks capped 28 days); `features/appraisals` | - |
| H31 | "Safer-recruitment onboarding & DBS - track DBS checks and expiry" | S | `features/team/OnboardingApp.tsx`, `routes/onboarding.ts`, `routes/credentials.ts` | "tracks" not "performs" - already worded right |
| H32 | "Training centre - CPD courses & certificates" | P | course library + certificates exist (`features/learning`); no CPD accreditation found | "Training library with certificates (CPD-style content)" |
| H33 | "Roles & permissions - office sees money, coaches see only their sessions" | S | `server/src/middleware/access.ts`, e2e `staff-portal.spec.ts` | - |
| H34 | "Invoices, purchase orders & expenses" | S | `routes/invoices.ts`, `purchasing.ts`, `expenses.ts` | - |
| H35 | "Payments auto-reconciled - card, funding and bank payments are matched to the right booking automatically" | P | card settles automatically via Stripe webhook; TFC/voucher/bank are matched BY HAND: `routes/reconciliation.ts` header ("matched by hand here"), `/bank-match` | "Card payments reconcile automatically; funding and bank payments are matched to bookings with a unique reference and a one-tap tick" |
| H36 | "Refunds computed & recorded" | S | `docs/partial-cancel-handoff.md`, `routes/bookings.ts`; e2e `booking-lifecycle.spec.ts` | - |
| H37 | "Franchise split-fees & royalties - worked out to the penny" / "Paid automatically" | P | calculated: `routes/splitfees.ts`; collection is off-platform: `docs/splitfees-payout-handoff.md` | "Royalties calculated to the penny; settle however you agree with each franchisee" |
| H38 | "Syncs to Sage / Xero / QuickBooks - push your figures" | P | only the payroll wages journal posts: `routes/accounting.ts` `POST /post/:runId`; Sage never live-tested | "Post payroll journals to Xero, QuickBooks and Sage (Sage in early access)" |
| H39 | "Live registers & ratio checks - ratios update live and warn before you breach" | S | `routes/ratios.ts`, `lib/ratios.ts`, `RegistersApp.tsx` | - |
| H40 | "Allergy, medical & SEND flags on the register" | S | `routes/registers.ts` (care card, allergies, SEND) | - |
| H41 | "Trips - risk assessment, parent consent per child, headcount out and back" | S | `routes/trips.ts`; e2e `trips-consent.spec.ts` | - |
| H42 | "Meals, allergens & caterer reports" | S | `routes/meals.ts`, `mealMenus.ts`; `features/meals` | - |
| H43 | "Incidents, accidents & medication logs (MAR), with the parent notified" | S | `routes/incidents.ts`, `medications.ts` (`notifyParent*`) | - |
| H44 | "DBS & certificate tracking with expiry reminders" | S | `routes/credentials.ts`, `lib/sweeps.ts` | - |
| H45 | Franchise: "Live overview", "Per-franchisee branding", "League tables and network roll-up" | S | `features/franchise/HoDashboardApp.tsx`, `lib/brand-theme.ts` | verify league-table wording; dashboard has by-franchise ranking |
| H46 | Franchise: "Draw territories, approve each patch and prevent overlap" | P | drawing + HO approval real (`routes/franchises.ts`); overlap is an approximate read-only warning: `FranchiseTerritoriesApp.tsx:4,77-83` | "...and get warned when territories overlap" |
| H47 | Franchise: "each site settles to its own account" (also franchises.html "own brand, own bank") | N | franchise accounts cannot create or open a Stripe account; they share the head office's tenant account: `server/src/routes/payments.ts:70-75, 139-142` | "Franchisee takings are tracked per franchise; head office holds the Stripe account and settles royalties with each site" |
| H48 | "Memberships, packages & feature control - Standardise memberships" | P | `FranchiseFeaturesApp.tsx` feature control real; memberships benefit-on-join only | - |
| H49 | "Run the day sorted: Registers with locked collection - verified every time" | P | collection password is displayed to staff and `collectedBy` is free text on the server: `routes/registers.ts:45,451`; nothing blocks release without it | "A collection password on every child, shown to staff at the door, and a record of who collected" |
| H50 | "Marketing & growth: what quiet dates are worth ... campaigns to live-listing audiences" | P | marketing view and Email audiences exist; revenue-per-empty-seat tool not verified | verify "Growth" view before keeping |
| H51 | "Meals: parents pre-order & pay" | S | `routes/mealsShop.ts` | - |
| H52 | TFC section: "Around 545,000 UK families pay with Tax-Free Childcare" | U | external statistic, no source cited | cite HMRC source and date or remove |
| H53 | TFC: "Parents pay with their TFC code at checkout"; "no logging into the HMRC portal for every transaction"; checkout mock "No HMRC portal login needed" | N | parent must still pay from their own HMRC account using the reference; direct HMRC pay is env-gated and off: `routes/tfc.ts` (answers "not connected"), `docs/tfc/audit-findings.md` | "Parents choose Tax-Free Childcare at checkout and get your account details plus their child's unique payment reference" |
| H54 | TFC: "Every payment matched & reconciled to the booking" | P | matching is manual with a minted reference: openapi v0.35.0, `reconciliation.ts` | "Every payment tracked against the booking and child" |
| H55 | "Direct HMRC verification - rolling out" | S | honest: client built, not live: `lib/tfc.ts`, `docs/tfc/security-evidence.md` | - |
| H56 | Finance mock: "Next payout Fri 12 Sep Barclays ..4471"; "92% collected" | U | illustrative mock; product shows Stripe payout in the Stripe Express dashboard | label as example |
| H57 | "No platform holds your cash - it settles straight to your own bank via Stripe Connect" | S | `payments.ts`, `lib/stripe.ts` | - |
| H58 | "Setup guides / Blog / Community - Coming soon"; "Trust & security - Live" | S | honestly flagged | - |
| H59 | Language selector shows 11 languages | S | `lib/i18n/config.ts` | - |
| H60 | Nav "Watch a 2-min tour" | N | tour page says "Full walkthrough - coming soon" (tour.html) | "Product tour (coming soon)" or link to `/how-it-works` |
| H61 | "Your brand, your bank account, zero booking commission" (footer) | S | as H3 | - |
| H62 | Brand: "Activly" | P | the app, emails and sign-in still display ActivityOS: `lib/i18n/config.ts` `BRAND`, `public/v2/nametbc.version` | align before launch (see cross-page section) |

## 2. pricing.html

| # | Claim | Verdict | Evidence | Suggested wording |
|---|---|---|---|---|
| P1 | Freelancer £29/mo, £290/yr | S | `subscription.ts` `DEFAULT_PLANS` (29; annual = 10 months) | - |
| P2 | "Just £24/mo billed yearly - 2 months free" | S | 290/12 = 24.17 | - |
| P3 | Company from £49/mo; Starter <=10 £49, Growth 11-30 £69, Scale 31-75 £89, 76+ £89 + £1/staff | S | `DEFAULT_PLANS.company.bands` | - |
| P4 | Company annual £490/£690/£890, 76+ £890 + £10/staff; "From £41/mo billed yearly" | S | 10-month rule; 490/12 = 40.8 | - |
| P5 | Franchise £99/mo HQ, £990/yr, "£83/mo billed yearly" | S | `DEFAULT_PLANS.franchise` | - |
| P6 | Franchisee fee first 5 £39, next 10 £31, rest £25; annual £390/£310/£250; "Your own head-office venues are free" | S | `franchiseTiers` in `subscription.ts`; "free HQ venues" consistent with metering only accepted franchisee invites | - |
| P7 | "You start with a free trial" / "Free trial to start" | S | 7-day trial exists | state length |
| P8 | "Free trial, no card needed" (FAQ, CTA band); platform-bookings "Set up in an afternoon - no card needed" | N | trial captures a card first (SetupIntent) and auto-charges on day 7: `subscription.ts:244-262,378`, `docs/subscription-billing-handoff.md:12`; e2e `subscription-billing.spec.ts` ("fresh signup through the gate's real PaymentElement") | "7-day free trial. Card required; you are charged on day 7 unless you cancel." |
| P9 | "Standard Stripe card fees (~1.5% + 20p)" | P | Stripe's standard UK card rate; premium/EEA/international cards cost more; platform does not charge | "from 1.5% + 20p for standard UK cards; other cards cost more" |
| P10 | "No setup fee, no lock-in. Rolling monthly - cancel anytime" | P | cancel takes effect at end of billing period, fees paid non-refundable: `terms.html` s5; annual plans are not "monthly" | "Cancel any time; cancellation applies at the end of the paid period" |
| P11 | "No per-child fees"; "never by bookings" | S | plans priced by staff/franchisee count | - |
| P12 | Company plan includes "Roles & permissions"; Freelancer includes "Live-data AI copilot" | S | `middleware/access.ts`; freelancer nav includes AI | - |
| P13 | "Priority onboarding & support" (Franchise) | U | no support SLA or onboarding process evidenced | describe the actual support channel/hours |
| P14 | Website add-on "From £300-£500", "unlimited changes", "built-in AI edit bot updates the live site", "Hosting, updates and uptime handled" | N | no website-builder/edit-bot product found; `features/platform/ActivlySiteApp.tsx` is HQ's own site tooling; no hosting product | mark as bespoke service, drop "AI edit bot" and "uptime" until built |
| P15 | "Don't have a domain? We sort this for you at no extra cost" | U | service promise, no product backing | confirm operationally |
| P16 | "Can I move my data across? Yes - import your activities and families" | P | families CSV import exists (`features/customers/FamilyImport.tsx`); no activity/listing importer found | "Import your families from a spreadsheet; we help set up your sessions" |
| P17 | "Most providers are live within days" | U | product live only since 30 Sep; no onboarding stats | "Set up in an afternoon" is also unverified |
| P18 | Compare table: Freelancer lacks staff scheduling/payroll; Company+Franchise have them | S | nav per portal (INV s1) | - |
| P19 | "Territories, split-fees & royalties" (Franchise only) | S | franchise-only nav | - |
| P20 | "Discounts, referrals & memberships" in all plans | S | in freelancer nav | memberships caveat (M1) |
| P21 | "Tax-Free Childcare & reconciliation" in all plans | P | see H21/H54 | - |

## 3. parents.html

| # | Claim | Verdict | Evidence | Suggested wording |
|---|---|---|---|---|
| PA1 | "Free for families - always" | P | true as architecture (providers pay), but "always" is a promise | "Free for families" |
| PA2 | "No paper forms, no bank transfers" | P | bank transfers still occur for TFC/voucher/bank methods | "Fewer paper forms and bank transfers" |
| PA3 | "Card, childcare vouchers or Tax-Free Childcare - with a receipt, instantly" | S | method selection and receipts: `features/listings/checkout.tsx`, `paymentReceipt.ts` | - |
| PA4 | "Accidents and incidents recorded and sent to you in writing" | S | `routes/incidents.ts`, `features/incidents/ParentAccidentsApp.tsx` | - |
| PA5 | "Amend or cancel within your provider's rules - join a waitlist that moves you up automatically" | S | waitlist FIFO, `lib/waitlist.ts`; cancel rules | - |
| PA6 | "Payment plan where your provider offers one" | N | no instalment/payment-plan feature found | remove or confirm |
| PA7 | "Wallet & credit - cancellations, goodwill, referral rewards land as credit and come off at checkout" | S | `lib/wallet.ts`, `features/parent/WalletApp.tsx` | - |
| PA8 | "Top up & save 5%" (mock app) | N | no top-up route in `server/src/routes/wallet.ts`/`my.ts`; wallet is credit from refunds/membership/referral | remove "Top up & save" |
| PA9 | "Memberships - join a tier; monthly credit dropped into your wallet; Club £15/mo" | P | tiers exist; benefit delivered on join, no recurring charge: `routes/memberships.ts` header | "join a membership tier ... (monthly billing coming)" |
| PA10 | "Priority booking on new terms before they open to everyone" | N | no early-access gating found in membership code | remove |
| PA11 | "Codes & sibling discounts; block-booking or early-bird savings worked out for you" | S | `lib/discountCodes.ts`, `lib/bundlePricing.ts` | - |
| PA12 | "Refer a friend - you both get credit" | S | `routes/referral.ts`, `ReferApp.tsx` | - |
| PA13 | TFC: "choose TFC at checkout and you get the provider's account details and your child's own payment reference" | S | minted reference `CC-TTT-SSSS-KX` per booking-and-child: openapi v0.35.0 | - |
| PA14 | "Matched automatically when it clears - no emailing screenshots" | N | matching is the operator's manual tick; no bank feed: `reconciliation.ts` | "Your provider matches it to your booking using your child's reference" |
| PA15 | "A unique reference per child, so payments can't land against the wrong booking" | S | injective reference function (openapi v0.35.0); caveat: only for bookings created after v0.35 | - |
| PA16 | "Part-pay with TFC and put the rest on a card in the same checkout" | U | partial/part-payment exists in ledger ("Partially paid"); mixed-method checkout not verified | verify |
| PA17 | "Overpaid or cancelled? The difference goes to your wallet" | P | overpaid/needsRefund surfaced on ledger; refund to wallet exists | verify automatic behaviour |
| PA18 | "Employer childcare vouchers work the same way where your provider accepts them" | S | `voucherScheme` in `reconciliation.ts` | - |
| PA19 | "Child profile once: medical, allergies, dietary, SEND, doctor, emergency contacts, who's allowed to collect" | S | `routes/children.ts`, `ChildrenApp.tsx` | - |
| PA20 | "Only people on your list can [collect]" | P | no server enforcement (`collectedBy` free text); UI shows list | "who may collect is recorded and shown to staff" |
| PA21 | "Medication & consent - written permission; staff see it on the register" | S | `routes/medications.ts` | - |
| PA22 | "Trips: read the details and give consent with a tap" | S | `routes/trips.ts`; e2e `trips-consent.spec.ts` | - |
| PA23 | "Meals - flagged allergen clashes" | S | `routes/meals.ts` | - |
| PA24 | "Photos shared privately with you, only with your consent; excluded if consent off; staff see the flag" | S | `routes/moments.ts` (server-enforced `photoConsent`) | - |
| PA25 | "Ask the assistant: 'What did I pay in July?'" | S | parent AI scope: `routes/ai.ts` (custdash portal) | - |
| PA26 | "The whole app is available in 11 languages" | P | 11 locales exist; ur/pa/bn/cy strings machine-written, native review pending: `docs/i18n-native-review.md` | "available in 11 languages" is fine; avoid "most widely spoken UK" superlatives |
| PA27 | "Do I have to download an app? No. It runs in your phone's browser and you can add it to your home screen" | S | browser web app (works as bookmark shortcut) | - |
| PA28 | "Second parent can have their own login to the same children" | U | not verified in code | check `children.parentUid` model (children keyed to one `parentUid`) |
| PA29 | "Only your provider sees it. Not pooled, sold, or handed to anyone else" | P | provider-scoped isolation proven (`franchise-isolation.spec.ts`, `isolationTest.mts`); but data also flows to sub-processors (Firebase, Stripe, Groq AI, HMRC) | "not sold; shared only with the providers you book and our sub-processors" |
| PA30 | "Medical and safeguarding information shown only to the people running your child's session" | P | role/site scoping real (`childAccess.ts`, `siteScope.ts`); "only" is strong | soften |
| PA31 | "Encrypted in transit and at rest" | P | transit at host; Firestore at rest by Google; field-level AES only for staff NI/bank: `docs/tfc/security-evidence.md` | "encrypted in transit and at rest on Google Cloud" |
| PA32 | "View what's held, correct it, or ask for deletion" | S | `routes/privacy.ts` (see, download, deletion REQUEST) | - |
| PA33 | "Some records must legally be retained; everything else can go" | P | deletion is a recorded request actioned by provider/platform; no automatic wipe: `routes/privacy.ts` header | "we pass the request to your provider and delete what the law allows" |
| PA34 | "Records timestamped and kept properly" | S | registers/incidents/medication entries carry `by`/`at` | - |
| PA35 | "Six photos from the trip land in Moments" etc. (journey) | S | illustrative; feature exists | - |
| PA36 | "Thursday cancelled for weather, credit already in your wallet" | P | provider-cancelled session credit: `partial-cancel` logic exists; automatic weather-cancel credit not verified | present as example |

## 4. companies.html

| # | Claim | Verdict | Evidence | Suggested wording |
|---|---|---|---|---|
| C1 | "Build a listing once. It runs at every venue ... prices, capacity and ratios travel with it" | P | locations/venues + listings in company portal; "published to every site at once" multi-site publish not verified: `features/listings`, `routes/locationStaff.ts` | verify before keeping "every site at once" |
| C2 | "Four minutes from new listing to first booking" (also freelancers "4 min") | U | invented timing | remove the number |
| C3 | "About six hours a week, per site" saved | U | no measurement | remove or label as estimate |
| C4 | "Open your fifth venue without hiring someone" | U | marketing claim | - |
| C5 | "Never oversell: age bands and staff ratios cap the numbers at checkout" | P | age-range check at booking (`routes/my.ts:940`) and capacity caps (`blockDomain.ts`) real; staff-ratio-based caps at checkout not verified (`my.ts:1400` ageCapsOn) | "capacity and age limits are enforced at checkout" |
| C6 | "Card, Tax-Free Childcare, wallet credit or a voucher - taken at the moment of booking" | P | TFC/voucher are chosen at booking but paid later and reconciled; only card/wallet is "taken" | "chosen at booking" |
| C7 | "Live clock-ins across every site"; "Late auto-deducts (your rules)" | S | `routes/timeclock.ts`; e2e `timeclock-staff-correction.spec.ts`; platform-staff late auto-deduct | - |
| C8 | "The week's wages total as it is worked" | P | rota shows est. wages (platform-staff mock: "est. £1,310 wages"); live wage totalling not verified | - |
| C9 | "You're told a shift leaves you short with days to spare" | P | `lib/schedulingGap.ts` exists | verify alert timing |
| C10 | "Clock-in becomes timesheet becomes payslip. Nobody rekeys" | S | payroll built from approved timesheets | - |
| C11 | "94% of HMRC payments land against the right child and booking on their own" | N | fabricated statistic; no automatic HMRC matching exists: `reconciliation.ts` | remove |
| C12 | "HMRC pays by BACS with a terse reference ... Every payment matched to the right child and booking; Auto-matched / Auto-split" (mock table) | N | the product has no bank-feed ingestion or batch splitting: `reconciliation.ts` header ("matched by hand"), `bank-match` "matches on nothing" | "Record each HMRC payment against a child's unique reference with one tap" |
| C13 | "Two days a month, back" / "Close the month in an hour" | U | invented | remove |
| C14 | "Funded hours - LA reconciled" rows (mock) | P | `Funded` pay status exists (`reconciliation.ts` isReconciled); LA batch import does not | - |
| C15 | "Every site in one view" | S | `HoDashboardApp.tsx`, company dashboard | - |
| C16 | "Compliance you can prove: ratios, DBS tracking, medication locks and read-and-confirm policies" | S | `staffPolicy.ts`, `medications.ts`, `DocumentsApp.tsx` | - |
| C17 | "Easy cancellations: refunds go back to card or to wallet credit" | S | `routes/bookings.ts` refund paths | - |
| C18 | "Vouchers & codes - Sell gift vouchers" | N | no gift-voucher product in `server/src`/`features` (grep) | "Run discount codes and referral rewards" |
| C19 | "Memberships for parents ... applied automatically at checkout" | P | benefit applied; billing not recurring (M1) | - |
| C20 | "Registers live across all your venues; collection PIN & who picked up" | P | registers per session; company-wide live aggregate exists; "PIN" is the collection password | use "collection password" consistently |
| C21 | "Live ratio per age band, per site; amber warning before you breach" | S | `routes/ratios.ts` | - |
| C22 | "Meals: drag-to-day, allergen matching, parent pre-order" | S | `features/meals` | drag-to-day unverified but low risk |
| C23 | "Trips: digital consent per child, headcount out & back, emergency contacts" | S | `routes/trips.ts` | - |
| C24 | "Leave: UK entitlement worked out; approve/deny; who's off and which sessions need cover" | S | `lib/holiday.ts`; `features/holiday` | cover-gap display unverified |
| C25 | "Events calendar - shareable with staff & parents"; "Activity timetable - visible to staff on shift"; "Task manager" | S | `routes/calendarEvents.ts`, `timetables.ts`, `tasks.ts` | - |
| C26 | "In 11 UK-parent languages" | S/P | see PA26 | - |
| C27 | "HMRC-ready payroll" | N | see H29 | - |
| C28 | "Installs like a native app" | P | see H23 | - |

## 5. freelancers.html

| # | Claim | Verdict | Evidence | Suggested wording |
|---|---|---|---|---|
| F1 | "A booking page on your own domain ... set up in an afternoon" | N/U | own domain not live (H6); "afternoon" untested | see H6 |
| F2 | "Payments land in your Stripe next day" | U | see H7 | - |
| F3 | "Admin runs itself: waitlists, reminders, refunds and registers handle themselves" | P | waitlist auto mode, reminders (`autoEmails.ts`) and refund calc exist; registers are taken by a person | "waitlists, reminders and refund calculations are automatic" |
| F4 | "Reconciliation: card, TFC and bank transfers matched automatically" | P | see H35 | - |
| F5 | "Inventory: low-stock alerts, carries over each season" | P | `features/inventory` exists; alerting/carry-over not verified | verify |
| F6 | "Ratios & groups", "Trips", "Calendar", "Timetable", "Tasks" for freelancers | S | freelancer nav (INV s1) | - |
| F7 | "Registers & receipts sent automatically" | S | `lib/emails.ts` receipts | - |
| F8 | "Reconciled 96%" (mock) | U | illustrative | label as example |
| F9 | Same listing/booking feature claims as companies (vouchers, memberships, blocks, subscriptions) | P | see C18, C19, H17 | - |

## 6. franchises.html

| # | Claim | Verdict | Evidence | Suggested wording |
|---|---|---|---|---|
| FR1 | "Franchisees run their patch in their own brand" | S | per-franchise brand `lib/brand-theme.ts`, `FranchiseFeaturesApp.tsx` | - |
| FR2 | "5 franchises - own brand, own bank" ; "each franchisee settles to their own account" | N | franchise role cannot create/open a Stripe account (shares head office's): `routes/payments.ts:70-75,139-142` | see H47 |
| FR3 | "Royalties to the penny - split fees and royalties calculated automatically" | S | `routes/splitfees.ts` | - |
| FR4 | "Head office - royalties 10% - calculated" | S | configurable rate (revenue % or per-booking) | - |
| FR5 | "Standardise with a click: set a feature, listing or policy once and roll it out" | P | feature control exists (`FranchiseFeaturesApp.tsx`); listing/policy push-down not verified | verify |
| FR6 | "Territories: postcode-accurate boundaries; approve or reject each patch; overlap protection - no two franchisees clash" | P | drawn polygons (not postcode-lookup), HO approval, overlap is a warning only | see H46 |
| FR7 | "Needs attention: revenue down 41%, territory awaiting approval, uncollected, invite pending" | S | `hoOverview.ts`/`HoDashboardApp.tsx` attention list | - |
| FR8 | "Network revenue / bookings / league table" | S | `HoDashboardApp.tsx` | - |
| FR9 | Nav of mock: "Franchises, Territories map, Feature control, Invite franchises, Milestones, Split fees, Compliance & certs, Documents" | S | company nav | - |

## 7. schools.html

| # | Claim | Verdict | Evidence | Suggested wording |
|---|---|---|---|---|
| SC1 | "Trust office: Dashboard, Network, Schools, Term dates, Feature control, Invite schools, Take-up" | N | no such nav items or views; schools use the Company/Franchise portal: `lib/nav/config.ts` | present as "run each school as a franchise-style site under one head office" |
| SC2 | "Central sees take-up, income and unpaid balances across the trust; each school sees only its own" | P | HQ rollup + franchise isolation real (`HoDashboardApp.tsx`, e2e `franchise-isolation.spec.ts`); "take-up" report not found | - |
| SC3 | "Safeguarding oversight - incidents and medication across the trust, read-only" | P | `features/franchise/HoOversightApp.tsx` exists; plan doc says medication cross-franchise scoping was rolling out | verify before keeping |
| SC4 | "Set a policy, price list or club template once and roll it out" | U | see FR5 | - |
| SC5 | "Parents pay card, employer vouchers or TFC. Each child gets their own payment reference" | S | minted references (openapi v0.35.0) | - |
| SC6 | "Arrears you can actually see ... reminders that go out on their own" | S | reconciliation outstanding + `autoEmails.ts` paymentDue | - |
| SC7 | "Funded, free and staff places come off the invoice automatically, still on register/take-up" | P | `Funded` pay status; "staff-discounted" place type not verified | verify |
| SC8 | "Late collections logged for charging" | P | `nudges` for late pick-up exist in `registers.ts:64`; no late-fee charging found | "late pick-ups are recorded and chased" |
| SC9 | "Attendance list ready to export" | S | CSV export in `RegistersApp.tsx` | - |
| SC10 | "Parents notified if a child didn't arrive" | U | absent marking exists; automatic "didn't arrive" notification not verified in `registers.ts` | verify |
| SC11 | "Policies read and confirmed with version history" | S | `features/documents/DocumentsApp.tsx`, `lib/sweeps.ts` | - |
| SC12 | "Safer recruitment records: DBS, references, right to work, qualifications, induction; cleared to start gate before rota" | S | `staffPolicy.ts`, `routes/references.ts`, `onboarding.ts` | - |
| SC13 | "Does this replace our MIS? No. Lists and registers export as CSV" | S | CSV exports | - |
| SC14 | "Who is the data controller? You are. Data held in line with UK GDPR, encrypted in transit and at rest" | P | roles consistent with DPA; encryption wording see PA31 | - |
| SC15 | "Rotas, cover, hours; TAs as staff with roles" | S | staff portal, rota | - |
| SC16 | "Training: safeguarding, food hygiene, paediatric first aid course library" | S | `features/learning/courseContent*.ts` | - |
| SC17 | "Roles per person: office, club lead, DSL, business manager" | P | per-area permission matrix exists; named roles are templates at best | verify names |
| SC18 | "Reception to Y6 Breakfast Club / 7:45 / £4.50" | S | illustrative listing mock | - |

## 8. tour.html

| # | Claim | Verdict | Evidence | Suggested wording |
|---|---|---|---|---|
| T1 | "Full walkthrough - coming soon" | S | honest | - |
| T2 | Area cards link to the 5 platform pages | S | pages exist | - |
| T3 | Home/nav promise "Watch a 2-min tour" (on every page) | N | contradicts T1 | see H60 |

## 9. safeguarding.html

| # | Claim | Verdict | Evidence | Suggested wording |
|---|---|---|---|---|
| SG1 | "No consent, no dose - a dose cannot be recorded without parental consent on file; the record is rejected" | S | `routes/medications.ts:349` (409 "No parental consent on file") | - |
| SG2 | "Every dose goes on the MAR with the name of the person who gave it" | S | `medications.ts` (`by`) | - |
| SG3 | "A trip cannot be marked ready or completed while a child is missing consent" | S | `routes/trips.ts` ~376-392 (409) | "signed off or completed" matches the code better than "ready" |
| SG4 | "No lapsed certificate on a rota: an expired first aid or safeguarding certificate cannot be rostered" | S | `routes/shifts.ts`, `lib/staffPolicy.ts` KEY_CERTS (blocks when a cert on file is expired; a MISSING cert does not block, only a missing DBS) | add: "when you switch on compliance (on by default)" |
| SG5 | "These are refused by the server - there is no continue anyway" | S | server 409s above | - |
| SG6 | "Collection password: if they can't give it, the child doesn't leave" | N | password is shown to staff on the register; nothing in `routes/registers.ts` blocks collection: `RegistersApp.tsx:718`, `registers.ts:451` | "a collection password is shown to staff on the register so they can ask for it" |
| SG7 | "Collected by - recorded; only people on that family's list can be chosen; walk-home is separate flag" | P | `collectedBy` recorded; list restriction not server-enforced | verify UI |
| SG8 | "Ratios calculated live, flag the moment you drop below, on site and on trips" | P | live on register/ratios; "on trips" ratio target on trips only partly verified | - |
| SG9 | "Roll call, any time; headcount at every stage of a trip, recorded" | S | `RegistersApp.tsx` Roll call; trips headcount | - |
| SG10 | "Submitting a concern notifies your named safeguarding lead automatically" | S | `server/src/lib/dslAlert.ts` | - |
| SG11 | "Your categories, your protocol - editable concern categories and 'what to do now' steps" | S | `features/setup/SetupApp.tsx` safeguarding settings; `LogConcernApp.tsx` | - |
| SG12 | "LADO, MASH and out-of-hours numbers for every council you work in, click-to-call, on the exported record" | P | LADO/MASH fields exist in `routes/incidents.ts`; per-council multiples and click-to-call not verified | verify |
| SG13 | "Decision and action recorded on same record; exports as a PDF" | S | `features/incidents/SafeguardingApp.tsx` (pdf), `incidents.ts` | - |
| SG14 | "Accidents: parent emailed and notified in-app, and chased until they acknowledge" | P | notify + optional `requireAcknowledgement` setting: `incidents.ts:229-236`; the "chased until" sweep not confirmed | "...and, if you switch it on, asked to acknowledge" |
| SG15 | "Every concern, accident, dose and register entry carries who recorded it and when" | S | `by`/`at` fields | - |
| SG16 | "Safer recruitment: one record per person; 'Start on hold' vs 'Cleared to start'" | S | `lib/i18n/messages/areas/team.ts`, `staffPolicy.ts` | - |
| SG17 | "Policies with version history, assigned to roles, who has read the current version" | S | `DocumentsApp.tsx` | - |
| SG18 | "No shared logins; None/View/Edit matrix per area; money doesn't reach staff" | S | `middleware/access.ts`; e2e `staff-portal.spec.ts` | - |
| SG19 | "Training on the same record: safeguarding, first aid, food hygiene" | S | `features/learning` | - |
| SG20 | "Photo consent respected; staff see flag before the photo" | S | `routes/moments.ts` | - |
| SG21 | "Held in line with UK GDPR, encrypted in transit and at rest; not pooled, sold or shared" | P | see PA29/PA31 | - |
| SG22 | "Records ... kept properly and exportable so SAR isn't an archaeology project" | P | export for registers/concerns exists; SAR tooling partial (`routes/privacy.ts`) | - |
| SG23 | "Activly records, prompts and, in three places, refuses. It does not decide suitability..." | S | accurate scope statement | good copy |
| SG24 | "Fifteen minutes, your own setting's scenario, no slides" (demo) | U | operational promise | - |

## 10. security.html

| # | Claim | Verdict | Evidence | Suggested wording |
|---|---|---|---|---|
| SE1 | "Every connection is secured with HTTPS/TLS" | S | Vercel/Railway TLS (host-provided; `docs/tfc/security-evidence.md` marks "to be confirmed" for TLS termination) | - |
| SE2 | "Data is encrypted at rest on the infrastructure that stores it" | S | Google Firestore default encryption | - |
| SE3 | "Each provider's data is logically isolated" | S | server-derived scope; `server/src/isolationTest.mts`; e2e `franchise-isolation.spec.ts`; but no Firestore rules file and isolation is app-code only | add nothing; do not claim "can never" |
| SE4 | "One provider can never see another's families, staff or finances" | P | tests prove it for tested paths; "never" is absolute, evidence lists known limits | "cannot see" |
| SE5 | "Role-based permissions, least privilege" | S | `middleware/role.ts`, `access.ts` | - |
| SE6 | "Runs on Google Cloud / Firebase infrastructure in UK/EU regions" | U | regions not evidenced; the app also runs on Vercel and Railway (not mentioned): `docs/tfc/security-evidence.md` "to be confirmed" | name all hosts; state regions only once confirmed |
| SE7 | "Passwords never stored - salted hash by our authentication provider" | S | Firebase Auth | - |
| SE8 | "Regular backups ... with monitoring to catch issues early" | U | backup/PITR settings "to be confirmed"; no monitoring tooling evidenced beyond `lib/monitor.ts` | confirm Firestore backups before keeping |
| SE9 | "Card payments run through Stripe (PCI-DSS). Card numbers never stored on our systems" | S | `routes/payments.ts` (no card fields), Stripe Elements | - |
| SE10 | "Breach response ... notify the ICO within 72 hours where required" | U | written procedure not evidenced ("incident process to be confirmed") | produce the procedure |
| SE11 | "Staff bound by confidentiality, trained on data protection" | U | no evidence | confirm |
| SE12 | "UK GDPR & DPA 2018 ... DPA you sign at set-up" | P | DPA page exists but is a DRAFT with [TBC] placeholders and there is no sign-at-set-up flow found | "DPA available; accepted at sign-up" only when the flow and final text exist |
| SE13 | "Named sub-processor list" | P | listed in DPA but incomplete: Vercel, Railway and Groq are used and Groq appears only in the privacy page, not in DPA Schedule 3; email provider "TBC" | complete the list |
| SE14 | "Data export whenever you want it" | P | per-user export `routes/privacy.ts`; tenant-wide export is CSV per area | - |
| SE15 | "Certifications on our roadmap (ISO 27001, Cyber Essentials) - status: in progress" | U | no evidence of any certification process underway; honest that none is held | "none held today; we plan to pursue Cyber Essentials" (drop "in progress" unless it is) |
| SE16 | "DBS tracking, live ratios, medication locks, read-and-confirm policies - the evidence you need at inspection" | P | features real; "the evidence you need" is an Ofsted-type promise | "evidence to help you at inspection" |

## 11. dpa.html / privacy.html / terms.html (legal)

| # | Claim | Verdict | Evidence | Suggested wording |
|---|---|---|---|---|
| L1 | DPA/Privacy/Terms all headed "Draft for review ... [operating company legal name - TBC], company no. [TBC], ICO registration no. [TBC], contact [TBC]" | N | placeholders live in public legal pages; no ICO registration number is evidenced anywhere | fill or take the pages down before taking customers; the ICO fee/registration is a legal requirement for a controller |
| L2 | Privacy: "AI provider (currently Groq) ... not used to train third-party models" | U | Groq confirmed in `server/src/routes/ai.ts`/`platformSupport.ts`; the no-training statement depends on Groq's terms | confirm contract/setting; also add Groq to DPA Schedule 3 |
| L3 | Privacy/DPA: "HMRC" listed as a sub-processor "where TFC features are used" | P | HMRC would be an independent controller, and the integration is not live | reword as recipient, not sub-processor |
| L4 | Privacy: "Provider data available for export for 30 days then removed within 90 days; backups cycled within 35 days; support comms kept 3 years; payroll 6 years" | U | only staff-onboarding 6-year purge job found (`lib/sweeps.ts`); 30/90/35-day mechanisms not evidenced | align policy to what actually runs |
| L5 | Privacy: "UK/EU regions; transfers use IDTA/SCCs" | U | regions unconfirmed | - |
| L6 | Privacy: "Passwords salted hashes; card numbers never stored; role-based access; monitoring & logging" | S/U | S for passwords/cards; monitoring/logging only partly (audit logs listed in INV s2) | - |
| L7 | DPA: "audit rights once per year", "notice of new sub-processors" | U | contractual promises with no operating process evidenced | confirm you can operate them |
| L8 | Terms s5: "We do not take a commission or percentage of your bookings" | S | as H3 | - |
| L9 | Terms s5: "Free trials ... convert to a paid Subscription unless cancelled" | S | consistent with real trial; contradicts the pricing page's "no card needed" | align pricing copy |
| L10 | Terms s6: "Payments processed through your own Stripe ... settle directly to your bank" | P | true for freelancer/company; franchisee payments settle to head office's account (H47) | add franchise carve-out |
| L11 | Terms s13: "as available ... no uptime guarantee" | S | no SLA promised; sensible | - |
| L12 | Terms s17: liability cap = fees paid in prior 12 months | U | legal drafting, not for this audit | solicitor review |
| L13 | Terms/Privacy: "We are not a bank, payment institution" | S | funds never held by platform (direct charges) | keep; this protects against FCA characterisation |
| L14 | Privacy s5: "Service intended for 18+ and not directed at children" | P | the Teaching/Learning Hub has a child kid-mode (children log in) - contradicts "not directed at children" | revise for the Hub |

## 12. platform-bookings.html

| # | Claim | Verdict | Evidence | Suggested wording |
|---|---|---|---|---|
| B1 | Single sessions/drop-ins, whole weeks, discounted blocks, add-ons, "smart listings for any activity" | S | `ListingWizard.tsx`, `routes/blocks.ts`, `blockBundles.ts` | - |
| B2 | "Rolling subscriptions & memberships that renew themselves - steady income without chasing re-bookings" | N | no recurring billing for memberships/listing subscriptions: `routes/memberships.ts` header ("no recurring charge yet"); no recurring charge in `stripeWebhook.ts` | "membership plans that deliver credit or discounts; automatic monthly billing coming" |
| B3 | "Capacity & ratios respected - you can never oversell a session or slip out of ratio" | P | capacity enforced server-side; "never ... slip out of ratio" overstated (ratios are monitored on the register) | "Capacity and age limits enforced at checkout; ratios checked live on the day" |
| B4 | "Automatic booking reminders - time, venue, what to bring" | S | `lib/autoEmails.ts` `sessionReminder` (default ON) | "what to bring" unverified, minor |
| B5 | "Parents cancel within your rules; refunds go to card or wallet" | S | as C17 | - |
| B6 | "Run seasonal codes, early-bird pricing and referral rewards; track every redemption" | S | `discountRedemptions.ts` | - |
| B7 | "Every method reconciled against the booking for you" | P | see H35 | - |
| B8 | "Paid add-ons reconcile automatically" | S | add-ons attach to booking (`checkout.tsx`) | - |
| B9 | "No card needed" | N | see P8 | - |

## 13. platform-comms.html

| # | Claim | Verdict | Evidence | Suggested wording |
|---|---|---|---|---|
| CM1 | "Message centre - 1:1 and group chat; history kept against the family" | S | `routes/messages.ts`; e2e `messages-broadcast.spec.ts` | - |
| CM2 | "Email campaigns ... and see who opened it" | S | open pixel: `lib/emailSend.ts:42,120` (`openedBy`) | note: open tracking pixel disclosure in privacy policy |
| CM3 | "AI writes your messages ... tweak the tone" | S | `routes/ai.ts` `POST` draft (kind, length) | - |
| CM4 | "Newsletters & announcements" | S | `routes/posts.ts`, `newsletter-email-handoff.md` | - |
| CM5 | "Merge fields: child name, session, venue" | S | `lib/mergeFields.ts` | - |
| CM6 | "Consent-aware: opt-outs respected automatically so marketing only reaches families who said yes" | S | `e2e/email-compliance.spec.ts`, unsubscribe links | - |
| CM7 | "Your logo and colours, installed to the home screen like a native app - parents see you, never us" | P | branding real; no PWA manifest; the product shell is currently ActivityOS-branded in places | see H23/H62 |
| CM8 | "Wallet credit; Moments; Refer-a-friend; 11 languages" | S | parent nav | - |
| CM9 | "No app store, no logins to chase" | P | parents still log in (account) | "no app to download" |
| CM10 | "Far fewer messages" / "you'll field far fewer 'how did they get on?' messages" | U | outcome claim, no data | soften |

## 14. platform-finance.html

| # | Claim | Verdict | Evidence | Suggested wording |
|---|---|---|---|---|
| FN1 | "Income ledger; invoices & POs; expenses & suppliers; refunds" | S | `routes/income.ts`, `invoices.ts`, `purchasing.ts`, `expenses.ts`, `suppliers.ts` | - |
| FN2 | "TFC reconciled ... matched to bookings" | P | manual (H54) | - |
| FN3 | "HMRC pays by BACS ... Activly matches every payment to the right child and booking, marks the invoice" + "How a payment lands" six-step flow with "Matched automatically" | N | no bank-feed; operator ticks the match: `reconciliation.ts` | rewrite the flow: "BACS arrives -> you find the child's reference on your statement -> tick it -> booking marked paid" |
| FN4 | "HMRC adds 20% - up to £500 per quarter, per child" | S | scheme rule (government figure; £500/quarter standard, £1,000 for disabled children) | add "(£1,000 for disabled children)" |
| FN5 | "Auto-matched 94%", "Needs review: suggested matches", "LA funded hours reconciled" (mock) | N | see C11/C12/C14 | - |
| FN6 | "Payouts to your own Stripe; money settles straight to your bank via Stripe Connect" | S | `payments.ts` | franchise carve-out (H47) |
| FN7 | "Revenue, profit & outstanding debts" | S | `features/money/FinanceAnalyticsApp.tsx` | - |
| FN8 | "CSV export" | S | `lib/csv.ts`, export wizards | - |
| FN9 | "Syncs to Sage / Xero / QuickBooks - keep the numbers in step" | P | payroll journal only (H38) | - |
| FN10 | "Dashboard: Next payout Fri 12 Sep Barclays ..4471" | U | mock; the app links to the Stripe dashboard for payouts | - |

## 15. platform-safeguarding.html

| # | Claim | Verdict | Evidence | Suggested wording |
|---|---|---|---|---|
| PS1 | "Sign children in/out from your phone; present/absent/awaiting; live ratio per age band with amber warning" | S | `RegistersApp.tsx`, `ratios.ts` | - |
| PS2 | "Collection PIN & who picked up" | P | collection password; see SG6 | "collection password" |
| PS3 | "Works across every site" | S | company registers aggregate | - |
| PS4 | "Allergy/medical/SEND flags; log incidents & accidents; MAR with parent notified automatically" | S | `incidents.ts`, `medications.ts` | - |
| PS5 | "Photo-consent carried through" | S | `moments.ts` | - |
| PS6 | "Read-and-confirm policies" | S | `DocumentsApp.tsx` | - |
| PS7 | "DBS & certificate tracking with expiry reminders" | S | `credentials.ts`, `sweeps.ts` | - |
| PS8 | Mock accident form: "RIDDOR check - Not reportable", "signature captured", "Parent must be informed before collection" | N | no RIDDOR field or parent signature capture in `features/incidents` (grep) | remove from mock or build |
| PS9 | Mock concern: "DSL notified - read receipt", "chronology linked to 2 earlier entries", "Export for LADO", "Restricted, audit trail on" | P | DSL alert real (`dslAlert.ts`); chronology linking and read receipt not found; only deletion audit exists | trim mock to what ships |
| PS10 | Mock ratios by group with "Owls - 1 coach short - Move staff" | S | `ratios.ts` groups/staffing | - |
| PS11 | "Trips - risk assessment & consent per child; headcount; documents & policies library" | S | `trips.ts`, `DocumentsApp.tsx` | - |
| PS12 | "Evidence at inspection ... produced on demand" | P | exports exist per area; "on demand pack" not found | "export registers, logs and policies" |
| PS13 | "Expiry checked 03/2027 - 2 due" (medication expiry tracking, mock) | U | medication expiry field not verified | verify |

## 16. platform-staff.html

| # | Claim | Verdict | Evidence | Suggested wording |
|---|---|---|---|---|
| ST1 | "Build the week's rota per site; staff set availability; clock in/out with breaks; live who's-in/on-break board" | S | `rota.ts`, `availability.ts`, `timeclock.ts`; staff nav | - |
| ST2 | "Late auto-deducts (your rules)" | S | `features/timeclock` clock settings (`loadClockSettings`) | - |
| ST3 | "Timesheets flow straight into payroll" | S | `PayrollApp.tsx` | - |
| ST4 | "Monthly pay run with estimated PAYE, NI & pension; branded payslips; staff see own payslips" | S | `payslips.ts`, `StaffPayslipsApp.tsx`; e2e `payroll-*.spec.ts` | - |
| ST5 | "Connect QuickBooks / Xero / Sage - push payroll straight into the accounts package" | P | journal post only; Sage untested live | "Post payroll journals to QuickBooks, Xero and Sage" |
| ST6 | "HMRC-ready" (hero) | N | see H29 | - |
| ST7 | "Safer-recruitment onboarding: references, right-to-work, checks against a UK-ready record" | S | `onboarding.ts`, `references.ts` | - |
| ST8 | "Two-sided staff appraisals with feedback log" | S | `features/appraisals` | - |
| ST9 | "Learning Centre - 39 CPD-certified courses written for this sector" | P | library has ~66 course ids in code (SEED_LIBRARY); "CPD-certified" not substantiated (code says "CPD-style"); the figure 39 is stale (plan doc: "confirm the live count") | "A built-in course library (60+ courses) with certificates" |
| ST10 | "Certificates on the staff record - Ofsted-ready" | N | "Ofsted-ready" is an inspection-outcome claim; Ofsted does not endorse software | "inspection-friendly records" |
| ST11 | "Team compliance: trained / due / overdue / blocked 'not cleared to start'" | S | `LearningCentreApp.tsx`, `staffPolicy.ts` | - |
| ST12 | "Holiday & absence (UK entitlement worked out)" | S | `lib/holiday.ts` | - |
| ST13 | "Roles & permissions" | S | `access.ts` | - |
| ST14 | "Book a 20-minute walkthrough" vs safeguarding "Fifteen minutes" | P | inconsistent demo length (cross-page) | pick one |

---

## CROSS-PAGE INCONSISTENCIES

1. **Trial terms.** pricing.html FAQ + CTA band and platform-bookings: "no card needed". terms.html s5: trials "convert to a paid Subscription unless cancelled" (implies card). Product: 7-day trial, card up front (`subscription.ts`). Home says "Free to start". Fix everywhere to the same sentence.
2. **Brand.** Site = "Activly" (also "Activ ly" split in the logo markup). App, API docs and `BRAND` = "ActivityOS"; HQ plan/support strings call the product ActivityOS; DPA/Privacy refer to "Activly" with legal entity "[TBC]". A visitor who signs up lands in an app named ActivityOS.
3. **Collection control name.** "Collection PIN" (home, companies, freelancers, platform-safeguarding) vs "collection password" (safeguarding.html, parents). Product term: "collection password" (`collectionPassword`). Also "locked collection - verified every time" (home) vs "shown to staff" (code).
4. **Money-matching language.** "Auto-matched/auto-split/94%" (companies, platform-finance, home TFC mock) vs "reconciled with a unique reference" (parents/schools) vs product reality "operator ticks it manually". Three different strengths of the same claim.
5. **HMRC / TFC.** home: "Direct HMRC verification - rolling out" (honest) vs same page's mock "No HMRC portal login needed" and companies "HMRC pays by BACS ... every payment matched". DPA/Privacy/Terms list HMRC as a sub-processor/third party "where TFC features are used" as if live.
6. **Own domain.** home/freelancers/companies/pricing: "your own domain" vs pricing add-on: "Don't have a domain? We sort this for you" (a website add-on, not the booking page). Product: no custom domain.
7. **Franchise money.** franchises/home/platform-finance: "own bank/settles to its own account" vs terms s6 "your own Stripe" vs code: franchisees share head office's Stripe.
8. **Payroll wording.** "HMRC-ready" (home hero text for Staff & payroll, companies, platform-staff, home tour cards) vs "estimated PAYE" (home feature rows, platform-staff) vs product "estimates; no RTI". Home also says "Monthly pay" while the engine supports four frequencies.
9. **Training course count.** platform-staff: "39 courses / 39 CPD-certified"; home: "CPD courses"; code: ~66 course ids. "CPD certified" vs code "CPD-style".
10. **Demo length.** safeguarding "Fifteen minutes"; platform-staff "20-minute walkthrough"; home "Free 1-on-1 demo", tour "live tour".
11. **Product tour.** Nav on every page "Watch a 2-min tour" vs tour.html "Full walkthrough - coming soon".
12. **Commission comparison.** Home calculator "5% commission platform" vs comparison table "1-3%+ per booking".
13. **Savings.** Home "£300+ a month in separate subscriptions ... saving roughly £4,000 a year" (does not reconcile) and "25+ separate tools" vs "replaces" logo wall of 12.
14. **Language count.** Consistently 11 everywhere (OK). But parents.html says "11 of the most widely spoken UK-parent languages" while code comment says chosen by census demographics; ur/pa/bn/cy awaiting native review.
15. **Plan names/prices.** Consistent across pricing/terms/code. Terms say "franchise pricing is per network" while pricing is base + per franchisee. Plan label "Company & school" on pricing vs "Company" in code/terms; schools.html says "A flat monthly fee" without naming the plan.
16. **Cancellation.** pricing "cancel anytime, rolling monthly" vs terms "end of current billing period, fees non-refundable"; annual billing is not monthly-rolling.
17. **Under-18 / child users.** privacy.html "not directed at children" vs the Learning Hub kid-mode in the product.
18. **Memberships.** parents.html presents monthly-priced tiers (Club £15/mo) as working with auto credit; code says benefits on join, no recurring charge.

---

## TOP 15 RISKS (ranked)

1. **"Free trial, no card needed"** (pricing FAQ, pricing CTA, platform-bookings) - the product captures a card and auto-charges on day 7. Misleading-omission under consumer/B2B advertising rules (CAP/ASA), and chargeback/trust risk on day 7. Fix the copy today.
2. **TFC presented as automated/live** ("94% auto-matched", "Auto-split", "no HMRC portal login needed", "matched automatically when it clears", BACS batch table). No bank feed, no live HMRC integration, HMRC tokens stored unencrypted and no HMRC sandbox evidence. A provider who relies on it will have unmatched money. Also an invented statistic (94%).
3. **Legal pages are drafts with placeholders** (company name, company no., ICO registration, DPO email all "TBC"; Terms says "should be reviewed by a qualified solicitor before launch"). The product went live 30 Sep. A controller must be registered with the ICO; the DPA must be signed to be an Art. 28 contract. Security page claims "a DPA you sign at set-up" - no flow found.
4. **Security claims beyond evidence**: "UK/EU regions" (Vercel/Railway/Firestore regions unconfirmed), "regular backups" (unconfirmed), "breach procedure", "staff trained on data protection", "can never see", "encrypted at rest" for everything (only staff NI/bank are field-encrypted; ID/DBS scans and children's SEND documents are plain Firestore chunks; TFC and accounting tokens plaintext). Known-gaps list in `docs/tfc/security-evidence.md` has 15 items including no Firestore rules file in repo and no pen test. Children's special-category data raises the stakes.
5. **Fabricated or unusable testimonials**, including one praising an "AI Front Desk" that answers calls (does not exist), plus "paid for itself in the first week". Named organisations; no permission records. Misleading advertising and potential defamation/misattribution exposure.
6. **"HMRC-ready" payroll / payroll implies compliance.** No RTI/FPS/EPS filing; figures are estimates; run lines partly computed in the browser; the code header says RTI stays with the payroll provider. A provider could miss a statutory filing believing the product does it. HMRC penalties land on the employer.
7. **Franchise money claims**: "each franchisee settles to their own account / own bank" is contradicted by code (franchise shares head office's Stripe; cannot open its own). Also "royalties paid automatically" while collection is off-platform. Misdescribes who holds franchisee funds - financial-flow/trust issue and possible regulated-activity optics if head office pools money (the site otherwise rightly says "we are not a bank").
8. **Safeguarding over-promise**: "if they can't give the password, the child doesn't leave" / "locked collection - verified every time" - the system only displays the password and records a free-text name; nothing blocks release. Reliance on this in a collection incident is a duty-of-care and misrepresentation risk. Related: "Ofsted-ready", "inspection-ready", "stands up at inspection" language, "only people on your list can collect".
9. **Certifications and standards implied**: "CPD-certified" courses (no accreditation evidence), "Ofsted-ready", "PCI-DSS" (true for Stripe, not for us - the page words it correctly), and "Certifications - status: in progress" (ISO 27001 / Cyber Essentials) without any process evidenced.
10. **Own-domain booking page** promised in headline copy on four pages; not live. Customers will plan their marketing around a domain they cannot get (the embed widget is the real, live alternative).
11. **Website design & maintenance add-on** (£300-£500, "unlimited changes via AI edit bot", "uptime handled", free domain sourcing): no product behind it - sells a service/SLA-like promise. Also "uptime handled for you" is the only uptime language on the site; Terms deliberately disclaim availability. Contradiction between add-on and Terms s13.
12. **Memberships/subscriptions that "renew themselves"** and "monthly" tiers with credit "dropped into your wallet": no recurring billing exists (benefit on join). Providers will promise parents recurring revenue/credit that never bills.
13. **Privacy-policy retention and processor statements not matching practice** (30/90/35-day windows, Groq not in the DPA, HMRC labelled a sub-processor, Hub child users vs "not directed at children", payslip emails carry an open-tracking pixel, deletion is a recorded request not a wipe while parents.html reads as self-service deletion).
14. **Unsupported quantified benefits**: "£4,000 saved a year", "25+ tools", "about six hours a week per site", "two days a month back", "four minutes to first booking", "live within days", "around 545,000 families". All can be challenged; none have a source.
15. **Brand mismatch (Activly vs ActivityOS) plus the unfinished legal entity**: visitors, parents and the ICO/Stripe/HMRC will see a different name from the site; Terms refer to an entity that "is TBC". Also "Next day payouts" (Stripe controls timing; new accounts have a hold) and "No setup fee/lock-in" vs annual commitment.

---

## What the product does that the site never mentions (worth a line)

1. **Teaching / Learning Hub** for tutors, parents and kids - lessons, live whiteboard room, quizzes, homework, games, curriculum bank, progress digests, "how it works" films. Largest product area with 60+ e2e specs and zero site presence (Tutoring appears only as an emoji on the home hero).
2. **Embed widget** (`public/embed.js`): drop the storefront list or one listing into the provider's existing website - the real, live answer to "my own site".
3. **Unique payment reference minted per booking-and-child with a check symbol** (arithmetically validated, offline) - the genuine, defensible TFC differentiator; the site oversells matching and undersells this.
4. **Per-user "Data & privacy" self-service** (see/download my data, request deletion) in every portal.
5. **Stripe Connect self-serve onboarding** ("Get paid") with Express dashboard - provider's own bank, no developer.
6. **Safeguarding hardening not claimed**: concern-delete audit, DSL-about-DSL routing (allegations against the DSL go only to the account holder), unresolved-reference-concern blocks "cleared to start".
7. **HQ email 2FA, impersonation log, payroll audit log, NI/bank AES-256-GCM** - real, defensible security points to put on security.html in place of unprovable ones.
8. **Partial cancellation/refund engine**, booking cut-offs, age-range enforcement at checkout, waitlist 2-hour holds.
9. **Parent Memberships/Coupons/Refer wallet** and **Reviews/Feedback** loop; **Newsfeed acknowledgements**.
10. **Accounting mapping UI** (6 buckets) with idempotent journal posts to Xero/QuickBooks (tested) - a concrete, honest integration claim.
