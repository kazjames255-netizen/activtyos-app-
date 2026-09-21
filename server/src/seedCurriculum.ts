// Curriculum → Learning Hub seeder (pack-agnostic). Turns the typed content in server/src/curriculum/<pack>/<key>.ts
// (original, DfE-programme-of-study-aligned; see curriculum/types.ts + README.md) into REAL hub documents:
//   · TAXONOMY  subject → topic → "Year N" (or CYear.subtopic) SUBTOPIC rows. Files from different packs that share the
//               same subject + topic NAME (case-insensitive) are MERGED under one topic (that is how KS1/KS3 join KS2).
//   · NOTES     one published course note per topic-year, filed under the year subtopic
//   · QUESTIONS every quiz question (single / multi / short / number / written; pictures as private hub `images` docs)
//   · QUIZZES   one published QUIZ per topic-year (audience = its yearsCovered)
//   · PLACEMENT one published DIAGNOSTIC per SUBJECT per year N: "<Subject> placement — Year N", one mixed-topic paper
//               drawing 1–2 questions from EVERY topic that has content in year N AND year N−1, scored per topic
//               (each question's topicId is its year subtopic, so byTopic gives a baseline per topic-year)
//   · FLASHCARDS published cards per topic-year
//
//   npx tsx src/seedCurriculum.ts <tenantId> [--pack <name>] [--subject <Subject>] [--years 3-6] [--dry] [--strict]
//   npx tsx src/seedCurriculum.ts clean <tenantId> [--subject <Subject>] [--force]
//   npx tsx src/seedCurriculum.ts check <tenantId> [--pack …] [--subject …] [--years …] [--sample 300|all]
//   (npx tsx src/seedCurriculumKS2Maths.ts … is a thin wrapper that adds `--pack ks2maths`.)
//
// SAFETY
//  · Tenant id REQUIRED; @activityos-test.com tenants are refused; only ever touches that tenant.
//  · Every doc it CREATES has an id starting `curr-<tenantId>-` (hubTopics / hubNotes / hubQuestions / hubAssessments /
//    hubFlashcards / images), deterministic: `curr-<tid>-<subject>-<type>-<topic>-y<year>[-nn]` (questions:
//    `curr-<tid>-<subject>-q-<questionKey>`). Re-running overwrites in place; an UNFILTERED run also prunes docs it made
//    earlier that the content no longer produces (a filtered run never prunes, except the old pre-pack Maths ids).
//    It never edits or deletes a doc it did not create, never goes through the API, sends no email / notification.
//  · Topics are REUSED, never duplicated: (subject, topic[, subtopic]) matches are case-insensitive and keep the tenant's
//    existing id and spelling (e.g. an earlier demo seed's "Number & place value"); otherwise a `curr-…` row is created.
//  · Invalid content FILES are skipped with a warning (`--strict` aborts instead) so it picks up whatever validates.
//  · Writes are batched (≤400 ops, ≤~6MB), retried on transient errors, ordered topics → images → questions →
//    assessments → notes → flashcards (an interrupted run never leaves an assessment pointing at a missing question),
//    and idempotent, so simply re-running resumes.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { db } from "./firebase";
import { mergeHub, type HubSettings } from "../../lib/hubConfig";
import { markResponse, scoreAttempt, type MarkRule } from "./lib/hubScoring";
import type { CKind, CQuestion, CTopic, CYear } from "./curriculum/types";
import { setImagePack, validateTopic } from "./curriculum/validate";

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
const FORCE = takeBool("--force");
const STRICT = takeBool("--strict");
const PACK = takeFlag("--pack");
const SUBJECT = takeFlag("--subject");
const YEARS_ARG = takeFlag("--years");
const SAMPLE_ARG = takeFlag("--sample") ?? "300";
const yr = YEARS_ARG?.match(/^(\d+)(?:-(\d+))?$/);
const YEAR_MIN = yr ? Number(yr[1]) : 1;
const YEAR_MAX = yr ? Number(yr[2] ?? yr[1]) : 13;
if (YEARS_ARG !== undefined && !yr) { console.error(`--years must look like 3-6 (got "${YEARS_ARG}")`); process.exit(1); }
const FILTERED = PACK !== undefined || SUBJECT !== undefined || YEARS_ARG !== undefined;

const arg1 = process.argv[2];
const MODE: "seed" | "clean" | "check" = arg1 === "clean" ? "clean" : arg1 === "check" ? "check" : "seed";
const TID = MODE === "seed" ? arg1 : process.argv[3];
if (!TID || TID.startsWith("-")) {
  console.error("Usage: npx tsx src/seedCurriculum.ts <tenantId> [--pack p] [--subject S] [--years a-b] [--dry] [--strict]  |  ... clean <tenantId> [--subject S] [--force]  |  ... check <tenantId> [filters] [--sample N|all]");
  process.exit(1);
}
if (MODE === "clean" && (PACK !== undefined || YEARS_ARG !== undefined)) { console.error("clean supports only --subject (and --force)."); process.exit(1); }

const P = `curr-${TID}-`;
const here = path.dirname(fileURLToPath(import.meta.url));
const CUR_DIR = path.join(here, "curriculum");
const COLS = ["hubTopics", "hubNotes", "hubQuestions", "hubAssessments", "hubFlashcards"] as const;
/** Write order: parents before children, questions before the assessments that list them. */
const WRITE_ORDER = ["hubTopics", "images", "hubQuestions", "hubAssessments", "hubNotes", "hubFlashcards"];
const SUBJECT_ORDER = ["Maths", "English", "Science", "French", "Spanish", "German"];
const PLACEMENT_SOFT = 24; // second nominal-year questions are added only while the paper is shorter than this
const PLACEMENT_HARD = 30; // never longer than this (year-below questions are dropped first, deterministically)
const lc = (s: unknown) => String(s ?? "").trim().toLowerCase();
const slug = (s: string) => lc(s).replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
const yl = (y: number) => `Year ${y}`;

// ── ids ──────────────────────────────────────────────────────────────────────
const ID = {
  topic: (subj: string, t: string) => `${P}${slug(subj)}-topic-${slug(t)}`,
  sub: (subj: string, t: string, y: number) => `${P}${slug(subj)}-sub-${slug(t)}-y${y}`,
  note: (subj: string, t: string, y: number) => `${P}${slug(subj)}-note-${slug(t)}-y${y}`,
  quiz: (subj: string, t: string, y: number) => `${P}${slug(subj)}-quiz-${slug(t)}-y${y}`,
  card: (subj: string, t: string, y: number, i: number) => `${P}${slug(subj)}-card-${slug(t)}-y${y}-${String(i).padStart(2, "0")}`,
  q: (subj: string, key: string) => `${P}${slug(subj)}-q-${key}`,
  placement: (subj: string, y: number) => `${P}${slug(subj)}-placement-y${y}`,
  img: (pack: string, file: string) => `${P}media-${slug(pack)}-${slug(file.replace(/\.png$/i, ""))}`,
};
/** Ids written by the first (KS2-Maths-only) version of this seeder: `curr-<tid>-<type>-…` with no subject segment. */
const LEGACY = new RegExp(`^${P.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(q|note|quiz|card|placement|sub|topic|img)-`);

