import { randomBytes } from "node:crypto";
import { Router, type Response } from "express";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../../firebase";
import { canSee, canWriteRow, hubConfig, okId, requireEdit, resolveCtx, same, type HubCtx } from "../../lib/hubCore";
import { assessmentUseCached, collate, patchQuestion, questionIndex, topicRank } from "../../lib/hubIndex";
import { forgetHub } from "../../lib/hubCache";
import { pingHub } from "../../lib/hubPing";
import type { HubSettings } from "../../../../lib/hubConfig";
import { GENERATOR_LABEL, isGenerator } from "../../../../features/learninghub/tools/problems";
import { cleanItems, cleanPairs } from "../../lib/hubKinds";
import { claimQuestionImages, dropQuestionImages, imageBase, pictureOf, questionImageIds, signedImage } from "../../lib/hubMedia";
import { assessmentsCol, loadTopics, nowIso, questionsCol, type AssessmentDoc, type QuestionDoc } from "./shared";

// Learning Hub — the question bank (tutors only; a family never reads a question
// directly — it only ever meets the stripped copy inside a running attempt).

export const hubQuestionsApi = Router();

// An option needs a label or a picture (picture answers): the emptiness check is in questionFields.
const pictureRef = z.object({ id: z.string().min(1).max(100) });
const optionSchema = z.object({ id: z.string().trim().min(1).max(40).optional(), text: z.string().trim().max(500).default(""), image: pictureRef.nullable().optional() });
const questionBody = z.object({
  topicId: z.string().min(1).max(100),
  kind: z.string().min(1).max(60),
  prompt: z.string().trim().min(1).max(5000),
  options: z.array(optionSchema).max(12).default([]),
  answer: z.unknown().optional(),
  // match → pairs (term ↔ definition, optional {url, alt} pictures); order → items in the CORRECT order. Checked in questionFields.
  pairs: z.array(z.object({
    term: z.string().max(2000), definition: z.string().max(2000),
    termImage: z.object({ url: z.string().max(1000), alt: z.string().max(300) }).nullable().optional(),
    definitionImage: z.object({ url: z.string().max(1000), alt: z.string().max(300) }).nullable().optional(),
  })).max(20).optional(),
  items: z.array(z.string().max(2000)).max(20).optional(),
  // tool → which generator builds the problem (a fixed seed pins one exact problem; absent = a fresh one every attempt) and optional own tolerances. Checked in questionFields.
  tool: z.object({
    generatorId: z.string().min(1).max(60),
    seed: z.number().int().min(1).max(4294967295).nullable().optional(),
    tol: z.object({ mm: z.number().min(0.1).max(10).optional(), deg: z.number().min(0.1).max(10).optional() }).optional(),
  }).optional(),
  acceptedAnswers: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  tolerance: z.number().finite().min(0).max(1e9).default(0),
  marks: z.number().int().min(1).max(100).default(1),
  explanation: z.string().max(5000).default(""),
  published: z.boolean().default(true),
  // The year groups this question is for (labels, like a quiz audience). Omitted on an edit = keep; [] = not tagged.
  yearGroups: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  // One picture per question; alt text is required (accessibility). Omitted on an edit = keep the current one; null = remove it.
  image: z.object({ id: z.string().min(1).max(100), alt: z.string().trim().min(1, "Describe the picture for screen readers (alt text)").max(300) }).nullable().optional(),
});
type QuestionBody = z.infer<typeof questionBody>;

type Fields = Pick<QuestionDoc, "topicId" | "kind" | "prompt" | "options" | "answer" | "acceptedAnswers" | "tolerance" | "marks" | "explanation" | "published" | "yearGroups"> & { tool?: QuestionDoc["tool"]; pairs?: QuestionDoc["pairs"]; items?: string[] } & { image: { id: string; alt: string } | null };

/** Check the body against the marking rule of its kind (settings.hub.questionKinds)
 *  and shape what is stored: option ids, the answer key, accepted answers. Returns
 *  the fields, or a message for a 400. */
