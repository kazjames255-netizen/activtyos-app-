# Auto-plan a week (suggest only)

A tutor taps "Plan next week" for a child or a group. The server builds a ranked, explained week of homework from the
weakest topics. It is a SUGGESTION: nothing is created until the tutor ticks cards and accepts. There are NO auto-set
remedial packs ("booster packs") by design.

## API

`GET /api/learning-hub/plan/suggest?childId=<id> | groupId=<id> [&days=7] [&minutesPerDay=20] [&subject=Maths]`
Tutor-only (same edit + franchise-scope rules as mastery). Exactly one of childId/groupId (else 400). Mounted through
`hubAssessmentsApi` (server/src/routes/hub/assessmentsApi.ts, next to `hubMasteryApi`). Query `?tenantId=` scope works as for other hub routes.

Response:
```
{ target: {kind:"child",childId,childName} | {kind:"group",groupId,name,size},
  yearGroup, generatedAt, support:{noTimer,extraTimePercent,calm},
  items: PlanItem[],   // ordered by due day
  gaps: {topicId,topicLabel,subject,pct,why:"no_content"|"no_room"}[],   // weak topics we could not plan
  summary:{days,minutesPerDay,totalMinutes,weakTopics,considered} }
PlanItem = { id, rank(1=weakest), topicId, subject, topicLabel, score,
  title, instructions, dueAt(ISO 17:00Z), dueDay(YYYY-MM-DD),
  assessmentId|null, noteIds[], worksheetNoteIds[], minutes,
  reason:{kind:"scored"|"baseline"|"group"|"stale",topic,pct,daysAgo,weak?,total?,attempts}, reasonText(English),
  chips:("weak"|"stale"|"quiz"|"lesson"|"worksheet"|"recap"|"fresh"|"untimed"|"extraTime"|"calm"|"groupShare")[],
  parts:{kind,id,title,minutes}[] }
```
`title / instructions / dueAt / assessmentId / noteIds / worksheetNoteIds` map 1:1 onto `POST /homework` (homeworkBody in
routes/hub/homeworkApi.ts); the client adds `assignedChildIds` / `assignedGroupIds`. If the homework redesign drops `title`
or `noteIds`, `toHomeworkBody` in planApi.ts is the single place to adapt.

## Rules (server/src/lib/hubPlan.ts, pure and deterministic)
1. Weak = mastery < 75. score = (100-pct)/100 x confidence (1 attempt 0.75, 2 -> 0.9, 3+ -> 1, baseline only 0.6) x 1.1 if untouched 21+ days
   x group share below the bar (groups); x 0.6 if that topic got homework in the last 10 days.
2. Content per topic (published, franchise-visible, audience-fit): worksheet with its auto-marked quiz > standalone quiz closest to 12 min
   (never-attempted first) > worksheet alone. Lessons within +-1 year of the child's year group; a recap lesson is paired in when mastery < 50 or only a placement baseline exists.
3. Never repeats a quiz attempted or set in the last 10 days, nor a lesson/worksheet set in the last 10 days.
4. Workload: default 20 min/day, Mon-Fri from tomorrow, <= 2 items/day, least-loaded day first, avoids the same subject on adjacent days. An item over 1.5x the daily budget is deferred (listed in `gaps`); an over-budget recap lesson is dropped first.
5. Support profile (strictest across a group): noTimer -> +25% estimate, extraTime% stretches estimates, calm -> 75% budget, 1 item/day, gentle wording.

Perf: uses the cached `tenantTopics` / `assessmentRows` / `noteIndex`; a per-tenant topic->candidates memo (30 s). Per request Firestore
cost is 2 small queries per student (their attempts; homework `array-contains childId`), groups capped at 40 members. No collection scans.
Selftest: `server/node_modules/.bin/tsx server/src/lib/hubPlan.selftest.ts`.

## UI (features/learninghub/plan/)
- `planApi.ts`: `suggestPlan(target, {qs,days,minutesPerDay,subject})`, `toHomeworkBody(item, {childIds,groupIds}, overrides?)`, `setPlanItems(items, to, qs)` (posts one homework per item).
- `AutoPlanSheet.tsx`: `<AutoPlanSheet target={{childId}} | {{groupId}} targetName qs onClose onAccept={(items)=>...} />`. Uses teachKit `Dialog`, i18n `hubplan.*` (lib/i18n/messages/areas/hubplan.ts, 11 locales).

### Mounting points (not wired; other agents own those files)
1. StudentsPanel.tsx, next to the "Set homework" button (~line 522, `hub-student-homework`): add a "Plan next week" button that sets
   `plan={childId}` state and renders `<AutoPlanSheet target={{ childId: s.childId }} targetName={s.childName} qs={qs} onClose=... onAccept=.../>`.
2. GroupsSection.tsx group card header: same with `target={{ groupId: g.id }}`.
3. TutorHomework.tsx toolbar, next to "Set homework", with a student/group picker first.
`onAccept` options: (a) quick: `await setPlanItems(items, { childIds: [childId] }, qs)` (or `{ groupIds: [gid], childIds: memberIds }`, since the API needs at
least one student overall) then refresh; (b) review each in `HomeworkForm` by feeding `initialTitle / initialInstructions / initialAssessmentId /
initialNoteIds / initialChildIds / initialGroupIds` from `toHomeworkBody(item, ...)`. HomeworkForm has no `initialDueAt` or `initialWorksheetNoteIds`
prop yet; add those two when the bare-homework redesign lands (the plan already returns `dueAt` and `worksheetNoteIds`).

Known limits: topic year is only implied by content (lesson year, quiz audience); the group plan reads attempts per student but only homework-based
repeat-avoidance, and uses the group's median year group. Reason/instruction strings from the server are English (instructions are tutor-editable
prefill); the sheet renders reasons and chips through i18n from the structured `reason` / `chips`.
