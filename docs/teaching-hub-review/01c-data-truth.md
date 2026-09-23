# 01c - Data-truth check: where every Teaching Hub number comes from

Method: code trace only (no DB, no API). Anything that needs live data to confirm is marked **[needs DB]**.
Paths are relative to the repo root. `FE` = features/learninghub, `SRV` = server/src.
Trust score 1 (cosmetic) to 4 (a tutor or parent will stop believing the screen).

## 0. Scope: is anything leaked from other tenants? (refuted)

- Every hub read starts with `resolveCtx` (SRV/lib/hubCore.ts:120). For `company|freelancer|franchise|staff` it returns `tenantId: auth.tenantId`; `franchiseId` is null unless role is franchise/staff (hubCore.ts:126-138). A freelancer owns a solo tenant (middleware/role.ts:11), so "AmirFreelancer" is a whole tenant of his own.
- All big reads are `where("tenantId","==",ctx.tenantId)`: `noteIndex`/`tenantTopics` (SRV/lib/hubIndex.ts:78,147 via `shardedTenantRead`, :47), assessments, cards, enrolments, submissions. No other tenant's rows enter any count.
- Franchise scope: `canSee` (hubCore.ts:187) lets a franchise/staff user READ head-office content (franchiseId null) plus its own; tenant-level users see every franchise's content. `canSeeStudent` (:200) restricts people rows to own franchise. So in a multi-franchise tenant, header counts are "head office + mine" for a franchise, "everything in the tenant" for company/freelancer. That is consistent, not a leak, but it is NOT "my content" - there is no per-tutor scope inside a tenant (only lessons have a Mine/Everyone toggle, FE/mineKit.tsx).
- Why Amir has 7,894 lessons at all: the Oak library was imported INTO his tenant (ids `oak-<tenant>-q-...`, see comment hubIndex.ts:23-26: "~89k questions + ~49k cards + 8.5k assessments" per tenant). It is a per-tenant copy, so it is in his counts legitimately.

## 1. Tutor Home and hub header

### 1.1 Header stat tiles (FE/HubHero.tsx:148-160, Home tab only; shown in "full" mode)
| Tile | Component | API | Source / definition |
|---|---|---|---|
| Subjects 7 | HubHero.tsx:150 `subjectsOf(topics).length` (types.ts:229) | GET /topics (SRV/routes/learningHub.ts:274-280, `visibleTopics` :271) via useHubData.ts:111 | Count of DISTINCT `subject` strings across every `hubTopics` doc the caller can see (cache "topics", 60 s TTL, swr, hubIndex.ts:78). Case-sensitive string set. Counts any topic, even one with zero lessons, quizzes only, or a tutor-made "Geography"/stray topic. Not "subjects taught", not "subjects with lessons". |
| ...(2,457 topics) | HubHero.tsx:150 `topics.length` | same | EVERY topic doc: subject roots, unit topics AND "Year N" subtopics (parentTopicId set) all count. Not units. The library export's `unit` column is empty (0 of 7,470 filled - verified in inputs CSV), so the two vocabularies never meet. |
| Lessons 7,894 (1 in draft) | HubHero.tsx:151 `noteStats.total`, sub `drafts` | GET /notes/counts (learningHub.ts:591-614), fetched at useHubData.ts:96 | Loops `noteIndex(tenant)` (every `hubNotes` doc, hubIndex.ts:147, 20 min TTL, patched on writes) and counts EVERY note in a visible topic: `total++` with no `isLesson`, `kind` or `oakKey` test (:604-611). So it includes interactive lessons, plain notes/worksheet notes, tutor-authored notes, whiteboard snapshots (`kind:"board"`, hubIndex.ts:112,138) and drafts. Label says "Lessons" but the definition is "notes". |
| Worksheets 1 | HubHero.tsx:152 `noteStats.files` | same | `files += n.attachments.length` (learningHub.ts:608): the number of ATTACHMENTS (PDFs/images) across all notes, not the number of worksheets. Sub-label "PDFs and images". |
| Students 8 | HubHero.tsx:154 `activeStudents` | GET roster (useHubData.ts, `students`) -> `tenantRoster` hubIndex.ts:230 (30 s TTL) | Enrolments with `active !== false` in the caller's franchise scope. |

