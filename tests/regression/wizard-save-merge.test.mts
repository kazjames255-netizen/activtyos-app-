// The listing wizard autosaves while you type. A finished save must not overwrite letters typed while it was in flight.
import test from "node:test";
import assert from "node:assert/strict";
import { mergeSaved } from "../../features/listings/wizardRules";

test("typing during a save survives; only id/status come from the save", () => {
  const imgs: unknown[] = [];
  const sent = { description: "t", images: imgs, gallery: [] as unknown[] };
  const now = { description: "testing", images: imgs, gallery: sent.gallery };
  const out = mergeSaved(now, sent, { id: "L1", status: "draft", images: ["https://x/1.jpg"], gallery: [] });
  assert.equal(out.description, "testing");
  assert.equal(out.id, "L1");
  assert.deepEqual(out.images, ["https://x/1.jpg"]);
});

test("photos changed mid-save are kept, not replaced by the uploaded copies of the old ones", () => {
  const sentImgs: unknown[] = ["data:a"];
  const sent = { images: sentImgs, gallery: [] as unknown[] };
  const newer = ["data:a", "data:b"];
  const out = mergeSaved({ images: newer, gallery: sent.gallery }, sent, { id: "L1", status: "live", images: ["https://x/a.jpg"], gallery: [] });
  assert.equal(out.images, newer);
  assert.equal(out.status, "live");
});
