// Behaviour tests: a discount code is handed back exactly once when the booking that used it ends without the family getting the place.
// Real API + Firestore emulator (npm run test:emu). Each test books through POST /api/my/bookings, ends the booking through the real
// route (or the real sweep / lib function), and reads the code document's usedCount from the emulator.
//
// Every test also books a BYSTANDER with the same code, so usedCount is 2 before the release: an over-release shows up as 0 (or lower),
// a missing release as 2, and the right answer is exactly 1.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
  book, bookingDoc, bulk, call, db, makeCode, makeListing, makeParent, makeProvider, operatorAction, patchBooking, redemptionsFor,
  settle, stays, uniq, usedCount, type Code, type Listing, type Parent, type Provider,
} from "./helpers.mts";

let P: Provider;
let auto: Listing; // auto-confirm: bookings are Confirmed (unpaid, bank transfer)
let manual: Listing; // manual approval: bookings are "Approval needed"
let A: Parent, B: Parent, C: Parent;

before(async () => {
  P = await makeProvider("P");
  auto = await makeListing(P, `Auto camp ${uniq()}`, false);
  manual = await makeListing(P, `Manual camp ${uniq()}`, true);
  A = await makeParent("A", P);
  B = await makeParent("B", P);
  C = await makeParent("C", P);
});

/** A fresh code, a bystander booking holding one use, and the booking under test holding another. usedCount is 2. */
async function twoUses(l: Listing, parent: Parent = A): Promise<{ code: Code; ref: string; bystander: string }> {
  const code = await makeCode(P, `T${uniq().toUpperCase()}`);
  const bystander = await book(B, l, { code: code.code });
  const ref = await book(parent, l, { code: code.code });
  assert.equal(await usedCount(code), 2, "setup: both bookings used the code");
  return { code, ref, bystander };
}
/** Make a manual-approval booking look like a held card (no Stripe in the emulator: no intent id, so nothing is sent to Stripe). */
const holdIt = (ref: string, expiresAt: string, state = "held") => patchBooking(P, ref, { cardHold: { state, expiresAt, amount: 18 } });

