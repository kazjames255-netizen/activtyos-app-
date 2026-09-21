# Learning Hub — performance at scale (round 4)

Measured 20 Sep 2026 against the live dev API (`localhost:4000`) as the Oak STAGING tutor
(tenant `pnH8zTuvYlb7yJbvcanr`). Read-only GETs, timed with curl (`time_total`). Every request
the hub UI makes on first load of each tab was timed cold (API process just restarted, caches
empty) and warm (second pass).

**Caveat on the numbers:** the machine was shared with several other agents for the whole
session (`uptime` load average 540–630 on a laptop; a `tsc --noEmit` took >3 min). Absolute
values are inflated and noisy — the *ratios* and the causes are what matter. Re-run
`scratch: e2e-style token + curl loop` on a quiet box before quoting figures.

## What the staging tenant holds

| collection | docs |
| --- | ---: |
| hubTopics | 1,850 |
| hubNotes (lessons) | 7,470 |
| hubQuestions | 88,984 |
| hubAssessments (quizzes) | 8,547 |
| hubFlashcards | 48,811 |
| hubEnrolments / attempts / lessons | 2 / 4 / 3 |

Raw Firestore throughput from this network, single stream: assessments (full docs, 10 MB) 20 s,
questions (9-field `select`) 55 s, cards (4-field `select`) 19 s. That is 1.5–2.5k docs/s and is
the floor for any cold index build unless the read is parallelised.

## Before (first pass = cold, second = warm)

| tab | request | cold | warm | bytes |
| --- | --- | ---: | ---: | ---: |
| shell | `/providers` | 3.1 s | 0.28 s | 162 |
| shell | `/topics` | 8.7 s | 0.17 s | 385 KB |
| shell | `/students`, `/config`, `/groups` | 1.8 / 0.16 / 0.28 s | ≤0.3 s | small |
| shell | `/notes/counts` | **21.1 s** | 0.20 s | 50 KB |
| Home / Live / Roster | `/lessons`, `/homework/inbox`, `/mastery/overview`, `/attempts`, `/homework` | 0.3–0.8 s | 0.3–1.4 s | tiny |
| Lessons list | `/notes?limit=40&sort=topic` | 0.59 s | **1.50 s** | 23 KB |
| Lessons search / subject filter | `/notes?…&q=fraction`, `…&subject=Maths` | 0.21 / 0.50 s | 0.35 / 0.48 s | 24 KB |
| Quizzes | `/assessments?light=1` | **158.5 s** | **4.4 s** | **4.9 MB** |
| Quizzes (bank) | `/questions?light=1&sort=topic&limit=40` | **13.2 s** | **10.9 s** | 14 KB |
| Quizzes (bank) | `/questions/counts` | 2.6 s | **2.0 s** | 74 KB |
| Flashcards | `/flashcards?limit=40&sort=topic` | **63.9 s** | **6.9 s** | 15 KB |
| Flashcards | `/flashcards/stats` | **10.9 s** | **2.0 s** | 154 KB |
| Roster | `/tutors`, `/family-invites`, `/in-person/sessions` | 0.3–0.4 s | 0.4–0.9 s | tiny |

## Causes found

1. **Index TTL too short for this size (the "warm is slow" bug).** `hubIndex` caches the
   question / note / assessment / card indexes for 3 min with stale-while-revalidate. At 89k
   questions + 49k cards + 8.5k assessments the background refresh re-reads ~150k documents
   every few minutes, and parsing them blocks the event loop for seconds — so a "warm"
   `/questions?limit=40` took 11 s (as slow as cold) and `/questions/counts` 2 s for a 74 KB
   answer. Every API write already patches the cache in place, so the TTL only bounds
   seed-script staleness. **Fix:** `TTL_INDEX` 3 min → 20 min.
2. **`localeCompare` in the big sorts.** `/questions`, `/flashcards`, `/notes` (sort=topic) and
   `/assessments` sorted the whole filtered set by a `subject\0topic\0subtopic` label with
   `String.prototype.localeCompare` (an ICU call per comparison): ~1.5 M ICU compares to pick a
   40-row page of the 89k bank. **Fix:** `topicRank()` — one integer per topic id, computed once
   per request from the 1,850 topics — plus a single shared `Intl.Collator` (`collate`) for the
   text tie-breaks; plain `<`/`>` for ISO dates and ids.
3. **Single-stream cold index builds.** One `where tenantId ==` query streams at ~2k docs/s.
   **Fix:** `shardedTenantRead()` in `hubIndex.ts`: reads the tenant's smallest and largest doc
   id (two 1-row queries), splits the id space evenly at the first differing character and runs
   the same query in 8 parallel `orderBy(documentId).startAt/endBefore` ranges. Works for random
   auto-ids and for the importer's `oak-<tenant>-q-<hash>-…` ids. Equality + `orderBy(__name__)`
   uses the automatic single-field index — **no new composite index needed** (nothing added to
   `firestore.indexes.json`). Used for questions, cards, assessments, notes and topics.
4. **Slow index builds were invisible.** `hubCache` now logs
   `[hub-cache] <kind>|<tenant> loaded in N s (rows)` whenever a build takes >1 s, so the cold
   cost per tenant shows in the API log.
