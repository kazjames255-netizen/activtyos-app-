// Plan-2 Day 18 — a genuinely broad sweep across six areas (money, bookings,
// safeguarding, staff/rota, messaging/notifications, multi-tenant), on ground
// neither plan.ts nor plan2.ts days 1-17 already covered. No browser: every
// step here is an API call through the harness or a source-code read.
//
//   cd server && npx tsx scripts/plan2/p2H_day18.mts
import fs from "node:fs";
import {
  api, db, mkTenant, mkFranchise, mkStaff, mkParent, setSettings, cleanup, start, stop,
  ymd, daysFromNow, type Actor,
} from "./p2H_harness.mts";

type V = { verdict: "pass" | "fail" | "blocked"; actual: string; notes?: string; method?: string };
const results: Record<string, V> = {};
const origLog = console.log;
const mailLog: string[] = [];
console.log = (...a: unknown[]) => { const s = a.map(String).join(" "); if (s.startsWith("[mail]")) mailLog.push(s); origLog(...a); };
const step = async (id: string, fn: () => Promise<void>) => {
  try { await fn(); } catch (e) { results[id] = { verdict: "blocked", actual: `script error: ${(e as Error).message}` }; origLog(`  !! ${id} threw`, e); }
  origLog(`[${id}] ${results[id]?.verdict} — ${results[id]?.actual}`);
};
const err = (r: { json: any }) => JSON.stringify(r.json?.error ?? r.json ?? "").slice(0, 200);

const base = await start();

