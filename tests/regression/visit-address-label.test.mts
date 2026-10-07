import { test } from "node:test";
import assert from "node:assert/strict";
import { visitAddressLabel } from "../../features/bookings/helpers";

test("area words already in the typed address are not repeated", () => {
  assert.equal(
    visitAddressLabel({ address: "12 Corris Court, Milton Keynes", postcode: "MK10 9NR", area: "Broughton & Moulsoe, Milton Keynes" }),
    "12 Corris Court, Milton Keynes, MK10 9NR · Broughton & Moulsoe",
  );
});

test("an area that adds nothing new is left out entirely", () => {
  assert.equal(visitAddressLabel({ address: "5 Elm Rd, Leeds", postcode: "LS1 1AA", area: "leeds" }), "5 Elm Rd, Leeds, LS1 1AA");
});

test("a new area is still shown, and a missing street line works", () => {
  assert.equal(visitAddressLabel({ address: "12 High St", postcode: "MK10 9NR", area: "Kents Hill" }), "12 High St, MK10 9NR · Kents Hill");
  assert.equal(visitAddressLabel({ address: "", postcode: "MK10 9NR", area: "Broughton & Moulsoe, Milton Keynes" }), "MK10 9NR · Broughton & Moulsoe, Milton Keynes");
  assert.equal(visitAddressLabel(null), "");
});

test("whole words only: 'Hill' in the address does not hide 'Kents Hill'", () => {
  assert.equal(visitAddressLabel({ address: "3 Hill Rd", postcode: "MK10 9NR", area: "Kents Hill" }), "3 Hill Rd, MK10 9NR · Kents Hill");
});
