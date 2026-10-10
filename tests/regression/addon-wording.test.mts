import test from "node:test";
import assert from "node:assert/strict";
import { CATALOGS } from "../../lib/i18n/messages/index";
import { bellsForStaff } from "../../server/src/lib/rosterRules";
import { bellText, bodyIn, englishBody, englishTitle, titleIn } from "../../server/src/lib/extraWording";
import { decisionWording, doneLineMsg, headingMsg, newRequestWording, pendingLineMsg, plainTitle, renderFull, withdrawnWording } from "../../features/bookings/addonWording";
import { trFor } from "../../server/src/lib/extraWording";
import type { AddonRequest } from "../../features/bookings/types";

// The plain sentences about a request to change / cancel an extra: what is asked, for whom, which day; a price only where it matters; a change reads
// "from <old choice> to <new choice>". Every sentence is key + data, so it can be shown in all 11 languages.
const LANGS = ["en", "pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"] as const;
const REF = "APF-10350";
const LISTING = "HOME VISIT FITNESS LESSON FOR FATS KIDS";

const base = { id: "r1", status: "pending", createdAt: "2026-09-01T10:00:00Z", price: 10, child: "Child B" } as const;
const sizeChange = (): AddonRequest => ({ ...base, key: "k", kind: "change", label: "tshirty × 1 (size: xl)", to: { size: "m" }, toLabel: "tshirty × 1 (size: m)", priceDiff: 0 }) as AddonRequest;
const colourChange = (): AddonRequest => ({ ...base, key: "k", kind: "change", label: "Water bottle × 2 (Colour: Blue)", to: { Colour: "Red" }, toLabel: "Water bottle × 2 (Colour: Red)", priceDiff: 0 }) as AddonRequest;
const target = (o: object = {}) => ({ key: "k1", child: "Child B", label: "tshirty × 3", name: "tshirty", price: 10, ...o });
const cancel = (targets: object[]): AddonRequest => ({ ...base, key: "k1", kind: "cancel", label: "tshirty × 3", targets, price: targets.reduce((n: number, t: any) => n + t.price, 0) }) as unknown as AddonRequest;
const decided = (r: AddonRequest, o: Partial<AddonRequest>): AddonRequest => ({ ...r, ...o }) as AddonRequest;

test("a size change: title names the extra, the sentence says who, from what to what; no price anywhere", () => {
  const w = newRequestWording(sizeChange(), { ref: REF, refundable: 50 });
  assert.equal(englishTitle(w), "Change request: tshirty");
  assert.equal(englishBody(w), "Child B asked to change tshirty size from xl to m (booking APF-10350). Approve or decline.");
  assert.ok(!/£/.test(englishTitle(w) + englishBody(w)));
});

test("a colour change uses the choice names, and quantity is mentioned only when it changed", () => {
  assert.equal(englishBody(newRequestWording(colourChange(), { ref: REF })), "Child B asked to change Water bottle Colour from Blue to Red (booking APF-10350). Approve or decline.");
  const qty = { ...colourChange(), toLabel: "Water bottle × 3 (Colour: Red)" };
  assert.match(englishBody(newRequestWording(qty, { ref: REF })), /Colour from Blue to Red; quantity from 2 to 3/);
});

test("cancel one day, several days, a whole one-off extra with its date, and a bulk request across children", () => {
  const one = newRequestWording(cancel([target({ days: ["2026-09-01"] })]), { ref: REF, refundable: 10 });
  assert.equal(englishTitle(one), "Cancel request: tshirty");
  assert.equal(englishBody(one), "Child B asked to cancel tshirty on Tue 1 Sep (booking APF-10350). £10.00 can be refunded. Approve or decline.");
  assert.equal(englishBody(newRequestWording(cancel([target({ days: ["2026-09-01", "2026-09-02", "2026-09-03"] })]), { ref: REF })), "Child B asked to cancel tshirty for 3 days (booking APF-10350). Approve or decline.");
  assert.equal(englishBody(newRequestWording(cancel([target({ when: ["2026-09-01"] })]), { ref: REF, refundable: 4 })), "Child B asked to cancel tshirty on Tue 1 Sep (booking APF-10350). £4.00 can be refunded. Approve or decline.");
  assert.equal(englishBody(newRequestWording(cancel([target()]), { ref: REF })), "Child B asked to cancel tshirty (booking APF-10350). Approve or decline.");
  const bulk = newRequestWording(cancel([target(), target({ key: "k2", child: "Child C", label: "Water bottle × 1", name: "Water bottle" })]), { ref: REF, refundable: 100 });
  assert.equal(englishTitle(bulk), "Cancel request: 2 extras");
  assert.equal(englishBody(bulk), "Child B, Child C asked to cancel 2 extras (booking APF-10350). £20.00 can be refunded. Approve or decline.");
});

