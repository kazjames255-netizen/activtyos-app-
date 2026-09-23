# X2 - Safeguarding lead (DSL) audit, Teaching Hub (code-only)

Method: code read only, no browser, no product code changed. Paths relative to repo root. Severity 1 (note) to 4 (block). Recommendation: BLOCK / FIX / ACCEPT.

## Verdicts by scenario

### (a) Tutor wants to message a child directly
Rules as built (server/src/routes/hub/doubtsApi.ts:96-116): any tutor/staff/franchise user with `canEdit` may open a thread to ANY active enrolled child in their franchise scope (tenant-level operators: every child in the tenant) via `eligibleStudents` (teachingCommon.ts:40-53). No assignment check (`tutorUid` on the enrolment is ignored), no DBS/safeguarding-training flag, no first-message template, no second adult. The message is delivered to the PARENT'S account (child rides the family login) and the parent is emailed the first 140 chars (:111-114, hubNotify.ts:65-69). Threads are append-only (no edit/delete route) which is good for evidence; the family can always see the whole thread (doubtsApi.ts:124-134) which is good. But: no moderation, no keyword scan, no DSL visibility, no HQ oversight view, no retention rule, no report/flag button for the child. Free-text 2,000/4,000 chars, no link/phone/email stripping, so "message me on Snapchat" passes untouched.
Recommendation: FIX (S-01, S-02, S-03).

### (b) Parent asks "who has seen my child's data / who was in the video lesson"
Cannot be answered from the product. No access log exists anywhere in hub routes. For a lesson the parent's export (hubPrivacy.ts:63-67) shows only THEIR child's `joinedAt`; the tutor identity is only `tutorName`, plus first `tutorJoinedAt` (lessonsApi.ts:479). Any tutor in scope can join any lesson as owner (lessonsApi.ts:441-445, no "assigned tutor" check), and neither the join of a second adult/observer, nor Daily participant events, are stored. Room is private, chat off, family screenshare off, no recording property set (hubVideo.ts:108-118) - all good - but there is no evidence either way of who was present. Doubt threads and tool state are not in the export (S-04).
Recommendation: FIX (S-05).

### (c) Franchise tutor tries another franchise's student
Holds. `resolveCtx` (hubCore.ts:120-139) refuses a franchise role with no franchiseId; `canSeeStudent` (:200-203) is own-franchise-only; `eligibleStudents`, `editableDoubt` (doubtsApi.ts:146-152) and join (lessonsApi.ts:439) all 404 out-of-scope. GET /doubts filters by `canSeeStudent` after reading the whole tenant (:137-139, correct but wasteful). Note staff/company (tenant-level) see EVERY franchise's children and threads - by design, but there is no per-tutor scope inside a franchise (any tutor sees all franchise children). Recommendation: ACCEPT scoping, FIX least-privilege (S-06).

### (d) HQ "view as" a tutor then hits a button
Worst finding. `applyImpersonation` (server/src/middleware/role.ts:138-150) swaps `req.user` uid/name/email AND `req.auth` to the target on the strength of an `x-act-as` header alone. Every hub write then stamps the tutor: doubt replies `byName: ctx.name` and `createdBy: ctx.uid` (doubtsApi.ts:101-108,174), lessons join as tutor owner, notifyFamilies emails the parent "New message from your tutor". Nothing in a written document records `req.impersonating` (grep: only account.ts blocks 3 account actions and emailSync.ts:65 refuses). The only trail is (1) `console.warn` per request (role.ts:149, log retention only) and (2) `impersonationLog` written by POST /platform/impersonate (platform.ts:39) - a separate voluntary call the client makes; the header works without ever calling it. The banner (ImpersonationBar.tsx:28) warns the operator but the child/parent/tutor cannot tell. HQ can therefore send a message to a child "as" a named tutor, or join a live lesson as the tutor, with no attributable record. Also "view as parent" reads the child's thread and can post as the child (`/doubts/:id/message`, role parent).
Recommendation: BLOCK any redesign that keeps writes-as-tutor without `actedBy` stamping. FIX (S-07).

### (e) Child in kid mode tries to leave the hub or open another child's profile
KidMode (family/KidMode.tsx:40-67) pushes history state to trap back navigation and exit needs ParentGate: a multiplication sum 13-19 x 6-9 (ParentGate.tsx:11), client-only, self-described "accident guard, not security" (:8). A 9-11 year old who knows 17x8 passes it; the sum has no lockout, no rate limit, wrong answer just re-rolls (infinite guesses). Mode is in sessionStorage (editable in devtools). Server side does NOT enforce kid mode: the same parent token serves every child of that parent (`scopedChildren`), so "another child's profile" is only limited to siblings under the same parent, which is legitimate; a different family's child is impossible (enrolment-scoped). The address bar / other tabs leave the hub freely (browser-level; expected). Recommendation: ACCEPT for accident guard, FIX to add attempt throttle and optionally PIN (S-08).

### (f) Data erase for a child
eraseChildLearning (hubPrivacy.ts:73-132) covers: enrolments, submissions (+ image docs by submissionId), flashcard reviews, attempts, mastery, lesson childIds/attendance, groups, family invites, board elements (cid match), tool states (ownerKey), homework assigned lists. NOT covered:
1. `hubDoubts` (childId, childName, full message text) - no erase, no export (grep of hubPrivacy.ts/my.ts/privacy.ts: zero hits). Highest gap: it is the child's free text and tutor-to-child correspondence.
2. In-app notifications and the emails' bell entries bearing child name and message text (notify.ts collection; parent-scoped so parent's own, but tenant notifications from notifyTutor contain child name plus first 140 chars of the message and are visible to the whole tenant team - never erased).
3. `liveAnswers` on remote_sync hubLessons (childId keyed, contains in-progress responses) - only childIds/attendance removed (:95).
4. `attendance` entries are removed but lesson `childNames`/title snapshots, if any, are not checked.
5. Board images a child uploaded via hub uploads (element imageId) - elements removed but the image docs remain.
6. `hubToolEvents` are anonymous (ok). `hubNcTags` is per tenant (ok).
7. Child doc is archived not deleted (my.ts:2721) - retention of name/dob/medical/EHCP fields is outside hub scope but should be stated.
8. Enrolment erase deletes `parentEmail` too, ok. No retention limit (TTL) exists on any hub collection; erase happens only on parent request.
Recommendation: FIX (S-04).

