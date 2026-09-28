import { Router } from "express";
import { ageInYears, childDobs, hubConfig, okId, resolveCtx, requireEdit } from "../../lib/hubCore";
import { rateLimit } from "../../lib/rateLimit";
import { checkpointSession, factsOverview, finishSession, GameError, journeyOverview, resumableSession, resumeSession, sessionsCol, setPinned, setUnlockAll, startMtc, startSession } from "../../lib/hubGames";
import { childFacts, childFor, nowIso, requestedChild } from "./shared";
import { pingHub } from "../../lib/hubPing";
import { finishQuiz, isQuizGameId, quizProgress, startQuiz } from "../../lib/hubQuizGames";
import { botFoundryProgress, finishBotFoundry, startBotFoundry } from "../../lib/games/botFoundry";
import { finishSortYard, sortYardProgress, startSortYard } from "../../lib/games/sortYard";
import { finishTraining, startTraining, trainingProgress } from "../../lib/games/trainingGround";

// Bot Foundry / Sort Yard / Training Ground: three MORE genuinely different mechanics (a block-program-vs-grid
// simulator, a sort/chart/order data-handling grader, and a generic typed-answer drill engine respectively) - each
// gets its own start/finish/progress module (server/src/lib/games/*.ts) sharing only the POST /games/sessions
// contract and the hubGameSessions collection, same as MTC and the quiz-quest trio above. See each module's own
// header and features/learninghub/games/<game>/core.ts for the pure engine + curriculum content.
type MiniGameId = "bot-foundry" | "sort-yard" | "training-ground";
const isMiniGameId = (v: unknown): v is MiniGameId => v === "bot-foundry" || v === "sort-yard" || v === "training-ground";
/** A child's own year group ("Year 4", "4"...) narrowed to the couple of NC years either side, for the puzzle/data
 *  banks that are tagged by year; unknown/free-text year groups fall back to "no filter" (the full bank). */
function yearsAround(yearGroup: string | null | undefined): string[] | undefined {
  const n = yearGroup ? Number(String(yearGroup).match(/\d+/)?.[0]) : NaN;
  if (!Number.isFinite(n)) return undefined;
  return [String(Math.max(1, n - 1)), String(n), String(n + 1)];
}

// Learning Hub - GAMES. Penguin Slide (docs/games-research/03-concepts.md) and its highway reskin Turbo Slide
// (features/learninghub/games/turbo/) - same server-authoritative simulation, same fact-mastery data, see
// docs/games-prototypes/BACKEND-PATTERN.md. Contract: server/openapi.yaml, tag "hub-games".
//   POST /games/sessions              family: start a run (mode solo | quick | calm | mtc, optional skin: "penguin" | "turbo"). The server issues seed + config + plan (facts, weakest first). ?tenantId= as every family hub call.
//   POST /games/sessions/:id/finish   family: send the INPUT LOG; the server re-simulates from the seed and records the result. Idempotent.
//   GET  /games/penguin-slide/facts   family + tutor: fact strengths (the thaw map; tutors also get slow/wrong lists and runs). /games/turbo-slide/facts is the same read (shared data), for the Turbo Slide UI.
//   PUT  /games/penguin-slide/pin     tutor: pin the tables a child should practise (they win over Pip's picks). /games/turbo-slide/pin is the same write.
export const hubGamesApi = Router();

// Cheap in-process guard on top of the per-IP limit: a child can't open more than 12 runs in 10 minutes.
const recent = new Map<string, number[]>();
function tooMany(childId: string): boolean {
  const now = Date.now(); const xs = (recent.get(childId) ?? []).filter((t) => now - t < 600_000);
  if (xs.length >= 12) { recent.set(childId, xs); return true; }
  xs.push(now); recent.set(childId, xs);
  if (recent.size > 5000) recent.clear();
  return false;
}