test("money shows only for a cancel that has something paid: the refundable amount is capped at what is paid", () => {
  assert.ok(!/£/.test(englishBody(newRequestWording(cancel([target()]), { ref: REF, refundable: 0 }))));
  assert.match(englishBody(newRequestWording(cancel([target({ price: 10 })]), { ref: REF, refundable: 6 })), /£6\.00 can be refunded/);
});

test("the family's answer: approved change, declined change with the reason, cancel with each real money outcome", () => {
  const ok = decided(sizeChange(), { status: "approved", money: { resolution: "waive", amount: 0 } });
  const w = decisionWording(ok, { ref: REF, listing: LISTING });
  assert.equal(englishTitle(w), "Your tshirty change was approved");
  assert.equal(englishBody(w), "Child B's tshirty changed from size xl to size m (Home visit fitness lesson for fats kids, APF-10350).");
  const no = decisionWording(decided(sizeChange(), { status: "declined", declineReason: "Out of stock." }), { ref: REF, listing: LISTING });
  assert.equal(englishTitle(no), "Your request to change tshirty was declined");
  assert.equal(englishBody(no), "Your tshirty stays as it was (Home visit fitness lesson for fats kids, APF-10350). Reason: Out of stock.");
  const c = cancel([target({ days: ["2026-09-01"] })]);
  const cw = (money: AddonRequest["money"]) => decisionWording(decided(c, { status: "approved", money }), { ref: REF, listing: LISTING });
  assert.equal(englishTitle(cw(undefined)), "Your tshirty cancellation was approved");
  assert.equal(englishBody(cw({ resolution: "wallet", amount: 10 })), "Your tshirty on Tue 1 Sep was cancelled (Home visit fitness lesson for fats kids, APF-10350). £10.00 was added to your wallet.");
  assert.equal(englishBody(cw({ resolution: "refund", amount: 10 })), "Your tshirty on Tue 1 Sep was cancelled (Home visit fitness lesson for fats kids, APF-10350). Your £10.00 refund is on its way.");
  assert.equal(englishBody(cw({ resolution: "none", amount: 0 })), "Your tshirty on Tue 1 Sep was cancelled (Home visit fitness lesson for fats kids, APF-10350). Nothing to refund.");
  const nc = decisionWording(decided(c, { status: "declined" }), { ref: REF, listing: LISTING });
  assert.equal(englishTitle(nc), "Your request to cancel tshirty was declined");
  assert.equal(englishBody(nc), "Your tshirty stays on the booking (Home visit fitness lesson for fats kids, APF-10350).");
});

test("a bank / cash / voucher refund is only RECORDED until the provider sends it: never 'on its way' before that", () => {
  const c = cancel([target({ days: ["2026-09-01"] })]);
  const w = decisionWording(decided(c, { status: "approved", money: { resolution: "refund", amount: 10 } }), { ref: REF, listing: LISTING, awaitingTransfer: true, provider: "Sunny Club" });
  assert.equal(englishBody(w), "Your tshirty on Tue 1 Sep was cancelled (Home visit fitness lesson for fats kids, APF-10350). Your £10.00 refund has been recorded; Sunny Club will send it.");
  assert.ok(!/on its way/.test(englishBody(w)));
  for (const lang of LANGS.filter((l) => l !== "en")) assert.notEqual(bodyIn(w, lang), englishBody(w), lang);
  // a card refund (not awaiting a transfer) still says it is on its way
  const card = decisionWording(decided(c, { status: "approved", money: { resolution: "refund", amount: 10 } }), { ref: REF, listing: LISTING, awaitingTransfer: false });
  assert.match(englishBody(card), /refund is on its way\.$/);
});

test("a CARD refund is also only 'recorded' until the provider has actually issued it", async () => {
  const { refundNeedsProviderTransfer, refundIssued } = await import("../../features/bookings/helpers");
  const card = (cancel: any) => ({ method: "Card", paymentIntentId: "pi_x", cancel }) as any;
  assert.equal(refundNeedsProviderTransfer(card({ refund: "pending", refundVia: "card" })), true, "pending card refund is not on its way yet");
  assert.equal(refundNeedsProviderTransfer(card(null)), true);
  assert.equal(refundIssued(card({ refund: "approved", refundVia: "card" })), true, "approved card refund has been issued");
  assert.equal(refundNeedsProviderTransfer(card({ refund: "approved", refundVia: "card" })), false);
  assert.equal(refundNeedsProviderTransfer({ cancel: { refund: "approved", refundVia: "offline", refundTransfer: "sent" } } as any), false, "an offline refund the provider confirmed sending");
  assert.equal(refundNeedsProviderTransfer({ cancel: { refund: "approved", refundVia: "offline", refundTransfer: "awaiting" } } as any), true);
  // the card wording while pending is the 'recorded' sentence
  const w = decisionWording(decided(cancel([target()]), { status: "approved", money: { resolution: "refund", amount: 8 } }), { ref: REF, listing: LISTING, awaitingTransfer: refundNeedsProviderTransfer(card({ refund: "pending" })), provider: "Sunny Club" });
  assert.match(englishBody(w), /refund has been recorded; Sunny Club will send it\.$/);
});

