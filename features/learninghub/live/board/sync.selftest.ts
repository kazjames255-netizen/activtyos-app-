// Network self-test for the whiteboard's live layer: `npx tsx features/learninghub/live/board/sync.selftest.ts`
// A fake Daily room (targeted + broadcast app messages, `owner` = tutor token) wired exactly like the app
// (BoardLink + makeHandlers + PadHub): permissions across peers, late joiners, private pads never reach other students.
import assert from "node:assert/strict";
import type { CallLike, CallParticipant, InboxMsg, WbMessage } from "./callObject";
import { PT, newState, sorted, type BoardState, type El, type Op, type Sender } from "./model";
import { applyAll } from "./reducer";
import { PadHub, PAD_PAGE, showToClassOps } from "./pads";
import { BoardLink, tuning } from "./sync";
import { packBytes } from "./wireGuard";
import { makeHandlers } from "./wire";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let n = 0;
const t = async (name: string, fn: () => Promise<void>) => { try { await fn(); n++; console.log(`  ok  ${name}`); } catch (e) { console.error(`  FAIL ${name}\n`, e); process.exitCode = 1; } };

class Room {
  calls = new Map<string, FakeCall>();
  join(c: FakeCall) { this.calls.set(c.id, c); for (const o of this.calls.values()) if (o !== c) o.fire("participant-joined", { participant: { session_id: c.id, local: false, owner: c.owner, user_name: c.userName } }); }
  send(from: string, data: unknown, to: string) {
    const targets = to === "*" ? [...this.calls.values()].filter((c) => c.id !== from) : [this.calls.get(to)].filter((c): c is FakeCall => !!c);
    for (const c of targets) setTimeout(() => { c.log.push({ fromId: from, data: data as WbMessage }); c.fire("app-message", { fromId: from, data }); }, 1);
  }
}
class FakeCall implements CallLike {
  handlers = new Map<string, Set<(e: never) => void>>();
  log: InboxMsg[] = [];
  constructor(public room: Room, public id: string, public owner: boolean, public userName: string, public userId?: string) {}
  sendAppMessage(data: unknown, to?: string) { this.room.send(this.id, data, to ?? "*"); }
  on(ev: string, cb: (e: never) => void) { if (!this.handlers.has(ev)) this.handlers.set(ev, new Set()); this.handlers.get(ev)!.add(cb); }
  off(ev: string, cb: (e: never) => void) { this.handlers.get(ev)?.delete(cb); }
  fire(ev: string, e: unknown) { this.handlers.get(ev)?.forEach((f) => (f as (x: unknown) => void)(e)); }
  participants() { const o: Record<string, CallParticipant> = {}; for (const c of this.room.calls.values()) o[c.id] = { session_id: c.id, owner: c.owner, user_name: c.userName, user_id: c.userId, local: c.id === this.id }; return o; }
  meetingState() { return "joined-meeting"; }
}

interface Client { call: FakeCall; state: BoardState; link: BoardLink; hub: PadHub; denied: number; went?: string }
function client(room: Room, id: string, name: string, role: { tutor: boolean; cid?: string; page?: string; state?: BoardState }): Client {
  const call = new FakeCall(room, id, role.tutor, name, role.cid ? `c:${role.cid}` : undefined);
  room.join(call);
  const state = role.state ?? newState();
  const hub = new PadHub({ tutor: role.tutor, cid: role.cid, name });
  const c = { call, state, hub, denied: 0 } as Client;
  const link: BoardLink = new BoardLink(call, { tutor: role.tutor, name, cid: role.cid }, () => state, makeHandlers({
    state,
    onRemoteOps: (ops, who) => { const r = applyAll(state, ops, who); c.denied += r.denied; return { gaps: r.gaps }; },
    onRemotePtr: () => undefined, onRemoteGo: (page) => { c.went = page; }, peersChanged: () => undefined, page: role.page,
  }, hub, () => link));
  c.link = link;
  link.start();
  call.on("app-message", ((e: { fromId: string; data: WbMessage }) => link.receive({ fromId: e.fromId, data: e.data })) as never);
  return c;
}
const stroke = (id: string, own: string, by?: string, cid?: string, v = Date.now()): El => ({ id, k: "stroke", own, by, cid, z: v, v, c: "#000", w: 4, pts: [0, 0, 50, 10, 10, 50, 20, 5, 50] });
const me = (c: Client, sender: Sender, ops: Op[]) => { applyAll(c.state, ops, sender); c.link.queue(...ops); };
const ids = (s: BoardState) => sorted(s.pages[0]!).map((e) => e.id);
const T: Sender = { tutor: true, own: "T" };
const A: Sender = { tutor: false, own: "c:kidA", by: "Ava", cid: "kidA" };
const B: Sender = { tutor: false, own: "c:kidB", by: "Ben", cid: "kidB" };