// ── guard ────────────────────────────────────────────────────────────────────
async function guard(): Promise<{ name: string; ownerUid: string; ownerName: string }> {
  const t = await db.collection("tenants").doc(TID).get();
  if (!t.exists) { console.error(`No tenant ${TID}.`); process.exit(1); }
  const ownerUid = (t.get("ownerUid") as string | undefined) ?? "";
  const owner = ownerUid ? await db.collection("users").doc(ownerUid).get() : null;
  const emails = [t.get("email"), t.get("notifyEmail"), owner?.get("email")].filter((e): e is string => typeof e === "string");
  const bad = emails.find((e) => e.toLowerCase().endsWith("@activityos-test.com"));
  if (bad) { console.error(`Refusing: tenant ${TID} is an e2e test account (${bad}). The Playwright suite owns those.`); process.exit(1); }
  return { name: (t.get("name") as string) ?? TID, ownerUid, ownerName: ((owner?.get("name") as string | undefined) ?? "").trim() || "Your tutor" };
}

// ── content loading: every pack folder, merged by subject + topic name ───────
interface TY { pack: string; year: number; label: string; yc: number[]; cy: CYear }
interface LTopic { subject: string; topic: string; ts: string; ys: Map<number, TY>; notIntroduced: Map<number, string> }
const inRange = (y: number) => y >= YEAR_MIN && y <= YEAR_MAX;
const packInScope = (pack: string) => PACK === undefined || PACK === pack;
const subjectInScope = (s: string) => SUBJECT === undefined || lc(SUBJECT) === lc(s);
const tyInScope = (t: LTopic, ty: TY) => subjectInScope(t.subject) && packInScope(ty.pack) && ty.yc.some(inRange) && inRange(ty.year);

async function loadContent(): Promise<{ topics: LTopic[]; packs: string[]; problems: string[]; skipped: string[] }> {
  const packs = fs.readdirSync(CUR_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  const seen = new Set<string>();
  const byName = new Map<string, LTopic>();
  const problems: string[] = [];
  const skipped: string[] = [];
  for (const pack of packs) {
    setImagePack(pack);
    const files = fs.readdirSync(path.join(CUR_DIR, pack)).filter((f) => f.endsWith(".ts") && !f.startsWith("_")).sort();
    for (const f of files) {
      const where = `${pack}/${f}`;
      let t: CTopic | undefined;
      try { const mod = await import(pathToFileURL(path.join(CUR_DIR, pack, f)).href); t = mod.TOPIC ?? mod.default; }
      catch (e) { problems.push(`${where}: failed to load — ${(e as Error).message}`); skipped.push(where); continue; }
      if (!t) { problems.push(`${where}: no TOPIC export`); skipped.push(where); continue; }
      const errs = validateTopic(t, seen);
      if (errs.length) { problems.push(...errs.map((e) => `${pack}/${e}`)); skipped.push(where); continue; }
      const nameKey = `${lc(t.subject)}|${lc(t.topic)}`;
      const lt = byName.get(nameKey) ?? { subject: t.subject, topic: t.topic, ts: slug(t.topic), ys: new Map<number, TY>(), notIntroduced: new Map<number, string>() };
      byName.set(nameKey, lt);
      for (const [ys, cy] of Object.entries(t.years)) {
        if (!cy) continue;
        const year = Number(ys);
        if (lt.ys.has(year)) { problems.push(`${where}: ${t.subject} / ${t.topic} Year ${year} is already provided by ${lt.ys.get(year)!.pack} — skipped`); continue; }
        lt.ys.set(year, { pack, year, label: cy.subtopic?.trim() || yl(year), yc: cy.yearsCovered?.length ? cy.yearsCovered : [year], cy });
      }
      for (const [ys, why] of Object.entries(t.notIntroduced ?? {})) if (why) lt.notIntroduced.set(Number(ys), why);
    }
  }
  const sOrder = (s: string) => { const i = SUBJECT_ORDER.indexOf(s); return i < 0 ? 99 : i; };
  const topics = [...byName.values()].filter((t) => t.ys.size).sort((a, b) => sOrder(a.subject) - sOrder(b.subject));
  return { topics, packs, problems, skipped };
}

/** subject → topic rows × year columns (question counts) for the years that subject has content in. */
function matrix(topics: LTopic[], count: (t: LTopic, ty: TY) => string): string {
  const out: string[] = [];
  for (const subject of [...new Set(topics.map((t) => t.subject))]) {
    const ts = topics.filter((t) => t.subject === subject);
    const years = [...new Set(ts.flatMap((t) => [...t.ys.keys()]))].sort((a, b) => a - b);
    const head = `${subject.padEnd(30)}${years.map((y) => `Y${y}`.padEnd(9)).join("")}`;
    out.push(head, "-".repeat(head.length));
    for (const t of ts) out.push(`${t.topic.slice(0, 28).padEnd(30)}${years.map((y) => (t.ys.get(y) ? count(t, t.ys.get(y)!) : t.notIntroduced.has(y) ? "n/i" : "·").padEnd(9)).join("")}`);
    out.push("");
  }
  return out.join("\n");
}

// ── deterministic helpers ────────────────────────────────────────────────────
function seedRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = (h ^= h >>> 16) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffled<T>(xs: T[], seed: string): T[] {
  const r = seedRng(seed);
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ── placement construction (spec §3 "Diagnostic Assessment — construction rule") ────────────
interface Pick { t: LTopic; ty: TY; q: CQuestion }
/** Representative, auto-markable questions for a topic-year (a tutor-marked "written" one never goes in a placement). */
function diagnosticPool(cy: CYear): CQuestion[] {
  const auto = cy.quiz.questions.filter((q) => q.kind !== "written");
  const flagged = auto.filter((q) => q.diagnostic);
  return flagged.length ? flagged : [...auto].sort((a, b) => Math.abs(a.difficulty - 2) - Math.abs(b.difficulty - 2));
}
/** Every topic-year covering year N ("nominal") and every one covering N−1 but not N ("below"), for one subject. */
function placementSets(subject: string, N: number, topics: LTopic[]) {
  const nominal: { t: LTopic; ty: TY }[] = [], below: { t: LTopic; ty: TY }[] = [];
  for (const t of topics.filter((x) => x.subject === subject)) for (const ty of t.ys.values()) {
    if (ty.yc.includes(N)) nominal.push({ t, ty });
    else if (N > 1 && ty.yc.includes(N - 1)) below.push({ t, ty });
  }
  return { nominal, below };
}
function buildPlacement(subject: string, N: number, topics: LTopic[]): Pick[] {
  const { nominal, below } = placementSets(subject, N, topics);
  const slots = new Map<string, Pick[]>();
  const sk = (t: LTopic, ty: TY) => `${t.ts}-${ty.year}`;
  // year below: ONE question each — the easiest of the representative pair (secure recall of the earlier work)
  let belowPicks = below.filter(({ ty }) => diagnosticPool(ty.cy).length);
  // nominal year: ONE question each (the harder of the pair) …
  const nomPicks = nominal.filter(({ ty }) => diagnosticPool(ty.cy).length);
  // paper-length safety: drop year-below topics (seeded order) if the mandatory firsts would pass the hard cap
  if (nomPicks.length + belowPicks.length > PLACEMENT_HARD) belowPicks = shuffled(belowPicks, `${subject}-${N}-trim`).slice(0, Math.max(0, PLACEMENT_HARD - nomPicks.length));
  for (const { t, ty } of belowPicks) slots.set(sk(t, ty), [{ t, ty, q: [...diagnosticPool(ty.cy)].sort((a, b) => a.difficulty - b.difficulty)[0] }]);
  for (const { t, ty } of nomPicks) slots.set(sk(t, ty), [{ t, ty, q: [...diagnosticPool(ty.cy)].sort((a, b) => b.difficulty - a.difficulty)[0] }]);
  // … then a second representative question per nominal topic while the paper has room (seeded order, so it is not
  // always the same topics that miss out)
  let total = [...slots.values()].reduce((n, s) => n + s.length, 0);
  for (const { t, ty } of shuffled(nomPicks, `${subject}-${N}-second`)) {
    if (total >= PLACEMENT_SOFT) break;
    const first = slots.get(sk(t, ty))![0].q;
    const second = diagnosticPool(ty.cy).find((q) => q.key !== first.key);
    if (!second) continue;
    slots.get(sk(t, ty))!.push({ t, ty, q: second });
    total++;
  }
  return shuffled([...slots.values()].flat(), `${subject}-${N}-order`);
}

// ── stored shapes ────────────────────────────────────────────────────────────
type Write = { col: string; id: string; data: Record<string, unknown> };
const OPT_IDS = ["a", "b", "c", "d", "e", "f"];

function kindMap(cfg: HubSettings): Record<CKind, string> {
  const want: Record<CKind, string> = { single: "choice", multi: "multi", short: "exact", number: "numeric", written: "manual" };
  const out = {} as Record<CKind, string>;
  for (const k of Object.keys(want) as CKind[]) {
    // prefer the standard id (single/multi/short/number/written); a tenant that renamed a kind keeps its own id for that marking rule
    const pick = cfg.questionKinds.find((x) => x.id === k && x.mark === want[k]) ?? cfg.questionKinds.find((x) => x.mark === want[k]);
    if (!pick) throw new Error(`This tenant's question kinds have no "${want[k]}" marking rule for ${k} questions`);
    out[k] = pick.id;
  }
  return out;
}
/** The content question as the exact doc the questions API stores. */
function questionDoc(q: CQuestion, topicId: string, kinds: Record<CKind, string>, imgId: (file: string) => string): Record<string, unknown> {
  const options = q.kind === "single" || q.kind === "multi" ? (q.options ?? []).map((text, i) => ({ id: OPT_IDS[i], text })) : [];
  const idOf = (text: string) => {
    const i = (q.options ?? []).findIndex((o) => o === text);
    if (i < 0) throw new Error(`${q.key}: answer "${text}" is not one of the options`);
    return OPT_IDS[i];
  };
  let answer: unknown;
  if (q.kind === "single") answer = idOf(q.answer as string);
  else if (q.kind === "multi") answer = (q.answer as string[]).map(idOf);
  else if (q.kind === "number") answer = q.answer as number;
  else if (q.kind === "written") answer = null; // a tutor marks it; the mark scheme is in `explanation`
  else answer = String(q.answer).trim();
  return {
    topicId, kind: kinds[q.kind], prompt: q.prompt, options, answer,
    acceptedAnswers: q.kind === "short" ? [...new Set((q.accepted ?? []).map((a) => a.trim()).filter(Boolean))] : [],
    tolerance: q.kind === "number" ? q.tolerance ?? 0 : 0,
    marks: q.marks ?? 1, explanation: q.explanation, published: true,
    image: q.image ? { id: imgId(q.image.file), alt: q.image.alt } : null,
  };
}

const tenantCfg = async () => mergeHub(((await db.collection("libraries").doc(TID).get()).get("settings.hub") ?? null) as Partial<HubSettings> | null);

async function withRetry<T>(what: string, fn: () => Promise<T>): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await fn(); }
    catch (e) { if (i >= 4) throw e; const ms = 1500 * i; console.warn(`  ${what} failed (${(e as Error).message.slice(0, 80)}) — retry ${i}/3 in ${ms}ms`); await new Promise((r) => setTimeout(r, ms)); }
  }
}
async function delAll(refs: FirebaseFirestore.DocumentReference[], label = "") {
  for (let i = 0; i < refs.length; i += 400) {
    const chunk = refs.slice(i, i + 400);
    await withRetry("delete batch", async () => { const b = db.batch(); for (const r of chunk) b.delete(r); await b.commit(); });
    if (label && refs.length > 400) console.log(`  ${label}: deleted ${Math.min(i + 400, refs.length)}/${refs.length}`);
  }
}
async function commitWrites(writes: Write[]) {
  const sorted = [...writes].sort((a, b) => WRITE_ORDER.indexOf(a.col) - WRITE_ORDER.indexOf(b.col));
  const done: Record<string, number> = {};
  const total: Record<string, number> = {};
  for (const w of sorted) total[w.col] = (total[w.col] ?? 0) + 1;
  let batch: Write[] = [], bytes = 0;
  const flush = async () => {
    if (!batch.length) return;
    const chunk = batch; batch = []; bytes = 0;
    await withRetry("write batch", async () => { const b = db.batch(); for (const w of chunk) b.set(db.collection(w.col).doc(w.id), w.data); await b.commit(); });
    for (const w of chunk) done[w.col] = (done[w.col] ?? 0) + 1;
    const last = chunk[chunk.length - 1].col;
    if (total[last] > 400 || last === "images") console.log(`  ${last}: ${done[last]}/${total[last]}`);
  };
  for (const w of sorted) {
    const size = w.col === "images" ? String(w.data.b64 ?? "").length : 1500;
    if (batch.length >= 400 || bytes + size > 6_000_000) await flush();
    batch.push(w); bytes += size;
  }
  await flush();
}