test("the Bell lets a title wrap to two lines instead of cutting it", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../../components/shell/Bell.tsx", import.meta.url), "utf8");
  assert.match(src, /line-clamp-2 break-words[^"]*text-\[12\.5px\] font-bold/);
  assert.ok(!/truncate text-\[12\.5px\] font-bold/.test(src));
});

test("setupKnowledge no longer says every bell is never a sentence", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../../server/src/lib/setupKnowledge.ts", import.meta.url), "utf8");
  assert.match(src, /EXCEPTION: extra \(add-on\) request bells/);
});

test("withdrawn: the provider is told, with the same plain naming", () => {
  const w = withdrawnWording(sizeChange(), { ref: REF });
  assert.equal(englishTitle(w), "Request withdrawn: tshirty");
  assert.equal(englishBody(w), "Child B withdrew their request to change tshirty (booking APF-10350).");
  assert.equal(englishBody(withdrawnWording(cancel([target()]), { ref: REF })), "Child B withdrew their request to cancel tshirty (booking APF-10350).");
});

test("the family's screen: heading, pending line and the line after approval", () => {
  const en = trFor("en");
  const say = (m: ReturnType<typeof headingMsg>) => renderFull(en, m);
  assert.equal(say(headingMsg(["tshirty"])), "Change or cancel your tshirty");
  assert.equal(say(headingMsg(["tshirty", "tshirty"])), "Change or cancel your tshirty");
  assert.equal(say(headingMsg(["tshirty", "Water bottle"])), "Change or cancel your extras");
  assert.equal(say(pendingLineMsg(sizeChange(), "Sunny Club")), "Change requested: tshirty size xl → m, waiting for Sunny Club");
  assert.equal(say(pendingLineMsg(cancel([target()]), "Sunny Club")), "Cancel requested: tshirty, waiting for Sunny Club");
  assert.equal(say(doneLineMsg(decided(sizeChange(), { status: "approved" }))), "Changed from size xl to size m");
  assert.equal(say(doneLineMsg(decided(sizeChange(), { status: "declined" }))), "Request declined");
  assert.equal(en("p7shell.xrBtnChange", { name: "tshirty", child: "Child B" }), "Change tshirty (Child B)");
  assert.equal(en("p7shell.xrBtnCancel", { name: "tshirty", child: "Child B" }), "Cancel tshirty (Child B)");
});

test("a request made before `from` was stored still reads the old choice off its label", () => {
  const old = sizeChange(); // no `from`
  assert.match(englishBody(newRequestWording(old, { ref: REF })), /size from xl to m/);
  const withFrom = { ...sizeChange(), from: { size: "xl" } } as AddonRequest;
  assert.equal(englishBody(newRequestWording(withFrom, { ref: REF })), englishBody(newRequestWording(old, { ref: REF })));
});

test("capitals typed by a provider read as a sentence; mixed case is left alone", () => {
  assert.equal(plainTitle("HOME VISIT FITNESS LESSON"), "Home visit fitness lesson");
  assert.equal(plainTitle("Mini Movers"), "Mini Movers");
  assert.equal(plainTitle("PE"), "PE");
});

const ALL = (): ReturnType<typeof newRequestWording>[] => [
  newRequestWording(sizeChange(), { ref: REF }),
  newRequestWording({ ...colourChange(), toLabel: "Water bottle × 3 (Colour: Red)" }, { ref: REF }),
  newRequestWording(cancel([target({ days: ["2026-09-01"] })]), { ref: REF, refundable: 10 }),
  newRequestWording(cancel([target({ days: ["2026-09-01", "2026-09-02"] })]), { ref: REF }),
  newRequestWording(cancel([target(), target({ key: "k2", child: "Child C" })]), { ref: REF, refundable: 5 }),
  withdrawnWording(sizeChange(), { ref: REF }), withdrawnWording(cancel([target()]), { ref: REF }), withdrawnWording(cancel([target(), target({ key: "k2" })]), { ref: REF }),
  decisionWording(decided(sizeChange(), { status: "approved", money: { resolution: "charge", amount: 2 } }), { ref: REF, listing: LISTING }),
  decisionWording(decided(sizeChange(), { status: "declined", declineReason: "No" }), { ref: REF, listing: LISTING }),
  decisionWording(decided(cancel([target({ days: ["2026-09-01"] })]), { status: "approved", money: { resolution: "wallet", amount: 10 } }), { ref: REF, listing: LISTING }),
  decisionWording(decided(cancel([target({ days: ["2026-09-01", "2026-09-02"] })]), { status: "approved", money: { resolution: "refund", amount: 10 } }), { ref: REF, listing: LISTING }),
  decisionWording(decided(cancel([target(), target({ key: "k2" })]), { status: "approved", money: { resolution: "none", amount: 0 } }), { ref: REF, listing: LISTING }),
  decisionWording(decided(cancel([target()]), { status: "declined" }), { ref: REF, listing: LISTING }),
  decisionWording(decided(cancel([target(), target({ key: "k2" })]), { status: "declined" }), { ref: REF, listing: LISTING }),
];

