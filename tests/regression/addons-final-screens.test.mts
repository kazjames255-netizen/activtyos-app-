import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as H from "../../features/bookings/helpers";
import { DEFAULT_POLICY } from "../../lib/cancellation";
import { CATALOGS } from "../../lib/i18n/messages";
import { translate } from "../../lib/i18n/translate";
import { computeRelease, releaseRecord } from "../../server/src/lib/releaseMoney";
import { parentBell, PARENT_BELL_KINDS } from "../../server/src/lib/parentBells";
import type { Booking } from "../../features/bookings/types";

// Final add-on build, screens round: the part-paid release preview comes from the SERVER's own calculation; wording says who cancelled; refund log lines,
// payment chips and parent bells are translated; three small record fixes.
const root = path.resolve(import.meta.dirname, "../..");
const LANGS = ["en", "pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"] as const;
const has = (lang: string, key: string) => { const o = key.split(".").reduce<unknown>((a, k) => (a && typeof a === "object" ? (a as Record<string, unknown>)[k] : undefined), (CATALOGS as Record<string, unknown>)[lang]); return typeof o === "string" ? o : undefined; };
const days = ["2099-10-18", "2099-10-19", "2099-10-20", "2099-10-21"];
const mk = (o: Partial<Booking>): Booking => ({ ref: "R", booker: "B", email: "e@x.com", phone: "", child: "K", listing: "L", pass: "4", ticket: "", dates: "", sessions: [], status: "Confirmed",
  pay: "Partially paid", method: "Bank transfer", amount: 104, amountPaid: 40, addons: [], days: [...days], kids: [{ name: "K", dates: [...days] }], ...o }) as unknown as Booking;
const NOW = "2099-01-01T00:00:00.000Z";

// ---- FAIL 1: the preview is the server's calculation -------------------------------------------------------------------------------------------
test("part-paid booking: releasing 2 of 4 days drops the price, refunds nothing, owes the rest (both resolutions)", () => {
  for (const resolution of ["refund", "wallet"] as const) {
    const r = computeRelease(mk({}), [{ childKey: "K", days: days.slice(0, 2) }], resolution, DEFAULT_POLICY, NOW, "2099-01-01");
    assert.equal(r.preview.partPaid, true);
    assert.equal(r.preview.priceBefore, 104);
    assert.equal(r.preview.priceAfter, 52);
    assert.equal(r.preview.drop, 52);
    assert.equal(r.preview.paid, 40);
    assert.equal(r.preview.refund + r.preview.credit, 0, resolution);
    assert.equal(r.preview.owedAfter, 12);
  }
});
test("paid-in-full booking: wallet gives the full value of the days, refund follows the policy; the price stays", () => {
  const paid = mk({ pay: "Paid", amountPaid: 104 });
  const w = computeRelease(structuredClone(paid), [{ childKey: "K", days: days.slice(0, 2) }], "wallet", DEFAULT_POLICY, NOW, "2099-01-01").preview;
  assert.equal(w.partPaid, false); assert.equal(w.credit, 52); assert.equal(w.refund, 0); assert.equal(w.priceAfter, 104); assert.equal(w.owedAfter, 0);
  const f = computeRelease(structuredClone(paid), [{ childKey: "K", days: days.slice(0, 2) }], "refund", DEFAULT_POLICY, NOW, "2099-01-01").preview;
  assert.equal(f.credit, 0); assert.ok(f.refund > 0 && f.refund <= 52);
});
test("the preview does not change the booking it was given", () => {
  const b = mk({}); const before = JSON.stringify(b);
  computeRelease(structuredClone(b), [{ childKey: "K", days: days.slice(0, 2) }], "wallet", DEFAULT_POLICY, NOW, "2099-01-01");
  assert.equal(JSON.stringify(b), before);
});
test("the record of a part-paid release says the booking was reduced; no wallet credit line, no 'wallet credit' in the note", () => {
  const r = releaseRecord({ resolution: "wallet", value: 0, releasedCount: 2, partPaid: true, drop: 52 });
  assert.equal(r.log?.kind, "reduced"); assert.equal(r.log?.amount, 0); assert.deepEqual(r.log?.vars, { n: 2, amt: "£52.00" });
  assert.doesNotMatch(r.note, /wallet/i);
  const real = releaseRecord({ resolution: "wallet", value: 20, releasedCount: 2, partPaid: true, drop: 52 });
  assert.equal(real.log?.kind, "releasedWallet"); assert.equal(real.log?.amount, 20); assert.match(real.note, /wallet credit/);
  const refund = releaseRecord({ resolution: "refund", value: 0, releasedCount: 1, partPaid: false, drop: 0 });
  assert.equal(refund.log, null); assert.doesNotMatch(refund.note, /wallet/i);
});
test("the browser does no release maths: the old per-day 'dayWorth' summary is gone from the screen", () => {
  const ui = fs.readFileSync(path.join(root, "features/parent/MyBookingsApp.tsx"), "utf8");
  assert.doesNotMatch(ui, /p7bk\.dayWorth/);
  assert.match(ui, /release-preview/);
});