/** One pass over the tenant's docs: our ids (with createdAt) per collection. */
async function ourDocs(col: string, fields: string[] = ["createdAt"]) {
  const snap = await db.collection(col).where("tenantId", "==", TID).select(...fields).get();
  return snap.docs.filter((d) => d.id.startsWith(P));
}

// ── seed ─────────────────────────────────────────────────────────────────────
async function seed() {
  const { name, ownerUid, ownerName } = await guard();
  const { topics: all, packs, problems, skipped } = await loadContent();
  for (const p of problems) console.warn("  content problem: " + p);
  if (problems.length && STRICT) { console.error(`--strict: ${problems.length} content problem(s) — aborting.`); process.exit(1); }
  if (skipped.length) console.warn(`  SKIPPED ${skipped.length} invalid file(s): ${skipped.join(", ")}\n`);
  if (!all.length) { console.error("No valid content found in server/src/curriculum/*/."); process.exit(1); }
  const scopeTopics = all.filter((t) => [...t.ys.values()].some((ty) => tyInScope(t, ty)));
  if (!scopeTopics.length) { console.error(`Nothing in scope (pack=${PACK ?? "all"} subject=${SUBJECT ?? "all"} years=${YEARS_ARG ?? "all"}). Packs found: ${packs.join(", ")}`); process.exit(1); }
  console.log(`Packs: ${packs.join(", ")}${FILTERED ? `  ·  scope: pack=${PACK ?? "all"} subject=${SUBJECT ?? "all"} years=${YEARS_ARG ?? "all"}` : ""}`);
  console.log(matrix(scopeTopics, (t, ty) => (tyInScope(t, ty) ? `${ty.cy.quiz.questions.length}q` : "-")));

  const cfg = await tenantCfg();
  const kinds = kindMap(cfg);
  const groupLabel = (y: number) => cfg.yearGroups.find((g) => lc(g) === lc(yl(y))) ?? yl(y);
  const missingYG = new Set<string>();
  const audienceFor = (years: number[]) => { for (const y of years) if (!cfg.yearGroups.some((g) => lc(g) === lc(yl(y)))) missingYG.add(yl(y)); return { yearGroups: years.map(groupLabel), ageMin: null, ageMax: null }; };
  const nowIso = new Date().toISOString();
  const b = { tenantId: TID, franchiseId: null, createdBy: ownerUid || "seed" };
  const writes: Write[] = [];

  // ONE read of the tenant's existing rows (topics in full for reuse-matching; ours with createdAt for stability + pruning)
  const [topicSnap, ...ours] = await Promise.all([db.collection("hubTopics").where("tenantId", "==", TID).get(), ...COLS.filter((c) => c !== "hubTopics").map((c) => ourDocs(c)), ourDocs("images", ["bytes"])]);
  const prevCreated = new Map<string, string>();
  const ourIds = new Map<string, string[]>(); // col → ids we made earlier
  COLS.filter((c) => c !== "hubTopics").forEach((c, i) => { ourIds.set(c, ours[i].map((d) => d.id)); for (const d of ours[i]) prevCreated.set(`${c}/${d.id}`, d.get("createdAt") as string); });
  ourIds.set("images", ours[ours.length - 1].map((d) => d.id));
  ourIds.set("hubTopics", topicSnap.docs.filter((d) => d.id.startsWith(P)).map((d) => d.id));
  for (const d of topicSnap.docs) if (d.id.startsWith(P)) prevCreated.set(`hubTopics/${d.id}`, d.get("createdAt") as string);
  const put = (col: string, docId: string, data: Record<string, unknown>) => writes.push({ col, id: docId, data: { ...b, ...data, createdAt: prevCreated.get(`${col}/${docId}`) ?? nowIso } });

  // ── taxonomy: reuse the tenant's rows case-insensitively, create the rest ──
  const existing = topicSnap.docs.filter((d) => !d.id.startsWith(P) && (d.get("franchiseId") ?? null) === null).map((d) => ({ id: d.id, subject: String(d.get("subject")), topic: String(d.get("topic")), subtopic: (d.get("subtopic") as string | null) ?? null, parent: (d.get("parentTopicId") as string | null) ?? null }));
  const subjectSpelling = new Map<string, string>();
  const spell = (s: string) => { if (!subjectSpelling.has(s)) subjectSpelling.set(s, topicSnap.docs.find((d) => lc(d.get("subject")) === lc(s))?.get("subject") ?? s); return subjectSpelling.get(s)!; };
  const subIdOf = new Map<string, string>(); // `${subject}|${topic}|${year}` → subtopic doc id
  const qInfo = new Map<string, { t: LTopic; ty: TY; q: CQuestion; docId: string }>();
  const reused: string[] = [];
  let newParents = 0, newSubs = 0, reusedSubs = 0;
  for (const t of scopeTopics) {
    const subject = spell(t.subject);
    const hit = existing.find((e) => lc(e.subject) === lc(subject) && lc(e.topic) === lc(t.topic) && e.subtopic === null && e.parent === null);
    const row = hit ? { id: hit.id, topic: hit.topic } : { id: ID.topic(t.subject, t.topic), topic: t.topic };
    if (hit) { if (hit.topic !== t.topic) reused.push(`${t.subject}: ${t.topic} → "${hit.topic}"`); } else { put("hubTopics", row.id, { subject, topic: row.topic, subtopic: null, parentTopicId: null }); newParents++; }
    for (const ty of t.ys.values()) {
      if (!tyInScope(t, ty)) continue;
      const shit = existing.find((e) => lc(e.subject) === lc(subject) && lc(e.topic) === lc(row.topic) && lc(e.subtopic) === lc(ty.label) && e.parent === row.id);
      const sid = shit ? shit.id : ID.sub(t.subject, t.topic, ty.year);
      if (shit) reusedSubs++; else { put("hubTopics", sid, { subject, topic: row.topic, subtopic: ty.label, parentTopicId: row.id }); newSubs++; }
      subIdOf.set(`${t.subject}|${t.topic}|${ty.year}`, sid);
    }
  }

  // ── images (each distinct picture once) ──
  const imgFiles = new Map<string, { pack: string; file: string }>();
  for (const t of scopeTopics) for (const ty of t.ys.values()) if (tyInScope(t, ty)) for (const q of ty.cy.quiz.questions) if (q.image) imgFiles.set(ID.img(ty.pack, q.image.file), { pack: ty.pack, file: q.image.file });
  const imgIdFor = new Map<string, string>(); // `${pack}/${file}` → doc id
  for (const [docId, { pack, file }] of imgFiles) {
    imgIdFor.set(`${pack}/${file}`, docId);
    const buf = fs.readFileSync(path.resolve(here, "../../scratch/curriculum-images", pack, file));
    if (buf.length > 200_000 || buf[0] !== 0x89 || buf.subarray(1, 4).toString() !== "PNG") throw new Error(`${pack}/${file} is not a valid PNG under 200KB`);
    // exactly the `images` doc shape hub uploads produce (+ hubUse:"question", which the API stamps when a question claims it)
    writes.push({ col: "images", id: docId, data: { tenantId: TID, contentType: "image/png", b64: buf.toString("base64"), private: true, kind: "hub", hubUse: "question", bytes: buf.length, createdAt: nowIso } });
  }

  // ── notes / questions / quizzes / flashcards per topic-year ──
  let bigNotes = 0, noteBytes = 0, maxNote = 0;
  for (const t of scopeTopics) for (const ty of t.ys.values()) {
    if (!tyInScope(t, ty)) continue;
    const { cy, year } = ty;
    const sid = subIdOf.get(`${t.subject}|${t.topic}|${year}`)!;
    const subject = spell(t.subject);
    put("hubNotes", ID.note(t.subject, t.topic, year), { topicId: sid, title: cy.note.title, body: cy.note.body, published: true, attachments: [], videos: [], createdByName: ownerName, updatedAt: nowIso });
    const nb = Buffer.byteLength(cy.note.body); noteBytes += nb; maxNote = Math.max(maxNote, nb); if (nb > 1536) bigNotes++;
    const imgId = (file: string) => imgIdFor.get(`${ty.pack}/${file}`)!;
    for (const q of cy.quiz.questions) {
      const docId = ID.q(t.subject, q.key);
      put("hubQuestions", docId, { ...questionDoc(q, sid, kinds, imgId), yearGroups: ty.yc.map(groupLabel), updatedAt: nowIso });
      qInfo.set(q.key, { t, ty, q, docId });
    }
    put("hubAssessments", ID.quiz(t.subject, t.topic, year), {
      type: "quiz", title: cy.quiz.title, subject, topicIds: [sid], questionIds: cy.quiz.questions.map((q) => qInfo.get(q.key)!.docId),
      timeLimitMins: null, passMarkPct: cfg.passMarkPct, published: true, updatedAt: nowIso,
      audience: audienceFor(ty.yc), retakePolicy: "inherit", retakeCooldownHours: null,
    });
    cy.flashcards.forEach((f, i) => put("hubFlashcards", ID.card(t.subject, t.topic, year, i + 1), { topicId: sid, front: f.front, back: f.back, published: true, createdByName: ownerName, updatedAt: nowIso }));
  }

  // ── placement (diagnostic) papers: per SUBJECT per year, built from ALL loaded content, written only if every question
  //    they use is inside this run's scope (never a paper that points at something not seeded) ──
  const placementNotes: string[] = [];
  const subjects = [...new Set(all.map((t) => t.subject))].filter(subjectInScope);
  for (const subject of subjects) for (let N = 1; N <= 13; N++) {
    if (!inRange(N)) continue;
    const picks = buildPlacement(subject, N, all);
    if (!picks.length || !picks.some((p) => p.ty.yc.includes(N))) continue;
    const uncovered = picks.filter((p) => !tyInScope(p.t, p.ty));
    if (uncovered.length) { placementNotes.push(`  ${subject} placement Year ${N}: SKIPPED (needs ${uncovered.length} question(s) outside this run's scope — run without filters)`); continue; }
    const topicIds = [...new Set(picks.map((p) => subIdOf.get(`${p.t.subject}|${p.t.topic}|${p.ty.year}`)!))];
    put("hubAssessments", ID.placement(subject, N), {
      type: "diagnostic", title: `${spell(subject)} placement — ${yl(N)}`, subject: spell(subject), topicIds, questionIds: picks.map((p) => qInfo.get(p.q.key)!.docId),
      timeLimitMins: null, passMarkPct: 0, published: true, updatedAt: nowIso,
      audience: audienceFor([N]), retakePolicy: "inherit", retakeCooldownHours: null,
    });
    const nom = picks.filter((p) => p.ty.yc.includes(N)).length;
    placementNotes.push(`  ${spell(subject)} placement ${yl(N)}: ${picks.length} questions (${nom} from ${yl(N)}, ${picks.length - nom} from ${yl(N - 1)}) across ${topicIds.length} topic-years`);
  }

  // ── pruning: unfiltered runs drop docs we made earlier that the content no longer produces; a filtered run only
  //    migrates the ids of the first (pre-pack) Maths-only version of this seeder ──
  const keep = new Set(writes.map((w) => `${w.col}/${w.id}`));
  const legacyOk = subjectInScope("Maths") && packInScope("ks2maths");
  const staleIds: { col: string; id: string }[] = [];
  for (const [col, ids] of ourIds) for (const docId of ids) {
    if (keep.has(`${col}/${docId}`)) continue;
    if (!FILTERED || (legacyOk && LEGACY.test(docId))) staleIds.push({ col, id: docId });
  }
  // never delete an assessment students have already sat / been set as homework
  let keptAssessments = 0;
  const staleAsm = new Set(staleIds.filter((s) => s.col === "hubAssessments").map((s) => s.id));
  if (staleAsm.size) {
    const [att, hw] = await Promise.all([db.collection("hubAttempts").where("tenantId", "==", TID).select("assessmentId").get(), db.collection("hubHomework").where("tenantId", "==", TID).select("assessmentId").get()]);
    const used = new Set([...att.docs, ...hw.docs].map((d) => d.get("assessmentId") as string));
    for (let i = staleIds.length - 1; i >= 0; i--) if (staleIds[i].col === "hubAssessments" && used.has(staleIds[i].id)) { staleIds.splice(i, 1); keptAssessments++; }
  }

  console.log(`${DRY ? "DRY RUN — nothing written. Would seed" : "Seeding"} into "${name}" (${TID}) — ${writes.length} docs:`);
  if (!DRY) {
    await commitWrites(writes);
    if (staleIds.length) await delAll(staleIds.map((s) => db.collection(s.col).doc(s.id)), "stale");
  }
  const by = (c: string) => writes.filter((w) => w.col === c).length;
  const asm = writes.filter((w) => w.col === "hubAssessments");
  console.log(`${DRY ? "" : "Done. "}  topic rows written: ${newParents} parents + ${newSubs} year subtopics (${reusedSubs} pre-existing year subtopics reused); existing tenant parents reused case-insensitively${reused.length ? ` (renamed to tenant spelling: ${reused.join("; ")})` : ""}`);
  console.log(`  ${by("hubNotes")} notes (${(noteBytes / 1024).toFixed(0)} KB, largest ${(maxNote / 1024).toFixed(1)} KB, ${bigNotes} over 1.5 KB) · ${by("hubQuestions")} questions · ${by("images")} images · ${asm.filter((a) => a.data.type === "quiz").length} quizzes + ${asm.filter((a) => a.data.type === "diagnostic").length} placement papers · ${by("hubFlashcards")} flashcards`);
  for (const n of placementNotes) console.log(n);
  console.log(`  stale docs ${DRY ? "that would be pruned" : "pruned"}: ${staleIds.length}${FILTERED && !staleIds.length ? " (filtered run: no pruning)" : ""}${keptAssessments ? ` · ${keptAssessments} stale assessment(s) KEPT because students have attempts/homework on them` : ""}`);
  if (missingYG.size) console.warn(`  WARNING: this tenant's hub year groups don't include ${[...missingYG].join(", ")} — audiences use the plain label; add them in Learning Hub settings.`);
  console.log(`  Verify:  npx tsx src/seedCurriculum.ts check ${TID}${FILTERED ? ` ${[PACK && `--pack ${PACK}`, SUBJECT && `--subject ${SUBJECT}`, YEARS_ARG && `--years ${YEARS_ARG}`].filter(Boolean).join(" ")}` : ""}   ·   Remove:  npx tsx src/seedCurriculum.ts clean ${TID}`);
}

