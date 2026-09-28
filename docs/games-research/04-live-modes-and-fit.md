# 04 - Live game modes: fit with our codebase, competitor mechanics, build plan

Status: research/architecture only. No app code touched. Written 2026-09-26.
Files cited were read directly; where I only inferred (not read end to end) it is marked "(inferred)".

---------------------------------------------------------------------------
## PART 1 - Audit: what we can build on, what is missing
---------------------------------------------------------------------------

### 1.1 Reusable pieces (verified)

| Need | Existing piece | Notes / limits |
| --- | --- | --- |
| Session doc + lifecycle | `hubLessons` rows with `mode: "remote_sync"` / `"in_person"` (`server/src/routes/hub/remoteSyncApi.ts`, `inPersonApi.ts`) | Status `live/ended/cancelled`, lazy sweep of stale sessions (`sweepIfStale`, STALE_MS 90 min), tutor-only `End`. A game session can be a third `mode: "game"` and ride the same collection AND the same SSE channel (`hubLessons` is a HUB_DIRECT_CHANNEL in `events.ts`). |
| Presence | `attendance[childId]` stamped by `POST .../heartbeat` every ~12s; CONNECTED_MS=30s | Fine for "X of Y connected". Heartbeats deliberately do NOT bump `updatedAt`. |
| Pace modes | `pace: driven / lockstep / own_pace` + `liveAnswers[childId]` (whole-entry replace, debounced PATCH `live-answer`) | Directly maps to game flow: `lockstep` = Kahoot-style "everyone on Q3", `own_pace` = Blooket/Gimkit/Quizizz-style. `liveAnswers` is a live read only, nothing recorded. |
| Join UX | `features/learninghub/remotesync/JoinRemoteSyncBanner.tsx`: family sees `GET /remote-sync/active`, polls (POLL_MS) + `useRealtime(["hubLessons"])` | This is "join from a signed-in child account", NOT join-by-code. |
| Roster / scoping | `hubCore.ts`: `resolveCtx`, `canSeeStudent`, `eligibleStudents`, `visibleGroups`, `activeMembers`; `hubEnrolments` (has `childName`, `childId`, `parentUid`); `groupsApi.ts` groups | Teams can be pre-seeded from `hubGroups`. |
| In-person big screen | `inperson/*` + `GET /in-person/sessions/:id/questions` (one shared session-seeded shuffle, so projector matches devices), `POST .../submit` (tutor submits per child), `CaptureGrid.tsx`, `ResultsPanel.tsx` | Good model for "tutor projects, kids answer" - but it's tutor-captures-answers, not device answers. |
| Question model | `server/src/curriculum/types.ts` (`CKind`: single/multi/short/number/written), `questions.ts`, question kinds in `settings.hub.questionKinds[kind].mark` -> `MarkRule` (choice, multi, exact, numeric, match, order, tool, manual) | ~4,679 curriculum questions loaded per owner tenant. |
| Auto-marking, pure | `server/src/lib/hubScoring.ts` `markResponse(MarkableQuestion, response)` - PURE (no Firestore), self-testable | Reuse verbatim for game answers. `manual` kind must be excluded from games. |
| Seeded generators | `features/learninghub/tools/problems.ts`: `ToolSpec {generatorId, seed}`, `publicProblem()`, `markTool()`, `PROBLEM_GENERATORS` (geometry today) - server re-generates from seed, answer never travels | The blueprint for anti-cheat and for infinite "fresh per player" questions. Only geometry generators exist; arithmetic/spelling generators would be new and cheap. |
| Answers never leak | `attempts.ts`: `snapshotQuestions` (server-side snapshot at start), `questionOut` (no key), `reveal` gates `correctAnswer`/`explanation` | Games use the same split: public `questionOut`, private snapshot. `GRACE_MS = 2 min` already encodes "slow connection isn't punished". |
| Mastery write-back | `attempts.ts` `refreshMastery`, `lib/hubMastery.ts` (`weightedMastery`, last 5 slices, 0.5^i decay), `hubAttempts` shape | A finished game can synthesise an attempt per child (assessmentType "practice"/"game") so mastery and the marking queue just work. Must decide weighting (see 1.10). |
| Flashcards + SRS | `flashcardsApi.ts` `POST /flashcards/:id/review`, `lib/hubSrs.ts`, `/flashcards/due` | Flashcards are a natural game source (match, memory, race). |
| Realtime | `lib/realtime.ts` (ONE shared EventSource, ticket auth via `POST /api/events/ticket`, 20s single-use ticket, union of collections, reconnect 3s) + `server/src/routes/events.ts` (SSE, `:ping` every 25s) | Invalidation-only ("collection X changed, refetch"). Payload-free by design. |
| Ping pattern | `lib/hubPing.ts`: one `hubPings/{tenantId}` doc, writes coalesced to 1 per 700ms | Model for batching leaderboard fan-out. |
| Cache | `lib/hubCache.ts` (per-process TTL, single-flight, disk snapshot), `lib/hubIndex.ts` (tenant question index merged with shared library) | Question pool for a game is a memory read, not Firestore. |
| Rate limit | `server/src/lib/rateLimit.ts` `rateLimit(name,max,windowMs)` fixed window, in-memory, per IP (`trust proxy` aware) | Adequate for one instance; note the file itself says "per instance". School wifi = many kids behind ONE IP (see 1.3). |
| Whiteboard / video | `features/learninghub/live/board/*` (reducer, sync, wire guard, selftests), `live/workspace`, `CallProvider` | Optional: a tutor can run a game while on a video call; the game panel should be a floating pane (see `FloatingVideo`, `remotesync/FloatingPanel.tsx`). Board not needed for v1. |
| Help tools | `remotesync/HelpTools.tsx`, `InstrumentOverlay.tsx`, `ApparatusBench.tsx` (fixed tool list) | Reuse on-question (calculator, number line) - good for maths games. |
| Privacy | `lib/hubPrivacy.ts` `HUB_COLLECTION_PRIVACY` with a self-test that FAILS if a new `hub*` collection is not registered for erase/export | Any new game collection MUST be added there or `hubSelfTest5.ts` goes red. Good guardrail, use it. |
| Kid UI | `features/learninghub/family/KidMode.tsx`, `KidIconTabs.tsx`, `kidCopy.ts`; `mascot/`; child-scoped "stars dashboard" (P-03) | Stars exist as a UI/progress concept; I found no server-side XP/coin ledger (grep of hub routes returned no xp store) (inferred - verify). |
| e2e | Playwright, `e2e/helpers/{accounts,ui,tenantData,lessonFixture}.ts`, `cardWith(page, runUniqueName, text)` rule; specs `learning-hub-inperson.spec.ts`, `learning-hub-live-room.spec.ts`, `learning-hub-teaching.spec.ts` | Two-context pattern (tutor + family) already used. |

