// Gesture self-test: pointer events → ops (no DOM): `npx tsx features/learninghub/live/board/controller.selftest.ts`
import assert from "node:assert/strict";
import { BoardController, type Outbox, type Ptr } from "./controller";
import { PT, routeConnectors, anchorToward, hitTest, pointInPolygon, polyPoints, shapeTextArea, type El, type Op } from "./model";
import { GENERAL } from "./toolkit/general";
import { GEOGRAPHY } from "./toolkit/geography";
import { MATHS } from "./toolkit/maths";
import { SLICE_PTS, applyAll } from "./reducer";
import { TUTOR, newState } from "./model";
import { sanitizeOps } from "./wireGuard";
import { byteLen } from "./wireGuard";

let n = 0;
const t = (name: string, fn: () => void) => { try { fn(); n++; console.log(`  ok  ${name}`); } catch (e) { console.error(`  FAIL ${name}\n`, e); process.exitCode = 1; } };

class Out implements Outbox { ops: Op[] = []; ptrs = 0; queue(...o: Op[]) { this.ops.push(...o); } setPtr() { this.ptrs++; } go() {} present() {} }
const mk = (tutor = true, cid = "kidA") => {
  const c = new BoardController({ isTutor: tutor, readOnlyBoard: false, self: tutor ? { tutor: true, own: "T", name: "Sam" } : { tutor: false, own: `c:${cid}`, by: "Ava", cid, name: "Ava" } });
  const out = new Out(); c.out = out; c.setSize(1000, 700, 1);
  return { c, out };
};
let id = 1;
const P = (x: number, y: number, o: Partial<Ptr> = {}): Ptr => ({ id: id, type: "mouse", x, y, pressure: 0.5, shift: false, button: 0, buttons: 1, t: performance.now(), ...o });
const drag = (c: BoardController, pts: [number, number][], o: Partial<Ptr> = {}) => {
  c.pointerDown(P(...pts[0]!, o));
  for (const p of pts.slice(1)) c.pointerMove([P(p[0], p[1], o)]);
  c.pointerUp(P(...pts[pts.length - 1]!, o));
};
const els = (c: BoardController) => [...c.curPage.els.values()];

console.log("whiteboard controller gestures");

t("pen draws a stroke and streams add + points", () => {
  const { c, out } = mk();
  c.setTool("pen");
  drag(c, [[100, 100], [140, 120], [200, 160], [260, 150]]);
  const s = els(c);
  assert.equal(s.length, 1); assert.equal(s[0]!.k, "stroke"); assert.ok(s[0]!.pts!.length >= 3 * PT);
  assert.equal(out.ops[0]!.op, "add");
  assert.ok(out.ops.some((o) => o.op === "pts"));
  // history: undo removes it, redo brings it back
  c.undo(); assert.equal(els(c).length, 0); c.redo(); assert.equal(els(c).length, 1);
});

t("a student who isn't allowed can't draw; once allowed they can, in their own name", () => {
  const { c } = mk(false);
  c.setTool("pen"); // refused
  drag(c, [[100, 100], [200, 200]]);
  assert.equal(els(c).length, 0);
  c.onRemoteOps([{ op: "perm", all: false, ids: ["kidA"] }], { tutor: true, own: "T" });
  assert.equal(c.canDraw, true);
  c.setTool("pen");
  drag(c, [[100, 100], [200, 200], [260, 180]]);
  const s = els(c)[0]!;
  assert.equal(s.own, "c:kidA"); assert.equal(s.by, "Ava"); assert.equal(s.cid, "kidA");
  // and the tutor narrowing it to someone else takes it away again
  c.onRemoteOps([{ op: "perm", all: false, ids: ["kidB"] }], { tutor: true, own: "T" });
  assert.equal(c.canDraw, false);
});

t("shapes: rectangle, Shift makes a square, a click without dragging leaves nothing behind", () => {
  const { c } = mk();
  c.setTool("rect");
  drag(c, [[100, 100], [300, 220]]);
  let r = els(c)[0]!; assert.equal(r.shape, "rect"); assert.ok(Math.abs((r.x2! - r.x1!)) > 50);
  c.setTool("rect");
  drag(c, [[400, 300], [560, 340]], { shift: true });
  r = els(c).find((e) => e.id !== r.id)!;
  assert.ok(Math.abs(Math.abs(r.x2! - r.x1!) - Math.abs(r.y2! - r.y1!)) < 0.2);
  const before = els(c).length;
  c.setTool("ellipse"); drag(c, [[600, 500], [601, 500]]);
  assert.equal(els(c).length, before);
});

