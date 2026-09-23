// run: server/node_modules/.bin/tsx features/learninghub/tools/science/labels/labeller.selftest.ts
import { DIAGRAM_DATA } from "./diagramData";
import { acceptedFor, hintFor, markerPos, numberOf, partsAtLevel, scoreLabels, scoreTyped, shuffleBank, getDiagram } from "./labeller";

let n = 0, fails = 0;
const check = (name: string, ok: boolean, extra = "") => { n++; if (!ok) { fails++; console.error(`FAIL: ${name} ${extra}`); } };
const eq = (name: string, a: unknown, b: unknown) => check(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);

check("at least 10 diagrams", DIAGRAM_DATA.length >= 10, String(DIAGRAM_DATA.length));
check("diagram ids unique", new Set(DIAGRAM_DATA.map((d) => d.id)).size === DIAGRAM_DATA.length);
check("all four required topics covered", ["cells", "plants", "body-systems", "physics"].every((t) => DIAGRAM_DATA.some((d) => d.topic === t)));
for (const id of ["animal-cell", "plant-cell", "bacterial-cell", "flower", "eye", "heart", "digestive", "leaf", "respiratory"]) check(`required diagram ${id} exists`, !!getDiagram(id));

for (const d of DIAGRAM_DATA) {
  const ids = d.parts.map((p) => p.id), labels = d.parts.map((p) => p.label.toLowerCase());
  check(`${d.id}: part ids unique`, new Set(ids).size === ids.length);
  check(`${d.id}: labels unique`, new Set(labels).size === labels.length);
  check(`${d.id}: at least 5 parts`, d.parts.length >= 5, String(d.parts.length));
  check(`${d.id}: has key stage(s)`, d.keyStages.length > 0);
  for (const p of d.parts) {
    const m = markerPos(p);
    check(`${d.id}/${p.id}: hotspot inside viewBox`, p.hotspot.x >= 0 && p.hotspot.x <= d.viewBox.w && p.hotspot.y >= 0 && p.hotspot.y <= d.viewBox.h);
    check(`${d.id}/${p.id}: marker inside viewBox with margin`, m.x >= 12 && m.x <= d.viewBox.w - 12 && m.y >= 12 && m.y <= d.viewBox.h - 12);
    const h = p.hint.toLowerCase();
    check(`${d.id}/${p.id}: hint does not contain label or any accepted term`, acceptedFor(p).every((a) => !h.includes(a.toLowerCase())));
    check(`${d.id}/${p.id}: hints at every step avoid the label`, [0, 1, 2].every((s) => !hintFor(p, s).toLowerCase().includes(p.label.toLowerCase())));
    check(`${d.id}/${p.id}: hint is a real sentence`, p.hint.length >= 15 && p.hint.length <= 120);
    const acc = acceptedFor(p).map((a) => a.trim().toLowerCase());
    check(`${d.id}/${p.id}: accepts has no duplicates (incl. label)`, new Set(acc).size === acc.length);
    check(`${d.id}/${p.id}: accepts are non-empty strings`, acc.every((a) => a.length > 0));
  }
  const pos = d.parts.map(markerPos);
  let minD = Infinity;
  for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) minD = Math.min(minD, Math.hypot(pos[i]!.x - pos[j]!.x, pos[i]!.y - pos[j]!.y));
  check(`${d.id}: markers at least 12 units apart`, minD >= 12, `min ${minD.toFixed(1)}`);
  // accepted terms must not collide across different parts of one diagram (would make one typed answer credit two markers)
  const all = d.parts.flatMap((p) => acceptedFor(p).map((a) => a.toLowerCase()));
  check(`${d.id}: no accepted term shared by two parts`, new Set(all).size === all.length);
  // levels
  const l1 = partsAtLevel(d, 1).map((p) => p.id), l2 = partsAtLevel(d, 2).map((p) => p.id), l3 = partsAtLevel(d, 3).map((p) => p.id);
  check(`${d.id}: level 1 subset of level 2`, l1.every((x) => l2.includes(x)));
  check(`${d.id}: level 2 subset of level 3`, l2.every((x) => l3.includes(x)));
  check(`${d.id}: level 3 is every part`, l3.length === d.parts.length);
  check(`${d.id}: level 1 has 3+ parts and fewer than level 3`, l1.length >= 3 && l1.length < l3.length, `${l1.length}/${l3.length}`);
  check(`${d.id}: level 2 strictly between (or equal-safe) 1 and 3`, l1.length <= l2.length && l2.length <= l3.length);
}

