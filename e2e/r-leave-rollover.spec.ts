import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { API_URL, ROOT } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, fbSignUp } from "./helpers/accounts";
import { leaveYearOf, planRollover } from "../server/src/lib/leaveRollover";

// Holiday & absence (#40): year-end carry-over rollover. Pure rule + the manager-only, dry-run-by-default API.
test.describe.configure({ mode: "serial", timeout: 240_000 });

const POL = { leaveYearStartMonth: 1, leaveYearStartDay: 1, daysPerWeek: 5, allowanceBasis: "statutory" as const, customDays: 28, carryOverMax: 5 };

test("pure rule: cap, expiry, joiners, rolled-up, idempotence, April year", () => {
  expect(leaveYearOf({ leaveYearStartMonth: 4, leaveYearStartDay: 1 }, "2027-03-31")).toEqual({ start: "2026-04-01", end: "2027-03-31" });
  expect(leaveYearOf(POL, "2027-01-01")).toEqual({ start: "2027-01-01", end: "2027-12-31" });
  const abs = [{ staffId: "a", kind: "annual", status: "approved", start: "2026-06-01", days: 5 }, { staffId: "a", kind: "annual", status: "pending", start: "2026-07-01", days: 9 },
    { staffId: "a", kind: "sickness", status: "approved", start: "2026-08-01", days: 3 }, { staffId: "a", kind: "annual", status: "approved", start: "2025-12-30", days: 2 }];
  const plan = planRollover(POL, [
    { id: "a", name: "A", allowanceDays: 28 },
    { id: "b", name: "B", allowanceDays: 28, carriedOver: 3, startDate: "2026-07-01" }, // joined mid-year: 6 months = 14 + 3 carried in
    { id: "c", name: "C", holidayPay: "rolled-up" },
    { id: "d", name: "D", allowanceDays: 28, rolledYearStart: "2027-01-01" },
    { id: "e", name: "E", startDate: "2027-02-01" },
  ], abs, "2027-01-10");
  const r = Object.fromEntries(plan.rows.map((x) => [x.id, x]));
  expect(plan.endedYear).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  expect(r.a).toMatchObject({ used: 5, unused: 23, carry: 5, expired: 18 }); // only APPROVED ANNUAL in the ended year counts
  expect(r.b).toMatchObject({ allowance: 14, carriedIn: 3, unused: 17, carry: 5 });
  expect(r.c.skipped).toBeTruthy(); expect(r.d.skipped).toBeTruthy(); expect(r.e.skipped).toBeTruthy();
});

let ho = "", other = "";
const call = async (tok: string, method: string, url: string, body?: unknown) => {
  const res = await fetch(`${API_URL}${url}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: (await res.json().catch(() => null)) as any };
};

test("API: dry-run by default, apply stamps once, tenants isolated", async () => {
  const Y = new Date().getFullYear(), P = Y - 1, ASOF = `${Y}-${new Date().toISOString().slice(5, 10)}`;
  const stamp = Date.now().toString(36);
  const mk = async (n: string) => {
    const u = await fbSignUp(`e2e-r-${n}-${stamp}@${TEST_EMAIL_DOMAIN}`);
    const reg = await call(u.idToken, "POST", "/api/register-role", { role: "company", businessName: `R Leave ${n}${stamp}`, providerName: `R Leave ${n}${stamp}`, providerNameMode: "business" });
    expect(reg.status).toBe(201);
    execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", reg.json.tenantId], { stdio: "pipe" });
    return u.idToken as string;
  };
  ho = await mk("ho"); other = await mk("ot");
  expect((await call(ho, "PUT", "/api/leave/config", { policy: POL, profiles: [{ id: "pat", name: "Pat Lee", allowanceDays: 28, carriedOver: 0 }, { id: "sam", name: "Sam Roe", allowanceDays: 28 }] })).status).toBe(200);
  const add = (name: string, start: string, end: string, days: number) => call(ho, "POST", "/api/leave/absences", { name, staffId: name.split(" ")[0].toLowerCase(), kind: "annual", start, end, days, status: "approved" });
  expect((await add("Pat Lee", `${P}-06-01`, `${P}-06-05`, 5)).status).toBeLessThan(300);
  expect((await add("Sam Roe", `${P}-03-01`, `${P}-04-06`, 27)).status).toBeLessThan(300);

  const dry = await call(ho, "POST", "/api/leave/rollover", { asOf: ASOF });
  expect(dry.status, JSON.stringify(dry.json)).toBe(200);
  expect(dry.json.dryRun).toBe(true);
  const row = (j: any, id: string) => j.rows.find((x: any) => x.id === id);
  expect(row(dry.json, "pat")).toMatchObject({ unused: 23, carry: 5, expired: 18 });
  expect(row(dry.json, "sam")).toMatchObject({ used: 27, carry: 1 });
  const cfg = await call(ho, "GET", "/api/leave");
  expect(cfg.json.profiles.find((p: any) => p.id === "pat").carriedOver).toBe(0); // dry-run wrote nothing

  expect((await call(ho, "POST", "/api/leave/rollover", { apply: true, asOf: "2999-01-01" })).status).toBe(400);
  const applied = await call(ho, "POST", "/api/leave/rollover", { apply: true, asOf: ASOF });
  expect(applied.status, JSON.stringify(applied.json)).toBe(200);
  expect(applied.json.applied).toBe(true);
  const after = (await call(ho, "GET", "/api/leave")).json.profiles;
  expect(after.find((p: any) => p.id === "pat").carriedOver).toBe(5);
  expect(after.find((p: any) => p.id === "sam").carriedOver).toBe(1);
  const again = await call(ho, "POST", "/api/leave/rollover", { apply: true, asOf: ASOF });
  expect(again.json.rows.every((x: any) => x.skipped)).toBe(true); // idempotent
  expect((await call(ho, "GET", "/api/leave")).json.profiles.find((p: any) => p.id === "pat").carriedOver).toBe(5);

  // another tenant has no policy and cannot see or touch this one's
  const o = await call(other, "POST", "/api/leave/rollover", { apply: true, asOf: ASOF });
  expect(o.status).toBe(400);
  expect(JSON.stringify((await call(other, "GET", "/api/leave")).json)).not.toContain("Pat Lee");
});
