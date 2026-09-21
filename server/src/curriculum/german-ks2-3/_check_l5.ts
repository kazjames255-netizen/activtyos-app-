// Structural + heuristic checks for the German pack (run: cd server && npx tsx src/curriculum/german-ks2-3/_check_l5.ts).
// Language accuracy is verified by review; this catches mechanical slips: key not in options, duplicate options,
// diagnostics count, correct-option position/length bias, ss-for-ß and ae/oe/ue spellings, gender/article clashes and
// lowercase nouns in CORRECT text, verb-third after a time phrase, quiz sentences copied into the note, flashcard direction.
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { CTopic } from "../types";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const problems: string[] = [];
const warns: string[] = [];
const bad = (m: string) => problems.push(m);
const lc = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const flat = (s: string) => s.toLowerCase().replace(/[^a-zäöüß0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// Substitute spellings that must not appear in displayed German (allowed only in `accepted`).
const ASCII_SLIPS = /\b(fuer|ueber|schoen|gruen|fuenf|zwoelf|Buecher|Maedchen|Muetze|Tuer|Kaese|Fruehstueck|Haeuser|Saefte|Baeume|hoeren|woerter|Stuehle|Geschaeft|heisse|heissen|Strasse|Fuss|weiss|gross|grosse|Suessigkeiten|Praeteritum)\b/;
// Nouns (lowercase spelling) that must be capitalised if they follow an article/possessive in correct text.
const NOUNS = "hund|katze|bruder|schwester|mutter|vater|buch|heft|stift|tisch|stuhl|lehrer|lehrerin|kind|kinder|haus|auto|park|kino|stadt|dorf|bahnhof|schule|tasche|jacke|hose|rock|kleid|mantel|schal|mütze|kopf|arm|hand|bein|fuß|nase|apfel|käse|brot|wasser|milch|saft|tee|eis|kuchen|suppe|zimmer|hotel|flughafen|zug|bus|ball|lineal|tafel|klavier|gitarre|pferd|fisch|vogel|hase|maus|opa|oma|onkel|tante|freund|freundin|geburtstag|montag|mai|winter|sommer|wetter|sonne|verkehr|markt|museum|bibliothek|post|bank|kirche|schwimmbad|supermarkt|rechnung|speisekarte|fahrkarte|koffer|garten|baum|tür|fenster|handy|fahrrad|mädchen|zeitung|wohnung|blume|freundschaft|lieblingsfach|hausaufgaben|stundenplan|pause|stunde|lehrerin|computer|ernährung|schokolade|zucker|obst|gemüse|pool|film|eltern|geschwister|augen|haare|katzen|freunden|großeltern|cousin|cousine|tür";
const NOUN_LOWER = new RegExp(`\\b(der|die|das|den|dem|ein|eine|einen|einem|einer|kein|keine|keinen|mein|meine|meinen|meinem|meiner|dein|sein|seine|ihr|ihre|unser|zum|zur) (${NOUNS})\\b`);
// Gender clashes: masculine noun after eine/die/... or feminine after ein/der/... (correct text only).
const FEM = "katze|schwester|mutter|tante|oma|maus|schule|tasche|jacke|hose|tafel|gitarre|schildkröte|stadt|kirche|bank|post|bibliothek|suppe|milch|limonade|butter|banane|kartoffel|mütze|nase|hand|zeitung|wohnung|blume|freundschaft|pause|stunde|rechnung|speisekarte|fahrkarte|tür|ferienwohnung|jugendherberge|schwimmbad_";
const MASC = "hund|bruder|vater|onkel|opa|vogel|hase|stift|bleistift|tisch|stuhl|park|bahnhof|apfel|käse|saft|tee|kuchen|reis|zug|bus|ball|rock|pullover|mantel|schal|kopf|arm|koffer|garten|baum|flughafen|campingplatz|supermarkt|markt|computer|radiergummi|zucker|mai|montag|winter|freitag";
const NEUT = "kind|buch|heft|haus|auto|kino|dorf|kleid|bein|ei|brot|wasser|eis|pferd|zimmer|hotel|lineal|klavier|museum|fenster|handy|fahrrad|mädchen|obst|gemüse|klassenzimmer|rathaus|geschäft|meerschweinchen|schwimmbad";
const CLASH = [
  new RegExp(`\\b(ein|der|kein|mein|dein|sein|zum|dem_) (${FEM})\\b`, "i"),
  new RegExp(`\\b(eine|die|keine|meine|deine|seine|zur) (${MASC.replace("|freitag", "")})\\b`, "i"),
  new RegExp(`\\b(der|die|eine|einen|keine|keinen|meine|meinen) (${NEUT})\\b`, "i"),
];
// Never-correct German patterns.
const NEVER = [/\bich habe \w+ jahre\b/i, /\bich habe (elf|zwölf|dreizehn|vierzehn|fünfzehn|zehn|neun|acht|sieben) jahre alt\b/i, /\bhabe (nach|in) \w+ gefahren\b/i, /\bich bin gespielt\b/i, /\bvon dem\b.*\bzu dem\b_/, /\bzu der Bahnhof\b/i, /\bmit den zug\b/i, /\bweil ich bin\b/i, /\bdu arbeitst\b/i, /\bich fährst\b/i, /\bgebesucht\b/i, /\bwerde ich fliegen nach\b/i];
// Verb-third: a time phrase directly followed by the subject pronoun (verb should come between).
const VERB3 = /(^|[.!?] )(Am \w+|Im \w+|Zum \w+|Heute|Morgen|Gestern|Montags|Samstags|Letztes Jahr|Nächstes Jahr|Letzten Sommer|Um \w+ Uhr|Zu Hause|Oft|Manchmal) (ich|wir|er|sie|du|man|ihr|es) [a-zäöüß]+/;

const dropMistakes = (body: string) => body.split("## Common mistakes")[0];
const GERMAN_HINT = /[äöüß]|\b(ich|du|er|sie|wir|der|die|das|den|dem|ein|eine|einen|ist|sind|mein|meine|und|am|im|zum|zur|Wie|Wo|Was|Es|Ja|Das|Guten|Gute|Auf|Mit|Man|Hast|Wollen)\b/;

let topics = 0, qs = 0, cards = 0, notes = 0, written = 0, images = 0;
for (const f of readdirSync(HERE).filter((x) => x.endsWith(".ts") && !x.startsWith("_")).sort()) {
  const t: CTopic = (await import(pathToFileURL(path.join(HERE, f)).href)).TOPIC;
  topics++;
  if (t.subject !== "German") bad(`${t.key}: subject`);
  if (!t.key.startsWith("de")) bad(`${t.key}: key prefix`);
  for (const [yr, y] of Object.entries(t.years)) {
    if (!y) continue;
    notes++;
    const where = `${t.key} Y${yr}`;
    const diag = y.quiz.questions.filter((q) => q.diagnostic).length;
    if (diag !== 2) bad(`${where}: ${diag} diagnostics (need exactly 2)`);
    if (y.quiz.questions.length !== 10) bad(`${where}: ${y.quiz.questions.length} questions (want 10)`);
    if (y.quiz.questions.filter((q) => q.kind === "written").length > 1) bad(`${where}: >1 written`);
    if (Number(yr) < 7 && y.quiz.questions.some((q) => q.kind === "written")) bad(`${where}: written below Y7`);
    const single = y.quiz.questions.filter((q) => q.kind === "single");
    const positions = new Set(single.map((q) => q.options!.indexOf(q.answer as string)));
    if (positions.size < 3) bad(`${where}: correct answers in <3 positions`);
    const longest = single.filter((q) => { const L = q.options!.map((o) => o.length); return (q.answer as string).length === Math.max(...L) && L.filter((l) => l === Math.max(...L)).length === 1; }).length;
    if (longest > Math.ceil(single.length * 0.5)) bad(`${where}: correct option is the strictly longest in ${longest}/${single.length} single questions`);
    const d = [1, 2, 3].map((n) => y.quiz.questions.filter((q) => q.difficulty === n).length);
    if (d[0] < 2 || d[2] < 2) warns.push(`${where}: difficulty spread ${d.join("/")}`);

    const noteMain = dropMistakes(y.note.body);
    const noteFlat = flat(y.note.body);
    const correctDe: string[] = []; // German-bearing correct text
    for (const q of y.quiz.questions) {
      qs++;
      if (q.image) images++;
      if (q.kind === "single" || q.kind === "multi") {
        const opts = q.options!;
        const ans = Array.isArray(q.answer) ? q.answer : [q.answer as string];
        for (const a of ans) if (!opts.includes(a)) bad(`${q.key}: answer not among options: ${a}`);
        if (new Set(opts.map(lc)).size !== opts.length) bad(`${q.key}: duplicate options`);
        if (q.kind === "single" && ans.length !== 1) bad(`${q.key}: single needs one answer`);
        if (q.kind === "multi" && (ans.length < 2 || ans.length >= opts.length)) bad(`${q.key}: multi answer count`);
        correctDe.push(...ans);
      }
      if (q.kind === "short") {
        const a = q.answer as string;
        correctDe.push(a);
        for (const acc of q.accepted ?? []) if (lc(acc) === lc(a)) bad(`${q.key}: accepted duplicates answer`);
        if (a !== a.normalize("NFC")) bad(`${q.key}: answer not NFC`);
        if (/[.?!]$/.test(a)) bad(`${q.key}: short answer has end punctuation`);
      }
      if (q.kind === "written") written++;
      const shown = [q.prompt, ...(q.options ?? []), typeof q.answer === "string" ? q.answer : "", ...(Array.isArray(q.answer) ? q.answer : [])].join(" ⏎ ");
      if (ASCII_SLIPS.test(shown)) bad(`${q.key}: ascii-style spelling in shown text: ${shown.match(ASCII_SLIPS)![0]}`);
      if (ASCII_SLIPS.test(q.explanation)) bad(`${q.key}: ascii-style spelling in explanation`);
      // quoted German in the prompt is treated as correct German
      for (const m of q.prompt.matchAll(/'([^']{8,})'/g)) correctDe.push(m[1]);
      // a quiz sentence (≥4 words) must not sit verbatim in the note
      const cand = [...(Array.isArray(q.answer) ? q.answer : [String(q.answer)]), ...[...q.prompt.matchAll(/'([^']{8,})'/g)].map((m) => m[1])].filter((s) => s.trim().split(/\s+/).length >= 4 && GERMAN_HINT.test(s) && !/\b(the|you|are|is|do|get)\b/i.test(s));
      for (const c of cand) if (noteFlat.includes(flat(c))) bad(`${q.key}: sentence "${c}" appears verbatim in the note`);
    }
    for (const c of y.flashcards) correctDe.push(c.front, c.back);
    const corpus = [...correctDe, noteMain];
    for (const text of corpus) {
      for (const re of CLASH) { const m = text.match(re); if (m) bad(`${where}: gender/article clash "${m[0]}"`); }
      for (const re of NEVER) { const m = text.match(re); if (m) bad(`${where}: impossible German "${m[0]}"`); }
      const m1 = text.match(NOUN_LOWER); if (m1) bad(`${where}: lowercase noun "${m1[0]}"`);
      for (const line of text.split(/\n/)) { const m2 = line.match(VERB3); if (m2) bad(`${where}: verb-third "${m2[0]}"`); }
    }
    if (ASCII_SLIPS.test(noteMain + " " + y.flashcards.map((c) => c.front + " " + c.back).join(" "))) bad(`${where}: ascii-style spelling in note/flashcards: ${(noteMain + y.flashcards.map((c) => c.front + " " + c.back).join(" ")).match(ASCII_SLIPS)![0]}`);
    // note structure
    if (!/^\|.*\|\s*$/m.test(y.note.body) || !/\| ---/.test(y.note.body)) bad(`${where}: note has no vocabulary table`);
    if (!/(sound|pronunc)/i.test(y.note.body)) bad(`${where}: note has no pronunciation tip`);
    if (!/Common mistakes/i.test(y.note.body)) bad(`${where}: note has no common-mistakes section`);
    if ((y.note.body.match(/^- .*\./gm) ?? []).length < 3) bad(`${where}: fewer than 3 model sentences/bullets`);
    // flashcards: both directions, no empties
    cards += y.flashcards.length;
    if (y.flashcards.some((c) => lc(c.front) === lc(c.back))) bad(`${where}: flashcard front = back`);
    const deFront = y.flashcards.filter((c) => GERMAN_HINT.test(c.front)).length;
    const deBack = y.flashcards.filter((c) => GERMAN_HINT.test(c.back)).length;
    if (deFront < 1 || deBack < 1) warns.push(`${where}: flashcard directions look one-sided (German front ${deFront}, German back ${deBack})`);
  }
}
console.log(`${topics} topics · ${notes} topic-years · ${qs} questions (${written} written, ${images} images) · ${cards} flashcards · ${problems.length} problem(s), ${warns.length} warning(s)`);
for (const w of warns) console.log(" ~ " + w);
for (const p of problems) console.error(" ✗ " + p);
process.exit(problems.length ? 1 : 0);
