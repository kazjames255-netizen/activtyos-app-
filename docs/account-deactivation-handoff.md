# Parent account deactivation (soft close) — backend handoff

Front-end built 2026-09-02 (`features/account/AccountApp.tsx` → `CloseAccount`).
Model chosen by Kaz: **self-service soft close**, not hard delete.

## What's built (front-end + a thin safe endpoint)

- **Danger zone** on the parent My-account page. Pre-checks (client, UX only):
  outstanding balance from `/api/my/bookings`, active memberships from
  `/api/my/memberships?tenantId=` per provider, wallet credit from `/api/my/wallet`.
- **Outstanding is a hard gate** — the Close button is disabled while > £0, with a
  link to My bookings.
- On confirm: the client **cancels each active membership** (existing
  `POST /api/my/memberships/cancel`), then calls `POST /api/account/deactivate`,
  then signs out.
- **`POST /api/account/deactivate`** (built, `server/src/routes/account.ts`):
  re-checks outstanding **server-side** (rejects with 409 + `{outstanding, count}`
  if unpaid — never trust the client gate), then sets on the user doc:
  `deactivatedAt`, `deactivationReason`, `marketingConsent:false`. Returns `{ok:true}`.

## STILL OWED (Amir)

1. **Actually block login.** Setting `deactivatedAt` does nothing on its own.
   `admin.auth().updateUser(uid, { disabled: true })` (Firebase Admin) on deactivate,
   and clear it on reactivation.
2. **Reactivation on sign-in within 30 days.** When a deactivated user signs in
   inside the grace window, clear `disabled` + `deactivatedAt` and let them back in
   (restore marketing only if they opt in again — don't silently re-subscribe).
   After 30 days, keep login closed; reopening requires contacting the provider.
3. **Wallet credit policy.** The UI warns credit is forfeited on close. Decide +
   enforce: forfeit, or auto-request a provider refund. Today nothing happens to
   the balance server-side.
4. **Record retention.** Deactivation must NOT delete the family's bookings,
   children (safeguarding), or payment history — providers are legally required to
   retain these (safeguarding: years; finance: ~6 yrs HMRC). Define the retention
   window + eventual purge job.
5. **Notify the provider(s).** Bell/email each provider the family had bookings
   with that the account closed (so they can update registers / follow up).
6. **Hide/annotate the closed family** in the operator Families list (e.g. a
   "Closed account" badge) rather than showing them as active.
7. **Membership cancellation robustness.** The client cancels memberships before
   deactivating; if that partially fails the account can still close with an active
   membership. Consider cancelling server-side inside `/deactivate` as a backstop
   (reuse the cancel logic incl. `deactivateMembershipCode` for percent tiers).

## Notes
- Same split as the rest: client gating is UX; the server is the source of truth
  for money and auth. Outstanding is already re-checked server-side; the login
  disable + reactivation are the missing enforcement.
- Ties to [[customer-wallet]] (§Z wallet backend) and the memberships handoff.
