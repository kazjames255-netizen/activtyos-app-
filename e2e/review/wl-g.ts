import * as L from "./wl-lib";
const { A, call, ok, check, eq, must, book, firstBooking, sd, opAction, myBooking, mkListing } = L;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mon = sd(0, 0), tue = sd(0, 1), wed = sd(0, 2);
const st = async (k: string, ref: string) => (await myBooking(k, ref))?.status;
const until = async (k: string, ref: string, want: string, ms = 25000) => { const t0 = Date.now(); let s = ""; while (Date.now() - t0 < ms) { s = await st(k, ref); if (s === want) return `${s} after ${((Date.now() - t0) / 1000).toFixed(1)}s`; await sleep(1500); } throw new Error(`still ${s} after ${ms / 1000}s (wanted ${want})`); };
(async () => {
  await check("E09-pass-cap-positive-control", "caps", async () => {
    const Lh = await mkListing("pv", "WL E9 passcap", { maxAttendees: "3", waitlistMode: "auto", ticketOverrides: { "1 day": { capacity: "1" } } });
    const a = firstBooking(await book("pa", Lh, [mon], "1 day")); const b = firstBooking(await book("pb", Lh, [mon], "1 day")); eq(b.status, "Waitlisted", "pb waits on the pass cap");
    await call("pa", "POST", `/api/my/bookings/${a.ref}/cancel`, {});
    return "pa (holds the capped 1-day place) cancels -> pb " + await until("pb", b.ref, "Offered");
  });
  await check("E09b-manual-offer-respects-pass-cap", "caps", async () => {
    const Lh = await mkListing("pv", "WL E9b passcap manual", { maxAttendees: "3", waitlistMode: "manual", ticketOverrides: { "1 day": { capacity: "1" } } });
    firstBooking(await book("pa", Lh, [mon], "1 day")); const b = firstBooking(await book("pb", Lh, [mon], "1 day")); eq(b.status, "Waitlisted", "pb waits");
    const r = await opAction("pv", b.ref, { type: "offer" });
    eq(r.status, 409, "operator offer refused while the ticket is at its cap");
    return `operator Offer -> 409 "${r.json?.error}"`;
  });
  // age caps
  const lib = (await call("pv", "GET", "/api/library")).json ?? {};
  await ok("pv", "PUT", "/api/library", { venues: lib.venues ?? [], settings: { ...(lib.settings ?? {}), ratioGroups: [{ id: "g-small", name: "Under 8s", ageFrom: 4, ageTo: 7, ratio: 8 }, { id: "g-big", name: "8 and over", ageFrom: 8, ageTo: 11, ratio: 12 }] } });
  await check("E10-age-cap-not-bypassed-by-offer", "caps", async () => {
    const La = await mkListing("pv", "WL E10 agecap", { maxAttendees: "3", waitlistMode: "auto", ageCapsOn: true, ageCaps: { "g-small": 1 } });
    const a = firstBooking(await book("pa", La, [mon], "1 day", {}, L.kid(), La.blockId, 6)); eq(a.status, "Confirmed", "pa (age 6) takes the only Under-8 place");
    const b = firstBooking(await book("pb", La, [mon], "1 day", {}, L.kid(), La.blockId, 6)); eq(b.status, "Waitlisted", "pb (age 6) waits: Under 8s full");
    const c = firstBooking(await book("pc", La, [mon], "1 day", {}, L.kid(), La.blockId, 9)); eq(c.status, "Confirmed", "pc (age 9) is a different group: seated");
    await call("pc", "POST", `/api/my/bookings/${c.ref}/cancel`, {}); await sleep(12000);
    const s1 = await st("pb", b.ref);
    if (s1 === "Offered") throw new Error("pb (Under 8s) was offered a place although the Under 8s cap (1) is still held by pa");
    await call("pa", "POST", `/api/my/bookings/${a.ref}/cancel`, {});
    return `an 8+ child leaving doesn't free an Under-8 place (pb stays ${s1}); then pa (age 6) leaves -> pb ` + await until("pb", b.ref, "Offered");
  });
  console.log("done G"); await L.closeAll(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