export function questionFields(cfg: HubSettings, b: QuestionBody): Fields | string {
  const kind = cfg.questionKinds.find((k) => k.id === b.kind);
  if (!kind) return `Unknown question type "${b.kind}"`;
  const base = { topicId: b.topicId, kind: b.kind, prompt: b.prompt, marks: b.marks, explanation: b.explanation, published: b.published, yearGroups: [...new Set(b.yearGroups ?? [])], image: b.image ? { id: b.image.id, alt: b.image.alt } : null };

  switch (kind.mark) {
    case "choice":
    case "multi": {
      if (b.options.length < 2) return "A choice question needs at least two options";
      const ids = new Set<string>();
      if (b.options.some((o) => !o.text && !o.image)) return "Every option needs some text or a picture";
      const options = b.options.map((o) => {
        let id = o.id ?? "";
        if (id.includes("/")) id = "";
        while (!id || ids.has(id)) id = `o${randomBytes(3).toString("hex")}`;
        ids.add(id);
        return { id, text: o.text, ...(o.image ? { image: { id: o.image.id } } : {}) };
      });
      if (kind.mark === "choice") {
        if (typeof b.answer !== "string" || !ids.has(b.answer)) return "Pick which option is correct";
        return { ...base, options, answer: b.answer, acceptedAnswers: [], tolerance: 0 };
      }
      if (!Array.isArray(b.answer) || !b.answer.length || !b.answer.every((a) => typeof a === "string" && ids.has(a))) return "Pick every option that is correct";
      return { ...base, options, answer: [...new Set(b.answer as string[])], acceptedAnswers: [], tolerance: 0 };
    }
    case "exact": {
      if (typeof b.answer !== "string" || !b.answer.trim()) return "Enter the correct answer";
      const accepted = [...new Set(b.acceptedAnswers.map((a) => a.trim()).filter(Boolean))];
      return { ...base, options: [], answer: b.answer.trim().slice(0, 500), acceptedAnswers: accepted, tolerance: 0 };
    }
    case "numeric": {
      const n = typeof b.answer === "number" ? b.answer : typeof b.answer === "string" && b.answer.trim() !== "" ? Number(b.answer) : NaN;
      if (!Number.isFinite(n)) return "Enter the correct answer as a number";
      return { ...base, options: [], answer: n, acceptedAnswers: [], tolerance: b.tolerance };
    }
    case "match": {
      const pairs = cleanPairs(b.pairs);
      if (typeof pairs === "string") return pairs;
      return { ...base, options: [], answer: null, pairs, acceptedAnswers: [], tolerance: 0 };
    }
    case "order": {
      const items = cleanItems(b.items);
      if (typeof items === "string") return items;
      return { ...base, options: [], answer: null, items, acceptedAnswers: [], tolerance: 0 };
    }
    case "tool": {
      const t = b.tool;
      if (!t || !isGenerator(t.generatorId)) return `Pick a tool question type (${Object.values(GENERATOR_LABEL).slice(0, 3).join(", ")}…)`;
      // No answer key is stored: marking re-generates the problem from the attempt's seed (lib/hubScoring.ts → features/learninghub/tools/problems.ts).
      return { ...base, options: [], answer: null, acceptedAnswers: [], tolerance: 0, tool: { generatorId: t.generatorId, ...(t.seed ? { seed: t.seed } : {}), ...(t.tol && (t.tol.mm || t.tol.deg) ? { tol: t.tol } : {}) } };
    }
    default: // manual — a tutor marks it, so there is no key
      return { ...base, options: [], answer: null, acceptedAnswers: [], tolerance: 0 };
  }
}

