import test from "node:test";
import assert from "node:assert/strict";
import { joinList, safeLocale } from "../lib/i18n/listFormat";

test("joinList never throws when Intl.ListFormat is missing (old Safari)", () => {
  const I = Intl as unknown as { ListFormat?: unknown };
  const saved = I.ListFormat;
  I.ListFormat = undefined;
  try { assert.equal(joinList(["a", "b", "c"], "en-GB"), "a, b, c"); } finally { I.ListFormat = saved; }
});

test("joinList uses the language's own 'and' when available", () => {
  assert.equal(joinList(["a", "b"], "en-GB"), "a and b");
  assert.equal(joinList(["a"], "en-GB"), "a");
  assert.equal(joinList([], "en-GB"), "");
});

test("joinList survives an invalid locale tag", () => {
  assert.equal(joinList(["a", "b"], "not a tag!"), "a, b");
});

test("safeLocale falls back to en-GB for a tag the browser rejects", () => {
  assert.equal(safeLocale("not a tag!"), "en-GB");
  assert.equal(safeLocale("cy-GB"), "cy-GB");
});
