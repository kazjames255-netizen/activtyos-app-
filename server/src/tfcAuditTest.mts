// Credential-free regression test for the HMRC Tax-Free Childcare client
// (server/src/lib/tfc.ts). fetch is stubbed; nothing touches the network.
// Run: cd server && npx tsx --tsconfig ../tsconfig.json src/tfcAuditTest.mts
import {
  accountBalance, exchangeCode, failureForCode, linkAccount, openToken, payOnce, refreshTokens,
  sealToken, submitPayment, tfcConfig, toPence, toPounds, withFreshTokens,
  type PayRec, type PayStore, type TfcConfig, type TfcTokens,
} from "./lib/tfc";

let passed = 0, failed = 0;
const ok = (c: unknown, name: string) => { if (c) passed++; else { failed++; process.stdout.write("FAIL: " + name + "\n"); } };
const eq = (a: unknown, b: unknown, name: string) => ok(JSON.stringify(a) === JSON.stringify(b), `${name} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

// Fake secret-shaped values, assembled so they are obviously test data.
const TOK_A = "TESTACCESS" + "x9f3kq2m7z", TOK_R = "TESTREFRESH" + "p4w8d1n6", SECRET = "TESTCLIENTSECRET" + "h5j2v9", CODE = "TESTAUTHCODE" + "b3c7e1";
for (const k of ["HMRC_TFC_CLIENT_ID", "HMRC_TFC_CLIENT_SECRET", "HMRC_TFC_EPP_UNIQUE_CUSTOMER_ID", "HMRC_TFC_EPP_REG_REFERENCE", "HMRC_TFC_TOKEN_KEY", "HMRC_TFC_BASE_URL"]) delete process.env[k];

// Capture all console output.
const logs: string[] = [];
for (const m of ["log", "warn", "error", "info", "debug"] as const) (console as any)[m] = (...a: unknown[]) => logs.push(a.map(String).join(" "));
const report = (s: string) => process.stdout.write(s + "\n");

// ── env-gated not-connected ──
ok(tfcConfig() === null, "no env → tfcConfig null");
process.env.HMRC_TFC_CLIENT_ID = "cid";
process.env.HMRC_TFC_CLIENT_SECRET = SECRET;
process.env.HMRC_TFC_EPP_UNIQUE_CUSTOMER_ID = "12345678901";
ok(tfcConfig() === null, "partial env → still null");
process.env.HMRC_TFC_EPP_REG_REFERENCE = "HMRC123456A";
const cfg = tfcConfig() as TfcConfig;
ok(!!cfg, "full env → config");
ok(cfg.baseUrl === "https://test-api.service.hmrc.gov.uk", "defaults to the sandbox host, never production");
ok(cfg.redirectUri.endsWith("/api/tfc/callback"), "default redirect uri");

// ── fetch stub ──
type Call = { url: string; init: any };
let calls: Call[] = [];
let handler: (c: Call) => Response | Promise<Response> = () => new Response("{}", { status: 200 });
(globalThis as any).fetch = async (url: string, init: any) => {
  if (!/^https:\/\/test-api\.service\.hmrc\.gov\.uk\//.test(url)) throw new Error("unexpected host " + url);
  const c = { url, init }; calls.push(c); return handler(c);
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const tokens: TfcTokens = { accessToken: TOK_A, refreshToken: TOK_R, expiresAt: Date.now() + 3_600_000 };
const payArgs = { outboundChildPaymentRef: "ABCD12345TFC", amount: 12.34, ccpRegReference: "EY123456", ccpPostcode: "AB1 2CD" };
const pay = () => submitPayment(cfg, tokens, payArgs);

// ── pence conversion ──
eq(toPence(12.34), 1234, "12.34 → 1234p");
eq(toPence(0.1 + 0.2), 30, "0.1+0.2 → 30p");
eq(toPence(1.005), 101, "1.005 rounds half-up to 101p");
eq(toPence(19.99), 1999, "19.99 → 1999p");
eq(toPence(0), 0, "0 → 0p");
ok(Number.isNaN(toPence(NaN)) && Number.isNaN(toPence(Infinity)), "non-finite → NaN");
eq(toPounds(1234), 12.34, "1234p → 12.34");
eq(toPounds(undefined), 0, "undefined pence → 0");
eq(toPounds("12" as any), 0, "string pence → 0, never NaN");

// wire format: amount sent in whole pence, correct path/headers/payee_type
calls = []; handler = () => json(200, { payment_reference: "PR1", estimated_payment_date: "2026-10-05" });
const good = await pay();
ok(good.ok && good.data.paymentReference === "PR1", "payment success parsed");
const sent = JSON.parse(calls[0].init.body);
eq(sent.payment_amount, 1234, "wire amount is integer pence");
eq(sent.payee_type, "CCP", "payee_type CCP");
ok(calls[0].url.endsWith("/individuals/tax-free-childcare/payments/"), "payment path");
ok(calls[0].init.headers.Accept === "application/vnd.hmrc.1.2+json", "v1.2 Accept header");
ok(/^[0-9a-f-]{36}$/.test(calls[0].init.headers["Correlation-ID"]), "correlation id is a uuid");
ok(sent.epp_unique_customer_id === "12345678901" && sent.epp_reg_reference === "HMRC123456A", "EPP identifiers sent");
// bad amounts never reach HMRC
calls = [];
for (const amount of [0, -5, NaN, 0.001]) {
  const r = await submitPayment(cfg, tokens, { ...payArgs, amount });
  ok(!r.ok && r.failure === "connection-failed", `amount ${amount} refused locally`);
}
eq(calls.length, 0, "no HTTP call for invalid amounts");

// ── five failure states ──
const codes: [string, number, string][] = [
  ["E0033", 400, "insufficient-funds"], ["E0027", 400, "provider-not-added"], ["E0030", 400, "not-connected"],
  ["ETFC2", 400, "connection-expired"], ["E0401", 500, "connection-expired"], ["E0999", 400, "connection-failed"],
];
for (const [code, status, want] of codes) {
  handler = () => json(status, { errorCode: code, errorDescription: "x" });
  const r = await pay();
  ok(!r.ok && r.failure === want, `${code} → ${want}`);
}
eq(failureForCode(undefined, 401), "connection-expired", "401 → expired");
eq(failureForCode(undefined, 403), "connection-expired", "403 → expired");
eq(failureForCode(undefined, 429), "connection-failed", "429 → failed");

// ── never throws ──
handler = () => { throw new Error("socket hang up"); };
const net = await pay();
ok(!net.ok && net.failure === "connection-failed" && net.uncertain === true, "network error → connection-failed, uncertain");
handler = () => new Response("<html>bad gateway</html>", { status: 502 });
ok(!(await pay()).ok, "non-JSON 502 handled");
handler = () => new Response("not json", { status: 200 });
const bad200 = await pay();
ok(!bad200.ok && bad200.uncertain === true, "unreadable 200 body → uncertain failure");
handler = () => json(400, { errorCode: "E0033" });
for (const fn of [
  () => linkAccount(cfg, tokens, { outboundChildPaymentRef: "ABCD12345TFC", childDateOfBirth: "2019-01-01" }),
  () => accountBalance(cfg, tokens, { outboundChildPaymentRef: "ABCD12345TFC" }),
  () => exchangeCode(cfg, CODE), () => refreshTokens(cfg, TOK_R),
]) { let threw = false; try { await fn(); } catch { threw = true; } ok(!threw, "documented failure does not throw"); }
handler = () => { throw new Error("boom"); };
for (const fn of [() => exchangeCode(cfg, CODE), () => refreshTokens(cfg, TOK_R), () => accountBalance(cfg, tokens, { outboundChildPaymentRef: "x" })]) {
  let threw = false; try { await fn(); } catch { threw = true; } ok(!threw, "network failure does not throw");
}

// ── balance in pounds ──
handler = () => json(200, { tfc_account_status: "ACTIVE", paid_in_by_you: 8000, government_top_up: 2000, total_balance: 10000, cleared_funds: 7550, top_up_allowance: 200000 });
const bal = await accountBalance(cfg, tokens, { outboundChildPaymentRef: "ABCD12345TFC" });
ok(bal.ok && bal.data.clearedFunds === 75.5 && bal.data.totalBalance === 100, "balance converted pence → pounds");
handler = () => json(200, { cleared_funds: "oops" });
const badBal = await accountBalance(cfg, tokens, { outboundChildPaymentRef: "x" });
ok(badBal.ok && badBal.data.clearedFunds === 0, "malformed balance field reads 0, not NaN");

// ── OAuth: refresh classification and expiry/retry ──
handler = () => json(400, { error: "invalid_grant" });
const dead = await refreshTokens(cfg, TOK_R);
ok(!dead.ok && dead.failure === "connection-expired", "refused refresh (invalid_grant) → connection-expired");
handler = () => json(503, {});
const blip = await refreshTokens(cfg, TOK_R);
ok(!blip.ok && blip.failure === "connection-failed", "refresh 503 is transient → connection-failed, link not killed");
handler = () => { throw new Error("offline"); };
const blip2 = await refreshTokens(cfg, TOK_R);
ok(!blip2.ok && blip2.failure === "connection-failed", "refresh network error → connection-failed");
handler = (c) => json(200, { access_token: TOK_A + "2", refresh_token: TOK_R + "2", expires_in: 14400 });
const ex = await exchangeCode(cfg, CODE);
ok(ex.ok && ex.data.expiresAt > Date.now() + 14_000_000, "exchange parses expires_in");
ok(String(calls[calls.length - 1].init.body).includes("grant_type=authorization_code"), "authorization_code grant");

// expired stored token → refresh before the call, rotated token persisted
let saved: TfcTokens | null = null, apiCalls = 0;
handler = (c) => c.url.endsWith("/oauth/token")
  ? json(200, { access_token: "NEWA" + "1234567", refresh_token: "NEWR" + "1234567", expires_in: 14400 })
  : (apiCalls++, json(200, { child_full_name: "Test Child" }));
const fresh = await withFreshTokens(cfg, { ...tokens, expiresAt: Date.now() - 1 }, (t) => { saved = t; }, (t) =>
  linkAccount(cfg, t, { outboundChildPaymentRef: "ABCD12345TFC", childDateOfBirth: "2019-01-01" }));
ok(fresh.ok && saved !== null && apiCalls === 1, "expired token refreshed once, rotated tokens handed to onRefresh");
// HMRC rejects a token we thought was good: one refresh, one retry, then stop
let payCalls = 0, tokenCalls = 0;
handler = (c) => c.url.endsWith("/oauth/token")
  ? (tokenCalls++, json(200, { access_token: "NEWA" + "7654321", refresh_token: "NEWR" + "7654321", expires_in: 14400 }))
  : (payCalls++, json(401, { errorCode: "ETFC2" }));
const twice = await withFreshTokens(cfg, tokens, () => {}, (t) => submitPayment(cfg, t, payArgs));
ok(!twice.ok && twice.failure === "connection-expired" && payCalls === 2 && tokenCalls === 1, "auth rejection retried exactly once");
// a definite non-auth failure is never retried
payCalls = 0;
handler = () => (payCalls++, json(400, { errorCode: "E0033" }));
await withFreshTokens(cfg, tokens, () => {}, (t) => submitPayment(cfg, t, payArgs));
eq(payCalls, 1, "insufficient-funds payment not retried");
// network failure on a payment is never auto-retried
payCalls = 0;
handler = () => { payCalls++; throw new Error("timeout"); };
await withFreshTokens(cfg, tokens, () => {}, (t) => submitPayment(cfg, t, payArgs));
eq(payCalls, 1, "timed-out payment not re-sent by withFreshTokens");

// ── payment idempotency (payOnce) ──
const mem = new Map<string, PayRec>();
const store: PayStore = {
  async begin(id, rec) { const e = mem.get(id); if (e) return e; mem.set(id, { ...rec }); return null; },
  async finish(id, patch) { mem.set(id, { ...mem.get(id), ...patch }); },
};
let sends = 0;
handler = () => (sends++, json(200, { payment_reference: "PR-ONCE", estimated_payment_date: "2026-10-06" }));
const [a, b] = await Promise.all([payOnce(store, "k1", pay), payOnce(store, "k1", pay)]);
eq(sends, 1, "concurrent same key → HMRC called once");
ok([a, b].filter((r) => r.ok).length === 1, "the loser is refused, not double-paid");
const replay = await payOnce(store, "k1", pay);
ok(replay.ok && replay.data.paymentReference === "PR-ONCE" && sends === 1, "retry after success replays the stored result");
// timeout → uncertain → never re-sent
sends = 0; handler = () => { sends++; throw new Error("ETIMEDOUT"); };
const t1 = await payOnce(store, "k2", pay);
ok(!t1.ok && t1.uncertain === true && mem.get("k2")?.status === "uncertain", "timeout recorded as uncertain");
handler = () => (sends++, json(200, { payment_reference: "DOUBLE" }));
const t2 = await payOnce(store, "k2", pay);
ok(!t2.ok && t2.code === "PAYMENT_IN_DOUBT" && sends === 1, "uncertain key is not re-sent");
// pending row (crash after intent) blocks resend
mem.set("k3", { status: "pending" });
const t3 = await payOnce(store, "k3", pay);
ok(!t3.ok && t3.code === "PAYMENT_IN_DOUBT", "pending intent blocks resend");
// partial failure: HMRC paid but our ledger write fails → caller still told ok
const flaky: PayStore = { begin: async () => null, finish: async () => { throw new Error("firestore down"); } };
handler = () => json(200, { payment_reference: "PR-PAID", estimated_payment_date: "2026-10-07" });
const p4 = await payOnce(flaky, "k4", pay);
ok(p4.ok && p4.data.paymentReference === "PR-PAID", "ledger failure after HMRC success still reports the payment");
// definite failure replays as the same failure
handler = () => json(400, { errorCode: "E0033" });
await payOnce(store, "k5", pay);
const r5 = await payOnce(store, "k5", pay);
ok(!r5.ok && r5.failure === "insufficient-funds", "definite failure replays its failure");
// send() that throws is treated as uncertain
const r6 = await payOnce(store, "k6", async () => { throw new Error("x"); });
ok(!r6.ok && r6.uncertain === true, "throwing send() becomes uncertain, not an exception");

// ── token sealing ──
ok(sealToken("plain-tok") === "plain-tok", "no key → plaintext passthrough");
process.env.HMRC_TFC_TOKEN_KEY = Buffer.alloc(32, 7).toString("base64");
const sealed = sealToken(TOK_A);
ok(sealed.startsWith("enc:v1:") && !sealed.includes(TOK_A), "sealed token hides plaintext");
eq(openToken(sealed), TOK_A, "sealed token round-trips");
eq(openToken("legacy-plain"), "legacy-plain", "legacy plaintext still readable");
ok(openToken(sealed.slice(0, -4) + "AAAA") === null, "tampered ciphertext rejected");
delete process.env.HMRC_TFC_TOKEN_KEY;
ok(openToken(sealed) === null, "sealed token without key → null, not a crash");

// ── secrets never logged ──
const joined = logs.join("\n");
for (const s of [TOK_A, TOK_R, SECRET, CODE, "NEWA1234567", "NEWR1234567", "Bearer"]) ok(!joined.includes(s), `log never contains ${s.slice(0, 8)}…`);
ok(logs.length > 0 && logs.some((l) => /correlation/.test(l)), "failures log a correlation id");

report(failed ? `tfcAuditTest: ${passed} passed, ${failed} failed` : `tfcAuditTest: ${passed} passed, 0 failed`);
process.exit(failed ? 1 : 0);