/** Full question as a tutor sees it (with the key). Pictures carry their id (to send back on save) and a signed preview link. */
export const questionOut = (base: string, id: string, q: QuestionDoc, usedBy = 0) => ({
  id, topicId: q.topicId, kind: q.kind, prompt: q.prompt,
  image: q.image?.id ? { id: q.image.id, alt: q.image.alt ?? "", url: signedImage(base, q.image.id) } : pictureOf(base, q.image),
  options: (q.options ?? []).map((o) => ({ id: o.id, text: o.text, ...(o.image?.id ? { image: { id: o.image.id, url: signedImage(base, o.image.id) } } : pictureOf(base, o.image) ? { image: { url: pictureOf(base, o.image)!.url } } : {}) })),
  answer: q.answer ?? null,
  ...(q.pairs?.length ? { pairs: q.pairs } : {}), ...(q.items?.length ? { items: q.items } : {}), ...(q.tool ? { tool: q.tool } : {}),
  acceptedAnswers: q.acceptedAnswers ?? [], tolerance: q.tolerance ?? 0, marks: q.marks, explanation: q.explanation ?? "",
  published: q.published !== false, yearGroups: q.yearGroups ?? [], franchiseId: q.franchiseId ?? null, usedBy, updatedAt: q.updatedAt,
});

/** A visible topic the caller may FILE a question under (a franchise may file under head office's). */
async function usableTopic(ctx: HubCtx, topicId: string) {
  return (await loadTopics(ctx)).find((t) => t.id === topicId) ?? null;
}

/** Published assessments (tenant-wide) using each question id, plus all-assessment counts. A FRESH scan — used by the
 *  (rare) write paths that must be exact; lists use the cached, in-place-patched copy (assessmentUseCached). */
async function assessmentUse(tenantId: string) {
  const snap = await assessmentsCol.where("tenantId", "==", tenantId).select("questionIds", "published", "title").get();
  const published = new Map<string, string[]>(); // questionId → published assessment titles
  const any = new Map<string, number>();
  for (const d of snap.docs) {
    const a = d.data() as Pick<AssessmentDoc, "questionIds" | "published" | "title">;
    for (const q of a.questionIds ?? []) {
      any.set(q, (any.get(q) ?? 0) + 1);
      if (a.published) published.set(q, [...(published.get(q) ?? []), a.title]);
    }
  }
  return { published, any };
}

const strParam = (v: unknown) => (typeof v === "string" && v ? v : null);
const intParam = (v: unknown, dflt: number, max: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : dflt; };
const UNPAGED_MAX = 200; // a plain (un-paged) list call is capped here; ask for `?limit=&cursor=` to walk a bigger bank

/** A question row for LIST screens: enough to pick and scan, never the key, options or explanation. */
const questionLight = (id: string, q: Pick<QuestionDoc, "topicId" | "kind" | "marks" | "prompt" | "published" | "franchiseId" | "updatedAt"> & { image?: unknown; yearGroups?: string[] }, usedBy: number) => ({
  id, topicId: q.topicId, kind: q.kind, prompt: q.prompt.length > 200 ? `${q.prompt.slice(0, 199)}…` : q.prompt, marks: q.marks, published: q.published !== false,
  hasImage: !!q.image, yearGroups: q.yearGroups ?? [], franchiseId: q.franchiseId ?? null, usedBy, updatedAt: q.updatedAt,
});

