// OFFLINE refunds name the method actually paid (cash / bank transfer / voucher, a mix included), end to end against the emulator: the family's cancel-panel
// data (booking.refundMethod, release-preview), the entries behind an approval, the family's bell and emails, the provider's reminder bell. A booking paid by
// card + wallet carries NO offline wording at all. Amounts are never changed by any of this.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { call, db, makeParent, makeProvider, ok, operatorAction, bookingDoc, sleep, uniq, type Parent, type Provider } from "./helpers.mts";
import { refundApprovedSpec, refundSentSpec } from "../../server/src/lib/emailTemplates";
import { refundTransferReminders } from "../../server/src/lib/sweeps";

const r2 = (n: number) => Math.round(n * 100) / 100;
let P: Provider;
let L: { id: string; blockId: string; dates: string[] };
let seq = 0;

async function listing(title: string) {
  const start = new Date(); start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7) + 21);
  const end = new Date(start); end.setDate(end.getDate() + 27);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const period = await ok("POST", "/api/periods", P.token, { title: "Full day", start: "09:00", finish: "15:30" });
  const pass = await ok("POST", "/api/passes", P.token, { name: "Week pass", days: 5 });
  const bundle = await ok("POST", "/api/block-bundles", P.token, { name: `RM ${title}`, periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 100, calcOn: true });
  const lst = await ok("POST", "/api/listings", P.token, {
    title, venueId: "emu-venue", runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [1, 2, 3, 4, 5],
    maxAttendees: "5000", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id,
    passes: [{ name: "Week pass", price: 100, days: 5 }], bookingType: "auto", status: "live", visibility: "public",
  });
  await ok("PUT", `/api/block-bundles/${bundle.id}/listings`, P.token, { listingIds: [lst.id] });
  const blocks = await db.collection("blocks").where("listingId", "==", lst.id).get();
  const dates = (blocks.docs[0].data().sessions as { date: string }[]).map((s) => s.date).sort().slice(0, 5);
  return { id: lst.id as string, blockId: blocks.docs[0].id, dates };
}

let stripe: any, payIntent: any;
before(async () => {
  P = await makeProvider("RM");
  const lib = (await ok("GET", "/api/library", P.token)) ?? {};
  const venues: any[] = lib.venues ?? [];
  if (!venues.some((v) => v.id === "emu-venue")) venues.push({ id: "emu-venue", name: "Test Sports Hall", address: "1 Test Way", city: "Testville" });
  await ok("PUT", "/api/library", P.token, {
    venues, addons: lib.addons ?? [],
    settings: { ...(lib.settings ?? {}), marketplaceListed: true, allowPartialCancel: true, partialAllowWallet: true, partialAllowRefund: true, allowCardRefund: true },
  });
  L = await listing(`RM ${uniq()}`);
  try { const m: any = await import("./_stack.mts"); stripe = m.stripe; payIntent = m.payIntent; } catch (e) { console.log("no stripe:", (e as Error).message); }
});

const walletId = (email: string) => `${P.tenantId}__${email.trim().toLowerCase()}`;
const setWallet = (email: string, balance: number) => db.collection("wallet").doc(walletId(email)).set({ tenantId: P.tenantId, email: email.toLowerCase(), balance, updatedAt: new Date().toISOString() });
const doc = (ref: string) => bookingDoc(P, ref);
const approve = (ref: string) => operatorAction(P, ref, { type: "refund-approve" });
const cancel = (ref: string, amount?: number) => operatorAction(P, ref, amount == null ? { type: "cancel", refund: "full" } : { type: "cancel", refund: "partial", amount });
const sent = (ref: string) => operatorAction(P, ref, { type: "refund-sent" });
const BANK = { accountName: "Test Parent", sortCode: "112233", accountNumber: "12345678" };

