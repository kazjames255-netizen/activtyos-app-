# Site review D - parents.html, security.html, safeguarding.html

Full list of text edits: docs/site-review/d-text-changes.md. New file: public/v2/trim-d.css (linked after responsive.css in all three pages, everything inside @media (max-width:759.98px)).

## Phone height at 390x844 (document scrollHeight)
| page | before | after | change |
|---|---|---|---|
| parents | 17473 | 10768 | -38% |
| security | 5888 | 4023 | -32% |
| safeguarding | 10187 | 6789 | -33% |
No horizontal overflow at 360/390/430/768/1440. At 768 and 1440 the trim does nothing; the few-px height differences there come from the text edits only (parents 1440: 9599 to 9556, security 3968 to 4011 from the added NI sentence). Visual check: parents at 390 scrolled and looked at; security/safeguarding checked by height/overflow only (not eyeballed after trim).

## What the trim hides on phones (HTML kept)
- parents: "how it usually goes" column, 2 of 9 booking cards (Refer, Timetable), the whole Memberships pay card, one newsfeed-type loop card (Feedback), the large "inside your account" mock portal, the languages chip band, last 0 ticks kept (first 4 of 5 TFC ticks shown). Icon tiles dropped on cards, tighter bands. Hero, TFC card + reference mock, child-day cards, trust list, FAQ, CTA all kept.
- security: hero photo, 3 of 9 measure cards (passwords, backups, people and process), the duplicate "Safeguarding, inspection-ready" compliance card; compliance forced to one column.
- safeguarding: 2 register cards (Present/absent/collected, Roll call), 2 concern cards (categories, numbers), 2 people cards (training, role matrix), 1 data card, 2nd paragraph of "where software stops". The three enforced guarantees, collection password, collected-by, allergies, ratios, lead alert, accidents, policies, photo consent and the "where software stops" disclaimer stay.

## Truth fixes made (file checked)
parents (all in server/src unless noted):
- TFC "reconciles itself / matches itself / matched automatically": false today. Matching is a human tick by the provider (routes/reconciliation.ts, lib/childcare.ts "the bank tick stays a human's"; HMRC client in lib/tfc.ts is env-gated, not live). Reworded to "your provider matches it".
- "Receipt instantly" for TFC and the week-story "receipt before you close the app": reworded.
- "Payment plan": no feature found; removed.
- Memberships: a tier gives credit OR a % off, not both (routes/memberships.ts); priority/first access and "term by term savings" not found; billing is on-join (no recurring charge yet). Mock tiers and the invented "saved this term GBP 64.50" corrected.
- Wallet "Top up & save 5%" (mock): no top-up feature (routes/wallet.ts); replaced.
- Referral: provider-funded, friend gets discount, referrer a reward (routes/referral.ts); reworded.
- "Who's allowed to collect / only people on your list can": no collector list exists; collected-by is typed (features/registers/RegistersApp.tsx prompt); profile has a collection password. Reworded.
- "Add to home screen": no PWA manifest/service worker found in app/ or public/; removed.
- "Second parent has own login to the same children": not found (children keyed to one parentUid); FAQ rewritten. Needs Kaz.
- Feedback "so the next family knows", assistant example "what did I pay in July": removed/changed.
- "Start free" for providers changed to free trial (pricing.html).
safeguarding:
- "Only people on that family's list can be chosen" at collection: false (free text); removed.
- Accident acknowledgement "chased": only when the provider switches on requireAcknowledgement (routes/incidents.ts, lib/sweeps.ts); reworded.
- "Expiry dates chase themselves": compliance route flags expiring (45 days) but no automatic chase found; reworded to "flagged".
- "Every view ... has a name": no view audit found; now "every edit".
- Trip wording "marked ready" to "signed off" (trips.ts refuses sign-off/completion with pending consent).
- Collection password: app stores/shows it; the check is staff procedure; wording made honest.
security: added verified AES-256-GCM field encryption of staff NI numbers (lib/fieldCrypto.ts); "can never see" to "cannot see".

