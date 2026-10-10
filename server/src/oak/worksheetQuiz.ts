// Oak worksheet PDF -> INTERACTIVE, AUTO-MARKED hub quiz (assessment), linked from the lesson note as `worksheetQuizId`.
//
//   cd server && npx tsx src/oak/worksheetQuiz.ts <stage> [options]
//
// Stages (each idempotent + resumable; state in scratch/oak-worksheet-quiz/state.json):
//   select   --tenants <id[,id]> [--pilot N] [--limit N] [--subject S]   choose lessons (raw Oak JSON with a worksheetUrl that exist as notes) -> work/index.json
//   extract  [--limit N]                    fetch <worksheet>/export/pdf, extract text (pdftotext | pypdf), render pages (swift PDFKit, optional), write context.json
//                                           (lesson facts + Oak's own exit/starter Q&A: the ONLY sources an answer may come from)
//   draft    [--limit N]                    LLM draft -> drafts/<slug>.json   (needs ANTHROPIC_API_KEY; without it drafts are supplied as files, see below)
//   verify   [--limit N]                    INDEPENDENT second solve of every auto-marked question WITHOUT the key -> verify/<slug>.json (API, or supplied files);
//                                           marked with the real hubScoring.markResponse; any disagreement downgrades that question to `written` (kept, tutor-marked)
//   load     --tenants <id[,id]> [--dry] [--real] [--retry-failed] [--limit N]   write hubQuestions + hubAssessments (ws-<tid>-<lessonSlug>) and set note.worksheetQuizId
//   report                                  kinds mix, auto-marked %, projection
//
// Draft file format (drafts/<lessonSlug>.json) — see DraftFile below. Verify file: { answers: { "<qn>": <value> } } where the value is the option TEXT
// (single), option texts (multi), text/number (short/number), items in order (order), [{term,definition}] (match); a question the solver cannot answer is omitted.
// SAFETY: the two real tenants need --real; only --dry is allowed against them without it.
import { sanitiseForImport } from "./noOak";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { db } from "../firebase";
import { mergeHub, type HubSettings } from "../../../lib/hubConfig";
import { markResponse, type MarkRule } from "../lib/hubScoring";

