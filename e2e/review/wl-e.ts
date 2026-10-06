import * as L from "./wl-lib";
const { A, call, ok, check, eq, must, book, firstBooking, sd, opAction, myBooking, mkListing, mailCount } = L;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mon = sd(0, 0), tue = sd(0, 1), wed = sd(0, 2);
const dayOf = async (Lx: L.Listing, d: string) => (await L.blockDoc("pv", Lx.id, Lx.blockId))?.sessions?.find((s: any) => s.date === d)?.bookedCount;
const st = async (k: string, ref: string) => (await myBooking(k, ref))?.status;
(async () => {
  // ---- E1 provider cancels a confirmed booking -> auto offer
  const La = await mkListing("pv", "WL E1 auto", { maxAttendees: "1", waitlistMode: "auto" });
  await check("E01-provider-cancel-triggers-auto-offer", "triggers", async () => {
    const a = firstBooking(await book("pa", La, [mon], "1 day")); const b = firstBooking(await book("pb", La, [mon], "1 day"));
    eq(b.status, "Waitlisted", "pb waits");
    const r = await opAction("pv", a.ref, { type: "cancel", refund: "none" }); eq(r.status, 200, "provider cancel");
    await sleep(3000); eq(await st("pb", b.ref), "Offered", "pb auto-offered after PROVIDER cancels");
    return "provider cancels pa -> pb offered automatically";
  });
  // ---- E2 provider declines an approval-needed booking holding a place -> auto offer
  const Lb = await mkListing("pv", "WL E2 approval", { maxAttendees: "1", waitlistMode: "auto", bookingType: "manual" });
  await check("E02-decline-pending-frees-place", "triggers", async () => {
    const a = firstBooking(await book("pa", Lb, [mon], "1 day")); eq(a.status, "Approval needed", "pa pending");
    const b = firstBooking(await book("pb", Lb, [mon], "1 day")); eq(b.status, "Waitlisted", "pending booking holds the only place -> pb waits");
    const r = await opAction("pv", a.ref, { type: "decline", reason: "full" }); eq(r.status, 200, "decline");
    await sleep(3000); eq(await st("pb", b.ref), "Offered", "pb offered when the pending request is declined");
    return "pa pending holds the place (pb waits); provider declines pa -> pb offered";
  });
  // ---- E3 capacity raised
  const Lc = await mkListing("pv", "WL E3 capacity", { maxAttendees: "1", waitlistMode: "auto" });
  await check("E03-capacity-raised-offers-waiting", "triggers", async () => {
    const a = firstBooking(await book("pa", Lc, [mon], "1 day")); const b = firstBooking(await book("pb", Lc, [mon], "1 day"));
    eq(b.status, "Waitlisted", "pb waits");
    const r = await call("pv", "PUT", `/api/listings/${Lc.id}`, { maxAttendees: "2" }); must(r.status < 300, "raise capacity " + r.status);
    await sleep(4000);
    const bl = await L.blockDoc("pv", Lc.id, Lc.blockId);
    const s = await st("pb", b.ref);
    if (s !== "Offered") throw new Error(`capacity now ${bl?.capacity}/day with 1 booked, but pb is still ${s} (no automatic offer, and no 'spaces' nudge to the queue)`);
    return "capacity 1->2 -> pb auto-offered";
  });
  // ---- E4 multi-child booking needs two seats
  const Ld = await mkListing("pv", "WL E4 seats", { maxAttendees: "2", waitlistMode: "auto" });
  await check("E04-two-children-need-two-seats", "fit", async () => {
    const a = firstBooking(await book("pa", Ld, [mon], "1 day")); const b = firstBooking(await book("pb", Ld, [mon], "1 day"));
    eq(a.status, "Confirmed", "pa"); eq(b.status, "Confirmed", "pb");
    // pc books TWO children in one basket (two items, same dates)
    const r = await call("pc", "POST", "/api/my/bookings", { listingId: Ld.id, blockId: Ld.blockId, method: "card", items: [{ pass: "1 day", child: L.kid(), age: 8, dates: [mon] }, { pass: "1 day", child: L.kid(), age: 9, dates: [mon] }] });
    eq(r.status, 201, "pc basket"); const cs = r.json.bookings;
    must(cs.every((x: any) => x.status === "Waitlisted"), "both siblings waitlist together: " + cs.map((x: any) => x.status));
    const d = firstBooking(await book("pd", Ld, [mon], "1 day")); eq(d.status, "Waitlisted", "pd single waits behind the pair");
    // one seat frees -> the PAIR can't fit (needs 2) so FIFO gap: who gets the single seat?
    await call("pa", "POST", `/api/my/bookings/${a.ref}/cancel`, {}); await sleep(3500);
    const sc = await Promise.all(cs.map((x: any) => st("pc", x.ref))); const sd_ = await st("pd", d.ref);
    return `one seat freed: pair statuses ${sc.join("+")}, single pd ${sd_} (pair at front needs 2 seats; ${sd_ === "Offered" ? "single is offered ahead of the pair (skip)" : "single waits"})`;
  });
  // ---- E5 multi-day pass with one full day waitlists whole booking; per-date queue
  const Le = await mkListing("pv", "WL E5 multiday", { maxAttendees: "1", waitlistMode: "auto" });
  await check("E05-multiday-pass-waits-for-all-days", "fit", async () => {
    const a = firstBooking(await book("pa", Le, [mon], "1 day")); eq(a.status, "Confirmed", "pa fills Mon only");
    const b = firstBooking(await book("pb", Le, [mon, tue, wed], "3 days")); eq(b.status, "Waitlisted", "3-day pass: Mon full -> whole booking waitlists");
    const pos = (await myBooking("pb", b.ref)).waitlist ?? [];
    must(pos.length === 3, "position shown for each of its dates: " + JSON.stringify(pos));
    await call("pa", "POST", `/api/my/bookings/${a.ref}/cancel`, {}); await sleep(3500);
    eq(await st("pb", b.ref), "Offered", "offered once Mon frees (Tue/Wed were free)");
    eq(await dayOf(Le, tue), 1, "Tue seat held"); eq(await dayOf(Le, wed), 1, "Wed seat held");
    return `3-day pass waits on Mon; positions ${pos.map((p: any) => p.date.slice(5) + "#" + p.position).join(",")}; offer holds Mon+Tue+Wed`;
  });
  // ---- E6 multi-week
  const Lf = await mkListing("pv", "WL E6 multiweek", { maxAttendees: "1", waitlistMode: "auto" });
  await check("E06-multiweek-booking-queues-per-week", "fit", async () => {
    const wk2 = Lf.blocks[1];
    const a = firstBooking(await book("pa", Lf, [mon], "1 day")); eq(a.status, "Confirmed", "pa fills week 1 Mon");
    const r = await book("pb", Lf, [mon], "1 day"); const b = firstBooking(r); eq(b.status, "Waitlisted", "pb waits wk1");
    // a basket spanning wk1 Mon (full) and wk2 Mon (free): per-block segments
    const rr = await call("pc", "POST", "/api/my/bookings", { listingId: Lf.id, blockId: Lf.blockId, method: "card", items: [{ pass: "1 day", child: L.kid(), age: 8, dates: [mon, sd(1, 0)] }] });
    if (rr.status >= 300) return `multi-week 2 x 1-day items: HTTP ${rr.status} ${JSON.stringify(rr.json).slice(0, 200)}`;
    const bs = rr.json.bookings; return `multi-week basket -> ${bs.map((x: any) => x.ref + ":" + x.status + "[" + (x.days ?? []).join("/") + "]").join(" ; ")}`;
  });
  console.log("done E"); await L.closeAll(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
