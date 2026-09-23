// Self-test for the two arrange-it question kinds, `match` and `order`: marking
// (correct / wrong / partial / duplicates / reordering / whitespace + case), the
// authoring validators, the per-attempt shuffle (deterministic, never the answer key
// in place) and the no-answer-leak property of what a student is sent. No Firestore:
//   cd server && npx tsx src/hubSelfTest4.ts
import assert from "node:assert/strict";
import { markMatch, markOrder, markResponse, inferRule, isBlank, type MarkableQuestion } from "./lib/hubScoring";
import { cleanItems, cleanKindResponse, cleanPairs, presentMatch, presentOrder, seededShuffle, type Pair } from "./lib/hubKinds";
import { HUB_DEFAULTS, mergeHub } from "../../lib/hubConfig";

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log(`  ok  ${name}`); };

const pairs: Pair[] = [
  { term: "Numerator", definition: "The top number of a fraction" },
  { term: "Denominator", definition: "The bottom number of a fraction" },
  { term: "Equivalent", definition: "Different fractions, same value" },
  { term: "Improper", definition: "Top is bigger than the bottom" },
];
const M = (over: Partial<MarkableQuestion> = {}): MarkableQuestion => ({ mark: "match", answer: pairs, marks: 1, ...over });
const O = (items: string[], over: Partial<MarkableQuestion> = {}): MarkableQuestion => ({ mark: "order", answer: items, marks: 1, ...over });
const mr = (ps: { term: string; definition: string }[]) => ({ kind: "match", pairs: ps });
const or = (items: string[]) => ({ kind: "order", items });
const RIGHT = 1, WRONG = 0;

console.log("match marking");
t("every pair right → full marks, in any order", () => {
  assert.deepEqual(markResponse(M({ marks: 3 }), mr(pairs)), { correct: true, marksAwarded: 3, pending: false });
  assert.equal(markResponse(M(), mr([...pairs].reverse())).correct, true);
});
t("one pair swapped is wrong (all-or-nothing, no partial credit)", () => {
  const swapped = [{ term: pairs[0].term, definition: pairs[1].definition }, { term: pairs[1].term, definition: pairs[0].definition }, pairs[2], pairs[3]];
  assert.deepEqual(markResponse(M({ marks: 2 }), mr(swapped)), { correct: false, marksAwarded: WRONG, pending: false });
});
t("a missing pair or a partly-filled board is wrong", () => {
  assert.equal(markResponse(M(), mr(pairs.slice(0, 3))).correct, false);
  assert.equal(markResponse(M(), mr([])).correct, false, "no pairs = blank = wrong, not pending");
  assert.equal(isBlank(mr([])), true);
});
t("a repeated pair can't stand in for a missing one", () => {
  assert.equal(markResponse(M(), mr([pairs[0], pairs[0], pairs[1], pairs[2]])).correct, false);
  assert.equal(markResponse(M(), mr([...pairs, pairs[0]])).correct, false, "extra pair");
});
t("whitespace is ignored but case counts (EE / Ee / ee are different answers)", () => {
  const spaced = pairs.map((p) => ({ term: `  ${p.term} `, definition: p.definition.replace(/ /g, "   ") }));
  assert.equal(markResponse(M(), mr(spaced)).correct, true);
  const recased = pairs.map((p, i) => (i === 0 ? { term: p.term.toUpperCase() === p.term ? p.term.toLowerCase() : p.term.toUpperCase(), definition: p.definition } : p));
  assert.equal(markResponse(M(), mr(recased)).correct, false, "a case-changed term is a different answer");
  const geno: Pair[] = [{ term: "EE", definition: "homozygous dominant" }, { term: "Ee", definition: "heterozygous" }, { term: "ee", definition: "homozygous recessive" }];
  assert.equal(markResponse(M({ answer: geno }), mr(geno)).correct, true);
  assert.equal(markResponse(M({ answer: geno }), mr([{ term: "ee", definition: "homozygous dominant" }, { term: "Ee", definition: "heterozygous" }, { term: "EE", definition: "homozygous recessive" }])).correct, false, "swapped genotypes are wrong");
});
t("duplicate definitions/terms across pairs are matched as a multiset", () => {
  const dup: Pair[] = [{ term: "Two", definition: "Even" }, { term: "Four", definition: "Even" }, { term: "Three", definition: "Odd" }];
  assert.equal(markResponse(M({ answer: dup }), mr([{ term: "Four", definition: "Even" }, { term: "Three", definition: "Odd" }, { term: "Two", definition: "Even" }])).correct, true);
  assert.equal(markResponse(M({ answer: dup }), mr([{ term: "Four", definition: "Odd" }, { term: "Three", definition: "Even" }, { term: "Two", definition: "Even" }])).correct, false);
});
t("malformed responses are wrong, never a crash", () => {
  for (const r of ["a string", 5, ["x"], { kind: "match" }, { kind: "match", pairs: "no" }, { kind: "match", pairs: [{ term: 1, definition: 2 }] }, { kind: "match", pairs: [null] }, { kind: "order", items: ["a"] }, null, undefined]) {
    assert.equal(markResponse(M(), r).correct, false, JSON.stringify(r));
  }
  assert.equal(markMatch(null, mr(pairs)), false, "no key");
  assert.equal(markMatch([], mr([])), false, "empty key");
});
t("pictures on a pair never affect marking", () => {
  const withPic: Pair[] = pairs.map((p) => ({ ...p, termImage: { url: "https://x.example/a.png", alt: "a" } }));
  assert.equal(markResponse(M({ answer: withPic }), mr(pairs.map(({ term, definition }) => ({ term, definition })))).correct, true);
});