Why 7,894 vs the export's 7,470 (Maths/English/Science/French/Spanish/German) and 7 vs 6:
- The export (inputs/ActivityOS-lesson-library.csv, verified: 7,470 rows = English 2,671, Maths 1,935, Science 1,498, French 492, Spanish 492, German 382; every row has an `oak_url`) is Oak lessons only. The header counts all notes: 7,894 - 7,470 = **424 extra notes**, which by code can only be: notes with no Oak source (tutor-written lessons, plain notes, test notes), `kind:"board"` whiteboard snapshots saved from live lessons, drafts (1 shown), and any re-imported duplicates. **[needs DB]** to split the 424 exactly; a one-off count by (`kind`, `isLesson`, `oakKey`, `published`) on `hubNotes` gives it.
- The 7th subject is a topic-level artefact (a topic with subject "Geography" or a case/spelling variant such as "Maths"/"maths"), because Subjects = distinct `hubTopics.subject`, not subjects that contain lessons. **[needs DB]** to name it, but the mechanism is certain.
- 2,457 "topics" vs empty `unit`: topic docs = subject/unit/Year-subtopic tree, not the Oak `unit` field.
- Also note the client can filter topics by enrolled subject (useHubData.ts:158-161, `allow`) so header topics/subjects can differ from `/notes/counts` (which is filtered server-side by `visible` topics + optional `?year=`). Lessons tab year filter is lifted into the same call (useHubData.ts:35,96) so the header tile changes when a year is chosen on Lessons.
- Trust 4. Fix: relabel and redefine - "Lessons" = `isLesson && kind!=="board"` (same `usable()` rule the curriculum map uses, curriculumApi.ts:63); "Subjects" = distinct subjects that have >=1 lesson; drop "topics" and "Worksheets 1" from Home (proposal: remove the whole tile row on Today).

### 1.2 "Needs your attention - 23 things" (FE/home/TutorHome.tsx:146,165-174)
`attn = toMark + written + overdue + quiet` (:146). Data is four parallel fetches (FE/home/useHomeData.ts:73-80, allSettled, realtime refetch after 350 ms on channels hubAttempts/hubHomework/hubSubmissions/hubLessons/hubFlashcards/hubEnrolments, :16):
- Homework to mark (9) = `inbox.filter(status==="submitted")` (TutorHome.tsx:103). Source GET /homework/inbox (SRV/routes/hub/homeworkApi.ts:161): every `hubSubmissions` in tenant, `canSeeStudent`, student must be in current roster.
- Written answers to mark (7) = `attempts.filter(status==="pending_marking")` minus placement (`assessmentType==="diagnostic"`), (:105-108). Source GET /attempts (SRV/routes/hub/attempts.ts:380-405). **Defect:** the unfiltered list is `.slice(0,300)` newest-first (:397); the Home call passes no `?status=` filter, so an old pending paper falls off and Home under-counts (the code comment at :386-388 admits the marking queue uses `?status=pending_marking` for this reason).
- Placement papers are added to `attn` via `d.written` (total) but shown as a separate row only if >0 (:170) - so the badge count can exceed the sum of visible rows only if that row is hidden (it is not: shown when >0). OK.
- Overdue homework (6) = `inbox.filter(status==="assigned" && dueAt < now)` (:104). "Assigned" rows are one per child per homework, so 6 = child-homework pairs, not homeworks.
- Quiet 14+ days (1) = active students whose newest of {mastery lastActive, any non-in-progress attempt, inbox submitted/marked} is >14 d old, excluding anyone enrolled <14 d ago (:96-101). A child who was only ever assigned homework and never opened it counts as "quiet".
- Consequence: "23 things" adds unlike units (papers, child-homework pairs, people). Clicking "Homework to mark" and "Overdue" both go to the Homework tab (:168,171).
- Trust 2. Fix: pass `?status=pending_marking` for the Home attempts call; label rows as people/papers consistently; one Mark queue.

