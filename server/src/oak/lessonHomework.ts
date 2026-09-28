// Kaz (28 Sep 2026): "create a homework with 10-15 questions per lesson and make sure its clear what lesson
// its applied to. you can use the current homeworks as a starting point as long as they are also applied to
// the lessons" — only 433 of 7,894 real-tenant lesson notes have a worksheetQuizId (the ones whose lesson
// happened to have an Oak worksheet PDF, via worksheetQuiz.ts). This script covers the rest: it drafts an
// interactive, auto-marked quiz DIRECTLY from a lesson note's own title+body (no PDF needed), verifies each
// answer with an independent second solve (same bar as worksheetQuiz.ts — anything the checker can't
// reproduce is downgraded to tutor-marked "written" rather than risk a wrong auto-mark), and loads it exactly
// like an existing worksheet quiz: hubQuestions + hubAssessments (wsQuiz:true, lessonId set) + note.worksheetQuizId.
// The quiz title is always "<lesson title> — homework" so it's unambiguous which lesson it belongs to, both in
// the "Set homework" worksheet picker and on the lesson page itself.
//
//   cd server && npx tsx src/oak/lessonHomework.ts <stage> --tenants <id[,id]> [options]
//
// Stages (idempotent + resumable; state in scratch/oak-lesson-homework/state.json):
//   select --tenants <id[,id]> [--pilot N] [--limit N] [--subject S] [--redo]   notes with no worksheetQuizId -> work/index.json
//   draft  [--limit N] [--concurrency N]           LLM: lesson title+body -> drafts/<noteId>.json (10-15 Qs)
//   verify [--limit N] [--concurrency N]           independent second solve -> verify/<noteId>.json
//   load   --tenants <id[,id]> [--dry] [--real] [--retry-failed] [--limit N]    write hubQuestions/hubAssessments, set note.worksheetQuizId
//   report                                          kinds mix, auto-marked %
// SAFETY: the two real tenants need --real for `load` (matches worksheetQuiz.ts's own rule); `select`/`draft`/`verify` never write anything.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../firebase";
import { sanitiseForImport } from "./noOak";
import { mergeHub, type HubSettings } from "../../../lib/hubConfig";
import { shardedTenantRead } from "../lib/hubIndex";
import { claude, keyOf, OPT, validateDraft, brandHits, applyVerify, type DraftFile, type DraftQ } from "./worksheetQuiz";

const REAL = new Set(["7jG2XO3cOD3VtoL8YfFY", "jYp5XNZGT7bgSUMuEgHN"]);
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../../..");
const DIR = path.join(ROOT, "scratch/oak-lesson-homework");
const WORK = path.join(DIR, "work"), DRAFTS = path.join(DIR, "drafts"), VERIFY = path.join(DIR, "verify");
const STATE = path.join(DIR, "state.json"), LOG = path.join(DIR, "run.log");
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const flag = (n: string) => process.argv.includes(`--${n}`);
for (const d of [DIR, WORK, DRAFTS, VERIFY]) fs.mkdirSync(d, { recursive: true });
const log = (s: string) => { const l = `${new Date().toTimeString().slice(0, 8)} ${s}`; console.log(l); fs.appendFileSync(LOG, l + "\n"); };

interface Row { noteId: string; tenant: string; title: string; body: string; topicId: string; subject: string; year: number }
interface State { loaded: Record<string, { at: string; quizId: string; q: number }>; failed: Record<string, string>; skipped: Record<string, string> }
const state: State = (() => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return { loaded: {}, failed: {}, skipped: {} }; } })();
const save = () => { fs.writeFileSync(`${STATE}.tmp`, JSON.stringify(state)); fs.renameSync(`${STATE}.tmp`, STATE); };
const rd = <T,>(f: string): T | null => { try { return JSON.parse(fs.readFileSync(f, "utf8")) as T; } catch { return null; } };
const wr = (f: string, o: unknown) => fs.writeFileSync(f, JSON.stringify(o, null, 1));
const index = (): Row[] => rd<Row[]>(path.join(WORK, "index.json")) ?? [];
const yearOf = (subtopic: string) => Number(String(subtopic).match(/(\d+)/)?.[1]) || 0;

