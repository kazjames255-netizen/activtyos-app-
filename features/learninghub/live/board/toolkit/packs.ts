import { ENGLISH } from "./english";
import { GENERAL } from "./general";
import { GEOGRAPHY } from "./geography";
import { HISTORY } from "./history";
import { LANGUAGES } from "./languages";
import { MATHS } from "./maths";
import { SCIENCE } from "./science";
import type { Level, PackId, ToolItem } from "./kit";

// The toolkit registry. Config-driven: a pack is a list of items (templates, stamps, backgrounds);
// nothing is tied to a subject NAME — tutors type their own — a pack is just chosen (or guessed from
// the topic's subject by keyword) and any combination can be browsed.

export interface Pack { id: PackId; label: string; blurb: string; items: ToolItem[]; groups?: string[] }
export const PACKS: Pack[] = [
  { id: "general", label: "General", blurb: "Venn, mind map, flowchart, tables, KWL, timer, stickers", items: GENERAL },
  { id: "maths", label: "Maths", blurb: "Number lines, fractions, graphs, geometry, statistics, nets", items: MATHS },
  { id: "english", label: "English", blurb: "Handwriting, phonics, word tiles, story & essay frames, annotate a text", items: ENGLISH },
  { id: "languages", label: "Languages", blurb: "Conjugation, vocabulary, dialogues, accents, character grids", items: LANGUAGES },
  { id: "geography", label: "Geography", blurb: "Outline maps, grid references, climate graphs, cycles, frames", items: GEOGRAPHY },
  { id: "history", label: "History", blurb: "Timelines, source analysis, cause chains, significance, family trees", items: HISTORY },
  { id: "science", label: "Science", blurb: "Biology, Chemistry (periodic table, atoms), Physics (circuits, rays, waves)", items: SCIENCE, groups: ["Biology", "Chemistry", "Physics", "Frames"] },
];
export const packById = (id: PackId) => PACKS.find((p) => p.id === id);

const RULES: [RegExp, PackId][] = [
  [/math|arithmetic|algebra|geometry|number|statistic|numeracy|calcul/i, "maths"],
  [/english|literacy|reading|writing|phonic|spelling|grammar|comprehension|literature|drama/i, "english"],
  [/french|spanish|german|italian|mandarin|chinese|japanese|latin|arabic|portuguese|urdu|russian|polish|language|mfl|esol|eal/i, "languages"],
  [/geograph|earth|climate|map/i, "geography"],
  [/histor|civics|politic|religio/i, "history"],
  [/scien|biolog|chem|physic|nature|electric/i, "science"],
];
/** Guess a pack from a subject the tutor typed. */
export function packFromSubject(subject: string | null | undefined): PackId {
  const s = (subject ?? "").trim();
  for (const [re, id] of RULES) if (re.test(s)) return id;
  return "general";
}

/** Style from year groups ("Reception", "Year 4"…): Early = Reception–Y6, Standard = Y7–9, Advanced = Y10–13. Mixed → the oldest. */
export function levelFromYears(years: (string | null | undefined)[]): Level | null {
  const nums = years.map((y) => { const s = (y ?? "").toLowerCase(); if (/reception|nursery|foundation/.test(s)) return 0; const m = s.match(/(\d{1,2})/); return m ? Number(m[1]) : null; }).filter((n): n is number => n != null);
  if (!nums.length) return null;
  const top = Math.max(...nums);
  return top <= 6 ? "early" : top <= 9 ? "standard" : "advanced";
}

export function searchItems(items: ToolItem[], q: string) {
  const t = q.trim().toLowerCase();
  return t ? items.filter((i) => `${i.label} ${i.sub ?? ""} ${i.tags ?? ""} ${i.group ?? ""}`.toLowerCase().includes(t)) : items;
}
export const forLevel = (items: ToolItem[], level: Level, all: boolean) => (all ? items : items.filter((i) => !i.levels || i.levels.includes(level)));