const REAL = new Set(["7jG2XO3cOD3VtoL8YfFY", "jYp5XNZGT7bgSUMuEgHN"]);
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../../..");
const RAW = path.join(ROOT, "scratch/oak-raw");
const DIR = path.join(ROOT, "scratch/oak-worksheet-quiz");
const WORK = path.join(DIR, "work"), DRAFTS = path.join(DIR, "drafts"), VERIFY = process.env.WS_VERIFY_DIR ? path.resolve(process.env.WS_VERIFY_DIR) : path.join(DIR, "verify");
const STATE = path.join(DIR, "state.json"), LOG = path.join(DIR, "run.log");
const MODEL = process.env.WS_MODEL || "claude-sonnet-5";
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const flag = (n: string) => process.argv.includes(`--${n}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
for (const d of [DIR, WORK, DRAFTS, VERIFY]) fs.mkdirSync(d, { recursive: true });
const log = (s: string) => { const l = `${new Date().toTimeString().slice(0, 8)} ${s}`; console.log(l); fs.appendFileSync(LOG, l + "\n"); };

// ── types ────────────────────────────────────────────────────────────────────
export type DKind = "single" | "multi" | "short" | "number" | "written" | "order" | "match";
export interface DraftQ {
  /** worksheet numbering as printed, e.g. "A1", "2c" (unique in the file) */
  n: string;
  kind: DKind;
  prompt: string;
  options?: string[];
  /** single: option text · multi: option texts · short: text · number: number · order/match/written: omit */
  answer?: string | string[] | number;
  /** short: other correct spellings/forms (hubScoring normalises case + whitespace only) */
  accepted?: string[];
  tolerance?: number;
  /** order: items in the CORRECT order · match: pairs */
  items?: string[];
  pairs?: { term: string; definition: string }[];
  marks?: number;
  /** child-facing: why it's right / the method. For `written`: the mark scheme / model answer. */
  explanation: string;
  /** where the answer comes from (audit): given in the worksheet, in Oak's lesson content, or derived by unambiguous knowledge/calculation */
  basis: "worksheet" | "lesson" | "derived" | "open-ended";
  /** the question depends on a picture/diagram in the PDF: stored as `written` with a pointer to the printable page */
  needsPicture?: { page: number };
}
export interface DraftFile { lessonSlug: string; unitSlug: string; title: string; instructions: string; pdfTotalMarks?: number; questions: DraftQ[]; skipped?: string }
interface IndexRow { key: string; lessonSlug: string; unitSlug: string; title: string; subject: string; programme: string; year: number; gid: string; tenants: Record<string, string> }
interface State { loaded: Record<string, { at: string; quizId: string; q: number }>; failed: Record<string, string>; skipped: Record<string, string>; usage?: { in: number; out: number; calls: number } }
const state: State = (() => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return { loaded: {}, failed: {}, skipped: {} }; } })();
const save = () => { fs.writeFileSync(`${STATE}.tmp`, JSON.stringify(state)); fs.renameSync(`${STATE}.tmp`, STATE); };
const rd = <T>(f: string): T | null => { try { return JSON.parse(fs.readFileSync(f, "utf8")) as T; } catch { return null; } };
const wr = (f: string, o: unknown) => fs.writeFileSync(f, JSON.stringify(o, null, 1));
const index = (): IndexRow[] => rd<IndexRow[]>(path.join(WORK, "index.json")) ?? [];

// ── validation (a draft is only ever loaded through this) ────────────────────
const nz = (s: unknown): s is string => typeof s === "string" && s.trim() !== "";
/** OWNER RULE: no source branding may reach a child/parent-visible field (title, instructions, prompts, options, explanations, accepted, items, pairs). */
export const BRAND_RE = /\b(oak|oak national academy|national academy|ogl|open government licence)\b|thenational\.academy|©/i;
export const brandHits = (d: DraftFile): string[] => {
  const hits: string[] = [];
  const chk = (where: string, v: unknown) => { if (typeof v === "string" && BRAND_RE.test(v)) hits.push(`${where}: source branding "${v.match(BRAND_RE)![0]}"`); };
  chk("title", d.title); chk("instructions", d.instructions);
  for (const q of d.questions ?? []) { const w = `q${q.n}`; chk(w + ".prompt", q.prompt); chk(w + ".explanation", q.explanation); (q.options ?? []).forEach((o) => chk(w + ".option", o)); (q.accepted ?? []).forEach((o) => chk(w + ".accepted", o)); (q.items ?? []).forEach((o) => chk(w + ".item", o)); (q.pairs ?? []).forEach((p) => { chk(w + ".pair", p.term); chk(w + ".pair", p.definition); }); if (typeof q.answer === "string") chk(w + ".answer", q.answer); if (Array.isArray(q.answer)) q.answer.forEach((a) => chk(w + ".answer", a)); }
  return hits;
};
export function validateDraft(d: DraftFile): string[] {
  const errs: string[] = [];
  if (d.skipped) return errs;
  errs.push(...brandHits(d));
  if (!nz(d.title) || !nz(d.instructions)) errs.push("title/instructions missing");
  if (!Array.isArray(d.questions) || !d.questions.length) return [...errs, "no questions"];
  if (d.questions.length > 40) errs.push("more than 40 questions");
  const seen = new Set<string>();
  for (const q of d.questions) {
    const w = `q${q.n}`;
    if (!nz(q.n) || seen.has(q.n)) errs.push(`${w}: missing/duplicate n`); seen.add(q.n);
    if (!nz(q.prompt) || q.prompt.length > 5000) errs.push(`${w}: prompt`);
    if (!nz(q.explanation)) errs.push(`${w}: explanation is mandatory`);
    if (!["worksheet", "lesson", "derived", "open-ended"].includes(q.basis)) errs.push(`${w}: basis`);
    if (q.kind === "single" || q.kind === "multi") {
      const o = q.options ?? [];
      if (o.length < 2 || o.length > 12 || new Set(o.map((x) => x.trim().toLowerCase())).size !== o.length || o.some((x) => !nz(x) || x.length > 500)) errs.push(`${w}: options`);
      const a = q.kind === "single" ? [q.answer] : q.answer;
      if (!Array.isArray(a) || !a.length || a.some((x) => typeof x !== "string" || !o.includes(x))) errs.push(`${w}: answer must be exact option text(s)`);
      if (q.kind === "single" && Array.isArray(q.answer)) errs.push(`${w}: single answer is an array`);
      if (q.kind === "multi" && Array.isArray(q.answer) && (q.answer.length < 2 || q.answer.length >= o.length)) errs.push(`${w}: multi needs 2..n-1 right options`);
    } else if (q.kind === "short") {
      if (!nz(q.answer) || String(q.answer).length > 200) errs.push(`${w}: short answer`);
      if ((q.accepted ?? []).some((x) => !nz(x))) errs.push(`${w}: accepted`);
    } else if (q.kind === "number") {
      if (typeof q.answer !== "number" || !Number.isFinite(q.answer)) errs.push(`${w}: number answer`);
    } else if (q.kind === "order") {
      const it = q.items ?? [];
      if (it.length < 2 || it.length > 8 || new Set(it).size !== it.length || it.some((x) => !nz(x) || x.length > 300)) errs.push(`${w}: order items (2–8 distinct)`);
    } else if (q.kind === "match") {
      const p = q.pairs ?? [];
      if (p.length < 3 || p.length > 8 || p.some((x) => !nz(x.term) || !nz(x.definition))) errs.push(`${w}: match pairs (3–8)`);
    } else if (q.kind !== "written") errs.push(`${w}: kind`);
    if (q.kind !== "written" && q.basis === "open-ended") errs.push(`${w}: open-ended questions must be written`);
    if (q.kind !== "written" && q.needsPicture) errs.push(`${w}: picture questions must be written`);
  }
  return errs;
}

// ── select ───────────────────────────────────────────────────────────────────
function rawAll() {
  const out: (IndexRow & { subjectTitle: string })[] = [];
  for (const dir of fs.readdirSync(RAW)) {
    const full = path.join(RAW, dir);
    if (dir.startsWith("_") || !fs.statSync(full).isDirectory()) continue;
    for (const f of fs.readdirSync(full)) {
      if (!f.endsWith(".json")) continue;
      try {
        const o = JSON.parse(fs.readFileSync(path.join(full, f), "utf8")) as Record<string, unknown>;
        const gid = String(o.worksheetUrl ?? "").match(/\/presentation\/d\/([A-Za-z0-9_-]{20,80})/)?.[1];
        if (!gid || !o.unitSlug || !o.lessonSlug) continue;
        out.push({ key: `${o.unitSlug}|${o.lessonSlug}`, lessonSlug: String(o.lessonSlug), unitSlug: String(o.unitSlug), title: String(o.lessonTitle), subject: String(o.subjectTitle), subjectTitle: String(o.subjectTitle), programme: dir, year: Number(o.year) || 0, gid, tenants: {} });
      } catch { /* skip */ }
    }
  }
  return out;
}
async function noteMap(tenant: string) {
  const snap = await db.collection("hubNotes").where("tenantId", "==", tenant).select("lesson.unitSlug", "lesson.lessonSlug", "lesson.quizId", "topicId", "worksheetQuizId").get();
  const m = new Map<string, { noteId: string; quizId: string; topicId: string; done: boolean }>();
  for (const d of snap.docs) { const u = d.get("lesson.unitSlug"), l = d.get("lesson.lessonSlug"); if (u && l) m.set(`${u}|${l}`, { noteId: d.id, quizId: d.get("lesson.quizId"), topicId: d.get("topicId"), done: !!d.get("worksheetQuizId") }); }
  return m;
}
/** the pilot mix: spread over subjects/key stages (round-robin per programme so every key stage and a language appear) */
function pilotPick(rows: IndexRow[], n: number, want: string[]): IndexRow[] {
  const byProg = new Map<string, IndexRow[]>();
  for (const r of rows) if (want.some((w) => r.programme.startsWith(w))) { if (!byProg.has(r.programme)) byProg.set(r.programme, []); byProg.get(r.programme)!.push(r); }
  const lists = [...byProg.values()].map((l) => l.filter((_, i) => i % Math.max(1, Math.floor(l.length / 4)) === 1));
  const out: IndexRow[] = [];
  for (let i = 0; out.length < n && lists.some((l) => l[i]); i++) for (const l of lists) if (l[i] && out.length < n) out.push(l[i]);
  return out;
}
async function stageSelect() {
  const tenants = (arg("tenants") ?? "").split(",").filter(Boolean);
  if (!tenants.length) throw new Error("--tenants required");
  const raw = rawAll(); const maps = new Map<string, Awaited<ReturnType<typeof noteMap>>>();
  for (const t of tenants) maps.set(t, await noteMap(t));
  let rows: IndexRow[] = raw.filter((r) => tenants.some((t) => maps.get(t)!.has(r.key)));
  const subject = arg("subject")?.toLowerCase(); if (subject) rows = rows.filter((r) => r.subject.toLowerCase().includes(subject));
  const pilot = Number(arg("pilot"));
  if (pilot) rows = pilotPick(rows, pilot, (arg("programmes") ?? "maths-primary-ks1,maths-primary-ks2,maths-secondary-ks3,maths-secondary-ks4-foundation,science-primary-ks2,science-secondary-ks3,biology-secondary-ks4-foundation,english-primary-ks1,english-primary-ks2,english-secondary-ks3,french-secondary-ks3,spanish-secondary-ks3").split(","));
  const lim = Number(arg("limit")); if (lim) rows = rows.slice(0, lim);
  const seen = new Set<string>(); rows = rows.filter((r) => (seen.has(r.key) ? false : (seen.add(r.key), true)));
  for (const r of rows) for (const t of tenants) { const n = maps.get(t)!.get(r.key); if (n) r.tenants[t] = n.noteId; }
  wr(path.join(WORK, "index.json"), rows);
  const by: Record<string, number> = {}; rows.forEach((r) => { by[r.programme] = (by[r.programme] ?? 0) + 1; });
  log(`select: ${rows.length} lessons (of ${raw.length} raw with a worksheet)  ${JSON.stringify(by)}`);
}

// ── extract ──────────────────────────────────────────────────────────────────
async function fetchPdf(gid: string): Promise<Buffer> {
  let wait = 4000;
  for (let a = 1; a <= 6; a++) {
    try {
      const res = await fetch(`https://docs.google.com/presentation/d/${gid}/export/pdf`, { redirect: "follow", headers: { "User-Agent": "ActivityLane-oak-import/1.0" } });
      if (res.ok) { const b = Buffer.from(await res.arrayBuffer()); if (b.subarray(0, 5).toString("latin1") === "%PDF-" && b.length > 1000) return b; throw new Error("not a PDF"); }
      if ([401, 403, 404].includes(res.status)) throw new Error(`HTTP ${res.status}`);
    } catch (e) { if (a === 6 || /HTTP 40/.test((e as Error).message)) throw e; }
    await sleep(wait); wait = Math.min(wait * 2, 60_000);
  }
  throw new Error("gave up");
}
/** drop source credit/licence lines (footers/headers) so they can never be copied into generated content */
const scrubSource = (t: string) => t.split("\n").filter((l) => !/\boak\b|national academy|open government licence|produced in partnership|terms & conditions|^\s*©/i.test(l)).join("\n");
function pdfText(file: string): string[] {
  try { const t = execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" }); return t.split("\f").filter((x) => x.trim()); } catch { /* fall back */ }
  const py = "import sys,json,pypdf\nr=pypdf.PdfReader(sys.argv[1])\nprint(json.dumps([p.extract_text() or '' for p in r.pages]))";
  return JSON.parse(execFileSync("python3", ["-c", py, file], { encoding: "utf8", maxBuffer: 20e6 }));
}
const RENDER = path.join(DIR, "render"); // swift PDFKit page renderer (render.swift), optional: pages are only rendered when it exists
function contextFor(row: IndexRow) {
  const dir = fs.readdirSync(RAW).find((d) => d === row.programme)!;
  const o = JSON.parse(fs.readFileSync(path.join(RAW, dir, `${row.unitSlug}__${row.lessonSlug}.json`), "utf8")) as Record<string, any>;
  const txt = (p: any) => (Array.isArray(p) ? p.map((x) => x.text ?? "").join(" ") : "");
  const qa = (arr: any[]) => (arr ?? []).map((q) => ({ q: txt(q.questionStem), type: q.questionType, answers: q.answers, feedback: q.feedback }));
  return {
    title: o.lessonTitle, unit: o.unitTitle, subject: o.subjectTitle, year: o.yearGroupTitle, outcome: o.pupilLessonOutcome, keyLearningPoints: o.keyLearningPoints,
    keywords: o.lessonKeywords, misconceptions: o.misconceptionsAndCommonMistakes, oakStarterQuiz: qa(o.starterQuiz), oakExitQuiz: qa(o.exitQuiz),
    transcript: Array.isArray(o.transcriptSentences) ? o.transcriptSentences.join(" ").slice(0, 12000) : "",
  };
}
async function stageExtract() {
  const rows = index().slice(0, Number(arg("limit")) || Infinity);
  let ok = 0;
  for (const r of rows) {
    const dir = path.join(WORK, r.lessonSlug); fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(path.join(dir, "text.txt")) && fs.existsSync(path.join(dir, "context.json"))) continue;
    try {
      const pdf = path.join(dir, "worksheet.pdf");
      if (!fs.existsSync(pdf)) { fs.writeFileSync(pdf, await fetchPdf(r.gid)); await sleep(1000); }
      const pages = pdfText(pdf);
      fs.writeFileSync(path.join(dir, "text.txt"), pages.map((p, i) => `===== PAGE ${i + 1} =====\n${scrubSource(p)}`).join("\n"));
      if (fs.existsSync(RENDER)) { try { execFileSync(RENDER, [pdf, path.join(dir, "page")]); } catch { /* optional */ } }
      wr(path.join(dir, "context.json"), contextFor(r)); ok++;
    } catch (e) { state.failed[`extract:${r.key}`] = (e as Error).message; log(`extract FAIL ${r.lessonSlug}: ${(e as Error).message}`); }
  }
  save(); log(`extract: ${ok} new`);
}

