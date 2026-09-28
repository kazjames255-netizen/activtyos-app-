import { Router } from "express";
import { okId, resolveCtx } from "../../lib/hubCore";
import { rateLimit } from "../../lib/rateLimit";
import { appliedOverview, checkpointAppliedSession, finishAppliedSession, GameError, isGameId, resumableAppliedSession, resumeAppliedSession, startAppliedSession } from "../../lib/appliedGames";
import { childFor, nowIso, requestedChild } from "./shared";
import { pingHub } from "../../lib/hubPing";

// Learning Hub — the applied-maths cluster: Market Day, Bake Off Blitz, Rhythm Reef
// (features/learninghub/games/{market,bakeoff,reef}/, shared core: features/learninghub/games/applied/).
// Contract: server/openapi.yaml, tag "hub-games". Same shape as /games/sessions (hubGames.ts) but keyed by gameId
// since these are a different skill domain per game, not one shared fact-fluency map:
//   POST /games/applied/:gameId/sessions              family: start a run. Server issues seed + level + a form of
//                                                      items with the answer key stripped.
//   POST /games/applied/:gameId/sessions/:id/finish    family: send ANSWERS ONLY; the server re-marks the exact
//                                                      items it issued. Idempotent.
//   GET  /games/applied/:gameId/state                  family + tutor: level, per-tag accuracy, personal best.
export const hubAppliedGamesApi = Router();

// Same convention as hubGamesApi.ts: a per-child soft cap on top of the per-IP rate limit.
const recent = new Map<string, number[]>();
function tooMany(childId: string): boolean {
  const now = Date.now(); const xs = (recent.get(childId) ?? []).filter((t) => now - t < 600_000);
  if (xs.length >= 12) { recent.set(childId, xs); return true; }
  xs.push(now); recent.set(childId, xs);
  if (recent.size > 5000) recent.clear();
  return false;
}

hubAppliedGamesApi.post("/games/applied/:gameId/sessions", rateLimit("hub-games-start", 40), async (req, res) => {
  if (!isGameId(req.params.gameId)) { res.status(404).json({ error: "Unknown game" }); return; }
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (ctx.role !== "parent" || ctx.canEdit) { res.status(403).json({ error: "Games are played from a student's own account" }); return; }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const child = await childFor(ctx, ctx.childId ?? (typeof body.childId === "string" ? body.childId : ctx.children.length === 1 ? ctx.children[0]!.childId : null), res, { needActive: true });
  if (!child) return;
  if (tooMany(child.childId)) { res.status(429).json({ error: "That's a lot of games! Let's take a little break." }); return; }
  const out = await startAppliedSession({ tenantId: ctx.tenantId, franchiseId: child.franchiseId, childId: child.childId, parentUid: ctx.uid, gameId: req.params.gameId, nowIso: nowIso() });
  res.status(201).json(out);
});

hubAppliedGamesApi.post("/games/applied/:gameId/sessions/:id/finish", rateLimit("hub-games-finish", 60), async (req, res) => {
  if (!isGameId(req.params.gameId)) { res.status(404).json({ error: "Unknown game" }); return; }
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (ctx.role !== "parent" || ctx.canEdit) { res.status(403).json({ error: "Games are played from a student's own account" }); return; }
  if (!okId(req.params.id)) { res.status(404).json({ error: "Game not found" }); return; }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const child = await childFor(ctx, ctx.childId ?? (typeof body.childId === "string" ? body.childId : ctx.children.length === 1 ? ctx.children[0]!.childId : null), res);
  if (!child) return;
  try {
    const out = await finishAppliedSession({ tenantId: ctx.tenantId, childId: child.childId, gameId: req.params.gameId, sessionId: req.params.id, answers: body.answers, nowIso: nowIso() });
    pingHub(ctx.tenantId, "hubAppliedState");
    res.json(out);
  } catch (e) {
    if (e instanceof GameError) { res.status(e.status).json({ error: e.message }); return; }
    throw e;
  }
});

// Mid-run "Back to Games": save the answers given so far (same pattern as /games/sessions/:id/checkpoint).
hubAppliedGamesApi.post("/games/applied/:gameId/sessions/:id/checkpoint", rateLimit("hub-games-checkpoint", 60), async (req, res) => {
  if (!isGameId(req.params.gameId)) { res.status(404).json({ error: "Unknown game" }); return; }
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (ctx.role !== "parent" || ctx.canEdit) { res.status(403).json({ error: "Games are played from a student's own account" }); return; }
  if (!okId(req.params.id)) { res.status(404).json({ error: "Game not found" }); return; }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const child = await childFor(ctx, ctx.childId ?? (typeof body.childId === "string" ? body.childId : ctx.children.length === 1 ? ctx.children[0]!.childId : null), res);
  if (!child) return;
  try {
    res.json(await checkpointAppliedSession({ tenantId: ctx.tenantId, childId: child.childId, gameId: req.params.gameId, sessionId: req.params.id, answers: body.answers, nowIso: nowIso() }));
  } catch (e) {
    if (e instanceof GameError) { res.status(e.status).json({ error: e.message }); return; }
    throw e;
  }
});

// Is there a run this child left mid-way, for THIS game, not finished and not expired? Drives "Continue" vs "Play".
hubAppliedGamesApi.get("/games/applied/:gameId/sessions/resumable", async (req, res) => {
  if (!isGameId(req.params.gameId)) { res.status(404).json({ error: "Unknown game" }); return; }
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (ctx.role !== "parent" || ctx.canEdit) { res.status(403).json({ error: "Games are played from a student's own account" }); return; }
  const child = await childFor(ctx, ctx.childId ?? (typeof req.query.childId === "string" ? req.query.childId : ctx.children.length === 1 ? ctx.children[0]!.childId : null), res);
  if (!child) return;
  res.json({ resumable: await resumableAppliedSession(ctx.tenantId, child.childId, req.params.gameId) });
});

// Fetch a SPECIFIC abandoned-but-resumable session (items + level, exactly as `start` would return, plus the
// server-held checkpoint) so the client can continue it.
hubAppliedGamesApi.get("/games/applied/:gameId/sessions/:id/resume", async (req, res) => {
  if (!isGameId(req.params.gameId)) { res.status(404).json({ error: "Unknown game" }); return; }
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (ctx.role !== "parent" || ctx.canEdit) { res.status(403).json({ error: "Games are played from a student's own account" }); return; }
  if (!okId(req.params.id)) { res.status(404).json({ error: "Game not found" }); return; }
  const child = await childFor(ctx, ctx.childId ?? (typeof req.query.childId === "string" ? req.query.childId : ctx.children.length === 1 ? ctx.children[0]!.childId : null), res);
  if (!child) return;
  try {
    res.json(await resumeAppliedSession({ tenantId: ctx.tenantId, childId: child.childId, gameId: req.params.gameId, sessionId: req.params.id, nowIso: nowIso() }));
  } catch (e) {
    if (e instanceof GameError) { res.status(e.status).json({ error: e.message }); return; }
    throw e;
  }
});

hubAppliedGamesApi.get("/games/applied/:gameId/state", async (req, res) => {
  if (!isGameId(req.params.gameId)) { res.status(404).json({ error: "Unknown game" }); return; }
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const child = await requestedChild(ctx, req.query.childId, res, false);
  if (!child) return;
  res.json(await appliedOverview(ctx.tenantId, child.childId, req.params.gameId));
});
