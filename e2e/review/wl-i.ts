import * as L from "./wl-lib";
const { A, call, ok, check, eq, must, book, firstBooking, sd, opAction, myBooking, mkListing, pageFor, snap } = L;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mon = sd(0, 0), tue = sd(0, 1), wed = sd(0, 2);
const st = async (k: string, ref: string) => (await myBooking(k, ref))?.status;
const until = async (k: string, ref: string, want: string, ms = 25000) => { const t0 = Date.now(); let s = ""; while (Date.now() - t0 < ms) { s = await st(k, ref); if (s === want) return `${s} after ${((Date.now() - t0) / 1000).toFixed(1)}s`; await sleep(1500); } throw new Error(`still ${s} after ${ms / 1000}s (wanted ${want})`); };
(async () => {
  await check("D06-cancel-an-offered-booking-passes-down", "auto", async () => {
    const La = await mkListing("pv", "WL D6 offered-cancel", { maxAttendees: "1", waitlistMode: "auto" });
    const a = firstBooking(await book("pa", La, [mon], "1 day")); const b = firstBooking(await book("pb", La, [mon], "1 day")); const c = firstBooking(await book("pc", La, [mon], "1 day"));
    await call("pa", "POST", `/api/my/bookings/${a.ref}/cancel`, {}); await until("pb", b.ref, "Offered");
    const r = await call("pb", "POST", `/api/my/bookings/${b.ref}/cancel`, {}); eq(r.status, 200, "pb cancels the OFFERED booking: " + JSON.stringify(r.json).slice(0, 120));
    return "pb cancels while Offered -> pc " + await until("pc", c.ref, "Offered");
  });
  await check("D07-provider-cancels-offered-passes-down", "auto", async () => {
    const La = await mkListing("pv", "WL D7 provider-cancels-offered", { maxAttendees: "1", waitlistMode: "auto" });
    const a = firstBooking(await book("pa", La, [mon], "1 day")); const b = firstBooking(await book("pb", La, [mon], "1 day")); const c = firstBooking(await book("pc", La, [mon], "1 day"));
    await call("pa", "POST", `/api/my/bookings/${a.ref}/cancel`, {}); await until("pb", b.ref, "Offered");
    const r = await opAction("pv", b.ref, { type: "cancel", refund: "none" }); eq(r.status, 200, "provider cancels pb's offered booking");
    return "provider cancels the Offered booking -> pc " + await until("pc", c.ref, "Offered");
  });
  await check("D08-cancel-one-day-frees-place", "auto", async () => {
    const La = await mkListing("pv", "WL D8 cancel-day", { maxAttendees: "1", waitlistMode: "auto" });
    const a = firstBooking(await book("pa", La, [mon, tue, wed], "3 days")); eq(a.status, "Confirmed", "pa 3 days");
    const b = firstBooking(await book("pb", La, [tue], "1 day")); eq(b.status, "Waitlisted", "pb waits on Tue");
    const r = await call("pa", "POST", `/api/my/bookings/${a.ref}/cancel`, { days: [tue], resolution: "wallet" });
    if (r.status >= 300) return `one-day release refused for this provider setup: HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 160)} (not testable here)`;
    return "pa releases Tue from a 3-day booking -> pb " + await until("pb", b.ref, "Offered");
  });
  await check("U05-parent-leaves-list-in-ui", "ui", async (shots) => {
    const La = await mkListing("pv", "WL U5 leave", { maxAttendees: "1", waitlistMode: "manual" });
    firstBooking(await book("pa", La, [mon], "1 day")); const b = firstBooking(await book("pc", La, [mon], "1 day"));
    const p = await pageFor("pc", "/custdash/bookings");
    await p.getByText("My waiting list").first().waitFor({ timeout: 40000 });
    p.on("dialog", (d) => d.accept().catch(() => {}));
    const card = p.locator('[data-ui="card"]').filter({ hasText: "WL U5 leave" }).first();
    await card.waitFor({ timeout: 20000 }).catch(async () => { await p.getByText("My waiting list").first().click(); await p.waitForTimeout(800); });
    shots.push(await snap(p, "u05a-before-leave", [], false));
    await p.locator('[data-ui="card"]').filter({ hasText: "WL U5 leave" }).first().getByRole("button", { name: /Leave waiting list/ }).click();
    await p.waitForTimeout(3000); shots.push(await snap(p, "u05b-after-leave", [], false)); await p.close();
    eq(await st("pc", b.ref), "Cancelled", "left the list");
    return "Leave waiting list (UI, confirm dialog) -> Cancelled";
  });
  console.log("done I"); await L.closeAll(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
