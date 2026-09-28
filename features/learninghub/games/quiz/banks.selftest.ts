// Run: server/node_modules/.bin/tsx features/learninghub/games/quiz/banks.selftest.ts
// Mechanical quality gate for every quiz-quest content bank: structure, unique keys, no duplicate questions, exactly one right option, no banned brand word, an
// unbiased answer position, and the size targets. It does not judge whether a fact is TRUE - every added fact was checked by hand against the curriculum.
import { COMPASS_ITEMS } from "../compass/content";
import { MUSEUM_ITEMS } from "../museum/content";
import { COLOUR_ITEMS } from "../colourlab/content";
import { DEBATE_ITEMS } from "../debate/content";
import { DETECTIVE_ITEMS } from "../detective/content";
import { VAULT_ITEMS } from "../vault/content";
import { WORDPOP_ITEMS } from "../wordpop/content";
import { buildPlan, type QuizItem } from "./core";

let fails = 0; const ok = (c: unknown, m: string) => { if (!c) { fails++; console.error("FAIL", m); } };
const BANKS: Record<string, { items: QuizItem[]; min: number }> = {
  compass: { items: COMPASS_ITEMS, min: 100 }, museum: { items: MUSEUM_ITEMS, min: 100 }, colourlab: { items: COLOUR_ITEMS, min: 100 }, debate: { items: DEBATE_ITEMS, min: 100 },
  detective: { items: DETECTIVE_ITEMS, min: 36 }, vault: { items: VAULT_ITEMS, min: 100 }, wordpop: { items: WORDPOP_ITEMS, min: 100 },
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const BANNED = new RegExp("\\b" + ["O", "a", "k"].join("") + "\\b", "i"); // owner rule: that word appears nowhere in learner-facing content

for (const [name, { items, min }] of Object.entries(BANKS)) {
  ok(items.length >= min, `${name}: ${items.length} items, want at least ${min}`);
  const keys = new Set<string>(); const prompts = new Map<string, string>();
  for (const it of items) {
    ok(!keys.has(it.key), `${name}: duplicate key ${it.key}`); keys.add(it.key);
    ok(it.options.length >= 2 && it.options.length <= 4, `${name}/${it.key}: ${it.options.length} options`);
    const ids = new Set(it.options.map((o) => o.id)); ok(ids.size === it.options.length, `${name}/${it.key}: duplicate option ids`);
    const texts = it.options.map((o) => norm(o.text)); ok(new Set(texts).size === texts.length, `${name}/${it.key}: duplicate option text`);
    ok(it.options.filter((o) => o.id === it.correctId).length === 1, `${name}/${it.key}: correctId must match exactly one option`);
    ok(it.options.every((o) => o.text.trim().length > 0), `${name}/${it.key}: empty option`);
    ok(it.explanation.trim().length >= 12, `${name}/${it.key}: missing explanation`);
    ok([1, 2, 3].includes(it.difficulty), `${name}/${it.key}: difficulty`);
    ok(it.topics.length >= 1, `${name}/${it.key}: topics`);
    ok(it.prompt.trim().length >= 8, `${name}/${it.key}: prompt`);
    const all = [it.prompt, it.passage ?? "", it.explanation, ...it.options.map((o) => o.text)].join(" ");
    ok(!BANNED.test(all), `${name}/${it.key}: banned word`);
    ok(!/undefined|\[object|NaN/.test(all), `${name}/${it.key}: broken text`);
    // the same question (prompt + passage + option set) must not appear twice; a generic prompt like "Which period came FIRST?" is only unique via its options
    const sig = norm(it.prompt) + "|" + norm(it.passage ?? "") + "|" + [...texts].sort().join("/");
    ok(!prompts.has(sig), `${name}/${it.key}: duplicates ${prompts.get(sig)}`); prompts.set(sig, it.key);
  }
  // no fixed position for the right answer IN A RUN: the stored order lists the right option first, and buildPlan shuffles it per run, so measure the plans a child actually gets
  if (items.length >= 50) {
    const byKey = new Map(items.map((i) => [i.key, i])); const slots: Record<string, number> = {}; let total = 0;
    for (let seed = 1; seed <= 300; seed++) for (const p of buildPlan(seed, items, new Map(), 12, "2026-09-27T10:00:00.000Z")) {
      const at = p.options.findIndex((o) => o.id === byKey.get(p.key)!.correctId); slots[at] = (slots[at] ?? 0) + 1; total++;
    }
    for (const [p, n] of Object.entries(slots)) ok(n / total < 0.6, `${name}: in a run the right answer sits in slot ${p} for ${Math.round((100 * n) / total)}% of questions`);
  }
  const t: Record<string, number> = {}; for (const it of items) for (const x of it.topics) t[x] = (t[x] ?? 0) + 1;
  console.log(`${name.padEnd(10)} ${String(items.length).padStart(4)} items  ${JSON.stringify(t)}`);
}
console.log(fails ? `${fails} FAILURES` : "banks selftest: all passed");
process.exit(fails ? 1 : 0);
