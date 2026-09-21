// Oak National Academy → Learning Hub importer (contract: docs/oak-import.md).
//
//   cd server
//   npx tsx src/oak/import.ts <tenantId> [--dry] [--subject Maths] [--programme <slug-substring>] [--keystage ks2]
//                                        [--year 6] [--unit <substring>] [--limit N] [--add-kinds] [--real] [--slim-body] [--slides] [--stats out.json]
//   npx tsx src/oak/import.ts check <tenantId> [same filters] [--deep]
//   npx tsx src/oak/import.ts clean <tenantId>          (deletes ONLY docs whose id starts `oak-<tenantId>-`)
//
// Reads scratch/oak-raw/<programme>/*.json (crawler output, never modified) and writes, per Oak lesson:
//   hubTopics (unit = topic, "Year N" subtopic) · hubNotes (the Lesson) · hubQuestions (starter + exit) ·
//   hubAssessments (lesson quiz + per-unit check) · hubFlashcards (keyword + cloze cards)
//
// SAFETY
//  · Only ever CREATES/OVERWRITES docs whose id starts `oak-<tenantId>-` (deterministic, so a re-run updates in place);
//    it never edits or deletes any other doc, never prunes, sends no email/notification and never goes through the API.
//    (Topic rows the tenant already has — same subject + topic + "Year N", case-insensitive — are REUSED, not written.)
//  · The owner's real tenants are refused unless --real (their ids are listed in REAL_TENANTS); @activityos-test.com
//    tenants are always refused. Legal sign-off for public launch is the owner's (see docs/oak-import.md).
//  · Writes are batched (≤400 ops, ≤~6MB), retried, ordered topics → questions → assessments → notes → flashcards per
//    unit, so an interrupted run never leaves an assessment pointing at a missing question. Re-running resumes.
//  · Pure content: no LLM, no network. Every doc: imported:true + source:{provider:"oak",url,licence:"OGL-3.0"}.
import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../firebase";
import { mergeHub, type HubSettings } from "../../../lib/hubConfig";
import { markResponse, type MarkRule } from "../lib/hubScoring";
import { mdExcerpt, readMinutes } from "../lib/hubText";
import { convertMath } from "./math";
import { SLIDES_BY_LESSON } from "./slides";
import { applyArtPolicy } from "./factory/art/select";
import type { Slide } from "../../../features/learninghub/lesson/slides/types";
import { EXTRAS_BY_LESSON } from "./extras";
import { deckFor, curatedFor, factsFromRaw, planFor, slideTextFor } from "./factory";
import { tidy, convertOakQuestion, type OakKind, type RawQ } from "./factory/quality";
import { flashcardsFor } from "./factory/generate";
import { planToMarkdown, PLAN_HEADING } from "../../../features/learninghub/lesson/plan";

// ── args ─────────────────────────────────────────────────────────────────────
function takeFlag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0) return undefined;
  const v = process.argv[i + 1];
  process.argv.splice(i, v && !v.startsWith("--") ? 2 : 1);
  return v && !v.startsWith("--") ? v : "";
}
const takeBool = (name: string) => { const i = process.argv.indexOf(name); if (i >= 0) process.argv.splice(i, 1); return i >= 0; };
const DRY = takeBool("--dry");
const REAL = takeBool("--real");
const ADD_KINDS = takeBool("--add-kinds");
const DEEP = takeBool("--deep");
const GEN_SLIDES = takeBool("--slides"); // lesson factory: every lesson gets a slide deck (hand-built > curated/agent-authored > generated), see docs/oak-import.md "Factory"
takeBool("--slim-body"); // (no-op now: the raw video transcript is never stored — the lesson `plan` replaces it)
const SUBJECT = takeFlag("--subject");
const PROGRAMME = takeFlag("--programme");
const KEYSTAGE = takeFlag("--keystage");
const YEAR = takeFlag("--year");
const UNIT = takeFlag("--unit");
const LESSON = takeFlag("--lesson"); // substring of the lesson slug or title (import a single lesson)
const LIMIT = takeFlag("--limit");
const STATS_OUT = takeFlag("--stats");
const arg1 = process.argv[2];
const MODE: "import" | "check" | "clean" = arg1 === "check" ? "check" : arg1 === "clean" ? "clean" : "import";
const TID = MODE === "import" ? arg1 : process.argv[3];
if (!TID || TID.startsWith("-")) {
  console.error("Usage: npx tsx src/oak/import.ts <tenantId> [--dry] [--subject S] [--programme p] [--keystage ks2] [--year N] [--unit u] [--limit N] [--add-kinds] [--real]\n       npx tsx src/oak/import.ts check <tenantId> [filters] [--deep]\n       npx tsx src/oak/import.ts clean <tenantId>");
  process.exit(1);
}
const LIMIT_N = LIMIT !== undefined && LIMIT !== "" ? Number(LIMIT) : Infinity;
if (!(LIMIT_N > 0)) { console.error("--limit must be a positive number"); process.exit(1); }

const REAL_TENANTS = new Set(["7jG2XO3cOD3VtoL8YfFY", "jYp5XNZGT7bgSUMuEgHN"]); // the owner's real tenants
const here = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.resolve(here, "../../../scratch/oak-raw");
const RULES_FILE = path.resolve(here, "../../../scratch/prototype/widgets/rules.json");
const P = `oak-${TID}-`;
const MAX_DOC_BYTES = 900_000;
const ATTR_URL = "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/";
const lc = (s: unknown) => String(s ?? "").trim().toLowerCase();
const slug = (s: string) => lc(s).replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const h10 = (s: string) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 10);

// ── subject mapping ──────────────────────────────────────────────────────────
const SUBJECT_ORDER = ["Maths", "English", "Science", "French", "Spanish", "German"];
const HUB_SUBJECT: Record<string, string> = { maths: "Maths", english: "English", science: "Science", french: "French", spanish: "Spanish", german: "German", biology: "Science", chemistry: "Science", physics: "Science", "combined science": "Science" };
const TOPIC_PREFIX: Record<string, string> = { biology: "Biology — ", chemistry: "Chemistry — ", physics: "Physics — ", "combined science": "Combined Science — " };
const LANGUAGES = new Set(["French", "Spanish", "German"]);

// ── question kinds (match / order are owned by the hub-rules agent: adapt HERE if their ids / mark rules differ) ──
const KIND_WANT: Record<OakKind, { id: string; label: string; mark: string }> = {
  single: { id: "single", label: "Single choice", mark: "choice" },
  multi: { id: "multi", label: "Multiple choice", mark: "multi" },
  short: { id: "short", label: "Short answer", mark: "exact" },
  match: { id: "match", label: "Matching", mark: "match" },
  order: { id: "order", label: "Put in order", mark: "order" },
};

// ── stats ────────────────────────────────────────────────────────────────────
type Bag = Record<string, number>;
const bump = (b: Bag, k: string, n = 1) => { b[k] = (b[k] ?? 0) + n; };
const stats = {
  lessonsScanned: 0, lessonsDuplicate: 0, lessonsInScope: 0, lessonsImported: 0,
  skipped: {} as Bag, dropped: {} as Bag,
  docs: {} as Bag, bytes: {} as Bag, maxBytes: {} as Bag, oversize: [] as { id: string; col: string; bytes: number }[],
  notesBySubject: {} as Bag, notesByKS: {} as Bag, questionsBySubject: {} as Bag, cardsBySubject: {} as Bag,
  qKind: {} as Bag, qOakType: {} as Bag, qSlot: {} as Bag, images: 0, optionImages: 0, uniqueImages: new Set<string>(),
  mathConverted: 0, mathResidual: 0, questionsWithResidualMath: 0, lessonsQuizFromStarter: 0, widgets: {} as Bag,
  unitChecks: 0, dupFlashFronts: 0, plans: {} as Bag, planSkipped: {} as Bag, maxNoteBytes: 0, decks: {} as Bag, deckSkipped: {} as Bag,
};
const noteSizes: number[] = [];

