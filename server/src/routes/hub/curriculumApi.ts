import { Router } from "express";
import { z } from "zod";
import { db } from "../../firebase";
import { canSee, canWriteRow, okId, requireEdit, resolveCtx, scopedChildren, type HubCtx } from "../../lib/hubCore";
import { childAssignedNoteIds, noteIndex, type NoteRow } from "../../lib/hubIndex";
import { frameworkIds, framework, tally, type CurFramework, type Placement } from "../../lib/curriculum";
import { attemptsCol, nowIso } from "./teachingCommon";

// Learning Hub — "Where do these lessons fit the curriculum?" A read-mostly view over a static reference map
// (lib/curriculum.ts: the National Curriculum, GCSE/AQA…) plus the provider's own corrections (`hubNcTags`).
//  · A tutor sees every lesson their scope can see, placed on the map (counts per area × year, gaps, thin spots).
//  · A family sees ONLY the lessons their tutor assigned to the chosen child (same rule as the Lessons tab), and which of
//    those the child has finished (their exit quiz is handed in) — so the same grid reads as "what my child has covered".
//  · A tutor can correct where a lesson sits (or place their OWN lesson): a per-tenant override that beats the reference map.
// Nothing here writes to the library or to any child's record.

export const hubCurriculumApi = Router();
const tagsCol = db.collection("hubNcTags");

interface TagDoc { tenantId: string; franchiseId: string | null; framework: string; noteId: string; areaId: string; year: number; byUid: string; byName: string; at: string }

// A tenant's corrections are tiny (a few hundred rows at most), so they're cached whole for a minute and dropped on every write.
const tagCache = new Map<string, { at: number; v: Promise<Map<string, TagDoc>> }>();
const TAG_TTL = 60_000;
const forgetTags = (tenantId: string) => { for (const k of [...tagCache.keys()]) if (k.startsWith(`${tenantId}|`)) tagCache.delete(k); };
function tenantTags(tenantId: string, fw: string): Promise<Map<string, TagDoc>> {
  const key = `${tenantId}|${fw}`, hit = tagCache.get(key);
  if (hit && Date.now() - hit.at < TAG_TTL) return hit.v;
  const v = tagsCol.where("tenantId", "==", tenantId).where("framework", "==", fw).get().then((s) => new Map(s.docs.map((d) => { const t = d.data() as TagDoc; return [t.noteId, t] as const; })));
  tagCache.set(key, { at: Date.now(), v });
  v.catch(() => tagCache.delete(key));
  return v;
}

/** Where a lesson sits in this framework: the provider's correction first, else the reference map. null = unplaced. */
function place(fw: CurFramework, row: NoteRow, tags: Map<string, TagDoc>): Placement | null {
  const t = tags.get(row.id);
  if (t) {
    const areaIdx = fw.areas.findIndex((a) => a.id === t.areaId);
    if (areaIdx >= 0) return { areaIdx, year: t.year ?? 0, confidence: 0, status: 0, corrected: true };
  }
  const ref = row.oakKey ? fw.lessons[row.oakKey] : undefined;
  return ref ? { areaIdx: ref[0], year: ref[1], confidence: ref[2], status: ref[3], corrected: false } : null;
}

// A child's handed-in quiz ids, cached ~15 s (the drawer re-asks on every year toggle; a fresh hand-in shows within seconds).
const finishedCache = new Map<string, { at: number; v: Promise<Set<string>> }>();
function finishedQuizzes(tenantId: string, childId: string): Promise<Set<string>> {
  const key = `${tenantId}|${childId}`, hit = finishedCache.get(key);
  if (hit && Date.now() - hit.at < 15_000) return hit.v;
  if (finishedCache.size > 500) finishedCache.clear();
  const v = attemptsCol.where("tenantId", "==", tenantId).where("childId", "==", childId).select("assessmentId", "status").get()
    .then((snap) => new Set(snap.docs.filter((d) => d.get("status") !== "in_progress").map((d) => d.get("assessmentId") as string)));
  finishedCache.set(key, { at: Date.now(), v });
  v.catch(() => finishedCache.delete(key));
  return v;
}

