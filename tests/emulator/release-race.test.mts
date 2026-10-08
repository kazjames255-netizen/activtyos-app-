// Behaviour tests: PARALLEL releases / cancels of the same booking must never pay out more than the days actually removed are worth,
// and never more than was paid. Real API + Firestore emulator (npm run test:emu).
//
// A 5-day pass at 100 pounds, paid in full: each day is worth exactly 20. Every iteration books a FRESH booking, fires 15 requests at
// once, then checks the wallet ledger (walletEntries), the stored booking (refund log / pending refund) and the parent's wallet balance.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { call, db, makeParent, makeProvider, ok, operatorAction, uniq, type Parent, type Provider } from "./helpers.mts";

const ITER = Number(process.env.RACE_ITER ?? 30);
const PAR = 15;
const DAY = 20; // 100 / 5
let P: Provider;
let listingId = "";
let blockId = "";
let dates: string[] = [];
let seq = 0;

before(async () => {
  P = await makeProvider("R");
  const lib = (await ok("GET", "/api/library", P.token)) ?? {};
  const venues: any[] = lib.venues ?? [];
  if (!venues.some((v) => v.id === "emu-venue")) venues.push({ id: "emu-venue", name: "Test Sports Hall", address: "1 Test Way", city: "Testville" });
  await ok("PUT", "/api/library", P.token, { venues, addons: lib.addons ?? [], settings: { ...(lib.settings ?? {}), marketplaceListed: true, allowPartialCancel: true, partialAllowWallet: true, partialAllowRefund: true } });
  const start = new Date(); start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7) + 21);
  const end = new Date(start); end.setDate(end.getDate() + 27);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const period = await ok("POST", "/api/periods", P.token, { title: "Full day", start: "09:00", finish: "15:30" });
  const pass = await ok("POST", "/api/passes", P.token, { name: "Week pass", days: 5 });
  const bundle = await ok("POST", "/api/block-bundles", P.token, { name: `Race block ${uniq()}`, periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 100, calcOn: true });
  const listing = await ok("POST", "/api/listings", P.token, {
    title: `Race camp ${uniq()}`, venueId: "emu-venue", runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [1, 2, 3, 4, 5],
    maxAttendees: "5000", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id,
    passes: [{ name: "Week pass", price: 100, days: 5 }], bookingType: "auto", status: "live", visibility: "public",
  });
  await ok("PUT", `/api/block-bundles/${bundle.id}/listings`, P.token, { listingIds: [listing.id] });
  const blocks = await db.collection("blocks").where("listingId", "==", listing.id).get();
  assert.ok(!blocks.empty);
  listingId = listing.id; blockId = blocks.docs[0].id;
  dates = (blocks.docs[0].data().sessions as { date: string }[]).map((s) => s.date).sort().slice(0, 5);
  assert.equal(dates.length, 5);
});

