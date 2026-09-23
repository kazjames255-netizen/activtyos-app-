import { FieldPath } from "firebase-admin/firestore";
import { db } from "../firebase";
import { hubCached, patchHub } from "./hubCache";
import { mdExcerpt, readMinutes } from "./hubText";
import type { AssessmentDoc, QuestionDoc, TopicDoc } from "../routes/hub/shared";
import type { EnrolmentDoc } from "./hubCore";

// Learning Hub — cached, tenant-wide READ MODELS (lists the hub re-reads on nearly every request): the topic
// tree, a light question index, the note index, the assessment rows, the roster. Each is a raw, tenant-scoped copy;
// callers filter it through hubCore's canSee / subjectAllowed per request (access is never cached).
//
// Freshness: every write route patches the cached copy in place (`patch*`) or drops it (`forgetHub`), so a tutor
// sees their own change at once; the TTLs are the backstop for writes that bypass the API (seed scripts).

const topicsCol = db.collection("hubTopics");
const notesCol = db.collection("hubNotes");
const questionsCol = db.collection("hubQuestions");
const assessmentsCol = db.collection("hubAssessments");
const enrolCol = db.collection("hubEnrolments");

const TTL_TOPICS = 60_000;
// Questions / notes / assessments / cards: patched on every API write, so this only bounds seed-script staleness. It was 3 min,
// which at scale (a tenant with ~89k questions + ~49k cards + 8.5k assessments) meant a background re-read of ~150k documents
// every few minutes — parsing that blocked the event loop for seconds and made every "warm" request slow (see docs/hub-review/perf-round4.md).
const TTL_INDEX = 20 * 60_000;
const TTL_ROSTER = 30_000;

// ── sorting helpers ──────────────────────────────────────────────────────────
// `String.prototype.localeCompare` goes through ICU on every call; sorting ~90k question rows by a topic label that way took
// several seconds per request. Lists sort by a precomputed topic RANK (an integer per topic id) and use one shared collator
// for the text tie-breaks.
export const collate: (a: string, b: string) => number = new Intl.Collator(undefined, { sensitivity: "variant" }).compare;
/** topic id → its position in subject › topic › subtopic order (the "shelf" order every library list uses). */
export function topicRank(topics: readonly { id: string; subject: string; topic: string; subtopic?: string | null }[]): Map<string, number> {
  const sorted = [...topics].sort((a, b) => collate(a.subject, b.subject) || collate(a.topic, b.topic) || collate(a.subtopic ?? "", b.subtopic ?? ""));
  return new Map(sorted.map((t, i) => [t.id, i] as const));
}

// ── parallel (sharded) tenant reads ──────────────────────────────────────────
// One `where tenantId ==` query streams at ~1.5–2.5k docs/s from here, so the 89k-question index of a big tenant took ~55 s (and
// the 49k-card one ~20 s) to build. Splitting the same query into N id ranges that are read in parallel gets N streams working
// at once. The ranges come from the tenant's smallest and largest document ids (two 1-row queries): the id space between them is
// split evenly on the first character that differs, so both random ids and prefixed, sequential ids (`oak-<tenant>-q-<hash>…`)
// shard well. `orderBy(documentId)` with an equality filter needs no composite index. Rows are returned in id order.
const SHARDS = 8;
export async function shardedTenantRead(col: FirebaseFirestore.CollectionReference, tenantId: string, fields: string[] | null): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  const idPath = FieldPath.documentId();
  const base = col.where("tenantId", "==", tenantId);
  const q = fields ? base.select(...fields) : base;
  const [lo, hi] = await Promise.all([base.select().orderBy(idPath).limit(1).get(), base.select().orderBy(idPath, "desc").limit(1).get()]);
  if (lo.empty || hi.empty) return [];
  const minId = lo.docs[0]!.id, maxId = hi.docs[0]!.id;
  let p = 0;
  while (p < minId.length && p < maxId.length && minId[p] === maxId[p]) p++;
  const prefix = minId.slice(0, p);
  const a = minId.charCodeAt(p) || 0x20, b = maxId.charCodeAt(p) || 0x7e;
  // Boundaries strictly inside (a, b]; too narrow a range (or one id) → a single query.
  const cuts: string[] = [];
  for (let i = 1; i < SHARDS; i++) { const c = a + Math.round(((b - a) * i) / SHARDS); if (c > a && c <= b && !cuts.includes(prefix + String.fromCharCode(c))) cuts.push(prefix + String.fromCharCode(c)); }
  if (!cuts.length) return (await q.get()).docs;
  const ranges = [minId, ...cuts];
  const parts = await Promise.all(ranges.map((start, i) => {
    let r = q.orderBy(idPath).startAt(start);
    if (i + 1 < ranges.length) r = r.endBefore(ranges[i + 1]!);
    return r.get();
  }));
  return parts.flatMap((s) => s.docs);
}