// ---- FAIL 2: who cancelled -------------------------------------------------------------------------------------------------------------------
test("the Cancellation block names who cancelled", () => {
  const f = (H as unknown as { cancelBlockKey?: (c: { by?: string }) => string }).cancelBlockKey;
  assert.equal(typeof f, "function");
  assert.equal(f!({ by: "Provider" }), "p7bd.providerCancelledRefund");
  assert.equal(f!({ by: "Booker" }), "p7bd.parentAsked");
  assert.equal(f!({}), "p7bd.parentAsked");
});

// ---- FAIL 3/4/5: translations ---------------------------------------------------------------------------------------------------------------
const KEYS = ["p7bd.providerCancelledRefund", "p7bd.refundDeclinedNothing", "p7bd.logApproved", "p7bd.logApprovedPartial", "p7bd.logWallet1", "p7bd.logWalletN", "p7bd.logReduced1", "p7bd.logReducedN",
  "p7bd.logNamedWallet", "p7bd.logReduced", "p7bd.msgProvider", "p7bd.msgProviderRefund", "p7bd.msgParent", "p7bd.msgReleased1", "p7bd.msgReleasedN", "p7bd.msgChildCancelled",
  "p7bk.relPartPaid", "p7bk.relPaidWallet", "p7bk.relPaidRefund", "p7bk.relUnpaid"];