// ── select: every note with no worksheetQuizId yet ──────────────────────────
async function stageSelect() {
  const tenants = (arg("tenants") ?? "").split(",").filter(Boolean);
  if (!tenants.length) throw new Error("--tenants required");
  const subject = arg("subject")?.toLowerCase();
  const rows: Row[] = [];
  const topicCache = new Map<string, { subject: string; subtopic: string }>();
  for (const tenant of tenants) {
    // A raw unsharded .get() against ~7,900 docs times out at real-tenant scale (same note as audit-worksheet-quizzes.ts) — use
    // the app's own sharded, field-masked reader instead.
    const notes = await shardedTenantRead(db.collection("hubNotes"), tenant, ["title", "body", "topicId", "worksheetQuizId"]);
    const need = notes.filter((d) => !d.get("worksheetQuizId") && d.get("title") && d.get("body") && d.get("topicId"));
    // Batch-fetch every distinct topic doc via getAll() instead of one .get() per note — sequential awaits over
    // ~1,300 distinct topics took 3+ minutes (found 28 Sep 2026 on the real tenant) and killed this stage outright.
    const topicIds = [...new Set(need.map((d) => d.get("topicId") as string))].filter((id) => !topicCache.has(id));
    for (let i = 0; i < topicIds.length; i += 300) {
      const refs = topicIds.slice(i, i + 300).map((id) => db.collection("hubTopics").doc(id));
      const docs = await db.getAll(...refs);
      docs.forEach((doc) => topicCache.set(doc.id, { subject: doc.get("subject") ?? "", subtopic: doc.get("subtopic") ?? "" }));
    }
    for (const d of need) {
      const title = d.get("title") as string, body = d.get("body") as string, topicId = d.get("topicId") as string;
      const t = topicCache.get(topicId) ?? { subject: "", subtopic: "" };
      if (subject && !t.subject.toLowerCase().includes(subject)) continue;
      rows.push({ noteId: d.id, tenant, title, body, topicId, subject: t.subject, year: yearOf(t.subtopic) });
    }
  }
  const pilot = Number(arg("pilot")), lim = Number(arg("limit"));
  let out = rows;
  if (pilot) { const step = Math.max(1, Math.floor(rows.length / pilot)); out = rows.filter((_, i) => i % step === 0).slice(0, pilot); }
  else if (lim) out = rows.slice(0, lim);
  wr(path.join(WORK, "index.json"), out);
  log(`select: ${out.length} lessons need homework (of ${rows.length} with none, across ${tenants.length} tenant(s))`);
}

// ── draft: LLM, straight from the lesson's own title+body ──────────────────
const DRAFT_SYS = `You write a homework quiz for a child, based on ONE lesson's own written content (title + body, markdown). Output ONE JSON object (DraftFile: lessonSlug [use the noteId given], unitSlug [use the subject given], title, instructions, questions[]) and nothing else.
Write 10 to 15 questions that test understanding of THIS lesson's content only — do not require outside knowledge beyond what's in the body. Vary question kinds where the content allows it: single|multi (options are exact texts; answer = exact option text[s]), short (typed; give "accepted" variants: digits vs words, plural, British/US spelling, with/without unit), number (numeric, optional tolerance), order (items in CORRECT order), match (pairs), written (tutor-marked; explanation = model answer / mark scheme — use this for anything open-ended, "explain/analyse/describe/your own", or extended writing). Every answer must be reproducible from the lesson body itself — never invent a fact the lesson didn't state. Prompts must be self-contained and readable on screen. Maths as unicode (×÷½²°£), no LaTeX. explanation: 1-2 child-friendly sentences stating the method or the "why", always mandatory. marks default 1. instructions: one short line telling the child what to do. title: "<a short, clear name for this practice>" — NOT the literal lesson title (the note it's attached to already shows that); think of it the way a tutor would title a homework sheet. NEVER include the name of any publisher/source, credit or licence lines, URLs or logos anywhere in the output.`;
async function stageDraft() {
  const rows = index().slice(0, Number(arg("limit")) || Infinity);
  const conc = Math.min(6, Number(arg("concurrency")) || 4);
  let next = 0, ok = 0, fail = 0;
  async function run(r: Row) {
    const f = path.join(DRAFTS, `${r.noteId}.json`); if (fs.existsSync(f)) return;
    try {
      const user = `noteId: ${r.noteId}\nsubject: ${r.subject}\nyear: ${r.year}\n\nLESSON TITLE: ${r.title}\n\nLESSON BODY:\n${r.body.slice(0, 12000)}`;
      const out = JSON.parse((await claude(DRAFT_SYS, user)).replace(/^[^{]*/, "").replace(/[^}]*$/, ""));
      out.lessonSlug = r.noteId; out.unitSlug = r.subject;
      wr(f, out); ok++;
    } catch (e) { fail++; state.failed[`draft:${r.noteId}`] = (e as Error).message; log(`draft FAIL ${r.noteId}: ${(e as Error).message}`); }
    if ((ok + fail) % 25 === 0) { save(); log(`draft progress ${ok + fail}/${rows.length} · ok ${ok} · fail ${fail}`); }
  }
  await Promise.all(Array.from({ length: conc }, async () => { while (next < rows.length) await run(rows[next++]!); }));
  save(); log(`draft: ${ok} ok, ${fail} failed (of ${rows.length})`);
}