/** A booking of 100 paid offline: each [method, amount] is recorded by the provider. `own` is the booking's own method. */
async function offlineBooking(own: string, paid: [string, number][], scheme?: string): Promise<{ parent: Parent; ref: string }> {
  const parent = await makeParent("RM", P);
  const r = await call("POST", "/api/my/bookings", parent.token, { listingId: L.id, blockId: L.blockId, method: "Bank transfer", items: [{ pass: "Week pass", child: `Kid ${++seq}${uniq()}`, age: 8, dates: L.dates }] });
  assert.ok(r.status < 300, `book -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  const list = Array.isArray(r.json) ? r.json : (r.json?.bookings ?? [r.json]);
  const ref = (list[0]?.ref ?? list[0]?.booking?.ref) as string;
  await db.collection("bookings").doc(`${P.tenantId}_${ref}`).set({ method: own, ...(scheme ? { voucherScheme: scheme } : {}) }, { merge: true });
  for (const [method, amount] of paid) {
    const p = await call("POST", `/api/bookings/${encodeURIComponent(ref)}/record-payment`, P.token, { amount, method });
    assert.ok(p.status < 300, `pay ${method} -> ${p.status} ${JSON.stringify(p.json).slice(0, 200)}`);
  }
  return { parent, ref };
}
const familyView = async (parent: Parent, ref: string) => {
  const l = await ok("GET", "/api/my/bookings", parent.token);
  return (Array.isArray(l) ? l : l.bookings).find((b: any) => b.ref === ref);
};
async function parentBells(parent: Parent, ref: string) {
  await sleep(400);
  const s = await db.collection("notifications").where("tenantId", "==", P.tenantId).get();
  return s.docs.map((d) => d.data() as any).filter((n) => n.ref === ref && String(n.email ?? "").toLowerCase() === parent.email.toLowerCase());
}
const offlineEntries = (b: any) => ((b.refundEntries ?? []) as any[]).filter((e) => e.via === "offline");

describe("offline refunds name the method paid", () => {
  it("cash: cancel-panel data, release-preview, entries, family bell + emails, provider reminder", async () => {
    const f = await offlineBooking("Cash", [["Cash", 100]]);
    const fv = await familyView(f.parent, f.ref);
    assert.deepEqual(fv.refundMethod.kinds, ["cash"]);
    assert.deepEqual(fv.refundMethod.parts, [{ kind: "cash", amount: 100 }]);
    assert.equal(fv.refundMethod.hasCard, false);
    assert.equal("paidVia" in fv, false, "the provider's bookkeeping is not sent to the family");
    // cancel panel for released days: the preview names the method and the shares add up to what goes back
    const pv = await call("POST", `/api/my/bookings/${encodeURIComponent(f.ref)}/release-preview`, f.parent.token, { days: [L.dates[0]], resolution: "refund" });
    assert.equal(pv.status, 200, JSON.stringify(pv.json));
    assert.deepEqual(pv.json.method.kinds, ["cash"]);
    assert.equal(r2(pv.json.method.parts.reduce((n: number, p: any) => n + p.amount, 0)), pv.json.toOriginal);
    assert.ok(pv.json.refund > 0);

    assert.equal((await cancel(f.ref)).status, 200);
    const a = await approve(f.ref); assert.equal(a.status, 200, JSON.stringify(a.json));
    const b = await doc(f.ref);
    assert.deepEqual(offlineEntries(b).map((e) => e.parts), [[{ kind: "cash", amount: 100 }]]);
    assert.equal(r2(offlineEntries(b).reduce((n, e) => n + e.cash, 0)), 100, "the amount is untouched");
    const fv2 = await familyView(f.parent, f.ref);
    assert.deepEqual(fv2.refundMethod.sending, ["cash"]);
    const bell = (await parentBells(f.parent, f.ref)).find((n) => n.i18n?.bk === "rfm.bellRec");
    assert.ok(bell, "the family's approved-refund bell names the method");
    assert.equal(bell.i18n.bv.kinds, "cash");
    assert.match(bell.body, /cash refund/);
    assert.doesNotMatch(bell.body, /bank transfer|the way you paid/);
    const mail = refundApprovedSpec(b as any, "Acme Clubs").body;
    assert.match(mail, /will send your £100\.00 cash refund/);
    assert.doesNotMatch(mail, /bank transfer|the way you paid/);

    // the provider's reminder: backdate the ledger row 4 days, run the sweep
    const led = await db.collection("payments").where("tenantId", "==", P.tenantId).where("status", "==", "to-reimburse").get();
    for (const d of led.docs) if ((d.get("refs") ?? [])[0] === f.ref) await d.ref.update({ createdAt: new Date(Date.now() - 4 * 86_400_000).toISOString() });
    await refundTransferReminders();
    await sleep(500);
    const ours = (await db.collection("notifications").where("tenantId", "==", P.tenantId).get()).docs.map((d) => d.data() as any).filter((n) => String(n.title).includes(f.ref) && /refund to send/i.test(String(n.title)));
    assert.ok(ours.length >= 1, "the reminder fired");
    assert.equal(ours[0].body.split(" · ")[0], "Hand back £100.00 in cash");

    const s = await sent(f.ref); assert.equal(s.status, 200, JSON.stringify(s.json));
    const b2 = await doc(f.ref);
    const sentBell = (await parentBells(f.parent, f.ref)).find((n) => /has been sent/.test(String(n.body)));
    assert.ok(sentBell, "the family hears it was sent");
    assert.match(sentBell.body, /has been sent in cash/);
    const sentMail = refundSentSpec(b2 as any, "Acme Clubs").body;
    assert.match(sentMail, /in cash/);
    assert.doesNotMatch(sentMail, /Bank transfers usually/);
  });

  it("bank transfer: names bank transfer, the bank-transfer note stays", async () => {
    const f = await offlineBooking("Bank transfer", [["Bank transfer", 100]]);
    const fv = await familyView(f.parent, f.ref);
    assert.deepEqual(fv.refundMethod.kinds, ["bank"]);
    assert.equal((await call("POST", `/api/my/bookings/${encodeURIComponent(f.ref)}/cancel`, f.parent.token, { refundPref: "card", refundBank: BANK })).status, 200);
    assert.equal((await approve(f.ref)).status, 200);
    const b = await doc(f.ref);
    assert.deepEqual(offlineEntries(b).map((e) => e.parts), [[{ kind: "bank", amount: 100 }]]);
    const bell = (await parentBells(f.parent, f.ref)).find((n) => n.i18n?.bk === "rfm.bellRec");
    assert.ok(bell); assert.equal(bell.i18n.bv.kinds, "bank"); assert.match(bell.body, /bank transfer refund/);
    assert.match(refundApprovedSpec(b as any, "Acme Clubs").body, /will send your £100\.00 bank transfer refund/);
    assert.equal((await sent(f.ref)).status, 200);
    const b2 = await doc(f.ref);
    assert.match(refundSentSpec(b2 as any, "Acme Clubs").body, /by bank transfer/);
    assert.match(refundSentSpec(b2 as any, "Acme Clubs").body, /Bank transfers usually/);
    assert.ok((await parentBells(f.parent, f.ref)).some((n) => /has been sent by bank transfer/.test(String(n.body))));
  });

  it("voucher: names the voucher", async () => {
    const f = await offlineBooking("Voucher", [["Voucher", 100]], "Edenred");
    const fv = await familyView(f.parent, f.ref);
    assert.deepEqual(fv.refundMethod.kinds, ["voucher"]);
    assert.equal((await cancel(f.ref)).status, 200);
    assert.equal((await approve(f.ref)).status, 200);
    const b = await doc(f.ref);
    assert.deepEqual(offlineEntries(b).map((e) => e.parts), [[{ kind: "voucher", amount: 100 }]]);
    const bell = (await parentBells(f.parent, f.ref)).find((n) => n.i18n?.bk === "rfm.bellRec");
    assert.ok(bell); assert.match(bell.body, /voucher refund/);
    const mail = refundApprovedSpec(b as any, "Acme Clubs").body;
    assert.match(mail, /voucher refund/); assert.match(mail, /Edenred/);
  });

  it("mixed bank transfer + cash: both are named, the shares add up to the penny", async () => {
    const f = await offlineBooking("Bank transfer", [["Bank transfer", 60], ["Cash", 40]]);
    const fv = await familyView(f.parent, f.ref);
    assert.deepEqual(fv.refundMethod.kinds, ["bank", "cash"]);
    assert.deepEqual(fv.refundMethod.parts, [{ kind: "bank", amount: 60 }, { kind: "cash", amount: 40 }]);
    assert.equal((await cancel(f.ref, 33.33)).status, 200);
    assert.equal((await approve(f.ref)).status, 200);
    const b = await doc(f.ref);
    const parts = offlineEntries(b).flatMap((e) => e.parts);
    assert.deepEqual(parts, [{ kind: "bank", amount: 20 }, { kind: "cash", amount: 13.33 }]);
    assert.equal(r2(parts.reduce((n: number, p: any) => n + p.amount, 0)), 33.33);
    const bell = (await parentBells(f.parent, f.ref)).find((n) => n.i18n?.bk === "rfm.bellRec");
    assert.ok(bell); assert.equal(bell.i18n.bv.kinds, "bank,cash"); assert.match(bell.body, /bank transfer and cash refund/);
    assert.match(refundApprovedSpec(b as any, "Acme Clubs").body, /bank transfer and cash refund/);
    assert.equal((await sent(f.ref)).status, 200);
    assert.match(refundSentSpec(await doc(f.ref) as any, "Acme Clubs").body, /by bank transfer and cash/);
  });

  it("card + wallet: no offline wording anywhere", async (t) => {
    if (!stripe) return t.skip("no stripe test key");
    const parent = await makeParent("RM", P);
    await setWallet(parent.email, 30);
    const r = await call("POST", "/api/my/bookings", parent.token, { listingId: L.id, blockId: L.blockId, method: "card", items: [{ pass: "Week pass", child: `Kid ${++seq}${uniq()}`, age: 8, dates: L.dates }] });
    assert.ok(r.status < 300, JSON.stringify(r.json).slice(0, 300));
    const list = Array.isArray(r.json) ? r.json : (r.json?.bookings ?? [r.json]);
    const ref = (list[0]?.ref ?? list[0]?.booking?.ref) as string;
    const co = await call("POST", "/api/payments/checkout", parent.token, { refs: [ref], tenantId: P.tenantId });
    assert.equal(co.status, 201, JSON.stringify(co.json));
    await payIntent(String(co.json.clientSecret).split("_secret_")[0]);
    const c = await call("POST", `/api/payments/checkout/${co.json.paymentId}/confirm`, parent.token);
    assert.equal(c.json.paid, true, JSON.stringify(c.json));
    const fv = await familyView(parent, ref);
    assert.equal(fv.refundMethod, undefined, "nothing was paid offline");
    assert.equal((await cancel(ref)).status, 200);
    const a = await approve(ref); assert.equal(a.status, 200, JSON.stringify(a.json));
    const b = await doc(ref);
    assert.equal(offlineEntries(b).length, 0);
    assert.ok(!(b.refundEntries ?? []).some((e: any) => e.parts), "no entry carries offline kinds");
    const bells = await parentBells(parent, ref);
    for (const n of bells) assert.doesNotMatch(`${n.title} ${n.body}`, /bank transfer|cash|voucher/i, `bell: ${n.body}`);
    assert.ok(!bells.some((n) => n.i18n?.bk === "rfm.bellRec"));
    assert.doesNotMatch(refundApprovedSpec(b as any, "Acme Clubs").body, /bank transfer|cash|voucher/i);
    assert.equal((await familyView(parent, ref)).refundMethod, undefined);
  });
});
