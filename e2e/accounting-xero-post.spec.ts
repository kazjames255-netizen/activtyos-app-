import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { loadAccounts, ROOT, API_URL } from "./helpers/env";
import { fbSignIn } from "./helpers/accounts";

// LIVE Xero test: posts a payroll wages journal to the 'ActivityOS Test' Xero org (a free trial org, no real books), verifies it,
// then VOIDS it (Xero manual journals cannot be deleted once posted). Refuses to run unless the connection label is exactly that.
// Setup used: the standing company account (Xero already connected — this spec never connects/disconnects it).

const server = path.join(ROOT, "server");
const patchDoc = (collection: string, id: string, patch: Record<string, unknown>) =>
  execFileSync("npx", ["tsx", path.join(ROOT, "e2e/helpers/docPatch.ts"), collection, id, JSON.stringify(patch)], { cwd: server, stdio: "pipe" });
const xero = (tenantId: string, cmd: string, jid: string) => {
  const out = execFileSync("npx", ["tsx", path.join(ROOT, "e2e/helpers/xeroAdmin.ts"), tenantId, cmd, jid], { cwd: server, stdio: "pipe" }).toString();
  return JSON.parse(out.match(/@@JSON@@(.*)@@END@@/)![1]);
};

async function call(method: string, p: string, token: string, body?: unknown) {
  const r = await fetch(`${API_URL}${p}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  let json: any = null; try { json = await r.json(); } catch { /* */ }
  return { status: r.status, body: json };
}

const LINES = [
  { id: "e2e-xero-a", name: "E2E Xero Alpha", grossM: 600, payeM: 60, eeNiM: 48, erNiM: 78, eePenM: 18, erPenM: 24, netM: 474 },
  { id: "e2e-xero-b", name: "E2E Xero Beta", grossM: 400, payeM: 40, eeNiM: 32, erNiM: 52, eePenM: 12, erPenM: 16, netM: 316 },
];

test("post an approved pay run to Xero: gates, mapping, balanced journal, idempotent, then void", async () => {
  test.setTimeout(240_000);
  const { accounts } = loadAccounts();
  const co = accounts.company, fl = accounts.freelancer;
  const tok = (await fbSignIn(co.email)).idToken;
  const flTok = (await fbSignIn(fl.email)).idToken;

  const conns = (await call("GET", "/api/accounting/connections", tok)).body;
  test.skip(!conns?.xero?.connected, "Xero is not connected for the e2e company account");
  expect(conns.xero.label, "SAFETY: only ever post to the 'ActivityOS Test' Xero org").toBe("ActivityOS Test");

  const priorMapping = (await call("GET", "/api/accounting/mapping?provider=xero", tok)).body.mapping ?? {};
  let journalId = "";
  const mk = async (t: string, period: string) => {
    const r = await call("POST", "/api/payroll/runs", t, { period, paidOn: "2026-09-30", lines: LINES });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    return r.body.id as string;
  };
  try {
    const period = `E2E Xero ${Date.now()}`;
    const runId = await mk(tok, period);
    const post = (id = runId, t = tok) => call("POST", `/api/accounting/post/${id}?provider=xero`, t);

    // draft -> 409
    expect((await post()).status).toBe(409);
    // creator cannot approve their own run (segregation of duties); a different creator can be approved by the company account
    expect((await call("POST", `/api/payroll/runs/${runId}/approve`, tok)).status).toBe(403);
    patchDoc("payrollRuns", `${co.tenantId}_${runId}`, { createdBy: "e2e-other-creator@activityos-test.com" });
    expect((await call("POST", `/api/payroll/runs/${runId}/approve`, tok)).status).toBe(200);

    // unmapped -> 400 (freelancer tenant has no mapping; mapping is checked before connection)
    const flRun = await mk(flTok, `E2E Xero fl ${Date.now()}`);
    patchDoc("payrollRuns", `${fl.tenantId}_${flRun}`, { createdBy: "e2e-other-creator@activityos-test.com" });
    expect((await call("POST", `/api/payroll/runs/${flRun}/approve`, flTok)).status).toBe(200);
    const un = await post(flRun, flTok);
    expect(un.status, JSON.stringify(un.body)).toBe(400);

    // real chart of accounts -> map all 6 buckets
    const accs = (await call("GET", "/api/accounting/xero/accounts", tok)).body as { id: string; name: string }[];
    expect(accs.length).toBeGreaterThanOrEqual(3);
    const codes = accs.map((a) => a.id).filter(Boolean);
    const pick = (i: number) => codes[i % codes.length];
    const mapping = { grossWages: pick(0), employerNi: pick(1), employerPension: pick(2), payeNicLiability: pick(codes.length - 1), pensionPayable: pick(codes.length - 2), netWagesBank: pick(codes.length - 3) };
    expect((await call("PUT", "/api/accounting/mapping", tok, { provider: "xero", mapping })).status).toBe(200);

    // post -> 200, journal stored on the run
    const ok = await post();
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    journalId = ok.body.journalId;
    expect(journalId).toMatch(/^[0-9a-f-]{36}$/);
    expect(ok.body.status).toBe("posted");
    const stored = ((await call("GET", "/api/payroll", tok)).body.runs as any[]).find((r) => r.id === runId);
    expect(stored.accounting.journalId).toBe(journalId);

    // idempotent re-post -> same journal id, no second journal
    const again = await post();
    expect(again.status).toBe(200);
    expect(again.body.journalId).toBe(journalId);
    expect(again.body.alreadyPosted).toBe(true);

    // fetch back from Xero: narration, balanced, amounts
    const j = xero(co.tenantId, "get", journalId);
    expect(j.Narration).toBe(`ActivityOS payroll — ${period}`);
    const amt = (desc: string) => j.JournalLines.find((l: any) => l.Description === desc).LineAmount as number;
    expect(amt("Gross wages")).toBe(1000);
    expect(amt("Employer NI")).toBe(130);
    expect(amt("Employer pension")).toBe(40);
    expect(amt("HMRC PAYE/NIC liability")).toBe(-(100 + 80 + 130));
    expect(amt("Pension payable")).toBe(-(30 + 40));
    expect(amt("Net wages")).toBe(-790);
    const debits = j.JournalLines.filter((l: any) => l.LineAmount > 0).reduce((a: number, l: any) => a + l.LineAmount, 0);
    const credits = -j.JournalLines.filter((l: any) => l.LineAmount < 0).reduce((a: number, l: any) => a + l.LineAmount, 0);
    expect(debits).toBe(credits);

    // other tenant cannot see/post this run; an unconnected tenant with its own approved run is refused
    expect((await post(runId, flTok)).status).toBe(404);
    await call("PUT", "/api/accounting/mapping", flTok, { provider: "xero", mapping });
    const refused = await post(flRun, flTok);
    expect(refused.status, JSON.stringify(refused.body)).toBe(409);
  } finally {
    if (journalId) expect(xero(co.tenantId, "void", journalId).Status).toBe("VOIDED");
    // PUT merges nested keys, so restore both tenants' mappings wholesale via the Admin helper
    patchDoc("accountingMappings", `${co.tenantId}__xero`, { mapping: priorMapping });
    patchDoc("accountingMappings", `${fl.tenantId}__xero`, { mapping: {} });
  }
});
