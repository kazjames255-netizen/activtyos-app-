// Structural checks for the German KS4-5 pack (run: cd server && npx tsx src/curriculum/german-ks4-5/_check_l6.ts).
// German accuracy itself is verified by native-level review; this catches mechanical slips: key not among options,
// duplicate / case-only-different options, "systematically longest" correct option, ASCII umlaut spellings, lowercase
// nouns, verb-second after subordinators, obvious article/gender clashes in CORRECT text, note leaks, counts.
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { CTopic } from "../types";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const problems: string[] = [];
const bad = (m: string) => problems.push(m);
const lc = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const wc = (s: string) => s.replace(/[|]/g, " ").replace(/\s-{3,}\s/g, " ").trim().split(/\s+/).filter(Boolean).length;
const dropErrors = (body: string) => body.split("## Common errors")[0];

// ASCII spellings of German words that must carry an umlaut/ß in the CORRECT text (unless the answer list accepts them).
const ASCII = /\b(fuer|ueber|koennen|koennte|moechte|muessen|muesste|Maedchen|schoen|gehoert|zurueck|Buecher|Uebung|waehrend|waere|haette|wuerde|Grosse|Strasse|heisst|weiss|gross|grosse|Fuesse|natuerlich|Gruesse|Grüsse)\b/;
// Common German nouns that must be capitalised (unambiguous vs. English words).
const NOUNS = ["schule", "haus", "freund", "freundin", "stadt", "zeit", "geld", "mutter", "vater", "schwester", "bruder", "wetter", "umwelt", "arbeit", "beruf", "zukunft", "lehrer", "schüler", "familie", "regierung", "gesellschaft", "sprache", "universität", "ausbildung", "praktikum", "handy", "unterricht", "prüfung", "bahnhof", "museum", "theater", "konzert", "zeitung", "fernsehen", "kultur", "erinnerung", "geschichte", "wahl", "partei", "schlagzeile", "werbung", "handlung", "erzähler", "autor", "text", "stuhl", "tisch", "mann", "frau", "kinder", "menschen", "leute", "jugendliche", "abitur", "stundenplan", "zeugnis", "note", "fach", "pause", "internet", "weihnachten", "ostern", "silvester", "karneval"];
const NOUN_RE = NOUNS.map((n) => new RegExp(`(?<![A-Za-zÀ-ÿ'-])${n}(?![A-Za-zÀ-ÿ])`));
// A German clause introduced by these, followed by pronoun + finite verb straight away, is verb-second (wrong).
const V2_AFTER_SUB = /\b(weil|dass|obwohl|wenn|damit|sodass|falls|nachdem|bevor|indem|während) (ich|er|sie|wir|du|man|es) (habe|hat|bin|ist|kann|muss|will|soll|darf|gehe|geht|fahre|fährt|mag|sind|haben|können|müssen|wollen|sollen)\b/i;
// article / gender clash in correct German text (nominative-style).
const MASC = "Bahnhof|Supermarkt|Park|Lebenslauf|Stundenplan|Anteil|Regisseur|Wandel|Bundestag|Bundesrat|Erzähler|Autor|Wendepunkt|Höhepunkt|Schauplatz|Schnitt|Bildschirm|Beruf|Weihnachtsmarkt|Umzug|Klimawandel|Müll|Brauch|Sender|Vergleich|Stuhl|Tisch";
const FEM = "Ausbildung|Wahl|Koalition|Werbung|Handlung|Fassade|Metapher|Ironie|Unterkunft|Sehenswürdigkeit|Jugendherberge|Umwelt|Armut|Innenstadt|Umgebung|Falschmeldung|Schlagzeile|Zusammenfassung|Gleichberechtigung|Vereinbarkeit|Note|Klassenarbeit|Bewerbung|Stelle|Renovierung|Verringerung|Entscheidung|Möglichkeit|Entwicklung|Schwierigkeit";
const CLASH = [new RegExp(`\\b(die|eine|diese) (${MASC})\\b`), new RegExp(`\\b(ein|das|dieses|kein) (${FEM})\\b`)];