// GET /questions — the bank. Tutors only. Filters (all optional): `topicId` (a topic id also pulls in its
// subtopics'), `subject`, `kind`, `published=0|1`, `q` (text in the prompt). Pagination: `?limit=&cursor=` returns
// `{ items, total, nextCursor }` (default 50, max 200); without them the reply is a plain array of at most 200.
// `light=1` drops options / answer key / explanation from each row (use GET /questions/:id to open one) — pickers,
// the bank list and the builder use it. Without `light` the rows have the full shape they always had.
hubQuestionsApi.get("/questions", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const topics = await loadTopics(ctx);
  const topicId = strParam(req.query.topicId);
  const subject = strParam(req.query.subject);
  const kind = strParam(req.query.kind);
  const needle = (strParam(req.query.q) ?? "").toLowerCase();
  const pub = req.query.published === "1" ? true : req.query.published === "0" ? false : null;
  const light = req.query.light === "1";
  // `yearGroup` = one label or a comma list (any of them matches); `none` = questions not tagged with a year yet.
  const yearWanted = (strParam(req.query.yearGroup) ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 30);
  const yearFit = (yg?: string[]) => !yearWanted.length || (yearWanted.includes("none") ? !(yg?.length) : !!yg?.some((g) => yearWanted.includes(g.toLowerCase())));
  let ids = new Set(topics.filter((t) => !subject || same(t.subject, subject)).map((t) => t.id));
  // `topicId` = one topic, `topicIds` = a comma list of them (each pulls in its subtopics) — the builder's topic chips.
  const wanted = topicId ? [topicId] : (strParam(req.query.topicIds)?.split(",").filter(Boolean).slice(0, 60) ?? []);
  const scoped = wanted.length > 0;
  if (scoped) {
    if (wanted.some((w) => !topics.some((t) => t.id === w && (!subject || same(t.subject, subject))))) { res.status(404).json({ error: "Topic not found" }); return; }
    ids = new Set(wanted.flatMap((w) => [w, ...topics.filter((t) => t.parentTopicId === w).map((t) => t.id)]));
  }
  // sort=topic → subject › topic › subtopic, then prompt A–Z (the bank's shelves); sort=prompt → prompt A–Z (the builder's picker);
  // default → oldest first. Topic order is an integer rank per topic (a bank can hold ~90k rows: no ICU compares per pair).
  const sortMode = req.query.sort === "topic" ? "topic" : req.query.sort === "prompt" ? "prompt" : "created";
  const rank = sortMode === "topic" ? topicRank(topics) : null;
  const order = <T extends { id: string; topicId: string; prompt: string; createdAt?: string }>(a: T, b: T) =>
    (rank ? (rank.get(a.topicId) ?? -1) - (rank.get(b.topicId) ?? -1) : 0)
    || (sortMode === "created" ? ((a.createdAt ?? "") < (b.createdAt ?? "") ? -1 : (a.createdAt ?? "") > (b.createdAt ?? "") ? 1 : 0) : collate(a.prompt, b.prompt)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const paged = req.query.limit !== undefined || req.query.cursor !== undefined;
  const start = paged ? intParam(req.query.cursor, 0, 1_000_000) : 0;
  const limit = paged ? intParam(req.query.limit, 50, 200) : UNPAGED_MAX;
  const use = await assessmentUseCached(ctx.tenantId);
  const base = imageBase(req);
  const keep = (q: { topicId: string; franchiseId?: string | null; kind: string; published?: boolean; prompt: string; yearGroups?: string[] }) =>
    ids.has(q.topicId) && yearFit(q.yearGroups) && canSee(ctx, q.franchiseId) && (!kind || q.kind === kind) && (pub === null || (q.published !== false) === pub) && (!needle || q.prompt.toLowerCase().includes(needle));

  let total: number;
  let out: unknown[];
  if (scoped && ids.size <= 30) {
    // One topic (+ its subtopics): read exactly those documents — small, exact, and never needs the whole-bank index.
    const snap = await questionsCol.where("tenantId", "==", ctx.tenantId).where("topicId", "in", [...ids]).get();
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as QuestionDoc) })).filter(keep).sort(order);
    total = rows.length;
    out = rows.slice(start, start + limit).map((q) => (light ? questionLight(q.id, q, use.any.get(q.id) ?? 0) : questionOut(base, q.id, q, use.any.get(q.id) ?? 0)));
  } else {
    // Whole bank / a subject / a text search: filter the cached light index, then read full docs for just the page.
    const rows = [...(await questionIndex(ctx.tenantId)).values()].filter(keep).sort(order);
    total = rows.length;
    const page = rows.slice(start, start + limit);
    if (light || !page.length) out = page.map((q) => questionLight(q.id, q, use.any.get(q.id) ?? 0));
    else {
      const snaps = await db.getAll(...page.map((q) => questionsCol.doc(q.id)));
      out = snaps.filter((d) => d.exists).map((d) => questionOut(base, d.id, d.data() as QuestionDoc, use.any.get(d.id) ?? 0));
    }
  }
  if (!paged) { res.set("X-Total-Count", String(total)); res.json(out); return; }
  const next = start + limit;
  res.json({ items: out, total, nextCursor: next < total ? String(next) : null });
});

