// Run: server/node_modules/.bin/tsx server/src/lib/hubDigest.selftest.ts
// No Firestore, no network, no mail: the parent digest / homework nudge rules with an in-memory sent-log and a counting sender.
import { mergeHub } from "../../../lib/hubConfig";
import { LOCALES } from "../../../lib/i18n/config";
import {
  buildDigest, digestDue, inQuietHours, makeToken, nudgeDecision, processDigests, processNudges, readToken, subKey, weekKey,
  type ClaimMeta, type LogStore, type RunOpts, type TenantData,
} from "./hubDigest";
import { DIGEST_LOCALES, fmtDate, normLocale, renderDigest, renderNudge, renderUnsubPage, strings } from "./hubDigestEmail";
import { validateHubPatch } from "./hubRules";

let n = 0, bad = 0;
const ok = (c: unknown, m: string) => { n++; if (!c) { bad++; console.error("FAIL:", m); } };

class MemStore implements LogStore {
  docs = new Map<string, ClaimMeta>();
  async claim(key: string, m: ClaimMeta) { if (this.docs.has(key)) return false; if ((await this.sentKinds(m.capKey)).size >= m.cap) return false; this.docs.set(key, m); return true; }
  async release(key: string) { this.docs.delete(key); }
  async has(key: string) { return this.docs.has(key); }
  async sentKinds(capKey: string) { return new Set([...this.docs.values()].filter((d) => d.capKey === capKey).map((d) => d.kind as string)); }
}
const sent: { to: string; subject: string; html: string }[] = [];
const send = async (to: string, subject: string, html: string) => { sent.push({ to, subject, html }); return true as const; };

// Sunday 27 Sep 2026, 17:30 UK (BST = UTC+1)
const SUN = new Date("2026-09-27T16:30:00Z");
const iso = (d: Date, addH = 0) => new Date(d.getTime() + addH * 3_600_000).toISOString();

function fixture(over: Partial<TenantData> = {}, on = true): TenantData {
  return {
    tenantId: "T-synthetic", provider: "Sunny Tutors",
    enrolments: [
      { childId: "c1", childName: "Maya Patel", parentUid: "u1", parentEmail: "parent1@example.test", franchiseId: null, active: true },
      { childId: "c2", childName: "Omar Khan", parentUid: "u2", parentEmail: "parent2@example.test", franchiseId: null, active: true },
      { childId: "c3", childName: "Quiet Kid", parentUid: "u3", parentEmail: "parent3@example.test", franchiseId: null, active: true },
    ],
    cfgFor: () => ({ parentDigest: on, homeworkNudges: on, nudgeLeadHours: 24 }),
    localeOf: (u) => (u === "u1" ? "ar" : u === "u2" ? "pl" : "en"),
    homework: [
      { id: "h1", title: "Fractions practice", dueAt: iso(SUN, -30), createdAt: iso(SUN, -100), assignedChildIds: ["c1", "c2"], franchiseId: null },
      { id: "h2", title: "Spelling list 5", dueAt: iso(SUN, 60), createdAt: iso(SUN, -20), assignedChildIds: ["c1"], franchiseId: null },
    ],
    submissions: new Map([
      [subKey("h1", "c1"), { status: "marked" as const, submittedAt: iso(SUN, -50), mark: { score: 9, max: 10, markedAt: iso(SUN, -40) } }],
    ]),
    attempts: new Map([
      ["c1", [{ title: "Times tables", subject: "Maths", pct: 90, passMarkPct: 70, status: "marked", type: "quiz", submittedAt: iso(SUN, -5) }, { title: "Old one", subject: "Maths", pct: 40, passMarkPct: 70, status: "marked", type: "quiz", submittedAt: iso(SUN, -24 * 20) }]],
    ]),
    lessons: [{ id: "l1", title: "Live maths", startsAt: iso(SUN, 48), status: "scheduled", childIds: ["c1"], attendance: {} }],
    optOut: new Set(), muted: new Set(),
    ...over,
  };
}
const opts = (o: Partial<RunOpts> = {}): RunOpts => ({ now: SUN, dry: false, store: new MemStore(), send, ...o });

// ── time ──
ok(weekKey(SUN) === "2026-09-27", "week key = that Sunday");
ok(weekKey(new Date("2026-09-30T10:00:00Z")) === "2026-09-27", "Wednesday belongs to the Sunday before");
ok(digestDue(SUN) && !digestDue(new Date("2026-09-27T14:00:00Z")) && !digestDue(new Date("2026-09-28T17:30:00Z")), "digest slot = Sunday from 17:00 UK");
ok(inQuietHours(new Date("2026-09-28T21:30:00Z")) && inQuietHours(new Date("2026-09-28T05:00:00Z")) && !inQuietHours(new Date("2026-09-28T12:00:00Z")), "quiet hours 21:00-08:00 UK");

