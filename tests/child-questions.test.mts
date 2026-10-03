/**
 * Child questions + child profile regression tests (pure: no network, no Firestore).
 * Oracle: lib/testTracker/catalogue.ts CF-* entries (CF-001..CF-017, CF-021).
 *
 * Run:   npm run test:questions
 *        (= server/node_modules/.bin/tsx --test tests/child-questions.test.mts)
 *
 * Covers: lib/settings.ts (questionsFor, dobRequired, limitFor, asksEveryBooking, withDefaults,
 *           SEEDED_QUESTIONS, TOILET_QUESTION, toiletQuestion, needsNappies, heldForReview),
 *         components/QuestionFields.tsx (unansweredRequired),
 *         features/listings/checkout.tsx (ageOn, CHILD_LIMITS),
 *         server/src/lib/questionHold.ts (heldByNoAnswer: the server's hold-if-No rule from routes/my.ts),
 *         server/src/lib/childSchema.ts (the POST/PUT /api/my/children zod schema, extracted from routes/my.ts),
 *         server/src/lib/tidyChildren.ts (splitChildNames, tidyChildren).
 */
import test from "node:test";
import assert from "node:assert/strict";
import type { ChildQuestion } from "../lib/settings";
import { heldByNoAnswer } from "../server/src/lib/questionHold";
import { childSchema } from "../server/src/lib/childSchema";
import { splitChildNames, tidyChildren } from "../server/src/lib/tidyChildren";
import { ukToday, addDays } from "../server/src/lib/ukDate";

// The client modules pull in lib/api -> the Firebase web SDK, which throws at import without an API key. A dummy key is
// enough (initialising auth does no network I/O), so set it before dynamically importing them.
process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??= "test-dummy-key";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??= "test-dummy";
process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??= "1:1:web:1";
const {
  questionsFor, dobRequired, limitFor, asksEveryBooking, withDefaults, DEFAULT_SETTINGS, SEEDED_QUESTIONS,
  TOILET_QUESTION, toiletQuestion, needsNappies, heldForReview, answerKey, DEFAULT_QUESTION_LENGTH,
} = await import("../lib/settings");
const { unansweredRequired } = await import("../components/QuestionFields");
const { ageOn, CHILD_LIMITS } = await import("../features/listings/checkout");

const q = (over: Partial<ChildQuestion> & { id: string }): ChildQuestion =>
  ({ label: over.id, type: "text", scope: "all", ...over }) as ChildQuestion;
const ids = (qs: ChildQuestion[]) => qs.map((x) => x.id);
const issuePaths = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.path.join("."));

test("CF-005/006/007: question shapes and required answers", async (t) => {
  await t.test("CF-005: a required text question with no / blank / whitespace answer is unanswered", () => {
    const qs = [q({ id: "a", label: "Nickname", required: true })];
    assert.deepEqual(ids(unansweredRequired(qs, {})), ["a"]);
    assert.deepEqual(ids(unansweredRequired(qs, { a: "" })), ["a"]);
    assert.deepEqual(ids(unansweredRequired(qs, { a: "   " })), ["a"]);
  });
  await t.test("CF-005: answering clears it; a non-required question never blocks", () => {
    assert.deepEqual(unansweredRequired([q({ id: "a", required: true })], { a: "Bea" }), []);
    assert.deepEqual(unansweredRequired([q({ id: "b" })], {}), []);
    assert.deepEqual(unansweredRequired([q({ id: "b", required: false })], {}), []);
  });
  await t.test("CF-005: several required questions are ALL reported at once, not the first only", () => {
    const qs = [q({ id: "a", required: true }), q({ id: "b", required: true }), q({ id: "c", required: true })];
    assert.deepEqual(ids(unansweredRequired(qs, { b: "x" })), ["a", "c"]);
  });
  await t.test("CF-006/007: choice and yes/no questions keep type + options and are required the same way", () => {
    const choice = q({ id: "swim", type: "choice", options: ["None", "Beginner", "Confident"], required: true });
    const yn = q({ id: "yn", type: "yesno", required: true });
    assert.deepEqual(choice.options, ["None", "Beginner", "Confident"]);
    assert.deepEqual(ids(unansweredRequired([choice, yn], { swim: "Beginner" })), ["yn"]);
    assert.deepEqual(unansweredRequired([choice, yn], { swim: "Beginner", yn: "No" }), []);
  });
  await t.test("answers are stored under the question id", () => {
    assert.equal(answerKey(q({ id: "q-xyz" })), "q-xyz");
  });
  await t.test("text question falls back to the default length", () => {
    assert.equal(DEFAULT_QUESTION_LENGTH, 300);
  });
});

