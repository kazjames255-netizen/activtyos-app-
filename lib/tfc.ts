/**
 * Tax-Free Childcare — the one definition of "what went wrong", shared by
 * both halves of the app.
 *
 * It lives here rather than beside the UI because the API decides which of
 * these a parent sees: server/src/lib/tfc.ts maps HMRC's documented error
 * codes onto this union, and server/src/routes/tfc.ts returns it in the body.
 * Two copies of this list would drift silently — nothing type-checks across
 * an HTTP boundary.
 *
 * The UI side (the copy for each state, and the flow itself) is in
 * features/listings/tfc.ts, which re-exports this type so every existing
 * `import { type TfcFailure } from "./tfc"` keeps working.
 */

/** The failures HMRC's flow actually produces, each with a designed screen. */
export type TfcFailure =
  | "not-connected"        // HMRC isn't wired up here (or our EPP record is inactive)
  | "insufficient-funds"   // balance won't cover the amount
  | "provider-not-added"   // the setting isn't a provider on the booker's account
  | "connection-failed"    // the link didn't complete
  | "connection-expired"   // the token has aged out — re-authorise
  | "no-tfc-account"       // E0043: the parent has no Tax-Free Childcare account yet
  | "account-blocked"      // E0035: HMRC blocks payments from this account — only HMRC can fix it
  | "reference-mismatch"   // E0024-ish for the family: E0025 / E0026 / E0032 — reference and date of birth don't match
  | "provider-unavailable"; // E0031 / E0036 / E0042: the CHILDCARE PROVIDER can't be paid via TFC (inactive, bank details, not found)

/**
 * HMRC's documented error codes -> the screen a parent sees. ONE table, shared by the API (which decides) and tests.
 * Codes: docs "Tax-Free Childcare Payments API v1.2", test scenarios, 6 Oct 2026.
 */
export const TFC_CODE_FAILURES: Record<string, TfcFailure> = {
  E0033: "insufficient-funds",   // insufficient funds
  E0027: "provider-not-added",   // CCP not linked to the TFC account
  E0030: "not-connected",        // OUR EPP record is inactive (nothing the parent can do)
  E0024: "not-connected",        // OUR epp_reg_reference / epp_unique_customer_id mismatch (our configuration)
  ETFC2: "connection-expired",   // bearer token not valid
  E0401: "connection-expired",   // auth failure behind a 500
  E0043: "no-tfc-account",
  E0035: "account-blocked",
  E0025: "reference-mismatch",   // child_date_of_birth and reference do not match
  E0026: "reference-mismatch",   // reference does not match the parent's NI number
  E0032: "reference-mismatch",   // our EPP details are not associated with this reference
  E0031: "provider-unavailable", // CCP inactive
  E0036: "provider-unavailable", // payee bank details incorrect
  E0042: "provider-unavailable", // ccp_reg_reference not found / postcode mismatch
};

/** The i18n key stem (p7ck.<stem>_title / _detail) for each failure: used by every screen so they never disagree. */
export const TFC_COPY_STEM: Record<TfcFailure, string> = {
  "not-connected": "tfcNotConnected",
  "insufficient-funds": "tfcInsufficient",
  "provider-not-added": "tfcProviderNotAdded",
  "connection-failed": "tfcConnFailed",
  "connection-expired": "tfcConnExpired",
  "no-tfc-account": "tfcNoAccount",
  "account-blocked": "tfcBlocked",
  "reference-mismatch": "tfcRefMismatch",
  "provider-unavailable": "tfcProviderUnavailable",
};

/** Map one HMRC error onto a designed failure screen (pure). */
export function tfcFailureForCode(code: string | undefined, status: number): TfcFailure {
  if (code && TFC_CODE_FAILURES[code]) return TFC_CODE_FAILURES[code];
  // A 401/403 from the gateway is the token, not the request: the same state the spec calls "connection expired".
  if (status === 401 || status === 403) return "connection-expired";
  return "connection-failed";
}
