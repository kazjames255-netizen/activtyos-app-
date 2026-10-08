# HMRC Tax-Free Childcare Payments API v1.2: sandbox test evidence

Prepared 7 Oct 2026 for HMRC's *Evidence of Testing Checklist*. Application: **Activityos** (sandbox), Application ID `3813221c-6e57-45e6-8473-6b08f81c3695`.
Sandbox base URL `https://test-api.service.hmrc.gov.uk`. Scenario references are HMRC's documented test values (`outbound_child_payment_ref`: the first 4 letters pick the response).

## Status at a glance

| Part | Status |
| --- | --- |
| Success journey (link, balance, pay) on the live site | **PASSED** (reported by the developer, 7 Oct 2026: "link, balance and payment from checkout, with HMRC's reference saved on the booking"). Needs the per-reference runs below attached as screenshots. |
| Mapping of every documented error code to a parent-facing message | **DONE and unit-tested** (`tests/regression/tfc-sandbox-scenarios.test.mts`, 4 tests). New parent screens added for E0043, E0035, E0025/E0026/E0032 and E0031/E0036/E0042. |
| Running each of the 16 scenario references against the sandbox with a real test user | **NOT YET RUN: needs a person.** The automated run was blocked by the tooling's permission policy (it would have exchanged the sandbox client secret for user tokens). See "How to run it" below. |

## How to run the 16 scenarios (about 20 minutes)

1. In the app, as a throwaway parent, add a child and type the scenario reference as the child's Tax-Free Childcare reference (for example `EEWW00000TFC`), with any date of birth.
2. At checkout choose Tax-Free Childcare, press **Login with HMRC**, sign in with an HMRC *Create Test User* account (Developer Hub, Create Test User), give permission.
3. Where the scenario is a balance or payment one, book and pay by Tax-Free Childcare for that child.
4. Screenshot the screen the parent sees, and paste the date, tester and result into the table below.

## Scenario table

Expected = what HMRC documents. Parent message = the title shown by our checkout (all 11 languages exist; English shown). "Booking state" is always *Awaiting voucher payment* (never marked Paid) on a failure.

### Success

| Reference | Endpoint | Expected per HMRC docs | Our handling | Result | Screenshot | Date / who |
| --- | --- | --- | --- | --- | --- | --- |
| AAAA00000TFC | link | child "Peter Pan" | linked, child name stored | to attach | | |
| AAAA00000TFC | balance | ACTIVE, total 9500p, cleared 8000p | shows cleared funds £80.00 | to attach | | |
| AAAA00000TFC | payment | ref 1234567887654321, est 2024-10-01 | reference saved on the booking | to attach | | |
| AABB00000TFC | link / balance / payment | "Benjamin Button", INACTIVE, ref ...322 | as above (INACTIVE account shown) | to attach | | |
| AACC00000TFC | link / balance / payment | "Christopher Columbus", ACTIVE 13500p, ref ...323 | as above | to attach | | |
| AADD00000TFC | link / balance / payment | "Donald Duck", ACTIVE 16500p, ref ...324 | as above | to attach | | |

### Errors (all HTTP 400)

| Reference | HMRC code | Endpoints | Meaning | Parent sees (title) | What to do next (shown to parent) | Code path | Unit test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EERR00000TFC | E0026 | link, balance, payment | reference does not match the parent's NI number | Check your child's reference and date of birth | Check both on your TFC account and try again | `reference-mismatch` | PASS |
| EETT00000TFC | E0030 | link, balance, payment | OUR EPP record is inactive | Paying HMRC directly isn't connected yet | Pay from your HMRC account and give us your payment reference | `not-connected` | PASS |
| EEBD00000TFC | E0043 | link, balance, payment | parent has no TFC account | You need a Tax-Free Childcare account first | Create one on GOV.UK, or pay another way | `no-tfc-account` (new) | PASS |
| EEPP00000TFC | E0024 | link, payment | our EPP identifiers do not match | Paying HMRC directly isn't connected yet | manual reference route; flagged in our logs for the developer | `not-connected` | PASS |
| EEQQ00000TFC | E0025 | link | date of birth and reference do not match | Check your child's reference and date of birth | as E0026 | `reference-mismatch` (new) | PASS |
| EEVV00000TFC | E0032 | balance, payment | our EPP details not associated with the reference | Check your child's reference and date of birth | re-link the child | `reference-mismatch` (new) | PASS |
| EERS00000TFC | E0027 | payment | provider not linked to the TFC account | HMRC payment failed | Add the provider as a childcare provider in your TFC account, then pay | `provider-not-added` | PASS |
| EEUU00000TFC | E0031 | payment | childcare provider inactive | This provider can't take Tax-Free Childcare yet | nothing was taken; pay another way or ask the provider | `provider-unavailable` (new) | PASS |
| EEYY00000TFC | E0035 | payment | payments blocked on this TFC account | Please contact Tax-Free Childcare customer services | only HMRC can fix it; pay another way meanwhile | `account-blocked` (new) | PASS |
| EEYZ00000TFC | E0036 | payment | payee bank details incorrect | This provider can't take Tax-Free Childcare yet | as E0031 | `provider-unavailable` (new) | PASS |
| EEBC00000TFC | E0042 | payment | ccp_reg_reference not found or postcode mismatch | This provider can't take Tax-Free Childcare yet | as E0031 | `provider-unavailable` (new) | PASS |
| EEWW00000TFC | E0033 | payment | insufficient funds | Not enough in your HMRC account | Top up your TFC account, or pay part another way | `insufficient-funds` | PASS |

