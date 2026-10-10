// Learning Hub hardening (10 Oct 2026, owner-accepted defaults). Children's data. Pure tests: no Firestore read or write happens here
// (the settings-read failure is injected by making the server's Firestore handle throw). The attack cases that need real data are in
// tests/emulator/hub-hardening.test.mts.
import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { mergeHub } from "../lib/hubConfig";
import { db } from "../server/src/firebase";
import { enforceAccess, forgetSettings } from "../server/src/middleware/access";
import { boardForViewer, boardIsStale } from "../server/src/lib/hubBoardRules";
import { DRAFT_MAX_BYTES, START_PER_HOUR, takeToken } from "../server/src/lib/hubLimits";
import { VIDEO_OFF } from "../server/src/lib/hubVideo";
import { ownsSharedSourceFlag } from "../server/src/lib/hubCore";
import { scrubNotice } from "../server/src/lib/hubNotify";
import { scrubPayload } from "../server/src/oak/noOak";

function fakeRes() {
  const r: { status: number; body: any; sent: boolean } = { status: 200, body: null, sent: false };
  const res: any = { status(n: number) { r.status = n; return res; }, json(b: unknown) { r.body = b; r.sent = true; return res; } };
  return { res, r };
}
const staffReq = (path: string, method = "GET") => ({ auth: { role: "staff", tenantId: "t-fc", franchiseId: null, permRole: "x" }, baseUrl: "/api/learning-hub", path, method, user: { uid: "u1", email: "s@emu.test" } }) as any;

describe("enforceAccess fails CLOSED when the settings read errors", () => {
  it("a hub read by staff gets 503 settings_unavailable and never reaches the route", async () => {
    forgetSettings("t-fc");
    const m = mock.method(db, "collection", () => { throw new Error("injected: settings unreadable"); });
    try {
      const { res, r } = fakeRes();
      let nexted = false;
      await enforceAccess(staffReq("/attempts"), res, () => { nexted = true; });
      assert.equal(nexted, false, "the request must not continue");
      assert.equal(r.status, 503);
      assert.equal(r.body.code, "settings_unavailable");
    } finally { m.mock.restore(); forgetSettings("t-fc"); }
  });
  it("same for a company owner on a gated feature route (the whole gate is closed, not just the hub)", async () => {
    forgetSettings("t-fc");
    const m = mock.method(db, "collection", () => { throw new Error("injected"); });
    try {
      const { res, r } = fakeRes();
      let nexted = false;
      const req = { auth: { role: "company", tenantId: "t-fc", franchiseId: null }, baseUrl: "/api/learning-hub", path: "/students", method: "GET", user: { uid: "u2" } } as any;
      await enforceAccess(req, res, () => { nexted = true; });
      assert.equal(nexted, false);
      assert.equal(r.status, 503);
    } finally { m.mock.restore(); forgetSettings("t-fc"); }
  });
  it("a route the gate does not cover still passes through (no settings needed)", async () => {
    const { res } = fakeRes();
    let nexted = false;
    await enforceAccess({ auth: { role: "company", tenantId: "t-fc" }, baseUrl: "/api", path: "/health", method: "GET" } as any, res, () => { nexted = true; });
    assert.equal(nexted, true);
  });
});

describe("revealAnswers defaults to after_pass", () => {
  it("nothing stored, or garbage stored: after_pass", () => {
    assert.equal(mergeHub(undefined).revealAnswers, "after_pass");
    assert.equal(mergeHub({}).revealAnswers, "after_pass");
    assert.equal(mergeHub({ revealAnswers: "always" as never }).revealAnswers, "after_pass");
    assert.equal(mergeHub({ revealAnswers: null as never }).revealAnswers, "after_pass");
  });
  it("a valid choice the provider made is kept", () => {
    for (const v of ["after_pass", "after_submit", "after_marked", "never"] as const) assert.equal(mergeHub({ revealAnswers: v }).revealAnswers, v);
  });
});

