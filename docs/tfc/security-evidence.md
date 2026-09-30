# ActivityOS security and data-handling evidence (Tax-Free Childcare Payments API)

Prepared 30 September 2026 from the repository on branch `teaching-hub-redesign`, describing the committed code including the Tax-Free Childcare audit fixes (commit 103c7fd4); the Stripe platform-fallback guard is in `server/src/lib/stripe.ts`. Purpose: to help answer HMRC's supplier assurance questionnaire for the Tax-Free Childcare Payments API. Every statement below points to the file that proves it. Where something cannot be proven from the repository it is marked **To be confirmed by Kaz/Amir** rather than claimed. Nothing here is a certification: the repository contains no evidence of ISO 27001, PCI DSS attestation, Cyber Essentials or a penetration test, so none is claimed.

## Summary

- ActivityOS is a multi-tenant web platform for children's activity providers. The web app is Next.js; the API is Express on Node with Firebase (Auth and Firestore) behind it (`AGENTS.md`, `server/src/index.ts`).
- Every API request except a short, rate-limited list of public endpoints needs a verified Firebase sign-in token, and the account's role and tenant are read from the server's own records, never from the request (`server/src/middleware/auth.ts`, `server/src/middleware/role.ts`).
- The browser never talks to Firestore. All authorisation is on the server (`AGENTS.md`).
- Employee National Insurance numbers and onboarding bank details are encrypted at rest with AES-256-GCM (`server/src/lib/fieldCrypto.ts`, `server/src/routes/payroll.ts`, `server/src/routes/onboarding.ts`).
- Card payments are direct charges on each provider's own Stripe Express account. Funds do not pass through an ActivityOS account (`server/src/routes/payments.ts`).
- The HMRC client logs only a correlation id and HMRC's error code, never a token, authorisation code or client secret (`server/src/lib/tfc.ts`).
- Main open weaknesses, all listed in full under Known gaps: the HMRC Tax-Free Childcare access and refresh tokens, and the Sage/Xero/QuickBooks tokens, are stored unencrypted in Firestore (server-only); ID scans are held as Firestore chunks; the payroll audit log cannot be read through the product and is immutable by convention only; no Firestore security rules file is in the repository.

## Data we hold

Collections are named as they appear in code. Personal data is held in Google Firestore (`server/src/firebase.ts`).

| Data | Where | Who can read it | Evidence |
| --- | --- | --- | --- |
| Parent and child records (names, date of birth, TFC reference, medical and SEND notes) | `children`, `bookings`, `customers` | The parent; the provider the child is booked with; franchise staff only for their own franchise | `server/src/routes/children.ts`, `server/src/lib/childAccess.ts`, `server/src/lib/franchiseScope.ts` |
| Parent SEND/EHCP documents | `childFiles` (chunked) | The uploading parent, and a provider the child has since been booked with | `server/src/routes/childFiles.ts` |
| Staff payroll configuration and runs, including NI numbers (encrypted) | `payrollConfig`, `payrollRuns` | Managers and owners; narrowed to a named payroll-admin list when a tenant sets one | `server/src/routes/payroll.ts` |
| Staff onboarding record: DBS, right to work, ID and address proof, bank details and NI (encrypted), scans | `onboardRecords`, `onboardFiles` | A manager of that tenant, or the person the record belongs to | `server/src/routes/onboarding.ts` |
| Tax-Free Childcare link state and payment attempts | `tfcLinks`, `tfcLinkStates`, `tfcPayments` | Server only; parents reach their own rows through the parent routes | `server/src/routes/tfc.ts` |
| Accounting connections (Sage, Xero, QuickBooks) | `accountingConnections` | Server only, never returned to the browser | `server/src/routes/accounting.ts` |
| Card payment records | `payments` (Stripe ids and amounts; no card numbers) | The provider's managers | `server/src/routes/payments.ts` |

What we do not hold: full card numbers (Stripe collects them, see Payments and funds flow), and staff bank details are not copied into the payroll audit log (`server/src/routes/payroll.ts`, comment above `diffEmployees`).