test("CF-008: scope (one listing only)", async (t) => {
  const all = q({ id: "all", scope: "all" });
  const one = q({ id: "one", scope: ["L1"] });
  const two = q({ id: "two", scope: ["L1", "L2"] });
  const qs = [all, one, two];
  await t.test("asked only on the listing it is scoped to", () => {
    assert.deepEqual(ids(questionsFor(qs, "L1")), ["all", "one", "two"]);
    assert.deepEqual(ids(questionsFor(qs, "L2")), ["all", "two"]);
    assert.deepEqual(ids(questionsFor(qs, "L3")), ["all"]);
  });
  await t.test("no listing in hand (Families screen / export) still shows scoped questions", () => {
    assert.deepEqual(ids(questionsFor(qs)), ["all", "one", "two"]);
  });
  await t.test("an empty scope array matches no listing", () => {
    assert.deepEqual(ids(questionsFor([q({ id: "none", scope: [] })], "L1")), []);
  });
  await t.test("hidden questions are never asked, whatever the scope", () => {
    assert.deepEqual(ids(questionsFor([q({ id: "h", hidden: true }), q({ id: "h2", hidden: true, scope: ["L1"] })], "L1")), []);
    assert.deepEqual(ids(questionsFor([q({ id: "h", hidden: true })])), []);
  });
});

test("CF-009: age-gated questions (minAge / maxAge)", async (t) => {
  const gated = q({ id: "walk", minAge: 8, maxAge: 11 });
  await t.test("ages 6, 9 and unknown: only the 9-year-old is asked", () => {
    assert.deepEqual(ids(questionsFor([gated], "L1", 6)), []);
    assert.deepEqual(ids(questionsFor([gated], "L1", 9)), ["walk"]);
    assert.deepEqual(ids(questionsFor([gated], "L1", null)), []);
    assert.deepEqual(ids(questionsFor([gated], "L1", undefined)), []);
    assert.deepEqual(ids(questionsFor([gated], "L1")), []);
  });
  await t.test("boundaries are inclusive (7 no, 8 yes, 11 yes, 12 no)", () => {
    assert.deepEqual([7, 8, 11, 12].map((a) => questionsFor([gated], undefined, a).length), [0, 1, 1, 0]);
  });
  await t.test("either end may be open", () => {
    const minOnly = q({ id: "min", minAge: 8 });
    const maxOnly = q({ id: "max", maxAge: 5 });
    assert.deepEqual([7, 8, 17].map((a) => questionsFor([minOnly], undefined, a).length), [0, 1, 1]);
    assert.deepEqual([4, 5, 6].map((a) => questionsFor([maxOnly], undefined, a).length), [1, 1, 0]);
  });
  await t.test("minAge 0 is still a gate (0 is not 'unset'): a child with no DOB is asked nothing", () => {
    const zero = q({ id: "zero", minAge: 0 });
    assert.deepEqual(ids(questionsFor([zero], undefined, null)), []);
    assert.deepEqual(ids(questionsFor([zero], undefined, 0)), ["zero"]);
  });
  await t.test("a child with no DOB still gets every NON-gated question", () => {
    const plain = q({ id: "plain" });
    assert.deepEqual(ids(questionsFor([plain, gated], "L1", null)), ["plain"]);
  });
  await t.test("age gate and listing scope combine (both must pass)", () => {
    const both = q({ id: "both", minAge: 8, scope: ["L1"] });
    assert.deepEqual(ids(questionsFor([both], "L1", 9)), ["both"]);
    assert.deepEqual(ids(questionsFor([both], "L2", 9)), []);
    assert.deepEqual(ids(questionsFor([both], "L1", 5)), []);
  });
  await t.test("a child moves into the range on their birthday (age derived from DOB on the run date)", () => {
    // Born 2018-03-15: 7 the day before the 8th birthday, 8 on it.
    assert.equal(ageOn("2018-03-15", "2026-03-14"), 7);
    assert.equal(ageOn("2018-03-15", "2026-03-15"), 8);
    const g = q({ id: "g", minAge: 8 });
    assert.equal(questionsFor([g], undefined, ageOn("2018-03-15", "2026-03-14")).length, 0);
    assert.equal(questionsFor([g], undefined, ageOn("2018-03-15", "2026-03-15")).length, 1);
  });
  await t.test("ageOn: no DOB / junk DOB gives null, not NaN or 0", () => {
    assert.equal(ageOn(undefined, "2026-10-03"), null);
    assert.equal(ageOn("", "2026-10-03"), null);
    assert.equal(ageOn("banana", "2026-10-03"), null);
    assert.equal(ageOn("2018-03-15", ""), null);
  });
  await t.test("ageOn: 29 Feb birthday turns a year older on 1 Mar in a non-leap year", () => {
    assert.equal(ageOn("2016-02-29", "2026-02-28"), 9);
    assert.equal(ageOn("2016-02-29", "2026-03-01"), 10);
  });
});

