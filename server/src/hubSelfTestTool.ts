// Tool questions end to end WITHOUT a database: authoring → attempt snapshot → what the child receives → hand-in → marking.
// Run: cd server && npx tsx src/hubSelfTestTool.ts
import assert from "node:assert/strict";
import { HUB_DEFAULTS, mergeHub } from "../../lib/hubConfig";
import { markResponse, scoreAttempt } from "./lib/hubScoring";
import { cleanResponse, questionOut, snapshotQuestions } from "./routes/hub/attempts";
import { questionFields } from "./routes/hub/questions";
import { PROBLEM_GENERATORS } from "../../features/learninghub/tools/problems";
import type { AssessmentDoc, QuestionDoc } from "./routes/hub/shared";

let n = 0; const ok = (c: boolean, m: string) => { n++; assert.ok(c, m); };
const cfg = HUB_DEFAULTS;

// settings: a "tool" kind exists by default, and a tenant on the old defaults gets it slotted in
ok(cfg.questionKinds.some((k) => k.mark === "tool"), "default kinds include a tool question");
const legacy = mergeHub({ questionKinds: [{ id: "single", label: "S", mark: "choice" }, { id: "multi", label: "M", mark: "multi" }, { id: "short", label: "T", mark: "exact" }, { id: "number", label: "N", mark: "numeric" }, { id: "written", label: "W", mark: "manual" }] });
ok(legacy.questionKinds.some((k) => k.mark === "tool") && legacy.questionKinds.some((k) => k.mark === "match"), "a tenant on the five legacy kinds gains match, order AND tool");
const custom = mergeHub({ questionKinds: [{ id: "a", label: "A", mark: "choice" }] });
ok(!custom.questionKinds.some((k) => k.mark === "tool"), "a tenant with its own custom list is left exactly as written");

// authoring
const body = (o: object) => ({ topicId: "t1", kind: "tool", prompt: "Measure it", options: [], acceptedAnswers: [], tolerance: 0, marks: 4, explanation: "", published: true, ...o }) as never;
const good = questionFields(cfg, body({ tool: { generatorId: "M-G01.measure" } }));
ok(typeof good !== "string" && good.tool?.generatorId === "M-G01.measure" && good.answer === null, "valid tool question stores a generator and NO answer key");
ok(typeof questionFields(cfg, body({})) === "string", "tool question without a generator refused");
ok(typeof questionFields(cfg, body({ tool: { generatorId: "../evil" } })) === "string", "unknown generator refused");
ok(typeof questionFields(cfg, body({ tool: { generatorId: "M-G01.measure", tol: { deg: 5 } } })) !== "string", "own tolerance accepted");

// attempt snapshot
const qdoc = (extra: Partial<QuestionDoc> = {}): QuestionDoc => ({ tenantId: "T", franchiseId: null, topicId: "t1", kind: "tool", prompt: "Measure the angle", options: [], answer: null, acceptedAnswers: [], tolerance: 0, marks: 4, explanation: "", published: true, createdBy: "u", createdAt: "", updatedAt: "", tool: { generatorId: "M-G01.measure" }, ...extra });
const snapDoc = (id: string, d: QuestionDoc) => ({ exists: true, id, data: () => d }) as never;
const asm = { questionIds: ["q1", "q2"], type: "quiz" } as unknown as AssessmentDoc;
const snapsA = snapshotQuestions("T", asm, cfg, { franchiseId: null }, [snapDoc("q1", qdoc()), snapDoc("q2", qdoc({ tool: { generatorId: "M-G02.perpBisector", seed: 4242 } }))]);
const snapsB = snapshotQuestions("T", asm, cfg, { franchiseId: null }, [snapDoc("q1", qdoc()), snapDoc("q2", qdoc({ tool: { generatorId: "M-G02.perpBisector", seed: 4242 } }))]);
ok(snapsA.length === 2 && snapsA.every((s) => s.mark === "tool" && s.tool), "both snapshotted as tool questions with a dealt seed");
ok(snapsA[1]!.tool!.seed === 4242 && snapsB[1]!.tool!.seed === 4242, "a pinned seed is honoured");
ok(snapsA[0]!.tool!.seed !== snapsB[0]!.tool!.seed, "an unpinned seed differs between attempts (regenerating question)");

// what the CHILD receives
const out = questionOut(snapsA[0]!, "http://x", "att1");
const json = JSON.stringify(out);
ok("toolProblem" in out && (out as { toolProblem: { prompt: string } }).toolProblem.prompt.length > 5, "the child receives the problem's prompt and given marks");
for (const bad of ["checkerParams", "checkerId", '"model"', "maxScore", '"answer":"', "expected"]) ok(!json.includes(bad), `the child's copy contains no "${bad}"`);
ok(out.marks === 4 && !("answer" in out), "no answer key field on the question sent");

// hand-in: cleaning
ok(cleanResponse({ kind: "tool", number: 68 }) !== null && (cleanResponse({ kind: "tool", number: 68 }) as { number: number }).number === 68, "a typed number survives cleaning");
ok(cleanResponse({ kind: "tool" }) === null && cleanResponse({ kind: "tool", marks: [] }) === null, "an empty hand-in becomes null");
ok(cleanResponse({ kind: "tool", marks: [{ k: "seg", a: [1, 2], b: [9, 9] }, { k: "evil" }] }) !== null, "junk marks dropped, good kept");
ok(cleanResponse("hello") === "hello" && cleanResponse(5) === 5, "other kinds untouched");

// marking, exactly as the submit route calls it
const answerFor = (s: (typeof snapsA)[number]) => { const p = PROBLEM_GENERATORS[s.tool!.generatorId]!(s.tool!.seed); return p.expects === "number" ? { kind: "tool", number: p.model.number } : { kind: "tool", marks: p.model.marks }; };
for (const s of snapsA) {
  const good = markResponse({ mark: s.mark, answer: s.answer, marks: s.marks, tool: s.tool }, cleanResponse(answerFor(s)));
  ok(good.correct === true && good.marksAwarded === 4 && !good.pending && (good.feedback?.length ?? 0) > 0, `${s.tool!.generatorId}: the model answer earns all 4 marks and returns checker lines`);
  const none = markResponse({ mark: s.mark, answer: s.answer, marks: s.marks, tool: s.tool }, null);
  ok(none.correct === false && none.marksAwarded === 0, "no answer earns 0");
}
const half = markResponse({ mark: "tool", answer: null, marks: 3, tool: { generatorId: "M-G02.triangle", seed: 3 } }, cleanResponse({ kind: "tool", marks: (PROBLEM_GENERATORS["M-G02.triangle"]!(3).model.marks ?? []).filter((m) => m.k !== "arc") }));
ok(half.marksAwarded === 2.25 && half.correct === false, `partial credit is kept (got ${half.marksAwarded} of 3)`);
ok(markResponse({ mark: "tool", answer: null, marks: 1 }, { kind: "tool", number: 5 }).correct === false, "no tool spec → wrong, never a crash");
// scoring an attempt with fractional marks
const sc = scoreAttempt([{ topicId: "a", correct: false, marksAwarded: 2.25, marksMax: 3, pending: false }, { topicId: "a", correct: true, marksAwarded: 1, marksMax: 1, pending: false }], 70);
ok(sc.status === "marked" && sc.pct === 81 && sc.scoreMarks === 3.25, `attempt score handles partial marks (${sc.pct}%)`);
console.log(`${n} checks passed`);
process.exit(0);
