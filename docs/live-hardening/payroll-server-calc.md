# Payroll server-side recalculation and the GBP accounting guard

Until now `POST /api/payroll/runs` in `server/src/routes/payroll.ts` only bounds-checked the figures the browser sent. The browser (`features/payroll/PayrollApp.tsx`) computes every line with `computeLine` in `features/payroll/payCalc.ts` (HMRC engine: `features/payroll/ukStatutory.ts`). This change makes the server re-run that same engine and compare, and stops accounting posts going to a non-GBP provider company. Every default leaves live behaviour unchanged.

## Modes

`PAYROLL_SERVER_CALC` selects one of three modes, resolved by `resolveCalcMode` in `features/payroll/payCalc.ts`.

- **warn (default, also used for unset or any unrecognised value).** The server recomputes each line from the STORED employee record (`payrollConfig`) plus the per-run inputs on the line (hours, additions, deductions, leave, sick-pay rule, pro-rata, overrides). Figures compared with a 1p tolerance: gross, PAYE, employee NI, employer NI, employee pension, employer pension, student loan, net. Also compared: the rate against the stored rate, tax code and NI category against the stored record and that period's stored adjustment, and the pro-rata share against start/leave dates and the run window. A mismatch NEVER blocks: the run is created exactly as submitted, a log line is written (hashed employee key, field names and counts only: no name, no NI number, no amounts) and the run gets `calcCheck: { status: "mismatch", mode, checked, unverified, mismatches: [{ employeeKey, field, sent, computed }] }`.
- **enforce.** Same comparison; a mismatch returns HTTP 400 `code: "calc_mismatch"` with a readable message (who, which field, sent vs calculated) and stores nothing. Never the default: typos such as `enforced` or `true` fall back to warn. A single request may ask for enforce with body `calcMode: "enforce"` (stricter only; it cannot loosen the server mode, cannot turn `off` on, and is never stored). That is how `e2e/payroll-server-calc.spec.ts` tests enforce on a warn-default API.
- **off.** No check, no extra read.

What is deliberately not a mismatch: a matching run is stored byte-for-byte as before (no `calcCheck` field at all); a run with no `freq`, a tenant with no stored employees, or a line whose person is not on the stored list (demo or manual rows) is counted as unverified, never as a mismatch; any internal fault in the checker is logged and ignored (fail open).

Year to date: the browser sends Month-1/Week-1 basis lines (it passes no cumulative inputs), so feeding the stored year-to-date (`server/src/lib/payrollYtd.ts`) into the comparison would change today's numbers by pennies on steady pay and by far more on bonuses. So it is ADVISORY only: with `PAYROLL_SERVER_CALC_YTD=1` the server also computes cumulative PAYE from `payrollYtd` (via `ytdInputsFor`) and records `calcCheck.ytdAdvisory` where it differs by more than 1p. It never affects status or enforcement. Default off. Making the browser itself send cumulative inputs is a separate `features/payroll/PayrollApp.tsx` change.

GBP guard (`POST /api/accounting/post/:runId` in `server/src/routes/accounting.ts`): before the run is claimed the provider's base currency is read (QuickBooks preferences home currency, Xero Organisation `BaseCurrency`, Sage business info). A positively-read non-GBP currency returns 409 `code: "non_gbp_provider"` and leaves the run untouched and retryable. If the currency cannot be read (network, non-200, unexpected shape, not connected) the guard FAILS OPEN: it logs and lets the post continue.

## Environment variables

| Variable | Values | Default | Effect |
| --- | --- | --- | --- |
| `PAYROLL_SERVER_CALC` | `off`, `warn`, `enforce` | `warn` | Server recalculation mode (above). |
| `PAYROLL_SERVER_CALC_YTD` | `1` | unset (off) | Adds the advisory cumulative-PAYE comparison to `calcCheck`. |
| `ACCOUNTING_ALLOW_NON_GBP` | `1` | unset | Turns the GBP guard off entirely (deliberate override). |
| `QBO_ENV` | `sandbox`, `production` | `sandbox` (`qboConfig` in `server/src/lib/accounting.ts`) | The QuickBooks sandbox company (realm 9341458202792641, USD) is allowed without the override only while this is not `production`, so `e2e/accounting-qbo-post.spec.ts` and `e2e/accounting-edge.spec.ts` keep working. |

## Rollout (warn, watch logs, then enforce)

1. Ship with nothing set: mode is warn. Live behaviour is unchanged; runs only gain `calcCheck` when a figure differs by more than 1p.
2. Watch for `[payroll] calc-check warn:` lines in the API log and for runs with `calcCheck` (Firestore `payrollRuns`, or `GET /api/payroll`). Investigate every one: each is either a browser/server drift (a real bug), a stale employee record, or someone sending doctored figures. Optionally set `PAYROLL_SERVER_CALC_YTD=1` for a period to see where cumulative PAYE would differ.
3. Only after a clean stretch (several real pay runs across frequencies, including starters, leavers, leave, timesheet-hours and rolled-up staff with zero mismatches) set `PAYROLL_SERVER_CALC=enforce`. Roll back instantly by setting `warn` or unsetting it.
4. For the GBP guard: connect GBP-home-currency companies for UK customers. Use `ACCOUNTING_ALLOW_NON_GBP=1` only for a deliberate non-GBP test company.
5. Verification: `cd server && npx tsx --tsconfig ../tsconfig.json src/payrollCalcVerify.mts` (pure engine and comparison, at least 200 assertions), `scripts/e2e-locked.sh e2e/payroll-server-calc.spec.ts`, plus `e2e/payroll-flow.spec.ts` and `e2e/payroll-security.spec.ts`.

## Risks

- Hours-driven lines: the line carries `hoursM` rounded to 2 decimals, so manually typed hours with more decimals can differ from the exact pay by up to rate x 0.005 hours; the comparison allows that slack, which also means a tamper of a few pence on such a line goes unseen.
- Per-run adjustments (extra additions, deductions, leave, hours, manual PAYE/NI/pension overrides) are taken from the submitted line as inputs: the server proves the figures follow from the inputs, not that the inputs are right (timesheet hours and leave are not re-derived from `clockRecords`). Manual overrides are trusted by design.
- Enforce is not safe to switch on until the warn period is clean; a stale stored employee record (edited after the browser loaded) produces a legitimate-looking mismatch and, in enforce, a refusal. The browser's message is "Refresh Payroll and create the run again".
- Pension scheme is always the legacy mode and student loan always on, matching what `PayrollApp.tsx` sends today; if the UI later sends `pensionScheme` or `studentLoan:false` the server check must be taught the same inputs first or it will report false mismatches.
- `features/payroll/payCalc.ts` imports `../../lib/holiday` and `../../lib/i18n/format` relatively (not via the `@/` alias) so the server can import it; Next.js and tsx resolve both the same. A future reintroduction of an `@/` import there breaks `npm --prefix server run typecheck`.
- GBP guard fails open by design: a provider outage during the lookup lets a non-GBP post through. The Sage business endpoint field for base currency is unverified against a live Sage company; if it is absent the guard cannot see the currency and fails open.
- The guard adds one provider read per post attempt (and a forced token refresh on a 401); a rate-limited provider just falls back to the normal post path.
- The guard and calc check are read-only with respect to provider and pay data; the only new persisted field is `calcCheck` on a mismatching run, which is returned by the existing run listings.
