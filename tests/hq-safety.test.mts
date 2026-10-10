// Pure tests for the HQ portal safety helpers (server/src/lib/hqSafety.ts). Run: tsx --test tests/hq-safety.test.mts
//   X16 bank masking   X06 body hash / reason   X17 feature keys   X18 price rules   X26 duplicate cycles   X27 AI digest redaction
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { bodyHash, cleanReason, diffPlans, isFrozenAccount, truthyFlag, knownFeatureKeys, makesDuplicateCycle, maskAccountNumber, maskBank, maskSortCode, redactPersonal, validPrice } from "../server/src/lib/hqSafety.ts";

test("X16: sort code and account number are masked to their last digits", () => {
  assert.equal(maskSortCode("12-34-34"), "**-**-34");
  assert.equal(maskSortCode("123456"), "**-**-56");
  assert.equal(maskAccountNumber("12345678"), "****5678");
  assert.equal(maskAccountNumber("99999999"), "****9999");
  assert.equal(maskAccountNumber(null), null);
  const m = maskBank({ bankName: "Testbank", accountName: "Acme", sortCode: "20-30-40", accountNumber: "12345678" })!;
  assert.deepEqual(m, { bankName: "Testbank", accountName: "Acme", sortCode: "**-**-40", accountNumber: "****5678", masked: true });
  assert.ok(!JSON.stringify(m).includes("20-30") && !JSON.stringify(m).includes("1234"));
  assert.equal(maskBank(null), null);
});

test("X06: a body hash is keyed (HMAC), full length, stable, never the content, and empty for no body", () => {
  const mac = (k: string) => (s: string) => createHmac("sha256", k).update(s).digest("base64url");
  const h = bodyHash({ child: "Ava", address: "1 Secret Street" }, mac("server-secret"))!;
  assert.equal(h.length, 43, "the full digest, not a truncation");
  assert.equal(h, bodyHash({ child: "Ava", address: "1 Secret Street" }, mac("server-secret")));
  assert.notEqual(h, bodyHash({ child: "Ava", address: "2 Secret Street" }, mac("server-secret")));
  assert.notEqual(h, bodyHash({ child: "Ava", address: "1 Secret Street" }, mac("another-secret")), "depends on the secret");
  assert.ok(!h.includes("Ava"));
  // Without the secret an attacker cannot test guesses: the plain unsalted hashes of the same body do not match.
  const body = { accountNumber: "12345678" };
  const guess = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const mine = bodyHash(body, mac("server-secret"))!;
  assert.ok(!mine.startsWith(guess.slice(0, 12)) && Buffer.from(mine, "base64url").toString("hex") !== guess);
  assert.equal(bodyHash({}, mac("k")), null);
  assert.equal(bodyHash(undefined, mac("k")), null);
});

test("X06: invisible characters do not count towards the reason", () => {
  assert.equal(cleanReason("\u200b\u200b\u200b\u200b\u200b\u200b"), null);
  assert.equal(cleanReason("ab\u200bcd\u200e\u2060"), null, "four visible characters");
  assert.equal(cleanReason("\u3164\u3164\u3164\u3164\u3164"), null);
  assert.equal(cleanReason("a\u200bbcde"), "abcde");
  assert.equal(cleanReason("fix\u00a0the  bill"), "fix the bill");
});

test("X08: any truthy-string disabled flag counts as disabled", () => {
  for (const v of [true, "true", "TRUE", " true ", 1, "1", "yes"]) assert.ok(truthyFlag(v), String(v));
  for (const v of [false, "false", "", 0, "0", null, undefined, "no"]) assert.ok(!truthyFlag(v), String(v));
  assert.ok(isFrozenAccount({ disabled: "true" }));
  assert.ok(isFrozenAccount({ deactivatedAt: "2026-10-01" }));
  assert.ok(!isFrozenAccount({ disabled: "false" }));
});