console.log("order marking");
const seq = ["Wake up", "Brush teeth", "Eat breakfast", "Go to school"];
t("the exact sequence is right; any other order is wrong", () => {
  assert.deepEqual(markResponse(O(seq, { marks: 2 }), or(seq)), { correct: true, marksAwarded: 2, pending: false });
  assert.equal(markResponse(O(seq), or(["Brush teeth", "Wake up", "Eat breakfast", "Go to school"])).correct, false, "two swapped");
  assert.equal(markResponse(O(seq), or([...seq].reverse())).correct, false, "reversed");
});
t("missing, extra or empty answers are wrong", () => {
  assert.equal(markResponse(O(seq), or(seq.slice(0, 3))).correct, false);
  assert.equal(markResponse(O(seq), or([...seq, "Sleep"])).correct, false);
  assert.equal(markResponse(O(seq), or([])).correct, false);
  assert.equal(isBlank(or([])), true);
});
t("whitespace is ignored but case counts", () => {
  assert.equal(markResponse(O(seq), or(seq.map((s) => `  ${s}  `))).correct, true);
  assert.equal(markResponse(O(seq), or(seq.map((s) => s.toUpperCase()))).correct, seq.every((s) => s === s.toUpperCase()), "a re-cased item is a different answer");
  const geno = ["EE", "Ee", "ee"];
  assert.equal(markResponse(O(geno), or(["EE", "Ee", "ee"])).correct, true);
  assert.equal(markResponse(O(geno), or(["ee", "Ee", "EE"])).correct, false, "reordered genotypes are wrong");
});
t("duplicate items: identical wording is interchangeable, position still matters", () => {
  const rep = ["Add", "Stir", "Add", "Bake"];
  assert.equal(markResponse(O(rep), or(["Add", "Stir", "Add", "Bake"])).correct, true);
  assert.equal(markResponse(O(rep), or(["Add", "Add", "Stir", "Bake"])).correct, false);
  assert.equal(markResponse(O(rep), or(["Stir", "Add", "Add", "Bake"])).correct, false);
});
t("malformed responses are wrong", () => {
  for (const r of ["Wake up", 3, seq, { kind: "order" }, { kind: "order", items: "x" }, { kind: "order", items: [1, 2, 3, 4] }, { kind: "match", pairs: [] }, null]) {
    assert.equal(markResponse(O(seq), r).correct, false, JSON.stringify(r));
  }
  assert.equal(markOrder(null, or(seq)), false);
});
t("inferRule falls back to the stored shape when a tenant dropped the kind", () => {
  assert.equal(inferRule({ answer: null, pairs }), "match");
  assert.equal(inferRule({ answer: null, items: seq }), "order");
});

console.log("authoring validators");
t("cleanPairs: 3–8, both sides, pictures need https + alt", () => {
  assert.ok(Array.isArray(cleanPairs(pairs)));
  assert.match(String(cleanPairs(pairs.slice(0, 2))), /at least 3/);
  assert.match(String(cleanPairs(Array.from({ length: 9 }, (_, i) => ({ term: `t${i}`, definition: `d${i}` })))), /at most 8/);
  assert.match(String(cleanPairs([...pairs.slice(0, 2), { term: "x", definition: " " }])), /both a term/);
  assert.match(String(cleanPairs([...pairs.slice(0, 2), pairs[0]])), /twice/);
  assert.match(String(cleanPairs([...pairs.slice(0, 3), { term: "x", definition: "y", termImage: { url: "http://insecure/a.png", alt: "a" } }])), /https/);
  assert.match(String(cleanPairs([...pairs.slice(0, 3), { term: "x", definition: "y", termImage: { url: "https://ok/a.png", alt: "" } }])), /alt/);
  const ok = cleanPairs([...pairs.slice(0, 3), { term: " x ", definition: " y ", definitionImage: { url: "https://ok/a.png", alt: " pic " } }]) as Pair[];
  assert.deepEqual(ok[3], { term: "x", definition: "y", definitionImage: { url: "https://ok/a.png", alt: "pic" } });
});
t("cleanItems: 2–8 non-empty, repeats allowed", () => {
  assert.deepEqual(cleanItems([" a ", "b"]), ["a", "b"]);
  assert.deepEqual(cleanItems(["a", "a"]), ["a", "a"]);
  assert.match(String(cleanItems(["only"])), /at least 2/);
  assert.match(String(cleanItems(Array.from({ length: 9 }, (_, i) => `i${i}`))), /at most 8/);
  assert.match(String(cleanItems(["a", " "])), /some text/);
});
t("cleanKindResponse keeps only plausible arrangements", () => {
  assert.deepEqual(cleanKindResponse({ kind: "order", items: ["a", 2, "b"] }), { kind: "order", items: ["a", "b"] });
  assert.deepEqual(cleanKindResponse({ kind: "match", pairs: [{ term: "a", definition: "b", extra: 1 }, { term: 1 }] }), { kind: "match", pairs: [{ term: "a", definition: "b" }] });
  assert.equal(cleanKindResponse("x"), undefined);
  assert.equal(cleanKindResponse({ kind: "other", items: [] }), undefined);
  assert.equal((cleanKindResponse({ kind: "order", items: Array.from({ length: 50 }, () => "a") }) as { items: string[] }).items.length, 8);
});

