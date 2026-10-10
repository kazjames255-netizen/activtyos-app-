// Head injury notice: detection and wording (pure, no database).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isHeadInjury, headInjuryBell, headInjuryEmail } from "../server/src/lib/headInjury.ts";
import { CATALOGS } from "../lib/i18n/messages/index.ts";

const v = { name: "Ada", activity: "Football Club", when: "14:30", contact: "Sunny Sports (01234 567890)" };

describe("isHeadInjury", () => {
  it("ticks, body part and injury text name the head, accidents only", () => {
    assert.equal(isHeadInjury({ kind: "accident", headInjury: true }), true);
    assert.equal(isHeadInjury({ kind: "accident", injury: "Bump to the head" }), true);
    assert.equal(isHeadInjury({ kind: "accident", bodyPart: "Forehead" }), true);
    assert.equal(isHeadInjury({ kind: "accident", injury: "Suspected concussion" }), true);
    assert.equal(isHeadInjury({ kind: "incident", headInjury: true, injury: "Bump to the head" }), false);
    assert.equal(isHeadInjury({ kind: "safeguarding", bodyPart: "head" }), false);
  });
  it("other injuries and words that only contain 'head' do not count", () => {
    assert.equal(isHeadInjury({ kind: "accident", injury: "Grazed knee" }), false);
    assert.equal(isHeadInjury({ kind: "accident", injury: "Headache from the heat" }), false);
    assert.equal(isHeadInjury({ kind: "accident", bodyPart: "Overhead swing hurt shoulder" }), false);
    assert.equal(isHeadInjury({ kind: "accident" }), false);
  });
});

describe("head injury wording", () => {
  it("bell and email carry the child, activity, time, contact and the watch-for advice", () => {
    const b = headInjuryBell(v);
    assert.match(b.title, /Ada/);
    for (const x of [v.name, v.activity, v.when, v.contact, "headache", "vomiting", "drowsiness", "confusion"]) assert.ok(b.body.includes(x), x);
    assert.ok(!/\{\w+\}/.test(b.title + b.body), "unfilled placeholder");
    const m = headInjuryEmail(v);
    for (const x of ["Ada", "Football Club", "14:30", "Sunny Sports", "headache", "vomiting", "drowsiness", "confusion", "999"]) assert.ok(m.html.includes(x), x);
  });
  it("email escapes provider-typed text", () => {
    assert.ok(!headInjuryEmail({ ...v, activity: "<script>x</script>" }).html.includes("<script>"));
  });
  it("all 11 languages have both keys with the same placeholders", () => {
    const need = ["{name}", "{activity}", "{when}", "{contact}"];
    for (const l of ["en", "pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"]) {
      const c = (CATALOGS as any)[l].p7shell;
      assert.ok(c.bellHeadTitle.includes("{name}"), l);
      for (const p of need) assert.ok(c.bellHeadBody.includes(p), `${l} ${p}`);
    }
  });
});
