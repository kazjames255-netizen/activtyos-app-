import * as L from "./wl-lib";
import { execFileSync } from "node:child_process";
const { A, call, check, eq, must, book, firstBooking, sd, snap, pageFor, opAction, opBooking, myBooking, mailLog } = L;
const S: any = JSON.parse(require("node:fs").readFileSync(L.SHOTS + "/state-a.json", "utf8"));
const mon = sd(0, 0);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const bookedCount = async () => (await L.blockDoc("pv", S.L1.id, S.L1.blockId));
const dayCount = async (d: string) => { const b = await bookedCount(); return (b?.dayCounts ?? b?.days?.[d]?.booked ?? null); };
(async () => {
  const b0 = await bookedCount(); console.log("block0 keys", Object.keys(b0 ?? {}).join(","), "booked", b0?.bookedCount, "dayCounts", JSON.stringify(b0?.dayCounts)?.slice(0, 120));
  // B1 manual: parent cancels -> no automatic offer
  await check("B01-manual-no-auto-offer", "manual", async () => {
    const r = await call("pa", "POST", "/api/my/bookings/WLT-10312/cancel", {});
    if (r.status >= 300) throw new Error(`cancel ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
    await sleep(3000);
    const q = await myBooking("pc", "WLT-10314");
    eq(q.status, "Waitlisted", "first in queue still waiting (manual mode)");
    return `cancel WLT-10312 -> ${r.json?.status ?? "ok"}; WLT-10314 still ${q.status} (manual mode = provider chooses)`;
  });
  // B2 provider can offer ANY queued booking (choose); offer pd (2nd) over pc (1st)
  await check("B02-manual-offer-chosen", "manual", async () => {
    const r = await opAction("pv", "WLT-10315", { type: "offer" });
    eq(r.status, 200, "offer http");
    const b = await opBooking("pv", "WLT-10315");
    eq(b.status, "Offered", "status"); must(b.offerExpiresAt, "expiry set");
    const hrs = (Date.parse(b.offerExpiresAt) - Date.now()) / 3600000;
    must(hrs > 1.9 && hrs < 2.05, "expiry ~2h, got " + hrs.toFixed(2));
    return `WLT-10315 Offered, expires in ${hrs.toFixed(2)}h (${b.offerExpiresAt})`;
  });
  await check("B03-offer-holds-seat", "manual", async () => {
    // day is now 2/2 again (pb + offered). Another offer must be refused.
    const r = await opAction("pv", "WLT-10314", { type: "offer" });
    eq(r.status, 409, "second offer refused");
    // a brand new parent trying to book the held place must be waitlisted, not confirmed
    const rb = await book("pe", S.L1, [mon], "1 day");
    const bk = firstBooking(rb);
    eq(bk.status, "Waitlisted", "new booker goes to the queue, not into the held place");
    return `second offer -> 409 "${r.json?.error}"; new parent pe -> ${bk.status} (WLT-${bk.ref})`;
  });
  await check("B04-offer-email-and-bell", "manual", async () => {
    await sleep(2500);
    const lines = mailLog(A.pd.email).filter((l) => /place has opened/i.test(l));
    const n = (await call("pd", "GET", "/api/notifications")).json?.notifications ?? [];
    const bell = n.filter((x: any) => /available/i.test(x.title ?? ""));
    must(lines.length === 1, `offer email count = ${lines.length} (want exactly 1)`);
    must(bell.length >= 1, "bell raised for the offered family");
    return `1 offer email ("${lines[0].slice(0, 110)}"), bell: "${bell[0].title}" -> ${bell[0].href}`;
  });
  await check("B05-ui-offer-parent", "manual", async (shots) => {
    const p = await pageFor("pd", "/custdash/bookings?pay=WLT-10315");
    shots.push(await snap(p, "b05-parent-offer", [/Accept|accept/i]));
    const txt = await p.locator("body").innerText(); await p.close();
    must(/Accept/i.test(txt) && /Decline|No thanks|decline/i.test(txt), "Accept and Decline buttons visible");
    return "parent sees the offer with Accept + Decline";
  });
  await check("B06-ui-offer-parent-phone", "manual", async (shots) => {
    const p = await pageFor("pd", "/custdash/bookings?pay=WLT-10315", 390);
    shots.push(await snap(p, "b06-parent-offer-390", [/Accept|accept/i]));
    const over = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2); await p.close();
    must(!over, "no sideways scroll at 390px");
    return "390px offer view, no horizontal scroll";
  });
  // B07 accept
  await check("B07-accept-offer", "manual", async () => {
    const before = await myBooking("pd", "WLT-10315");
    const r = await call("pd", "POST", "/api/my/bookings/WLT-10315/accept-offer", {});
    eq(r.status, 200, "accept http");
    const b = await myBooking("pd", "WLT-10315");
    eq(b.status, "Confirmed", "status"); eq(b.amount, before.amount, "amount unchanged");
    must(b.pay === "Unpaid" || b.pay === "Pending", "pay state " + b.pay);
    return `accepted: Confirmed, amount £${b.amount} unchanged, pay=${b.pay}, amountPaid=${b.amountPaid ?? 0}`;
  });
  await check("B08-accept-again-refused", "manual", async () => {
    const r = await call("pd", "POST", "/api/my/bookings/WLT-10315/accept-offer", {});
    eq(r.status, 409, "second accept refused");
    return "second accept -> 409 " + r.json?.error;
  });
  await check("B09-other-parent-cannot-answer", "manual", async () => {
    const r1 = await opAction("pv", "WLT-10314", { type: "offer" }); // day full again -> 409
    const r = await call("pa", "POST", "/api/my/bookings/WLT-10314/accept-offer", {});
    must(r.status === 404 || r.status === 409, "someone else's accept refused, got " + r.status);
    return `offer when full -> ${r1.status}; other family accept -> ${r.status} ${r.json?.error}`;
  });
  console.log("done B"); await L.closeAll(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
