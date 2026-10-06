import * as L from "./wl-lib";
import { db } from "../../server/src/firebase";
import { expireOffers } from "../../server/src/lib/waitlist";
const { A, call, check, eq, must, book, firstBooking, sd, snap, pageFor, opAction, opBooking, myBooking, mailLog, mkListing, kid } = L;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mon = sd(0, 0), tue = sd(0, 1), wed = sd(0, 2);
(async () => {
  const L2 = await mkListing("pv", "WL Camp auto", { maxAttendees: "1", waitlistMode: "auto", waitlistSize: "10" });
  require("node:fs").writeFileSync(L.SHOTS + "/state-d.json", JSON.stringify({ L2 }));
  const day = async (d: string) => (await L.blockDoc("pv", L2.id, L2.blockId))?.sessions?.find((s: any) => s.date === d)?.bookedCount;
  const st = async (k: string, ref: string) => (await myBooking(k, ref))?.status;
  const R: Record<string, string> = {};
  await check("D01-setup-auto-queue", "auto", async () => {
    const ra = await book("pa", L2, [mon], "1 day"); if (ra.status >= 300) throw new Error("pa book " + ra.status + " " + JSON.stringify(ra.json)); const a = firstBooking(ra); R.a = a.ref; eq(a.status, "Confirmed", "pa");
    const e = firstBooking(await book("pe", L2, [tue], "1 day")); R.e = e.ref; eq(e.status, "Confirmed", "pe tue");
    const b = firstBooking(await book("pb", L2, [mon], "1 day")); R.b = b.ref; eq(b.status, "Waitlisted", "pb");
    const c = firstBooking(await book("pc", L2, [mon], "1 day")); R.c = c.ref; eq(c.status, "Waitlisted", "pc");
    const d = firstBooking(await book("pd", L2, [tue], "1 day")); R.d = d.ref; eq(d.status, "Waitlisted", "pd tue");
    return `Mon: pa seated, queue pb(1) pc(2); Tue: pe seated, pd(1)  refs ${JSON.stringify(R)}`;
  });
  await check("D02-auto-offer-first-in-queue-right-date", "auto", async (shots) => {
    const m0 = L.mailCount(A.pb.email, /place has opened/i);
    const c = await call("pa", "POST", `/api/my/bookings/${R.a}/cancel`, {}); eq(c.status, 200, "pa cancel");
    await sleep(3500);
    eq(await st("pb", R.b), "Offered", "first in Mon queue offered");
    eq(await st("pc", R.c), "Waitlisted", "second stays waiting");
    eq(await st("pd", R.d), "Waitlisted", "Tue queue untouched by a Mon cancellation");
    eq(await day(mon), 1, "Mon seat held for the offer");
    eq(L.mailCount(A.pb.email, /place has opened/i) - m0, 1, "new offer emails to pb");
    return `Mon freed -> pb Offered automatically, pc still waiting, Tue's pd untouched; 1 offer email to pb`;
  });
  await check("D03-auto-offer-bell", "auto", async () => {
    const n = (await call("pb", "GET", "/api/notifications")).json?.notifications ?? [];
    const bell = n.filter((x: any) => /available/i.test(x.title ?? ""));
    must(bell.length >= 1, `bell for the automatically-offered family (notifications: ${n.map((x: any) => x.title).join(" | ").slice(0, 160)})`);
    return "bell raised: " + bell[0].title;
  });
  await check("D04-auto-decline-passes-down", "auto", async () => {
    const r = await call("pb", "POST", `/api/my/bookings/${R.b}/decline-offer`, {}); eq(r.status, 200, "decline");
    await sleep(3500);
    eq(await st("pb", R.b), "Cancelled", "pb cancelled");
    eq(await st("pc", R.c), "Offered", "pc offered next");
    eq(await day(mon), 1, "still exactly one seat held");
    return "pb declines -> pc offered automatically; seat count stays 1";
  });
  await check("D05-auto-expiry-passes-down", "auto", async () => {
    // only pc waiting/offered on Mon. add pa back to queue first so there is someone after pc
    const a2 = firstBooking(await book("pa", L2, [mon], "1 day")); R.a2 = a2.ref; eq(a2.status, "Waitlisted", "pa re-joins queue");
    const doc = (await db.collection("bookings").where("ref", "==", R.c).get()).docs[0];
    await doc.ref.update({ offerExpiresAt: new Date(Date.now() - 60_000).toISOString() });
    await expireOffers(); await sleep(3500);
    eq(await st("pc", R.c), "Waitlisted", "pc lapsed to the back");
    eq(await st("pa", R.a2), "Offered", "next in line (pa) offered when pc's hold lapsed");
    return "pc's hold lapsed -> pc requeued at the back, pa offered automatically";
  });
  console.log("R", JSON.stringify(R)); require("node:fs").writeFileSync(L.SHOTS + "/state-d-refs.json", JSON.stringify(R));
  console.log("done D"); await L.closeAll(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
