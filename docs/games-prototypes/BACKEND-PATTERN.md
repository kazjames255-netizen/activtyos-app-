# Wiring a Learning Hub game to a real backend

Every game in the Learning Hub arcade must have real server-side scoring and a real progress trail **from the
moment it is built** - never shipped as a client-only prototype, even briefly. This is the checklist. It distills
`server/src/lib/hubGames.ts` + `server/src/routes/hub/gamesApi.ts` + `features/learninghub/games/penguin/` (the
first game wired this way) and `features/learninghub/games/turbo/` (the second - a reskin of the same engine,
see "same domain, new skin" below) so a future agent doesn't have to re-read all of that source to get a new game
plugged in correctly.

## The one rule everything else follows

**The browser never sends a score.** It sends an input log (or, for a typed-answer format, the typed answers). The
server re-simulates or re-marks from a seed IT issued, and computes the real result. A modified client can lie
about anything it wants; it can only ever change what the server *ignores*.

Concretely: `POST /games/sessions` issues `{ sessionId, seed, cfg, plan }` before a single question is shown.
`POST /games/sessions/:id/finish` takes only `{ log }` or `{ answers }` and returns the result the server itself
computed by replaying `(seed, cfg, plan, log)` through the same deterministic function the client used to render
the run. If the client and server ever disagree, the server wins, silently and always.

## Step 1 - is this actually a new skill domain, or a new skin on one you already have?

Before writing a new simulation, check: does the new game ask the same kind of question over the same fact
universe as an existing game (e.g. "steer into the lane with `a * b`", 2-12 times tables)? If so:

- **Reuse the existing core wholesale** (`export * from "../<other-game>/core"` - see
  `features/learninghub/games/turbo/core.ts`). Do not fork the physics/scoring math to reskin it; a fork means two
  places that can each be subtly wrong.
- **Share the Firestore collections.** Two games teaching the same facts should update the SAME per-fact mastery
  doc, not two independent ones - a child's progress in the fluency map should not depend on which skin they
  clicked. Tag the session with which game asked for it (`skin: "penguin" | "turbo"` on the session doc) purely
  for reporting; never branch scoring logic on it.
- **Only the render layer, the mode menu and the theme need to be new.** `features/learninghub/games/turbo/engine/render.ts`
  is the actual new content for Turbo Slide; `engine/game.ts`, `engine/input.ts`, `engine/fx.ts`, `engine/audio.ts`
  and `core.ts`/`run.ts`/`record.ts` are reused unchanged (either imported directly or re-exported).

If the new game teaches a genuinely different thing (spelling patterns, not number facts; a different mechanic
entirely), model its own state doc around what it *actually* teaches - do not force it into an existing fact-key
shape it doesn't fit. Read the game's own design doc (`docs/games-prototypes/`, `docs/games-research/`) for what
it teaches before assuming.

## Step 2 - three Firestore collections, all keyed by `(tenantId, childId, ...)`

| Collection | One doc per | Holds |
| --- | --- | --- |
| `hubGameSessions` | run (or attempt) | the seed/config/plan issued at start; once finished, the re-simulated `result`, `summary`, and a privacy-safe `trials` array (one row per answered question: itemId, tags, correct/miss/guess, response time, error type) |
| `hub<Skill>State` (e.g. `hubFactState`) | (child, skill unit) | the FSRS-lite/Elo state for that one fact/word/concept: stability, difficulty, next-due date, recent latencies, the wrong answers actually given |
| `hubGameProfile` | child | personal bests, ability estimate (theta), baseline response time, points today, days practised, pinned focus areas |

A second game on the SAME skill domain reuses rows 2 and 3 as-is (see Step 1); it still gets its own rows in row 1
(sessions), tagged with `skin`/`gameId`.

## Step 3 - the API surface (add to `server/openapi.yaml` tag `hub-games`, don't invent a parallel contract)

- `POST /games/sessions` - family only, and specifically a **plain parent, not a tutor/staff account acting for a
  child** (`ctx.role !== "parent" || ctx.canEdit` -> 403 "Games are played from a student's own account"). Resolve
  the child, rate-limit per child (12 runs / 10 min is the existing convention - `rateLimit(...)` at the route plus
  an in-process per-child counter), build the config/plan server-side from the child's saved state (never trust a
  client-sent plan), store the session, return `{ sessionId, seed, cfg, plan, ... }`.
- `POST /games/sessions/:id/finish` - takes the input log (or typed answers), loads the stored session, checks it
  hasn't expired (48 h TTL is the existing convention) and isn't already `done` (return the stored result again if
  it is - **idempotent**, because a flaky connection WILL cause a retry), re-simulates, and inside one Firestore
  transaction: reads the current fact-state + profile docs, applies the update, writes them back, marks the
  session `done` with its `result`. Never write outside a transaction when more than one collection changes
  together.