hubGamesApi.post("/games/sessions", rateLimit("hub-games-start", 40), async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (ctx.role !== "parent" || ctx.canEdit) { res.status(403).json({ error: "Games are played from a student's own account" }); return; }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const child = await childFor(ctx, ctx.childId ?? (typeof body.childId === "string" ? body.childId : ctx.children.length === 1 ? ctx.children[0]!.childId : null), res, { needActive: true });
  if (!child) return;
  if (tooMany(child.childId)) { res.status(429).json({ error: "That's a lot of games! Let's take a little break." }); return; }
  if (body.mode === "mtc") { // "MTC practice": mimics the official Year 4 check; kept apart from the fun run
    res.status(201).json(await startMtc({ tenantId: ctx.tenantId, franchiseId: child.franchiseId, childId: child.childId, parentUid: ctx.uid, nowIso: nowIso(), skin: body.skin }));
    return;
  }
  // The three "quiz-quest" games (Compass Quest / Museum Vault / Colour Lab) - a different mechanic entirely
  // (seeded MCQ item bank, not the times-tables lane simulation), so they get their own start/finish/progress
  // functions (server/src/lib/hubQuizGames.ts) sharing only the POST /games/sessions contract, same as MTC above.
  if (isQuizGameId(body.gameId)) {
    res.status(201).json(await startQuiz({ tenantId: ctx.tenantId, franchiseId: child.franchiseId, childId: child.childId, parentUid: ctx.uid, gameId: body.gameId, nowIso: nowIso() }));
    return;
  }
  if (isMiniGameId(body.gameId)) {
    const years = yearsAround((await childFacts(child, await hubConfig(ctx.tenantId, child.franchiseId))).yearGroup); // the year they are in NOW (rolled forward each September)
    try {
      if (body.gameId === "bot-foundry") { res.status(201).json(await startBotFoundry({ tenantId: ctx.tenantId, franchiseId: child.franchiseId, childId: child.childId, parentUid: ctx.uid, years, nowIso: nowIso() })); return; }
      if (body.gameId === "sort-yard") { res.status(201).json(await startSortYard({ tenantId: ctx.tenantId, franchiseId: child.franchiseId, childId: child.childId, parentUid: ctx.uid, years, nowIso: nowIso() })); return; }
      res.status(201).json(await startTraining({ tenantId: ctx.tenantId, franchiseId: child.franchiseId, childId: child.childId, parentUid: ctx.uid, packId: body.packId, nowIso: nowIso() }));
      return;
    } catch (e) {
      if (e instanceof GameError) { res.status(e.status).json({ error: e.message }); return; }
      throw e;
    }
  }
  const dob = (await childDobs([child.childId])).get(child.childId) ?? null;
  const out = await startSession({
    tenantId: ctx.tenantId, franchiseId: child.franchiseId, childId: child.childId, parentUid: ctx.uid, support: child.support, age: ageInYears(dob), body, nowIso: nowIso(),
  });
  res.status(201).json(out);
});

hubGamesApi.post("/games/sessions/:id/finish", rateLimit("hub-games-finish", 60), async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (ctx.role !== "parent" || ctx.canEdit) { res.status(403).json({ error: "Games are played from a student's own account" }); return; }
  if (!okId(req.params.id)) { res.status(404).json({ error: "Game not found" }); return; }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const child = await childFor(ctx, ctx.childId ?? (typeof body.childId === "string" ? body.childId : ctx.children.length === 1 ? ctx.children[0]!.childId : null), res);
  if (!child) return;
  try {
    // Peek the session's own kind before dispatching: a quiz-quest session ("compass-quest" | "museum-vault" |
    // "colour-lab") sends `answers`, not a tick log, and is marked by hubQuizGames.finishQuiz against its own
    // static item bank - it can't be routed through finishSession's slide/mtc replay logic.
    const peek = await sessionsCol.doc(req.params.id).get();
    if (peek.exists && isQuizGameId(peek.get("gameId"))) {
      if (peek.get("tenantId") !== ctx.tenantId || peek.get("childId") !== child.childId) { res.status(404).json({ error: "Game not found" }); return; }
      if (peek.get("status") === "done") { res.json({ ...(peek.get("result") as object), repeat: true }); return; }
      if (String(peek.get("expiresAt")) < nowIso()) { res.status(410).json({ error: "This game has expired - start a new one" }); return; }
      const out = await finishQuiz(sessionsCol.doc(req.params.id), peek, { tenantId: ctx.tenantId, childId: child.childId, answers: body.answers, nowIso: nowIso() });
      pingHub(ctx.tenantId, "hubQuizItemState");
      res.json(out);
      return;
    }
    if (peek.exists && isMiniGameId(peek.get("gameId"))) {
      const gid = peek.get("gameId") as MiniGameId;
      const out = gid === "bot-foundry"
        ? await finishBotFoundry({ tenantId: ctx.tenantId, childId: child.childId, sessionId: req.params.id, submissions: body.submissions, nowIso: nowIso() })
        : gid === "sort-yard"
        ? await finishSortYard({ tenantId: ctx.tenantId, childId: child.childId, sessionId: req.params.id, submissions: body.submissions, nowIso: nowIso() })
        : await finishTraining({ tenantId: ctx.tenantId, childId: child.childId, sessionId: req.params.id, answers: body.answers, nowIso: nowIso() });
      pingHub(ctx.tenantId, gid === "bot-foundry" ? "hubBotPuzzleState" : gid === "sort-yard" ? "hubSortRoundState" : "hubTrainingItemState");
      res.json(out);
      return;
    }
    const out = await finishSession({ tenantId: ctx.tenantId, childId: child.childId, sessionId: req.params.id, log: body.log, endTick: body.endTick, answers: body.answers, nowIso: nowIso() });
    pingHub(ctx.tenantId, "hubFactState");
    res.json(out);
  } catch (e) {
    if (e instanceof GameError) { res.status(e.status).json({ error: e.message }); return; }
    throw e;
  }
});

