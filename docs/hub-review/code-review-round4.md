# Code review, round 4 — uncommitted changes to EXISTING files outside the hub

Scope: `git diff --stat` (31 tracked files) plus the new `app/[portal]/call/[leadId]/` and
`app/call-ended/` pages. Question asked: does any of this change behaviour for non-hub
users, or break bookings / invoicing / scheduling / other portals? Both
`npx tsc --noEmit` (root and `server/`) were clean before and after the fixes below.

## Fixed (surgical)

1. **`server/openapi.yaml` drifted from the hub routes.** 13 mounted endpoints had no
   spec entry: `GET /providers`, `GET/POST /topics`, `PUT/DELETE /topics/{id}`,
   `POST /topics/rename-subject`, `GET /notes/{id}/lesson-questions`,
   `PATCH /notes/{id}`, `POST /notes/{id}/warmup-check`, `GET /homework/reach`,
   `POST /flashcards/publish`, `POST /lessons/{id}/extend`, `POST /lessons/{id}/reopen`.
   Added them (method-level diff of `learningHub.ts` + `routes/hub/*` vs the spec is now
   empty both ways). Also: `/api/uploads` said "max ~900KB" and had no `purpose`/`kind`
   fields — now 750KB with both documented; the submission-files entry said "≈900KB";
   the leads description now mentions the new `GET /api/platform/leads/{id}`.
2. **Uploads cap 900KB → 750KB side-effect.** The Expenses and Purchasing receipt
   compressors looped only while the data-URL was > 1,100,000 chars (≈825KB decoded),
   i.e. above the new server cap: a big receipt photo that used to pass (750–786KB) now
   gets a 413. Lowered both loops to 1,000,000 chars (= 750KB) so the client target equals
   the server cap. `InvoicesApp.tsx` has the identical loop (line 75) and was **left
   alone** under the "don't touch invoicing" rule — one-number change if wanted. The
   Setup/Account logo (820,000 chars), Moments (900px JPEG), Listing wizard (1200px) and
   newsletter (1600px) targets were already under the cap. Incidents/Safeguarding/Staff
   expenses upload raw files with no compression: they already failed above 900KB, so
   nothing new breaks — the cap change turns a Firestore 500 into a clean 413.
3. **Demo-booked email without a video room.** `ensureLeadVideoUrl` now returns `null`
   when `DAILY_API_KEY` is unset or Daily fails; the button was already conditional but
   the line under it still said "Same link works whenever you're ready" with no link.
   Copy is now conditional ("We'll send you the link before the call").

## Checked and OK (no change)

- **Opt-in defaults.** `OPT_IN_FEATURES = {learninghub}`; `isFeatureOff` keeps the
  existing "off only when `false`" rule for every other key, so no non-hub module changes
  state. Used consistently by the sidebar, ViewGate, Setup → Features, the franchise
  features matrix (`FranchiseFeaturesApp`), `server/lib/customerArea.ts` and
  `middleware/access.ts` (all go through `firstOff`). A franchise with its own features
  map needs HQ to switch the hub on per franchise — consistent with opt-in.
- **Role caps.** `capLevel(null, …)` is still `"edit"` (no matrix → nothing restricted).
  With a matrix in force, a role silent on `learninghub` gets `"none"`; every other area
  keeps the legacy "silent = edit". Existing custom roles therefore need an owner to grant
  the hub — intended, documented in `lib/accessMap.ts`. Two built-in roles (Site Lead,
  Coach) got `learninghub: "edit"`; HO roles are untouched.
- **Nav gating.** Hub item added to company/franchise/freelancer (top group), staff
  (Team & learning group) and custdash; hidden by default everywhere via the opt-in rule,
  and for families by `customerArea.learninghub` which starts `false` and only becomes
  `true` when `/api/learning-hub/providers` returns ≥1 row (parents are not gated by
  `enforceAccess`, so this read never 403s; failures fall back to hidden). ViewGate's
  `?invite=` bypass is limited to `view === "learninghub"`.
- **Platform portal** untouched except Sales/VideoCalls buttons now route to
  `/platform/call/<leadId>` (a real page). `GET /api/platform/leads/:id` is registered
  after `GET /` and no other GET sub-path exists, so nothing is shadowed; it requires the
  platform role. The page is under `app/[portal]/`, so another portal hitting it just
  sees the API's 403 message.
- **Privacy export/erase.** `exportChildLearning` covers enrolments, submissions (+marks),
  flashcard reviews, attempts (answer key stripped), mastery, lessons (own child's
  attendance only). In-person sessions are `hubLessons` with `mode:"in_person"` and their
  results are `hubAttempts`, so both are covered. `eraseChildLearning` additionally strips
  the child from groups, homework, family invites and whiteboard elements. Not exported:
  group membership, invite `childNames`, board drawings — low-value, noted below.
- **Notifications.** `"learning"` added to the category enum and `NotifyCategory`; tsc
  confirms no exhaustive map was missed.
- **Events (SSE).** Hub channels are added per role; big collections are pings, not
  streams. Parent listeners are scoped by `parentUid`/child ids (`array-contains-any`
  capped at 10). Nothing changed for existing channels.
- **Settings.** `hub: mergeHub(s.hub)` in `withDefaults`; `customerArea.learninghub` is
  optional and, server-side, deliberately ignored in favour of the Features switch.
- **package.json.** `prebuild` runs `scripts/hub-widgets.mjs`, which exits 0 when
  `scratch/prototype/widgets` is absent (so CI/other machines are fine). New deps:
  `@daily-co/daily-js`, `katex` (+ `@types/katex` — belongs in devDependencies, harmless).
- **tsconfig.** Excludes `scratch/` and `server/src/**/_check_*.ts` from the ROOT project
  only; the server project still includes them and passes, so no real errors are hidden.
- **`lib/api.ts`** `ApiError.body` is additive. **`e2eCleanup`** gained the hub
  collections. **`firestore.indexes.json`** adds three hub composites (none used yet).
- **`my.ts` DELETE child** now runs `eraseChildLearning` before archiving. Equality-only
  queries (no index needed); if it throws the delete fails loudly, which is the safer
  GDPR behaviour.

## Risks left

- `InvoicesApp.tsx` compress target (1,100,000 chars) still exceeds the 750KB cap —
  not changed per the owner rule.
- Custom staff roles saved before this change get NO hub access until edited.
- `capLevel` default-none is keyed on a hard-coded set; adding another opt-in module
  later must touch both `OPT_IN_FEATURES` and `DEFAULT_NONE_AREAS`.
- The privacy export omits hub group membership, invite `childNames` and board drawings.
- `@types/katex` sits in `dependencies`.
