# Holiday & absence planner — backend handoff (for Amir)

Front-end built 2026-08-15. A BrightHR-style holiday/absence planner: staff
request time off, managers approve/decline with clash detection, everyone's
**statutory entitlement is computed to UK law**, and approved leave feeds the
schedule. Front-end + demo store only — the statutory/server machinery below is
yours.

## Files
- `lib/holiday.ts` — pure model + **UK entitlement engine** (no deps). Types (`Absence`, `LeaveProfile`, `HolidayPolicy`), `statutoryDays`, `annualAllowance`, `accruedAllowance`, `workingDays`, `leaveYear`, `summarise`, `conflicts`, `offOn`, `nextPublicHoliday`, bank-holiday table (Eng & Wales 2025–27).
- `features/holiday/HolidayApp.tsx` — operator/manager view (company + franchise + freelancer view `holiday`): **Requests** (approve/decline/edit + allowance-after + Show conflicts), **Who's off** (week timeline + "needs covering" vs the rota), **Allowances** (per-person entitlement table + editor), **Settings** (leave-year, policy, bank holidays, region).
- `features/holiday/MyHolidayApp.tsx` — staff view (staff view `holiday`, replaced the old stub): summary counters, allowance ring, next public holiday, request-time-off modal, absence history + cancel.
- `features/holiday/data.ts` — demo localStorage store + seeding from the shared roster (`DEMO_STAFF`).
- `features/schedule/ScheduleApp.tsx` — reads approved leave (`loadApprovedLeave`) so on-leave staff are blocked from being rostered + flagged "🏖 On approved leave" / "needs covering".

## The law implemented (verify before production)
- Statutory = **5.6 weeks × days worked/week, capped at 28 days** (`statutoryDays`). E.g. 5d→28, 4d→22.4, 3d→16.8.
- **Bank holidays** aren't automatically extra (policy toggle `bankHolidaysExtra`); `workingDays` excludes weekends + bank holidays from a booking.
- **First-year accrual** 1/12 per month (`accruedAllowance`, needs a real `startDate`).
- **Irregular/part-year** workers accrue **12.07%** of hours worked (`accruedFromHours`) — not yet surfaced in UI; wire when hours come from the rota.
- Bank-holiday dates are **England & Wales**; Scotland/NI fall back to Eng-Wal in the demo.

## Stores (demo → move server-side)
`aos.holiday.absences.v1` (Absence[]), `aos.holiday.policy.v1` (HolidayPolicy), `aos.holiday.profiles.v1` (LeaveProfile[]). Absence.staffId is a demo name-slug — replace with the real user id (the same id used by invites/schedule/payroll).

## Owed (Amir)
1. **Collections + tenant scoping**: `absences`, `holidayPolicy` (per tenant), `leaveProfiles` (per user: allowance override, days/week, carried-over, start date). Real per-user identity so staff see only their own; managers see their team (RBAC — holiday approval is a permission).
2. **Approval workflow + notifications**: on request → bell/email the approver; on approve/decline → bell/email the requester (with the decline reason); optional escalation. Status transitions server-validated (can't approve past someone's remaining allowance without an override flag).
3. **Schedule integration server-side**: block rostering a person on approved leave (front-end already hides them from assign/auto-fill by name); generate a **"needs covering"** alert when approved leave lands on an existing shift; ideally two-way (booking leave frees/queries the shift).
4. **Entitlement truth**: compute allowance from the employment contract (days/week, FTE, start/leave dates), pro-rata joiners/leavers, **carry-over rollover** at leave-year end (cap `carryOverMax`, expire the rest), and the 12.07% accrual for irregular hours (feed from rota hours — ties to the "Rota labour cost → Payroll" item).
5. **Payroll link**: approved paid leave should feed **holiday pay** (the payroll "Holiday pay" addition), and **sickness** should drive SSP eligibility (Bradford factor is surfaced softly via `sickThreshold`).
6. **Bank holidays**: use the official gov.uk bank-holidays JSON feed (`https://www.gov.uk/bank-holidays.json`) by division (england-and-wales / scotland / northern-ireland) instead of the hardcoded table; refresh yearly.
7. **Audit + data protection**: absence reasons/sickness are special-category-adjacent — access-log, retain per policy, and gate sickness detail behind the manager role.

Ties to [[roles-permissions]] (approval permission), the schedule/rota persistence item, and payroll (holiday pay / SSP).
