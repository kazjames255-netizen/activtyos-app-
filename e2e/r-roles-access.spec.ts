import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { API_URL, ROOT } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, fbSignIn, fbSignUp } from "./helpers/accounts";

// Roles & permissions (#30) + assignment scoping (#32): PATCH /api/invites/:token/access
// changes a joined member of staff's role and assigned listings on the SERVER, and the
// existing enforcement (middleware/access.ts caps, lib/siteScope.ts) follows at once.
// Self-provisioned throwaway company + staff (cleaned by e2e:cleanup via the test domain).

test.describe.configure({ mode: "serial", timeout: 240_000 });

const stamp = Date.now().toString(36);
const email = (n: string) => `e2e-r-${n}-${stamp}@${TEST_EMAIL_DOMAIN}`;
const tokens: Record<string, string> = {};
let staffInvite = "";
let l1 = "", l2 = "", b2 = "";
const DAY = "2027-03-02";

const call = async (who: string, method: string, url: string, body?: unknown) => {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${API_URL}${url}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokens[who]}` }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: res.status, json: (await res.json().catch(() => null)) as any };
    } catch (e) { if (attempt >= 12) throw e; await new Promise((r) => setTimeout(r, 4_000)); }
  }
};

async function provision(prefix: string) {
  const ho = await fbSignUp(email(`${prefix}ho`));
  const reg = await fetch(`${API_URL}/api/register-role`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${ho.idToken}` }, body: JSON.stringify({ role: "company", businessName: `R Co ${prefix}${stamp}`, providerName: `R Co ${prefix}${stamp}`, providerNameMode: "business" }) });
  expect(reg.status).toBe(201);
  const tenantId = ((await reg.json()) as { tenantId: string }).tenantId;
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", tenantId], { stdio: "pipe" });
  return { ho, tenantId };
}