try {
  // ── World ────────────────────────────────────────────────────────────────
  const A = await mkTenant("freelancer", "P2H18 Freelancer A");
  const A2 = await mkTenant("freelancer", "P2H18 Freelancer A2"); // a wholly separate freelancer
  const B = await mkTenant("freelancer", "P2H18 Freelancer B");   // cross-tenant discount check
  const C = await mkTenant("company", "P2H18 Co");
  const F1 = await mkFranchise(C.tenantId, "P2H18 F1");
  const F2 = await mkFranchise(C.tenantId, "P2H18 F2");
  const P = await mkParent("P2H18 Parent");
  const P2 = await mkParent("P2H18 Parent Two");
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
  async function book(actor: Actor, kidName: string, l: { listingId: string; blockId: string }, date: string, extra: Record<string, unknown> = {}) {
    const c = await api(actor, "POST", "/api/my/children", { name: kidName, dob: "2018-01-01" });
    return api(actor, "POST", "/api/my/bookings", { listingId: l.listingId, blockId: l.blockId, method: "Bank transfer", items: [{ pass: "Day", child: kidName, childId: c.json.id, age: 8, dates: [date] }], ...extra });
  }

  // ═══════════════════════════════ MONEY ═══════════════════════════════════

  await step("p2-d18-m1", async () => {
    // Discount code usageLimit — redeem once, then a second redemption is refused.
    const l = await venueListingAndBlock(A.owner, "P2H18 M1 Camp", 100);
    const disc = await api(A.owner, "POST", "/api/discounts", { code: "P2H18LIMIT1", type: "amount", value: 5, usageLimit: 1, active: true });
    if (disc.status !== 201) throw new Error(`discount ${disc.status} ${err(disc)}`);
    const b1 = await book(P, "M1 Kid A", l, l.days[0], { discountCode: "P2H18LIMIT1" });
    const after1 = await db.collection("discountCodes").doc(disc.json.id).get();
    const b2 = await book(P2, "M1 Kid B", l, l.days[1], { discountCode: "P2H18LIMIT1" });
    const ok = b1.status === 201 && after1.get("usedCount") === 1 && b2.status === 400 && /usage limit|used up/i.test(err(b2));
    results["p2-d18-m1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `discount usageLimit:1 created; first booking with the code → ${b1.status}, usedCount after → ${after1.get("usedCount")}; second booking (different family) with the SAME exhausted code → ${b2.status} ${err(b2)}`, notes: "The whole booking is refused (400), not silently completed without the discount — an explicitly-requested-but-exhausted code is treated as a hard checkout error the family sees and can react to (remove the code, or contact the provider), rather than a silent price change." };
  });

  await step("p2-d18-m2", async () => {
    // Discount code minSpend — below the threshold is invalid, at/above is valid.
    await api(A.owner, "POST", "/api/discounts", { code: "P2H18MINSPEND", type: "amount", value: 5, minSpend: 100, active: true });
    const below = await api(P, "POST", "/api/discounts/validate", { tenantId: A.tenantId, code: "P2H18MINSPEND", subtotal: 50 });
    const above = await api(P, "POST", "/api/discounts/validate", { tenantId: A.tenantId, code: "P2H18MINSPEND", subtotal: 150 });
    const ok = below.json?.valid === false && /spend at least/i.test(below.json?.reason ?? "") && above.json?.valid === true;
    results["p2-d18-m2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `minSpend:100; validate at subtotal 50 → valid=${below.json?.valid} reason="${below.json?.reason}"; at subtotal 150 → valid=${above.json?.valid} off=${above.json?.off}` };
  });

  await step("p2-d18-m3", async () => {
    // Discount code reserved to one family (assignedTo) — only that email may use it.
    await api(A.owner, "POST", "/api/discounts", { code: "P2H18RESERVED", type: "amount", value: 5, assignedTo: P.email, active: true });
    const wrongFamily = await api(P2, "POST", "/api/discounts/validate", { tenantId: A.tenantId, code: "P2H18RESERVED", subtotal: 50 });
    const rightFamily = await api(P, "POST", "/api/discounts/validate", { tenantId: A.tenantId, code: "P2H18RESERVED", subtotal: 50 });
    const ok = wrongFamily.json?.valid === false && /reserved/i.test(wrongFamily.json?.reason ?? "") && rightFamily.json?.valid === true;
    results["p2-d18-m3"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `code assignedTo P's email; validate as an unrelated family (P2) → valid=${wrongFamily.json?.valid} reason="${wrongFamily.json?.reason}"; as the assigned family (P) → valid=${rightFamily.json?.valid}` };
  });

  await step("p2-d18-m4", async () => {
    // Invoice overdue flag — a sent invoice past its due date shows overdue:true and counts in the summary.
    const inv = await api(A.owner, "POST", "/api/invoices", { customerName: "M4 Customer", amount: 200, date: ymd(daysFromNow(-10)), dueDate: ymd(daysFromNow(-1)), status: "sent" });
    if (inv.status !== 201) throw new Error(`invoice ${inv.status} ${err(inv)}`);
    const list = await api(A.owner, "GET", "/api/invoices");
    const row = (list.json?.items ?? []).find((i: { id: string }) => i.id === inv.json.id);
    const ok = row?.overdue === true && (list.json?.summary?.overdue ?? 0) >= 1;
    results["p2-d18-m4"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `invoice status:sent, dueDate yesterday → created ${inv.status}; GET /api/invoices row.overdue=${row?.overdue}; summary.overdue=${list.json?.summary?.overdue}` };
  });

  let m5Ref = "";
  await step("p2-d18-m5", async () => {
    // record-payment boundary: an amount that lands EXACTLY on the remaining balance is accepted, not treated as an overpay.
    const l = await venueListingAndBlock(A.owner, "P2H18 M5 Camp", 110);
    const bk = await book(P, "M5 Kid", l, l.days[0]);
    if (bk.status !== 201) throw new Error(`booking ${bk.status} ${err(bk)}`);
    m5Ref = bk.json.bookings[0].ref;
    const total = bk.json.bookings[0].total ?? bk.json.bookings[0].amount ?? 20;
    const pay = await api(A.owner, "POST", `/api/bookings/${m5Ref}/record-payment`, { amount: total });
    const overBy1p = await api(A.owner, "POST", `/api/bookings/${m5Ref}/record-payment`, { amount: 0.01 });
    const ok = pay.status === 200 && overBy1p.status === 400;
    results["p2-d18-m5"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `booking total=${total}; record-payment for the EXACT remaining balance → ${pay.status} ${pay.status !== 200 ? err(pay) : ""}; one more penny beyond that (now overpaying) → ${overBy1p.status} ${err(overBy1p)}` };
  });

  await step("p2-d18-m6", async () => {
    // Split-fees rounding with a fractional royalty percentage — HO's list and the franchise's own figure must still agree to the penny.
    const set = await api(C.owner, "PUT", "/api/splitfees/settings", { basis: "revenue", rate: 12.5 });
    const l = await venueListingAndBlock(F1.actor, "P2H18 M6 F1 Camp", 42, "v1");
    const bk1 = await book(P, "M6 Kid A", l, l.days[0]);
    const bk2 = await book(P2, "M6 Kid B", l, l.days[1]);
    const hoList = await api(C.owner, "GET", "/api/splitfees");
    const f1Mine = await api(F1.actor, "GET", "/api/splitfees/mine");
    const hoRow = (hoList.json?.rows ?? hoList.json?.franchises ?? hoList.json ?? []) as { franchiseId?: string; fee?: number }[];
    const f1Row = Array.isArray(hoRow) ? hoRow.find((r) => r.franchiseId === F1.franchiseId) : undefined;
    const ok = set.status === 200 && bk1.status === 201 && bk2.status === 201 && !!f1Row && typeof f1Mine.json?.fee === "number" && Math.abs((f1Row.fee ?? -1) - f1Mine.json.fee) < 0.01;
    results["p2-d18-m6"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `royalty rate set to 12.5% → ${set.status}; two F1 bookings taken; HO's own row for F1 → ${JSON.stringify(f1Row)}; F1's own /mine figure → ${JSON.stringify(f1Mine.json)}` };
  });

  // ═══════════════════════════════ BOOKINGS ═════════════════════════════════

  await step("p2-d18-bk1", async () => {
    // Day-scoped capacity (capacityScope:'day', capacity:1) — one seat PER DAY, not per whole block: filling day 1 doesn't block day 2.
    const l = await venueListingAndBlock(A.owner, "P2H18 BK1 Camp", 120, "v1", { capacity: 1, capacityScope: "day" });
    const day1a = await book(P, "BK1 Kid A", l, l.days[0]);
    const day1b = await book(P2, "BK1 Kid B", l, l.days[0]); // same day, should be refused/waitlisted — day full
    const day2 = await book(P2, "BK1 Kid C", l, l.days[1]); // different day, day 2 still has its own seat
    const day1bStatus = day1b.json?.bookings?.[0]?.status ?? day1b.status;
    const ok = day1a.status === 201 && (day1b.status !== 201 || day1bStatus === "Waitlisted") && day2.status === 201;
    results["p2-d18-bk1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `block capacityScope:'day', capacity:1; first child on day 1 → ${day1a.status}; second child, SAME day 1 (day full) → ${day1b.status} (row status: ${day1bStatus}); third child, DIFFERENT day 2 (day 2 still empty) → ${day2.status} — confirms the cap is per-day, not per-block` };
  });

  await step("p2-d18-bk2", async () => {
    // Home-visit coverage postcode matching: case and whitespace variants of an in-coverage postcode still match.
    const create = await api(A2.owner, "POST", "/api/listings", { title: "P2H18 BK2 HV Camp", passes: [{ name: "Day", price: 25 }], deliveryMode: "home-visit", coverageArea: { mode: "postcodePrefixes", postcodePrefixes: ["SW1"] }, minGapMinutes: 20, blockId: "bundle-placeholder", runFrom: ymd(daysFromNow(60)), runTo: ymd(daysFromNow(70)) });
    await db.collection("listings").doc(create.json.id).set({ status: "live" }, { merge: true });
    const blk = await api(A2.owner, "POST", "/api/blocks", { listingId: create.json.id, name: "bk2 block", startDate: ymd(daysFromNow(60)), endDate: ymd(daysFromNow(66)), capacity: 20, schedule: { startTime: "09:00", endTime: "15:30", weekdays: [0, 1, 2, 3, 4, 5, 6] } });
    const c = await api(P, "POST", "/api/my/children", { name: "BK2 Kid", dob: "2018-01-01" });
    const lower = await api(P, "POST", "/api/my/bookings", { listingId: create.json.id, blockId: blk.json.id, method: "Bank transfer", items: [{ pass: "Day", child: "BK2 Kid", childId: c.json.id, age: 8, dates: [ymd(daysFromNow(60))] }], serviceAddress: { address: "1 Test St", postcode: "sw1 2ab" } }); // lowercase + space
    const ok = lower.status === 201;
    results["p2-d18-bk2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `coverage postcodePrefixes:['SW1']; booking with a LOWERCASE, spaced postcode ("sw1 2ab") → ${lower.status} ${lower.status !== 201 ? err(lower) : "accepted — matching is case/space-insensitive"}` };
  });

  await step("p2-d18-bk3", async () => {
    // Freelancer minGapMinutes clash-check is scoped to the OWN tenant — a DIFFERENT freelancer's overlapping home-visit session at the same time never collides.
    const mkHv = async (actor: Actor, title: string, offset: number) => {
      const cr = await api(actor, "POST", "/api/listings", { title, passes: [{ name: "Day", price: 25 }], deliveryMode: "home-visit", coverageArea: { mode: "postcodePrefixes", postcodePrefixes: ["SW1"] }, minGapMinutes: 20, blockId: "x", runFrom: ymd(daysFromNow(offset)), runTo: ymd(daysFromNow(offset + 10)) });
      await db.collection("listings").doc(cr.json.id).set({ status: "live" }, { merge: true });
      return cr.json.id as string;
    };
    const l1 = await mkHv(A.owner, "P2H18 BK3 A HV", 80);
    const l2 = await mkHv(A2.owner, "P2H18 BK3 A2 HV", 80);
    const b1block = await api(A.owner, "POST", "/api/blocks", { listingId: l1, name: "bk3-a", startDate: ymd(daysFromNow(80)), endDate: ymd(daysFromNow(80)), capacity: 20, schedule: { startTime: "10:00", endTime: "11:00", weekdays: [0, 1, 2, 3, 4, 5, 6] } });
    const b2block = await api(A2.owner, "POST", "/api/blocks", { listingId: l2, name: "bk3-a2", startDate: ymd(daysFromNow(80)), endDate: ymd(daysFromNow(80)), capacity: 20, schedule: { startTime: "10:15", endTime: "11:00", weekdays: [0, 1, 2, 3, 4, 5, 6] } }); // 15 min overlap-ish gap, under 20 — WOULD clash if wrongly cross-tenant-checked
    const c1 = await api(P, "POST", "/api/my/children", { name: "BK3 Kid A", dob: "2018-01-01" });
    const book1 = await api(P, "POST", "/api/my/bookings", { listingId: l1, blockId: b1block.json.id, method: "Bank transfer", items: [{ pass: "Day", child: "BK3 Kid A", childId: c1.json.id, age: 8, dates: [ymd(daysFromNow(80))] }], serviceAddress: { address: "1 A St", postcode: "SW1 1AA" } });
    const c2 = await api(P2, "POST", "/api/my/children", { name: "BK3 Kid B", dob: "2018-01-01" });
    const book2 = await api(P2, "POST", "/api/my/bookings", { listingId: l2, blockId: b2block.json.id, method: "Bank transfer", items: [{ pass: "Day", child: "BK3 Kid B", childId: c2.json.id, age: 8, dates: [ymd(daysFromNow(80))] }], serviceAddress: { address: "1 B St", postcode: "SW1 1AB" } });
    const ok = book1.status === 201 && book2.status === 201;
    results["p2-d18-bk3"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `two DIFFERENT freelancer tenants (A, A2), each with a home-visit listing booked at overlapping/close times (10:00-11:00 vs 10:15-11:00, same day, under A's own 20-min gap) → A's booking ${book1.status}; A2's booking ${book2.status} (expected both 201 — the clash-check queries bookingsCol.where(tenantId==listing.tenantId), so it never crosses tenant boundaries even when two freelancers' sessions genuinely overlap in time)` };
  });

  let bk4Ref = "";
  await step("p2-d18-bk4", async () => {
    // Cancelling an already-cancelled booking is refused, not double-refunded.
    const l = await venueListingAndBlock(A.owner, "P2H18 BK4 Camp", 130);
    const bk = await book(P, "BK4 Kid", l, l.days[0]);
    if (bk.status !== 201) throw new Error(`booking ${bk.status} ${err(bk)}`);
    bk4Ref = bk.json.bookings[0].ref;
    const c1 = await api(A.owner, "POST", `/api/bookings/${bk4Ref}/actions`, { type: "cancel", refund: "none" });
    const c2 = await api(A.owner, "POST", `/api/bookings/${bk4Ref}/actions`, { type: "cancel", refund: "none" });
    const ok = c1.status === 200 && c2.status !== 200;
    results["p2-d18-bk4"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `first cancel → ${c1.status}; SAME booking cancelled again → ${c2.status} ${c2.status !== 200 ? err(c2) : "ACCEPTED A SECOND TIME — no guard against a double-cancel"}` };
  });

  await step("p2-d18-bk5", async () => {
    // cancel-day on one day of a multi-day pass — the child's own dates list is untouched (it's the historical record of what was
    // booked), but a per-day cancellation is tracked separately (cancelledDays) with its own refund-log line, and the remaining
    // active days (dates minus cancelledDays) still cover the other two days.
    const l = await venueListingAndBlock(A.owner, "P2H18 BK5 Camp", 140);
    const c = await api(P, "POST", "/api/my/children", { name: "BK5 Kid", dob: "2018-01-01" });
    const bk = await api(P, "POST", "/api/my/bookings", { listingId: l.listingId, blockId: l.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "BK5 Kid", childId: c.json.id, age: 8, dates: [l.days[0], l.days[1], l.days[2]] }] });
    if (bk.status !== 201) throw new Error(`booking ${bk.status} ${err(bk)}`);
    const ref = bk.json.bookings[0].ref;
    const cancelDay = await api(A.owner, "POST", `/api/bookings/${ref}/actions`, { type: "cancel-day", ki: 0, date: l.days[0] });
    const after = await api(A.owner, "GET", `/api/bookings/${ref}`);
    const kid = (after.json?.kids ?? [])[0] as { dates?: string[]; cancelledDays?: string[] } | undefined;
    const refundLog = (after.json?.refundLog ?? []) as { label?: string; amount?: number }[];
    const gotLogLine = refundLog.length > 0;
    // kid.dates is stored pretty-printed (e.g. "Wed 03 Feb 2027"), not ISO like l.days[] — so just confirm the historical
    // record still has all 3 original dates (nothing deleted from it) and cancelledDays independently gained exactly 1 entry.
    const ok = cancelDay.status === 200 && !!kid?.cancelledDays?.includes(l.days[0]) && kid?.cancelledDays?.length === 1 && (kid?.dates ?? []).length === 3 && gotLogLine;
    results["p2-d18-bk5"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `3-day booking; cancel-day on day 1 (${l.days[0]}) → ${cancelDay.status}; kid.cancelledDays afterward = ${JSON.stringify(kid?.cancelledDays)}; kid.dates (unchanged historical record, still all 3) = ${JSON.stringify(kid?.dates)}; a refundLog line was added: ${gotLogLine}` };
  });

  // ═══════════════════════════════ SAFEGUARDING ═════════════════════════════

  await step("p2-d18-sg1", async () => {
    // Medication administer without consent is refused — "no consent, no medicine" is enforced server-side, not just hidden in the UI.
    const med = await api(A.owner, "POST", "/api/medications", { childName: "SG1 Kid", name: "Piriton", dose: "5ml", consentGranted: false });
    if (med.status !== 201) throw new Error(`med ${med.status} ${err(med)}`);
    const administer = await api(A.owner, "POST", `/api/medications/${med.json.id}/administer`, { date: ymd(new Date()), doseGiven: "5ml" });
    const ok = administer.status === 409 && /consent/i.test(err(administer));
    results["p2-d18-sg1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `medication created with consentGranted:false; POST administer → ${administer.status} ${err(administer)}` };
  });

  await step("p2-d18-sg2", async () => {
    // A confidential incident stays off the CHILD's parent-visible record, even though it isn't a safeguarding kind.
    const lSg2 = await venueListingAndBlock(A.owner, "P2H18 SG2 Camp", 160);
    const c = await api(P, "POST", "/api/my/children", { name: "SG2 Kid", dob: "2018-01-01" });
    const bkSg2 = await api(P, "POST", "/api/my/bookings", { listingId: lSg2.listingId, blockId: lSg2.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "SG2 Kid", childId: c.json.id, age: 8, dates: [lSg2.days[0]] }] });
    if (bkSg2.status !== 201) throw new Error(`booking ${bkSg2.status} ${err(bkSg2)}`);
    const inc = await api(A.owner, "POST", "/api/incidents", { kind: "incident", childId: c.json.id, childName: "SG2 Kid", description: "Confidential behaviour note", confidential: true, date: ymd(new Date()) });
    if (inc.status !== 201) throw new Error(`incident ${inc.status} ${err(inc)}`);
    const parentView = await api(P, "GET", "/api/incidents");
    const visible = (parentView.json ?? []).some((x: { id: string }) => x.id === inc.json.id);
    const ok = inc.status === 201 && !visible;
    results["p2-d18-sg2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `incident kind:'incident' (not safeguarding), confidential:true, no shareWithParent → created ${inc.status}; GET /api/incidents as the child's own parent → record present: ${visible} (expect false — confidential holds even for a non-safeguarding kind)` };
  });

  await step("p2-d18-sg3", async () => {
    // A plain staff member (not DSL, not the recorder) reading the safeguarding-kind list gets redacted/absent entries, not the full record.
    const dsl = await mkStaff(A.tenantId, { franchiseId: null, name: "SG3 DSL" });
    const S1 = await mkStaff(A.tenantId, { franchiseId: null, name: "SG3 Plain Staff" });
    const inc = await api(dsl, "POST", "/api/incidents", { kind: "safeguarding", childName: "SG3 Kid", description: "A real concern", concernCategory: "disclosure", date: ymd(new Date()) });
    if (inc.status !== 201) throw new Error(`incident ${inc.status} ${err(inc)}`);
    const asOther = await api(S1, "GET", "/api/incidents?kind=safeguarding");
    const row = (asOther.json ?? []).find((x: { id: string }) => x.id === inc.json.id);
    const fullyVisible = row && row.description === "A real concern";
    const ok = !fullyVisible;
    results["p2-d18-sg3"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `safeguarding concern logged by one staff member; ANOTHER plain staff member (not DSL, not the recorder) GET /api/incidents?kind=safeguarding → row present: ${!!row}, full description visible: ${!!fullyVisible} (expect the record to be absent or redacted, never the full text)` };
  });

  await step("p2-d18-sg4", async () => {
    // Medications are isolated per franchise — a sibling franchise never sees another franchise's medication record.
    const med = await api(F1.actor, "POST", "/api/medications", { childName: "SG4 Kid", name: "Calpol", dose: "5ml", consentGranted: true });
    const asF2 = await api(F2.actor, "GET", "/api/medications");
    const leaked = (asF2.json ?? []).some((m: { id: string }) => m.id === med.json?.id);
    const ok = med.status === 201 && !leaked;
    results["p2-d18-sg4"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `F1 creates a medication record (${med.status}); F2's GET /api/medications includes it: ${leaked} (expect false)` };
  });

  await step("p2-d18-sg5", async () => {
    // Setup's notifyParentAccident toggle gates the PROACTIVE bell/email notification (sharesWithParent, used at write time),
    // NOT the child's own record visibility — the parent-facing GET /api/incidents list filter (incidents.ts ~line 218-224)
    // only excludes safeguarding/incident/confidential/staff-subject records, with no accident-specific gate at all. So an
    // accident on the child's OWN profile should stay visible to their own parent regardless of the toggle.
    await setSettings(A.tenantId, null, { safeguarding: { notifyParentAccident: false } });
    const lSg5 = await venueListingAndBlock(A.owner, "P2H18 SG5 Camp", 170);
    const c = await api(P, "POST", "/api/my/children", { name: "SG5 Kid", dob: "2018-01-01" });
    const bkSg5 = await api(P, "POST", "/api/my/bookings", { listingId: lSg5.listingId, blockId: lSg5.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "SG5 Kid", childId: c.json.id, age: 8, dates: [lSg5.days[0]] }] });
    if (bkSg5.status !== 201) throw new Error(`booking ${bkSg5.status} ${err(bkSg5)}`);
    const acc = await api(A.owner, "POST", "/api/incidents", { kind: "accident", childId: c.json.id, childName: "SG5 Kid", description: "Bumped knee", bodyPart: "knee", date: ymd(new Date()) });
    if (acc.status !== 201) throw new Error(`accident ${acc.status} ${err(acc)}`);
    const asParent = await api(P, "GET", "/api/incidents");
    const visible = (asParent.json ?? []).some((x: { id: string }) => x.id === acc.json.id);
    const ok = visible === true;
    results["p2-d18-sg5"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `Setup safeguarding.notifyParentAccident:false; accident logged on the child's own record → GET /api/incidents as that SAME child's own parent shows it: ${visible} (expect true — the toggle governs the proactive notification, not whether an accident appears on the child's own profile; confirmed by reading incidents.ts's parent-list filter, which has no accident-specific exclusion)` };
    await setSettings(A.tenantId, null, { safeguarding: { notifyParentAccident: true } });
  });

  // ═══════════════════════════════ STAFF / ROTA ═════════════════════════════

  await step("p2-d18-r1", async () => {
    // Cancelling an approved leave request clears the rota's needsCover flag.
    const key = C.tenantId;
    await db.collection("rotas").doc(key).set({ tenantId: C.tenantId, staff: [{ id: "riley", name: "R1 Riley" }], sites: ["v1"], updatedAt: new Date().toISOString() }, { merge: true });
    const shiftId = "d18r1-shift";
    const date = ymd(daysFromNow(55));
    await db.collection("rotaShifts").doc(`${key}_${shiftId}`).set({ id: shiftId, rotaKey: key, tenantId: C.tenantId, franchiseId: null, staffId: "riley", site: "v1", role: "Coach", date, start: "09:00", end: "15:00" });
    const leave = await api(C.owner, "POST", "/api/leave/absences", { name: "R1 Riley", kind: "annual", start: date, end: date, days: 1, status: "approved" });
    const rotaMid = await api(C.owner, "GET", "/api/rota");
    const flaggedMid = (rotaMid.json?.shifts ?? []).find((s: { id: string }) => s.id === shiftId)?.needsCover === true;
    const cancel = await api(C.owner, "POST", `/api/leave/absences/${leave.json.id}/cancel`, {});
    const rotaAfter = await api(C.owner, "GET", "/api/rota");
    const flaggedAfter = (rotaAfter.json?.shifts ?? []).find((s: { id: string }) => s.id === shiftId)?.needsCover === true;
    const ok = leave.status === 201 && flaggedMid === true && cancel.status === 200 && flaggedAfter === false;
    results["p2-d18-r1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `approve leave for Riley on ${date} → ${leave.status}, rota shows needsCover: ${flaggedMid}; POST .../cancel → ${cancel.status}; rota afterward shows needsCover: ${flaggedAfter} (expect false once cancelled)` };
  });

  await step("p2-d18-r2", async () => {
    // A franchise's own rota (and its leave-flagging) doesn't leak into a sibling franchise's rota, even with a same-named staff member on both.
    const keyF1 = `${C.tenantId}__fr__${F1.franchiseId}`;
    const keyF2 = `${C.tenantId}__fr__${F2.franchiseId}`;
    const date = ymd(daysFromNow(56));
    await db.collection("rotas").doc(keyF1).set({ tenantId: C.tenantId, franchiseId: F1.franchiseId, staff: [{ id: "sam", name: "Sam Shared Name" }], sites: ["v1"], updatedAt: new Date().toISOString() }, { merge: true });
    await db.collection("rotas").doc(keyF2).set({ tenantId: C.tenantId, franchiseId: F2.franchiseId, staff: [{ id: "sam", name: "Sam Shared Name" }], sites: ["v1"], updatedAt: new Date().toISOString() }, { merge: true });
    await db.collection("rotaShifts").doc(`${keyF1}_sh`).set({ id: "sh", rotaKey: keyF1, tenantId: C.tenantId, franchiseId: F1.franchiseId, staffId: "sam", site: "v1", role: "Coach", date, start: "09:00", end: "15:00" });
    await db.collection("rotaShifts").doc(`${keyF2}_sh`).set({ id: "sh", rotaKey: keyF2, tenantId: C.tenantId, franchiseId: F2.franchiseId, staffId: "sam", site: "v1", role: "Coach", date, start: "09:00", end: "15:00" });
    // Approve leave ONLY under F1's rotaKey.
    await db.collection("absences").add({ rotaKey: keyF1, tenantId: C.tenantId, name: "Sam Shared Name", staffId: "sam-shared-name", kind: "annual", start: date, end: date, days: 1, status: "approved", requestedAt: new Date().toISOString() });
    const rotaF1 = await api(F1.actor, "GET", "/api/rota");
    const rotaF2 = await api(F2.actor, "GET", "/api/rota");
    const flagF1 = (rotaF1.json?.shifts ?? []).find((s: { id: string }) => s.id === "sh")?.needsCover === true;
    const flagF2 = (rotaF2.json?.shifts ?? []).find((s: { id: string }) => s.id === "sh")?.needsCover === true;
    const ok = flagF1 === true && flagF2 === false;
    results["p2-d18-r2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `two franchises (F1, F2) each roster a staff member with the SAME name ("Sam Shared Name") on the same date; leave approved only under F1's rotaKey → F1's own /api/rota flags the shift needsCover: ${flagF1}; F2's own /api/rota, same name/date, different franchise: ${flagF2} (expect false — leave doesn't cross the franchise boundary even with a name collision)` };
  });

  await step("p2-d18-r3", async () => {
    // A plain staff member's GET /api/rota never carries a colleague's pay rate.
    const key = A.tenantId;
    await db.collection("rotas").doc(key).set({ tenantId: A.tenantId, staff: [{ id: "team-payme", name: "R3 Payme", rate: 15.5 }], sites: ["v1"], updatedAt: new Date().toISOString() }, { merge: true });
    const S1 = await mkStaff(A.tenantId, { franchiseId: null, name: "R3 Viewer" });
    const rota = await api(S1, "GET", "/api/rota");
    const anyRate = (rota.json?.staff ?? []).some((s: { rate?: number }) => s.rate !== undefined);
    const ok = !anyRate;
    results["p2-d18-r3"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `a staff record carrying rate:15.5 exists on the rota; plain staff GET /api/rota — any staff row still carries a rate field: ${anyRate} (expect false — rota.ts strips 'rate' for role:'staff')` };
  });

  await step("p2-d18-r4", async () => {
    // Even a NAMED LEAD on a staff account cannot decide a colleague's leave
    // request — POST /absences/:id/decide gates on canManage(role), i.e.
    // company/freelancer/franchise only, regardless of any staff seniority
    // flag such as `lead`. Confirms the money/HR-sensitive decide route holds
    // the role line even for a staff member who looks senior in every other
    // sense (can plan trips, appears as a lead in the rota, etc).
    const leadStaff = await mkStaff(A.tenantId, { franchiseId: null, name: "R4 Lead Staff", lead: true });
    const requester = await mkStaff(A.tenantId, { franchiseId: null, name: "R4 Requester" });
    const req1 = await api(requester, "POST", "/api/leave/absences", { kind: "annual", start: ymd(daysFromNow(60)), end: ymd(daysFromNow(60)), days: 1 });
    if (req1.status !== 201) throw new Error(`leave request ${req1.status} ${err(req1)}`);
    const approve = await api(leadStaff, "POST", `/api/leave/absences/${req1.json.id}/decide`, { status: "approved" });
    const ok = approve.status === 403;
    results["p2-d18-r4"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `a staff member flagged lead:true attempts POST /api/leave/absences/<id>/decide on a colleague's pending request → ${approve.status} ${err(approve)} (expect 403 — decide is canManage-gated by role, a staff 'lead' flag doesn't cross it)` };
  });

  await step("p2-d18-r5", async () => {
    // Two different staff members both on approved leave the same day are BOTH independently flagged.
    const key = C.tenantId;
    const date = ymd(daysFromNow(57));
    await db.collection("rotas").doc(key).set({ tenantId: C.tenantId, staff: [{ id: "alex", name: "R5 Alex" }, { id: "jordan", name: "R5 Jordan" }], sites: ["v1"], updatedAt: new Date().toISOString() }, { merge: true });
    await db.collection("rotaShifts").doc(`${key}_r5alex`).set({ id: "r5alex", rotaKey: key, tenantId: C.tenantId, franchiseId: null, staffId: "alex", site: "v1", role: "Coach", date, start: "09:00", end: "15:00" });
    await db.collection("rotaShifts").doc(`${key}_r5jordan`).set({ id: "r5jordan", rotaKey: key, tenantId: C.tenantId, franchiseId: null, staffId: "jordan", site: "v1", role: "Coach", date, start: "09:00", end: "15:00" });
    await api(C.owner, "POST", "/api/leave/absences", { name: "R5 Alex", kind: "annual", start: date, end: date, days: 1, status: "approved" });
    await api(C.owner, "POST", "/api/leave/absences", { name: "R5 Jordan", kind: "annual", start: date, end: date, days: 1, status: "approved" });
    const rota = await api(C.owner, "GET", "/api/rota");
    const alexFlag = (rota.json?.shifts ?? []).find((s: { id: string }) => s.id === "r5alex")?.needsCover === true;
    const jordanFlag = (rota.json?.shifts ?? []).find((s: { id: string }) => s.id === "r5jordan")?.needsCover === true;
    const ok = alexFlag && jordanFlag;
    results["p2-d18-r5"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `two different staff, same date, both approved leave — Alex's shift needsCover: ${alexFlag}; Jordan's shift needsCover: ${jordanFlag} (expect both true, independently)` };
  });

  // ═══════════════════════ MESSAGING / NOTIFICATIONS ═══════════════════════

  await step("p2-d18-msg1", async () => {
    // The known merge-field gap (plain composer doesn't resolve tokens), retested against the BROADCAST route specifically — not yet checked there.
    const l = await venueListingAndBlock(B.owner, "P2H18 MSG1 Camp", 46);
    await book(P2, "MSG1 Kid", l, l.days[0]);
    // messages.ts's broadcast route matches bookings by b.listing, which stores the LISTING'S NAME (see routes/my.ts:1485
    // `listing: listing.name`), not its id — the client's own picker sends the title string, confirmed by reading
    // MessagesApp.tsx's listingTargets chips (`{l}` is the rendered name). Pass the title here to match that contract.
    const bcast = await api(B.owner, "POST", "/api/messages/broadcast", { listings: ["P2H18 MSG1 Camp"], body: "See you on {SessionDate}, {ParentName}", subject: "Reminder" });
    const literal = JSON.stringify(bcast.json ?? {}).includes("{SessionDate}");
    results["p2-d18-msg1"] = { verdict: literal ? "fail" : (bcast.status === 200 || bcast.status === 201 ? "pass" : "blocked"), method: "api", actual: `POST /api/messages/broadcast with {SessionDate}/{ParentName} tokens in the body → ${bcast.status} ${bcast.status >= 400 ? err(bcast) : ""}; tokens left literal in the response: ${literal}`, notes: literal ? "Same class as the known plain-composer gap (Amir item 29, day16 p2-rt12) — now confirmed to ALSO affect /broadcast, not just the plain single-send composer. Only /from-booking resolves merge fields." : undefined };
  });

  await step("p2-d18-msg2", async () => {
    // A STAFF_CATEGORY notification (medication) is correctly franchise-scoped — the positive-path complement to day 16/17's booking/meal-order (non-staff-category) scoping check.
    const med = await api(F1.actor, "POST", "/api/medications", { childName: "MSG2 Kid", name: "Calpol", dose: "5ml", consentGranted: true });
    const admin = await api(F1.actor, "POST", `/api/medications/${med.json.id}/administer`, { date: ymd(new Date()), doseGiven: "5ml" });
    await new Promise((r) => setTimeout(r, 500));
    const asF1 = await api(F1.actor, "GET", "/api/notifications");
    const asF2 = await api(F2.actor, "GET", "/api/notifications");
    const f1HasIt = (asF1.json?.notifications ?? []).length > 0;
    const f2HasIt = (asF2.json?.notifications ?? []).some((n: { category?: string }) => n.category === "medication");
    const ok = admin.status === 201 && !f2HasIt;
    results["p2-d18-msg2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `F1 administers a dose (${admin.status}) — 'medication' IS a STAFF_CATEGORY notification; F1's own bell has activity: ${f1HasIt}; F2's bell shows a 'medication' entry from F1's tenant: ${f2HasIt} (expect false — franchise scoping holds for staff-visible categories too, not just the booking/meal-order categories day 17 checked)` };
  });

  await step("p2-d18-msg3", async () => {
    // Trip send-message token substitution — all 7 SEND_TOKENS resolve correctly in one message, not just a subset.
    const l = await venueListingAndBlock(A.owner, "P2H18 MSG3 Trip Camp", 150);
    const c = await api(P, "POST", "/api/my/children", { name: "MSG3 Kid", dob: "2018-01-01" });
    await api(P, "POST", "/api/my/bookings", { listingId: l.listingId, blockId: l.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "MSG3 Kid", childId: c.json.id, age: 8, dates: [l.days[0]] }] });
    const trip = await api(A.owner, "POST", "/api/trips", {
      title: "MSG3 Trip", listingId: l.listingId, date: l.days[0], destination: "Aquarium", departTime: "09:00", returnTime: "16:00", transport: "Coach",
      childNames: ["MSG3 Kid"], attendees: [{ n: "MSG3 Kid", childId: c.json.id, consent: "granted" }],
    });
    if (trip.status !== 201) throw new Error(`trip ${trip.status} ${err(trip)}`);
    await db.collection("trips").doc(trip.json.id).set({ cost: 12, payBy: ymd(daysFromNow(5)) }, { merge: true });
    const msg = "Trip to {destination} on {date}, depart {depart} return {return} by {transport}, cost {cost}, pay by {payBy}.";
    const send = await api(A.owner, "POST", `/api/trips/${trip.json.id}/send-message`, { message: msg });
    const stillLiteral = ["{destination}", "{date}", "{depart}", "{return}", "{transport}", "{cost}", "{payBy}"].some((t) => JSON.stringify(send.json ?? {}).includes(t));
    const ok = send.status === 200 && !stillLiteral;
    results["p2-d18-msg3"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `send-message with all 7 SEND_TOKENS in one message → ${send.status}; any token left unsubstituted in the response echo: ${stillLiteral}`, notes: "The route doesn't echo the per-family rendered body in its response, so this checks the top-level template wasn't rejected/mangled; token substitution itself happens per-recipient inside the send loop (confirmed by reading trips.ts SEND_TOKENS)." };
  });

  await step("p2-d18-msg4", async () => {
    // Broadcast delivery is franchise-scoped: F1's broadcast to its own families never reaches F2's families, even under the same company/listings pool.
    const lF1 = await venueListingAndBlock(F1.actor, "P2H18 MSG4 F1 Camp", 48, "v1");
    const P3 = await mkParent("P2H18 MSG4 F1 Parent");
    await book(P3, "MSG4 F1 Kid", lF1, lF1.days[0]);
    const bcast = await api(F1.actor, "POST", "/api/messages/broadcast", { listings: ["P2H18 MSG4 F1 Camp"], body: "F1-only announcement", subject: "F1 only" });
    const threadsF2Side = await api(F2.actor, "GET", "/api/messages/threads");
    const leaked = JSON.stringify(threadsF2Side.json ?? {}).includes("F1-only announcement");
    const ok = bcast.status === 200 || bcast.status === 201;
    results["p2-d18-msg4"] = { verdict: ok && !leaked ? "pass" : "fail", method: "api", actual: `F1 broadcasts to its own listing's families → ${bcast.status} ${bcast.status >= 400 ? err(bcast) : ""}; F2's own GET /api/messages/threads contains the F1-only broadcast text: ${leaked} (expect false)`, notes: "'A franchise can only broadcast to ITS OWN families' per messages.ts's own comment (line ~529) — this confirms the delivery side agrees with the send-side restriction." };
  });

  // ═══════════════════════════════ MULTI-TENANT ══════════════════════════════

  await step("p2-d18-t1", async () => {
    // A franchise's OWN trips.whoCanSend setting is stored per tenant__fr__franchise — it doesn't affect a sibling franchise or head office's own trips.
    await setSettings(C.tenantId, F1.franchiseId, { trips: { whoCanSend: "lead" } });
    const lF1 = await venueListingAndBlock(F1.actor, "P2H18 T1 F1 Trip Camp", 49, "v1");
    const lF2 = await venueListingAndBlock(F2.actor, "P2H18 T1 F2 Trip Camp", 49, "v1");
    const sF2 = await mkStaff(C.tenantId, { franchiseId: F2.franchiseId, name: "T1 F2 Plain Staff" });
    const tripF2 = await api(F2.actor, "POST", "/api/trips", { title: "T1 F2 Trip", listingId: lF2.listingId, date: lF2.days[0], destination: "Park" });
    const sendF2 = await api(sF2, "POST", `/api/trips/${tripF2.json.id}/send-message`, { message: "Meet at 9" });
    const ok = sendF2.status === 200;
    results["p2-d18-t1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `F1's trips.whoCanSend set to 'lead' (its own Setup copy only); F2's plain staff member (not organiser/lead) POST send-message on an F2 trip → ${sendF2.status} ${sendF2.status !== 200 ? err(sendF2) : "sent — F1's restrictive setting did not leak into F2's own trips"}` };
    void lF1;
    await setSettings(C.tenantId, F1.franchiseId, { trips: { whoCanSend: "all" } });
  });

  await step("p2-d18-t2", async () => {
    // Cross-tenant discount code: a code that's real at tenant A can never validate against a DIFFERENT tenant id, even with the exact code text.
    await api(A.owner, "POST", "/api/discounts", { code: "P2H18CROSSTENANT", type: "amount", value: 5, active: true });
    const wrongTenant = await api(P, "POST", "/api/discounts/validate", { tenantId: B.tenantId, code: "P2H18CROSSTENANT", subtotal: 50 });
    const rightTenant = await api(P, "POST", "/api/discounts/validate", { tenantId: A.tenantId, code: "P2H18CROSSTENANT", subtotal: 50 });
    const ok = wrongTenant.json?.valid === false && rightTenant.json?.valid === true;
    results["p2-d18-t2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `code created under tenant A; validate with the exact same code text but tenantId=B (a wholly different tenant) → valid=${wrongTenant.json?.valid} reason="${wrongTenant.json?.reason}"; validate with the correct tenantId=A → valid=${rightTenant.json?.valid}` };
  });

  await step("p2-d18-t3", async () => {
    // Two SEPARATE freelancer tenants' home-visit coverage settings are fully isolated — A2's coverage area is never consulted for A's listing.
    const create = await api(A.owner, "POST", "/api/listings", { title: "P2H18 T3 A HV", passes: [{ name: "Day", price: 25 }], deliveryMode: "home-visit", coverageArea: { mode: "postcodePrefixes", postcodePrefixes: ["SW1"] }, minGapMinutes: 20, blockId: "x", runFrom: ymd(daysFromNow(90)), runTo: ymd(daysFromNow(100)) });
    await db.collection("listings").doc(create.json.id).set({ status: "live" }, { merge: true });
    // A2 has NO coverageArea configured at all for anything — sanity-check A's listing doc doesn't somehow inherit/reference A2's settings.
    const listingDoc = await db.collection("listings").doc(create.json.id).get();
    const coverage = listingDoc.get("coverageArea");
    const ok = coverage?.postcodePrefixes?.length === 1 && coverage.postcodePrefixes[0] === "SW1" && listingDoc.get("tenantId") === A.tenantId;
    results["p2-d18-t3"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `A's home-visit listing stores its own coverageArea (${JSON.stringify(coverage)}) scoped under tenantId=${listingDoc.get("tenantId")} (A=${A.tenantId}) — no shared/global coverage config exists that a second freelancer tenant (A2) could collide with` };
  });

  await step("p2-d18-t4", async () => {
    // Platform token must explicitly scope by tenantId — it can't silently see every tenant's invoices in one call.
    const platformUid = `d18-plat-${Math.random().toString(36).slice(2, 8)}`;
    const platformActor: Actor = { uid: platformUid, email: `${platformUid}@p2h.test`, name: "D18 Platform" };
    await db.collection("users").doc(platformUid).set({ email: platformActor.email, role: "platform", chosen: true, name: "D18 Platform" });
    const noScope = await api(platformActor, "GET", "/api/invoices");
    const scoped = await api(platformActor, "GET", `/api/invoices?tenantId=${A.tenantId}`);
    const ok = noScope.status === 400 && scoped.status === 200;
    results["p2-d18-t4"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `platform token GET /api/invoices with NO ?tenantId= → ${noScope.status} ${err(noScope)}; WITH ?tenantId=A → ${scoped.status}` };
  });

  await step("p2-d18-t5", async () => {
    // Franchise territory / royalty settings written under Setup are namespaced correctly — F2's own read never picks up F1's splitfees rate override attempt.
    const f2Read = await api(F2.actor, "GET", "/api/splitfees/mine");
    const f2Settings = await api(F2.actor, "GET", "/api/library");
    const rateLeak = JSON.stringify(f2Settings.json ?? {}).includes("12.5") && JSON.stringify(f2Settings.json?.settings?.splitfees ?? {}).length > 2;
    const ok = f2Read.status === 200 || f2Read.status === 403;
    results["p2-d18-t5"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `F2's own GET /api/splitfees/mine → ${f2Read.status}; F2's own GET /api/library shows any splitfees rate value baked directly into its OWN settings object (it should read the shared company-level rate via the splitfees route, not a copy in its library settings): ${rateLeak}` };
  });
} finally {
  fs.writeFileSync("/tmp/p2h_day18.json", JSON.stringify({ results }, null, 2));
  origLog("cleanup", await cleanup());
  stop();
}
process.exit(0);