const WORD_KEYS = ["words.offline", "words.wallet", "words.booker", "words.provider", "words.booking"];
test("every new screen string exists in all 11 languages, and differs from English in pl / ar / cy", () => {
  for (const k of KEYS) {
    const en = has("en", k); assert.ok(en, `${k} en`);
    for (const l of LANGS) assert.ok(has(l, k), `${k} ${l}`);
    for (const l of ["pl", "ar", "cy"]) assert.notEqual(has(l, k), en, `${k} ${l} is still English`);
  }
});
test("source / who words exist in 11 languages", () => { for (const k of WORD_KEYS) for (const l of LANGS) assert.ok(has(l, k), `${k} ${l}`); });
test("refund log lines render from structured data and also from stored English lines", () => {
  const f = (H as unknown as { refundLogLabel?: (x: unknown, t: (k: string, v?: Record<string, string | number>) => string) => string }).refundLogLabel;
  assert.equal(typeof f, "function");
  const t = (l: "pl" | "cy" | "ar") => (k: string, v?: Record<string, string | number>) => translate(l, k, v);
  for (const l of ["pl", "cy", "ar"] as const) {
    assert.equal(f!({ label: "Refund approved", kind: "approved", amount: 5, on: "x", by: "P" }, t(l)), translate(l, "p7bd.logApproved"));
    assert.equal(f!({ label: "Refund approved", amount: 5, on: "x", by: "P" }, t(l)), translate(l, "p7bd.logApproved"), "stored English line");
    assert.equal(f!({ label: "Refund approved (partial)", amount: 5, on: "x", by: "P" }, t(l)), translate(l, "p7bd.logApprovedPartial"));
    assert.equal(f!({ label: "2 days released — wallet credit", amount: 5, on: "x", by: "B" }, t(l)), translate(l, "p7bd.logWalletN", { n: 2 }));
    assert.equal(f!({ label: "1 day released — wallet credit", amount: 5, on: "x", by: "B" }, t(l)), translate(l, "p7bd.logWallet1"));
    assert.equal(f!({ label: "x", kind: "reduced", vars: { n: 2, amt: "£52.00" }, amount: 0, on: "x", by: "B" }, t(l)), translate(l, "p7bd.logReducedN", { n: 2, amt: "£52.00" }));
  }
  assert.equal(f!({ label: "Something a person typed", amount: 1, on: "x", by: "P" }, t("pl")), "Something a person typed");
});
test("system cancel messages translate; a message a person typed does not", () => {
  const f = (H as unknown as { cancelMsgText?: (m: string, t: (k: string, v?: Record<string, string | number>) => string) => string }).cancelMsgText;
  assert.equal(typeof f, "function");
  const t = (k: string, v?: Record<string, string | number>) => translate("pl", k, v);
  assert.equal(f!("Cancelled by provider.", t), translate("pl", "p7bd.msgProvider"));
  assert.equal(f!("Refund issued by provider.", t), translate("pl", "p7bd.msgProviderRefund"));
  assert.equal(f!("Cancelled by the parent.", t), translate("pl", "p7bd.msgParent"));
  assert.equal(f!("2 days released by the parent.", t), translate("pl", "p7bd.msgReleasedN", { n: 2 }));
  assert.equal(f!("1 day released by the parent.", t), translate("pl", "p7bd.msgReleased1"));
  assert.equal(f!("We are moving house", t), "We are moving house");
});
test("Payments chips and refund-log labels go through the word / label translators", () => {
  const pay = fs.readFileSync(path.join(root, "features/parent/PaymentsApp.tsx"), "utf8");
  assert.match(pay, /w\(payLabelFor\(b\)\)/);
  assert.match(pay, /refundLogLabel\(/);
  const bd = fs.readFileSync(path.join(root, "features/bookings/BookingDetail.tsx"), "utf8");
  assert.match(bd, /refundLogLabel\(/); assert.match(bd, /cancelMsgText\(/); assert.match(bd, /cancelBlockKey\(/);
});
test("parent bells carry a key + data and translate; the English text is unchanged", () => {
  assert.ok(PARENT_BELL_KINDS.length >= 9);
  const ex = { ref: "EMU-1", amt: "£12.00", listing: "Football" } as Record<string, string>;
  const en = (k: (typeof PARENT_BELL_KINDS)[number]) => parentBell(k, ex);
  assert.equal(en("refund-approved-card").title, "Refund approved · EMU-1");
  assert.equal(en("payment-received").title, "Payment received · EMU-1");
  assert.equal(en("extra-declined").title, "Extra request declined · EMU-1");
  assert.equal(en("refund-approved-card").body, "£12.00 refund approved for Football — on its way back to your card.");
  for (const kind of PARENT_BELL_KINDS) {
    const b = parentBell(kind, ex);
    assert.ok(b.i18n.tk, kind);
    for (const l of LANGS) assert.ok(has(l, b.i18n.tk!), `${kind} title ${l}`);
    if (b.i18n.bk) for (const l of LANGS) assert.ok(has(l, b.i18n.bk), `${kind} body ${l}`);
    for (const l of ["pl", "cy", "ar"] as const) assert.notEqual(translate(l, b.i18n.tk!, b.i18n.tv), b.title, `${kind} ${l} title is still English`);
  }
  const bell = fs.readFileSync(path.join(root, "components/shell/Bell.tsx"), "utf8");
  assert.match(bell, /i18n/);
});

// ---- Records ----------------------------------------------------------------------------------------------------------------------------------
test("'paid to date' counts a part-payment", () => {
  const f = (H as unknown as { partPaidCash?: (b: Booking) => number }).partPaidCash;
  assert.equal(typeof f, "function");
  assert.equal(f!(mk({})), 40);
  assert.equal(f!(mk({ pay: "Paid", amountPaid: 104 })), 0, "paid bookings are counted by the existing rule");
  assert.equal(f!(mk({ status: "Cancelled" })), 0);
  assert.equal(f!(mk({ pay: "Unpaid", amountPaid: 0 })), 0);
});
test("a declined refund no longer says it is 'to refund'; the approve button says 'Approve refund'", () => {
  const bd = fs.readFileSync(path.join(root, "features/bookings/BookingDetail.tsx"), "utf8");
  assert.match(bd, /c\.refund !== "declined" && c\.amount != null/);
  assert.match(bd, /refundDeclinedNothing/);
  assert.doesNotMatch(bd, /t\("p7bd\.markReimbursed"\)/);
});