// GET /questions/counts — how many questions each topic has (own rows, not rolled up), for the topic-first screens.
hubQuestionsApi.get("/questions/counts", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const visible = new Set((await loadTopics(ctx)).map((t) => t.id));
  const byTopic: Record<string, { total: number; published: number }> = {};
  for (const q of (await questionIndex(ctx.tenantId)).values()) {
    if (!visible.has(q.topicId) || !canSee(ctx, q.franchiseId)) continue;
    const c = (byTopic[q.topicId] ??= { total: 0, published: 0 });
    c.total++; if (q.published) c.published++;
  }
  res.json({ byTopic });
});

// GET /questions/:id — one question in full (key, options, explanation, picture links) for the editor.
hubQuestionsApi.get("/questions/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  if (!okId(req.params.id)) { res.status(404).json({ error: "Question not found" }); return; }
  const snap = await questionsCol.doc(req.params.id).get();
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || !canSee(ctx, snap.get("franchiseId"))) { res.status(404).json({ error: "Question not found" }); return; }
  const use = await assessmentUseCached(ctx.tenantId);
  res.json(questionOut(imageBase(req), snap.id, snap.data() as QuestionDoc, use.any.get(snap.id) ?? 0));
});

hubQuestionsApi.post("/questions", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = questionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  if (!(await usableTopic(ctx, parsed.data.topicId))) { res.status(404).json({ error: "Topic not found" }); return; }
  const fields = questionFields(await hubConfig(ctx.tenantId, ctx.franchiseId), parsed.data);
  if (typeof fields === "string") { res.status(400).json({ error: fields }); return; }
  const badPic = await claimQuestionImages(ctx.tenantId, questionImageIds(fields));
  if (badPic) { res.status(400).json({ error: badPic }); return; }
  const now = nowIso();
  const doc: QuestionDoc = { tenantId: ctx.tenantId, franchiseId: ctx.franchiseId, ...fields, createdBy: ctx.uid, createdAt: now, updatedAt: now };
  const ref = await questionsCol.add(doc);
  patchQuestion(ctx.tenantId, ref.id, doc); pingHub(ctx.tenantId, "hubQuestions");
  res.status(201).json(questionOut(imageBase(req), ref.id, doc));
});

/** A visible-and-writable question, or a refusal already sent. */
async function editableQuestion(ctx: HubCtx, id: string, res: Response) {
  if (!okId(id)) { res.status(404).json({ error: "Question not found" }); return null; }
  const snap = await questionsCol.doc(id).get();
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || !canSee(ctx, snap.get("franchiseId"))) { res.status(404).json({ error: "Question not found" }); return null; }
  if (!canWriteRow(ctx, snap.get("franchiseId"))) { res.status(403).json({ error: "That question belongs to head office" }); return null; }
  return snap;
}

