import test from "node:test";
import assert from "node:assert/strict";
import { missingRequiredQuestions } from "../server/src/lib/requiredChildQuestions";

const qs = [
  { id: "a", label: "Can they swim?", required: true, scope: "all" as const },
  { id: "b", label: "Injuries?", required: true, ask: "every", scope: "all" as const },
  { id: "c", label: "Optional", scope: "all" as const },
  { id: "d", label: "Other camp only", required: true, scope: ["x"] },
  { id: "e", label: "Walk home (8+)", required: true, scope: "all" as const, minAge: 8 },
];
const base = { questions: qs, listingId: "L1", runFrom: "2026-11-02", saved: true };

test("lists each unanswered required question that applies", () => {
  assert.deepEqual(missingRequiredQuestions({ ...base, dob: "2020-01-01", answers: {} }), ["Can they swim?", "Injuries?"]);
});
test("answered, scoped-out, optional and age-gated are skipped", () => {
  assert.deepEqual(missingRequiredQuestions({ ...base, dob: "2020-01-01", answers: { a: "yes", b: "no" } }), []);
  assert.deepEqual(missingRequiredQuestions({ ...base, dob: "2015-01-01", answers: { a: "y", b: "n" } }), ["Walk home (8+)"]);
});
test("unsaved child: only every-booking questions are checkable", () => {
  assert.deepEqual(missingRequiredQuestions({ ...base, saved: false, answers: {} }), ["Injuries?"]);
});
