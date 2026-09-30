import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { API_URL, ROOT } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, fbSignUp } from "./helpers/accounts";

// PAYROLL SERVER-SIDE RECALCULATION — POST /api/payroll/runs re-runs the shared engine (features/payroll/payCalc.ts computeLine) from the STORED
// employee record and compares it with the browser's figures (1p tolerance). Default mode is WARN: a mismatch is recorded on the run as `calcCheck`
// and never blocks. A request may ask for "enforce" (stricter only) via body.calcMode, which is how this spec exercises enforce on a warn-default API.
// Throwaway company provisioned per run; its payroll data is wiped in afterAll (the account itself is removed by e2e:cleanup).

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const email = `e2e-paycalc-${stamp}@${TEST_EMAIL_DOMAIN}`;
const NAME = `Calc Person ${stamp}`;
const slug = (n: string) => n.trim().toLowerCase().replace(/\s+/g, "-");
let token = "";
let tenantId = "";

const call = async (method: string, url: string, body?: unknown) => {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${API_URL}${url}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
      const t = await res.text(); let json: any = null; try { json = JSON.parse(t); } catch { /* empty */ }
      return { status: res.status, json };
    } catch (e) { if (attempt >= 12) throw e; await new Promise((r) => setTimeout(r, 4_000)); }
  }
};
const admin = (...args: string[]) => {
  const out = execFileSync("npx", ["tsx", "../e2e/helpers/payrollAdmin.ts", ...args], { cwd: path.join(ROOT, "server"), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const m = out.match(/@@JSON@@([\s\S]*?)@@END@@/);
  return m ? JSON.parse(m[1]) : null;
};

// 36,000 a year, monthly, 1257L, cat A — the hand-computed golden line (payrollCalcVerify.mts): gross 3000, PAYE 390.20, NI 156.16, er NI 387.45, net 2453.64.
const goldLine = () => ({ id: slug(NAME), name: NAME, basis: "year", rate: 36000, hpw: 0, weeks: 52, taxCode: "1257L", niCat: "A", freqLabel: "Monthly", hoursM: 0, basePayM: 3000, addM: 0, dedM: 0, additions: [], deductions: [], manual: { paye: false, eeNi: false, eePen: false }, grossM: 3000, payeM: 390.2, eeNiM: 156.16, erNiM: 387.45, eePenM: 0, erPenM: 0, netM: 2453.64 });
const runBody = (period: string, line: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ period, paidOn: "2026-10-31", freq: "monthly", window: { start: "2026-10-01", end: "2026-10-31" }, lines: [line], ...extra });

test.beforeAll(async () => {
  test.setTimeout(300_000);
  const co = await fbSignUp(email);
  token = co.idToken;
  const reg = await call("POST", "/api/register-role", { role: "company", businessName: `PayCalc Co ${stamp}`, providerName: `PayCalc Co ${stamp}`, providerNameMode: "business" });
  expect(reg.status, JSON.stringify(reg.json)).toBe(201);
  tenantId = reg.json.tenantId;
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", tenantId], { stdio: "pipe" });
  const put = await call("PUT", "/api/payroll/employees", { employees: [{ id: slug(NAME), name: NAME, role: "Coach", basis: "year", rate: 36000, hpw: 0, weeks: 52, taxCode: "1257L", niCat: "A", pension: false }] });
  expect(put.status, JSON.stringify(put.json)).toBe(200);
});

test.afterAll(async () => {
  try { if (tenantId) admin("wipe", tenantId); } catch (e) { console.error("payroll wipe failed", (e as Error).message); }
});

test("a matching run is stored exactly as before: no calcCheck, in warn and in enforce", async () => {
  const a = await call("POST", "/api/payroll/runs", runBody(`Match warn ${stamp}`, goldLine()));
  expect(a.status, JSON.stringify(a.json)).toBe(201);
  expect(a.json.period).toBe(`Match warn ${stamp}`);
  expect(a.json.calcCheck, "a matching run must not carry calcCheck").toBeUndefined();
  expect(a.json.calcMode, "the per-request mode is never stored").toBeUndefined();
  const b = await call("POST", "/api/payroll/runs", runBody(`Match enforce ${stamp}`, goldLine(), { calcMode: "enforce" }));
  expect(b.status, JSON.stringify(b.json)).toBe(201);
  expect(b.json.calcCheck).toBeUndefined();
  const stored = (await call("GET", "/api/payroll")).json.runs.filter((r: any) => String(r.period).endsWith(stamp) && r.period.startsWith("Match"));
  expect(stored.length).toBe(2);
  for (const r of stored) { expect(r.calcCheck).toBeUndefined(); expect(r.lines[0].payeM).toBe(390.2); expect(r.status).toBe("draft"); }
});

test("warn (the default): a tampered PAYE line is STILL created, with calcCheck naming the mismatch", async () => {
  const period = `Mismatch warn ${stamp}`;
  const r = await call("POST", "/api/payroll/runs", runBody(period, { ...goldLine(), payeM: 100, netM: 2743.84 }));
  expect(r.status, JSON.stringify(r.json)).toBe(201);
  expect(r.json.lines[0].payeM, "the submitted figures are stored untouched").toBe(100);
  expect(r.json.calcCheck.status).toBe("mismatch");
  expect(r.json.calcCheck.mode).toBe("warn");
  expect(r.json.calcCheck.checked).toBe(1);
  const m = r.json.calcCheck.mismatches.find((x: any) => x.field === "payeM");
  expect(m, JSON.stringify(r.json.calcCheck)).toBeTruthy();
  expect(m).toMatchObject({ employeeKey: slug(NAME), sent: 100, computed: 390.2 });
  // anchored to THIS run: read it back from the list
  const listed = (await call("GET", "/api/payroll")).json.runs.find((x: any) => x.period === period);
  expect(listed.calcCheck.status).toBe("mismatch");
  expect(JSON.stringify(listed.calcCheck)).not.toMatch(/niNumber|niNumberEnc/);
});

test("enforce: a tampered run is refused with a readable 400 and nothing is stored", async () => {
  const period = `Mismatch enforce ${stamp}`;
  const r = await call("POST", "/api/payroll/runs", runBody(period, { ...goldLine(), grossM: 9000, netM: 8000 }, { calcMode: "enforce" }));
  expect(r.status, JSON.stringify(r.json)).toBe(400);
  expect(r.json.code).toBe("calc_mismatch");
  expect(r.json.error).toContain(NAME);
  expect(r.json.error).toMatch(/grossM sent 9000 but the server calculates 3000/);
  expect(r.json.mismatches.some((x: any) => x.field === "grossM")).toBe(true);
  const after = (await call("GET", "/api/payroll")).json.runs.filter((x: any) => x.period === period);
  expect(after.length, "no run may be created for a refused request").toBe(0);
});

test("a rate that differs from the stored employee record is caught; 1p rounding noise and unknown (manual) employees are not", async () => {
  const rate = await call("POST", "/api/payroll/runs", runBody(`Rate ${stamp}`, { ...goldLine(), rate: 99000 }, { calcMode: "enforce" }));
  expect(rate.status, JSON.stringify(rate.json)).toBe(400);
  expect(rate.json.mismatches.some((x: any) => x.field === "rate")).toBe(true);
  const penny = await call("POST", "/api/payroll/runs", runBody(`Penny ${stamp}`, { ...goldLine(), payeM: 390.21, netM: 2453.63 }, { calcMode: "enforce" }));
  expect(penny.status, JSON.stringify(penny.json)).toBe(201);
  expect(penny.json.calcCheck).toBeUndefined();
  const manual = await call("POST", "/api/payroll/runs", runBody(`Manual ${stamp}`, { ...goldLine(), id: `manual-${stamp}`, name: `Manual ${stamp}`, payeM: 1, netM: 2000 }, { calcMode: "enforce" }));
  expect(manual.status, "a person not on the stored employee list cannot be verified, so is never blocked").toBe(201);
  expect(manual.json.calcCheck).toBeUndefined();
});
