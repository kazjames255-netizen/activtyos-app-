import test from "node:test";
import assert from "node:assert/strict";
import { applyHoNetFilter, blocksInHoNet } from "../../server/src/lib/franchiseScope";
import { owedNow } from "../../features/bookings/helpers";
import { kitTally, type KitBooking } from "../../features/bookings/addons";

// FAIL 3 (verify-integration-screens): owner Finance and Add-on orders ignored the Head office scope selector (own / franchise F / all showed the same).
// Same rule as every other head-office screen: ?franchiseId= "__ho__" = own locations, an id = that franchise, absent = everything.
const B = (ref: string, amount: number, franchiseId: string | null, listingId: string) =>
  ({ ref, status: "Confirmed", pay: "Unpaid", amount, amountPaid: 0, franchiseId, listingId, blockId: `blk-${listingId}`, days: ["2026-10-26"], child: "c", kids: [{ name: "c" }],
     addonLines: [{ child: "c", label: "T-shirt", price: 10, days: ["2026-10-26"], perDay: false, name: "T-shirt", qty: 1 }] }) as unknown as KitBooking & { franchiseId: string | null; amount: number; listingId: string; blockId: string };
const ALL = [B("own-1", 200, null, "L-own"), B("own-2", 170, null, "L-own"), B("fr-1", 44, "F", "L-F")];
const sum = (rows: unknown[]) => Math.round(rows.reduce<number>((t, b) => t + owedNow(b as never), 0));

test("Finance owed follows the head-office scope: own 370, franchise F 44, all 414", () => {
  assert.equal(sum(applyHoNetFilter(ALL, "company", "__ho__")), 370);
  assert.equal(sum(applyHoNetFilter(ALL, "company", "F")), 44);
  assert.equal(sum(applyHoNetFilter(ALL, "company", "")), 414);
  assert.equal(sum(applyHoNetFilter(ALL, "company", undefined)), 414);
});

const blocks = [{ id: "blk-L-own", listingId: "L-own" }, { id: "blk-L-F", listingId: "L-F" }, { id: "blk-gone", listingId: "L-missing" }];
const owner = new Map<string, string | null>([["L-own", null], ["L-F", "F"]]);

test("Add-on orders blocks follow the scope (own location never lists a franchise's booking)", () => {
  assert.deepEqual(blocksInHoNet(blocks, owner, "company", "__ho__").map((b) => b.id), ["blk-L-own"]);
  assert.deepEqual(blocksInHoNet(blocks, owner, "company", "F").map((b) => b.id), ["blk-L-F"]);
  assert.equal(blocksInHoNet(blocks, owner, "company", "").length, 3);
  assert.equal(blocksInHoNet(blocks, owner, "company", undefined).length, 3);
});
test("the scope only narrows a head office; other roles are untouched", () => {
  assert.equal(blocksInHoNet(blocks, owner, "freelancer", "F").length, 3);
  assert.equal(blocksInHoNet(blocks, owner, "franchise", "__ho__").length, 3);
});
test("Add-on orders tally per scope counts only that scope's orders", () => {
  const inScope = (q: string) => {
    const ids = new Set(blocksInHoNet(blocks, owner, "company", q).map((b) => b.id));
    return ALL.filter((b) => ids.has((b as unknown as { blockId: string }).blockId));
  };
  const items = (bs: KitBooking[]) => kitTally(bs, "2026-10-01", "2026-10-31").days["2026-10-26"]?.items ?? 0;
  assert.equal(items(inScope("__ho__")), 2);
  assert.equal(items(inScope("F")), 1);
  assert.equal(items(inScope("")), 3);
});