Retention: staff onboarding records and their scans are purged six years after a person leaves, by a daily job (`server/src/lib/sweeps.ts`, `ONBOARDING_RETENTION_YEARS`). A parent's own deletion request is recorded for action by the provider and platform rather than wiped automatically, because safeguarding records may need to be kept (`server/src/routes/privacy.ts`). Retention for Tax-Free Childcare data specifically is **not yet defined in code**, see Known gaps.

## Encryption

In transit: the web app (Vercel) and API (Railway) are served by those hosts' HTTPS endpoints, and the API trusts exactly one proxy hop so client addresses are real (`server/src/index.ts`). TLS termination itself happens at the hosts, not in this repository. **To be confirmed by Kaz/Amir:** HTTPS-only enforcement and minimum TLS version on the live domains.

At rest, field level: employee NI numbers, onboarding bank details, NI and pay rate are encrypted before storage with AES-256-GCM, a fresh random 12-byte IV per value and a 16-byte authentication tag, so tampering is detected on decrypt (`server/src/lib/fieldCrypto.ts`, lines 42-69). Used at `server/src/routes/payroll.ts` (NI stored only as `niNumberEnc`) and `server/src/routes/onboarding.ts` (`ENCRYPTED_VALUE_IDS`). The NI number is never returned in lists, only by an explicit, audited, rate-limited reveal call.

Key handling: the key comes from `FIELD_ENCRYPTION_SECRET`; if that is missing it is derived from the service-account material; in production with neither, the server refuses to start rather than encrypt under a key that would not survive a restart (`server/src/lib/fieldCrypto.ts`, lines 21-39). There is no key-rotation tool in the repository. `FIELD_ENCRYPTION_SECRET` is not listed in `server/.env.example`. **To be confirmed by Kaz/Amir:** that it is set explicitly in the live API environment.

At rest, database level: Firestore is encrypted at rest by Google by default. That is a property of the Google service and is not evidenced by this repository.

Signed links: private image links and unsubscribe links are HMAC-SHA256 signed and compared in constant time; image links expire after six hours (`server/src/lib/signing.ts`, lines 40-76).

Passwords and sign-in are handled by Firebase Auth; the API verifies the Firebase ID token on each request (`server/src/middleware/auth.ts`, lines 34-56). We do not store passwords.

## Access control

- Authentication: a bearer token is required and verified by Firebase. A token issued before an account's sessions were revoked (password change, "sign out everywhere", deactivation) is refused (`server/src/middleware/auth.ts`, lines 11-41; revoke on deactivate in `server/src/routes/invites.ts`).
- Roles: platform, company, freelancer, franchise, staff, parent. The role and tenant are read from the user's Firestore record on every request, not trusted from the client. Deactivated or closed accounts get nothing (`server/src/middleware/role.ts`, lines 89-112).
- Per-area permissions for staff ("Roles and permissions") and feature switches are enforced on the server, not just hidden in the menu (`server/src/middleware/access.ts`).
- Payroll: only owner-tier roles, and when a tenant names payroll administrators only those people, for payroll, payslips, and accounting posts (`server/src/routes/payroll.ts`, lines 84-110). NI reveal is limited to 30 per minute per user and approval to 30 per minute; all payroll calls to 600 per minute per user (`server/src/routes/payroll.ts`, lines 28-34, `server/src/lib/rateLimit.ts`).
- Tax-Free Childcare routes are parent-only and resolve the child from the caller's own children (`children.parentUid` must equal the caller). A child id from the browser is never trusted alone, and someone else's child answers as "not found" (`server/src/routes/tfc.ts`, functions `myChild` and `myLink`).
- Platform (HQ) super-admin accounts need an email one-time code, stored only as a salted hash, valid 10 minutes, with attempt limits; verification is good for 12 hours (`server/src/routes/twoFa.ts`, `server/src/middleware/role.ts`, lines 113-127).
- Public endpoints (directory, demo form, invite preview, unsubscribe, pay page) are rate limited per client address. The limiter is in memory and per process (`server/src/lib/rateLimit.ts`, `server/src/index.ts`).
- Platform impersonation ("open account") is only allowed for genuine platform accounts and every change made while impersonating is logged (`server/src/middleware/role.ts`, lines 144-170).
- API documentation pages are not served in production unless explicitly enabled (`server/src/index.ts`).
- Request bodies are limited to 2 MB (`server/src/index.ts`). Input is validated with `zod` schemas (for example `server/src/routes/tfc.ts`, `paySchema`).

