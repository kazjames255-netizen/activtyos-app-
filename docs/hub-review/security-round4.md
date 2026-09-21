# Learning Hub — security review, round 4 (backend)

Date: 20 Sep 2026. Scope: `server/src/routes/learningHub.ts`, `server/src/routes/hub/*.ts`, `server/src/lib/hub*.ts`,
`lib/hubCore.ts`, SSE filtering (`routes/events.ts`), uploads (`routes/uploads.ts`, `lib/hubUpload.ts`), privacy export
(`lib/hubPrivacy.ts`). Method: code read as an attacker holding a valid account in each role (parent, child in kid mode,
freelancer tenant A, staff, tenant-B tutor, unauthenticated), then live probes against `localhost:4000` with the
throwaway `e2e-*-mu6r2bx6@activityos-test.com` accounts only (no real tenants touched). No commits, no build, no e2e run.

## Findings

| # | Sev | Finding | Status |
| --- | --- | --- | --- |
| 1 | **Medium** | **Teacher-only lesson content leaked to families via `GET /notes?full=1`.** `noteOut()` defaults `canEdit = true`; the `full=1` branch of the list didn't pass `ctx.canEdit`, so a parent got `teacherTips`, `misconceptions` and the plan's `commonMistakes` / `watchOut` — the parts `GET /notes/:id` strips with `lessonOut()`. Verified live: parent's `?full=1&ids=<lesson>` returned all three; `/notes/:id` didn't. | **Fixed** — `learningHub.ts` passes `ctx.canEdit`. Re-verified: keys now identical to `/notes/:id`. |
| 2 | Low | **No rate limit on the hub; `POST /lessons/:id/join` mints Daily tokens.** Each call costs up to 3 Daily API requests (room create/read + token). A client in a retry loop, or a hostile family/tutor, could burn API quota/cost without limit. | **Fixed** — `rateLimit("hub-join", 30)` per address per minute (same in-memory limiter as the public routes). Verified `RateLimit-Limit: 30` on the response. |
| 3 | Low | **Kid mode is client-side only.** `features/learninghub/family/KidMode.tsx` keeps the mode in `sessionStorage`; the child uses the parent's Firebase token. A child who opens devtools / another tab is the parent as far as every API is concerned (siblings' results, revealed answer keys after a pass, messages). The server has no "child session" concept, so nothing to fix server-side; noted for the product. | Open (design) |
| 4 | Low | **Family invite can re-activate a paused enrolment.** `POST /family-invites/:token/accept` sets `active: true` on an existing enrolment the tutor paused (`active:false`), as long as the parent holds an unexpired, unrevoked link (claimed by them or still pending). A tutor who un-enrols a family but forgets the link lets the family re-enrol themselves. Tutor can revoke the link; expiry is 30 days. | Open — suggest refusing accept when `prev.active === false` unless the invite postdates the pause. |
| 5 | Low | **Staff with a View-only Learning Hub cap still read answer keys.** `resolveCtx` sets `canEdit: true` for every operator; only the access middleware (non-GET ⇒ `edit`) holds a view-only staff member back. GETs that reveal keys (`/questions`, `/attempts/:id` with `reveal`, `/in-person/sessions/:id/questions`) are open to them. They are tutors, and "View" plausibly includes the bank, so recorded rather than changed. | Open (accepted) |
| 6 | Info | **Express 5 default error handler.** No `app.use((err, req, res, next))` in `index.ts`; an uncaught throw in a hub route falls to Express's default handler, which includes the stack trace in the body when `NODE_ENV !== "production"`. Production is fine; dev/staging boxes without `NODE_ENV` would leak paths. | Open — one-liner if wanted. |

## What held up (checked, no issue)

- **Tenancy / IDOR**: every single-doc read re-checks `tenantId` and answers 404 (`childRefFor`, `loadAttempt`, `sessionFor`,
  `lessonFor` in boards, `editableNote/Topic/Lesson/Homework`, `ownSubmission`, `usable()` for invites). Every list is
  `where("tenantId","==",…)` then `canSee`/`canSeeStudent`. Bodies that reference other docs (`noteIds`, `assessmentId`,
  `quizId`, `warmupQuestionIds`, `groupIds`, `childIds`, `attachments`, board `imageId`, submission `attemptId`) are all
  re-read and checked against the caller's tenant/scope. Live: parent `?tenantId=<real tenant>` ⇒ 404, foreign lesson
  board ⇒ 404, all tutor endpoints ⇒ 403.
- **Parent ⇄ other families**: parent context is built only from ACTIVE `hubEnrolments` with `parentUid == uid`;
  attempts/submissions/lessons/boards/homework filter on that. `familyOut` hides other children's attendance; the
  in-person router is tutor-only. SSE for parents listens on `parentUid`/`childIds array-contains-any` queries and only
  ever emits the collection name (no doc data).
- **Franchise (tenant B tutor / franchise staff)**: `canSeeStudent` (people rows) is stricter than `canSee` (content);
  head-office rows are read-only for a franchise (`canWriteRow`). Verified in code for lessons, boards, homework,
  submissions, attempts, in-person sessions, invites, templates.
- **Daily rooms**: rooms are `privacy: private` + `exp`; tokens minted only inside the join window, `is_owner` only for
  a tutor who can write the lesson, families refused while `needsTutor`/`ended` (safeguarding), extend capped at 4 h;
  the `user_id` (child identity for the whiteboard) is signed into the token, not client-settable.
- **Answer keys**: `questionOut` never carries `answer`; match/order shuffle is seeded and key-free; reveal follows
  `settings.hub.revealAnswers` (+ `after_pass`); draft answers are owner-only; privacy export allow-lists attempt fields.
- **Mass assignment**: every body is a zod object (strips unknown keys). The two `passthrough`/`record` bodies
  (`lesson`, `lesson.slides`) are size-capped and only rendered through `RichText` (KaTeX `trust:false`) and
  `SlideArt` (SVG by library id, not from data) — no `dangerouslySetInnerHTML` on stored hub text; YouTube is
  parsed to an 11-char id and re-emitted on fixed hosts.
- **Uploads**: 4 raster mimes + PDF, magic-byte sniffed, 750 KB / 1 MB caps, `nosniff` on serve, SVG refused.
  Hub attachments must be this tenant's `kind:"hub"` private uploads; homework files must be the same parent's,
  for that submission, ≤ 8 per hand-in.

## Files changed

- `server/src/routes/learningHub.ts` — `GET /notes?full=1` passes `ctx.canEdit` to `noteOut` (finding 1).
- `server/src/routes/hub/lessonsApi.ts` — `rateLimit("hub-join", 30)` on `POST /lessons/:id/join` (finding 2).

`cd server && npx tsc --noEmit` clean. API contract unchanged.