// ---- scoring: placements ----
const heart = getDiagram("heart")!;
const perfect = Object.fromEntries(heart.parts.map((p) => [p.id, p.id]));
let r = scoreLabels(perfect, heart);
eq("perfect placement scores every part", [r.score, r.max], [10, 10]);
r = scoreLabels({}, heart);
eq("empty placement scores 0 of 10", [r.score, r.max], [0, 10]);
const partial = { ...perfect, ra: "la", la: "ra", aorta: undefined };
r = scoreLabels(partial, heart);
eq("two swapped + one missing = 7/10", [r.score, r.max], [7, 10]);
eq("perPart flags the swap and the gap", [(r.log.perPart as Record<string, string>).ra, (r.log.perPart as Record<string, string>).aorta, (r.log.perPart as Record<string, string>).lv], ["wrong", "empty", "correct"]);
check("feedback names the part number", r.feedback.some((f) => f.includes("Part 1 of 10")));
check("feedback never reveals any label", DIAGRAM_DATA.every((d) => scoreLabels({}, d).feedback.concat(scoreLabels({ [d.parts[0]!.id]: d.parts[1]!.id }, d).feedback).every((f) => d.parts.every((p) => !f.toLowerCase().includes(p.label.toLowerCase())))));
check("wrong placement line uses a cross, correct a tick", scoreLabels({ ra: "ra", la: "ra" }, heart).feedback[0]!.startsWith("✓") && scoreLabels({ ra: "ra", la: "ra" }, heart).feedback[1]!.startsWith("✗"));
const lvl1 = partsAtLevel(heart, 1);
r = scoreLabels(Object.fromEntries(lvl1.map((p) => [p.id, p.id])), heart, 1);
eq("level-1 scoring only counts level-1 parts", [r.score, r.max], [lvl1.length, lvl1.length]);
check("a label placed on a part outside the level is ignored", scoreLabels({ ...Object.fromEntries(lvl1.map((p) => [p.id, p.id])), pv: "pv" }, heart, 1).max === lvl1.length);
eq("numberOf is 1-based in active order", [numberOf(lvl1, lvl1[0]!.id), numberOf(lvl1, "nope")], [1, 0]);

// ---- shuffle ----
const parts = heart.parts;
const a = shuffleBank(parts, 42), b = shuffleBank(parts, 42);
eq("shuffle deterministic per seed", a, b);
eq("shuffle is a permutation of the parts", a.map((x) => x.id).sort(), parts.map((p) => p.id).sort());
check("shuffle never equals marker order", [1, 2, 3, 4, 5, 6, 7, 8].every((s) => shuffleBank(parts, s).some((x, i) => x.id !== parts[i]!.id)));
check("different seeds give different orders", new Set([1, 2, 3, 4, 5, 6].map((s) => shuffleBank(parts, s).map((x) => x.id).join())).size >= 4);
{ const before = parts.map((p) => p.id).join(); shuffleBank(parts, 9); check("shuffle does not mutate input", parts.map((p) => p.id).join() === before); }
eq("bank items carry the label text", a.every((x) => x.label === heart.parts.find((p) => p.id === x.id)!.label), true);

// ---- typed mode ----
const animal = getDiagram("animal-cell")!;
const ok = (d: typeof animal, id: string, t: string) => scoreTyped({ [id]: t }, d).score === 1;
check("typed: exact label accepted", ok(animal, "nucleus", "nucleus"));
check("typed: case and padding forgiven", ok(animal, "nucleus", "  NuCleUs "));
check("typed: alternative accepted (plural)", ok(animal, "mito", "Mitochondria"));
check("typed: alternative accepted (membrane)", ok(animal, "membrane", "plasma membrane"));
check("typed: accent slip tolerated", ok(animal, "nucleus", "nucléus"));
check("typed: misspelling rejected", !ok(animal, "nucleus", "nucleous"));
check("typed: wrong part's word rejected", !ok(animal, "nucleus", "cytoplasm"));
check("typed: empty rejected", !ok(animal, "nucleus", "   "));
check("typed: UK and US spelling both accepted", ok(getDiagram("digestive")!, "oesophagus", "esophagus") && ok(getDiagram("digestive")!, "oesophagus", "oesophagus"));
check("typed: trailing punctuation ignored", ok(animal, "cytoplasm", "cytoplasm."));
r = scoreTyped(Object.fromEntries(animal.parts.map((p) => [p.id, p.label])), animal);
eq("typed: all labels typed gives full marks", [r.score, r.max], [5, 5]);
r = scoreTyped({ nucleus: "nucleus", membrane: "wall", cytoplasm: "" }, animal);
eq("typed: 1 right, 1 wrong, rest blank", [r.score, r.max], [1, 5]);
eq("typed: perPart distinguishes wrong from empty", [(r.log.perPart as Record<string, string>).membrane, (r.log.perPart as Record<string, string>).cytoplasm], ["wrong", "empty"]);
check("typed feedback does not leak the answer", r.feedback.every((f) => animal.parts.every((p) => !f.toLowerCase().includes(p.label.toLowerCase()))));
check("typed: every part's own label scores under its own diagram", DIAGRAM_DATA.every((d) => d.parts.every((p) => ok(d, p.id, p.label) && p.accepts.every((x) => ok(d, p.id, x)))));

// ---- hints ----
const nuc = animal.parts[0]!;
check("hint step 0 is the base hint", hintFor(nuc, 0) === nuc.hint);
check("hint step 1 extends step 0 with first letter and length", hintFor(nuc, 1).startsWith(nuc.hint) && hintFor(nuc, 1).includes("“n”") && hintFor(nuc, 1).includes("7 letters"));
check("multi-word hint reports word count", hintFor(getDiagram("heart")!.parts[0]!, 1).includes("2 words"));

console.log(`${n} checks, ${fails} failed`);
process.exit(fails ? 1 : 0);
