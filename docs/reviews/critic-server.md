# Adversarial server review (last day's work)

Read-only review by code reading only. No live curl or tsx runs, no mail sent, no real tenant touched. Paths are relative to `server/src/`.
Not deeply reviewed: `lib/hubPlan.ts` internals (pure ranking logic), `worksheetQuiz.ts` LLM draft and load stages, `hubDigestEmail.ts` localisation strings.

Calibration: the tenant-isolation and IDOR surface is mostly sound. Every family read checks `tenantId`, `scopedChildren`, `published`, and homework assignment. The real problems are functional regressions, a default that widens child-visible content, cost, and a few hardening gaps.

## HIGH

### H1. Editing a shared-library lesson forks the note with a dangling worksheet pointer — CONFIRMED
- `routes/learningHub.ts:963` (fork path of `PUT /notes/:id`) does `{ ...before, ...patch, tenantId: ctx.tenantId }`, and `ref = notesCol.doc()` gives it a new id.
- It copies `worksheetFile` and `worksheetQuizId` from the shared original.
- The storage path is derived from `tenants/<tenantId>/oak-worksheets/<noteId>.pdf` (`lib/worksheetStorage.ts:8`). The forked note has a new tenant and a new id, so no object exists.
- `signWorksheet` (`worksheetStorage.ts:20`) never checks existence, and V4 signing succeeds for a missing object.
- `checkRefs` (`homeworkApi.ts:83`) only tests that `worksheetFile` is truthy.
- Scenario: a tutor tweaks any shared lesson that has a worksheet, then sets it as homework. The family taps the worksheet, `GET /notes/:id/worksheet` returns 200 with a URL, and the URL returns a storage "NoSuchKey" XML error.
- The forked note's `worksheetQuizId` also still points at the shared tenant's assessment.
- Fix: on fork, delete `worksheetFile` from the copy, or copy the object into the new path. Have `GET /worksheet` call `hasWorksheetObject` (one `exists()`) and return 404 when the object is missing.

### H2. The family lesson default flipped to "all published lessons" for every existing tenant — CONFIRMED (backwards-compat and privacy expectation)
- `lib/hubAccess.ts:17` returns `null` (no restriction) when `lessonAccess === "all"`. The default is `"all"` (`lib/hubConfig.ts:116`, `:156`).
- Before this change `familyAssignedNoteIds` was strictly homework-assigned (`git diff learningHub.ts`).
- Every tenant that never set the new field now exposes its whole published library to every enrolled family through `/notes`, `/notes/counts`, `/notes/:id` and the curriculum scope. This includes lessons for other year groups and provider-private lessons.
- Two more inconsistencies:
  - `curriculumApi.ts:197` (child tab) still uses assigned-only, while `scopeFor` (`:69-72`) now uses the rule.
  - `hubAccess.ts:16` reads config for `kids[0].franchiseId` only, so a multi-child family across franchises gets the first franchise's setting.
- Fix: default to `"assigned"` (the previous behaviour) when the field is absent, and make `"all"` an explicit opt-in. Resolve the config per child.

### H3. Digest sweep cost: it loads all attempts of every child, every 30 minutes for 7 hours every Sunday, even for tenants with the switch off — CONFIRMED
- `lib/hubDigestStore.ts:74-79` runs `hubAttempts where tenantId==, childId==` per active child, with no date bound. The 70-day filter is applied in memory, and `select()` still bills one read per document.
- `startDigestSweeps` (`:150-160`) runs every 30 minutes, and `digestDue` is true from 17:00 until midnight. That is about 14 full loads per Sunday. The sent-log stops duplicate mail but not the reads.
- `runTenant` calls `loadTenantData` before checking `cfgFor().parentDigest`. Tenants with the switch off (the default) pay for the full load and then skip.
- Scenario: 500 children with 300 attempts each is about 150k reads per run, so about 2M reads per Sunday per tenant, for zero emails.
- `processNudges` calls `store.sentKinds(capKey)` (a Firestore query) per (homework, child) before `nudgeDecision`. Each hourly sweep makes hundreds to thousands of queries that are not yet due.
- `POST /digest/run` and `GET /digest/preview` (`routes/hub/digestApi.ts`) run the same full load per request, with only the global rate limit.
- Fix:
  - Read the cfgs first and return early when no franchise has a switch on.
  - Add `where("submittedAt", ">=", cutoff)` with a composite index.
  - Run the digest once per week, or check the log for the whole tenant first.
  - Call `nudgeDecision` before `sentKinds`, or pre-load the log once per tenant.
  - Bound `hubHomework` by `dueAt >= cutoff` in the query.