// ── settings: additive, validated, default OFF ──
const d0 = mergeHub(undefined);
ok(d0.parentDigest === false && d0.homeworkNudges === false && d0.nudgeLeadHours === 24, "defaults: both OFF, 24 h");
ok(mergeHub({ homeworkNudges: true, nudgeLeadHours: 99 as number }).homeworkNudges === true && mergeHub({ nudgeLeadHours: 99 }).nudgeLeadHours === 24, "merge keeps a real flag, repairs a bad lead time");
const v1 = validateHubPatch({ homeworkNudges: true, parentDigest: false, nudgeLeadHours: 48 });
ok(v1.ok && v1.patch.homeworkNudges === true && v1.patch.nudgeLeadHours === 48, "patch accepted");
ok(!validateHubPatch({ homeworkNudges: "yes" }).ok && !validateHubPatch({ nudgeLeadHours: 0 }).ok && !validateHubPatch({ nudgeLeadHours: 73 }).ok, "patch rejects bad values");

// ── rendering: 11 locales, RTL, escaping, first name only ──
const td = fixture();
const e1 = td.enrolments[0];
const data = buildDigest(td, e1, SUN)!;
ok(!!data, "digest has content for c1");
ok(data.childName === "Maya", "first name only");
ok(data.celebrate.kind === "score" && data.celebrate.pct === 90, "celebrates the best real result");
ok(data.quizzes.length === 1, "only this week's quizzes (20-day-old one excluded)");
ok(data.streakDays === 1 && data.strongest === "Maths", "streak + strongest");
ok(data.upcoming.some((u) => u.kind === "homework") && data.upcoming.some((u) => u.kind === "lesson"), "coming up lists homework + lesson");
ok(data.homework.some((h) => h.status === "marked" && h.score === 9), "marked homework carries its score");
ok(LOCALES.length === 11 && DIGEST_LOCALES.length === 11, "11 locales");
for (const l of LOCALES) {
  const r = renderDigest(data, l.code, { hub: "https://app.test/custdash/learninghub?child=c1", stop: "https://api.test/stop?u=x" });
  ok(r.html.includes(`lang="${l.code}"`), `${l.code}: lang attr`);
  ok(r.html.includes(l.rtl ? 'dir="rtl"' : 'dir="ltr"'), `${l.code}: dir ${l.rtl ? "rtl" : "ltr"}`);
  ok(r.html.includes(strings(l.code).cta) && r.html.includes("https://app.test/custdash/learninghub?child=c1"), `${l.code}: CTA button + link`);
  ok(r.subject.includes("Maya"), `${l.code}: subject names the child`);
  ok(!/\{[a-z_]+\}/i.test(r.html), `${l.code}: no unfilled {placeholder}`);
  ok(!r.html.includes("Patel"), `${l.code}: no surname`);
  const s = strings(l.code);
  ok(l.code === "en" || s.subject !== strings("en").subject, `${l.code}: actually translated`);
  for (const k of ["nudge_before", "nudge_after"] as const) {
    const nr = renderNudge(k, { childName: "Maya", provider: "Sunny Tutors", title: "Fractions", dueAt: iso(SUN, 20) }, l.code, { hub: "https://a.test/h", stop: "https://a.test/s" });
    ok(!/\{[a-z_]+\}/i.test(nr.html) && nr.html.includes("Fractions"), `${l.code}: nudge ${k} renders`);
  }
  ok(renderUnsubPage(l.code, { scope: "nudge", provider: "X", step: "confirm", action: "/a" }).includes(l.rtl ? 'dir="rtl"' : 'dir="ltr"'), `${l.code}: unsub page dir`);
}
ok(normLocale("AR-EG") === "ar" && normLocale("xx") === "en" && normLocale(undefined) === "en" && normLocale("cy") === "cy", "locale normalisation, fallback en");
const evil = renderDigest({ ...data, childName: "<img src=x onerror=1>", homework: [{ title: "<script>alert(1)</script>", status: "assigned", dueAt: null }] }, "en", { hub: "h", stop: "s" }).html;
ok(!evil.includes("<script>") && !evil.includes("<img src=x") && evil.includes("&lt;script&gt;"), "HTML-escaped");
ok(!/overdue|late|failed|missed/i.test(renderNudge("nudge_after", { childName: "Maya", provider: "P", title: "T", dueAt: iso(SUN, -30) }, "en", { hub: "h", stop: "s" }).html), "gentle wording: no overdue/late/failed/missed");

