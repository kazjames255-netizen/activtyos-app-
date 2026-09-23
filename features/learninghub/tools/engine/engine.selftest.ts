// Run: npx tsx features/learninghub/tools/engine/engine.selftest.ts
import * as g from "./geometry";
import { makeRng } from "./rng";
import { commit, newHistory, redo, undo, unwrap, wrap, canUndo, canRedo } from "./state";

let n = 0, bad = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { bad++; console.error("FAIL:", m); } };
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;

// directions: up = 90, right = 0
ok(near(g.dirOf([0, 0], [1, 0]), 0), "east = 0°");
ok(near(g.dirOf([0, 0], [0, -1]), 90), "up = 90°");
ok(near(g.dirOf([0, 0], [-1, 0]), 180), "west = 180°");
ok(near(g.dirOf([0, 0], [0, 1]), 270), "down = 270°");
ok(near(g.angleAt([0, 0], [1, 0], [0, -1]), 90), "angleAt anticlockwise");
ok(near(g.interiorAngle([0, 0], [1, 0], [0, 1]), 90), "interior 90");
const r = g.rotateAbout([10, 0], [0, 0], 90);
ok(near(r[0], 0) && near(r[1], -10), "rotate east 90° anticlockwise → up");
ok(near(g.norm180(190), -170) && near(g.norm360(-10), 350), "normalise");
ok(near(g.lineAngDiff(0, 180), 0) && near(g.lineAngDiff(10, 100), 90) && near(g.lineAngDiff(5, 175), 10), "line angle diff");

// bearings: north = up
ok(near(g.bearingOf([0, 0], [0, -5]), 0), "north = 000");
ok(near(g.bearingOf([0, 0], [5, 0]), 90), "east = 090");
ok(near(g.bearingOf([0, 0], [0, 5]), 180), "south = 180");
ok(near(g.bearingOf([0, 0], [-5, 0]), 270), "west = 270");
ok(g.fmt3(7) === "007°" && g.fmt3(359.6) === "000°", "3-figure format");
for (let b = 0; b < 360; b += 7) { const q = g.fromBearing([3, 4], b, 50); ok(near(g.bearingOf([3, 4], q), b, 1e-6) && near(g.dist([3, 4], q), 50, 1e-6), `bearing round trip ${b}`); }

// intersections
const x = g.lineIntersect({ a: [0, 0], b: [10, 10] }, { a: [0, 10], b: [10, 0] });
ok(!!x && near(x[0], 5) && near(x[1], 5), "line intersect");
ok(g.lineIntersect({ a: [0, 0], b: [1, 0] }, { a: [0, 1], b: [1, 1] }) === null, "parallel → null");
ok(g.segIntersect({ a: [0, 0], b: [1, 0] }, { a: [5, -1], b: [5, 1] }) === null, "segments that miss");
const cc = g.circleCircle([0, 0], 5, [6, 0], 5);
ok(cc.length === 2 && cc.every((p) => near(g.dist(p, [0, 0]), 5) && near(g.dist(p, [6, 0]), 5)), "circle/circle");
ok(g.circleCircle([0, 0], 1, [10, 0], 1).length === 0, "circles too far");
const lc = g.lineCircle({ a: [-10, 0], b: [10, 0] }, [0, 0], 5);
ok(lc.length === 2 && near(Math.abs(lc[0]![0]), 5), "line/circle");
const pb = g.perpBisector([0, 0], [10, 0]);
ok(near(g.lineAngDiff(g.dirOf(pb.a, pb.b), 0), 90) && near(g.distToLine(pb, [5, 0]), 0), "perp bisector");
ok(near(g.bisectorDir([0, 0], [1, 0], [0, -1]), 45), "angle bisector");
ok(g.inSweep(10, 350, 30) && !g.inSweep(100, 350, 30), "sweep wraps 0");
ok(near(g.distToSeg({ a: [0, 0], b: [10, 0] }, [15, 0]), 5) && near(g.distToLine({ a: [0, 0], b: [10, 0] }, [15, 3]), 3), "distances");

// rng is reproducible and in range
const a = makeRng(42), b = makeRng(42);
for (let i = 0; i < 100; i++) ok(a.next() === b.next(), "rng reproducible");
const r3 = makeRng(7);
for (let i = 0; i < 1000; i++) { const v = r3.int(3, 9); ok(v >= 3 && v <= 9 && Number.isInteger(v), "rng int range"); }
ok(makeRng(1).shuffle([1, 2, 3, 4, 5]).sort().join() === "1,2,3,4,5", "shuffle keeps items");

// history
let h = newHistory(0);
ok(!canUndo(h) && !canRedo(h), "fresh history");
h = commit(h, 1); h = commit(h, 2);
ok(h.present === 2 && canUndo(h), "commit");
h = undo(h); ok(h.present === 1 && canRedo(h), "undo");
h = redo(h); ok(h.present === 2, "redo");
h = undo(h); h = commit(h, 9);
ok(!canRedo(h) && h.present === 9, "commit clears redo");
ok(commit(h, h.present) === h, "same value is not a step");
let big = newHistory(0); for (let i = 1; i <= 500; i++) big = commit(big, i);
ok(big.past.length <= 200 && big.present === 500, "history is capped");

// envelope
const env = wrap("t", 2, { a: 1 });
ok(JSON.stringify(unwrap(env, "t", 2, () => ({ a: -1 }), () => ({ a: 0 }))) === '{"a":1}', "unwrap same version");
ok(unwrap(wrap("t", 1, { old: true }), "t", 2, (o) => ({ a: (o as { old: boolean }).old ? 7 : 0 }), () => ({ a: 0 })).a === 7, "migrate old version");
ok(unwrap(null, "t", 2, () => ({ a: -1 }), () => ({ a: 0 })).a === 0, "garbage → initial");
ok(unwrap(wrap("other", 2, { a: 5 }), "t", 2, () => ({ a: -1 }), () => ({ a: 0 })).a === 0, "wrong tool → initial");
ok(unwrap(wrap("t", 9, { a: 5 }), "t", 2, () => ({ a: -1 }), () => ({ a: 0 })).a === 0, "future version → initial");

console.log(`${n} checks, ${bad} failed`);
process.exit(bad ? 1 : 0);