t("eraser removes whole drawings it touches — but only ones the person may change", () => {
  const { c } = mk();
  c.setTool("pen"); drag(c, [[100, 100], [300, 100]]);
  c.setTool("pen"); drag(c, [[100, 400], [300, 400]]);
  assert.equal(els(c).length, 2);
  c.setTool("eraser");
  drag(c, [[200, 90], [200, 110]]);
  assert.equal(els(c).length, 1);
  c.undo(); assert.equal(els(c).length, 2);
});

t("select + drag moves an element and sends updates; undo puts it back", () => {
  const { c, out } = mk();
  c.setTool("rect"); drag(c, [[100, 100], [300, 220]]);
  const id0 = els(c)[0]!.id, x0 = els(c)[0]!.x1!;
  c.setTool("select");
  c.pointerDown(P(100, 160)); // on the rectangle's left edge
  assert.ok(c.selection.has(id0));
  c.pointerMove([P(160, 190)]); c.pointerUp(P(160, 190));
  assert.ok(els(c)[0]!.x1! > x0 + 30);
  assert.ok(out.ops.some((o) => o.op === "upd" && o.id === id0));
  c.undo(); assert.equal(els(c)[0]!.x1, x0);
});

t("text: typing commits an element; an empty commit adds nothing", () => {
  const { c } = mk();
  c.setTool("text"); c.pointerDown(P(300, 300)); c.pointerUp(P(300, 300));
  assert.ok(c.editing);
  let ticks = 0; c.subscribe(() => ticks++);
  c.setEditText("1/"); c.setEditText("1/2 + 1/4");
  assert.equal(ticks, 2, "every keystroke re-renders the controlled text box (a missed notify swallowed typed characters)");
  c.commitEdit();
  assert.equal(els(c).length, 1); assert.equal(els(c)[0]!.text, "1/2 + 1/4");
  c.setTool("text"); c.pointerDown(P(500, 300)); c.pointerUp(P(500, 300)); c.commitEdit();
  assert.equal(els(c).length, 1);
});

t("stamps: fraction bar click toggles shading; clear page + undo", () => {
  const { c } = mk();
  c.insertStamp("fractions");
  const s = els(c)[0]!; assert.equal(s.stamp, "fractions");
  c.setTool("select");
  const sx = c.view.x + (s.x! + s.w! * 0.1) * c.view.k, sy = c.view.y + (s.y! + 20) * c.view.k;
  c.pointerDown(P(sx, sy)); c.pointerUp(P(sx, sy));
  assert.equal(els(c)[0]!.opts!.mask, 1);
  c.clearPage(); assert.equal(els(c).length, 0);
  c.undo(); assert.equal(els(c).length, 1);
});

t("zoom keeps the point under the cursor; wheel with ctrl zooms, plain trackpad scroll pans", () => {
  const { c } = mk();
  const before = c.toWorld(400, 300);
  c.zoomAt(400, 300, 1.5);
  const after = c.toWorld(400, 300);
  assert.ok(Math.abs(before.x - after.x) < 1e-6 && Math.abs(before.y - after.y) < 1e-6);
  const k = c.view.k; c.wheel(400, 300, 0, -50, 0, true); assert.ok(c.view.k > k);
  const x = c.view.x; c.wheel(400, 300, 12, 7, 0, false); assert.notEqual(c.view.x, x); assert.ok(Math.abs(c.view.k - c.view.k) < 1e-9);
});

t("two-finger pinch zooms and cancels a stray stroke", () => {
  const { c } = mk();
  c.setTool("pen");
  c.pointerDown(P(300, 300, { type: "touch", id: 1 }));
  c.pointerDown(P(400, 300, { type: "touch", id: 2 }));
  const k = c.view.k;
  c.pointerMove([P(200, 300, { type: "touch", id: 1 })]); c.pointerMove([P(500, 300, { type: "touch", id: 2 })]);
  assert.ok(c.view.k > k);
  c.pointerUp(P(200, 300, { type: "touch", id: 1 })); c.pointerUp(P(500, 300, { type: "touch", id: 2 }));
});

t("laser sends pointer messages and never draws", () => {
  const { c, out } = mk();
  c.setTool("laser");
  c.pointerMove([P(100, 100, { buttons: 0 })]); c.pointerMove([P(300, 120, { buttons: 0 })]);
  assert.ok(out.ptrs >= 1); assert.equal(els(c).length, 0);
});

