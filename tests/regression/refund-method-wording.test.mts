// How an OFFLINE refund (cash / bank transfer / voucher) is named: one pure helper, mix aware, penny correct, with the words in all 11 languages.
import test from "node:test";
import assert from "node:assert/strict";
import { CATALOGS } from "../../lib/i18n/messages/index";
import { joinList } from "../../lib/i18n/listFormat";
import {
  askLabel, kindOfMethod, methodHow, methodNames, owedLine, recordedLine, refundMethodInfo, refundPartsFor, sendLine, splitOverParts, unsentKinds,
  type OfflineKind, type Tr,
} from "../../features/bookings/refundMethod";

const LOCALES = ["en", "pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"] as const;
const dict = (l: string) => (CATALOGS as any)[l].rfm as Record<string, string>;
const trFor = (l: string): Tr => (k, v = {}) => Object.entries(v).reduce((s, [a, b]) => s.split(`{${a}}`).join(b), dict(l)[k.replace(/^rfm\./, "")] ?? k);
const en = trFor("en");
const J = (x: string[]) => joinList(x, "en-GB");
const book = (o: Record<string, unknown> = {}) => ({ method: "Cash", voucherScheme: undefined, amountPaid: 0.5, pay: "Paid", amount: 0.5, ...o }) as any;

test("kindOfMethod names the offline method, card and unknown are null", () => {
  assert.equal(kindOfMethod("Bank transfer"), "bank");
  assert.equal(kindOfMethod("BACS"), "bank");
  assert.equal(kindOfMethod("Cash on the day"), "cash");
  assert.equal(kindOfMethod("Cash"), "cash");
  assert.equal(kindOfMethod("Tax-Free Childcare"), "voucher");
  assert.equal(kindOfMethod("Voucher"), "voucher");
  assert.equal(kindOfMethod("Card", "Edenred"), "voucher");
  assert.equal(kindOfMethod("Card"), null);
  assert.equal(kindOfMethod("PayPal"), null);
});

test("single method: the exact owner wording for cash, bank transfer and voucher", () => {
  const cash = refundMethodInfo(book()), bank = refundMethodInfo(book({ method: "Bank transfer" })), vou = refundMethodInfo(book({ method: "Voucher", voucherScheme: "Edenred" }));
  assert.deepEqual(cash.kinds, ["cash"]); assert.deepEqual(bank.kinds, ["bank"]); assert.deepEqual(vou.kinds, ["voucher"]);
  assert.equal(owedLine(cash.kinds, "£0.50", en, J), "Refund £0.50 owed: paid in cash");
  assert.equal(owedLine(bank.kinds, "£0.50", en, J), "Refund £0.50 owed: paid by bank transfer");
  assert.equal(sendLine(bank.kinds, "£0.50", en, J), "Send £0.50 by bank transfer");
  assert.equal(sendLine(cash.kinds, "£0.50", en, J), "Hand back £0.50 in cash");
  assert.equal(askLabel(bank.kinds, "Acme Clubs", "£0.50", en, J), "Ask Acme Clubs to send me my £0.50 back by bank transfer");
  assert.equal(askLabel(cash.kinds, "Acme Clubs", "£0.50", en, J), "Ask Acme Clubs to hand me my £0.50 cash back");
  assert.equal(askLabel(vou.kinds, "Acme Clubs", "£0.50", en, J), "Ask Acme Clubs to refund my £0.50 voucher");
  assert.equal(recordedLine(cash.kinds, "Acme Clubs", "£0.50", en, J), "Refund recorded: Acme Clubs will send your £0.50 cash refund");
  assert.equal(recordedLine(bank.kinds, "Acme Clubs", "£0.50", en, J), "Refund recorded: Acme Clubs will send your £0.50 bank transfer refund");
  assert.equal(recordedLine(vou.kinds, "Acme Clubs", "£0.50", en, J), "Refund recorded: Acme Clubs will send your £0.50 voucher refund");
});

test("a mix names each method, in a fixed order", () => {
  const mix = refundMethodInfo(book({ method: "Bank transfer", amountPaid: 50, amount: 50, paidVia: { cash: 20 } }));
  assert.deepEqual(mix.parts, [{ kind: "bank", amount: 30 }, { kind: "cash", amount: 20 }]);
  assert.equal(mix.mixed, true);
  assert.equal(methodNames(mix.kinds, en, J), "bank transfer and cash");
  assert.equal(methodHow(mix.kinds, en, J), "by bank transfer and cash");
  assert.equal(askLabel(mix.kinds, "Acme", "£25.00", en, J), "Ask Acme to send me my £25.00 back by bank transfer and cash");
  assert.equal(owedLine(mix.kinds, "£25.00", en, J), "Refund £25.00 owed: paid by bank transfer and cash");
  const three = refundMethodInfo(book({ method: "Voucher", voucherScheme: "Edenred", amountPaid: 60, amount: 60, paidVia: { cash: 10, bank: 20 } }));
  assert.deepEqual(three.kinds, ["bank", "cash", "voucher"]);
  assert.equal(methodNames(three.kinds, en, J), "bank transfer, cash and voucher");
});

