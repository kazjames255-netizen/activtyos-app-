import { Router } from "express";
import { z } from "zod";
import { db } from "../../firebase";
import { canSeeStudent, canWriteRow, okId, requireEdit, resolveCtx, scopedChildren, type HubCtx } from "../../lib/hubCore";
import { signImageUrl } from "../../lib/signing";
import { imagesCol, isParent, lessonsCol, nowIso } from "./teachingCommon";

// Learning Hub — the live lesson WHITEBOARD's saved copy. The board itself is
// synced peer-to-peer over the Daily call (app messages); this is only the
// durable copy: the tutor's client autosaves it (debounced) and on leave, so a
// reload / rejoin restores it, a family can look at it read-only, and "Save to
// lesson notes" has something to point at. Contract: docs/learning-hub.md →
// "Round 4 — whiteboard".
//
//   hubBoards/{lessonId}  {tenantId, franchiseId, lessonId, pages:[{id,background,elements}],
//                          childIds (students who drew: for erase), updatedAt, updatedBy}
//
// Access follows the lesson: GET = a tutor who can see the lesson's students, or
// a parent whose ENROLLED child is in it (read-only); PUT = a tutor who can write
// the lesson. A foreign lesson id is a 404 for everyone. Images on a board are
// REFERENCES to this tenant's private hub uploads (never inline bytes); GET
// re-signs each one (6 h links).

export const hubBoardsApi = Router();
export const boardsCol = db.collection("hubBoards");

const MAX_BOARD_BYTES = 700_000;
const MAX_PAGES = 30;
const MAX_ELEMENTS = 4000;

export const BACKGROUNDS = ["blank", "lined", "squared", "graph", "numberline", "isometric", "handwriting", "dotgrid", "tianzige", "twocol", "storymap", "diagram", "vocab"] as const;
const num = z.number().finite();
const pt = z.number().finite().min(-1e6).max(1e6);
const element = z.object({
  id: z.string().min(1).max(60),
  k: z.enum(["stroke", "shape", "text", "sticky", "image", "stamp"]),
  /** Who owns it: "T" (the tutor) or "c:<childId>". */
  own: z.string().min(1).max(120),
  by: z.string().max(40).optional(),
  cid: z.string().max(100).optional(),
  z: num,
  v: num,
  c: z.string().max(40).optional(),
  w: num.optional(),
  h: num.optional(),
  hl: z.boolean().optional(),
  sty: z.enum(["dash", "neon", "rainbow"]).optional(),
  pts: z.array(pt).max(90_000).optional(),
  shape: z.enum(["line", "arrow", "darrow", "rect", "ellipse", "triangle", "diamond", "rtriangle", "pentagon", "hexagon", "star", "heart", "bubble", "ngon", "parallelogram", "trapezium", "kite"]).optional(),
  x: pt.optional(), y: pt.optional(), x1: pt.optional(), y1: pt.optional(), x2: pt.optional(), y2: pt.optional(),
  fill: z.string().max(40).nullable().optional(),
  text: z.string().max(2000).optional(),
  size: num.optional(),
  bold: z.boolean().optional(),
  imageId: z.string().min(1).max(100).optional(),
  stamp: z.string().regex(/^[a-z]{2,20}$/).optional(),
  grp: z.string().max(40).optional(),
  dash: z.boolean().optional(),
  rot: num.optional(),
  // typeable cells / text inside shapes, fill + outline looks, polygons, locking, connectors (all client-defined; see model.ts El)
  tc: z.string().max(40).optional(),
  al: z.enum(["l", "c", "r"]).optional(),
  va: z.enum(["t", "m", "b"]).optional(),
  ph: z.string().max(120).optional(),
  cell: z.boolean().optional(),
  fa: z.number().finite().min(0).max(1).optional(),
  ns: z.boolean().optional(),
  n: z.number().finite().min(3).max(12).optional(),
  ap: z.number().finite().min(-2).max(3).optional(),
  lock: z.boolean().optional(),
  ah: z.enum(["none", "open", "filled", "dot"]).optional(),
  fr: z.string().max(60).optional(),
  to: z.string().max(60).optional(),
  opts: z.record(z.string().max(20), z.union([num, z.string().max(4000), z.boolean()])).optional(),
});
const page = z.object({
  id: z.string().min(1).max(40),
  background: z.enum(BACKGROUNDS),
  elements: z.array(element).max(MAX_ELEMENTS),
});
const boardBody = z.object({ pages: z.array(page).min(1).max(MAX_PAGES) });

