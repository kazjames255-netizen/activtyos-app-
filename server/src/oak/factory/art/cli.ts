// Picture-library tooling (no Firestore, no network).
//   cd server
//   npx tsx src/oak/factory/art/cli.ts check                 library self-checks + policy unit tests (exit 1 on any failure)
//   npx tsx src/oak/factory/art/cli.ts doc [out.md]          verification tables (Oak definitions for every concept, allow-list evidence) -> docs/hub-review/F1-images.md tables
//   npx tsx src/oak/factory/art/cli.ts sheet [regex] [dark]  HTML contact sheet of the library (/tmp/f1/sheet.html)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PICS } from "./library";
import { EMOJI } from "./allowlist";
import { PIC_CSS } from "./style";
import { chooseArt, norm } from "./select";
import { EXT_LANG_TESTS } from "./ext-languages-tests"; // X5
import { runExtEnglishChecks } from "./ext-english-tests";
import { runExtMathsPrimaryTests } from "./ext-maths-primary-tests"; // X1
import { runExtMathsSecondaryTests } from "./ext-maths-secondary-tests"; // X2
import { runExtScienceTests } from "./ext-science-tests"; // X3
import type { Slide } from "../../../../../features/learninghub/lesson/slides/types";

const here = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.resolve(here, "../../../../../scratch/oak-raw");
const cmd = process.argv[2];

// ── self-checks ─────────────────────────────────────────────────────────────
function selfCheck(): string[] {
  const bad: string[] = [];
  const ids = new Set<string>();
  for (const p of PICS) {
    if (!/^[a-z0-9-]{1,60}$/.test(p.id)) bad.push(`${p.id}: bad id`);
    if (ids.has(p.id)) bad.push(`${p.id}: duplicate id`); ids.add(p.id);
    for (const f of ["title", "alt", "caption", "evidence", "doesNotShow"] as const) if (!String(p[f] ?? "").trim()) bad.push(`${p.id}: empty ${f}`);
    if (p.alt.length < 30) bad.push(`${p.id}: alt text too short`);
    if (!p.concepts.length || p.concepts.some((c) => !norm(c))) bad.push(`${p.id}: bad concepts`);
    if (!p.subjects.length) bad.push(`${p.id}: no subjects`);
    if (!/^<svg [^>]*viewBox="0 0 \d+ \d+"/.test(p.svg) || !p.svg.endsWith("</svg>")) bad.push(`${p.id}: not a well-formed svg root`);
    if (/undefined|NaN|Infinity/.test(p.svg)) bad.push(`${p.id}: svg contains undefined/NaN`);
    if (/<script|on\w+=|javascript:/i.test(p.svg)) bad.push(`${p.id}: svg contains script`);
    const tags = p.svg.match(/<(\w+)[\s>]/g)?.length ?? 0; if (tags < 3) bad.push(`${p.id}: svg nearly empty`);
    if (p.covers) for (const c of p.covers) if (!PICS.some((o) => o.family === p.family && o.concepts.includes(c))) bad.push(`${p.id}: covers "${c}" which no family member names`);
  }
  // a concept phrase must belong to ONE picture per subject (otherwise the choice between pictures would be a guess)
  const owner = new Map<string, string>();
  // (X2: key-stage aware: two pictures may share a phrase only when their `keyStages` scopes do not overlap, e.g. a KS1-2 and a KS3-4 diagram of the same word)
  for (const p of PICS) for (const s of p.subjects) for (const c of p.concepts) for (const ks of p.keyStages?.length ? p.keyStages : ["ks1", "ks2", "ks3", "ks4"]) { const k = `${s}|${ks}|${norm(c)}`; const o = owner.get(k); if (o && o !== p.id) bad.push(`concept "${c}" (${s} ${ks}) claimed by ${o} and ${p.id}`); owner.set(k, p.id); }
  const seen = new Map<string, string>();
  for (const e of EMOJI) {
    if (!e.emoji || !e.name) bad.push(`emoji entry without emoji/name: ${JSON.stringify(e).slice(0, 40)}`);
    for (const s of e.subjects) for (const w of [...e.words, ...(e.fr ?? []), ...(e.es ?? []), ...(e.de ?? [])]) { const k = `${s}|${norm(w)}`; const o = seen.get(k); if (o && o !== e.emoji) bad.push(`emoji word "${w}" (${s}) claimed by ${o} and ${e.emoji}`); seen.set(k, e.emoji); }
  }
  return bad;
}

