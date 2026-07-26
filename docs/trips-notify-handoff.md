# Handoff — Trips & visits (parent notify + consent)

**From:** Kaz · **Date:** 2026-07-26.

Trips & visits (`features/trips/TripsApp.tsx`) is rebuilt to the Medication /
Accidents standard: themed hero + stat tiles, a **3-step wizard** (Where & when /
Who's going / Risk & consent), transport picker, booked-child multi-select
(optionally scoped to a listing), staff list with a **live ratio check**, risk
assessment, consent, status (planned/completed/cancelled), edit, search +
status filters. Backed by the existing `/api/trips` (GET/POST/PUT/DELETE) — no
schema change needed for the core.

## Update (26 Jul) — richer form, pulled from live data
- **Who's going is now day-scoped.** The child picker offers only the children
  **booked on the trip's date** (resolved from each booking's `days` / `kids[].dates`,
  cancelled days excluded), optionally within one listing. A **Select-all** bulk
  toggle picks everyone booked that day.
- **Staff pulled from the listing.** When a listing is chosen the form fetches
  `/api/listings/:id` → `library.staff` and offers those names (plus the tenant
  team from `/api/library` → `staff`) as one-tap chips. Manual entry still works.
- **Structured risk assessment (the manual's hazard table).** Replaces the free-text
  box: hazards — `{ h, who, controls, initial (L/M/H), residual (L/M/H), done }` —
  seeded from a default template, editable/addable, with a **sign-off** (`raSigned` +
  `raAssessor` + `raDate`) that only unlocks once every hazard has a residual risk and
  its controls ticked. Cards show an **RA signed / RA draft** badge. I **added these to
  `tripSchema`** (server/src/routes/trips.ts) — additive & optional: `hazards[]`,
  `raSigned`, `raAssessor`, `raDate`. Nothing else in the route changed.

## Update (26 Jul, pt.2) — full 7-step planner (matches the manual)
The page is now the manual's end-to-end planner. Browse trips as **readiness-ring
cards**; **Open planner** expands one trip into 7 steps with a live readiness %,
stat chips, and a **track-changes** toolbar (local/session — accept/reject edits,
not persisted). Steps: **1** details + lead/EVC/cost + **itinerary**; **2** RA hazard
table + sign-off; **3** staffing with **named lead + first-aider + roles + ratio bar**;
**4** **per-child consent** (consented/pending/not-coming) + paid state + emergency/med
flags + "send request to N parents"; **5** **line-manager sign-off** (gated on
RA+ratio+consents); **6** **on-the-day head-count checkpoints** (locked until approved);
**7** return & debrief. All persisted via new optional `tripSchema` fields (I added
them, additive only): `lead, leadPhone, evc, cost, offsiteRatio, itinerary[], kit,
raRef, raReview, roster[], attendees[], checkpoints[], signoff{}, returned`.

**What's still yours here (on top of §What's yours below):**
- **Parent message & pay link (new Step 8, optional).** An editable template
  (merge fields resolved from the trip) + a **pay-by date**; "Send to parents &
  generate pay link" is a front-end stub that stamps `parentMsgSentAt`. Yours:
  actually email/notify the parents on the trip, mint the **secure pay link**
  (Stripe Connect), and surface the request + payment in each parent's profile.
  Persisted fields: `parentMsg`, `payBy`, `parentMsgSentAt`. It's optional — the
  operator may collect at booking instead.
- **Paid consent / Stripe.** Step 4 "Take payment" is a front-end stub that flips a
  `paid` flag. Real payment must run through the provider's connected processor
  (Stripe Connect), and the parent-side flow is where consent + payment actually
  happen — the operator screen only *records* it.
- **Enrich attendees.** `attendees[]` stores names + a best-effort age from the
  booking. The **emergency-contact (`em`) and medical (`med`) flags** should come from
  the child's profile via `childId` (same resolution as §2) rather than being blank.
- **Sign-off / head counts** are recorded operator-side only for now; if you want a
  real approval identity or an audit trail, that's backend.

## Settings (done, persist via the library settings)
Setup → **Trips & visits** (`settings.trips`):
- **`notifyParent`** (default true) — ask parents to consent when their child is
  on a trip.
- **`requireConsent`** (default true) — a trip can't be marked ready/completed
  until every child on it has consent.
- **`ratioTarget`** (number, default 8) — target children-per-staff; the trip
  card + wizard flag when it's exceeded (front-end only, live now).

## What's yours (backend)
1. **Notify + collect consent per child.** When `notifyParent` is on and a trip
   is saved with children, email + bell each child's parent with the trip
   details (destination, date, depart/return, transport) and a **consent
   request**; remind until they respond. Mirrors the medication/accident notify
   layer + mute. Needs the trip's children resolved to `childId` (see #2) so the
   right parents are reached and the trip appears in the parent's area.
2. **childId on trips.** The trip stores `childNames: string[]` today; the
   front-end picks booked children by name. To reach parents, resolve those to
   `childId` (match the tenant's bookings/children like the medication flow) and
   store a `childIds` / per-child consent map on the trip.
3. **Per-child consent state + enforcement.** Store each child's consent
   (given/at/by). Surface it back so the operator card shows "3/5 consented",
   and — when `requireConsent` is on — block marking the trip completed until all
   have consented. The front-end `consentObtained` boolean is the interim
   whole-trip flag.
4. **Parent side.** A parent view of upcoming trips their child is on, with a
   **"Give consent"** action (like the accidents acknowledge), timestamped.

Everything else (fields, access rules, edit, delete) is already yours in
`server/src/routes/trips.ts`.
