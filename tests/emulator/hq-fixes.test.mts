// HQ platform portal fixes (areas run platform-hq, 10 Oct; cases X06-X36 of ~/ActivityOS-QA/runs/areas-10oct/platform-hq/CASES.md).
// Real API + Firestore emulator (npm run test:emu), synthetic data only. This file starts its OWN API process (cold caches, own rate limits) with a
// preload (tests/emulator/support/hq-stubs.cjs) that gives it two test doubles: audit-write fault injection and a STUB for the AI model, so no real
// model is ever called. Nothing here touches anything but the emulator.
//   X16  bank details masked in the providers list; full details only via an audited, rate-limited Reveal (fails closed)
//   X06  every impersonated request is logged (reads too): target tenant, method, path, status, body hash, never the body; a reason is required
//   X07  audit write fails -> acting requests are refused (503), the open is a clear 503 not a 500
//   X08  disabled / closed targets open read-only; own / HQ / junk ids refused    X34  10 opens a minute
//   X12  On-trial figure = Trial tab rule    X17  unknown feature refused, switch bites at once    X18/X21  pricing + tracker validation, history, reset
//   X20/X36  lead delete is soft + audited, contacted stores who    X23  support replies atomic, authored, idempotent    X26  no duplicate rings
//   X27  AI digest has no personal data    X28  mark-handled closes a deletion request    X29  bookings need a tenant    X31  accounts search + paging + lookup log
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { API, db, login, makeProvider, sleep, uniq, type Provider } from "./helpers.mts";

const u = uniq();
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const port = Number(new URL(API).port) + 77;
const B = `http://localhost:${port}`;
const FAIL = join(tmpdir(), `hq-fail-${u}.txt`);
const GROQ = join(tmpdir(), `hq-groq-${u}.json`);
let child: ChildProcess | null = null;
const failing = (...names: string[]) => (names.length ? writeFileSync(FAIL, names.join("\n")) : rmSync(FAIL, { force: true }));