### 1.2 Gaps (what does not exist)

1. Join by short code. Every current join path needs a signed-in family/child account tied to `hubEnrolments`. No code, no anonymous/guest participant.
2. Server-authoritative question clock (a "question opened at T, closes at T+N" state machine). Existing time limits are per attempt (`startedAt + timeLimitMins + GRACE_MS`), not per question.
3. Per-answer scoring with latency, streaks, team totals, and leaderboards.
4. Payload-carrying realtime. SSE only says "refetch". At 30-40 clients a per-question broadcast plus refetch causes a thundering herd (40 GETs per question), fine for cost, ugly for latency. Need either an SSE payload variant or a tiny `GET /game/:id/state` that is cached per (session, questionIndex) - see 1.7.
5. Nickname generator / moderation. Repo grep found no profanity/nickname module; nothing to reuse.
6. Team model at session level (groups exist but are tutor-content groups, not game teams).
7. Retention job. The repo has lazy-sweep (no cron) - games need TTL deletion of per-answer rows.
8. Load-test harness (nothing under `scripts/` for it; `scripts/` only has i18n/curriculum tools).
9. Shared rate-limit store: in-memory limiter is per instance and per IP.

### 1.3 Session lifecycle

States: `lobby -> question_open -> question_closed(reveal) -> ... -> finished`, plus `paused`, `ended`(abandoned), `cancelled`.

- Create: `POST /game/sessions {gameId, sourceSpec, mode, teams?, settings}` (tutor). Server snapshots the chosen questions into the session (as `snapshotQuestions` does) so edits mid-game cannot change it, and stores `seed`.
- Join code: 6 chars, unambiguous alphabet (no 0/O/1/I/L), generated server-side, unique among live sessions (`gameCodes/{code}` doc -> `sessionId`, TTL 4h). Lobby-only: code stops working once tutor presses Start unless "allow late join" is on. Codes expire on end. Rate limit `POST /game/join` at 10/min/IP AND a global 60/min per code (kids on one school IP would share the per-IP bucket - that is why the per-IP limit must be generous, e.g. 60/min, while the anti-guess protection is a per-code attempt counter and code entropy: 30^6 ~ 7e8, 4h lifetime, so brute force is impractical at 10/min).
- Two join tiers (recommend BOTH, tutor picks):
  A. "Roster join" (best for privacy): tutor picks the enrolled children/groups up front; child opens `/play`, enters the code AND picks their own avatar tile from the roster grid of avatars (no names shown) or the family-signed-in child is auto-recognised via existing `/remote-sync/active`-style lookup. Identity = existing `childId`, so results write back to mastery.
  B. "Guest join": code only; server assigns a generated identity `Adjective+Animal+emoji` (e.g. "Brave Otter") from a fixed wordlist. No free text ever. Results are session-only and are not written to mastery (no childId), unless the tutor later maps the guest to a child.
- Anti-duplicate join: a signed cookie/`joinToken` (random 128-bit) returned on join; needed for every subsequent request. Reconnect = present the token (see 1.9).
- End: tutor `End`, or all-finished, or sweep after inactivity (reuse STALE_MS idea but shorter: 30 min).

