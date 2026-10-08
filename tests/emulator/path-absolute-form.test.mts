// An HTTP request line may be absolute-form ("GET http://host/api/bookings HTTP/1.1"). Express routes on the pathname inside it, but the
// access gates saw the raw string and matched nothing. Every gate must see the path Express routes on: role matrix, Setup feature
// switches, subscription wall, closed-account exemption. Also: a percent-encoded slash is NOT a slash to Express, so it must not satisfy
// a "/x/administer" allow-list. Real API + Firestore emulator. Synthetic data only.
import assert from "node:assert/strict";
import http from "node:http";
import { before, describe, it } from "node:test";
import { CAP_API, FEATURE_API, normalizeApiPath } from "../../lib/accessMap";
import { db, login, makeProvider, ok, uniq, type Provider } from "./helpers.mts";

const API = new URL(process.env.EMU_API!);
/** Send an arbitrary request target (origin-form or absolute-form) exactly as written. */
function raw(method: string, target: string, token: string | null, body?: unknown): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const req = http.request({ host: API.hostname, port: API.port, method, path: target, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}) } }, (res) => {
      let t = ""; res.on("data", (c) => (t += c)); res.on("end", () => { let json: any = null; try { json = t ? JSON.parse(t) : null; } catch { json = t; } resolve({ status: res.statusCode ?? 0, json }); });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}
const absolute = (p: string) => [
  `http://localhost${p}`, `https://localhost${p}`, `HTTP://LOCALHOST${p}`, `http://user:pass@localhost:80${p}`,
  `ws://localhost${p}`, `ftp://localhost${p}`, `http://localhost${p}${p.includes("?") ? "&" : "?"}x=1`, `http://localhost${p}/`,
];

let P: Provider, F: Provider, L: Provider;
const tok: Record<string, string> = {};
const AREAS = [...new Set(CAP_API.map((c) => c.area))];

before(async () => {
  P = await makeProvider("abs"); F = await makeProvider("absfeat"); L = await makeProvider("abslock");
  const all = (level: string) => Object.fromEntries(AREAS.map((a) => [a, level]));
  const roles = [{ id: "none-all", name: "None", caps: all("none") }, { id: "view-all", name: "View", caps: all("view") }];
  const lib = (await ok("GET", "/api/library", P.token)) ?? {};
  await ok("PUT", "/api/library", P.token, { venues: lib.venues ?? [], addons: lib.addons ?? [], settings: { ...(lib.settings ?? {}), roles, rolesSetAt: new Date().toISOString() } });
  for (const r of ["none-all", "view-all"]) {
    const email = `staff-abs-${r}-${uniq()}@emu.test`;
    const s = await login(email);
    await db.collection("users").doc(s.uid).set({ email, role: "staff", chosen: true, tenantId: P.tenantId, franchiseId: null, name: email, staffRole: r, permRole: r }, { merge: true });
    tok[r] = s.token;
  }
  const flib = (await ok("GET", "/api/library", F.token)) ?? {};
  await ok("PUT", "/api/library", F.token, { venues: flib.venues ?? [], addons: flib.addons ?? [], settings: { ...(flib.settings ?? {}), features: { meals: false, trips: false } } });
  await db.collection("tenants").doc(L.tenantId).set({ subscription: { status: "canceled" } }, { merge: true });
});

describe("normalizeApiPath", () => {
  it("is idempotent and ignores scheme://authority, query, case and trailing slashes", () => {
    for (const x of ["/API/Bookings/", "http://user:pass@Host:80/api/Bookings?x=1", "HTTP://H/api//bookings//", "ws://h/api/meals", "/api/medications/x%2fadminister", "/"]) {
      const n = normalizeApiPath(x);
      assert.equal(normalizeApiPath(n), n, x);
    }
    for (const x of absolute("/api/bookings")) assert.equal(normalizeApiPath(x), "/api/bookings", x);
    assert.equal(normalizeApiPath("/api/medications/x%2fadminister"), "/api/medications/x%2fadminister");
  });
});

describe("absolute-form request targets get the same answer as the origin-form path", () => {
  it("role matrix: none/none staff refused on every variant", async () => {
    for (const p of ["/api/bookings", "/api/registers", "/api/customers", "/api/medications", "/api/incidents"]) {
      const base = await raw("GET", p, tok["none-all"]);
      assert.equal(base.status, 403, `${p} canonical`);
      for (const v of absolute(p)) assert.equal((await raw("GET", v, tok["none-all"])).status, 403, v);
    }
  });
  it("role matrix: view-only staff cannot write on any variant", async () => {
    for (const v of ["/api/bookings", ...absolute("/api/bookings")]) assert.equal((await raw("POST", v, tok["view-all"], {})).status, 403, v);
  });
  it("feature switches: owner with Meals / Trips off is refused on every variant", async () => {
    for (const f of FEATURE_API.filter((x) => ["/api/meals", "/api/trips"].includes(x.prefix))) {
      assert.equal((await raw("GET", f.prefix, F.token)).status, 403);
      for (const v of absolute(f.prefix)) assert.equal((await raw("GET", v, F.token)).status, 403, v);
    }
  });
  it("subscription wall: a locked tenant gets the same 402 on every variant", async () => {
    const base = await raw("GET", "/api/dashboard", L.token);
    assert.equal(base.status, 402, JSON.stringify(base.json).slice(0, 150));
    for (const v of absolute("/api/dashboard")) assert.equal((await raw("GET", v, L.token)).status, 402, v);
    // and an OPEN path stays open in absolute form
    assert.equal((await raw("GET", "/api/subscription", L.token)).status, (await raw("GET", "http://localhost/api/subscription", L.token)).status);
  });
  it("closed-account exemption: only /api/account/reactivate gets through, in any form", async () => {
    const email = `closed-${uniq()}@emu.test`;
    const s = await login(email);
    const closed = () => db.collection("users").doc(s.uid).set({ email, role: "parent", chosen: true, deactivatedAt: new Date().toISOString() }, { merge: true });
    await closed();
    for (const v of ["/api/me", ...absolute("/api/me"), "/api/Me", "http://localhost/api/my/bookings"]) {
      const r = await raw("GET", v, s.token);
      assert.equal(r.status, 403, v); assert.equal(r.json?.code, "account_closed", v);
    }
    for (const v of ["/api/account/reactivate", ...absolute("/api/account/reactivate"), "/API/Account/Reactivate"]) {
      await closed();
      const r = await raw("POST", v, s.token, {});
      assert.notEqual(r.json?.code, "account_closed", `${v} should reach the reactivate route: ${r.status}`);
    }
  });
  it("a percent-encoded slash is not a slash: it never satisfies the view-level write allow-list", async () => {
    for (const who of ["view-all", "none-all"]) {
      for (const [m, p] of [["PUT", "/api/medications/x%2fadminister"], ["POST", "/api/medications/x%2fadminister"], ["DELETE", "/api/medications/x%2fadminister"], ["POST", "/api/posts/x%2freact"], ["POST", "/api/documents/library/x%2fread"]] as const) {
        for (const v of [p, ...absolute(p)]) {
          const r = await raw(m, v, tok[who], {});
          assert.equal(r.status, 403, `${who} ${m} ${v}: ${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
        }
      }
    }
    // a real administer path is still allowed for view-level staff past the matrix (not a 403 view_only)
    const real = await raw("POST", "/api/medications/x/administer", tok["view-all"], {});
    assert.notEqual(real.json?.code, "view_only");
  });
});