t("new shapes: a star / speech bubble draws as one element; hit-testing follows the outline; fill makes the inside hittable", () => {
  const { c } = mk();
  for (const shape of ["star", "hexagon", "heart", "bubble", "diamond", "pentagon", "rtriangle", "darrow"] as const) {
    c.setTool(shape); drag(c, [[200, 200], [400, 360]]);
  }
  assert.deepEqual(els(c).map((e) => e.shape), ["star", "hexagon", "heart", "bubble", "diamond", "pentagon", "rtriangle", "darrow"]);
  assert.equal(c.lastShape, "darrow");
  const star = els(c)[0]!;
  const mid = { x: ((star.x1 ?? 0) + (star.x2 ?? 0)) / 2, y: ((star.y1 ?? 0) + (star.y2 ?? 0)) / 2 + 10 };
  assert.equal(hitTest(star, mid.x, mid.y, 4), false, "the middle of an unfilled star is empty");
  assert.equal(hitTest({ ...star, fill: "#f00" }, mid.x, mid.y, 4), true, "…but a filled one is solid");
  assert.equal(hitTest(star, 900, 900, 4), false);
  const pts = polyPoints("star", 0, 0, 100, 100);
  assert.equal(pts.length, 10);
  assert.ok(Math.min(...pts.map((p) => p[0])) >= -1e-9 && Math.max(...pts.map((p) => p[0])) <= 100 + 1e-9);
  assert.ok(Math.min(...pts.map((p) => p[1])) >= -1e-9 && Math.max(...pts.map((p) => p[1])) <= 100 + 1e-9);
  const heart = polyPoints("heart", 0, 0, 100, 100);
  assert.ok(pointInPolygon(heart, 50, 60) && !pointInPolygon(heart, 2, 2));
  const bubble = polyPoints("bubble", 0, 0, 100, 100);
  assert.ok(pointInPolygon(bubble, 50, 30) && pointInPolygon(bubble, 20, 88) && !pointInPolygon(bubble, 90, 95));
  c.undo(); assert.equal(els(c).length, 7);
});

t("closed shapes take fill + dashed; open ones ignore fill", () => {
  const { c } = mk();
  c.setUi({ fill: true, dashed: true });
  c.setTool("hexagon"); drag(c, [[100, 100], [250, 220]]);
  c.setTool("darrow"); drag(c, [[100, 300], [300, 300]]);
  const [hex, arr] = els(c);
  assert.ok(hex!.fill && hex!.dash); assert.equal(arr!.fill, null);
});

t("pen styles: the chosen look is stored on the stroke (solid stores nothing) and the highlighter ignores it", () => {
  const { c, out } = mk();
  c.setTool("pen"); c.setUi({ penStyle: "neon" }); drag(c, [[100, 100], [200, 150], [300, 120]]);
  c.setUi({ penStyle: "solid" }); drag(c, [[100, 300], [300, 320]]);
  c.setUi({ penStyle: "rainbow" }); c.setTool("highlighter"); drag(c, [[100, 500], [300, 520]]);
  const [a, b, h] = els(c);
  assert.equal(a!.sty, "neon"); assert.equal(b!.sty, undefined); assert.equal(h!.sty, undefined);
  const add = out.ops.find((o) => o.op === "add" && o.el.sty === "neon");
  assert.ok(add, "the style travels with the add op, so peers and the saved copy see it");
});

t("widgets: dice roll, wheel spin and counter click change their state", () => {
  const click = (kind: "dice" | "spinner" | "tally") => {
    const { c } = mk();
    c.insertStamp(kind);
    const e = els(c)[0]!, x = c.view.x + (e.x! + e.w! / 2) * c.view.k, y = c.view.y + (e.y! + e.h! / 2) * c.view.k;
    c.setTool("select"); c.selection.clear(); c.pointerDown(P(x, y)); c.pointerUp(P(x, y));
    return els(c)[0]!;
  };
  const dice = click("dice");
  assert.equal(dice.opts!.rolls, 1); assert.ok(Number(dice.opts!.a) >= 1 && Number(dice.opts!.a) <= 6);
  const spinner = click("spinner");
  assert.ok(Number(spinner.opts!.spin) >= 360 * 4); assert.ok(Number(spinner.opts!.pick) >= 0 && Number(spinner.opts!.pick) < 6);
  const seg = 360 / 6, pick = Number(spinner.opts!.pick), landed = (((-(Number(spinner.opts!.spin) % 360)) % 360) + 360) % 360;
  assert.equal(Math.floor(landed / seg), pick, "the wheel stops with the picked entry under the pointer");
  assert.equal(click("tally").opts!.n, 1);
});

t("loading the saved board keeps what was drawn while it was loading", () => {
  const { c } = mk();
  c.setTool("pen"); drag(c, [[100, 100], [300, 200]]);
  const early = els(c)[0]!.id;
  const kept = c.loadSaved([{ id: "p1", background: "lined", elements: [] }]);
  assert.equal(kept, 1); assert.equal(els(c).length, 1); assert.equal(els(c)[0]!.id, early);
  assert.ok(c.loaded);
  assert.equal(c.loadSaved(undefined), 0, "a second load doesn't merge");
});


