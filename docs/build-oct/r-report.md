# Agent R report - staff / roles backend (2 Oct)

Verified each item against current code first; docs/amir-backend-outstanding.md was stale on #30/#32/#38.

## 30 Roles & permissions - BUILT (the missing piece) / rest ALREADY BUILT
- Already built: caps in /api/me, enforceAccess (middleware/access.ts + lib/accessMap.ts), role id on invites (invite.staffRole -> users.staffRole -> permRole), users.assignment.
- Gap found: role/assignment could only be set at invite creation; later edits lived in the browser's localStorage, so server caps/site-scope kept the old values.
- BUILT: `PATCH /api/invites/:token/access {staffRole?, jobTitle?, assignment?}` (server/src/routes/invites.ts). Account holders only (staff -> 403, other tenant -> 404, franchisee only its own staff). Updates the invite AND the joined user doc (same tenant + same franchise + still staff). When the tenant has a roles matrix (rolesSetAt) an unknown role id is 400 (an unknown id would resolve to "unrestricted"). Writes an `auditLog` row (actor, before/after) - first use of that collection.
- Not built: no Team-screen UI calls the new endpoint yet (Team has no edit-role control; patchMeta is local only). Phase 2b hard-enforce tier for medical/payroll and an audit-log READER still open.

## 32 Deployment / assignment scoping - ALREADY BUILT (registers/attendance) + now editable
- lib/siteScope.ts + registers.ts (list and mark/note/etc via blockInMyFranchise), children, incidents, medication, messages, bookings, customers all scope assigned staff. Doc claim "no staff_assignments" is moot: assignment lives on users.assignment.
- Added: reassigning via the new PATCH above takes effect on the next request (tested).
- Availability -> schedule: not changed (routes/availability.ts untouched; not re-verified end to end).

## 36 Listing wizard staff picker - BUILT
- features/listings/ListingWizard.tsx StaffStep now merges GET /api/location-staff `team` (joined staff, managers only, falls back silently on 403) with library staff. A team member is copied into library staff (id `u_<uid>`) when ticked or given a bio, so customer pages keep reading library staff by id. No server change. Invited-but-not-yet-joined people are not offered (no account yet).

## 38 Credentials / certificates - ALREADY BUILT (/v/<ref>) / SKIPPED (reminders)
- /v/{ref} page + GET /api/public/credentials/:ref exist (index.ts ~243, credentials.ts ~147).
- Expiry/renewal reminder sends: SKIPPED - it is a notification-send sweep (agent N territory).

## 40 Holiday & absence - BUILT (carry-over rollover)
- server/src/lib/leaveRollover.ts (pure rule) + `POST /api/leave/rollover {apply?, asOf?}` in routes/leave.ts. Managers only, DRY-RUN BY DEFAULT. unused = allowance + carried-in - approved annual leave in the ended year; carry = min(unused, carryOverMax); expired reported. Pro-rates mid-year joiners by month, skips rolled-up (12.07%) staff, stamps profile.rolledYearStart so apply is idempotent (transaction). Refuses apply for a future asOf.
- Still owed: gov.uk bank-holiday feed, holiday-pay -> payroll / SSP (payroll is off limits), sickness retention/access log. Nothing calls rollover on a schedule; a manager triggers it (no UI button yet).

## 5 / 5b Franchise isolation - partly BUILT
- Staff/team scoping was already in place (invites list, location-staff team, leave key, franchise-isolation spec has franchise staff cases).
- BUILT backfill: `npm --prefix server run backfill-franchise -- <tenantId> [--apply]` (server/src/backfillFranchiseOwnership.ts). Stamps booking.franchiseId from the listing owner where missing. Dry-run default, one tenant per run, real tenants need ALLOW_REAL=1 to apply. Only a dry run on a nonexistent tenant was executed. Never run against production.
- 5b: invite welcome message now reads the franchise's own settings (loadSettings with franchise fallback). Left on head-office copy deliberately: lib/emails, autoEmails, sender, sweeps prefs (notification-send, agent N), referral/memberships/reviews/posts (public/brand settings, product decision on whose copy applies).

## Tests (all via scripts/e2e-locked.sh)
- e2e/r-roles-access.spec.ts (5): coach 403 no_access / view_only; PATCH refused for staff, other tenant, unknown role, empty body; live role change both ways; register scoping by listing incl. cross-listing mark refused and reassign; team-feed manager only + tenant isolated. PASS.
- e2e/r-leave-rollover.spec.ts (2): pure rule cases + API dry-run/apply/idempotent/future refused/tenant isolated. PASS.
- Regression: franchise-isolation (13) PASS, staff-portal (4) PASS, comms-scoping franchise test PASS.
- Failures NOT caused by this work: comms-scoping "HQ support" (platform 2FA required in env), safeguarding "operator logs an accident" (UI wizard click timeout, no touched files). 
- `npm --prefix server run typecheck` and `npx tsc --noEmit` clean.

## Residual risks
- auditLog has no reader; assignment ids are not validated against tenant listings (harmless: scope only resolves the tenant's own listings).
- Role ids on invite creation are still unvalidated (pre-existing); only the new PATCH validates.
- Files: invites.ts, leave.ts, ListingWizard.tsx, server/package.json (1 script line) edited; new: lib/leaveRollover.ts, backfillFranchiseOwnership.ts, 2 specs.
