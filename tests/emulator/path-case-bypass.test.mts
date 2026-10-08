// Express routes paths case-insensitively (and tolerates a trailing slash) but the role matrix / Setup feature switches matched the
// raw path case-sensitively, so /API/MEDICATIONS or /api/Bookings skipped every access block. A path variant must get the SAME answer
// as the canonical lower-case path, for every role type and every gated area; public routes stay public; legit lower-case routes work.
// Real API + Firestore emulator (npm run test:emu). Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { CAP_API, FEATURE_API, FEATURE_WRITE_API } from "../../lib/accessMap";
import { call, db, login, makeParent, makeProvider, ok, uniq, type Provider } from "./helpers.mts";

let P: Provider;      // caps matrix in force; owner + staff
let F: Provider;      // every Setup feature switched off
let parent: { token: string };
const tok: Record<string, string> = {};

const caseVariants = (p: string) => [
  p.toUpperCase(),
  p.replace(/\/([a-z])/g, (_m, c: string) => "/" + c.toUpperCase()), // /Api/Medications
  p.replace(/^\/api/, "/API"),                                      // /API/medications
  p + "/",
  p.toUpperCase() + "/",
];
// Not "the same route" for Express, but a proxy/normaliser could still map them to it: they must never be MORE open than the canonical path.
const oddVariants = (p: string) => ["/" + p, p.replace("/api/", "/api//"), p.replace(/^\/api\/(.)/, (_m, c: string) => "/api/%" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")), p + "/."];

const AREAS = [...new Set(CAP_API.map((c) => c.area))];
const prefixes = () => [...new Set([...CAP_API.map((c) => c.prefix), ...FEATURE_API.map((f) => f.prefix), ...FEATURE_WRITE_API.map((f) => f.prefix)])];

before(async () => {
  P = await makeProvider("case");
  F = await makeProvider("casefeat");
  parent = await makeParent("case", P);
  const all = (level: string) => Object.fromEntries(AREAS.map((a) => [a, level]));
  const roles = [
    { id: "none-all", name: "None all", caps: all("none") },
    { id: "view-all", name: "View all", caps: all("view") },
    { id: "regs-only", name: "Regs only", caps: { ...all("none"), registers: "edit", bookings: "view" } },
  ];
  const lib = (await ok("GET", "/api/library", P.token)) ?? {};
  await ok("PUT", "/api/library", P.token, { venues: lib.venues ?? [], addons: lib.addons ?? [], settings: { ...(lib.settings ?? {}), roles, rolesSetAt: new Date().toISOString() } });
  for (const r of ["none-all", "view-all", "regs-only"]) {
    const email = `staff-${r}-${uniq()}@emu.test`;
    const s = await login(email);
    await db.collection("users").doc(s.uid).set({ email, role: "staff", chosen: true, tenantId: P.tenantId, franchiseId: null, name: email, staffRole: r, permRole: r }, { merge: true });
    tok[r] = s.token;
  }
  const keys = [...new Set([...FEATURE_API, ...FEATURE_WRITE_API].flatMap((f) => f.keys))];
  const flib = (await ok("GET", "/api/library", F.token)) ?? {};
  await ok("PUT", "/api/library", F.token, { venues: flib.venues ?? [], addons: flib.addons ?? [], settings: { ...(flib.settings ?? {}), features: Object.fromEntries(keys.map((k) => [k, false])) } });
});

describe("path case / slash variants get the same answer as the canonical path", () => {
  it("sanity: the none-all staff token is refused on the lower-case path for the headline areas", async () => {
    for (const p of ["/api/medications", "/api/incidents", "/api/bookings", "/api/customers"]) {
      const r = await call("GET", p, tok["none-all"]);
      assert.equal(r.status, 403, `${p} -> ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
    }
  });
  for (const who of ["none-all", "view-all", "regs-only"]) {
    it(`staff ${who}: every gated area, GET and POST, every case variant == canonical`, async () => {
      const bad: string[] = [];
      for (const p of prefixes()) {
        for (const method of ["GET", "POST"]) {
          const body = method === "POST" ? {} : undefined;
          const base = await call(method, p, tok[who], body);
          for (const v of caseVariants(p)) {
            const r = await call(method, v, tok[who], body);
            if (r.status !== base.status) bad.push(`${who} ${method} ${v}: ${r.status} (canonical ${p} ${base.status})`);
          }
        }
      }
      assert.deepEqual(bad, [], bad.slice(0, 25).join("\n") + (bad.length > 25 ? `\n... ${bad.length} total` : ""));
    });
  }
  it("a refused canonical path is never opened by an odd variant (double slash, encoded letter, dot segment)", async () => {
    const bad: string[] = [];
    for (const p of prefixes()) {
      const base = await call("GET", p, tok["none-all"]);
      if (base.status !== 403) continue;
      for (const v of oddVariants(p)) {
        const r = await call("GET", v, tok["none-all"]);
        if (r.status !== 403 && r.status !== 404) bad.push(`GET ${v}: ${r.status}`);
      }
    }
    assert.deepEqual(bad, [], bad.slice(0, 25).join("\n"));
  });
  it("Setup feature switches (turned off): owner gets the same 403 on every case variant", async () => {
    const bad: string[] = [];
    for (const f of FEATURE_API) {
      const base = await call("GET", f.prefix, F.token);
      assert.equal(base.status, 403, `${f.prefix} canonical should be feature_off, got ${base.status}`);
      for (const v of caseVariants(f.prefix)) {
        const r = await call("GET", v, F.token);
        if (r.status !== 403) bad.push(`GET ${v}: ${r.status}`);
      }
    }
    for (const f of FEATURE_WRITE_API) {
      const base = await call("POST", f.prefix, F.token, {});
      assert.equal(base.status, 403, `${f.prefix} POST canonical should be feature_off, got ${base.status}`);
      for (const v of caseVariants(f.prefix)) {
        const r = await call("POST", v, F.token, {});
        if (r.status !== 403) bad.push(`POST ${v}: ${r.status}`);
      }
    }
    assert.deepEqual(bad, [], bad.slice(0, 25).join("\n"));
  });
  it("owner and parent: variants answer exactly like the canonical path", async () => {
    const bad: string[] = [];
    for (const [who, token] of [["owner", P.token], ["parent", parent.token]] as const) {
      for (const p of ["/api/bookings", "/api/customers", "/api/medications", "/api/incidents", "/api/registers", "/api/library", "/api/me", "/api/my/bookings", "/api/platform/notifications"]) {
        const base = await call("GET", p, token);
        for (const v of caseVariants(p)) {
          const r = await call("GET", v, token);
          if (r.status !== base.status) bad.push(`${who} GET ${v}: ${r.status} (canonical ${base.status})`);
        }
      }
    }
    assert.deepEqual(bad, [], bad.join("\n"));
  });
  it("legit lower-case routes still work for a role that has the area", async () => {
    assert.equal((await call("GET", "/api/registers", tok["regs-only"])).status, 200);
    assert.equal((await call("GET", "/api/bookings", tok["regs-only"])).status, 200);
    assert.equal((await call("GET", "/api/bookings", tok["view-all"])).status, 200);
    assert.equal((await call("GET", "/api/bookings", P.token)).status, 200);
    assert.equal((await call("GET", "/api/me", tok["none-all"])).status, 200);
  });
  it("public routes stay public in any case", async () => {
    for (const p of ["/api/listings", "/api/providers", "/api/version", "/health"]) {
      const base = await call("GET", p, null);
      assert.ok(base.status < 300, `${p} -> ${base.status}`);
      for (const v of caseVariants(p).slice(0, 3)) {
        const r = await call("GET", v, null);
        assert.equal(r.status, base.status, `${v}: ${r.status} vs ${base.status}`);
      }
    }
  });
  it("signed-out callers get 401 on a case variant of a private route, not data", async () => {
    for (const v of ["/API/MEDICATIONS", "/api/Bookings", "/Api/Incidents/"]) {
      const r = await call("GET", v, null);
      assert.equal(r.status, 401, v);
    }
  });
});
