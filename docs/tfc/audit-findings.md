# Tax-Free Childcare Payments API v1.2: audit findings

Audited 30 Sep 2026, offline. No HMRC host was contacted. The public spec pages
(`developer.service.hmrc.gov.uk` API docs and `github.com/hmrc/tax-free-childcare-payments`) returned
only a sign-in page and a high-level README to an unauthenticated fetch, so field-level claims below are
marked either "matches the comment block in the code" (authored from the spec by the original developer) or
moved to Open questions. Nothing is assumed.

Files in scope: `server/src/lib/tfc.ts`, `server/src/routes/tfc.ts`, `lib/tfc.ts`,
`features/listings/tfc.ts`, `features/listings/TfcConnect.tsx`. Regression test:
`server/src/tfcAuditTest.mts` (79 assertions, no credentials). Related and read only:
`server/src/index.ts`, `server/src/lib/rateLimit.ts`, `server/src/lib/childcare.ts`,
`features/listings/checkout.tsx`, `docs/tfc-build-spec.md`.

## Spec comparison

| Area | Code | Status |
| --- | --- | --- |
| Endpoints | POST `/individuals/tax-free-childcare/payments/link`, `/balance`, and `/individuals/tax-free-childcare/payments/` (`server/src/lib/tfc.ts`) | Consistent with the v1.2 paths in the code header; unconfirmed from public docs (Q1) |
| Accept header | `application/vnd.hmrc.1.2+json` | Standard HMRC versioning form |
| Correlation-ID | fresh UUID per call, logged on failure only | Header name and whether HMRC requires it unconfirmed (Q2) |
| Payload fields | `epp_unique_customer_id`, `epp_reg_reference`, `outbound_child_payment_ref`, `child_date_of_birth`, `payment_amount`, `ccp_reg_reference`, `ccp_postcode`, `payee_type: "CCP"` | Matches the code's spec comments; unconfirmed (Q1) |
| Amounts | pounds in our API, whole pence on the wire; balance fields converted back | Verified by test; unit assumed pence (Q3) |
| Error codes | E0033, E0027, E0030, ETFC2, E0401 mapped; everything else `connection-failed` | Mapping is ours; meanings unconfirmed (Q4) |
| OAuth | authorization code, scope `tax-free-childcare-payments`, `/oauth/authorize` and `/oauth/token`, refresh rotation, 60 s expiry skew | Standard HMRC user-restricted flow; lifetimes unconfirmed (Q5) |
| Redirect URI | `HMRC_TFC_REDIRECT_URI` or `API_URL` + `/api/tfc/callback`, sent on authorize and exchange | Must match the Developer Hub registration exactly (Q6) |
| Base URL | defaults to the SANDBOX host; production only by explicit env | Safe default |
| Timeouts | 20 s per call via `AbortSignal.timeout` | No documented HMRC guidance (Q7) |
| Tenant isolation | every route parent-only; child and link resolved by `parentUid`; tenant payee read from `settings.childcare` via `server/src/lib/childcare.ts` | See Findings F9 |
| Five failure states | `lib/tfc.ts` union, copy in `features/listings/tfc.ts` | All five reachable and tested |

## Findings

Severity is for real-money, real-customer use.

- F1 (HIGH, fixed): no payment idempotency. `POST /api/my/tfc/pay` called HMRC on every request. A double
  click, a client retry or two tabs could charge twice, and the attempt was recorded only after the call.
- F2 (HIGH, fixed): ambiguous outcome treated as a clean failure. A timeout, dropped socket or unreadable 200
  body on a payment returned `connection-failed`, and the UI then tells the parent to pay manually, so the
  parent could pay twice. Nothing marked the attempt as "may have been paid".
- F3 (HIGH, fixed): partial failure. If HMRC paid and the Firestore write failed, the only trace was a log
  line. The intent is now written before the call and updated after; a write failure after success no longer
  hides the success from the caller.
- F4 (MEDIUM, fixed): a refresh that failed for ANY reason (network blip, 5xx, 429) returned
  `connection-expired`, and the routes then set `linked:false`, forcing a parent back through GOV.UK. Only a
  4xx refusal now means expired.
- F5 (MEDIUM, fixed): OAuth callback claim was read-then-write, so two concurrent redirects with the same
  `state` could both proceed. Now an atomic transaction.
- F6 (MEDIUM, fixed): amount handling. `Math.round(p*100)` turned 1.005 into 100p, a zero or sub-penny amount
  (0.001) was sent as `payment_amount: 0`, and non-numeric balance fields produced NaN pounds. All guarded.
- F7 (MEDIUM, fixed): no rate limit on `/api/my/tfc/*` (the callback had one in `server/src/index.ts`). Added a
  per-parent limit inside `server/src/routes/tfc.ts` (60 per minute) since `index.ts` is not ours to edit.