// Mid-run "Back to Games": save exactly where the child got to, so it can be resumed later. Never trust the log
// blindly - checkpointSession re-verifies it replays cleanly before it is stored.
hubGamesApi.post("/games/sessions/:id/checkpoint", rateLimit("hub-games-checkpoint", 60), async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (ctx.role !== "parent" || ctx.canEdit) { res.status(403).json({ error: "Games are played from a student's own account" }); return; }
  if (!okId(req.params.id)) { res.status(404).json({ error: "Game not found" }); return; }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const child = await childFor(ctx, ctx.childId ?? (typeof body.childId === "string" ? body.childId : ctx.children.length === 1 ? ctx.children[0]!.childId : null), res);
  if (!child) return;
  try {
    res.json(await checkpointSession({ tenantId: ctx.tenantId, childId: child.childId, sessionId: req.params.id, log: body.log, endTick: body.endTick, nowIso: nowIso() }));
  } catch (e) {
    if (e instanceof GameError) { res.status(e.status).json({ error: e.message }); return; }
    throw e;
  }
});

// Is there a run this child left mid-way, for THIS skin, not finished and not expired? Drives "Continue" vs "Play"
// on the Games tab card honestly, instead of guessing from whether any fact has ever been played.
hubGamesApi.get("/games/sessions/resumable", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (ctx.role !== "parent" || ctx.canEdit) { res.status(403).json({ error: "Games are played from a student's own account" }); return; }
  const child = await childFor(ctx, ctx.childId ?? (typeof req.query.childId === "string" ? req.query.childId : ctx.children.length === 1 ? ctx.children[0]!.childId : null), res);
  if (!child) return;
  const skin = req.query.skin === "turbo" ? "turbo" : "penguin";
  res.json({ resumable: await resumableSession(ctx.tenantId, child.childId, skin) });
});

// Fetch a SPECIFIC abandoned-but-resumable session (seed/cfg/plan, exactly as `start` would return, plus the
// server-held checkpoint) so the client can continue it - never a fresh start pretending to be a resume.
hubGamesApi.get("/games/sessions/:id/resume", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (ctx.role !== "parent" || ctx.canEdit) { res.status(403).json({ error: "Games are played from a student's own account" }); return; }
  if (!okId(req.params.id)) { res.status(404).json({ error: "Game not found" }); return; }
  const child = await childFor(ctx, ctx.childId ?? (typeof req.query.childId === "string" ? req.query.childId : ctx.children.length === 1 ? ctx.children[0]!.childId : null), res);
  if (!child) return;
  try {
    res.json(await resumeSession({ tenantId: ctx.tenantId, childId: child.childId, sessionId: req.params.id, nowIso: nowIso() }));
  } catch (e) {
    if (e instanceof GameError) { res.status(e.status).json({ error: e.message }); return; }
    throw e;
  }
});

hubGamesApi.get("/games/penguin-slide/facts", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const child = await requestedChild(ctx, req.query.childId, res, false);
  if (!child) return;
  res.json(await factsOverview(ctx.tenantId, child.childId));
});

// Turbo Slide teaches the identical fact domain and writes to the SAME hubFactState/hubGameProfile as Penguin Slide
// (see hubGames.ts's `skinOf` / GAME_ID) - this is an alias of the read above, not a second data model, so a
// family or tutor sees one true fact-strength map regardless of which game a child prefers.
hubGamesApi.get("/games/turbo-slide/facts", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const child = await requestedChild(ctx, req.query.childId, res, false);
  if (!child) return;
  res.json(await factsOverview(ctx.tenantId, child.childId));
});

hubGamesApi.put("/games/penguin-slide/pin", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const child = await childFor(ctx, body.childId, res);
  if (!child) return;
  const tables = Array.isArray(body.tables) ? [...new Set((body.tables as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n >= 2 && n <= 12))].sort((a, b) => a - b) : null;
  if (!tables || tables.length > 6) { res.status(400).json({ error: "Pin between 0 and 6 tables from 2 to 12" }); return; }
  await setPinned(ctx.tenantId, child.franchiseId, child.childId, tables, ctx.uid, nowIso());
  pingHub(ctx.tenantId, "hubFactState");
  res.json({ childId: child.childId, pinned: tables });
});