## Tenant isolation

- Every operator API derives scope from the signed-in account; there is no tenant parameter a caller can change. The bookings route states the rule and applies it (`server/src/routes/bookings.ts`, lines 50-58). Booking document ids include the tenant id (`server/src/routes/bookings.ts`, `bookingDocId`).
- Franchise accounts and their staff are narrowed to their own franchise: their own listings, children, families and records, never head office's or a sibling franchise's (`server/src/lib/franchiseScope.ts`).
- Staff can be limited to assigned sites (`server/src/lib/siteScope.ts`). Children's files and safeguarding access follow the rules in `server/src/lib/childAccess.ts`.
- Automated proof: `server/src/isolationTest.mts` (provider A cannot load provider B's data), `e2e/franchise-isolation.spec.ts` (a franchise cannot read or write head office's or another franchise's records through the API, and its screens never show them) and `e2e/comms-scoping.spec.ts` (a franchise cannot message head office's families).
- Known limit: the decision "which records belong to which tenant" is made in application code on each query. There is no second layer such as Firestore security rules in this repository (see Known gaps).

## Audit logging

- Payroll: one record per action in `payrollAuditLog`, holding tenant, actor, role, action, timestamp and before/after detail. Covers viewing and editing employees, NI reveal, creating, approving and publishing runs, settings, payslip view and email, onboarding sensitive data, and accounting connect, mapping and posting. NI numbers are never written into it (`server/src/lib/payrollAudit.ts`, lines 11-36; calls throughout `server/src/routes/payroll.ts`).
- Safeguarding: deleting a record with a designated-safeguarding-lead decision writes an audit entry first, and the delete fails if the entry cannot be written (`server/src/lib/incidentDeletionAudit.ts`).
- HQ impersonation: opening an account, and every change made as that account, is recorded in `impersonationLog` (`server/src/middleware/role.ts`, `server/src/routes/platform.ts`).
- Tax-Free Childcare: every payment attempt to HMRC, successful or not, is stored in `tfcPayments` with parent, child, reference, amount, result and HMRC error code (`server/src/routes/tfc.ts`, the `paymentsCol.add` call in the pay route). HMRC failures log a correlation id and code only (`server/src/lib/tfc.ts`).
- Limits: payroll audit writes are fire-and-forget, so a failed write is logged but does not stop the action. There is no screen or API to read the payroll audit log, and it is not protected from edit or delete by anything stronger than there being no route that does it. The Tax-Free Childcare token use is not audited per use. See Known gaps.

## Payments and funds flow