## Verified as true
No-consent-no-dose (routes/medications.ts 409), trip consent gate (routes/trips.ts), rota refuses expired DBS/first aid/safeguarding when compliance on (lib/staffPolicy.ts; note it only checks people who already have a certificate on file), concern alerts DSL (lib/dslAlert.ts), LADO/MASH/OOH click-to-call and PDF export (features/incidents/SafeguardingApp.tsx), headcount (registers.ts), ratios (routes/ratios.ts), read-and-confirm versioned policies (routes/documents.ts), Start on hold/Cleared to start (features/team/OnboardingApp.tsx), None/View/Edit caps (middleware/access.ts, setup/RolesPermissions.tsx), photo consent enforced on Moments (routes/moments.ts), 11 app languages (lib/i18n/config.ts), parent portal views exist (lib/nav/config.ts custdash: wallet, memberships, meals, medication, accidents, trips, feedback, AI, privacy), deletion requests (routes/privacy.ts), Stripe via lib/stripe.ts.

## Needs Kaz (not changed)
1. security + parents + DPA: "Google Cloud / Firebase in UK/EU regions". No region setting found anywhere in the repo; also the API runs on Railway and the web on Vercel (per project memory), neither named on security/DPA/privacy.
2. "Regular backups, monitoring" (security): no backup/PITR config found in repo; operational claim.
3. "Staff bound by confidentiality, trained on data protection" (security): organisational claim.
4. "Certifications on our roadmap ... Status: in progress" (ISO 27001, Cyber Essentials): "roadmap" and "in progress" sit oddly together; confirm real status.
5. "Free for families, always" (parents) and "provider pays".
6. "Named sub-processor list" (security) vs DPA Schedule 3 which has "[Email delivery provider - TBC]".
7. Breach/72h/ICO statements: legal.
8. Second-parent access (see above) and whether memberships should be described as monthly given no recurring billing yet.
9. Parent AI assistant: capabilities described generally; code has a parent snapshot (bookings, children, credit, threads) plus how-to text, no payment history.

## Legal pages (review only, not edited)
- privacy.html: stray English "Safeguarding" link directly after "Data Processing Agreement" in the controller/processor paragraph and again in the children's-data paragraph and the retention list (appears as a bare link word "Safeguarding"); not translated.
- Placeholders still present: operating company name, company no., registered office, ICO registration no. (privacy), terms (company, address, email), dpa ([data protection contact - TBC], [email - TBC], [Email delivery provider - TBC]). 8 TBC lines in total. Must be filled before anyone relies on them.
- Sub-processors: DPA Schedule 3 lists Google/Firebase, Stripe, email TBC, HMRC. Code also uses Resend/SMTP (email), Groq (AI assistant, server/src/routes/ai.ts), accounting integrations (Xero/QuickBooks), and Railway/Vercel hosting. Groq in particular may see child/family data via the assistant. Lawyer to decide whether to list.
- DPA lists HMRC "to reconcile funded payments" and terms list HMRC (Tax-Free Childcare): the HMRC integration is not live today (manual reference); wording implies it is.
- Privacy says passwords salted hashes by auth provider (true, Firebase Auth); retention periods (90 days, 6 years, 3 years support) are policy statements I could not verify against code (no retention sweep found).
- terms.html footer link list differs from other pages (shows Pricing, Contact us; no Security/Safeguarding legal links) - minor inconsistency.
- terms: fees "non-refundable except where required by law" and cancel-at-period-end: confirm vs billing flow (routes/subscription.ts not checked).

## Still looking off / not verified
- Translations: edited strings keep old data-i18n keys, so non-English visitors see old text until the lead re-runs convert.mjs and new translations are supplied; the TFC/memberships/FAQ statements in other languages stay stale until then.
- Security/safeguarding trimmed layouts only height-checked, not eyeballed. Phone view has odd card counts in some sections (single column, so no layout orphan).
- Not checked: server-side meal allergen flagging for parents ("flagged before you pick it": allergens exist on menu items; the clash check was not located).
- Dev server on 8104 stopped; scratch spec deleted.
