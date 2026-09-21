// `npx tsx features/learninghub/live/board/wireGuard.selftest.ts` — the wire input gate (sanitising, byte packing, digest).
import assert from "node:assert/strict";
import { newState, type El, type Op } from "./model";
import { applyAll } from "./reducer";
import { boardDigest, byteLen, cleanEl, packBytes, sanitizeNeed, sanitizeOps, sanitizePtr } from "./wireGuard";

let n = 0;
const t = (name: string, fn: () => void) => { try { fn(); n++; console.log(`  ok  ${name}`); } catch (e) { console.error(`  FAIL ${name}\n`, e); process.exitCode = 1; } };
const el = (o: Partial<El> = {}): El => ({ id: "e1", k: "stroke", own: "T", z: 1, v: 1, pts: [0, 0, 50, 1, 1, 50], ...o });
const student = { tutor: false }, tutor = { tutor: true };

console.log("wire guard");
t("need.have is clamped to [0, MAX_PTS]; junk is rejected", () => {
  assert.equal(sanitizeNeed({ page: "p1", id: "a", have: -1e12 })!.have, 0);
  assert.equal(sanitizeNeed({ page: "p1", id: "a", have: 1e15 })!.have, 20000);
  assert.equal(sanitizeNeed({ page: "p1", id: "a", have: 2.9 })!.have, 2);
  for (const bad of [null, 5, { page: "p1", id: "a", have: NaN }, { page: "p1", id: "a", have: "3" }, { page: "p1", id: "a".repeat(61), have: 0 }, { page: "x".repeat(41), id: "a", have: 0 }]) assert.equal(sanitizeNeed(bad), null);
});
t("elements are clipped / dropped to the server's limits", () => {
  const ok = cleanEl(el({ text: "x".repeat(9000), by: "b".repeat(90), cid: "c".repeat(500), c: "#fff" }))!;
  assert.equal(ok.text!.length, 2000); assert.equal(ok.by!.length, 40); assert.equal(ok.cid, undefined);
  assert.equal(cleanEl(el({ own: "c:" + "x".repeat(200) })), null);
  assert.equal(cleanEl(el({ id: "x".repeat(61) })), null);
  assert.equal(cleanEl(el({ v: NaN })), null);
  assert.equal(cleanEl(el({ k: "video" as never })), null);
  assert.equal(cleanEl({ ...el(), pts: ["a", 1, 2] }), null);
  assert.deepEqual(cleanEl({ ...el(), pts: [1, 2, 3, 4] })!.pts, [1, 2, 3]); // trimmed to whole points
  assert.equal(cleanEl({ ...el(), pts: [1e12, 0, 5] })!.pts![0], 1e6);
  assert.equal((cleanEl({ ...el(), evil: 1, __proto__: { x: 1 } } as never) as Record<string, unknown>).evil, undefined);
});
t("sanitizeOps: garbage in, only clean ops out; a student's picture url is dropped, a tutor's kept", () => {
  const url = "https://x.example/a.png";
  const ops = sanitizeOps([{ op: "add", page: "p1", el: { id: "i", k: "image", own: "T", z: 1, v: 1, imageId: "img", url } }, null, 3, { op: "zzz" }, { op: "del", page: "p1", ids: ["a", 5, "b"], v: 1 }, { op: "pages", pages: [{ id: "p1", bg: "sparkly" }] }, { op: "perm", all: "yes", ids: [] }, { op: "pts", page: "p1", id: "a", from: -4, pts: [1, 2, 3] }], tutor);
  assert.equal(ops.length, 2);
  assert.equal((ops[0] as Extract<Op, { op: "add" }>).el.url, url);
  assert.deepEqual((ops[1] as Extract<Op, { op: "del" }>).ids, ["a", "b"]);
  assert.equal((sanitizeOps([{ op: "add", page: "p1", el: { id: "i", k: "image", own: "c:x", z: 1, v: 1, imageId: "img", url: "javascript:alert(1)" } }], student)[0] as Extract<Op, { op: "add" }>).el.url, undefined);
  assert.equal(sanitizeOps("nope", student).length, 0);
  assert.equal(sanitizeOps(Array.from({ length: 2000 }, () => ({ op: "reset" })), tutor).length, 400);
});
t("the reducer never sees a NaN / oversized value from the wire", () => {
  const s = newState();
  const ops = sanitizeOps([{ op: "add", page: "p1", el: { id: "z", k: "shape", own: "T", z: 1, v: 1, shape: "rect", x1: 0, y1: 0, x2: "boom", w: Infinity } }], tutor);
  applyAll(s, ops, { tutor: true, own: "T" });
  const e = s.pages[0]!.els.get("z")!;
  assert.ok(e.x2 === undefined && e.w === undefined);
});
t("pointer messages are validated", () => {
  assert.equal(sanitizePtr({ page: "p1", x: "1", y: 2 }), null);
  assert.equal(sanitizePtr({ page: "p1", x: 1, y: 2, laser: true, col: "red; drop table" })!.col, "#2f6bd8");
});
t("byteLen matches UTF-8 (CJK 3 bytes, emoji 4)", () => {
  const enc = new TextEncoder();
  for (const s of ["abc", "字字字", "😀ok", "é"]) assert.equal(byteLen(s), enc.encode(s).length);
});
t("packBytes: an op that can never fit is dropped (and counted), the rest still go", () => {
  const big: Op = { op: "add", page: "p1", el: el({ k: "shape", pts: undefined, opts: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, "v".repeat(400)])) }) };
  const small: Op = { op: "add", page: "p1", el: el({ id: "s" }) };
  const r = packBytes([big, small], 3000);
  assert.equal(r.dropped, 1); assert.equal(r.packs.flat().length, 1);
});
t("boardDigest ignores element order but sees a version, page or permission change", () => {
  const a = newState(), b = newState();
  a.pages[0]!.els.set("x", el({ id: "x" })); a.pages[0]!.els.set("y", el({ id: "y" }));
  b.pages[0]!.els.set("y", el({ id: "y" })); b.pages[0]!.els.set("x", el({ id: "x" }));
  assert.deepEqual(boardDigest(a), boardDigest(b));
  b.pages[0]!.els.get("x")!.v = 2; assert.notDeepEqual(boardDigest(a), boardDigest(b));
  b.pages[0]!.els.get("x")!.v = 1; b.perm = { all: true, ids: [] }; assert.notDeepEqual(boardDigest(a), boardDigest(b));
});
console.log(`\n${n} passed`);