- Card payments are Stripe direct charges created on the provider's own Stripe Express connected account (`server/src/routes/payments.ts`, `paymentIntents.create` with the provider's `stripeAccount` option, lines 322-352). The money lands in the provider's Stripe balance and payouts go to the provider's own bank account.
- Funds do not enter an ActivityOS-owned account, and no application fee or platform transfer is set on these charges (no `application_fee` or `transfer_data` appears in `server/src/routes/payments.ts` or `server/src/lib/stripe.ts`).
- A provider that has not finished Stripe onboarding cannot take card payments: the API answers "can't take card payments yet" (`server/src/routes/payments.ts`, lines 335-338). The only exception is a development flag, `STRIPE_PLATFORM_FALLBACK`, that routes such payments to the platform account for testing. It must stay unset in production; the code comment says so (`server/src/lib/stripe.ts`, comment above `platformFallback`) and it is commented out in `server/.env.example`. An uncommitted change in `server/src/lib/stripe.ts` adds a guard that forces the flag off whenever `NODE_ENV` is production and logs an error; until that is committed and deployed the flag is only a convention. **To be confirmed by Kaz/Amir:** it is not set on the live Railway environment.
- Express accounts are created with card_payments and transfers capabilities requested (`server/src/routes/payments.ts`, lines 83-99). A franchise cannot open or change its head office's Stripe account (same file, lines 70-75).
- Card details are not handled by our API code: it creates the Stripe payment intent and returns its client secret, and no card fields are read or stored anywhere in `server/src/routes/payments.ts`. The browser-side card form was not reviewed for this document. Stripe webhooks are accepted only with a valid signature, verified against the raw body (`server/src/routes/stripeWebhook.ts`, lines 41-56). Settlement of a payment is claimed once, so a repeated webhook cannot double-apply (`server/src/lib/settlePayment.ts`).
- Subscription billing for providers' ActivityOS plans is separate (Stripe Billing, `server/src/lib/billing.ts`).
- Tax-Free Childcare: ActivityOS asks HMRC to pay the provider on behalf of a parent. HMRC moves the money from the parent's Tax-Free Childcare account to the provider's registered childcare account; ActivityOS does not receive or hold those funds. The provider is identified to HMRC by its own registered childcare reference and postcode from its Setup, not by ActivityOS (`server/src/routes/tfc.ts`, `providerIdentity`; `server/src/lib/tfc.ts`). Amounts are sent in whole pence (`server/src/lib/tfc.ts`, `toPence`). If HMRC credentials are not configured the integration answers "not connected" and the parent uses the manual reference path (`server/src/lib/tfc.ts`, `tfcConfig`).
- HMRC OAuth: the parent signs in at GOV.UK. The link uses a 32-byte random single-use state value valid for 15 minutes, tied to that parent and child, before any token is stored (`server/src/routes/tfc.ts`, the link start route and the `tfcCallback` route). The client reads credentials from environment variables, never from the repository (`server/src/lib/tfc.ts`, `tfcConfig`; names only in `server/.env.example`). It refreshes tokens a minute before expiry and retries once on rejection (`server/src/lib/tfc.ts`, `withFreshTokens`).
- The HMRC client's own rule, stated in the file header, is that it never logs a token, authorisation code or client secret, and every documented failure returns a designed failure state instead of throwing (`server/src/lib/tfc.ts`, header comment). The log calls in that file carry only the operation name, HTTP status, HMRC error code and correlation id.

## Hosting and secrets

What the repository proves:

- Web app: Next.js, deployed on Vercel (comments in `Dockerfile` and `nixpacks.toml`; `next.config.ts`).
- API: a Node 22 container built from `Dockerfile`, run on Railway with `NODE_ENV=production` (`Dockerfile`, `nixpacks.toml`, `server/src/index.ts` comments on Railway proxy hops).
- Data: Google Firebase Auth and Firestore via the Firebase Admin SDK using a service account (`server/src/firebase.ts`). Index definitions are in `firestore.indexes.json` and `firebase.json`.
- Secrets are read from environment variables (Stripe, HMRC, signing, field encryption, webhook secrets); `server/.env`, all `.env*` files and `server/serviceAccountKey.json` are git-ignored (`.gitignore`). `server/.env.example` and `.env.local.example` list variable names with no values.
- Email uses a mail provider configured by environment (`server/src/lib/mailer.ts`).
- Internal diagnostic routes are disabled unless a key is set and compared in constant time (`server/src/index.ts`, `/internal/read-stats`, `/internal/hub-cache/forget`).

To be confirmed by Kaz/Amir (not provable from the repository):

- Hosting regions for Vercel, Railway and the Firestore database (UK or EU data residency).
- Who holds access to the Vercel, Railway, Firebase, Google Cloud and Stripe consoles, and whether multi-factor authentication is enforced on each.
- Backup and point-in-time recovery settings for Firestore, and any tested restore.
- Where production secrets are stored and who can read them, and the rotation process.
- Dependency and vulnerability scanning, and whether any third-party penetration test has been done.
- Incident response contact and breach-notification process.
- Contracts and data-processing terms with each sub-processor (Google, Vercel, Railway, Stripe, the mail provider).

## Testing evidence

Automated end-to-end and API suites (Playwright, run against the live dev stack with throwaway test accounts; see `AGENTS.md`):

