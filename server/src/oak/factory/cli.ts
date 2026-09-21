// Lesson factory CLI (no Firestore, no network): build + validate the slide deck of every in-scope Oak lesson.
//   cd server
//   npx tsx src/oak/factory/cli.ts check [--subject Maths] [--keystage ks2] [--unit s] [--lesson s] [--limit N] [--json out.json]
//   npx tsx src/oak/factory/cli.ts show <lesson-slug-substring>        (prints the generated deck as readable text)
//   npx tsx src/oak/factory/cli.ts curated                             (validates every curated/*.json override)
// Same lesson set + dedupe as the importer (subject|keystage|unit|lesson).
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { convertMath } from "../math";
import { deckFor, factsFromRaw, CURATED_DIR } from "./index";
import { validateDeck } from "./validate";
import { SLIDES_BY_LESSON } from "../slides";

const here = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.resolve(here, "../../../../scratch/oak-raw");
const args = process.argv.slice(2);
const cmd = args[0];
const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const lc = (s: unknown) => String(s ?? "").trim().toLowerCase();
const cm = (s: string) => convertMath(s).text;
const HUB_SUBJECT: Record<string, string> = { maths: "Maths", english: "English", science: "Science", french: "French", spanish: "Spanish", german: "German", biology: "Science", chemistry: "Science", physics: "Science", "combined science": "Science" };

export interface Lesson { o: Record<string, unknown>; subject: string; subjectTitle: string; ks: string; unitSlug: string; lessonSlug: string; unitTitle: string; lessonTitle: string; year: number; order: number }
const LITE = ["subjectTitle", "keyStageSlug", "unitSlug", "unitTitle", "lessonSlug", "lessonTitle", "year", "orderInUnit", "pupilLessonOutcome", "keyLearningPoints", "lessonKeywords", "lessonOutline", "programmeSlug"];
/** Light copies of every unique raw lesson (only the fields the factory reads), cached in the OS temp dir keyed by the raw files' signature. */
function liteIndex(): Record<string, unknown>[] {
  const files: string[] = [];
  const sig = crypto.createHash("sha1");
  for (const prog of fs.readdirSync(RAW).sort()) {
    const dp = path.join(RAW, prog);
    if (!fs.statSync(dp).isDirectory()) continue;
    for (const f of fs.readdirSync(dp).filter((x) => x.endsWith(".json")).sort()) { const fp = path.join(dp, f); files.push(fp); const st = fs.statSync(fp); sig.update(`${prog}/${f}:${st.size}:${st.mtimeMs}|`); }
  }
  const cache = path.join(os.tmpdir(), `oak-factory-lite-${sig.digest("hex").slice(0, 16)}.json`);
  try { return JSON.parse(fs.readFileSync(cache, "utf8")); } catch { /* rebuild */ }
  const seen = new Set<string>(); const rows: Record<string, unknown>[] = [];
  for (const fp of files) {
    let o: Record<string, unknown>;
    try { o = JSON.parse(fs.readFileSync(fp, "utf8")); } catch { continue; }
    const key = `${o.subjectTitle}|${o.keyStageSlug}|${o.unitSlug}|${o.lessonSlug}`;
    if (seen.has(key)) continue; seen.add(key);
    rows.push(Object.fromEntries(LITE.map((k) => [k, o[k]])));
  }
  try { fs.writeFileSync(cache, JSON.stringify(rows)); } catch { /* optional */ }
  return rows;
}
export function* rawLessons(filter: (o: Record<string, unknown>) => boolean = () => true): Generator<Lesson> {
  for (const o of liteIndex()) {
    const subject = HUB_SUBJECT[lc(o.subjectTitle)];
    if (!subject || !o.unitSlug || !o.lessonSlug) continue;
    if (!filter(o)) continue;
    yield { o, subject, subjectTitle: String(o.subjectTitle), ks: String(o.keyStageSlug), unitSlug: String(o.unitSlug), lessonSlug: String(o.lessonSlug), unitTitle: String(o.unitTitle ?? ""), lessonTitle: String(o.lessonTitle ?? ""), year: Number(o.year) || 0, order: Number(o.orderInUnit) || 0 };
  }
}

