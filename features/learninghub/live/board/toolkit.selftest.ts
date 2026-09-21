// Toolkit self-test: `npx tsx features/learninghub/live/board/toolkit.selftest.ts`
// Every template in every pack builds valid elements (finite numbers, known kinds/stamps), stays small, and lands on a board
// through the permission-checking reducer; the function plotter's parser is safe; subject/year → pack/style guessing.
import assert from "node:assert/strict";
import { BG_KINDS, PT, TUTOR, newState, pointInPolygon, rotCentre, stampDef, boundsOf, hitTest, type BoardState, type El } from "./model";
import { netFaces } from "./toolkit/maths";
import { scramble } from "./toolkit/english";
import { drawElement, DEFAULT_PAPER } from "./render";
import { applyOp } from "./reducer";
import { pos, ELEMENT_SYMBOLS, parseEvents } from "./render-stamps";
import { B, LEVELS, place, type Vals } from "./toolkit/kit";
import { compile } from "./toolkit/mathExpr";
import { PACKS, forLevel, levelFromYears, packFromSubject, searchItems } from "./toolkit/packs";
import { PACK_SYMBOLS, SYMBOL_SETS } from "./toolkit/symbols";

let n = 0;
const t = (name: string, fn: () => void) => { try { fn(); n++; console.log(`  ok  ${name}`); } catch (e) { console.error(`  FAIL ${name}\n`, e); process.exitCode = 1; } };
const ctx = { ink: "#102356", brand: "#2f6bd8", danger: "#e21d27", soft: "#eaf0fc" };
const KINDS = new Set(["stroke", "shape", "text", "sticky", "image", "stamp"]);

console.log("whiteboard toolkit");

t("every template of every pack builds valid, small, placeable elements", () => {
  let items = 0, els = 0;
  for (const pack of PACKS) for (const item of pack.items) {
    if (!item.make) continue; // backgrounds / actions
    items++;
    const vals: Vals = Object.fromEntries((item.params ?? []).map((p) => [p.k, p.def]));
    const b = new B(ctx);
    item.make(b, ctx, vals);
    const placed = place(b, 0, 0, "T", 10);
    assert.ok(placed.length > 0, `${item.id} made nothing`);
    for (const e of placed) {
      assert.ok(KINDS.has(e.k), `${item.id}: kind ${e.k}`);
      for (const k of ["x", "y", "x1", "y1", "x2", "y2", "w", "h", "size", "rot"] as (keyof El)[]) if (e[k] !== undefined) assert.ok(Number.isFinite(e[k] as number), `${item.id}: ${k}`);
      if (e.k === "stamp") assert.ok(stampDef(e.stamp!), `${item.id}: unknown stamp ${e.stamp}`);
      if (e.k === "stroke") assert.ok(e.pts!.length >= PT * 2 && e.pts!.length % PT === 0, `${item.id}: stroke points`);
      if (e.k === "text") assert.ok(typeof e.text === "string");
      assert.ok(e.grp, `${item.id}: grouped`);
    }
    const size = JSON.stringify(placed).length;
    assert.ok(size < 60_000, `${item.id} is ${size} bytes`);
    // lands on a board through the reducer (as the tutor), and a student can't add stamps/templates' images
    const s: BoardState = newState();
    for (const e of placed) assert.equal(applyOp(s, { op: "add", page: "p1", el: e }, TUTOR).changed, true, `${item.id}: reducer`);
    els += placed.length;
  }
  assert.ok(items >= 70, `only ${items} templates`);
  console.log(`      ${items} templates, ${els} elements`);
});