test("CF-010: ask once vs ask on every booking", async (t) => {
  const once = q({ id: "diet", ask: "once" });
  const dflt = q({ id: "swim" });
  const every = q({ id: "injury", ask: "every" });
  await t.test("default (unset) is 'once'; only ask='every' re-asks", () => {
    assert.equal(asksEveryBooking(once), false);
    assert.equal(asksEveryBooking(dflt), false);
    assert.equal(asksEveryBooking(every), true);
  });
  await t.test("the child form asks the once-questions; the roster re-asks only the every-booking ones, with no overlap", () => {
    const live = questionsFor([once, dflt, every], "L1", 9);
    const form = live.filter((x) => !asksEveryBooking(x));
    const roster = live.filter(asksEveryBooking);
    assert.deepEqual(ids(form), ["diet", "swim"]);
    assert.deepEqual(ids(roster), ["injury"]);
    assert.equal(form.length + roster.length, live.length);
  });
  await t.test("a REQUIRED every-booking question blocks until answered on each booking, ignoring answers from the form's set", () => {
    const req = q({ id: "injury", ask: "every", required: true });
    assert.deepEqual(ids(unansweredRequired([req], {})), ["injury"]);
    assert.deepEqual(unansweredRequired([req], { injury: "Sprained wrist" }), []);
  });
});

test("CF-011: yes/no question holds the booking when answered No", async (t) => {
  const hold = q({ id: "toilet", type: "yesno", reviewIfNo: true });
  const noHold = q({ id: "swim", type: "yesno" });
  await t.test("No (any case/space) holds; Yes and unanswered do not", () => {
    for (const a of ["No", "no", "NO", " no ", "nO"]) assert.equal(heldByNoAnswer(["toilet"], { toilet: a }), true, `"${a}"`);
    assert.equal(heldByNoAnswer(["toilet"], { toilet: "Yes" }), false);
    assert.equal(heldByNoAnswer(["toilet"], { toilet: "" }), false);
    assert.equal(heldByNoAnswer(["toilet"], {}), false);
  });
  await t.test("a child with no stored answers at all is not held", () => {
    assert.equal(heldByNoAnswer(["toilet"], undefined), false);
    assert.equal(heldByNoAnswer(["toilet"], null), false);
  });
  await t.test("no hold-if-No questions configured => never held", () => {
    assert.equal(heldByNoAnswer([], { toilet: "No" }), false);
  });
  await t.test("only questions flagged reviewIfNo count: a No on an ordinary yes/no does not hold", () => {
    assert.deepEqual(ids(heldForReview([hold, noHold], { toilet: "Yes", swim: "No" })), []);
    assert.deepEqual(ids(heldForReview([hold, noHold], { toilet: "No", swim: "No" })), ["toilet"]);
  });
  await t.test("a hidden hold question no longer holds bookings", () => {
    assert.deepEqual(ids(heldForReview([{ ...hold, hidden: true }], { toilet: "No" })), []);
  });
  await t.test("any ONE of several hold questions answered No holds the booking", () => {
    assert.equal(heldByNoAnswer(["a", "b"], { a: "Yes", b: "No" }), true);
    assert.equal(heldByNoAnswer(["a", "b"], { a: "Yes", b: "Yes" }), false);
  });
  await t.test("client heldForReview and the server rule agree on the same inputs", () => {
    const qs = [hold, noHold];
    const serverIds = qs.filter((x) => !x.hidden && x.reviewIfNo).map((x) => x.id);
    for (const answers of [{ toilet: "No" }, { toilet: "Yes" }, { toilet: " NO " }, { swim: "No" }, {}] as Record<string, string>[]) {
      assert.equal(heldForReview(qs, answers).length > 0, heldByNoAnswer(serverIds, answers), JSON.stringify(answers));
    }
  });
});