test("in every other language the sentences differ from English, keep the names / numbers, and leave no {placeholder}", () => {
  for (const w of ALL()) {
    const en = [titleIn(w, "en"), bodyIn(w, "en")];
    for (const lang of LANGS.filter((l) => l !== "en")) {
      const out = [titleIn(w, lang), bodyIn(w, lang)];
      assert.notEqual(out[0], en[0], `${lang} title same as English: ${en[0]}`);
      assert.notEqual(out[1], en[1], `${lang} body same as English: ${en[1]}`);
      for (const s of out) assert.ok(!/\{[a-zA-Z0-9]+\}/.test(s), `${lang} leftover placeholder: ${s}`);
    }
    const vars = { ...w.title.vars, ...w.body.vars };
    for (const lang of LANGS) {
      const body = bodyIn(w, lang);
      if (vars.ref) assert.ok(body.includes(String(vars.ref)), `${lang} lost the reference: ${body}`);
      if (vars.name) assert.ok(`${titleIn(w, lang)} ${body}`.includes(String(vars.name)), `${lang} lost the extra's name`);
    }
  }
});

test("every extra-request key has all 11 languages with the same {placeholders} as English", () => {
  const get = (l: string, k: string) => (CATALOGS as any)[l]?.p7shell?.[k] as string | undefined;
  const keys = Object.keys((CATALOGS as any).en.p7shell).filter((k) => k.startsWith("xr"));
  assert.ok(keys.length >= 45, `found ${keys.length}`);
  const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  for (const k of keys) {
    const en = get("en", k)!;
    for (const l of LANGS) {
      const v = get(l, k);
      assert.ok(v, `${l}.${k} missing`);
      assert.equal(ph(v!), ph(en), `${l}.${k} placeholders differ`);
      if (l !== "en" && !/^(PartArrow)$/.test(k.slice(2))) assert.notEqual(v, en, `${l}.${k} same as English`);
    }
  }
});

test("a bell carries the English text AND the key + data for every language; dates travel as ISO", () => {
  const t = bellText(newRequestWording(cancel([target({ days: ["2026-09-01"] })]), { ref: REF, refundable: 10 }));
  assert.equal(t.title, "Cancel request: tshirty");
  assert.equal(t.i18n.tk, "p7shell.xrTReqCancel");
  assert.equal(t.i18n.bk, "p7shell.xrReqCancelOn");
  assert.equal(t.i18n.bv.date, "2026-09-01");
  assert.deepEqual(t.i18n.more?.map((m) => m.k), ["p7shell.xrCanRefund", "p7shell.xrApprove"]);
  const ch = bellText(newRequestWording(sizeChange(), { ref: REF }));
  assert.equal(ch.i18n.bv.c1q, "size");
  assert.equal(ch.i18n.bv.c1from, "xl");
  assert.equal(ch.i18n.bv.c1to, "m");
  // the browser rebuilds the sentence in the viewer's language from that data alone
  const cy = renderFull(trFor("cy"), { key: ch.i18n.bk, vars: ch.i18n.bv });
  assert.match(cy, /size o xl i m/);
  assert.notEqual(cy, ch.body);
});

test("staff see no prices: a change bell passes the staff filter, a refundable cancel bell (which quotes £) does not", () => {
  const change = bellText(newRequestWording(sizeChange(), { ref: REF, refundable: 99 }));
  const refund = bellText(newRequestWording(cancel([target()]), { ref: REF, refundable: 10 }));
  const free = bellText(newRequestWording(cancel([target()]), { ref: REF, refundable: 0 }));
  const seen = bellsForStaff([change, refund, free].map((b) => ({ category: "booking", title: b.title, body: b.body })));
  assert.equal(seen.length, 2);
  for (const b of seen) assert.ok(!/£/.test(`${b.title} ${b.body}`));
  // the data a staff bell carries holds no amount either
  assert.ok(!/£/.test(JSON.stringify(change.i18n)) && !/£/.test(JSON.stringify(free.i18n)));
});
