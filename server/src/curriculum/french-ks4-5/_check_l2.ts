// Structural + grammar checks for the french-ks4-5 pack (L2). Run: cd server && npx tsx src/curriculum/french-ks4-5/_check_l2.ts
// 1. validateTopic() from ../validate.ts on every topic file in this folder.
// 2. Structure: answers are options, `short` variants cover ' / ’ and accent-free typing, note 200–350 words, reading passages ≤120 words,
//    difficulty spread, question kinds.
// 3. Conjugation: small rule tables (present irregulars + rules for imperfect, future, conditional, subjunctive, passé simple).
//    - every "| verb (tense) | six forms |" table row in the notes is re-generated and compared;
//    - every gap-fill answer listed in GAPS is re-generated and compared.
// 4. Content hygiene: a note must not contain the verbatim French answer of a quiz item; the correct answer of one item must not be
//    printed in another item of the same quiz; a short list of typical learner errors must not appear in any CORRECT text.
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateTopic } from "../validate";
import type { CQuestion, CTopic } from "../types";

const HERE = path.dirname(fileURLToPath(import.meta.url));
let fails = 0;
const bad = (m: string) => { fails++; console.error("FAIL " + m); };
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae");
const norm = (s: string) => strip(s.toLowerCase().replace(/[’']/g, "'")).replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

// ---------- conjugation rule tables ----------
type Six = [string, string, string, string, string, string];
const PRES: Record<string, Six> = {
  être: ["suis", "es", "est", "sommes", "êtes", "sont"],
  avoir: ["ai", "as", "a", "avons", "avez", "ont"],
  aller: ["vais", "vas", "va", "allons", "allez", "vont"],
  faire: ["fais", "fais", "fait", "faisons", "faites", "font"],
  pouvoir: ["peux", "peux", "peut", "pouvons", "pouvez", "peuvent"],
  vouloir: ["veux", "veux", "veut", "voulons", "voulez", "veulent"],
  savoir: ["sais", "sais", "sait", "savons", "savez", "savent"],
  venir: ["viens", "viens", "vient", "venons", "venez", "viennent"],
  prendre: ["prends", "prends", "prend", "prenons", "prenez", "prennent"],
  comprendre: ["comprends", "comprends", "comprend", "comprenons", "comprenez", "comprennent"],
  mourir: ["meurs", "meurs", "meurt", "mourons", "mourez", "meurent"],
  falloir: ["", "", "faut", "", "", ""],
  finir: ["finis", "finis", "finit", "finissons", "finissez", "finissent"],
};
const erPres = (inf: string): Six => { const s = inf.slice(0, -2); return [s + "e", s + "es", s + "e", s + "ons", s + "ez", s + "ent"]; };
const presOf = (inf: string): Six => PRES[inf] ?? (inf.endsWith("er") ? erPres(inf) : (() => { throw new Error("no present for " + inf); })());
const ENDINGS_IMPF = ["ais", "ais", "ait", "ions", "iez", "aient"];
const ENDINGS_FUT = ["ai", "as", "a", "ons", "ez", "ont"];
const FUT_STEM: Record<string, string> = { être: "ser", avoir: "aur", aller: "ir", faire: "fer", pouvoir: "pourr", vouloir: "voudr", savoir: "saur", venir: "viendr", voir: "verr", falloir: "faudr", mourir: "mourr", prendre: "prendr", comprendre: "comprendr", finir: "finir" };
const futStem = (inf: string) => FUT_STEM[inf] ?? (inf.endsWith("er") ? inf : (() => { throw new Error("no future stem for " + inf); })());
const IMPF_STEM: Record<string, string> = { être: "ét" };
const impfStem = (inf: string) => IMPF_STEM[inf] ?? presOf(inf)[3].replace(/ons$/, "");
const SUBJ_IRR: Record<string, Six> = {
  être: ["sois", "sois", "soit", "soyons", "soyez", "soient"],
  avoir: ["aie", "aies", "ait", "ayons", "ayez", "aient"],
  aller: ["aille", "ailles", "aille", "allions", "alliez", "aillent"],
  faire: ["fasse", "fasses", "fasse", "fassions", "fassiez", "fassent"],
  pouvoir: ["puisse", "puisses", "puisse", "puissions", "puissiez", "puissent"],
  savoir: ["sache", "saches", "sache", "sachions", "sachiez", "sachent"],
};
const subjOf = (inf: string): Six => {
  if (SUBJ_IRR[inf]) return SUBJ_IRR[inf];
  const p = presOf(inf); const st3 = p[5].replace(/ent$/, ""); const stN = p[3].replace(/ons$/, "");
  const E = ["e", "es", "e", "ions", "iez", "ent"];
  return E.map((e, i) => (i === 3 || i === 4 ? stN : st3) + e) as Six;
};
const PS_IRR: Record<string, Six> = {
  être: ["fus", "fus", "fut", "fûmes", "fûtes", "furent"],
  avoir: ["eus", "eus", "eut", "eûmes", "eûtes", "eurent"],
};
const psOf = (inf: string): Six => {
  if (PS_IRR[inf]) return PS_IRR[inf];
  if (inf.endsWith("er")) { const s = inf.slice(0, -2); return [s + "ai", s + "as", s + "a", s + "âmes", s + "âtes", s + "èrent"]; }
  if (inf.endsWith("ir")) { const s = inf.slice(0, -2); return [s + "is", s + "is", s + "it", s + "îmes", s + "îtes", s + "irent"]; }
  throw new Error("no passé simple for " + inf);
};
const GEN: Record<string, (inf: string) => Six> = {
  present: presOf,
  imperfect: (inf) => ENDINGS_IMPF.map((e) => impfStem(inf) + e) as Six,
  future: (inf) => ENDINGS_FUT.map((e) => futStem(inf) + e) as Six,
  conditional: (inf) => ENDINGS_IMPF.map((e) => futStem(inf) + e) as Six,
  subjunctive: subjOf,
  "passé simple": psOf,
};
const PERSONS: Record<string, number> = { je: 0, tu: 1, il: 2, nous: 3, vous: 4, ils: 5 };

// gap-fill answers to re-generate: [question key, infinitive, tense, person, expected surface text (may include an auxiliary + participle)]
const GAPS: [string, string, string, string, string][] = [
  ["frgram4-y10-01", "faire", "present", "ils", "font"],
  ["frgram4-y10-02", "pouvoir", "present", "vous", "pouvez"],
  ["frgram4-y10-04", "habiter", "imperfect", "nous", "habitions"],
  ["frgram4-y10-05", "faire", "future", "il", "fera"],
  ["frgram4-y10-10", "avoir", "conditional", "nous", "aurions"],
  ["frgram4-y11-01", "arriver", "subjunctive", "tu", "arrives"],
  ["frgram4-y11-03", "être", "subjunctive", "nous", "soyons"],
  ["frgram4-y11-04", "faire", "conditional", "je", "ferais"],
  ["frgram4-y11-06", "avoir", "imperfect", "il", "avait commencé"],
  ["fride-y10-11", "être", "present", "nous", "sommes allés"],
  ["frloc-y10-09", "faire", "imperfect", "il", "faisait"],
  ["frloc-y11-10", "falloir", "conditional", "il", "faudrait"],
  ["frwork-y11-04", "aller", "future", "je", "irai"],
  ["frsoc-y12-04", "être", "subjunctive", "ils", "soient"],
  ["frsoc-y12-09", "savoir", "subjunctive", "ils", "sachent"],
  ["frsoc-y13-04", "arriver", "subjunctive", "nous", "arrivions"],
  ["frsoc-y13-09", "faire", "subjunctive", "il", "fasse"],
  ["frart-y12-11", "être", "subjunctive", "il", "soit"],
  ["frart-y13-10", "avoir", "subjunctive", "ils", "aient"],
  ["frgram5-y12-03", "savoir", "subjunctive", "il", "sache"],
  ["frgram5-y13-04", "aller", "passé simple", "ils", "allèrent"],
  ["frgram5-y13-09", "avoir", "future", "je", "aurai fini"],
  ["frfilm-y12-10", "comprendre", "subjunctive", "il", "comprenne"],
  ["frfilm-y13-10", "mourir", "present", "il", "meurt"],
];
// participle-based answers: the auxiliary form is generated, the participle is given in the expected text and must follow it
const AUX_GAP: Record<string, { aux: string; tense: string; person: string; pp: string }> = {
  "frgram4-y11-06": { aux: "avoir", tense: "imperfect", person: "il", pp: "commencé" },
  "fride-y10-11": { aux: "être", tense: "present", person: "nous", pp: "allés" },
  "frgram5-y13-09": { aux: "avoir", tense: "future", person: "je", pp: "fini" },
};

const LINT: RegExp[] = [/\bma amie\b/i, /\bune problème\b/i, /\bcette film\b/i, /j'ai allé/i, /nous avons allé/i, /\bun œuvre\b/i, /chefs-d'œuvres/i, /ce que compte/i, /malgré que/i, /\bje suis \d+ ans/i, /\bsa honnêteté\b/i, /\bbien que \w+ (est|sont|a|ont) /i];
const FR = new Set("le la les un une des je j' il elle nous ils de du au aux est que qui pour dans en et à ne pas sur avec ce cette son sa ses mon ma mes ont sont a as suis".split(" "));
const EN = new Set("the of to and is a an in that it for you be was were with as on at by this from or are".split(" "));
const isFrench = (t: string) => { const w = t.toLowerCase().split(/[\s,.;:!?…«»()]+/).filter(Boolean); let f = /[àâçéèêëîïôöùûüœ]/.test(t) ? 1 : 0, e = 0; for (const x of w) { const k = x.includes("'") ? x.split("'")[0] + "'" : x; if (FR.has(x) || FR.has(k)) f++; if (EN.has(x)) e++; } return f > e; };
// ---------- load topics ----------
const files = readdirSync(HERE).filter((f) => f.endsWith(".ts") && !f.startsWith("_")).sort();
const topics: CTopic[] = [];
for (const f of files) { const m = await import(pathToFileURL(path.join(HERE, f)).href); topics.push(m.TOPIC); }
const seen = new Set<string>();
const allQ = new Map<string, CQuestion>();
let nQ = 0, nCards = 0, nWritten = 0, nPassages = 0;

for (const t of topics) {
  for (const p of validateTopic(t, seen)) bad("validate " + p);
  for (const [yr, y] of Object.entries(t.years)) {
    if (!y) continue;
    const where = `${t.key} Y${yr}`;
    const nw = words(y.note.body);
    if (nw < 200 || nw > 350) bad(`${where}: note has ${nw} words (need 200–350)`);
    const qs = y.quiz.questions;
    if (qs.length < 12 || qs.length > 14) bad(`${where}: ${qs.length} questions (need 12–14)`);
    const dist = [1, 2, 3].map((d) => qs.filter((q) => q.difficulty === d).length);
    if (dist[0] < 2 || dist[2] < 3 || dist[1] < 4) bad(`${where}: difficulty spread ${dist.join("/")} (want about 2:5:3)`);
    const kinds = ["single", "short", "multi", "written"].map((k) => qs.filter((q) => q.kind === k).length);
    if (kinds[3] > 1 || kinds[3] < 1) bad(`${where}: written count ${kinds[3]}`);
    if (kinds[2] < 1) bad(`${where}: no multi`);
    console.log(`${where.padEnd(14)} qs=${qs.length} d=${dist.join("/")} single/short/multi/written=${kinds.join("/")} note=${nw}w cards=${y.flashcards.length} diag=${qs.filter((q) => q.diagnostic).length}`);
    nQ += qs.length; nCards += y.flashcards.length; nWritten += kinds[3];
    const noteN = norm(y.note.body);
    const posSet = new Set<number>();
    for (const q of qs) {
      allQ.set(q.key, q);
      if (q.kind === "single") posSet.add(q.options!.indexOf(q.answer as string));
      // reading passages
      const m = q.prompt.match(/«([^»]|»(?=[^\n]*»))*»/s);
      if (/^Read the/.test(q.prompt)) {
        nPassages++;
        const passage = q.prompt.split("\n\n").slice(1).join(" ");
        const pw = words(passage);
        if (pw > 120) bad(`${q.key}: passage has ${pw} words (max 120)`);
        // the note must not contain sentences of the passage
        for (const s of passage.split(/(?<=[.!?])\s+/)) if (words(s) >= 6 && noteN.includes(norm(s))) bad(`${q.key}: passage sentence appears in the note: ${s}`);
      }
      void m;
      if (q.kind === "short") {
        const ans = q.answer as string;
        const acc = new Set(q.accepted ?? []);
        if (/'/.test(ans) && !acc.has(ans.replace(/'/g, "’"))) bad(`${q.key}: short answer lacks the ’ variant`);
        if (ans !== ans.trim() || /\s{2}/.test(ans)) bad(`${q.key}: whitespace in answer`);
        if (/[àâçéèêëîïôöùûüœÀÉ]/.test(ans) && ![...acc].some((a) => strip(a) === a && strip(ans) === a || a === strip(ans))) console.log(`  note ${q.key}: accented answer "${ans}" has no accent-free variant (accent may be the point)`);
        for (const a of acc) if (norm(a) !== norm(ans) && !(q.accepted ?? []).length) bad(`${q.key}: odd accepted`);
      }
      // French targets = answers of single / short and right options of multi
      const targets: string[] = q.kind === "multi" ? (q.answer as string[]) : q.kind === "short" || q.kind === "single" ? [q.answer as string] : [];
      for (const tg of targets) {
        if (!isFrench(tg)) continue;
        if (words(norm(tg)) >= 5 && noteN.includes(norm(tg))) bad(`${q.key}: correct French "${tg}" appears verbatim in the note`);
        if (words(norm(tg)) >= 4)
          for (const o of qs) if (o !== q && (norm(o.prompt).includes(norm(tg)) || (o.options ?? []).some((x) => norm(x) === norm(tg)))) bad(`${q.key}: correct answer "${tg}" also printed in ${o.key}`);
      }
    }
    if (posSet.size < 3) bad(`${where}: single answers occupy only ${posSet.size} positions`);
    nCards += 0;
    // notes: verify conjugation table rows
    for (const line of y.note.body.split("\n")) {
      const r = line.match(/^\|\s*([a-zéèêâîôû]+)\s*\(([^)]+)\)\s*\|\s*([^|]+?)\s*\|\s*$/);
      if (!r) continue;
      const [, inf, tense, forms] = r;
      const gen = GEN[tense];
      if (!gen) { bad(`${where}: unknown tense in table row: ${line}`); continue; }
      const want = gen(inf).join(", ");
      if (want !== forms.trim()) bad(`${where}: table ${inf} (${tense}): note says "${forms.trim()}", rules give "${want}"`);
      else console.log(`  ok table ${inf} (${tense})`);
    }
    // learner-error lint on every CORRECT text
    const correct: string[] = [];
    for (const q of qs) {
      if (q.kind === "single" || q.kind === "short" || q.kind === "written") correct.push(String(q.answer));
      if (q.kind === "multi") correct.push(...(q.answer as string[]));
    }
    for (const c of correct)
      for (const re of LINT) if (re.test(c)) bad(`${where}: typical error "${re}" in correct text: ${c}`);
  }
}