// ── LLM (draft + verify) ─────────────────────────────────────────────────────
// Exported so lessonHomework.ts (which generates quizzes straight from a lesson's own title+body, for the many
// lessons that never had an Oak worksheet PDF to begin with) can reuse the exact same call/retry/usage-tracking
// logic rather than a second, divergent copy of it.
export async function claude(system: string, user: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY; if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  for (let a = 1; a <= 5; a++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: MODEL, max_tokens: 8000, system, messages: [{ role: "user", content: user }] }) });
    if (res.ok) { const j = await res.json() as any; state.usage = { in: (state.usage?.in ?? 0) + j.usage.input_tokens, out: (state.usage?.out ?? 0) + j.usage.output_tokens, calls: (state.usage?.calls ?? 0) + 1 }; return j.content.map((c: any) => c.text ?? "").join(""); }
    if (![429, 500, 502, 503, 529].includes(res.status)) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    await sleep(3000 * a);
  }
  throw new Error("API retries exhausted");
}
const jsonOf = (s: string) => JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1));
const DRAFT_SYS = `You convert an Oak National Academy lesson WORKSHEET (extracted PDF text) into an interactive, auto-marked quiz for children. Output ONE JSON object (DraftFile: lessonSlug, unitSlug, title, instructions, pdfTotalMarks?, questions[]) and nothing else.
Rules: keep the worksheet's title, instructions and question ORDER. One quiz question per answerable item (split "a) b) c)" parts; keep the worksheet numbering in "n"). Kinds: single|multi (options are exact texts; answer = exact option text[s]), short (typed; give "accepted" variants: digits vs words, units, plural, British/US, with/without unit, fraction/decimal forms), number (numeric, optional tolerance), order (items in CORRECT order), match (pairs), written (tutor-marked; explanation = model answer / mark scheme). Worksheets rarely include answers: derive an answer ONLY when it is unambiguous from the lesson content supplied (keyLearningPoints, Oak exit/starter quiz Q&A, transcript) or from certain knowledge/calculation; set basis accordingly. Anything open-ended, "explain/describe/draw/design/your own", opinion, extended writing, drawing, or that depends on a picture/diagram you cannot see => kind "written" (needsPicture:{page} when a picture is needed). Never invent brittle exact-match answers; if several answers are correct, use written or list every variant in accepted. Prompts must be self-contained and readable on screen (no "look at the table above" unless you reproduce the data). Maths as unicode (×÷½²°£), no LaTeX. explanation: 1-2 child-friendly sentences stating the method. marks default 1. NEVER include the name of the publisher/source, credit or licence lines, URLs or logos anywhere in the output (drop footers such as copyright/licence text); titles are just the worksheet title.`;
async function stageDraft() {
  const rows = index().slice(0, Number(arg("limit")) || Infinity);
  for (const r of rows) {
    const f = path.join(DRAFTS, `${r.lessonSlug}.json`); if (fs.existsSync(f)) continue;
    const dir = path.join(WORK, r.lessonSlug);
    try {
      const out = jsonOf(await claude(DRAFT_SYS, `lessonSlug: ${r.lessonSlug}\nunitSlug: ${r.unitSlug}\n\nWORKSHEET TEXT:\n${fs.readFileSync(path.join(dir, "text.txt"), "utf8")}\n\nLESSON CONTEXT:\n${fs.readFileSync(path.join(dir, "context.json"), "utf8")}`));
      wr(f, out);
    } catch (e) { state.failed[`draft:${r.key}`] = (e as Error).message; log(`draft FAIL ${r.lessonSlug}: ${(e as Error).message}`); }
  }
  save();
}

