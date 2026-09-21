// Self-test for the whiteboard state machine: `npx tsx features/learninghub/live/board/reducer.selftest.ts`
import assert from "node:assert/strict";
import { PT, TUTOR, nextV, reserveV, boundsOf, fitToLimit, fromSaved, hitTest, movePatch, newState, saveSize, simplifyPts, sorted, toSaved, type BoardState, type El, type Op, type Sender } from "./model";
import { History, SLICE_PTS, actionOps, applyAll, applyOp, elementOps, packOps, snapshotOps } from "./reducer";

let n = 0;
const t = (name: string, fn: () => void) => { try { fn(); n++; console.log(`  ok  ${name}`); } catch (e) { console.error(`  FAIL ${name}\n`, e); process.exitCode = 1; } };

const kid: Sender = { tutor: false, own: "c:kid1", by: "Ava", cid: "kid1" };
const kid2: Sender = { tutor: false, own: "c:kid2", by: "Ben", cid: "kid2" };
const stroke = (id: string, v: number, pts = 3, own = "T", extra: Partial<El> = {}): El => ({ id, k: "stroke", own, z: v, v, c: "#000", w: 4, pts: Array.from({ length: pts * PT }, (_, i) => (i % PT === 2 ? 50 : i)), ...extra });
const els = (s: BoardState, page = "p1") => sorted(s.pages.find((p) => p.id === page)!).map((e) => e.id);

console.log("whiteboard reducer");

t("add + streamed points; duplicate delivery is ignored", () => {
  const s = newState();
  assert.equal(applyOp(s, { op: "add", page: "p1", el: stroke("a", 1, 2) }, TUTOR).changed, true);
  assert.equal(applyOp(s, { op: "add", page: "p1", el: stroke("a", 1, 2) }, TUTOR).changed, false);
  const more = [1, 2, 50, 3, 4, 50];
  assert.equal(applyOp(s, { op: "pts", page: "p1", id: "a", from: 2, pts: more }, TUTOR).changed, true);
  assert.equal(s.pages[0]!.els.get("a")!.pts!.length, 4 * PT);
  // the same slice again, and an overlapping one, add nothing new
  assert.equal(applyOp(s, { op: "pts", page: "p1", id: "a", from: 2, pts: more }, TUTOR).changed, false);
  assert.equal(applyOp(s, { op: "pts", page: "p1", id: "a", from: 3, pts: [9, 9, 50, 7, 7, 50] }, TUTOR).changed, true);
  assert.equal(s.pages[0]!.els.get("a")!.pts!.length, 5 * PT);
});

t("a gap in streamed points is reported so the owner can resend", () => {
  const s = newState();
  applyOp(s, { op: "add", page: "p1", el: stroke("a", 1, 2) }, TUTOR);
  const r = applyOp(s, { op: "pts", page: "p1", id: "a", from: 5, pts: [1, 1, 50] }, TUTOR);
  assert.deepEqual(r.gap, { id: "a", have: 2 });
  assert.equal(s.pages[0]!.els.get("a")!.pts!.length, 2 * PT);
});

t("locked board: student ops are ignored", () => {
  const s = newState();
  const r = applyOp(s, { op: "add", page: "p1", el: stroke("k", 1, 2, "c:kid1") }, kid);
  assert.equal(r.denied, true); assert.deepEqual(els(s), []);
});

t("open board: a student draws in their own name; ownership can't be forged", () => {
  const s = newState();
  applyOp(s, { op: "perm", all: true, ids: [] }, TUTOR);
  const forged = stroke("k", 1, 2, "T", { by: "Teacher" });
  assert.equal(applyOp(s, { op: "add", page: "p1", el: forged }, kid).changed, true);
  const e = s.pages[0]!.els.get("k")!;
  assert.equal(e.own, "c:kid1"); assert.equal(e.by, "Ava"); assert.equal(e.cid, "kid1");
  // a student can't add images or stamps
  assert.equal(applyOp(s, { op: "add", page: "p1", el: { id: "i", k: "image", own: "c:kid1", z: 2, v: 2, imageId: "x", x: 0, y: 0, w: 10, h: 10 } }, kid).denied, true);
});