async function callB(method: string, path: string, token: string | null, body?: unknown, headers: Record<string, string> = {}): Promise<{ status: number; json: any }> {
  const r = await fetch(`${B}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const t = await r.text();
  let json: any = null;
  try { json = t ? JSON.parse(t) : null; } catch { json = t; }
  return { status: r.status, json };
}

interface Hq { token: string; uid: string; email: string }
async function mkHq(tag: string): Promise<Hq> {
  const email = `hq-${tag}-${u}@emu.test`;
  const s = await login(email);
  await db.collection("users").doc(s.uid).set({ email, role: "platform", name: `HQ ${tag}`, twoFaVerifiedAt: Date.now() });
  return { token: s.token, uid: s.uid, email };
}
async function mkUser(email: string, extra: Record<string, unknown> = {}) {
  const s = await login(email);
  await db.collection("users").doc(s.uid).set({ email, role: "parent", chosen: true, name: `Fam ${u}`, ...extra }, { merge: true });
  return s;
}
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
const rowsFor = async (collection: string, field: string, value: string) => (await db.collection(collection).where(field, "==", value).get()).docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) }));
async function until<T>(fn: () => Promise<T | null | undefined | false>, ms = 6000): Promise<T> {
  const stop = Date.now() + ms;
  for (;;) { const v = await fn(); if (v) return v as T; if (Date.now() > stop) throw new Error("timed out waiting"); await sleep(100); }
}

let PA: Provider, PB: Provider, PC: Provider;
let owner: { token: string; uid: string };
let parentA: { token: string; uid: string }, parentDis: { uid: string }, parentClosed: { uid: string };
let h1: Hq, h2: Hq;
const SECRET = `SECRETCAT-${u}`;
const leakA = "jane.smith@example.com", leakB = "Jane Smith", leakC = "Ava Testchild", leakD = "07700 900123";

before(async () => {
  PA = await makeProvider("hqa"); PB = await makeProvider("hqb"); PC = await makeProvider("hqc");
  owner = await login(PA.email);
  // Subscription states for the On-trial figure (X12): PA's trial is running, PB's ran out two days ago.
  await db.collection("tenants").doc(PA.tenantId).set({ subscription: { status: "trialing", plan: "company", price: 49, cadence: "month", trialEndsAt: day(5), cardLast4: "4242" } }, { merge: true });
  await db.collection("tenants").doc(PB.tenantId).set({ subscription: { status: "trialing", plan: "company", price: 49, cadence: "month", trialEndsAt: day(-2), cardLast4: "4242" } }, { merge: true });
  // Bank details (X16).
  await db.collection("libraries").doc(PA.tenantId).set({ settings: { billing: { bankName: "Testbank", accountName: "Acme Ltd", sortCode: "20-30-34", accountNumber: "12345678" } } }, { merge: true });
  parentA = await mkUser(`pa-hq-${u}@emu.test`);
  parentDis = await mkUser(`pdis-hq-${u}@emu.test`, { disabled: true });
  parentClosed = await mkUser(`pclosed-hq-${u}@emu.test`, { deactivatedAt: new Date().toISOString() });
  for (let i = 1; i <= 5; i++) await mkUser(`acct-${u}-${i}@emu.test`, { name: `Acct ${u} ${i}` });
  h1 = await mkHq("h1"); h2 = await mkHq("h2");
  // Support threads for the AI digest (X27): a parent's name, email, phone and child's name inside the free text.
  const at = new Date().toISOString();
  await db.collection("supportThreads").add({ party: "customer", name: leakB, email: leakA, tier: "company", providerId: PA.tenantId, providerName: "Acme Ltd", subject: `Incident question ${u}`, kind: "message", status: "open", unreadByHq: true, messages: [{ id: `m-${u}`, from: "them", body: `Parent ${leakB} (${leakA}, ${leakD}) says child ${leakC} was hurt; please advise.`, at }], createdAt: at, updatedAt: at });
  await db.collection("deletionRequests").add({ uid: parentA.uid, email: `pa-hq-${u}@emu.test`, role: "parent", reason: null, status: "pending", requestedAt: at, dueBy: day(30).slice(0, 10) });
  // The API process under test.
  const env = { ...process.env, PORT: String(port), GROQ_API_KEY: "stub-key-not-a-real-key", HQ_STUB_FAIL_FILE: FAIL, HQ_STUB_GROQ_OUT: GROQ };
  child = spawn(join(root, "server/node_modules/.bin/tsx"), ["--require", join(root, "tests/emulator/support/hq-stubs.cjs"), "server/src/index.ts"], { cwd: root, env, stdio: ["ignore", "ignore", "inherit"] });
  let up = false;
  for (let i = 0; i < 120 && !up; i++) { up = await fetch(`${B}/health`).then((r) => r.status < 500, () => false); if (!up) await sleep(500); }
  assert.ok(up, "the HQ test API process did not start");
});
after(() => { try { child?.kill("SIGTERM"); } catch { /* gone */ } rmSync(FAIL, { force: true }); rmSync(GROQ, { force: true }); });

describe("X16: bank details", () => {
  it("the providers list shows only the last digits, and never the full numbers anywhere in the payload", async () => {
    const r = await callB("GET", "/api/platform/providers", h1.token);
    assert.equal(r.status, 200);
    const p = r.json.providers.find((x: any) => x.id === PA.tenantId);
    assert.ok(p?.bank, "PA has a bank record");
    assert.equal(p.bank.sortCode, "**-**-34");
    assert.equal(p.bank.accountNumber, "****5678");
    const raw = JSON.stringify(r.json);
    assert.ok(!raw.includes("12345678") && !raw.includes("20-30-34"), "full numbers are not in the list payload");
  });
  it("Reveal returns the full details, writes an audit row (who, which tenant, when) without the numbers, and non-HQ is refused", async () => {
    const r = await callB("POST", `/api/platform/providers/${PA.tenantId}/bank-reveal`, h1.token, {});
    assert.equal(r.status, 200);
    assert.equal(r.json.bank.sortCode, "20-30-34");
    assert.equal(r.json.bank.accountNumber, "12345678");
    const rows = (await rowsFor("platformAudit", "byUid", h1.uid)).filter((x) => x.kind === "bank_reveal" && x.tenantId === PA.tenantId);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].byEmail, h1.email);
    assert.ok(rows[0].at);
    assert.ok(!JSON.stringify(rows[0]).includes("12345678") && !JSON.stringify(rows[0]).includes("20-30-34"), "the audit row holds no bank numbers");
    assert.equal((await callB("POST", `/api/platform/providers/${PA.tenantId}/bank-reveal`, owner.token, {})).status, 403);
    assert.equal((await callB("POST", `/api/platform/providers/nope-${u}/bank-reveal`, h1.token, {})).status, 404);
  });
  it("fails closed: if the audit row cannot be written the numbers are not shown", async () => {
    failing("platformAudit");
    try {
      const r = await callB("POST", `/api/platform/providers/${PA.tenantId}/bank-reveal`, h1.token, {});
      assert.equal(r.status, 503);
      assert.equal(r.json.code, "audit_unavailable");
      assert.ok(!JSON.stringify(r.json).includes("12345678"));
    } finally { failing(); }
  });
  it("is rate limited (10 a minute per HQ user)", async () => {
    const h = await mkHq("rev");
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await callB("POST", `/api/platform/providers/${PA.tenantId}/bank-reveal`, h.token, {})).status);
    assert.deepEqual(codes.slice(0, 10), Array(10).fill(200));
    assert.deepEqual(codes.slice(10), [429, 429]);
    assert.equal((await rowsFor("platformAudit", "byUid", h.uid)).filter((x) => x.kind === "bank_reveal").length, 10, "only the revealed ones are logged");
  });
});

describe("X06/X07/X08/X34: opening and acting as an account", () => {
  it("a reason of at least 5 characters is required and is stored on the open row with the target tenant", async () => {
    const h = await mkHq("open");
    const none = await callB("POST", "/api/platform/impersonate", h.token, { uid: owner.uid });
    assert.equal(none.status, 400); assert.equal(none.json.code, "reason_required");
    assert.equal((await callB("POST", "/api/platform/impersonate", h.token, { uid: owner.uid, reason: "abcd" })).status, 400);
    assert.equal((await callB("POST", "/api/platform/impersonate", h.token, { uid: owner.uid, reason: "      " })).status, 400);
    const ok = await callB("POST", "/api/platform/impersonate", h.token, { uid: owner.uid, reason: "  Provider rang about a refund  " });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.status, "active"); assert.equal(ok.json.readOnly, false);
    const open = (await rowsFor("impersonationLog", "byUid", h.uid)).filter((x) => x.kind === "open");
    assert.equal(open.length, 1, "refused opens leave no row");
    assert.equal(open[0].reason, "Provider rang about a refund");
    assert.equal(open[0].targetTenantId, PA.tenantId);
    assert.equal(open[0].targetUid, owner.uid);
  });
  it("every request while acting is logged, reads too: tenant, method, path, status and a short body hash, never the body; polling is not", async () => {
    const h = await mkHq("act");
    const as = { "x-act-as": owner.uid };
    assert.equal((await callB("GET", "/api/me", h.token, undefined, as)).status, 200);
    assert.equal((await callB("GET", "/api/bookings", h.token, undefined, as)).status, 200);
    const w = await callB("POST", "/api/expenses", h.token, { date: "2026-10-10", category: SECRET, amount: 1 }, as);
    assert.equal(w.status, 201, JSON.stringify(w.json));
    const rows = await until(async () => {
      const r = (await rowsFor("impersonationLog", "byUid", h.uid)).filter((x) => x.kind === "request");
      return r.length >= 2 && r.every((x) => x.status !== undefined) ? r : null;
    });
    assert.ok(!rows.some((x) => x.path === "/api/me"), "polling paths are not logged");
    const read = rows.find((x) => x.method === "GET" && x.path === "/api/bookings")!;
    assert.ok(read, "the read is logged");
    assert.equal(read.targetTenantId, PA.tenantId); assert.equal(read.status, 200); assert.equal(read.bodyHash ?? null, null);
    const write = rows.find((x) => x.method === "POST" && x.path === "/api/expenses")!;
    assert.ok(write, "the write is logged");
    assert.match(write.bodyHash, /^[0-9a-f]{12}$/); assert.equal(write.status, 201); assert.equal(write.targetTenantId, PA.tenantId);
    assert.equal(write.targetUid, owner.uid); assert.equal(write.byUid, h.uid);
    assert.ok(!JSON.stringify(rows).includes(SECRET), "the body content is never stored");
  });
  it("X07 fails closed: when the audit row cannot be written the open is a clear 503 and acting requests are refused (the write does not happen)", async () => {
    const h = await mkHq("fail");
    const before = (await db.collection("expenses").where("category", "==", `X07-${u}`).get()).size;
    failing("impersonationLog");
    try {
      const open = await callB("POST", "/api/platform/impersonate", h.token, { uid: owner.uid, reason: "audit is down" });
      assert.equal(open.status, 503); assert.equal(open.json.code, "audit_unavailable");
      const read = await callB("GET", "/api/bookings", h.token, undefined, { "x-act-as": owner.uid });
      assert.equal(read.status, 503); assert.equal(read.json.code, "audit_unavailable");
      const w = await callB("POST", "/api/expenses", h.token, { date: "2026-10-10", category: `X07-${u}`, amount: 1 }, { "x-act-as": owner.uid });
      assert.equal(w.status, 503);
    } finally { failing(); }
    assert.equal((await db.collection("expenses").where("category", "==", `X07-${u}`).get()).size, before, "nothing was written");
    // Control: with the audit healthy the same write goes through and is logged.
    const w2 = await callB("POST", "/api/expenses", h.token, { date: "2026-10-10", category: `X07-${u}`, amount: 1 }, { "x-act-as": owner.uid });
    assert.equal(w2.status, 201);
  });
  it("X08: a switched-off or closed account opens for looking only; HQ, own and junk ids are refused", async () => {
    const h = await mkHq("frozen");
    const dis = await callB("POST", "/api/platform/impersonate", h.token, { uid: parentDis.uid, reason: "parent asked why" });
    assert.equal(dis.status, 200); assert.equal(dis.json.status, "disabled"); assert.equal(dis.json.readOnly, true);
    const clo = await callB("POST", "/api/platform/impersonate", h.token, { uid: parentClosed.uid, reason: "closed their account" });
    assert.equal(clo.status, 200); assert.equal(clo.json.status, "closed"); assert.equal(clo.json.readOnly, true);
    for (const target of [parentDis.uid, parentClosed.uid]) {
      assert.equal((await callB("GET", "/api/my/bookings", h.token, undefined, { "x-act-as": target })).status, 200, "reading is allowed");
      const w = await callB("PUT", "/api/my/children/none", h.token, { name: "x" }, { "x-act-as": target });
      assert.equal(w.status, 403); assert.equal(w.json.code, "impersonation_target_frozen");
    }
    assert.equal((await callB("POST", "/api/platform/impersonate", h.token, { uid: h.uid, reason: "my own account" })).status, 400);
    assert.equal((await callB("POST", "/api/platform/impersonate", h.token, { uid: h2.uid, reason: "another HQ user" })).status, 400);
    assert.equal((await callB("POST", "/api/platform/impersonate", h.token, { uid: "a/b", reason: "slash in the id" })).status, 400);
    assert.equal((await callB("POST", "/api/platform/impersonate", h.token, { uid: "x".repeat(500), reason: "very long id" })).status, 400);
    assert.equal((await callB("POST", "/api/platform/impersonate", h.token, { uid: `gone-${u}`, reason: "deleted account" })).status, 404);
    // A junk act-as header is ignored (HQ stays HQ), never a 500.
    assert.equal((await callB("GET", "/api/platform/providers", h.token, undefined, { "x-act-as": "a/b" })).status, 200);
  });
  it("HQ acting as a healthy parent can still edit that parent's own data (owner decision HV58), and it is audited", async () => {
    const h = await mkHq("parent");
    const r = await callB("GET", "/api/my/bookings", h.token, undefined, { "x-act-as": parentA.uid });
    assert.equal(r.status, 200);
    const rows = await until(async () => { const x = (await rowsFor("impersonationLog", "byUid", h.uid)).filter((y) => y.path === "/api/my/bookings"); return x.length ? x : null; });
    assert.equal(rows[0].targetUid, parentA.uid);
  });
  it("X34: opening is limited to 10 a minute per HQ user and the audit table is not flooded", async () => {
    const h = await mkHq("rate");
    const codes: number[] = [];
    for (let i = 0; i < 14; i++) codes.push((await callB("POST", "/api/platform/impersonate", h.token, { uid: parentA.uid, reason: "rate limit test" })).status);
    assert.deepEqual(codes.slice(0, 10), Array(10).fill(200));
    assert.ok(codes.slice(10).every((c) => c === 429), codes.join(","));
    assert.equal((await rowsFor("impersonationLog", "byUid", h.uid)).filter((x) => x.kind === "open").length, 10);
  });
});

describe("X12/X17: trial figure and feature switches", () => {
  it("the On-trial figure counts running trials only (same rule as the Trial tab)", async () => {
    const r = await callB("GET", "/api/platform/subscriptions", h1.token);
    assert.equal(r.status, 200);
    const rows: any[] = r.json.rows;
    const running = rows.filter((x) => x.status === "trialing" && (!x.trialEndsAt || Date.parse(x.trialEndsAt) >= Date.now())).length;
    const allTrialing = rows.filter((x) => x.status === "trialing").length;
    assert.ok(rows.find((x) => x.id === PB.tenantId && x.status === "trialing"), "PB has an ended trial");
    assert.ok(allTrialing > running, "there is an ended trial that must not be counted");
    assert.equal(r.json.summary.trialing, running);
  });
  it("an unknown feature is refused and stored nowhere; a real one takes effect on the very next request", async () => {
    assert.equal((await callB("GET", "/api/tasks", PC.token)).status, 200, "tasks is on (this also warms the API's settings cache)");
    const bad = await callB("PATCH", `/api/platform/providers/${PC.tenantId}/features`, h1.token, { view: "zzz", on: false });
    assert.equal(bad.status, 400); assert.equal(bad.json.code, "unknown_feature");
    assert.equal(((await db.collection("libraries").doc(PC.tenantId).get()).data()?.settings?.features ?? {}).zzz, undefined);
    assert.equal((await callB("PATCH", `/api/platform/providers/${PC.tenantId}/features`, h1.token, { view: "tasks", on: false })).status, 200);
    assert.equal((await callB("GET", "/api/tasks", PC.token)).status, 403, "switched off at once (no 10 s wait)");
    assert.equal((await callB("PATCH", `/api/platform/providers/${PC.tenantId}/features`, h1.token, { view: "tasks", on: true })).status, 200);
    assert.equal((await callB("GET", "/api/tasks", PC.token)).status, 200, "and back on at once");
    assert.equal((await callB("PATCH", `/api/platform/providers/${PC.tenantId}/features`, PC.token, { view: "tasks", on: false })).status, 403);
    assert.equal((await callB("PATCH", "/api/platform/providers/nope/features", h1.token, { view: "tasks", on: false })).status, 404);
  });
});

describe("X18/X21: pricing and the test tracker", () => {
  after(async () => { await callB("POST", "/api/subscription/pricing/reset", h1.token, {}); await db.collection("testTrackerResults").doc("LT-001").delete(); });
  it("silly prices and unknown plans are refused; an edit is recorded (who, when, old, new); reset restores the seed and is recorded", async () => {
    assert.equal((await callB("POST", "/api/subscription/pricing/reset", h2.token, {})).status, 200, "start from the seed prices whatever an earlier run left behind");
    const g = await callB("GET", "/api/subscription/pricing", h1.token);
    assert.equal(g.status, 200);
    const plans: any[] = JSON.parse(JSON.stringify(g.json.defaults));
    const withPlan = (fn: (p: any[]) => void) => { const x = JSON.parse(JSON.stringify(plans)); fn(x); return { plans: x }; };
    const fl = (p: any[]) => p.find((x) => x.id === "freelancer");
    for (const [name, body] of Object.entries({
      zero: withPlan((p) => { fl(p).price = 0; }), huge: withPlan((p) => { fl(p).price = 1e9; }), negative: withPlan((p) => { fl(p).price = -5; }),
      threeDecimals: withPlan((p) => { fl(p).price = 29.999; }), bandZero: withPlan((p) => { p.find((x) => x.id === "company").bands[0].price = 0; }),
      unknownPlan: withPlan((p) => { p.push({ id: "ZZZ-9999", name: "x", price: 5, cadence: "month", blurb: "", features: [] }); }),
    })) assert.equal((await callB("PUT", "/api/subscription/pricing", h1.token, body)).status, 400, name);
    const ok = await callB("PUT", "/api/subscription/pricing", h1.token, withPlan((p) => { fl(p).price = 35; }));
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    const h = await callB("GET", "/api/subscription/pricing/history", h1.token);
    assert.equal(h.status, 200);
    assert.equal(h.json.history[0].action, "edit"); assert.equal(h.json.history[0].byEmail, h1.email); assert.ok(h.json.history[0].at);
    assert.ok(h.json.history[0].changes.some((c: any) => c.plan === "freelancer" && c.path === "price" && c.old === 29 && c.new === 35));
    const reset = await callB("POST", "/api/subscription/pricing/reset", h2.token, {});
    assert.equal(reset.status, 200); assert.equal(reset.json.isDefault, true);
    const after = await callB("GET", "/api/subscription/pricing", h1.token);
    assert.equal(after.json.isDefault, true); assert.equal(fl(after.json.plans).price, 29);
    const h2r = await callB("GET", "/api/subscription/pricing/history", h1.token);
    assert.equal(h2r.json.history[0].action, "reset"); assert.equal(h2r.json.history[0].byEmail, h2.email);
    assert.ok(h2r.json.history[0].changes.some((c: any) => c.plan === "freelancer" && c.path === "price" && c.old === 35 && c.new === 29));
    for (const [m, p] of [["PUT", "/api/subscription/pricing"], ["POST", "/api/subscription/pricing/reset"], ["GET", "/api/subscription/pricing/history"]] as const)
      assert.equal((await callB(m, p, owner.token, m === "PUT" ? { plans } : m === "POST" ? {} : undefined)).status, 403, `${m} ${p}`);
  });
  it("the tracker only takes checks that exist in the catalogue", async () => {
    const put = (id: string, body: any, tok = h1.token) => callB("PUT", `/api/platform/test-tracker/${id}`, tok, body);
    assert.equal((await put("ZZZ-9999", { status: "pass" })).status, 404);
    assert.equal((await put("ab-1", { status: "pass" })).status, 400);
    assert.equal((await put("LT-001", { status: "pass", note: "n".repeat(2001) })).status, 400);
    assert.equal((await put("LT-001", { status: "pass", byAccount: { hacker: "pass" } })).status, 400);
    assert.equal((await put("LT-001", { status: "fail", note: "first" })).status, 200);
    assert.equal((await put("LT-001", { status: "pass", note: "second" })).status, 200);
    const doc = (await db.collection("testTrackerResults").doc("LT-001").get()).data()!;
    assert.deepEqual(doc.history.map((x: any) => x.status), ["fail", "pass"]);
    assert.equal(doc.history[1].by, h1.email);
    assert.equal((await put("LT-001", { status: "pass" }, owner.token)).status, 403);
  });
});

describe("X20/X36: leads and at-risk", () => {
  it("deleting a lead is a soft delete with who and when, and an audit row; it leaves the board and cannot be edited back to life", async () => {
    const c = await callB("POST", "/api/platform/leads", h1.token, { business: `Lead ${u}`, email: `lead-${u}@emu.test`, stage: "new" });
    assert.equal(c.status, 201);
    const id = c.json.id as string;
    assert.ok((await callB("GET", "/api/platform/leads", h1.token)).json.some((l: any) => l.id === id));
    assert.equal((await callB("DELETE", `/api/platform/leads/${id}`, owner.token)).status, 403);
    assert.equal((await callB("DELETE", `/api/platform/leads/${id}`, h2.token)).status, 200);
    assert.equal((await callB("GET", `/api/platform/leads/${id}`, h1.token)).status, 404);
    assert.ok(!(await callB("GET", "/api/platform/leads", h1.token)).json.some((l: any) => l.id === id), "gone from the board");
    const doc = (await db.collection("leads").doc(id).get()).data()!;
    assert.ok(doc.deletedAt); assert.equal(doc.deletedBy, h2.email); assert.equal(doc.inPipeline, false); assert.equal(doc.business, `Lead ${u}`, "the record is kept");
    const audit = (await rowsFor("platformAudit", "byUid", h2.uid)).filter((x) => x.kind === "lead_deleted" && x.leadId === id);
    assert.equal(audit.length, 1);
    assert.equal((await callB("PUT", `/api/platform/leads/${id}`, h1.token, { stage: "demo" })).status, 404);
    assert.equal((await callB("DELETE", `/api/platform/leads/${id}`, h1.token)).status, 404, "a second delete finds nothing");
    assert.equal((await db.collection("leads").doc(id).get()).data()!.inPipeline, false, "still off the board");
  });
  it("'contacted' stores who and when once; a second person does not overwrite it; un-marking clears it", async () => {
    const first = await callB("POST", `/api/platform/at-risk/${PA.tenantId}/contacted`, h1.token, {});
    assert.equal(first.status, 200); assert.equal(first.json.contactedBy, h1.email);
    const second = await callB("POST", `/api/platform/at-risk/${PA.tenantId}/contacted`, h2.token, {});
    assert.equal(second.json.contactedBy, h1.email); assert.equal(second.json.contactedAt, first.json.contactedAt);
    const t = (await db.collection("tenants").doc(PA.tenantId).get()).data()!;
    assert.equal(t.retentionContactedBy, h1.email); assert.equal(t.retentionContactedByUid, h1.uid);
    const off = await callB("POST", `/api/platform/at-risk/${PA.tenantId}/contacted`, h2.token, { contacted: false });
    assert.equal(off.json.contactedAt, null);
    assert.equal((await db.collection("tenants").doc(PA.tenantId).get()).data()!.retentionContactedBy, null);
    assert.equal((await callB("POST", `/api/platform/at-risk/nope-${u}/contacted`, h1.token, {})).status, 404);
  });
});

describe("X23/X26/X27: support", () => {
  let thread = "";
  const threadDoc = async (id: string) => (await db.collection("supportThreads").doc(id).get()).data() as any;
  const bells = async () => (await rowsFor("notifications", "tenantId", PA.tenantId)).filter((n) => String(n.title).startsWith("Reply from")).length;
  it("replies at the same instant are all kept, each carries its author; a double click is one message, one bell", async () => {
    const c = await callB("POST", "/api/platform/support", h1.token, { party: "provider", providerId: PA.tenantId, name: "Acme", email: PA.email, subject: `Thread ${u}`, body: "opening" });
    assert.equal(c.status, 201);
    thread = c.json.id;
    const b0 = await bells();
    const [r1, r2] = await Promise.all([
      callB("POST", `/api/platform/support/${thread}/messages`, h1.token, { body: "alpha" }),
      callB("POST", `/api/platform/support/${thread}/messages`, h2.token, { body: "beta" }),
    ]);
    assert.equal(r1.status, 200); assert.equal(r2.status, 200);
    let t = await threadDoc(thread);
    const mine = (b: string) => t.messages.filter((m: any) => m.body === b);
    assert.equal(mine("alpha").length, 1, "alpha kept"); assert.equal(mine("beta").length, 1, "beta kept");
    assert.equal(mine("alpha")[0].byUid, h1.uid); assert.equal(mine("alpha")[0].byEmail, h1.email);
    assert.equal(mine("beta")[0].byUid, h2.uid);
    assert.equal(t.messages[0].byUid, h1.uid, "the conversation opener is authored too");
    // Double click: two identical sends at once.
    const dbl = await Promise.all([1, 2].map(() => callB("POST", `/api/platform/support/${thread}/messages`, h1.token, { body: "gamma" })));
    assert.deepEqual(dbl.map((d) => d.status), [200, 200]);
    assert.equal(dbl.filter((d) => d.json.duplicate).length, 1, "exactly one was recognised as a repeat");
    t = await threadDoc(thread);
    assert.equal(mine("gamma").length, 1);
    assert.equal((await bells()) - b0, 3, "one bell each for alpha, beta, gamma - none for the repeat");
    // Same words from a DIFFERENT person is a different message.
    assert.equal((await callB("POST", `/api/platform/support/${thread}/messages`, h2.token, { body: "gamma" })).json.duplicate, undefined);
  });
  it("a provider posting while HQ replies loses nothing", async () => {
    const [hq, prov] = await Promise.all([
      callB("POST", `/api/platform/support/${thread}/messages`, h1.token, { body: "delta from HQ" }),
      callB("POST", "/api/messages/support", PA.token, { body: "epsilon from provider" }),
    ]);
    assert.equal(hq.status, 200); assert.equal(prov.status, 201);
    const bodies = (await threadDoc(thread)).messages.map((m: any) => m.body);
    assert.ok(bodies.includes("delta from HQ") && bodies.includes("epsilon from provider"), bodies.join(" | "));
  });
  it("X26: a duplicate link that would close a ring is refused", async () => {
    const mk = async (n: string) => (await db.collection("supportThreads").add({ party: "provider", name: n, email: `${n}@emu.test`, tier: "company", providerId: null, providerName: n, subject: n, kind: "message", status: "open", unreadByHq: false, messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })).id;
    const [a, b, c, d] = [await mk(`ra${u}`), await mk(`rb${u}`), await mk(`rc${u}`), await mk(`rd${u}`)];
    const dup = (x: string, y: string) => callB("PUT", `/api/platform/support/${x}`, h1.token, { duplicateOf: y });
    assert.equal((await dup(a, b)).status, 200, "A dup B");
    const back = await dup(b, a);
    assert.equal(back.status, 400); assert.equal(back.json.code, "duplicate_cycle");
    assert.equal((await dup(b, c)).status, 200, "B dup C (a chain is fine)");
    assert.equal((await dup(c, a)).status, 400, "C dup A would close A-B-C");
    assert.equal((await dup(c, d)).status, 200);
    assert.equal((await dup(a, a)).status, 400);
    assert.equal((await threadDoc(b)).duplicateOf, c, "the refused link was not stored");
  });
  it("X27: the digest sent to the AI model holds no parent name, email, phone or child name (the model is a stub; nothing leaves the machine)", async () => {
    rmSync(GROQ, { force: true });
    const r = await callB("GET", "/api/platform/support/review", h1.token);
    assert.equal(r.status, 200);
    assert.equal(r.json.aiConfigured, true);
    const sent = await until(async () => (existsSync(GROQ) ? readFileSync(GROQ, "utf8") : null));
    const digest = JSON.parse(JSON.parse(sent).messages[1].content);
    const text = JSON.stringify(digest);
    for (const leak of [leakA, leakB, leakC, leakD, "Jane", "Smith", "Ava", "Testchild", "jane.smith", "07700", "900123"]) assert.ok(!text.includes(leak), `${leak} reached the model: ${text.slice(0, 500)}`);
    assert.ok(/hurt/.test(text) && text.includes(`Incident question`), "the complaint itself still reaches the model");
    assert.equal(r.json.overview, "stub overview");
  });
});

describe("X28/X29/X31: deletion requests, bookings, accounts", () => {
  it("X28: a deletion request can be marked handled (who, when) and then leaves the bell; dismiss alone only hides it", async () => {
    const bell = async () => (await callB("GET", "/api/platform/notifications", h1.token)).json.items as any[];
    const item = (await bell()).find((i) => i.type === "privacy" && i.title.includes(`pa-hq-${u}@emu.test`));
    assert.ok(item, "the request is in the bell");
    const id = item.id.replace(/^privacy_/, "");
    assert.equal((await callB("POST", `/api/platform/notifications/privacy/${id}/handled`, owner.token, {})).status, 403);
    assert.equal((await callB("POST", `/api/platform/notifications/privacy/nope-${u}/handled`, h1.token, {})).status, 404);
    const done = await callB("POST", `/api/platform/notifications/privacy/${id}/handled`, h1.token, {});
    assert.equal(done.status, 200); assert.equal(done.json.handledByEmail, h1.email);
    const doc = (await db.collection("deletionRequests").doc(id).get()).data()!;
    assert.equal(doc.status, "handled"); assert.equal(doc.handledByUid, h1.uid); assert.ok(doc.handledAt);
    assert.ok(!(await bell()).some((i) => i.id === item.id), "closed for every HQ user");
    assert.equal((await callB("POST", `/api/platform/notifications/privacy/${id}/handled`, h2.token, {})).json.alreadyHandled, true);
  });
  it("X29: HQ cannot list every booking at once; one provider at a time", async () => {
    const none = await callB("GET", "/api/bookings", h1.token);
    assert.equal(none.status, 400);
    assert.ok(!Array.isArray(none.json));
    const one = await callB("GET", `/api/bookings?tenantId=${PA.tenantId}`, h1.token);
    assert.equal(one.status, 200); assert.ok(Array.isArray(one.json));
  });
  it("X31: accounts are searched and paged (50 by default), and every lookup is logged", async () => {
    const h = await mkHq("accts");
    const page = async (qs: string) => callB("GET", `/api/platform/accounts?${qs}`, h.token);
    const q = `acct-${u}`;
    const p1 = await page(`q=${q}&limit=2`);
    assert.equal(p1.status, 200);
    assert.equal(p1.json.accounts.length, 2); assert.equal(p1.json.matching, 5); assert.ok(p1.json.nextCursor);
    const p2 = await page(`q=${q}&limit=2&cursor=${encodeURIComponent(p1.json.nextCursor)}`);
    const p3 = await page(`q=${q}&limit=2&cursor=${encodeURIComponent(p2.json.nextCursor)}`);
    const all = [...p1.json.accounts, ...p2.json.accounts, ...p3.json.accounts].map((a: any) => a.email);
    assert.equal(p2.json.accounts.length, 2); assert.equal(p3.json.accounts.length, 1); assert.equal(p3.json.nextCursor, null);
    assert.equal(new Set(all).size, 5, "five different accounts across the pages");
    assert.ok(all.every((e: string) => e.startsWith(q)));
    assert.deepEqual(Object.keys(p1.json.accounts[0]).sort(), ["email", "label", "name", "portal", "provider", "role", "uid"]);
    const none = await page(`q=no-such-person-${u}`);
    assert.deepEqual(none.json.accounts, []);
    const def = await page("");
    assert.ok(def.json.accounts.length <= 50, "a default page is at most 50");
    assert.ok((await page("limit=100000")).json.accounts.length <= 100, "the limit is capped");
    assert.ok(!def.json.accounts.some((a: any) => a.role === "platform"), "no HQ accounts in the list");
    const logged = (await rowsFor("platformAudit", "byUid", h.uid)).filter((x) => x.kind === "accounts_lookup");
    assert.equal(logged.length, 6);
    assert.ok(logged.some((x) => x.q === q && x.returned === 2 && x.matching === 5));
    assert.equal((await callB("GET", "/api/platform/accounts", owner.token)).status, 403);
  });
});
