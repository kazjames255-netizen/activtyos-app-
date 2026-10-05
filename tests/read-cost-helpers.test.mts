/** Firestore read-cost helpers: TTL cache + shared SSE listeners. Pure, no network. */
import test from "node:test";
import assert from "node:assert/strict";
import { ttlCache } from "../server/src/lib/ttlCache";
import { createSharedListeners } from "../server/src/lib/sharedListeners";

test("ttlCache: second call within the TTL does not reload; after it does", async () => {
  let t = 1000, loads = 0;
  const c = ttlCache<number>(60_000, () => t);
  assert.equal(await c.wrap("a", async () => ++loads), 1);
  t += 59_000;
  assert.equal(await c.wrap("a", async () => ++loads), 1);
  t += 2_000;
  assert.equal(await c.wrap("a", async () => ++loads), 2);
});

test("ttlCache: keys are independent and clear() forces a reload", async () => {
  let loads = 0;
  const c = ttlCache<number>(60_000);
  await c.wrap("a", async () => ++loads);
  await c.wrap("b", async () => ++loads);
  assert.equal(loads, 2);
  c.clear("a");
  await c.wrap("a", async () => ++loads);
  await c.wrap("b", async () => ++loads);
  assert.equal(loads, 3);
  c.clear();
  await c.wrap("b", async () => ++loads);
  assert.equal(loads, 4);
});

test("ttlCache: concurrent callers share one load; a failure is not cached", async () => {
  let loads = 0;
  const c = ttlCache<number>(60_000);
  const [x, y] = await Promise.all([c.wrap("k", async () => { loads++; await new Promise((r) => setTimeout(r, 5)); return 7; }), c.wrap("k", async () => { loads++; return 8; })]);
  assert.deepEqual([x, y, loads], [7, 7, 1]);
  await assert.rejects(c.wrap("bad", async () => { throw new Error("boom"); }));
  assert.equal(await c.wrap("bad", async () => 5), 5);
});

test("ttlCache: a clear() during a load stops the pre-write copy being stored", async () => {
  let loads = 0, release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const c = ttlCache<number>(60_000);
  const p = c.wrap("k", async () => { loads++; await gate; return 1; });
  c.clear("k");
  release();
  await p;
  assert.equal(await c.wrap("k", async () => { loads++; return 2; }), 2);
  assert.equal(loads, 2);
});

function fakeSource() {
  let attaches = 0, detaches = 0;
  let fire: () => void = () => {};
  const attach = (onChange: () => void) => { attaches++; fire = onChange; onChange(); /* initial snapshot */ return () => { detaches++; }; };
  return { attach, fire: () => fire(), get attaches() { return attaches; }, get detaches() { return detaches; } };
}

test("sharedListeners: one Firestore listener serves many subscribers; initial snapshot is not an event", () => {
  const src = fakeSource();
  const sl = createSharedListeners(10_000);
  const got: string[] = [];
  sl.subscribe("t1:bookings", src.attach, () => got.push("a"));
  sl.subscribe("t1:bookings", src.attach, () => got.push("b"));
  assert.equal(src.attaches, 1);
  assert.deepEqual(got, []);
  src.fire();
  assert.deepEqual(got, ["a", "b"]);
});

test("sharedListeners: different keys never share (tenant isolation)", () => {
  const s1 = fakeSource(), s2 = fakeSource();
  const sl = createSharedListeners(10_000);
  const got: string[] = [];
  sl.subscribe("t1:bookings", s1.attach, () => got.push("t1"));
  sl.subscribe("t2:bookings", s2.attach, () => got.push("t2"));
  s1.fire();
  assert.deepEqual(got, ["t1"]);
  assert.equal(sl.liveCount(), 2);
});

test("sharedListeners: lingers after the last subscriber leaves, then detaches", async () => {
  const src = fakeSource();
  const sl = createSharedListeners(20);
  const off = sl.subscribe("k", src.attach, () => {});
  off(); off(); // idempotent
  const off2 = sl.subscribe("k", src.attach, () => {});
  assert.equal(src.attaches, 1, "re-subscribe within the linger window reuses the listener");
  off2();
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(src.detaches, 1);
  assert.equal(sl.liveCount(), 0);
  sl.subscribe("k", src.attach, () => {});
  assert.equal(src.attaches, 2);
});

test("sharedListeners: an unsubscribed connection stops receiving events", () => {
  const src = fakeSource();
  const sl = createSharedListeners(10_000);
  const got: string[] = [];
  const offA = sl.subscribe("k", src.attach, () => got.push("a"));
  sl.subscribe("k", src.attach, () => got.push("b"));
  offA();
  src.fire();
  assert.deepEqual(got, ["b"]);
});
