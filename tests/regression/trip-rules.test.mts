import test from "node:test";
import assert from "node:assert/strict";
import {
  consentObtained, consentPending, going, materialSnapshot, parseCost, ratioProblem, signoffProblems, staffNeeded, unlinkedChildren, viewForReader,
  type RuleAttendee, type RuleTrip,
} from "../../server/src/lib/tripRules";
import { parentBell } from "../../server/src/lib/parentBells";
import { CATALOGS } from "../../lib/i18n/messages/index";

// Trips: the rules the SERVER enforces. Pure (no database). Child safety: who may go, with how many staff, on whose consent.

const kid = (n: string, consent?: RuleAttendee["consent"], childId: string | null = n): RuleAttendee => ({ n, consent, ...(childId ? { childId } : {}) });

test("consent flag: server-owned, a decline does not turn it off, nobody going means false", () => {
  assert.equal(consentObtained([]), false);
  assert.equal(consentObtained([kid("A", "granted"), kid("B", "granted")]), true);
  assert.equal(consentObtained([kid("A", "granted"), kid("B", "pending")]), false);
  assert.equal(consentObtained([kid("A", "granted"), kid("B", "declined")]), true, "B is simply not going");
  assert.equal(consentObtained([kid("A", "declined")]), false, "nobody is going");
  assert.equal(consentObtained([kid("A")]), false, "no answer = pending");
  assert.deepEqual(consentPending([kid("A"), kid("B", "declined"), kid("C", "granted")]).map((a) => a.n), ["A"]);
  assert.deepEqual(going([kid("A"), kid("C", "granted")]).map((a) => a.n), ["C"]);
});

test("ratio 1:8 arithmetic: 16 going need 2 staff, 17 need 3, never fewer than 1", () => {
  assert.equal(staffNeeded(16, 8), 2);
  assert.equal(staffNeeded(17, 8), 3);
  assert.equal(staffNeeded(1, 8), 1);
  assert.equal(staffNeeded(0, 8), 1);
  assert.equal(staffNeeded(9, 0), 9, "a zero ratio is treated as 1:1, never divides by zero");
  const kids = (n: number) => Array.from({ length: n }, (_, i) => kid(`K${i}`, "granted"));
  const staff = (n: number) => Array.from({ length: n }, (_, i) => ({ n: `S${i}` }));
  assert.equal(ratioProblem({ offsiteRatio: 8, attendees: kids(16), roster: staff(2) }), null);
  assert.match(ratioProblem({ offsiteRatio: 8, attendees: kids(17), roster: staff(2) }) ?? "", /needs 3 staff, and 2 are on the trip/);
  assert.equal(ratioProblem({ attendees: kids(40), roster: staff(1) }), null, "no ratio set = nothing to enforce");
  // declined and pending children do not count towards the staff needed
  assert.equal(ratioProblem({ offsiteRatio: 8, attendees: [...kids(16), kid("X", "declined"), kid("Y", "pending")], roster: staff(2) }), null);
  // the roster wins, the plain staff list is the fallback
  assert.equal(ratioProblem({ offsiteRatio: 8, attendees: kids(9), staff: ["a", "b"] }), null);
  assert.notEqual(ratioProblem({ offsiteRatio: 8, attendees: kids(9), staff: ["a"] }), null);
});

test("sign-off needs: details, finished risk assessment, ratio, a lead and a first-aider, and somebody going", () => {
  const ok: RuleTrip = {
    destination: "Farm", date: "2026-10-20", lead: "Tina", transport: "Minibus", offsiteRatio: 8,
    hazards: [{ h: "Road", done: true, residual: "L" }], raSigned: true,
    roster: [{ n: "Tina", r: "Trip lead", fa: true }], attendees: [kid("A", "granted")],
  };
  assert.deepEqual(signoffProblems(ok), []);
  assert.match(signoffProblems({ ...ok, lead: "" }).join(), /destination, date, trip lead and transport/);
  assert.match(signoffProblems({ ...ok, raSigned: false }).join(), /risk assessment/);
  assert.match(signoffProblems({ ...ok, hazards: [{ h: "Road", done: false, residual: "L" }] }).join(), /risk assessment/);
  assert.match(signoffProblems({ ...ok, hazards: [] }).join(), /risk assessment/);
  assert.match(signoffProblems({ ...ok, roster: [{ n: "Someone", r: "Trip lead", fa: true }] }).join(), /named trip lead must be on/, "matched by NAME, not by a role word");
  assert.match(signoffProblems({ ...ok, roster: [{ n: "Someone", r: "Not the team leader", fa: true }] }).join(), /named trip lead must be on/);
  assert.deepEqual(signoffProblems({ ...ok, roster: [{ n: " tina ", r: "Coach", fa: true }] }), [], "the named lead on the roster is the lead, whatever the role text");
  assert.match(signoffProblems({ ...ok, roster: [], staff: ["Tina"] }).join(), /roster is empty/, "a bare staff list is not a roster");
  assert.match(signoffProblems({ ...ok, offsiteRatio: undefined, roster: [] }).join(), /roster is empty/, "no ratio and no roster = zero staff");
  assert.match(signoffProblems({ ...ok, roster: [{ n: "Tina", r: "Trip lead" }] }).join(), /first-aider/);
  assert.match(signoffProblems({ ...ok, attendees: [kid("A", "declined")] }).join(), /no child is going/);
  assert.match(signoffProblems({ ...ok, attendees: Array.from({ length: 9 }, (_, i) => kid(`K${i}`, "granted")) }).join(), /ratio/);
});

