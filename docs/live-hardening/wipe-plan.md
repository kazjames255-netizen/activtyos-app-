# Portal wipe plan (everything except HQ)

Status: PLAN ONLY. Nothing in this document has been executed. The companion script `scripts/wipe-portals-dryrun.mjs` is strictly read-only (no write calls; its selftest proves the fixture throws on any write method). The real wipe script does not exist yet and must not be written or run until the go/no-go checklist below is fully ticked and Kaz has said go in writing.

Why this is dangerous: web (Vercel), API (Railway), the dev stack and the e2e suite all share ONE Firebase project, so "wipe the portals" is a wipe of the live database. The existing `server/src/e2eCleanup.ts` already contains a tenant-scoped collection list and recursive-delete pattern, but it is hard-limited to `@activityos-test.com` accounts; a full wipe must not reuse it unmodified.

## What is kept

Protected by the dry run (and required to be protected by any real wipe):

- Every Auth user whose `users/{uid}.role` is `platform` (the HQ portal; see `server/src/middleware/role.ts`, which also gates them behind email 2FA). Their `users` docs are never deleted.
- Explicit allow-list: Kaz's own real accounts, passed as `--keep-email` or `--keep-file`. Nothing is guessed; any non-e2e, non-platform account not on the list is reported as "unprotected" so it can be reviewed by name.
- Tenants owned by, or assigned to, a kept user (`tenants.ownerUid`, `users.tenantId`), with all their tenant-scoped data. This matters because the Learning Hub curriculum (4,679 questions, see `docs/learning-hub.md`) lives inside the two owner tenants, so keeping those tenants keeps the curriculum.
- The e2e accounts (`@activityos-test.com`, manifest in `e2e/.auth/accounts.json`, helpers in `e2e/helpers/env.ts`) are NOT protected by default; `--keep-e2e` protects them and their tenants. NEEDS DECISION: Kaz keeps them or lets the suite re-provision them (it does so on the next run).
- Non-tenant collections classified KEEP: `leads` (71k sales docs, one count only), `platform`, `platformConfig`, `ventureLakes`, `pageViews`, `opsHeartbeat`, `incidentsOps`, `schedulerLocks` (live scheduler leader locks; deleting can double-fire sweeps), `stripeEvents` (webhook idempotency, see `server/src/routes/stripeWebhook.ts`; deleting lets old Stripe events be re-processed), `impersonationLog` (HQ security audit).
- Storage: `hubSlides/<tenantId>/...` folders of kept tenants.

## What would be deleted

Classification comes from reading `server/src` (about 150 collection names) and `server/src/e2eCleanup.ts`; the script's CATALOG is the machine-readable version and it flags any root collection it does not know as UNCLASSIFIED rather than guessing.