test("CF-014: toilet-training question drives the nappy badge", async (t) => {
  await t.test("the preset is a required yes/no, shown on the register, that holds on No", () => {
    assert.equal(TOILET_QUESTION.type, "yesno");
    assert.equal(TOILET_QUESTION.kind, "toilet");
    assert.equal(TOILET_QUESTION.required, true);
    assert.equal(TOILET_QUESTION.showOnRegister, true);
    assert.equal(TOILET_QUESTION.reviewIfNo, true);
  });
  await t.test("needsNappies is true only for an answer of No to the live toilet question", () => {
    const qs = [TOILET_QUESTION];
    assert.equal(needsNappies(qs, { [TOILET_QUESTION.id]: "No" }), true);
    assert.equal(needsNappies(qs, { [TOILET_QUESTION.id]: " no " }), true);
    assert.equal(needsNappies(qs, { [TOILET_QUESTION.id]: "Yes" }), false);
    assert.equal(needsNappies(qs, {}), false);
    assert.equal(needsNappies(qs, null), false);
  });
  await t.test("no toilet question (or a hidden one) => no nappy badge, even with a stray 'No'", () => {
    assert.equal(needsNappies([], { "q-toilet": "No" }), false);
    assert.equal(toiletQuestion([{ ...TOILET_QUESTION, hidden: true }]), undefined);
    assert.equal(needsNappies([{ ...TOILET_QUESTION, hidden: true }], { "q-toilet": "No" }), false);
  });
  await t.test("the badge keys on kind, not on the id, so a provider's renamed/relabelled question still works", () => {
    const custom = q({ id: "my-own-id", label: "Out of nappies yet?", type: "yesno", kind: "toilet" });
    assert.equal(toiletQuestion([q({ id: "other" }), custom]), custom);
    assert.equal(needsNappies([custom], { "my-own-id": "no" }), true);
  });
  await t.test("a No also holds the booking for approval (client + server rules)", () => {
    assert.equal(heldForReview([TOILET_QUESTION], { "q-toilet": "No" }).length, 1);
    assert.equal(heldByNoAnswer(["q-toilet"], { "q-toilet": "No" }), true);
  });
});

test("CF-015 / CF-009: Date of birth required vs optional", async (t) => {
  const settings = (requireDob: boolean) => withDefaults({ requireDob });
  await t.test("Required => required, nothing forcing it", () => {
    const r = dobRequired(settings(true), []);
    assert.equal(r.required, true);
    assert.deepEqual(r.forcedBy, []);
  });
  await t.test("Optional with no age-gated question => optional", () => {
    const r = dobRequired(settings(false), [q({ id: "a" }), q({ id: "b", required: true })]);
    assert.equal(r.required, false);
    assert.deepEqual(r.forcedBy, []);
  });
  await t.test("CF-009: an age-gated question locks DOB on even when the setting says optional", () => {
    const g = q({ id: "walk", minAge: 8 });
    const r = dobRequired(settings(false), [q({ id: "a" }), g]);
    assert.equal(r.required, true);
    assert.deepEqual(ids(r.forcedBy), ["walk"]);
  });
  await t.test("maxAge-only gate also forces it; minAge 0 counts as a gate", () => {
    assert.equal(dobRequired(settings(false), [q({ id: "m", maxAge: 5 })]).required, true);
    assert.equal(dobRequired(settings(false), [q({ id: "z", minAge: 0 })]).required, true);
  });
  await t.test("a HIDDEN age-gated question does not force DOB", () => {
    const r = dobRequired(settings(false), [q({ id: "walk", minAge: 8, hidden: true })]);
    assert.equal(r.required, false);
    assert.deepEqual(r.forcedBy, []);
  });
  await t.test("default settings require a date of birth", () => {
    assert.equal(DEFAULT_SETTINGS.requireDob, true);
    assert.equal(withDefaults(null).requireDob, true);
    assert.equal(withDefaults(undefined).requireDob, true);
  });
  await t.test("a library that stored requireDob:false keeps it through withDefaults", () => {
    assert.equal(withDefaults({ requireDob: false }).requireDob, false);
  });
});

