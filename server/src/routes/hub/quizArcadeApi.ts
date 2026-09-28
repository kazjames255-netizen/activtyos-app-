import { Router } from "express";
import { okId, resolveCtx } from "../../lib/hubCore";
import { rateLimit } from "../../lib/rateLimit";
import { finishQuizSession, GameError, quizArcadeSummary, quizFacts, startQuizSession, type QuizGameSpec } from "../../lib/quizArcade";
import { primeReefSpec } from "../../lib/games/primeReef";
import { dataCarnivalSpec } from "../../lib/games/dataCarnival";
import { shapeWorkshopSpec } from "../../lib/games/shapeWorkshop";
import { childFor, nowIso, requestedChild } from "./shared";
import { pingHub } from "../../lib/hubPing";

// Learning Hub — the "quiz arcade" trio: Prime Reef (number theory), Data Carnival (statistics), Shape Workshop
// (geometry). Same server-authoritative contract as Penguin/Turbo Slide (docs/games-prototypes/BACKEND-PATTERN.md)
// but a plan-of-multiple-choice-items shape (like MTC practice) rather than a lane-steering simulation, since these
// are genuinely different skill domains, not reskins of the times-tables fact universe.
//   POST /games/quiz/:gameId/sessions            family only: start a run. Server builds the plan (weakest topics
//                                                 first) and returns items WITHOUT their correct answers.
//   POST /games/quiz/:gameId/sessions/:id/finish family only: send back {answers:[{id,chosen,ms}]}. Idempotent.
//   GET  /games/quiz/:gameId/facts                family + tutor: per-topic mastery + profile for one game.
//   GET  /games/quiz-arcade/summary                family + tutor: combined "have they played any of the three" line for Progress.
export const hubQuizArcadeApi = Router();

const SPECS: Record<string, QuizGameSpec> = { "prime-reef": primeReefSpec, "data-carnival": dataCarnivalSpec, "shape-workshop": shapeWorkshopSpec };
const specFor = (id: string): QuizGameSpec | null => SPECS[id] ?? null;

// Same per-child in-process throttle as the fact-fluency games (hub/gamesApi.ts): 12 runs / 10 min, shared across
// all three quiz-arcade games plus Penguin/Turbo (a child cranking through any combination still hits one cap).
const recent = new Map<string, number[]>();
function tooMany(childId: string): boolean {
  const now = Date.now(); const xs = (recent.get(childId) ?? []).filter((t) => now - t < 600_000);
  if (xs.length >= 12) { recent.set(childId, xs); return true; }
  xs.push(now); recent.set(childId, xs);
  if (recent.size > 5000) recent.clear();
  return false;
}

hubQuizArcadeApi.post("/games/quiz/:gameId/sessions", rateLimit("hub-quiz-start", 40), async (req, res) => {
  const spec = specFor(String(req.params.gameId));
  if (!spec) { res.status(404).json({ error: "Unknown game" }); return; }
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (ctx.role !== "parent" || ctx.canEdit) { res.status(403).json({ error: "Games are played from a student's own account" }); return; }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const child = await childFor(ctx, ctx.childId ?? (typeof body.childId === "string" ? body.childId : ctx.children.length === 1 ? ctx.children[0]!.childId : null), res, { needActive: true });
  if (!child) return;
  if (tooMany(child.childId)) { res.status(429).json({ error: "That's a lot of games! Let's take a little break." }); return; }
  const out = await startQuizSession(spec, { tenantId: ctx.tenantId, franchiseId: child.franchiseId, childId: child.childId, parentUid: ctx.uid, nowIso: nowIso() });
  res.status(201).json(out);
});

hubQuizArcadeApi.post("/games/quiz/:gameId/sessions/:id/finish", rateLimit("hub-quiz-finish", 60), async (req, res) => {
  const spec = specFor(String(req.params.gameId));
  if (!spec) { res.status(404).json({ error: "Unknown game" }); return; }
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (ctx.role !== "parent" || ctx.canEdit) { res.status(403).json({ error: "Games are played from a student's own account" }); return; }
  if (!okId(req.params.id)) { res.status(404).json({ error: "Game not found" }); return; }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const child = await childFor(ctx, ctx.childId ?? (typeof body.childId === "string" ? body.childId : ctx.children.length === 1 ? ctx.children[0]!.childId : null), res);
  if (!child) return;
  try {
    const out = await finishQuizSession(spec, { tenantId: ctx.tenantId, childId: child.childId, sessionId: req.params.id, answers: body.answers, nowIso: nowIso() });
    pingHub(ctx.tenantId, "hubQuizArcadeMastery");
    res.json(out);
  } catch (e) {
    if (e instanceof GameError) { res.status(e.status).json({ error: e.message }); return; }
    throw e;
  }
});

hubQuizArcadeApi.get("/games/quiz/:gameId/facts", async (req, res) => {
  const spec = specFor(String(req.params.gameId));
  if (!spec) { res.status(404).json({ error: "Unknown game" }); return; }
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const child = await requestedChild(ctx, req.query.childId, res, false);
  if (!child) return;
  res.json(await quizFacts(spec, ctx.tenantId, child.childId));
});

hubQuizArcadeApi.get("/games/quiz-arcade/summary", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const child = await requestedChild(ctx, req.query.childId, res, false);
  if (!child) return;
  res.json(await quizArcadeSummary(ctx.tenantId, child.childId, [primeReefSpec, dataCarnivalSpec, shapeWorkshopSpec]));
});