// ── verify: independent second solve, same bar as worksheetQuiz.ts ─────────
const stripKey = (d: DraftFile) => ({ title: d.title, instructions: d.instructions, questions: d.questions.filter((q) => q.kind !== "written").map((q) => ({ n: q.n, kind: q.kind, prompt: q.prompt, options: q.options, items: q.items ? [...q.items].sort() : undefined, pairs: q.pairs ? { terms: q.pairs.map((p) => p.term), definitions: q.pairs.map((p) => p.definition).sort() } : undefined })) });
const VERIFY_SYS = `You are a careful teacher marking. Solve each question yourself from scratch, using only general knowledge (you are not shown the original lesson). Output ONE JSON object {"answers":{"<n>":value}}: single = the exact option text, multi = array of exact option texts, short = the answer text, number = a number, order = the array of items in correct order, match = [{"term","definition"}]. Omit a question only if it is genuinely ambiguous or you cannot solve it.`;
async function stageVerify() {
  const rows = index().slice(0, Number(arg("limit")) || Infinity);
  const conc = Math.min(6, Number(arg("concurrency")) || 4);
  let next = 0, ok = 0;
  async function run(r: Row) {
    const d = rd<DraftFile>(path.join(DRAFTS, `${r.noteId}.json`)); if (!d) return;
    const f = path.join(VERIFY, `${r.noteId}.json`); if (fs.existsSync(f)) return;
    try { wr(f, JSON.parse((await claude(VERIFY_SYS, `Lesson subject: ${r.subject}\n\n${JSON.stringify(stripKey(d))}`)).replace(/^[^{]*/, "").replace(/[^}]*$/, ""))); ok++; }
    catch (e) { state.failed[`verify:${r.noteId}`] = (e as Error).message; }
    if (ok % 25 === 0) save();
  }
  await Promise.all(Array.from({ length: conc }, async () => { while (next < rows.length) await run(rows[next++]!); }));
  save(); log(`verify: ${ok} done`);
}

