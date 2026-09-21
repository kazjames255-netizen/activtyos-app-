// Self-test for the Learning Hub round-3 pure rules: UK year group from a dob, audience
// eligibility, the retake decision, YouTube parsing, overall attainment maths, editable
// settings validation and the auto/written split. No Firestore, no network:
//   cd server && npx tsx src/hubSelfTest3.ts
import assert from "node:assert/strict";
import {
  ageInYears, audienceFit, audienceKey, cleanVideos, effectiveRetake, effectiveYearGroup, failStreak, normAudience, overallAttainment, parseYouTube, retakeDecision,
  ukYearGroup, validateHubPatch, videoOut, videosOut, yearGroupFromDob,
} from "./lib/hubRules";
import { autoSplit } from "./lib/hubScoring";
import { HUB_DEFAULTS } from "../../lib/hubConfig";
import { capForApi } from "../../lib/accessMap";

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log(`  ok  ${name}`); };
const D = (s: string) => new Date(`${s}T12:00:00`); // a local noon, so the tests don't depend on the machine's timezone

console.log("year group from dob (UK: age on 31 Aug)");
t("Reception / Year 1 boundaries in autumn 2026 (academic year 2026/27)", () => {
  // Age 4 on 31 Aug 2026 → Reception: born 1 Sep 2021 .. 31 Aug 2022.
  assert.equal(ukYearGroup("2021-09-01", D("2026-10-01")), "Reception");
  assert.equal(ukYearGroup("2022-08-31", D("2026-10-01")), "Reception");
  assert.equal(ukYearGroup("2021-08-31", D("2026-10-01")), "Year 1");
  assert.equal(ukYearGroup("2020-09-01", D("2026-10-01")), "Year 1");
  assert.equal(ukYearGroup("2020-08-31", D("2026-10-01")), "Year 2");
});
t("the same child moves up a year each 1 September, not on their birthday", () => {
  assert.equal(ukYearGroup("2016-03-14", D("2026-08-31")), "Year 5"); // still 2025/26
  assert.equal(ukYearGroup("2016-03-14", D("2026-09-01")), "Year 6"); // 2026/27 starts
  assert.equal(ukYearGroup("2016-03-14", D("2027-03-13")), "Year 6"); // birthday changes nothing
});
t("Year 6 (10-11) and Year 13 (17-18) and out-of-range", () => {
  assert.equal(ukYearGroup("2015-09-01", D("2026-10-01")), "Year 6");
  assert.equal(ukYearGroup("2009-09-01", D("2026-10-01")), "Year 12");
  assert.equal(ukYearGroup("2008-09-01", D("2026-10-01")), "Year 13");
  assert.equal(ukYearGroup("2007-08-31", D("2026-10-01")), null, "past Year 13");
  assert.equal(ukYearGroup("2023-01-01", D("2026-10-01")), null, "nursery age");
});
t("dob formats: ISO date, day-month-year text, garbage", () => {
  assert.equal(ukYearGroup("14 Mar 2016", D("2026-10-01")), "Year 6");
  assert.equal(ukYearGroup("not a date", D("2026-10-01")), null);
  assert.equal(ukYearGroup("", D("2026-10-01")), null);
  assert.equal(ukYearGroup(undefined, D("2026-10-01")), null);
});
t("only when the tenant's list has that label (case-insensitive, tenant's spelling)", () => {
  assert.equal(yearGroupFromDob("2016-03-14", ["Year 6", "Year 7"], D("2026-10-01")), "Year 6");
  assert.equal(yearGroupFromDob("2016-03-14", ["year 6"], D("2026-10-01")), "year 6");
  assert.equal(yearGroupFromDob("2016-03-14", ["Grade 1", "Grade 2"], D("2026-10-01")), null);
});
t("age in whole years", () => {
  assert.equal(ageInYears("2016-03-14", D("2026-03-13")), 9);
  assert.equal(ageInYears("2016-03-14", D("2026-03-14")), 10);
  assert.equal(ageInYears("2030-01-01", D("2026-03-14")), null, "future dob");
  assert.equal(ageInYears(null), null);
});
t("effectiveYearGroup: auto follows the dob; tagged wins; null = unknown; legacy derives", () => {
  const list = HUB_DEFAULTS.yearGroups;
  assert.equal(effectiveYearGroup({ yearGroup: "Year 3", yearGroupAuto: true }, "2016-03-14", list, D("2026-10-01")), "Year 6");
  assert.equal(effectiveYearGroup({ yearGroup: "Year 3", yearGroupAuto: false }, "2016-03-14", list, D("2026-10-01")), "Year 3");
  assert.equal(effectiveYearGroup({ yearGroup: null, yearGroupAuto: false }, "2016-03-14", list, D("2026-10-01")), null);
  assert.equal(effectiveYearGroup({}, "2016-03-14", list, D("2026-10-01")), "Year 6");
  assert.equal(effectiveYearGroup({ yearGroupAuto: true }, null, list), null, "no dob → unknown");
});