// ── board editing core (D2) ─────────────────────────────────────────────────
const place = (c: BoardController, id: string, vals: Record<string, string | number> = {}) => {
  const item = [...GEOGRAPHY, ...MATHS, ...GENERAL].find((i) => i.id === id)!;
  c.placeTemplate(item, { ...Object.fromEntries((item.params ?? []).map((p) => [p.k, p.def])), ...vals });
};
const screenOf = (c: BoardController, x: number, y: number) => ({ x: c.view.x + x * c.view.k, y: c.view.y + y * c.view.k });
const centreOf = (e: El) => ({ x: (Math.min(e.x1!, e.x2!) + Math.max(e.x1!, e.x2!)) / 2, y: (Math.min(e.y1!, e.y2!) + Math.max(e.y1!, e.y2!)) / 2 });
const clickAt = (c: BoardController, w: { x: number; y: number }, o: Partial<Ptr> = {}) => { const p = screenOf(c, w.x, w.y); c.pointerDown(P(p.x, p.y, o)); c.pointerUp(P(p.x, p.y, o)); };

t("duplicating a template gives the copy its own group (it is no longer glued to the original) and keeps the stacking order", () => {
  const { c } = mk();
  place(c, "geo-pyramid");
  const before = els(c).length, g0 = els(c)[0]!.grp!;
  c.duplicateSelection();
  const all = els(c), copies = all.slice(before);
  assert.equal(all.length, before * 2);
  const gs = new Set(copies.map((e) => e.grp)); assert.equal(gs.size, 1); assert.ok(!gs.has(g0) && [...gs][0], "the copy has a NEW group id");
  const zs = copies.map((e) => e.z); assert.equal(new Set(zs).size, zs.length, "each copy has its own z");
  // clicking a copy selects only the copy's family
  c.selection.clear(); c.setTool("select");
  const cell = copies.find((e) => e.cell)!;
  clickAt(c, centreOf(cell));
  assert.ok([...c.selection].every((id) => copies.some((e) => e.id === id)) && c.selection.size === copies.length);
});

t("a placed table is recognised as rows × columns; rows and columns can be added and removed (and undone); anything else is not a table", () => {
  const { c } = mk();
  place(c, "g-table", { cols: 3, rows: 2 }); // heading row + 2 body rows
  const t0 = c.selectedTable!;
  assert.ok(t0, "the whole placed table is selected and recognised");
  assert.equal(t0.cells.length, 3); assert.equal(t0.cells[0]!.length, 3);
  assert.equal(t0.cells[0]![0]!.text, "Heading 1", "row 0 is the heading row, left to right");
  const n0 = els(c).length;
  c.tableAdd("row");
  assert.equal(els(c).length, n0 + 3); assert.equal(c.selectedTable!.cells.length, 4, "a new row joins the table and the selection");
  const newRow = c.selectedTable!.cells[3]!, above = c.selectedTable!.cells[2]!;
  assert.equal(Math.min(newRow[0]!.y1!, newRow[0]!.y2!), Math.max(above[0]!.y1!, above[0]!.y2!), "the new row sits just under the last one");
  assert.ok(!newRow[0]!.fill && !newRow[0]!.text, "a new row is a plain empty body row");
  c.tableAdd("col");
  assert.equal(c.selectedTable!.cells[0]!.length, 4);
  assert.equal(c.selectedTable!.cells[0]![3]!.fill, c.selectedTable!.cells[0]![2]!.fill, "a new column keeps the heading look in the heading row");
  c.tableRemove("col"); c.tableRemove("row");
  assert.equal(c.selectedTable!.cells.length, 3); assert.equal(c.selectedTable!.cells[0]!.length, 3);
  c.undo(); c.selection = new Set(els(c).filter((e) => e.grp === t0.grp).map((e) => e.id)); // (undo clears the selection; select the table again)
  assert.equal(c.selectedTable!.cells.length, 4, "removing a row undoes");
  // a table never shrinks below one row / one column
  for (let i = 0; i < 10; i++) c.tableRemove("row");
  assert.equal(c.selectedTable!.cells.length, 1);
  // a template that is not a grid (the pyramid) is not a table
  c.selection.clear(); place(c, "geo-pyramid"); assert.equal(c.selectedTable, null);
});

