import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { loadAccounts, ROOT, API_URL } from "./helpers/env";
import { fbSignIn } from "./helpers/accounts";

// LIVE QuickBooks test against Intuit's SANDBOX company (fake data): posts a payroll wages journal, verifies it, then DELETES it
// (QBO journal entries can be deleted with operation=delete). Refuses unless QBO_ENV=sandbox and the connection is realm 9341458202792641.
// Uses the standing company account's existing QuickBooks connection — never connects/disconnects it.

const SANDBOX_REALM = "9341458202792641";
const server = path.join(ROOT, "server");
const patchDoc = (collection: string, id: string, patch: Record<string, unknown>) =>
  execFileSync("npx", ["tsx", path.join(ROOT, "e2e/helpers/docPatch.ts"), collection, id, JSON.stringify(patch)], { cwd: server, stdio: "pipe" });
const qbo = (tenantId: string, cmd: string, jid: string) => {
  const out = execFileSync("npx", ["tsx", path.join(ROOT, "e2e/helpers/qboAdmin.ts"), tenantId, cmd, jid], { cwd: server, stdio: "pipe" }).toString();
  return JSON.parse(out.match(/@@JSON@@(.*)@@END@@/)![1]);
};

async function call(method: string, p: string, token: string, body?: unknown) {
  const r = await fetch(`${API_URL}${p}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  let json: any = null; try { json = await r.json(); } catch { /* */ }
  return { status: r.status, body: json };
}

const LINES = [
  { id: "e2e-qbo-a", name: "E2E QBO Alpha", grossM: 600, payeM: 60, eeNiM: 48, erNiM: 78, eePenM: 18, erPenM: 24, netM: 474 },
  { id: "e2e-qbo-b", name: "E2E QBO Beta", grossM: 400, payeM: 40, eeNiM: 32, erNiM: 52, eePenM: 12, erPenM: 16, netM: 316 },
];

test("post an approved pay run to QuickBooks sandbox: gates, mapping, balanced journal, idempotent, then delete", async () => {
  test.setTimeout(240_000);
  const { accounts } = loadAccounts();
  const co = accounts.company, fl = accounts.freelancer;
  const tok = (await fbSignIn(co.email)).idToken;
  const flTok = (await fbSignIn(fl.email)).idToken;

  const conns = (await call("GET", "/api/accounting/connections", tok)).body;
  test.skip(!conns?.quickbooks?.connected, "QuickBooks is not connected for the e2e company account");
  expect(conns.quickbooks.label, "SAFETY: only ever post to the QBO sandbox company").toBe(`Company ${SANDBOX_REALM}`);
  expect(execFileSync("grep", ["-E", "^QBO_ENV=", path.join(server, ".env")]).toString().trim().replace(/["']/g, "")).toBe("QBO_ENV=sandbox");

  const priorMapping = (await call("GET", "/api/accounting/mapping?provider=quickbooks", tok)).body.mapping ?? {};
  let journalId = "";
  const mk = async (t: string, period: string) => {
    const r = await call("POST", "/api/payroll/runs", t, { period, paidOn: "2026-09-30", lines: LINES });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    return r.body.id as string;
  };
  try {
    const period = `E2E QBO ${Date.now()}`;
    const runId = await mk(tok, period);
    const post = (id = runId, t = tok) => call("POST", `/api/accounting/post/${id}?provider=quickbooks`, t);

    expect((await post()).status).toBe(409); // draft
    expect((await call("POST", `/api/payroll/runs/${runId}/approve`, tok)).status).toBe(403); // self-approval refused
    patchDoc("payrollRuns", `${co.tenantId}_${runId}`, { createdBy: "e2e-other-creator@activityos-test.com", createdByUid: "e2e-other-creator-uid" });
    expect((await call("POST", `/api/payroll/runs/${runId}/approve`, tok)).status).toBe(200);

    // unmapped -> 400 (freelancer tenant)
    const flRun = await mk(flTok, `E2E QBO fl ${Date.now()}`);
    patchDoc("payrollRuns", `${fl.tenantId}_${flRun}`, { createdBy: "e2e-other-creator@activityos-test.com", createdByUid: "e2e-other-creator-uid" });
    expect((await call("POST", `/api/payroll/runs/${flRun}/approve`, flTok)).status).toBe(200);
    const un = await post(flRun, flTok);
    expect(un.status, JSON.stringify(un.body)).toBe(400);

    // real chart of accounts -> map all 6 buckets (expenses for debits; liabilities/bank for credits; never AR/AP which need an entity)
    const accs = (await call("GET", "/api/accounting/quickbooks/accounts", tok)).body as { id: string; name: string }[];
    expect(accs.length).toBeGreaterThanOrEqual(3);
    const ofType = (t: string) => accs.filter((a) => a.name.endsWith(`(${t})`)).map((a) => a.id);
    const exp = ofType("Expense"), ocl = ofType("Other Current Liability"), bank = ofType("Bank");
    expect(exp.length).toBeGreaterThanOrEqual(1); expect(ocl.length).toBeGreaterThanOrEqual(1); expect(bank.length).toBeGreaterThanOrEqual(1);
    const mapping = { grossWages: exp[0], employerNi: exp[1] ?? exp[0], employerPension: exp[2] ?? exp[0], payeNicLiability: ocl[0], pensionPayable: ocl[1] ?? ocl[0], netWagesBank: bank[0] };
    expect((await call("PUT", "/api/accounting/mapping", tok, { provider: "quickbooks", mapping })).status).toBe(200);

    const ok = await post();
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    journalId = ok.body.journalId;
    expect(journalId).toMatch(/^\d+$/);
    expect(ok.body.status).toBe("posted");
    const stored = ((await call("GET", "/api/payroll", tok)).body.runs as any[]).find((r) => r.id === runId);
    expect(stored.accounting.journalId).toBe(journalId);

    const again = await post();
    expect(again.status).toBe(200);
    expect(again.body.journalId).toBe(journalId);
    expect(again.body.alreadyPosted).toBe(true);

    // fetch back from QBO
    const j = qbo(co.tenantId!, "get", journalId);
    expect(j.DocNumber).toMatch(/^AOS-PAY-2609-[0-9a-f]{6}$/); expect(j.DocNumber.length).toBeLessThanOrEqual(21);
    expect(j.TxnDate).toBe("2026-09-30");
    const line = (desc: string) => j.Line.find((l: any) => l.Description === desc);
    const amt = (desc: string, type: string) => { const l = line(desc); expect(l.JournalEntryLineDetail.PostingType).toBe(type); return l.Amount as number; };
    expect(amt("Gross wages", "Debit")).toBe(1000);
    expect(amt("Employer NI", "Debit")).toBe(130);
    expect(amt("Employer pension", "Debit")).toBe(40);
    expect(amt("HMRC PAYE/NIC liability", "Credit")).toBe(100 + 80 + 130);
    expect(amt("Pension payable", "Credit")).toBe(30 + 40);
    expect(amt("Net wages", "Credit")).toBe(790);
    const sum = (t: string) => j.Line.filter((l: any) => l.JournalEntryLineDetail.PostingType === t).reduce((a: number, l: any) => a + l.Amount, 0);
    expect(sum("Debit")).toBe(sum("Credit"));

    // other tenant cannot see/post; an unconnected tenant with its own approved+mapped run is refused
    expect((await post(runId, flTok)).status).toBe(404);
    await call("PUT", "/api/accounting/mapping", flTok, { provider: "quickbooks", mapping });
    const refused = await post(flRun, flTok);
    expect(refused.status, JSON.stringify(refused.body)).toBe(409);
  } finally {
    if (journalId) {
      const d = qbo(co.tenantId!, "delete", journalId);
      expect(d.deleted).toBe(true);
      expect(qbo(co.tenantId!, "exists", journalId).exists, "test journal must be gone from the sandbox").toBe(false);
    }
    patchDoc("accountingMappings", `${co.tenantId}__quickbooks`, { mapping: priorMapping });
    patchDoc("accountingMappings", `${fl.tenantId}__quickbooks`, { mapping: {} });
  }
});
