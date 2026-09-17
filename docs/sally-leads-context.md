# Sally's context — ActivityOS & the leads pipeline

**Read this whole document before doing any work, every time you run.** It is
the living record of what ActivityOS is, who it's for, and everything that's
been built for finding and managing leads. It gets updated whenever Kaz and
Claude discuss anything relevant here — treat it as ground truth, not a
one-off briefing.

Last updated: 2026-09-17.

---

## 1. What ActivityOS is

A multi-tenant platform for children's activity providers (holiday camps,
breakfast/after-school clubs, activity classes, tuition, franchises). Two
halves: the backend (Express + Firebase, built by Amir) and the UI (Next.js,
built on top of it). Six portals: `company`, `franchise`, `freelancer`
(operators), `staff`, `custdash` (parents), `platform` (super-admin/HQ —
where the leads pipeline and Sally's work live).

## 2. Target audience, pricing, positioning

Source: `docs/website-content-plan-v2.md` (the canonical, current strategy
doc — check it directly if this section ever looks stale).

**Three personas / pricing tiers:**
- **Freelancer** — solo coach/tutor/instructor. £29/mo flat.
- **Company** — multi-staff camps/clubs/wraparound providers, including
  owner-operators of several sites. From £49/mo, tiered by staff count
  (£49 up to 5 staff, £79 up to 15, £129 up to 40).
- **Franchise/HQ** — £99/mo base + a per-franchisee fee. Head office's own
  directly-run venues are free.

**Core wedge: zero commission.** "£29 a month, no commission" is the
flagship phrase used throughout — this is the thing that differentiates
ActivityOS from marketplace competitors that take a cut per booking. Card
processing fees are passed through at Stripe's real rate (~1.5% + 20p) with
no markup — kept honest and separate from the subscription price.

**Core ICP — matches the leads pipeline's own `CORE` fit category exactly:**
holiday camps, breakfast/after-school (wraparound) clubs, activity classes.
Tuition and preschool are "adjacent" (still fundable, lower priority).
**Nurseries are explicitly a poor fit** — they mostly already run on
nursery-specific software and aren't the target.

**Brand voice:** plain-spoken, "a fellow operator" not a SaaS vendor,
concrete over clever, UK spelling, no SaaS jargon.

**Known launch blocker (as of the source doc):** claims-heavy marketing pages
need 3 named, referenceable providers before they can go live — not yet
secured. If Sally's work touches marketing or outreach, this is worth
tracking.

**⚠️ OPEN — needs Kaz's input, do not fabricate:**
- Explicit growth/volume targets (e.g. leads-per-week, contacted-per-week,
  conversion targets). Nothing like this exists in writing yet.
- Any geographic prioritisation beyond what the data already covers (UK-wide
  today — is there a region Kaz wants prioritised?).
- Whether nurseries/adjacent categories should be actively deprioritised in
  sourcing, or just deprioritised in *outreach* (the sourcing scripts still
  find nurseries; only the fit-scoring downranks them).

## 3. The leads pipeline — there are TWO separate systems, don't conflate them

### 3a. `/api/leads` + `features/platform/LeadsApp.tsx` — the research/sourcing pipeline

This is the one Sally owns. It's upstream of the Sales CRM below — this is
where new prospects are found, researched, and enriched before anyone
manually chases them.

- **Scale:** ~41,500 leads in the database as of the last perf-fix pass.
- **No OpenAPI documentation exists for this route** — it isn't in
  `server/openapi.yaml` at all. Its only documentation is inline code
  comments in `server/src/routes/leads.ts` and this document.
- **Endpoints:** `POST /api/leads` (public — the marketing site's `/demo`
  form), `GET /api/leads` (platform-role only, in-memory cache refreshed
  every 3 minutes, gzipped, disk-cached to survive restarts), `PATCH
  /api/leads/:id` (platform-role, **status only**: new/contacted/won/lost —
  moving off "new" pushes it onto the HQ Sales board via `inPipeline`/`stage`).

**Lead record fields** (all optional except id/name/email/status/createdAt):
core (`email, phone, business, size, message, source, status, createdAt`)
plus a large researched-prospect set: `website, socialUrl, location, kind,
legalForm, companyNumber, charityNumber, bookingSystem, reviewTier
("likely_fit"|"uncertain"), needsHumanReview, sourceUrl, confidence,
researchSources, listingsOnSource, plan, planReason, personalContact, sport,
sources[], onSources, comingSoon, ofstedSites, providerTypes[],
providerType, network, networkKind, networkOperators, ofstedRegions, region,
county, emailFrom, phoneFrom, websiteFoundBy, nation, websiteCandidate,
activityTypes[], haf, hafFrom, hafText, hafLocalAuthority, hafPaid,
bookingUrl, bookingFrom, bookingChecked, websiteDead, websiteDeadAt,
websiteDeadWhy, websiteDeadCategory, bookingMethod, bookingMethodEvidence,
secondaryContact, secondaryContactType, secondaryContactNote, giasUrn,
giasSchoolName, schoolType, boarding, ageLow, ageHigh, schoolPhase,
schoolGovernance, trustName, roleContacts{head, pupilPremiumLead,
inclusionLead, sendco}`.

**Fit scoring:** `TYPE` = holiday🏕️, wraparound🎒, activity⚽, tuition📚,
preschool🧸, nursery🍼, childminder🏠, other🏫. `CORE = [holiday, wraparound,
activity]` is the real ICP, matching section 2 above exactly. `Fit` derives
to `core` / `adjacent` (tuition, preschool) / `nursery` (lowest).

**19-category activity classifier** (regex over name/business/sport/message/
network/website): multi, sport, gym, swim, martial, dance, drama, music,
arts, forest, stem, language, tuition, baby, cook, animals, send, youth, haf.

**Source badges (17):** `ciw`/`cis`/`fsni` (Wales/Scotland/NI care
registers), `demo` (marketing form), `eequ`/`playwaze`/`pebble`/`yellowdays`
(booking-platform directories), `ofsted`, `haf` (council holiday-activities
lists), `gias` (DfE independent schools), `gias-state` (DfE state schools),
and **8 Companies House SIC sweeps**: `companiesHouse-sports`, `-daycare`,
`-performingarts`, `-farmsAttractions`, `-residentialCamps`,
`-leisureCentres`, `-attractionsMuseums`, `-otherEducation`. (A 9th sweep,
party/entertainment, exists as a script — `filter_party_entertainment_ch.mjs`
— check whether it's landed as a badge yet.)

**Filters (14 dimensions):** plan, runs, activity, fit, size, booking,
nation, region, ofsted, source, contact, status, schoolType, schoolPhase,
schoolGovernance, roleContact. Key derived filters: `okToEmail` (PECR
compliance — excludes personal/sole-trader contacts from bulk email),
`isWebsiteOpportunity` (dead site but domain still resolves = a rebuild
pitch angle), `hasNoContact`/`hasSecondaryContact` (dead-end tracking).
Booking-platform detection recognises ~25 named platforms (Magic Booking,
ClassForKids, Famly, Blossom, Tapestry, eequ, Pebble, Playwaze, KipLearn,
Kidsplan, ParentPay, Eventbrite, Calendly, Bookwhen, WooCommerce, PayPal,
Connect Childcare, Amelia, Bookly, eyLog, Parenta, Baby's Days, Nursery Hub,
Legend, Gladstone, Better/GLL, HolidayActivities, Coordinate).

**Saved views:** 🗂️All leads, ⭐Best prospects (reachable + core fit + no
booking platform yet), 📇Ready to contact, 📩Demo requests, 🍎HAF providers,
🔎Still researching.

**Sourcing scripts** (`server/scripts/leads/`, ~70 files):
- Orchestration: `pipeline.sh` runs `find_websites.mjs → verify_sites.mjs →
  apply_verify.mjs → find_contacts.mjs`.
- **The 8 Companies House sweeps** each: download a free monthly CH bulk
  snapshot, filter by SIC code with hand-tuned false-positive guards (e.g.
  the daycare SIC also catches elderly day-care; leisure-centre SIC catches
  ordinary gyms), cross-check against existing leads by company number/name/
  postcode to dedupe, and write a REVIEW file — **these are research-only,
  they never touch Firestore directly**. A human/import step applies them.
- **Schools chain** (separate): `fetch_gias.mjs → import_gias.mjs →
  import_gias_state.mjs → enrich_schools.mjs (sharded homepage crawl for
  email/phone/booking-system) → enrich_school_roles.mjs (sharded staff-page
  crawl for head/pupil-premium-lead/inclusion-lead/SENDCo names)`.
  `backfill_gias_school_name.mjs` fixes mismerges.
- **`overnight_draft_outreach.mjs` already does most of what "Sally proposes
  a lead + drafts outreach overnight" needs**: scans `status=="new"` leads
  with a real direct business email (excludes register/charity/gov domains,
  25+ known platform-support domains, noreply addresses), generates a
  personalised subject+body (town, activity type, multi-site signal,
  no-booking-system signal), writes `draftOutreach:{subject,body,draftedAt}`
  + `outreachStatus:"drafted-pending-review"` onto the doc. **Never sends,
  never changes `status`.** Has `--dry`/`--apply`/`--limit` flags. This is
  the seed to build Sally's daily loop on top of, not something to
  reinvent from scratch.
- Other scripts of note: `dedupe.mjs`, `secondary_contact.mjs`,
  `booking_method.mjs`/`booking_urls.mjs`, `social_urls.mjs`,
  `childminders.mjs`, `import_registers.mjs` (Ofsted/CIW/CIS/FSNI),
  `haf_eequ.mjs`/`merge_haf.mjs`, `verify_sites.mjs`/`apply_verify.mjs`,
  many sharded batch/worker scripts for running the pipeline over tens of
  thousands of rows in parallel, `_audit_counts.mjs`/`_audit_sweep.mjs` (QA).

### 3b. `/api/platform/leads` + `features/platform/SalesApp.tsx` — the Sales CRM

A **different, separate** system — the working pipeline once a prospect is
being actively chased (not Sally's lane, but she should know it exists so
she never confuses the two). Documented in `docs/sales-crm-handoff.md` and
`server/openapi.yaml` (tag `platform-hq`). Full CRUD + activities +
stage-weighted forecast (new .05 → contacted .15 → interested .35 → demo
.55 → trial .80 → won 1). Auto-converts a lead to "won" when a matching
signup happens (email/phone/business-name match). As of the last handoff
doc, running on a localStorage demo store, not yet wired to a persistent
backend for CSV import.

## 4. Change history (narrative, newest first)

Started as basic filtering/CRUD, hit a performance crisis around 41,500
rows (several dedicated perf-fix commits — don't re-derive all rows on
every poll), then expanded sourcing breadth significantly (DfE GIAS schools,
8 new Companies House SIC sweeps covering categories the original Ofsted-
only sourcing was blind to), then UX polish (per-category colours, undo
toasts, better filter UI, CSV export improvements).

Recent commits (2026-09-17 session): 5 new Companies House SIC sweeps for
previously-missed venue categories; per-category quick-filter colours;
school-name-as-title toggle for club-at-school leads; fixed a crash on the
Found-on/source filter dropdown; the full DfE GIAS schools pipeline
(import + enrichment + role-contacts + a mismerge fix).

*(Claude: append new entries here after any session that changes the leads
pipeline, in the same one-paragraph style — don't let this section go
stale.)*

## 5. How Sally should operate

1. **Read this document in full before starting any daily run.** If it
   contradicts what you observe in the live code/data, trust the live
   state and flag the contradiction back to Kaz — this doc can go stale.
2. **Your lane is sourcing, enrichment, and triage of `/api/leads`** — not
   the Sales CRM (`/api/platform/leads`), which is Kaz/Amir's active-chase
   pipeline.
3. **Never write a new lead into the live `leads` collection, send an
   outreach email, or change a lead's `status` without asking first.**
   Sourcing/tagging/scoring/deduping within your own review files is fine
   to do autonomously; anything that lands in the production database or
   goes external needs a yes.
4. **Report in this shape:** "Found N new leads today from [source]. Here's
   a breakdown: [counts by category/fit]. Top 3 worth a look: [...]. Shall
   I store them?" — concrete numbers, not vague summaries.
5. **Self-educate and grow your own memory.** When you learn something
   durable about the pipeline, the data quirks, or what works/doesn't in
   outreach, write it to your own memory files — not just this doc (this
   doc is the shared/onboarding layer; your memory is your accumulated
   working knowledge).
6. **Stay inside the ICP.** Core = holiday/wraparound/activity providers.
   Don't spend effort chasing nurseries or out-of-scope categories unless
   asked.
