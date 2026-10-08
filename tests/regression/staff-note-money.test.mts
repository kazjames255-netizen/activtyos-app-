import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { bellsForStaff, staffSafeNote } from "../../server/src/lib/rosterRules";

// FINAL POLISH (B): the booking `note` a staff token receives must carry no money. System-generated notes ('1 day released — £26.00 refund requested.',
// 'Price set by provider: £69.00 (was £80.00)') are rewritten; a note a person typed is kept.
test("a release note loses its amount, keeps the facts", () => {
  assert.equal(staffSafeNote("1 day released — £26.00 refund requested."), "1 day released.");
  assert.equal(staffSafeNote("Sam — 2 days released — £1,026.50 refund requested."), "Sam — 2 days released.");
  assert.equal(staffSafeNote("1 day released to wallet credit."), "1 day released to wallet credit.");
  assert.equal(staffSafeNote("Mia — whole place released — no refund due."), "Mia — whole place released — no refund due.");
});
test("a price-set note is dropped; a human note before it stays", () => {
  assert.equal(staffSafeNote("Price set by provider: £69.00 (was £80.00) — loyal family"), "");
  assert.equal(staffSafeNote("Allergic to nuts · Price set by provider: £69.00 (was £80.00)"), "Allergic to nuts");
});
test("a note staff typed is untouched (even when it mentions money)", () => {
  assert.equal(staffSafeNote("Peanut allergy. Mum rings on arrival."), "Peanut allergy. Mum rings on arrival.");
  assert.equal(staffSafeNote("Collect £5 for the trip"), "Collect £5 for the trip");
  assert.equal(staffSafeNote(undefined), "");
});
test("every system note template that carries a pound amount is covered by staffSafeNote", () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const src = fs.readFileSync(path.join(root, "server/src/routes/my.ts"), "utf8");
  const lines = src.split("\n").filter((l) => /b\.note = /.test(l) && (/£/.test(l) || /money\(/.test(l)));
  assert.ok(lines.length >= 2, "found the money notes");
  // The rendered shapes of those templates:
  for (const rendered of ["Sam released — £26.00 refund requested.", "Price set by provider: £10.00 (was £12.00) — why"]) assert.doesNotMatch(staffSafeNote(rendered), /£/);
});

test("the team bell shows staff no money: billing alerts and anything quoting a pound amount are hidden, alerts aimed at them stay", () => {
  const items = [
    { category: "billing", title: "Refund declined", body: "No amount here" },
    { category: "booking", title: "Refund requested", body: "1 day released, £26.00 refund requested" },
    { category: "booking", title: "New booking", body: "Mia booked Football" },
    { category: "billing", title: "Your payslip", body: "£1,200 net", toEmail: "staff@x.com" },
  ];
  assert.deepEqual(bellsForStaff(items).map((n) => n.title), ["New booking", "Your payslip"]);
});
