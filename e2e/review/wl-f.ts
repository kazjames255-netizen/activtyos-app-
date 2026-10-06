import * as L from "./wl-lib";
const { A, call, ok, check, eq, must, book, firstBooking, sd, opAction, myBooking, mkListing } = L;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mon = sd(0, 0), tue = sd(0, 1), wed = sd(0, 2);
const st = async (k: string, ref: string) => (await myBooking(k, ref))?.status;
const until = async (k: string, ref: string, want: string, ms = 25000) => { const t0 = Date.now(); let s = ""; while (Date.now() - t0 < ms) { s = await st(k, ref); if (s === want) return `${s} after ${((Date.now() - t0) / 1000).toFixed(1)}s`; await sleep(1500); } throw new Error(`still ${s} after ${ms / 1000}s (wanted ${want})`); };
(async () => {
  await check("E03-capacity-raised-offers-waiting", "triggers", async () => {
    const Lc = await mkListing("pv", "WL E3 capacity", { maxAttendees: "1", waitlistMode: "auto" });
    firstBooking(await book("pa", Lc, [mon], "1 day")); const b = firstBooking(await book("pb", Lc, [mon], "1 day"));
    eq(b.status, "Waitlisted", "pb waits");
    const r = await call("pv", "PUT", `/api/listings/${Lc.id}`, { maxAttendees: "2" }); must(r.status < 300, "raise capacity " + r.status);
    return "capacity 1->2 -> pb " + await until("pb", b.ref, "Offered");
  });
  await check("E07-ticket-closed-then-reopened", "triggers", async () => {
    const Lg = await mkListing("pv", "WL E7 ticket", { maxAttendees: "3", waitlistMode: "auto", ticketOverrides: { "1 day": { capacity: "0" } } });
    const r = await book("pa", Lg, [mon], "1 day");
    const b = firstBooking(r);
    if (!b) return `closed ticket: booking refused HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 160)} (cannot join the queue for a closed ticket)`;
    const wasStatus = b.status;
    const u = await call("pv", "PUT", `/api/listings/${Lg.id}`, { ticketOverrides: {} }); must(u.status < 300, "reopen " + u.status);
    await sleep(4000);
    const after = await st("pa", b.ref);
    if (wasStatus === "Waitlisted" && after !== "Offered") throw new Error(`was ${wasStatus}; ticket reopened but still ${after}`);
    return `closed ticket booking -> ${wasStatus}; after reopening -> ${after}`;
  });
  await check("E08-pass-cap-not-bypassed-by-offer", "caps", async () => {
    const Lh = await mkListing("pv", "WL E8 passcap", { maxAttendees: "3", waitlistMode: "auto", ticketOverrides: { "1 day": { capacity: "1" } } });
    const a = firstBooking(await book("pa", Lh, [mon], "1 day")); eq(a.status, "Confirmed", "pa takes the one 1-day place");
    const b = firstBooking(await book("pb", Lh, [mon], "1 day")); eq(b.status, "Waitlisted", "pb waits (1-day ticket cap reached though the block has room)");
    const c = firstBooking(await book("pc", Lh, [mon, tue, wed], "3 days")); eq(c.status, "Confirmed", "pc 3-day pass seated");
    await call("pc", "POST", `/api/my/bookings/${c.ref}/cancel`, {}); await sleep(15000);
    const s = await st("pb", b.ref);
    if (s === "Offered") throw new Error("pb was OFFERED a 1-day place although the 1-day ticket is capped at 1/day and pa holds it (block seat freed, pass seat not)");
    return `block seat freed by a 3-day cancellation; pb stays ${s} because the 1-day ticket is still at its cap`;
  });
  console.log("done F"); await L.closeAll(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