### 1.3 Mastery grid, Top improvers, Needs a nudge, Weekly rhythm, Recent activity
- Grid: FE/home/ClassSnapshot.tsx (`Cell`, bands via `bandTone` homeLib.ts:97) from GET /mastery/overview (SRV/routes/hub/mastery.ts:116-146). It reads STORED `hubMastery` rows (cached 20 s, cleared when a row is rebuilt), averages a child's topic rows per subject (:139-142). The child's own screen uses GET /mastery which is computed FRESH from attempts (:15,:64-113, `rollupSubject`). Two computations of the same idea: they can disagree if stored rows lag (rows only rebuilt via `refreshMastery` after a mark/submit, attempts.ts:337,466,491; inPersonApi.ts:412). **[needs DB]** to see if any student is stale. Trust 3.
- Bands: `config.masteryBands` from hub settings (Learning 0, Developing 50, Secure 80, Mastered 90 per brief); a % maps to the highest band whose `min <= pct` (homeLib.ts:88-93). "Not started" = `masteryPct == null`.
- Top improvers: `improvement(attempts)` (homeLib.ts:139-152): per child, latest marked non-placement quiz % minus mean of up to 3 before; needs >=2 attempts; also limited to the same 300-attempt window.
- Needs a nudge: quiet list (above) + children whose subject-average < second band min (TutorHome.tsx:126-137).
- Weekly rhythm: `perDay(attempts, now, 14)` (homeLib.ts:110): quiz submissions per calendar day, last 14 days ("quizzes handed in"); homework hand-ins are NOT in it. It is a 14-day chart called "weekly".
- Recent activity: attempts + inbox events, newest 10 (TutorHome.tsx:110-124).
- Next lesson: `upcoming[0]` of GET /lessons filtered by `lessonTiming` phase upcoming/open (:91), scope Mine/Everyone toggle for staff (:79-85). Duplicates Live lessons "Nothing coming up".
- Live banner: see section 5.

## 2. Flashcards numbers (SRV/routes/hub/flashcardsApi.ts, SRV/lib/hubSrs.ts; FE/flashcards/TutorFlashcards.tsx)
- "Cards 51,873": `stats.totalCards` = ALL cards in the tenant index visible to the caller (flashcardsApi.ts:200 `cards = index.values().filter(canSee)`, :217) - includes drafts/unpublished (there is a separate `publishedCards`). FE: TutorFlashcards.tsx:97-98,~127.
- "Due to review 10": `sum(students[].due)` (FE ~:129): per child, review docs `nextDueAt <= now` among cards available to that child (:210-213).
- Per child: `cardsAvailable = cards.filter(cardForChild)` (:208). `cardForChild` (:87-100) says a card is available if published, in head-office/own-franchise scope, AND (topic explicitly assigned to the child, OR the child's ENROLMENT `subjects` array contains the card's topic subject, case-insensitive). **Not by year group, not by ability**: a Year 3 child enrolled in "Maths" gets every Maths card of every year. That is why Callum shows `14 / 22,229` and Aisha `0 / 9,278`: enrolled subjects differ (Callum probably has English+Maths+Science, Aisha fewer, or a subject with far more cards).
- "started" = `reviewed = rev.length`, review docs (per card per child) that are in the available set (:210-212). "22,215 new" = `avail.length - rev.length` (:213), i.e. all never-seen cards, so 14 + 22,215 = 22,229 by construction. "0/9,278" and "new 9,278" are the same fact shown twice.
- The child's own queue (GET /flashcards/due, :115-145) uses the same `cardForChild`, builds `buildQueue` (hubSrs.ts) and hands over at most `SESSION_MAX`; `dueCount`/`newCount` on Student Home (StudentHome.tsx:96-98, "N flashcards to review") add due + ALL new cards, so a child is told "22,229 flashcards to review" though a session is capped.
- Trust 3 (huge, meaningless denominators; "Students 8 / cards started 14 of 22,229" reads as failure). Fix: show "N due today, N reviewed this week" per child; cap "new" to the assigned decks; stop counting subject-wide cards as "available" unless a deck is assigned.

## 3. Child-side contradictions