interface Scope { rows: NoteRow[]; mode: "tutor" | "child"; done: Set<string>; childId: string | null }
/** The lessons this caller's map is drawn from. */
async function scopeFor(ctx: HubCtx): Promise<Scope | { error: string; status: number }> {
  const all = await noteIndex(ctx.tenantId);
  const usable = (r: NoteRow) => r.published && r.kind !== "board" && (r.isLesson || !!r.oakKey);
  if (ctx.role === "parent" && !ctx.canEdit) {
    if (!ctx.childId && ctx.children.length > 1) return { error: "Which child? Pass ?childId=", status: 400 };
    const kid = scopedChildren(ctx)[0];
    if (!kid) return { error: "Which child? Pass ?childId=", status: 400 };
    const assigned = await childAssignedNoteIds(ctx.tenantId, kid.childId);
    const rows = [...assigned].map((id) => all.get(id)).filter((r): r is NoteRow => !!r && usable(r) && canSee(ctx, r.franchiseId));
    // "Done" = the lesson's exit quiz has been handed in for THIS child.
    const finished = await finishedQuizzes(ctx.tenantId, kid.childId);
    const done = new Set(rows.filter((r) => r.lessonQuizId && finished.has(r.lessonQuizId)).map((r) => r.id));
    return { rows, mode: "child", done, childId: kid.childId };
  }
  const rows = [...all.values()].filter((r) => usable(r) && canSee(ctx, r.franchiseId));
  return { rows, mode: "tutor", done: new Set(), childId: null };
}
const fwParam = (q: unknown) => (typeof q === "string" && frameworkIds().includes(q) ? q : "nc2014");

// GET /curriculum?framework=nc2014|gcse-aqa — the whole map in one small payload (≈120 areas × 11 years).
hubCurriculumApi.get("/curriculum", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const fw = framework(fwParam(req.query.framework));
  if (!fw) { res.status(404).json({ error: "That curriculum isn't available yet" }); return; }
  const scope = await scopeFor(ctx);
  if ("error" in scope) { res.status(scope.status).json({ error: scope.error }); return; }
  const tags = await tenantTags(ctx.tenantId, fw.id);
  const placed: Placement[] = [], doneP: Placement[] = [];
  let unplaced = 0;
  const conf = [0, 0, 0];
  for (const r of scope.rows) {
    const p = place(fw, r, tags);
    if (!p) { unplaced++; continue; }
    placed.push(p);
    if (!p.corrected) conf[p.confidence]!++;
    if (scope.done.has(r.id)) doneP.push(p);
    // A GCSE unit that spans two spec areas counts in both.
    const extra = r.oakKey && !p.corrected ? fw.secondary?.[r.oakKey] : undefined;
    for (const a of (extra ?? []).filter((x) => x !== p.areaIdx)) { const q = { ...p, areaIdx: a }; placed.push(q); if (scope.done.has(r.id)) doneP.push(q); }
  }
  const t = tally(fw, placed), d = scope.mode === "child" ? tally(fw, doneP) : null;
  res.json({
    mode: scope.mode,
    framework: { id: fw.id, label: fw.label, version: fw.version, note: fw.note },
    frameworks: frameworkIds().map(framework).filter((f): f is CurFramework => !!f).map((f) => ({ id: f.id, label: f.label })),
    areas: fw.areas.map((a, i) => ({ id: a.id, subject: a.subject, group: a.group ?? a.subject, strand: a.strand, area: a.area, code: a.code ?? null, y: t.byYear[i]!.slice(1, 12), done: d ? d.byYear[i]!.slice(1, 12) : undefined })),
    rows: t.rows.map((r) => ({ areaId: fw.areas[r.areaIdx]!.id, from: r.from, to: r.to, lessons: r.lessons, status: r.status })),
    summary: t.summary,
    lessons: scope.rows.length, unplaced, autoMapped: { high: conf[0], medium: conf[1], low: conf[2] },
  });
});