// ── load: write hubQuestions + hubAssessments, set note.worksheetQuizId ────
async function stageLoad() {
  const tenants = (arg("tenants") ?? "").split(",").filter(Boolean), dry = flag("dry"), real = flag("real");
  if (!tenants.length) throw new Error("--tenants required");
  if (tenants.some((t) => REAL.has(t)) && !real && !dry) throw new Error("a real tenant needs --real (and the owner's approval)");
  if (flag("retry-failed")) for (const k of Object.keys(state.failed)) if (k.startsWith("load:")) delete state.failed[k];
  const rows = index().slice(0, Number(arg("limit")) || Infinity);
  const stamp = new Date().toISOString();
  const cfgCache = new Map<string, HubSettings>();
  let nLoaded = 0, nQ = 0;
  for (const r of rows) {
    if (state.loaded[r.noteId] && !flag("redo")) continue;
    if (state.failed[`load:${r.noteId}`]) continue;
    const d = rd<DraftFile>(path.join(DRAFTS, `${r.noteId}.json`)); if (!d) continue;
    const errs = validateDraft(d);
    if (errs.length) { state.failed[`load:${r.noteId}`] = errs.join("; "); log(`INVALID ${r.noteId}: ${errs[0]}`); continue; }
    if (d.questions.length < 10 || d.questions.length > 15) { state.failed[`load:${r.noteId}`] = `${d.questions.length} questions, want 10-15`; continue; }
    const v = rd<{ answers: Record<string, unknown> }>(path.join(VERIFY, `${r.noteId}.json`));
    const { final } = applyVerify(d, v);
    let cfg = cfgCache.get(r.tenant);
    if (!cfg) { const lib = await db.collection("libraries").doc(r.tenant).get(); cfg = mergeHub((lib.get("settings.hub") ?? null) as Partial<HubSettings> | null); cfgCache.set(r.tenant, cfg); }
    const RULE = { single: "choice", multi: "multi", short: "exact", number: "numeric", order: "order", match: "match", written: "manual" } as const;
    const kindId = (rule: string) => { const k = cfg!.questionKinds.find((x) => x.mark === rule); if (!k) throw new Error(`tenant ${r.tenant} has no "${rule}" question kind`); return k.id; };
    const qids: string[] = []; const docs: { id: string; data: Record<string, unknown> }[] = [];
    try {
      final.questions.forEach((q: DraftQ, i: number) => {
        const id = `hw-${r.tenant}-${r.noteId}-q${i + 1}`.slice(0, 200); qids.push(id);
        const k = q.kind === "written" ? { answer: null, acceptedAnswers: [], tolerance: 0 } : keyOf(q);
        const options = q.kind === "single" || q.kind === "multi" ? q.options!.map((t, j) => ({ id: OPT[j], text: t })) : [];
        docs.push({ id, data: {
          tenantId: r.tenant, franchiseId: null, createdBy: "oak-import", createdByName: "Worksheet library", topicId: r.topicId, kind: kindId(RULE[q.kind]), prompt: q.prompt, image: null,
          options, answer: k.answer, acceptedAnswers: k.acceptedAnswers, tolerance: k.tolerance, ...(q.kind === "order" ? { items: q.items } : {}), ...(q.kind === "match" ? { pairs: q.pairs } : {}),
          marks: q.marks ?? 1, explanation: q.explanation, published: true, imported: true, wsQuiz: { qn: q.n, basis: q.basis }, createdAt: stamp, updatedAt: stamp } });
      });
      const aid = `hw-${r.tenant}-${r.noteId}`.slice(0, 200);
      // Kaz: "make sure its clear what lesson its applied to" — the assignable title always names the lesson,
      // not just the tutor's own homework-sheet name for it.
      const asm = {
        tenantId: r.tenant, franchiseId: null, createdBy: "oak-import", createdByName: "Worksheet library", type: "quiz", title: `${r.title} — ${final.title}`,
        subject: r.subject, topicIds: [r.topicId], questionIds: qids, timeLimitMins: null, passMarkPct: cfg.passMarkPct, published: true,
        audience: { yearGroups: r.year ? [cfg.yearGroups.find((x) => x.toLowerCase() === `year ${r.year}`) ?? `Year ${r.year}`] : [], ageMin: null, ageMax: null },
        instructions: final.instructions, retakePolicy: "inherit", retakeCooldownHours: null, imported: true, lessonId: r.noteId, wsQuiz: true, createdAt: stamp, updatedAt: stamp };
      if (!dry) {
        for (let i = 0; i < docs.length; i += 200) { const b = db.batch(); for (const x of docs.slice(i, i + 200)) b.set(db.collection("hubQuestions").doc(x.id), sanitiseForImport(x.data, `hubQuestions/${x.id}`)); await b.commit(); }
        await db.collection("hubAssessments").doc(aid).set(sanitiseForImport(asm, `hubAssessments/${aid}`));
        await db.collection("hubNotes").doc(r.noteId).update({ worksheetQuizId: aid });
        state.loaded[r.noteId] = { at: stamp, quizId: aid, q: docs.length };
      }
      nLoaded++; nQ += docs.length;
    } catch (e) { state.failed[`load:${r.noteId}`] = (e as Error).message; log(`FAIL ${r.noteId}: ${(e as Error).message}`); }
    if (nLoaded % 50 === 0) save();
  }
  save(); log(`load${dry ? " (DRY)" : ""}: ${nLoaded} quizzes, ${nQ} questions across ${tenants.join(", ")}`);
}

function stageReport() {
  const kinds: Record<string, number> = {}; let lessons = 0, q = 0;
  for (const r of index()) {
    const d = rd<DraftFile>(path.join(DRAFTS, `${r.noteId}.json`)); if (!d) continue;
    const v = rd<{ answers: Record<string, unknown> }>(path.join(VERIFY, `${r.noteId}.json`));
    const { final } = applyVerify(d, v); lessons++;
    for (const x of final.questions) { kinds[x.kind] = (kinds[x.kind] ?? 0) + 1; q++; }
  }
  log(`report: ${lessons} drafted lessons · ${q} questions · kinds ${JSON.stringify(kinds)} · auto-marked ${(100 * (q - (kinds.written ?? 0)) / Math.max(1, q)).toFixed(1)}%`);
}

const stage = process.argv[2];
(async () => {
  if (stage === "select") await stageSelect();
  else if (stage === "draft") await stageDraft();
  else if (stage === "verify") await stageVerify();
  else if (stage === "load") await stageLoad();
  else if (stage === "report") stageReport();
  else throw new Error("stage: select|draft|verify|load|report");
})().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