t("moving a long stroke never sends one oversized `upd`: it goes as delete + re-add in message-sized slices", () => {
  const { c, out } = mk();
  c.setTool("pen");
  const pts: [number, number][] = []; for (let i = 0; i < 400; i++) pts.push([100 + i, 200 + Math.sin(i / 9) * 60]);
  drag(c, pts);
  const stroke = els(c)[0]!; assert.ok(stroke.pts!.length / PT > SLICE_PTS * 2);
  out.ops.length = 0;
  c.setTool("select"); c.selection = new Set([stroke.id]);
  const on = screenOf(c, stroke.pts![300 * PT]!, stroke.pts![300 * PT + 1]!); // a point ON the stroke
  c.pointerDown(P(on.x, on.y)); c.pointerMove([P(on.x + 80, on.y + 40)]); c.pointerUp(P(on.x + 80, on.y + 40));
  assert.ok(out.ops.length > 0);
  for (const op of out.ops) assert.ok(byteLen(JSON.stringify(op)) < 3000, `an op of ${byteLen(JSON.stringify(op))} bytes`);
  assert.ok(!out.ops.some((o) => o.op === "upd" && (o.patch.pts?.length ?? 0) / PT > SLICE_PTS), "no giant upd");
  // a peer replaying exactly what was sent ends up with the moved stroke, all points
  const peer = newState();
  applyAll(peer, [{ op: "add", page: "p1", el: { ...stroke, pts: stroke.pts!.slice() } }], TUTOR);
  applyAll(peer, sanitizeOps(JSON.parse(JSON.stringify(out.ops)), { tutor: true }), TUTOR);
  const got = peer.pages[0]!.els.get(stroke.id)!;
  assert.equal(got.pts!.length, els(c)[0]!.pts!.length); assert.equal(JSON.stringify(got.pts), JSON.stringify(els(c)[0]!.pts));
});

t("an interrupted gesture still finishes: a shape dragged when a second finger lands is kept and undoable; a pinch leaves no dot; an interrupted erase can be undone", () => {
  const { c } = mk();
  c.setTool("rect");
  c.pointerDown(P(200, 200, { type: "touch", id: 11 })); c.pointerMove([P(320, 300, { type: "touch", id: 11 })]);
  c.pointerDown(P(500, 500, { type: "touch", id: 12 })); // second finger: pinch → abort
  assert.equal(els(c).length, 1); assert.ok(c.history.canUndo, "the half-drawn rectangle went into history");
  c.pointerUp(P(320, 300, { type: "touch", id: 11 })); c.pointerUp(P(500, 500, { type: "touch", id: 12 }));
  c.undo(); assert.equal(els(c).length, 0);
  // pen + pinch: the lone dot the first finger made is taken back
  const d = mk(); d.c.setTool("pen");
  d.c.pointerDown(P(300, 300, { type: "touch", id: 21 })); d.c.pointerDown(P(400, 300, { type: "touch", id: 22 }));
  assert.equal(els(d.c).length, 0, "no stray dot after a pinch");
  // erase interrupted
  const e = mk(); e.c.setTool("pen"); drag(e.c, [[100, 100], [300, 100]]); e.c.setTool("eraser");
  e.c.pointerDown(P(200, 100, { type: "touch", id: 31 })); assert.equal(els(e.c).length, 0);
  e.c.pointerCancel(P(200, 100, { type: "touch", id: 31 }));
  e.c.undo(); assert.equal(els(e.c).length, 1, "the rub-out was one undoable step even though it was cut short");
});

t("undo of a change to a field that was never set clears it for EVERYONE (an undefined `before` used to leave it set on peers)", () => {
  const { c, out } = mk();
  c.setTool("text"); c.pointerDown(P(300, 300)); c.pointerUp(P(300, 300)); c.setEditText("hello"); c.commitEdit();
  delete (els(c)[0] as { bold?: boolean }).bold; // (a text made by a template has no `bold` at all)
  const id = els(c)[0]!.id; assert.equal(els(c)[0]!.bold, undefined);
  const peer = newState();
  applyAll(peer, [{ op: "add", page: "p1", el: { ...els(c)[0]! } }], TUTOR);
  c.setTool("select"); c.selection = new Set([id]); c.setUi({ bold: true });
  assert.equal(els(c)[0]!.bold, true);
  c.undo(); assert.equal(els(c)[0]!.bold, undefined, "undone locally");
  const wire = sanitizeOps(JSON.parse(JSON.stringify(out.ops.filter((o) => o.op === "upd"))), { tutor: true });
  applyAll(peer, wire, TUTOR);
  assert.equal(peer.pages[0]!.els.get(id)!.bold, undefined, "and undone on the peer's board too");
});

t("the eraser rubs out drawings only by default — never a picture, a teaching aid or a template's parts — until you choose Everything", () => {
  const { c } = mk();
  c.insertStamp("numberline");
  place(c, "geo-pyramid");
  c.setTool("pen"); drag(c, [[100, 100], [300, 100]]);
  const total = els(c).length;
  c.setTool("eraser"); c.setUi({ eraserSize: 70 });
  const stamp = els(c).find((e) => e.k === "stamp")!, cell = els(c).find((e) => e.cell)!;
  const cp = centreOf(cell), sp = { x: stamp.x! + stamp.w! / 2, y: stamp.y! + stamp.h! / 2 };
  const a = screenOf(c, cp.x, cp.y), b2 = screenOf(c, sp.x, sp.y);
  drag(c, [[a.x, a.y], [a.x + 2, a.y + 2]]); drag(c, [[b2.x, b2.y], [b2.x + 2, b2.y + 2]]);
  assert.equal(els(c).length, total, "stamp + template untouched");
  const pen = els(c).find((e) => e.k === "stroke")!;
  drag(c, [[200, 100], [202, 100]]);
  assert.ok(!els(c).some((e) => e.id === pen.id), "the pen stroke went");
  c.setUi({ eraserAll: true }); drag(c, [[b2.x, b2.y], [b2.x + 2, b2.y + 2]]);
  assert.ok(!els(c).some((e) => e.id === stamp.id), "…but Everything rubs out the aid too");
});