async function main() {
console.log("whiteboard live layer (fake Daily room)");

await t("per-student permission is enforced on every peer (host-authoritative)", async () => {
  const room = new Room();
  const tutor = client(room, "s-tutor", "Sam", { tutor: true });
  const a = client(room, "s-a", "Ava", { tutor: false, cid: "kidA" });
  const b = client(room, "s-b", "Ben", { tutor: false, cid: "kidB" });
  await sleep(120);
  me(tutor, T, [{ op: "perm", all: false, ids: ["kidA"] }]);
  await sleep(120);
  assert.deepEqual([a.state.perm, b.state.perm], [{ all: false, ids: ["kidA"] }, { all: false, ids: ["kidA"] }]);
  // A (allowed) draws: the tutor AND B (another student) see it
  me(a, A, [{ op: "add", page: "p1", el: stroke("a1", "c:kidA", "Ava", "kidA") }]);
  await sleep(150);
  assert.deepEqual([ids(tutor.state), ids(b.state)], [["a1"], ["a1"]]);
  // B (not allowed) draws locally / sends anyway: everybody else ignores it
  me(b, B, [{ op: "add", page: "p1", el: stroke("b1", "c:kidB", "Ben", "kidB") }]);
  await sleep(150);
  assert.deepEqual([ids(tutor.state), ids(a.state)], [["a1"], ["a1"]]);
  assert.ok(tutor.denied >= 1 && a.denied >= 1);
  // the tutor opens it to everyone, then takes it back
  me(tutor, T, [{ op: "perm", all: true, ids: [] }]);
  await sleep(120);
  me(b, B, [{ op: "add", page: "p1", el: stroke("b2", "c:kidB", "Ben", "kidB") }]);
  await sleep(150);
  assert.deepEqual(ids(tutor.state).sort(), ["a1", "b2"]);
  me(tutor, T, [{ op: "perm", all: false, ids: [] }]);
  await sleep(120);
  me(a, A, [{ op: "add", page: "p1", el: stroke("a2", "c:kidA", "Ava", "kidA") }]);
  await sleep(150);
  assert.ok(!ids(tutor.state).includes("a2"));
});

await t("a student can't impersonate the tutor: only the token holder's clear / background / perm ops count", async () => {
  const room = new Room();
  const tutor = client(room, "s-tutor", "Sam", { tutor: true });
  const a = client(room, "s-a", "Ava", { tutor: false, cid: "kidA" });
  await sleep(100);
  me(tutor, T, [{ op: "add", page: "p1", el: stroke("t1", "T") }]);
  await sleep(120);
  // Ava's client sends a clear + a permission grant claiming to be the tutor (own "T" in the body means nothing)
  a.link.queue({ op: "clear", page: "p1", v: Date.now() + 5 }, { op: "perm", all: true, ids: [] }, { op: "add", page: "p1", el: stroke("fake", "T") });
  await sleep(150);
  assert.deepEqual(ids(tutor.state), ["t1"]);
  assert.equal(tutor.state.perm.all, false);
});

await t("a late joiner gets the whole board from the tutor, big strokes included", async () => {
  const room = new Room();
  const tutor = client(room, "s-tutor", "Sam", { tutor: true });
  await sleep(50);
  const big = stroke("big", "T"); big.pts = Array.from({ length: 900 * PT }, (_, i) => (i % PT === 2 ? 50 : (i * 7) % 500));
  me(tutor, T, [{ op: "padd", id: "p2", bg: "graph" }, { op: "add", page: "p1", el: big }, { op: "add", page: "p1", el: stroke("s2", "T") }]);
  await sleep(150);
  const late = client(room, "s-late", "Cy", { tutor: false, cid: "kidC" });
  await sleep(600);
  assert.deepEqual(ids(late.state), ["big", "s2"]);
  assert.equal(late.state.pages.length, 2);
  assert.equal(late.state.pages[1]!.bg, "graph");
  assert.equal(late.state.pages[0]!.els.get("big")!.pts!.length, big.pts!.length);
});

await t("PRIVACY: a student's pad reaches only the tutor; the tutor's marks reach only that student", async () => {
  const room = new Room();
  const tutor = client(room, "s-tutor", "Sam", { tutor: true });
  const a = client(room, "s-a", "Ava", { tutor: false, cid: "kidA" });
  const b = client(room, "s-b", "Ben", { tutor: false, cid: "kidB" });
  await sleep(150);
  // Ava writes on her pad (through the same path as the app: a targeted pad message)
  const padA = a.hub.own!;
  const ops: Op[] = [{ op: "add", page: PAD_PAGE, el: stroke("w1", "c:kidA", "Ava", "kidA") }];
  applyAll(padA.state, ops, A);
  a.link.sendPad({ ops }, a.link.tutorPeer()!.id);
  await sleep(120);
  assert.deepEqual(sorted(tutor.hub.pads.get("kidA")!.state.pages[0]!).map((e) => e.id), ["w1"]);
  assert.ok(tutor.hub.pads.get("kidA")!.lastStrokeAt > 0);
  assert.equal(b.hub.pads.size, 1); // only Ben's own (empty) pad
  assert.deepEqual([...b.hub.own!.state.pages[0]!.els.keys()], []);
  assert.equal(b.call.log.filter((m) => m.data.pad).length, 0, "Ben's client never even received a pad message");
  // tutor sets a question for Ava only; only Ava's session is sent it
  tutor.hub.setQuestion(tutor.link, ["kidA"], { text: "What is 3/4 + 1/8?" });
  await sleep(150);
  assert.ok([...a.hub.own!.state.pages[0]!.els.values()].some((e) => e.id.startsWith("q-") && e.own === "T"));
  assert.equal(b.call.log.filter((m) => m.data.pad).length, 0);
  assert.equal(b.hub.own!.state.pages[0]!.els.size, 0);
  // Ava presses Done: the tutor sees the tick
  a.hub.setDone(a.link, true);
  await sleep(100);
  assert.equal(tutor.hub.pads.get("kidA")!.done, true);
  // main-board messages did still reach everyone (only pads are private)
  me(tutor, T, [{ op: "add", page: "p1", el: stroke("main", "T") }]);
  await sleep(120);
  assert.deepEqual([ids(a.state), ids(b.state)], [["main"], ["main"]]);
});

await t("a forged pad message from one student to another is dropped on receipt", async () => {
  const room = new Room();
  const tutor = client(room, "s-tutor", "Sam", { tutor: true });
  const a = client(room, "s-a", "Ava", { tutor: false, cid: "kidA" });
  const b = client(room, "s-b", "Ben", { tutor: false, cid: "kidB" });
  await sleep(150);
  // Ava (cheating client) addresses her pad to Ben directly
  a.link.sendPad({ ops: [{ op: "add", page: PAD_PAGE, el: stroke("spam", "T") }] }, "s-b");
  await sleep(120);
  assert.equal(b.call.log.filter((m) => m.data.pad).length, 1, "it was delivered to Ben's client…");
  assert.equal(b.hub.own!.state.pages[0]!.els.size, 0, "…but Ben's pad refuses it: only the tutor may write to a pad");
  // and a pad message addressed to '*' is refused by the sender's own link
  const before = room.calls.get("s-b")!.log.length;
  a.link.sendPad({ done: true }, "*");
  await sleep(60);
  assert.equal(room.calls.get("s-b")!.log.length, before);
  assert.equal(tutor.hub.pads.get("kidA")?.done ?? false, false);
});

await t("a student who refreshes gets their pad back (tutor's copy) and the tutor gets it if the tutor rejoined", async () => {
  const room = new Room();
  const tutor = client(room, "s-tutor", "Sam", { tutor: true });
  const a = client(room, "s-a", "Ava", { tutor: false, cid: "kidA" });
  await sleep(150);
  const ops: Op[] = [{ op: "add", page: PAD_PAGE, el: stroke("w1", "c:kidA", "Ava", "kidA") }];
  applyAll(a.hub.own!.state, ops, A); a.link.sendPad({ ops }, "s-tutor");
  tutor.hub.setQuestion(tutor.link, ["kidA"], { text: "Q?" });
  await sleep(150);
  // Ava refreshes: a brand-new client with a new session id
  room.calls.delete("s-a"); a.link.stop();
  const a2 = client(room, "s-a2", "Ava", { tutor: false, cid: "kidA" });
  await sleep(700);
  const got = [...a2.hub.own!.state.pages[0]!.els.keys()];
  assert.ok(got.includes("w1") && got.some((i) => i.startsWith("q-")), `restored ${got.join(",")}`);
  // the tutor rejoins (fresh hub): Ava's client re-sends her work
  room.calls.delete("s-tutor"); tutor.link.stop();
  const tutor2 = client(room, "s-tutor2", "Sam", { tutor: true });
  await sleep(700);
  assert.ok(tutor2.hub.pads.get("kidA")?.state.pages[0]!.els.has("w1"), "tutor got Ava's work back");
});

await t("'Show to class' makes a read-only page of tutor-owned copies", async () => {
  const room = new Room();
  const tutor = client(room, "s-tutor", "Sam", { tutor: true });
  const a = client(room, "s-a", "Ava", { tutor: false, cid: "kidA" });
  await sleep(120);
  const pad = tutor.hub.pad("kidA", "Ava");
  applyAll(pad.state, [{ op: "add", page: PAD_PAGE, el: stroke("w1", "c:kidA", "Ava", "kidA") }], A);
  const ops = showToClassOps("sw1", pad, "Ava's working");
  me(tutor, T, ops);
  await sleep(200);
  const page = a.state.pages.find((p) => p.id === "sw1")!;
  assert.ok(page && page.els.size === 2);
  assert.ok([...page.els.values()].every((e) => e.own === "T"));
  // Ava can't move or delete them
  assert.equal(applyAll(a.state, [{ op: "del", page: "sw1", ids: ["w1~sw1"], v: Date.now() + 9 }], A).changed, false);
  // "Send back" removes the page for everyone
  me(tutor, T, [{ op: "pdel", id: "sw1" }]);
  await sleep(120);
  assert.equal(a.state.pages.some((p) => p.id === "sw1"), false);
});

await t("IDENTITY: a student's child id comes from the signed token — a forged hello.cid changes nothing", async () => {
  const room = new Room();
  const tutor = client(room, "s-tutor", "Sam", { tutor: true });
  const a = client(room, "s-a", "Ava", { tutor: false, cid: "kidA" });
  const b = client(room, "s-b", "Ben", { tutor: false, cid: "kidB" });
  await sleep(150);
  me(tutor, T, [{ op: "perm", all: false, ids: ["kidA"] }]);
  await sleep(120);
  // Ben claims to be Ava (hello + a pad message), hoping to write as her
  b.call.sendAppMessage({ wb: 1, hello: { cid: "kidA", name: "Ava" } }, "*");
  await sleep(100);
  assert.equal(tutor.link.peers.get("s-b")!.cid, "kidB");
  assert.equal(a.link.peers.get("s-b")!.cid, "kidB");
  me(b, B, [{ op: "add", page: "p1", el: stroke("b1", "c:kidB", "Ben", "kidB") }]);
  await sleep(150);
  assert.deepEqual(ids(tutor.state), [], "Ben is still not allowed to write");
  // his pad still lands in HIS pad on the tutor, not Ava's
  b.link.sendPad({ ops: [{ op: "add", page: PAD_PAGE, el: stroke("bp", "c:kidB", "Ben", "kidB") }] }, "s-tutor");
  await sleep(100);
  assert.equal(tutor.hub.pads.get("kidA")?.state.pages[0]!.els.size ?? 0, 0);
  assert.equal(tutor.hub.pads.get("kidB")!.state.pages[0]!.els.size, 1);
});

await t("a token with no user_id gets no child id (it can only write under 'everyone')", async () => {
  const room = new Room();
  const tutor = client(room, "s-tutor", "Sam", { tutor: true });
  const g = client(room, "s-g", "Guest", { tutor: false });
  await sleep(120);
  g.call.sendAppMessage({ wb: 1, hello: { cid: "kidA", name: "Ava" } }, "*");
  await sleep(80);
  assert.equal(tutor.link.peers.get("s-g")!.cid, undefined);
  me(tutor, T, [{ op: "perm", all: false, ids: ["kidA"] }]);
  await sleep(100);
  me(g, { tutor: false, own: "c:s-g", by: "Guest", cid: undefined }, [{ op: "add", page: "p1", el: stroke("g1", "c:s-g", "Guest") }]);
  await sleep(120);
  assert.deepEqual(ids(tutor.state), []);
});

await t("WIRE INPUT: a hostile need.have / cid / text / oversized op can't hang or poison the tutor", async () => {
  const room = new Room();
  const tutor = client(room, "s-tutor", "Sam", { tutor: true });
  const a = client(room, "s-a", "Ava", { tutor: false, cid: "kidA" });
  await sleep(150);
  me(tutor, T, [{ op: "perm", all: true, ids: [] }, { op: "add", page: "p1", el: stroke("t1", "T") }]);
  await sleep(120);
  const before = tutor.call.log.length;
  const t0 = Date.now();
  for (const have of [-1e12, -1, 1e15, NaN, "x", 1.5]) a.call.sendAppMessage({ wb: 1, need: { page: "p1", id: "t1", have } }, "s-tutor");
  a.call.sendAppMessage({ wb: 1, need: { page: "p1", id: "t1".repeat(200), have: 0 } }, "s-tutor");
  await sleep(300);
  assert.ok(Date.now() - t0 < 1500, "the tutor did not hang");
  assert.ok(room.calls.get("s-a")!.log.filter((m) => m.data.ops).length < 12, "bounded resend");
  void before;
  // a student text over the server's 2000-char limit, and an element with an over-long own / id, never reach the board as-is
  a.call.sendAppMessage({ wb: 1, ops: [
    { op: "add", page: "p1", el: { id: "long", k: "text", own: "c:kidA", z: 1, v: Date.now(), x: 0, y: 0, text: "x".repeat(5000), size: 28, c: "#000" } },
    { op: "add", page: "p1", el: { id: "y".repeat(500), k: "text", own: "c:kidA", z: 1, v: Date.now(), x: 0, y: 0, text: "hi" } },
    { op: "add", page: "p1", el: { id: "badnum", k: "stroke", own: "c:kidA", z: 1, v: "now", pts: [0, 0, 5] } },
    { op: "add", page: "p1", el: { id: "cidlong", k: "text", own: "c:kidA", z: 1, v: Date.now(), x: 0, y: 0, text: "ok", cid: "z".repeat(300), by: "b".repeat(200) } },
    { op: "nonsense" }, null, 7, { op: "add" },
  ] }, "s-tutor");
  await sleep(200);
  const els = tutor.state.pages[0]!.els;
  assert.equal(els.get("long")!.text!.length, 2000);
  assert.ok(!els.has("badnum"));
  assert.equal([...els.keys()].filter((k) => k.startsWith("yyy")).length, 0);
  const c = els.get("cidlong")!;
  assert.ok((c.cid?.length ?? 0) <= 100 && (c.by?.length ?? 0) <= 40 && c.own.length <= 120);
  // and the tutor still syncs normally afterwards
  me(tutor, T, [{ op: "add", page: "p1", el: stroke("t2", "T") }]);
  await sleep(120);
  assert.ok(a.state.pages[0]!.els.has("t2"));
});

await t("a flooding student is rate-limited; the tutor is not", async () => {
  const room = new Room();
  const tutor = client(room, "s-tutor", "Sam", { tutor: true });
  const a = client(room, "s-a", "Ava", { tutor: false, cid: "kidA" });
  await sleep(120);
  me(tutor, T, [{ op: "perm", all: true, ids: [] }]);
  await sleep(100);
  const flood = () => Array.from({ length: 300 }, (_, i) => ({ op: "add", page: "p1", el: stroke(`f${Math.random()}${i}`, "c:kidA", "Ava", "kidA") }));
  for (let i = 0; i < 10; i++) a.call.sendAppMessage({ wb: 1, ops: flood() }, "s-tutor");
  await sleep(250);
  assert.ok(tutor.state.pages[0]!.els.size <= 900, `accepted ${tutor.state.pages[0]!.els.size}`);
});

await t("LATE JOIN while presenting: the newcomer is told the board is presented, and which page the tutor is on, and gets the board + permission", async () => {
  const room = new Room();
  const tutor = client(room, "s-tutor", "Sam", { tutor: true, page: "p2" });
  await sleep(50);
  me(tutor, T, [{ op: "padd", id: "p2", bg: "lined" }, { op: "perm", all: false, ids: ["kidC"] }, { op: "add", page: "p2", el: stroke("on2", "T") }]);
  tutor.link.present(true);
  await sleep(120);
  const late = client(room, "s-late", "Cy", { tutor: false, cid: "kidC" });
  await sleep(900);
  assert.ok(late.call.log.some((m) => m.fromId === "s-tutor" && m.data.present === true), "present: true re-sent to the newcomer");
  assert.equal(late.went, "p2");
  assert.equal(late.state.pages.length, 2);
  assert.deepEqual(late.state.perm, { all: false, ids: ["kidC"] });
  assert.ok(late.state.pages[1]!.els.has("on2"));
  // a student's own "present" claim is not what the layout store believes — (checked in callObject: owner only)
});

await t("TUTOR REJOIN with a stale copy: students' newer work survives (merge, not reset); the tutor's elements still arrive", async () => {
  const room = new Room();
  const tutor = client(room, "s-tutor", "Sam", { tutor: true });
  const a = client(room, "s-a", "Ava", { tutor: false, cid: "kidA" });
  await sleep(150);
  me(tutor, T, [{ op: "perm", all: true, ids: [] }, { op: "add", page: "p1", el: stroke("t1", "T") }]);
  await sleep(120);
  me(a, A, [{ op: "add", page: "p1", el: stroke("a1", "c:kidA", "Ava", "kidA") }]);
  await sleep(150);
  assert.deepEqual(ids(tutor.state).sort(), ["a1", "t1"]);
  // the tutor reloads: their saved copy is STALE (has t1 only, not a1) — a new session id
  room.calls.delete("s-tutor"); tutor.link.stop();
  const stale = newState(); stale.perm = { all: true, ids: [] }; stale.pages[0]!.els.set("t1", { ...stroke("t1", "T") });
  const tutor2 = client(room, "s-tutor2", "Sam", { tutor: true, state: stale });
  await sleep(1300);
  assert.ok(a.state.pages[0]!.els.has("a1"), "Ava's drawing was not wiped by the stale copy");
  assert.ok(a.state.pages[0]!.els.has("t1"));
  assert.ok(tutor2.state.pages[0]!.els.has("a1"), "…and Ava handed it back to the rejoined tutor");
});

await t("HEARTBEAT: a student that drifted (phantom stroke) heals itself from the tutor's digest", async () => {
  const room = new Room();
  tuning.digestMs = 120; tuning.resyncMinMs = 0;
  try {
    const tutor = client(room, "s-tutor", "Sam", { tutor: true });
    const a = client(room, "s-a", "Ava", { tutor: false, cid: "kidA" });
    await sleep(150);
    me(tutor, T, [{ op: "add", page: "p1", el: stroke("t1", "T") }]);
    await sleep(120);
    // Ava's client holds a stroke nobody else accepted (drawn before her permission was revoked)
    applyAll(a.state, [{ op: "add", page: "p1", el: stroke("ghost", "c:kidA", "Ava", "kidA") }], { tutor: true, own: "T" });
    assert.deepEqual(ids(a.state).sort(), ["ghost", "t1"]);
    await sleep(1100);
    assert.deepEqual(ids(a.state), ["t1"], "resynced to the tutor's copy");
  } finally { tuning.digestMs = 10_000; tuning.resyncMinMs = 45_000; }
});

await t("a dropped-and-restored connection: the student hands back its work and re-syncs", async () => {
  const room = new Room();
  const tutor = client(room, "s-tutor", "Sam", { tutor: true });
  const a = client(room, "s-a", "Ava", { tutor: false, cid: "kidA" });
  await sleep(150);
  me(tutor, T, [{ op: "perm", all: true, ids: [] }]);
  await sleep(100);
  // Ava draws while offline (her messages are lost), the tutor draws meanwhile
  const off = a.call.sendAppMessage.bind(a.call); a.call.sendAppMessage = () => undefined;
  me(a, A, [{ op: "add", page: "p1", el: stroke("offline", "c:kidA", "Ava", "kidA") }]);
  await sleep(100);
  a.call.sendAppMessage = off;
  me(tutor, T, [{ op: "add", page: "p1", el: stroke("missed", "T") }]);
  a.call.fire("network-connection", { event: "interrupted" });
  a.call.fire("network-connection", { event: "connected" });
  await sleep(900);
  assert.ok(tutor.state.pages[0]!.els.has("offline"), "the tutor got Ava's offline drawing");
  assert.ok(a.state.pages[0]!.els.has("missed"), "Ava got what she missed");
});

await t("packBytes counts UTF-8 bytes: CJK text is split/clipped to fit; nothing exceeds the limit", async () => {
  const cjk = "字".repeat(1500);
  const ops: Op[] = [
    { op: "add", page: "p1", el: { id: "cjk", k: "text", own: "T", z: 1, v: 1, x: 0, y: 0, text: cjk } },
    ...Array.from({ length: 30 }, (_, i): Op => ({ op: "add", page: "p1", el: { id: `c${i}`, k: "text", own: "T", z: 1, v: 1, x: 0, y: 0, text: "字".repeat(120) } })),
  ];
  const { packs, clipped } = packBytes(ops, 3000);
  assert.ok(clipped >= 1);
  const enc = new TextEncoder();
  for (const p of packs) assert.ok(enc.encode(JSON.stringify({ wb: 1, ops: p })).length < 4096, "under Daily's 4 KB");
  assert.equal(packs.flat().length, ops.length, "no op lost");
});

console.log(`\n${n} passed${process.exitCode ? " (with failures)" : ""}`);
process.exit(process.exitCode ?? 0);
}
void main();