// ── raw index ────────────────────────────────────────────────────────────────
interface Ref {
  file: string; programmes: string[]; subjectTitle: string; subject: string; ks: string; year: number; unitSlug: string; unitTitle: string;
  lessonSlug: string; lessonTitle: string; order: number; ownTid: string;
}
/** Scanning parses every raw file (~40s for 8k lessons), so the light index is cached in the OS temp dir, keyed by a
 *  signature of every raw file's name/size/mtime — any change to the raw data rebuilds it. */
function scanRaw(): Ref[] {
  const dirs = fs.readdirSync(RAW, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  const files: { prog: string; f: string }[] = [];
  const sig = crypto.createHash("sha1");
  for (const prog of dirs) for (const f of fs.readdirSync(path.join(RAW, prog)).filter((x) => x.endsWith(".json")).sort()) {
    files.push({ prog, f });
    const st = fs.statSync(path.join(RAW, prog, f)); sig.update(`${prog}/${f}:${st.size}:${st.mtimeMs}|`);
  }
  const cacheFile = path.join(os.tmpdir(), `oak-import-index-${sig.digest("hex").slice(0, 16)}.json`);
  try {
    const c = JSON.parse(fs.readFileSync(cacheFile, "utf8")) as { rows: Ref[]; scanned: number; duplicate: number; skipped: Bag };
    stats.lessonsScanned = c.scanned; stats.lessonsDuplicate = c.duplicate; for (const [k, v] of Object.entries(c.skipped)) bump(stats.skipped, k, v);
    return c.rows;
  } catch { /* no usable cache */ }
  const rows = new Map<string, Ref>();
  for (const { prog, f } of files) {
    const file = path.join(RAW, prog, f);
    let o: Record<string, unknown>;
    try { o = JSON.parse(fs.readFileSync(file, "utf8")); } catch { bump(stats.skipped, "unreadable/incomplete JSON file (crawler still writing?)"); continue; }
    stats.lessonsScanned++;
    const subjectTitle = String(o.subjectTitle ?? "");
    const subject = HUB_SUBJECT[lc(subjectTitle)];
    if (!subject) { bump(stats.skipped, `unknown subject "${subjectTitle}"`); continue; }
    const year = Number(o.year);
    if (!Number.isInteger(year) || year < 1 || year > 13) { bump(stats.skipped, "no valid year group"); continue; }
    if (!o.unitSlug || !o.lessonSlug || !o.lessonTitle || !o.unitTitle) { bump(stats.skipped, "missing unit/lesson slug or title"); continue; }
    const ks = String(o.keyStageSlug ?? "");
    const key = `${subjectTitle}|${ks}|${o.unitSlug}|${o.lessonSlug}`; // Foundation/Higher + overlapping programmes collapse here
    const prev = rows.get(key);
    if (prev) { if (!prev.programmes.includes(prog)) prev.programmes.push(prog); stats.lessonsDuplicate++; continue; }
    rows.set(key, { file, programmes: [prog], subjectTitle, subject, ks, year, unitSlug: String(o.unitSlug), unitTitle: String(o.unitTitle), lessonSlug: String(o.lessonSlug), lessonTitle: String(o.lessonTitle), order: Number(o.orderInUnit) || 0, ownTid: h10(key) });
  }
  const out = [...rows.values()];
  try { fs.writeFileSync(cacheFile, JSON.stringify({ rows: out, scanned: stats.lessonsScanned, duplicate: stats.lessonsDuplicate, skipped: stats.skipped })); } catch { /* cache is optional */ }
  return out;
}
const sOrder = (s: string) => { const i = SUBJECT_ORDER.indexOf(s); return i < 0 ? 99 : i; };
function inScope(r: Ref): boolean {
  if (SUBJECT && lc(SUBJECT) !== lc(r.subject) && lc(SUBJECT) !== lc(r.subjectTitle)) return false;
  if (PROGRAMME && !r.programmes.some((p) => p.includes(lc(PROGRAMME)))) return false;
  if (KEYSTAGE && lc(KEYSTAGE) !== lc(r.ks)) return false;
  if (YEAR && Number(YEAR) !== r.year) return false;
  if (UNIT && !(lc(r.unitSlug).includes(lc(UNIT)) || lc(r.unitTitle).includes(lc(UNIT)))) return false;
  if (LESSON && !(lc(r.lessonSlug).includes(lc(LESSON)) || lc(r.lessonTitle ?? "").includes(lc(LESSON)))) return false;
  return true;
}

// ── widget rules (same logic as scratch/prototype/build.mjs) ────────────────
interface WidgetRule { id: string; subject?: string; match: string }
function loadWidgetRules(): { id: string; subject?: string; re: RegExp }[] {
  if (!fs.existsSync(RULES_FILE)) return [];
  let raw: WidgetRule[] = [];
  try { raw = JSON.parse(fs.readFileSync(RULES_FILE, "utf8")); } catch (e) { console.warn(`  warn: ${RULES_FILE} unreadable — no widgets (${(e as Error).message})`); return []; }
  const out: { id: string; subject?: string; re: RegExp }[] = [];
  for (const r of raw) { try { out.push({ id: r.id, subject: r.subject, re: new RegExp(r.match, "i") }); } catch { console.warn(`  warn: widget rule ${r.id}: bad regex ${r.match} — skipped`); } }
  return out;
}
const WIDGET_RULES = loadWidgetRules();
const widgetFor = (subjectTitle: string, unitTitle: string, lessonTitle: string) =>
  WIDGET_RULES.find((r) => (!r.subject || r.subject === subjectTitle) && r.re.test(`${unitTitle} | ${lessonTitle}`))?.id ?? "";

// ── text helpers ─────────────────────────────────────────────────────────────
const mathState = { conv: 0, res: 0 };
/** Text with LaTeX made readable; tracks conversions. */
function cm(t: string): string { const r = convertMath(t); mathState.conv += r.converted; mathState.res += r.residual; return r.text; }
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

// ── lesson factory: keywords of the rest of the unit (only ever wrong options for keyword questions) ──
let ALL_REFS: Ref[] = [];
const unitPoolCache = new Map<string, { k: string; d: string }[]>();
function unitPool(r: Ref): { k: string; d: string }[] {
  const key = `${r.subjectTitle}|${r.ks}|${r.unitSlug}`;
  let p = unitPoolCache.get(key);
  if (p) return p;
  p = [];
  for (const x of ALL_REFS) {
    if (x.subjectTitle !== r.subjectTitle || x.ks !== r.ks || x.unitSlug !== r.unitSlug || x.lessonSlug === r.lessonSlug) continue;
    try { for (const k of factsFromRaw(JSON.parse(fs.readFileSync(x.file, "utf8")), cm).keywords) if (k.d && !p.some((y) => lc(y.k) === lc(k.k))) p.push(k); } catch { /* skip unreadable */ }
  }
  unitPoolCache.set(key, p);
  return p;
}

// ── deterministic rng (for the unit-check sample) ───────────────────────────
function seedRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = (h ^= h >>> 16) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffled<T>(xs: T[], seed: string): T[] { const r = seedRng(seed); const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ── tenant context ───────────────────────────────────────────────────────────
interface Ctx {
  name: string; ownerName: string; ownerUid: string; cfg: HubSettings; kinds: Record<OakKind, string>; missingKinds: OakKind[];
  yearLabel: (y: number) => string; spell: (s: string) => string;
  topics: { id: string; subject: string; topic: string; subtopic: string | null; parent: string | null }[];
}
async function guard() {
  const t = await db.collection("tenants").doc(TID).get();
  if (!t.exists) { console.error(`No tenant ${TID}.`); process.exit(1); }
  const ownerUid = (t.get("ownerUid") as string | undefined) ?? "";
  const owner = ownerUid ? await db.collection("users").doc(ownerUid).get() : null;
  const emails = [t.get("email"), t.get("notifyEmail"), owner?.get("email")].filter((e): e is string => typeof e === "string");
  const bad = emails.find((e) => e.toLowerCase().endsWith("@activityos-test.com"));
  if (bad) { console.error(`Refusing: tenant ${TID} is an e2e test account (${bad}).`); process.exit(1); }
  if (REAL_TENANTS.has(TID) && !REAL && MODE !== "check") { console.error(`Refusing: ${TID} is one of the owner's real tenants. Import to a staging tenant, or pass --real once the lead says so.`); process.exit(1); }
  return { name: (t.get("name") as string) ?? TID, ownerUid, ownerName: ((owner?.get("name") as string | undefined) ?? "").trim() || "Your tutor" };
}
async function tenantCtx(): Promise<Ctx> {
  const g = await guard();
  const lib = await db.collection("libraries").doc(TID).get();
  const cfg = mergeHub((lib.get("settings.hub") ?? null) as Partial<HubSettings> | null);
  const kinds = {} as Record<OakKind, string>;
  const missingKinds: OakKind[] = [];
  for (const k of Object.keys(KIND_WANT) as OakKind[]) {
    const w = KIND_WANT[k];
    const pick = cfg.questionKinds.find((x) => x.id === w.id && x.mark === w.mark) ?? cfg.questionKinds.find((x) => x.mark === w.mark);
    if (pick) kinds[k] = pick.id; else { kinds[k] = w.id; missingKinds.push(k); }
  }
  const topicSnap = await db.collection("hubTopics").where("tenantId", "==", TID).get();
  const topics = topicSnap.docs.filter((d) => (d.get("franchiseId") ?? null) === null).map((d) => ({ id: d.id, subject: String(d.get("subject")), topic: String(d.get("topic")), subtopic: (d.get("subtopic") as string | null) ?? null, parent: (d.get("parentTopicId") as string | null) ?? null }));
  const spelled = new Map<string, string>();
  const spell = (s: string) => { if (!spelled.has(s)) spelled.set(s, topics.find((t) => lc(t.subject) === lc(s))?.subject ?? s); return spelled.get(s)!; };
  const yearLabel = (y: number) => cfg.yearGroups.find((x) => lc(x) === lc(`Year ${y}`)) ?? `Year ${y}`;
  return { ...g, cfg, kinds, missingKinds, yearLabel, spell, topics };
}

// ── ids ──────────────────────────────────────────────────────────────────────
/** Oak publishes every lesson's slide deck as a public Google Slides file; its id lets the player embed the real deck (lesson.oakDeck). */
function oakDeckId(o: Record<string, unknown>): string | null {
  const m = String(o.presentationUrl ?? "").match(/\/presentation\/d\/([A-Za-z0-9_-]{20,80})/);
  return m ? m[1] : null;
}

const ID = {
  topic: (subject: string, topic: string) => `${P}tp-${slug(subject)}-${h10(lc(topic))}`,
  sub: (subject: string, topic: string, year: number) => `${P}tp-${slug(subject)}-${h10(lc(topic))}-y${year}`,
  note: (r: Ref) => `${P}n-${r.ownTid}-${slug(r.lessonSlug).slice(0, 60)}`,
  q: (r: Ref, qid: unknown) => `${P}q-${r.ownTid}-${qid}`,
  lessonQuiz: (r: Ref) => `${P}a-${r.ownTid}`,
  unitCheck: (r: Ref) => `${P}u-${h10(`${r.subjectTitle}|${r.ks}|${r.unitSlug}`)}`,
};

// ── conversion ───────────────────────────────────────────────────────────────
type Write = { col: string; id: string; data: Record<string, unknown> };
interface QOut { doc: Record<string, unknown>; id: string; kind: OakKind; hasImage: boolean; resid: boolean }
/** One Oak question → hub question doc (or a reason it can't be imported). The conversion itself is factory/quality.ts `convertOakQuestion`. */
function convertQuestion(r: Ref, q: RawQ, slot: "starter" | "exit", topicId: string, kinds: Record<OakKind, string>, meta: { url: string; stamp: string }): QOut | string {
  const before = mathState.res;
  const res = convertOakQuestion(q, cm);
  if (typeof res === "string") return res;
  const resid = mathState.res > before;
  const doc = {
    topicId, ...res.doc, kind: kinds[res.kind], ...(resid ? { hasMath: true } : {}),
    imported: true, source: { provider: "oak", url: meta.url, licence: "OGL-3.0" },
    oak: { questionId: q.questionId, questionUid: q.questionUid ?? null, type: q.questionType ?? "", slot, lessonSlug: r.lessonSlug },
    createdAt: meta.stamp, updatedAt: meta.stamp,
  };
  if (res.optImgs) stats.optionImages += res.optImgs;
  return { doc, id: ID.q(r, q.questionId), kind: res.kind, hasImage: res.hasImage, resid };
}

type ExtrasIn = { flashcards: { front: string; back: string }[]; worksheet?: { title: string; instructions: string; pdfFile?: string; questions: { prompt: string; answer: string; accepted?: string[]; explanation: string }[] } };
interface LessonOut { writes: Write[]; ref: Ref; exitIds: string[]; audience: string; topicId: string; url: string; stamp: string }
function attributionLine(subjectTitle: string, url: string) {
  return `A ${subjectTitle} lesson by Oak National Academy licensed under [Open Government Licence (OGL)](${ATTR_URL}). Source: ${url}`;
}

/** Everything one raw lesson becomes. Returns a skip reason instead when nothing useful can be built. */
function buildLesson(r: Ref, o: Record<string, unknown>, ctx: Ctx, subId: (r: Ref) => string): LessonOut | string {
  const url = String(o._sourceUrl ?? `https://www.thenational.academy/teachers/programmes/${r.programmes[0]}/units/${r.unitSlug}/lessons/${r.lessonSlug}`);
  const stamp = String(o._fetchedAt ?? new Date().toISOString());
  const topicId = subId(r);
  const yearLabel = ctx.yearLabel(r.year);
  const meta = { url, stamp };
  const b = { tenantId: TID, franchiseId: null as string | null, createdBy: ctx.ownerUid || "oak-import", createdByName: ctx.ownerName };
  const prov = { imported: true, source: { provider: "oak", url, licence: "OGL-3.0" } };
  const writes: Write[] = [];
  const put = (col: string, id: string, data: Record<string, unknown>) => writes.push({ col, id, data: { ...b, ...data } });

  // questions: exit → quiz; starter → warm-up (never the same Oak question twice)
  const seenQ = new Set<string>();
  const conv = (arr: unknown, slot: "starter" | "exit") => {
    const outs: QOut[] = [];
    for (const rq of (Array.isArray(arr) ? arr : []) as RawQ[]) {
      const res = convertQuestion(r, rq, slot, topicId, ctx.kinds, meta);
      if (typeof res === "string") { bump(stats.dropped, res); continue; }
      if (seenQ.has(res.id)) { bump(stats.dropped, "duplicate question in lesson"); continue; }
      seenQ.add(res.id); outs.push(res);
    }
    return outs;
  };
  const exit = conv(o.exitQuiz, "exit");
  const starter = conv(o.starterQuiz, "starter");
  const fromStarter = exit.length === 0 && starter.length > 0;
  const quizQs = fromStarter ? starter : exit;
  if (!quizQs.length) return "no usable quiz question (exit or starter)";
  const warm = fromStarter ? [] : starter;
  for (const qo of [...quizQs, ...warm]) {
    put("hubQuestions", qo.id, { ...qo.doc, ...prov });
    bump(stats.qKind, qo.kind); bump(stats.qOakType, String((qo.doc.oak as { type: string }).type)); bump(stats.qSlot, String((qo.doc.oak as { slot: string }).slot));
    bump(stats.questionsBySubject, r.subject);
    if (qo.hasImage) stats.images++;
    if (qo.resid) stats.questionsWithResidualMath++;
    const im = qo.doc.image as { url: string } | null; if (im) stats.uniqueImages.add(im.url);
  }
  if (fromStarter) stats.lessonsQuizFromStarter++;

  const noteId = ID.note(r);
  const quizId = ID.lessonQuiz(r);
  put("hubAssessments", quizId, {
    type: "quiz", title: `Lesson quiz — ${cm(r.lessonTitle)}`, subject: ctx.spell(r.subject), topicIds: [topicId], questionIds: quizQs.map((x) => x.id),
    timeLimitMins: null, passMarkPct: ctx.cfg.passMarkPct, published: true, audience: { yearGroups: [yearLabel], ageMin: null, ageMax: null },
    retakePolicy: "inherit", retakeCooldownHours: null, ...prov, lessonId: noteId, createdAt: stamp, updatedAt: stamp,
  });

  // the Lesson (hubNotes)
  // the same cleaned facts the deck + plan use (factory/quality.ts: typo / error corrections, wrong-keyword filters): the Lesson viewer and the note body must not show what the deck corrected
  const facts = factsFromRaw(o, cm);
  const points = facts.points;
  const keywords = facts.keywords;
  const outline = facts.outline;
  const mis = ((o.misconceptionsAndCommonMistakes ?? []) as { misconception?: string; response?: string }[]).map((x) => ({ misconception: tidy(cm(String(x.misconception ?? ""))).replace(/\*\*/g, "").trim(), response: tidy(cm(String(x.response ?? ""))).replace(/\*\*/g, "").trim() })).filter((x) => x.misconception);
  const tips = ((o.teacherTips ?? []) as { teacherTip?: string }[]).map((x) => tidy(cm(String(x.teacherTip ?? ""))).replace(/\*\*/g, "").trim()).filter(Boolean);
  const outcome = facts.outcome;
  const attribution = `A ${r.subjectTitle} lesson by Oak National Academy licensed under Open Government Licence (OGL)`;
  const widget = widgetFor(r.subjectTitle, r.unitTitle, r.lessonTitle);
  if (widget) bump(stats.widgets, widget);
  // a hand-built slide deck; its art is never trusted: only verified pictures / literal emoji survive (factory/art/select.ts, F1 policy)
  const hand = SLIDES_BY_LESSON[r.lessonSlug];
  let slides: unknown[] | undefined = hand ? applyArtPolicy(hand as unknown as Slide[], { subject: r.subject, discipline: String(r.subjectTitle), keyStage: r.ks, lessonTitle: cm(r.lessonTitle), unitTitle: cm(r.unitTitle) }) : undefined;
  let slidesFrom: "hand" | "curated" | "generated" | "" = slides ? "hand" : "";
  if (!slides && GEN_SLIDES) {
    const d = deckFor(o, { cm, subject: r.subject, unitTitle: cm(r.unitTitle), lessonTitle: cm(r.lessonTitle), pool: unitPool(r), seed: `${r.unitSlug}|${r.lessonSlug}`, unitSlug: r.unitSlug, lessonSlug: r.lessonSlug });
    if (d.slides.length) { slides = d.slides; slidesFrom = d.source; } else bump(stats.deckSkipped, d.problems[0] ?? "no deck");
  }
  if (slidesFrom) bump(stats.decks, slidesFrom);
  // The lesson PLAN (hand-written > curated JSON > derived from Oak's structured facts) replaces the raw video script: the transcript is never stored.
  const pr = planFor(o, { cm, unitSlug: r.unitSlug, lessonSlug: r.lessonSlug, hasWarmup: warm.length > 0, slideText: () => slideTextFor(o) });
  const plan = pr.plan;
  if (plan) bump(stats.plans, pr.source); else bump(stats.planSkipped, pr.problems[0] ?? "no plan");
  const md: string[] = [];
  if (outcome) md.push(`**${outcome}**`);
  if (points.length) md.push("## Key learning points", points.map((p) => `- ${p}`).join("\n"));
  if (keywords.length) md.push("## Key words", keywords.map((k) => `- **${k.k}**${k.d ? ` — ${k.d}` : ""}`).join("\n"));
  // (a short plain-text version of the plan; the common mistakes stay OUT of the body: they are statements pupils get wrong, and the body is family-visible)
  if (plan) md.push(`## ${PLAN_HEADING}`, planToMarkdown(plan));
  else if (outline.length) md.push("## Lesson outline", outline.map((s, i) => `${i + 1}. ${s}`).join("\n"));
  // (Owner decision 2026-09-20: no credit line inside the lesson text; the licence details stay in `lesson.source`.)
  const body = md.join("\n\n");
  // Hand-built extras for this lesson: curated flashcards, and the worksheet as an interactive short-answer quiz. All linked to the lesson; the tutor sets them as optional homework from the lesson page.
  const curated = GEN_SLIDES ? curatedFor(r.unitSlug, r.lessonSlug) : null;
  const extras: ExtrasIn | undefined = EXTRAS_BY_LESSON[r.lessonSlug] ?? (curated?.flashcards?.length || curated?.worksheet ? { flashcards: curated.flashcards ?? [], worksheet: curated.worksheet } : undefined);
  let worksheet: { assessmentId: string; title: string } | undefined;
  if (extras) {
    extras.flashcards.forEach((c, i) => put("hubFlashcards", `${P}c-${r.ownTid}-x${i + 1}`, {
      topicId, front: clip(c.front, 1000), back: clip(c.back, 2000), published: true, ...prov, lessonId: noteId, createdAt: stamp, updatedAt: stamp,
    }));
    if (extras.worksheet) {
    const wsQ = extras.worksheet.questions.map((q, i) => {
      const id = `${P}q-${r.ownTid}-ws${i + 1}`;
      put("hubQuestions", id, {
        topicId, prompt: q.prompt, image: null, marks: 1, published: true, explanation: q.explanation, tolerance: 0, acceptedAnswers: q.accepted ?? [], options: [] as unknown[],
        answer: q.answer, kind: ctx.kinds.short, ...prov, createdAt: stamp, updatedAt: stamp,
      });
      return id;
    });
    const wsAid = `${P}a-${r.ownTid}-ws`;
    put("hubAssessments", wsAid, {
      type: "quiz", title: extras.worksheet.title, subject: ctx.spell(r.subject), topicIds: [topicId], questionIds: wsQ,
      timeLimitMins: null, passMarkPct: ctx.cfg.passMarkPct, published: true, audience: { yearGroups: [yearLabel], ageMin: null, ageMax: null },
      retakePolicy: "inherit", retakeCooldownHours: null, ...prov, lessonId: noteId, createdAt: stamp, updatedAt: stamp,
    });
    // (Owner decision 2026-09-20: no worksheet PDF and no worksheet note — a worksheet is just its interactive quiz, set as homework.)
    worksheet = { assessmentId: wsAid, title: extras.worksheet.title };
    }
  }
  const lesson = {
    outcome, outline, points, keywords, misconceptions: mis, teacherTips: tips, ...(plan ? { plan } : {}), ...(slides ? { slides } : {}), ...(worksheet ? { worksheet } : {}), warmupQuestionIds: warm.map((x) => x.id), quizId,
    orderInUnit: r.order, unitTitle: cm(r.unitTitle), unitSlug: r.unitSlug, lessonSlug: r.lessonSlug, year: r.year, keyStage: r.ks, ...(fromStarter ? { quizFrom: "starter" } : {}),
    source: { provider: "oak", url, licence: "OGL-3.0", attribution, programmes: r.programmes, fetchedAt: stamp },
    ...(widget ? { widget } : {}),
    ...(oakDeckId(o) ? { oakDeck: oakDeckId(o) } : {}),
  };
  put("hubNotes", noteId, {
    topicId, title: cm(r.lessonTitle), body, published: true, attachments: [], videos: [], lesson, excerpt: mdExcerpt(body), readMinutes: readMinutes(body), hasBody: true,
    ...prov, createdAt: stamp, updatedAt: stamp,
  });

  // flashcards: one per keyword + cloze cards from the key learning points (factory/generate.ts flashcardsFor: only this lesson's own words)
  for (const c of flashcardsFor(points, keywords, LANGUAGES.has(r.subject))) put("hubFlashcards", `${P}c-${r.ownTid}-${c.key}`, {
    topicId, front: clip(c.front, 1000), back: clip(c.back, 2000), published: true, ...prov, lessonId: noteId, createdAt: stamp, updatedAt: stamp,
  });
  return { writes, ref: r, exitIds: quizQs.map((x) => x.id), audience: yearLabel, topicId, url, stamp };
}

// ── driver: topics, then unit by unit ────────────────────────────────────────
const jsonBytes = (d: unknown) => Buffer.byteLength(JSON.stringify(d), "utf8");
function account(w: Write) {
  const n = jsonBytes(w.data);
  bump(stats.docs, w.col); bump(stats.bytes, w.col, n);
  if (n > (stats.maxBytes[w.col] ?? 0)) stats.maxBytes[w.col] = n;
  if (n > MAX_DOC_BYTES) stats.oversize.push({ id: w.id, col: w.col, bytes: n });
  if (w.col === "hubNotes") { noteSizes.push(n); stats.maxNoteBytes = Math.max(stats.maxNoteBytes, n); }
  return n;
}
async function withRetry<T>(what: string, fn: () => Promise<T>): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await fn(); }
    catch (e) { if (i >= 5) throw e; const ms = 1500 * i; console.warn(`  ${what} failed (${(e as Error).message.slice(0, 90)}) — retry ${i}/4 in ${ms}ms`); await new Promise((r) => setTimeout(r, ms)); }
  }
}
/** Collects writes; `drain()` commits them collection by collection (a barrier between collections, so a quiz is never
 *  visible before its questions), with up to CONCURRENCY batches (≤400 ops, ≤~6MB each) in flight within a collection. */
