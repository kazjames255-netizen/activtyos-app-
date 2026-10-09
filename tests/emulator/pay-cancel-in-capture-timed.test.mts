/**
 * Timed behaviour test for a cancel that lands anywhere inside (or around) the approval's capture: the provider approves, and a parent cancel or a
 * provider cancel arrives 0-2000 ms later (random jitter), many trials, waves of parallel trials (load widens the window the way real traffic does).
 * After the dust settles every trial is judged against Stripe's own books and the booking:
 *   - an ended booking (Cancelled / Declined) is never "Paid" while money was captured: it is either refunded at Stripe or has the refund pending;
 *   - at most one refund, never more than was captured; money captured and cancelled are never both true;
 *   - a captured payment's record is never "released"; a released hold is never left standing at Stripe for an ended booking;
 *   - a booking that stayed approved is Confirmed + Paid with no refund.
 * CIC_TRIALS (default 24) trials in waves of CIC_WAVE (default 8). Live Stripe TEST via the platform fallback; connected-account path NOT exercised.
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { makeProvider, makeParent, makeListing, book, uniq, call, db, sleep, operatorAction, bookingDoc, type Provider, type Parent, type Listing } from "./helpers.mts";
import { stripe, payIntent } from "./_stack.mts";

const TRIALS = Number(process.env.CIC_TRIALS || 24);
const WAVE = Number(process.env.CIC_WAVE || 8);
let P: Provider, A: Parent, M: Listing;
before(async () => {
  P = await makeProvider("CICT"); A = await makeParent("CICTA", P);
  M = await makeListing(P, `CICT manual ${uniq()}`, true);
});

/** The test client itself can hit Stripe's test rate limit under load: that must never be mistaken for a product failure. */
async function sr<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= 8 || !/rate.?limit|lock_timeout|ECONNRESET|fetch failed/i.test(`${(e as any)?.code} ${(e as Error).message}`)) throw e;
      await sleep(300 * i + Math.floor(Math.random() * 300));
    }
  }
}
async function heldBooking() {
  const ref = await book(A, M, { method: "card" });
  const co = await call("POST", "/api/payments/checkout", A.token, { refs: [ref], tenantId: P.tenantId });
  assert.equal(co.status, 201, JSON.stringify(co.json));
  const piId = String(co.json.clientSecret).split("_secret_")[0];
  await sr(() => payIntent(piId));
  const payId = co.json.paymentId as string;
  for (let i = 0; i < 6; i++) { const r = await call("POST", `/api/payments/checkout/${payId}/confirm`, A.token); if (r.json?.held === true) break; await sleep(400); }
  const b = await bookingDoc(P, ref);
  assert.equal(b.cardHold?.state, "held", `setup: ${b.status}/${b.cardHold?.state}`);
  return { ref, payId, piId };
}

type Way = "parent" | "provider";
async function trial(i: number, way: Way, offset: number) {
  const h = await heldBooking();
  const cancel = async () => {
    await sleep(offset);
    return way === "parent" ? call("POST", `/api/my/bookings/${encodeURIComponent(h.ref)}/cancel`, A.token, {}) : operatorAction(P, h.ref, { type: "cancel", refund: "full" });
  };
  const [ap, ca] = await Promise.all([operatorAction(P, h.ref, { type: "approve" }), cancel()]);
  return { ...h, i, way, offset, ap: ap.status, ca: ca.status };
}
async function judge(t: Awaited<ReturnType<typeof trial>>): Promise<string[]> {
  const p = await sr(() => stripe.paymentIntents.retrieve(t.piId));
  const refunds = (await sr(() => stripe.refunds.list({ payment_intent: t.piId, limit: 100 }))).data.filter((r: any) => r.status !== "failed" && r.status !== "canceled");
  const got: number = p.amount_received ?? 0;
  const refunded = refunds.reduce((a: number, r: any) => a + r.amount, 0);
  const b = await bookingDoc(P, t.ref);
  const rec = (await db.collection("payments").doc(t.payId).get()).data() as any;
  const ended = b.status === "Cancelled" || b.status === "Declined";
  const bad: string[] = [];
  const tag = `#${t.i} ${t.way}@${t.offset}ms approve ${t.ap} cancel ${t.ca} | pi ${p.status} got ${got} refunded ${refunded} | ${b.status}/${b.pay}/${b.cancel?.refund} hold ${b.cardHold?.state} rec ${rec?.status}`;
  if (refunds.length > 1) bad.push("more than one refund");
  if (refunded > got) bad.push("refunded more than captured");
  if (got > 0 && p.status === "canceled") bad.push("captured AND cancelled");
  if (got > 0 && rec?.status === "released") bad.push("captured but the payment record says released");
  if (got > 0 && ended) {
    if (b.pay === "Paid") bad.push("ended booking is still Paid");
    const covered = refunded === got || ["pending", "full", "partial"].includes(b.cancel?.refund);
    if (!covered) bad.push("ended booking, money captured, no refund done or pending");
  }
  if (got > 0 && !ended && !(b.status === "Confirmed" && b.pay === "Paid" && refunded === 0)) bad.push("kept booking is not Confirmed+Paid without a refund");
  if (got === 0 && ended && p.status !== "canceled") bad.push("ended booking but the card is still authorised at Stripe");
  if (got === 0 && p.status === "canceled" && !ended) bad.push("card released but the booking is still alive");
  return bad.length ? [`${bad.join("; ")} :: ${tag}`] : [];
}

describe("a cancel at any moment around the approval's capture", () => {
  it(`${TRIALS} timed trials (waves of ${WAVE}, parent and provider cancels, 0-2000 ms jitter): every end state is coherent`, { timeout: (TRIALS / WAVE + 1) * 120_000 }, async () => {
    const failures: string[] = [];
    let done = 0;
    while (done < TRIALS) {
      const n = Math.min(WAVE, TRIALS - done);
      const wave = await Promise.all(Array.from({ length: n }, (_, k) => trial(done + k, (done + k) % 3 === 2 ? "provider" : "parent", Math.floor(Math.random() * 2000))));
      await sleep(3500);
      for (const t of wave) failures.push(...(await judge(t)));
      done += n;
    }
    console.log(`[cic-timed] ${TRIALS} trials, ${failures.length} bad`);
    assert.equal(failures.length, 0, `${failures.length} bad of ${TRIALS}:\n${failures.slice(0, 12).join("\n")}`);
  });
});