console.log("shuffle + no answer leak");
t("the shuffle is deterministic per seed and differs between seeds", () => {
  const a = presentOrder(seq, "attempt1:q1");
  assert.deepEqual(a, presentOrder(seq, "attempt1:q1"), "refresh must not reshuffle");
  assert.deepEqual([...a].sort(), [...seq].sort(), "same items, just moved");
  assert.ok(Array.from({ length: 12 }, (_, i) => presentOrder(seq, `attempt${i}:q1`).join("|")).some((x) => x !== a.join("|")), "other attempts get other arrangements");
  assert.deepEqual(seededShuffle([1, 2, 3, 4, 5], "s"), seededShuffle([1, 2, 3, 4, 5], "s"));
});
t("a student is never handed the key already in place", () => {
  for (let i = 0; i < 300; i++) {
    assert.notDeepEqual(presentOrder(seq, `a${i}:q`), seq, `order ${i}`);
    assert.notDeepEqual(presentOrder(["x", "y"], `a${i}:q`), ["x", "y"], `2 items ${i}`);
    const m = presentMatch(pairs, `a${i}:q`);
    assert.notDeepEqual(m.definitions.map((d) => d.text), pairs.map((p) => p.definition), `match ${i}`);
  }
  assert.deepEqual(presentOrder(["same", "same"], "a:q"), ["same", "same"], "nothing to shuffle is fine");
});
t("presentMatch: terms as written, definitions shuffled, and no key in the payload", () => {
  const withPics: Pair[] = pairs.map((p, i) => ({ ...p, termImage: i === 0 ? { url: "https://x.example/t.png", alt: "top" } : undefined }));
  const m = presentMatch(withPics, "att:q");
  assert.deepEqual(m.terms.map((x) => x.text), pairs.map((p) => p.term));
  assert.equal(m.terms[0].image?.url, "https://x.example/t.png");
  assert.deepEqual(m.definitions.map((x) => x.text).sort(), pairs.map((p) => p.definition).sort());
  const wire = JSON.stringify(m);
  assert.ok(!/"pairs"|"answer"|"correct"|"termImage"|"definitionImage"/.test(wire), "no key-shaped fields");
  assert.deepEqual(Object.keys(m).sort(), ["definitions", "terms"]);
});
t("presentOrder returns only the item strings", () => {
  const o = presentOrder(seq, "att:q");
  assert.ok(o.every((x) => typeof x === "string"));
  assert.equal(o.length, seq.length);
});

console.log("settings");
t("defaults carry match + order + tool; an old five-kind tenant list gains them; a customised list is left alone", () => {
  assert.deepEqual(HUB_DEFAULTS.questionKinds.filter((k) => k.mark === "match" || k.mark === "order").map((k) => k.id), ["match", "order"]);
  const legacy = [{ id: "single", label: "Single", mark: "choice" as const }, { id: "multi", label: "Multi", mark: "multi" as const }, { id: "short", label: "Short", mark: "exact" as const }, { id: "number", label: "Num", mark: "numeric" as const }, { id: "written", label: "Written", mark: "manual" as const }];
  assert.deepEqual(mergeHub({ questionKinds: legacy }).questionKinds.map((k) => k.id), ["single", "multi", "short", "number", "match", "order", "tool", "written"]);
  // a kind the tenant already has (here "match", renamed) is not added twice; only the missing one is
  assert.deepEqual(mergeHub({ questionKinds: [...legacy.slice(0, 4), { id: "match", label: "Pairs", mark: "match" }, legacy[4]] }).questionKinds.map((k) => k.id), ["single", "multi", "short", "number", "match", "order", "tool", "written"]);
  assert.deepEqual(mergeHub({ questionKinds: [{ id: "x", label: "X", mark: "exact" }] }).questionKinds.map((k) => k.id), ["x"]);
});

console.log(`\n${n} hub kind tests passed`);