/** A fresh booking of 5 days, paid in full (100). Returns the ref. */
const owners = new Map<string, Parent>();
async function paidBooking(): Promise<string> {
  // A fresh family each time: wallet credit from an earlier iteration would otherwise be spent at checkout.
  const parent = await makeParent("R", P);
  const r = await call("POST", "/api/my/bookings", parent.token, { listingId, blockId, method: "Bank transfer", items: [{ pass: "Week pass", child: `Kid ${++seq}${uniq()}`, age: 8, dates }] });
  assert.ok(r.status < 300, `book -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  const list = Array.isArray(r.json) ? r.json : (r.json?.bookings ?? [r.json]);
  const ref = (list[0]?.ref ?? list[0]?.booking?.ref) as string;
  assert.ok(ref);
  owners.set(ref, parent);
  const pay = await call("POST", `/api/bookings/${encodeURIComponent(ref)}/record-payment`, P.token, { amount: 100, method: "Bank transfer" });
  assert.ok(pay.status < 300, `pay -> ${pay.status} ${JSON.stringify(pay.json).slice(0, 300)}`);
  return ref;
}
const doc = async (ref: string) => (await db.collection("bookings").doc(`${P.tenantId}_${ref}`).get()).data() as Record<string, any>;
/** Everything credited to the wallet for this booking (ledger). */
async function walletCredit(ref: string): Promise<number> {
  const s = await db.collection("walletEntries").where("tenantId", "==", P.tenantId).where("ref", "==", ref).get();
  return Math.round(s.docs.reduce((n, d) => n + Number(d.get("delta") ?? 0), 0) * 100) / 100;
}
const round2 = (n: number) => Math.round(n * 100) / 100;
const pending = (d: Record<string, any>) => (["pending", "full", "partial"].includes(d.cancel?.refund) ? Number(d.cancel?.amount ?? 0) : 0);
const release = (ref: string, days: string[], resolution: "wallet" | "refund") => call("POST", `/api/my/bookings/${encodeURIComponent(ref)}/cancel`, owners.get(ref)!.token, { days, resolution, msg: "race" });
const times = <T,>(n: number, f: (i: number) => Promise<T>) => Promise.all(Array.from({ length: n }, (_, i) => f(i)));
const loop = async (name: string, body: (i: number) => Promise<void>) => { for (let i = 0; i < ITER; i++) { try { await body(i); } catch (e) { (e as Error).message = `[${name} iteration ${i}] ${(e as Error).message}`; throw e; } } };

describe("parallel releases never pay out more than the days removed are worth", () => {
  it(`wallet: ${PAR} parallel releases of the SAME day credit exactly one day (20), once`, async () => {
    await loop("wallet-same-day", async () => {
      const ref = await paidBooking();
      const res = await times(PAR, () => release(ref, [dates[2]], "wallet"));
      const credit = await walletCredit(ref);
      const d = await doc(ref);
      assert.equal(credit, DAY, `wallet credit ${credit} (statuses ${res.map((r) => r.status)})`);
      assert.equal(res.filter((r) => r.status === 200).length, 1, `exactly one release succeeds: ${res.map((r) => r.status)}`);
      assert.ok(res.filter((r) => r.status !== 200).every((r) => r.status === 400 || r.status === 409), "the others are refused 400/409");
      const logged = (d.refundLog ?? []).filter((x: any) => x.source === "Wallet").reduce((n: number, x: any) => n + x.amount, 0);
      assert.equal(round2(logged), DAY, "refund log agrees with the ledger");
    });
  });

  it(`refund: ${PAR} parallel refund-releases of the SAME day leave one day's pending refund (<= 20), and approving sends no more`, async () => {
    await loop("refund-same-day", async () => {
      const ref = await paidBooking();
      const ctl = await paidBooking();
      assert.equal((await release(ctl, [dates[2]], "refund")).status, 200);
      const one = pending(await doc(ctl)); // what ONE release is worth under this provider's policy
      const res = await times(PAR, () => release(ref, [dates[2]], "refund"));
      const d = await doc(ref);
      assert.ok(pending(d) <= DAY + 0.005, `pending refund ${pending(d)} for one day (statuses ${res.map((r) => r.status)})`);
      assert.equal(pending(d), one, "same pending refund as a single release");
      assert.equal(res.filter((r) => r.status === 200).length, 1, `exactly one release succeeds: ${res.map((r) => r.status)}`);
      if (pending(d) > 0) {
        const ap = await operatorAction(P, ref, { type: "refund-approve" });
        assert.equal(ap.status, 200, JSON.stringify(ap.json));
        const after = await doc(ref);
        assert.ok(Number(after.refundedApproved ?? 0) <= DAY + 0.005, `approved ${after.refundedApproved} for one day`);
      }
    });
  });

  it("mixed: wallet and refund releases of the same day in parallel pay out one day in total", async () => {
    await loop("mixed", async () => {
      const ref = await paidBooking();
      const res = await times(PAR, (i) => release(ref, [dates[1]], i % 2 ? "wallet" : "refund"));
      const d = await doc(ref);
      const w = await walletCredit(ref);
      const total = round2(w + pending(d));
      assert.ok(total <= DAY + 0.005, `wallet ${w} + pending ${pending(d)} = ${total} > 20 (statuses ${res.map((r) => r.status)})`);
      assert.equal(res.filter((r) => r.status === 200).length, 1);
    });
  });

  it("release (wallet) vs provider cancel-day (wallet) of the same day, in parallel: one day's credit in total", async () => {
    await loop("release-vs-cancel-day", async () => {
      const ref = await paidBooking();
      const reqs = [...Array.from({ length: 8 }, () => release(ref, [dates[3]], "wallet")), ...Array.from({ length: 7 }, () => operatorAction(P, ref, { type: "cancel-day", ki: 0, date: dates[3], resolution: "wallet" }))];
      const res = await Promise.all(reqs);
      const credit = await walletCredit(ref);
      assert.equal(credit, DAY, `credit ${credit} (statuses ${res.map((r) => r.status)})`);
    });
  });

  it("release (refund) vs provider cancel-day (refund) of the same day, in parallel: pending refund never above one day", async () => {
    await loop("release-vs-cancel-day-refund", async () => {
      const ref = await paidBooking();
      const res = await Promise.all([...Array.from({ length: 8 }, () => release(ref, [dates[3]], "refund")), ...Array.from({ length: 7 }, () => operatorAction(P, ref, { type: "cancel-day", ki: 0, date: dates[3], resolution: "refund" }))]);
      const d = await doc(ref);
      assert.ok(pending(d) <= DAY + 0.005, `pending ${pending(d)} (statuses ${res.map((r) => r.status)})`);
    });
  });

  it("release vs provider cancel-child, in parallel: never more than the 100 paid in total", async () => {
    await loop("release-vs-cancel-child", async () => {
      const ref = await paidBooking();
      await Promise.all([...Array.from({ length: 8 }, (_, i) => release(ref, [dates[i % 4]], "wallet")), ...Array.from({ length: 7 }, () => operatorAction(P, ref, { type: "cancel-child", ki: 0, resolution: "wallet" }))]);
      const credit = await walletCredit(ref);
      assert.ok(credit <= 100.005, `credit ${credit} > paid 100`);
    });
  });

  it("different days in parallel: credit equals the days actually released, and the last day is never released", async () => {
    await loop("different-days", async () => {
      const ref = await paidBooking();
      const res = await times(PAR, (i) => release(ref, [dates[i % 5]], "wallet"));
      const d = await doc(ref);
      const gone = (d.kids?.[0]?.cancelledDays ?? []) as string[];
      const credit = await walletCredit(ref);
      assert.equal(credit, round2(gone.length * DAY), `credit ${credit} for ${gone.length} released days (statuses ${res.map((r) => r.status)})`);
      assert.ok(gone.length <= 4, "at least one day always stands");
      assert.ok(credit <= 100.005);
    });
  });

  it("release vs whole-booking cancel by the parent and by the provider, in parallel: total back never above paid", async () => {
    await loop("release-vs-cancel", async () => {
      const ref = await paidBooking();
      const res = await Promise.all([
        ...Array.from({ length: 6 }, (_, i) => release(ref, [dates[i % 4]], i % 2 ? "wallet" : "refund")),
        call("POST", `/api/my/bookings/${encodeURIComponent(ref)}/cancel`, owners.get(ref)!.token, { msg: "all" }),
        operatorAction(P, ref, { type: "cancel", refund: "full" }),
      ]);
      const d = await doc(ref);
      const w = await walletCredit(ref);
      const total = round2(w + pending(d) + Number(d.refundedApproved ?? 0));
      assert.ok(total <= 100.005, `wallet ${w} + pending ${pending(d)} + approved ${d.refundedApproved ?? 0} > paid 100 (statuses ${res.map((r) => r.status)})`);
    });
  });

  it("refund approve / decline replays in parallel act once", async () => {
    await loop("approve-replay", async () => {
      const ref = await paidBooking();
      assert.equal((await release(ref, [dates[0]], "refund")).status, 200);
      const before = await walletCredit(ref);
      const res = await Promise.all([...Array.from({ length: 5 }, () => operatorAction(P, ref, { type: "refund-approve" })), ...Array.from({ length: 5 }, () => operatorAction(P, ref, { type: "refund-decline" }))]);
      const d = await doc(ref);
      const credit = round2((await walletCredit(ref)) - before);
      assert.ok(credit <= DAY + 0.005 && Number(d.refundedApproved ?? 0) <= DAY + 0.005, `credit ${credit} approved ${d.refundedApproved} (statuses ${res.map((r) => r.status)})`);
    });
  });
});