// ── verify: independent solve, marked by the REAL marking function ───────────
const RULE: Record<DKind, MarkRule> = { single: "choice", multi: "multi", short: "exact", number: "numeric", order: "order", match: "match", written: "manual" };
export const OPT = "abcdefghijkl";
/** the stored-shape key for a draft question (what markResponse sees) */
export function keyOf(q: DraftQ): { answer: unknown; acceptedAnswers: string[]; tolerance: number } {
  let answer: unknown = null;
  if (q.kind === "single") answer = OPT[q.options!.indexOf(q.answer as string)];
  else if (q.kind === "multi") answer = (q.answer as string[]).map((a) => OPT[q.options!.indexOf(a)]);
  else if (q.kind === "short") answer = String(q.answer).trim();
  else if (q.kind === "number") answer = q.answer;
  else if (q.kind === "order") answer = q.items;
  else if (q.kind === "match") answer = q.pairs;
  return { answer, acceptedAnswers: q.kind === "short" ? [...new Set((q.accepted ?? []).map((a) => a.trim()).filter(Boolean))] : [], tolerance: q.kind === "number" ? q.tolerance ?? 0 : 0 };
}
/** a solver's raw answer -> the response the child UI would send */
function responseOf(q: DraftQ, v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (q.kind === "single") { const i = q.options!.indexOf(String(v)); return i < 0 ? "?" : OPT[i]; }
  if (q.kind === "multi") return (Array.isArray(v) ? v : [v]).map((x) => { const i = q.options!.indexOf(String(x)); return i < 0 ? "?" : OPT[i]; });
  if (q.kind === "order") return { kind: "order", items: v };
  if (q.kind === "match") return { kind: "match", pairs: v };
  return v;
}
export interface Disagreement { lesson: string; n: string; kind: DKind; prompt: string; key: unknown; solver: unknown }
export function compareSolve(d: DraftFile, solved: Record<string, unknown>): { agree: number; total: number; dis: Disagreement[] } {
  let agree = 0, total = 0; const dis: Disagreement[] = [];
  for (const q of d.questions) {
    if (q.kind === "written") continue; total++;
    const k = keyOf(q);
    const m = markResponse({ mark: RULE[q.kind], answer: k.answer, acceptedAnswers: k.acceptedAnswers, tolerance: k.tolerance, marks: 1 }, responseOf(q, solved[q.n]));
    if (m.correct === true) agree++; else dis.push({ lesson: d.lessonSlug, n: q.n, kind: q.kind, prompt: q.prompt.slice(0, 160), key: q.kind === "order" ? q.items : q.kind === "match" ? q.pairs : q.answer, solver: solved[q.n] ?? null });
  }
  return { agree, total, dis };
}
const stripKey = (d: DraftFile) => ({ title: d.title, instructions: d.instructions, questions: d.questions.filter((q) => q.kind !== "written").map((q) => ({ n: q.n, kind: q.kind, prompt: q.prompt, options: q.options, items: q.items ? [...q.items].sort() : undefined, pairs: q.pairs ? { terms: q.pairs.map((p) => p.term), definitions: q.pairs.map((p) => p.definition).sort() } : undefined })) });
const VERIFY_SYS = `You are a careful teacher marking. Solve each question yourself from scratch. Output ONE JSON object {"answers":{"<n>":value}}: single = the exact option text, multi = array of exact option texts, short = the answer text, number = a number, order = the array of items in correct order, match = [{"term","definition"}]. Omit a question only if it is genuinely ambiguous or you cannot solve it.`;
async function stageVerify() {
  const rows = index().slice(0, Number(arg("limit")) || Infinity);
  for (const r of rows) {
    const d = rd<DraftFile>(path.join(DRAFTS, `${r.lessonSlug}.json`)); if (!d || d.skipped) continue;
    const f = path.join(VERIFY, `${r.lessonSlug}.json`); if (fs.existsSync(f)) continue;
    if (!process.env.ANTHROPIC_API_KEY) continue; // without the API, verify files are supplied by independent reviewers
    try { wr(f, jsonOf(await claude(VERIFY_SYS, `Lesson: ${d.title}\n\n${JSON.stringify(stripKey(d))}`))); } catch (e) { state.failed[`verify:${r.key}`] = (e as Error).message; }
  }
  save();
}
/** draft + verify file -> final draft: every auto-marked question the solver did not reproduce becomes `written` (never silently kept) */
export function applyVerify(d: DraftFile, v: { answers: Record<string, unknown> } | null): { final: DraftFile; dis: Disagreement[]; agree: number; total: number } {
  if (!v) { const total = d.questions.filter((q) => q.kind !== "written").length; return { final: { ...d, questions: d.questions.map((q) => toWritten(q, true)) }, dis: [], agree: 0, total }; }
  const c = compareSolve(d, v.answers); const bad = new Set(c.dis.map((x) => x.n));
  return { final: { ...d, questions: d.questions.map((q) => (bad.has(q.n) ? toWritten(q, true) : q)) }, ...c };
}
function toWritten(q: DraftQ, _force = true): DraftQ {
  if (q.kind === "written") return q;
  const ans = q.kind === "order" ? (q.items ?? []).join(" → ") : q.kind === "match" ? (q.pairs ?? []).map((p) => `${p.term} = ${p.definition}`).join("; ") : Array.isArray(q.answer) ? q.answer.join(", ") : String(q.answer ?? "");
  return { n: q.n, kind: "written", prompt: q.prompt + (q.options ? `\n${q.options.map((o, i) => `${OPT[i].toUpperCase()}. ${o}`).join("\n")}` : ""), marks: q.marks, basis: q.basis, explanation: `Suggested answer (not confirmed by the independent check): ${ans}. ${q.explanation}` };
}

