// Run: server/node_modules/.bin/tsx features/learninghub/tools/problems.selftest.ts
import { cleanToolAnswer, GENERATOR_LABEL, isBlankToolAnswer, markTool, publicProblem, PROBLEM_GENERATORS } from "./problems";
let n = 0, bad = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { bad++; console.error("FAIL:", m); } };
ok(Object.keys(PROBLEM_GENERATORS).every((k) => k in GENERATOR_LABEL) && Object.keys(GENERATOR_LABEL).every((k) => k in PROBLEM_GENERATORS), "every generator has a label and vice versa");
for (const [id, gen] of Object.entries(PROBLEM_GENERATORS)) {
  for (let seed = 1; seed <= 200; seed++) {
    const p = gen(seed), pub = publicProblem(p);
    // NO LEAK: the public problem holds no model answer / checker data, and the JSON never contains them
    const json = JSON.stringify(pub);
    ok(!("model" in pub) && !("checkerParams" in pub) && !("checkerId" in pub) && !("maxScore" in pub), `${id}: public problem has no answer fields`);
    ok(!json.includes("checkerParams") && !json.includes('"model"'), `${id}: nothing answer-like in the JSON`);
    // full marks for the model answer, via the server's own path (re-generating from the seed)
    const full = markTool({ generatorId: id, seed }, p.model, 4);
    ok(!!full && full.correct && full.marksAwarded === 4, `${id} seed ${seed}: model answer earns all 4 marks`);
    const none = markTool({ generatorId: id, seed }, null, 4);
    ok(!!none && !none.correct && none.marksAwarded === 0, `${id}: no answer earns 0`);
  }
}
// the measure-angle answer must not be derivable from what the child is sent
const p = PROBLEM_GENERATORS["M-G01.measure"]!(11), sent = JSON.stringify(publicProblem(p));
ok(!sent.includes(String(p.model.number) + "°") && !/"expected"/.test(sent), "the angle size is not in what the child receives");
// partial credit
const tri = PROBLEM_GENERATORS["M-G02.triangle"]!(3);
const partial = markTool({ generatorId: "M-G02.triangle", seed: 3 }, { marks: (tri.model.marks ?? []).filter((m) => m.k !== "arc") }, 4);
ok(!!partial && partial.marksAwarded === 3 && !partial.correct, `right triangle but no construction arcs → 3 of 4 marks (got ${partial?.marksAwarded})`);
// cleaning
ok(cleanToolAnswer("x") === null && cleanToolAnswer([1]) === null && cleanToolAnswer(null) === null, "non-objects rejected");
const dirty = cleanToolAnswer({ number: 5, marks: [{ k: "seg", a: [1, 2], b: [3, 4] }, { k: "seg", a: ["x", 2], b: [3, 4] }, { k: "bogus" }, { k: "arc", c: [0, 0], r: -3, a0: 0, a1: 90 }, "junk"], points: [[1, 2], [Infinity, 3], "z"] });
ok(dirty?.number === 5 && dirty.marks?.length === 1 && dirty.points?.length === 1, "bad marks / points dropped, good ones kept");
ok(cleanToolAnswer({ marks: Array.from({ length: 1000 }, () => ({ k: "seg", a: [0, 0], b: [1, 1] })) })!.marks!.length === 300, "mark count capped");
ok(cleanToolAnswer({ number: 1e20 })!.number === undefined, "absurd numbers dropped");
ok(isBlankToolAnswer(null) && isBlankToolAnswer({}) && isBlankToolAnswer({ number: null, marks: [] }) && !isBlankToolAnswer({ number: 0 }) && !isBlankToolAnswer({ points: [[1, 1]] }), "blank detection");
ok(markTool({ generatorId: "nope", seed: 1 }, {}, 1) === null, "unknown generator → null (caller decides)");
ok(markTool({ generatorId: "M-G01.measure", seed: 5, tol: { deg: 6 } }, { number: (PROBLEM_GENERATORS["M-G01.measure"]!(5).model.number as number) + 5 }, 1)!.correct, "a question can carry its own looser tolerance");
console.log(`${n} checks, ${bad} failed`);
process.exit(bad ? 1 : 0);