test.beforeAll(async () => {
  const a = await provision("a");
  tokens.ho = a.ho.idToken;
  const b = await provision("b"); // a second, unrelated tenant
  tokens.other = b.ho.idToken;

  // Roles matrix in force: coach can't see Moments and can only view families; lead can edit both.
  const lib = await call("ho", "GET", "/api/library");
  const settings = { ...(lib.json?.settings ?? {}), rolesSetAt: new Date().toISOString(), roles: [
    { id: "r_coach", name: "Coach", caps: { moments: "none", customers: "view" } },
    { id: "r_lead", name: "Lead", caps: { moments: "edit", customers: "edit" } },
  ] };
  expect((await call("ho", "PUT", "/api/library", { settings })).status).toBe(200);

  const inv = await call("ho", "POST", "/api/invites", { role: "staff", name: `R Staff ${stamp}`, staffRole: "r_coach", assignment: { mode: "all", ids: [] } });
  expect(inv.status).toBe(201);
  staffInvite = inv.json.token;
  const s = await fbSignUp(email("staff"));
  expect((await fetch(`${API_URL}/api/invites/${staffInvite}/accept`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.idToken}` }, body: "{}" })).status).toBe(200);
  tokens.staff = s.idToken;

  // Two listings, one block each, on the same day.
  for (const [k, n] of [["l1", "Alpha"], ["l2", "Beta"]] as const) {
    const l = await call("ho", "POST", "/api/listings", { name: `R ${n} ${stamp}`, description: "x" });
    expect(l.status).toBeLessThan(300);
    const blk = await call("ho", "POST", "/api/blocks", { listingId: l.json.id, name: `R ${n} block`, startDate: DAY, endDate: DAY, capacity: 10, schedule: { startTime: "09:00", endTime: "15:00" } });
    expect(blk.status).toBeLessThan(300);
    if (k === "l1") l1 = l.json.id; else { l2 = l.json.id; b2 = blk.json.id; }
  }
});

test("role follows the invite: coach is refused Moments, view-only on families", async () => {
  const money = await call("staff", "GET", "/api/moments");
  expect(money.status).toBe(403);
  expect(money.json?.code).toBe("no_access");
  expect((await call("staff", "GET", "/api/customers")).status).toBe(200);
  const w = await call("staff", "POST", "/api/customers", { name: `R fam ${stamp}`, email: `r-fam-${stamp}@${TEST_EMAIL_DOMAIN}` });
  expect(w.status).toBe(403);
  expect(w.json?.code).toBe("view_only");
});

test("access PATCH is refused for staff, other tenants, unknown roles and empty bodies", async () => {
  expect((await call("staff", "PATCH", `/api/invites/${staffInvite}/access`, { staffRole: "r_lead" })).status).toBe(403); // no self-promotion
  expect((await call("other", "PATCH", `/api/invites/${staffInvite}/access`, { staffRole: "r_lead" })).status).toBe(404); // not their invite
  expect((await call("ho", "PATCH", `/api/invites/${staffInvite}/access`, { staffRole: "r_nonexistent" })).status).toBe(400);
  expect((await call("ho", "PATCH", `/api/invites/${staffInvite}/access`, {})).status).toBe(400);
  // nothing changed
  expect((await call("staff", "GET", "/api/moments")).status).toBe(403);
});

test("changing the role on the server takes effect on the very next request", async () => {
  const r = await call("ho", "PATCH", `/api/invites/${staffInvite}/access`, { staffRole: "r_lead" });
  expect(r.status, JSON.stringify(r.json)).toBe(200);
  expect((await call("staff", "GET", "/api/moments")).status).toBe(200);
  const mw = await call("staff", "POST", "/api/moments", { caption: `R moment ${stamp}`, photoType: "work" });
  expect(mw.json?.code).not.toBe("view_only");
  expect(mw.json?.code).not.toBe("no_access");
  const me = await call("staff", "GET", "/api/me");
  expect(me.json?.permRole).toBe("r_lead");
  const list = await call("ho", "GET", "/api/invites");
  expect(list.json.find((i: any) => i.token === staffInvite)?.staffRole).toBe("r_lead");
  // and back down again
  expect((await call("ho", "PATCH", `/api/invites/${staffInvite}/access`, { staffRole: "r_coach" })).status).toBe(200);
  expect((await call("staff", "GET", "/api/moments")).status).toBe(403);
});

test("assigned staff see only their listings in registers; reassigning widens/narrows it live", async () => {
  const names = (j: any) => JSON.stringify(j ?? null);
  // unscoped (mode all): sees both
  const all = names((await call("staff", "GET", `/api/registers?date=${DAY}`)).json);
  expect(all).toContain(`R Alpha ${stamp}`);
  expect(all).toContain(`R Beta ${stamp}`);
  // assigned to listing 1 only
  expect((await call("ho", "PATCH", `/api/invites/${staffInvite}/access`, { assignment: { mode: "listings", ids: [l1] } })).status).toBe(200);
  const only1 = await call("staff", "GET", `/api/registers?date=${DAY}`);
  expect(only1.status).toBe(200);
  expect(names(only1.json)).toContain(`R Alpha ${stamp}`);
  expect(names(only1.json)).not.toContain(`R Beta ${stamp}`);
  // marking the other listing's register is refused
  const mark = await call("staff", "POST", `/api/registers/${b2}/${DAY}/mark`, { ref: "x", action: "in" });
  expect([403, 404]).toContain(mark.status);
  // moved to listing 2
  expect((await call("ho", "PATCH", `/api/invites/${staffInvite}/access`, { assignment: { mode: "listings", ids: [l2] } })).status).toBe(200);
  const only2 = names((await call("staff", "GET", `/api/registers?date=${DAY}`)).json);
  expect(only2).toContain(`R Beta ${stamp}`);
  expect(only2).not.toContain(`R Alpha ${stamp}`);
});

test("listing-wizard staff picker feed: the joined team is readable by managers only, never by staff or other tenants", async () => {
  const mine = await call("ho", "GET", "/api/location-staff");
  expect(mine.status).toBe(200);
  expect(JSON.stringify(mine.json.team)).toContain(`R Staff ${stamp}`);
  expect((await call("staff", "GET", "/api/location-staff")).status).toBe(403);
  const theirs = await call("other", "GET", "/api/location-staff");
  expect(theirs.status).toBe(200);
  expect(JSON.stringify(theirs.json.team)).not.toContain(`R Staff ${stamp}`);
});