// ── policy unit tests: (slide, context) -> exact expected pictures ─────────────
type T = { name: string; slide: Pick<Slide, "kind" | "title" | "blocks">; subject: string; lessonTitle?: string; expect: string[]; emoji?: string[] };
const lead = (text: string) => ({ t: "lead" as const, text });
const list = (...items: string[]) => ({ t: "list" as const, items });
const define = (...it: [string, string][]) => ({ t: "define" as const, items: it.map(([term, def]) => ({ term, def })) });
const S = (kind: Slide["kind"], title: string, ...blocks: Slide["blocks"]): T["slide"] => ({ kind, title, blocks });
const TESTS: T[] = [
  { name: "the owner's example: sphere key-word slide gets a sphere", subject: "Maths", slide: S("intro", "Key words", define(["sphere", "A sphere is a 3D shape where every point on its surface is equidistant from the centre."])), expect: ["sphere"] },
  { name: "the owner's example: the sphere PRACTICE slide gets NO picture (it would give the answer)", subject: "Maths", slide: S("practice", "Key word practice", { t: "choice", q: "Which key word matches this meaning? A … is a 3D shape where every point on its surface is equidistant from the centre", options: ["sphere", "cone", "cube"], answer: 0 }), expect: [] },
  { name: "check slide with a cloze gets nothing", subject: "Maths", slide: S("check", "Quick check", { t: "choice", q: "A _____ has one curved surface", options: ["sphere", "cone"], answer: 0 }), expect: [] },
  { name: "cone is never drawn as a cylinder", subject: "Maths", slide: S("explain", "The volume of a cone", lead("The volume of a cone is one third of the volume of the cylinder with the same base and height.")), expect: ["cone", "cylinder"] },
  { name: "hemisphere is not a sphere", subject: "Maths", slide: S("explain", "The volume of a hemisphere", lead("A hemisphere is half of a sphere.")), expect: ["hemisphere"] },
  { name: "cube number is not a cube", subject: "Maths", slide: S("explain", "Cube numbers", lead("A cube number is the product of a number multiplied by itself three times.")), expect: [] },
  { name: "cube root is not a cube", subject: "Maths", slide: S("explain", "Cube roots", lead("The cube root of 27 is 3.")), expect: [] },
  { name: "square numbers are not squares", subject: "Maths", slide: S("explain", "Square numbers", lead("Square numbers are 1, 4, 9, 16.")), expect: [] },
  { name: "squares and cubes together: neither picture", subject: "Maths", slide: S("explain", "Squares and cubes", lead("Knowledge of squares, cubes, multiples and factors can be used to solve problems.")), expect: [] },
  { name: "non right-angled triangles do not get a right-angled triangle", subject: "Maths", slide: S("explain", "Non right-angled triangles", lead("Problems involving non right-angled triangles need the sine rule.")), expect: [] },
  { name: "a square-based pyramid is not a square", subject: "Maths", slide: S("explain", "Square-based pyramids", lead("A square-based pyramid has a square base.")), expect: ["square-based-pyramid"] },
  { name: "numeric pictures are refused when the slide has numbers", subject: "Maths", slide: S("explain", "Numerators and denominators", lead("In 3/5 the numerator is 3 and the denominator is 5.")), expect: [] },
  { name: "numerator with no numbers is fine", subject: "Maths", slide: S("explain", "Numerator and denominator", lead("The numerator tells us how many parts we have; the denominator tells us how many equal parts make the whole.")), expect: ["numerator-denominator"] },
  { name: "a title in quotation marks is not a concept", subject: "English", slide: S("explain", "Reading ‘Small Island’", lead("The play ‘Small Island’ follows migrants from Jamaica.")), expect: [], emoji: [] },
  { name: "sound lesson: no transverse wave", subject: "Science", lessonTitle: "Sound waves", slide: S("intro", "Key words", define(["wavelength", "The distance between the same point on two neighbouring waves."])), expect: [] },
  { name: "longitudinal lesson: longitudinal wave, not transverse", subject: "Science", lessonTitle: "Representing longitudinal waves", slide: S("intro", "Key words", define(["longitudinal wave", "A wave in which the vibrations are parallel to the direction of travel."])), expect: ["longitudinal-wave"] },
  { name: "Maths reflection is not light", subject: "Science", slide: S("explain", "Reflection", lead("Reflection is the change in direction of a wave at a boundary.")), expect: [] },
  { name: "polysemous 'cell' (nerve cell) does not get a circuit (X3: it gets the neurone diagram)", subject: "Science", slide: S("explain", "Nerve cells", lead("Nerve cells transmit electrical impulses around the body.")), expect: ["x3-neurone"] },
  { name: "fitness circuit is not an electrical circuit", subject: "Science", slide: S("intro", "Key words", define(["fitness circuit", "A series of exercises done one after another."])), expect: [] },
  { name: "Earth's structure lesson does not get states of matter", subject: "Science", slide: S("explain", "Models of Earth's structure", lead("In the centre of Earth is a solid metallic core surrounded by a liquid outer core.")), expect: [] },
  { name: "states of matter (KS1) gets the particle picture", subject: "Science", slide: S("explain", "Solids, liquids and gases", lead("Materials can be solids, liquids or gases.")), expect: ["states-of-matter"] },
  { name: "sperm/egg cell does not get an egg emoji (X3: it gets the sperm and egg cell diagram)", subject: "Science", slide: S("intro", "Egg cells", lead("The egg cell is the female sex cell.")), expect: ["x3-sperm-egg"], emoji: [] },
  { name: "a spelling bee is not a bee", subject: "German", slide: S("intro", "A spelling bee", lead("Knowing the alphabet lets you take part in a spelling bee.")), expect: [], emoji: [] },
  { name: "evolutionary tree is not a tree", subject: "Science", slide: S("explain", "Evolutionary trees", lead("Evolutionary trees show how species are related.")), expect: [], emoji: [] },
  { name: "literal noun: teeth", subject: "Science", slide: S("intro", "Keeping teeth healthy", lead("I can describe how to look after my teeth.")), expect: [], emoji: ["🦷"] },
  { name: "French flag only when France is named in the title/lead", subject: "French", lessonTitle: "School in France", slide: S("intro", "Today’s learning", lead("I can talk about school in France.")), expect: ["flag-france"] },
  { name: "French flag never for the plain word French (X5: the slide now gets the perfect-tense structure picture, never a flag)", subject: "French", slide: S("explain", "Using the perfect tense", lead("Many French verbs form the perfect tense with avoir.")), expect: ["fr-perfect"] },
  { name: "no flag when another country is named (Spain and Cuba)", subject: "Spanish", lessonTitle: "Christmas in Spain and Cuba", slide: S("intro", "Learning about Christmas in Spain and Cuba", lead("I can talk about Christmas in Spain and Cuba.")), expect: [] },
  { name: "word families is not a family emoji", subject: "German", lessonTitle: "Word families", slide: S("intro", "Developing awareness of word families", lead("Use your knowledge to understand word families and unfamiliar words.")), expect: [], emoji: [] },
  { name: "flag not used on a history slide", subject: "German", slide: S("intro", "Germany after the war", lead("After the war Germany was divided into zones.")), expect: [] },
  { name: "story mountain for the arc lesson", subject: "English", lessonTitle: "Planning a story mountain", slide: S("explain", "The story mountain", lead("A story mountain shows the rising action, the climax and the resolution of a narrative.")), expect: ["story-mountain"] },
  { name: "clock: telling the time is refused (the clock shows one fixed time)", subject: "Maths", slide: S("explain", "The hour hand", lead("The hour hand shows half past the hour when it is halfway between two numbers on the analogue clock.")), expect: [] },
  { name: "area only for the plain idea of area", subject: "Maths", slide: S("explain", "Area", lead("Area is the amount of space inside a shape. It is measured in square units, counting the squares that cover the shape.")), expect: ["area"] },
  { name: "area of a circle gets a circle, not the unit-square area picture", subject: "Maths", slide: S("explain", "Area of a circle", lead("The area of a circle uses the radius.")), expect: ["circle"] },
];

