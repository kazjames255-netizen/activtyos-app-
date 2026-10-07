import test from "node:test";
import assert from "node:assert/strict";
import { BELL_BODY_MAX, BELL_LABEL, BELL_TITLE_MAX, bellBody, bellDay, bellMoney, bellTitle, paymentType, type BellKind } from "../../server/src/lib/bellText";
import { providerPaidBell } from "../../server/src/lib/providerPaidBell";

// Kaz: the provider's bell must be clean: 'NEW BOOKING, TYPE, COST, REF, that's it', no unfinished sentences ("New booking (awaiting bank transfer pay…").
// The bell list cuts text at about 32 (title) and 48 (body) characters, so every bell is a fixed label + ref and at most three short facts.

const KINDS = Object.keys(BELL_LABEL) as BellKind[];
const noSentence = (t: string) => assert.doesNotMatch(t, /[()]|—|\.\s|\.$/, `bell text must not be a sentence: "${t}"`);

test("every bell kind: the title fits, carries the ref and is not a sentence (even with a long ref and a multi-booking basket)", () => {
  for (const k of KINDS) {
    assert.ok(BELL_LABEL[k].length <= 20, `${k}: label too long`);
    const one = bellTitle(k, "APF-10334");
    assert.ok(one.length <= BELL_TITLE_MAX, `${k}: "${one}"`);
    assert.ok(one.endsWith("APF-10334"), `${k}: ref missing in "${one}"`);
    noSentence(one.replace("✓", ""));
    const many = bellTitle(k, ["APF-10334", "APF-10335", "APF-10336"]);
    assert.ok(many.length <= BELL_TITLE_MAX, `${k}: "${many}"`);
    assert.ok(many.includes("APF-10334"));
    const long = bellTitle(k, "ABCDEFGHIJKL-1234567");
    assert.ok(long.length <= BELL_TITLE_MAX, `${k}: "${long}"`);
  }
  assert.equal(bellTitle("new-booking", "APF-10334"), "New booking · APF-10334");
  assert.equal(bellTitle("booking-request", ["APF-10329", "APF-10330"]), "Booking request · APF-10329 +1");
});

test("bell body: TYPE · COST then optional facts, dropped (never cut) when they do not fit", () => {
  assert.equal(bellBody(["Bank transfer", bellMoney(15.3)]), "Bank transfer · £15.30");
  assert.equal(bellBody(["Card", bellMoney(0.3), "Online"]), "Card · £0.30 · Online");
  assert.equal(bellBody(["Card held", bellMoney(0.3), `by ${bellDay("2026-10-14T10:09:00Z")}`]), "Card held · £0.30 · by 14 Oct");
  // empty facts are ignored
  assert.equal(bellBody(["Card", "£1.00", "", false, null, undefined]), "Card · £1.00");
  // an optional fact that would push it past the limit is dropped whole, not cut mid-word
  const out = bellBody(["Tax-Free Childcare", bellMoney(1234.5), "A very long optional tag that cannot fit here at all"]);
  assert.equal(out, "Tax-Free Childcare · £1234.50");
  assert.ok(out.length <= BELL_BODY_MAX);
  for (const body of [bellBody(["Bank transfer", "£15.30", "2 extras"]), bellBody(["Card held", "£0.60", "Released"]), bellBody(["Wallet credit", "£5.00", "2 days"])]) {
    assert.ok(body.length <= BELL_BODY_MAX, body);
    noSentence(body);
  }
});

test("payment type: two words or fewer, from how the family pays", () => {
  assert.equal(paymentType({ method: "Card", amount: 0.3 }), "Card");
  assert.equal(paymentType({ method: "card", amount: 0.3, cardHold: { state: "held" } }), "Card held");
  assert.equal(paymentType({ method: "Bank transfer", amount: 15.3 }), "Bank transfer");
  assert.equal(paymentType({ method: "bank", amount: 15.3 }), "Bank transfer");
  assert.equal(paymentType({ method: "Cash", amount: 5 }), "Cash");
  assert.equal(paymentType({ method: "Tax-Free Childcare", amount: 5 }), "Tax-Free Childcare");
  assert.equal(paymentType({ method: "Childcare vouchers", amount: 5 }), "Voucher");
  assert.equal(paymentType({ method: "Card", amount: 0 }), "Free");
  assert.equal(paymentType({ method: "Card", amount: 5, pay: "Funded" }), "Free");
});

test("the provider paid bell follows the same rules", () => {
  const b = { ref: "APF-10330", listing: "A long listing name that would never fit in a bell", booker: "Kaz James", amount: 0.3, child: "sally james", kids: undefined };
  for (const confirmed of [true, false]) {
    const m = providerPaidBell([b], confirmed);
    assert.ok(m.title.length <= BELL_TITLE_MAX && m.body.length <= BELL_BODY_MAX);
    noSentence(m.title.replace("✓", ""));
    noSentence(m.body);
  }
});