hubQuestionsApi.put("/questions/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = questionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const snap = await editableQuestion(ctx, req.params.id, res);
  if (!snap) return;
  const before = snap.data() as QuestionDoc;
  if (!(await usableTopic(ctx, parsed.data.topicId))) { res.status(404).json({ error: "Topic not found" }); return; }
  let body: QuestionBody = parsed.data.image === undefined ? { ...parsed.data, image: before.image?.id ? { id: before.image.id, alt: before.image.alt ?? "" } : null } : parsed.data;
  if (body.yearGroups === undefined) body = { ...body, yearGroups: before.yearGroups ?? [] };
  // Oak's option pictures are links, not uploads. An option the form sends back with no picture keeps its Oak one (a marker the
  // fields step lets through, swapped back below); uploading a picture for that option replaces it.
  const KEEP = "__keep-oak-picture__";
  const oakOptPics = new Map((before.options ?? []).filter((o) => !o.image?.id && o.image?.url).map((o) => [o.id, o.image!] as const));
  if (oakOptPics.size) body = { ...body, options: body.options.map((o) => (o.id && oakOptPics.has(o.id) && !o.image ? { ...o, image: { id: KEEP } } : o)) };
  const fields = questionFields(await hubConfig(ctx.tenantId, before.franchiseId), body);
  if (typeof fields === "string") { res.status(400).json({ error: fields }); return; }
  // An Oak question's picture is a link, not an upload: editing the wording must not silently drop it (send image:null to remove it).
  if (parsed.data.image === undefined && !before.image?.id && before.image?.url) (fields as { image?: unknown }).image = before.image;
  if (oakOptPics.size && "options" in fields && Array.isArray(fields.options)) {
    (fields as { options: { id: string; image?: { id?: string } | null }[] }).options = (fields.options as { id: string; image?: { id?: string } | null }[]).map((o) => (o.image?.id === KEEP ? { ...o, image: oakOptPics.get(o.id) } : o));
  }
  const badPic = await claimQuestionImages(ctx.tenantId, questionImageIds(fields));
  if (badPic) { res.status(400).json({ error: badPic }); return; }
  // A published quiz must never lose a question out from under a student.
  if (before.published !== false && !fields.published) {
    const use = await assessmentUse(ctx.tenantId);
    const titles = use.published.get(snap.id);
    if (titles?.length) { res.status(409).json({ error: `Used by a published quiz (${titles.join(", ")}) — unpublish that first`, code: "question_in_use" }); return; }
  }
  const patch = { ...fields, updatedAt: nowIso() };
  // Changing a question's type must not leave the old key behind (a match's pairs, an order's items).
  await snap.ref.update({ ...patch, ...(fields.pairs ? {} : { pairs: FieldValue.delete() }), ...(fields.items ? {} : { items: FieldValue.delete() }), ...(fields.tool ? {} : { tool: FieldValue.delete() }) });
  const next: QuestionDoc = { ...before, ...patch };
  if (!fields.pairs) delete next.pairs;
  if (!fields.items) delete next.items;
  if (!fields.tool) delete next.tool;
  patchQuestion(ctx.tenantId, snap.id, next); pingHub(ctx.tenantId, "hubQuestions");
  const keep = new Set(questionImageIds(fields));
  void dropQuestionImages(ctx.tenantId, questionImageIds(before).filter((id) => !keep.has(id))); // pictures this edit replaced or removed
  res.json(questionOut(imageBase(req), snap.id, next));
});

hubQuestionsApi.delete("/questions/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const snap = await editableQuestion(ctx, req.params.id, res);
  if (!snap) return;
  const use = await assessmentUse(ctx.tenantId);
  const titles = use.published.get(snap.id);
  if (titles?.length) { res.status(409).json({ error: `Used by a published quiz (${titles.join(", ")}) — unpublish or edit that first`, code: "question_in_use" }); return; }
  // Drafts that still list it just lose the reference.
  const drafts = await assessmentsCol.where("tenantId", "==", ctx.tenantId).select("questionIds").get();
  const batch = db.batch();
  let touched = 0;
  for (const d of drafts.docs) {
    const ids = (d.get("questionIds") as string[] | undefined) ?? [];
    if (ids.includes(snap.id)) { batch.update(d.ref, { questionIds: ids.filter((x) => x !== snap.id), updatedAt: nowIso() }); touched++; }
  }
  batch.delete(snap.ref);
  await batch.commit();
  patchQuestion(ctx.tenantId, snap.id, null); pingHub(ctx.tenantId, "hubQuestions");
  if (touched) { forgetHub(ctx.tenantId, "assessments"); pingHub(ctx.tenantId, "hubAssessments"); }
  void dropQuestionImages(ctx.tenantId, questionImageIds(snap.data() as QuestionDoc));
  res.json({ ok: true, draftsUpdated: touched });
});