// GET /curriculum/lessons?framework=&area=<areaId>&year=<1-11 | all> — the lessons behind one cell.
hubCurriculumApi.get("/curriculum/lessons", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const fw = framework(fwParam(req.query.framework));
  if (!fw) { res.status(404).json({ error: "That curriculum isn't available yet" }); return; }
  const areaIdx = fw.areas.findIndex((a) => a.id === req.query.area);
  if (areaIdx < 0) { res.status(404).json({ error: "Unknown curriculum area" }); return; }
  const yearQ = req.query.year === "all" || req.query.year === undefined ? null : Number(req.query.year);
  const scope = await scopeFor(ctx);
  if ("error" in scope) { res.status(scope.status).json({ error: scope.error }); return; }
  const tags = await tenantTags(ctx.tenantId, fw.id);
  const out: { id: string; title: string; year: number; confidence: number; corrected: boolean; done: boolean; canCorrect: boolean }[] = [];
  for (const r of scope.rows) {
    const p = place(fw, r, tags);
    const hits = p && (p.areaIdx === areaIdx || (!p.corrected && r.oakKey && p.areaIdx !== areaIdx && fw.secondary?.[r.oakKey]?.includes(areaIdx)));
    if (!hits || (yearQ && p!.year !== yearQ)) continue;
    out.push({ id: r.id, title: r.title, year: p!.year, confidence: p!.confidence, corrected: p!.corrected, done: scope.done.has(r.id), canCorrect: ctx.canEdit && canWriteRow(ctx, r.franchiseId) });
  }
  out.sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
  res.json({ area: fw.areas[areaIdx], total: out.length, lessons: out.slice(0, 400) });
});

const tagBody = z.object({ framework: z.string().refine((f) => frameworkIds().includes(f)), areaId: z.string().min(1).max(200), year: z.number().int().min(1).max(11).nullable().optional() });

// PUT /curriculum/tags/:noteId — a tutor corrects where a lesson sits (or places their OWN lesson). Per tenant; beats the reference map.
hubCurriculumApi.put("/curriculum/tags/:noteId", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const noteId = req.params.noteId;
  const parsed = tagBody.safeParse(req.body);
  if (!okId(noteId) || !parsed.success) { res.status(400).json({ error: parsed.success ? "Bad lesson id" : parsed.error.issues }); return; }
  const fw = framework(parsed.data.framework);
  const row = (await noteIndex(ctx.tenantId)).get(noteId);
  // Foreign / unknown lessons are indistinguishable from missing ones (same rule as the rest of the hub).
  if (!fw || !row || !canSee(ctx, row.franchiseId)) { res.status(404).json({ error: "Lesson not found" }); return; }
  if (!canWriteRow(ctx, row.franchiseId)) { res.status(403).json({ error: "This lesson belongs to head office — you can't change where it sits." }); return; }
  if (!fw.areas.some((a) => a.id === parsed.data.areaId)) { res.status(400).json({ error: "Unknown curriculum area" }); return; }
  // A placement needs a year the map can draw (1–11): the tutor's pick, else the lesson's own year if it has one in range.
  const ownYear = row.lessonYear && row.lessonYear >= 1 && row.lessonYear <= 11 ? row.lessonYear : null;
  const year = parsed.data.year ?? ownYear;
  if (!year) { res.status(400).json({ error: "Which year is this lesson for? Pick a year (1–11) so it can be shown on the map." }); return; }
  const doc: TagDoc = { tenantId: ctx.tenantId, franchiseId: row.franchiseId, framework: fw.id, noteId, areaId: parsed.data.areaId, year, byUid: ctx.uid, byName: ctx.name, at: nowIso() };
  await tagsCol.doc(`${ctx.tenantId}__${fw.id}__${noteId}`).set(doc);
  forgetTags(ctx.tenantId);
  res.json({ ok: true, tag: { areaId: doc.areaId, year: doc.year } });
});

// DELETE /curriculum/tags/:noteId?framework= — back to the reference map.
hubCurriculumApi.delete("/curriculum/tags/:noteId", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const noteId = req.params.noteId, fwId = fwParam(req.query.framework);
  if (!okId(noteId) || (req.query.framework !== undefined && req.query.framework !== fwId)) { res.status(400).json({ error: "Bad lesson id" }); return; }
  const ref = tagsCol.doc(`${ctx.tenantId}__${fwId}__${noteId}`), snap = await ref.get();
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || !canWriteRow(ctx, (snap.get("franchiseId") as string | null) ?? null)) { res.status(404).json({ error: "No correction to remove" }); return; }
  await ref.delete();
  forgetTags(ctx.tenantId);
  res.json({ ok: true });
});