test("CF-016: default consent questions (sun cream / first aid)", async (t) => {
  const byId = (id: string) => SEEDED_QUESTIONS.find((x) => x.id === id);
  await t.test("seeded with the exact wording from the catalogue, as yes/no", () => {
    assert.equal(byId("q-suncream")?.label, "May we apply sun cream?");
    assert.equal(byId("q-suncream")?.type, "yesno");
    assert.equal(byId("q-firstaid")?.label, "May we give first aid?");
    assert.equal(byId("q-firstaid")?.type, "yesno");
  });
  await t.test("they supersede the old typed consent columns (documentation key) and apply to all listings", () => {
    assert.equal(byId("q-suncream")?.replaces, "suncreamConsent");
    assert.equal(byId("q-firstaid")?.replaces, "firstAidConsent");
    assert.equal(byId("q-suncream")?.scope, "all");
  });
  await t.test("a No on a consent never holds a booking (only reviewIfNo questions do)", () => {
    assert.deepEqual(heldForReview(SEEDED_QUESTIONS, { "q-suncream": "No", "q-firstaid": "No" }), []);
  });
  await t.test("every seeded question is asked of every listing and child by default", () => {
    assert.deepEqual(ids(questionsFor(SEEDED_QUESTIONS, "any-listing", 9)).sort(), ids(SEEDED_QUESTIONS).sort());
    assert.deepEqual(ids(questionsFor(SEEDED_QUESTIONS, "any-listing", null)).sort(), ids(SEEDED_QUESTIONS).sort());
  });
  await t.test("consent answers ride on the child schema under `answers`, and the legacy boolean consents still validate", () => {
    const r = childSchema.safeParse({ name: "Ava", answers: { "q-suncream": "Yes", "q-firstaid": "No" }, suncreamConsent: true, firstAidConsent: false });
    assert.equal(r.success, true);
  });
});

test("CF-017: trip consent settings defaults (the consent endpoint itself needs Firestore, not covered)", async (t) => {
  await t.test("trips default to requiring consent, notifying parents", () => {
    assert.equal(DEFAULT_SETTINGS.trips?.requireConsent, true);
    assert.equal(DEFAULT_SETTINGS.trips?.notifyParent, true);
  });
  await t.test("withDefaults keeps a provider's trips.requireConsent:false", () => {
    assert.equal(withDefaults({ trips: { requireConsent: false } } as never).trips?.requireConsent, false);
  });
});