## MEDIUM

### M1. Worksheets from the shared library silently disappear from homework, and their quiz cannot be started — CONFIRMED
- `homeworkApi.ts:83` accepts a shared-library note (`canReadContent`).
- `worksheetsOut` (`:163`) and `attempts.ts:226` require `n.tenantId === ctx.tenantId`, so shared notes are dropped from `worksheets[]` for tutor and parent.
- The `worksheetQuizId` link check fails, so `POST` attempts with `homeworkId` returns 404 "Homework not found".
- Meanwhile `GET /notes/:id/worksheet` works for the same note, so the UI surfaces disagree.
- Fix: use `canReadContent` in both, keeping the strict tenant check only for the homework doc.

### M2. A tutor can override a parent's unsubscribe — CONFIRMED (compliance)
- `DELETE /digest/opt-out/:childId` (`digestApi.ts:88-98`) sets `digest:true` or `nudge:true` for the parent's email, with no proof that the parent asked.
- Any tutor can therefore re-subscribe a parent who used the unsubscribe link, which breaks the opt-out contract (PECR / GDPR-style).
- Fix: remove the endpoint, or make it a parent-authenticated action, or require a fresh parent re-consent link.

### M3. Stored HTML injection in the tutor preview — CONFIRMED in code, exploitability PLAUSIBLE
- `digestApi.ts:68` interpolates `${name}` (`firstName(e.childName)`) into an HTML banner without `esc()`.
- A parent sets a child name of `<img/src=x/onerror=...>`. `firstName` splits on whitespace, so a payload without spaces survives. The tutor previews a child with nothing to report.
- The route returns `text/html`, and the UI does not call it yet (no client hits), so exposure depends on how the UI embeds it.
- Fix: `esc(name)`. Serve with `Content-Security-Policy: sandbox` or `default-src 'none'`.

### M4. The 2FA attempt counter is non-atomic — CONFIRMED in code; exploit cost HIGH (downgraded)
- `routes/twoFa.ts` reads `twoFaAttempts`, compares, then writes `attempts+1`. Parallel requests all read the same count.
- `/send` also has a check-then-set race on the resend cooldown (mail spam to the fixed inbox).
- The limit `rateLimit("2fa", 20)` is per IP, in memory and per instance, so a single IP gets about 20 guesses a minute against a 1M space. It is only exploitable from many IPs or after the limit is bypassed by scaling out. It still defeats the "5 attempts" claim.
- Also:
  - Verification is per user, not per session, so a Firebase token stolen after a verify passes for 12 hours (`middleware/role.ts:118`).
  - The hard-coded recipient `kazjames255@gmail.com` means that when `MAIL_LIVE` is not `1`, the code is never delivered (`delivered:false`) and platform users are locked out with no fallback.
- Fix: run verify in a Firestore transaction (increment before compare), do the same for `/send`, and bind the verification to a token `auth_time` or session id.

### M5. Non-atomic idempotent create for in-person and remote-sync sessions — CONFIRMED
- `inPersonApi.ts:148-156` and `remoteSyncApi.ts` (create) do `ref.get()` then `ref.set(doc)`. A double tap with the same `key` in parallel makes both requests see "absent", and the second `set` overwrites the first.
- That resets `attendance`, `step` and `liveAnswers` mid-lesson.
- Fix: use `ref.create(doc)` and fall back to the read on the already-exists error (code 6).

### M6. A partly failed in-person submit can never heal — PLAUSIBLE
- `inPersonApi.ts` `submit`: when `submissionsCol...update().catch(() => {})` fails, or the process dies before `refreshMastery`, the retry hits the fixed attempt id, returns "duplicate", and `continue`s.
- The homework stays "assigned", no mastery is recorded, the parent is not notified, and the digest and nudges can still nag about homework that was done.
- Fix: on the duplicate branch, re-run the idempotent homework hand-in and mastery refresh, or use one batch or transaction.

## LOW