// ── clean ────────────────────────────────────────────────────────────────────
async function clean() {
  await guard();
  const inScopeId = (docId: string) => SUBJECT === undefined || docId.startsWith(`${P}${slug(SUBJECT)}-`) || (lc(SUBJECT) === "maths" && LEGACY.test(docId));
  const mineIn = async (col: string) => (await ourDocs(col, [])).filter((d) => inScopeId(d.id));
  const asms = await mineIn("hubAssessments"), cards = await mineIn("hubFlashcards");
  const asmIds = new Set(asms.map((d) => d.id)), cardIds = new Set(cards.map((d) => d.id));
  const [att, hw, rev] = await Promise.all([
    db.collection("hubAttempts").where("tenantId", "==", TID).select("assessmentId").get(),
    db.collection("hubHomework").where("tenantId", "==", TID).select("assessmentId").get(),
    db.collection("hubFlashcardReviews").where("tenantId", "==", TID).select("cardId").get(),
  ]);
  const nAtt = att.docs.filter((d) => asmIds.has(d.get("assessmentId"))).length, nHw = hw.docs.filter((d) => asmIds.has(d.get("assessmentId"))).length, nRev = rev.docs.filter((d) => cardIds.has(d.get("cardId"))).length;
  if ((nAtt || nHw || nRev) && !FORCE) {
    console.error(`Refusing: students have used this content (${nAtt} attempts, ${nHw} homework, ${nRev} flashcard reviews). Removing it would orphan their history. Re-run with --force to delete anyway.`);
    process.exit(1);
  }
  const out: Record<string, number> = {};
  out.hubAssessments = asms.length; await delAll(asms.map((d) => d.ref), "hubAssessments");
  out.hubFlashcards = cards.length; await delAll(cards.map((d) => d.ref), "hubFlashcards");
  const qs = await mineIn("hubQuestions"); out.hubQuestions = qs.length; await delAll(qs.map((d) => d.ref), "hubQuestions");
  const notes = await mineIn("hubNotes"); out.hubNotes = notes.length; await delAll(notes.map((d) => d.ref), "hubNotes");
  // pictures: all of ours if unscoped, else only those no remaining question of ours uses
  const imgs = (await ourDocs("images", [])) ;
  let delImgs = imgs;
  if (SUBJECT !== undefined) {
    const left = await db.collection("hubQuestions").where("tenantId", "==", TID).select("image").get();
    const used = new Set(left.docs.map((d) => d.get("image")?.id as string | undefined).filter(Boolean));
    delImgs = imgs.filter((d) => !used.has(d.id));
  }
  out.images = delImgs.length; await delAll(delImgs.map((d) => d.ref));
  // topic rows we created — subtopics first, then parents; never a row anything else is filed under
  const inUse = new Set<string>();
  for (const col of ["hubQuestions", "hubNotes", "hubFlashcards", "hubAssessments", "hubLessons", "hubHomework"]) {
    for (const d of (await db.collection(col).where("tenantId", "==", TID).select("topicId", "topicIds").get()).docs) {
      const t = d.get("topicId"); if (typeof t === "string") inUse.add(t);
      for (const x of (d.get("topicIds") as string[] | undefined) ?? []) inUse.add(x);
    }
  }
  const tsnap = await db.collection("hubTopics").where("tenantId", "==", TID).select("parentTopicId").get();
  const cand = tsnap.docs.filter((d) => d.id.startsWith(P) && inScopeId(d.id));
  const subs = cand.filter((d) => d.get("parentTopicId") && !inUse.has(d.id));
  await delAll(subs.map((d) => d.ref));
  const gone = new Set(subs.map((d) => d.id));
  const stillHasKid = new Set(tsnap.docs.filter((d) => !gone.has(d.id)).map((d) => d.get("parentTopicId") as string).filter(Boolean));
  const parents = cand.filter((d) => !d.get("parentTopicId") && !inUse.has(d.id) && !stillHasKid.has(d.id));
  await delAll(parents.map((d) => d.ref));
  out.hubTopics = subs.length + parents.length;
  if (subs.length + parents.length < cand.length) out["hubTopics kept (still in use)"] = cand.length - subs.length - parents.length;
  console.log(`Curriculum clean for ${TID}${SUBJECT ? ` (subject ${SUBJECT})` : ""}:`, out);
}

