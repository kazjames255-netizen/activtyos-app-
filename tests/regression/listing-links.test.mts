import { test } from "node:test";
import assert from "node:assert/strict";
import { listingLinkPath, listingLinkUrl, listingLinkKindOf } from "../../lib/listingLinks";

test("storefront link is /book/<id>, quick link adds ?quick=1", () => {
  assert.equal(listingLinkPath("abc123"), "/book/abc123");
  assert.equal(listingLinkPath("abc123", "storefront"), "/book/abc123");
  assert.equal(listingLinkPath("abc123", "quick"), "/book/abc123?quick=1");
});

test("the id is encoded and the embed flag survives", () => {
  assert.equal(listingLinkPath("a b/c", "storefront"), "/book/a%20b%2Fc");
  assert.equal(listingLinkPath("x", "quick", { embed: true }), "/book/x?quick=1&embed=1");
  assert.equal(listingLinkPath("x", "storefront", { embed: true }), "/book/x?embed=1");
});

test("the URL uses the origin it is given, without a doubled slash", () => {
  assert.equal(listingLinkUrl("https://app.example.com/", "id1", "quick"), "https://app.example.com/book/id1?quick=1");
  assert.equal(listingLinkUrl("https://app.example.com", "id1"), "https://app.example.com/book/id1");
});

test("the kind is read back from the query string", () => {
  assert.equal(listingLinkKindOf(new URLSearchParams("quick=1")), "quick");
  assert.equal(listingLinkKindOf(new URLSearchParams("quick=0")), "storefront");
  assert.equal(listingLinkKindOf(new URLSearchParams("")), "storefront");
});
