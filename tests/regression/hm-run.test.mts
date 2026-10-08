/** The HMRC sandbox runner (e2e/review/hm-run-lib.ts): sandbox-host refusal, masking, and error-code mapping via a mocked fetch. No network. */
import test from "node:test";
import assert from "node:assert/strict";
import { assertSandbox, maskRef, scrub, SCENARIOS, runScenario, extractCode, spliceResults, renderResults, type Row } from "../../e2e/review/hm-run-lib";

test("refuses anything but the sandbox host", () => {
  assertSandbox("https://test-api.service.hmrc.gov.uk");
  assertSandbox("https://test-api.service.hmrc.gov.uk/");
  for (const bad of ["https://api.service.hmrc.gov.uk", "http://test-api.service.hmrc.gov.uk", "https://test-api.service.hmrc.gov.uk.evil.com", "https://evil.com/test-api.service.hmrc.gov.uk", "http://localhost:4000", "nonsense", ""])
    assert.throws(() => assertSandbox(bad), /Refusing|not a valid/, bad);
});

test("masking keeps only the last 3 characters and scrub hides secrets and references", () => {
  assert.equal(maskRef("AAAA00000TFC"), "*********TFC");
  assert.equal(maskRef("ab"), "**");
  const s = scrub("ref AAAA00000TFC token abcd1234secret pay 1234567887654321 Bearer xyz.123", ["abcd1234secret"]);
  assert.ok(!s.includes("AAAA00000TFC") && !s.includes("abcd1234secret") && !s.includes("1234567887654321") && !s.includes("xyz.123"), s);
});

test("extractCode reads a pasted redirect URL or bare code", () => {
  assert.equal(extractCode("https://x/cb?code=abc%2B1&state=hm-run"), "abc+1");
  assert.equal(extractCode(" abc "), "abc");
});

test("all 16 scenarios run against a mocked HMRC and map to the expected parent screen; a failure does not stop the run", async () => {
  assert.equal(SCENARIOS.length, 16);
  const realFetch = globalThis.fetch;
  let status = 0;
  globalThis.fetch = (async (_u: unknown, init: { body: string }) => {
    const ref: string = JSON.parse(init.body).outbound_child_payment_ref;
    const sc = SCENARIOS.find((s) => s.ref === ref)!;
    if (sc.kind === "error") { status = 400; return new Response(JSON.stringify({ errorCode: sc.code, errorDescription: "x" }), { status }); }
    status = 200;
    return new Response(JSON.stringify({ child_full_name: "Peter Pan", tfc_account_status: "ACTIVE", cleared_funds: 8000, payment_reference: "1234567887654321", estimated_payment_date: "2024-10-01" }), { status });
  }) as unknown as typeof fetch;
  try {
    const d = { cfg: { baseUrl: "https://test-api.service.hmrc.gov.uk", clientId: "cid", clientSecret: "sec", redirectUri: "r", eppUniqueCustomerId: "12345678901", eppRegReference: "HMRC123456A" },
      tokens: { accessToken: "tok", refreshToken: "ref", expiresAt: Date.now() + 1e6 }, lastStatus: () => status, ccp: { ref: "EY123456", postcode: "AB12 3CD" } };
    const rows: Row[] = [];
    for (const sc of SCENARIOS) rows.push(...(await runScenario(d, sc)));
    assert.ok(rows.length > 16);
    for (const r of rows) assert.ok(r.pass, `${r.id} ${r.request}: ${r.note}`);
    assert.ok(rows.filter((r) => r.mapped).length >= 12);
    // a wrong code from HMRC is recorded as a failure, not thrown
    globalThis.fetch = (async () => new Response(JSON.stringify({ errorCode: "E9999" }), { status: 400 })) as unknown as typeof fetch;
    const bad = await runScenario(d, SCENARIOS.find((s) => s.id === "S16")!);
    assert.equal(bad[0].pass, false);
    // a network error is recorded, not thrown
    globalThis.fetch = (async () => { throw new Error("boom"); }) as unknown as typeof fetch;
    const net = await runScenario(d, SCENARIOS[0]);
    assert.equal(net.length, 3);
    assert.ok(net.every((r) => !r.pass));
    // masked refs only in the evidence
    const md = renderResults(rows, "now");
    assert.ok(!/[A-Z]{4}\d{5}TFC/.test(md) && !md.includes("1234567887654321"));
    assert.ok(spliceResults("a\n## Safety properties\nb", md).includes("hm-run:results:end"));
  } finally { globalThis.fetch = realFetch; }
});