// ── SANITISING (not rejecting) ──────────────────────────────────────────────
// The board is assembled live from many peers' messages, so one bad element (a text over its limit, an
// over-long id from a hostile client…) must never make the tutor's autosave fail for the rest of the lesson.
// PUT therefore repairs what it can (clips strings, clamps numbers, falls back to a blank background) and
// DROPS what it can't (an element that fails the schema, a page with a duplicate id), and reports the count.
// Only structurally hopeless bodies (no pages at all) are a 400; size stays a 413.
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const CLIP: [string, number][] = [["by", 40], ["c", 40], ["fill", 40], ["text", 2000], ["grp", 40]];
function repairElement(raw: unknown): BoardElement | null {
  if (!isObj(raw)) return null;
  const e: Record<string, unknown> = { ...raw };
  for (const [k, max] of CLIP) if (typeof e[k] === "string" && (e[k] as string).length > max) e[k] = (e[k] as string).slice(0, max);
  if (typeof e.cid === "string" && e.cid.length > 100) delete e.cid; // an over-long child id is dropped, the element survives
  if (Array.isArray(e.pts)) {
    e.pts = (e.pts as unknown[]).slice(0, 90_000).map((n) => (typeof n === "number" && Number.isFinite(n) ? Math.max(-1e6, Math.min(1e6, n)) : n));
  }
  for (const k of ["x", "y", "x1", "y1", "x2", "y2"]) if (typeof e[k] === "number") e[k] = Math.max(-1e6, Math.min(1e6, e[k] as number));
  for (const k of Object.keys(e)) if (e[k] === null && k !== "fill") delete e[k]; // null means "unset" everywhere except a shape's fill
  let r = element.safeParse(e);
  if (!r.success) {
    // One bad OPTIONAL field (an out-of-range look, a long label…) costs that field, not the element; a bad identity / geometry drops it.
    const bad = new Set(r.error.issues.map((i) => String(i.path[0] ?? "")));
    if ([...bad].some((k) => ["", "id", "k", "own", "z", "v", "pts"].includes(k))) return null;
    for (const k of bad) delete e[k];
    r = element.safeParse(e);
  }
  return r.success ? r.data : null;
}
function sanitiseBoard(body: unknown): { pages: BoardPage[]; dropped: number } | null {
  const raw = isObj(body) && Array.isArray(body.pages) ? body.pages : null;
  if (!raw || !raw.length) return null;
  let dropped = 0;
  const seen = new Set<string>();
  const pages: BoardPage[] = [];
  for (const p of raw.slice(0, MAX_PAGES)) {
    if (!isObj(p) || typeof p.id !== "string" || !p.id.length || p.id.length > 40 || seen.has(p.id)) { dropped++; continue; }
    seen.add(p.id);
    const background = (BACKGROUNDS as readonly string[]).includes(p.background as string) ? (p.background as BoardPage["background"]) : "blank";
    const els: BoardElement[] = [];
    for (const e of (Array.isArray(p.elements) ? p.elements : []).slice(0, MAX_ELEMENTS)) {
      const ok = repairElement(e);
      if (ok) els.push(ok); else dropped++;
    }
    pages.push({ id: p.id, background, elements: els });
  }
  return pages.length ? { pages, dropped } : null;
}

const emptyBoard = () => ({ pages: [{ id: "p1", background: "blank", elements: [] as unknown[] }] });

type BoardPage = z.infer<typeof page>;
type BoardElement = z.infer<typeof element>;

/** A lesson this caller may open the board of, or a refusal already sent. */
async function lessonFor(ctx: HubCtx, id: string, res: import("express").Response, write: boolean) {
  if (!okId(id)) { res.status(404).json({ error: "Lesson not found" }); return null; }
  const snap = await lessonsCol.doc(id).get();
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId) { res.status(404).json({ error: "Lesson not found" }); return null; }
  const childIds = (snap.get("childIds") as string[] | undefined) ?? [];
  const franchiseId = (snap.get("franchiseId") as string | null | undefined) ?? null;
  if (isParent(ctx)) {
    if (write) { res.status(403).json({ error: "Only tutors can save the board" }); return null; }
    if (!scopedChildren(ctx).some((c) => childIds.includes(c.childId))) { res.status(404).json({ error: "Lesson not found" }); return null; }
  } else {
    if (!canSeeStudent(ctx, franchiseId)) { res.status(404).json({ error: "Lesson not found" }); return null; }
    if (write && (!requireEdit(ctx, res) || !canWriteRow(ctx, franchiseId))) {
      if (!res.headersSent) res.status(403).json({ error: "That lesson belongs to head office" });
      return null;
    }
  }
  return { id: snap.id, childIds, franchiseId };
}