### 3.1 Home "2 homework tasks due soon" vs Homework tab "No homework right now"
- Home: FE/home/StudentHome.tsx:50-54,98. `todo` = homework rows with `childId===childId && submission.status==="assigned"`; `urgent = todo.filter(overdue || soon)` where `soon` = due within 2 days (hwTypes.ts:37-49); the hero text says "`N homework task(s) due soon`" - but `urgent` includes OVERDUE ones, so overdue work is labelled "due soon".
- Homework tab: FE/homework/StudentHomework.tsx:40-45. It calls the SAME endpoint (GET /api/learning-hub/homework?childId=, homeworkApi.ts:205-243, parent branch). If the request errors, the `.catch` does `setList(c => c ?? [])` and only calls `onError` (:41-43), and `list.length===0` renders **"No homework right now"** (:60-62) - a failed load is displayed as an empty state. The tab also loads on its own timer (5-20 s "Checking access..." per the brief) whereas Home already had its data.
- Other ways they can differ: the tab is only truthful when `qs`/`childId` are the same as Home's; a tutor previewing the student view (canEdit) gets the tutor-shaped list branch (homeworkApi.ts:212-226) with no `childId`/`submission`, so Home's `h.childId===childId` filter matches nothing (would show "Nothing to hand in" not "2 due"), i.e. the observed direction (Home says 2, tab says none) is the failed/slow-load case or a stale-render race. **[needs live run]** to confirm which.
- Trust 4 (child told they owe work that is then "not there"). Fix: in StudentHomework distinguish error from empty (show the Notice + Retry, never the empty state, on failure) and lift one shared homework fetch (Home + tab) into a single hook; rename Home copy to "due soon or overdue" (or split the two).

### 3.2 "How I'm doing 78%" vs "Latest results: none"
- "How I'm doing" (StudentHome.tsx:220-247) shows the STRONGEST subject's `masteryPct` (top of `mastery.subjects` sorted desc, :65,224) from GET /mastery (mastery.ts:66-113), computed fresh from ALL the child's attempts with no parent filter (`liteAttempts` :24-28, `computeTopicMastery` hubMastery.ts:75: marked `quiz` attempts only, weighted by topic slices; also placement baselines).
- "Latest results" (StudentHome.tsx:63,209-217) = the first 3 of GET /attempts (attempts.ts:380-405) that are non-placement, not in_progress, submitted. That endpoint additionally requires `canSeeStudent` and, for a parent, `a.parentUid === ctx.uid` (:395), and caps at 300 newest. So a child can have mastery (from attempts recorded by the tutor, in-person, seeded/imported, or under a different `parentUid`) and yet an empty results list. It is the same child with two different visibility filters. **[needs DB]** to confirm which attempts have a differing `parentUid`/franchise. Also `results` drops `diagnostic` attempts although they feed baselines but not mastery %.
- Trust 4. Fix: one source of truth - derive "latest results" from the same attempt set used for mastery (or show mastery only when `results.length>0`), and remove the `parentUid` mismatch for tutor-recorded attempts.

### 3.3 "My level 75%" vs subject chips "90%"
- "My level" (Attainment, FE/progress/Attainment.tsx:36-66, hero on Home StudentHome.tsx:136) = `overall` from `overallAttainment` (SRV/lib/hubRules.ts:243-255) = the UNWEIGHTED MEAN of every attempted subject's mastery (75%), mapped to a band. The "How I'm doing" ring on the same screen is the STRONGEST subject (78%), and the chips under the level bar show the BAND LABEL per subject (Attainment.tsx:123-136), while the scale under the bar prints each band's FLOOR ("Mastered 90%", :101). So "90%" is a band threshold, or a subject value; either way three different numbers (mean 75, best 78, floor/subject 90) sit within one screen without saying which is which. Not a data bug; a labelling problem. **[needs live run]** to confirm the exact "90%" element.
- Trust 3. Fix: show one number per card and name it ("Average across subjects 75%" / "Best subject 78%"); print the band name, not the floor, on the scale.

### 3.4 Other child-side
- Streak/Flame: counts days with an attempt or homework hand-in (StudentHome.tsx:56-61); flashcard reviews do not count.
- Locked wording: see 4.