## Findings register

| id | Sev | Area | Finding | file:line | Rec |
|---|---|---|---|---|---|
| S-01 | 4 | Messaging | Any in-scope tutor can start a 1:1 message to any enrolled child; no assignment check, no DSL sight, no keyword/contact-detail scan, no report button | doubtsApi.ts:96-116; teachingCommon.ts:40 | FIX |
| S-02 | 3 | Messaging | Tutor-to-child text can contain phone/email/links; delivered verbatim and echoed in parent email. No moderation queue | doubtsApi.ts:38,111-114 | FIX |
| S-03 | 3 | Messaging | No retention/audit view: DSL cannot list all tutor-child threads or who read them; `seen` overwrites flags with no reader/time | doubtsApi.ts:206-221 | FIX |
| S-04 | 4 | Erase/export | `hubDoubts`, notification bodies, remote-sync liveAnswers and board image uploads not erased; doubts not in privacy export | hubPrivacy.ts:24-132 | FIX |
| S-05 | 3 | Video | No record of who was in a lesson; any tutor in scope can join as owner; no second-adult/observer or recording policy stored | lessonsApi.ts:441-445,479; hubVideo.ts:108 | FIX |
| S-06 | 2 | Scope | No per-tutor scoping inside a franchise or tenant; every tutor sees every child's threads | doubtsApi.ts:137-139 | FIX |
| S-07 | 4 | Impersonation | Writes as HQ-acting-as-tutor are indistinguishable from the tutor's; no `actedBy` on any doc; audit is only a per-request console.warn and a voluntary log call; can email real parents | role.ts:138-150; platform.ts:32-40; doubtsApi.ts:174 | BLOCK |
| S-08 | 2 | Kid mode | ParentGate is a client-side sum, unlimited guesses, sessionStorage; server does not enforce kid mode | ParentGate.tsx:8-21; KidMode.tsx:10 | FIX |
| S-09 | 2 | Tool state | Autosave takes arbitrary JSON (z.unknown) up to 64 KB per tool/context under the child's key; only GeometryBoard uses it today, but any future writing tool inherits server storage of free text, while the writing tools promise "nothing is sent" | toolsApi.ts:36,66-78; TimedWriting.tsx:81 | FIX (allow-list schema) |
| S-10 | 1 | Tool usage | Counters carry no child identity, one doc per tenant-day | toolsApi.ts:36-47 | ACCEPT |
| S-11 | 1 | Tool questions | Marking regenerates from seed server-side; PublicProblem strips answer; export allow-lists answers | problems.ts:19-22; hubPrivacy.ts:49-58 | ACCEPT |
| S-12 | 1 | Video identity | Daily token shows first name only; user_id `c:<childId>` signed; siblings named "Ava and Ben"; chat off; family cannot screenshare | lessonsApi.ts:432-436; hubVideo.ts:114-117,141 | ACCEPT |
| S-13 | 2 | Video | Rooms are unrecorded (good) but capacity up to 200 and privacy is "private" without `enable_knocking` / lobby; join window 10 mins early lets a family join before the tutor (mitigated by waitingForTutor only after End) | hubVideo.ts:31,89-97; lessonsApi.ts:455-460 | FIX (require tutor-present) |
| S-14 | 2 | Whiteboard | Wire input is sanitised and bounded; children's drawings persist server-side under cid (erase handles) but board autosave is tutor's client only | wireGuard.ts:1-30; boardsApi.ts:10-40 | ACCEPT |
| S-15 | 2 | Nudges | Streak flame, "keep it going tomorrow" and 14-day tallies shown to children by default; no leaderboard found; no setting to turn streaks off (ICO Children's Code: nudge techniques) | StudentHome.tsx:56-61,138-142 | FIX |
| S-16 | 2 | Email | Real parents cannot be mailed from dev: MAIL_LIVE unset suppresses all mail except MAIL_ALLOWLIST (mailer.ts:87-122). Risk is env misconfiguration: `notifyFamilies` reads real enrolments, so any staging DB copy with MAIL_LIVE=1 mails real parents | mailer.ts:87-99; hubNotify.ts:47-76 | ACCEPT + env guard |
| S-17 | 1 | AI | No AI/LLM calls found in hub client or routes | grep | ACCEPT |
| S-18 | 2 | Parent visibility | Parent can read own child's threads; tutor's `byName` shown; but thread list is capped to 10 children by `in` query | doubtsApi.ts:128 | ACCEPT |

## What I would BLOCK in any redesign
1. Any write made while acting as another account that does not carry `actedBy` (real HQ uid) on the document and in an immutable audit log.
2. Tutor-to-child messaging without assignment check, a DSL-visible log, contact-detail filtering and a parent copy.
3. Child data features (threads, tool state, live answers, images) shipped without being added to export and erase in the same change.
4. Server-persisted free text/drawings from children in tools that state "nothing is sent".
5. Kid-mode as the only barrier to a parent-only action (no server enforcement of the child context).
6. Streaks/timers/leaderboards enabled by default for children.