5. **`/assessments?light=1` is un-paged: 8,547 rows, 4.9 MB, every time the Quizzes tab
   opens** (`features/learninghub/quiz/TutorAssess.tsx`). The server already offers
   `?limit=&cursor=` with facets, but `AssessmentList` groups the whole array client-side
   (subject → topic shelves, 18 per shelf) and computes per-paper stats for all of them.
   Not fixed in this round — it needs the list to move to the paged endpoint (facets for the
   chips, a page per open shelf), which is a UI refactor beyond the time box. Documented as the
   top follow-up below. The other 7k-row lists (Lessons, question bank, flashcards) were already
   server-paged at 40 per page and stay that way.

## After

**The after-numbers are incomplete and not comparable.** The machine's load average climbed
from ~540 to ~630 during the session (other agents + the owner's portal), and the lead asked
for all load against the API to stop before the after-pass finished. Under that load even
`GET /providers` (one Firestore read) took 30 s cold / 1.5 s warm, `GET /config` (one doc)
0.8 s — i.e. the box, not the code, set the floor. What was captured:

| request | before cold / warm | after (pass at load ≈600) | verdict |
| --- | ---: | ---: | --- |
| `/notes?limit=40&sort=topic` (Lessons list) | 0.59 / 1.50 s | 0.76 s warm (pass 2, before sharding), 1.56 s cold | comparator fix; warm no longer waits on a background index re-read |
| `/notes?…&q=fraction`, `…&subject=Maths` | 0.21–0.50 s | 0.36 / 0.66 s warm | unchanged in substance |
| `/notes/counts` (shell) | 21.1 s cold | 14.2 s cold before sharding; 38 s with sharding under 2× load | inconclusive — re-measure; the sharded read should be re-checked against the single query on a quiet box |
| `/assessments?light=1` (Quizzes) | 158 s / 4.4 s | 139 s → 383 s cold (load doubled meanwhile); 10.6 s "warm" while the 89k-question index was still building | **still the #1 problem**: un-paged 8.5k rows / 4.9 MB — see follow-up 1 |
| `/questions?…&limit=40` | 13.2 / 10.9 s | 46 s cold (index build under load); no warm sample | comparator fix + TTL fix target exactly the 10.9 s warm figure; unverified |
| `/flashcards…`, `/questions/counts`, `/flashcards/stats` | 64 / 7 s, 2.6 / 2 s, 11 / 2 s | not reached before stop | unverified |
| Home / Live / Homework / Roster endpoints | 0.3–1.4 s | 0.7–3.7 s (all load) | nothing large; scale with machine load only |

Index build times logged by the new `[hub-cache]` line (cold, single stream, before sharding):
notes 14.2 s (7,470), assessments 66.4 s (8,547), questions 129.7 s (88,984), topics 23.8 s
(1,850, 59-row tenant: 1.9 s). Standalone probe from the same network: assessments 20 s,
questions 55 s, cards 19 s — so the in-process builds were 2–3× slower than the raw reads, which
is the event-loop contention from the other index builds + the 3-min SWR refresh cycle.

**What to run on a quiet machine** (script is `scratchpad/time.sh`-style: sign in as the
staging tutor via `identitytoolkit accounts:signInWithPassword`, then curl each GET above with
`-w "%{time_total}"`; run it twice, restart the API for a true cold pass). Expected from the
changes: `/questions`, `/flashcards`, `/notes` warm well under 500 ms; cold index builds cut by
up to 8× where Firestore lets 8 streams run in parallel; no more periodic multi-second stalls.
If the sharded `notes` build is still slower than the plain query, drop `shardedTenantRead` for
`noteIndex` only (one-line revert in `hubIndex.ts`).

## Still to do (in priority order)

1. **Page the Quizzes list.** Switch `TutorAssess` / `AssessmentList` to
   `GET /assessments?limit=40&cursor=&light=1` (+ `subject`/`topicId`/`yearGroup` from the
   sidebar; `facets` for the chip counts). That removes the 4.9 MB download and the 8.5k-row
   client sort/stats on every open. The Results/Marking tabs only need `aType` for the rows in
   `attempts` — fetch those ids via `?ids=` or carry `assessmentType` on the attempt (it already
   does).
2. **gzip the API.** `server/` has no `compression` middleware; `/topics` (385 KB) and
   `/flashcards/stats` (154 KB) compress ~8–10×. One line in `server/src/index.ts` after adding
   the `compression` dependency (not done: package.json is outside this round's scope).
3. **`/topics` payload.** 1,850 topics = 385 KB per shell load (it is `Cache-Control:
   private, no-cache` + ETag, so revalidates cheaply, but a first paint still downloads it).
   A `select()` of the six fields the client uses, or a per-subject lazy load, would halve it.
4. **`/flashcards/stats` on big decks** walks every card × every active student; fine at 2
   students, O(students × cards) at 30. Pre-bucket cards by subject+franchise once per request.
5. **Warm the big indexes on boot** for the tenants that were active recently (or on the first
   `/providers` call) so a deploy never lands a tutor on a 30 s+ first Quizzes open.

## Files touched

- `server/src/lib/hubIndex.ts` — `TTL_INDEX`, `collate`, `topicRank`, `shardedTenantRead`, index loaders use it
- `server/src/lib/hubCache.ts` — slow-load log line
- `server/src/routes/hub/questions.ts`, `server/src/routes/hub/flashcardsApi.ts`,
  `server/src/routes/learningHub.ts` (`/notes`), `server/src/routes/hub/assessments.ts` — sort comparators

No API shape changed; no indexes to deploy.