const CONCURRENCY = 8;
class Writer {
  private pending: { w: Write; size: number }[] = []; private pendingBytes = 0; written: Bag = {};
  constructor(private live: boolean) {}
  get full() { return this.pending.length >= 3000 || this.pendingBytes > 25_000_000; }
  add(w: Write, size: number) { this.pending.push({ w, size }); this.pendingBytes += size; }
  async drain() {
    const items = this.pending; this.pending = []; this.pendingBytes = 0;
    for (const col of COL_ORDER) {
      const mine = items.filter((x) => x.w.col === col);
      const batches: Write[][] = []; let cur: Write[] = [], bytes = 0;
      for (const { w, size } of mine) {
        if (cur.length >= 400 || bytes + size > 6_000_000) { batches.push(cur); cur = []; bytes = 0; }
        cur.push(w); bytes += size;
      }
      if (cur.length) batches.push(cur);
      let next = 0;
      const worker = async () => {
        for (;;) {
          const i = next++; if (i >= batches.length) return;
          const chunk = batches[i];
          if (this.live) await withRetry("write batch", async () => { const b = db.batch(); for (const w of chunk) b.set(db.collection(w.col).doc(w.id), w.data); await b.commit(); });
          bump(this.written, col, chunk.length);
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));
    }
  }
}
const COL_ORDER = ["images", "hubTopics", "hubQuestions", "hubAssessments", "hubNotes", "hubFlashcards"];

