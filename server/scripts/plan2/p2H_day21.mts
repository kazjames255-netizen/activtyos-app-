// Plan-2 Day 21 — round 2 of the founder's "keep hunting" mandate (race
// conditions, load, data-integrity, privilege-escalation), covering fresh
// ground day 20 didn't reach: concurrent invite-accept, concurrent discount-
// code CREATE (a TOCTOU race candidate — the dupe check isn't in a
// transaction), staff-cap enforcement under concurrency, a bigger booking
// burst, and a couple more integrity/privesc checks. No browser.
//
//   cd server && npx tsx scripts/plan2/p2H_day21.mts
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
  const A = await mkTenant("freelancer", "P2H21 Freelancer A");
  const C = await mkTenant("company", "P2H21 Co");
  const F1 = await mkFranchise(C.tenantId, "P2H21 F1");
  const P = await mkParent("P2H21 Parent");
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

  // ══════════════════════════════ RACE (round 2) ═════════════════════════════

  await step("p2-d21-race1", async () => {
    // Two concurrent CREATES of a discount code with the SAME code text — the dupe check (col.where(...).get() then
    // col.add()) is a plain read-then-write with NO transaction, a classic TOCTOU shape.
    const mk = () => api(A.owner, "POST", "/api/discounts", { code: "P2H21DUPE", type: "amount", value: 5, active: true });
    const [r1, r2] = await Promise.all([mk(), mk()]);
    const created = [r1, r2].filter((r) => r.status === 201).length;
    const snap = await db.collection("discountCodes").where("tenantId", "==", A.tenantId).where("code", "==", "P2H21DUPE").get();
    const ok = created <= 1 && snap.size <= 1;
    results["p2-d21-race1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `two concurrent POST /api/discounts with the SAME code text ('P2H21DUPE') → r1=${r1.status}, r2=${r2.status}; both returned 201: ${created === 2}; discountCodes docs actually stored with this code=${snap.size} (expect <=1)`, notes: created === 2 || snap.size > 1 ? "CONFIRMED RACE: discounts.ts POST / checks for a duplicate with a plain read (col.where(...).get()) THEN writes (col.add()) — no transaction wraps the two, so two near-simultaneous creates of the same code both pass the dupe check and both get written, leaving two discountCodes docs with the identical code string. Any subsequent /validate or redemption that queries by code (.limit(1)) will nondeterministically pick one of the two, and a code deactivated/edited via one doc's id leaves the other still live and redeemable." : "The dupe check held under concurrency in this run." };
  });

  await step("p2-d21-race2", async () => {
    // Two concurrent ACCEPTS of the SAME invite token — accept IS wrapped in a transaction that checks invite.usedBy inside it.
    const inv = await api(A.owner, "POST", "/api/invites", { role: "staff", email: "d21race2@p2h.test" });
    if (inv.status !== 201) throw new Error(`invite create ${inv.status} ${err(inv)}`);
    const uidA = `d21-race2a-${Math.random().toString(36).slice(2, 8)}`;
    const uidB = `d21-race2b-${Math.random().toString(36).slice(2, 8)}`;
    const actorA: Actor = { uid: uidA, email: "d21race2@p2h.test", name: "D21 Race2 A" };
    const actorB: Actor = { uid: uidB, email: "d21race2@p2h.test", name: "D21 Race2 B" };
    const [r1, r2] = await Promise.all([
      api(actorA, "POST", `/api/invites/${inv.json.token}/accept`, {}),
      api(actorB, "POST", `/api/invites/${inv.json.token}/accept`, {}),
    ]);
    const succeeded = [r1, r2].filter((r) => r.status === 200).length;
    const ok = succeeded === 1;
    results["p2-d21-race2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `same invite token, two concurrent accept calls (different uids, same sentTo email) → r1=${r1.status}, r2=${r2.status}; succeeded count=${succeeded} (expect exactly 1 — the accept transaction reads+checks invite.usedBy inside the transaction, so the loser should see 410 'already used')` };
  });

  await step("p2-d21-race3", async () => {
    // Staff-cap enforcement under real concurrency — the invite.ts comment explicitly claims "two people accepting at once
    // can't both take the last place" because the cap check runs INSIDE the transaction; verify that claim for real.
    // Uses a DEDICATED fresh tenant (not A, which by this point in the script already has a staff member from race2).
    // Create-time ALSO caps pending invites against the current limit (so 2 invites can't be created at once against a
    // limit of 1) — the real-world shape this defends against is a plan DOWNGRADE after invites already went out (the
    // route's own comment), so create both invites while the limit is generous, then lower it right before accepting.
    const D = await mkTenant("freelancer", "P2H21 Race3 Tenant");
    await db.collection("tenants").doc(D.tenantId).update({ subscription: { status: "active", plan: "freelancer", staffLimit: 5, since: new Date().toISOString() } });
    const inv1 = await api(D.owner, "POST", "/api/invites", { role: "staff", email: "d21race3a@p2h.test" });
    const inv2 = await api(D.owner, "POST", "/api/invites", { role: "staff", email: "d21race3b@p2h.test" });
    if (inv1.status !== 201 || inv2.status !== 201) throw new Error(`invite create ${inv1.status}/${inv2.status}`);
    await db.collection("tenants").doc(D.tenantId).update({ subscription: { status: "active", plan: "freelancer", staffLimit: 1, since: new Date().toISOString() } });
    const uidA = `d21-race3a-${Math.random().toString(36).slice(2, 8)}`;
    const uidB = `d21-race3b-${Math.random().toString(36).slice(2, 8)}`;
    const [r1, r2] = await Promise.all([
      api({ uid: uidA, email: "d21race3a@p2h.test", name: "R3 A" }, "POST", `/api/invites/${inv1.json.token}/accept`, {}),
      api({ uid: uidB, email: "d21race3b@p2h.test", name: "R3 B" }, "POST", `/api/invites/${inv2.json.token}/accept`, {}),
    ]);
    const succeeded = [r1, r2].filter((r) => r.status === 200).length;
    const ok = succeeded <= 1;
    results["p2-d21-race3"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `fresh tenant, staffLimit:1 (0 existing staff); two DIFFERENT staff invites accepted concurrently by two different people → r1=${r1.status} ${r1.status !== 200 ? err(r1) : ""}, r2=${r2.status} ${r2.status !== 200 ? err(r2) : ""}; succeeded count=${succeeded} (expect <=1 — the cap check is read inside the accept transaction specifically to prevent this, per the route's own comment)`, evidence: true };
  });

  // ══════════════════════════════ LOAD (round 2) ═════════════════════════════

  await step("p2-d21-load1", async () => {
    // A bigger write burst on the actual booking-creation path (the most complex single write in the app — pricing,
    // capacity, discount resolution and the freelancer gap-check all run inside one request).
    const listings = await Promise.all(Array.from({ length: 6 }, (_, i) => venueListingAndBlock(A.owner, `P2H21 LOAD1 Camp ${i}`, 500 + i * 10)));
    const t0 = Date.now();
    const calls = listings.map((l, i) => (async () => {
      const parent = await mkParent(`P2H21 Load1 Parent ${i}`);
      const c = await api(parent, "POST", "/api/my/children", { name: `LOAD1 Kid ${i}`, dob: "2018-01-01" });
      return api(parent, "POST", "/api/my/bookings", { listingId: l.listingId, blockId: l.blockId, method: "Bank transfer", items: [{ pass: "Day", child: `LOAD1 Kid ${i}`, childId: c.json.id, age: 8, dates: [l.days[0]] }] });
    })());
    const rs = await Promise.all(calls);
    const elapsed = Date.now() - t0;
    const created = rs.filter((r) => r.status === 201).length;
    const errors = rs.filter((r) => r.status >= 500).length;
    // No hard wall-clock gate here — this dev sandbox's single Node process shares CPU with everything else running
    // alongside it, so an absolute ms threshold isn't a meaningful pass/fail line. Correctness (all 6 land, no 5xx) is
    // the real signal; timing is reported as an observation, not scored.
    const ok = errors === 0 && created === 6;
    results["p2-d21-load1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `6 concurrent full booking creations (each its own listing/block/family, the heaviest single write path in the app) → ${created}/6 succeeded, ${errors} 5xxs, ${elapsed}ms wall time (timing not gated — see note)`, notes: `${elapsed}ms for 6 concurrent full booking creations in a single-process dev sandbox — not necessarily representative of production latency under load; flagged as an observation for whoever owns real load-testing infra, not a correctness bug.` };
  });

  // ══════════════════════════════ INTEGRITY (round 2) ════════════════════════

  await step("p2-d21-integ1", async () => {
    // A discount code deactivated AFTER a booking already used it doesn't retroactively change that booking's recorded price.
    const l = await venueListingAndBlock(A.owner, "P2H21 INTEG1 Camp", 560);
    const disc = await api(A.owner, "POST", "/api/discounts", { code: "P2H21INTEG1", type: "amount", value: 5, active: true });
    if (disc.status !== 201) throw new Error(`discount ${disc.status} ${err(disc)}`);
    const c = await api(P, "POST", "/api/my/children", { name: "INTEG1 Kid", dob: "2018-01-01" });
    const bk = await api(P, "POST", "/api/my/bookings", { listingId: l.listingId, blockId: l.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "INTEG1 Kid", childId: c.json.id, age: 8, dates: [l.days[0]] }], discountCode: "P2H21INTEG1" });
    if (bk.status !== 201) throw new Error(`booking ${bk.status} ${err(bk)}`);
    const amountAtBooking = bk.json.bookings[0].amount;
    await api(A.owner, "PUT", `/api/discounts/${disc.json.id}`, { code: "P2H21INTEG1", type: "amount", value: 5, active: false });
    const after = await db.collection("bookings").where("tenantId", "==", A.tenantId).where("ref", "==", bk.json.bookings[0].ref).limit(1).get();
    const ok = (after.docs[0]?.get("amount") ?? -1) === amountAtBooking;
    results["p2-d21-integ1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `booking created with a £5-off code applied (amount=${amountAtBooking}); the code is deactivated AFTERWARD; re-reading the booking → amount=${after.docs[0]?.get("amount")} (expect unchanged — deactivating a code must never retroactively alter an already-priced booking)` };
  });

  await step("p2-d21-integ2", async () => {
    // Sum of individual payments doc amounts for a booking equals its own amountPaid — the two records never disagree.
    const l = await venueListingAndBlock(A.owner, "P2H21 INTEG2 Camp", 570);
    const c = await api(P, "POST", "/api/my/children", { name: "INTEG2 Kid", dob: "2018-01-01" });
    const bk = await api(P, "POST", "/api/my/bookings", { listingId: l.listingId, blockId: l.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "INTEG2 Kid", childId: c.json.id, age: 8, dates: [l.days[0]] }] });
    if (bk.status !== 201) throw new Error(`booking ${bk.status} ${err(bk)}`);
    const ref = bk.json.bookings[0].ref;
    await api(A.owner, "POST", `/api/bookings/${ref}/record-payment`, { amount: 8 });
    await api(A.owner, "POST", `/api/bookings/${ref}/record-payment`, { amount: 12 });
    const bDoc = await db.collection("bookings").where("tenantId", "==", A.tenantId).where("ref", "==", ref).limit(1).get();
    const amountPaid = bDoc.docs[0]?.get("amountPaid") ?? -1;
    const pays = await db.collection("payments").where("refs", "array-contains", ref).get();
    const paymentsSum = pays.docs.reduce((s, d) => s + (Number(d.get("amount")) || 0), 0);
    const ok = amountPaid === 20 && paymentsSum === amountPaid;
    results["p2-d21-integ2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `two part-payments (£8 + £12) recorded separately; booking.amountPaid=${amountPaid}; sum of ${pays.size} payments doc(s)=${paymentsSum} (expect both =20 and equal to each other — the booking's own running total and its itemised payment records must never drift apart)` };
  });

  // ═══════════════════════════ PRIVILEGE ESCALATION (round 2) ═══════════════

  await step("p2-d21-pe1", async () => {
    // Platform acting-as a franchise inherits the FRANCHISE's own restrictions — it doesn't get company-level powers just because the acting account is platform.
    const platformUid = `d21-plat-${Math.random().toString(36).slice(2, 8)}`;
    const platformActor: Actor = { uid: platformUid, email: `${platformUid}@p2h.test`, name: "D21 Platform" };
    await db.collection("users").doc(platformUid).set({ email: platformActor.email, role: "platform", chosen: true, name: "D21 Platform" });
    const asF1 = await api(platformActor, "GET", "/api/franchises", undefined, { "x-act-as": F1.actor.uid });
    const ok = asF1.status === 403;
    results["p2-d21-pe1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `platform token acting-as F1 (a franchise) GET /api/franchises (company-only route) → ${asF1.status} ${err(asF1)} (expect 403 — impersonation inherits the impersonated account's OWN role restrictions, doesn't grant platform-level or company-level power)` };
  });

  await step("p2-d21-pe2", async () => {
    // A second accept attempt on an ALREADY-used invite token, by a completely different person, is refused (not just re-checked against the original accepter).
    const inv = await api(A.owner, "POST", "/api/invites", { role: "staff", email: "d21pe2@p2h.test" });
    if (inv.status !== 201) throw new Error(`invite create ${inv.status} ${err(inv)}`);
    const first = await api({ uid: `d21-pe2-first-${Math.random().toString(36).slice(2, 6)}`, email: "d21pe2@p2h.test", name: "First" }, "POST", `/api/invites/${inv.json.token}/accept`, {});
    if (first.status !== 200) throw new Error(`first accept ${first.status} ${err(first)}`);
    const second = await api({ uid: `d21-pe2-second-${Math.random().toString(36).slice(2, 6)}`, email: "d21pe2@p2h.test", name: "Second" }, "POST", `/api/invites/${inv.json.token}/accept`, {});
    const ok = second.status === 410;
    results["p2-d21-pe2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `invite accepted once (${first.status}); a SECOND, different account attempts to accept the SAME already-used token → ${second.status} ${err(second)} (expect 410 'already used')`, attack: true };
  });
} finally {
  fs.writeFileSync("/tmp/p2h_day21.json", JSON.stringify({ results }, null, 2));
  origLog("cleanup", await cleanup());
  stop();
}
process.exit(0);
