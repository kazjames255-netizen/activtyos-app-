import * as L from "./wl-lib";
import { db } from "../../server/src/firebase";
import { expireOffers } from "../../server/src/lib/waitlist";
const { A, call, check, eq, must, book, firstBooking, sd, snap, pageFor, opAction, opBooking, myBooking, mailLog } = L;
const S: any = JSON.parse(require("node:fs").readFileSync(L.SHOTS + "/state-a.json", "utf8"));
const mon = sd(0, 0);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const blk = async () => await L.blockDoc("pv", S.L1.id, S.L1.blockId);
const dayBooked = async () => (await blk())?.sessions?.find((s: any) => s.date === mon)?.bookedCount;
(async () => {
  await check("C01-free-place-then-offer-decline", "decline", async (shots) => {
    const c = await call("pb", "POST", "/api/my/bookings/WLT-10313/cancel", {});
    eq(c.status, 200, "pb cancel"); eq(await dayBooked(), 1, "1 seated after cancel");
    const o = await opAction("pv", "WLT-10314", { type: "offer" }); eq(o.status, 200, "offer pc");
    eq(await dayBooked(), 2, "offer holds the seat");
    const p = await pageFor("pc", "/custdash/bookings?pay=WLT-10314");
    shots.push(await snap(p, "c01-parent-offer-after-fix", [/Accept the place/i]));
    const txt = await p.locator("body").innerText();
    must(!/isn't ready to pay/i.test(txt), "offer link no longer throws 'not ready to pay'");
    await p.getByRole("button", { name: /Give it up/i }).click();
    await p.waitForTimeout(2500); await p.close();
    const b = await myBooking("pc", "WLT-10314");
    eq(b.status, "Cancelled", "declined offer -> Cancelled");
    eq(await dayBooked(), 1, "seat released after decline");
    return `offer link opens the card (no error modal); decline -> Cancelled; seat held=2 then released=1; note="${b.note}"`;
  });
  await check("C02-decline-manual-no-auto-next", "decline", async () => {
    await sleep(2500);
    const q = await myBooking("pa", "WLT-10316");
    eq(q.status, "Waitlisted", "next in line is NOT auto offered in manual mode");
    return "manual mode: next family stays Waitlisted until the provider offers";
  });
  await check("C03-offer-expiry-requeues", "expiry", async () => {
    const o = await opAction("pv", "WLT-10316", { type: "offer" }); eq(o.status, 200, "offer pa");
    const doc = (await db.collection("bookings").where("ref", "==", "WLT-10316").get()).docs[0];
    await doc.ref.update({ offerExpiresAt: new Date(Date.now() - 60_000).toISOString() });
    await expireOffers(); await sleep(1500);
    const b = await myBooking("pa", "WLT-10316");
    eq(b.status, "Waitlisted", "expired offer -> back in the queue");
    eq(await dayBooked(), 1, "seat released on expiry");
    const e = await myBooking("pe", "WLT-10317");
    const pa = (b.waitlist ?? [])[0]?.position, pe = (e.waitlist ?? [])[0]?.position;
    must(pe < pa, `lapsed family moves behind pe: pe=${pe} pa=${pa}`);
    return `expired -> Waitlisted, note "${b.note}", seat released; queue now pe=${pe}, pa=${pa} (lapsed family goes to the back)`;
  });
  await check("C04-accept-after-expiry-refused", "expiry", async () => {
    const o = await opAction("pv", "WLT-10317", { type: "offer" }); eq(o.status, 200, "offer pe");
    const doc = (await db.collection("bookings").where("ref", "==", "WLT-10317").get()).docs[0];
    await doc.ref.update({ offerExpiresAt: new Date(Date.now() - 60_000).toISOString() });
    const r = await call("pe", "POST", "/api/my/bookings/WLT-10317/accept-offer", {});
    eq(r.status, 409, "late accept refused");
    // the seat is still held until the sweep runs; run it
    await expireOffers(); await sleep(1200);
    eq(await dayBooked(), 1, "seat back after sweep");
    return `late accept -> 409 "${r.json?.error}"`;
  });
  console.log("done C"); await L.closeAll(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
