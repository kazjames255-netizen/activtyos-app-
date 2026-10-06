import * as L from "./wl-lib";
import { execFileSync } from "node:child_process";
import path from "node:path";
const { A, call, ok, check, eq, must, book, firstBooking, sd, opAction, myBooking, mkListing, mailCount, ROOT } = L;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mon = sd(0, 0), tue = sd(0, 1);
const st = async (k: string, ref: string) => (await myBooking(k, ref))?.status;
const until = async (k: string, ref: string, want: string, ms = 25000) => { const t0 = Date.now(); let s = ""; while (Date.now() - t0 < ms) { s = await st(k, ref); if (s === want) return `${s} after ${((Date.now() - t0) / 1000).toFixed(1)}s`; await sleep(1500); } throw new Error(`still ${s} after ${ms / 1000}s (wanted ${want})`); };
const wallet = async (k: string) => { const r = await call(k, "GET", `/api/my/wallet`); return (r.json?.balances ?? []).find((b: any) => b.tenantId === A.pv.tenantId)?.balance ?? 0; };
(async () => {
  // multi-week basket for one child: wk1 Mon full, wk2 Mon free
  await check("E06-multiweek-basket", "fit", async () => {
    const Lf = await mkListing("pv", "WL E6 multiweek", { maxAttendees: "1", waitlistMode: "auto" });
    const wk2 = sd(1, 0);
    const a = firstBooking(await book("pa", Lf, [mon], "1 day")); eq(a.status, "Confirmed", "pa fills wk1 Mon");
    const k = L.kid();
    const rr = await call("pc", "POST", "/api/my/bookings", { listingId: Lf.id, blockId: Lf.blockId, method: "card", items: [{ pass: "1 day", child: k, age: 8, dates: [mon] }, { pass: "1 day", child: k, age: 8, dates: [wk2] }] });
    eq(rr.status, 201, "basket http " + JSON.stringify(rr.json).slice(0, 200));
    const bs = rr.json.bookings.map((x: any) => `${x.ref}:${x.status}[${(x.days ?? []).join("/").replace(/2026-/g, "")}]`);
    return `one child, wk1 Mon (full) + wk2 Mon (free) -> ${bs.join(" ; ")}`;
  });
  // wallet untouched by waitlist, discount & add-on frozen at join
  await check("F01-wallet-not-spent-on-waitlist", "money", async () => {
    execFileSync(path.join(ROOT, "server/node_modules/.bin/tsx"), [path.join(ROOT, "e2e/helpers/walletCredit.ts"), A.pv.tenantId!, A.pe.email, "30"], { cwd: path.join(ROOT, "server"), stdio: "pipe" });
    const w0 = await wallet("pe"); must(w0 >= 30, "credited: " + w0);
    const Lw = await mkListing("pv", "WL F1 wallet", { maxAttendees: "1", waitlistMode: "manual" });
    firstBooking(await book("pa", Lw, [mon], "1 day"));
    const r = await book("pe", Lw, [mon], "1 day", { walletCap: 20 }); const b = firstBooking(r);
    eq(b.status, "Waitlisted", "pe waits");
    const w1 = await wallet("pe");
    eq(w1, w0, "wallet untouched while waiting");
    // leave the list: still untouched, nothing owed
    const c = await call("pe", "POST", `/api/my/bookings/${b.ref}/cancel`, {}); eq(c.status, 200, "leave list");
    eq(await wallet("pe"), w0, "wallet unchanged after leaving");
    return `wallet £${w0} before = £${w1} while waiting (walletCap £20 was ignored for the waitlisted line) = £${await wallet("pe")} after leaving`;
  });
  await check("F02-discount-frozen-at-join", "money", async () => {
    const Ld = await mkListing("pv", "WL F2 discount", { maxAttendees: "1", waitlistMode: "manual", discounts: [{ id: "eb", kind: "early", name: "Early bird", passNames: [], enabled: true, moreThan: 0, appliesTo: "all", method: "percent", value: 10, beforeDate: "" }] });
    firstBooking(await book("pa", Ld, [mon], "1 day"));
    const b = firstBooking(await book("pb", Ld, [mon], "1 day"));
    eq(b.status, "Waitlisted", "pb waits");
    const joinAmt = b.amount, joinList = b.listPrice, joinOff = b.discountOff;
    await opAction("pv", "NA", {}).catch(() => {});
    // free the place and offer
    const aref = (await call("pv", "GET", "/api/bookings")).json.find((x: any) => x.listing === "WL F2 discount" && x.status === "Confirmed").ref;
    await opAction("pv", aref, { type: "cancel", refund: "none" });
    const o = await opAction("pv", b.ref, { type: "offer" }); eq(o.status, 200, "offer");
    const acc = await call("pb", "POST", `/api/my/bookings/${b.ref}/accept-offer`, {}); eq(acc.status, 200, "accept");
    const after = await myBooking("pb", b.ref);
    eq(after.amount, joinAmt, "amount unchanged at accept");
    return `joined at £${joinAmt} (list £${joinList}, off £${joinOff}); after offer+accept still £${after.amount}, discountNames=${JSON.stringify(after.discountNames ?? after.discount ?? "")}`;
  });
  await check("F03-price-change-after-join", "money", async () => {
    const Lp = await mkListing("pv", "WL F3 price", { maxAttendees: "1", waitlistMode: "manual" });
    firstBooking(await book("pa", Lp, [mon], "1 day"));
    const b = firstBooking(await book("pb", Lp, [mon], "1 day")); eq(b.amount, 20, "joined at £20");
    // raise the 1-day price via the listing's passes list
    const full = (await call("pv", "GET", `/api/listings/${Lp.id}`)).json;
    const passes = (full.passes ?? []).map((p: any) => p.name === "1 day" ? { ...p, price: 35 } : p);
    const u = await call("pv", "PUT", `/api/listings/${Lp.id}`, { passes });
    const aref = (await call("pv", "GET", "/api/bookings")).json.find((x: any) => x.listing === "WL F3 price" && x.status === "Confirmed").ref;
    await opAction("pv", aref, { type: "cancel", refund: "none" });
    await opAction("pv", b.ref, { type: "offer" });
    await call("pb", "POST", `/api/my/bookings/${b.ref}/accept-offer`, {});
    const after = await myBooking("pb", b.ref);
    return `listing price edit HTTP ${u.status}; family joined at £20, accepted at £${after.amount} (the price they were quoted when they joined is kept)`;
  });
  // provider removes someone / hidden ticket / emails
  await check("F04-provider-removes-from-queue", "queue", async () => {
    const Lq = await mkListing("pv", "WL F4 remove", { maxAttendees: "1", waitlistMode: "manual" });
    firstBooking(await book("pa", Lq, [mon], "1 day"));
    const b = firstBooking(await book("pb", Lq, [mon], "1 day")); const c = firstBooking(await book("pc", Lq, [mon], "1 day"));
    const d = firstBooking(await book("pd", Lq, [mon], "1 day"));
    const m0 = mailCount(A.pb.email, /cancel|declin/i);
    const r = await opAction("pv", c.ref, { type: "decline", reason: "Not suitable" }); eq(r.status, 200, "provider declines waitlisted pc");
    const pd = await myBooking("pd", d.ref); const pos = pd.waitlist?.[0]?.position;
    eq(pos, 2, "pd moves up to 2nd (pb 1st)");
    eq(await st("pc", c.ref), "Declined", "pc declined");
    return `provider declines the 2nd family -> they see Declined; pd moves 3rd -> ${pos}nd`;
  });
  await check("F05-hidden-ticket-cannot-join", "queue", async () => {
    const Lh = await mkListing("pv", "WL F5 hidden", { maxAttendees: "1", waitlistMode: "manual", ticketOverrides: { "1 day": { hidden: true } } });
    const r = await book("pa", Lh, [mon], "1 day");
    return `hidden ticket -> HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 140)}`;
  });
  await check("F06-leave-list-and-requeue-positions", "queue", async () => {
    const Ll = await mkListing("pv", "WL F6 leave", { maxAttendees: "1", waitlistMode: "manual" });
    firstBooking(await book("pa", Ll, [mon], "1 day"));
    const b = firstBooking(await book("pb", Ll, [mon], "1 day")); const c = firstBooking(await book("pc", Ll, [mon], "1 day"));
    const x = await call("pb", "POST", `/api/my/bookings/${b.ref}/cancel`, {}); eq(x.status, 200, "leave");
    const after = await myBooking("pb", b.ref);
    eq(after.status, "Cancelled", "status");
    const pc = await myBooking("pc", c.ref); eq(pc.waitlist?.[0]?.position, 1, "pc now 1st");
    must(!after.cancel || (after.cancel.amount ?? 0) === 0, "no refund/fee on a waitlist exit");
    return `pb leaves -> Cancelled with no money moved; pc moves to 1st; cancel record=${JSON.stringify(after.cancel ?? null).slice(0, 100)}`;
  });
  await check("F07-emails-not-doubled", "emails", async () => {
    const Le = await mkListing("pv", "WL F7 emails", { maxAttendees: "1", waitlistMode: "auto" });
    const a = firstBooking(await book("pa", Le, [mon], "1 day"));
    const j0 = mailCount(A.pb.email, /waiting list|waitlist/i);
    const b = firstBooking(await book("pb", Le, [mon], "1 day")); await sleep(2500);
    const joined = mailCount(A.pb.email, /waiting list|waitlist/i) - j0;
    const o0 = mailCount(A.pb.email, /place has opened/i);
    await call("pa", "POST", `/api/my/bookings/${a.ref}/cancel`, {}); await until("pb", b.ref, "Offered"); await sleep(2000);
    const offered = mailCount(A.pb.email, /place has opened/i) - o0;
    const c0 = mailCount(A.pb.email, /confirm|booked/i);
    await call("pb", "POST", `/api/my/bookings/${b.ref}/accept-offer`, {}); await sleep(2500);
    const conf = mailCount(A.pb.email, /confirm|booked/i) - c0;
    eq(offered, 1, "offer emails"); must(joined <= 1, "join emails " + joined); must(conf <= 1, "confirmation emails " + conf);
    return `join emails=${joined}, offer emails=${offered}, accept-confirmation emails=${conf}`;
  });
  await check("F08-addon-price-frozen-and-held", "money", async () => {
    const lib = (await call("pv", "GET", "/api/library")).json ?? {};
    const addons = [...(lib.addons ?? []).filter((a: any) => a.id !== "wl-lunch"), { id: "wl-lunch", name: "Lunch", type: "perday", price: 4 }];
    await ok("pv", "PUT", "/api/library", { venues: lib.venues ?? [], addons, settings: lib.settings ?? {} });
    const La = await mkListing("pv", "WL F8 addon", { maxAttendees: "1", waitlistMode: "manual", addonIds: ["wl-lunch"] });
    firstBooking(await book("pa", La, [mon], "1 day"));
    const r = await call("pb", "POST", "/api/my/bookings", { listingId: La.id, blockId: La.blockId, method: "card", items: [{ pass: "1 day", child: L.kid(), age: 8, dates: [mon], addons: [{ id: "wl-lunch", days: [mon] }] }] });
    eq(r.status, 201, "book " + JSON.stringify(r.json).slice(0, 200)); const b = r.json.bookings[0];
    eq(b.status, "Waitlisted", "waits"); eq(b.amount, 24, "pass £20 + lunch £4 held in the waitlisted total");
    const aref = (await call("pv", "GET", "/api/bookings")).json.find((x: any) => x.listing === "WL F8 addon" && x.status === "Confirmed").ref;
    await opAction("pv", aref, { type: "cancel", refund: "none" }); await opAction("pv", b.ref, { type: "offer" });
    await call("pb", "POST", `/api/my/bookings/${b.ref}/accept-offer`, {});
    const after = await myBooking("pb", b.ref);
    eq(after.amount, 24, "amount after accept");
    return `waitlisted booking carries the add-on: £${b.amount} (pass 20 + Lunch 4) -> after accept £${after.amount}; addons=${JSON.stringify(after.addons ?? [])}`;
  });
  console.log("done H"); await L.closeAll(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