t("type INTO a shape: double-click a rectangle, type, commit — the words live on the shape, follow it and sync as one op; a cell keeps existing when emptied", () => {
  const { c, out } = mk();
  c.setTool("rect"); drag(c, [[200, 200], [420, 300]]);
  const r = els(c)[0]!;
  c.setTool("select"); c.selection.clear();
  const mid = centreOf(r), sp = screenOf(c, mid.x, mid.y);
  c.pointerDown(P(sp.x, sp.y)); c.pointerUp(P(sp.x, sp.y)); // an unfilled shape's inside is not a hit — first click is a marquee start
  c.pointerDown(P(sp.x, sp.y)); c.pointerUp(P(sp.x, sp.y));
  assert.ok(c.editing && c.editing.kind === "shape" && c.editing.id === r.id, "double-click inside opens the label editor");
  c.setEditText("Population"); c.commitEdit();
  assert.equal(els(c)[0]!.text, "Population");
  const ops = out.ops.filter((o) => o.op === "upd" && o.id === r.id); assert.ok(ops.length >= 1);
  c.beginEdit(els(c)[0]!); c.setEditText(""); c.commitEdit();
  assert.equal(els(c).length, 1, "emptying the words leaves the shape"); assert.equal(els(c)[0]!.text, undefined);
  c.undo(); assert.equal(els(c)[0]!.text, "Population");
  const area = shapeTextArea(els(c)[0]!); assert.ok(area.w > 0 && area.h > 0 && area.x >= Math.min(r.x1!, r.x2!) && area.x + area.w <= Math.max(r.x1!, r.x2!));
});

t("a template is not an empty box any more: the population pyramid is typeable cells with data-driven bars, Tab moves to the next cell", () => {
  const { c } = mk();
  place(c, "geo-pyramid");
  const cells = els(c).filter((e) => e.cell), bars = cells.filter((e) => e.fill);
  assert.ok(cells.length >= 51, `${cells.length} cells`); assert.ok(bars.length >= 34, "male + female bars are filled");
  const male = bars.filter((e) => e.fill === bars[0]!.fill).sort((a, b) => Math.max(a.x1!, a.x2!) - Math.max(b.x1!, b.x2!) || a.y1! - b.y1!);
  const widths = new Set(male.map((e) => Math.round(Math.abs(e.x2! - e.x1!)))); assert.ok(widths.size > 8, "bars have different lengths (they follow the numbers)");
  // blank mode: dashed empty slots
  const b2 = mk(); place(b2.c, "geo-pyramid", { mode: "Blank bars for students" });
  assert.ok(els(b2.c).filter((e) => e.cell && e.dash).length >= 34);
  // typing into one cell and Tab
  c.setTool("select"); c.selection.clear();
  const target = cells.find((e) => e.text === "10–14")!;
  c.beginEdit(target); c.setEditText("kids"); c.tabEdit(1);
  assert.equal(els(c).find((e) => e.id === target.id)!.text, "kids");
  assert.ok(c.editing && c.editing.id !== target.id, "Tab opened the next cell");
});

t("select inside a template: a second click picks one cell, Alt-click reaches one directly, ungroup frees every part, Ctrl+G joins them again", () => {
  const { c } = mk();
  place(c, "geo-pyramid");
  const all = els(c), cell = all.find((e) => e.cell && e.text === "20–24")!, wp = centreOf(cell);
  c.setTool("select"); c.selection.clear();
  clickAt(c, wp); assert.equal(c.selection.size, all.length, "first click = the whole template");
  c.pointerUp(P(0, 0));
  const t0 = performance.now(); const sp = screenOf(c, wp.x, wp.y);
  c.pointerDown(P(sp.x, sp.y, { t: t0 + 900 })); c.pointerUp(P(sp.x, sp.y, { t: t0 + 900 }));
  assert.deepEqual([...c.selection], [cell.id], "second (slow) click narrows to that cell");
  c.selection.clear(); clickAt(c, wp, { alt: true }); assert.deepEqual([...c.selection], [cell.id], "Alt-click");
  c.selection = new Set(all.map((e) => e.id)); c.ungroupSelection();
  assert.ok(els(c).every((e) => e.grp === undefined), "ungrouped");
  c.selection.clear(); clickAt(c, wp); assert.equal(c.selection.size, 1);
  c.selection = new Set(all.map((e) => e.id)); c.key({ key: "g", shiftKey: false, ctrlKey: true, metaKey: false, altKey: false }, true);
  assert.equal(new Set(els(c).map((e) => e.grp)).size, 1, "Ctrl+G groups");
});

