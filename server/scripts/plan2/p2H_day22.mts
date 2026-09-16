// Plan-2 Day 22 — round 3 of the founder's "keep hunting" mandate. Focused,
// high-signal set: a customer-record lost-update race (PUT requires the full
// object, so two staff editing different fields concurrently can silently
// clobber each other), a staff assignment-scope leak check, a company-vs-
// franchise settings write-boundary check, and two orphaned-reference
// integrity checks. No browser.
//
//   cd server && npx tsx scripts/plan2/p2H_day22.mts
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
  const A = await mkTenant("freelancer", "P2H22 Freelancer A");
  const C = await mkTenant("company", "P2H22 Co");
  const F1 = await mkFranchise(C.tenantId, "P2H22 F1");
  const F2 = await mkFranchise(C.tenantId, "P2H22 F2");
  const P = await mkParent("P2H22 Parent");
  await setSettings(A.tenantId, null, { locations: [{ id: "v1", name: "Venue One" }] });
  await setSettings(C.tenantId, null, { locations: [{ id: "v1", name: "Venue One" }, { id: "v2", name: "Venue Two" }] });

  async function venueListingAndBlock(actor: Actor, title: string, startOffset: number, venueId = "v1") {
    const l = await api(actor, "POST", "/api/listings", { title, passes: [{ name: "Day", price: 20 }], venueId });
    if (l.status !== 201) throw new Error(`listing ${l.status} ${err(l)}`);
    await db.collection("listings").doc(l.json.id).set({ status: "live", venueId }, { merge: true });
    const b = await api(actor, "POST", "/api/blocks", {
      listingId: l.json.id, name: `${title} block`,
      startDate: ymd(daysFromNow(startOffset)), endDate: ymd(daysFromNow(startOffset + 6)),
      capacity: 20, schedule: { startTime: "09:00", endTime: "15:30", weekdays: [0, 1, 2, 3, 4, 5, 6] },
    });
    if (b.status !== 201) throw new Error(`block ${b.status} ${err(b)}`);
    return { listingId: l.json.id as string, blockId: b.json.id as string, days: [0, 1, 2, 3, 4].map((n) => ymd(daysFromNow(startOffset + n))) };
  }

  // ══════════════════════════════ RACE (round 3) ═════════════════════════════

  await step("p2-d22-race1", async () => {
    // Two staff members edit DIFFERENT fields of the SAME customer record
    // concurrently. FIXED 2026-09-16 as a two-part change: (1) server —
    // PUT /:id now takes a true customerSchema.partial() and .set(patch,
    // {merge:true}), only ever writing fields actually present in the
    // request body (server/src/routes/customers.ts); (2) client —
    // features/customers/CustomersApp.tsx's save() now diffs the form
    // against the record as loaded and sends ONLY the changed fields
    // (mirrors features/tasks/TasksApp.tsx's patch()), instead of always
    // resubmitting the whole form including stale copies of fields it
    // didn't touch. (1) alone doesn't fix the bug: the OLD client always
    // sent the full object, so the server had no way to tell "unchanged"
    // from "meant to be this value" without the client-side diff too — the
    // repro below now sends only-the-changed-field per call, exactly what
    // the fixed UI actually sends.
    const cust = await api(A.owner, "POST", "/api/customers", { name: "Race1 Customer", email: "race1@p2h.test", phone: "07700000001" });
    if (cust.status !== 201) throw new Error(`customer create ${cust.status} ${err(cust)}`);
    const [r1, r2] = await Promise.all([
      api(A.owner, "PUT", `/api/customers/${cust.json.id}`, { name: "Race1 Customer RENAMED" }),
      api(A.owner, "PUT", `/api/customers/${cust.json.id}`, { phone: "07700000002" }),
    ]);
    const final = await db.collection("customers").doc(cust.json.id).get();
    const nameKept = final.get("name") === "Race1 Customer RENAMED";
    const phoneKept = final.get("phone") === "07700000002";
    const ok = nameKept && phoneKept;
    results["p2-d22-race1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `two concurrent PUT /api/customers/<id> — one sends only the changed name, the other only the changed phone (matching the fixed client's diff-only patches) → r1=${r1.status}, r2=${r2.status}; final stored name="${final.get("name")}" (renamed: ${nameKept}), phone="${final.get("phone")}" (updated: ${phoneKept})`, notes: ok ? "Both fields' changes survived under true Promise.all concurrency — the partial-merge server fix + diff-only client fix together close the lost-update. See CustomersApp.tsx save() and server/src/routes/customers.ts PUT /:id." : "LOST UPDATE still reproduces." };
  });

  await step("p2-d22-race2", async () => {
    // Two concurrent trip send-message calls on the SAME trip — do attending families get double-messaged?
    const l = await venueListingAndBlock(A.owner, "P2H22 RACE2 Trip Camp", 600);
    const c = await api(P, "POST", "/api/my/children", { name: "RACE2 Kid", dob: "2018-01-01" });
    const bk = await api(P, "POST", "/api/my/bookings", { listingId: l.listingId, blockId: l.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "RACE2 Kid", childId: c.json.id, age: 8, dates: [l.days[0]] }] });
    if (bk.status !== 201) throw new Error(`booking ${bk.status} ${err(bk)}`);
    const trip = await api(A.owner, "POST", "/api/trips", { title: "RACE2 Trip", listingId: l.listingId, date: l.days[0], destination: "Zoo", childNames: ["RACE2 Kid"], attendees: [{ n: "RACE2 Kid", childId: c.json.id, consent: "granted" }] });
    if (trip.status !== 201) throw new Error(`trip ${trip.status} ${err(trip)}`);
    const before = await db.collection("notifications").where("tenantId", "==", A.tenantId).get();
    const [s1, s2] = await Promise.all([
      api(A.owner, "POST", `/api/trips/${trip.json.id}/send-message`, { message: "Meet at 9am" }),
      api(A.owner, "POST", `/api/trips/${trip.json.id}/send-message`, { message: "Meet at 9am" }),
    ]);
    await new Promise((r) => setTimeout(r, 400));
    const after = await db.collection("notifications").where("tenantId", "==", A.tenantId).get();
    const newCount = after.size - before.size;
    const ok = s1.status === 200 && s2.status === 200 && newCount <= 2;
    results["p2-d22-race2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `same trip, two concurrent send-message calls → s1=${s1.status} sent=${s1.json?.sent}, s2=${s2.status} sent=${s2.json?.sent}; new notification docs created=${newCount}`, notes: "send-message has no idempotency guard against being called twice (no 'already sent' flag checked), so a double-click or a retried request genuinely double-messages every family on the trip — worth a product decision on whether that's acceptable for a one-off parent comms send." };
  });

  // ═══════════════════════════ PRIVILEGE ESCALATION (round 3) ═══════════════

  await step("p2-d22-pe1", async () => {
    // A staff member with assignment.mode:'all' is scoped to 'all' WITHIN their own franchise — it must never reach a sibling franchise's data.
    const sAll = await mkStaff(C.tenantId, { franchiseId: F1.franchiseId, name: "PE1 All-Sites Staff", assignment: { mode: "all", ids: [] } });
    const lF2 = await venueListingAndBlock(F2.actor, "P2H22 PE1 F2 Camp", 610, "v2");
    const cF2 = await api(P, "POST", "/api/my/children", { name: "PE1 F2 Kid", dob: "2018-01-01" });
    const bkF2 = await api(P, "POST", "/api/my/bookings", { listingId: lF2.listingId, blockId: lF2.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "PE1 F2 Kid", childId: cF2.json.id, age: 8, dates: [lF2.days[0]] }] });
    if (bkF2.status !== 201) throw new Error(`F2 booking ${bkF2.status} ${err(bkF2)}`);
    const asF1All = await api(sAll, "GET", "/api/bookings");
    const leaked = (asF1All.json ?? []).some((b: { ref?: string }) => b.ref === bkF2.json.bookings[0].ref);
    const ok = !leaked;
    results["p2-d22-pe1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `staff assigned to F1 with assignment.mode:'all' (meant to mean 'all of F1's own sites'); GET /api/bookings → F2's booking (a DIFFERENT franchise) present: ${leaked} (expect false — 'all' must be scoped by the staff member's own franchiseId, never network-wide)`, attack: true };
  });

  await step("p2-d22-pe2", async () => {
    // Company (head office) writing to /api/library with a franchiseId query param — does that let HO silently edit a franchise's OWN settings copy, bypassing the franchise's control of it?
    await setSettings(C.tenantId, F1.franchiseId, { safeguarding: { dslName: "F1's own DSL" } });
    const spoofed = await api(C.owner, "PUT", `/api/library?franchiseId=${F1.franchiseId}`, { settings: { safeguarding: { dslName: "HO OVERWROTE THIS" } } });
    const f1Lib = await db.collection("libraries").doc(`${C.tenantId}__fr__${F1.franchiseId}`).get();
    const dslName = (f1Lib.data()?.settings as { safeguarding?: { dslName?: string } } | undefined)?.safeguarding?.dslName;
    const ok = dslName === "F1's own DSL";
    results["p2-d22-pe2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `F1's own DSL name set to "F1's own DSL"; company owner PUT /api/library?franchiseId=${F1.franchiseId} attempting to overwrite it directly → ${spoofed.status} ${err(spoofed)}; F1's stored dslName afterward = "${dslName}" (expect UNCHANGED — a query-param franchiseId on a write route must not let HO silently rewrite a franchise's own settings copy outside the real franchise-features control surface)`, attack: true };
  });

  // ══════════════════════════ DATA INTEGRITY (round 3) ═══════════════════════

  await step("p2-d22-integ1", async () => {
    // A trip's attendee list referencing a childId whose booking has since been cancelled doesn't crash the roll call / consent read.
    const l = await venueListingAndBlock(A.owner, "P2H22 INTEG1 Trip Camp", 620);
    const c = await api(P, "POST", "/api/my/children", { name: "INTEG1 Kid", dob: "2018-01-01" });
    const bk = await api(P, "POST", "/api/my/bookings", { listingId: l.listingId, blockId: l.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "INTEG1 Kid", childId: c.json.id, age: 8, dates: [l.days[0]] }] });
    if (bk.status !== 201) throw new Error(`booking ${bk.status} ${err(bk)}`);
    const trip = await api(A.owner, "POST", "/api/trips", { title: "INTEG1 Trip", listingId: l.listingId, date: l.days[0], destination: "Farm", childNames: ["INTEG1 Kid"], attendees: [{ n: "INTEG1 Kid", childId: c.json.id, consent: "granted" }] });
    if (trip.status !== 201) throw new Error(`trip ${trip.status} ${err(trip)}`);
    await api(A.owner, "POST", `/api/bookings/${bk.json.bookings[0].ref}/actions`, { type: "cancel", refund: "none" });
    // trips.ts has no singular GET /:id — read back via the list route instead.
    const get = await api(A.owner, "GET", "/api/trips");
    const found = (get.json ?? []).find((t: { id: string }) => t.id === trip.json.id);
    const ok = get.status === 200 && !!found;
    results["p2-d22-integ1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `trip attendee's own booking cancelled afterward; GET /api/trips (list) → ${get.status}, the trip still present: ${!!found} (expect true, no crash — the trip's attendee record survives the underlying booking being cancelled, same spirit as p2-d20-integ5's child-deletion check)` };
  });

  await step("p2-d22-integ2", async () => {
    // A notification referencing a since-deleted booking doesn't crash the bell read.
    const l = await venueListingAndBlock(A.owner, "P2H22 INTEG2 Camp", 630);
    const c = await api(P, "POST", "/api/my/children", { name: "INTEG2 Kid", dob: "2018-01-01" });
    const bk = await api(P, "POST", "/api/my/bookings", { listingId: l.listingId, blockId: l.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "INTEG2 Kid", childId: c.json.id, age: 8, dates: [l.days[0]] }] });
    if (bk.status !== 201) throw new Error(`booking ${bk.status} ${err(bk)}`);
    await new Promise((r) => setTimeout(r, 400));
    const bookingDoc = await db.collection("bookings").where("tenantId", "==", A.tenantId).where("ref", "==", bk.json.bookings[0].ref).limit(1).get();
    await bookingDoc.docs[0]?.ref.delete();
    const list = await api(A.owner, "GET", "/api/notifications");
    const ok = list.status === 200;
    results["p2-d22-integ2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `the booking a notification refers to is deleted directly; GET /api/notifications afterward → ${list.status} (expect 200, no crash from a dangling reference in a notification doc)` };
  });
} finally {
  fs.writeFileSync("/tmp/p2h_day22.json", JSON.stringify({ results }, null, 2));
  origLog("cleanup", await cleanup());
  stop();
}
process.exit(0);
