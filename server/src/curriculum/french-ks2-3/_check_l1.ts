// Structural checks for the French pack (run: cd server && npx tsx src/curriculum/french-ks2-3/_check_l1.ts).
// Language accuracy is verified by review; this catches mechanical slips: key not in options, duplicate options,
// unaccented spellings of common accented words, obvious article/gender clashes in CORRECT text, position spread.
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { CTopic } from "../types";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const problems: string[] = [];
const bad = (m: string) => problems.push(m);
const lc = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

// Words that must carry an accent when written in French (unaccented spelling is a slip). Word-boundary match.
const NEEDS_ACCENT = ["ecole", "francais", "frere", "pere", "musee", "matiere", "preferee", "sante", "legumes", "gateau", "gateaux", "telephone", "tele", "eleve", "equilibre", "reserver", "desole", "deja", "tres", "etais", "etait", "ete", "arrivee", "allee", "parti(e)", "voila", "cote", "apres", "meme", "peche", "verite", "histoire?"].filter((w) => /^[a-z]+$/.test(w));
const NEEDS_RE = NEEDS_ACCENT.map((w) => new RegExp(`(?<![A-Za-zÀ-ÿ])${w}(?![A-Za-zÀ-ÿ])`, "i"));
// Gender clashes: masculine noun after une / feminine noun after un (checked in correct answers + notes minus 'Common mistakes').
const FEM = "règle|gomme|trousse|cantine|piscine|banque|poste|gare|pomme|banane|limonade|glace|tortue|robe|jupe|tante|sœur|mère|chambre|plage|salade|carotte|table|fille|voiture|maison|veste|ville|école|matière|guitare|natation|danse|main|tête|jambe|bouche|oreille";
const MASC = "stylo|crayon|cahier|livre|chat|chien|lapin|poisson|cheval|oiseau|pull|manteau|pantalon|parc|cinéma|gâteau|vélo|frère|père|oncle|château|gîte|hôtel|camping|avion|train|village|bureau|sac|cartable|musée|garçon|nez|bras|pied|fromage|pain|lait|poulet|jus";
const CLASH = [new RegExp(`\\b(un|le|mon|ton|son|ce) (${FEM})\\b`, "i"), new RegExp(`\\b(une|la|ma|ta|sa|cette) (${MASC})\\b`, "i")];
// Never-correct French patterns.
const NEVER = [/\bje ai\b/i, /\bje aime\b/i, /\bde le\b/i, /\bà le\b/i, /\bà les\b/i, /\bde les\b/i, /\ble eau\b/i, /\bla eau\b/i, /\bj'ai allé\b/i, /\bil est douze ans\b/i];

const dropMistakes = (body: string) => body.split("## Common mistakes")[0];

let topics = 0, qs = 0, cards = 0, notes = 0, written = 0;
for (const f of readdirSync(HERE).filter((x) => x.endsWith(".ts") && !x.startsWith("_")).sort()) {
  const t: CTopic = (await import(pathToFileURL(path.join(HERE, f)).href)).TOPIC;
  topics++;
  if (t.subject !== "French") bad(`${t.key}: subject`);
  if (!t.key.startsWith("fr")) bad(`${t.key}: key prefix`);
  for (const [yr, y] of Object.entries(t.years)) {
    if (!y) continue;
    notes++;
    const where = `${t.key} Y${yr}`;
    const fr: string[] = []; // French-bearing correct text
    const diag = y.quiz.questions.filter((q) => q.diagnostic).length;
    if (diag !== 2) bad(`${where}: ${diag} diagnostics (need exactly 2)`);
    const single = y.quiz.questions.filter((q) => q.kind === "single");
    const positions = new Set(single.map((q) => q.options!.indexOf(q.answer as string)));
    if (positions.size < 3) bad(`${where}: correct answers in <3 positions`);
    for (const q of y.quiz.questions) {
      qs++;
      if (q.kind === "written") written++;
      if (q.kind === "single" || q.kind === "multi") {
        const opts = q.options!;
        const ans = Array.isArray(q.answer) ? q.answer : [q.answer as string];
        for (const a of ans) if (!opts.includes(a)) bad(`${q.key}: answer not among options: ${a}`);
        if (new Set(opts.map(lc)).size !== opts.length) bad(`${q.key}: duplicate options`);
        if (q.kind === "single" && ans.length !== 1) bad(`${q.key}: single needs one answer`);
        if (q.kind === "multi" && (ans.length < 2 || ans.length >= opts.length)) bad(`${q.key}: multi answer count`);
        fr.push(...ans);
        if (!q.prompt.includes("___") && false) bad(q.key);
      }
      if (q.kind === "short") {
        const a = q.answer as string;
        fr.push(a);
        for (const acc of q.accepted ?? []) if (lc(acc) === lc(a)) bad(`${q.key}: accepted duplicates answer`);
        // accented answers: the exact answer must keep its accent (accepted may strip it)
        if (/[a-z]/i.test(a) && a !== a.normalize("NFC")) bad(`${q.key}: answer not NFC`);
        if (/[\?\!\.]$/.test(a)) bad(`${q.key}: short answer has end punctuation (marker doesn't strip it)`);
      }
      // text-wide accent slips anywhere a child would read French (prompt, options, answer)
      const shown = [q.prompt, ...(q.options ?? []), typeof q.answer === "string" ? q.answer : ""].join(" ⏎ ");
      for (let i = 0; i < NEEDS_RE.length; i++) if (NEEDS_RE[i].test(shown) && !/write .* without accent/i.test(q.prompt)) bad(`${q.key}: unaccented "${NEEDS_ACCENT[i]}" in prompt/options/answer`);
    }
    const noteMain = dropMistakes(y.note.body);
    fr.push(noteMain);
    for (const c of y.flashcards) fr.push(c.front, c.back);
    for (const text of fr) {
      for (const re of CLASH) { const m = text.match(re); if (m) bad(`${where}: gender/article clash "${m[0]}"`); }
      for (const re of NEVER) { const m = text.match(re); if (m) bad(`${where}: impossible French "${m[0]}"`); }
    }
    for (let i = 0; i < NEEDS_RE.length; i++) if (NEEDS_RE[i].test(y.note.body + " " + y.flashcards.map((c) => c.front + " " + c.back).join(" "))) bad(`${where}: unaccented "${NEEDS_ACCENT[i]}" in note/flashcards`);
    cards += y.flashcards.length;
    if (y.flashcards.some((c) => lc(c.front) === lc(c.back))) bad(`${where}: flashcard front = back`);
    if (!/pronunc|sound|silent|say it|sounds like/i.test(y.note.body)) bad(`${where}: note has no pronunciation tip`);
    if (!/Common mistakes/i.test(y.note.body)) bad(`${where}: note has no common-mistakes section`);
    if ((y.note.body.match(/^- .*\./gm) ?? []).length < 3) bad(`${where}: fewer than 3 model sentences/bullets`);
  }
}
console.log(`${topics} topics · ${notes} topic-years · ${qs} questions (${written} written) · ${cards} flashcards · ${problems.length} problem(s)`);
for (const p of problems) console.error(" ✗ " + p);
process.exit(problems.length ? 1 : 0);