test("card and wallet money has no offline wording at all", () => {
  assert.deepEqual(refundMethodInfo(book({ method: "Card", paymentIntentId: "pi_1", amountPaid: 50, amount: 50 })).kinds, []);
  assert.deepEqual(refundMethodInfo(book({ method: "Card", amountPaid: 0, pay: "Unpaid", amount: 0, walletApplied: 30 })).kinds, []);
  // card + hand-recorded cash: only the cash is offline
  const cc = refundMethodInfo(book({ method: "Card", paymentIntentId: "pi_1", amountPaid: 50, amount: 50, cardPaid: 30, paidVia: { cash: 20 } }));
  assert.deepEqual(cc.parts, [{ kind: "cash", amount: 20 }]); assert.equal(cc.hasCard, true);
  // card booking whose extra cash was recorded without an explicit card total: still card + cash
  const cc2 = refundMethodInfo(book({ method: "Card", paymentIntentId: "pi_1", amountPaid: 50, amount: 50, paidVia: { bank: 20 } }));
  assert.deepEqual(cc2.parts, [{ kind: "bank", amount: 20 }]);
});

test("the shares of an offline refund add up to the penny", () => {
  const parts = [{ kind: "bank" as OfflineKind, amount: 33.33 }, { kind: "cash" as OfflineKind, amount: 33.33 }, { kind: "voucher" as OfflineKind, amount: 33.34 }];
  for (const a of [0.01, 0.5, 1, 10, 33.33, 49.99, 100]) {
    const s = splitOverParts(a, parts);
    assert.equal(Math.round(s.reduce((n, p) => n + p.amount, 0) * 100), Math.round(a * 100), `sum for ${a}`);
  }
  assert.deepEqual(splitOverParts(25, [{ kind: "bank", amount: 30 }, { kind: "cash", amount: 20 }]), [{ kind: "bank", amount: 15 }, { kind: "cash", amount: 10 }]);
  assert.deepEqual(splitOverParts(0.5, [{ kind: "cash", amount: 0.5 }]), [{ kind: "cash", amount: 0.5 }]);
  assert.deepEqual(splitOverParts(0, parts), []);
  // an entry's own stamped shares win over a recalculation
  assert.deepEqual(refundPartsFor(book(), 9, [{ kind: "bank", amount: 4 }, { kind: "cash", amount: 5 }]), [{ kind: "bank", amount: 4 }, { kind: "cash", amount: 5 }]);
});

test("unsentKinds follows the open refund entries", () => {
  const b = book({ method: "Bank transfer", amountPaid: 50, amount: 50, paidVia: { cash: 20 }, refundEntries: [
    { via: "offline", status: "sent", cash: 5, parts: [{ kind: "bank", amount: 5 }] },
    { via: "offline", status: "approved", cash: 10, parts: [{ kind: "cash", amount: 10 }] },
  ] });
  assert.deepEqual(unsentKinds(b), ["cash"]);
  assert.deepEqual(unsentKinds(book({ method: "Cash", refundEntries: [{ via: "offline", status: "approved", cash: 1 }] })), ["cash"]);
});

test("every rfm string exists in all 11 languages with its placeholders", () => {
  const need: Record<string, string[]> = {
    nBank: [], nCash: [], nVoucher: [], hBank: [], hCash: [], hVoucher: [], hMix: ["{methods}"], yourProv: [],
    optBank: ["{provider}", "{amt}"], optCash: ["{provider}", "{amt}"], optVoucher: ["{provider}", "{amt}"], optMix: ["{provider}", "{amt}", "{methods}"],
    parentRec: ["{provider}", "{amt}", "{methods}"], bellRec: ["{amt}", "{listing}", "{provider}", "{methods}"], owed: ["{amt}", "{how}"],
    sBank: ["{amt}"], sCash: ["{amt}"], sVoucher: ["{amt}"], sMix: ["{amt}", "{methods}"], chip: ["{methods}"], chipAmt: ["{methods}", "{amt}"],
    confHead: ["{amt}", "{how}"], confBody: ["{amt}", "{name}", "{methods}"], apprBody: ["{amt}", "{name}", "{how}", "{methods}"], sentChip: ["{date}", "{methods}"],
  };
  const bad: string[] = [];
  for (const l of LOCALES) for (const [k, vars] of Object.entries(need)) {
    const v = dict(l)[k];
    if (!v) { bad.push(`${l}.${k} missing`); continue; }
    for (const p of vars) if (!v.includes(p)) bad.push(`${l}.${k} lost ${p}`);
    if (l !== "en" && v === dict("en")[k] && v.length > 14) bad.push(`${l}.${k} still English`);
  }
  assert.deepEqual(bad, []);
});

test("the sentences render in every language with nothing left in braces", () => {
  for (const l of LOCALES) {
    const tr = trFor(l);
    const j = (x: string[]) => joinList(x, l);
    for (const kinds of [["cash"], ["bank"], ["voucher"], ["bank", "cash"]] as OfflineKind[][]) {
      const lines = [askLabel(kinds, "Acme", "£1.00", tr, j), owedLine(kinds, "£1.00", tr, j), sendLine(kinds, "£1.00", tr, j), recordedLine(kinds, "Acme", "£1.00", tr, j)];
      for (const s of lines) assert.doesNotMatch(s, /[{}]|rfm\./, `${l} ${kinds}: ${s}`);
    }
  }
});