function runTests(): string[] {
  const bad: string[] = [];
  for (const t of [...TESTS, ...EXT_LANG_TESTS]) {
    const got = chooseArt(t.slide, { subject: t.subject, lessonTitle: t.lessonTitle ?? "" });
    const okPics = got.pics.length === t.expect.length && t.expect.every((x) => got.pics.includes(x));
    if (!okPics) bad.push(`TEST "${t.name}": expected pictures [${t.expect}] got [${got.pics}] (${got.notes.slice(0, 3).join("; ")})`);
    if (t.emoji && (got.emoji.length !== t.emoji.length || !t.emoji.every((x) => got.emoji.includes(x)))) bad.push(`TEST "${t.name}": expected emoji [${t.emoji}] got [${got.emoji}]`);
  }
  return bad;
}

// ── Oak evidence ────────────────────────────────────────────────────────────
type Kw = { k: string; d: string; lesson: string; subject: string };
function oakKeywords(): { kws: Kw[]; titles: string[] } {
  const kws: Kw[] = [], titles: string[] = [];
  for (const prog of fs.readdirSync(RAW).sort()) {
    const dp = path.join(RAW, prog); if (!fs.statSync(dp).isDirectory()) continue;
    for (const f of fs.readdirSync(dp).filter((x) => x.endsWith(".json"))) {
      let o: Record<string, unknown>; try { o = JSON.parse(fs.readFileSync(path.join(dp, f), "utf8")); } catch { continue; }
      const lesson = String(o.lessonTitle ?? ""); titles.push(`${o.subjectTitle}|${lesson}`);
      for (const k of (o.lessonKeywords as { keyword?: string; description?: string }[] | null) ?? []) kws.push({ k: String(k.keyword ?? ""), d: String(k.description ?? ""), lesson, subject: String(o.subjectTitle) });
    }
  }
  return { kws, titles };
}
const clip = (s: string, n = 150) => (s.length > n ? `${s.slice(0, n - 1)}…` : s).replace(/\|/g, "/").replace(/\s+/g, " ");
function docTables(): string {
  const { kws, titles } = oakKeywords();
  const out: string[] = [];
  out.push("| Picture id | Concepts (exact) | Subjects | Oak evidence (keyword definition found in scratch/oak-raw) | Drawing verification | Does NOT show |", "| --- | --- | --- | --- | --- | --- |");
  for (const p of PICS) {
    const ev: string[] = [];
    for (const c of p.concepts) {
      const grp = (x: string) => (/^(biology|chemistry|physics|combined science|science)$/i.test(x) ? "Science" : x);
      const hit = kws.find((k) => norm(k.k) === norm(c) && k.d.trim() && (p.subjects as string[]).includes(grp(k.subject))); // the definition must come from a subject the picture is allowed in
      if (hit) { ev.push(`**${c}**: “${clip(hit.d, 110)}” (${clip(hit.lesson, 40)})`); if (ev.length >= 2) break; }
    }
    if (!ev.length) { const t = titles.filter((x) => norm(x).includes(norm(p.concepts[0]))).length; ev.push(t ? `no Oak keyword with this exact name; the phrase “${p.concepts[0]}” is in ${t} Oak lesson titles/keyword lists` : "curriculum knowledge (see verification)"); }
    out.push(`| \`${p.id}\` | ${p.concepts.map((c) => `\`${c}\``).join(", ")} | ${p.subjects.join(", ")} | ${ev.join("<br>")} | ${clip(p.evidence, 420)}${p.requires ? ` Requires one of: ${p.requires.slice(0, 5).join(", ")}.` : ""}${p.numeric ? " Numeric: refused when the slide has numbers." : ""} | ${clip(p.doesNotShow, 160)} |`);
  }
  out.push("", "### Literal-emoji allow-list", "", "| Emoji | Unicode name | Exact words (English) | Other languages | Subjects | Oak / curriculum check |", "| --- | --- | --- | --- | --- | --- |");
  for (const e of EMOJI) {
    const n = kws.filter((k) => e.words.some((w) => norm(k.k) === norm(w))).length;
    const t = titles.filter((x) => e.words.some((w) => new RegExp(`\\b${norm(w)}s?\\b`).test(norm(x)))).length;
    out.push(`| ${e.emoji} | ${e.name} | ${e.words.map((w) => `\`${w}\``).join(", ") || "(none: foreign words only)"} | ${[e.fr && `fr: ${e.fr.join("/")}`, e.es && `es: ${e.es.join("/")}`, e.de && `de: ${e.de.join("/")}`].filter(Boolean).join("; ") || "-"} | ${e.subjects.join(", ")} | concrete noun; Unicode name matches the word${e.note ? `; ${e.note}` : ""}. Oak keyword lists with this word: ${n}; lesson titles: ${t}. |`);
  }
  return out.join("\n");
}

async function main() {
  if (cmd === "check") {
    const x4 = runExtEnglishChecks();
    const x1 = runExtMathsPrimaryTests();
    const x2 = runExtMathsSecondaryTests(); // X2
    const x3 = runExtScienceTests(); // X3
    const bad = [...selfCheck(), ...runTests(), ...x4.problems, ...x1.problems, ...x2.problems, ...x3.problems];
    console.log(`${PICS.length} pictures, ${EMOJI.length} emoji entries, ${TESTS.length + EXT_LANG_TESTS.length} policy tests + ${x4.n} X4 English tests + ${x1.tests} X1 Maths primary tests + ${x2.tests} X2 Maths KS3-4 tests + ${x3.tests} X3 Science tests, ${bad.length} problems`);
    for (const b of bad) console.log("FAIL", b);
    process.exit(bad.length ? 1 : 0);
  }
  if (cmd === "doc") { const t = docTables(); const o = process.argv[3]; if (o) fs.writeFileSync(o, t); else console.log(t); return; }
  if (cmd === "sheet") {
    const only = process.argv[3] ? new RegExp(process.argv[3]) : null; const dark = process.argv[4] === "dark";
    const html = `<html><head><style>:root{--ink:${dark ? "#f2f4f8" : "#171534"};--ink-2:${dark ? "#aeb3c2" : "#4a4763"};--ink-3:#8a86a3;--surface:${dark ? "#181a21" : "#fff"};--brand-2:#2f6bd8;--green:#15b364;--gold:#f5b81f;--red:#e21d27;--violet:#6a4fd0}body{background:${dark ? "#0f1115" : "#f5f8fd"};font-family:system-ui;margin:10px;display:flex;flex-wrap:wrap;gap:10px}.c{width:230px;background:var(--surface);border:1px solid #8884;border-radius:12px;padding:8px;color:var(--ink)}.c small{display:block;font-size:11px;opacity:.7}${PIC_CSS}</style></head><body>${PICS.filter((p) => !only || only.test(p.id)).map((p) => `<div class="c">${p.svg}<small>${p.id}</small></div>`).join("")}</body></html>`;
    fs.mkdirSync("/tmp/f1", { recursive: true }); fs.writeFileSync("/tmp/f1/sheet.html", html); console.log("wrote /tmp/f1/sheet.html", PICS.length);
    return;
  }
  console.error("usage: art/cli.ts check|doc [out.md]|sheet [regex] [dark]"); process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