console.log("audience eligibility");
const yr = (...g: string[]) => normAudience({ yearGroups: g });
t("no audience = everyone", () => {
  assert.equal(audienceFit(normAudience(undefined), { yearGroup: null, age: null }), "yes");
  assert.equal(audienceFit(normAudience({ yearGroups: [], ageMin: null, ageMax: null }), { yearGroup: "Year 1", age: 5 }), "yes");
});
t("year groups: must be in the list (case-insensitive); unknown never excludes", () => {
  assert.equal(audienceFit(yr("Year 3", "Year 4"), { yearGroup: "year 4", age: null }), "yes");
  assert.equal(audienceFit(yr("Year 3", "Year 4"), { yearGroup: "Year 5", age: 9 }), "no");
  assert.equal(audienceFit(yr("Year 3", "Year 4"), { yearGroup: null, age: 9 }), "unknown");
});
t("age range is inclusive; unknown age is unknown", () => {
  const a = normAudience({ ageMin: 7, ageMax: 9 });
  assert.equal(audienceFit(a, { yearGroup: null, age: 7 }), "yes");
  assert.equal(audienceFit(a, { yearGroup: null, age: 9 }), "yes");
  assert.equal(audienceFit(a, { yearGroup: null, age: 10 }), "no");
  assert.equal(audienceFit(a, { yearGroup: null, age: 6 }), "no");
  assert.equal(audienceFit(a, { yearGroup: null, age: null }), "unknown");
  assert.equal(audienceFit(normAudience({ ageMin: 7 }), { yearGroup: null, age: 15 }), "yes", "open-ended");
});
t("both set: both must fit; a definite miss beats an unknown", () => {
  const a = normAudience({ yearGroups: ["Year 4"], ageMin: 8, ageMax: 9 });
  assert.equal(audienceFit(a, { yearGroup: "Year 4", age: 8 }), "yes");
  assert.equal(audienceFit(a, { yearGroup: "Year 4", age: 12 }), "no");
  assert.equal(audienceFit(a, { yearGroup: null, age: 12 }), "no", "age already rules them out");
  assert.equal(audienceFit(a, { yearGroup: "Year 4", age: null }), "unknown");
  assert.equal(audienceFit(a, { yearGroup: null, age: null }), "unknown");
});
t("normAudience tolerates junk; audienceKey ignores order and case (one diagnostic per audience)", () => {
  assert.deepEqual(normAudience({ yearGroups: ["Year 3", "year 3", " ", 5], ageMin: "x", ageMax: 300 }), { yearGroups: ["Year 3"], ageMin: null, ageMax: 25 });
  assert.equal(audienceKey(yr("Year 3", "Year 4")), audienceKey(yr("year 4", "YEAR 3")));
  assert.notEqual(audienceKey(yr("Year 3", "Year 4")), audienceKey(yr("Year 5", "Year 6")));
  assert.notEqual(audienceKey(normAudience({ ageMin: 7, ageMax: 9 })), audienceKey(normAudience({ ageMin: 7, ageMax: 10 })));
  assert.equal(audienceKey(normAudience(undefined)), audienceKey(normAudience({})));
});