- `e2e/payroll-security.spec.ts`: 12 tests. Unauthenticated calls to every payroll, payslip and accounting endpoint are refused; staff, franchise staff, parents and platform accounts are refused on manager endpoints; NI stored only as ciphertext and masked in every read; money validation; approval segregation and double-approve races; staff see only their own published payslip; the payroll-admin allow-list; onboarding bank and NI redaction; accounting responses never expose tokens; every payroll mutation and sensitive read is audited and never contains an NI number; per-user rate limit on the NI reveal.
- `e2e/franchise-isolation.spec.ts`: a franchise cannot read or write head office's or another franchise's records, through the API or the screens.
- `e2e/comms-scoping.spec.ts`: messaging and alert scoping across franchises and support threads.
- `server/src/isolationTest.mts`: provider A cannot load provider B's data (run against the Firebase emulators).
- Recorded results: `lib/testing/agent-results/plan3-payroll-security.json` (19 recorded items: 7 pass, 6 fixed during testing, 6 left open, the open ones are reproduced under Known gaps), plus `lib/testing/agent-results/plan3-payroll-flow.json` and `lib/testing/agent-results/plan3-payroll-accounting.json`. These records were produced by ActivityOS's own automated testing agents; they are internal evidence, not independent assurance.
- Tax-Free Childcare: seed data for a demo exists (`server/src/seedTfcDemo.ts`) and the design notes are in `docs/tfc-build-spec.md`. No end-to-end spec in `e2e/` exercises the live HMRC sandbox flow, and **HMRC sandbox test evidence is to be confirmed by Kaz/Amir**.
- No independent penetration test, vulnerability scan or external audit is recorded in the repository.

## Known gaps

Stated plainly so they can be disclosed or fixed before go-live. Each was checked against the code on 30 September 2026.

1. **HMRC Tax-Free Childcare tokens are stored unencrypted.** The access and refresh token for each linked child sit in plaintext in `tfcLinks` in Firestore. The file's own comment says this must be fixed (envelope encryption with a key management service, deletion on unlink and account closure with revocation at HMRC, and an audit line per use) before real HMRC credentials are used (`server/src/routes/tfc.ts`, the "TOKEN STORAGE: WHAT IS STILL OWED" header comment and `saveTokens`). Only the server reads the collection and the browser never does, but a leaked database export would contain live tokens. The existing field encryption in `server/src/lib/fieldCrypto.ts` is not applied to them. Since this document was first drafted, optional AES-256-GCM sealing of these tokens has been committed in `server/src/lib/tfc.ts` (commit 103c7fd4), but it only takes effect when a separate `HMRC_TFC_TOKEN_KEY` is set and otherwise stores plaintext; it does not yet add deletion on unlink or a per-use audit line. Re-check this item once the key is set in production. **This should be closed before go-live.**
2. **No unlink or delete of TFC data.** Nothing outside `server/src/routes/tfc.ts` references `tfcLinks`, `tfcPayments` or `tfcLinkStates`, so account closure and the privacy routes (`server/src/routes/privacy.ts`) do not remove them, and no retention period is defined for them.
3. **Payment request trusts browser values.** The Tax-Free Childcare pay call takes the amount and the provider's tenant id from the request body (capped at 10,000 and validated as a number), rather than deriving them from a server-side booking (`server/src/routes/tfc.ts`, `paySchema` and the pay route). The parent can only pay from their own linked account, to a provider whose registration details exist, and HMRC checks the account, but the amount is not tied to an order on the server.
4. **Accounting OAuth tokens stored in plaintext.** Sage, Xero and QuickBooks access and refresh tokens are kept unencrypted in `accountingConnections` in Firestore. They are server-only and never returned to the browser (`server/src/routes/accounting.ts`, lines 169, 480-505; recorded as open-1 in `lib/testing/agent-results/plan3-payroll-security.json`).
5. **People are linked to some records by name.** Payroll and onboarding records are matched to a person by name in places. Ambiguity now fails closed (duplicates see nothing; `e2e/payroll-security.spec.ts`), but a user-id key would be the real fix (`server/src/routes/onboarding.ts`, comment near line 105; open-6 in the results file). The Tax-Free Childcare route can also look a child up by name, but only within the caller's own children (`server/src/routes/tfc.ts`, `myChild`).
6. **Payroll audit log has no read access, and immutability is by convention.** It is written but there is no endpoint or screen to read it, so evidence currently needs direct database access. Nothing stops an edit or delete other than the absence of a route, and there are no Firestore rules in the repository (`server/src/lib/payrollAudit.ts`; open-5 in the results file). Writes are also best-effort.
7. **Payslip emails include an open-tracking pixel.** Payslip emails are sent through the general email sender, which appends a 1x1 tracking image that records who opened the message (`server/src/lib/emailSend.ts`, lines 41-42 and 183; `server/src/routes/payslips.ts`, line 194). The payslip body holds name and period, no amounts, but the send is also visible in email history to anyone with Email access (open-3 in the results file).
8. **ID, DBS and address-proof scans are stored as Firestore chunks**, not in object storage, and are not field-encrypted (access is restricted to the manager or the person; Firestore encrypts at rest by default). The same is true of parents' SEND/EHCP documents (`server/src/routes/onboarding.ts`, header comment; `server/src/routes/childFiles.ts`, header comment).
9. **No Firestore security rules file in the repository.** Isolation relies on all access going through the API using the admin SDK (`firebase.json` declares indexes only). If a client SDK path were ever exposed, nothing in this repository would limit it. **To be confirmed by Kaz/Amir:** the rules deployed on the live Firebase project.
10. **No explicit HTTP security headers in application code.** Neither `next.config.ts` nor the API sets content security policy, frame or transport security headers. The hosts may add some. **To be confirmed by Kaz/Amir.**
11. **Rate limiting is per API process and in memory.** With more than one API instance each has its own counters (`server/src/lib/rateLimit.ts`, header comment).
12. **Field encryption key has no rotation path**, and `FIELD_ENCRYPTION_SECRET` is not documented in `server/.env.example` (`server/src/lib/fieldCrypto.ts`).
13. **Payroll maths partly runs in the browser.** Run lines are stored as computed by the manager's browser, with bounds checks but no server recalculation (`lib/testing/agent-results/plan3-payroll-flow.json`, pf-open-server-maths). This is a payroll integrity point, not a Tax-Free Childcare one.
14. **Franchise payroll seeding bug.** A franchise library copied from head office can inherit head office's payroll-admin list and lock the franchise owner out of its own payroll until edited (open-4, `lib/testing/agent-results/plan3-payroll-security.json`). This fails closed.
15. **No independent assurance.** No penetration test, external audit or recognised certification is evidenced.