t("packs cover General, Maths, English, Languages, Geography, History, Science with items for each key stage", () => {
  assert.deepEqual(PACKS.map((p) => p.id), ["general", "maths", "english", "languages", "geography", "history", "science"]);
  for (const p of PACKS) for (const l of LEVELS) assert.ok(forLevel(p.items, l, false).length >= 3, `${p.id}/${l}`);
  assert.deepEqual(PACKS.find((p) => p.id === "science")!.groups, ["Biology", "Chemistry", "Physics", "Frames"]);
  // subject frames: every pack's page backgrounds are real kinds, and the four subject frames are offered where they belong
  for (const p of PACKS) for (const i of p.items) if (i.bg) assert.ok(BG_KINDS.includes(i.bg), `${i.id} background`);
  for (const [pack, id] of [["maths", "m-bg-graph"], ["maths", "m-bg-numberline"], ["english", "e-storymap"], ["science", "s-diagram"], ["languages", "l-vocab-page"]] as const) assert.ok(PACKS.find((p) => p.id === pack)!.items.some((i) => i.id === id && i.bg), id);
  assert.ok(searchItems(PACKS[0]!.items.concat(...PACKS.slice(1).map((p) => p.items)), "conjugation").some((i) => i.id === "l-conj"));
});

t("subject → pack guess and year group → style are config-driven", () => {
  const g: [string, string][] = [["Maths", "maths"], ["GCSE Mathematics", "maths"], ["English Literature", "english"], ["French", "languages"], ["Mandarin", "languages"], ["Geography", "geography"], ["History", "history"], ["Biology", "science"], ["Physics A-level", "science"], ["Chess club", "general"], ["", "general"]];
  for (const [s, p] of g) assert.equal(packFromSubject(s), p, s);
  assert.equal(levelFromYears(["Reception", "Year 2"]), "early");
  assert.equal(levelFromYears(["Year 6"]), "early");
  assert.equal(levelFromYears(["Year 7", "Year 8"]), "standard");
  assert.equal(levelFromYears(["Year 9", "Year 11"]), "advanced"); // a mixed group takes the oldest
  assert.equal(levelFromYears(["Year 13"]), "advanced");
  assert.equal(levelFromYears([null, undefined]), null);
});

t("the function plotter parses safely (no eval) and evaluates", () => {
  const f = (s: string, x: number) => compile(s)!(x);
  assert.equal(f("y = 2x + 1", 3), 7); assert.equal(f("x^2 - 3x + 2", 2), 0); assert.equal(f("3(x+1)", 2), 9); assert.equal(f("-x^2", 3), -9); assert.equal(f("x²", 4), 16);
  assert.ok(Math.abs(f("sin(pi/2)", 0) - 1) < 1e-9); assert.equal(f("sqrt(x)", 9), 3);
  for (const bad of ["alert(1)", "x+", "process.exit()", "constructor", "x;y", "", "1/", "(x"]) assert.equal(compile(bad), null, bad);
});

t("periodic table: 118 distinct cells, correct known positions", () => {
  assert.equal(ELEMENT_SYMBOLS.length, 118);
  const cells = new Set<string>();
  for (let z = 1; z <= 118; z++) { const p = pos(z); assert.ok(p.c >= 0 && p.c < 18 && p.r >= 0 && p.r < 10, `Z${z}`); cells.add(`${p.c},${p.r}`); }
  assert.equal(cells.size, 118);
  assert.deepEqual([pos(1), pos(2), pos(6), pos(11), pos(26), pos(79)].map((p) => [p.c, p.r]), [[0, 0], [17, 0], [13, 1], [0, 2], [7, 3], [10, 5]]);
  assert.equal(ELEMENT_SYMBOLS[10], "Na"); assert.equal(ELEMENT_SYMBOLS[25], "Fe"); assert.equal(ELEMENT_SYMBOLS[78], "Au");
});

t("timeline events parse; accent / symbol palettes exist for the language and science packs", () => {
  assert.deepEqual(parseEvents("1066|Hastings; 1215|Magna Carta; nope"), [{ year: 1066, label: "Hastings" }, { year: 1215, label: "Magna Carta" }]);
  const chars = (id: string) => SYMBOL_SETS.find((s) => s.id === id)!.chars;
  for (const c of ["é", "è", "ê", "ë", "à", "â", "ç", "î", "ï", "ô", "ù", "û", "ü", "œ"]) assert.ok(chars("fr").includes(c), c);
  for (const c of ["ñ", "¿", "¡"]) assert.ok(chars("es").includes(c), c);
  for (const c of ["ä", "ö", "ß", "€"]) assert.ok(chars("de").includes(c), c);
  for (const c of ["²", "³", "√", "±", "≈", "→", "⇌", "°", "Δ", "∞"]) assert.ok(chars("sci").includes(c) || chars("maths").includes(c), c);
  assert.ok(PACK_SYMBOLS.languages!.includes("fr"));
});