## 4. Quizzes tab counts (SRV/routes/hub/assessments.ts:195-306; FE/quiz/AssessmentList.tsx:61,176; FE/quiz/useAssessmentPage.ts)
- Tutor "8,971 quizzes" / "Showing 40 of N": `total = list.length` = every `hubAssessments` row in the tenant (canSee) matching the sidebar filters (type, subject, topic, year group, search, published) (:227-233,:246,:278). PAGE size 40 (`intQ(q.limit,40,100)`), `Showing {list.length} of {total}` (AssessmentList.tsx:176). It includes drafts and the ~thousands of auto-generated lesson exit quizzes (an exit quiz is a normal assessment, `lessonQuizId` on the note, hubIndex.ts:126). The number changes with type: the `facets.types` object carries quiz vs diagnostic counts (:303). 78 placement tests = `types.diagnostic`.
- Child "709 quizzes": family branch (:216-225) = published only, subjects the child is enrolled in, `fitsChild` franchise, and audience must not be "no" for any of the parent's kids; ONE "unknown-year" paper is still shown. So 709 vs 8,971 is enrolment-subject + year/age audience filtering plus published-only. Fine, but the tutor cannot see "what my child sees" number.
- "599 locked lesson quizzes": `lessonOnly` group "Finish a lesson to unlock" (FE/shared-assess/StudentAssess.tsx:174-176) = items with `lessonNoteId` (a published note whose `lessonQuizId` points at the quiz, assessments.ts:277-281). This is a different concept from `locked`/`lockedReason` ("Take the {subject} diagnostic first", assessments.ts:352-364, only when hub setting requireDiagnostic). Same word "locked/unlock" for two rules. Also the map `lessonOf` is only built for the current page (:277 `if (page.length)`), so 599 depends on how the child list is paged. **[needs live run]**.
- Trust 2. Fix: tutor default filter = "my students' years and subjects" with the count of what they'd see; one word for the two lock rules ("Do the lesson first" vs "Do the starting quiz first").

## 5. The stale live-lesson banner
- Component: FE/remotesync/TutorLiveBanner.tsx:14-38, mounted on Home (TutorHome.tsx:151) and the Lessons tab (NotesPanel.tsx:644) - not on every tab (the brief says every tab; code says two). Polls GET /remote-sync/sessions?status=live every 15 s and on realtime `hubLessons` (:12,20-22). Text: "You're broadcasting ... N of M connected" where connected = heartbeat within 30 s (remoteSyncApi.ts:59 CONNECTED_MS).
- Storage: a `hubLessons` doc with `mode:"remote_sync"`, `status:"live"`, created live by POST /remote-sync/sessions (remoteSyncApi.ts:162-200).
- Expiry: `STALE_MS = 6 h` (:66). `sweepIfStale` (:71-76) flips `live`->`ended` if `updatedAt` is older than 6 h - but only lazily, when the tutor list route runs (:222-224; no cron). The "Leave lesson" button deliberately does NOT end (RemoteSyncApp.tsx:247,285); the tutor End action was removed; `POST .../end` (:283-295) exists but no UI calls `endRemoteSync` (features grep: only api.ts:51 defines it).
- Why it can persist for days: `updatedAt` is refreshed by anything: progress patch (:242), Rejoin's PATCH .../students (:277, sets `updatedAt`), heartbeat (:328) and live-answer writes (:374). Any open child tab, any Rejoin click, or the tutor re-opening the lesson resets the 6-hour clock, and Rejoin itself is the only path offered. The banner shows "0 of 8 connected" (nobody heartbeating in 30 s) yet the row stays "live" until 6 h of total silence. Also the slice is capped at 20 rows sorted by `startsAt` (:226). **[needs DB]** to see this doc's `updatedAt`; if it is >6 h old, the deployed server predates the sweep.
- Family side mirrors it (JoinRemoteSyncBanner, GET /remote-sync/active :302) so children can be shown "Resume" for a dead class.
- Trust 3. Fix: (a) show an "End broadcast" button on the banner (call existing `endRemoteSync`); (b) shorten the idle expiry to ~45-60 min based on last heartbeat/progress, and stop bumping `updatedAt` on Rejoin/tools edits; (c) auto-hide when `connectedCount===0` and last activity > 15 min.

## 6. Curriculum map numbers (FE/curriculum/CurriculumCard.tsx; SRV/routes/hub/curriculumApi.ts)
- `data.lessons = scope.rows.length` (curriculumApi.ts:110). Tutor scope = `noteIndex` rows that are `published && kind!=="board" && (isLesson || oakKey)` (:63,72-73), then `place()` maps each to an area (unplaced counted separately, "N of your lessons aren't on this map yet", CurriculumCard.tsx:188). GCSE units spanning two areas count twice in the tallies (:98-101).
- So it does NOT agree with the header by design: header counts all notes incl. drafts, boards, plain notes; map counts only published interactive/Oak lessons -> map lessons <= 7,894 (and approx 7,470 if only Oak). "covered/thin/gaps" then use area tallies. Coverage % is per subject; languages have no checklist so the card shows "lessons placed" (CurriculumCard.tsx:87,135).
- Child mode: only lessons assigned to the child (`childAssignedNoteIds`) - a family sees "N lessons given" (:101), again a different denominator from tutor totals.
- Trust 2 (correct, but visibly different numbers with no explanation). Fix: use the same `usable()` definition for the header Lessons count, so both read ~7,470.

