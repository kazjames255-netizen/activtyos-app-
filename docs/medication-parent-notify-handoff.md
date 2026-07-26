# Medication → link to child + notify parent (for Amir)

**From:** Kaz · **Date:** 2026-07-25.

The operator Medication page (`features/medication/MedicationApp.tsx`) is built:
authorise a med (consent), a **frequency** (Every day / As needed), **instructions**
(how to give — I added `instructions` to `medSchema` in `server/src/routes/medications.ts`),
one-tap **Given? Yes / No** dose logging with day+time, and a searchable
**child/family picker** on the Child field. What's missing is the parent side.

## What's needed
A recorded dose (and a not-given event) must **reach the child's parent** in the
customer area, and ideally **notify** them.

1. **Resolve the child link.** The operator picks a child by name (the picker
   reads `/api/customers`, whose embedded children have **no canonical id**). To
   link to the parent, resolve `childId` server-side: on `POST /api/medications`
   (or on administer), match the chosen `childName` (+ optionally the family) to a
   `children` doc for this tenant's customers and stamp `childId`. The medication
   schema already accepts `childId` — it's just not being populated from the
   operator flow. (This is the "booked-child picker on incident/medication forms"
   item on your list — same fix.)
2. **Surface to the parent.** `ParentMedicationApp` already exists and the parent
   GET filters by their `children`' `childId`. Once `childId` is stamped, the med +
   its MAR (every Given / Not given dose with day·time) shows to the parent
   automatically. Please confirm the parent GET returns administrations too.
3. **Notify.** When a dose is logged (`POST /api/medications/:id/administer`),
   push a notification to the parent — a customer-area alert and/or the existing
   email path (`emailNewMessage`-style) — e.g. "Riverdale gave Amir his Ventolin
   at 12:04" or "A dose was recorded as NOT given". Include the `given` outcome
   (the client sends `given: boolean`; add it to `administerSchema` so it persists
   — right now only `doseGiven` ("Not given") carries it).

## Fields the client already sends (add to schemas where missing)
- `medSchema`: `instructions` ✅ (added). `childId` accepted but not populated — see #1.
- `administerSchema`: currently strips **`given`** (boolean) — add it so the
  Given/Not-given outcome is stored first-class, not just inferred from `doseGiven`.

## Notify preference (parent can mute)
The parent page has a **"🔕 Stop notifying me — I'll check here"** toggle (and
its inverse). It's stored in `localStorage` (`aos.medNotifyMuted`) for now.
Please persist it server-side as a parent preference and **gate the email + bell
on it**: on each dose, email the parent AND raise an in-app bell notification —
UNLESS muted. (Muted = they'll just read the Medication page themselves.)
Withdrawing consent is already wired (`POST /:id/withdraw`).

## Not doing on the front end
Per Kaz's rule, I stopped at the UI + the tiny `instructions` schema add. The
child-id resolution, the parent-view wiring, and the notification are yours.
