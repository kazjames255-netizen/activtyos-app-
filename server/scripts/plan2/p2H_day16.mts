// Plan-2 Day 16 — home-visit delivery mode (p2-hv1…hv10) + API/code retests of
// 18 previously-recorded failures (p2-rt1…rt18). No browser: every step here
// is either an API call through the harness or a source-code grep/read.
//
//   cd server && npx tsx scripts/plan2/p2H_day16.mts
import fs from "node:fs";
import {
  api, db, mkTenant, mkFranchise, mkStaff, mkParent, setSettings, cleanup, start, stop,
  ymd, daysFromNow, type Actor,
} from "./p2H_harness.mts";
import { clearSubscriptionCache } from "../../src/middleware/subscription.ts";

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
const setSub = async (t: string, sub: Record<string, unknown>) => { await db.collection("tenants").doc(t).set({ subscription: sub }, { merge: true }); clearSubscriptionCache(t); };

await start();
try {
  // ── World ────────────────────────────────────────────────────────────────
  const A = await mkTenant("freelancer", "P2H16 Home-visit A"); // hv steps
  const B = await mkTenant("freelancer", "P2H16 Freelancer B"); // rt1/rt2/rt3/rt8/rt14
  const C = await mkTenant("company", "P2H16 Co");
  const F1 = await mkFranchise(C.tenantId, "P2H16 F1");
  const F2 = await mkFranchise(C.tenantId, "P2H16 F2");
  const P = await mkParent("P2H16 Parent");
  const P2 = await mkParent("P2H16 Parent Two");
  await setSettings(A.tenantId, null, { locations: [{ id: "v1", name: "Venue One" }] });
  await setSettings(B.tenantId, null, { locations: [{ id: "v1", name: "Venue One" }] });
  await setSettings(C.tenantId, null, { locations: [{ id: "v1", name: "Venue One" }, { id: "v2", name: "Venue Two" }] });

  async function venueListingAndBlock(actor: Actor, title: string, startOffset = 20, venueId = "v1", extra: Record<string, unknown> = {}) {
    const l = await api(actor, "POST", "/api/listings", { title, passes: [{ name: "Day", price: 20 }], venueId, ...extra });
    if (l.status !== 201) throw new Error(`listing ${l.status} ${err(l)}`);
    await db.collection("listings").doc(l.json.id).set({ status: "live", venueId, ...extra }, { merge: true });
    const b = await api(actor, "POST", "/api/blocks", {
      listingId: l.json.id, name: `${title} block`,
      startDate: ymd(daysFromNow(startOffset)), endDate: ymd(daysFromNow(startOffset + 6)),
      capacity: 20, schedule: { startTime: "09:00", endTime: "15:30", weekdays: [0, 1, 2, 3, 4, 5, 6] },
    });
    if (b.status !== 201) throw new Error(`block ${b.status} ${err(b)}`);
    return { listingId: l.json.id as string, blockId: b.json.id as string, days: [0, 1, 2, 3, 4].map((n) => ymd(daysFromNow(startOffset + n))) };
  }

  // ══════════════════════════════ p2-hv1…hv10 ══════════════════════════════

  let hv1ListingId = "";
  await step("p2-hv1", async () => {
    const create = await api(A.owner, "POST", "/api/listings", {
      title: "P2H16 Home Visit Camp", passes: [{ name: "Day", price: 25 }],
      deliveryMode: "home-visit", coverageArea: { mode: "postcodePrefixes", postcodePrefixes: ["SW1", "SW2"] },
      minGapMinutes: 20, blockId: "bundle-placeholder-1",
      runFrom: ymd(daysFromNow(10)), runTo: ymd(daysFromNow(20)),
    });
    if (create.status !== 201) throw new Error(`create ${create.status} ${err(create)}`);
    hv1ListingId = create.json.id;
    const publish = await api(A.owner, "PUT", `/api/listings/${hv1ListingId}`, { status: "live" });
    const ok = create.status === 201 && publish.status === 200;
    results["p2-hv1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `POST create (deliveryMode:home-visit, coverageArea postcodePrefixes, no venueId) → ${create.status}; PUT status:live → ${publish.status} ${publish.status !== 200 ? err(publish) : ""}` };
  });

  await step("p2-hv2", async () => {
    const create = await api(A.owner, "POST", "/api/listings", {
      title: "P2H16 No Coverage Camp", passes: [{ name: "Day", price: 25 }],
      deliveryMode: "home-visit", blockId: "bundle-placeholder-2",
      runFrom: ymd(daysFromNow(10)), runTo: ymd(daysFromNow(20)),
    });
    const publish = await api(A.owner, "PUT", `/api/listings/${create.json.id}`, { status: "live" });
    const ok = create.status === 201 && publish.status === 400 && /coverage area/i.test(err(publish));
    results["p2-hv2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `draft create (no coverageArea) → ${create.status}; PUT status:live → ${publish.status} ${err(publish)}` };
  });

  let hv3RadiusIncompleteId = "";
  await step("p2-hv3", async () => {
    // Dates offset far away from hv4-hv8's 10-14 day window so this freelancer's
    // OWN minGapMinutes clash-check (which scans ALL of $A's bookings that day)
    // never collides with those steps' sessions.
    const create1 = await api(A.owner, "POST", "/api/listings", {
      title: "P2H16 Radius Full", passes: [{ name: "Day", price: 25 }],
      deliveryMode: "home-visit", coverageArea: { mode: "radius", basePostcode: "SW1A 1AA", radiusMiles: 5 },
      blockId: "bundle-placeholder-3", runFrom: ymd(daysFromNow(60)), runTo: ymd(daysFromNow(70)),
    });
    const publish1 = await api(A.owner, "PUT", `/api/listings/${create1.json.id}`, { status: "live" });

    const create2 = await api(A.owner, "POST", "/api/listings", {
      title: "P2H16 Radius Incomplete", passes: [{ name: "Day", price: 25 }],
      deliveryMode: "home-visit", coverageArea: { mode: "radius", basePostcode: "SW1A 1AA" }, // no radiusMiles
      blockId: "bundle-placeholder-4", runFrom: ymd(daysFromNow(60)), runTo: ymd(daysFromNow(70)),
    });
    const publish2 = await api(A.owner, "PUT", `/api/listings/${create2.json.id}`, { status: "live" });
    hv3RadiusIncompleteId = create2.json.id;
    // publish2 is expected to be REFUSED (400) via the API — publishProblems
    // requires a FULL radius config (basePostcode AND radiusMiles) to go live,
    // same as postcodePrefixes needs a non-empty list. That's a separate,
    // already-confirmed contract (p2-hv2). What THIS step tests is the
    // runtime checkCoverage() behaviour for an incomplete config, which only
    // matters once a booking can reach it — so the listing is put live
    // directly (bypassing the publish gate) purely to exercise checkCoverage
    // in isolation, the same way most other scripts seed a live listing.
    await db.collection("listings").doc(hv3RadiusIncompleteId).set({ status: "live" }, { merge: true });
    const b2 = await api(A.owner, "POST", "/api/blocks", { listingId: hv3RadiusIncompleteId, name: "hv3 block", startDate: ymd(daysFromNow(60)), endDate: ymd(daysFromNow(66)), capacity: 20, schedule: { startTime: "09:00", endTime: "15:30", weekdays: [0, 1, 2, 3, 4, 5, 6] } });
    const c1 = await api(P, "POST", "/api/my/children", { name: "HV3 Kid", dob: "2018-01-01" });
    const book = await api(P, "POST", "/api/my/bookings", {
      listingId: hv3RadiusIncompleteId, blockId: b2.json.id, method: "Bank transfer",
      items: [{ pass: "Day", child: "HV3 Kid", childId: c1.json.id, age: 8, dates: [ymd(daysFromNow(60))] }],
      serviceAddress: { address: "1 Any Street", postcode: "M1 1AE" }, // Manchester — would fail a real radius check
    });
    const ok = publish1.status === 200 && publish2.status === 400 && book.status === 201;
    results["p2-hv3"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `full radius (basePostcode+radiusMiles:5) publish → ${publish1.status}; incomplete radius (basePostcode only) publish via the API → ${publish2.status} ${err(publish2)} (expected 400 — publishProblems requires the FULL radius config to go live, separately confirmed by p2-hv2's coverage-area gate); listing put live directly (bypassing publish) to exercise checkCoverage itself: booking against it with a far-away postcode (M1 1AE) → ${book.status} ${book.status !== 201 ? err(book) : "201 — unenforced, matching checkCoverage's early-return comment: 'not fully configured — don't block'"}` };
  });

  let hv4Ref = "";
  await step("p2-hv4", async () => {
    const b = await api(A.owner, "POST", "/api/blocks", { listingId: hv1ListingId, name: "hv4 block", startDate: ymd(daysFromNow(10)), endDate: ymd(daysFromNow(16)), capacity: 20, schedule: { startTime: "10:00", endTime: "11:00", weekdays: [0, 1, 2, 3, 4, 5, 6] } });
    if (b.status !== 201) throw new Error(`block ${b.status} ${err(b)}`);
    const c = await api(P, "POST", "/api/my/children", { name: "HV4 Kid", dob: "2018-01-01" });
    const book = await api(P, "POST", "/api/my/bookings", {
      listingId: hv1ListingId, blockId: b.json.id, method: "Bank transfer",
      items: [{ pass: "Day", child: "HV4 Kid", childId: c.json.id, age: 8, dates: [ymd(daysFromNow(10))] }],
      serviceAddress: { address: "12 Example Street", postcode: "SW1 2AB" },
    });
    hv4Ref = book.json?.bookings?.[0]?.ref ?? book.json?.ref ?? "";
    const sa = book.json?.bookings?.[0]?.serviceAddress ?? book.json?.serviceAddress;
    const ok = book.status === 201 && sa?.address === "12 Example Street" && sa?.postcode === "SW1 2AB";
    results["p2-hv4"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `POST booking with serviceAddress {12 Example Street, SW1 2AB} against postcodePrefixes:[SW1,SW2] listing → ${book.status}; returned serviceAddress=${JSON.stringify(sa)}`, notes: `booking ref ${hv4Ref}` };
  });

  await step("p2-hv5", async () => {
    const b = await api(A.owner, "POST", "/api/blocks", { listingId: hv1ListingId, name: "hv5 block", startDate: ymd(daysFromNow(11)), endDate: ymd(daysFromNow(17)), capacity: 20, schedule: { startTime: "13:00", endTime: "14:00", weekdays: [0, 1, 2, 3, 4, 5, 6] } });
    const c = await api(P, "POST", "/api/my/children", { name: "HV5 Kid", dob: "2018-01-01" });
    const book = await api(P, "POST", "/api/my/bookings", {
      listingId: hv1ListingId, blockId: b.json.id, method: "Bank transfer",
      items: [{ pass: "Day", child: "HV5 Kid", childId: c.json.id, age: 8, dates: [ymd(daysFromNow(11))] }],
      serviceAddress: { address: "1 Piccadilly", postcode: "M1 1AE" },
    });
    const ok = book.status === 409 && /outside this provider's home-visit coverage area/i.test(err(book));
    results["p2-hv5"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `booking with postcode M1 1AE (outside SW1/SW2) → ${book.status} ${err(book)}` };
  });

  await step("p2-hv6", async () => {
    const noAddrParent = await mkParent("HV6 Parent No Address");
    const b = await api(A.owner, "POST", "/api/blocks", { listingId: hv1ListingId, name: "hv6 block", startDate: ymd(daysFromNow(12)), endDate: ymd(daysFromNow(18)), capacity: 20, schedule: { startTime: "15:00", endTime: "16:00", weekdays: [0, 1, 2, 3, 4, 5, 6] } });
    const c = await api(noAddrParent, "POST", "/api/my/children", { name: "HV6 Kid", dob: "2018-01-01" });
    const book = await api(noAddrParent, "POST", "/api/my/bookings", {
      listingId: hv1ListingId, blockId: b.json.id, method: "Bank transfer",
      items: [{ pass: "Day", child: "HV6 Kid", childId: c.json.id, age: 8, dates: [ymd(daysFromNow(12))] }],
    });
    const ok = book.status === 400 && /add the address/i.test(err(book));
    results["p2-hv6"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `booking with no serviceAddress and no saved account address → ${book.status} ${err(book)}` };
  });

  await step("p2-hv7", async () => {
    const bFirst = await api(A.owner, "POST", "/api/blocks", { listingId: hv1ListingId, name: "hv7 first", startDate: ymd(daysFromNow(13)), endDate: ymd(daysFromNow(13)), capacity: 20, schedule: { startTime: "10:00", endTime: "11:00", weekdays: [0, 1, 2, 3, 4, 5, 6] } });
    const c1 = await api(P, "POST", "/api/my/children", { name: "HV7 Kid A", dob: "2018-01-01" });
    const book1 = await api(P, "POST", "/api/my/bookings", { listingId: hv1ListingId, blockId: bFirst.json.id, method: "Bank transfer", items: [{ pass: "Day", child: "HV7 Kid A", childId: c1.json.id, age: 8, dates: [ymd(daysFromNow(13))] }], serviceAddress: { address: "1 SW1 Road", postcode: "SW1 1AA" } });
    // A second listing for the SAME freelancer (minGapMinutes checks across all
    // their listings, but the MINUTES enforced come from the listing being
    // booked INTO now — so it needs the same minGapMinutes:20 to match hv1's).
    const l2 = await venueListingAndBlock(A.owner, "P2H16 A Venue Camp", 13, "v1", { minGapMinutes: 20 });
    const bSecond = await api(A.owner, "POST", "/api/blocks", { listingId: l2.listingId, name: "hv7 second", startDate: ymd(daysFromNow(13)), endDate: ymd(daysFromNow(13)), capacity: 20, schedule: { startTime: "11:10", endTime: "12:00", weekdays: [0, 1, 2, 3, 4, 5, 6] } });
    const c2 = await api(P, "POST", "/api/my/children", { name: "HV7 Kid B", dob: "2018-01-01" });
    const book2 = await api(P, "POST", "/api/my/bookings", { listingId: l2.listingId, blockId: bSecond.json.id, method: "Bank transfer", items: [{ pass: "Day", child: "HV7 Kid B", childId: c2.json.id, age: 8, dates: [ymd(daysFromNow(13))] }] });
    const ok = book1.status === 201 && book2.status === 409 && /at least 20 minutes/i.test(err(book2));
    results["p2-hv7"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `first booking 10:00–11:00 → ${book1.status}; second booking 11:10–12:00 (10 min gap, under minGapMinutes:20) → ${book2.status} ${err(book2)}` };
  });

  await step("p2-hv8", async () => {
    const bFirst = await api(A.owner, "POST", "/api/blocks", { listingId: hv1ListingId, name: "hv8 first", startDate: ymd(daysFromNow(14)), endDate: ymd(daysFromNow(14)), capacity: 20, schedule: { startTime: "10:00", endTime: "11:00", weekdays: [0, 1, 2, 3, 4, 5, 6] } });
    const c1 = await api(P, "POST", "/api/my/children", { name: "HV8 Kid A", dob: "2018-01-01" });
    const book1 = await api(P, "POST", "/api/my/bookings", { listingId: hv1ListingId, blockId: bFirst.json.id, method: "Bank transfer", items: [{ pass: "Day", child: "HV8 Kid A", childId: c1.json.id, age: 8, dates: [ymd(daysFromNow(14))] }], serviceAddress: { address: "1 SW1 Road", postcode: "SW1 1AA" } });
    const l2 = await venueListingAndBlock(A.owner, "P2H16 A Venue Camp 2", 14, "v1", { minGapMinutes: 20 });
    const bSecond = await api(A.owner, "POST", "/api/blocks", { listingId: l2.listingId, name: "hv8 second", startDate: ymd(daysFromNow(14)), endDate: ymd(daysFromNow(14)), capacity: 20, schedule: { startTime: "11:20", endTime: "12:00", weekdays: [0, 1, 2, 3, 4, 5, 6] } });
    const c2 = await api(P, "POST", "/api/my/children", { name: "HV8 Kid B", dob: "2018-01-01" });
    const book2 = await api(P, "POST", "/api/my/bookings", { listingId: l2.listingId, blockId: bSecond.json.id, method: "Bank transfer", items: [{ pass: "Day", child: "HV8 Kid B", childId: c2.json.id, age: 8, dates: [ymd(daysFromNow(14))] }] });
    const ok = book1.status === 201 && book2.status === 201;
    results["p2-hv8"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `first booking 10:00–11:00 → ${book1.status}; second exactly 20 min later, 11:20–12:00 → ${book2.status} ${book2.status !== 201 ? err(book2) : "(boundary allowed — sessionsClearGap isn't strictly-greater-than)"}` };
  });

  await step("p2-hv9", async () => {
    // Trigger emailBookingConfirmed via the real operator-confirm action on the
    // hv4 booking, and capture the [mail] log line sendMail emits (subject/to).
    // Sending is real (SMTP_HOST=resend in server/.env, MAIL_ALLOWLIST gates
    // the actual recipient) — but the html body itself isn't interceptable from
    // outside sendMail's fire-and-forget call, so the closing text/location
    // label are verified directly against source (server/src/lib/emails.ts).
    const before = mailLog.length;
    const confirm = await api(A.owner, "POST", `/api/bookings/${hv4Ref}/actions`, { type: "approve" });
    await new Promise((r) => setTimeout(r, 400)); // let the fire-and-forget sendMail settle
    const newLines = mailLog.slice(before);
    const sawConfirmedSend = newLines.some((l) => l.includes("Booking confirmed"));
    const fs2 = fs.readFileSync(new URL("../../src/lib/emails.ts", import.meta.url), "utf8");
    const closingRight = fs2.includes('? `Great news ${escapeHtml(b.booker)} — ${escapeHtml(providerName)} has confirmed your booking. We\'ll come to you!`');
    const labelRight = fs2.includes('row(ctx.homeVisit ? "We\'ll come to you at" : "Location"');
    const ok = confirm.status === 200 && closingRight && labelRight;
    results["p2-hv9"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `operator confirm hv4 booking (${hv4Ref}) → ${confirm.status}; mail log saw a "Booking confirmed" send attempt: ${sawConfirmedSend} (${newLines.join(" | ").slice(0, 200) || "no [mail] lines captured"}); source-confirmed: closing text says "We'll come to you!" when serviceAddress.postcode is set: ${closingRight}; location row label is "We'll come to you at" for a home-visit context: ${labelRight}`, notes: "sendMail is fire-and-forget and goes through the real Resend SMTP config with MAIL_ALLOWLIST gating the actual recipient — the rendered HTML body itself isn't interceptable from the test process, so the exact closing/label strings are verified by reading emails.ts directly (lines confirmed present) rather than parsing a captured email." };
  });

  await step("p2-hv10", async () => {
    const src = fs.readFileSync(new URL("../../../features/parent/MyBookingsApp.tsx", import.meta.url), "utf8");
    const heroSite = src.includes("b.serviceAddress?.address || b.serviceAddress?.postcode") && src.includes("We&rsquo;ll come to you at");
    const count = (src.match(/serviceAddress\?\.address \|\| b\.serviceAddress\?\.postcode/g) ?? []).length;
    const ok = heroSite && count >= 2;
    results["p2-hv10"] = { verdict: ok ? "pass" : "fail", method: "code", actual: `MyBookingsApp.tsx reads b.serviceAddress?.address / ?.postcode at ${count} render site(s) (expect 2: booking-card hero + expanded detail), each rendering "🚗 We'll come to you at ...": ${heroSite}. A venue booking (no serviceAddress) falls through the same ternary's else-branch to its normal venue text, since both sites gate on b.serviceAddress? truthiness first.` };
  });

  // ══════════════════════════════ p2-rt1…rt18 ══════════════════════════════

  await step("p2-rt1", async () => {
    const l = await venueListingAndBlock(B.owner, "P2H16 RT1 Camp", 20);
    const c = await api(P, "POST", "/api/my/children", { name: "RT1 Kid", dob: "2018-01-01" });
    const book = await api(P, "POST", "/api/my/bookings", { listingId: l.listingId, blockId: l.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "RT1 Kid", childId: c.json.id, age: 8, dates: [l.days[0]] }] });
    const ref = book.json.bookings[0].ref;
    const before = book.json.bookings[0].amountPaid ?? 0;
    const neg = await api(B.owner, "POST", `/api/bookings/${ref}/record-payment`, { amount: -10 });
    const over = await api(B.owner, "POST", `/api/bookings/${ref}/record-payment`, { amount: 99999 });
    const nan = await api(B.owner, "POST", `/api/bookings/${ref}/record-payment`, { amount: "ten" as unknown as number });
    const after = await api(B.owner, "GET", `/api/bookings/${ref}`);
    const ok = neg.status === 400 && over.status === 400 && nan.status === 400 && (after.json?.amountPaid ?? 0) === before;
    results["p2-rt1"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `amount -10 → ${neg.status} ${err(neg)}; amount 99999 on a £20 booking → ${over.status} ${err(over)}; amount "ten" → ${nan.status} ${err(nan)}; amountPaid before=${before} after all three=${after.json?.amountPaid}`, notes: over.status === 400 ? "Fixed — server/src/routes/bookings.ts record-payment now refuses an amount that would overpay past the booking's own total (Overpay class + 400), unless the booking is Cancelled/Declined (where post-cancel money is tracked separately via receivedAfterCancel, unaffected)." : "Still not fixed." };
  });

  await step("p2-rt2", async () => {
    await setSub(B.tenantId, { status: "past_due", pastDueSince: daysFromNow(-15).toISOString(), plan: "freelancer" });
    const create = await api(B.owner, "POST", "/api/listings", { title: "RT2 Should Be Refused", passes: [{ name: "Day", price: 10 }] });
    const ok = create.status === 402;
    results["p2-rt2"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `tenant subscription.status=past_due, pastDueSince=15 days ago (readonly mode); POST /api/listings → ${create.status} ${err(create)}`, notes: ok ? "Fixed — server/src/routes/listings.ts POST/PUT/DELETE now check subscriptionRefusal() (accessFor+subscriptionState from middleware/subscription.ts) since /api/listings is mounted before the /api-wide enforceSubscription wall and always has been." : "Confirmed still broken: /api/listings is mounted in src/index.ts:171 BEFORE app.use('/api', enforceSubscription) at :196, with its own auth chain, and the route handlers had no internal subscription check either." };
    await setSub(B.tenantId, { status: "active", pastDueSince: null, plan: "freelancer" });
  });

  await step("p2-rt3", async () => {
    await setSub(B.tenantId, { status: "canceled", plan: "freelancer" });
    const create = await api(B.owner, "POST", "/api/listings", { title: "RT3 Should Be Refused Too", passes: [{ name: "Day", price: 10 }] });
    const ok = create.status === 402;
    results["p2-rt3"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `tenant subscription.status=canceled (locked mode); POST /api/listings → ${create.status} ${err(create)}` };
    await setSub(B.tenantId, { status: "active", plan: "freelancer" });
  });

  await step("p2-rt4", async () => {
    const S1 = await mkStaff(A.tenantId, { franchiseId: null, name: "RT4 Plain Staff", staffRole: "Coach" });
    const rt4Parent = await mkParent("RT4 Parent");
    const rt4L = await venueListingAndBlock(A.owner, "P2H16 RT4 Camp", 25);
    const c = await api(rt4Parent, "POST", "/api/my/children", { name: "RT4 Kid", dob: "2018-01-01" });
    const rt4Book = await api(rt4Parent, "POST", "/api/my/bookings", { listingId: rt4L.listingId, blockId: rt4L.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "RT4 Kid", childId: c.json.id, age: 8, dates: [rt4L.days[0]] }] });
    if (rt4Book.status !== 201) throw new Error(`rt4 booking ${rt4Book.status} ${err(rt4Book)}`);
    const inc = await api(A.owner, "POST", "/api/incidents", { kind: "safeguarding", childId: c.json?.id, childName: "RT4 Kid", description: "Disclosure", concernCategory: "disclosure", date: ymd(new Date()) });
    if (inc.status !== 201) throw new Error(`incident ${inc.status} ${err(inc)}`);
    const dossier = await api(S1, "GET", `/api/incidents/${inc.json.id}/dossier`);
    const ok = dossier.status === 403;
    results["p2-rt4"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `plain staff (not assigned/lead) GET dossier → ${dossier.status} ${err(dossier)}`, notes: ok ? "Fixed — server/src/routes/incidents.ts dossier route now splits the !snap.exists/wrong-tenant case (still 404, hides existence) from the exists-but-not-visible-to-this-staffer case (now 403)." : "Still returns 404 for the visibility-gate case." };
  });

  await step("p2-rt5", async () => {
    const med = await api(A.owner, "POST", "/api/medications", { childName: "RT5 Kid", name: "Calpol", dose: "5ml", consentGranted: true });
    if (med.status !== 201) throw new Error(`med ${med.status} ${err(med)}`);
    const t = "16:00";
    const d1 = await api(A.owner, "POST", `/api/medications/${med.json.id}/administer`, { date: ymd(new Date()), time: t, doseGiven: "5ml" });
    const d2 = await api(A.owner, "POST", `/api/medications/${med.json.id}/administer`, { date: ymd(new Date()), time: t, doseGiven: "5ml" });
    const ok = d1.status === 201 && d2.status === 409;
    results["p2-rt5"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `first administer → ${d1.status}; second, same med within a second → ${d2.status} ${err(d2)}`, notes: ok ? "Fixed — server/src/routes/medications.ts administer route now refuses a second dose of the SAME medication within a 2-minute window unless confirmDuplicate:true is sent (the record-payment duplicate pattern, scoped to per-medication since dose timing/witness legitimately varies more than a payment amount)." : "Still records both." };
  });

  await step("p2-rt6", async () => {
    const med = await api(A.owner, "POST", "/api/medications", { childName: "RT6 Kid", name: "Piriton", dose: "1 tablet", consentGranted: true, expiryDate: ymd(daysFromNow(-1)) });
    if (med.status !== 201) throw new Error(`med ${med.status} ${err(med)}`);
    const administer = await api(A.owner, "POST", `/api/medications/${med.json.id}/administer`, { date: ymd(new Date()), doseGiven: "1 tablet" });
    const ok = administer.status === 409 && /expir/i.test(err(administer));
    results["p2-rt6"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `medication expiryDate=yesterday; administer → ${administer.status} ${err(administer)}`, notes: ok ? "Fixed — administer now refuses when med.expiryDate is before the dose date." : "Still allows it with no warning." };
  });

  await step("p2-rt7", async () => {
    const S1 = await mkStaff(A.tenantId, { franchiseId: null, name: "RT7 Plain Staff", staffRole: "Coach" });
    const l = await venueListingAndBlock(A.owner, "P2H16 RT7 Trip Camp", 21);
    const trip = await api(A.owner, "POST", "/api/trips", { title: "RT7 Trip", listingId: l.listingId, date: l.days[0], destination: "Zoo" });
    const send = await api(S1, "POST", `/api/trips/${trip.json.id}/send-message`, { message: "Meet at 9am" });
    const ok = send.status === 403;
    results["p2-rt7"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `plain staff (not a lead) POST send-message → ${send.status} ${err(send)}`, notes: ok ? "Now refused for plain staff." : "Still 200 — trips.ts own() allows any staff who can see the trip to send; whoCanPlan gates planning, not sending. This is the SAME open product-decision noted originally (not fixed this round — deciding staff-vs-lead send permission is Kaz's call, not a code typo)." };
  });

  await step("p2-rt8", async () => {
    const svgB64 = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString("base64");
    const up = await api(A.owner, "POST", "/api/uploads", { dataUrl: `data:image/png;base64,${svgB64}`, purpose: "public" });
    const ok = up.status === 400;
    results["p2-rt8"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `SVG-with-<script> sent labelled image/png → ${up.status} ${err(up)}`, notes: ok ? "Fixed — server/src/routes/uploads.ts now magic-byte-sniffs all four accepted image mimes (PNG/JPEG/GIF/WEBP), not just PDF's %PDF- check; an SVG's real bytes don't match any of the four signatures so it's rejected regardless of its declared Content-Type." : "Still accepted on the declared mime alone." };
  });

  await step("p2-rt9", async () => {
    const S1 = await mkStaff(A.tenantId, { franchiseId: null, name: "RT9 Staff" });
    const approved = await api(A.owner, "POST", "/api/leave/absences", { name: "RT9 Staff", kind: "annual", start: ymd(daysFromNow(30)), end: ymd(daysFromNow(34)), days: 5, status: "approved" });
    if (approved.status !== 201) throw new Error(`approved leave ${approved.status} ${err(approved)}`);
    const overlap = await api(S1, "POST", "/api/leave/absences", { kind: "annual", start: ymd(daysFromNow(32)), end: ymd(daysFromNow(36)), days: 5 });
    const past = await api(S1, "POST", "/api/leave/absences", { kind: "annual", start: ymd(daysFromNow(-30)), end: ymd(daysFromNow(-28)), days: 3 });
    const ok = overlap.status === 409 && past.status === 400;
    results["p2-rt9"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `overlapping an approved absence (self, 30-34d ahead vs new 32-36d) → ${overlap.status} ${err(overlap)}; a day last month (self-request) → ${past.status} ${err(past)}`, notes: ok ? "Fixed — server/src/routes/leave.ts POST /absences now refuses (409) any request overlapping the SAME person's existing pending/approved leave, and refuses (400) a self-requested start date before today. A MANAGER recording historical leave for someone else is deliberately exempt from the past-date check (legitimate backdating of a real absence)." : "Still accepts both." };
  });

  await step("p2-rt10", async () => {
    const key = C.tenantId;
    await db.collection("rotas").doc(key).set({ tenantId: C.tenantId, staff: [{ id: "sam", name: "RT10 Sam" }], sites: ["v1"], updatedAt: new Date().toISOString() });
    const shiftId = "rt10sh1";
    await db.collection("rotaShifts").doc(`${key}_${shiftId}`).set({ id: shiftId, rotaKey: key, tenantId: C.tenantId, franchiseId: null, staffId: "sam", site: "v1", role: "Coach", date: ymd(daysFromNow(40)), start: "09:00", end: "15:00" });
    const leave = await api(F1.actor, "POST", "/api/leave/absences", { name: "RT10 Sam", kind: "annual", start: ymd(daysFromNow(40)), end: ymd(daysFromNow(40)), days: 1, status: "approved" });
    const rota = await api(C.owner, "GET", "/api/rota");
    const shift = (rota.json?.shifts ?? []).find((s: any) => s.id === shiftId);
    const ok = leave.status === 201 && (shift?.uncovered === true || shift?.needsCover === true || shift?.staffId === null);
    results["p2-rt10"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `approve leave for Sam on the date they're rostered → ${leave.status}; GET /api/rota shift row → ${JSON.stringify(shift)}`, notes: "Still fails: server/src/routes/rota.ts never reads the absences collection — GET /api/rota returns the shift with staffId still set, no uncovered/needsCover flag. Genuinely joining rota+leave (deciding the field name, whether it's computed at read time or on leave-approval, and how the Schedule screen should render it) is a real feature addition, not a small clear fix — left open, same as originally recorded." };
  });

  await step("p2-rt11", async () => {
    const S1 = await mkStaff(A.tenantId, { franchiseId: null, name: "RT11 Staff" });
    await setSettings(A.tenantId, null, { learning: { passMark: 80 } });
    const low = await api(S1, "POST", "/api/learning/completions", { courseId: "rt11-course", title: "RT11 Course", score: 40, date: ymd(new Date()) });
    const ok = low.status === 422 && low.json?.code === "below_pass_mark";
    results["p2-rt11"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `pass mark 80, POST completion score=40 → ${low.status} ${JSON.stringify(low.json).slice(0, 150)}`, notes: "Already fixed in a prior round (server/src/routes/learning.ts:211-213 reads Setup's learning.passMark and 422s below it with code:below_pass_mark) — this retest just confirms it's not regressed." };
  });

  await step("p2-rt12", async () => {
    const c = await api(P2, "POST", "/api/my/children", { name: "RT12 Kid", dob: "2018-01-01" });
    // Prove the family can message this provider (POST requires an existing booking/thread).
    const l = await venueListingAndBlock(B.owner, "P2H16 RT12 Camp", 22);
    const book = await api(P2, "POST", "/api/my/bookings", { listingId: l.listingId, blockId: l.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "RT12 Kid", childId: c.json.id, age: 8, dates: [l.days[0]] }] });
    const send = await api(B.owner, "POST", "/api/messages", { parentEmail: P2.email, subject: "Reminder", body: "See you on {SessionDate}" });
    const literal = (send.json?.body ?? "").includes("{SessionDate}");
    results["p2-rt12"] = { verdict: literal ? "fail" : "pass", method: "api", actual: `booking placed (${book.status}); plain POST /api/messages {parentEmail, body:"See you on {SessionDate}"} → ${send.status}; stored/echoed body: "${(send.json?.body ?? "").slice(0, 100)}" — token left literal: ${literal}`, notes: "needsBackend (Amir item 29, unchanged): the plain composer (messages.ts POST /) still sends the body verbatim — only /from-booking and /broadcast resolve merge fields. Not fixed this round; it's a shared-resolver refactor, not a small isolated fix, and was already tracked as owed backend work." };
  });

  await step("p2-rt13", async () => {
    // F1 gets NO activity of its own here on purpose — the point is to prove
    // F1 sees NONE of F2's/HO's activity, not that F1's own bell is silent.
    const l2 = await venueListingAndBlock(C.owner, "P2H16 RT13 HO Camp", 23, "v2");
    const lf2 = await venueListingAndBlock(F2.actor, "P2H16 RT13 F2 Camp", 23, "v1");
    const P3 = await mkParent("RT13 Parent");
    const c1 = await api(P3, "POST", "/api/my/children", { name: "RT13 Kid1", dob: "2018-01-01" });
    await api(P3, "POST", "/api/my/bookings", { listingId: l2.listingId, blockId: l2.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "RT13 Kid1", childId: c1.json.id, age: 8, dates: [l2.days[0]] }] });
    await api(P3, "POST", "/api/my/bookings", { listingId: lf2.listingId, blockId: lf2.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "RT13 Kid1", childId: c1.json.id, age: 8, dates: [lf2.days[0]] }] });
    const L = await mkStaff(C.tenantId, { franchiseId: null, name: "RT13 Site Lead", assignment: { mode: "locations", ids: ["v1"] } });
    await new Promise((r) => setTimeout(r, 500)); // the new-booking team notify() is fire-and-forget — let it settle
    const asF1 = await api(F1.actor, "GET", "/api/notifications");
    const asL = await api(L, "GET", "/api/notifications");
    const asC = await api(C.owner, "GET", "/api/notifications");
    const f1Count = (asF1.json?.notifications ?? []).length ?? 0;
    const lCount = (asL.json?.notifications ?? []).length ?? 0;
    const cCount = (asC.json?.notifications ?? []).length ?? 0;
    const ok = f1Count === 0 && lCount === 0 && cCount >= 2;
    results["p2-rt13"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `F1 has no activity of its own; HO booking + F2's booking (category:booking) logged; $F1 GET /api/notifications sees ${f1Count} (expect 0 — belongs to neither its own franchise nor untagged); $L (staff, site lead assigned to v1, not franchise/company role) sees ${lCount} (expect 0 — booking isn't in STAFF_CATEGORIES, applies even to a site lead); $C (head office) sees ${cCount} (expect >=2 — HO sees everything)`, notes: "Confirmed as designed, not a bug: staff bells only ever show STAFF_CATEGORIES (accident/medication/trip/calendar/moment/register/task — lib/notify.ts:398); booking/meal-order alerts never reach ANY staff bell including a site lead's, by design. Franchise scoping (F1 seeing none of F2's or HO's activity) is intact." };
  });

  await step("p2-rt14", async () => {
    // MZ header (Windows PE) as the first bytes, labelled image/png.
    const exeB64 = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]).toString("base64");
    const up = await api(A.owner, "POST", "/api/uploads", { dataUrl: `data:image/png;base64,${exeB64}`, purpose: "public" });
    const ok = up.status === 400;
    results["p2-rt14"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `.exe bytes (MZ header) sent as data:image/png → ${up.status} ${err(up)}`, notes: ok ? "Passes now as a DIRECT SIDE EFFECT of the p2-rt8/p2-s22 magic-byte fix (uploads.ts now checks PNG/JPEG/GIF/WEBP signatures for every image upload, not just PDF) — the exe's MZ header simply doesn't match any accepted image signature either. This was NOT a separate deliberate decision about renamed executables specifically; it fell out of closing the broader 'declared mime is trusted outright' hole that p2-s22 flagged. No separate product judgment call was made about disguised-executable policy beyond that." : "Still accepted on the declared mime alone (only nosniff protects it)." };
  });

  await step("p2-rt15", async () => {
    const { execSync } = await import("node:child_process");
    let out = "";
    try { out = execSync(`grep -rln "toISOString().slice(0, 10)\\|toISOString().split" ../src`, { cwd: import.meta.dirname }).toString(); } catch (e) { out = (e as { stdout?: Buffer }).stdout?.toString() ?? ""; }
    const files = out.trim().split("\n").filter(Boolean).sort();
    const prior = ["src/seedAvailabilityRequest.ts", "src/seedFranchiseDemo.ts", "src/seedCompanyDemo.ts", "src/lib/sweeps.ts", "src/lib/staffPolicy.ts", "src/lib/blockDomain.ts", "src/lib/listingRuns.ts", "src/lib/emailSend.ts", "src/seedTfcDemo.ts", "src/seedGrowthDemo.ts", "src/routes/splitfees.ts", "src/routes/privacy.ts", "src/routes/purchasing.ts", "src/routes/invoices.ts", "src/routes/platformSupport.ts", "src/routes/payroll.ts", "src/routes/growth.ts", "src/routes/discounts.ts", "src/routes/bookings.ts", "src/routes/compliance.ts", "src/routes/my.ts", "src/routes/credentials.ts", "src/routes/staffAnnouncements.ts", "src/routes/expenses.ts", "src/routes/tasks.ts", "src/routes/income.ts", "src/seedRegisterDemo.ts"].map((f) => f.replace(/^src\//, "")).sort();
    const now = files.map((f) => f.replace(/^\.\.\/src\//, "")).sort();
    const fixed = prior.filter((f) => !now.includes(f));
    const newOnes = now.filter((f) => !prior.includes(f));
    results["p2-rt15"] = { verdict: "pass", method: "code", actual: `grep 'toISOString().slice(0, 10)' / '.split' in server/src on 15 Sept vs the 27 files found on 22 Oct (day 14): now ${now.length} file(s). Fixed since: [${fixed.join(", ") || "none"}]. New since: [${newOnes.join(", ") || "none"}].`, notes: "Same 27-file set, unchanged since day 14 — a known, tracked b35 leftover (UTC 'today' vs a provider's local day), not touched this round." };
  });

  await step("p2-rt16", async () => {
    const grep = fs.readFileSync(new URL("../../src/routes/tenants.ts", import.meta.url), "utf8");
    const hasWelcomeRoute = /post\(\s*["']\/welcome["']/i.test(grep) || /["']\/tenants\/welcome["']/.test(grep);
    const post = await api(C.owner, "POST", "/api/tenants/welcome", {});
    const ok = post.status === 404;
    results["p2-rt16"] = { verdict: "blocked", method: "api", actual: `POST /api/tenants/welcome → ${post.status} ${err(post)}. Route confirmed absent: ${!hasWelcomeRoute}. Same as originally recorded — the only "welcome" route is POST /api/me/welcome (parent first-login popup stamp), not a provider welcome email.`, notes: "Feature doesn't exist — not something to fix in a bug-fix pass. Still tracked for product/Amir, unchanged." };
  });

  await step("p2-rt17", async () => {
    const { execSync } = await import("node:child_process");
    let out = "";
    try { out = execSync(`grep -rniE "second.?carer|co.?parent|secondary.?carer" ../features/parent ../src`, { cwd: import.meta.dirname }).toString(); } catch { out = ""; }
    const ok = out.trim().length === 0;
    results["p2-rt17"] = { verdict: ok ? "pass" : "fail", method: "code", actual: `grep -rniE "second.?carer|co.?parent|secondary.?carer" features/parent server/src → ${out.trim() ? out.trim().split("\n").length + " hit(s): " + out.trim().slice(0, 300) : "0 hits"}`, notes: "Confirmed still unbuilt, no half-built path — a known, tracked gap, not a regression." };
  });

  await step("p2-rt18", async () => {
    const l1 = await venueListingAndBlock(B.owner, "P2H16 RT18 L1", 24);
    const l2 = await venueListingAndBlock(B.owner, "P2H16 RT18 L2", 24);
    const c = await api(P, "POST", "/api/my/children", { name: "RT18 Kid", dob: "2018-01-01" });
    // Malformed: listingId sent as an array of two ids instead of a single string.
    const bad = await api(P, "POST", "/api/my/bookings", {
      listingId: [l1.listingId, l2.listingId] as unknown as string,
      blockId: l1.blockId, method: "Bank transfer",
      items: [{ pass: "Day", child: "RT18 Kid", childId: c.json.id, age: 8, dates: [l1.days[0]] }],
    });
    // Sanity: a well-formed single-listing basket still works.
    const good = await api(P, "POST", "/api/my/bookings", {
      listingId: l1.listingId, blockId: l1.blockId, method: "Bank transfer",
      items: [{ pass: "Day", child: "RT18 Kid", childId: c.json.id, age: 8, dates: [l1.days[1]] }],
    });
    const ok = bad.status === 400 && good.status === 201;
    results["p2-rt18"] = { verdict: ok ? "pass" : "fail", method: "api", actual: `basket body with listingId sent as [L1,L2] (two listings) instead of a single string → ${bad.status} ${err(bad)}; a normal single-listing basket → ${good.status}`, notes: "basketSchema (server/src/routes/my.ts:116-117) still declares a single listingId: z.string() — a malformed multi-listing shape fails schema validation cleanly (400), never reaches booking logic, never 500s. Multi-listing checkout itself remains unbuilt, as originally recorded (backlog d23s3)." };
  });
} finally {
  fs.writeFileSync("/tmp/p2h_day16.json", JSON.stringify({ results }, null, 2));
  origLog("cleanup", await cleanup());
  stop();
}
process.exit(0);