DELETE (tenant data, removed with its tenant, by `tenantId`): bookings, blocks, listings, customers, children and childFiles (also keyed by `parentUid` / `ownerUid` because parents have no tenant; childFiles has a `chunks` subcollection so it needs a recursive delete), threads, messages, posts, moments, registers, rota and shifts, trips, tasks, meal data, discount codes and redemptions, invites, notifications, calendar events, documents, images, inventory, the whole Learning Hub family (`hub*`), emailMessages, scheduledEmails, milestones, accounting connections, plus `users`, `tenants`, `libraries` (doc id = tenant id or `tenantId__fr__franchiseId`, see `server/src/lib/tenantLibrary.ts`; the script's kept count there is a lower bound) and the non-kept Firebase Auth users.

DECIDE (legal or shared, do not delete until decided): `payments`, `invoices`, `expenses`, `expenseClaims`, `income`, `tfcPayments`, `tfcLinks`, payroll (`payrollRuns`, `payrollConfig`, `payrollYtd`, `payrollAuditLog`, `payslipPdfs`), time clock (`clockRecords`, `clockAuditLog`), `subscriptionEvents`, safeguarding and H&S records (`incidents`, `medications`, `medicationAdmin`, `credentialRecords`, `onboardRecords`, `incidentDeletionAudit`), `deletionRequests`, `emailSuppressions` (unsubscribe and bounce list), and HQ support history (`supportThreads` keyed by `providerId`, `supportMessages`).

LEGAL FLAG: payroll and tax records (payslips, YTD, PAYE-related runs, expenses, invoices, payments) must be retained by law for UK employers and businesses (generally 6 years; payroll and RTI longer for some items). If ANY real customer has run payroll or taken payments on the live system, deleting those records may be unlawful and certainly destroys the customer's own statutory evidence. The audit trail in `server/src/lib/payrollAudit.ts` (`payrollAuditLog`) is append-only by design and is the last thing that should ever go. If only test data exists, say so in writing before proceeding.

Scheduled and cached state to account for: queued `scheduledEmails`, `schedulerFired` markers, `mailboxSummary` and `payslipPdfs` caches, hub digest queue and log. Outside Firestore: Stripe connected accounts, subscriptions and payment links; Xero and QuickBooks connections (`server/src/lib/accounting.ts`); the mail provider's suppression list; Firebase Auth sessions.

Numbers: the live dry run has NOT been executed yet (the automated run was blocked by the permission classifier as a production read; Kaz needs to run it or approve it). Run it once, after review, with the allow-list, and paste its report here:

`node scripts/wipe-portals-dryrun.mjs --live --out <scratch>/wipe-dryrun.json --keep-email <kaz@...> [--keep-file keep.txt] [--keep-e2e]`

## Order of deletion

Only after every box below is ticked, and first on a rehearsal copy. A real wipe script must itself default to dry-run and require an explicit `--execute` plus the project id typed back.

1. Freeze: put the API in maintenance (or stop the scheduler in `server/src/lib/scheduler.ts`) so no sweep sends email or charges while deleting. Do not delete `schedulerLocks`.
2. Fresh Firestore export and Auth export (see checklist). Verify the export exists and is non-empty.
3. Cancel external obligations first: Stripe subscriptions and open payment links per tenant, accounting disconnects, queued `scheduledEmails` (cancel, do not send).
4. Copy out anything retained (emailSuppressions, payroll and tax records, support history) into an archive collection or bucket owned by HQ.
5. Delete leaf data per non-kept tenant, children before parents: hub and tenant-scoped collections by `tenantId` (`recursiveDelete` where subcollections exist), then user-owned docs by `parentUid` / `ownerUid` / `referrerUid`, email-keyed docs (`notificationPrefs`, wallet), then Storage `hubSlides/<tenant>/`.
6. Delete `libraries` docs, then `tenants` docs for non-kept tenants.
7. Delete `users` docs for non-kept users, then the Auth users last (so a failure leaves accounts that still map to data, not orphaned data). Never delete any uid in the protected set; re-verify the protected set immediately before this step.
8. Re-run the dry run: every DELETE collection must show zero non-kept docs; KEEP counts (notably `leads`) must be unchanged.
9. Smoke: HQ login (2FA), `scripts/check-live.mjs`, one fresh signup.

## Cost

- The dry run reads documents only for the small protected set: at most 2,000 document reads per run, enforced in code by the Meter in `scripts/wipe-portals-dryrun.mjs` (the `--cap` flag can only lower it). Expected use is well under 100 (platform users, kept users, kept tenants).
- Everything else is a `count()` aggregation, billed about 1 read per 1,000 index entries, capped at 1,500 count queries per run (roughly 150 collections, each counted once plus once per chunk of 10 kept tenants). The `leads` collection (71k docs) gets exactly ONE plain count (about 71 billed units); the Meter throws on a second count, a filter, or any document read of `leads`.
- Auth listing is not a Firestore read (capped at 20,000 users); Storage listing is capped at 1,000 objects.
- For context, `docs/firestore-cost.md` records the earlier GBP 100 bill caused by full reads; this job must not repeat it. The script refuses a second live run (marker file) unless `--rerun` is passed.
- The real wipe will cost more: every document deleted is a billed delete (small per document) and the queries used to find them are billed reads. Estimate from the dry-run totals before executing; the Firestore export is also billed per document read.

## Go/no-go checklist

All must be YES before anything is deleted.

- [ ] Kaz's explicit written go (message or email quoted in this file), naming the allow-list and stating the wipe is of the LIVE project.
- [ ] Fresh backup first: `gcloud firestore export gs://<backup-bucket>/pre-wipe-$(date +%F) --project <project-id>` plus an Auth export (`firebase auth:export pre-wipe-auth.json --project <project-id>`); confirm the files exist, and do a test restore into a scratch project. Keep for the legal retention period.
- [ ] Rehearsal on a copy: import that export into a separate throwaway Firebase project (`gcloud firestore import`), point a copy of the script at it, run the real wipe there, then re-run the dry run and the smoke tests. Never rehearse against the live project.
- [ ] Legal retention decided in writing: payroll, payslips, YTD, tax, invoices, payments and expense records (UK statutory retention, typically 6 years) are either confirmed to be test-only or archived to a retained, access-controlled location. Flag: this is the collections marked DECIDE above and the append-only `payrollAuditLog`.
- [ ] Audit logs retention: `payrollAuditLog`, `clockAuditLog`, `incidentDeletionAudit`, `impersonationLog` either kept or archived; decision recorded.
- [ ] Email suppression lists and unsubscribe records (`emailSuppressions`, see `server/src/lib/emailSync.ts`, PECR) copied to an HQ-owned list BEFORE deletion so opted-out people are never emailed again; the mail provider's own suppression list left untouched.
- [ ] Stripe: connected accounts and live payment records must NOT be orphaned. Deleting our docs does not delete Stripe objects: live subscriptions would keep billing with no tenant to serve, refunds and disputes would have nothing to reconcile against, and payment records Stripe holds are needed for tax. Before deleting a tenant: cancel or transfer its subscription, refund or settle open payment links, disconnect (do not delete) connected accounts unless the operator agrees, and export its Stripe payment ids. Check `server/src/routes/stripeWebhook.ts` and `server/src/lib/settlePayment.ts` so later webhooks for deleted tenants do not error or recreate data. Test mode versus live mode must be confirmed per key.
- [ ] Protected set printed by the dry run matches Kaz's list exactly (HQ accounts, real accounts, the decision on e2e accounts), with no unclassified collections remaining.
- [ ] GDPR/erasure: any `deletionRequests` honoured or preserved as required; real customers (if any) told before their data disappears.
- [ ] Rollback: the export from step 2 is the rollback (`gcloud firestore import` into the live project restores documents; Auth users restore with `firebase auth:import`, which keeps uids but not sessions). Decide beforehand the maximum time window in which a restore is acceptable, and that restore rehearsal succeeded. Deleted Stripe cancellations are NOT reversible by restore.
- [ ] Maintenance window and scheduler freeze arranged; the dev servers are not stopped (warn first).
- [ ] The real wipe script defaults to dry-run, requires `--execute` and the project id typed back, refuses uids in the protected set, and has its own selftest with a write-capable fixture that proves protected accounts survive.