// ── load ─────────────────────────────────────────────────────────────────────
const yearLabelOf = (cfg: HubSettings, y: number) => cfg.yearGroups.find((x) => x.toLowerCase() === `year ${y}`) ?? `Year ${y}`;
async function stageLoad() {
  const tenants = (arg("tenants") ?? "").split(",").filter(Boolean), dry = flag("dry"), real = flag("real");
  if (!tenants.length) throw new Error("--tenants required");
  if (tenants.some((t) => REAL.has(t)) && !real && !dry) throw new Error("a real tenant needs --real (and the owner's approval)");
  if (flag("retry-failed")) { for (const k of Object.keys(state.failed)) if (k.startsWith("load:")) delete state.failed[k]; }
  const rows = index().slice(0, Number(arg("limit")) || Infinity);
  const stamp = new Date().toISOString();
  for (const tenant of tenants) {
    const lib = await db.collection("libraries").doc(tenant).get();
    const cfg = mergeHub((lib.get("settings.hub") ?? null) as Partial<HubSettings> | null);
    const kindId = (rule: MarkRule) => { const k = cfg.questionKinds.find((x) => x.mark === rule); if (!k) throw new Error(`tenant ${tenant} has no "${rule}" question kind`); return k.id; };
    const notes = await noteMap(tenant);
    let nLoaded = 0, nQ = 0;
    for (const r of rows) {
      const sk = `${tenant}|${r.key}`, n = notes.get(r.key);
      if (!n) continue;
      if (state.loaded[sk] && !flag("redo")) continue;
      if (state.failed[`load:${sk}`]) continue;
      const d = rd<DraftFile>(path.join(DRAFTS, `${r.lessonSlug}.json`)); if (!d) { continue; }
      if (d.skipped) { state.skipped[sk] = d.skipped; continue; }
      const errs = validateDraft(d); if (errs.length) { state.failed[`load:${sk}`] = errs.join("; "); log(`INVALID ${r.lessonSlug}: ${errs[0]}`); continue; }
      const v = rd<{ answers: Record<string, unknown> }>(path.join(VERIFY, `${r.lessonSlug}.json`));
      const { final } = applyVerify(d, v);
      const qids: string[] = []; const docs: { id: string; data: Record<string, unknown> }[] = [];
      final.questions.forEach((q, i) => {
        const id = `ws-${tenant}-${r.lessonSlug}-q${i + 1}`.slice(0, 200); qids.push(id);
        const k = q.kind === "written" ? { answer: null, acceptedAnswers: [], tolerance: 0 } : keyOf(q);
        const options = q.kind === "single" || q.kind === "multi" ? q.options!.map((t, j) => ({ id: OPT[j], text: t })) : [];
        const prompt = q.needsPicture ? `${q.prompt}\n\n(This question uses a picture: look at page ${q.needsPicture.page} of the printable worksheet.)` : q.prompt;
        docs.push({ id, data: {
          tenantId: tenant, franchiseId: null, createdBy: "oak-import", createdByName: "Worksheet library", topicId: n.topicId, kind: kindId(RULE[q.kind]), prompt, image: null,
          options, answer: k.answer, acceptedAnswers: k.acceptedAnswers, tolerance: k.tolerance, ...(q.kind === "order" ? { items: q.items } : {}), ...(q.kind === "match" ? { pairs: q.pairs } : {}),
          marks: q.marks ?? 1, explanation: q.explanation, published: true, imported: true, wsQuiz: { qn: q.n, basis: q.basis }, createdAt: stamp, updatedAt: stamp } });
      });
      const aid = `ws-${tenant}-${r.lessonSlug}`.slice(0, 200);
      const quiz = await db.collection("hubAssessments").doc(n.quizId).get();
      const asm = {
        tenantId: tenant, franchiseId: null, createdBy: "oak-import", createdByName: "Worksheet library", type: "quiz", title: final.title, subject: quiz.get("subject") ?? r.subject, topicIds: [n.topicId], questionIds: qids,
        timeLimitMins: null, passMarkPct: cfg.passMarkPct, published: true, audience: { yearGroups: [yearLabelOf(cfg, r.year)], ageMin: null, ageMax: null }, instructions: final.instructions,
        retakePolicy: "inherit", retakeCooldownHours: null, imported: true, lessonId: n.noteId, wsQuiz: true, createdAt: stamp, updatedAt: stamp };
      if (!dry) {
        try {
          for (let i = 0; i < docs.length; i += 200) { const b = db.batch(); for (const x of docs.slice(i, i + 200)) b.set(db.collection("hubQuestions").doc(x.id), sanitiseForImport(x.data, `hubQuestions/${x.id}`)); await b.commit(); }
          await db.collection("hubAssessments").doc(aid).set(sanitiseForImport(asm, `hubAssessments/${aid}`));
          await db.collection("hubNotes").doc(n.noteId).update({ worksheetQuizId: aid });
          state.loaded[sk] = { at: stamp, quizId: aid, q: docs.length };
        } catch (e) { state.failed[`load:${sk}`] = (e as Error).message; log(`FAIL ${sk}: ${(e as Error).message}`); continue; }
      }
      nLoaded++; nQ += docs.length;
    }
    save(); log(`load ${tenant}${dry ? " (DRY)" : ""}: ${nLoaded} quizzes, ${nQ} questions`);
    // This wrote hubQuestions/hubAssessments/hubNotes straight to Firestore, in a separate process from the API server —
    // its in-memory hub cache (lib/hubCache.ts) has no way to see this and keeps serving its last copy (up to 20 min
    // stale) unless told. Best-effort: a script running against an API with no HUB_CACHE_ADMIN_KEY set (or no API up
    // at all, e.g. CI) just skips this — the TTL is still the backstop, same as any other bypass-the-API write.
    if (!dry && nLoaded > 0) await bustHubCache(tenant);
  }
}