console.log("retake decision");
const HOUR = 3_600_000;
const now = Date.parse("2026-09-19T12:00:00Z");
t("never attempted / unlimited / granted are always allowed", () => {
  assert.equal(retakeDecision({ policy: "once", cooldownHours: 24, finishedAt: [], granted: false, now }).allowed, true);
  assert.equal(retakeDecision({ policy: "unlimited", cooldownHours: 24, finishedAt: ["2026-09-19T11:59:00Z"], granted: false, now }).allowed, true);
  assert.equal(retakeDecision({ policy: "once", cooldownHours: 24, finishedAt: ["2026-09-01T00:00:00Z"], granted: true, now }).allowed, true);
});
t("once: blocked after one finished attempt, no next date", () => {
  assert.deepEqual(retakeDecision({ policy: "once", cooldownHours: 24, finishedAt: ["2026-09-01T00:00:00Z"], granted: false, now }), { allowed: false, reason: "once", nextAvailableAt: null });
});
t("cooldown: blocked until the LAST finish + hours, then allowed", () => {
  const last = new Date(now - 5 * HOUR).toISOString();
  const r = retakeDecision({ policy: "cooldown", cooldownHours: 24, finishedAt: ["2026-09-01T00:00:00Z", last], granted: false, now });
  assert.equal(r.allowed, false);
  assert.equal(r.reason, "cooldown");
  assert.equal(r.nextAvailableAt, new Date(now + 19 * HOUR).toISOString());
  assert.equal(retakeDecision({ policy: "cooldown", cooldownHours: 24, finishedAt: [new Date(now - 25 * HOUR).toISOString()], granted: false, now }).allowed, true);
  assert.equal(retakeDecision({ policy: "cooldown", cooldownHours: 24, finishedAt: [new Date(now - 24 * HOUR).toISOString()], granted: false, now }).allowed, true, "exactly at the boundary");
});
t("unlimited retakes: a short break after N not-passed tries in a row (and only then)", () => {
  const now = Date.parse("2026-09-20T12:00:00Z"), MIN = 60_000;
  const at = (m: number) => new Date(now - m * MIN).toISOString();
  const mk = (rows: { status: string; pct: number | null; m: number }[]) => failStreak(rows.map((r) => ({ status: r.status, pct: r.pct, passMarkPct: 70, submittedAt: at(r.m) })));
  const fails = mk([{ status: "marked", pct: 40, m: 50 }, { status: "marked", pct: 50, m: 20 }, { status: "marked", pct: 60, m: 5 }]);
  assert.deepEqual({ count: fails.count, lastAt: fails.lastAt }, { count: 3, lastAt: at(5) });
  const args = { policy: "unlimited" as const, cooldownHours: 24, granted: false, now, breakAfter: 3, breakMinutes: 30 };
  const held = retakeDecision({ ...args, finishedAt: [at(50), at(20), at(5)], streak: fails });
  assert.equal(held.allowed, false); assert.equal(held.reason, "break"); assert.equal(held.nextAvailableAt, new Date(now - 5 * MIN + 30 * MIN).toISOString());
  assert.equal(retakeDecision({ ...args, finishedAt: [at(50), at(40), at(20)], streak: mk([{ status: "marked", pct: 40, m: 50 }, { status: "marked", pct: 50, m: 40 }, { status: "marked", pct: 60, m: 20 }]) }).allowed, false, "still inside the break window");
  assert.equal(retakeDecision({ ...args, finishedAt: [at(90), at(80), at(70)], streak: mk([{ status: "marked", pct: 40, m: 90 }, { status: "marked", pct: 50, m: 80 }, { status: "marked", pct: 60, m: 70 }]) }).allowed, true, "the break is over");
  assert.equal(retakeDecision({ ...args, finishedAt: [at(50), at(20), at(5)], streak: fails, granted: true }).allowed, true, "a tutor grant skips it");
  assert.equal(retakeDecision({ ...args, breakAfter: 0, finishedAt: [at(5)], streak: fails }).allowed, true, "0 = off");
  assert.equal(mk([{ status: "marked", pct: 40, m: 50 }, { status: "marked", pct: 90, m: 20 }, { status: "marked", pct: 60, m: 5 }]).count, 1, "a pass ends the streak");
  assert.equal(mk([{ status: "marked", pct: 40, m: 50 }, { status: "pending_marking", pct: null, m: 20 }]).count, 0, "a paper still with the tutor is not counted as failed");
  assert.equal(retakeDecision({ ...args, policy: "once", finishedAt: [at(5)], streak: fails }).reason, "once", "the stricter policies are untouched");
});
t("assessment override beats the tutor default; 'inherit' / unset use it", () => {
  const cfg = { retakePolicy: "once" as const, retakeCooldownHours: 12 };
  assert.deepEqual(effectiveRetake({}, cfg), { policy: "once", cooldownHours: 12 });
  assert.deepEqual(effectiveRetake({ retakePolicy: "inherit" }, cfg), { policy: "once", cooldownHours: 12 });
  assert.deepEqual(effectiveRetake({ retakePolicy: "unlimited" }, cfg), { policy: "unlimited", cooldownHours: 12 });
  assert.deepEqual(effectiveRetake({ retakePolicy: "cooldown", retakeCooldownHours: 48 }, cfg), { policy: "cooldown", cooldownHours: 48 });
  assert.deepEqual(effectiveRetake({ retakePolicy: "cooldown", retakeCooldownHours: null }, cfg), { policy: "cooldown", cooldownHours: 12 });
});