## Questions HMRC typically asks

These map common questionnaire themes to the sections above. The wording of HMRC's actual questions should be checked against the questionnaire itself.

| Theme | Short answer | Where |
| --- | --- | --- |
| What personal data do you hold and why? | Parent, child, staff and payment reference data needed to run bookings; listed per collection | Data we hold |
| Is data encrypted in transit and at rest? | Transit via host TLS (to be confirmed); sensitive staff fields AES-256-GCM; Google encrypts Firestore at rest; TFC tokens are not yet field-encrypted | Encryption, Known gaps |
| Who can access it and how is that controlled? | Verified sign-in, server-side roles and permissions, payroll-admin list, email 2FA for super-admin | Access control |
| How is one customer's data kept from another's? | Scope derived from the account on every request; franchise narrowing; isolation tests | Tenant isolation |
| Are actions logged and can logs be reviewed? | Payroll, safeguarding deletion, impersonation and TFC payment attempts are logged; payroll log has no read screen | Audit logging, Known gaps |
| Do you handle our funds? | No. Card payments are direct charges to each provider; TFC money moves between HMRC and the provider | Payments and funds flow |
| Where is it hosted and who are your sub-processors? | Vercel, Railway, Google Firebase, Stripe; regions and contracts to be confirmed | Hosting and secrets |
| How are credentials and tokens protected? | Environment variables, never in the repository or logs; TFC client never logs tokens; storage of tokens is a known gap | Hosting and secrets, Known gaps |
| Have you tested your controls? | Automated isolation, payroll security and role tests; no independent penetration test | Testing evidence |
| What happens on a breach or when a customer leaves? | Incident process to be confirmed; parent deletion is a recorded request; staff records purged after six years | Hosting and secrets, Data we hold |