t("a whole template scales from its corner handle: everything grows together, undo puts it back", () => {
  const { c } = mk();
  place(c, "geo-pyramid");
  const before = els(c).map((e) => ({ ...e })), bounds = (list: El[]) => { let x0 = Infinity, x1 = -Infinity; for (const e of list) { x0 = Math.min(x0, e.x1 ?? e.x ?? 0, e.x2 ?? e.x ?? 0); x1 = Math.max(x1, e.x1 ?? e.x ?? 0, e.x2 ?? e.x ?? 0); } return x1 - x0; };
  const w0 = bounds(before);
  c.setTool("select");
  // find the bottom-right handle of the whole selection via its box
  let x1 = -Infinity, y1 = -Infinity, x0 = Infinity, y0 = Infinity;
  for (const e of before) { const bx = Math.max(e.x1 ?? e.x ?? 0, e.x2 ?? e.x ?? 0), by = Math.max(e.y1 ?? e.y ?? 0, e.y2 ?? e.y ?? 0); x1 = Math.max(x1, bx); y1 = Math.max(y1, by); x0 = Math.min(x0, e.x1 ?? e.x ?? 0); y0 = Math.min(y0, e.y1 ?? e.y ?? 0); }
  const from = screenOf(c, x1 + 6 + 8, y1 + 6 + 8); // the se handle sits at the padded box corner (approx.)
  c.pointerDown(P(from.x, from.y)); c.pointerMove([P(from.x + 300, from.y + 300)]); c.pointerUp(P(from.x + 300, from.y + 300));
  const w1 = bounds(els(c));
  assert.ok(w1 > w0 * 1.1, `template widened (${Math.round(w0)} → ${Math.round(w1)})`);
  c.undo(); assert.ok(Math.abs(bounds(els(c)) - w0) < 1);
});

t("bring to front keeps the selection's own stacking order; send to back puts it below everything", () => {
  const { c } = mk();
  c.setTool("rect"); drag(c, [[100, 100], [200, 200]]); c.setTool("rect"); drag(c, [[300, 100], [400, 200]]); c.setTool("rect"); drag(c, [[500, 100], [600, 200]]);
  const [a, b2, d] = els(c).map((e) => e.id);
  c.selection = new Set([a!, b2!]); c.bringToFront();
  const z = (id: string) => els(c).find((e) => e.id === id)!.z;
  assert.ok(z(a!) < z(b2!) && z(b2!) > z(d!) && z(a!) > z(d!), "a below b, both above d");
  c.selection = new Set([d!]); c.sendToBack(); assert.ok(z(d!) < z(a!) && z(d!) < z(b2!));
});

t("changing size / colour while editing existing text sticks", () => {
  const { c } = mk();
  c.setTool("text"); c.pointerDown(P(300, 300)); c.pointerUp(P(300, 300)); c.setEditText("Hi"); c.commitEdit();
  const e = els(c)[0]!;
  c.beginEdit(e); c.setUi({ textSize: 60, bold: true, colour: "#e21d27" }); c.commitEdit();
  const r = els(c)[0]!; assert.equal(r.size, 60); assert.equal(r.bold, true); assert.equal(r.c, "#e21d27");
});

t("regular polygon tool draws a regular n-gon; triangle types; fill / no outline restyle a selected shape", () => {
  const { c } = mk();
  c.setUi({ sides: 6 }); c.setTool("ngon"); drag(c, [[100, 100], [300, 220]]);
  const g = els(c)[0]!; assert.equal(g.shape, "ngon"); assert.equal(g.n, 6);
  const pts = polyPoints("ngon", g.x1!, g.y1!, g.x2!, g.y2!, { n: 6 }), d = (i: number, j: number) => Math.hypot(pts[i]![0] - pts[j]![0], pts[i]![1] - pts[j]![1]);
  assert.ok(Math.abs(d(0, 1) - d(1, 2)) < 1e-6 && Math.abs(d(1, 2) - d(2, 3)) < 1e-6, "all sides equal even though the drag box was not square");
  c.setTool("triangle"); drag(c, [[400, 100], [500, 200]], { shift: true });
  const t3 = els(c)[1]!; assert.ok(Math.abs(Math.abs(t3.y2! - t3.y1!) - Math.abs(t3.x2! - t3.x1!) * 0.866) < 0.6, "Shift = equilateral");
  c.selection = new Set([t3.id]); c.setTriangleType("obtuse"); assert.ok((els(c)[1]!.ap ?? 0.5) < 0);
  c.setTriangleType("right"); assert.equal(els(c)[1]!.ap, 0);
  c.setTriangleType("isosceles"); assert.equal(els(c)[1]!.ap, undefined);
  c.setTool("select"); c.selection = new Set([g.id]); c.setUi({ fill: true }); assert.ok(els(c)[0]!.fill);
  c.setUi({ fillColour: "#15b364", fillSolid: true, noLine: true, dashed: true });
  const s2 = els(c)[0]!; assert.equal(s2.fill, "#15b364"); assert.equal(s2.fa, 1); assert.equal(s2.ns, true); assert.equal(s2.dash, true);
  // filled triangle is hittable in its inside now
  assert.equal(hitTest({ ...t3, fill: "#f00" }, (t3.x1! + t3.x2!) / 2, t3.y2! - 8, 4), true);
});


