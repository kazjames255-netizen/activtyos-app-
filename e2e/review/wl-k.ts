import * as L from "./wl-lib";
const { A, call, check, eq, must, book, firstBooking, sd, pageFor, snap, mkListing } = L;
const mon = sd(0, 0);
(async () => {
  const Lk = await mkListing("pv", "WL K provider-queue", { maxAttendees: "1", waitlistMode: "manual" });
  firstBooking(await book("pa", Lk, [mon], "1 day"));
  const rs = []; for (const k of ["pb", "pc", "pd"]) rs.push(firstBooking(await book(k, Lk, [mon], "1 day")));
  await check("W09-provider-sees-queue-order", "ui", async (shots) => {
    const list = (await call("pv", "GET", "/api/bookings")).json;
    const pos = rs.map((r) => list.find((b: any) => b.ref === r.ref)?.waitlist?.[0]?.position);
    eq(pos.join(","), "1,2,3", "positions in the provider list");
    const det = await L.opBooking("pv", rs[1].ref); eq(det.waitlist?.[0]?.position, 2, "detail position");
    const p = await pageFor("pv", "/freelancer/bookings");
    await p.getByPlaceholder(/Search booker/).fill("WL K provider-queue"); await p.waitForTimeout(1500);
    shots.push(await snap(p, "w09a-provider-list-positions", [/in the queue/], false));
    await p.getByText(/#2 in the queue/).first().click(); await p.waitForTimeout(1500);
    shots.push(await snap(p, "w09b-provider-detail-position", [/in the queue/], false));
    await p.close();
    return "provider list + detail show #1,#2,#3 in the queue for the date";
  });
  console.log("done K"); await L.closeAll(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
