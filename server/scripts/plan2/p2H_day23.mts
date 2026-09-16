// Plan-2 Day 23 — round 4 of the "keep hunting" mandate. A small, targeted
// set: confirming tasks.ts's PUT (true partial merge) does NOT share the
// customers.ts lost-update pattern found on day 22 (a useful contrast), plus
// one more orphaned-reference integrity check. No browser.
//
//   cd server && npx tsx scripts/plan2/p2H_day23.mts
import fs from "node:fs";
import { api, db, mkTenant, mkParent, cleanup, start, stop, ymd, daysFromNow, type Actor } from "./p2H_harness.mts";

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
  const A = await mkTenant("freelancer", "P2H23 Freelancer A");
  const P = await mkParent("P2H23 Parent");

  async function venueListingAndBlock(actor: Actor, title: string, startOffset: number) {
    const l = await api(actor, "POST", "/api/listings", { title, passes: [{ name: "Day", price: 20 }], venueId: "v1" });
    if (l.status !== 201) throw new Error(`listing ${l.status} ${err(l)}`);
    await db.collection("listings").doc(l.json.id).set({ status: "live" }, { merge: true });
    const b = await api(actor, "POST", "/api/blocks", { listingId: l.json.id, name: `${title} block`, startDate: ymd(daysFromNow(startOffset)), endDate: ymd(daysFromNow(startOffset + 6)), capacity: 20, schedule: { startTime: "09:00", endTime: "15:30", weekdays: [0, 1, 2, 3, 4, 5, 6] } });
    if (b.status !== 201) throw new Error(`block ${b.status} ${err(b)}`);
    return { listingId: l.json.id as string, blockId: b.json.id as string, days: [0, 1, 2, 3, 4].map((n) => ymd(daysFromNow(startOffset + n))) };
  }

  await step("p2-d23-race1", async () => {
    // Contrast with p2-d22-race1 (customers.ts lost update): tasks.ts PUT uses a genuine PARTIAL schema + .set(merge:true),
    // so two concurrent edits to DIFFERENT fields should both survive, unlike customers.ts's full-object-required PUT.
    const task = await api(A.owner, "POST", "/api/tasks", { t: "Race1 Task", who: "" });
    if (task.status !== 201) throw new Error(`task create ${task.status} ${err(task)}`);
    const [r1, r2] = await Promise.all([
      api(A.owner, "PUT", `/api/tasks/${task.json.id}`, { t: "Race1 Task RENAMED" }),
      api(A.owner, "PUT", `/api/tasks/${task.json.id}`, { who: "Someone Else" }),
    ]);
    const final = await db.collection("tasks").doc(task.json.id).get();
    const titleKept = final.get("t") === "Race1 Task RENAMED";
    const whoKept = final.get("who") === "Someone Else";
    const ok = titleKept && whoKept;
    results["p2-d23-race1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `two concurrent PUT /api/tasks/<id> — one sends only {t:...}, the other only {who:...} (a true partial payload, not the full object) → r1=${r1.status}, r2=${r2.status}; final t="${final.get("t")}" (renamed: ${titleKept}), who="${final.get("who")}" (updated: ${whoKept})`, notes: ok ? "Confirms the contrast with p2-d22-race1: tasks.ts's partialSchema + .set(merge:true) genuinely merges field-by-field, so two concurrent edits to different fields both survive — customers.ts's full-object PUT is the outlier, not the norm, across the codebase." : "Unexpected — tasks.ts also lost an update under concurrency." };
  });

  await step("p2-d23-integ1", async () => {
    // A discount-code redemption record survives the discount code doc itself being deleted directly.
    const disc = await api(A.owner, "POST", "/api/discounts", { code: "P2H23INTEG1", type: "amount", value: 5, active: true });
    if (disc.status !== 201) throw new Error(`discount ${disc.status} ${err(disc)}`);
    const l = await venueListingAndBlock(A.owner, "P2H23 INTEG1 Camp", 700);
    const c = await api(P, "POST", "/api/my/children", { name: "INTEG1 Kid", dob: "2018-01-01" });
    const bk = await api(P, "POST", "/api/my/bookings", { listingId: l.listingId, blockId: l.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "INTEG1 Kid", childId: c.json.id, age: 8, dates: [l.days[0]] }], discountCode: "P2H23INTEG1" });
    if (bk.status !== 201) throw new Error(`booking ${bk.status} ${err(bk)}`);
    await db.collection("discountCodes").doc(disc.json.id).delete();
    const validate = await api(P, "POST", "/api/discounts/validate", { tenantId: A.tenantId, code: "P2H23INTEG1", subtotal: 20 });
    const list = await api(A.owner, "GET", "/api/bookings");
    const ok = validate.status === 200 && validate.json?.valid === false && list.status === 200;
    results["p2-d23-integ1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `code used on a real booking, then the discountCodes doc itself deleted directly; POST /api/discounts/validate for the now-gone code → ${validate.status} valid=${validate.json?.valid}; GET /api/bookings (the booking that used the deleted code) → ${list.status} (expect: validate cleanly says invalid/not-recognised, no 500; the booking list still reads fine despite referencing a deleted discount code)` };
  });
} finally {
  fs.writeFileSync("/tmp/p2h_day23.json", JSON.stringify({ results }, null, 2));
  origLog("cleanup", await cleanup());
  stop();
}
process.exit(0);
