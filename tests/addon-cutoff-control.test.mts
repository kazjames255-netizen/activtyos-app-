import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cutoffBlur, cutoffFromSaved, cutoffToggle, cutoffType, cutoffValueToSave, parseCutoffText } from "../features/listings/addonCutoffControl";

describe("add-on cut-off control state", () => {
  it("parse: only whole 0-60", () => {
    assert.equal(parseCutoffText("0"), 0); assert.equal(parseCutoffText("60"), 60); assert.equal(parseCutoffText(" 7 "), 7);
    for (const v of ["", "abc", "1.5", "-1", "61", "100"]) assert.equal(parseCutoffText(v), null, v);
  });
  it("starts off when nothing saved, on when a number is saved", () => {
    assert.equal(cutoffFromSaved(undefined, 3).on, false);
    assert.deepEqual(cutoffFromSaved(7, 3), { on: true, text: "7", lastValid: 7 });
    assert.equal(cutoffFromSaved(99, 3).on, false);
  });
  it("ticking on starts at the Setup default", () => {
    const c = cutoffToggle(cutoffFromSaved(undefined, 3), true);
    assert.equal(c.on, true); assert.equal(c.text, "3");
  });
  it("backspacing the number keeps the box ticked", () => {
    let c = cutoffFromSaved(7, 3);
    c = cutoffType(c, "");
    assert.equal(c.on, true); assert.equal(c.text, "");
    c = cutoffType(c, "5");
    assert.equal(cutoffValueToSave(c), 5);
  });
  it("empty or garbage while on never stores 0: reverts to the last valid number", () => {
    let c = cutoffType(cutoffFromSaved(7, 3), "");
    assert.equal(cutoffValueToSave(c), 7);
    assert.equal(cutoffBlur(c).text, "7");
    c = cutoffType(c, "abc");
    assert.equal(cutoffValueToSave(c), 7);
    c = cutoffType(c, "99");
    assert.equal(cutoffValueToSave(c), 7);
  });
  it("a typed 0 is a real 0; off saves nothing", () => {
    assert.equal(cutoffValueToSave(cutoffType(cutoffFromSaved(7, 3), "0")), 0);
    assert.equal(cutoffValueToSave(cutoffToggle(cutoffFromSaved(7, 3), false)), undefined);
  });
});
