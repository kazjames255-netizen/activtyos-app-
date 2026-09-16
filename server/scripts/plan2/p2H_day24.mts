// Plan-2 Day 24 — round 5 of the "keep hunting" mandate: one final targeted
// race check on expense claims. PATCH /:id (approve) does a plain
// read-then-write guarded only by `!c.expenseId` (no transaction), the same
// TOCTOU shape as day 21's discount-code CREATE race and day 22's customer
// lost update — checking whether it also produces a duplicate "money out"
// expense row under concurrency. No browser.
//
//   cd server && npx tsx scripts/plan2/p2H_day24.mts
import fs from "node:fs";
import { api, db, mkTenant, mkStaff, cleanup, start, stop, ymd } from "./p2H_harness.mts";

type V = { verdict: "pass" | "fail" | "blocked"; actual: string; notes?: string; method?: string };
const results: Record<string, V> = {};
const origLog = console.log;
const step = async (id: string, fn: () => Promise<void>) => {
  try { await fn(); } catch (e) { results[id] = { verdict: "blocked", actual: `script error: ${(e as Error).message}` }; origLog(`  !! ${id} threw`, e); }
  origLog(`[${id}] ${results[id]?.verdict} — ${results[id]?.actual}`);
};
const err = (r: { json: any }) => JSON.stringify(r.json?.error ?? r.json ?? "").slice(0, 200);

await start();

try {
  const A = await mkTenant("freelancer", "P2H24 Freelancer A");
  const S1 = await mkStaff(A.tenantId, { franchiseId: null, name: "D24 Staff" });

  await step("p2-d24-race1", async () => {
    // Two concurrent PATCH {status:'approved'} on the SAME expense claim — the "one expense row, once" guard
    // (!c.expenseId) is a plain read-then-write, not a transaction.
    const claim = await api(S1, "POST", "/api/expense-claims", { date: ymd(new Date()), category: "Travel & mileage", amount: 42.5, note: "D24 race test" });
    if (claim.status !== 201) throw new Error(`claim create ${claim.status} ${err(claim)}`);
    const [r1, r2] = await Promise.all([
      api(A.owner, "PATCH", `/api/expense-claims/${claim.json.id}`, { status: "approved" }),
      api(A.owner, "PATCH", `/api/expense-claims/${claim.json.id}`, { status: "approved" }),
    ]);
    const expSnap = await db.collection("expenses").where("tenantId", "==", A.tenantId).where("claimId", "==", claim.json.id).get();
    const ok = expSnap.size <= 1;
    results["p2-d24-race1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `same expense claim, two concurrent PATCH {status:'approved'} calls → r1=${r1.status}, r2=${r2.status}; expenses docs created with claimId=<this claim>=${expSnap.size} (expect <=1 — 'one expense row, once' should hold even under real concurrency)`, notes: expSnap.size > 1 ? "CONFIRMED RACE: expenseClaims.ts PATCH /:id reads c.expenseId then later writes it, with no transaction wrapping the check-then-act — two near-simultaneous approvals both read expenseId as unset and both create their own 'money out' expense row for the same claim, double-counting the spend in Money out / payroll." : "The guard held under concurrency in this run — no duplicate expense row." };
  });
} finally {
  fs.writeFileSync("/tmp/p2h_day24.json", JSON.stringify({ results }, null, 2));
  origLog("cleanup", await cleanup());
  stop();
}
process.exit(0);