console.log("YouTube");
const ID = "dQw4w9WgXcQ";
t("accepted link shapes → the 11-char id", () => {
  for (const u of [
    `https://www.youtube.com/watch?v=${ID}`, `https://youtube.com/watch?v=${ID}&list=PL1`, `http://m.youtube.com/watch?v=${ID}`, `https://youtu.be/${ID}`, `https://youtu.be/${ID}?si=abc`,
    `https://www.youtube.com/shorts/${ID}`, `https://www.youtube.com/embed/${ID}`, `https://www.youtube-nocookie.com/embed/${ID}`, `youtube.com/watch?v=${ID}`, `  https://youtu.be/${ID}  `,
  ]) assert.equal(parseYouTube(u)?.id, ID, u);
});
t("everything else is refused", () => {
  for (const u of [
    "", "hello", `https://vimeo.com/${ID}`, `https://evil.com/watch?v=${ID}`, `https://youtube.com.evil.com/watch?v=${ID}`, `https://evilyoutube.com/watch?v=${ID}`,
    `https://www.youtube.com/watch?v=short`, `https://www.youtube.com/watch?v=${ID}xx`, `https://www.youtube.com/watch`, `https://www.youtube.com/playlist?list=PL${ID}`,
    `https://www.youtube.com/channel/${ID}`, `https://www.youtube.com/@${ID}`, `https://youtu.be/`, `https://youtu.be/${ID}/extra`, `https://user:pw@youtube.com/watch?v=${ID}`,
    `https://www.youtube.com:8443/watch?v=${ID}`, `javascript:alert(1)//youtube.com/watch?v=${ID}`, `data:text/html,https://youtu.be/${ID}`, `ftp://youtu.be/${ID}`,
    `https://www.youtube.com/watch?v=${ID}"><script>`, `https://youtu.be/<script>alert(1)</script>`, `https://www.youtube-nocookie.com/watch?v=${ID}`,
  ]) assert.equal(parseYouTube(u), null, u);
  assert.equal(parseYouTube(123), null);
  assert.equal(parseYouTube(null), null);
});
t("start time from the link (t= / start=) or the body; the body wins", () => {
  assert.equal(parseYouTube(`https://youtu.be/${ID}?t=90`)?.start, 90);
  assert.equal(parseYouTube(`https://www.youtube.com/watch?v=${ID}&t=45s`)?.start, 45);
  assert.equal(parseYouTube(`https://youtu.be/${ID}?t=1m30s`)?.start, null, "only plain seconds");
  assert.deepEqual(cleanVideos([{ url: `https://youtu.be/${ID}?t=90`, start: 10, title: " Intro " }]), [{ id: ID, title: "Intro", start: 10 }]);
  assert.deepEqual(cleanVideos([{ url: `https://youtu.be/${ID}?t=90` }]), [{ id: ID, title: "", start: 90 }]);
});
t("cleanVideos: max 6; one bad link rejects the lot with a message", () => {
  const ok = { url: `https://youtu.be/${ID}` };
  assert.equal((cleanVideos(Array(6).fill(ok)) as unknown[]).length, 6);
  assert.equal(typeof cleanVideos(Array(7).fill(ok)), "string");
  assert.equal(typeof cleanVideos([ok, { url: "https://vimeo.com/1" }]), "string");
  assert.deepEqual(cleanVideos(undefined), []);
});
t("output: canonical watch url + nocookie embed; only well-formed ids leave the server", () => {
  assert.deepEqual(videoOut({ id: ID, title: "T", start: null }), { id: ID, title: "T", start: null, url: `https://www.youtube.com/watch?v=${ID}`, embedUrl: `https://www.youtube-nocookie.com/embed/${ID}` });
  assert.equal(videoOut({ id: ID, title: "", start: 90 }).embedUrl, `https://www.youtube-nocookie.com/embed/${ID}?start=90`);
  assert.equal(videosOut([{ id: "bad id!", title: "", start: null }, { id: ID, title: "", start: null }]).length, 1);
});