describe("a code is released when the booking ends without the place", () => {
  it("operator cancels an unpaid booking: back by exactly 1; a second cancel is refused and changes nothing", async () => {
    const { code, ref } = await twoUses(auto);
    const r = await operatorAction(P, ref, { type: "cancel", refund: "none" });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    await settle(code, 1, "after operator cancel");
    assert.equal((await operatorAction(P, ref, { type: "cancel", refund: "none" })).status, 409);
    await stays(code, 1, "after the repeated cancel");
    assert.equal((await redemptionsFor(code)).length, 1, "only the bystander's redemption is left");
  });

  it("operator declines a manual-approval card-hold request: back by exactly 1; declining twice releases once", async () => {
    const { code, ref } = await twoUses(manual);
    await holdIt(ref, new Date(Date.now() + 5 * 86400_000).toISOString());
    assert.equal((await bookingDoc(P, ref)).status, "Approval needed");
    const r = await operatorAction(P, ref, { type: "decline", reason: "Full" });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal((await bookingDoc(P, ref)).status, "Declined");
    await settle(code, 1, "after decline");
    assert.equal((await operatorAction(P, ref, { type: "decline" })).status, 409);
    await stays(code, 1, "after declining again");
  });

  it("bulk decline releases every declined booking's code once, and a repeat bulk decline releases nothing more", async () => {
    const code1 = await makeCode(P, `T${uniq().toUpperCase()}`);
    const code2 = await makeCode(P, `T${uniq().toUpperCase()}`);
    const by1 = await book(C, manual, { code: code1.code });
    const by2 = await book(C, manual, { code: code2.code });
    const r1 = await book(A, manual, { code: code1.code });
    const r2 = await book(B, manual, { code: code2.code });
    assert.deepEqual([await usedCount(code1), await usedCount(code2)], [2, 2]);
    assert.equal((await bulk(P, [r1, r2], "decline")).status, 200);
    await settle(code1, 1, "bulk decline, code 1");
    await settle(code2, 1, "bulk decline, code 2");
    assert.equal((await bulk(P, [r1, r2], "decline")).status, 200);
    await stays(code1, 1, "bulk decline repeated, code 1");
    await stays(code2, 1, "bulk decline repeated, code 2");
    assert.ok(by1 && by2);
  });

  it("bulk cancel releases each cancelled booking's code once; repeating the bulk cancel does not over-release", async () => {
    const { code, ref } = await twoUses(auto);
    const other = await makeCode(P, `T${uniq().toUpperCase()}`);
    await book(C, auto, { code: other.code });
    const ref2 = await book(A, auto, { code: other.code });
    assert.equal((await bulk(P, [ref, ref2], "cancel")).status, 200);
    await settle(code, 1, "bulk cancel, code 1");
    await settle(other, 1, "bulk cancel, code 2");
    assert.equal((await bulk(P, [ref, ref2], "cancel")).status, 200);
    await stays(code, 1, "bulk cancel repeated, code 1");
    await stays(other, 1, "bulk cancel repeated, code 2");
  });

  it("the hold-lapse sweep declines an expired request and gives its code back once; running the sweep again changes nothing", async () => {
    const { code, ref } = await twoUses(manual);
    await holdIt(ref, new Date(Date.now() - 60_000).toISOString());
    const { cardHoldSweep } = await import("../../server/src/lib/cardHold");
    await cardHoldSweep();
    assert.equal((await bookingDoc(P, ref)).status, "Declined", "the sweep declined the lapsed request");
    await settle(code, 1, "after the lapse sweep");
    await cardHoldSweep();
    await stays(code, 1, "after a second sweep");
  });

  it("a family that never entered their card (awaiting, over a day old) loses the request and the code comes back", async () => {
    const { code, ref } = await twoUses(manual);
    await patchBooking(P, ref, { cardHold: { state: "awaiting", amount: 18 }, createdAt: new Date(Date.now() - 3 * 86400_000).toISOString() });
    const { cardHoldSweep } = await import("../../server/src/lib/cardHold");
    await cardHoldSweep();
    assert.equal((await bookingDoc(P, ref)).status, "Declined");
    await settle(code, 1, "after the awaiting-card sweep");
  });

  it("the family turns down an offered waiting-list place: code back by exactly 1; a second decline is refused", async () => {
    const { code, ref } = await twoUses(auto);
    // The waiting list's offer step (2-hour hold) is simulated by writing the Offered status; the decline itself is the real route.
    await patchBooking(P, ref, { status: "Offered" });
    const r = await call("POST", `/api/my/bookings/${encodeURIComponent(ref)}/decline-offer`, A.token, {});
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal((await bookingDoc(P, ref)).status, "Cancelled");
    await settle(code, 1, "after declining the offer");
    assert.ok((await call("POST", `/api/my/bookings/${encodeURIComponent(ref)}/decline-offer`, A.token, {})).status >= 400);
    await stays(code, 1, "after declining the offer again");
  });

  it("the parent cancels an unpaid booking: back by exactly 1; cancelling again is refused", async () => {
    const { code, ref } = await twoUses(auto);
    const r = await call("POST", `/api/my/bookings/${encodeURIComponent(ref)}/cancel`, A.token, { msg: "Changed plans" });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    await settle(code, 1, "after parent cancel");
    assert.ok((await call("POST", `/api/my/bookings/${encodeURIComponent(ref)}/cancel`, A.token, {})).status >= 400);
    await stays(code, 1, "after parent cancels again");
  });

  it("a sibling basket (one redemption covering two bookings): the code only comes back when the LAST booking of the basket ends", async () => {
    // The API merges a basket's children into one booking, so a two-booking basket is built by pointing one redemption at two
    // bookings; the release code under test is the real one.
    const code = await makeCode(P, `T${uniq().toUpperCase()}`);
    await book(B, auto, { code: code.code }); // bystander
    const r1 = await book(A, auto, { code: code.code });
    const r2 = await book(A, auto, { code: code.code });
    const reds = (await redemptionsFor(code)).filter((d) => (d.get("refs") as string[]).some((x) => x === r1 || x === r2));
    assert.equal(reds.length, 2);
    await reds[1].ref.delete();
    await reds[0].ref.update({ refs: [r1, r2] });
    await db.collection("discountCodes").doc(code.id).update({ usedCount: 2 }); // bystander + the one basket
    await operatorAction(P, r1, { type: "cancel", refund: "none" });
    await stays(code, 2, "one sibling cancelled: the basket still holds the code");
    await operatorAction(P, r2, { type: "cancel", refund: "none" });
    await settle(code, 1, "both siblings cancelled");
  });
});

