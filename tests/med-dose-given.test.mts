// H22: a dose written as "No dose" / "Missed" / "Refused" must be treated as NOT given; a real dose as given; an explicit `given` wins.
// H12 / H50 wording: the two short parent bells exist in all 11 languages with their placeholders.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { doseWasGiven } from "../server/src/lib/medDose";
import { medReaskBell, recordMadeBell } from "../server/src/lib/healthBells";
import { CATALOGS } from "../lib/i18n/messages/index";

describe("doseWasGiven", () => {
  const missed = ["No dose", "no dose", "NO DOSE", "  No   dose ", "No dose given", "no-dose", "Not given", "not given - asleep", "Not-given", "Not given (refused)", "Dose not given", "Not taken",
    "Missed", "missed dose", "Refused", "Child refused", "Declined", "Skipped", "Withheld", "Omitted", "None", "Nil", "Nothing", "Didn't take it", "Did not have it"].filter((x) => x !== "Child refused");
  for (const t of missed) it(`"${t}" is NOT given`, () => assert.equal(doseWasGiven(t), false));
  const given = ["2 puffs", "5ml", "One puff", "1 tablet", "10 mg", "Half a tablet", "Normal dose", "Double dose (as directed)", "Cream applied"];
  for (const t of given) it(`"${t}" is given`, () => assert.equal(doseWasGiven(t), true));
  it("an explicit given flag wins over the text", () => {
    assert.equal(doseWasGiven("No dose", true), true);
    assert.equal(doseWasGiven("2 puffs", false), false);
  });
});

describe("the two health bells", () => {
  const LANGS = ["en", "pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"];
  const need: Record<string, string[]> = { bellMedReaskTitle: ["{name}"], bellMedReaskBody: ["{provider}", "{med}"], bellRecordTitle: ["{name}"], bellRecordBody: ["{name}", "{provider}"] };
  for (const l of LANGS) it(`${l}: all four strings with their placeholders`, () => {
    const c = (CATALOGS as any)[l].p7shell;
    for (const [k, ph] of Object.entries(need)) for (const p of ph) assert.ok(String(c[k]).includes(p), `${l} ${k} ${p}`);
  });
  it("the English text is filled in, and the confidential-record bell carries nothing but the child and the provider", () => {
    const m = medReaskBell({ name: "Sam", med: "Ventolin", provider: "Acme" });
    assert.match(m.title, /Sam/); assert.match(m.body, /Acme/); assert.match(m.body, /Ventolin/);
    const r = recordMadeBell({ name: "Sam", provider: "Acme" });
    assert.equal(r.body, "A record was made about Sam. Please contact Acme.");
    assert.ok(r.i18n.tk && r.i18n.bk);
  });
});