async function bustHubCache(tenantId: string) {
  const key = process.env.HUB_CACHE_ADMIN_KEY;
  if (!key) { log(`(skip cache-bust for ${tenantId}: HUB_CACHE_ADMIN_KEY not set — restart the API, or set it, before relying on this content right away)`); return; }
  try {
    const base = process.env.API_URL || "http://localhost:4000";
    const res = await fetch(`${base}/internal/hub-cache/forget`, { method: "POST", headers: { "content-type": "application/json", "x-admin-key": key }, body: JSON.stringify({ tenantId }) });
    log(res.ok ? `cache-bust ok for ${tenantId}` : `cache-bust FAILED for ${tenantId}: HTTP ${res.status}`);
  } catch (e) { log(`cache-bust FAILED for ${tenantId}: ${(e as Error).message}`); }
}

// ── report / projection ──────────────────────────────────────────────────────
function stageReport() {
  const kinds: Record<string, number> = {}; let lessons = 0, q = 0, dis = 0, tot = 0, unv = 0;
  for (const r of index()) {
    const d = rd<DraftFile>(path.join(DRAFTS, `${r.lessonSlug}.json`)); if (!d || d.skipped) continue;
    const v = rd<{ answers: Record<string, unknown> }>(path.join(VERIFY, `${r.lessonSlug}.json`));
    const a = applyVerify(d, v); lessons++; dis += a.dis.length; tot += a.total; if (!v) unv++;
    for (const x of a.final.questions) { kinds[x.kind] = (kinds[x.kind] ?? 0) + 1; q++; }
  }
  const auto = q - (kinds.written ?? 0);
  log(`report: ${lessons} quizzes · ${q} questions · kinds ${JSON.stringify(kinds)} · auto-marked ${(100 * auto / Math.max(1, q)).toFixed(1)}% · verify disagreements ${dis}/${tot} · unverified lessons ${unv}`);
}
async function stageProject() {
  const raw = rawAll(); const n = raw.length;
  const perLesson = { inTok: 6500, outTok: 3200, vIn: 1800, vOut: 900 }; // measured on the pilot: ~7 pages of text + context; draft + verify
  const price = { in: 3, out: 15 }; // $/Mtok (claude-sonnet-5 list price; check the claude-api skill before quoting)
  const cost = n * ((perLesson.inTok + perLesson.vIn) * price.in + (perLesson.outTok + perLesson.vOut) * price.out) / 1e6;
  log(`projection: ${n} raw lessons with a worksheet · est API cost $${cost.toFixed(0)} (draft+verify) · fetch ${(n * 1.2 / 3600).toFixed(1)} h @1.2s/PDF · LLM ${(n * 35 / 3600 / 4).toFixed(1)} h at 4 parallel`);
}