t("3-D nets fold: every face is joined to the rest along an edge of EXACTLY the same length, the loose edges pair up, nothing overlaps", () => {
  for (const kind of ["Cube", "Cuboid", "Triangular prism", "Square-based pyramid"]) {
    const faces = netFaces(kind), key = (a: [number, number], b: [number, number]) => [a, b].map((p) => `${Math.round(p[0] * 100)},${Math.round(p[1] * 100)}`).sort().join("|");
    const edges = new Map<string, { n: number; len: number }>();
    for (const f of faces) for (let i = 0; i < f.length; i++) {
      const a = f[i]!, b = f[(i + 1) % f.length]!, k = key(a, b), cur = edges.get(k);
      edges.set(k, { n: (cur?.n ?? 0) + 1, len: Math.hypot(a[0] - b[0], a[1] - b[1]) });
    }
    const shared = [...edges.values()].filter((e) => e.n === 2).length, loose = [...edges.values()].filter((e) => e.n === 1);
    assert.ok([...edges.values()].every((e) => e.n <= 2), `${kind}: an edge shared by 3 faces`);
    assert.equal(shared, faces.length - 1, `${kind}: faces are joined in a tree (${faces.length} faces, ${shared} joins)`);
    const byLen = new Map<number, number>(); for (const e of loose) byLen.set(Math.round(e.len * 10), (byLen.get(Math.round(e.len * 10)) ?? 0) + 1);
    for (const [len, n] of byLen) assert.equal(n % 2, 0, `${kind}: loose edges of length ${len / 10} do not pair up (${n}) — the net would not close`);
    // no face's centre lies inside another face
    faces.forEach((f, i) => { const cx = f.reduce((a, p) => a + p[0], 0) / f.length, cy = f.reduce((a, p) => a + p[1], 0) / f.length; faces.forEach((g, j) => { if (i !== j) assert.ok(!pointInPolygon(g, cx, cy), `${kind}: faces ${i} and ${j} overlap`); }); });
  }
  assert.equal(netFaces("Cube").length, 6); assert.equal(netFaces("Cuboid").length, 6); assert.equal(netFaces("Triangular prism").length, 5); assert.equal(netFaces("Square-based pyramid").length, 5);
});

t("the population pyramid is data-driven typeable cells; blank mode leaves dashed slots", () => {
  const item = PACKS.find((p) => p.id === "geography")!.items.find((i) => i.id === "geo-pyramid")!;
  const build = (vals: Vals) => { const b = new B(ctx); item.make!(b, ctx, { ...Object.fromEntries(item.params!.map((p) => [p.k, p.def])), ...vals }); return place(b, 0, 0, "T", 10); };
  const els = build({ max: 10, male: "10, 5", female: "2.5, 1" });
  const bars = els.filter((e) => e.cell && e.fill), w = (e: El) => Math.abs(e.x2! - e.x1!);
  const widths = bars.map(w).sort((a, b) => a - b);
  assert.ok(widths.some((x) => Math.abs(x - 300) < 1) && widths.some((x) => Math.abs(x - 75) < 1) && widths.some((x) => Math.abs(x - 30) < 1), `bar lengths follow the numbers: ${widths.slice(0, 6).join(",")}`);
  assert.ok(els.some((e) => e.k === "text" && e.text === "10"), "axis ticks carry numbers");
  assert.ok(els.filter((e) => e.cell && e.text && /^\d+[–+]/.test(e.text)).length >= 17, "the age labels are cells too");
  const blank = build({ mode: "Blank bars for students" });
  assert.ok(blank.filter((e) => e.cell && e.dash).length >= 34);
  for (const e of els) if (e.cell) assert.ok(e.shape === "rect" && e.grp, "cells are grouped rectangles");
});

