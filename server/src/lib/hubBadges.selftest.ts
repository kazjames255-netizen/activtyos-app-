// Run: server/node_modules/.bin/tsx server/src/lib/hubBadges.selftest.ts
import { BADGE_IDS, bestStreak, computeBadges, type BadgeAttempt, type BadgeInput } from "./hubBadges";
let n = 0, bad = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { bad++; console.error("FAIL:", m); } };
const DAY = 86_400_000;
const t0 = Date.parse("2026-09-01T10:00:00Z");
const at = (d: number) => new Date(t0 + d * DAY).toISOString();
const att = (assessmentId: string, day: number, score: number, max = 10, status = "marked", type = "quiz"): BadgeAttempt => ({ assessmentId, type, status, scoreMarks: score, maxMarks: max, submittedAt: at(day) });
const base = (): BadgeInput => ({ now: t0 + 30 * DAY, attempts: [], handIns: [], cardsReviewed: 0, reviewedAt: [] });
const get = (i: BadgeInput, id: string) => computeBadges(i).find((b) => b.id === id)!;

// every badge is always listed once, in a stable order
ok(computeBadges(base()).map((b) => b.id).join() === BADGE_IDS.join(), "all badges listed in order");
ok(computeBadges(base()).every((b) => !b.earned), "a brand-new child has none");

// first quiz: any finished quiz; a diagnostic (entry test) or an unfinished one does not count
ok(!get({ ...base(), attempts: [att("q", 1, 5, 10, "in_progress")] }, "first_quiz").earned, "in progress is not a quiz taken");
ok(!get({ ...base(), attempts: [att("q", 1, 5, 10, "marked", "diagnostic")] }, "first_quiz").earned, "an entry test is not a quiz");
ok(get({ ...base(), attempts: [att("q", 1, 5, 10, "pending_marking")] }, "first_quiz").earned, "a handed-in quiz counts even before marking");

// streaks: best run ever, quizzes and flashcards both count
ok(bestStreak([]) === 0, "no activity → 0");
ok(bestStreak([t0, t0 + 1000]) === 1, "two events on one day → 1");
ok(bestStreak([t0, t0 + DAY, t0 + 2 * DAY]) === 3, "three days in a row → 3");
ok(bestStreak([t0, t0 + 2 * DAY, t0 + 3 * DAY]) === 2, "a gap breaks the run");
const s3 = { ...base(), attempts: [att("q", 0, 5), att("q", 1, 5)], reviewedAt: [t0 + 2 * DAY] };
ok(get(s3, "streak3").earned && !get(s3, "streak7").earned, "3 mixed days earn 3-day, not 7-day");
ok(get(s3, "streak7").have === 3 && get(s3, "streak7").need === 7, "progress shows 3 of 7");
ok(get({ ...base(), reviewedAt: Array.from({ length: 7 }, (_, d) => t0 + d * DAY) }, "streak7").earned, "7 days of flashcards earn the 7-day streak");
ok(get({ ...s3, attempts: [att("q", 0, 5), att("q", 5, 5), att("q", 6, 5)], reviewedAt: [] }, "streak3").earned === false, "a streak must be consecutive");

// homework hero: five on time
const hw = (late: boolean, status = "submitted") => ({ status, submittedAt: at(late ? 3 : 1), dueAt: at(2) });
ok(!get({ ...base(), handIns: [hw(false), hw(false), hw(false), hw(false), hw(true)] }, "homework5").earned, "a late one does not count");
ok(get({ ...base(), handIns: [hw(false), hw(false), hw(false), hw(false), hw(false, "marked")] }, "homework5").earned, "five on time (submitted or marked) earn it");
ok(get({ ...base(), handIns: [hw(false), hw(false)] }, "homework5").have === 2, "progress 2 of 5");
ok(!get({ ...base(), handIns: Array.from({ length: 5 }, () => ({ status: "assigned", submittedAt: null, dueAt: at(2) })) }, "homework5").earned, "assigned-but-not-handed-in never counts");

// flashcard fan
ok(!get({ ...base(), cardsReviewed: 49 }, "cards50").earned && get({ ...base(), cardsReviewed: 50 }, "cards50").earned, "50 cards is the line");
ok(get({ ...base(), cardsReviewed: 20 }, "cards50").have === 20, "progress counts cards");

// perfect score: full marks on a MARKED quiz
ok(get({ ...base(), attempts: [att("q", 1, 10)] }, "perfect").earned, "10/10 marked → perfect");
ok(!get({ ...base(), attempts: [att("q", 1, 9)] }, "perfect").earned, "9/10 is not");
ok(!get({ ...base(), attempts: [att("q", 1, 10, 10, "pending_marking")] }, "perfect").earned, "unmarked is not yet perfect");
ok(!get({ ...base(), attempts: [att("q", 1, 0, 0)] }, "perfect").earned, "a 0-mark quiz can't be perfect");

// comeback: a later attempt at the same quiz ≥ 20 points better than an earlier one
ok(get({ ...base(), attempts: [att("q", 1, 3), att("q", 4, 6)] }, "comeback").earned, "30 → 60 is a comeback (+30)");
ok(!get({ ...base(), attempts: [att("q", 1, 5), att("q", 4, 6)] }, "comeback").earned, "+10 is not enough");
ok(!get({ ...base(), attempts: [att("a", 1, 2), att("b", 4, 9)] }, "comeback").earned, "different quizzes don't count");
ok(!get({ ...base(), attempts: [att("q", 1, 9), att("q", 4, 3)] }, "comeback").earned, "getting worse is not a comeback");
ok(get({ ...base(), attempts: [att("q", 6, 8), att("q", 1, 2)] }, "comeback").earned, "order comes from dates, not array order");
ok(get({ ...base(), attempts: [att("q", 1, 4), att("q", 2, 3), att("q", 5, 6)] }, "comeback").earned, "best lift over the lowest earlier score");

// idempotent
const i1 = { ...base(), attempts: [att("q", 1, 3), att("q", 4, 6)], cardsReviewed: 10 };
ok(JSON.stringify(computeBadges(i1)) === JSON.stringify(computeBadges(i1)), "same input → same answer");

console.log(bad ? `hubBadges selftest: ${bad} FAILED of ${n}` : `hubBadges selftest OK (${n} checks)`);
process.exit(bad ? 1 : 0);
