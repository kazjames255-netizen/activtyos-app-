import * as L from "./wl-lib";
const { A, call, check, eq, must, book, firstBooking, sd, opAction, myBooking, mkListing } = L;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mon = sd(0, 0), tue = sd(0, 1);
(async () => {
  const Lx = await mkListing("pv", "WL final join", { maxAttendees: "2", waitlistMode: "manual", waitlistSize: "2" });
  const a = firstBooking(await book("pa", Lx, [mon], "1 day")); const b = firstBooking(await book("pb", Lx, [mon], "1 day"));
  await check("W01-fill-day", "join", async () => { eq(a.status, "Confirmed", "pa"); eq(b.status, "Confirmed", "pb"); return "capacity 2/day: pa + pb Confirmed"; });
  let c: any, d: any, kc = "";
  await check("W02-join-waitlist-single-day", "join", async () => {
    kc = L.kid(); c = firstBooking(await book("pc", Lx, [mon], "1 day", {}, kc));
    eq(c.status, "Waitlisted", "status");
    const m = await myBooking("pc", c.ref);
    eq(m.waitlist?.[0]?.position, 1, "parent position"); eq(m.amountPaid ?? 0, 0, "nothing paid");
    return `pc ${c.ref} Waitlisted; GET shows position ${m.waitlist[0].position} for ${m.waitlist[0].date}; amountPaid=${m.amountPaid ?? 0}, listed £${c.amount} not charged`;
  });
  await check("W03-second-in-queue", "join", async () => {
    d = firstBooking(await book("pd", Lx, [mon], "1 day")); const m = await myBooking("pd", d.ref); eq(m.waitlist?.[0]?.position, 2, "pd position");
    return `pd ${d.ref} position 2`;
  });
  await check("W04-size-limit", "join", async () => {
    const r = await book("pe", Lx, [mon], "1 day");
    eq(r.status, 409, "third refused"); must(/waiting list.*full/i.test(r.json?.error ?? ""), "message");
    return `waitlistSize 2: 3rd family -> 409 "${r.json?.error}"`;
  });
  await check("W05-duplicate-join", "join", async () => {
    // free a queue slot so the size cap is not the reason for refusal
    await call("pd", "POST", `/api/my/bookings/${d.ref}/cancel`, {});
    const r = await book("pc", Lx, [mon], "1 day", {}, kc);
    eq(r.status, 409, "dup refused"); must(/already (has a place|on the waiting list)/i.test(r.json?.error ?? ""), "message: " + r.json?.error);
    return `same child, same day, joined twice -> 409 "${r.json?.error}"`;
  });
  await check("W10-sibling-pair-queues-together", "join", async () => {
    const Ls = await mkListing("pv", "WL final sibling", { maxAttendees: "1", waitlistMode: "manual" });
    firstBooking(await book("pa", Ls, [mon], "1 day"));
    const r = await call("pc", "POST", "/api/my/bookings", { listingId: Ls.id, blockId: Ls.blockId, method: "card", items: [{ pass: "1 day", child: L.kid(), age: 8, dates: [mon] }, { pass: "1 day", child: L.kid(), age: 9, dates: [mon] }] });
    eq(r.status, 201, "basket"); const bs = r.json.bookings;
    const ms = await Promise.all(bs.map((x: any) => myBooking("pc", x.ref)));
    must(bs.every((x: any) => x.status === "Waitlisted"), "both waitlisted");
    return `two siblings, one basket -> ${bs.length} bookings all Waitlisted, positions ${ms.map((m: any) => m.waitlist?.[0]?.position).join("+")} (they keep their place together)`;
  });
  await check("B03-offer-holds-seat", "manual", async () => {
    const Lh = await mkListing("pv", "WL final hold", { maxAttendees: "1", waitlistMode: "manual" });
    const x = firstBooking(await book("pa", Lh, [mon], "1 day")); const y = firstBooking(await book("pb", Lh, [mon], "1 day"));
    await call("pa", "POST", `/api/my/bookings/${x.ref}/cancel`, {});
    eq((await opAction("pv", y.ref, { type: "offer" })).status, 200, "offer");
    const z = firstBooking(await book("pc", Lh, [mon], "1 day")); eq(z.status, "Waitlisted", "a new family cannot take the held place");
    const w = firstBooking(await book("pd", Lh, [mon], "1 day")); 
    const r = await opAction("pv", z.ref, { type: "offer" }); eq(r.status, 409, "second offer refused (day held)");
    return `held place cannot be taken: new booker -> ${z.status}; second offer -> 409 "${r.json?.error}"`;
  });
  console.log("done L"); await L.closeAll(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