test("CF-002 / CF-004: character limits for built-in child fields", async (t) => {
  await t.test("limitFor uses the provider's tuned limit when set", () => {
    const s = withDefaults({ charLimits: { allergies: 50, medical: 140, dietary: 140, send: 200, likes: 80, dislikes: 80 } });
    assert.equal(limitFor(s, "allergies", CHILD_LIMITS), 50);
  });
  await t.test("untuned settings fall to the stored default (allergies 140, send 200, likes 80)", () => {
    const s = withDefaults(null);
    assert.equal(limitFor(s, "allergies", CHILD_LIMITS), 140);
    assert.equal(limitFor(s, "send", CHILD_LIMITS), 200);
    assert.equal(limitFor(s, "likes", CHILD_LIMITS), 80);
  });
  await t.test("fields with no setting (collection password, emergency name/phone) use the compiled-in defaults", () => {
    const s = withDefaults(null);
    assert.equal(limitFor(s, "collectionPassword", CHILD_LIMITS), 40);
    assert.equal(limitFor(s, "emergencyName", CHILD_LIMITS), 80);
    assert.equal(limitFor(s, "emergencyPhone", CHILD_LIMITS), 30);
  });
  await t.test("an unknown field never returns undefined: it gets the generic text length", () => {
    assert.equal(limitFor(withDefaults(null), "somethingNew", CHILD_LIMITS), DEFAULT_QUESTION_LENGTH);
  });
  await t.test("a partial charLimits object merges, not blanks the other limits", () => {
    const s = withDefaults({ charLimits: { allergies: 10 } as never });
    assert.equal(s.charLimits.allergies, 10);
    assert.equal(s.charLimits.medical, 140);
  });
  await t.test("a provider limit of 0 is honoured (?? not ||)", () => {
    const s = withDefaults({ charLimits: { allergies: 0 } as never });
    assert.equal(limitFor(s, "allergies", CHILD_LIMITS), 0);
  });
  await t.test("the checkout limits never exceed what the server will accept (else a parent sees a 400 after typing within the limit)", () => {
    const srv = { allergies: 300, medical: 300, send: 300, likes: 300, dislikes: 300, collectionPassword: 60, emergencyName: 80, emergencyPhone: 40 };
    for (const [k, v] of Object.entries(CHILD_LIMITS)) assert.ok(v <= srv[k as keyof typeof srv], `${k}: UI ${v} > server ${srv[k as keyof typeof srv]}`);
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS.charLimits)) assert.ok(v <= 300, `charLimits.${k}`);
  });
});