describe("whiteboard: a parent sees only their own child's drawings plus the tutor's", () => {
  const pages = [{ id: "p1", background: "blank", elements: [
    { id: "t1", own: "T", k: "text" }, { id: "k1", own: "c:K1", cid: "K1", by: "Ava", k: "stroke" }, { id: "k3", own: "c:K3", cid: "K3", by: "Cy", k: "stroke" },
    { id: "odd", own: "c:K3", k: "stroke" }, { id: "x", own: "someone", k: "stroke", cid: "K3" },
  ] }] as any;
  it("the K1 family sees T + K1 only", () => {
    const out = boardForViewer(pages, new Set(["K1"]));
    assert.deepEqual(out[0].elements.map((e: any) => e.id), ["t1", "k1"]);
  });
  it("the K3 family sees T + K3's, never K1's name or strokes", () => {
    const out = boardForViewer(pages, new Set(["K3"]));
    assert.ok(!JSON.stringify(out).includes("Ava"));
    assert.deepEqual(out[0].elements.map((e: any) => e.id), ["t1", "k3", "odd", "x"]);
  });
  it("a family with no child in the lesson sees only the tutor's", () => {
    assert.deepEqual(boardForViewer(pages, new Set())[0].elements.map((e: any) => e.id), ["t1"]);
  });
  it("does not change the stored pages", () => {
    const before = JSON.stringify(pages); boardForViewer(pages, new Set(["K1"])); assert.equal(JSON.stringify(pages), before);
  });
});

describe("whiteboard: a stale save is refused", () => {
  it("same base: fine; older base: stale; nothing stored yet: fine", () => {
    assert.equal(boardIsStale("2026-10-10T10:00:00.000Z", "2026-10-10T10:00:00.000Z"), false);
    assert.equal(boardIsStale("2026-10-10T10:05:00.000Z", "2026-10-10T10:00:00.000Z"), true);
    assert.equal(boardIsStale(null, null), false);
    assert.equal(boardIsStale(null, undefined), false);
  });
  it("a save made without saying which copy it started from, over a stored board, is stale (no silent last-write-wins)", () => {
    assert.equal(boardIsStale("2026-10-10T10:05:00.000Z", undefined), true);
    assert.equal(boardIsStale("2026-10-10T10:05:00.000Z", null), true);
  });
});

describe("rate limits and draft size", () => {
  it("draft cap is well below the old 200KB", () => assert.ok(DRAFT_MAX_BYTES <= 64_000 && DRAFT_MAX_BYTES >= 20_000));
  it("quiz starts: 30 per hour per child, the 31st is refused, another child is unaffected, the window resets", () => {
    assert.equal(START_PER_HOUR, 30);
    const t0 = 1_000_000;
    for (let i = 0; i < 30; i++) assert.equal(takeToken("start:A:K1", 30, 3_600_000, t0 + i).ok, true);
    const over = takeToken("start:A:K1", 30, 3_600_000, t0 + 31);
    assert.equal(over.ok, false); assert.ok(over.retryAfterSec > 0);
    assert.equal(takeToken("start:A:K2", 30, 3_600_000, t0 + 31).ok, true);
    assert.equal(takeToken("start:A:K1", 30, 3_600_000, t0 + 3_600_001).ok, true);
  });
});

describe("live lessons with no video key", () => {
  it("a clear 'not switched on yet' reply, not a 503", () => {
    assert.notEqual(VIDEO_OFF.status, 503);
    assert.equal(VIDEO_OFF.code, "video_not_switched_on");
    assert.match(VIDEO_OFF.message, /live lessons are not switched on yet/i);
  });
});

describe("owner tenants are a flag on the tenant doc, not hardcoded ids", () => {
  it("only an explicit true counts", () => {
    assert.equal(ownsSharedSourceFlag({ ownsSharedSource: true }), true);
    for (const v of [undefined, null, {}, { ownsSharedSource: false }, { ownsSharedSource: "true" }, { ownsSharedSource: 1 }]) assert.equal(ownsSharedSourceFlag(v as never), false);
  });
});

describe("publisher name scrub reaches bells, emails and the i18n bundle", () => {
  it("scrubNotice cleans title and body", () => {
    const n = scrubNotice({ title: "New lesson from Oak National Academy", body: "Maya has a new lesson. Content from Oak National Academy under the Open Government Licence." });
    assert.ok(!/oak national|open government|OGL/i.test(`${n.title} ${n.body}`), JSON.stringify(n));
    assert.match(n.body, /Maya has a new lesson/);
  });
  it("scrubPayload (shared with the API guard) can clean an i18n bundle", () => {
    const bundle = { hubfam: { a: "Learn with Oak National Academy videos", b: "Plant an oak tree and watch the acorns grow" } };
    const out = scrubPayload(bundle) as any;
    assert.ok(!/oak national/i.test(JSON.stringify(out)));
    assert.match(out.hubfam.b, /oak tree/);
  });
});
