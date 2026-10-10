/**
 * Franchise payouts and a REAL Stripe TEST refund delivered by webhook: the payouts figure must move at once, never serve the old
 * 60-second cached total. A franchise-owned listing, a £20 card booking really paid in Stripe TEST, then an £8 refund made in the Stripe
 * dashboard and delivered signed to the local API (the same path Stripe uses).
 * Worked out first: card 20 -> after the refund 12; head office keeps 10% = 1.20; the franchise gets 10.80.
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { makeProvider, makeParent, makeListing, book, uniq, call, db, sleep, bookingDoc, login as hLogin, type Provider, type Parent, type Listing } from "./helpers.mts";
import { deliver, stripe, payIntent } from "./_stack.mts";

let P: Provider, A: Parent, L: Listing;
const F = `frW-${uniq()}`;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const waitFor = async (fn: () => Promise<boolean>, ms = 8000) => { const t = Date.now() + ms; while (Date.now() < t) { if (await fn()) return true; await sleep(200); } return false; };

before(async () => {
  P = await makeProvider("FPW"); A = await makeParent("FPWA", P);
  L = await makeListing(P, `FPW camp ${uniq()}`, false);
  await db.collection("listings").doc(L.id).set({ franchiseId: F }, { merge: true });
  const s = await hLogin(`fw-${uniq()}@emu.test`);
  await db.collection("users").doc(s.uid).set({ role: "franchise", tenantId: P.tenantId, franchiseId: F, franchiseName: "Webhook Camps", name: "W" });
});

const row = async () => {
  const t = today();
  const r = await call("GET", `/api/splitfees/payouts?from=${t}&to=${t}`, P.token);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return (r.json.rows as any[]).find((x) => x.franchiseId === F);
};

describe("a Stripe refund by webhook reaches the payouts figure immediately", () => {
  it("card 20 is shown, an 8 refund in Stripe is delivered, the very next read shows 12 (keeps 1.20, franchise gets 10.80)", async () => {
    const ref = await book(A, L, { method: "card" });
    const co = await call("POST", "/api/payments/checkout", A.token, { refs: [ref], tenantId: P.tenantId });
    assert.equal(co.status, 201, JSON.stringify(co.json));
    const piId = String(co.json.clientSecret).split("_secret_")[0];
    await payIntent(piId);
    const conf = await call("POST", `/api/payments/checkout/${co.json.paymentId}/confirm`, A.token);
    assert.equal(conf.json.paid, true, JSON.stringify(conf.json));
    const pi = await stripe.paymentIntents.retrieve(piId);

    const before = await row();
    assert.deepEqual([before.card, before.hoKeepsCard, before.franchiseCard], [20, 2, 18], "this fills the cache");

    await stripe.refunds.create({ payment_intent: pi.id, amount: 800 });
    const ch = await stripe.charges.retrieve(String(pi.latest_charge));
    const d = await deliver(`evt_fp_${uniq()}${uniq()}`, "charge.refunded", ch);
    assert.equal(d.status, 200);
    assert.ok(await waitFor(async () => ((await bookingDoc(P, ref)).refundLog ?? []).length > 0), "the refund is on the booking");
    const after = await row(); // no wait for the 60 seconds
    assert.deepEqual([after.card, after.hoKeepsCard, after.franchiseCard], [12, 1.2, 10.8]);
  });
});
