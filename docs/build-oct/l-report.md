# Agent L report: learning persistence + payroll records + media upload

## 37 Learning Centre persistence
- ALREADY BUILT: assignments (scope/due/required) and per-staff completions with pass mark (`routes/learning.ts`, `learningAssignments`/`learningCompletions`), notify/remind. Left unchanged. The parent/tutor Learning Hub (`learningHub.ts`, 4,679 questions) is a separate product and was not reused: staff training has its own content model.
- BUILT (the real gap): `server/src/routes/learningCentre.ts`, mounted at `/api/learning` in index.ts.
  - `GET/PUT /courses`: manager's course library edits (content + quizzes) per tenant/franchise, `learningCourses`. Franchise accounts also read head-office courses (`fromHo`). 800KB cap returns 413.
  - `POST/GET /attempts`: every quiz attempt (pass or fail) with attempt number, judged against the TENANT pass mark. Staff see only their own, managers the team.
  - `POST/GET /certificates`: certificate record (random ref) issued once per person+course, ONLY if a server-side completion exists. Idempotent. Own-only for staff.
- UI (minimal): `courseCompletions.ts` (syncs courses to the local copy, `recordAttempt`), `CoursePlayer.tsx` (posts an attempt on quiz submit), `LearningCentreApp.tsx` (`persistCourses` PUTs only edited/custom courses, not the built-in seed library).
- SKIPPED: policies + policyAcks (not in my list), public `/v/<ref>` certificate page (item 38), in-progress position and reminder prefs (still per-device by design), a server-side question bank for the built-in library (45k lines of client content, stays built-in).

## 39 Payroll records
- (a) BUILT on top of the existing `payrollYtd` store: `addRunToYtdOnce` writes a per-(run, employee) ledger doc `payrollYtdPosts` in the SAME transaction as the YTD bump, so a replay changes nothing. Approve now calls it (the only edit in payroll.ts, plus a `ytdPostFailed` flag if posting throws). New `POST /api/payroll/ytd/repost` (retries flagged runs) and `GET /api/payroll/ytd/:empId/reconcile` (stored vs ledger vs approved runs). Both audited. Calculation results untouched.
- (b) BUILT: `routes/payrollRecords.ts` + `lib/payrollDocsPdf.ts` (jsPDF). `GET /api/payroll/records/:empId` (list), `GET .../p60?taxYear=` (ended years only; manager `?preview=1` gives a PROVISIONAL unsaved copy), `POST/GET .../p45` (manager issues once for an employee with a leaveDate; the leaver reads their own). Persisted byte-identical in `payrollDocs` (retention `taxYearEnd`). Managers go through `requirePayrollAdmin`; staff only their own, and a P60 only once every approved run in that year is published. NI shown masked only; audit actions `view-p60/issue-p45/view-p45/repost-ytd/reconcile-ytd` carry no NI.
- (c) SKIPPED: `ukStatutory.ts` already handles S/C prefixes, W1/M1/X, 0T, K, BR/D0-D3, NT and an emergency 1257L fallback.
- No UI for P60/P45 yet (API only). Taxable pay is still approximated as gross (existing note).

## 0.2 Storage
- BUILT, flag OFF: `routes/mediaUploads.ts` at `/api/media`. Signed-URL flow (`upload-url`, PUT to bucket, `:id/complete`, `GET :id` 302 to a signed link). Image max 10MB, video max 200MB (`MEDIA_MAX_VIDEO_MB`), allowed jpeg/png/webp/gif/mp4/webm/mov, magic-byte check on the stored object, tenant-scoped, operators only. Every route returns 503 `media_storage_disabled` until switched on. Existing `/api/images` untouched. Not tested against a real bucket.
- Kaz/Amir must: enable Storage in the Firebase console (Blaze), set `MEDIA_STORAGE_ENABLED=true` and `FIREBASE_STORAGE_BUCKET=<bucket>` on the API host, grant the service account Storage Object Admin + Service Account Token Creator, and set the bucket CORS to allow PUT from the web origin. Then wire the lesson editor to it.

## Tests
- NEW `e2e/l-payroll-records-learning.spec.ts`: 5/5 pass (idempotent YTD + reconcile + repost, P60, P45, learning courses/attempts/certs, media 503). Run via `scripts/e2e-locked.sh`.
- Unchanged and passing: `payroll-flow` + `payroll-security` (17/17), `payrollCalcVerify` 344/0, `npm --prefix server run typecheck` and `npx tsc --noEmit` clean.
- Also edited `e2e/helpers/payrollAdmin.ts` (wipe covers the new collections; `flag-repost` command).

## Residual risks
- Runs approved before the ledger have no ledger entries (reconcile notes this); repost only touches runs flagged after this change, so it cannot double count old runs.
- P60/P45 are system-estimate summaries (no previous-employment pay), not HMRC RTI documents.
- index.ts got three single-line edits (imports, payrollRecords, learningCentre + media mounts).
