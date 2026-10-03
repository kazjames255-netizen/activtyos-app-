import test from "node:test";
import assert from "node:assert/strict";
import { buildPayOptions } from "../server/src/lib/publicPayOptions";

const billing = { bankName: "Monzo", accountName: "Acme Ltd", sortCode: "04-00-04", accountNumber: "12345678", email: "a@b.co", phone: "0123" };

test("bank transfer lists details and the reference", () => {
  const o = buildPayOptions(["Card", "Bank transfer", "Cash on the day"], billing, "APF-1");
  assert.equal(o.bank?.reference, "APF-1");
  assert.equal((o.bank as Record<string, unknown>).sortCode, undefined, "account details never go to a public page");
  assert.equal((o.bank as Record<string, unknown>).accountNumber, undefined);
  assert.equal(o.cash, true);
  assert.deepEqual(o.methods, ["Bank transfer", "Cash on the day"]);
  assert.equal(o.contact, null);
});

test("bank listed but no account details is not offered; falls back to contact", () => {
  const o = buildPayOptions(["Card", "Bank transfer"], { email: "a@b.co" }, "R");
  assert.equal(o.bank, null);
  assert.deepEqual(o.methods, []);
  assert.deepEqual(o.contact, { email: "a@b.co" });
});

test("vouchers and never leaks other billing fields", () => {
  const o = buildPayOptions(["Tax-Free Childcare"], { ...billing, vatNumber: "GB1" }, "R");
  assert.equal(o.vouchers, true);
  assert.equal(o.bank, null);
  assert.ok(!("vatNumber" in o));
});
