import { FieldValue } from "firebase-admin/firestore";
import { Router } from "express";
import { z } from "zod";
import { db } from "../../firebase";
import { okId, resolveCtx, scopedChildren, type HubCtx } from "../../lib/hubCore";
import { nowIso } from "./teachingCommon";

// Learning Hub — the Tools tab's server side:
//  · a tool's autosaved state (`hubToolStates`) — small JSON (≤ 64 KB), one doc per (owner, tool, context), so a refresh never loses work;
//  · a usage counter (`hubToolEvents`) — ONE doc per tenant per day holding counts per tool: which tools are opened and which
//    "In build / Coming soon" ones people click. No child identity is stored, so it is not personal data and drives the build order.
// Graded tool answers do NOT live here: they will ride the existing attempt docs (plan v2, Phase 2).

export const hubToolsApi = Router();
const statesCol = db.collection("hubToolStates");
const eventsCol = db.collection("hubToolEvents");

const toolId = z.string().regex(/^[A-Za-z0-9._-]{1,40}$/);
const STATE_MAX = 64 * 1024;

/** Whose state this is: a parent → the chosen child; a tutor/operator → themselves. Null = a parent with no child picked. */
function owner(ctx: HubCtx): { type: "child" | "user"; key: string } | null {
  if (ctx.role === "parent" && !ctx.canEdit) {
    if (!ctx.childId && ctx.children.length > 1) return null;
    const kid = scopedChildren(ctx)[0];
    return kid ? { type: "child", key: kid.childId } : null;
  }
  return { type: "user", key: ctx.uid };
}

// A small in-process limiter: a runaway client can't hammer the counters (60 events a minute per person).
const hits = new Map<string, { n: number; t: number }>();
const allow = (k: string) => { const now = Date.now(), h = hits.get(k); if (!h || now - h.t > 60_000) { hits.set(k, { n: 1, t: now }); if (hits.size > 2000) hits.clear(); return true; } return ++h.n <= 60; };

const eventBody = z.object({ toolId, kind: z.enum(["open", "comingSoonClick", "buildingClick"]) });
// POST /tools/events — count one open / click of a tool.
hubToolsApi.post("/tools/events", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const p = eventBody.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.issues }); return; }
  if (!allow(`${ctx.tenantId}|${ctx.uid}`)) { res.status(429).json({ error: "Slow down" }); return; }
  const day = nowIso().slice(0, 10);
  await eventsCol.doc(`${ctx.tenantId}__${day}`).set({ tenantId: ctx.tenantId, day, counts: { [p.data.toolId]: { [p.data.kind]: FieldValue.increment(1) } } }, { merge: true });
  res.json({ ok: true });
});

const ctxType = z.enum(["free", "lesson", "homework", "quiz", "liveLesson"]);
const stateKey = (tenantId: string, o: { key: string }, tool: string, type: string, id: string) => `${tenantId}__${o.key}__${tool}__${type}__${id}`;

// GET /tools/state?toolId=&contextType=&contextId= — the saved state for this person + tool + place, or null.
hubToolsApi.get("/tools/state", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const q = z.object({ toolId, contextType: ctxType.default("free"), contextId: z.string().max(100).default("-") }).safeParse(req.query);
  const o = owner(ctx);
  if (!q.success || !okId(q.data.contextId) || !o) { res.status(400).json({ error: o ? "Bad request" : "Which child? Pass ?childId=" }); return; }
  const snap = await statesCol.doc(stateKey(ctx.tenantId, o, q.data.toolId, q.data.contextType, q.data.contextId)).get();
  // The doc id already embeds tenant + owner; re-check anyway so a hand-built id can never cross either.
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || snap.get("ownerKey") !== o.key) { res.json({ state: null }); return; }
  res.json({ state: snap.get("state") ?? null, schemaVersion: snap.get("schemaVersion") ?? 1, updatedAt: snap.get("updatedAt") ?? null });
});

const putBody = z.object({ toolId, contextType: ctxType.default("free"), contextId: z.string().max(100).default("-"), schemaVersion: z.number().int().min(1).max(1000).default(1), state: z.unknown() });
// PUT /tools/state — autosave (the client debounces; identical saves are skipped there).
hubToolsApi.put("/tools/state", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const p = putBody.safeParse(req.body);
  const o = owner(ctx);
  if (!p.success || !okId(p.data.contextId) || !o) { res.status(400).json({ error: o ? "Bad request" : "Which child? Pass ?childId=" }); return; }
  const size = JSON.stringify(p.data.state ?? null).length;
  if (size > STATE_MAX) { res.status(413).json({ error: "That's too big to save (over 64 KB). Clear some of it and try again." }); return; }
  const now = nowIso();
  await statesCol.doc(stateKey(ctx.tenantId, o, p.data.toolId, p.data.contextType, p.data.contextId)).set({
    tenantId: ctx.tenantId, franchiseId: ctx.franchiseId, ownerType: o.type, ownerKey: o.key, toolId: p.data.toolId, contextType: p.data.contextType, contextId: p.data.contextId,
    schemaVersion: p.data.schemaVersion, state: p.data.state ?? null, createdBy: ctx.uid, updatedAt: now,
  });
  res.json({ ok: true, updatedAt: now });
});