// ── check (read back + assert) ───────────────────────────────────────────────
async function check() {
  await guard();
  const { topics: all, problems, skipped } = await loadContent();
  let bad = 0;
  const ok = (c: unknown, m: string) => { if (!c) { bad++; if (bad <= 60) console.error(`  FAIL: ${m}`); } };
  for (const p of problems) console.warn("  content problem (file skipped): " + p);
  const topics = all.filter((t) => [...t.ys.values()].some((ty) => tyInScope(t, ty)));
  const cfg = await tenantCfg();
  const kinds = kindMap(cfg);
  const ruleOf = (kindId: string): MarkRule => (cfg.questionKinds.find((k) => k.id === kindId)?.mark ?? "manual") as MarkRule;
  console.log(`Checking tenant ${TID} against ${topics.length} topics (scope: pack=${PACK ?? "all"} subject=${SUBJECT ?? "all"} years=${YEARS_ARG ?? "all"}; ${skipped.length} invalid file(s) skipped)…`);

  const readAll = async (col: string) => (await db.collection(col).where("tenantId", "==", TID).get()).docs;
  const [topicDocs, noteDocs, qDocs, aDocs, cardDocs, imgSnap] = await Promise.all([readAll("hubTopics"), readAll("hubNotes"), readAll("hubQuestions"), readAll("hubAssessments"), readAll("hubFlashcards"),
    db.collection("images").where("tenantId", "==", TID).select("kind", "private", "contentType", "bytes", "tenantId").get()]);
  const ownNotes = noteDocs.filter((d) => d.id.startsWith(P)), ownQ = qDocs.filter((d) => d.id.startsWith(P)), ownA = aDocs.filter((d) => d.id.startsWith(P)), ownCards = cardDocs.filter((d) => d.id.startsWith(P));
  const ownImgs = imgSnap.docs.filter((d) => d.id.startsWith(P));
  ok(!ownQ.concat(ownNotes, ownA, ownCards).some((d) => LEGACY.test(d.id)) || FILTERED, "legacy (pre-pack) ids still present — run an unfiltered seed to migrate");

  // expected, from the content
  const expected = { q: 0, n: 0, c: 0, quiz: 0 };
  const expImgs = new Set<string>();
  const contentQ = new Map<string, { t: LTopic; ty: TY; q: CQuestion }>();
  for (const t of topics) for (const ty of t.ys.values()) {
    if (!tyInScope(t, ty)) continue;
    expected.q += ty.cy.quiz.questions.length; expected.n++; expected.c += ty.cy.flashcards.length; expected.quiz++;
    for (const q of ty.cy.quiz.questions) { contentQ.set(ID.q(t.subject, q.key), { t, ty, q }); if (q.image) expImgs.add(ID.img(ty.pack, q.image.file)); }
  }
  const inScopeDoc = (docId: string) => contentQ.has(docId);
  const scopedQ = ownQ.filter((d) => FILTERED ? inScopeDoc(d.id) : true);
  ok(scopedQ.length === expected.q, `questions: expected ${expected.q}, found ${scopedQ.length}`);
  const noteIds = new Set(), cardIdSet = new Set();
  for (const t of topics) for (const ty of t.ys.values()) if (tyInScope(t, ty)) { noteIds.add(ID.note(t.subject, t.topic, ty.year)); ty.cy.flashcards.forEach((_, i) => cardIdSet.add(ID.card(t.subject, t.topic, ty.year, i + 1))); }
  ok(ownNotes.filter((d) => noteIds.has(d.id)).length === expected.n, `notes: expected ${expected.n}, found ${ownNotes.filter((d) => noteIds.has(d.id)).length}`);
  ok(ownCards.filter((d) => cardIdSet.has(d.id)).length === expected.c, `flashcards: expected ${expected.c}, found ${ownCards.filter((d) => cardIdSet.has(d.id)).length}`);
  const quizIds = new Set(); for (const t of topics) for (const ty of t.ys.values()) if (tyInScope(t, ty)) quizIds.add(ID.quiz(t.subject, t.topic, ty.year));
  ok(ownA.filter((d) => quizIds.has(d.id)).length === expected.quiz, `quizzes: expected ${expected.quiz}, found ${ownA.filter((d) => quizIds.has(d.id)).length}`);
  ok([...expImgs].every((i) => ownImgs.some((d) => d.id === i)), `images: some of the ${expImgs.size} expected images are missing`);
  if (!FILTERED) { ok(ownQ.length === expected.q && ownNotes.length === expected.n && ownCards.length === expected.c, `unfiltered check: stray curr- docs exist (q ${ownQ.length}/${expected.q}, notes ${ownNotes.length}/${expected.n}, cards ${ownCards.length}/${expected.c})`); }

  // tenant scoping + published
  const ourAll = [...ownNotes, ...ownQ, ...ownA, ...ownCards, ...topicDocs.filter((d) => d.id.startsWith(P))];
  for (const d of ourAll) ok(d.get("tenantId") === TID, `${d.id}: tenantId`);
  for (const d of [...ownNotes, ...ownQ, ...ownA, ...ownCards]) ok(d.get("published") === true, `${d.id}: not published`);

  // taxonomy: exactly one row per (subject, topic, subtopic) (case-insensitive) for OUR topics; subtopics under the right parent
  const topicById = new Map(topicDocs.map((d) => [d.id, d]));
  const ourKeys = new Set(topics.flatMap((t) => [`${lc(t.subject)}|${lc(t.topic)}`]));
  const seenKeys = new Map<string, string[]>();
  for (const d of topicDocs) { const k = [lc(d.get("subject")), lc(d.get("topic")), lc(d.get("subtopic")), d.get("franchiseId") ?? ""].join("|"); seenKeys.set(k, [...(seenKeys.get(k) ?? []), d.id]); }
  for (const [k, ids] of seenKeys) {
    if (ids.length < 2) continue;
    const [s, tp] = k.split("|");
    if (ourKeys.has(`${s}|${tp}`)) ok(false, `duplicate topic rows (case-insensitive) ${k}: ${ids.join(", ")}`); else console.warn(`  warn: pre-existing duplicate rows ${k} (not ours)`);
  }
  for (const s of new Set(topics.map((t) => t.subject))) {
    const spellings = new Set(topicDocs.filter((d) => lc(d.get("subject")) === lc(s)).map((d) => d.get("subject") as string));
    ok(spellings.size === 1, `subject ${s} spelled ${spellings.size} ways: ${[...spellings].join(" / ")}`);
  }
  const subId = new Map<string, string>(); // `${subject}|${topic}|${year}` → hub subtopic id
  for (const t of topics) {
    const parents = topicDocs.filter((d) => lc(d.get("subject")) === lc(t.subject) && lc(d.get("topic")) === lc(t.topic) && !d.get("subtopic") && !d.get("parentTopicId"));
    ok(parents.length === 1, `topic "${t.subject} / ${t.topic}": expected exactly 1 parent row, found ${parents.length}`);
    for (const ty of t.ys.values()) {
      if (!tyInScope(t, ty)) continue;
      const subs = topicDocs.filter((d) => d.get("parentTopicId") === parents[0]?.id && lc(d.get("subtopic")) === lc(ty.label));
      ok(subs.length === 1, `subtopic ${t.topic} / ${ty.label}: expected 1, found ${subs.length}`);
      if (subs[0]) subId.set(`${t.subject}|${t.topic}|${ty.year}`, subs[0].id);
    }
  }
  const idToTY = new Map<string, { t: LTopic; ty: TY }>(); for (const t of topics) for (const ty of t.ys.values()) { const s = subId.get(`${t.subject}|${t.topic}|${ty.year}`); if (s) idToTY.set(s, { t, ty }); }

  // images: existence + flags for all, full decode for a sample
  const imgIds = new Set(ownImgs.map((d) => d.id));
  for (const r of ownImgs) ok(r.get("tenantId") === TID && r.get("private") === true && r.get("kind") === "hub" && r.get("contentType") === "image/png" && r.get("bytes") <= 200_000, `${r.id}: wrong flags/size`);
  for (const r of shuffled(ownImgs, "img-sample").slice(0, 40)) {
    const d = (await r.ref.get()).data()!; const buf = Buffer.from(String(d.b64), "base64");
    ok(buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && d.bytes === buf.length, `${r.id}: not a valid PNG / bytes mismatch`);
  }

  // notes / cards
  for (const d of ownNotes) { ok(topicById.has(d.get("topicId")), `${d.id}: topic missing`); ok(String(d.get("body")).trim().split(/\s+/).length >= 120 && !!String(d.get("title")).trim(), `${d.id}: note too short / no title`); }
  for (const d of ownCards) { ok(topicById.has(d.get("topicId")), `${d.id}: topic missing`); ok(!!d.get("front") && !!d.get("back"), `${d.id}: empty card`); }

  // questions: structure for ALL, real scoring function for a SAMPLE
  const sampleN = SAMPLE_ARG === "all" ? Infinity : Math.max(1, Number(SAMPLE_ARG) || 300);
  const sampleIds = new Set(shuffled(scopedQ.map((d) => d.id), "score-sample").slice(0, sampleN));
  const qMap = new Map(qDocs.map((d) => [d.id, d.data()]));
  let markChecks = 0, imageRefs = 0, sampled = 0;
  const bySubject = new Map<string, number>();
  for (const d of scopedQ) {
    const x = d.data();
    const src = contentQ.get(d.id);
    ok(!!src, `${d.id}: not produced by the content`);
    ok(topicById.has(x.topicId), `${d.id}: topic ${x.topicId} missing`);
    ok(typeof x.prompt === "string" && x.prompt.length > 7 && !!x.explanation, `${d.id}: prompt/explanation`);
    if (src) bySubject.set(src.t.subject, (bySubject.get(src.t.subject) ?? 0) + 1);
    if (x.image) { imageRefs++; ok(imgIds.has(x.image.id) && String(x.image.alt ?? "").length > 10, `${d.id}: image ${x.image?.id} unresolved or no alt`); }
    const rule = ruleOf(x.kind);
    if (src) ok(x.kind === kinds[src.q.kind] && (src.q.kind === "written") === (rule === "manual"), `${d.id}: kind id ${x.kind}`);
    const opts = (x.options ?? []) as { id: string; text: string }[];
    const optIds = opts.map((o) => o.id);
    ok(new Set(optIds).size === optIds.length, `${d.id}: duplicate option ids`);
    if (rule === "choice") ok(typeof x.answer === "string" && optIds.includes(x.answer) && (!src || opts.find((o) => o.id === x.answer)?.text === src.q.answer), `${d.id}: single answer id/text`);
    else if (rule === "multi") { const a = x.answer as string[]; ok(Array.isArray(a) && a.length >= 2 && a.length < optIds.length && a.every((v) => optIds.includes(v)), `${d.id}: multi answer ids`); }
    else if (rule === "exact") ok(typeof x.answer === "string" && x.answer.trim() !== "", `${d.id}: short answer`);
    else if (rule === "numeric") ok(typeof x.answer === "number", `${d.id}: number answer`);
    else ok(x.answer === null && !!x.explanation, `${d.id}: written answer must be null with a mark scheme`);
    if (!sampleIds.has(d.id)) continue;
    sampled++;
    const q = { mark: rule, answer: x.answer, acceptedAnswers: x.acceptedAnswers, tolerance: x.tolerance, marks: x.marks };
    let right: unknown[] = [], wrong: unknown[] = [];
    if (rule === "choice") { right = [x.answer]; wrong = optIds.filter((o) => o !== x.answer); }
    else if (rule === "multi") { const a = x.answer as string[]; right = [a, [...a].reverse()]; wrong = [[a[0]], optIds, optIds.filter((o) => !a.includes(o)), [...a.slice(1), optIds.find((o) => !a.includes(o))]]; }
    else if (rule === "exact") { right = [x.answer, String(x.answer).toUpperCase(), `  ${x.answer}  `, ...(x.acceptedAnswers as string[])]; wrong = ["zzz-not-an-answer", ""]; }
    else if (rule === "numeric") { const a = x.answer as number, tol = x.tolerance ?? 0; right = [a, String(a), a + tol, a - tol]; wrong = [a + tol + 1, a - tol - 1, "abc"]; }
    else { wrong = [""]; markChecks++; ok(markResponse(q, "a written answer").pending === true, `${d.id}: written answer should wait for a tutor`); }
    for (const r of right) { markChecks++; ok(markResponse(q, r).correct === true, `${d.id}: right response ${JSON.stringify(r)} not marked correct`); }
    for (const w of wrong) { markChecks++; ok(markResponse(q, w).correct === false, `${d.id}: wrong response ${JSON.stringify(w)} marked correct`); }
  }

  // assessments
  const placement: string[] = [];
  const diagKeys = new Set<string>();
  for (const d of ownA) {
    if (FILTERED && !quizIds.has(d.id) && !/-placement-y\d+$/.test(d.id)) continue;
    const x = d.data();
    const qs = (x.questionIds as string[]).map((q) => qMap.get(q));
    ok(qs.every(Boolean), `${d.id}: dangling question id`);
    ok(new Set(x.questionIds).size === x.questionIds.length && x.published === true && qs.length > 0, `${d.id}: repeated/unpublished/empty`);
    ok(x.audience && Array.isArray(x.audience.yearGroups) && x.audience.yearGroups.length >= 1 && x.audience.ageMin === null && x.audience.ageMax === null && x.audience.yearGroups.every((g: string) => cfg.yearGroups.some((yg) => lc(yg) === lc(g))), `${d.id}: audience shape / not a tenant year group`);
    const qTopics = new Set(qs.map((q) => q?.topicId as string));
    ok(qs.every((q) => q && lc(topicById.get(q.topicId)?.get("subject")) === lc(x.subject)), `${d.id}: a question is outside subject ${x.subject}`);
    ok([...qTopics].every((t) => (x.topicIds as string[]).includes(t)), `${d.id}: topicIds don't cover its questions' topics`);
    const hasWritten = qs.some((q) => q && ruleOf(q.kind) === "manual");
    const s = scoreAttempt(qs.map((q) => { const qq = q!; const m = markResponse({ mark: ruleOf(qq.kind), answer: qq.answer, acceptedAnswers: qq.acceptedAnswers, tolerance: qq.tolerance, marks: qq.marks }, ruleOf(qq.kind) === "manual" ? "a written answer" : qq.answer); return { topicId: qq.topicId as string, correct: m.correct, marksAwarded: m.marksAwarded, marksMax: qq.marks as number, pending: m.pending }; }), x.passMarkPct);
    ok(s.pct === 100 && s.status === (hasWritten ? "pending_marking" : "marked"), `${d.id}: a perfect paper scored ${s.pct}% (${s.status})`);
    ok(Object.keys(s.byTopic).length === [...qTopics].filter((t) => qs.some((q) => q?.topicId === t && ruleOf(q.kind) !== "manual")).length, `${d.id}: byTopic doesn't cover every auto-marked topic`);
    if (x.type === "diagnostic") {
      const m = /^(.+) placement — Year (\d+)$/.exec(x.title);
      ok(!!m && lc(m[1]) === lc(x.subject), `${d.id}: title "${x.title}"`);
      const N = Number(m?.[2]);
      ok(!hasWritten, `${d.id}: a placement paper contains a tutor-marked question`);
      const used = new Map<string, number>(); for (const q of qs) used.set(q!.topicId as string, (used.get(q!.topicId as string) ?? 0) + 1);
      ok(qs.length <= PLACEMENT_HARD && [...used.values()].every((n) => n >= 1 && n <= 2), `${d.id}: ${qs.length} questions, max ${Math.max(...used.values())} per topic-year`);
      const { nominal, below } = placementSets(SUBJECT_ORDER.find((s2) => lc(s2) === lc(x.subject)) ?? x.subject, N, all);
      let missing = 0;
      for (const { t, ty } of [...nominal, ...below]) if (diagnosticPool(ty.cy).length && subId.get(`${t.subject}|${t.topic}|${ty.year}`) && !qTopics.has(subId.get(`${t.subject}|${t.topic}|${ty.year}`)!)) missing++;
      // year-below topics may only be dropped by the hard-cap trim (never on ordinary papers)
      ok(missing === 0 || qs.length >= PLACEMENT_HARD - 1, `${d.id}: ${missing} topic-year(s) with content in Year ${N}/${N - 1} have no question`);
      ok([...qTopics].every((t) => { const e = idToTY.get(t); return !!e && (e.ty.yc.includes(N) || e.ty.yc.includes(N - 1)); }), `${d.id}: uses a topic-year outside Year ${N}/${N - 1}`);
      const k = `${lc(x.subject)}|${x.audience.yearGroups.map(lc).sort().join(",")}`;
      ok(!diagKeys.has(k), `two placement papers share subject + audience (the API refuses this): ${k}`); diagKeys.add(k);
      placement.push(`${x.title}: ${qs.length} Qs / ${qTopics.size} topic-years, perfect paper = ${s.pct}%`);
    } else ok(qTopics.size === 1 && x.topicIds.length === 1, `${d.id}: quiz spans ${qTopics.size} topics`);
  }
  // an older (non-curriculum) published diagnostic with an identical subject + audience would block ours at the API
  for (const d of aDocs.filter((x) => !x.id.startsWith(P) && x.get("type") === "diagnostic" && x.get("published") !== false)) {
    const g = ((d.get("audience")?.yearGroups as string[] | undefined) ?? []).map(lc).sort().join(",");
    ok(!diagKeys.has(`${lc(d.get("subject"))}|${g}`) || d.get("audience")?.ageMin != null || d.get("audience")?.ageMax != null, `older diagnostic "${d.get("title")}" has an identical subject + audience to ours`);
  }

  // summary read back from Firestore
  const qBySub = new Map<string, number>(), nBySub = new Map<string, number>(), cBySub = new Map<string, number>();
  for (const d of ownQ) qBySub.set(d.get("topicId"), (qBySub.get(d.get("topicId")) ?? 0) + 1);
  for (const d of ownNotes) nBySub.set(d.get("topicId"), (nBySub.get(d.get("topicId")) ?? 0) + 1);
  for (const d of ownCards) cBySub.set(d.get("topicId"), (cBySub.get(d.get("topicId")) ?? 0) + 1);
  const diag = ownA.filter((d) => d.get("type") === "diagnostic");
  console.log(`Tenant ${TID}: ${ownQ.length} questions (${imageRefs} with pictures, ${ownImgs.length} image docs) · ${ownNotes.length} notes · ${ownA.length - diag.length} quizzes + ${diag.length} placements · ${ownCards.length} flashcards · ${topicDocs.filter((d) => d.id.startsWith(P)).length} curr topic rows`);
  console.log(`  by subject: ${[...bySubject].map(([s, n]) => `${s} ${n}q`).join(", ")}`);
  console.log(`  ${markChecks} scoring-function checks on a sample of ${sampled} of ${scopedQ.length} questions (each: its key marks correct; wrong responses mark incorrect; written waits for a tutor); structure checked on all`);
  for (const p of placement.sort()) console.log("  " + p);
  console.log("\n" + matrix(topics, (t, ty) => { const s = subId.get(`${t.subject}|${t.topic}|${ty.year}`); return s ? `${qBySub.get(s) ?? 0}/${nBySub.get(s) ?? 0}/${cBySub.get(s) ?? 0}` : "MISSING"; }) + "(cells = questions/notes/flashcards read back from Firestore)");
  console.log(bad ? `CHECK FAILED (${bad} problem(s))` : "CHECK PASSED");
  if (bad) process.exitCode = 1;
}

(async () => {
  if (MODE === "clean") await clean();
  else if (MODE === "check") await check();
  else await seed();
  process.exit(process.exitCode ?? 0);
})().catch((e) => { console.error(e); process.exit(1); });