test("CF-001: server child schema (POST/PUT /api/my/children)", async (t) => {
  const ok = { name: "Ava James", dob: "2018-03-15" };
  await t.test("name is required: missing, empty and whitespace-only are rejected", () => {
    assert.deepEqual(issuePaths(childSchema.safeParse({})), ["name"]);
    assert.deepEqual(issuePaths(childSchema.safeParse({ name: "" })), ["name"]);
    assert.deepEqual(issuePaths(childSchema.safeParse({ name: "    " })), ["name"]);
  });
  await t.test("name is trimmed and capped at 80", () => {
    assert.equal(childSchema.parse({ name: "  Ava  " }).name, "Ava");
    assert.equal(childSchema.safeParse({ name: "a".repeat(80) }).success, true);
    assert.deepEqual(issuePaths(childSchema.safeParse({ name: "a".repeat(81) })), ["name"]);
  });
  await t.test("a valid minimal child passes and photoConsent defaults to false (privacy-safe)", () => {
    const r = childSchema.parse(ok);
    assert.equal(r.photoConsent, false);
    assert.equal(r.dob, "2018-03-15");
  });
  await t.test("DOB must be a real calendar day: 'banana', 2026-13-45, 2026-02-31, 15/03/2018 are rejected", () => {
    for (const dob of ["banana", "2026-13-45", "2026-02-31", "15/03/2018", "2018-3-5"]) {
      assert.deepEqual(issuePaths(childSchema.safeParse({ ...ok, dob })), ["dob"], dob);
    }
  });
  await t.test("DOB in the future is rejected; today and yesterday are accepted", () => {
    const today = ukToday();
    assert.deepEqual(issuePaths(childSchema.safeParse({ ...ok, dob: addDays(today, 1) })), ["dob"]);
    assert.deepEqual(issuePaths(childSchema.safeParse({ ...ok, dob: "2999-01-01" })), ["dob"]);
    assert.equal(childSchema.safeParse({ ...ok, dob: today }).success, true);
    assert.equal(childSchema.safeParse({ ...ok, dob: addDays(today, -1) }).success, true);
  });
  await t.test("a blank DOB is allowed through the schema (the 'clear it' signal on PUT); omitted is allowed too", () => {
    assert.equal(childSchema.safeParse({ ...ok, dob: "" }).success, true);
    assert.equal(childSchema.safeParse({ name: "Ava" }).success, true);
  });
  await t.test("DOB with surrounding spaces is trimmed before validation", () => {
    assert.equal(childSchema.parse({ ...ok, dob: " 2018-03-15 " }).dob, "2018-03-15");
  });
  await t.test("age is an integer 0..17", () => {
    assert.equal(childSchema.safeParse({ ...ok, age: 0 }).success, true);
    assert.equal(childSchema.safeParse({ ...ok, age: 17 }).success, true);
    for (const age of [-1, 18, 7.5]) assert.deepEqual(issuePaths(childSchema.safeParse({ ...ok, age })), ["age"], String(age));
  });
  await t.test("CF-004: collection password max 60, trimmed", () => {
    assert.equal(childSchema.parse({ ...ok, collectionPassword: "  blue tractor " }).collectionPassword, "blue tractor");
    assert.equal(childSchema.safeParse({ ...ok, collectionPassword: "p".repeat(60) }).success, true);
    assert.deepEqual(issuePaths(childSchema.safeParse({ ...ok, collectionPassword: "p".repeat(61) })), ["collectionPassword"]);
  });
  await t.test("emergency contact: name <= 80, phone <= 40", () => {
    assert.equal(childSchema.safeParse({ ...ok, emergencyName: "n".repeat(80), emergencyPhone: "0".repeat(40) }).success, true);
    assert.deepEqual(issuePaths(childSchema.safeParse({ ...ok, emergencyName: "n".repeat(81) })), ["emergencyName"]);
    assert.deepEqual(issuePaths(childSchema.safeParse({ ...ok, emergencyPhone: "0".repeat(41) })), ["emergencyPhone"]);
  });
  await t.test("CF-002: allergies / medical / send / dietary / likes / dislikes capped at 300; care notes at 500", () => {
    for (const f of ["allergies", "medical", "send", "dietary", "likes", "dislikes"]) {
      assert.equal(childSchema.safeParse({ ...ok, [f]: "x".repeat(300) }).success, true, f);
      assert.deepEqual(issuePaths(childSchema.safeParse({ ...ok, [f]: "x".repeat(301) })), [f], f);
    }
    assert.equal(childSchema.safeParse({ ...ok, careNotes: "x".repeat(500) }).success, true);
    assert.deepEqual(issuePaths(childSchema.safeParse({ ...ok, careNotes: "x".repeat(501) })), ["careNotes"]);
  });
  await t.test("swimming only accepts the four known levels", () => {
    for (const s of ["none", "weak", "confident", "strong"]) assert.equal(childSchema.safeParse({ ...ok, swimming: s }).success, true, s);
    assert.deepEqual(issuePaths(childSchema.safeParse({ ...ok, swimming: "olympic" })), ["swimming"]);
  });
  await t.test("answers: free-text strings keyed by question id (key <= 60, value <= 2000); non-strings rejected", () => {
    assert.equal(childSchema.safeParse({ ...ok, answers: { "q-1": "Yes", q2: "x".repeat(2000) } }).success, true);
    assert.equal(childSchema.safeParse({ ...ok, answers: { q2: "x".repeat(2001) } }).success, false);
    assert.equal(childSchema.safeParse({ ...ok, answers: { q: true } }).success, false);
    assert.equal(childSchema.safeParse({ ...ok, answers: { ["k".repeat(61)]: "x" } }).success, false);
  });
  await t.test("photo: raster data URLs only (SVG rejected), and capped at 150k chars", () => {
    assert.equal(childSchema.safeParse({ ...ok, photo: "data:image/jpeg;base64,AAAA" }).success, true);
    assert.equal(childSchema.safeParse({ ...ok, photo: "data:image/svg+xml;base64,AAAA" }).success, false);
    assert.equal(childSchema.safeParse({ ...ok, photo: "https://evil.example/x.png" }).success, false);
    assert.equal(childSchema.safeParse({ ...ok, photo: "data:image/png;base64," + "A".repeat(150_000) }).success, false);
  });
  await t.test("unknown fields (e.g. parentUid) are stripped, so a client cannot set ownership", () => {
    const r = childSchema.parse({ ...ok, parentUid: "someone-else", archived: true }) as Record<string, unknown>;
    assert.equal("parentUid" in r, false);
    assert.equal("archived" in r, false);
  });
});