/** Attach a fresh signed link to each image element. */
function withUrls(base: string, pages: BoardPage[]) {
  return pages.map((p) => ({
    ...p,
    elements: p.elements.map((e) => (e.k === "image" && e.imageId ? { ...e, url: signImageUrl(`${base}/${e.imageId}`) as string } : e)),
  }));
}

// GET /lessons/:id/board — the saved board (an empty single page when nothing is saved yet).
hubBoardsApi.get("/lessons/:id/board", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const lesson = await lessonFor(ctx, req.params.id, res, false);
  if (!lesson) return;
  const snap = await boardsCol.doc(lesson.id).get();
  const readOnly = isParent(ctx);
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId) {
    res.json({ lessonId: lesson.id, ...emptyBoard(), updatedAt: null, updatedBy: null, readOnly });
    return;
  }
  const base = `${req.protocol}://${req.get("host")}/api/images`;
  const pages = (snap.get("pages") as BoardPage[] | undefined) ?? emptyBoard().pages as BoardPage[];
  res.json({ lessonId: lesson.id, pages: withUrls(base, pages), updatedAt: snap.get("updatedAt") ?? null, updatedBy: snap.get("updatedByName") ?? null, readOnly });
});

// PUT /lessons/:id/board {pages} — tutor only; last write wins. Bad elements are repaired or dropped (`dropped` says how many), never a reason to refuse the whole board.
hubBoardsApi.put("/lessons/:id/board", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const lesson = await lessonFor(ctx, req.params.id, res, true);
  if (!lesson) return;
  const size = JSON.stringify(req.body ?? {}).length;
  if (size > MAX_BOARD_BYTES) {
    res.status(413).json({ error: `This board is too big to save (${Math.round(size / 1000)} KB, the limit is ${MAX_BOARD_BYTES / 1000} KB). Clear a page or delete some long drawings and it will save again.`, code: "board_too_large", limitBytes: MAX_BOARD_BYTES });
    return;
  }
  const cleaned = sanitiseBoard(req.body);
  if (!cleaned) { res.status(400).json({ error: "A board needs at least one page" }); return; }
  let dropped = cleaned.dropped;
  let pages = cleaned.pages;

  // Images must be THIS tenant's private hub uploads — an element pointing at anything else is dropped (never stored).
  const allIds = [...new Set(pages.flatMap((p) => p.elements.flatMap((e) => (e.imageId ? [e.imageId] : []))))];
  const okIds = allIds.filter((i) => okId(i)).slice(0, 100);
  const good = new Set<string>();
  if (okIds.length) {
    const snaps = await db.getAll(...okIds.map((i) => imagesCol.doc(i)), { fieldMask: ["tenantId", "private", "kind", "contentType", "submissionId"] });
    snaps.forEach((s, i) => {
      if (s.exists && s.get("tenantId") === ctx.tenantId && s.get("private") === true && s.get("kind") === "hub" && !s.get("submissionId") && String(s.get("contentType") ?? "").startsWith("image/")) good.add(okIds[i]!);
    });
  }
  pages = pages.map((p) => ({ ...p, elements: p.elements.filter((e) => { const keep = !e.imageId || good.has(e.imageId); if (!keep) dropped++; return keep; }) }));

  // Keep only children who really are in the lesson (a student's drawings carry childId + first name only).
  const inLesson = new Set(lesson.childIds);
  const clean: BoardPage[] = pages.map((p) => ({
    ...p,
    elements: p.elements.map((e) => {
      const { cid, ...rest } = e;
      return cid && inLesson.has(cid) ? { ...rest, cid } : rest;
    }),
  }));
  const drew = [...new Set(clean.flatMap((p) => p.elements.flatMap((e) => (e.cid ? [e.cid] : []))))];
  const updatedAt = nowIso();
  try {
    await boardsCol.doc(lesson.id).set({
      tenantId: ctx.tenantId, franchiseId: lesson.franchiseId, lessonId: lesson.id,
      pages: clean, childIds: drew, updatedAt, updatedBy: ctx.uid, updatedByName: ctx.name || "Your tutor",
    });
  } catch (e) {
    // Firestore's 1 MiB document limit counts stored bytes (every number is 8), which the JSON-length check above can't see.
    if (/exceeds the maximum allowed size|too large|INVALID_ARGUMENT/i.test(e instanceof Error ? e.message : String(e))) {
      res.status(413).json({ error: "This board is too big to save. Clear a page or delete some long drawings and it will save again.", code: "board_too_large", limitBytes: MAX_BOARD_BYTES });
      return;
    }
    throw e;
  }
  res.json({ ok: true, updatedAt, bytes: size, dropped });
});

