// Recomputes the computable answer keys of the english-ks1 pack. Run: cd server && npx tsx src/curriculum/english-ks1/_check_e1.ts
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { CQuestion, CTopic } from "../types";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const bad: string[] = [];
const fail = (k: string, m: string) => bad.push(`${k}: ${m}`);
const V = /[aeiou]/;

// ---- spelling-rule engines (regular words only) ----
const plural = (w: string) => (/(s|x|z|sh|ch)$/.test(w) ? w + "es" : w + "s");
function addSuffix(w: string, suf: string): string {
  if (suf === "ing" || suf === "ed" || suf === "er" || suf === "est") {
    if (/[^aeiou]y$/.test(w) && suf !== "ing") return w.slice(0, -1) + "i" + suf;      // cry → cried
    if (w.endsWith("e")) return w.slice(0, -1) + suf;                                  // make → making
    if (/^[^aeiou]*[aeiou][^aeiouwxy]$/.test(w)) return w + w.slice(-1) + suf;         // hop → hopping (1 syllable, short vowel + 1 consonant)
    return w + suf;
  }
  return w + suf; // -ly, -ful, -less, un- handled by caller
}
const undouble = (w: string, suf: string) => { const b = w.slice(0, -suf.length); return b.length > 2 && b.at(-1) === b.at(-2) ? b.slice(0, -1) : b; };

// short-answer keys recomputed from (base, rule)
const SHORT: Record<string, string> = {
  "phon-y2-03": addSuffix("jump", "ing"),
  "spell-y1-03": plural("dog"),
  "spell-y1-05": plural("dish"),
  "spell-y1-06": addSuffix("walk", "ing"),
  "spell-y1-07": addSuffix("help", "ed"),
  "spell-y2-06": addSuffix("hop", "ing"),
  "vocab-y1-07": "un" + "kind",
  "vocab-y2-07": "quick" + "ly",
};
// single-answer keys recomputed from the rules
const SINGLE: Record<string, string> = {
  "spell-y1-04": plural("box"),
  "spell-y1-09": plural("bus"),
  "spell-y2-07": addSuffix("cry", "ed"),
  "spell-y2-08": addSuffix("make", "ing"),
  "phon-y2-10": undouble("hopping", "ing"),
};

// grapheme questions: key → { re: regex the ANSWER must match; NONE of the distractors may match }
const G: Record<string, RegExp> = {
  "phon-y1-01": /ai/, "phon-y1-02": /ee/, "phon-y1-03": /igh/, "phon-y1-04": /oa/, "phon-y1-05": /ar/, "phon-y1-06": /oi/, "phon-y1-10": /ur/,
  "phon-y2-01": /a.e$/, "phon-y2-02": /o.e$/, "phon-y2-07": /^c[iey]/, "phon-y2-08": /^g[eiy]/,
};
// 'ai' etc must be a real vowel-team, split digraphs must be genuinely split (vowel, consonant, final e)
const NOTSPLIT_IN_OPTIONS = ["gain", "hoop"]; // distractors purposely NOT split

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

