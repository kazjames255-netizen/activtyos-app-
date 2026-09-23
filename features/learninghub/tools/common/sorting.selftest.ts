import { SEQUENCE_SETS, SORT_SETS, VENN_SETS } from "./packs";
import { misplacedIds, nextHint, nextSequenceHint, scoreSequence, scoreSort, seededShuffle, shuffleSteps, validateSequenceSet, validateSortSet, validateVennSet, wrongPositions, type Placement } from "./sorting";

let n = 0, bad = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { bad++; console.error("FAIL:", m); } };

// validators over every pack
for (const s of SORT_SETS) { const e = validateSortSet(s); ok(e.length === 0, `sort ${s.id}: ${e.join("; ")}`); }
for (const s of SEQUENCE_SETS) { const e = validateSequenceSet(s); ok(e.length === 0, `seq ${s.id}: ${e.join("; ")}`); }
for (const s of VENN_SETS) { const e = validateVennSet(s); ok(e.length === 0, `venn ${s.id}: ${e.join("; ")}`); }
const allIds = [...SORT_SETS, ...SEQUENCE_SETS, ...VENN_SETS].map((s) => s.id);
ok(new Set(allIds).size === allIds.length, "set ids unique across packs");

// coverage
const cnt = (xs: { subject: string }[], sub: string) => xs.filter((x) => x.subject === sub).length;
ok(SORT_SETS.length >= 30, `>=30 sort sets (${SORT_SETS.length})`);
ok(SEQUENCE_SETS.length >= 15, `>=15 sequence sets (${SEQUENCE_SETS.length})`);
ok(VENN_SETS.length >= 6, `>=6 venn sets (${VENN_SETS.length})`);
ok(cnt(SORT_SETS, "science") >= 13, "science sorts >= 13");
ok(cnt(SORT_SETS, "maths") >= 6, "maths sorts >= 6");
ok(cnt(SORT_SETS, "english") >= 5, "english sorts >= 5");
ok(cnt(SORT_SETS, "languages") >= 3, "languages sorts >= 3");
ok(cnt(SORT_SETS, "humanities") >= 3, "humanities sorts >= 3");
ok(cnt(SEQUENCE_SETS, "science") >= 10, "science sequences >= 10");
ok(SORT_SETS.every((s) => s.keyStages.every((k) => k >= 1 && k <= 5)), "key stages in range");

// shuffle
const arr = [1, 2, 3, 4, 5, 6, 7, 8];
const a1 = seededShuffle(arr, 42), a2 = seededShuffle(arr, 42);
ok(JSON.stringify(a1) === JSON.stringify(a2), "seeded shuffle deterministic");
ok([...a1].sort().join() === arr.join(), "shuffle is a permutation");
ok(JSON.stringify(seededShuffle(arr, 1)) !== JSON.stringify(seededShuffle(arr, 2)), "different seeds differ");
ok(JSON.stringify(arr) === "[1,2,3,4,5,6,7,8]", "shuffle does not mutate input");
let shuffleBad = "";
for (const s of SEQUENCE_SETS) for (let seed = 1; seed <= 40; seed++) {
  const sh = shuffleSteps(s.steps, seed);
  if (sh.every((x, i) => x.id === s.steps[i]!.id) || sh.length !== s.steps.length || new Set(sh.map((x) => x.id)).size !== s.steps.length) { shuffleBad = `${s.id}@${seed}`; break; }
}
ok(shuffleBad === "", `shuffleSteps never returns the correct order ${shuffleBad}`);

// sort scoring
const set = SORT_SETS[0]!;
const perfect: Placement = Object.fromEntries(set.cards.map((c) => [c.id, c.cat]));
const rp = scoreSort(set, perfect);
ok(rp.score === set.cards.length && rp.max === set.cards.length, "perfect sort full marks");
ok(scoreSort(set, {}).score === 0 && scoreSort(set, {}).max === set.cards.length, "empty sort zero");
const one: Placement = { ...perfect, [set.cards[0]!.id]: "k1" };
ok(scoreSort(set, one).score === set.cards.length - 1, "one wrong loses one mark");
ok(misplacedIds(set, one).length === 1 && misplacedIds(set, one)[0] === set.cards[0]!.id, "misplaced id found");
ok(scoreSort(set, { ...perfect, nonsense: "k0" }).score === set.cards.length, "unknown card id ignored");
const half: Placement = Object.fromEntries(set.cards.slice(0, 4).map((c) => [c.id, c.cat]));
ok(scoreSort(set, half).score === 4, "partial placement scores placed cards");
const vs = VENN_SETS[0]!;
ok(scoreSort(vs, Object.fromEntries(vs.cards.map((c) => [c.id, c.zone]))).score === vs.cards.length, "perfect venn");
ok(scoreSort(vs, Object.fromEntries(vs.cards.map((c) => [c.id, "both"]))).score < vs.cards.length, "all-in-both venn not perfect");

// sequence scoring
const q = SEQUENCE_SETS[0]!, ids = q.steps.map((s) => s.id);
ok(scoreSequence(q, ids).score === scoreSequence(q, ids).max, "perfect sequence");
ok(scoreSequence(q, [...ids].reverse()).score < scoreSequence(q, ids).max, "reversed sequence not full");
ok(scoreSequence(q, []).score === 0, "empty sequence zero");
ok(scoreSequence(q, [ids[0]!, ids[0]!, ids[0]!, ids[0]!]).score < scoreSequence(q, ids).max, "duplicate placements not full marks");
const swapped = [...ids]; [swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!];
ok(wrongPositions(q, swapped).join() === "1,2", "wrong positions numbers only");
ok(wrongPositions(q, ids).length === 0, "no wrong positions when perfect");

// hints
let leak = 0, hints = 0;
for (const s of SORT_SETS) for (const c of s.cards) {
  const p: Placement = Object.fromEntries(s.cards.map((x) => [x.id, x.cat]));
  p[c.id] = s.categories.find((k) => k.id !== c.cat)!.id;
  const h = nextHint(s, p)!; hints++;
  const label = s.categories.find((k) => k.id === c.cat)!.label;
  if (!h || h.includes(label) || !h.includes(c.text)) leak++;
}
ok(hints > 100 && leak === 0, `sort hints never reveal category (${leak} leaks of ${hints})`);
ok(nextHint(set, perfect) === null, "no hint when perfect");
let sl = 0;
for (const s of SEQUENCE_SETS) {
  const o = s.steps.map((x) => x.id); [o[0], o[1]] = [o[1]!, o[0]!];
  const h = nextSequenceHint(s, o);
  if (!h) sl++;
  if (nextSequenceHint(s, s.steps.map((x) => x.id)) !== null) sl++;
}
ok(sl === 0, "sequence hints exist when wrong and are null when correct");

// validator negatives
const dup = { ...set, cards: [...set.cards, set.cards[0]!] };
ok(validateSortSet(dup).length > 0, "validator catches duplicate card");
ok(validateSortSet({ ...set, cards: set.cards.map((c) => ({ ...c, cat: "zz" })) }).length > 0, "validator catches unknown category");
ok(validateSequenceSet({ ...q, steps: q.steps.slice(0, 3) }).length > 0, "validator catches short sequence");
ok(validateSortSet({ ...set, cards: set.cards.slice(0, 3) }).length > 0, "validator catches too few cards");

console.log(`${n} checks, ${bad} failed`);
process.exit(bad ? 1 : 0);
