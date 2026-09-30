import { test, expect } from "@playwright/test";
import { API_URL, loadAccounts } from "./helpers/env";
import { fbSignIn } from "./helpers/accounts";
import { execFileSync } from "node:child_process";
import path from "node:path";

// Staff correcting their OWN earlier-day clockings: manager-only by default; when the tenant turns on staffBackfillDays the staff member must
// SUPPLY the real time (server "now" on an old record would be a ~48h shift), and the record is flagged for manager review.
test.describe.configure({ mode: "serial", timeout: 120_000 });

const raw = async (token: string, method: string, path: string, body?: unknown) => {
  const r = await fetch(`${API_URL}${path}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: r.status, json: await r.json().catch(() => null) as any };
};
const ukDay = (offset: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date(Date.now() + offset * 86_400_000));
let staff = "", mgr = "", tenantId = "";
// the record for the test day persists between runs (one doc per person per day) - delete it so the spec is re-runnable
const wipeDay = async (d: string) => {
  const mine = (await raw(staff, "GET", `/api/timeclock?day=${d}`)).json ?? [];
  for (const r of mine) execFileSync("npx", ["tsx", path.join(process.cwd(), "e2e/helpers/docDelete.ts"), "clockRecords", `${tenantId}_${d}_${r.id}`], { cwd: path.join(process.cwd(), "server"), stdio: "pipe" });
};
const settings = async (days: number) => {
  const cur = (await raw(mgr, "GET", "/api/timeclock/settings")).json;
  return raw(mgr, "PUT", "/api/timeclock/settings", { ...cur, staffBackfillDays: days });
};

test.beforeAll(async () => {
  const m = loadAccounts();
  staff = (await fbSignIn(m.accounts.staff.email, m.password)).idToken as string;
  // the standing staff account may have no name yet (a clocking is filed under the name)
  if (!String((await raw(staff, "GET", "/api/account")).json?.name ?? "").trim()) await raw(staff, "PUT", "/api/account", { name: `Clock Tester ${Date.now().toString(36)}` });
  mgr = (await fbSignIn(m.accounts.company.email, m.password)).idToken as string;
  tenantId = (m.accounts.company as any).tenantId;
  await wipeDay(ukDay(-2)); await wipeDay(ukDay(-1));
});
test.afterAll(async () => { await settings(0); await wipeDay(ukDay(-2)); await wipeDay(ukDay(-1)); });

test("off by default: earlier day is refused; staff cannot change the setting but can read it", async () => {
  expect((await settings(0)).status).toBe(200);
  const d = ukDay(-2);
  expect((await raw(staff, "POST", "/api/timeclock/event", { kind: "in", day: d, time: "09:00" })).status).toBe(400);
  expect((await raw(staff, "PUT", "/api/timeclock/settings", { payPolicy: "actual", autoPayOvertime: false, graceMin: 5, rounding: 0, leadLabel: "Lead", staffBackfillDays: 14 })).status).toBe(403);
  expect((await raw(staff, "GET", "/api/timeclock/settings")).json.staffBackfillDays).toBe(0);
});

test("on: accepted with the supplied time, flagged; bad requests rejected", async () => {
  expect((await settings(3)).status).toBe(200);
  const d = ukDay(-2);
  const ev = (b: object) => raw(staff, "POST", "/api/timeclock/event", { day: d, ...b });
  expect((await ev({ kind: "in" })).status).toBe(400);                       // no time
  expect((await ev({ kind: "out", time: "17:00" })).status).toBe(400);        // no clock-in yet
  expect((await ev({ kind: "in", time: "25:99" })).status).toBe(400);         // not a real time
  expect((await ev({ kind: "break-start", time: "10:00" })).status).toBe(400);
  expect((await ev({ kind: "in", time: "09:00", name: "Somebody Else" })).status).toBe(403); // other person
  const inn = await ev({ kind: "in", time: "09:00" });
  expect(inn.status).toBe(200);
  expect(inn.json.needsReview).toBe(true);
  expect(inn.json.staffEdited).toBe(true);
  expect(new Date(inn.json.clockInAt).getTime()).toBeLessThan(Date.now() - 24 * 3600_000);
  expect((await ev({ kind: "out", time: "08:00" })).status).toBe(400);        // out before in
  const out = await ev({ kind: "out", time: "17:30" });
  expect(out.status).toBe(200);
  expect(Date.parse(out.json.clockOutAt) - Date.parse(out.json.clockInAt)).toBe(8.5 * 3600_000); // not a ~48h shift
  // outside the look-back / future / today unaffected
  expect((await raw(staff, "POST", "/api/timeclock/event", { kind: "in", day: ukDay(-5), time: "09:00" })).status).toBe(400);
  expect((await raw(staff, "POST", "/api/timeclock/event", { kind: "in", day: ukDay(1), time: "09:00" })).status).toBe(400);
  // the manager sees it in the review queue, then clears it
  const q = await raw(mgr, "GET", "/api/timeclock/review");
  expect(q.status, JSON.stringify(q.json)).toBe(200);
  const hit = q.json.find((r: any) => r.day === d && r.staffEdited);
  expect(hit).toBeTruthy();
  expect((await raw(staff, "GET", "/api/timeclock/review")).status).toBe(403);
  expect((await raw(mgr, "PATCH", `/api/timeclock/${hit.id}?day=${d}`, { needsReview: false })).status).toBe(200);
  expect((await raw(mgr, "GET", "/api/timeclock/review")).json.find((r: any) => r.day === d)).toBeUndefined();
});

test("UK wall time is stored (BST-safe) and a manager-approved day cannot be rewritten by staff", async () => {
  expect((await settings(3)).status).toBe(200);
  const d = ukDay(-1);
  const inn = await raw(staff, "POST", "/api/timeclock/event", { kind: "in", day: d, time: "09:00" });
  expect(inn.status).toBe(200);
  // 09:00 in London on that day, whatever the season: the stored instant rendered back in London reads 09:00
  const back = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(inn.json.clockInAt));
  expect(back).toBe("09:00");
  expect((await raw(mgr, "PATCH", `/api/timeclock/${inn.json.id}?day=${d}`, { approved: true })).status).toBe(200);
  expect((await raw(staff, "POST", "/api/timeclock/event", { kind: "out", day: d, time: "17:00" })).status).toBe(400);
  expect((await raw(staff, "PATCH", `/api/timeclock/${inn.json.id}?day=${d}`, { needsReview: false })).status).toBe(403);
});