- F8 (MEDIUM, mitigated): tokens stored in plaintext in `tfcLinks/{childId}`. Added optional AES-256-GCM sealing
  (`HMRC_TFC_TOKEN_KEY`, 32 bytes); unset keeps the old behaviour, legacy plaintext stays readable. A KMS-held
  key is still the right end state. Still missing: unlink and delete-on-account-closure with HMRC revocation
  (no unlink route exists; `server/src/routes/privacy.ts` is not ours).
- F9 (MEDIUM, open): `tenantId` on `/pay` comes from the browser. The payee details are read server-side from
  that tenant's settings, so a parent cannot invent a payee, but can pick any tenant with complete childcare
  settings. It can only move the parent's own TFC money. Needs a server-side booking-to-tenant check; left for
  the owner of the booking model.
- F10 (LOW, fixed): `/pay` did not require `linked === true`; a half-finished link with tokens would call HMRC.
- F11 (LOW, open): concurrent refreshes can both spend the same rotating refresh token; the loser sees
  `connection-expired`. The per-child pay lock narrows this for payments, not for balance reads (Q5).
- F12 (LOW, open): `TfcConnect.tsx` closing the dialog during hand-off does not stop the poll, which runs up
  to 15 minutes and may call `onLinked` later; the popup also stays open. Benign (linking is idempotent)
  but untidy. Not changed: the screen logic is otherwise sound (try again, pay-from-HMRC escape, blocked
  pop-up goes to the manual path, poll blips tolerated, 404 treated as an ending).
- F13 (INFO): `postMessage(..., "*")` in the callback page carries only `{source, ok}`; no sensitive data.
- F14 (INFO): never-throws and never-logs rules hold. Logs contain correlation id, HTTP status, errorCode and
  OAuth error name only. Verified by capturing all console output in the test.
- F15 (INFO, open): no reconciliation job. `tfcPayments` rows now carry `status` (pending, ok, failed,
  uncertain) and the HMRC payment reference, which is what a reconciler needs, but nothing reads them yet.

## Fixes made

All in owned files.

- `server/src/lib/tfc.ts`: exported `toPence`/`toPounds` with epsilon rounding and NaN guards; local refusal of
  invalid amounts in `submitPayment`; `uncertain` flag on `TfcResult` (network error, unreadable 200, 5xx);
  refresh classification (4xx = expired, else `connection-failed`); `payOnce()` with a `PayStore` interface
  giving at-most-once per key (replay on success or failure, refuse on pending or uncertain);
  `sealToken`/`openToken` (AES-256-GCM).
- `server/src/routes/tfc.ts`: Firestore-backed `PayStore` (atomic `create`), intent written before the HMRC
  call, per-child 60 s in-flight lock (409 when busy), `idempotencyKey` in the pay schema, `linked` required
  to pay, `uncertain` returned to the browser, atomic callback state claim, per-user rate limit, sealed tokens
  on every write path.
- `features/listings/tfc.ts`: `pay()` sends an idempotency key (generated if the caller passes none) and
  reports `uncertain` (including when the request itself errors) so the UI can avoid inviting a blind retry.
  `features/listings/checkout.tsx` does not yet call `pay()`; whoever wires it must pass one key per intended
  payment and reuse it on retry.
- `server/src/tfcAuditTest.mts`: 79 assertions covering the five failure states, never-throws, no token or
  secret in logs, pence edge cases, idempotency and retry safety, partial failure, token sealing and the
  env-gated `not-connected` behaviour.
- Checks: `npx tsc --noEmit` and `npm --prefix server run typecheck` clean.

## Open questions for HMRC

Everything here is unconfirmed from public material and is deliberately not assumed.

1. Q1: exact field names, required/optional status and formats (DOB format, reference regexes, postcode
   format) for link, balance and payment in v1.2.
2. Q2: is `Correlation-ID` mandatory, what format does it accept, and does a repeated correlation id on a
   retry have any idempotency meaning?
3. Q3: confirm `payment_amount` and all balance fields are integer pence, and the minimum and maximum payment.
4. Q4: full error catalogue with HTTP status and whether each means "not processed" or "may have processed".
   Specifically E0033, E0027, E0030, E0043, ETFC2, E0401, and what a 403 means (scope, EPP status, or token).
5. Q5: access and refresh token lifetimes; is the refresh token rotated on every use, and what happens when
   two refreshes race?
6. Q6: redirect URI matching rules (exact match, trailing slash, query strings) and whether several URIs can
   be registered for sandbox and production.
7. Q7: recommended client timeout for the payment call, and is a 202 or a delayed answer possible?
8. Q8: does the payment endpoint dedupe repeated requests (same child, provider, amount, time), and is there a
   way to query a payment's status by our own reference after a timeout?
9. Q9: how do EPPs reconcile: is there a payments statement or report API, and what reference appears on the
   provider's bank statement?
10. Q10: revocation: is there an endpoint to revoke a user's grant when a parent unlinks or closes their
    account?
11. Q11: whether one parent may link several children under one access token, and whether `epp_reg_reference`
    differs per franchise or tenant (see the TODO in `server/src/routes/tfc.ts` on franchise providers).
12. Q12: sandbox test data (references, error triggers) for each error code, to replace the stubbed tests.