console.log("overall attainment");
const B3 = HUB_DEFAULTS.masteryBands; // Learning 0 / Developing 50 / Secure 80
t("mean of attempted subjects → band, index, next band and distance", () => {
  const o = overallAttainment([60, 70, null], B3)!;
  assert.deepEqual(o, { masteryPct: 65, band: "Developing", bandIndex: 1, bandCount: 3, next: { label: "Secure", min: 80 }, toNext: 15, subjectsCounted: 2 });
});
t("bottom, boundaries and top band", () => {
  assert.equal(overallAttainment([10], B3)!.band, "Learning");
  assert.equal(overallAttainment([10], B3)!.bandIndex, 0);
  assert.equal(overallAttainment([50], B3)!.band, "Developing");
  assert.equal(overallAttainment([49], B3)!.band, "Learning");
  const top = overallAttainment([95], B3)!;
  assert.deepEqual([top.band, top.bandIndex, top.next, top.toNext], ["Secure", 2, null, null]);
});
t("nothing attempted → null; unsorted bands are sorted; custom band sets work", () => {
  assert.equal(overallAttainment([null, null], B3), null);
  assert.equal(overallAttainment([], B3), null);
  const five = [{ min: 80, label: "E" }, { min: 0, label: "A" }, { min: 20, label: "B" }, { min: 40, label: "C" }, { min: 60, label: "D" }];
  const o = overallAttainment([44, 46], five)!;
  assert.deepEqual([o.band, o.bandIndex, o.bandCount, o.toNext], ["C", 2, 5, 15]);
});
t("rounds the mean (like every other mastery figure)", () => {
  assert.equal(overallAttainment([50, 51], B3)!.masteryPct, 51); // 50.5 → 51
});

console.log("PUT /config validation");
const ok = (h: unknown) => { const r = validateHubPatch(h); assert.equal(r.ok, true, JSON.stringify(r)); return (r as { ok: true; patch: Record<string, unknown> }).patch; };
const bad = (h: unknown, re?: RegExp) => { const r = validateHubPatch(h); assert.equal(r.ok, false, JSON.stringify(h)); if (re) assert.match((r as { ok: false; error: string }).error, re); };
t("bands: 2–8, first 0, strictly ascending, unique 1–24-char labels", () => {
  ok({ masteryBands: [{ min: 0, label: "Working towards" }, { min: 60, label: "Expected" }] });
  ok({ masteryBands: Array.from({ length: 8 }, (_, i) => ({ min: i * 10, label: `L${i}` })) });
  bad({ masteryBands: [{ min: 0, label: "Only" }] }, /between 2 and 8/);
  bad({ masteryBands: Array.from({ length: 9 }, (_, i) => ({ min: i * 10, label: `L${i}` })) }, /between 2 and 8/);
  bad({ masteryBands: [{ min: 10, label: "A" }, { min: 50, label: "B" }] }, /start at 0/);
  bad({ masteryBands: [{ min: 0, label: "A" }, { min: 50, label: "B" }, { min: 50, label: "C" }] }, /go up/);
  bad({ masteryBands: [{ min: 0, label: "A" }, { min: 60, label: "B" }, { min: 40, label: "C" }] }, /go up/);
  bad({ masteryBands: [{ min: 0, label: "A" }, { min: 101, label: "B" }] });
  bad({ masteryBands: [{ min: 0, label: "A" }, { min: 50.5, label: "B" }] });
  bad({ masteryBands: [{ min: 0, label: "" }, { min: 50, label: "B" }] });
  bad({ masteryBands: [{ min: 0, label: "x".repeat(25) }, { min: 50, label: "B" }] });
  bad({ masteryBands: [{ min: 0, label: "Same" }, { min: 50, label: "same" }] }, /different name/);
  assert.equal((ok({ masteryBands: [{ min: 0, label: "  Getting   there " }, { min: 50, label: "B" }] }).masteryBands as { label: string }[])[0].label, "Getting there");
});
t("pass mark, cooldown hours, policy, reveal, due days", () => {
  ok({ passMarkPct: 0 }); ok({ passMarkPct: 100 }); bad({ passMarkPct: 101 }); bad({ passMarkPct: -1 }); bad({ passMarkPct: 70.5 }); bad({ passMarkPct: "70" });
  ok({ retakeCooldownHours: 1 }); ok({ retakeCooldownHours: 720 }); bad({ retakeCooldownHours: 0 }); bad({ retakeCooldownHours: 721 });
  ok({ retakePolicy: "once" }); bad({ retakePolicy: "twice" });
  ok({ revealAnswers: "never" }); bad({ revealAnswers: "always" });
  ok({ homeworkDueDays: 14 }); bad({ homeworkDueDays: 0 });
  ok({ requireDiagnostic: true }); bad({ requireDiagnostic: "yes" });
});
t("year groups: ≤30 labels ≤24 chars, de-duplicated", () => {
  assert.deepEqual(ok({ yearGroups: ["Grade 1", "grade 1", "Grade 2"] }).yearGroups, ["Grade 1", "Grade 2"]);
  ok({ yearGroups: Array.from({ length: 30 }, (_, i) => `G${i}`) });
  bad({ yearGroups: Array.from({ length: 31 }, (_, i) => `G${i}`) }, /between 1 and 30/);
  bad({ yearGroups: ["x".repeat(25)] }); bad({ yearGroups: [] }); bad({ yearGroups: [""] }); bad({ yearGroups: [5] });
});
t("unknown keys, question types, empty and non-object bodies are refused", () => {
  bad({ questionKinds: [] }, /Setup/); bad({ evil: 1 }); bad({}, /Nothing/); bad(null); bad([]); bad("x");
  assert.deepEqual(Object.keys(ok({ passMarkPct: 60, retakePolicy: "cooldown", retakeCooldownHours: 12 })).sort(), ["passMarkPct", "retakeCooldownHours", "retakePolicy"]);
});