t("a student edits/deletes only their own elements", () => {
  const s = newState();
  applyOp(s, { op: "perm", all: true, ids: [] }, TUTOR);
  applyOp(s, { op: "add", page: "p1", el: stroke("t1", 1) }, TUTOR);
  applyOp(s, { op: "add", page: "p1", el: stroke("k1", 2) }, kid);
  applyOp(s, { op: "add", page: "p1", el: stroke("k2", 3) }, kid2);
  assert.equal(applyOp(s, { op: "upd", page: "p1", id: "t1", patch: { c: "#f00" }, v: 10 }, kid).denied, true);
  assert.equal(applyOp(s, { op: "upd", page: "p1", id: "k2", patch: { c: "#f00" }, v: 10 }, kid).denied, true);
  assert.equal(applyOp(s, { op: "upd", page: "p1", id: "k1", patch: { c: "#0f0" }, v: 10 }, kid).changed, true);
  assert.equal(applyOp(s, { op: "del", page: "p1", ids: ["t1", "k2"], v: 11 }, kid).changed, false);
  assert.deepEqual(els(s), ["t1", "k1", "k2"]);
  assert.equal(applyOp(s, { op: "del", page: "p1", ids: ["k1"], v: 12 }, kid).changed, true);
  // the tutor can remove anyone's
  assert.equal(applyOp(s, { op: "del", page: "p1", ids: ["k2"], v: 13 }, TUTOR).changed, true);
  assert.deepEqual(els(s), ["t1"]);
});

t("locking again stops a student editing even their own work", () => {
  const s = newState();
  applyOp(s, { op: "perm", all: true, ids: [] }, TUTOR);
  applyOp(s, { op: "add", page: "p1", el: stroke("k1", 2) }, kid);
  applyOp(s, { op: "perm", all: false, ids: [] }, TUTOR);
  assert.equal(applyOp(s, { op: "upd", page: "p1", id: "k1", patch: { c: "#f00" }, v: 5 }, kid).denied, true);
  assert.equal(applyOp(s, { op: "del", page: "p1", ids: ["k1"], v: 5 }, kid).changed, false);
  assert.equal(applyOp(s, { op: "pts", page: "p1", id: "k1", from: 3, pts: [1, 1, 50] }, kid).denied, true);
  assert.deepEqual(els(s), ["k1"]); // their drawing stays
});

t("tutor-only ops are refused from students (clear, background, pages, perm, reset)", () => {
  const s = newState();
  applyOp(s, { op: "perm", all: true, ids: [] }, TUTOR);
  applyOp(s, { op: "add", page: "p1", el: stroke("t1", 1) }, TUTOR);
  const ops: Op[] = [{ op: "clear", page: "p1", v: 9 }, { op: "bg", page: "p1", bg: "graph", v: 9 }, { op: "padd", id: "p2", bg: "blank" }, { op: "pdel", id: "p1" }, { op: "perm", all: false, ids: [] }, { op: "reset" }, { op: "pages", pages: [{ id: "zz", bg: "blank" }] }];
  for (const op of ops) assert.equal(applyOp(s, op, kid).denied, true, op.op);
  assert.deepEqual(els(s), ["t1"]); assert.equal(s.pages.length, 1); assert.equal(s.pages[0]!.bg, "blank"); assert.equal(s.perm.all, true);
});

t("last writer wins on updates; identity fields can't be changed", () => {
  const s = newState();
  applyOp(s, { op: "add", page: "p1", el: { id: "x", k: "text", own: "T", z: 1, v: 1, x: 0, y: 0, text: "a", size: 28, c: "#000" } }, TUTOR);
  applyOp(s, { op: "upd", page: "p1", id: "x", patch: { text: "new" }, v: 20 }, TUTOR);
  assert.equal(applyOp(s, { op: "upd", page: "p1", id: "x", patch: { text: "old" }, v: 10 }, TUTOR).changed, false);
  assert.equal(s.pages[0]!.els.get("x")!.text, "new");
  applyOp(s, { op: "upd", page: "p1", id: "x", patch: { own: "c:evil", id: "y", k: "stroke", by: "Zed" }, v: 30 }, TUTOR);
  const e = s.pages[0]!.els.get("x")!;
  assert.equal(e.own, "T"); assert.equal(e.id, "x"); assert.equal(e.k, "text"); assert.equal(e.by, undefined);
});