test("tidyChildren: joined names and duplicates (CF-021)", async (t) => {
  await t.test("splitChildNames splits on comma, '&' and 'and'", () => {
    assert.deepEqual(splitChildNames("Bella James, Ava James"), ["Bella James", "Ava James"]);
    assert.deepEqual(splitChildNames("Bella & Ava"), ["Bella", "Ava"]);
    assert.deepEqual(splitChildNames("Bella and Ava and Mia"), ["Bella", "Ava", "Mia"]);
    assert.deepEqual(splitChildNames("Bella,Ava"), ["Bella", "Ava"]);
  });
  await t.test("splitChildNames: blank / null / undefined => []; a single name is left whole", () => {
    assert.deepEqual(splitChildNames(""), []);
    assert.deepEqual(splitChildNames(null), []);
    assert.deepEqual(splitChildNames(undefined), []);
    assert.deepEqual(splitChildNames("Ava James"), ["Ava James"]);
  });
  await t.test("'and' inside a name is not a separator (Alexander, Sandy, Anderson)", () => {
    assert.deepEqual(splitChildNames("Alexander Sandy"), ["Alexander Sandy"]);
    assert.deepEqual(splitChildNames("Anderson"), ["Anderson"]);
  });
  await t.test("a joined entry becomes separate children without the group's id/dob/age", () => {
    const out = tidyChildren([{ name: "Bella James, Ava James", childId: "c1", dob: "2018-01-01", age: 8 }]);
    assert.deepEqual(out.map((k) => k.name), ["Bella James", "Ava James"]);
    for (const k of out) { assert.equal(k.childId, undefined); assert.equal(k.dob, undefined); assert.equal(k.age, undefined); }
  });
  await t.test("idNames lets the part whose real name matches keep the joined entry's childId", () => {
    const out = tidyChildren([{ name: "Bella James, Ava James", childId: "c1" }], new Map([["c1", "ava james"]]));
    assert.equal(out.find((k) => k.name === "Ava James")?.childId, "c1");
    assert.equal(out.find((k) => k.name === "Bella James")?.childId, undefined);
  });
  await t.test("same childId twice => one entry, missing details filled from the later one", () => {
    const out = tidyChildren([{ name: "Ava", childId: "c1" }, { name: "Ava J", childId: "c1", dob: "2018-01-01" }]);
    assert.equal(out.length, 1);
    assert.equal(out[0].dob, "2018-01-01");
    assert.equal(out[0].name, "Ava");
  });
  await t.test("same name, case/space-insensitive, no ids => de-duped", () => {
    assert.equal(tidyChildren([{ name: "Ava  James" }, { name: "ava james" }, { name: " AVA JAMES " }]).length, 1);
  });
  await t.test("same name but DIFFERENT dobs (twins / namesakes) stay separate", () => {
    const out = tidyChildren([{ name: "Sam Lee", dob: "2016-05-05" }, { name: "Sam Lee", dob: "2018-09-09" }]);
    assert.equal(out.length, 2);
  });
  await t.test("same name where one has a dob and one doesn't => treated as the same child", () => {
    const out = tidyChildren([{ name: "Sam Lee" }, { name: "Sam Lee", dob: "2016-05-05" }]);
    assert.equal(out.length, 1);
    assert.equal(out[0].dob, "2016-05-05");
  });
  await t.test("two different childIds with the same name are NOT merged (ids win)", () => {
    assert.equal(tidyChildren([{ name: "Sam Lee", childId: "a" }, { name: "Sam Lee", childId: "b" }]).length, 2);
  });
  await t.test("a joined entry duplicating a whole entry collapses to one of each", () => {
    const out = tidyChildren([{ name: "Ava James", childId: "c1" }, { name: "Ava James, Bella James" }]);
    assert.deepEqual(out.map((k) => k.name).sort(), ["Ava James", "Bella James"]);
  });
  await t.test("empty-name entries, null and non-objects are dropped; null/undefined list => []", () => {
    assert.deepEqual(tidyChildren([{ name: "" }, { name: "   " }, {}, null as never, "x" as never]), []);
    assert.deepEqual(tidyChildren(null), []);
    assert.deepEqual(tidyChildren(undefined), []);
  });
  await t.test("tidying is idempotent", () => {
    const once = tidyChildren([{ name: "Bella, Ava" }, { name: "ava" }, { name: "Mia", childId: "m" }]);
    assert.deepEqual(tidyChildren(once), once);
  });
});