// ── topics ───────────────────────────────────────────────────────────────────
export type TopicRow = TopicDoc & { id: string };
// A single `where tenantId ==` stream (no `swr`, a 60s TTL) was fine for a ~700-topic tenant, but blocks the request
// outright once the TTL lapses — and every hub request goes through `visibleTopics()` → here. At real-tenant scale
// (2,400+ topics) under Firestore contention (a concurrent bulk import) that stream spiked past 30s. Sharded (like
// the other big indexes) + `swr` so a request never blocks on a rebuild once the first one has landed, and `disk` so
// a process restart doesn't either.
export const tenantTopics = (tenantId: string): Promise<TopicRow[]> =>
  hubCached("topics", tenantId, "", TTL_TOPICS, async () => (await shardedTenantRead(topicsCol, tenantId, null)).map((d) => ({ id: d.id, ...(d.data() as TopicDoc) })), { swr: true, disk: true });

export const patchTopic = (tenantId: string, row: TopicRow | { id: string; deleted: true }) =>
  patchHub<TopicRow[]>("topics", tenantId, (list) => {
    const at = list.findIndex((t) => t.id === row.id);
    if ("deleted" in row) { if (at >= 0) list.splice(at, 1); return; }
    if (at >= 0) list[at] = row; else list.push(row);
  });

// ── questions (light) ────────────────────────────────────────────────────────
/** What a list needs from a question — never the answer key, options or explanation. */
export interface QRow {
  id: string; topicId: string; franchiseId: string | null; kind: string; prompt: string; marks: number; published: boolean; yearGroups: string[];
  /** An upload ({id}) or an Oak-hosted picture ({url}) — either way the row says "has a picture"; payloads go through lib/hubMedia `pictureOf`. */
  image: { id?: string; url?: string; alt: string } | null; createdAt: string; updatedAt: string;
}
const Q_FIELDS = ["topicId", "franchiseId", "kind", "prompt", "marks", "published", "image", "yearGroups", "createdAt", "updatedAt"] as const;
const qRow = (id: string, q: Partial<QuestionDoc>): QRow => ({
  id, topicId: q.topicId ?? "", franchiseId: q.franchiseId ?? null, kind: q.kind ?? "", prompt: q.prompt ?? "", marks: q.marks ?? 1, published: q.published !== false, yearGroups: q.yearGroups ?? [],
  image: q.image?.id ? { id: q.image.id, alt: q.image.alt ?? "" } : (q.image as { url?: string } | null | undefined)?.url ? { url: (q.image as { url: string }).url, alt: q.image?.alt ?? "" } : null,
  createdAt: q.createdAt ?? "", updatedAt: q.updatedAt ?? "",
});
export const questionIndex = (tenantId: string): Promise<Map<string, QRow>> =>
  hubCached("questions", tenantId, "", TTL_INDEX, async () => {
    const docs = await shardedTenantRead(questionsCol, tenantId, [...Q_FIELDS]);
    return new Map(docs.map((d) => [d.id, qRow(d.id, d.data() as Partial<QuestionDoc>)] as const));
  }, { swr: true, disk: true });
export const patchQuestion = (tenantId: string, id: string, doc: Partial<QuestionDoc> | null) =>
  patchHub<Map<string, QRow>>("questions", tenantId, (m) => { if (doc) m.set(id, qRow(id, doc)); else m.delete(id); });