t("tombstones: a deleted element does not come back from a late add; a newer add does", () => {
  const s = newState();
  applyOp(s, { op: "add", page: "p1", el: stroke("a", 5) }, TUTOR);
  applyOp(s, { op: "del", page: "p1", ids: ["a"], v: 8 }, TUTOR);
  assert.equal(applyOp(s, { op: "add", page: "p1", el: stroke("a", 5) }, TUTOR).changed, false);
  assert.equal(applyOp(s, { op: "pts", page: "p1", id: "a", from: 3, pts: [1, 1, 5] }, TUTOR).changed, false);
  assert.equal(applyOp(s, { op: "add", page: "p1", el: stroke("a", 9) }, TUTOR).changed, true); // undo's re-add
});

t("clear page: late older adds are ignored, newer ones land", () => {
  const s = newState();
  applyOp(s, { op: "add", page: "p1", el: stroke("a", 5) }, TUTOR);
  applyOp(s, { op: "clear", page: "p1", v: 10 }, TUTOR);
  assert.deepEqual(els(s), []);
  assert.equal(applyOp(s, { op: "add", page: "p1", el: stroke("late", 7) }, TUTOR).changed, false);
  assert.equal(applyOp(s, { op: "add", page: "p1", el: stroke("new", 12) }, TUTOR).changed, true);
});

t("replicas converge whatever the delivery order (adds, updates, deletes)", () => {
  const ops: Op[] = [
    { op: "add", page: "p1", el: stroke("a", 1) }, { op: "add", page: "p1", el: stroke("b", 2) }, { op: "add", page: "p1", el: stroke("c", 3) },
    { op: "upd", page: "p1", id: "a", patch: { c: "#111" }, v: 10 }, { op: "upd", page: "p1", id: "a", patch: { c: "#222" }, v: 11 },
    { op: "del", page: "p1", ids: ["b"], v: 12 },
  ];
  const run = (order: number[]) => { const s = newState(); for (const i of order) applyOp(s, ops[i]!, TUTOR); return JSON.stringify(toSaved(s)); };
  const base = run([0, 1, 2, 3, 4, 5]);
  for (const order of [[5, 4, 3, 2, 1, 0], [1, 5, 0, 4, 2, 3], [2, 0, 3, 5, 1, 4], [4, 3, 0, 1, 2, 5]]) {
    const got = run(order);
    // an update or delete arriving BEFORE its add can't apply (the element isn't there yet): the client re-syncs — compare only when adds came first
    if (order.indexOf(0) < order.indexOf(3) && order.indexOf(0) < order.indexOf(4) && order.indexOf(1) < order.indexOf(5)) assert.equal(got, base);
  }
  assert.equal(JSON.parse(base)[0].elements.length, 2);
  assert.equal(JSON.parse(base)[0].elements.find((e: El) => e.id === "a").c, "#222");
});

t("pages: add, background, delete; the last page can't be deleted", () => {
  const s = newState();
  applyOp(s, { op: "padd", id: "p2", bg: "graph" }, TUTOR);
  applyOp(s, { op: "bg", page: "p1", bg: "lined", v: 1 }, TUTOR);
  assert.deepEqual(s.pages.map((p) => [p.id, p.bg]), [["p1", "lined"], ["p2", "graph"]]);
  applyOp(s, { op: "pdel", id: "p1" }, TUTOR);
  assert.equal(applyOp(s, { op: "pdel", id: "p2" }, TUTOR).changed, false);
  assert.equal(s.pages.length, 1);
});