// ── "My templates": a tutor's saved board pages (hubBoardTemplates) ──────────
// tenant-scoped, tutor-only write, listed in the Toolkit's "My templates" pack. Capped: ≤ 40 per tenant scope,
// ≤ 600 elements and ≤ 250 KB each. Image elements must be this tenant's hub uploads (same rule as a board).
const templatesCol = db.collection("hubBoardTemplates");
const MAX_TEMPLATES = 40, MAX_TEMPLATE_BYTES = 250_000;
const templateBody = z.object({ name: z.string().trim().min(1).max(80), background: z.enum(BACKGROUNDS).default("blank"), elements: z.array(element).min(1).max(600) });

hubBoardsApi.get("/board-templates", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (!ctx.canEdit) { res.status(403).json({ error: "Only tutors have board templates" }); return; }
  const snap = await templatesCol.where("tenantId", "==", ctx.tenantId).get();
  const base = `${req.protocol}://${req.get("host")}/api/images`;
  const rows = snap.docs.filter((d) => canSeeStudent(ctx, d.get("franchiseId") ?? null))
    .map((d) => ({ id: d.id, name: d.get("name") as string, background: d.get("background") as string, createdAt: d.get("createdAt") as string,
      elements: ((d.get("elements") as BoardPage["elements"]) ?? []).map((e) => (e.k === "image" && e.imageId ? { ...e, url: signImageUrl(`${base}/${e.imageId}`) as string } : e)) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(rows);
});

hubBoardsApi.post("/board-templates", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const size = JSON.stringify(req.body ?? {}).length;
  if (size > MAX_TEMPLATE_BYTES) { res.status(413).json({ error: `That page is too big to keep as a template (${Math.round(size / 1000)} KB, the limit is ${MAX_TEMPLATE_BYTES / 1000} KB).`, code: "template_too_large" }); return; }
  const parsed = templateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const b = parsed.data;
  const mine = (await templatesCol.where("tenantId", "==", ctx.tenantId).get()).docs.filter((d) => (d.get("franchiseId") ?? null) === ctx.franchiseId);
  if (mine.length >= MAX_TEMPLATES) { res.status(409).json({ error: `You can keep up to ${MAX_TEMPLATES} templates — delete one first.`, code: "template_limit" }); return; }
  const imageIds = [...new Set(b.elements.flatMap((e) => (e.imageId ? [e.imageId] : [])))];
  if (imageIds.some((i) => !okId(i))) { res.status(400).json({ error: "That picture isn't valid" }); return; }
  if (imageIds.length) {
    const snaps = await db.getAll(...imageIds.map((i) => imagesCol.doc(i)), { fieldMask: ["tenantId", "private", "kind"] });
    if (snaps.some((x) => !x.exists || x.get("tenantId") !== ctx.tenantId || x.get("private") !== true || x.get("kind") !== "hub")) { res.status(400).json({ error: "A picture on the page wasn't uploaded for the Teaching Hub" }); return; }
  }
  // a template never carries a student's work
  const elements = b.elements.filter((e) => !e.own.startsWith("c:")).map(({ cid: _c, by: _b, ...rest }) => rest);
  if (!elements.length) { res.status(400).json({ error: "There's nothing of yours on this page to save" }); return; }
  const ref = await templatesCol.add({ tenantId: ctx.tenantId, franchiseId: ctx.franchiseId, name: b.name, background: b.background, elements, createdBy: ctx.uid, createdAt: nowIso() });
  res.status(201).json({ id: ref.id, name: b.name });
});

hubBoardsApi.delete("/board-templates/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const id = req.params.id;
  const snap = okId(id) ? await templatesCol.doc(id).get() : null;
  if (!snap?.exists || snap.get("tenantId") !== ctx.tenantId || !canWriteRow(ctx, snap.get("franchiseId") ?? null)) { res.status(404).json({ error: "Template not found" }); return; }
  await snap.ref.delete();
  res.json({ ok: true });
});

/** Delete a lesson's board (lesson deleted). */
export async function deleteBoardForLesson(lessonId: string) {
  try { await boardsCol.doc(lessonId).delete(); } catch { /* best-effort */ }
}