"Unit test PASS" means the code-to-screen mapping and the 11-language wording are tested without network. The **live sandbox run for each row is still to be attached** (see above).

<!-- hm-run:results:start -->
## Automated sandbox run results

Last run: 2026-10-08T15:46:49.528Z by `server/node_modules/.bin/tsx e2e/review/hm-run.mts` against test-api.service.hmrc.gov.uk. References are masked (last 3 characters shown). Scenario ids S01-S16 follow the tables above in order.

Overall: 32 of 32 requests passed.

| Id | Scenario | Request | Ref | HTTP | HMRC code | Parent screen | Expected screen | Mapped | Result | Timestamp (UTC) | Note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S01 | Success: Peter Pan (ACTIVE) | link | *********TFC | 200 | - | (success) | (success) | n/a | PASS | 2026-10-08T15:45:53.061Z |  |
| S01 | Success: Peter Pan (ACTIVE) | balance | *********TFC | 200 | - | (success) | (success) | n/a | PASS | 2026-10-08T15:45:54.946Z |  |
| S01 | Success: Peter Pan (ACTIVE) | payment | *********TFC | 200 | - | (success) | (success) | n/a | PASS | 2026-10-08T15:45:56.779Z |  |
| S02 | Success: Benjamin Button (INACTIVE) | link | *********TFC | 200 | - | (success) | (success) | n/a | PASS | 2026-10-08T15:45:58.541Z |  |
| S02 | Success: Benjamin Button (INACTIVE) | balance | *********TFC | 200 | - | (success) | (success) | n/a | PASS | 2026-10-08T15:46:00.425Z |  |
| S02 | Success: Benjamin Button (INACTIVE) | payment | *********TFC | 200 | - | (success) | (success) | n/a | PASS | 2026-10-08T15:46:02.147Z |  |
| S03 | Success: Christopher Columbus (ACTIVE) | link | *********TFC | 200 | - | (success) | (success) | n/a | PASS | 2026-10-08T15:46:03.988Z |  |
| S03 | Success: Christopher Columbus (ACTIVE) | balance | *********TFC | 200 | - | (success) | (success) | n/a | PASS | 2026-10-08T15:46:05.731Z |  |
| S03 | Success: Christopher Columbus (ACTIVE) | payment | *********TFC | 200 | - | (success) | (success) | n/a | PASS | 2026-10-08T15:46:07.442Z |  |
| S04 | Success: Donald Duck (ACTIVE) | link | *********TFC | 200 | - | (success) | (success) | n/a | PASS | 2026-10-08T15:46:09.195Z |  |
| S04 | Success: Donald Duck (ACTIVE) | balance | *********TFC | 200 | - | (success) | (success) | n/a | PASS | 2026-10-08T15:46:10.883Z |  |
| S04 | Success: Donald Duck (ACTIVE) | payment | *********TFC | 200 | - | (success) | (success) | n/a | PASS | 2026-10-08T15:46:12.677Z |  |
| S05 | E0026 reference does not match NI number | link | *********TFC | 400 | E0026 | reference-mismatch | reference-mismatch | yes | PASS | 2026-10-08T15:46:14.527Z |  |
| S05 | E0026 reference does not match NI number | balance | *********TFC | 400 | E0026 | reference-mismatch | reference-mismatch | yes | PASS | 2026-10-08T15:46:16.301Z |  |
| S05 | E0026 reference does not match NI number | payment | *********TFC | 400 | E0026 | reference-mismatch | reference-mismatch | yes | PASS | 2026-10-08T15:46:18.087Z |  |
| S06 | E0030 our EPP record inactive | link | *********TFC | 400 | E0030 | not-connected | not-connected | yes | PASS | 2026-10-08T15:46:19.798Z |  |
| S06 | E0030 our EPP record inactive | balance | *********TFC | 400 | E0030 | not-connected | not-connected | yes | PASS | 2026-10-08T15:46:21.564Z |  |
| S06 | E0030 our EPP record inactive | payment | *********TFC | 400 | E0030 | not-connected | not-connected | yes | PASS | 2026-10-08T15:46:23.315Z |  |
| S07 | E0043 parent has no TFC account | link | *********TFC | 400 | E0043 | no-tfc-account | no-tfc-account | yes | PASS | 2026-10-08T15:46:25.027Z |  |
| S07 | E0043 parent has no TFC account | balance | *********TFC | 400 | E0043 | no-tfc-account | no-tfc-account | yes | PASS | 2026-10-08T15:46:26.789Z |  |
| S07 | E0043 parent has no TFC account | payment | *********TFC | 400 | E0043 | no-tfc-account | no-tfc-account | yes | PASS | 2026-10-08T15:46:28.568Z |  |
| S08 | E0024 EPP identifiers mismatch | link | *********TFC | 400 | E0024 | not-connected | not-connected | yes | PASS | 2026-10-08T15:46:30.317Z |  |
| S08 | E0024 EPP identifiers mismatch | payment | *********TFC | 400 | E0024 | not-connected | not-connected | yes | PASS | 2026-10-08T15:46:32.032Z |  |
| S09 | E0025 date of birth / reference mismatch | link | *********TFC | 400 | E0025 | reference-mismatch | reference-mismatch | yes | PASS | 2026-10-08T15:46:33.814Z |  |
| S10 | E0032 EPP not associated with reference | balance | *********TFC | 400 | E0032 | reference-mismatch | reference-mismatch | yes | PASS | 2026-10-08T15:46:35.519Z |  |
| S10 | E0032 EPP not associated with reference | payment | *********TFC | 400 | E0032 | reference-mismatch | reference-mismatch | yes | PASS | 2026-10-08T15:46:37.276Z |  |
| S11 | E0027 provider not linked | payment | *********TFC | 400 | E0027 | provider-not-added | provider-not-added | yes | PASS | 2026-10-08T15:46:39.039Z |  |
| S12 | E0031 provider inactive | payment | *********TFC | 400 | E0031 | provider-unavailable | provider-unavailable | yes | PASS | 2026-10-08T15:46:40.743Z |  |
| S13 | E0035 payments blocked | payment | *********TFC | 400 | E0035 | account-blocked | account-blocked | yes | PASS | 2026-10-08T15:46:42.517Z |  |
| S14 | E0036 payee bank details incorrect | payment | *********TFC | 400 | E0036 | provider-unavailable | provider-unavailable | yes | PASS | 2026-10-08T15:46:44.294Z |  |
| S15 | E0042 ccp reference/postcode | payment | *********TFC | 400 | E0042 | provider-unavailable | provider-unavailable | yes | PASS | 2026-10-08T15:46:46.070Z |  |
| S16 | E0033 insufficient funds | payment | *********TFC | 400 | E0033 | insufficient-funds | insufficient-funds | yes | PASS | 2026-10-08T15:46:47.769Z |  |
<!-- hm-run:results:end -->

## Safety properties (code review, same session)

- A documented failure never throws: the checkout always gets a designed screen, never a blank error (`server/src/lib/tfc.ts`, rule 1).
- A payment that fails is never recorded on the booking: `tfcPayment` is only written on success, so the booking stays *Awaiting voucher payment* and is never marked paid (`server/src/routes/tfc.ts`, /pay).
- At most one HMRC payment per child per key: the intent is written before the call; pending/uncertain keys are never re-sent (`payOnce`). A timeout is flagged `uncertain` and the parent is told to check HMRC before paying again.
- No token, secret or authorisation code is ever logged: only the HMRC errorCode and a correlation id.
- Tokens are sealed at rest with AES-256-GCM when `HMRC_TFC_TOKEN_KEY` is set (set on the live API, confirmed by the developer 7 Oct 2026).
- Parent-facing wording shows no HMRC error code (tested).

## Not covered by these scenarios

Token refresh races, E0401/ETFC2 expiry (covered by unit tests of the refresh path), HMRC being unreachable (timeout path, flagged uncertain for payments).