t("snapshot → chunked messages → a fresh replica equals the original (big strokes included)", () => {
  const s = newState();
  applyOp(s, { op: "padd", id: "p2", bg: "squared" }, TUTOR);
  applyOp(s, { op: "perm", all: true, ids: [] }, TUTOR);
  applyOp(s, { op: "add", page: "p1", el: stroke("big", 1, 6000) }, TUTOR);
  for (let i = 0; i < 30; i++) applyOp(s, { op: "add", page: i % 2 ? "p2" : "p1", el: stroke(`s${i}`, 10 + i, 40) }, i % 3 ? TUTOR : kid);
  applyOp(s, { op: "add", page: "p1", el: { id: "t", k: "text", own: "T", z: 99, v: 99, x: 5, y: 6, text: "Hello ✏️ 2+3=5", size: 40, bold: true, c: "#00f" } }, TUTOR);
  const msgs = packOps(snapshotOps(s));
  assert.ok(msgs.length > 20);
  for (const m of msgs) assert.ok(JSON.stringify({ wb: 1, ops: m }).length < 3300, "message under the 4KB app-message limit");
  const r = newState();
  const res = applyAll(r, msgs.flat(), TUTOR);
  assert.equal(res.gaps.length, 0);
  assert.equal(JSON.stringify(toSaved(r)), JSON.stringify(toSaved(s)));
  assert.equal(r.perm.all, true);
});

t("out-of-order sync slices are healed by a resend request", () => {
  const big = stroke("big", 1, 500);
  const ops = elementOps("p1", big);
  assert.ok(ops.length > 3);
  const r = newState();
  applyOp(r, ops[0]!, TUTOR);
  const skip = applyOp(r, ops[2]!, TUTOR); // slice 2 before slice 1
  assert.ok(skip.gap);
  // owner resends from `have`
  const have = skip.gap!.have;
  applyOp(r, { op: "pts", page: "p1", id: "big", from: have, pts: big.pts!.slice(have * PT, (have + SLICE_PTS) * PT) }, TUTOR);
  for (const o of ops.slice(1)) applyOp(r, o, TUTOR);
  assert.deepEqual(r.pages[0]!.els.get("big")!.pts, big.pts);
});

t("per-student permission: only the students named may write; the rest are ignored", () => {
  const s = newState();
  applyOp(s, { op: "perm", all: false, ids: ["kid1"] }, TUTOR);
  assert.equal(applyOp(s, { op: "add", page: "p1", el: stroke("a", 1) }, kid).changed, true);
  assert.equal(applyOp(s, { op: "add", page: "p1", el: stroke("b", 2) }, kid2).denied, true);
  // a message from someone with no child id at all is never "allowed" by name
  assert.equal(applyOp(s, { op: "add", page: "p1", el: stroke("c", 3) }, { tutor: false, own: "c:xyz", by: "Zed" }).denied, true);
  assert.deepEqual(els(s), ["a"]);
  // widen to a second student, then narrow again: the first can no longer edit their own work
  applyOp(s, { op: "perm", all: false, ids: ["kid1", "kid2"] }, TUTOR);
  assert.equal(applyOp(s, { op: "add", page: "p1", el: stroke("b", 2) }, kid2).changed, true);
  applyOp(s, { op: "perm", all: false, ids: ["kid2"] }, TUTOR);
  assert.equal(applyOp(s, { op: "upd", page: "p1", id: "a", patch: { c: "#f00" }, v: 9 }, kid).denied, true);
  assert.equal(applyOp(s, { op: "upd", page: "p1", id: "b", patch: { c: "#f00" }, v: 9 }, kid2).changed, true);
  // "everyone" opens it to any student, "take back control" closes it
  applyOp(s, { op: "perm", all: true, ids: [] }, TUTOR);
  assert.equal(applyOp(s, { op: "add", page: "p1", el: stroke("d", 4) }, kid).changed, true);
  applyOp(s, { op: "perm", all: false, ids: [] }, TUTOR);
  assert.equal(applyOp(s, { op: "add", page: "p1", el: stroke("e", 5) }, kid).denied, true);
  // a student can't grant themselves permission
  assert.equal(applyOp(s, { op: "perm", all: true, ids: [] }, kid).denied, true);
  assert.equal(s.perm.all, false);
});