// ── tokens ──
const tok = makeToken("T1", "A@B.com", "digest");
ok(JSON.stringify(readToken(tok)) === JSON.stringify({ tenantId: "T1", email: "a@b.com", scope: "digest" }), "token round-trips (email lower-cased)");
ok(readToken(tok + "x") === null && readToken("nonsense") === null && readToken(tok.replace(/^./, "Z")) === null && readToken(undefined) === null, "tampered / junk token refused");
ok(readToken(makeToken("T1", "a@b.com", "nudge"))?.scope === "nudge", "scope carried");

// ── digest: switch, dedupe, cap, opt-out, mute, empty ──
{
  const off = await processDigests(fixture({}, false), opts());
  ok(off.length === 0 && sent.length === 0, "switch OFF (the default) = nothing happens");
  sent.length = 0;
  const store = new MemStore();
  const r1 = await processDigests(fixture(), opts({ store }));
  ok(r1.filter((i) => i.status === "sent").length === 2, `c1 + c2 get a digest (got ${r1.map((i) => i.childId + ":" + i.status + ":" + (i.reason ?? "")).join(",")})`);
  ok(r1.find((i) => i.childId === "c3")?.reason === "nothing_to_report", "a child with nothing to report gets no email");
  ok(sent.length === 2 && sent[0].html.includes('dir="rtl"') && sent[1].html.includes('lang="pl"'), "each parent gets their own language (ar RTL, pl)");
  const r2 = await processDigests(fixture(), opts({ store }));
  ok(sent.length === 2 && r2.every((i) => i.status !== "sent"), "rerun never double-sends (idempotent key)");
  ok(r2.some((i) => i.reason === "already_sent_or_capped"), "rerun reports why");
  const later = await processDigests(fixture(), opts({ store, now: new Date("2026-09-28T16:30:00Z") }));
  ok(later.every((i) => i.status !== "sent") && sent.length === 2, "later the same week: still max 1 digest per child");
  const nextWeek = await processDigests(fixture(), opts({ store, now: new Date("2026-10-04T16:30:00Z") }));
  ok(nextWeek.every((i) => i.status !== "sent" || i.childId), "next week's key is a fresh slot");
  sent.length = 0;
  const oo = await processDigests(fixture({ optOut: new Set(["digest:parent1@example.test"]), muted: new Set(["parent2@example.test"]) }), opts());
  ok(sent.length === 0 && oo.find((i) => i.childId === "c1")?.reason === "parent_opted_out" && oo.find((i) => i.childId === "c2")?.reason === "parent_muted_learning_emails", "opt-out and muted 'learning' emails are honoured");
  const inactive = fixture(); inactive.enrolments[0].active = false;
  ok((await processDigests(inactive, opts())).every((i) => i.childId !== "c1"), "un-enrolled child gets nothing");
}

// ── dry-run: renders, reports, NEVER sends, never claims ──
{
  sent.length = 0;
  const store = new MemStore();
  const files: string[] = [];
  const throwing = async () => { throw new Error("SEND CALLED IN DRY RUN"); };
  const r = await processDigests(fixture(), opts({ dry: true, store, send: throwing, onRender: (x) => { files.push(x.childId); return `/x/${x.childId}.html`; } }));
  ok(r.filter((i) => i.status === "dry").length === 2 && files.length === 2 && r[0].file === "/x/c1.html", "dry: rendered + reported");
  ok(store.docs.size === 0 && sent.length === 0, "dry: sent-log untouched, nothing sent");
  const nr = await processNudges(fixture(), opts({ dry: true, store, send: throwing, now: new Date("2026-09-28T15:30:00Z") }));
  ok(nr.every((i) => i.status === "dry") && store.docs.size === 0, "dry nudges: same");
  const inert = await processDigests(fixture({}, false), opts({ dry: true, store, send: throwing, ignoreSwitch: true }));
  ok(inert.filter((i) => i.status === "dry").length === 2, "tutor 'what would go out' dry run ignores the switch");
}
// mail not live (dev): nothing sent AND the log is not burned
{
  const store = new MemStore();
  const r = await processDigests(fixture(), opts({ store, send: async () => "not_live" }));
  ok(r.filter((i) => i.reason === "mail_not_live").length === 2 && store.docs.size === 0, "not-live send releases the claim (log not burned)");
  const f = await processDigests(fixture(), opts({ store, send: async () => false }));
  ok(f.filter((i) => i.status === "failed").length === 2 && store.docs.size === 0, "a failed send releases the claim so it retries");
}

