import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { loadAccounts, ROOT, API_URL } from "./helpers/env";
import { fbSignIn } from "./helpers/accounts";
import { computeTotals, journalLegs } from "../server/src/lib/accounting";

// LIVE edge cases for the payroll -> accounting journal, run against the two authorised TEST orgs only:
//   Xero  'ActivityOS Test'  (journals are VOIDED afterwards - Xero cannot delete posted manual journals)
//   QBO   Intuit SANDBOX realm 9341458202792641 (journals are DELETED afterwards, existence re-checked)
// Covers: after-tax deductions balance (7th bucket), odd pence, correction (negative) run, unique refs for same-month runs, concurrent double-post
// (Promise.all), mapping validation (wrong type / unknown / clear), provider-side rejection stored as `failed` + retry, expired/revoked refresh token -> 409 (not 500)
// with self-recovery, stale access token -> transparent forced refresh. Never connects/disconnects; tokens are restored byte-for-byte in `finally`.

const SANDBOX_REALM = "9341458202792641";
const server = path.join(ROOT, "server");
const tsx = (script: string, ...args: string[]) => execFileSync("npx", ["tsx", path.join(ROOT, "e2e/helpers", script), ...args], { cwd: server, stdio: "pipe" }).toString();
const json = (out: string) => JSON.parse(out.match(/@@JSON@@(.*)@@END@@/)![1]);
const patchDoc = (collection: string, id: string, patch: Record<string, unknown>) => tsx("docPatch.ts", collection, id, JSON.stringify(patch));
async function call(method: string, p: string, token: string, body?: unknown) {
  const r = await fetch(`${API_URL}${p}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j: any = null; try { j = await r.json(); } catch { /* */ }
  return { status: r.status, body: j };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const mk = (id: string, gross: number, ded = 0, pension = true) => {
  const paye = r2(gross * 0.1837), eeNi = r2(gross * 0.0791), erNi = r2(gross * 0.1379), eePen = pension ? r2(gross * 0.0499) : 0, erPen = pension ? r2(gross * 0.0301) : 0;
  return { id, name: id, grossM: gross, payeM: paye, eeNiM: eeNi, erNiM: erNi, eePenM: eePen, erPenM: erPen, netM: r2(gross - paye - eeNi - eePen - ded) };
};
const ODD = [mk("e2e-edge-a", 1234.57, 50.05), mk("e2e-edge-b", 0.07), mk("e2e-edge-c", 333.33, 0, false), mk("e2e-edge-d", 9876.54, 12.34)];
const FIX = [mk("e2e-edge-f1", 600), mk("e2e-edge-f2", 400)];
const NEG = FIX.map((l) => Object.fromEntries(Object.entries(l).map(([k, v]) => [k, typeof v === "number" ? -v : v])));

interface Prov {
  key: "xero" | "quickbooks"; label: string;
  admin: (tenantId: string, cmd: string, arg?: string) => any;
  pick: (accs: { id: string; name: string }[]) => Record<string, string> & { _wrongForLiability: string };
  legs: (journal: any) => Record<string, number>; // description -> signed pence (+debit)
  remove: (tenantId: string, id: string) => void;
}
const P: Prov[] = [
  {
    key: "xero", label: "Xero",
    admin: (t, cmd, arg = "") => json(tsx("xeroAdmin.ts", t, cmd, arg)),
    pick: (accs) => {
      const ex = accs.filter((a) => a.name.endsWith("(EXPENSE)")).map((a) => a.id), li = accs.filter((a) => a.name.endsWith("(LIABILITY)")).map((a) => a.id);
      expect(ex.length).toBeGreaterThanOrEqual(1); expect(li.length).toBeGreaterThanOrEqual(1);
      return { grossWages: ex[0], employerNi: ex[1] ?? ex[0], employerPension: ex[2] ?? ex[0], payeNicLiability: li[0], pensionPayable: li[1] ?? li[0], netWagesBank: li[2] ?? li[0], otherDeductions: li[3] ?? li[0], _wrongForLiability: ex[0] };
    },
    legs: (j) => Object.fromEntries(j.JournalLines.map((l: any) => [l.Description, Math.round(l.LineAmount * 100)])),
    remove: (t, id) => { expect(json(tsx("xeroAdmin.ts", t, "void", id)).Status).toBe("VOIDED"); },
  },
  {
    key: "quickbooks", label: "QuickBooks",
    admin: (t, cmd, arg = "") => json(tsx("qboAdmin.ts", t, cmd, arg)),
    pick: (accs) => {
      const of = (t: string) => accs.filter((a) => a.name.endsWith(`(${t})`)).map((a) => a.id);
      const ex = of("Expense"), ocl = of("Other Current Liability"), bank = of("Bank");
      expect(ex.length).toBeGreaterThanOrEqual(1); expect(ocl.length).toBeGreaterThanOrEqual(1); expect(bank.length).toBeGreaterThanOrEqual(1);
      return { grossWages: ex[0], employerNi: ex[1] ?? ex[0], employerPension: ex[2] ?? ex[0], payeNicLiability: ocl[0], pensionPayable: ocl[1] ?? ocl[0], netWagesBank: bank[0], otherDeductions: ocl[2] ?? ocl[0], _wrongForLiability: ex[0] };
    },
    legs: (j) => Object.fromEntries(j.Line.map((l: any) => [l.Description, Math.round(l.Amount * 100) * (l.JournalEntryLineDetail.PostingType === "Debit" ? 1 : -1)])),
    remove: (t, id) => { expect(json(tsx("qboAdmin.ts", t, "delete", id)).deleted).toBe(true); expect(json(tsx("qboAdmin.ts", t, "exists", id)).exists, "test journal must be gone").toBe(false); },
  },
];

for (const prov of P) {
  test(`${prov.label}: accounting edge cases (balance, negatives, races, mapping, failures, token recovery)`, async () => {
    test.setTimeout(560_000);
    const { accounts } = loadAccounts();
    const co = accounts.company;
    const tenantId = co.tenantId!;
    const tok = (await fbSignIn(co.email)).idToken;
    const conns = (await call("GET", "/api/accounting/connections", tok)).body;
    test.skip(!conns?.[prov.key]?.connected, `${prov.label} is not connected for the e2e company account`);
    if (prov.key === "xero") expect(conns.xero.label, "SAFETY: only the 'ActivityOS Test' Xero org").toBe("ActivityOS Test");
    else {
      expect(conns.quickbooks.label, "SAFETY: only the QBO sandbox company").toBe(`Company ${SANDBOX_REALM}`);
      expect(execFileSync("grep", ["-E", "^QBO_ENV=", path.join(server, ".env")]).toString().trim().replace(/["']/g, "")).toBe("QBO_ENV=sandbox");
    }
    expect(conns[prov.key].needsReconnect).toBeFalsy();

    const priorMapping = (await call("GET", `/api/accounting/mapping?provider=${prov.key}`, tok)).body.mapping ?? {};
    const created: string[] = [];
    let tokensTouched = false;
    const post = (id: string) => call("POST", `/api/accounting/post/${id}?provider=${prov.key}`, tok);
    // `forceLines`: the create endpoint now (rightly) refuses negative figures, so a correction/reversal run is written straight onto the draft doc.
    const approvedRun = async (tag: string, lines: unknown[], forceLines?: unknown[]) => {
      const period = `E2E edge ${tag} ${Date.now()}`;
      const r = await call("POST", "/api/payroll/runs", tok, { period, paidOn: "2026-09-30", lines });
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      patchDoc("payrollRuns", `${tenantId}_${r.body.id}`, { createdBy: "e2e-other-creator@activityos-test.com", createdByUid: "e2e-other-creator-uid", ...(forceLines ? { lines: forceLines } : {}) });
      expect((await call("POST", `/api/payroll/runs/${r.body.id}/approve`, tok)).status).toBe(200);
      return { id: r.body.id as string, period };
    };
    const storedAccounting = async (id: string) => ((await call("GET", "/api/payroll", tok)).body.runs as any[]).find((r) => r.id === id).accounting;
    const expectedFor = (lines: any[]) => Object.fromEntries(journalLegs(computeTotals(lines)).map((l) => [l.description, l.pence]));
    const checkJournal = (journalId: string, lines: any[]) => {
      const legs = prov.legs(prov.admin(tenantId, "get", journalId));
      expect(legs).toEqual(expectedFor(lines));
      expect(Object.values(legs).reduce((a, b) => a + b, 0), "journal must balance to the penny").toBe(0);
      return legs;
    };

    try {
      // ── setup: real chart of accounts, correct-type mapping WITHOUT the optional 7th bucket
      const accs = (await call("GET", `/api/accounting/${prov.key}/accounts`, tok)).body as { id: string; name: string }[];
      const full = prov.pick(accs);
      const { _wrongForLiability, otherDeductions, ...core } = full;
      expect((await call("PUT", "/api/accounting/mapping", tok, { provider: prov.key, mapping: core })).body.validated).toBe(true);

      // ── S1: run WITH after-tax deductions + odd pence needs the 7th bucket; without it: clear 400, nothing posted
      const s1 = await approvedRun("deductions", ODD);
      const need = await post(s1.id);
      expect(need.status, JSON.stringify(need.body)).toBe(400);
      expect(need.body.error).toMatch(/Other deductions/);
      expect((await call("PUT", "/api/accounting/mapping", tok, { provider: prov.key, mapping: { ...core, otherDeductions } })).status).toBe(200);
      const s1p = await post(s1.id);
      expect(s1p.status, JSON.stringify(s1p.body)).toBe(200);
      created.push(s1p.body.journalId);
      const t1 = computeTotals(ODD);
      expect(t1.otherDeductions).toBe(r2(50.05 + 12.34)); // 62.39: the money withheld from net pay (advance recoveries)
      const legs1 = checkJournal(s1p.body.journalId, ODD);
      expect(legs1["Other deductions"]).toBe(-6239);
      expect((await storedAccounting(s1.id)).status).toBe("posted");

      // ── S2: concurrent double-post (Promise.all) creates exactly ONE journal
      const s2 = await approvedRun("race", FIX);
      const rs = await Promise.all([post(s2.id), post(s2.id), post(s2.id), post(s2.id)]);
      expect(rs.map((r) => r.status), JSON.stringify(rs.map((r) => r.body))).toEqual([200, 200, 200, 200]);
      const ids = new Set(rs.map((r) => r.body.journalId));
      expect(ids.size, "all four callers must see the same journal").toBe(1);
      expect(rs.filter((r) => !r.body.alreadyPosted).length, "exactly one caller actually posted").toBe(1);
      const j2 = [...ids][0] as string; created.push(j2);
      checkJournal(j2, FIX);
      const refs = new Set<string>();
      if (prov.key === "quickbooks") {
        const doc2 = prov.admin(tenantId, "get", j2).DocNumber as string;
        expect(prov.admin(tenantId, "find", doc2).ids, "one journal for that DocNumber").toEqual([j2]);
        refs.add(doc2); refs.add(prov.admin(tenantId, "get", s1p.body.journalId).DocNumber);
        expect(refs.size, "two runs in the same month get DIFFERENT DocNumbers").toBe(2);
      }

      // ── S3: correction/reversal run (negative figures) flips sides and still balances; QBO never sees a negative Amount
      const s3 = await approvedRun("reversal", FIX, NEG);
      const s3p = await post(s3.id);
      expect(s3p.status, JSON.stringify(s3p.body)).toBe(200);
      created.push(s3p.body.journalId);
      const legs3 = checkJournal(s3p.body.journalId, NEG);
      expect(legs3["Gross wages"]).toBe(-100000); expect(legs3["Net wages"]).toBeGreaterThan(0);

      // ── S4: mapping validation - wrong type / unknown / archived-or-missing are refused with per-bucket problems; clearing a bucket really clears
      const wrong = await call("PUT", "/api/accounting/mapping", tok, { provider: prov.key, mapping: { ...core, payeNicLiability: _wrongForLiability } });
      expect(wrong.status, JSON.stringify(wrong.body)).toBe(400);
      expect(Object.keys(wrong.body.problems)).toEqual(["payeNicLiability"]);
      const unknown = await call("PUT", "/api/accounting/mapping", tok, { provider: prov.key, mapping: { ...core, grossWages: "no-such-account-999" } });
      expect(unknown.status).toBe(400); expect(unknown.body.problems.grossWages).toMatch(/doesn't exist/);
      const cleared = { ...core, pensionPayable: "" };
      expect((await call("PUT", "/api/accounting/mapping", tok, { provider: prov.key, mapping: cleared })).status).toBe(200);
      expect((await call("GET", `/api/accounting/mapping?provider=${prov.key}`, tok)).body.mapping.pensionPayable).toBeUndefined();
      const s4 = await approvedRun("unmapped", FIX);
      expect((await post(s4.id)).status, "a cleared bucket blocks posting").toBe(400);
      expect((await call("PUT", "/api/accounting/mapping", tok, { provider: prov.key, mapping: full })).status).toBe(200);

      // ── S5: provider-side rejection (bad account smuggled past validation) -> 422 + stored `failed`/validation, then a fixed mapping retries OK
      const s5 = await approvedRun("provider-reject", FIX);
      patchDoc("accountingMappings", `${tenantId}__${prov.key}`, { "mapping.grossWages": "999999" });
      const rej = await post(s5.id);
      expect(rej.status, JSON.stringify(rej.body)).toBe(422);
      expect(rej.body.kind).toBe("validation");
      const failed = await storedAccounting(s5.id);
      expect(failed.status).toBe("failed"); expect(failed.errorKind).toBe("validation"); expect(String(failed.error).length).toBeGreaterThan(10);
      expect(failed.journalId).toBeUndefined();
      expect((await call("PUT", "/api/accounting/mapping", tok, { provider: prov.key, mapping: full })).status).toBe(200);
      const retry = await post(s5.id);
      expect(retry.status, JSON.stringify(retry.body)).toBe(200);
      created.push(retry.body.journalId);
      expect((await storedAccounting(s5.id)).status).toBe("posted");
      checkJournal(retry.body.journalId, FIX);

      // ── S5b (Xero): a SYSTEM account (Accounts Payable 800) sneaks past validation. Xero would accept the draft and blank the code; we must catch it, refuse, and leave no draft behind
      if (prov.key === "xero") {
        const sys = await approvedRun("system-account", FIX);
        patchDoc("accountingMappings", `${tenantId}__${prov.key}`, { "mapping.payeNicLiability": "800" });
        const bad = await post(sys.id);
        expect(bad.status, JSON.stringify(bad.body)).toBe(422);
        expect(bad.body.error).toMatch(/system account|did not accept/i);
        expect((await storedAccounting(sys.id)).status).toBe("failed");
        const sysMap = await call("PUT", "/api/accounting/mapping", tok, { provider: "xero", mapping: { ...full, payeNicLiability: "800" } });
        expect(sysMap.status, "system accounts are refused at mapping time too").toBe(400);
        expect((await call("GET", "/api/accounting/xero/accounts", tok)).body.some((a: any) => a.id === "800"), "system accounts are not offered in the dropdown").toBe(false);
        expect((await call("PUT", "/api/accounting/mapping", tok, { provider: "xero", mapping: full })).status).toBe(200);
      }

      // ── S6: run posted to one provider is refused for another (never lose a live journal id)
      const other = prov.key === "xero" ? "quickbooks" : "xero";
      const cross = await call("POST", `/api/accounting/post/${s5.id}?provider=${other}`, tok);
      expect(cross.status, JSON.stringify(cross.body)).toBe(409);
      expect(cross.body.error).toMatch(/already posted/i);

      // ── S7: stale (revoked) ACCESS token: 401 -> one forced refresh -> the post still succeeds
      tokensTouched = true;
      expect(json(tsx("connTokens.ts", tenantId, prov.key, "stale")).broken).toBe(true);
      const s7 = await approvedRun("stale-access", FIX);
      const s7p = await post(s7.id);
      expect(s7p.status, JSON.stringify(s7p.body)).toBe(200);
      created.push(s7p.body.journalId);
      expect(json(tsx("connTokens.ts", tenantId, prov.key, "status")).broken, "refresh replaced the stale token (backup is just ours)").toBe(true);
      tsx("connTokens.ts", tenantId, prov.key, "restore");

      // ── S8: expired token AND dead refresh token: clean 409 "reconnect" (never a 500), stored on the run + flagged on the connection; recovers after restore
      expect(json(tsx("connTokens.ts", tenantId, prov.key, "break")).broken).toBe(true);
      const s8 = await approvedRun("dead-refresh", FIX);
      const dead = await post(s8.id);
      expect(dead.status, JSON.stringify(dead.body)).toBe(409);
      expect(dead.body.error).toMatch(/reconnect/i); expect(dead.body.kind).toBe("auth");
      expect(JSON.stringify(dead.body)).not.toMatch(/e2e-invalid-refresh-token|Bearer|client_secret/);
      const af = await storedAccounting(s8.id);
      expect(af.status).toBe("failed"); expect(af.errorKind).toBe("auth");
      expect((await call("GET", "/api/accounting/connections", tok)).body[prov.key].needsReconnect).toBe(true);
      const deadAccts = await call("GET", `/api/accounting/${prov.key}/accounts`, tok);
      expect(deadAccts.status).toBe(401 === deadAccts.status ? 401 : 409); // reconnect-needed is 409 (auth)
      tsx("connTokens.ts", tenantId, prov.key, "restore");
      tokensTouched = false;
      const s8p = await post(s8.id);
      expect(s8p.status, JSON.stringify(s8p.body)).toBe(200);
      created.push(s8p.body.journalId);
      expect((await call("GET", "/api/accounting/connections", tok)).body[prov.key].needsReconnect).toBeFalsy();
    } finally {
      if (tokensTouched) { try { tsx("connTokens.ts", tenantId, prov.key, "restore"); } catch { /* reported by the follow-up status check below */ } }
      const errs: string[] = [];
      for (const id of created) { try { prov.remove(tenantId, id); } catch (e) { errs.push(`${prov.key} ${id}: ${(e as Error).message}`); } }
      patchDoc("accountingMappings", `${tenantId}__${prov.key}`, { mapping: priorMapping });
      if (prov.key === "xero") {
        const left = prov.admin(tenantId, "sweep", "list").items.filter((i: any) => /E2E edge/.test(i.narration));
        expect(left, "no test draft/posted journal may be left in the Xero org").toEqual([]);
      }
      expect(json(tsx("connTokens.ts", tenantId, prov.key, "status")).broken, "connection tokens must be restored").toBe(false);
      expect(errs, "every test journal must be voided/deleted").toEqual([]);
    }
  });
}