## 7. Ranked discrepancy list (trust damage, smallest truthful fix)
| # | Discrepancy | Cause (code) | Trust | Smallest fix |
|---|---|---|---|---|
| 1 | Child: Home "2 homework due soon" vs Homework tab "No homework right now" | Same endpoint, but tab turns a failed/late fetch into an empty state (StudentHomework.tsx:41-43,60); Home "due soon" includes overdue (StudentHome.tsx:54,98) | 4 | Never show empty on error; share one fetch; reword copy |
| 2 | Child: "How I'm doing 78%" vs "Latest results: none" | Mastery from all attempts (mastery.ts:24) vs /attempts filtered by parentUid/franchise + 300 cap (attempts.ts:395-397) | 4 | Derive both from one attempt set; hide mastery when no results |
| 3 | Header Lessons 7,894 / Subjects 7 vs 7,470 / 6 | `/notes/counts` counts every note incl. boards, plain, drafts, non-Oak (learningHub.ts:604-611); Subjects = distinct topic subject strings (types.ts:229) | 4 | Count `isLesson && !board`; subjects that have lessons; or drop the tiles from Today |
| 4 | "My level 75%" vs 78% ring vs 90% chip | Mean vs strongest vs band floor (hubRules.ts:243; StudentHome.tsx:224; Attainment.tsx:101) | 3 | Name each figure; show band names not floors |
| 5 | Flashcards "14/22,229 started, 22,215 new", "0/9,278" | Availability = enrolled subjects, all years (flashcardsApi.ts:87-100,208-213) | 3 | Show due/reviewed-this-week; count only assigned decks |
| 6 | Stale "You're broadcasting - 0 of 8 connected" | 6 h idle sweep only, `updatedAt` bumped by Rejoin/heartbeat, no End UI (remoteSyncApi.ts:66,242,277,283) | 3 | End button + 45 min idle expiry |
| 7 | Tutor mastery grid vs child dashboard | Stored rows (20 s cache) vs fresh compute (mastery.ts:116-146 vs :64-113) | 3 | Read one compute path; rebuild rows on read if stale |
| 8 | "23 things" mixes units; written count can miss old papers | attn sums papers+pairs+people (TutorHome.tsx:146); /attempts 300 cap (attempts.ts:397) | 2 | Add `?status=pending_marking`; separate counts by unit |
| 9 | Quizzes 8,971 / 709 / 599 "locked"; "Showing 40 of" | Tenant-wide list vs family filters; two "lock" rules (assessments.ts:216-225,352-364) | 2 | Default to tutor's students' years; one lock vocabulary |
| 10 | Curriculum map lesson count differs from header | Different definition (curriculumApi.ts:63) | 2 | Share `usable()` rule |
| 11 | "Worksheets 1" | Sums attachments, not worksheets (learningHub.ts:608) | 2 | Remove tile |
| 12 | "Weekly rhythm" is 14 days of quizzes only | homeLib.ts:110 | 1 | Rename "Last 2 weeks" or include homework |
| 13 | Live banner "on every tab" | Only Home + Lessons mount it (TutorHome.tsx:151, NotesPanel.tsx:644) | 1 | Verify against brief; single shell-level component if wanted |

## Open items that need DB or a live run (not done here: read-only)
1. Split the 424 extra notes by `kind`/`isLesson`/`oakKey`/`published`; name the 7th subject.
2. Whether the stale banner doc's `updatedAt` is older than 6 h (server not restarted / sweep not deployed) or is being bumped.
3. For the child in the walkthrough: `parentUid`/`franchiseId` on the attempts that feed 78% but are missing from Latest results; and the exact element showing 90%.
4. Homework tab failure mode: check the network panel for a failed/slow GET /homework at the moment it showed the empty state.