function inScope(o: Record<string, unknown>): boolean {
  const S = opt("--subject"), K = opt("--keystage"), U = opt("--unit"), L = opt("--lesson"), Y = opt("--year");
  if (S && lc(S) !== lc(HUB_SUBJECT[lc(o.subjectTitle)]) && lc(S) !== lc(o.subjectTitle)) return false;
  if (K && lc(K) !== lc(o.keyStageSlug)) return false;
  if (Y && Number(Y) !== Number(o.year)) return false;
  if (U && !(lc(o.unitSlug).includes(lc(U)) || lc(o.unitTitle).includes(lc(U)))) return false;
  if (L && !(lc(o.lessonSlug).includes(lc(L)) || lc(o.lessonTitle).includes(lc(L)))) return false;
  return true;
}

/** Other lessons' keywords in the unit (wrong options for keyword questions). Built by one pass over the in-scope units. */
export function unitPools(all: Lesson[]): Map<string, { k: string; d: string }[]> {
  const pools = new Map<string, { k: string; d: string }[]>();
  for (const l of all) {
    const key = `${l.subjectTitle}|${l.ks}|${l.unitSlug}`;
    const a = pools.get(key) ?? [];
    for (const k of factsFromRaw(l.o, cm).keywords) if (k.d && !a.some((x) => x.k.toLowerCase() === k.k.toLowerCase())) a.push(k);
    pools.set(key, a);
  }
  return pools;
}

function readable(deck: unknown[]): string {
  const strip = (s: unknown) => String(s);
  return (deck as { kind: string; title: string; art?: string[]; blocks: Record<string, unknown>[] }[]).map((s, i) => {
    const lines = s.blocks.map((b) => {
      switch (b.t) {
        case "choice": return `   [choice] ${b.q}  -> ${(b.options as string[]).map((o, k) => (k === b.answer ? `*${o}*` : o)).join(" | ")}`;
        case "choices": return (b.items as { q?: string; options: string[]; answer: number }[]).map((c) => `   [choice] ${c.q}  -> ${c.options.map((o, k) => (k === c.answer ? `*${o}*` : o)).join(" | ")}`).join("\n");
        case "define": return (b.items as { term: string; def: string }[]).map((c) => `   [define] ${c.term}: ${c.def}`).join("\n");
        case "match": return `   [match] ${(b.pairs as { a: string; b: string }[]).map((p) => `${p.a} = ${p.b}`).join(" ; ")}`;
        case "cards": return `   [cards] ${(b.items as { emoji: string; title: string }[]).map((c) => `${c.emoji} ${c.title}`).join(" | ")}`;
        case "list": case "chips": return `   [${b.t}] ${(b.items as unknown[]).map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" • ")}`;
        default: return `   [${b.t}] ${strip(b.text ?? JSON.stringify(b))}`;
      }
    });
    return `${i + 1}. (${s.kind}) ${s.title} ${(s.art ?? []).join("")}\n${lines.join("\n")}`;
  }).join("\n");
}