let topics = 0, qs = 0, cards = 0, notes = 0, written = 0, images = 0;
const seenKeys = new Set<string>();
for (const f of readdirSync(HERE).filter((x) => x.endsWith(".ts") && !x.startsWith("_")).sort()) {
  const t: CTopic = (await import(pathToFileURL(path.join(HERE, f)).href)).TOPIC;
  topics++;
  if (t.subject !== "German") bad(`${t.key}: subject must be German`);
  if (!t.key.startsWith("de")) bad(`${t.key}: key must start with de`);
  const wantYears = ["deide", "deloc", "dework", "degram4"].includes(t.key) ? [10, 11] : [12, 13];
  if (Object.keys(t.years).map(Number).join() !== wantYears.join()) bad(`${t.key}: years should be ${wantYears}`);
  for (const [yr, y] of Object.entries(t.years)) {
    if (!y) continue;
    notes++;
    const where = `${t.key} Y${yr}`;
    const nw = wc(y.note.body);
    if (nw < 200 || nw > 350) bad(`${where}: note has ${nw} words (need 200–350)`);
    if (!/## Common errors/i.test(y.note.body)) bad(`${where}: note lacks a Common errors section`);
    if (!/\|/.test(y.note.body)) bad(`${where}: note lacks a table`);
    if ((y.note.body.match(/\*[^*\n]{12,}\*/g) ?? []).length < 3) bad(`${where}: fewer than 3 example sentences (italic or bold)`);
    const qsY = y.quiz.questions;
    if (qsY.length < 12 || qsY.length > 14) bad(`${where}: ${qsY.length} questions (need 12–14)`);
    const diff = [1, 2, 3].map((n) => qsY.filter((q) => q.difficulty === n).length);
    if (diff[0] < 2 || diff[0] > 3 || diff[2] < 3) bad(`${where}: difficulty spread ${diff.join("/")} off the 2:5:3 shape`);
    if (qsY.filter((q) => q.diagnostic).length !== 2) bad(`${where}: need exactly 2 diagnostics`);
    if (qsY.filter((q) => q.diagnostic).some((q) => q.difficulty !== 2)) bad(`${where}: diagnostics should be difficulty 2`);
    const wr = qsY.filter((q) => q.kind === "written");
    written += wr.length;
    if (wr.length > 1) bad(`${where}: more than one written`);
    for (const q of wr) if (!/Marking guide/.test(q.explanation)) bad(`${q.key}: written lacks a marking guide`);
    const single = qsY.filter((q) => q.kind === "single");
    const pos = new Set(single.map((q) => q.options!.indexOf(q.answer as string)));
    if (pos.size < 3) bad(`${where}: correct single answers sit in <3 positions`);
    const longest = single.filter((q) => { const a = (q.answer as string).length; return q.options!.every((o) => o === q.answer || o.length < a); }).length;
    if (single.length && longest / single.length > 0.5) bad(`${where}: correct option is the strictly longest in ${longest}/${single.length} singles`);
    const german: string[] = [];
    for (const q of qsY) {
      qs++;
      if (seenKeys.has(q.key)) bad(`${q.key}: duplicate key across pack`);
      seenKeys.add(q.key);
      if (q.image) images++;
      const txt = [q.prompt, ...(q.options ?? []), typeof q.answer === "string" ? q.answer : Array.isArray(q.answer) ? q.answer.join(" ") : ""];
      if (q.kind === "single" || q.kind === "multi") {
        const opts = q.options!;
        const ans = Array.isArray(q.answer) ? q.answer : [q.answer as string];
        for (const a of ans) if (!opts.includes(a)) bad(`${q.key}: answer not among options: ${a}`);
        if (new Set(opts.map(lc)).size !== opts.length) bad(`${q.key}: duplicate options (case-insensitive)`);
        if (q.kind === "single" && ans.length !== 1) bad(`${q.key}: single needs one answer`);
        if (q.kind === "multi" && (ans.length < 2 || ans.length >= opts.length)) bad(`${q.key}: multi answer count`);
        german.push(...ans);
      }
      if (q.kind === "short") {
        const a = q.answer as string;
        german.push(a);
        for (const acc of q.accepted ?? []) if (acc === a) bad(`${q.key}: accepted duplicates answer`);
        if (/[.!?]$/.test(a)) bad(`${q.key}: short answer ends in punctuation (the marker does not strip it)`);
        if (a !== a.normalize("NFC")) bad(`${q.key}: answer not NFC`);
      }
      const prompted = q.prompt.replace(/\n\n«[\s\S]*»/, (m) => { const w = wc(m); if (w > 122) bad(`${q.key}: passage has ${w} words (>120)`); return m; });
      void prompted;
      const shown = txt.join(" ⏎ ");
      if (ASCII.test(shown) && !/\bae\b|without umlaut/i.test(q.prompt)) bad(`${q.key}: ASCII umlaut spelling "${shown.match(ASCII)![0]}" in prompt/options/answer`);
      // German-bearing text for gender / order checks = the correct text only
      german.push(q.prompt);
      // no answer leaks in prompt for single: correct option text appearing verbatim in the prompt
      if (q.kind === "single" && q.options!.length && (q.answer as string).length > 12 && q.prompt.includes(q.answer as string)) bad(`${q.key}: correct option appears verbatim in the prompt`);
    }
    const main = dropErrors(y.note.body);
    german.push(main);
    for (const c of y.flashcards) german.push(c.front, c.back);
    const all = german.join("\n");
    for (let i = 0; i < NOUN_RE.length; i++) if (NOUN_RE[i].test(all.replace(/«[\s\S]*?»/g, (m) => m))) {
      // ignore English-sentence matches: only flag when the lowercase noun sits inside German text lines (crudely: preceded by a German article)
      const m = all.match(new RegExp(`\\b(der|die|das|ein|eine|einen|einem|einer|dem|den|des|mein|meine|meinen|meiner|meinem|zum|zur|im|am) ${NOUNS[i]}\\b`));
      if (m) bad(`${where}: lowercase noun "${m[0]}"`);
    }
    for (const rawLine of all.split("\n")) {
      const line = rawLine;
      const m1 = line.match(V2_AFTER_SUB); if (m1) bad(`${where}: verb-second after a subordinator: "${m1[0]}"`);
      for (const re of CLASH) { const m = line.match(re); if (m) bad(`${where}: gender/article clash "${m[0]}"`); }
      const ascii = line.match(ASCII); if (ascii && !/accept|ae\b/i.test(line)) bad(`${where}: ASCII umlaut form "${ascii[0]}" in note/cards/prompts`);
    }
    // Note leak: a bold model sentence from the note must not appear verbatim in a quiz item.
    for (const m of main.matchAll(/\*\*(.{18,}?)\*\*/g)) {
      const s = m[1].replace(/[.]$/, "");
      for (const q of qsY) if ([q.prompt, ...(q.options ?? []), typeof q.answer === "string" ? q.answer : ""].some((x) => x.includes(s))) bad(`${where}: note model sentence reused in ${q.key}`);
    }
    cards += y.flashcards.length;
    if (y.flashcards.length < 8 || y.flashcards.length > 12) bad(`${where}: flashcards ${y.flashcards.length}`);
    if (y.flashcards.some((c) => lc(c.front) === lc(c.back))) bad(`${where}: flashcard front = back`);
    // both directions: at least 2 cards whose FRONT is English-led (no German marker) and at least 2 German-led.
    const germanish = (s: string) => /[äöüß]|\b(der|die|das|ich|wir|sie|er|wenn|zu|im|mit|und|ist|sich|es|Ich|Der|Die|Das|Wenn|Man|Er|Sie|Das)\b/.test(s) || /^[a-zäöüß-]+$/.test(s) && !/^(the|a|to|and|of)$/.test(s);
    const de = y.flashcards.filter((c) => germanish(c.front)).length;
    if (de < 2 || y.flashcards.length - de < 1) bad(`${where}: flashcards not both directions (German-led fronts ${de}/${y.flashcards.length})`);
    const kinds = new Set(qsY.map((q) => q.kind));
    if (!kinds.has("single") || !kinds.has("short")) bad(`${where}: needs single and short questions`);
  }
}
console.log(`${topics} topics · ${notes} notes · ${qs} questions · ${cards} flashcards · ${written} written · ${images} images`);
if (problems.length) { for (const p of problems) console.error("✗", p); console.error(`${problems.length} problem(s)`); process.exit(1); }
console.log("_check_l6: 0 problems");