async function main() {
  let n = 0;
  const files = readdirSync(HERE).filter((f) => f.endsWith(".ts") && !f.startsWith("_"));
  for (const f of files) {
    const t: CTopic = (await import(pathToFileURL(path.join(HERE, f)).href)).TOPIC;
    for (const y of Object.values(t.years)) {
      if (!y) continue;
      if (y.year > 2) fail(t.key, `year ${y.year} out of KS1 scope`);
      const qs: CQuestion[] = y.quiz.questions;
      for (const q of qs) {
        n++;
        // generic
        if (q.kind === "written" || q.kind === "number" || q.kind === "multi") fail(q.key, `kind ${q.kind} not used at KS1`);
        if (q.prompt.split("\n").length > 4) fail(q.key, "prompt too long for KS1");
        if (q.kind === "single") {
          const opts = q.options!;
          if (!opts.includes(String(q.answer))) fail(q.key, "answer not among options");
          if (opts.filter((o) => o === q.answer).length !== 1) fail(q.key, "answer duplicated");
          if (SINGLE[q.key] !== undefined && SINGLE[q.key] !== q.answer) fail(q.key, `recomputed "${SINGLE[q.key]}" ≠ key "${q.answer}"`);
          if (G[q.key]) {
            const re = G[q.key];
            if (!re.test(String(q.answer))) fail(q.key, `answer "${q.answer}" lacks grapheme ${re}`);
            for (const o of opts) if (o !== q.answer && re.test(o)) fail(q.key, `distractor "${o}" also matches ${re}`);
          }
        }
        if (q.kind === "short") {
          const a = String(q.answer);
          if (a !== a.toLowerCase() && !/^[A-Z]/.test(a)) fail(q.key, "short answer casing odd");
          if (SHORT[q.key] !== undefined && SHORT[q.key] !== a) fail(q.key, `recomputed "${SHORT[q.key]}" ≠ key "${a}"`);
          // typed answer must appear nowhere in its own prompt
          if (!q.key.startsWith("rc-") && new RegExp(`\\b${a}\\b`, "i").test(q.prompt)) fail(q.key, "answer leaked in prompt");
        }
        // an option/answer must never be a mis-spelt day: any day-like word in a single question must be the correct one only for the key
        if (q.key === "spell-y1-01" && q.answer !== "Tuesday") fail(q.key, "Tuesday key");
        if (q.key === "spell-y1-02" && q.answer !== "Wednesday") fail(q.key, "Wednesday key");
        if (q.key === "spell-y1-01" || q.key === "spell-y1-02") if (!DAYS.includes(String(q.answer))) fail(q.key, "answer is not a real day spelling");
      }
      // distractor-only misspellings must not accidentally be real days
      const wdq = qs.filter((q) => q.key === "spell-y1-01" || q.key === "spell-y1-02");
      for (const q of wdq) for (const o of q.options!) if (o !== q.answer && DAYS.includes(o)) fail(q.key, `distractor ${o} is a real day`);
      // exactly the shape the brief wants
      if (qs.length !== 10) fail(t.key, `Y${y.year}: ${qs.length} questions`);
      if (qs.filter((q) => q.diagnostic).length !== 2) fail(t.key, `Y${y.year}: need exactly 2 diagnostic`);
      const d = [1, 2, 3].map((k) => qs.filter((q) => q.difficulty === k).length).join("/");
      if (d !== "3/5/2") fail(t.key, `Y${y.year}: difficulty spread ${d} (want 3/5/2)`);
      if (y.flashcards.length < 8 || y.flashcards.length > 12) fail(t.key, `Y${y.year}: flashcards`);
      // sanity: answer position spread
      const pos = new Set(qs.filter((q) => q.kind === "single").map((q) => q.options!.indexOf(String(q.answer))));
      if (pos.size < 3) fail(t.key, `Y${y.year}: answer positions ${[...pos]}`);
    }
  }
  // engine self-tests (so a broken rule can't silently bless a wrong key)
  const eq = (a: string, b: string, m: string) => { if (a !== b) fail("selftest", `${m}: ${a} ≠ ${b}`); };
  eq(plural("box"), "boxes", "box"); eq(plural("cat"), "cats", "cat"); eq(addSuffix("hop", "ing"), "hopping", "hop");
  eq(addSuffix("jump", "ed"), "jumped", "jump"); eq(addSuffix("cry", "ed"), "cried", "cry"); eq(addSuffix("make", "ing"), "making", "make");
  eq(addSuffix("play", "ed"), "played", "play"); eq(addSuffix("walk", "ing"), "walking", "walk");
  void V; void NOTSPLIT_IN_OPTIONS;
  console.log(`${n} questions checked · ${bad.length} problem(s)`);
  for (const b of bad) console.error("✗ " + b);
  process.exit(bad.length ? 1 : 0);
}
main();
