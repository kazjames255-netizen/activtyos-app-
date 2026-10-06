import * as L from "./wl-lib";
import { placeOfferedSpec } from "../../server/src/lib/emailTemplates";
const { A, call, ok, check, eq, must, book, firstBooking, sd, opAction, myBooking, mkListing } = L;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mon = sd(0, 0), tue = sd(0, 1);
const st = async (k: string, ref: string) => (await myBooking(k, ref))?.status;
(async () => {
  await check("E11-ticket-age-range-and-waitlist", "caps", async () => {
    const Lt = await mkListing("pv", "WL E11 ticket age", { maxAttendees: "1", waitlistMode: "manual", ageFrom: "5", ageTo: "11", ticketOverrides: { "1 day": { ageFrom: "8", ageTo: "11" } } });
    firstBooking(await book("pa", Lt, [mon], "1 day", {}, L.kid(), Lt.blockId, 9));
    const ok1 = await book("pb", Lt, [mon], "1 day", {}, L.kid(), Lt.blockId, 9);
    const young = await book("pc", Lt, [mon], "1 day", {}, L.kid(), Lt.blockId, 6);
    return `in-range child (9) on a full day -> ${firstBooking(ok1)?.status ?? "HTTP " + ok1.status}; child (6) outside the ticket's 8-11 range -> ${firstBooking(young)?.status ?? "HTTP " + young.status + " " + JSON.stringify(young.json).slice(0, 110)}`;
  });
  await check("E12-promote-now-overbooks-and-counts", "operator", async () => {
    const Lp = await mkListing("pv", "WL E12 promote", { maxAttendees: "1", waitlistMode: "manual" });
    firstBooking(await book("pa", Lp, [mon], "1 day")); const b = firstBooking(await book("pb", Lp, [mon], "1 day")); eq(b.status, "Waitlisted", "pb waits");
    const r = await opAction("pv", b.ref, { type: "promote" }); eq(r.status, 200, "promote");
    eq(await st("pb", b.ref), "Confirmed", "confirmed");
    const bl = await L.blockDoc("pv", Lp.id, Lp.blockId); const day = bl.sessions.find((x: any) => x.date === mon);
    return `promote seats the family at once: Confirmed; Mon now ${day.bookedCount}/${day.capacity} (deliberate overbook)`;
  });
  await check("E13-new-booker-vs-queue-after-cancel-manual", "queue", async () => {
    const Lq = await mkListing("pv", "WL E13 queue-jump", { maxAttendees: "1", waitlistMode: "manual" });
    const a = firstBooking(await book("pa", Lq, [mon], "1 day")); const b = firstBooking(await book("pb", Lq, [mon], "1 day")); eq(b.status, "Waitlisted", "pb waits");
    await call("pa", "POST", `/api/my/bookings/${a.ref}/cancel`, {});
    const e = firstBooking(await book("pe", Lq, [mon], "1 day"));
    return `a place frees in MANUAL mode while pb is queued; a brand-new family then books -> ${e.status} (${e.status === "Confirmed" ? "they take the place ahead of the waiting family" : "they join the queue behind pb"})`;
  });
  await check("E14-queued-or-offered-cannot-be-paid", "money", async () => {
    const Lc = await mkListing("pv", "WL E14 pay", { maxAttendees: "1", waitlistMode: "manual" });
    const a = firstBooking(await book("pa", Lc, [mon], "1 day")); const b = firstBooking(await book("pb", Lc, [mon], "1 day"));
    const r1 = await call("pb", "POST", "/api/payments/checkout", { refs: [b.ref], tenantId: A.pv.tenantId });
    await call("pa", "POST", `/api/my/bookings/${a.ref}/cancel`, {}); await opAction("pv", b.ref, { type: "offer" });
    const r2 = await call("pb", "POST", "/api/payments/checkout", { refs: [b.ref], tenantId: A.pv.tenantId });
    must(r1.status === 409 && /isn't ready to pay/.test(r1.json?.error ?? ""), "waitlisted not payable: " + r1.status + " " + JSON.stringify(r1.json).slice(0, 120));
    must(r2.status === 409 && /isn't ready to pay/.test(r2.json?.error ?? ""), "offered not payable until accepted: " + r2.status + " " + JSON.stringify(r2.json).slice(0, 120));
    return `pay while Waitlisted -> ${r1.status} "${r1.json?.error}"; while Offered (not yet accepted) -> ${r2.status} "${r2.json?.error}"`;
  });
  await check("E15-offer-email-wording", "emails", async () => {
    const fake: any = { booker: "Sam", listing: "Half term camp", ref: "ABC-1", offerExpiresAt: "2026-07-01T12:30:00.000Z" };
    const m = placeOfferedSpec(fake, "Riverside Camps", "https://app.example");
    const text = (m.body ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    must(/2 hours/.test(text) && /13:30/.test(text), "says 2 hours and shows UK time 13:30 for 12:30Z in July (BST): " + text.slice(0, 200));
    return `subject "${m.subject}"; body: ${text.slice(0, 330)}`;
  });
  console.log("done J"); await L.closeAll(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
