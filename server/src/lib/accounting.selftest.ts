// Run: server/node_modules/.bin/tsx server/src/lib/accounting.selftest.ts
// Pure tests for the payroll -> accounting journal builders (rounding/balance, negatives, zero legs, refs, retry/classification). No network, no Firestore.
import { computeTotals, journalLegs, requiredBuckets, qboJournalBody, xeroJournalBody, sageJournalBody, journalRefs, validatePayLines, pfetch, ProviderError, classifyStatus, __setSleepForTests, type AccountMapping } from "./accounting";

let n = 0, bad = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { bad++; console.error("FAIL:", m); } };
const M: AccountMapping = { grossWages: "G", employerNi: "EN", employerPension: "EP", payeNicLiability: "PN", pensionPayable: "PP", netWagesBank: "NB", otherDeductions: "OD" };
const p = (x: number) => Math.round(x * 100);
type L = Record<string, number>;
// A realistic line: net = gross - paye - eeNi - eePen - ded (all r2'd)
const mk = (gross: number, paye: number, eeNi: number, erNi: number, eePen: number, erPen: number, ded = 0): L => ({ grossM: gross, payeM: paye, eeNiM: eeNi, erNiM: erNi, eePenM: eePen, erPenM: erPen, netM: Math.round((gross - paye - eeNi - eePen - ded) * 100) / 100 });

const balanced = (lines: L[], label: string) => {
  const t = computeTotals(lines);
  const legs = journalLegs(t);
  ok(legs.reduce((a, l) => a + l.pence, 0) === 0, `${label}: legs net to zero`);
  const q = qboJournalBody(M, t, { paidOn: "2026-09-30", docNumber: "X" });
  const dr = q.Line.filter((l) => l.JournalEntryLineDetail.PostingType === "Debit").reduce((a, l) => a + p(l.Amount), 0);
  const cr = q.Line.filter((l) => l.JournalEntryLineDetail.PostingType === "Credit").reduce((a, l) => a + p(l.Amount), 0);
  ok(dr === cr, `${label}: QBO debits ${dr} == credits ${cr}`);
  ok(q.Line.every((l) => l.Amount > 0), `${label}: QBO amounts all > 0`);
  const x = xeroJournalBody(M, t, { paidOn: "2026-09-30", narration: "n" }).ManualJournals[0].JournalLines.reduce((a, l) => a + p(l.LineAmount), 0);
  ok(x === 0, `${label}: Xero nets to 0 (${x})`);
  const s = sageJournalBody(M, t, { paidOn: "2026-09-30", reference: "r", details: "d" }).journal.journal_lines;
  ok(s.reduce((a, l) => a + p(l.debit), 0) === s.reduce((a, l) => a + p(l.credit), 0), `${label}: Sage debits == credits`);
  ok(s.every((l) => !(l.debit === 0 && l.credit === 0)), `${label}: Sage has no zero/zero line`);
  return t;
};

