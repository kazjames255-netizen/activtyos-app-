import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { loadAccounts, ROOT, API_URL } from "./helpers/env";
import { fbSignIn } from "./helpers/accounts";
import { computeTotals, journalLegs } from "../server/src/lib/accounting";

// Big pay runs: a realistic 200-person run (every field a real payCalc Line carries) must be accepted, approved and journal-balanced to the penny.
// A run that would blow Firestore's 1 MiB document limit must be refused with a clear 4xx - never a 500 / half-written run.
const server = path.join(ROOT, "server");
const docDelete = (id: string) => execFileSync("npx", ["tsx", path.join(ROOT, "e2e/helpers/docDelete.ts"), "payrollRuns", id], { cwd: server, stdio: "pipe" });
const patchDoc = (id: string, patch: Record<string, unknown>) => execFileSync("npx", ["tsx", path.join(ROOT, "e2e/helpers/docPatch.ts"), "payrollRuns", id, JSON.stringify(patch)], { cwd: server, stdio: "pipe" });
async function call(method: string, p: string, token: string, body?: unknown) {
  const r = await fetch(`${API_URL}${p}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j: any = null; try { j = await r.json(); } catch { /* */ }
  return { status: r.status, body: j };
}
const r2 = (n: number) => Math.round(n * 100) / 100;
const line = (i: number) => {
  const gross = r2(1200.13 + i * 7.77), paye = r2(gross * 0.1837), eeNi = r2(gross * 0.0791), erNi = r2(gross * 0.1379), eePen = r2(gross * 0.0499), erPen = r2(gross * 0.0301), ded = i % 9 === 0 ? 17.03 : 0;
  return {
    id: `e2e-size-${i}`, staffKey: `e2e-size-${i}`, name: `E2E Size Person ${i}`, role: "Coach", op: "Main site", basis: "year", rate: 30000 + i, hpw: 37.5, weeks: 52, taxCode: "1257L", niCat: "A", freqLabel: "Monthly",
    hoursM: 0, basePayM: gross, addM: 0, dedM: ded, additions: [], deductions: ded ? [{ id: "d1", label: "Advance recovery", amount: ded }] : [], manual: { paye: false, eeNi: false, eePen: false },
    grossM: gross, payeM: paye, eeNiM: eeNi, erNiM: erNi, eePenM: eePen, erPenM: erPen, netM: r2(gross - paye - eeNi - eePen - ded),
  };
};

test("200-person pay run: accepted, approved, and its journal balances to the penny", async () => {
  test.setTimeout(120_000);
  const co = loadAccounts().accounts.company;
  const tok = (await fbSignIn(co.email)).idToken;
  const lines = Array.from({ length: 200 }, (_, i) => line(i));
  const made = await call("POST", "/api/payroll/runs", tok, { period: `E2E size 200 ${Date.now()}`, paidOn: "2026-09-30", lines });
  expect(made.status, JSON.stringify(made.body).slice(0, 300)).toBe(201);
  const docId = `${co.tenantId}_${made.body.id}`;
  try {
    patchDoc(docId, { createdBy: "e2e-other-creator@activityos-test.com", createdByUid: "e2e-other-creator-uid" });
    expect((await call("POST", `/api/payroll/runs/${made.body.id}/approve`, tok)).status).toBe(200);
    const stored = ((await call("GET", "/api/payroll", tok)).body.runs as any[]).find((r) => r.id === made.body.id);
    expect(stored.lines.length).toBe(200);
    const legs = journalLegs(computeTotals(stored.lines));
    expect(legs.reduce((a, l) => a + l.pence, 0)).toBe(0);
    const pence = (k: string) => stored.lines.reduce((a: number, l: any) => a + Math.round(l[k] * 100), 0);
    expect(legs.find((l) => l.description === "Gross wages")!.pence).toBe(pence("grossM"));
    expect(-legs.find((l) => l.description === "Net wages")!.pence).toBe(pence("netM"));
  } finally { docDelete(docId); }
});

test("an oversized run is refused cleanly (never a 500)", async () => {
  test.setTimeout(120_000);
  const co = loadAccounts().accounts.company;
  const tok = (await fbSignIn(co.email)).idToken;
  const big = Array.from({ length: 1000 }, (_, i) => ({ ...line(i), note: "x".repeat(700) }));
  const r = await call("POST", "/api/payroll/runs", tok, { period: `E2E size 1000 ${Date.now()}`, paidOn: "2026-09-30", lines: big });
  try {
    expect(r.status, `${r.status} ${JSON.stringify(r.body).slice(0, 200)}`).toBeLessThan(500);
  } finally { if (r.status === 201) docDelete(`${co.tenantId}_${r.body.id}`); }
});