// Alias: pinning tables is a property of the CHILD's fact practice, not of one game's UI, so it applies to whichever
// game the tutor is looking at.
hubGamesApi.put("/games/turbo-slide/pin", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const child = await childFor(ctx, body.childId, res);
  if (!child) return;
  const tables = Array.isArray(body.tables) ? [...new Set((body.tables as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n >= 2 && n <= 12))].sort((a, b) => a - b) : null;
  if (!tables || tables.length > 6) { res.status(400).json({ error: "Pin between 0 and 6 tables from 2 to 12" }); return; }
  await setPinned(ctx.tenantId, child.franchiseId, child.childId, tables, ctx.uid, nowIso());
  pingHub(ctx.tenantId, "hubFactState");
  res.json({ childId: child.childId, pinned: tables });
});

// The journey map: stars per stage, unlocked helpers / wardrobe, today's Challenge of the Day. Family (their own child) and tutors.
hubGamesApi.get("/games/penguin-slide/journey", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const child = await requestedChild(ctx, req.query.childId, res, false);
  if (!child) return;
  res.json(await journeyOverview(ctx.tenantId, child.childId, nowIso()));
});

// Compass Quest / Museum Vault / Colour Lab: family (their own child) + tutor read of a child's progress in one of
// these games - one item bank, one Leitner-box state, per game (see hubQuizGames.ts). GamesSummaryCard.tsx reads
// whichever of these the child has actually played.
hubGamesApi.get("/games/compass-quest/progress", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const child = await requestedChild(ctx, req.query.childId, res, false);
  if (!child) return;
  res.json(await quizProgress(ctx.tenantId, child.childId, "compass-quest"));
});
hubGamesApi.get("/games/museum-vault/progress", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const child = await requestedChild(ctx, req.query.childId, res, false);
  if (!child) return;
  res.json(await quizProgress(ctx.tenantId, child.childId, "museum-vault"));
});
hubGamesApi.get("/games/colour-lab/progress", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const child = await requestedChild(ctx, req.query.childId, res, false);
  if (!child) return;
  res.json(await quizProgress(ctx.tenantId, child.childId, "colour-lab"));
});

// Debate Keep / Story Detective / Word Vault / Word Pop - the English/literacy cluster. Same "quiz-quest" progress
// read as compass-quest/museum-vault/colour-lab above (quizProgress is one shared implementation, not four).
hubGamesApi.get("/games/debate-keep/progress", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const child = await requestedChild(ctx, req.query.childId, res, false);
  if (!child) return;
  res.json(await quizProgress(ctx.tenantId, child.childId, "debate-keep"));
});
hubGamesApi.get("/games/story-detective/progress", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const child = await requestedChild(ctx, req.query.childId, res, false);
  if (!child) return;
  res.json(await quizProgress(ctx.tenantId, child.childId, "story-detective"));
});
hubGamesApi.get("/games/word-vault/progress", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const child = await requestedChild(ctx, req.query.childId, res, false);
  if (!child) return;
  res.json(await quizProgress(ctx.tenantId, child.childId, "word-vault"));
});
hubGamesApi.get("/games/word-pop/progress", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const child = await requestedChild(ctx, req.query.childId, res, false);
  if (!child) return;
  res.json(await quizProgress(ctx.tenantId, child.childId, "word-pop"));
});

// Bot Foundry / Sort Yard / Training Ground: family (their own child) + tutor read of a child's progress. Same
// shape family (GamesSummaryCard.tsx reads whichever games a child has actually played).
hubGamesApi.get("/games/bot-foundry/progress", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const child = await requestedChild(ctx, req.query.childId, res, false);
  if (!child) return;
  res.json(await botFoundryProgress(ctx.tenantId, child.childId));
});
hubGamesApi.get("/games/sort-yard/progress", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const child = await requestedChild(ctx, req.query.childId, res, false);
  if (!child) return;
  res.json(await sortYardProgress(ctx.tenantId, child.childId));
});
hubGamesApi.get("/games/training-ground/progress", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const child = await requestedChild(ctx, req.query.childId, res, false);
  if (!child) return;
  res.json(await trainingProgress(ctx.tenantId, child.childId));
});

// Tutor: open every stage for a child (a strong learner who should not have to earn the early stars again). Stars are still earned honestly.
hubGamesApi.put("/games/penguin-slide/unlock", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const child = await childFor(ctx, body.childId, res);
  if (!child) return;
  await setUnlockAll(ctx.tenantId, child.franchiseId, child.childId, body.all === true, ctx.uid, nowIso());
  res.json({ childId: child.childId, unlockAll: body.all === true });
});