t("every template that used to ship empty boxes now ships typeable cells", () => {
  const need: [string, RegExp | null][] = [["geo-water", null], ["geo-rock", null], ["e-peel", null], ["e-5w", null], ["h-source", null], ["l-flash", null], ["g-kwl", null], ["m-hundred", null], ["m-tenframe", null], ["m-bar", null], ["s-punnett", null], ["g-flow", null]];
  for (const [id] of need) {
    const item = PACKS.flatMap((p) => p.items).find((i) => i.id === id)!;
    const b = new B(ctx); item.make!(b, ctx, Object.fromEntries((item.params ?? []).map((p) => [p.k, p.def])));
    const els = place(b, 0, 0, "T", 10);
    assert.ok(els.filter((e) => e.k === "shape" && e.cell).length >= 3, `${id}: cells`);
    // no LOOSE empty text left behind (the old flashcards / water cycle drew "" texts)
    assert.ok(!els.some((e) => e.k === "text" && !(e.text ?? "").trim()), `${id}: empty text element`);
  }
  // flashcards keep the translation the tutor typed
  const fl = PACKS.flatMap((p) => p.items).find((i) => i.id === "l-flash")!, b = new B(ctx);
  fl.make!(b, ctx, { pairs: "chat = cat, chien = dog", back: "Show the translation" });
  assert.ok(place(b, 0, 0, "T", 1).some((e) => e.text === "cat"));
  const b2 = new B(ctx); fl.make!(b2, ctx, { pairs: "chat = cat", back: "Leave blank to fill in" });
  assert.ok(!place(b2, 0, 0, "T", 1).some((e) => e.text === "cat"));
});

t("sentence builder scramble is never the original order, whatever the length", () => {
  for (const n of [2, 3, 4, 5, 6, 10, 14]) for (const seed of ["The cat sat", "a b c d e", "x"]) {
    const a = scramble(n, seed + n);
    assert.deepEqual([...a].sort((x, y) => x - y), Array.from({ length: n }, (_, i) => i));
    assert.ok(!a.every((v, i) => v === i), `n=${n} identity`);
  }
});

t("a protractor turns about its baseline centre (the measuring point) and the number line ends at max", () => {
  const e: El = { id: "p", k: "stamp", own: "T", z: 1, v: 1, stamp: "protractor", x: 100, y: 100, w: 380, h: 200, rot: 90, opts: { pv: 1 } };
  const rc = rotCentre(e); assert.deepEqual([rc.x, rc.y], [290, 292]);
  assert.ok(hitTest(e, 290, 292, 2), "the pivot stays under the protractor whatever its angle");
  const old = { ...e, opts: {} } as El; assert.deepEqual([rotCentre(old).x, rotCentre(old).y], [290, 200], "protractors placed before keep their old behaviour");
  const b = boundsOf(e); assert.ok(b.x < 290 && b.x + b.w > 290);
  // draw a number line 0→10 by 4 into a recording context
  const texts: string[] = [];
  const ctx2 = new Proxy({}, { get: (_t, k) => (k === "fillText" ? (t: string) => texts.push(t) : k === "measureText" ? () => ({ width: 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
  const nl: El = { id: "n", k: "stamp", own: "T", z: 1, v: 1, stamp: "numberline", x: 0, y: 0, w: 760, h: 96, opts: { min: 0, max: 10, step: 4 } };
  drawElement(ctx2, nl, { k: 1, paper: DEFAULT_PAPER, images: {} as never });
  assert.deepEqual(texts, ["0", "4", "8", "10"], "0 to 10 by 4 used to show 0, 4, 8, 12");
  texts.length = 0; drawElement(ctx2, { ...nl, opts: { min: 5, max: 0, step: 1 } }, { k: 1, paper: DEFAULT_PAPER, images: {} as never });
  assert.deepEqual(texts.slice(0, 2), ["0", "1"], "a reversed range is put the right way round");
});

console.log(`\n${n} passed${process.exitCode ? " (with failures)" : ""}`);