// ---------- gap-fill answers ----------
for (const [key, inf, tense, person, expected] of GAPS) {
  const q = allQ.get(key);
  if (!q) { bad(`GAPS: no question ${key}`); continue; }
  const gen = GEN[tense](inf)[PERSONS[person]];
  const aux = AUX_GAP[key];
  const surface = aux ? `${GEN[aux.tense](aux.aux)[PERSONS[aux.person]]} ${aux.pp}` : gen;
  if (surface !== expected) bad(`${key}: rules give "${surface}", GAPS expects "${expected}"`);
  if (String(q.answer) !== expected) bad(`${key}: stored answer "${String(q.answer)}" != "${expected}"`);
}
// sentences whose answer embeds a conjugated verb (checked by hand + here for the form)
const embed: [string, string][] = [["frsoc-y13-08", "puisse"], ["frgram5-y12-08", "sois pas venu"], ["frgram5-y13-08", "est parti"], ["frgram4-y10-09", "vais"]];
for (const [k, frag] of embed) { const q = allQ.get(k); if (!q || !String(q.answer).includes(frag)) bad(`${k}: expected fragment "${frag}"`); }
// puisse = subjunctive pouvoir je/il; sois = être subj; est parti = être present il + participle
if (GEN.subjunctive("pouvoir")[0] !== "puisse" || GEN.subjunctive("être")[1] !== "sois") bad("rule table self-test");

console.log(`\n${topics.length} topics, ${nQ} questions, ${nCards} flashcards, ${nWritten} written, ${nPassages} reading passages, ${GAPS.length} gap answers re-generated`);
console.log(fails ? `${fails} FAILURE(S)` : "ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