test("X06: the reason for opening an account is 5 to 300 characters once trimmed", () => {
  assert.equal(cleanReason("  Parent   rang about a refund "), "Parent rang about a refund");
  assert.equal(cleanReason("abcd"), null);
  assert.equal(cleanReason("     ab    "), null);
  assert.equal(cleanReason("abcde"), "abcde");
  assert.equal(cleanReason("x".repeat(301)), null);
  assert.equal(cleanReason(undefined), null);
  assert.equal(cleanReason(12345), null);
});

test("X18: a pricing change is described field by field (who/when are added by the route)", () => {
  const before = [{ id: "freelancer", name: "Freelancer", price: 29, features: ["a"] }, { id: "company", price: 49, bands: [{ id: "starter", price: 49, staffMax: 10 }] }];
  const after = [{ id: "company", price: 49, bands: [{ id: "starter", price: 55, staffMax: 10 }] }, { id: "freelancer", name: "Freelancer", price: 35, features: ["a"] }];
  assert.deepEqual(diffPlans(before, after), [
    { plan: "freelancer", path: "price", old: 29, new: 35 },
    { plan: "company", path: "bands.starter.price", old: 49, new: 55 },
  ]);
  assert.deepEqual(diffPlans(before, before), []);
  assert.deepEqual(diffPlans(null, [{ id: "x", price: 1 }]), [{ plan: "x", path: "(plan)", old: "absent", new: "present" }]);
});

test("X18: prices must be above 0, at most 10 000, at most two decimals", () => {
  for (const ok of [0.01, 29, 49.5, 99.99, 10000]) assert.ok(validPrice(ok), String(ok));
  for (const bad of [0, -5, 1e9, 10000.01, 29.999, NaN, Infinity, "29", null, undefined]) assert.ok(!validPrice(bad), String(bad));
});

test("X17: only real feature keys are accepted", () => {
  const k = knownFeatureKeys();
  for (const ok of ["tasks", "registers", "admin-registers", "messages", "marketing", "trips"]) assert.ok(k.has(ok), ok);
  for (const bad of ["zzz", "", "__proto__", "tasks ", "TASKS"]) assert.ok(!k.has(bad), JSON.stringify(bad));
});

test("X26: a duplicate link that would close a loop is detected", () => {
  assert.ok(makesDuplicateCycle({ B: "A" }, "A", "B"), "A dup B while B dup A");
  assert.ok(makesDuplicateCycle({ B: "C", C: "A" }, "A", "B"), "three-ring");
  assert.ok(makesDuplicateCycle({}, "A", "A"), "itself");
  assert.ok(!makesDuplicateCycle({ B: "C" }, "A", "B"), "a chain is fine");
  assert.ok(!makesDuplicateCycle({}, "A", "B"));
  // An existing loop elsewhere must not hang the check.
  assert.ok(makesDuplicateCycle({ X: "Y", Y: "X" }, "A", "X"));
});

test("X27: personal data is taken out of the text that goes to the AI model", () => {
  const raw = "Parent Jane Smith (jane.smith@example.com) says child Ava Testchild was hurt; please advise. Ring 07700 900123.";
  const out = redactPersonal(raw, ["Jane Smith", "jane.smith@example.com"]);
  for (const leak of ["jane.smith", "example.com", "Jane", "Smith", "Ava", "Testchild", "07700", "900123"]) assert.ok(!out.includes(leak), `${leak} leaked: ${out}`);
  assert.ok(/hurt/.test(out) && /please advise/.test(out), "the complaint itself survives");
  // A single first name after a trigger word, and the thread's own known name parts.
  assert.ok(!redactPersonal("my son Noah fell over", []).includes("Noah"));
  assert.ok(!redactPersonal("hi it is lucy here, lucy cannot log in", ["Lucy Brown"]).toLowerCase().includes("lucy"));
  // Product words and days are kept so the digest still reads.
  assert.ok(redactPersonal("Stripe payout failed on Monday", []).includes("Stripe"));
  assert.ok(redactPersonal("Stripe payout failed on Monday", []).includes("Monday"));
});