// ── notes ────────────────────────────────────────────────────────────────────
export interface NoteRow {
  id: string; topicId: string; franchiseId: string | null; published: boolean; title: string; excerpt: string; hasBody: boolean; readMinutes: number;
  attachments: { id: string; name: string; contentType: string; size: number }[]; videos: unknown[] | undefined;
  createdByName: string; createdAt: string; updatedAt: string; /** lower-cased title + body, for search only */ search: string;
  /** Has a structured interactive `lesson` (features/learninghub/lesson) — the card says so and the reader plays it. */
  isLesson: boolean; lessonWidget: string | null;
  /** "board" = a whiteboard snapshot saved from a live lesson (not an ordinary lesson). */
  kind: "board" | null;
  /** The lesson's exit quiz (an assessment id), if it has one. */
  lessonQuizId: string | null;
  /** The school year (1–13) the lesson is for, when its `lesson.year` says ("6", 6 or "Year 6"); null otherwise. */
  lessonYear: number | null;
}
interface NoteDocLike { topicId?: string; franchiseId?: string | null; published?: boolean; title?: string; body?: string; attachments?: NoteRow["attachments"]; videos?: unknown[]; createdByName?: string; createdAt?: string; updatedAt?: string; kind?: string; lesson?: { widget?: string | null; quizId?: string | null; year?: unknown } | null; excerpt?: string; readMinutes?: number; hasBody?: boolean }
const yearOf = (v: unknown): number | null => {
  const m = /^\s*(?:year\s*)?(\d{1,2})\s*$/i.exec(String(v ?? ""));
  const y = m ? Number(m[1]) : NaN;
  return y >= 1 && y <= 13 ? y : null;
};
export const noteRow = (id: string, n: NoteDocLike): NoteRow => {
  const body = n.body ?? "";
  // The list index is built WITHOUT the body (imported lessons carry ~20-70KB of it each): use the excerpt / read time / hasBody the
  // importer stored on the doc. A doc that has a body (API-written notes, or one just patched) is derived from it as before.
  const stored = n.body === undefined && typeof n.excerpt === "string";
  return {
    id, topicId: n.topicId ?? "", franchiseId: n.franchiseId ?? null, published: n.published !== false, title: n.title ?? "", excerpt: stored ? n.excerpt! : mdExcerpt(body), hasBody: stored ? !!n.hasBody : !!body.trim(),
    readMinutes: stored ? (n.readMinutes ?? 1) : readMinutes(body), attachments: n.attachments ?? [], videos: n.videos, createdByName: n.createdByName || "Your tutor", createdAt: n.createdAt ?? "", updatedAt: n.updatedAt ?? "",
    search: `${n.title ?? ""}\n${stored ? n.excerpt : body}`.toLowerCase(),
    kind: n.kind === "board" ? "board" : null,
    isLesson: !!n.lesson && typeof n.lesson === "object", lessonWidget: typeof n.lesson?.widget === "string" ? n.lesson.widget : null,
    lessonQuizId: typeof n.lesson?.quizId === "string" && n.lesson.quizId ? n.lesson.quizId : null,
    lessonYear: yearOf(n.lesson?.year),
  };
};
export const noteIndex = (tenantId: string): Promise<Map<string, NoteRow>> =>
  hubCached("notes", tenantId, "", TTL_INDEX, async () => {
    // Only the fields a list row needs. An imported Oak lesson doc carries its whole slide deck + transcript + keywords inside `lesson`
    // (~40KB each): reading every note in full made this query time out (HTTP 500 after ~130 s) once a tenant held ~7,500 lessons.
    const docs = await shardedTenantRead(notesCol, tenantId,
      ["topicId", "franchiseId", "published", "title", "excerpt", "readMinutes", "hasBody", "attachments", "videos", "createdByName", "createdAt", "updatedAt", "lesson.widget", "lesson.quizId", "lesson.year", "lesson.outcome", "lesson.lessonSlug"]);
    // Notes written through the API have no stored excerpt: read just their body (a few docs, in chunks).
    const bodies = new Map<string, string>();
    const bare = docs.filter((d) => typeof d.get("excerpt") !== "string");
    for (let i = 0; i < bare.length; i += 300) {
      const got = await db.getAll(...bare.slice(i, i + 300).map((d) => d.ref), { fieldMask: ["body"] });
      for (const g of got) bodies.set(g.id, (g.get("body") as string | undefined) ?? "");
    }
    return new Map(docs.map((d) => {
      const data = d.data() as NoteDocLike;
      if (bodies.has(d.id)) data.body = bodies.get(d.id);
      return [d.id, noteRow(d.id, data)] as const;
    }));
  }, { swr: true, disk: true });