### 1.4 Names, teams, safeguarding of identity

- Children NEVER type free text that other children see. Enforced by construction: the join endpoint accepts only `{code, avatarId?, rosterChildId?}`; `avatarId` is an enum from a fixed list. There is no name field in the API at all, so there is nothing to moderate and nothing to bypass by API abuse.
- Name modes (tutor setting per session): `generated` (Adjective+Animal, default for guest), `firstName` (enrolled child's first name only, tutor-enabled, shown on the big screen only if not "hide names"), `hidden` (rank shown as avatar only; leaderboard shows "You are 4th" privately), `anonymous-teams` (only team names).
- Wordlists: ~120 adjectives x ~120 animals (14k combos), curated by hand, stored as a TS const (like `HELP_TOOL_IDS`), profanity-audited once and re-checked in a selftest (concatenations of adjective+animal are the only risk; unit-test the cross product against a blocklist and against unfortunate pairs).
- Teams: tutor picks `teamCount` or "by group" (`hubGroups`). Assignment options: random balanced (seeded shuffle), by group, tutor-drag, or "mixed ability" using existing `hubMastery` bands (tutor-only; never shown to kids). Team names/colours from a fixed palette + animal (Red Foxes), no free text.
- Tutor controls (all server-enforced, mutate the session doc): pause/resume, skip question, kick participant (invalidate joinToken, blocks re-join for the session), freeze leaderboard (server stops publishing rank changes), hide names, no-ranking mode (server never computes/exposes ranks; only personal progress + class total), lock lobby, end game, extend time, "reveal now".

### 1.5 Question streaming, timing, anti-cheat

- Server holds the snapshot; the client receives only `questionOut` (prompt, options, image, `expects`) - never `answer`/`acceptedAnswers` (same discipline as `questionOut` in attempts.ts). Tool questions: send `PublicProblem` only.
- Server-authoritative clock: on open, server stamps `openedAt` (server time) and `closesAt = openedAt + limitMs`. Clients get `serverNow` in each response and compute offset (NTP-lite) only for the countdown visual; scoring never uses client time.
- Answer submit `POST /game/sessions/:id/answer {qIndex, response, joinToken}`; server records `receivedAt`. Reject if `qIndex != current` (or not own-pace-allowed), if already answered (idempotent first-write-wins via transaction/doc id `${qIndex}_${playerId}`), or if after `closesAt + grace`.
- Seeded per-player order and option shuffle (own_pace modes and Quizizz-style live): `rng = hash(sessionSeed, playerId)`; question order permuted, option order permuted server-side and the served option list is what the client sees; marking maps back via text (choice questions mark by exact option text in `markResponse`, so shuffling is safe). Lockstep modes (Kahoot-style) can keep a shared order but should still shuffle options per player to defeat "copy the neighbour's screen position" (option colours/positions differ).
- Anti-cheat realities: cannot stop a second device or a shouting neighbour. Mitigations: per-player shuffles, rate limit answers (1 per question), reject impossible latencies (< 250 ms after open, flagged not punished), tutor sees a "suspicious speed" hint only, no in-game currency you can steal (avoid Blooket "steal" mechanics), answers never in payloads (so devtools cheating is limited to timing).
- Written/manual questions are excluded from games. Prefer single/multi/number/short/match/order/tool.

### 1.6 Scoring and fairness (accessibility)

Recommended default model ("mastery-first", not speed-first):
- Points = base(difficulty) for correct; NO time bonus by default. Optional `speedBonus` toggle capped at +20% and off for `KS1`/support-flagged children.
- Never penalise wrong answers with big negatives; wrong = 0 (or "try again" once for half marks in cooperative modes).
- Streak bonus (capped) and "personal best" improvement bonus, so a child competes against their own last score - use last `weightedMastery` for that topic to set a personal target (server side, hidden).
- Latency fairness: (a) time limit is generous and per-child adjustable: reuse `effectiveLimitMins`/`child.support` (`noTimer`, extra time) from `attempts.ts` so children with support flags automatically get untimed/extended questions; (b) all scoring uses `receivedAt` minus a server-measured per-player RTT estimate (median of heartbeat round trips) when speed bonus is on, so slow wifi is not punished; (c) reading time: the timer starts when the client ACKs "question displayed" (a cheap POST), bounded by max +3s; text-to-speech (`features/learninghub/speak.tsx` exists) available on every question; (d) "no timer" per child is invisible to peers.
- Ranks: show top 5 + "you" only, never bottom of the list. "Hide names"/"no ranking" as above.

### 1.7 Transport at classroom scale (30-40 clients)

Options:
1. SSE (existing) + POST for answers. Server->client: SSE invalidation/payload. Client->server: POST. Works through every school proxy that lets HTTPS through; Chromebooks fine; auto-reconnect built into EventSource. Cost: one open connection per client (fine for 40; browsers cap ~6 per origin on HTTP/1.1, but `lib/realtime.ts` multiplexes into ONE stream per tab).
2. WebSocket. Lower latency, bidirectional, but needs a stateful server, sticky sessions, and some school filters break WS. Not needed for 40 clients with 1-2s latency tolerance.
3. Firestore listeners per client. Rejected: each listener attach reads the full result set, billed per doc per listener (see the header comment of `hubPing.ts` on why the stream avoids this). 40 clients x leaderboard doc of 40 players x every change = quadratic reads.

Recommendation: keep SSE + POST, but add a NEW small game channel instead of overloading the tenant stream:
- `GET /api/game/:sessionId/stream?joinToken=` (or ticket-style, single-use ticket as in `events.ts`, because EventSource cannot set headers) which serves ONE in-memory state object per session and pushes `event: state` with the full small payload (question public data, phase, `closesAt`, leaderboard top-N, your own score). 40 clients = 40 writes of a ~2 KB message per state change; trivial.
- Authoritative session state lives in process memory (a `Map<sessionId, GameRuntime>`) and is persisted to Firestore only at checkpoints (phase changes, every question close) so a server restart resumes from the last checkpoint. Answers are buffered in memory and flushed in ONE batched write per question close (`db.batch`, up to 500 ops), not per answer.
- Constraint to decide: this makes the API instance stateful for the duration of a game. If the API runs multiple instances behind a load balancer, need sticky routing by sessionId (or a single game-runtime instance). Today `rateLimit.ts` and `events.ts` tickets are already per-process Maps, so the deployment is effectively single-instance already; deployment topology (`server/` has no Dockerfile in the repo, I could not see hosting config) must be confirmed by the owner.
- Fallback when SSE fails (school proxy buffering): client falls back to long-poll `GET /game/:id/state?since=v` every 1.5-2s (heartbeat fold-in). Use ETag/`version` so unchanged polls are 304.

### 1.8 Cost model per session (Firestore, list prices approx: $0.06/100k reads, $0.18/100k writes; check current pricing)

Assume 30 kids, 20 questions.
- Naive: write each answer (600 writes) + write each player score (600) + leaderboard doc (20-600) + 30 listeners x 600 leaderboard changes = 18,000 reads. ~ 1,800 writes + 18,000 reads ~ $0.003 + $0.011 = about 1.5 cents. Cheap in absolute terms, but listener fan-out scales quadratically with class size and would blow up with concurrency (100 concurrent classes = $1.50/hour of peak).
- Recommended: in-memory runtime, 1 session doc write per phase change (~60), 1 batched answers flush per question (20 batches, ~600 doc writes total, or 20 writes if answers are stored as one doc per question with a map `answers[playerId]` - beware 1 MiB doc limit: 30 players x ~200 B = 6 KB, fine), 1 final results write per child (30 attempts docs, only for roster kids), ~5 reads. Total ~ 700 writes, ~50 reads ~ $0.0013 per session. Effectively free. The dominant cost is engineering, not Firestore.
- Compute: 40 SSE connections is a few MB of memory and negligible CPU. Load-test to confirm event-loop latency stays under 50 ms.
- Storage: answer rows are transient (TTL 30 days default); only aggregate results persist.

### 1.9 Reconnection and failure modes

- Reconnect: `joinToken` in `sessionStorage` + `localStorage` fallback; on reload, `POST /game/rejoin` returns full current state. The server treats absent players as still in the game (no auto-remove); answers they missed are simply not submitted (0), never a penalty beyond that question.
- School wifi: (a) captive portals/proxies buffering SSE - use `X-Accel-Buffering: no`, 25s `:ping` (already done in events.ts), poll fallback; (b) many kids behind one IP - rate limits must key on `joinToken`/`playerId` after join, and per-code rather than per-IP for join; (c) packet loss - answer POST retried with idempotency key `${qIndex}_${playerId}`; local "answer queued" state; server accepts up to `closesAt + grace` (grace = max(2s, measured RTT x 3), reuse the `GRACE_MS` philosophy).
- Chromebooks: low RAM and old Chrome - no heavy canvas/WebGL in v1; use CSS-only animations, `prefers-reduced-motion` respected, touch targets >= 48px, avoid `structuredClone` etc. (verify targets in `next.config`/browserslist). Test at 4GB RAM Chromebook via CPU throttling in Playwright/CDP.
- Tutor disconnect: session goes `paused` after 60s without tutor heartbeat (children see "Waiting for your teacher"); resumable. Second tutor device takeover allowed.
- Server restart: runtime rebuilt from last checkpoint; current question re-opens with fresh `closesAt` (documented, rare).
- Clock skew: never trust client clocks (see 1.5).
- Big-screen mode: separate `?display=1` view with a read-only ticket; shows question, timer, distribution after close, top 5; no names if hidden.

### 1.10 What is written to mastery / homework afterwards

- On finish, for each ROSTER child (has `childId`), create one `hubAttempts` doc via the same shape as `attempts.ts` (`assessmentType: "game"` or reuse "practice"; `questions` snapshot, `answers` marked with `markResponse`, `pct`, `status: "marked"`), then call `refreshMastery({tenantId, childId, franchiseId})`. Because `weightedMastery` weights the last 5 slices per topic, a noisy game session should count at reduced weight - propose a `weight` or `source: "game"` field and treat game slices as 0.5x in `hubMastery.ts` (needs a small change and selftest; decision #4 below).
- Games are also a homework type: `hubHomework` assigns a game "solo/async mode" (see phase 1); completion writes the same attempt doc, so the existing homework completion + marking queue + digest (`hubDigest.ts`) pick it up unchanged.
- Flashcard games write `hubFlashcardReviews` through the existing review path so SRS state advances legitimately (only for roster children).
- Guests: no writes to child data. Only aggregate session stats for the tutor.
- Teacher-facing debrief: per-question % correct, "most common wrong answer" (choice questions), children needing help - all computed from the buffered answers at close.

### 1.11 Privacy, UK Children's Code, retention

- No persistent public profile; no chat; no free-text; no friend lists; no cross-session leaderboards visible to other children; no location; no third-party analytics SDKs on the play page (check `package.json` deps - I did not audit).
- Data minimisation: guest sessions store `{playerId, generatedName, avatarId, answers}`; no IP is stored beyond rate-limit memory. Roster sessions store `childId` only.
- Defaults high privacy (Children's Code standard 7): names hidden on projector unless tutor enables; ranking off for under-8 (KS1) by default; no nudge techniques (no streak-loss guilt, no "your friends are playing" pings, no variable-reward loot boxes, no in-game purchases); age-appropriate copy from `kidCopy.ts`.
- Retention: per-answer rows TTL 30 days (Firestore TTL policy on `expireAt`, or a sweep on tutor listing like `sweepIfStale`); session doc + aggregates 12 months or tenant policy; guest sessions purge at 30 days; roster attempts follow existing child data policy and erase on `eraseChildLearning`.
- Register every new collection in `HUB_COLLECTION_PRIVACY` (`how: "delete"` for child-keyed, `"scrub"` for session docs listing children, `"none"` for wordlists/codes) and in export/erase, otherwise the existing self-test fails.
- DPIA addendum + update privacy notice; parents able to see what a game stored (export path exists in `routes/privacy.ts`).

### 1.12 Safeguarding review checklist (gate before any live mode ships)

- [ ] No API field accepts child-authored text visible to others (grep the OpenAPI for string fields on `/game/*`).
- [ ] Generated names cross-product passes blocklist selftest (incl. l33t and multi-language).
- [ ] Kick and lock work and are server-enforced; kicked token cannot rejoin.
- [ ] Join code cannot be enumerated (rate limit, entropy, expiry, lobby-only).
- [ ] Guest cannot see roster names or any other child's real name.
- [ ] Tutor can hide names/ranks instantly; big-screen honours it.
- [ ] No answer keys in any response (automated test: JSON-walk all `/game/*` responses for `answer`, `acceptedAnswers`, `explanation` before reveal).
- [ ] Anonymous sessions cannot write to child records.
- [ ] Timers/streak mechanics reviewed against Children's Code nudge guidance; reduced-motion + no-timer modes present.
- [ ] Retention/erasure verified by `hubSelfTest5`-style test for new collections.
- [ ] Audit log (who started, ended, kicked) for tutor actions.
- [ ] Photos/images in questions come from tenant content only (existing `hubMedia`), no user uploads in games.
- [ ] Safeguarding lead sign-off; tutors briefed that the tutor is the moderator.

### 1.13 How a game plugs in - interface sketch

```ts
// features/learninghub/games/types.ts (shared client+server pure module, like tools/problems.ts)
export type GameId = string;

export interface QuestionSource {
  kind: "assessment" | "topicPool" | "flashcards" | "generator";
  assessmentId?: string;            // reuse hubAssessments
  topicIds?: string[]; years?: number[]; difficulty?: (1|2|3)[];
  cardIds?: string[];
  generator?: { id: string; count: number };  // ToolSpec / seeded generators
}

export type GameMode =
  | "solo"            // homework / own device, no session
  | "live_classic"    // lockstep, tutor-paced (Kahoot-like)
  | "live_own_pace"   // everyone free-running to a target (Blooket/Gimkit-like)
  | "team_coop"       // team shares one score / one goal
  | "class_coop"      // whole class vs the game (no ranks)
  | "in_person_board";// big screen + tablets

export interface ScoringPolicy {
  base: (q: PublicQ, difficulty: 1|2|3) => number;
  speedBonus?: { maxPct: number; disabledForSupport: true };
  streak?: { cap: number };
  personalBest?: boolean;
  penalty?: 0;                      // wrong answers never negative
  team?: "sum" | "mean" | "shared_goal";
}

export interface GameTelemetry {
  onAnswer?(e: { qIndex: number; playerId: string; correct: boolean; ms: number }): void;
  summary(session: SessionResults): { perQuestion: PerQ[]; needsHelp: string[]; celebrate: string[] };
}

export interface GameDefinition<State = unknown> {
  id: GameId;
  title: string;
  subjects: string[]; ages: { minYear: number; maxYear: number };
  questionSources: QuestionSource["kind"][];   // what it can consume
  modes: GameMode[];
  minPlayers: number; maxPlayers: number;
  scoring: ScoringPolicy;
  telemetry: GameTelemetry;
  /** Pure server-side reducer: (state, event) -> state. No IO. Selftest-able like hubScoring. */
  init(cfg: { seed: string; players: string[]; teams?: string[][]; questions: number }): State;
  reduce(state: State, ev: { type: "answer"|"tick"|"tutor"; playerId?: string; correct?: boolean; at: number }): State;
  /** What each client may see of State (NEVER answers). */
  publicView(state: State, viewer: { playerId?: string; role: "player"|"tutor"|"display" }): unknown;
  /** Client component registered like lib/view-registry.tsx. */
  Component: React.ComponentType<{ view: unknown; send: (a: unknown) => void }>;
}
```

The framework (session, join, clock, transport, marking, persistence, tutor controls) is generic; each game is a pure `reduce` + `publicView` + a React view. Marking always goes through `markResponse`.

### 1.14 Firestore collection sketch

```
gameSessions/{sessionId}          tenantId, franchiseId, tutorUid, gameId, mode, status(lobby|open|closed|paused|finished),
                                  seed, settings{nameMode,ranking,speedBonus,noTimerAllowed,allowLateJoin},
                                  questionSnapshot[] (private; tutor/API only), qIndex, openedAt, closesAt,
                                  teams[{id,colour,name}], createdAt, updatedAt, expireAt
gameCodes/{code}                  sessionId, tenantId, expireAt          (TTL 4h)
gamePlayers/{sessionId_playerId}  sessionId, playerId, childId|null, avatarId, generatedName, teamId, joinTokenHash,
                                  kicked, connectedAt, score, streak, expireAt
gameAnswers/{sessionId_q_player}  (optional; may be buffered as one doc per question)  response, correct, marks, receivedAtMs, rttMs, expireAt
gameResults/{sessionId}           aggregates, per-question stats, per-child summary, written at finish (tutor-visible)
```
Registered in `lib/hubPrivacy.ts` HUB_COLLECTION_PRIVACY; add `gameSessions` to `HUB_DIRECT_CHANNELS` ONLY for tutor list views (via existing `hubLessons` pattern if `mode: "game"` is stored in `hubLessons` instead - decision for owner/dev: separate collection is cleaner and avoids polluting lesson lists, which already have to exclude `remote_sync`/`in_person`).

New routes: `server/src/routes/hub/gameApi.ts` (tutor), `server/src/routes/gamePlay.ts` (public join/play: code + joinToken, no Firebase auth for guests, strict rate limits, no cookies with PII); register in `server/src/index.ts` and `server/openapi.yaml` (tag `games`). New client: `features/learninghub/games/*`, `app/play/[code]` (public page), registered in `lib/view-registry.tsx`.

---------------------------------------------------------------------------
## PART 2 - Competitor mechanics research
---------------------------------------------------------------------------

Sources: Ditch That Textbook comparison https://ditchthattextbook.com/game-show-classroom-comparing-the-big-5/ ; Nibble comparison https://nibble-app.com/blog/gimkit-vs-kahoot ; Teachfloor https://www.teachfloor.com/blog/blooket-vs-gimkit-vs-kahoot--vs-quizizz ; Quizlet Live intro https://quizlet.com/blog/introducing-our-first-collaborative-learning-game-for-the-classroom-quizlet-live ; Quizlet individual mode https://quizlet.com/blog/1297 ; Quizlet Live help https://help.quizlet.com/hc/en-us/articles/360030985431-Starting-a-game-of-Classic-Quizlet-Live-in-teams-mode ; Pear Deck anonymous participation https://www.peardeck.com/blog/6-ways-to-use-anonymous-participation-with-pear-deck ; Nearpod FAQ https://nearpod.com/blog/virtual-learning-faq/ ; cooperative games research https://www.cooperativegames.com/whitepaper-the-value-of-cooperative-games , https://pmc.ncbi.nlm.nih.gov/articles/PMC8248432/ , https://corwin-connect.com/2016/01/cooperative-games-101-what-are-cooperative-games-and-how-can-they-help-education/ . Note: search snippets and a small-model summariser were used; treat pricing and player caps as indicative and verify on vendor pages before quoting.

| Product | How live mode works | Loved | Hated / complaints | Pricing hook |
| --- | --- | --- | --- | --- |
| Kahoot | Shared big screen; PIN join; lockstep questions, speed-weighted points, podium; Classic, Team mode, Test, Learn | Instant familiarity, music, natural pause points for teaching; huge library | Fast pace rushes slower processors; time pressure enables copying; inappropriate nicknames (Kahoot documents filtering protocols); 4 answer max | Free tier player caps (40 educators, ~10 for some free games per Nibble), paid tiers, AI generator premium |
| Quizizz / Wayground | Self-paced live or async; randomised questions per student; Paper Mode for non-device kids | Low stress, accessibility (read-aloud, dyslexia fonts, translation), reports | Less shared buzz | AI content generation, adaptive maths bundles |
| Quizlet Live | Teams of 3+, min 6 players; answers spread across teammates so nobody dominates; team resets to zero on a wrong answer | Forces peer talk; built from existing sets | Wrong answer reset causes friction/unkindness to the child who erred; min-player rule blocks small groups (later added Individuals mode) | Quizlet Plus |
| Blooket | Game modes (arcade, tower-defence) where correct answers earn currency; host or homework | Enthusiasm, good solo/homework use, themed modes | Game mechanics overshadow learning; stealing/steal-other-player mechanic; nickname abuse and hack-flooding of lobbies with inappropriate names | Seasonal events, rare "Blook" unlocks |
| Gimkit | Answers earn in-game money, reinvest in upgrades; 2D worlds; team and "Trust No One" modes | Strategy, economics, engaging for upper primary+ | Learning curve; Trustpilot ~2.9/5 (per Nibble) | Pro subscription (~$60/yr), school plans from ~$1k; free tier caps pro modes to ~5 players |
| Nearpod | Teacher-paced slides with embedded polls/quizzes; student-paced modes; Time to Climb | Fits existing lessons; privacy pledge | Heavier setup | School/district licences |
| Pear Deck | Slide-embedded participation; can run anonymous (dashboard shows avatars, not names) | Anonymous mode lowers exposure | - | Premium features |

### Cross-cutting lessons
1. Speed-weighted scoring is the #1 source of stress and unfairness; Quizizz's self-pacing is the antidote. Do NOT default to speed bonus.
2. Free-text nicknames are the #1 moderation problem on every platform. Our pre-approved names remove the problem class.
3. Per-player shuffles reduce copying without any surveillance.
4. Team mechanics that punish the individual (Quizlet reset) breed conflict. Use shared-pool/no-loss cooperative rules.
5. The pricing hooks are content generation, player caps and modes - we own the curriculum and are per-tenant, so games should be a tier-included feature (see decisions).
6. Homework/async play of the same game (Blooket, Quizizz) drives most usage; live is the "event". Build solo/async first (phase 1).

### Best low-stress cooperative modes to build (ranked)
1. Class boss / "Beat the Timer as a class" - the whole class fills one meter; every correct answer adds; wrong answers cost nothing; a personal-best bonus rewards improvement. No ranks. (Fits `class_coop`.)
2. Team relay with shared goal - teams of 3-4 each answer a different question part; team progress never decreases; team "helps" via a hint token that anyone can spend (Quizlet-Live spirit, without the reset).
3. Build/Grow - correct answers add pieces to a shared garden/rocket/reef displayed on the projector; class unlocks the next scene (visual, calming, no leaderboard).
4. Pair-and-share - two devices, one question split between them (one sees the clue, one the options); pairs seeded by tutor. Forces talk.
5. Rapid-fire flashcard race against yesterday's class average (ties into SRS).
6. Mystery unlock - class collectively finds a hidden picture/word; wrong answers are ignored.
Competitive modes remain available but opt-in per session, with ranking off for KS1 by default.

---------------------------------------------------------------------------
## PART 3 - Phased build plan
---------------------------------------------------------------------------

Effort assumes one full-stack dev familiar with the repo; ranges in working days.

### Phase 0 - Spike (3-5 days)
- Prove: in-memory `GameRuntime` + SSE state stream + POST answer + batched flush, with 40 fake clients, on the existing Express app. One trivial game ("Speed Sum" using an arithmetic generator + `markResponse`).
- Deliver: `scripts/loadtest-game.ts` (tsx): spawns N (default 40) simulated players; joins with a code, opens SSE with `fetch`/`eventsource`, answers each question with random latency 0.3-6s and 5% packet loss/retries, and injects reconnects; reports p50/p95 state-fanout latency, answer POST latency, event-loop lag, memory, Firestore op count (against the emulator - `server/firestore-debug.log` suggests the emulator is in use).
- Exit criteria: p95 fan-out < 500 ms at 40 clients, zero answer keys in payloads, one instance survives restart with checkpoint resume.
- Risk: deployment is stateful; confirm hosting.

### Phase 1 - Solo games in homework (2-3 weeks)
- Solo game framework (`GameDefinition`, `reduce`, `publicView`), 3-4 games: Match-up (flashcards/`match`), Number Bond Sprint (generator), Sort-it (`order`), Word Builder. Kid-mode integration in `KidMode.tsx`, assignable from `HomeworkPanel` as a homework kind, results into `hubAttempts` + `refreshMastery`, `hubFlashcardReviews` for card games.
- Server-side answer marking through `markResponse`; "game" attempt weight decision (#4).
- Themed stars/collectibles but purely cosmetic and non-purchasable; reduced-motion; TTS.
- Tests: pure selftests for scoring/reducers (pattern: `hubAccess.selftest.ts`), e2e spec `e2e/learning-hub-games-solo.spec.ts` with `cardWith` anchored assertions (assign -> child plays -> tutor sees score in this run's homework row).
- Risks: game design/art quality is the real effort; keep the framework thin.

### Phase 2 - Tutor-hosted live mode (3-4 weeks)
- Session lifecycle, join by code (roster join first, then guest join with generated names), lobby, teams, lockstep + own_pace, tutor controls (pause/kick/skip/freeze/hide names/no-ranking), big-screen `?display=1`, poll fallback, reconnect, retention TTL, `HUB_COLLECTION_PRIVACY` registration, openapi tag `games`.
- 2 live games: Classic Quiz (lockstep, mastery scoring) and Class Boss (cooperative).
- Safeguarding checklist (1.12) completed and signed off before pilot with 1-2 friendly tutors.
- Tests: e2e with 3 browser contexts (tutor + 2 kids, plus a display page) covering join, question, answer, reveal, leaderboard, kick, reconnect-after-reload, hide-names; the responses-contain-no-answer-key walk test; nickname cross-product selftest; rate limit test.
- Risks: school wifi/proxy behaviour (needs real-school pilot), name/identity policy, stateful hosting.

### Phase 3 - Classroom scale + polish (3-4 weeks)
- Concurrency: shared rate-limit store (Redis or Firestore counters) if more than one API instance; sticky sessions or a dedicated game-runtime process; backpressure and per-tenant concurrent-session caps; metrics (active sessions, fan-out latency, error rates).
- More modes (team relay, Build/Grow, in-person board mode using `inperson/*` for tablets), tutor session library/scheduling, post-game debrief report and parent digest line (`hubDigest.ts`), accessibility audit (WCAG 2.2 AA), Chromebook device-lab pass, i18n via `scripts/i18n-check-*.mjs` pattern (new `hubgames` namespace).
- Load test in CI nightly: 40 clients x 5 concurrent sessions on the emulator; budget assertions.
- Risks: reliability expectations rise once teachers run whole lessons on it; need a "degraded mode" (tutor can switch a live game to own-pace/solo if the room breaks).

Total: about 9-12 weeks for one dev, 6-8 with two.

### Test strategy summary
- Pure selftests (fast): scoring, reducers, name generator blocklist, option shuffle/mark round-trip, seeded per-player order determinism.
- API contract tests against emulator: lifecycle transitions, idempotent answers, late answers, kicked token, expired code, no-key leakage walker.
- e2e Playwright (multi-context) per phase as above, anchored with `cardWith(page, runUniqueName, ...)` rule from AGENTS.md; throwaway `@activityos-test.com` accounts; add to `e2e:cleanup`.
- Load: `scripts/loadtest-game.ts` (tsx) with fault injection (latency, drops, reconnect storms, 40 clients from one IP to validate rate-limit keys).
- Manual: Chromebook + iPad + phone on throttled network (CDP "Slow 3G"), projector legibility, one pilot classroom.

### 5 decisions the owner must make
1. Guest join or roster-only? Guest (code + generated animal name) is what makes "any device" work and matches Kahoot/Blooket, but guests cannot write to mastery and widen the safeguarding surface. Recommendation: ship roster join first, add guest join in phase 2 behind a per-tenant switch, default off for under-11 tenants.
2. Scoring philosophy: mastery-first (no speed bonus, cooperative default, ranks off for KS1) versus Kahoot-style speed competition. Recommendation: mastery-first default, speed bonus and ranks as tutor opt-ins.
3. Hosting/statefulness: are we willing to run game sessions in a single stateful process (sticky/single instance) for v1? Alternative is a dedicated small game server or a managed realtime layer (Ably/Pusher/Firebase RTDB) which adds cost and a data processor to the DPIA. Recommendation: in-process for pilot, revisit at phase 3.
4. Do game results count toward mastery and reports, and at what weight? (0 = fun only; 0.5x recommended; 1x risks noisy mastery.) Also whether guest results can be claimed by a child later.
5. Commercial packaging and retention: included for all tenants vs a paid add-on, per-tenant concurrent-session caps, and the retention period for answer rows (30 days recommended) - plus who signs off safeguarding/DPIA before any child touches a live session.

### Top risks
- Stateful runtime and restarts mid-lesson (mitigate: checkpoints, tutor "resume").
- School networks (mitigate: poll fallback, pilot early).
- Content quality: games only feel amazing if question feedback and art are excellent; the framework is the easy part.
- Name/identity policy drift ("just let them type a name") - the API deliberately has no name field; keep it that way.
- Scope creep into a Gimkit-like world engine; keep phase 2 to quiz-shaped games with skinned presentation.

### Unverified / to check
- Hosting topology (no Dockerfile or deploy config seen in `server/`).
- Whether any server-side XP/coin ledger exists (only UI stars found).
- Current Firestore prices and competitor prices (indicative only).
- I read remoteSyncApi.ts fully at header level and skimmed inPersonApi/attempts/events/hubCache/hubScoring; teachingApi.ts, lessonApi.ts, questions.ts, and the live workspace/board internals were not read line by line.