describe("idempotency and limits", () => {
  it("a decline and the lapse sweep on the same booking at the same instant release exactly once", async () => {
    for (let round = 0; round < 3; round++) {
      const { code, ref } = await twoUses(manual);
      await holdIt(ref, new Date(Date.now() - 60_000).toISOString());
      const { cardHoldSweep } = await import("../../server/src/lib/cardHold");
      await Promise.all([operatorAction(P, ref, { type: "decline" }), cardHoldSweep()]);
      assert.equal((await bookingDoc(P, ref)).status, "Declined");
      await settle(code, 1, `decline racing the sweep, round ${round}`, 900);
    }
  });

  it("two simultaneous operator cancels and a parent cancel of the same booking release exactly once", async () => {
    const { code, ref } = await twoUses(auto);
    await Promise.all([
      operatorAction(P, ref, { type: "cancel", refund: "none" }),
      operatorAction(P, ref, { type: "cancel", refund: "none" }),
      call("POST", `/api/my/bookings/${encodeURIComponent(ref)}/cancel`, A.token, {}),
    ]);
    await settle(code, 1, "three racing cancels", 900);
  });

  it("releaseDiscountCodes called many times at once for one booking still releases once (it is transactional)", async () => {
    const { releaseDiscountCodes } = await import("../../server/src/lib/discountRedemptions");
    for (let round = 0; round < 3; round++) {
      const { code, ref } = await twoUses(auto);
      // End the booking in the database without going through a route, so ONLY the direct calls below can release it.
      await patchBooking(P, ref, { status: "Cancelled", cancel: { on: "01/01/2030", by: "Provider", refund: "none", msg: "test" } });
      await Promise.all(Array.from({ length: 8 }, () => releaseDiscountCodes(P.tenantId, ref)));
      await settle(code, 1, `eight concurrent releases, round ${round}`, 400);
    }
  });

  it("the count never goes below 0, however many times a release is attempted", async () => {
    const { releaseDiscountCodes } = await import("../../server/src/lib/discountRedemptions");
    const code = await makeCode(P, `T${uniq().toUpperCase()}`);
    const ref = await book(A, auto, { code: code.code });
    await operatorAction(P, ref, { type: "cancel", refund: "none" });
    await settle(code, 0, "released to 0");
    for (let i = 0; i < 3; i++) await releaseDiscountCodes(P.tenantId, ref);
    await operatorAction(P, ref, { type: "cancel", refund: "none" }); // refused, 409
    await bulk(P, [ref], "cancel");
    await stays(code, 0, "never below 0");
    // A stale redemption left behind while the counter is already 0 must not drive it negative either.
    await db.collection("discountRedemptions").add({ codeId: code.id, tenantId: P.tenantId, code: code.code, refs: [ref], at: new Date().toISOString() });
    await releaseDiscountCodes(P.tenantId, ref);
    await stays(code, 0, "stale redemption with counter at 0");
  });

  it("a one-use code that was declined can be used again by someone else", async () => {
    const code = await makeCode(P, `ONE${uniq().toUpperCase()}`, { usageLimit: 1 });
    const ref = await book(A, manual, { code: code.code });
    const refused = await call("POST", "/api/my/bookings", B.token, { listingId: manual.id, blockId: manual.blockId, method: "Bank transfer", discountCode: code.code, items: [{ pass: "Day pass", child: `Kid${uniq()}`, age: 8 }] });
    assert.ok(refused.status >= 400, "the one-use code is spent while the first booking stands");
    assert.equal((await operatorAction(P, ref, { type: "decline" })).status, 200);
    await settle(code, 0, "one-use code released");
    const again = await book(B, manual, { code: code.code });
    assert.ok(again);
    assert.equal(await usedCount(code), 1);
  });
});

describe("a booking that was paid keeps its code unless all the money went back", () => {
  async function paidBooking() {
    const { code, ref } = await twoUses(auto);
    const r = await operatorAction(P, ref, { type: "paid" });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const b = await bookingDoc(P, ref);
    assert.equal(b.pay, "Paid");
    return { code, ref, amount: Number(b.amount) };
  }

  it("a paid booking cancelled with a PARTIAL refund does not release the code (it stays used)", async () => {
    const { code, ref, amount } = await paidBooking();
    const r = await operatorAction(P, ref, { type: "cancel", refund: "partial", amount: Math.round(amount / 2 * 100) / 100 });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal((await bookingDoc(P, ref)).status, "Cancelled");
    await stays(code, 2, "paid + partial refund keeps the code used");
  });

  it("a paid booking cancelled with NO refund does not release the code", async () => {
    const { code, ref } = await paidBooking();
    assert.equal((await operatorAction(P, ref, { type: "cancel", refund: "none" })).status, 200);
    await stays(code, 2, "paid + no refund keeps the code used");
  });

  it("a paid booking cancelled with a FULL refund does release the code (open owner decision C41: recorded, not asserted as policy)", async () => {
    const { code, ref, amount } = await paidBooking();
    assert.equal((await operatorAction(P, ref, { type: "cancel", refund: "full", amount })).status, 200);
    await settle(code, 1, "paid + full refund releases the code");
  });
});