- **L1. hubCache disk snapshot in `os.tmpdir()`** — CONFIRMED design, PLAUSIBLE impact (`lib/hubCache.ts:34-48`).
  - Predictable names (`aos-hub-cache.<kind>.<tenant>.json`) and a predictable temp name (`<file>.<pid>.tmp`). Files are written with the default mode (0644 under a normal umask), so any local user can read all of a tenant's notes, questions and cards. `writeFile` follows a symlink planted at the tmp name.
  - On a multi-user host an attacker can pre-create a snapshot that is then served. `diskRead` does no schema or tenant check.
  - Only `notes` has a version suffix (`.v2`). Other kinds serve an old-shape snapshot after a deploy, and access fields (`published`, `franchiseId`) can be stale for the first requests after a restart.
  - Fix: write with `{ mode: 0o600 }` into a `mkdtemp` private directory, embed and verify `{tenantId, version}` in the payload, and version all disk kinds.
- **L2. hubDigestPrefs is classed "holds no child data" but stores a parent's email** — `lib/hubPrivacy.ts` marks it `how:"none"`, so it is not erased with the parent account. Add it to the parent-erase and export paths.
- **L3. Digest and nudge sending gaps**
  - The claim happens before the send (at-most-once). A crash after claim loses that mail, and a timeout after a successful send followed by `release` can double-send.
  - There is no List-Unsubscribe or one-click header on the mail.
  - `apiBase()` and `webBase()` default to `localhost` when the env vars are missing, which would ship broken links in production.
  - If the server is down 17:00 to 24:00 Sunday the week is skipped.
- **L4. `childAssignedNoteIds` ignores `worksheetNoteIds`** (`lib/hubIndex.ts:258`), so worksheet-only homework does not unlock the lesson in "assigned" mode. It is cached for 30 seconds and never forgotten on homework writes, so assign and revoke lag by up to 30 seconds per instance.
- **L5. Remote-sync write amplification** — every 12-second heartbeat plus every live-answer does a Firestore write and a tenant-wide `pingHub`. That is about 2.5 writes per second for 30 children, and every tutor tab refetches.
- **L6. `GET /notes/:id/worksheet`** runs an unbounded `hubHomework array-contains` query per child. Bound it, or query by `noteIds` / `worksheetNoteIds` directly.
- **L7. Notes deleted but their storage object kept** (`DELETE /notes/:id` never removes `oak-worksheets/…`). The delete only drops attachments.
- **L8. The worksheet PDF still carries the source's own branding** while the owner rule bans it in child-visible text. The name field is clean but the PDF body is not.
- **L9. `aos.ca.learninghub` localStorage** (`lib/use-customer-area.ts`) is not per user. On a shared device, family B briefly sees "My Classroom" and `ViewGate` skips its check. The API stays authoritative, so it is cosmetic only.
- **L10. `firestoreLog.claim` swallows every error as "already sent"**, so a Firestore outage silently skips a week of sends with no log line.

## Areas checked and found OK
- Digest and preview IDOR: the tutor preview checks `canSeeStudent` and the tenant. The unsubscribe token is HMAC-signed (tenant, email, scope). GET only shows a confirm button and POST performs the opt-out. Values are escaped, and it is mounted before auth with a rate limit.
- Worksheet route: the path comes from the note's own tenant and id, `okId` validates the id, the URL lasts 15 minutes and the family must have the note in the homework of their own child. 404 is used consistently.
- Family lesson visibility for in-person and remote-sync sessions: `/lessons` filters both modes out and family responses list only the family's own children.

## Top 10 (by priority)
1. H3 Digest and nudge read amplification, with tenants off still loading everything.
2. H2 `lessonAccess` defaults to "all", widening what existing families can see.
3. H1 The fork copies `worksheetFile`, so the worksheet URL is dead, and `signWorksheet` should check existence.
4. M1 Shared-library worksheets are dropped from homework and block the linked quiz.
5. M2 A tutor can re-enable a parent's unsubscribe.
6. M3 Unescaped `name` in the preview banner.
7. M5 Session create is not atomic (a double tap wipes a live class).
8. M4 The 2FA counter race, resend race and lockout when mail is off.
9. M6 In-person submit retry cannot repair a half-written state.
10. L1 The hubCache tmp snapshot has open permissions and no integrity check.

## Top 3 to fix today
1. **H3**: short-circuit on switches, bound the attempts query, and run the log check before sentKinds. This is a billing risk the moment `HUB_DIGEST_ENABLED=1`.
2. **H2**: flip the `lessonAccess` default back to "assigned", or migrate existing tenants explicitly.
3. **H1 + M1**: strip or copy worksheet fields on fork, add an existence check in `GET /worksheet`, and switch `worksheetsOut` and `attempts` to `canReadContent`.
