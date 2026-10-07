import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { ROOT } from "./env";

// ─────────────────────────────────────────────────────────────────────────
// A LOCAL stand-in for HMRC's Tax-Free Childcare Payments API v1.2 and its
// OAuth endpoints, plus a tiny API harness that mounts the REAL routes
// (server/src/routes/tfc.ts) on a random local port wired to that stub.
//
// Nothing here ever talks to a real HMRC / GOV.UK host:
//   * the stub listens on 127.0.0.1 only;
//   * the harness sets HMRC_TFC_BASE_URL to the stub and wraps globalThis.fetch
//     with a guard that throws for any *.gov.uk / hmrc host, so even a bug
//     cannot reach HMRC from the HMRC client;
//   * the harness is NOT the dev API: it is a separate node process that starts
//     no schedulers/sweeps/jobs (it imports only the tfc routers), and it is
//     killed when the spec finishes. The dev API on :4000 is never touched.
// ─────────────────────────────────────────────────────────────────────────

/** How one stub endpoint answers. `ok` = the documented happy response. */
export type Reply =
  | "ok"
  | { status: number; body?: unknown }       // e.g. { status: 400, body: { errorCode: "E0033" } }
  | { drop: true }                            // destroy the socket: a network failure after the request arrived
  | { delayMs: number; then?: Reply };

export interface StubCall { path: string; method: string; body: Record<string, unknown> | null; bearer: string | null; correlationId: string | null; }

export interface HmrcStub {
  url: string;
  /** Every request the stub received, in order. */
  calls: StubCall[];
  /** Payment requests that reached HMRC (POST …/payments/). */
  payments: () => StubCall[];
  set: (k: "link" | "balance" | "pay" | "token" | "authorize", r: Reply) => void;
  /** Balance the stub reports, in pence. */
  setBalance: (p: { clearedFundsPence?: number; totalBalancePence?: number }) => void;
  reset: () => void;
  close: () => Promise<void>;
}