// Guarded: without this, `lessonHomework.ts` importing claude()/keyOf()/etc. from this file would also run
// THIS file's own CLI dispatcher below (against lessonHomework's argv) purely as an import side-effect — found
// 28 Sep 2026 when `lessonHomework.ts select` actually ran worksheetQuiz.ts's stageSelect instead of its own.
const isMain = import.meta.url === `file://${process.argv[1]}`;
const stage = process.argv[2];
if (isMain) (async () => {
  if (stage === "select") await stageSelect();
  else if (stage === "extract") await stageExtract();
  else if (stage === "draft") await stageDraft();
  else if (stage === "verify") await stageVerify();
  else if (stage === "load") await stageLoad();
  else if (stage === "validate") { let bad = 0; for (const r of index()) { const d = rd<DraftFile>(path.join(DRAFTS, `${r.lessonSlug}.json`)); if (!d) { console.log(`MISSING ${r.lessonSlug}`); continue; } const e = validateDraft(d); if (e.length) { bad++; console.log(`${r.lessonSlug}: ${e.join("; ")}`); } } const brand = index().reduce((n, r) => { const d = rd<DraftFile>(path.join(DRAFTS, `${r.lessonSlug}.json`)); return n + (d ? brandHits(d).length : 0); }, 0); console.log((bad ? `${bad} invalid` : "all drafts valid") + ` · source-branding rejections: ${brand}`); }
  else if (stage === "blind") { const dir = path.join(DIR, "blind"); fs.mkdirSync(dir, { recursive: true }); let n = 0; for (const r of index()) { const d = rd<DraftFile>(path.join(DRAFTS, `${r.lessonSlug}.json`)); if (!d || d.skipped) continue; wr(path.join(dir, `${r.lessonSlug}.json`), stripKey(d)); n++; } log(`blind: wrote ${n} answer-free question sheets to ${dir}`); }
  else if (stage === "compare") { let a = 0, t = 0; const all: Disagreement[] = []; for (const r of index()) { const d = rd<DraftFile>(path.join(DRAFTS, `${r.lessonSlug}.json`)); const v = rd<{ answers: Record<string, unknown> }>(path.join(VERIFY, `${r.lessonSlug}.json`)); if (!d || d.skipped || !v) continue; const c = compareSolve(d, v.answers); a += c.agree; t += c.total; all.push(...c.dis); } wr(path.join(DIR, "disagreements.json"), all); log(`compare: agreement ${a}/${t} (${(100 * a / Math.max(1, t)).toFixed(1)}%), ${all.length} disagreements -> disagreements.json`); }
  else if (stage === "report") stageReport();
  else if (stage === "project") await stageProject();
  else throw new Error("stage: select|extract|draft|verify|load|report|project");
})().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