// 1. the e2e fixture (matches the live specs)
{
  const t = balanced([mk(600, 60, 48, 78, 18, 24), mk(400, 40, 32, 52, 12, 16)], "fixture");
  ok(t.totalGross === 1000 && t.payeNicLiability === 310 && t.pensionPayable === 70 && t.totalNet === 790 && t.otherDeductions === 0, "fixture totals");
}
// 2. after-tax deductions (advance recovery): the OLD 6-line journal was out by exactly dedM
{
  const t = balanced([mk(1000, 100, 80, 130, 30, 40, 50)], "deductions");
  ok(t.otherDeductions === 50, "deductions surface as otherDeductions 50");
  ok(requiredBuckets(t).includes("otherDeductions"), "otherDeductions becomes required when non-zero");
  ok(!requiredBuckets(computeTotals([mk(1000, 100, 80, 130, 30, 40)])).includes("otherDeductions"), "not required when zero");
}
// 3. odd pence + 200 staff + float noise: 0.1+0.2 style values
{
  const lines: L[] = [];
  for (let i = 0; i < 200; i++) {
    const gross = Math.round((1234.57 + i * 13.37) * 100) / 100;
    lines.push(mk(gross, Math.round(gross * 0.1837 * 100) / 100, Math.round(gross * 0.0791 * 100) / 100, Math.round(gross * 0.1379 * 100) / 100, Math.round(gross * 0.0499 * 100) / 100, Math.round(gross * 0.0301 * 100) / 100, i % 7 === 0 ? 12.34 : 0));
  }
  balanced(lines, "200 staff");
  const sumP = lines.reduce((a, l) => a + p(l.grossM), 0);
  ok(p(computeTotals(lines).totalGross) === sumP, "200 staff gross equals exact pence sum");
}
// 4. classic float traps
{
  const t = balanced([mk(0.1, 0.02, 0.01, 0.01, 0, 0), mk(0.2, 0.03, 0.02, 0.02, 0, 0), mk(1.005 * 1 + 0.001, 0, 0, 0, 0, 0)], "float traps");
  ok(t.totalGross === 1.31 || t.totalGross === 1.3 || t.totalGross === 1.32, "float trap gross sane " + t.totalGross);
}
// 5. correction/reversal run: negative gross flips sides, still balanced, all amounts positive for QBO
{
  const t = balanced([mk(-500, -50, -40, -65, -15, -20)], "reversal");
  ok(t.totalGross === -500, "reversal gross negative");
  const q = qboJournalBody(M, t, { paidOn: "2026-09-30", docNumber: "X" });
  ok(q.Line.find((l) => l.Description === "Gross wages")!.JournalEntryLineDetail.PostingType === "Credit", "reversal: gross wages credited");
  ok(q.Line.find((l) => l.Description === "Net wages")!.JournalEntryLineDetail.PostingType === "Debit", "reversal: net wages debited");
}
// 6. zero lines dropped (freelancer with no pension / no NI)
{
  const t = balanced([mk(500, 0, 0, 0, 0, 0)], "zero legs");
  const legs = journalLegs(t);
  ok(legs.length === 3 - 1 + 0 || legs.length === 2, "only gross + net legs remain (" + legs.length + ")");
  ok(journalLegs(computeTotals([mk(0, 0, 0, 0, 0, 0)])).length === 0, "all-zero run has no legs");
}
// 7. huge but valid amounts
{
  balanced([mk(9_999_999.99, 3_000_000.01, 200_000.5, 1_380_000.33, 499_999.99, 300_000.07)], "huge");
}
// 8. mixed sign/adjustment: bonus clawback where net > gross - deductions (negative otherDeductions) still balances
{
  const l: L = { grossM: 100, payeM: 10, eeNiM: 5, erNiM: 6, eePenM: 2, erPenM: 3, netM: 90 }; // net larger than gross-deductions => other = -7
  const t = balanced([l], "negative other");
  ok(t.otherDeductions === -7, "negative otherDeductions = -7");
}
// 9. validation
ok(validatePayLines([{ grossM: 10 }]) === null, "valid ok");
ok(!!validatePayLines([{ grossM: NaN }]), "NaN rejected");
ok(!!validatePayLines([{ grossM: 1e12 }]), "1e12 rejected");
ok(!!validatePayLines([{ grossM: "5" as unknown as number }]), "string rejected");
// 10. refs
{
  const r = journalRefs("2026-09-30", "abcdef0123456789");
  ok(r.qboDocNumber === "AOS-PAY-2609-abcdef" && r.qboDocNumber.length <= 21, "docNumber " + r.qboDocNumber);
  ok(r.sageReference.length <= 30, "sage ref len");
  ok(journalRefs("2026-09-30", "aaaaaaaa").qboDocNumber !== journalRefs("2026-09-30", "bbbbbbbb").qboDocNumber, "two runs, same month => different DocNumber");
  let threw = false; try { journalRefs("", "x"); } catch { threw = true; }
  ok(threw, "missing paidOn refused");
}
// 11. classification + retries (fetch stubbed)
(async () => {
  ok(classifyStatus(401) === "auth" && classifyStatus(429) === "rate" && classifyStatus(503) === "outage" && classifyStatus(400) === "validation", "classifyStatus");
  __setSleepForTests(async () => {});
  const realFetch = globalThis.fetch;
  const seq = (...codes: Array<number | "throw">) => {
    let i = 0; const calls: number[] = [];
    globalThis.fetch = (async () => { const c = codes[Math.min(i++, codes.length - 1)]; calls.push(i); if (c === "throw") { const e = new Error("t"); e.name = "TimeoutError"; throw e; } return new Response("{}", { status: c, headers: c === 429 ? { "Retry-After": "1" } : {} }); }) as typeof fetch;
    return calls;
  };
  try {
    let calls = seq(429, 429, 200);
    ok((await pfetch("http://x", {}, "safe", "T")).status === 200 && calls.length === 3, "429 retried up to success");
    calls = seq(503, 200);
    ok((await pfetch("http://x", {}, "idempotent", "T")).status === 200 && calls.length === 2, "503 retried when idempotent");
    calls = seq(503, 200);
    ok((await pfetch("http://x", {}, "safe", "T")).status === 503 && calls.length === 1, "503 NOT retried when not idempotent");
    calls = seq("throw", "throw", "throw");
    let err: unknown; try { await pfetch("http://x", {}, "idempotent", "Xero"); } catch (e) { err = e; }
    ok(err instanceof ProviderError && err.kind === "network" && err.status === 504 && calls.length === 3, "timeouts exhaust into ProviderError network/504 after 3 tries");
    calls = seq("throw");
    err = undefined; try { await pfetch("http://x", {}, "safe", "Token"); } catch (e) { err = e; }
    ok(err instanceof ProviderError && calls.length === 1, "timeout on a token POST is never replayed");
    calls = seq(429, 429, 429);
    ok((await pfetch("http://x", {}, "safe", "T")).status === 429 && calls.length === 3, "persistent 429 gives up after 3");
  } finally { globalThis.fetch = realFetch; }
  console.log(`accounting selftest: ${n - bad}/${n} passed`);
  process.exit(bad ? 1 : 0);
})();