import { createTestUser } from "../../e2e/review/hm-run-lib";
test("createTestUser: token then create, and clear failures with the manual step", async () => {
  const cfg = { baseUrl: "https://test-api.service.hmrc.gov.uk", clientId: "cid-abcd", clientSecret: "sec-abcd" };
  const calls: string[] = [];
  const good = (async (u: string, init: { body: string; headers: Record<string, string> }) => {
    calls.push(u);
    if (u.endsWith("/oauth/token")) { assert.match(init.body, /client_credentials/); return new Response(JSON.stringify({ access_token: "tok-1234" }), { status: 200 }); }
    assert.equal(init.headers.Authorization, "Bearer tok-1234");
    assert.deepEqual(JSON.parse(init.body), { serviceNames: ["national-insurance"] });
    return new Response(JSON.stringify({ userId: "123456789012", password: "pw" }), { status: 201 });
  }) as unknown as typeof fetch;
  const ok = await createTestUser(cfg, undefined, good);
  assert.deepEqual(ok, { ok: true, userId: "123456789012", password: "pw" });
  assert.ok(calls[1].endsWith("/create-test-user/individuals"));
  const denied = (async (u: string) => u.endsWith("/oauth/token")
    ? new Response(JSON.stringify({ access_token: "tok-1234" }), { status: 200 })
    : new Response(JSON.stringify({ code: "MATCHING_RESOURCE_NOT_FOUND", secret: "tok-1234" }), { status: 404 })) as unknown as typeof fetch;
  const bad = await createTestUser(cfg, undefined, denied);
  assert.equal(bad.ok, false);
  if (!bad.ok) { assert.equal(bad.status, 404); assert.ok(!bad.body.includes("tok-1234")); assert.match(bad.manual, /Create Test User/); }
  await assert.rejects(createTestUser({ ...cfg, baseUrl: "https://api.service.hmrc.gov.uk" }, undefined, good), /Refusing/);
});

import { scenariosToRun, mergeRows, tokenUsable } from "../../e2e/review/hm-run-lib";
const dd = (over: Record<string, unknown> = {}) => ({
  cfg: { baseUrl: "https://test-api.service.hmrc.gov.uk", clientId: "cid", clientSecret: "sec", redirectUri: "r", eppUniqueCustomerId: "12345678901", eppRegReference: "HMRC123456A" },
  tokens: { accessToken: "tok", refreshToken: "ref", expiresAt: Date.now() + 1e6 }, ccp: { ref: "EY123456", postcode: "AB12 3CD" }, ...over });

test("429 is paced, retried with Retry-After then backoff, and recorded as RATE-LIMITED only when retries run out", async () => {
  const realFetch = globalThis.fetch;
  let status = 0, n = 0, ra: number | null = null;
  const waits: number[] = [];
  const sleep = async (ms: number) => { waits.push(ms); };
  const sc = SCENARIOS.find((s) => s.id === "S16")!; // payment only
  try {
    globalThis.fetch = (async () => {
      n++;
      if (n === 1) { status = 429; ra = 7; return new Response("{}", { status }); }
      if (n === 2) { status = 429; ra = null; return new Response("{}", { status }); }
      status = 400; ra = null; return new Response(JSON.stringify({ errorCode: "E0033" }), { status });
    }) as unknown as typeof fetch;
    const rows = await runScenario(dd({ lastStatus: () => status, lastRetryAfter: () => ra, sleep, paceMs: 1500 }) as never, sc);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].pass, true);
    assert.ok(!rows[0].limited);
    assert.deepEqual(waits, [1500, 7000, 1500, 6000, 1500]);
    waits.length = 0;
    globalThis.fetch = (async () => { status = 429; ra = null; return new Response("{}", { status }); }) as unknown as typeof fetch;
    const lim = await runScenario(dd({ lastStatus: () => status, lastRetryAfter: () => ra, sleep, paceMs: 1 }) as never, sc);
    assert.equal(lim[0].limited, true);
    assert.equal(lim[0].pass, false);
    assert.match(lim[0].note, /RATE-LIMITED/);
    assert.deepEqual(waits.filter((w) => w > 1), [3000, 6000, 12000, 24000]);
    assert.match(renderResults(lim, "now"), /RATE-LIMITED/);
  } finally { globalThis.fetch = realFetch; }
});

test("resume re-runs only scenarios not yet PASS, keeps earlier passes, and reuses a valid token", () => {
  const mk = (id: string, request: string, pass: boolean, limited = false) => ({ id, request, pass, limited }) as unknown as Row;
  const prev: Row[] = [];
  for (const sc of SCENARIOS) for (const ep of sc.endpoints) prev.push(mk(sc.id, ep, !(sc.id === "S05" && ep === "balance") && sc.id !== "S08", sc.id === "S08"));
  assert.deepEqual(scenariosToRun(prev).map((s) => s.id), ["S05", "S08"]);
  assert.equal(scenariosToRun(undefined).length, 16);
  assert.equal(scenariosToRun(prev.filter((r) => r.id !== "S16")).some((s) => s.id === "S16"), true);
  const fresh = ["link", "balance", "payment"].map((e) => mk("S05", e, true));
  const merged = mergeRows(prev, fresh);
  assert.equal(merged.filter((r) => r.id === "S05" && r.pass).length, 3);
  assert.equal(merged.filter((r) => r.id === "S01").length, 3);
  assert.equal(merged.length, prev.length);
  assert.ok(tokenUsable({ accessToken: "a", refreshToken: "", expiresAt: Date.now() + 3_600_000 }));
  assert.ok(!tokenUsable({ accessToken: "a", refreshToken: "", expiresAt: Date.now() + 60_000 }));
  assert.ok(!tokenUsable(undefined));
});
