# Clock in/out & timesheets — backend handoff (for Amir)

Front-end built 2026-08-15. Staff clock in/out with breaks, a live Who's-in board,
timesheets (actual vs scheduled + optional late auto-deduct), and a live Dashboard
card. Renamed the "Timesheets" concept to **"Clock in/out & timesheets"**.

## Files
- `features/timeclock/data.ts` — demo store + model + actions. `ClockRecord` per person (status in/break/out, clockInAt/clockOutAt, breakMs, lateMin, events[], approved), `ClockSettings` (autoDeductLate / graceMin / rounding). `clockIn/clockOut/startBreak/endBreak` mutate + **stamp the person's rota shift `in`/`out`** in `aos.rota.v5`. `workedMs`, `roundHours`, `scheduledHoursToday`, `offToday` (approved leave from the Holiday store).
- `features/timeclock/TimeClockApp.tsx` — staff view `clockinout` ("Clock in / out"): big clock button, Start/End break, live worked total, today's log, optional geolocation capture, mini who's-in.
- `features/timeclock/TimesheetsApp.tsx` — operator view `timesheets` (company/franchise/freelancer, "Clock in/out & timesheets"): **Who's in** (in / on break / out / off), **Timesheets** (in/out/break/worked/scheduled/late/deduction/pay-hrs + Approve), **Settings** (autoDeductLate toggle, grace, rounding).
- `features/timeclock/LiveClockCard.tsx` — the live "Who's in now" card injected into the operator **Dashboard**.
- Stores: `aos.timeclock.v1` (records), `aos.timeclock.settings.v1` (settings). Demo matches people **by name**; daily reset when the stored day ≠ today.

## How it ties in
- **Schedule**: clocking writes actual `in`/`out` onto the matching rota shift, so the existing check-in alerts + status chips reflect reality.
- **Payroll**: because the pay run's **Rostered-hours** mode already reads shift `in`/`out`, clocked hours flow into pay automatically. Late auto-deduct is expressed as paying actual-worked vs scheduled hours.
- **Holiday**: Who's-in "Off today" reads approved leave from `aos.holiday.absences.v1`.

## Owed (Amir)
1. **Real per-user identity** (staff clocks themselves; demo is name-keyed "me" = Marcus Bell) + server store of clock events (immutable audit — clock times are pay evidence).
2. **Shared-device KIOSK**: one tablet at the venue, staff clock in/out by **PIN** (or QR), with a photo/selfie option to stop buddy-punching.
3. **Geofence / GPS verification**: capture + validate location against the venue (front end captures lat/long best-effort; no map tiles — needs a maps provider key).
4. **Timesheet approval → payroll posting**: persist approvals; feed approved hours to the pay run server-side (not just the rota read); handle overnight/multi-shift, auto clock-out safeguards, rounding + break rules.
5. **Late auto-deduct** as a real payroll adjustment (currently a front-end preview), with an audit trail; and a manager edit/override of clock times with reason.
6. **Live board** via websockets/poll for true real-time (front end polls the local store every 30s).

Ties to [[payroll-app]] (rota-hours → pay), the schedule/rota persistence item, and [[holiday-planner]] (off-today).