test("cost: blank or a plain pounds amount with at most 2 decimals; words, minus, commas and huge values are refused", () => {
  const v = (x: unknown) => { const r = parseCost(x); return r.ok ? r.value : "REFUSED"; };
  assert.equal(v(undefined), undefined);
  assert.equal(v(""), undefined);
  assert.equal(v("  "), undefined);
  assert.equal(v("0"), "0.00");
  assert.equal(v("12"), "12.00");
  assert.equal(v("12.5"), "12.50");
  assert.equal(v("12.50"), "12.50");
  assert.equal(v("£7"), "7.00");
  for (const bad of ["free", "-5", "10,50", "12.505", "1e3", "£free", "12 pounds", "123456", "NaN", "5.", ".5"]) assert.equal(v(bad), "REFUSED", bad);
  // arithmetic shown to a provider: 3 children at 12.50 is 37.50 (display only, nothing collects it)
  assert.equal((Number(v("12.5")) * 3).toFixed(2), "37.50");
});

test("unlinked children: nobody can be asked for consent; a decline is not counted", () => {
  const list = [kid("Linked", "pending", "c1"), kid("Ghost", "pending", null), kid("Gone", "declined", null)];
  assert.deepEqual(unlinkedChildren(list).map((a) => a.n), ["Ghost"]);
  assert.deepEqual(unlinkedChildren([kid("A", "granted", "c1")]), []);
});

test("sign-off covers who is going and who looks after them: a changed answer, child, staff or time is a material change; wording is not", () => {
  const base: RuleTrip = { destination: "Farm", date: "2026-10-20", departTime: "09:00", lead: "Tina", transport: "Bus", offsiteRatio: 8, roster: [{ n: "Tina", r: "Lead", fa: true }], attendees: [kid("A", "granted", "c1")] };
  const same = materialSnapshot(base);
  assert.equal(materialSnapshot({ ...base, destination: " Farm " }), same, "whitespace is not a change");
  assert.equal(materialSnapshot({ ...base, attendees: [{ ...kid("A", "granted", "c1"), med: "note" }] }), same, "a medical note edit is not a roster change");
  assert.notEqual(materialSnapshot({ ...base, attendees: [kid("A", "declined", "c1")] }), same);
  assert.notEqual(materialSnapshot({ ...base, attendees: [kid("A", "granted", "c1"), kid("B", "pending", "c2")] }), same);
  assert.notEqual(materialSnapshot({ ...base, date: "2026-10-21" }), same);
  assert.notEqual(materialSnapshot({ ...base, departTime: "10:00" }), same);
  assert.notEqual(materialSnapshot({ ...base, roster: [] }), same);
  assert.notEqual(materialSnapshot({ ...base, offsiteRatio: 10 }), same);
  assert.notEqual(materialSnapshot({ ...base, raSigned: true }), same, "un-signing / signing the risk assessment changes what was signed off");
  assert.notEqual(materialSnapshot({ ...base, hazards: [{ h: "Road", done: true, residual: "L" }] }), same);
  assert.notEqual(materialSnapshot({ ...base, hazards: [{ h: "Road", done: true, residual: "L" }] }), materialSnapshot({ ...base, hazards: [] }));
});

test("plain staff see a medical FLAG, never the medical text or a parent's email; leads see everything", () => {
  const list: RuleAttendee[] = [{ n: "A", childId: "c1", consent: "granted", med: "Severe peanut allergy", consentBy: "mum@example.com" }, { n: "B", childId: "c2", consent: "pending" }];
  const lead = viewForReader(list, true);
  assert.equal(lead[0].med, "Severe peanut allergy");
  const plain = JSON.stringify(viewForReader(list, false));
  assert.doesNotMatch(plain, /peanut|mum@example/);
  const a = viewForReader(list, false)[0] as RuleAttendee & { medFlag?: boolean };
  assert.equal(a.medFlag, true);
  assert.equal(a.consentBy, "parent");
  assert.equal((viewForReader(list, false)[1] as { medFlag?: boolean }).medFlag, undefined);
});

test("trip cancelled bell: short, carries the data, no-payment line, and every one of the 11 languages has it", () => {
  const b = parentBell("trip-cancelled", { dest: "Hallam Farm", date: "20 Oct" });
  assert.match(b.title, /Hallam Farm/);
  assert.ok(b.title.length <= 60, b.title);
  assert.ok(b.body && b.body.length <= 90, b.body);
  assert.match(b.body ?? "", /20 Oct/);
  assert.match(b.body ?? "", /no payment/i);
  const cats = CATALOGS as unknown as Record<string, Record<string, Record<string, string>>>;
  for (const loc of ["en", "pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"]) {
    for (const k of [b.i18n.tk, b.i18n.bk!]) {
      const v = cats[loc]?.p7shell?.[k.split(".")[1]];
      assert.ok(v && v.length > 0, `${loc} is missing ${k}`);
      if (k === b.i18n.tk) assert.ok(v.includes("{dest}"), `${loc} ${k} keeps the {dest} placeholder`);
      else assert.ok(v.includes("{date}"), `${loc} ${k} keeps the {date} placeholder`);
    }
  }
});