console.log("staff permission mapping");
t("PUT /config, groups and allow-retake need Learning Hub EDIT for staff; reading needs View", () => {
  for (const [path, method] of [["/api/learning-hub/config", "PUT"], ["/api/learning-hub/groups", "POST"], ["/api/learning-hub/groups/x", "PUT"], ["/api/learning-hub/groups/x", "DELETE"], ["/api/learning-hub/assessments/x/allow-retake", "POST"]] as const) {
    assert.deepEqual(capForApi(path, method), { area: "learninghub", need: "edit" }, `${method} ${path}`);
  }
  for (const path of ["/api/learning-hub/config", "/api/learning-hub/groups"]) assert.deepEqual(capForApi(path, "GET"), { area: "learninghub", need: "view" }, path);
});

console.log("auto / written split");
t("self-marked score is separate from the written part still waiting", () => {
  const rules = new Map<string, "choice" | "manual" | "exact">([["a", "choice"], ["b", "exact"], ["w", "manual"]]);
  const s = autoSplit([
    { questionId: "a", marksAwarded: 2, marksMax: 2, pending: false },
    { questionId: "b", marksAwarded: 0, marksMax: 2, pending: false },
    { questionId: "w", marksAwarded: 0, marksMax: 4, pending: true },
  ], rules);
  assert.deepEqual(s, { autoMarks: 2, autoMax: 4, writtenPending: 1, awaitingWritten: true });
});
t("once the tutor has marked the written answer nothing is pending; a blank written answer never waits", () => {
  const rules = new Map<string, "choice" | "manual">([["a", "choice"], ["w", "manual"], ["w2", "manual"]]);
  const s = autoSplit([
    { questionId: "a", marksAwarded: 1, marksMax: 1, pending: false },
    { questionId: "w", marksAwarded: 3, marksMax: 4, pending: false },
    { questionId: "w2", marksAwarded: 0, marksMax: 4, pending: false },
  ], rules);
  assert.deepEqual(s, { autoMarks: 1, autoMax: 1, writtenPending: 0, awaitingWritten: false });
});
t("an all-written paper has autoMax 0", () => {
  const s = autoSplit([{ questionId: "w", marksAwarded: 0, marksMax: 4, pending: true }], new Map([["w", "manual" as const]]));
  assert.deepEqual(s, { autoMarks: 0, autoMax: 0, writtenPending: 1, awaitingWritten: true });
});

console.log(`\n${n} groups passed`);