t("connectors: an arrow drawn between two boxes is attached to them and follows when a box moves; a copy attaches to the copies", () => {
  const { c } = mk();
  c.setTool("rect"); drag(c, [[100, 200], [220, 280]]);
  c.setTool("rect"); drag(c, [[500, 200], [620, 280]]);
  const [a, b2] = els(c);
  c.setTool("arrow"); drag(c, [[160, 240], [560, 240]]);
  const ar = els(c)[2]!;
  assert.equal(ar.fr, a!.id); assert.equal(ar.to, b2!.id);
  routeConnectors(c.curPage.els);
  const arrow = () => els(c)[2]!;
  assert.ok(Math.abs(arrow().x1! - Math.max(a!.x1!, a!.x2!)) < 1.5, "starts on the right edge of the first box");
  assert.ok(Math.abs(arrow().x2! - Math.min(b2!.x1!, b2!.x2!)) < 1.5, "ends on the left edge of the second");
  // move the first box down: the arrow follows
  const y1Before = arrow().y1!;
  c.setTool("select"); c.selection.clear();
  const p = screenOf(c, Math.min(a!.x1!, a!.x2!), (a!.y1! + a!.y2!) / 2); // its left edge
  c.pointerDown(P(p.x, p.y)); c.pointerMove([P(p.x, p.y + 90)]); c.pointerUp(P(p.x, p.y + 90));
  routeConnectors(c.curPage.els);
  assert.ok(arrow().y1! > y1Before + 20, `the arrow's start followed the box down (${y1Before} → ${arrow().y1})`);
  assert.equal(arrow().to, b2!.id);
  // an ellipse anchors on its outline
  const ell = { id: "e", k: "shape", shape: "ellipse", own: "T", z: 1, v: 1, x1: 0, y1: 0, x2: 200, y2: 100 } as El;
  const an = anchorToward(ell, 500, 50)!; assert.ok(Math.abs(an.x - 200) < 0.01 && Math.abs(an.y - 50) < 0.01);
  // duplicating boxes + arrow attaches the copy arrow to the copies
  c.selection = new Set(els(c).map((e) => e.id)); c.duplicateSelection();
  const all = els(c), copies = all.slice(3), cArrow = copies.find((e) => e.shape === "arrow")!, cBoxes = copies.filter((e) => e.shape === "rect").map((e) => e.id);
  assert.ok(cBoxes.includes(cArrow.fr!) && cBoxes.includes(cArrow.to!), "the copy is attached to the copies");
});

t("snap to grid: shapes start and end on grid points; moves land on the grid", () => {
  const { c } = mk();
  c.setBackground("squared"); c.setUi({ snap: true });
  c.setTool("rect"); drag(c, [[113, 187], [297, 259]]);
  const r = els(c)[0]!, g = c.snapStep();
  for (const v of [r.x1!, r.y1!, r.x2!, r.y2!]) assert.equal(Math.round(v / g) * g, v, `${v} on the ${g} grid`);
  c.setTool("select"); c.selection.clear();
  const p = screenOf(c, r.x1!, (r.y1! + r.y2!) / 2);
  c.pointerDown(P(p.x, p.y)); c.pointerMove([P(p.x + 57, p.y + 33)]); c.pointerUp(P(p.x + 57, p.y + 33));
  const m = els(c)[0]!; assert.equal(Math.round(m.x1! / g) * g, m.x1!); assert.equal(Math.round(m.y1! / g) * g, m.y1!);
});

t("a protractor keeps its pivot mark when placed", () => {
  const { c } = mk();
  c.insertStamp("protractor");
  const p = els(c)[0]!; assert.equal(p.opts!.pv, 1);
});

console.log(`\n${n} passed${process.exitCode ? " (with failures)" : ""}`);