// ── nudges ──
const H = 3_600_000;
const T0 = new Date("2026-09-29T15:00:00Z"); // due
ok(nudgeDecision({ dueAt: T0.toISOString(), now: new Date(T0.getTime() - 30 * H), leadHours: 24, sent: new Set() }) === null, "30 h before: too early");
ok(nudgeDecision({ dueAt: T0.toISOString(), now: new Date(T0.getTime() - 5 * H), leadHours: 24, sent: new Set() }) === "nudge_before", "5 h before: before-nudge");
ok(nudgeDecision({ dueAt: T0.toISOString(), now: new Date(T0.getTime() - 5 * H), leadHours: 24, sent: new Set(["nudge_before"]) }) === null, "before-nudge only once");
ok(nudgeDecision({ dueAt: T0.toISOString(), now: new Date(T0.getTime() + 2 * H), leadHours: 24, sent: new Set() }) === null, "just past due: wait (no shaming)");
ok(nudgeDecision({ dueAt: T0.toISOString(), now: new Date(T0.getTime() + 26 * H), leadHours: 24, sent: new Set() }) === "nudge_after", "a day later: gentle follow-up");
ok(nudgeDecision({ dueAt: T0.toISOString(), now: new Date(T0.getTime() + 8 * 24 * H), leadHours: 24, sent: new Set() }) === null, "stale after a week: dropped");
ok(nudgeDecision({ dueAt: T0.toISOString(), now: new Date(T0.getTime() + 26 * H), leadHours: 24, sent: new Set(["nudge_before", "nudge_after"]) }) === null, "max 2 per homework");
ok(nudgeDecision({ dueAt: T0.toISOString(), now: new Date("2026-09-28T21:30:00Z"), leadHours: 24, sent: new Set() }) === null, "no nudges at night");
ok(nudgeDecision({ dueAt: T0.toISOString(), now: new Date(T0.getTime() - 30 * H), leadHours: 48, sent: new Set() }) === "nudge_before", "lead time honoured (48 h)");
{
  sent.length = 0;
  const store = new MemStore();
  const mk = () => fixture({
    homework: [{ id: "h9", title: "Read chapter 3", dueAt: T0.toISOString(), createdAt: iso(T0, -100), assignedChildIds: ["c1", "c2", "c3"], franchiseId: null }],
    submissions: new Map([[subKey("h9", "c2"), { status: "submitted" as const, submittedAt: iso(T0, -30), mark: null }]]),
  });
  const before = new Date(T0.getTime() - 5 * H);
  const a = await processNudges(mk(), opts({ store, now: before }));
  ok(a.filter((i) => i.status === "sent").length === 2 && !sent.some((s) => s.to === "parent2@example.test"), "before-nudge to c1 + c3, NOT to c2 who handed in");
  ok(a.every((i) => i.kind === "nudge_before"), "kind before");
  ok(sent[0].html.includes("Read chapter 3") && !sent[0].html.includes("Omar") && !sent[0].html.includes("Quiet Kid"), "only this child's own homework, no other child's name");
  const again = await processNudges(mk(), opts({ store, now: before }));
  ok(again.length === 0 && sent.length === 2, "rerun: no double nudge");
  const after = await processNudges(mk(), opts({ store, now: new Date(T0.getTime() + 26 * H) }));
  ok(after.filter((i) => i.status === "sent").length === 2 && after.every((i) => i.kind === "nudge_after"), "follow-up sent once");
  const third = await processNudges(mk(), opts({ store, now: new Date(T0.getTime() + 50 * H) }));
  ok(third.length === 0 && sent.length === 4, "cap: never more than 2 per homework per child");
  const optd = await processNudges(fixture({ homework: mk().homework, optOut: new Set(["nudge:parent1@example.test"]) }), opts({ now: before }));
  ok(optd.find((i) => i.childId === "c1")?.reason === "parent_opted_out", "nudge opt-out honoured");
  const offN = await processNudges(fixture({ homework: mk().homework }, false), opts({ now: before }));
  ok(offN.length === 0, "nudges default OFF");
}

// Native-level review of cy/ur/pa/bn/ar (docs/reviews/critic-i18n-other.md): the CTA is translated (no Latin product name), dates use Western digits, no gendered/idle wording.
for (const loc of ["ur", "pa", "bn", "ar", "cy"] as const) {
  ok(!/Learning Hub/.test(strings(loc).cta), `${loc} cta must not leave "Learning Hub" in Latin`);
  ok(!/[\u0660-\u0669\u06F0-\u06F9\u09E6-\u09EF\u0A66-\u0A6F]/.test(fmtDate("2026-09-29T09:00:00Z", loc)), `${loc} fmtDate uses Western digits: ${fmtDate("2026-09-29T09:00:00Z", loc)}`);
}
ok(strings("cy").subject === "Dysgu {name} yr wythnos hon", "cy digest subject is grammatical");
ok(!/منذ/.test(strings("ar").c_streak) && !/خامل/.test(JSON.stringify(strings("ar"))), "ar streak line has no 'since' / 'idle' wording");

console.log(`${n} checks, ${bad} failed`);
process.exit(bad ? 1 : 0);
