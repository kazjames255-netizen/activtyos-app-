# Handoff — Trips & visits (parent notify + consent)

**From:** Kaz · **Date:** 2026-07-26.

Trips & visits (`features/trips/TripsApp.tsx`) is rebuilt to the Medication /
Accidents standard: themed hero + stat tiles, a **3-step wizard** (Where & when /
Who's going / Risk & consent), transport picker, booked-child multi-select
(optionally scoped to a listing), staff list with a **live ratio check**, risk
assessment, consent, status (planned/completed/cancelled), edit, search +
status filters. Backed by the existing `/api/trips` (GET/POST/PUT/DELETE) — no
schema change needed for the core.

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
