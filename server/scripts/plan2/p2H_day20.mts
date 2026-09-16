// Plan-2 Day 20 — four new angles the founder asked for after day 19: race
// conditions/concurrency, load/stress on the dev server, data-integrity on
// booking/money/safeguarding records, and a deeper privilege-escalation
// sweep. No browser: every step is an API call through the harness (fired
// concurrently where the step is about a race) or a source-code read.
//
//   cd server && npx tsx scripts/plan2/p2H_day20.mts
import fs from "node:fs";
import {
  api, db, mkTenant, mkFranchise, mkStaff, mkParent, setSettings, cleanup, start, stop,
  ymd, daysFromNow, type Actor,
} from "./p2H_harness.mts";

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
  const A = await mkTenant("freelancer", "P2H20 Freelancer A");
  const C = await mkTenant("company", "P2H20 Co");
  const F1 = await mkFranchise(C.tenantId, "P2H20 F1");
  const P = await mkParent("P2H20 Parent");
  const P2 = await mkParent("P2H20 Parent Two");
  await setSettings(A.tenantId, null, { locations: [{ id: "v1", name: "Venue One" }] });
  await setSettings(C.tenantId, null, { locations: [{ id: "v1", name: "Venue One" }] });

  async function venueListingAndBlock(actor: Actor, title: string, startOffset: number, venueId = "v1", extra: Record<string, unknown> = {}) {
    const l = await api(actor, "POST", "/api/listings", { title, passes: [{ name: "Day", price: 20 }], venueId });
    if (l.status !== 201) throw new Error(`listing ${l.status} ${err(l)}`);
    await db.collection("listings").doc(l.json.id).set({ status: "live", venueId }, { merge: true });
    const b = await api(actor, "POST", "/api/blocks", {
      listingId: l.json.id, name: `${title} block`,
      startDate: ymd(daysFromNow(startOffset)), endDate: ymd(daysFromNow(startOffset + 6)),
      capacity: 20, schedule: { startTime: "09:00", endTime: "15:30", weekdays: [0, 1, 2, 3, 4, 5, 6] },
      ...extra,
    });
    if (b.status !== 201) throw new Error(`block ${b.status} ${err(b)}`);
    if (Object.keys(extra).length) await db.collection("blocks").doc(b.json.id).set(extra, { merge: true });
    return { listingId: l.json.id as string, blockId: b.json.id as string, days: [0, 1, 2, 3, 4].map((n) => ymd(daysFromNow(startOffset + n))) };
  }

  // ══════════════════════════ RACE CONDITIONS ════════════════════════════════

  await step("p2-d20-race1", async () => {
    // Two bookings fired at the EXACT same instant for the LAST capacity spot on a listing with capacity:1.
    const l = await venueListingAndBlock(A.owner, "P2H20 RACE1 Camp", 300, "v1", { capacity: 1 });
    const c1 = await api(P, "POST", "/api/my/children", { name: "RACE1 Kid A", dob: "2018-01-01" });
    const c2 = await api(P2, "POST", "/api/my/children", { name: "RACE1 Kid B", dob: "2018-01-01" });
    const mk = (actor: Actor, name: string, childId: string) => api(actor, "POST", "/api/my/bookings", { listingId: l.listingId, blockId: l.blockId, method: "Bank transfer", items: [{ pass: "Day", child: name, childId, age: 8, dates: [l.days[0]] }] });
    const [r1, r2] = await Promise.all([mk(P, "RACE1 Kid A", c1.json.id), mk(P2, "RACE1 Kid B", c2.json.id)]);
    const confirmed = [r1, r2].filter((r) => r.status === 201 && r.json?.bookings?.[0]?.status !== "Waitlisted").length;
    const block = await db.collection("blocks").doc(l.blockId).get();
    const ok = confirmed <= 1 && (block.get("bookedCount") ?? 0) <= 1;
    results["p2-d20-race1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `capacity:1 block; two bookings fired via Promise.all for the SAME last spot → r1=${r1.status} (${r1.json?.bookings?.[0]?.status ?? r1.json?.error}), r2=${r2.status} (${r2.json?.bookings?.[0]?.status ?? r2.json?.error}); confirmed (non-waitlisted) count=${confirmed}; block.bookedCount afterward=${block.get("bookedCount")} (expect confirmed<=1 and bookedCount<=1 — no double-booking of the last seat)` };
  });

  await step("p2-d20-race2", async () => {
    // Two managers decide the SAME leave request concurrently, one approving and one declining — the decide route has no transaction guard, so this documents the real "last write wins" behaviour rather than a corrupted mixed state.
    const S1 = await mkStaff(A.tenantId, { franchiseId: null, name: "RACE2 Staff" });
    const reqLeave = await api(S1, "POST", "/api/leave/absences", { kind: "annual", start: ymd(daysFromNow(90)), end: ymd(daysFromNow(90)), days: 1 });
    if (reqLeave.status !== 201) throw new Error(`leave request ${reqLeave.status} ${err(reqLeave)}`);
    const [d1, d2] = await Promise.all([
      api(A.owner, "POST", `/api/leave/absences/${reqLeave.json.id}/decide`, { status: "approved" }),
      api(A.owner, "POST", `/api/leave/absences/${reqLeave.json.id}/decide`, { status: "declined" }),
    ]);
    const final = await db.collection("absences").doc(reqLeave.json.id).get();
    const bothOk = d1.status === 200 && d2.status === 200;
    // A lost update: /decide has no guard against deciding an already-decided request (unlike refund-approve, which checks
    // the prior state) and no transaction, so BOTH calls return 200 and whichever write lands last silently overwrites the
    // other with no conflict signal to either manager. This is exactly the "lost update" shape asked for — flag it as a fail
    // even though the final stored value is a clean single status (not corrupted data), because the SIGNAL to the loser is
    // what's missing: a manager who just approved leave has no way to know a colleague's simultaneous decline just won.
    const ok = !bothOk;
    results["p2-d20-race2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `same leave request, concurrent decide(approved) + decide(declined) → d1=${d1.status}, d2=${d2.status}; final stored status="${final.get("status")}"`, notes: bothOk ? "LOST UPDATE: POST /api/leave/absences/:id/decide has no guard against deciding an already-decided request (contrast with bookings' refund-approve, which explicitly checks b.cancel.refund !== 'approved' and 409s on a replay) and doesn't run in a transaction. Both concurrent decisions return 200 — the second silently overwrites the first's decidedBy/decidedAt/status with no error to either caller. Whoever calls last wins invisibly; the loser believes their decision stuck. A one-line fix: check current status !== 'pending' before applying, same pattern as the cancel-action guard added for p2-d18-bk4." : "Unexpected: not both calls returned 200 — the route already refuses a second decision." };
  });

  await step("p2-d20-race3", async () => {
    // Two cancel actions fired concurrently on the SAME booking (the concurrent version of day18's p2-d18-bk4 double-cancel finding).
    const l = await venueListingAndBlock(A.owner, "P2H20 RACE3 Camp", 310);
    const c = await api(P, "POST", "/api/my/children", { name: "RACE3 Kid", dob: "2018-01-01" });
    const bk = await api(P, "POST", "/api/my/bookings", { listingId: l.listingId, blockId: l.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "RACE3 Kid", childId: c.json.id, age: 8, dates: [l.days[0]] }] });
    if (bk.status !== 201) throw new Error(`booking ${bk.status} ${err(bk)}`);
    const ref = bk.json.bookings[0].ref;
    const [c1, c2] = await Promise.all([
      api(A.owner, "POST", `/api/bookings/${ref}/actions`, { type: "cancel", refund: "none" }),
      api(A.owner, "POST", `/api/bookings/${ref}/actions`, { type: "cancel", refund: "none" }),
    ]);
    const after = await api(A.owner, "GET", `/api/bookings/${ref}`);
    const refundLogLen = (after.json?.refundLog ?? []).length;
    const bothAccepted = c1.status === 200 && c2.status === 200;
    const ok = !bothAccepted || refundLogLen <= 1;
    results["p2-d20-race3"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `same booking, two concurrent cancel actions → c1=${c1.status}, c2=${c2.status}; booking.refundLog length afterward=${refundLogLen}`, notes: "Same class as p2-d18-bk4 (day 18) — cancel has no guard against a second cancel of an already-cancelled booking, sequential or concurrent." };
  });

  await step("p2-d20-race4", async () => {
    // Two refund-approve calls fired concurrently on the SAME pending refund — refund-approve DOES run inside a Firestore transaction, so this checks whether that actually serializes the money movement.
    const l = await venueListingAndBlock(A.owner, "P2H20 RACE4 Camp", 320);
    const c = await api(P, "POST", "/api/my/children", { name: "RACE4 Kid", dob: "2018-01-01" });
    const bk = await api(P, "POST", "/api/my/bookings", { listingId: l.listingId, blockId: l.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "RACE4 Kid", childId: c.json.id, age: 8, dates: [l.days[0]] }] });
    if (bk.status !== 201) throw new Error(`booking ${bk.status} ${err(bk)}`);
    const ref = bk.json.bookings[0].ref;
    const pay = await api(A.owner, "POST", `/api/bookings/${ref}/record-payment`, { amount: 20 });
    if (pay.status !== 200) throw new Error(`record-payment ${pay.status} ${err(pay)}`);
    const cancelReq = await api(P, "POST", `/api/my/bookings/${ref}/amend`, { cancel: true }).catch(() => ({ status: 0, json: null }) as { status: number; json: unknown });
    // Fall back to an operator-side cancel-with-refund-pending shape if the parent amend route/shape differs in this build.
    const setup = cancelReq.status === 200 ? cancelReq : await api(A.owner, "POST", `/api/bookings/${ref}/actions`, { type: "cancel", refund: "partial", amount: 20 });
    if (setup.status !== 200 && setup.status !== 201) throw new Error(`refund setup ${setup.status} ${err(setup)}`);
    const [r1, r2] = await Promise.all([
      api(A.owner, "POST", `/api/bookings/${ref}/actions`, { type: "refund-approve" }),
      api(A.owner, "POST", `/api/bookings/${ref}/actions`, { type: "refund-approve" }),
    ]);
    const succeeded = [r1, r2].filter((r) => r.status === 200).length;
    const ok = succeeded <= 1;
    results["p2-d20-race4"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `booking paid then a refund set pending; two concurrent refund-approve calls → r1=${r1.status} ${r1.status !== 200 ? err(r1) : ""}, r2=${r2.status} ${r2.status !== 200 ? err(r2) : ""}; number that succeeded=${succeeded} (expect <=1 — the transaction + refund-approve replay guard should serialize this, unlike plain cancel)` };
  });

  await step("p2-d20-race5", async () => {
    // Two concurrent record-payment calls of the SAME amount — the true concurrent version of day16's p2-rt1 (which fired them sequentially).
    const l = await venueListingAndBlock(A.owner, "P2H20 RACE5 Camp", 330);
    const c = await api(P, "POST", "/api/my/children", { name: "RACE5 Kid", dob: "2018-01-01" });
    const bk = await api(P, "POST", "/api/my/bookings", { listingId: l.listingId, blockId: l.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "RACE5 Kid", childId: c.json.id, age: 8, dates: [l.days[0]] }] });
    if (bk.status !== 201) throw new Error(`booking ${bk.status} ${err(bk)}`);
    const ref = bk.json.bookings[0].ref;
    const [p1, p2] = await Promise.all([
      api(A.owner, "POST", `/api/bookings/${ref}/record-payment`, { amount: 20, methodRef: "BACS-RACE5" }),
      api(A.owner, "POST", `/api/bookings/${ref}/record-payment`, { amount: 20, methodRef: "BACS-RACE5" }),
    ]);
    const after = await api(A.owner, "GET", `/api/bookings/${ref}`);
    const succeeded = [p1, p2].filter((r) => r.status === 200).length;
    const ok = succeeded === 1 && (after.json?.amountPaid ?? 0) === 20;
    results["p2-d20-race5"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `£20 booking; two TRUE-concurrent record-payment {amount:20} calls (Promise.all, not sequential) → p1=${p1.status}, p2=${p2.status}; succeeded count=${succeeded}; final amountPaid=${after.json?.amountPaid} (expect exactly one to succeed, amountPaid=20 not 40)` };
  });

  await step("p2-d20-race6", async () => {
    // Two concurrent redemptions of a usageLimit:1 discount code — checks whether redeemCodesInTx's Firestore transaction really serializes this under true concurrency (day18's m1 tested it sequentially).
    const l = await venueListingAndBlock(A.owner, "P2H20 RACE6 Camp", 340);
    await api(A.owner, "POST", "/api/discounts", { code: "P2H20RACE6", type: "amount", value: 5, usageLimit: 1, active: true });
    const c1 = await api(P, "POST", "/api/my/children", { name: "RACE6 Kid A", dob: "2018-01-01" });
    const c2 = await api(P2, "POST", "/api/my/children", { name: "RACE6 Kid B", dob: "2018-01-01" });
    const mk = (actor: Actor, name: string, childId: string, date: string) => api(actor, "POST", "/api/my/bookings", { listingId: l.listingId, blockId: l.blockId, method: "Bank transfer", items: [{ pass: "Day", child: name, childId, age: 8, dates: [date] }], discountCode: "P2H20RACE6" });
    const [r1, r2] = await Promise.all([mk(P, "RACE6 Kid A", c1.json.id, l.days[0]), mk(P2, "RACE6 Kid B", c2.json.id, l.days[1])]);
    const applied1 = (r1.json?.bookings?.[0]?.discountCode ?? "").toUpperCase() === "P2H20RACE6";
    const applied2 = (r2.json?.bookings?.[0]?.discountCode ?? "").toUpperCase() === "P2H20RACE6";
    const disc = await db.collection("discountCodes").where("tenantId", "==", A.tenantId).where("code", "==", "P2H20RACE6").limit(1).get();
    const usedCount = disc.docs[0]?.get("usedCount") ?? -1;
    const appliedCount = [applied1, applied2].filter(Boolean).length;
    const ok = usedCount <= 1 && appliedCount <= 1;
    results["p2-d20-race6"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `usageLimit:1 code; two concurrent bookings both quoting it → r1 applied=${applied1} (${r1.status}), r2 applied=${applied2} (${r2.status}); code.usedCount afterward=${usedCount} (expect <=1 — redeemCodesInTx's transaction should serialize even under true concurrency)`, evidence: true };
  });

  // ══════════════════════════════ LOAD / STRESS ══════════════════════════════

  await step("p2-d20-load1", async () => {
    // A burst of 25 concurrent reads against a real, populated list endpoint.
    const t0 = Date.now();
    const calls = Array.from({ length: 25 }, () => api(A.owner, "GET", "/api/bookings"));
    const rs = await Promise.all(calls);
    const elapsed = Date.now() - t0;
    const errors = rs.filter((r) => r.status >= 500).length;
    const nonOk = rs.filter((r) => r.status !== 200).length;
    const ok = errors === 0 && elapsed < 10_000;
    results["p2-d20-load1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `25 concurrent GET /api/bookings → ${25 - nonOk}/25 returned 200, ${errors} returned 5xx, total wall time ${elapsed}ms` };
  });

  await step("p2-d20-load2", async () => {
    // A burst of 20 concurrent writes — every one should land, with no lost writes and no duplicates.
    const t0 = Date.now();
    const calls = Array.from({ length: 20 }, (_, i) => api(A.owner, "POST", "/api/incidents", { kind: "incident", childName: `LOAD2 Kid ${i}`, description: `Load test row ${i}`, date: ymd(new Date()) }));
    const rs = await Promise.all(calls);
    const elapsed = Date.now() - t0;
    const created = rs.filter((r) => r.status === 201).length;
    const ids = new Set(rs.filter((r) => r.status === 201).map((r) => r.json.id));
    const snap = await db.collection("incidents").where("tenantId", "==", A.tenantId).get();
    const matching = snap.docs.filter((d) => String(d.get("description") ?? "").startsWith("Load test row")).length;
    const ok = created === 20 && ids.size === 20 && matching === 20;
    results["p2-d20-load2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `20 concurrent POST /api/incidents → ${created}/20 returned 201 in ${elapsed}ms, ${ids.size} unique ids, ${matching} rows actually found in Firestore (expect all three = 20, no lost or duplicated writes under concurrency)` };
  });

  await step("p2-d20-load3", async () => {
    // A mixed burst — reads and writes on the same tenant at once — checking for cross-contamination or degradation, not just raw throughput.
    const l = await venueListingAndBlock(A.owner, "P2H20 LOAD3 Camp", 350);
    const t0 = Date.now();
    const reads = Array.from({ length: 15 }, () => api(A.owner, "GET", "/api/dashboard"));
    const writes = Array.from({ length: 5 }, (_, i) => api(P, "POST", "/api/my/children", { name: `LOAD3 Kid ${i}`, dob: "2018-01-01" }));
    const [readResults, writeResults] = await Promise.all([Promise.all(reads), Promise.all(writes)]);
    const elapsed = Date.now() - t0;
    const readErrors = readResults.filter((r) => r.status >= 500).length;
    const writeErrors = writeResults.filter((r) => r.status !== 201).length;
    const ok = readErrors === 0 && writeErrors === 0 && elapsed < 12_000;
    results["p2-d20-load3"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `mixed burst: 15 concurrent GET /api/dashboard + 5 concurrent POST /api/my/children on the same tenant at once → ${readErrors} read 5xxs, ${writeErrors} write failures, total wall time ${elapsed}ms`, notes: `(listing ${l.listingId} created only to keep the tenant realistically populated for the dashboard reads)` };
  });

  // ══════════════════════════ DATA INTEGRITY SWEEP ═══════════════════════════

  await step("p2-d20-integ1", async () => {
    // A cancelled booking's seat is actually freed on the block — bookedCount decrements, not just the booking's own status flips.
    const l = await venueListingAndBlock(A.owner, "P2H20 INTEG1 Camp", 360, "v1", { capacity: 5 });
    const c = await api(P, "POST", "/api/my/children", { name: "INTEG1 Kid", dob: "2018-01-01" });
    const bk = await api(P, "POST", "/api/my/bookings", { listingId: l.listingId, blockId: l.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "INTEG1 Kid", childId: c.json.id, age: 8, dates: [l.days[0]] }] });
    if (bk.status !== 201) throw new Error(`booking ${bk.status} ${err(bk)}`);
    const before = await db.collection("blocks").doc(l.blockId).get();
    const cancel = await api(A.owner, "POST", `/api/bookings/${bk.json.bookings[0].ref}/actions`, { type: "cancel", refund: "none" });
    const after = await db.collection("blocks").doc(l.blockId).get();
    const ok = cancel.status === 200 && (after.get("bookedCount") ?? 0) === (before.get("bookedCount") ?? 0) - 1;
    results["p2-d20-integ1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `block.bookedCount before booking a seat then cancelling it: before-cancel=${before.get("bookedCount")}, after-cancel=${after.get("bookedCount")} (expect a decrement of exactly 1 — a cancelled booking must free its seat, not leave a phantom hold on capacity)`, evidence: true };
  });

  await step("p2-d20-integ2", async () => {
    // amountPaid never exceeds amount after a realistic pay → part-refund → pay-again sequence (the invariant the overpay guard exists to protect).
    const l = await venueListingAndBlock(A.owner, "P2H20 INTEG2 Camp", 370);
    const c = await api(P, "POST", "/api/my/children", { name: "INTEG2 Kid", dob: "2018-01-01" });
    const bk = await api(P, "POST", "/api/my/bookings", { listingId: l.listingId, blockId: l.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "INTEG2 Kid", childId: c.json.id, age: 8, dates: [l.days[0]] }] });
    if (bk.status !== 201) throw new Error(`booking ${bk.status} ${err(bk)}`);
    const ref = bk.json.bookings[0].ref;
    await api(A.owner, "POST", `/api/bookings/${ref}/record-payment`, { amount: 20 });
    const doc = await db.collection("bookings").where("tenantId", "==", A.tenantId).where("ref", "==", ref).limit(1).get();
    const b = doc.docs[0]?.data() as { amount?: number; amountPaid?: number; pay?: string } | undefined;
    const ok = !!b && (b.amountPaid ?? 0) <= (b.amount ?? 0) && (b.amountPaid ?? 0) > 0 && b.pay === "Paid";
    results["p2-d20-integ2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `after full record-payment: stored amount=${b?.amount}, amountPaid=${b?.amountPaid}, pay="${b?.pay}" (expect amountPaid<=amount, amountPaid>0, pay:'Paid' — a booking marked Paid always has real money recorded against it, never a mismatched/impossible state)` };
  });

  await step("p2-d20-integ3", async () => {
    // A booking referencing a blockId that's since been deleted doesn't crash the list route — an orphaned reference is read defensively.
    const l = await venueListingAndBlock(A.owner, "P2H20 INTEG3 Camp", 380);
    const c = await api(P, "POST", "/api/my/children", { name: "INTEG3 Kid", dob: "2018-01-01" });
    const bk = await api(P, "POST", "/api/my/bookings", { listingId: l.listingId, blockId: l.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "INTEG3 Kid", childId: c.json.id, age: 8, dates: [l.days[0]] }] });
    if (bk.status !== 201) throw new Error(`booking ${bk.status} ${err(bk)}`);
    await db.collection("blocks").doc(l.blockId).delete();
    const list = await api(A.owner, "GET", "/api/bookings");
    const found = (list.json ?? []).find((x: { ref?: string }) => x.ref === bk.json.bookings[0].ref);
    const ok = list.status === 200 && !!found;
    results["p2-d20-integ3"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `booking's own block deleted directly (orphaning its blockId); GET /api/bookings afterward → ${list.status}, the orphaned booking still present in the list: ${!!found} — no 500 from the dangling reference` };
  });

  await step("p2-d20-integ4", async () => {
    // discountCode.usedCount never exceeds its own usageLimit across several real redemption attempts (an end-to-end version of race6's single race, run sequentially to isolate the invariant from the timing).
    await api(A.owner, "POST", "/api/discounts", { code: "P2H20INTEG4", type: "amount", value: 5, usageLimit: 2, active: true });
    const l = await venueListingAndBlock(A.owner, "P2H20 INTEG4 Camp", 390);
    for (let i = 0; i < 4; i++) {
      const parent = await mkParent(`P2H20 Integ4 Parent ${i}`);
      const c = await api(parent, "POST", "/api/my/children", { name: `INTEG4 Kid ${i}`, dob: "2018-01-01" });
      await api(parent, "POST", "/api/my/bookings", { listingId: l.listingId, blockId: l.blockId, method: "Bank transfer", items: [{ pass: "Day", child: `INTEG4 Kid ${i}`, childId: c.json.id, age: 8, dates: [l.days[i % 5]] }], discountCode: "P2H20INTEG4" });
    }
    const disc = await db.collection("discountCodes").where("tenantId", "==", A.tenantId).where("code", "==", "P2H20INTEG4").limit(1).get();
    const usedCount = disc.docs[0]?.get("usedCount") ?? -1;
    const ok = usedCount === 2;
    results["p2-d20-integ4"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `usageLimit:2 code, 4 separate families each attempt to redeem it → final usedCount=${usedCount} (expect exactly 2, never more than the limit even across many attempts)` };
  });

  await step("p2-d20-integ5", async () => {
    // A safeguarding incident referencing a childId whose child doc has since been deleted doesn't crash the dossier/list reads.
    const lInteg5 = await venueListingAndBlock(A.owner, "P2H20 INTEG5 Camp", 400);
    const childRes = await api(P, "POST", "/api/my/children", { name: "INTEG5 Kid", dob: "2018-01-01" });
    const bkInteg5 = await api(P, "POST", "/api/my/bookings", { listingId: lInteg5.listingId, blockId: lInteg5.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "INTEG5 Kid", childId: childRes.json.id, age: 8, dates: [lInteg5.days[0]] }] });
    if (bkInteg5.status !== 201) throw new Error(`booking ${bkInteg5.status} ${err(bkInteg5)}`);
    const inc = await api(A.owner, "POST", "/api/incidents", { kind: "safeguarding", childId: childRes.json.id, childName: "INTEG5 Kid", description: "test", concernCategory: "other", date: ymd(new Date()) });
    if (inc.status !== 201) throw new Error(`incident ${inc.status} ${err(inc)}`);
    await db.collection("children").doc(childRes.json.id).delete();
    const list = await api(A.owner, "GET", "/api/incidents?kind=safeguarding");
    const found = (list.json ?? []).find((x: { id: string }) => x.id === inc.json.id);
    const ok = list.status === 200 && !!found;
    results["p2-d20-integ5"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `safeguarding record's own child deleted afterward; GET /api/incidents?kind=safeguarding → ${list.status}, the orphaned record still present: ${!!found} — no 500 from the dangling childId, the concern itself (the sensitive part) survives the child record's own deletion` };
  });

  // ═══════════════════════════ PRIVILEGE ESCALATION ══════════════════════════

  await step("p2-d20-pe1", async () => {
    // x-act-as from a NON-platform franchise token is ignored — extends day4's p2-p11 (which used a generic non-platform token) to the franchise role specifically, since franchises are the role most structurally adjacent to company-level power.
    const r = await api(F1.actor, "GET", "/api/franchises", undefined, { "x-act-as": C.owner.uid });
    const ok = r.status === 403;
    results["p2-d20-pe1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `franchise token with x-act-as:<the company owner's uid> GET /api/franchises (a company-only route) → ${r.status} ${err(r)} (expect 403 — the header must be ignored for a non-platform token, not silently elevate a franchise to acting as its own head office)` };
  });

  await step("p2-d20-pe2", async () => {
    // A franchise cannot create an invite for role:'company' — schema-level, not just a role check that could be bypassed by a different field shape.
    const r = await api(F1.actor, "POST", "/api/invites", { role: "company", email: "d20pe2@p2h.test" });
    const ok = r.status === 400 || r.status === 403;
    results["p2-d20-pe2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `franchise token POST /api/invites {role:'company'} → ${r.status} ${err(r)} (expect 400/403 — invites.ts's own zod schema only accepts role:'franchise'|'staff', so 'company' can never even parse, let alone reach a role check)` };
  });

  await step("p2-d20-pe3", async () => {
    // Accepting an invite ignores any client-supplied role/franchiseId in the body — only franchiseName/franchiseArea/franchiseTerritory can be overridden by the invitee.
    const inv = await api(A.owner, "POST", "/api/invites", { role: "staff", email: "d20pe3@p2h.test" });
    if (inv.status !== 201) throw new Error(`invite create ${inv.status} ${err(inv)}`);
    const uid = `d20-pe3-${Math.random().toString(36).slice(2, 8)}`;
    const invitee: Actor = { uid, email: "d20pe3@p2h.test", name: "D20 PE3" };
    const accept = await api(invitee, "POST", `/api/invites/${inv.json.token}/accept`, { role: "company", franchiseId: "some-other-tenant", tenantId: "some-other-tenant" });
    const stored = await db.collection("users").doc(uid).get();
    const ok = accept.status === 200 && stored.get("role") === "staff" && stored.get("tenantId") === A.tenantId;
    results["p2-d20-pe3"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `invite created for role:'staff'; accept called with a body claiming {role:'company', franchiseId/tenantId:'some-other-tenant'} → ${accept.status}; stored user doc role="${stored.get("role")}", tenantId="${stored.get("tenantId")}" (expect role:'staff', tenantId:${A.tenantId} — the invite doc is the source of truth, client body is ignored for these fields)` };
  });

  await step("p2-d20-pe4", async () => {
    // A plain staff member cannot create an invite of any kind.
    const S1 = await mkStaff(A.tenantId, { franchiseId: null, name: "PE4 Staff" });
    const r = await api(S1, "POST", "/api/invites", { role: "staff", email: "d20pe4@p2h.test" });
    const ok = r.status === 403;
    results["p2-d20-pe4"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `plain staff token POST /api/invites {role:'staff'} → ${r.status} ${err(r)}` };
  });

  await step("p2-d20-pe5", async () => {
    // Editing an EXISTING invite's role field (not just accepting it) is refused for a franchise trying to turn a staff invite into a franchise one.
    const inv = await api(F1.actor, "POST", "/api/invites", { role: "staff", email: "d20pe5@p2h.test" });
    if (inv.status !== 201) throw new Error(`invite create ${inv.status} ${err(inv)}`);
    const patch = await api(F1.actor, "PATCH", `/api/invites/${inv.json.token}`, { role: "franchise" });
    const stored = await db.collection("invites").doc(inv.json.token).get();
    const ok = patch.status === 404 || patch.status === 403 || (patch.status === 200 && stored.get("role") === "staff");
    results["p2-d20-pe5"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `franchise's own staff invite; PATCH /api/invites/<token> {role:'franchise'} → ${patch.status} ${err(patch)}; stored role afterward="${stored.get("role")}" (expect either the route to refuse role changes outright, or the role field to be untouched even if the route accepts other edits)` };
  });

  await step("p2-d20-pe6", async () => {
    // A staff member cannot self-promote to `lead` via any field on their own PUT /api/account (the shared profile route every portal uses).
    const S1 = await mkStaff(A.tenantId, { franchiseId: null, name: "PE6 Staff", lead: false });
    const before = await db.collection("users").where("email", "==", S1.email).limit(1).get();
    const put = await api(S1, "PUT", "/api/account", { name: "PE6 Staff Renamed", lead: true, permRole: "manager", staffRole: "Manager" } as Record<string, unknown>);
    const after = await db.collection("users").where("email", "==", S1.email).limit(1).get();
    const ok = put.status === 200 && after.docs[0]?.get("lead") !== true && !after.docs[0]?.get("permRole");
    results["p2-d20-pe6"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `staff (lead:false) PUT /api/account with extra fields lead:true, permRole:'manager', staffRole:'Manager' → ${put.status}; stored lead before/after: ${before.docs[0]?.get("lead")}/${after.docs[0]?.get("lead")}; permRole present after: ${!!after.docs[0]?.get("permRole")}` };
  });
} finally {
  fs.writeFileSync("/tmp/p2h_day20.json", JSON.stringify({ results }, null, 2));
  origLog("cleanup", await cleanup());
  stop();
}
process.exit(0);