export const patchNote = (tenantId: string, id: string, doc: NoteDocLike | null) =>
  patchHub<Map<string, NoteRow>>("notes", tenantId, (m) => { if (doc) m.set(id, noteRow(id, doc)); else m.delete(id); });

// ── assessments ──────────────────────────────────────────────────────────────
export type AsmRow = AssessmentDoc & { id: string };
export const assessmentRows = (tenantId: string): Promise<Map<string, AsmRow>> =>
  hubCached("assessments", tenantId, "", TTL_INDEX, async () => {
    const docs = await shardedTenantRead(assessmentsCol, tenantId, null);
    return new Map(docs.map((d) => [d.id, { id: d.id, ...(d.data() as AssessmentDoc) }] as const));
  }, { swr: true, disk: true });
export const patchAssessment = (tenantId: string, id: string, doc: AssessmentDoc | null) =>
  patchHub<Map<string, AsmRow>>("assessments", tenantId, (m) => { if (doc) m.set(id, { id, ...doc }); else m.delete(id); });

/** questionId → { published titles, how many assessments use it } — derived from the cached assessment rows. */
export async function assessmentUseCached(tenantId: string) {
  const rows = await assessmentRows(tenantId);
  const published = new Map<string, string[]>();
  const any = new Map<string, number>();
  for (const a of rows.values()) {
    for (const q of a.questionIds ?? []) {
      any.set(q, (any.get(q) ?? 0) + 1);
      if (a.published !== false) { const l = published.get(q); if (l) l.push(a.title); else published.set(q, [a.title]); }
    }
  }
  return { published, any };
}

// ── flashcards (light) ───────────────────────────────────────────────────────
export interface CardRow { id: string; topicId: string; franchiseId: string | null; published: boolean; createdAt: string }
const flashcardsCol = db.collection("hubFlashcards");
export const cardIndex = (tenantId: string): Promise<Map<string, CardRow>> =>
  hubCached("cards", tenantId, "", TTL_INDEX, async () => {
    const docs = await shardedTenantRead(flashcardsCol, tenantId, ["topicId", "franchiseId", "published", "createdAt"]);
    return new Map(docs.map((d) => [d.id, { id: d.id, topicId: d.get("topicId") as string, franchiseId: (d.get("franchiseId") as string | null) ?? null, published: d.get("published") !== false, createdAt: (d.get("createdAt") as string) ?? "" }] as const));
  }, { swr: true, disk: true });
export const patchCard = (tenantId: string, id: string, doc: { topicId?: string; franchiseId?: string | null; published?: boolean; createdAt?: string } | null) =>
  patchHub<Map<string, CardRow>>("cards", tenantId, (m) => {
    if (!doc) { m.delete(id); return; }
    const prev = m.get(id);
    m.set(id, { id, topicId: doc.topicId ?? prev?.topicId ?? "", franchiseId: doc.franchiseId !== undefined ? doc.franchiseId : prev?.franchiseId ?? null, published: doc.published !== undefined ? doc.published !== false : prev?.published ?? true, createdAt: doc.createdAt ?? prev?.createdAt ?? "" });
  });

// ── roster ───────────────────────────────────────────────────────────────────
/** Every enrolment row of the tenant (active or not), unfiltered — callers apply canSeeStudent. */
export const tenantRoster = (tenantId: string): Promise<EnrolmentDoc[]> =>
  hubCached("roster", tenantId, "", TTL_ROSTER, async () => (await enrolCol.where("tenantId", "==", tenantId).get()).docs.map((d) => d.data() as EnrolmentDoc));