t("a private pad (one student + the tutor): students' own work only, the tutor annotates over it", () => {
  const pad = newState(); pad.perm = { all: true, ids: [] }; // a pad is always open to its own student
  applyOp(pad, { op: "add", page: "p1", el: { id: "q-1", k: "text", own: "T", z: 1, v: 1, x: 0, y: 0, text: "3/4 + 1/8 = ?", size: 30, c: "#000" } }, TUTOR);
  assert.equal(applyOp(pad, { op: "add", page: "p1", el: stroke("w1", 2) }, kid).changed, true);
  assert.equal(applyOp(pad, { op: "upd", page: "p1", id: "q-1", patch: { text: "cheat" }, v: 9 }, kid).denied, true); // can't rewrite the question
  assert.equal(applyOp(pad, { op: "del", page: "p1", ids: ["q-1"], v: 9 }, kid).changed, false);
  assert.equal(applyOp(pad, { op: "clear", page: "p1", v: 9 }, kid).denied, true);
  assert.equal(applyOp(pad, { op: "add", page: "p1", el: stroke("m1", 3) }, TUTOR).changed, true); // tutor's mark
  assert.deepEqual(els(pad), ["q-1", "w1", "m1"]);
});

t("undo / redo of add, delete, edit and clear", () => {
  const s = newState(); const h = new History();
  const run = (a: ReturnType<History["undo"]>) => { if (a) applyAll(s, actionOps(a), TUTOR); };
  const a = stroke("a", 1), b = stroke("b", 2);
  applyAll(s, actionOps({ t: "add", page: "p1", els: [a] }), TUTOR); h.push({ t: "add", page: "p1", els: [a] });
  applyAll(s, actionOps({ t: "add", page: "p1", els: [b] }), TUTOR); h.push({ t: "add", page: "p1", els: [b] });
  assert.deepEqual(els(s), ["a", "b"]);
  run(h.undo()); assert.deepEqual(els(s), ["a"]);
  run(h.undo()); assert.deepEqual(els(s), []);
  run(h.redo()); assert.deepEqual(els(s), ["a"]);
  run(h.redo()); assert.deepEqual(els(s), ["a", "b"]);
  // edit
  const before = { c: "#000" }, after = { c: "#f00" };
  applyAll(s, actionOps({ t: "upd", page: "p1", id: "a", before, after }), TUTOR); h.push({ t: "upd", page: "p1", id: "a", before, after });
  assert.equal(s.pages[0]!.els.get("a")!.c, "#f00");
  run(h.undo()); assert.equal(s.pages[0]!.els.get("a")!.c, "#000");
  // clear then undo brings everything back
  const all = sorted(s.pages[0]!).map((e) => ({ ...e }));
  applyAll(s, actionOps({ t: "clear", page: "p1", els: all }), TUTOR); h.push({ t: "clear", page: "p1", els: all });
  assert.deepEqual(els(s), []);
  run(h.undo()); assert.deepEqual(els(s), ["a", "b"]);
  run(h.redo()); assert.deepEqual(els(s), []);
  assert.equal(h.canRedo, false);
  h.push({ t: "add", page: "p1", els: [a] });
  assert.equal(h.canRedo, false); // a new action drops the redo stack
});

t("hit-testing and bounds", () => {
  const line: El = { id: "l", k: "stroke", own: "T", z: 1, v: 1, w: 6, pts: [0, 0, 50, 100, 0, 50] };
  assert.ok(hitTest(line, 50, 2, 4)); assert.ok(!hitTest(line, 50, 30, 4));
  const rect: El = { id: "r", k: "shape", shape: "rect", own: "T", z: 1, v: 1, w: 4, x1: 0, y1: 0, x2: 100, y2: 60 };
  assert.ok(hitTest(rect, 0, 30, 3)); assert.ok(!hitTest(rect, 50, 30, 3)); // outline only
  assert.ok(hitTest({ ...rect, fill: "#fff" }, 50, 30, 3));
  const ell: El = { id: "e", k: "shape", shape: "ellipse", own: "T", z: 1, v: 1, w: 4, x1: 0, y1: 0, x2: 100, y2: 100 };
  assert.ok(hitTest(ell, 100, 50, 3)); assert.ok(!hitTest(ell, 50, 50, 3));
  const ruler: El = { id: "u", k: "stamp", stamp: "ruler", own: "T", z: 1, v: 1, x: 0, y: 0, w: 200, h: 40, rot: 90 };
  assert.ok(hitTest(ruler, 100, 100, 0)); assert.ok(!hitTest(ruler, 190, 20, 0)); // rotated: hits where it now is
  const bb = boundsOf(ruler); assert.ok(Math.abs(bb.w - 40) < 0.001 && Math.abs(bb.h - 200) < 0.001);
  const moved = { ...line, ...movePatch(line, 10, 20) };
  assert.deepEqual(moved.pts!.slice(0, 3), [10, 20, 50]);
});

