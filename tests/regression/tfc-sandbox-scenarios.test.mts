/** HMRC Tax-Free Childcare Payments API v1.2 sandbox scenarios (test outbound_child_payment_ref values): every documented error code maps to the
 *  parent-facing screen we designed, every screen has wording in all 11 languages, and no screen leaks a raw HMRC error code. Pure: no network. */
import test from "node:test";
import assert from "node:assert/strict";
import { TFC_CODE_FAILURES, TFC_COPY_STEM, tfcFailureForCode, type TfcFailure } from "../../lib/tfc";
import { failureForCode } from "../../server/src/lib/tfc";
import p7ckMod from "../../lib/i18n/messages/areas/p7ck";
// the default export may be wrapped by the module interop layer
const p7ck = ((p7ckMod as unknown as { default?: unknown }).default ?? p7ckMod) as Record<string, Record<string, string>>;

// scenario ref -> [HMRC code, endpoints it applies to, the failure the PARENT must see]
const SCENARIOS: [string, string, string, TfcFailure][] = [
  ["EERR00000TFC", "E0026", "link, balance, payment", "reference-mismatch"],
  ["EETT00000TFC", "E0030", "link, balance, payment", "not-connected"],
  ["EEBD00000TFC", "E0043", "link, balance, payment", "no-tfc-account"],
  ["EEPP00000TFC", "E0024", "link, payment", "not-connected"],
  ["EEQQ00000TFC", "E0025", "link", "reference-mismatch"],
  ["EEVV00000TFC", "E0032", "balance, payment", "reference-mismatch"],
  ["EERS00000TFC", "E0027", "payment", "provider-not-added"],
  ["EEUU00000TFC", "E0031", "payment", "provider-unavailable"],
  ["EEYY00000TFC", "E0035", "payment", "account-blocked"],
  ["EEYZ00000TFC", "E0036", "payment", "provider-unavailable"],
  ["EEBC00000TFC", "E0042", "payment", "provider-unavailable"],
  ["EEWW00000TFC", "E0033", "payment", "insufficient-funds"],
];

test("every HMRC sandbox error scenario maps to the designed parent screen", () => {
  for (const [ref, code, , want] of SCENARIOS) {
    assert.equal(tfcFailureForCode(code, 400), want, `${ref} / ${code}`);
    assert.equal(failureForCode(code, 400), want, `server mapping ${ref} / ${code}`);
  }
});

test("token failures and unknown codes degrade safely", () => {
  assert.equal(tfcFailureForCode("ETFC2", 401), "connection-expired");
  assert.equal(tfcFailureForCode("E0401", 500), "connection-expired");
  assert.equal(tfcFailureForCode(undefined, 403), "connection-expired");
  assert.equal(tfcFailureForCode("E9999", 400), "connection-failed");
  assert.equal(tfcFailureForCode(undefined, 500), "connection-failed");
});

test("every failure screen has a title and detail in all 11 languages and shows no raw HMRC code", () => {
  const langs = Object.keys(p7ck) as (keyof typeof p7ck)[];
  assert.equal(langs.length, 11);
  for (const f of Object.keys(TFC_COPY_STEM) as TfcFailure[]) {
    const stem = TFC_COPY_STEM[f];
    for (const l of langs) {
      for (const part of ["title", "detail"]) {
        const text = (p7ck[l] as Record<string, string>)[`${stem}_${part}`];
        assert.ok(text && text.length > 8, `${l} ${stem}_${part}`);
        assert.doesNotMatch(text, /\bE\d{4}\b|ETFC2/, `${l} ${stem}_${part} leaks a code`);
      }
    }
  }
});

test("every mapped code resolves to a known failure screen", () => {
  for (const [code, f] of Object.entries(TFC_CODE_FAILURES)) assert.ok(TFC_COPY_STEM[f], `${code} -> ${f}`);
});