async function main() {
  if (cmd === "curated") {
    let n = 0, bad = 0; let curatedKeys: Set<string> | null = null;
    for (const f of fs.existsSync(CURATED_DIR) ? fs.readdirSync(CURATED_DIR).filter((x) => x.endsWith(".json")) : []) {
      n++;
      try {
        const c = JSON.parse(fs.readFileSync(path.join(CURATED_DIR, f), "utf8")) as { slides?: unknown[]; flashcards?: { front?: string; back?: string }[]; worksheet?: { title?: string; instructions?: string; questions?: { prompt?: string; answer?: string; accepted?: string[]; explanation?: string }[] } };
        const p = c.slides ? validateDeck(c.slides, undefined, true) : ["no slides"];
        const ne = (x: unknown) => typeof x === "string" && x.trim() !== "";
        if (!curatedKeys) curatedKeys = new Set([...rawLessons()].map((l) => `${l.unitSlug}__${l.lessonSlug}`));
        if (!curatedKeys.has(f.replace(/\.json$/, ""))) p.push("file name is not a known <unitSlug>__<lessonSlug> key");
        const fronts = new Set<string>();
        for (const x of c.flashcards ?? []) { if (!ne(x.front) || !ne(x.back) || x.front!.length > 1000 || x.back!.length > 2000) p.push("bad flashcard"); else if (fronts.has(x.front!.toLowerCase())) p.push(`duplicate flashcard front: ${x.front!.slice(0, 40)}`); else fronts.add(x.front!.toLowerCase()); }
        if (c.flashcards && (c.flashcards.length < 5 || c.flashcards.length > 20)) p.push(`${c.flashcards.length} flashcards (want 5-20)`);
        if (c.worksheet) {
          const w = c.worksheet;
          if (!ne(w.title) || !ne(w.instructions)) p.push("worksheet needs title + instructions");
          const qs = w.questions ?? [];
          if (qs.length < 3 || qs.length > 20) p.push(`worksheet has ${qs.length} questions (want 3-20)`);
          for (const q of qs) if (!ne(q.prompt) || !ne(q.answer) || !ne(q.explanation) || (q.accepted !== undefined && (!Array.isArray(q.accepted) || q.accepted.some((a) => !ne(a))))) p.push(`bad worksheet question: ${String(q.prompt).slice(0, 40)}`);
          if (new Set(qs.map((q) => String(q.prompt).toLowerCase())).size !== qs.length) p.push("repeated worksheet prompt");
          // the hub's short-answer marker trims + lower-cases: an answer that only differs by letter case (genotypes Pp/PP/pp, Aa/AA) can never be marked right
          for (const q of qs) if ([q.answer, ...(q.accepted ?? [])].some((a) => /^(?=.*[a-z])(?=.*[A-Z])[A-Za-z]{2,4}$/.test(String(a).trim()) && !/^[A-Z][a-z]+$/.test(String(a).trim()))) p.push(`worksheet answer needs letter case (the marker ignores case): ${String(q.answer).slice(0, 30)}`);
        }
        if (p.length) { bad++; console.log(`FAIL ${f}\n   ${p.join("\n   ")}`); }
      } catch (e) { bad++; console.log(`FAIL ${f}: ${(e as Error).message}`); }
    }
    console.log(`${n} curated files, ${bad} invalid`);
    process.exit(bad ? 1 : 0);
  }
  const t0 = Date.now();
  if (cmd === "dossier") {
    // Everything an authoring agent may use for one lesson, as plain text. <key> = "<unitSlug>__<lessonSlug>" (or a unique substring).
    const key = lc(args[1]);
    const SL = path.resolve(here, "../../../../scratch/oak-slides");
    let rawFile = "";
    for (const prog of fs.readdirSync(RAW).sort()) { const dp = path.join(RAW, prog); if (!fs.statSync(dp).isDirectory()) continue; const f = fs.readdirSync(dp).find((x) => x.toLowerCase().includes(key)); if (f) { rawFile = path.join(dp, f); break; } }
    if (!rawFile) { console.error(`no raw lesson matches "${key}"`); process.exit(1); }
    const o = JSON.parse(fs.readFileSync(rawFile, "utf8")) as Record<string, unknown>;
    const f = factsFromRaw(o, cm);
    const name = `${String(o.subjectTitle).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${o.keyStageSlug}/${o.unitSlug}__${o.lessonSlug}`;
    const t = (v: unknown) => cm(String(v ?? "")).replace(/\s+/g, " ").trim();
    console.log(`KEY: ${o.unitSlug}__${o.lessonSlug}\nSUBJECT: ${o.subjectTitle}  KEY STAGE: ${o.keyStageSlug}  YEAR: ${o.year}\nUNIT: ${o.unitTitle}\nLESSON: ${o.lessonTitle}\nOUTCOME: ${f.outcome}`);
    console.log(`\nKEY LEARNING POINTS:\n${f.points.map((p) => `- ${p}`).join("\n")}`);
    console.log(`\nKEYWORDS:\n${f.keywords.map((k) => `- ${k.k}: ${k.d}`).join("\n")}`);
    console.log(`\nOUTLINE: ${f.outline.join(" | ")}`);
    const mis = (o.misconceptionsAndCommonMistakes as { misconception?: string; response?: string }[] | null) ?? [];
    console.log(`\nMISCONCEPTIONS (teacher-facing; do not show pupils as written):\n${mis.map((m) => `- ${t(m.misconception)} => ${t(m.response)}`).join("\n")}`);
    const qs = (label: string, arr: unknown) => {
      console.log(`\n${label} (Oak's own quiz; the answers are the truth for this lesson; do NOT reuse these questions in your slides):`);
      for (const q of (Array.isArray(arr) ? arr : []) as { questionType?: string; questionStem?: { type?: string; text?: string }[]; answers?: Record<string, { answer?: { text?: string }[]; answerIsCorrect?: boolean; correctChoice?: { text?: string }[]; matchOption?: { text?: string }[]; correctOrder?: number }[]> }[]) {
        const stem = (q.questionStem ?? []).map((p) => (p.type === "text" ? t(p.text) : "[image]")).join(" ");
        const a = q.answers ?? {};
        const ans = q.questionType === "multiple-choice" ? (a["multiple-choice"] ?? []).filter((x) => x.answerIsCorrect).map((x) => (x.answer ?? []).map((p) => t(p.text)).join(" ")).join(" / ")
          : q.questionType === "short-answer" ? (a["short-answer"] ?? []).map((x) => (x.answer ?? []).map((p) => t(p.text)).join(" ")).join(" / ")
          : q.questionType === "match" ? (a.match ?? []).map((x) => `${(x.matchOption ?? []).map((p) => t(p.text)).join(" ")} = ${(x.correctChoice ?? []).map((p) => t(p.text)).join(" ")}`).join("; ")
          : (a.order ?? []).sort((x, y) => (x.correctOrder ?? 0) - (y.correctOrder ?? 0)).map((x) => (x.answer ?? []).map((p) => t(p.text)).join(" ")).join(" -> ");
        console.log(`- [${q.questionType}] ${stem}  ==> ${ans}`);
      }
    };
    qs("STARTER QUIZ", o.starterQuiz); qs("EXIT QUIZ", o.exitQuiz);
    let rec: { presentation?: string; worksheet?: string } = {};
    try { rec = JSON.parse(fs.readFileSync(path.join(SL, name + ".json"), "utf8")); } catch { /* not crawled */ }
    const dedupe = (txt: string) => { const seen = new Set<string>(); return txt.split("\n").map((l) => l.trim()).filter((l) => { if (!l) return true; if (seen.has(l)) return false; seen.add(l); return true; }).join("\n").replace(/\n{3,}/g, "\n\n"); };
    console.log(`\nOAK SLIDE-DECK TEXT (raw Google Slides export, duplicates removed. Animation builds are merged, so questions, right answers AND WRONG distractor statements from multiple-choice slides are all mixed in: use it for the teaching sequence, worked examples and vocabulary, and only state something as fact if it is consistent with the key learning points / keywords / quiz answers above):\n${dedupe(rec.presentation ?? "(none)").slice(0, 16000)}`);
    console.log(`\nOAK WORKSHEET TEXT (tasks only; no answers):\n${dedupe(rec.worksheet ?? "(none)").slice(0, 5000)}`);
    const tr = ((o.transcriptSentences as string[] | null) ?? []).map(t).join(" ");
    console.log(`\nVIDEO TRANSCRIPT (teacher's narration, reliable for what is TRUE and for worked-example steps; ignore greetings/pause instructions):\n${tr.slice(0, 18000)}`);
    return;
  }
  if (cmd === "show") {
    const q = lc(args[1]);
    const all = [...rawLessons()];
    const pools = unitPools(all.filter((l) => l.lessonSlug.includes(q) || l.unitSlug.includes(q)));
    for (const l of all.filter((l) => l.lessonSlug.includes(q)).slice(0, Number(opt("--n") ?? 1))) {
      const r = deckFor(l.o, { cm, subject: l.subject, unitTitle: cm(l.unitTitle), lessonTitle: cm(l.lessonTitle), pool: (pools.get(`${l.subjectTitle}|${l.ks}|${l.unitSlug}`) ?? []).filter(() => true), seed: `${l.unitSlug}|${l.lessonSlug}`, unitSlug: l.unitSlug, lessonSlug: l.lessonSlug });
      console.log(`## ${l.subject} ${l.ks} Y${l.year} — ${l.unitTitle} — ${l.lessonTitle}  [${r.source}]  problems: ${r.problems.length ? r.problems.join(" / ") : "none"}`);
      console.log(readable(r.slides));
    }
    return;
  }
  if (cmd !== "check") { console.error("usage: cli.ts check|show|curated"); process.exit(1); }
  const limit = opt("--limit") ? Number(opt("--limit")) : Infinity;
  const inScopeLessons: Lesson[] = [];
  for (const l of rawLessons(inScope)) { inScopeLessons.push(l); if (inScopeLessons.length >= limit) break; }
  // pools must come from the whole unit even when --lesson filters: use every lesson of the touched units
  const units = new Set(inScopeLessons.map((l) => `${l.subjectTitle}|${l.ks}|${l.unitSlug}`));
  const poolLessons = opt("--lesson") ? [...rawLessons((o) => units.has(`${o.subjectTitle}|${o.keyStageSlug}|${o.unitSlug}`))] : inScopeLessons;
  const pools = unitPools(poolLessons);
  const by: Record<string, { lessons: number; decks: number; slides: number; noDeck: number; invalid: number; curated: number; hand: number; qs: number }> = {};
  const reasons: Record<string, number> = {};
  const problems: { lesson: string; problems: string[] }[] = [];
  const hist: Record<number, number> = {};
  const kinds: Record<string, number> = {};
  const out: Record<string, unknown> = {};
  for (const l of inScopeLessons) {
    const k = `${l.subject} ${l.ks}`;
    const s = (by[k] ??= { lessons: 0, decks: 0, slides: 0, noDeck: 0, invalid: 0, curated: 0, hand: 0, qs: 0 });
    s.lessons++;
    if (SLIDES_BY_LESSON[l.lessonSlug]) { s.hand++; s.decks++; continue; }
    const pool = pools.get(`${l.subjectTitle}|${l.ks}|${l.unitSlug}`) ?? [];
    const r = deckFor(l.o, { cm, subject: l.subject, unitTitle: cm(l.unitTitle), lessonTitle: cm(l.lessonTitle), pool, seed: `${l.unitSlug}|${l.lessonSlug}`, unitSlug: l.unitSlug, lessonSlug: l.lessonSlug });
    if (r.slides.length) {
      s.decks++; s.slides += r.slides.length; if (r.source === "curated") s.curated++;
      hist[r.slides.length] = (hist[r.slides.length] ?? 0) + 1;
      for (const sl of r.slides as { blocks: { t: string }[] }[]) for (const b of sl.blocks) kinds[b.t] = (kinds[b.t] ?? 0) + 1;
      if (opt("--json")) out[`${l.unitSlug}__${l.lessonSlug}`] = r.slides;
    } else if (r.problems.length && !/not enough source facts/.test(r.problems[0])) { s.invalid++; problems.push({ lesson: `${l.subject} ${l.ks} ${l.unitSlug}/${l.lessonSlug}`, problems: r.problems }); }
    else { s.noDeck++; reasons[r.problems[0] ?? "?"] = (reasons[r.problems[0] ?? "?"] ?? 0) + 1; }
  }
  const tot = Object.values(by).reduce((a, b) => ({ lessons: a.lessons + b.lessons, decks: a.decks + b.decks, slides: a.slides + b.slides, noDeck: a.noDeck + b.noDeck, invalid: a.invalid + b.invalid, curated: a.curated + b.curated, hand: a.hand + b.hand, qs: 0 }), { lessons: 0, decks: 0, slides: 0, noDeck: 0, invalid: 0, curated: 0, hand: 0, qs: 0 });
  for (const [k, v] of Object.entries(by).sort()) console.log(`${k.padEnd(22)} lessons ${String(v.lessons).padStart(5)}  decks ${String(v.decks).padStart(5)}  avg slides ${(v.slides / Math.max(1, v.decks - v.hand)).toFixed(1)}  no-deck ${v.noDeck}  INVALID ${v.invalid}  curated ${v.curated}`);
  console.log(`TOTAL lessons ${tot.lessons}  decks ${tot.decks}  invalid ${tot.invalid}  no-deck ${tot.noDeck}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  console.log(`slide-count histogram: ${Object.entries(hist).sort((a, b) => Number(a[0]) - Number(b[0])).map(([n, c]) => `${n}:${c}`).join(" ")}`);
  console.log(`block types: ${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  if (Object.keys(reasons).length) console.log(`no-deck reasons: ${JSON.stringify(reasons)}`);
  for (const p of problems.slice(0, 40)) console.log(`INVALID ${p.lesson}\n   ${p.problems.join("\n   ")}`);
  if (opt("--json")) fs.writeFileSync(opt("--json")!, JSON.stringify(out));
  process.exit(tot.invalid ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