t("simplify / fit to the server's size cap", () => {
  const pts: number[] = [];
  for (let i = 0; i < 3000; i++) pts.push(i, Math.sin(i / 40) * 100 + (i % 2), 50);
  const simple = simplifyPts(pts, 1.2);
  assert.ok(simple.length < pts.length / 3);
  assert.deepEqual(simple.slice(0, 3), pts.slice(0, 3)); assert.deepEqual(simple.slice(-3), pts.slice(-3));
  const pages = toSaved(fromSaved([{ id: "p1", background: "blank", elements: Array.from({ length: 40 }, (_, i) => stroke(`s${i}`, i, 3000)) }]));
  assert.ok(saveSize(pages) > 700_000);
  const fit = fitToLimit(pages, 700_000);
  assert.ok(fit && saveSize(fit) <= 700_000);
  assert.equal(fitToLimit(pages, 1000), null);
});

t("saved copy round-trips and never carries client-only fields", () => {
  const s = newState();
  applyOp(s, { op: "add", page: "p1", el: { id: "i", k: "image", own: "T", z: 1, v: 1, imageId: "img1", url: "http://x/?sig=1", x: 0, y: 0, w: 10, h: 10 } }, TUTOR);
  const saved = toSaved(s);
  assert.equal("url" in saved[0]!.elements[0]!, false);
  assert.equal(JSON.stringify(toSaved(fromSaved(saved))), JSON.stringify(saved));
});


t("an upd that sets a field to null (or undefined) clears it; `fill: null` stays a real value; undo of a first-time change clears it on a peer through JSON", () => {
  const s = newState();
  applyOp(s, { op: "add", page: "p1", el: { id: "s", k: "shape", shape: "rect", own: "T", z: 1, v: 1, x1: 0, y1: 0, x2: 10, y2: 10, fill: "#f00", bold: true, grp: "g1" } }, TUTOR);
  applyOp(s, { op: "upd", page: "p1", id: "s", patch: { grp: null, bold: undefined, fill: null } as never, v: 2 }, TUTOR);
  const e = s.pages[0]!.els.get("s")!;
  assert.equal("grp" in e, false); assert.equal("bold" in e, false); assert.equal(e.fill, null);
  // the action for "set bold (was unset)" undone: the wire form carries null, not a dropped key
  const h = new History(); h.push({ t: "upd", page: "p1", id: "s", before: { rot: undefined }, after: { rot: 30 } });
  const undo = h.undo()!, ops = JSON.parse(JSON.stringify(actionOps(undo)));
  assert.equal(ops[0].patch.rot, null, "undefined survives JSON as null");
  const peer = newState();
  applyOp(peer, { op: "add", page: "p1", el: { id: "s", k: "shape", shape: "rect", own: "T", z: 1, v: 1, x1: 0, y1: 0, x2: 10, y2: 10, rot: 30 } }, TUTOR);
  applyAll(peer, ops, TUTOR);
  assert.equal("rot" in peer.pages[0]!.els.get("s")!, false);
});

t("versions reserved for a batch can never be overtaken by the very next edit", () => {
  const v = reserveV(500);
  assert.ok(nextV() > v + 499);
});

console.log(`\n${n} passed${process.exitCode ? " (with failures)" : ""}`);