- `GET /games/<game-id>/facts` (or your skill's equivalent) - family (their own child) + tutor read of the mastery
  map. If two games share the skill domain, this is the SAME handler mounted at two paths (see
  `/games/turbo-slide/facts` aliasing `/games/penguin-slide/facts` in `gamesApi.ts`) - not a second implementation.
- A tutor-only `PUT .../pin` (or equivalent) to let a tutor steer what the game practises, if that concept applies.

## Step 4 - the client is a thin, replaceable shell around the same pure functions the server uses

- `store.ts` exports a `Backend` interface with `start`/`finish`/`facts` (see `features/learninghub/games/turbo/store.ts`).
  A `liveBackend()` hits the real API; a `demoBackend()` runs the identical pure `buildRun`/`replay`/`recordRun`
  functions against `localStorage`, so a no-account demo plays exactly like the real thing and is honestly labelled
  as a demo (never silently treated as progress that will survive).
- The on-screen game loop (`engine/game.ts`) owns a fixed-tick accumulator, calls the shared `step()` each tick,
  and pushes `[tick, packedInput]` onto a log only when the packed input actually changes (keeps the log small).
  It **never computes score** - it reads `sim.fish`/`sim.streak`/etc for display only; the number that gets
  recorded is whatever `finish()` returns from the server.
- On "done", send the log immediately. Show the server's answer, not a locally-computed one, even though they will
  almost always agree - the point is that the display path and the trust path are the same path.

## Step 4b - pause / resume: mid-run is a real state, not an abandon

**Every game must be resumable, not just startable.** A child who taps away mid-run ("Back to Games", closing the
tab, losing signal) must be able to come back - later in the same visit, or after a fresh page load - and pick up
exactly where they left off. "Abandon the session and quietly start a new one next time" is not resume; the Games
tab must never lie with a "Continue" label that actually starts over.

The trick: because a finished run is already re-simulated by REPLAYING `(seed, cfg, plan, log)` from tick 0 (the one
rule at the top of this doc), **a mid-run checkpoint is just that same log, saved early.** No separate "resume
verification" logic is needed - `finish()`'s existing replay already re-checks the whole thing, checkpoint included,
every time.

- **Checkpoint on exit, not on every tick.** When the player leaves mid-run (before the sim reaches `done`), the
  client sends its current input log + tick (`Game.snapshot()` in `engine/game.ts`) to
  `POST /games/sessions/:id/checkpoint`. The server re-verifies it actually replays cleanly (calls `replay()` on it)
  before storing `{ log, endTick, savedAt }` on the session doc and flipping its status to `paused`. A checkpoint on
  an already-`done` or expired session is a silent no-op (`{ saved: false }`), never an error - exiting twice, or
  after the run already finished naturally, is normal.
- **`GET /games/sessions/resumable?skin=`** - is there a still-resumable (`started` or `paused`, not expired) session
  for this child + skin? The Games tab card calls this (once per game) to decide "Continue" vs "Play" for real,
  instead of guessing from whether any fact has ever been played.
- **`GET /games/sessions/:id/resume`** - fetch ONE specific session: everything `POST /games/sessions` would have
  returned (seed/cfg/plan/best/facts/journey), plus the server-held `checkpoint`. Never accepts a client-supplied
  position - the checkpoint is exactly what `checkpointSession()` last accepted and re-verified.
- **The client rebuilds by replaying, then keeps going live.** `Game.resume(seed, cfg, plan, checkpoint.log,
  checkpoint.endTick, bestPace)` calls the exact same pure `replay()` the server uses to fast-forward a fresh `Sim`
  to that tick (silently - `emit` stays off during the fast-forward), then flips `emit` back on and the normal fixed-
  tick loop carries on from that exact state (queue position, score, world position - everything, because `Sim` is a
  complete state object). New ticks append to the SAME log array `finish()` will eventually send in full, so a
  resumed run's finish still replays start-to-finish from tick 0 - exactly as trustworthy as a run played in one
  sitting, never a special "resume" trust path.
- **The UI never owns the decision, the server does.** `Backend.resumable()` / `Backend.resume()` (`store.ts`) are
  what the game component (`PenguinJourney.tsx` / `TurboSlide.tsx`) calls on mount when the shell already told it
  (via a `resume` prop) there's something to pick up; the shell itself only ever holds a boolean per game, never a
  session id or a log, keeping the actual state server-side (or, for the offline demo backend, in the same
  `localStorage` blob the rest of the demo already lives in).
- **Exiting mid-run is the shell's button, the game's job.** The "Back to Games" control usually lives OUTSIDE the
  game component (GamesPanel.tsx's `GameRunner`, sitting above the bounded canvas box) so it can't itself see the
  live `Sim`. Wire it as a token prop (`exitToken`, bumped on click) that the game component watches: on change, if a
  run is actually live, snapshot + checkpoint (fire-and-forget - a failed save just costs the child one "Play"
  instead of "Continue", never a scoring risk) and only then call the real `onExit`.
- **A session past resumability must fall back to "Play" honestly** - already finished (`status: "done"`) or past
  its 48 h TTL. Nothing extra to build here: `resumableSession()` filters on exactly those two conditions, the same
  ones `finishSession()` already checks.

## Step 5 - verify it for real before calling it done

- `npx tsc --noEmit` and `npm run build` clean, in both `server/` and the web app.
- Throwaway `@activityos-test.com` accounts (never the shared e2e queue, never real tenants) driven by your own
  Playwright script: sign up, start a session, send a log, confirm the server result differs from whatever the
  script pretended (e.g. send a log with all-wrong answers and confirm the server doesn't award full marks), and
  confirm a repeat `finish` call on the same session returns the same result (`repeat: true`).
- Confirm the shared skill-state collection actually shows the practice from BOTH games if you reused Step 1's
  sharing (play a fact wrong in one game, confirm the other game's UI reflects it as weak).

## Standing content rules (apply to every game, not just fact-fluency ones)

- Never mention "Oak" / Oak National Academy anywhere in UI text or code comments.
- No green as a persistent brand colour, no chat, no public ranking, no paid/random rewards, no time pressure on
  the *thinking* part of a question (a game's own arcade mechanic - e.g. a car needing to move somewhere - is fine;
  a countdown on reading the question is not, unless a support profile has explicitly opted into a "sprint").
- Respect the calm/no-timer support profile: force it, don't just offer it, and check `prefers-reduced-motion`.
