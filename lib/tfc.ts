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
  | "connection-expired";  // the token has aged out — re-authorise