async function run() {
  const t0 = Date.now();
  const ctx = await tenantCtx();
  console.log(`${DRY ? "DRY RUN — nothing written. " : ""}Tenant "${ctx.name}" (${TID}). Scanning ${RAW} …`);
  if (ctx.missingKinds.length) {
    const msg = `tenant question kinds lack ${ctx.missingKinds.map((k) => `${k} (${KIND_WANT[k].mark})`).join(", ")}`;
    if (DRY) console.warn(`  warn: ${msg} — a real run needs --add-kinds`);
    else if (!ADD_KINDS) { console.error(`Refusing: ${msg}. Re-run with --add-kinds to add them to this tenant's Learning Hub settings (libraries/${TID}.settings.hub.questionKinds).`); process.exit(1); }
    else {
      const ref = db.collection("libraries").doc(TID);
      const cur = ((await ref.get()).get("settings.hub") ?? {}) as Partial<HubSettings>;
      const kinds = [...(cur.questionKinds?.length ? cur.questionKinds : ctx.cfg.questionKinds), ...ctx.missingKinds.map((k) => ({ id: KIND_WANT[k].id, label: KIND_WANT[k].label, mark: KIND_WANT[k].mark }))];
      await ref.set({ settings: { hub: { ...cur, questionKinds: kinds } } }, { merge: true });
      console.log(`  added question kinds ${ctx.missingKinds.join(", ")} to the tenant's hub settings`);
    }
  }
  const all = scanRaw(); ALL_REFS = all;
  const sel = all.filter(inScope).sort((a, b) => sOrder(a.subject) - sOrder(b.subject) || a.ks.localeCompare(b.ks) || a.year - b.year || a.unitTitle.localeCompare(b.unitTitle) || a.unitSlug.localeCompare(b.unitSlug) || a.order - b.order || a.lessonSlug.localeCompare(b.lessonSlug)).slice(0, LIMIT_N);
  stats.lessonsInScope = sel.length;
  console.log(`  ${stats.lessonsScanned} lesson files scanned → ${all.length} unique lessons (${stats.lessonsDuplicate} Foundation/Higher/overlap duplicates merged) → ${sel.length} in scope (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  if (!sel.length) { console.error("Nothing in scope."); process.exit(1); }

  // taxonomy (reuse the tenant's rows case-insensitively)
  const now = new Date().toISOString();
  const topicWrites: Write[] = [];
  const subIds = new Map<string, string>(); // `${subject}|${topic}|${year}` → subtopic doc id
  let reusedParents = 0, reusedSubs = 0, newParents = 0, newSubs = 0;
  const b0 = { tenantId: TID, franchiseId: null, createdBy: ctx.ownerUid || "oak-import" };
  const prov0 = { imported: true, source: { provider: "oak", url: "https://www.thenational.academy/", licence: "OGL-3.0" } };
  const topicName = (r: Ref) => `${TOPIC_PREFIX[lc(r.subjectTitle)] && r.ks === "ks4" ? TOPIC_PREFIX[lc(r.subjectTitle)] : ""}${cm(r.unitTitle)}`;
  const parentDone = new Map<string, string>();
  const subFor = (r: Ref): string => {
    const subject = ctx.spell(r.subject), topic = topicName(r), key = `${subject}|${lc(topic)}|${r.year}`;
    const hit = subIds.get(key);
    if (hit) return hit;
    const pkey = `${subject}|${lc(topic)}`;
    let pid = parentDone.get(pkey);
    if (!pid) {
      const ex = ctx.topics.find((t) => lc(t.subject) === lc(subject) && lc(t.topic) === lc(topic) && t.subtopic === null && t.parent === null);
      if (ex) { pid = ex.id; reusedParents++; }
      else { pid = ID.topic(subject, topic); topicWrites.push({ col: "hubTopics", id: pid, data: { ...b0, subject, topic, subtopic: null, parentTopicId: null, ...prov0, createdAt: now } }); newParents++; }
      parentDone.set(pkey, pid);
    }
    const label = ctx.yearLabel(r.year);
    const exs = ctx.topics.find((t) => t.parent === pid && lc(t.subtopic) === lc(label));
    let sid: string;
    if (exs) { sid = exs.id; reusedSubs++; }
    else { sid = ID.sub(subject, topic, r.year); topicWrites.push({ col: "hubTopics", id: sid, data: { ...b0, subject, topic, subtopic: label, parentTopicId: pid, ...prov0, createdAt: now } }); newSubs++; }
    subIds.set(key, sid);
    return sid;
  };
  for (const r of sel) subFor(r);
  const writer = new Writer(!DRY);
  for (const w of topicWrites) { const n = account(w); writer.add(w, n); }
  await writer.drain();
  console.log(`  topics: ${newParents} new parents + ${newSubs} new "Year N" subtopics written; ${reusedParents} parents + ${reusedSubs} subtopics reused from the tenant's existing rows`);

  // units, in order; each unit's docs are written questions → assessments → notes → flashcards
  const byUnit = new Map<string, Ref[]>();
  for (const r of sel) { const k = `${r.subjectTitle}|${r.ks}|${r.unitSlug}`; (byUnit.get(k) ?? byUnit.set(k, []).get(k)!).push(r); }
  let unitN = 0;
  for (const [, lessons] of byUnit) {
    unitN++;
    const outs: LessonOut[] = [];
    const unitWrites: Write[] = [];
    for (const r of lessons) {
      let o: Record<string, unknown>;
      try { o = JSON.parse(fs.readFileSync(r.file, "utf8")); } catch { bump(stats.skipped, "unreadable JSON on second read"); continue; }
      const res = buildLesson(r, o, ctx, subFor);
      if (typeof res === "string") { bump(stats.skipped, res); continue; }
      outs.push(res); unitWrites.push(...res.writes); stats.lessonsImported++;
      bump(stats.notesBySubject, r.subject); bump(stats.notesByKS, `${r.subject} ${r.ks}`);
    }
    // per-unit "Unit check": up to 12 exit questions sampled round-robin across the unit's lessons
    if (outs.length >= 2) {
      const pools = outs.map((l) => shuffled(l.exitIds, `${l.ref.unitSlug}|${l.ref.lessonSlug}`));
      const picked: string[] = [];
      for (let round = 0; picked.length < 12; round++) {
        let any = false;
        for (const p of pools) { if (picked.length >= 12) break; if (round < p.length) { picked.push(p[round]); any = true; } }
        if (!any) break;
      }
      if (picked.length >= 4) {
        const r = outs[0].ref;
        const stamp = outs[0].stamp;
        unitWrites.push({ col: "hubAssessments", id: ID.unitCheck(r), data: {
          tenantId: TID, franchiseId: null, createdBy: ctx.ownerUid || "oak-import", type: "quiz", title: `Unit check — ${cm(r.unitTitle)}`, subject: ctx.spell(r.subject),
          topicIds: [outs[0].topicId], questionIds: picked, timeLimitMins: null, passMarkPct: ctx.cfg.passMarkPct, published: true,
          audience: { yearGroups: [outs[0].audience], ageMin: null, ageMax: null }, retakePolicy: "inherit", retakeCooldownHours: null,
          imported: true, source: { provider: "oak", url: outs[0].url, licence: "OGL-3.0" },
          createdAt: stamp, updatedAt: stamp,
        } });
        stats.unitChecks++;
      }
    }
    // dedupe identical flashcard fronts within the unit (same topic), keep the first
    const seenFront = new Set<string>();
    const finalWrites = unitWrites.filter((w) => {
      if (w.col !== "hubFlashcards") return true;
      const k = `${w.data.topicId}|${lc(w.data.front)}`;
      if (seenFront.has(k)) { stats.dupFlashFronts++; return false; }
      seenFront.add(k); return true;
    });
    for (const w of finalWrites) if (w.col === "hubFlashcards") bump(stats.cardsBySubject, lessons[0].subject);
    for (const w of finalWrites) { const n = account(w); writer.add(w, n); }
    if (writer.full) { const t1 = Date.now(); await writer.drain(); if (!DRY) console.log(`  committed a chunk in ${((Date.now() - t1) / 1000).toFixed(1)}s (${unitN}/${byUnit.size} units)`); }
    if (unitN % 25 === 0) console.log(`  … ${unitN}/${byUnit.size} units, ${stats.lessonsImported} lessons (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  await writer.drain();
  stats.mathConverted = mathState.conv; stats.mathResidual = mathState.res;
  report(t0, byUnit.size);
}

function pct(xs: number[], p: number) { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0; }
const kb = (n: number) => `${(n / 1024).toFixed(1)}KB`;
function report(t0: number, units: number) {
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const d = stats.docs;
  const total = Object.values(d).reduce((a, b) => a + b, 0);
  console.log(`\n${DRY ? "DRY RUN — would write" : "Wrote"} ${total} docs across ${units} units in ${secs}s:`);
  for (const c of COL_ORDER) console.log(`  ${c.padEnd(16)} ${String(d[c] ?? 0).padStart(7)} docs · ${kb(stats.bytes[c] ?? 0).padStart(10)} total · largest ${kb(stats.maxBytes[c] ?? 0)}`);
  console.log(`  notes: median ${kb(pct(noteSizes, 0.5))}, p99 ${kb(pct(noteSizes, 0.99))}, max ${kb(stats.maxNoteBytes)}`);
  console.log(`  lesson plans: ${Object.entries(stats.plans).map(([k, v]) => `${k} ${v}`).join(", ") || "none"} · no plan: ${Object.entries(stats.planSkipped).map(([k, v]) => `${k.slice(0, 80)} ×${v}`).join("; ") || "none"}`);
  console.log(`  oversize docs (>${MAX_DOC_BYTES / 1000}KB): ${stats.oversize.length}${stats.oversize.length ? " — " + stats.oversize.slice(0, 10).map((o) => `${o.col}/${o.id} ${kb(o.bytes)}`).join("; ") : ""}`);
  console.log(`  lessons: ${stats.lessonsImported} imported of ${stats.lessonsInScope} in scope (${stats.lessonsQuizFromStarter} have no exit quiz → quiz built from their starter questions); unit checks ${stats.unitChecks}; duplicate flashcard fronts dropped ${stats.dupFlashFronts}`);
  console.log(`  by subject/key stage (lessons): ${Object.entries(stats.notesByKS).sort().map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log(`  questions by subject: ${Object.entries(stats.questionsBySubject).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log(`  flashcards by subject: ${Object.entries(stats.cardsBySubject).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log(`  question kinds: ${Object.entries(stats.qKind).map(([k, v]) => `${k} ${v}`).join(", ")} · slots: ${Object.entries(stats.qSlot).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log(`  pictures: ${stats.images} questions with pictures (${stats.uniqueImages.size} distinct stem images, ${stats.optionImages} picture options; external Oak URLs)`);
  console.log(`  LaTeX: ${stats.mathConverted} spans converted to text, ${stats.mathResidual} left raw (in ${stats.questionsWithResidualMath} questions, flagged hasMath) `);
  if (GEN_SLIDES) console.log(`  slide decks: ${Object.entries(stats.decks).map(([k, v]) => `${k} ${v}`).join(", ") || "none"} · no deck: ${Object.entries(stats.deckSkipped).map(([k, v]) => `${k.slice(0, 80)} ×${v}`).join("; ") || "none"}`);
  console.log(`  widgets matched: ${Object.entries(stats.widgets).map(([k, v]) => `${k} ${v}`).join(", ") || "none"} (${WIDGET_RULES.length} rules)`);
  console.log(`  skipped lessons/files: ${Object.entries(stats.skipped).map(([k, v]) => `${k} ×${v}`).join("; ") || "none"}`);
  console.log(`  dropped questions: ${Object.entries(stats.dropped).map(([k, v]) => `${k} ×${v}`).join("; ") || "none"}`);
  if (STATS_OUT) fs.writeFileSync(STATS_OUT, JSON.stringify({ ...stats, uniqueImages: stats.uniqueImages.size, noteP50: pct(noteSizes, 0.5), noteP99: pct(noteSizes, 0.99), seconds: Number(secs) }, null, 1));
  if (!DRY) console.log(`  Verify: npx tsx src/oak/import.ts check ${TID}${[SUBJECT && ` --subject ${SUBJECT}`, KEYSTAGE && ` --keystage ${KEYSTAGE}`, YEAR && ` --year ${YEAR}`, UNIT && ` --unit ${UNIT}`, PROGRAMME && ` --programme ${PROGRAMME}`].filter(Boolean).join("")}`);
}

// ── check ────────────────────────────────────────────────────────────────────
/** Doc ids in `col` for this tenant that start with our prefix (full docs, or only `fields`). */
async function readOurs(col: string, fields?: string[]) {
  let q: FirebaseFirestore.Query = db.collection(col).where("tenantId", "==", TID);
  if (fields) q = q.select(...fields);
  const snap = await q.get();
  return snap.docs.filter((d) => d.id.startsWith(P));
}
const stable = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) : x));

async function check() {
  const t0 = Date.now();
  const ctx = await tenantCtx();
  let bad = 0;
  const ok = (c: unknown, m: string) => { if (!c) { bad++; if (bad <= 80) console.error(`  FAIL: ${m}`); } };
  const warn = (m: string) => console.warn(`  warn: ${m}`);
  const all = scanRaw(); ALL_REFS = all;
  const sel = all.filter(inScope).sort((a, b) => sOrder(a.subject) - sOrder(b.subject) || a.ks.localeCompare(b.ks) || a.year - b.year || a.unitTitle.localeCompare(b.unitTitle) || a.order - b.order).slice(0, LIMIT_N);
  console.log(`Checking tenant "${ctx.name}" (${TID}) against ${sel.length} in-scope Oak lessons …`);

  // expected docs = re-run the conversion in memory (no writes)
  const expected = new Map<string, Write>(); const lessonRefs = new Map<string, Ref>();
  const subIdFor = (r: Ref) => `sub:${ctx.spell(r.subject)}|${lc(`${TOPIC_PREFIX[lc(r.subjectTitle)] && r.ks === "ks4" ? TOPIC_PREFIX[lc(r.subjectTitle)] : ""}${cm(r.unitTitle)}`)}|${r.year}`;
  let skipped = 0;
  for (const r of sel) {
    const o = JSON.parse(fs.readFileSync(r.file, "utf8"));
    const res = buildLesson(r, o, ctx, subIdFor);
    if (typeof res === "string") { skipped++; continue; }
    lessonRefs.set(ID.note(r), r);
    for (const w of res.writes) expected.set(`${w.col}/${w.id}`, w);
  }
  const expCount = (c: string) => [...expected.values()].filter((w) => w.col === c).length;

  // Read only the in-scope docs, by id (a tenant-wide `where(tenantId==)` query times out once a tenant holds ~90k Oak questions).
  const readIds = async (col: string) => {
    const ids = [...expected.values()].filter((w) => w.col === col).map((w) => w.id);
    const out: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    for (let i = 0; i < ids.length; i += 300) {
      const snaps = await withRetry("read by id", () => db.getAll(...ids.slice(i, i + 300).map((id) => db.collection(col).doc(id))));
      for (const sn of snaps) if (sn.exists) out.push(sn as FirebaseFirestore.QueryDocumentSnapshot);
    }
    return out;
  };
  const [notes, questions, asms, cards, topicDocs] = await Promise.all([
    readIds("hubNotes"), readIds("hubQuestions"), readIds("hubAssessments"), readIds("hubFlashcards"),
    db.collection("hubTopics").where("tenantId", "==", TID).get().then((s) => s.docs),
  ]);
  const topicById = new Map(topicDocs.map((d) => [d.id, d]));
  const qById = new Map(questions.map((d) => [d.id, d.data()]));
  const asmById = new Map(asms.map((d) => [d.id, d.data()]));
  const noteById = new Map(notes.map((d) => [d.id, d.data()]));
  const scoped = (col: string, docs: FirebaseFirestore.QueryDocumentSnapshot[]) => docs.filter((d) => expected.has(`${col}/${d.id}`));

  // counts (in-scope): every expected doc exists (cards/assessments may be fewer only through unit-level dedupe, which is not applied to `expected`)
  ok(scoped("hubNotes", notes).length === expCount("hubNotes"), `notes: expected ${expCount("hubNotes")}, found ${scoped("hubNotes", notes).length}`);
  ok(scoped("hubQuestions", questions).length === expCount("hubQuestions"), `questions: expected ${expCount("hubQuestions")}, found ${scoped("hubQuestions", questions).length}`);
  const lessonQuizExpected = [...expected.values()].filter((w) => w.col === "hubAssessments").length;
  ok(scoped("hubAssessments", asms).length === lessonQuizExpected, `lesson quizzes: expected ${lessonQuizExpected}, found ${scoped("hubAssessments", asms).length}`);
  const cardsFound = scoped("hubFlashcards", cards).length;
  ok(cardsFound <= expCount("hubFlashcards") && cardsFound >= expCount("hubFlashcards") * 0.5, `flashcards: expected ≤${expCount("hubFlashcards")} (after per-unit front dedupe), found ${cardsFound}`);
  if (skipped) warn(`${skipped} in-scope lesson(s) are skipped by the importer (no usable quiz question)`);

  const stubKind = (kindId: string) => ctx.cfg.questionKinds.find((k) => k.id === kindId)?.mark ?? "manual";
  let markChecks = 0;
  const bySubject: Bag = {};
  // notes
  for (const d of scoped("hubNotes", notes)) {
    const x = d.data();
    if (x.worksheetFor) { // a lesson's worksheet note: a plain note carrying the PDF
      ok(x.published === true && x.imported === true && Array.isArray(x.attachments) && x.attachments.length <= 1 && x.attachments.every((a: { contentType: string }) => a.contentType === "application/pdf"), `${d.id}: worksheet note shape`);
      continue;
    }
    const r = lessonRefs.get(d.id)!;
    bump(bySubject, r.subject);
    ok(x.tenantId === TID && x.published === true && x.imported === true && x.source?.provider === "oak" && x.source?.licence === "OGL-3.0" && !!x.source?.url, `${d.id}: provenance/publish flags`);
    ok(topicById.has(x.topicId), `${d.id}: topic ${x.topicId} missing`);
    const l = x.lesson;
    ok(l && l.transcript === undefined && l.tips === undefined && (l.plan === undefined || (l.plan.v === 1 && Array.isArray(l.plan.steps) && l.plan.steps.length >= 3)) && Array.isArray(l.points) && Array.isArray(l.keywords) && Array.isArray(l.outline) && Array.isArray(l.warmupQuestionIds) && l.source?.provider === "oak" && l.source?.licence === "OGL-3.0" && Array.isArray(l.source?.programmes) && l.source.programmes.length >= 1 && !!l.source?.attribution, `${d.id}: structured lesson shape`);
    ok(l && asmById.has(l.quizId) && (asmById.get(l.quizId)?.questionIds?.length ?? 0) >= 1, `${d.id}: lesson quiz ${l?.quizId} missing or has no questions (every lesson needs ≥1 exit question)`);
    for (const q of l?.warmupQuestionIds ?? []) ok(qById.has(q), `${d.id}: warm-up question ${q} missing`);
    const bytes = jsonBytes(x); ok(bytes < MAX_DOC_BYTES, `${d.id}: ${bytes} bytes ≥ ${MAX_DOC_BYTES}`);
    if (DEEP) { const e = expected.get(`hubNotes/${d.id}`)!; ok(stable({ ...e.data, topicId: x.topicId }) === stable(x), `${d.id}: stored note differs from what the importer would write now`); }
  }
  // questions: references, provenance, decodable answer keys (real marking function)
  for (const d of scoped("hubQuestions", questions)) {
    const x = d.data(); const rule = stubKind(x.kind);
    ok(x.tenantId === TID && x.published === true && x.imported === true && x.source?.provider === "oak", `${d.id}: flags`);
    ok(topicById.has(x.topicId), `${d.id}: topic missing`);
    ok(typeof x.prompt === "string" && x.prompt.trim() !== "" && jsonBytes(x) < MAX_DOC_BYTES, `${d.id}: prompt/size`);
    ok(!x.image || (typeof x.image.url === "string" && /^https:\/\//.test(x.image.url) && !!x.image.alt), `${d.id}: image url/alt`);
    const optIds: string[] = (x.options ?? []).map((o: { id: string }) => o.id);
    ok(new Set(optIds).size === optIds.length, `${d.id}: duplicate option ids`);
    const mr = (r: unknown) => markResponse({ mark: rule as MarkRule, answer: x.answer, acceptedAnswers: x.acceptedAnswers, tolerance: x.tolerance, marks: x.marks }, r);
    if (rule === "choice") { markChecks++; ok(typeof x.answer === "string" && optIds.includes(x.answer) && mr(x.answer).correct === true && optIds.filter((o) => o !== x.answer).every((o) => mr(o).correct === false), `${d.id}: single answer key not decodable`); }
    else if (rule === "multi") { markChecks++; const a = x.answer as string[]; ok(Array.isArray(a) && a.length >= 2 && a.every((v) => optIds.includes(v)) && mr(a).correct === true && mr([a[0]]).correct === false, `${d.id}: multi answer key not decodable`); }
    else if (rule === "exact") { markChecks++; ok(typeof x.answer === "string" && x.answer.trim() !== "" && mr(x.answer).correct === true && (/ß/.test(String(x.answer)) || mr(` ${String(x.answer).toUpperCase()} `).correct === true) && (x.acceptedAnswers as string[]).every((s) => mr(s).correct === true), `${d.id}: short answer key not decodable`); }
    else if (rule === "match") {
      markChecks++; const pairs = x.pairs as { term: string; definition: string }[];
      const mm = (r: unknown) => markResponse({ mark: "match", answer: pairs, marks: x.marks }, r).correct;
      ok(Array.isArray(pairs) && pairs.length >= 3 && pairs.length <= 8 && x.answer === null && mm({ kind: "match", pairs: [...pairs].reverse() }) === true && mm({ kind: "match", pairs: pairs.map((p, i) => ({ term: p.term, definition: pairs[(i + 1) % pairs.length].definition })) }) === false, `${d.id}: match key not decodable`);
    } else if (rule === "order") {
      markChecks++; const items = x.items as string[];
      const mo = (r: unknown) => markResponse({ mark: "order", answer: items, marks: x.marks }, r).correct;
      ok(Array.isArray(items) && items.length >= 2 && items.length <= 8 && x.answer === null && mo({ kind: "order", items }) === true, `${d.id}: order key not decodable`);
    }
    else ok(false, `${d.id}: kind "${x.kind}" has marking rule "${rule}" — expected one of the Oak kinds (does the tenant have match/order kinds? run --add-kinds)`);
    if (DEEP) { const e = expected.get(`hubQuestions/${d.id}`)!; ok(stable({ ...e.data, topicId: x.topicId }) === stable(x), `${d.id}: stored question differs from what the importer would write now`); }
  }
  // assessments
  for (const d of scoped("hubAssessments", asms)) {
    const x = d.data();
    ok(x.tenantId === TID && x.published === true && x.imported === true && x.type === "quiz", `${d.id}: flags`);
    const qs = (x.questionIds as string[]).map((q) => qById.get(q));
    ok(qs.length >= 1 && qs.every(Boolean) && new Set(x.questionIds).size === x.questionIds.length, `${d.id}: empty / dangling / repeated question ids`);
    ok((x.topicIds as string[]).every((t) => topicById.has(t)), `${d.id}: topic missing`);
    ok(x.audience && x.audience.yearGroups?.length === 1 && x.audience.ageMin === null && x.audience.ageMax === null && ctx.cfg.yearGroups.some((g) => lc(g) === lc(x.audience.yearGroups[0])), `${d.id}: audience`);
    ok(x.questionIds.length <= 60, `${d.id}: unexpectedly long quiz (${x.questionIds.length})`);
    if (/^Unit check — /.test(x.title)) ok(x.questionIds.length <= 12, `${d.id}: unit check longer than 12`);
  }
  for (const d of scoped("hubFlashcards", cards)) { const x = d.data(); ok(x.tenantId === TID && x.published === true && x.imported === true && topicById.has(x.topicId) && !!x.front && !!x.back && x.front.length <= 1000 && x.back.length <= 2000, `${d.id}: flashcard`); }
  // ownership: nothing of ours without our prefix, and one topic row per (subject, topic, subtopic)
  for (const d of topicDocs.filter((t) => t.id.startsWith(P))) ok(d.get("tenantId") === TID && d.get("imported") === true, `${d.id}: topic flags`);
  const seen = new Map<string, string[]>();
  for (const d of topicDocs) { const k = [lc(d.get("subject")), lc(d.get("topic")), lc(d.get("subtopic")), d.get("franchiseId") ?? ""].join("|"); seen.set(k, [...(seen.get(k) ?? []), d.id]); }
  for (const [k, ids] of seen) if (ids.length > 1 && ids.some((i) => i.startsWith(P))) ok(false, `duplicate topic rows ${k}: ${ids.join(", ")}`);
  const kindsOk = (["match", "order"] as OakKind[]).every((k) => ctx.missingKinds.indexOf(k) < 0);
  if (!kindsOk) warn(`tenant question kinds lack ${ctx.missingKinds.join(", ")}: match/order questions can't be edited or marked until they are added`);

  console.log(`Tenant ${TID}: in scope, found in Firestore: ${notes.length} Oak lessons · ${questions.length} questions · ${asms.length} quizzes · ${cards.length} flashcards — expected: ${expCount("hubNotes")} lessons / ${expCount("hubQuestions")} questions / ${lessonQuizExpected} quizzes`);
  console.log(`  lessons by subject: ${Object.entries(bySubject).map(([k, v]) => `${k} ${v}`).join(", ")} · ${markChecks} answer keys decoded with the real marking function (choice / multi / exact / match / order) · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(bad ? `CHECK FAILED (${bad} problem(s))` : "CHECK PASSED");
  if (bad) process.exitCode = 1;
}

// ── clean (Oak docs only) ────────────────────────────────────────────────────
async function clean() {
  await guard();
  const out: Bag = {};
  for (const col of ["hubFlashcards", "hubAssessments", "hubNotes", "hubQuestions", "hubTopics"]) {
    // a topic row is only removed when nothing but Oak docs hang off it (children were removed first, above)
    const refs = (await readOurs(col, [])).map((d) => d.ref);
    for (let i = 0; i < refs.length; i += 400) { const chunk = refs.slice(i, i + 400); await withRetry("delete batch", async () => { const b = db.batch(); for (const r of chunk) b.delete(r); await b.commit(); }); }
    out[col] = refs.length;
  }
  console.log(`Removed Oak-imported docs (id prefix ${P}) from ${TID}:`, out);
}

(async () => {
  if (MODE === "clean") await clean();
  else if (MODE === "check") await check();
  else await run();
  process.exit(process.exitCode ?? 0);
})().catch((e) => { console.error(e); process.exit(1); });
