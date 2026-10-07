import { test } from "node:test";
import assert from "node:assert/strict";
import { videoModeDefault } from "../../server/src/lib/onlineRules";
import { onlineWording } from "../../server/src/lib/emailTemplates";

// QA agent E1 (7 Oct 2026): an online listing always stores its hosting choice, and an online booking's emails never say "See you there!".
const venues = [{ id: "v1", kind: "online" }, { id: "v2", kind: "venue" }, { id: "v3" }];

test("an online venue with no hosting choice defaults to the ActivityOS room", () => {
  assert.equal(videoModeDefault(venues, "v1", undefined), "platform");
});
test("a chosen hosting mode is never overwritten", () => {
  assert.equal(videoModeDefault(venues, "v1", "own"), "own");
  assert.equal(videoModeDefault(venues, "v1", "platform"), "platform");
});
test("a normal venue, no venue, or an unknown venue gets no hosting mode", () => {
  assert.equal(videoModeDefault(venues, "v2", undefined), undefined);
  assert.equal(videoModeDefault(venues, "v3", undefined), undefined);
  assert.equal(videoModeDefault(venues, undefined, undefined), undefined);
  assert.equal(videoModeDefault(venues, "nope", undefined), undefined);
  assert.equal(videoModeDefault(undefined, "v1", undefined), undefined);
});
test("online emails say 'See you online!' instead of 'See you there!'", () => {
  assert.equal(onlineWording("<p>Great news. See you there!</p>"), "<p>Great news. See you online!</p>");
  assert.equal(onlineWording("<p>See you there! See you there!</p>"), "<p>See you online! See you online!</p>");
  assert.equal(onlineWording("<p>No sign-off here.</p>"), "<p>No sign-off here.</p>");
});