export async function startHmrcStub(): Promise<HmrcStub> {
  const calls: StubCall[] = [];
  const replies: Record<string, Reply> = { link: "ok", balance: "ok", pay: "ok", token: "ok", authorize: "ok" };
  let balance = { clearedFundsPence: 25_000, totalBalancePence: 30_000 };
  let n = 0, refreshN = 0;
  // Only tokens this stub minted (or the seed token the harness plants) are good: a bearer we never issued is a 401, like HMRC's.
  const okBearer = (b: string | null) => !!b && /^stub-(access|seed)-/.test(b);

  const send = (res: http.ServerResponse, status: number, body?: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };
  /** Apply a scenario; returns true when it fully handled the response. */
  const scenario = async (r: Reply, req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> => {
    if (r === "ok") return false;
    if ("drop" in r) { req.socket.destroy(); return true; }
    if ("delayMs" in r) { await new Promise((x) => setTimeout(x, r.delayMs)); return r.then ? scenario(r.then, req, res) : false; }
    send(res, r.status, r.body);
    return true;
  };

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const raw = Buffer.concat(chunks).toString("utf8");
    let body: Record<string, unknown> | null = null;
    try {
      body = raw ? (req.headers["content-type"]?.includes("x-www-form-urlencoded") ? Object.fromEntries(new URLSearchParams(raw)) : JSON.parse(raw)) : null;
    } catch { /* leave null */ }
    const bearer = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ""))?.[1] ?? null;
    calls.push({ path: u.pathname, method: req.method ?? "GET", body, bearer, correlationId: (req.headers["correlation-id"] as string) ?? null });

    // ── OAuth: the GOV.UK sign-in, collapsed to a redirect ──
    if (u.pathname === "/oauth/authorize" && req.method === "GET") {
      const redirect = u.searchParams.get("redirect_uri") ?? "";
      const state = u.searchParams.get("state") ?? "";
      // The redirect target must be loopback: the stub never bounces a browser to a real host.
      if (!/^http:\/\/127\.0\.0\.1:\d+\//.test(redirect)) return send(res, 400, { error: "redirect_uri must be loopback in the stub" });
      const a = replies.authorize;
      const denied = a !== "ok" && "status" in a;
      const to = new URL(redirect);
      to.searchParams.set("state", state);
      if (denied) to.searchParams.set("error", "access_denied"); else to.searchParams.set("code", `stub-code-${++n}`);
      res.writeHead(302, { Location: to.toString() });
      return void res.end();
    }
    if (u.pathname === "/oauth/token" && req.method === "POST") {
      if (await scenario(replies.token, req, res)) return;
      const refresh = body?.grant_type === "refresh_token";
      if (refresh) refreshN++;
      return send(res, 200, { access_token: `stub-access-${++n}`, refresh_token: `stub-refresh-${++n}`, expires_in: 14400, token_type: "bearer" });
    }

    // ── The three Tax-Free Childcare calls ──
    const isLink = u.pathname === "/individuals/tax-free-childcare/payments/link";
    const isBal = u.pathname === "/individuals/tax-free-childcare/payments/balance";
    const isPay = u.pathname === "/individuals/tax-free-childcare/payments/" || u.pathname === "/individuals/tax-free-childcare/payments";
    if ((isLink || isBal || isPay) && req.method === "POST") {
      if (!String(req.headers.accept ?? "").includes("application/vnd.hmrc.1.2+json")) return send(res, 406, { code: "ACCEPT_HEADER_INVALID" });
      if (!okBearer(bearer)) return send(res, 401, { code: "INVALID_CREDENTIALS", message: "Invalid Authentication information provided" });
      const key = isLink ? "link" : isBal ? "balance" : "pay";
      if (await scenario(replies[key], req, res)) return;
      if (isLink) return send(res, 200, { child_full_name: "Stub Childname" });
      if (isBal) return send(res, 200, {
        tfc_account_status: "ACTIVE",
        paid_in_by_you: balance.clearedFundsPence,
        government_top_up: Math.max(0, balance.totalBalancePence - balance.clearedFundsPence),
        total_balance: balance.totalBalancePence,
        cleared_funds: balance.clearedFundsPence,
        top_up_allowance: 200_000,
      });
      return send(res, 201, { payment_reference: `STUBPAY${calls.filter((c) => c.path.endsWith("/payments/")).length}`, estimated_payment_date: "2099-01-05" });
    }
    send(res, 404, { code: "NOT_FOUND" });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  void refreshN;
  return {
    url: `http://127.0.0.1:${port}`,
    calls,
    payments: () => calls.filter((c) => c.method === "POST" && /\/payments\/?$/.test(c.path)),
    set: (k, r) => { replies[k] = r; },
    setBalance: (p) => { balance = { ...balance, ...p }; },
    reset: () => {
      calls.length = 0;
      for (const k of Object.keys(replies)) replies[k] = "ok";
      balance = { clearedFundsPence: 25_000, totalBalancePence: 30_000 };
    },
    close: () => new Promise<void>((r) => { server.closeAllConnections?.(); server.close(() => r()); }),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// The harness: the real /api/my/tfc + /api/tfc/callback routers on their own
// port, with a header-based auth shim (no Firebase token needed) and seed /
// cleanup endpoints for throwaway Firestore docs. Firestore is the real dev
// project (the routes read/write tfcLinks etc.), so every doc it makes is
// keyed to ids the spec owns and is removed by /__cleanup.
// ─────────────────────────────────────────────────────────────────────────

const HARNESS_SOURCE = (root: string, stubUrl: string) => `
import { createRequire } from "node:module";
const root = ${JSON.stringify(root)};
const stubUrl = ${JSON.stringify(stubUrl)};
process.env.HMRC_TFC_CLIENT_ID = "stub-client-id";
process.env.HMRC_TFC_CLIENT_SECRET = "stub-secret";
process.env.HMRC_TFC_EPP_UNIQUE_CUSTOMER_ID = "12345678901";
process.env.HMRC_TFC_EPP_REG_REFERENCE = "HMRC123456A";
process.env.HMRC_TFC_BASE_URL = stubUrl;
delete process.env.HMRC_TFC_TOKEN_KEY;
// Hard guard: any fetch to an HMRC / GOV.UK host throws before a socket opens. (Not a loopback-only rule: the Firebase Admin SDK
// may legitimately use fetch for Google auth, and that must keep working.)
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  let host = "";
  try { host = new URL(url).hostname; } catch {}
  if (/(^|\\.)gov\\.uk$|hmrc/i.test(host)) throw new Error("hmrc-stub harness blocked a fetch to " + host);
  return realFetch(input, init);
};
const req = createRequire(root + "/server/package.json");
const express = req("express");
const { tfc, tfcCallback } = await import(root + "/server/src/routes/tfc.ts");
const { db } = await import(root + "/server/src/firebase.ts");

const app = express();
app.use(express.json());
app.use("/api/tfc/callback", tfcCallback);
app.use("/api/my/tfc", (rq, rs, next) => {
  const uid = rq.header("x-stub-uid");
  if (!uid) { rs.status(401).json({ error: "no uid" }); return; }
  // The pay route finds the family's bookings by email, like every parent route.
  rq.user = { uid, email: rq.header("x-stub-email") || uid + "@activityos-test.com" };
  rq.auth = { role: rq.header("x-stub-role") || "parent" };
  next();
}, tfc);

// Test-only helpers. Every doc is addressed by an id the spec chose.
app.post("/__seed", async (rq, rs) => {
  const b = rq.body;
  if (b.kind === "child") await db.collection("children").doc(b.id).set({ parentUid: b.uid, name: b.name, dob: b.dob, ...(b.tfcReference ? { tfcReference: b.tfcReference } : {}), e2eStub: true });
  else if (b.kind === "tenant") await db.collection("libraries").doc(b.id).set({ tenantId: b.id, settings: { providerName: "Stub Provider", childcare: { settingName: "Stub Provider", registrationNumber: "EY123456", postcode: "AB1 2CD" } }, e2eStub: true });
  else if (b.kind === "link") await db.collection("tfcLinks").doc(b.childId).set({ parentUid: b.uid, childId: b.childId, childName: b.name, reference: b.reference, linked: true, linkedAt: new Date().toISOString(), failure: null, accessToken: "stub-seed-access", refreshToken: "stub-seed-refresh", expiresAt: Date.now() + 3600000 });
  else if (b.kind === "booking") await db.collection("bookings").doc(b.tenantId + "_" + b.ref).set({ tenantId: b.tenantId, ref: b.ref, email: b.email, child: b.child, childId: b.childId, status: b.status || "Confirmed", pay: b.pay || "Awaiting voucher payment", amount: b.amount, method: "tfc", e2eStub: true });
  else { rs.status(400).json({ error: "kind" }); return; }
  rs.json({ ok: true });
});
app.get("/__link/:childId", async (rq, rs) => {
  const s = await db.collection("tfcLinks").doc(rq.params.childId).get();
  const d = s.exists ? s.data() : null;
  rs.json(d ? { linked: d.linked === true, failure: d.failure ?? null, reference: d.reference ?? null, hasTokens: !!(d.accessToken && d.refreshToken) } : null);
});
app.get("/__payments/:childId", async (rq, rs) => {
  const q = await db.collection("tfcPayments").where("childId", "==", rq.params.childId).get();
  rs.json(q.docs.map((d) => ({ id: d.id, status: d.get("status"), amount: d.get("amount"), failure: d.get("failure") ?? null })));
});
app.get("/__booking/:tenantId/:ref", async (rq, rs) => {
  const s = await db.collection("bookings").doc(rq.params.tenantId + "_" + rq.params.ref).get();
  rs.json(s.exists ? { pay: s.get("pay"), tfcPayment: s.get("tfcPayment") ?? null } : null);
});
app.post("/__cleanup", async (rq, rs) => {
  const { childIds = [], tenantIds = [], uid } = rq.body;
  const out = { children: 0, links: 0, payments: 0, locks: 0, states: 0, tenants: 0, bookings: 0 };
  for (const t of tenantIds) for (const b of (await db.collection("bookings").where("tenantId", "==", t).get()).docs) if (b.get("e2eStub") === true) { await b.ref.delete(); out.bookings++; }
  for (const id of childIds) {
    const c = await db.collection("children").doc(id).get();
    // Refuse to touch a child that is not the caller's own throwaway.
    if (c.exists && c.get("parentUid") === uid) { await c.ref.delete(); out.children++; }
    const l = await db.collection("tfcLinks").doc(id).get();
    if (l.exists && l.get("parentUid") === uid) { await l.ref.delete(); out.links++; }
    const lock = db.collection("tfcPayLocks").doc(id);
    if ((await lock.get()).exists) { await lock.delete(); out.locks++; }
    for (const p of (await db.collection("tfcPayments").where("childId", "==", id).get()).docs) { await p.ref.delete(); out.payments++; }
    for (const s of (await db.collection("tfcLinkStates").where("parentUid", "==", uid).get()).docs) if (s.get("childId") === id) { await s.ref.delete(); out.states++; }
  }
  for (const t of tenantIds) {
    const d = await db.collection("libraries").doc(t).get();
    if (d.exists && d.get("e2eStub") === true) { await d.ref.delete(); out.tenants++; }
  }
  rs.json(out);
});

const server = app.listen(0, "127.0.0.1", () => {
  const port = server.address().port;
  process.env.HMRC_TFC_REDIRECT_URI = "http://127.0.0.1:" + port + "/api/tfc/callback";
  process.stdout.write("HARNESS_READY " + port + "\\n");
});
`;

export interface TfcHarness {
  url: string;
  /** Header set that authenticates as `uid` (a parent). */
  as: (uid: string) => Record<string, string>;
  post: <T = any>(p: string, headers: Record<string, string>, body?: unknown) => Promise<{ status: number; body: T }>;
  get: <T = any>(p: string, headers?: Record<string, string>) => Promise<{ status: number; body: T }>;
  seedChild: (o: { id: string; uid: string; name: string; dob: string; tfcReference?: string }) => Promise<void>;
  seedTenant: (id: string) => Promise<void>;
  seedLink: (o: { childId: string; uid: string; name: string; reference: string }) => Promise<void>;
  /** A parent's booking at a tenant, waiting on the scheme's money (the thing /pay pays for). */
  seedBooking: (o: { tenantId: string; ref: string; email: string; child: string; childId: string; amount: number; status?: string; pay?: string }) => Promise<void>;
  booking: (tenantId: string, ref: string) => Promise<{ pay: string; tfcPayment: { paymentReference: string; estimatedPaymentDate: string; amount: number } | null } | null>;
  link: (childId: string) => Promise<{ linked: boolean; failure: string | null; reference: string | null; hasTokens: boolean } | null>;
  payRecords: (childId: string) => Promise<{ id: string; status: string; amount: number; failure: string | null }[]>;
  cleanup: (o: { uid: string; childIds: string[]; tenantIds?: string[] }) => Promise<Record<string, number>>;
  stop: () => Promise<void>;
}

export async function startTfcHarness(stubUrl: string): Promise<TfcHarness> {
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(stubUrl)) throw new Error("the harness may only be pointed at the loopback stub");
  const file = path.join(os.tmpdir(), `tfc-harness-${process.pid}-${Date.now()}.mts`);
  fs.writeFileSync(file, HARNESS_SOURCE(ROOT, stubUrl));
  // cwd = server/ so dotenv / the service-account lookup resolve exactly as for the real API.
  const child: ChildProcess = spawn(path.join(ROOT, "server/node_modules/.bin/tsx"), ["--tsconfig", path.join(ROOT, "tsconfig.json"), file], {
    cwd: path.join(ROOT, "server"),
    // Never inherit a real HMRC config or a Stripe/email key the dev shell may hold beyond what the routes need.
    env: { ...process.env, NODE_ENV: "development", PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  const port = await new Promise<number>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("harness did not start in 60s:\n" + log.slice(-1500))), 60_000);
    child.stdout!.on("data", (d) => { log += d; const m = /HARNESS_READY (\d+)/.exec(log); if (m) { clearTimeout(t); resolve(Number(m[1])); } });
    child.stderr!.on("data", (d) => { log += d; });
    child.on("exit", (c) => { clearTimeout(t); reject(new Error(`harness exited early (${c}):\n${log.slice(-1500)}`)); });
  });
  const url = `http://127.0.0.1:${port}`;
  const call = async (method: string, p: string, headers: Record<string, string>, body?: unknown) => {
    const r = await fetch(url + p, { method, headers: { "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
    const text = await r.text();
    let parsed: any = text;
    try { parsed = JSON.parse(text); } catch { /* html page */ }
    return { status: r.status, body: parsed };
  };
  const seed = (b: unknown) => call("POST", "/__seed", {}, b).then((r) => { if (r.status !== 200) throw new Error("seed failed " + JSON.stringify(r.body)); });
  return {
    url,
    as: (uid) => ({ "x-stub-uid": uid }),
    post: (p, h, b) => call("POST", p, h, b ?? {}),
    get: (p, h = {}) => call("GET", p, h),
    seedChild: (o) => seed({ kind: "child", ...o }),
    seedTenant: (id) => seed({ kind: "tenant", id }),
    seedLink: (o) => seed({ kind: "link", ...o }),
    seedBooking: (o) => seed({ kind: "booking", ...o }),
    booking: async (t, r) => (await call("GET", `/__booking/${t}/${r}`, {})).body,
    link: async (id) => (await call("GET", `/__link/${id}`, {})).body,
    payRecords: async (id) => (await call("GET", `/__payments/${id}`, {})).body,
    cleanup: async (o) => (await call("POST", "/__cleanup", {}, o)).body,
    stop: async () => { child.kill("SIGTERM"); await new Promise((r) => setTimeout(r, 300)); if (!child.killed || child.exitCode === null) child.kill("SIGKILL"); fs.rmSync(file, { force: true }); },
  };
}
