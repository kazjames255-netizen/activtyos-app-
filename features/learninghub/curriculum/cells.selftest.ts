// Run: server/node_modules/.bin/tsx features/learninghub/curriculum/cells.selftest.ts
import { byStrand, defaultYear, expectedInYear, extraInYear, parseYear, yearSummary, cellKind, childSummary, rowsByArea, summarise, visibleYears, type MapArea, type MapRow } from "./cells";
let n = 0, bad = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { bad++; console.error("FAIL:", m); } };
const y = (o: Record<number, number>) => Array.from({ length: 11 }, (_, i) => o[i + 1] ?? 0);
const A: MapArea = { id: "a", subject: "maths", group: "maths", strand: "Number", area: "Fractions", code: null, y: y({ 3: 40, 4: 2, 5: 0, 7: 3 }), done: y({ 3: 10 }) };
const B: MapArea = { id: "b", subject: "maths", group: "maths", strand: "Number", area: "Statistics", code: null, y: y({}) };
const C: MapArea = { id: "c", subject: "maths", group: "maths", strand: "Algebra", area: "Equations", code: null, y: y({ 8: 5 }) };
const rows: MapRow[] = [
  { areaId: "a", from: 3, to: 3, lessons: 40, status: "covered" }, { areaId: "a", from: 4, to: 4, lessons: 2, status: "thin" }, { areaId: "a", from: 5, to: 5, lessons: 0, status: "gap" },
  { areaId: "b", from: 2, to: 2, lessons: 0, status: "gap" }, { areaId: "c", from: 7, to: 9, lessons: 5, status: "covered" },
];
const by = rowsByArea(rows);
ok(cellKind("tutor", A, 3, by).kind === "covered", "40 lessons = covered");
ok(cellKind("tutor", A, 4, by).kind === "thin", "2 lessons = thin");
ok(cellKind("tutor", A, 5, by).kind === "gap", "expected, none = gap");
ok(cellKind("tutor", A, 7, by).kind === "extra" && cellKind("tutor", A, 7, by).count === 3, "lessons the curriculum doesn't ask for = extra");
ok(cellKind("tutor", A, 1, by).kind === "na", "nothing expected, nothing there = na");
ok(cellKind("tutor", C, 8, by).kind === "covered" && cellKind("tutor", C, 7, by).kind === "covered" && cellKind("tutor", C, 9, by).kind === "covered", "a key-stage span is judged as a whole (5 lessons in Y8 makes Y7–9 covered)");
ok(cellKind("tutor", C, 8, by).span?.from === 7 && cellKind("tutor", C, 8, by).span?.to === 9, "span reported");
ok(cellKind("child", A, 3, by).kind === "done", "child: finished = done");
ok(cellKind("child", A, 4, by).kind === "assigned", "child: given, none finished = assigned");
ok(cellKind("child", A, 5, by).kind === "todo", "child: expected, nothing given = to-do (not a failure)");
ok(cellKind("child", A, 1, by).kind === "na", "child: not expected = na");
ok(visibleYears([A, B, C], by).join() === "2,3,4,5,7,8,9", `year columns (got ${visibleYears([A, B, C], by).join()})`);
const s = summarise(rows, new Set(["a", "b", "c"]));
ok(s.checked === 5 && s.covered === 2 && s.thin === 1 && s.gaps === 2 && s.pct === 40, `summary ${JSON.stringify(s)}`);
ok(summarise(rows, new Set(["zzz"])).pct === 0, "empty subject → 0%, no divide by zero");
const cs = childSummary([A, B, C], rows);
ok(cs.total === 50 && cs.done === 10 && cs.expected === 5 && cs.touched === 3, `child summary ${JSON.stringify(cs)}`);
ok(byStrand([A, B, C]).map(([s, l]) => `${s}:${l.length}`).join() === "Number:2,Algebra:1", "strand grouping keeps order");
const e7 = expectedInYear([A, B, C], 7, by), e5 = expectedInYear([A, B, C], 5, by);
ok(e7.map((i) => i.area.id).join() === "c", "Y7 lists only Equations (span Y7-9), never Algebra-less areas");
ok(e5.map((i) => i.area.id).join() === "a" && e5[0]!.cell.kind === "gap", "Y5: only Fractions, as a gap");
ok(expectedInYear([A, B, C], 1, by).length === 0, "a year nothing expects lists nothing");
ok(extraInYear([A, B, C], 7, by) === 3, "Fractions Y7 lessons = extra note, not a gap");
ok(yearSummary(expectedInYear([A, B, C], 3, by)).covered === 1 && yearSummary(e5).gaps === 1, "year summary");
ok(parseYear("Year 5") === 5 && parseYear("Y11") === 11 && parseYear("Reception") === null && parseYear(null) === null && parseYear("Year 13") === null, "parseYear");
ok(defaultYear([3, 4, 5], [4, 4, 5, null], [A]) === 4, "most common student year");
ok(defaultYear([3, 4, 5], [9], [A]) === 3, "no student match: year with most lessons");
ok(defaultYear([], [4], [A]) === null, "no years");
console.log(`${n} checks, ${bad} failed`);
process.exit(bad ? 1 : 0);
