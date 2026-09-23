"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "../kit";
import { requestHomeworkFilter, setHubIntent } from "../hubIntent";
import { InPersonApp } from "../inperson/InPersonApp";
import { pctOf } from "../homework/hwTypes";
import { lessonTiming } from "../live/lessonTypes";
import type { PanelProps } from "../panelTypes";
import { topicLabel } from "../types";
import { fmtClock, relDay, useCountUp, useNow } from "../teachKit";
import { Callouts, ClassSnapshot, type Nudge } from "./ClassSnapshot";
import { Card, FOCUS, HomeSkeleton, Icon, IconTile, PartError, Person, TONES, plural, rise, type IconName, type Tone } from "./homeKit";
import { DAY, improvement, perDay, relTime } from "./homeLib";
import { NextLessonHero, over } from "./NextLesson";
import { RhythmChart } from "./RhythmChart";
import { useTutorHome } from "./useHomeData";
import { ScopeToggle, useScope } from "../mineKit";
import { TutorLiveBanner } from "../remotesync/TutorLiveBanner";

type Go = NonNullable<PanelProps["goTo"]>;

// Tutor Home — "Today": what's next, what needs you, how the class is doing,
// what just happened. All of it derived from existing endpoints; no rules here.

function Attention({ icon, tone, count, label, hint, onClick }: { icon: IconName; tone: Tone; count: number; label: string; hint: string; onClick: () => void }) {
  const t = TONES[tone];
  const zero = count === 0;
  const shown = useCountUp(count, 600);
  return (
    <button type="button" onClick={onClick} aria-label={`${count} ${label}. ${hint}`}
      className={`home-lift group flex min-h-[64px] w-full items-center gap-3 rounded-2xl border p-3 text-left ${FOCUS}`}
      style={zero ? { background: "var(--panel)", borderColor: "var(--line)" } : { background: t.bg, borderColor: t.line }}>
      <span aria-hidden className="grid h-11 w-11 flex-none place-items-center rounded-xl" style={{ background: zero ? "var(--surface)" : "var(--surface)", color: zero ? "var(--ink-3)" : t.fg, boxShadow: "var(--shadow-sm)" }}>
        <Icon name={zero ? "check" : icon} size={21} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-extrabold leading-tight text-[var(--ink)]">{label}</span>
        <span className="mt-0.5 block truncate text-[11.5px] font-semibold text-[var(--ink-2)]">{zero ? "All clear" : hint}</span>
      </span>
      <span className="text-[28px] font-extrabold tabular-nums leading-none" style={{ fontFamily: "var(--ff-display)", color: zero ? "var(--ink-3)" : t.fg }}>{shown}</span>
      <Icon name="chevronRight" size={16} className="text-[var(--ink-3)] transition group-hover:translate-x-0.5" />
    </button>
  );
}

const ACTIONS: { key: "notes" | "quizzes" | "homework" | "live" | "students"; label: string; hint: string; icon: IconName; tone: Tone }[] = [
  { key: "notes", label: "New lesson", hint: "Share a lesson or worksheet", icon: "notes", tone: "brand" },
  { key: "quizzes", label: "New quiz", hint: "Build a test", icon: "quiz", tone: "violet" },
  { key: "homework", label: "Set homework", hint: "Set the next task", icon: "homework", tone: "gold" },
  { key: "live", label: "Schedule video lesson", hint: "Pick a time", icon: "video", tone: "green" },
  { key: "students", label: "Enrol student", hint: "Add to your roster", icon: "users", tone: "red" },
];

// Each quick action lands ON the form it promises (the destination panel opens it on arrival), not just on the tab.
const QUICK_INTENT: Partial<Record<(typeof ACTIONS)[number]["key"], Parameters<typeof setHubIntent>[0]>> = {
  quizzes: { kind: "newQuiz", groupId: "" },
  homework: { kind: "homework", groupId: "" },
  live: { kind: "lesson", groupId: "" },
  students: { kind: "enrol", groupId: "" },
};

/** The Lessons panel stays mounted (hidden) behind the other tabs, so its own "New lesson" button is there to press once the tab is shown. */
const openNewLesson = () => {
  setTimeout(() => {
    const b = [...document.querySelectorAll<HTMLButtonElement>("#hub-tabpanel-notes button")].find((x) => /^\s*New lesson\s*$/.test(x.textContent ?? ""));
    b?.click();
  }, 60);
};

interface FeedItem { id: string; at: number; who: string; text: string; sub?: string; icon: IconName; tone: Tone; go: "quizzes" | "homework" }

export function TutorHome(props: PanelProps) {
  const { qs, students, config, onError, goTo } = props;
  const go: Go = goTo ?? (() => undefined);
  const [teaching, setTeaching] = useState(false); // "Teach in person" (a lesson with the children beside you, no video)
  const { ready, parts, failed, reload } = useTutorHome(qs, onError);
  const now = useNow(30_000);
  // F11: a tutor in a multi-tutor business sees their own next lessons by default (Everyone is one tap away).
  const myUid = props.me?.uid ?? null;
  const allLessons = parts?.lessons;
  const multiTutor = !!myUid && !!allLessons && (props.me?.role === "staff" || allLessons.some((l) => l.tutorUid && l.tutorUid !== myUid));
  const mineCount = allLessons && myUid ? allLessons.filter((l) => l.tutorUid === myUid).length : 0;
  const [scope, setScope] = useScope(props.me?.role === "staff" && mineCount > 0 ? "mine" : "all");
  const mineOnly = multiTutor && scope === "mine";

  const d = useMemo(() => {
    if (!parts) return null;
    const { inbox, overview, attempts } = parts;
    const lessons = mineOnly ? parts.lessons.filter((l) => l.tutorUid === myUid) : parts.lessons;
    const upcoming = lessons.filter((l) => ["upcoming", "open"].includes(lessonTiming(l, now).phase)).sort((a, b) => Number(over(a, now)) - Number(over(b, now)) || a.startsAt.localeCompare(b.startsAt));
    const active = students.filter((s) => s.active !== false);

    // last activity per child: newest of the mastery rollup and any submitted attempt
    const seen = new Map<string, number>();
    const bump = (id: string, iso: string | null | undefined) => { const t = iso ? new Date(iso).getTime() : 0; if (t && t > (seen.get(id) ?? 0)) seen.set(id, t); };
    for (const o of overview) bump(o.childId, o.lastActive);
    for (const a of attempts) if (a.status !== "in_progress") bump(a.childId, a.submittedAt);
    for (const r of inbox) { bump(r.childId, r.submittedAt); bump(r.childId, r.mark?.markedAt); }
    // "Quiet" = enrolled a while and silent for 14+ days. Someone enrolled this fortnight hasn't been given the chance yet.
    const quiet = active.filter((s) => now - (seen.get(s.childId) ?? 0) > 14 * DAY && !(s.createdAt && now - new Date(s.createdAt).getTime() < 14 * DAY));

    const toMark = inbox.filter((r) => r.status === "submitted");
    const overdue = inbox.filter((r) => r.status === "assigned" && new Date(r.dueAt).getTime() < now);
    const written = attempts.filter((a) => a.status === "pending_marking");
    // Placement papers are marked under the Starting quiz tab, quizzes under Quizzes: count them apart and send each to its own tab.
    const writtenPlacement = written.filter((a) => a.assessmentType === "diagnostic");
    const writtenQuiz = written.length - writtenPlacement.length;

    const feed: FeedItem[] = [];
    for (const a of attempts) {
      if (a.status === "in_progress" || !a.submittedAt) continue;
      const title = a.assessmentTitle ?? "a quiz";
      const who = a.childName ?? "A student";
      const at = new Date(a.submittedAt).getTime();
      if (a.status === "pending_marking") feed.push({ id: `a-${a.id}`, at, who, text: `submitted written answers · ${title}`, sub: "Waiting for your marks", icon: "quiz", tone: "violet", go: "quizzes" });
      else feed.push({ id: `a-${a.id}`, at, who, text: `scored ${Math.round(a.pct ?? 0)}% on ${title}`, sub: a.passed === false ? "Below the pass mark" : a.passed ? "Passed" : undefined, icon: "quiz", tone: a.passed === false ? "gold" : "green", go: "quizzes" });
    }
    for (const r of inbox) {
      if (r.status === "submitted" && r.submittedAt) feed.push({ id: `h-${r.submissionId}`, at: new Date(r.submittedAt).getTime(), who: r.childName, text: `handed in ${r.title}`, sub: r.late ? "Late" : "Ready to mark", icon: "homework", tone: "brand", go: "homework" });
      if (r.status === "marked" && r.mark?.markedAt) feed.push({ id: `m-${r.submissionId}`, at: new Date(r.mark.markedAt).getTime(), who: r.childName, text: `${r.title} marked · ${r.mark.score}/${r.mark.max}`, sub: `${pctOf(r.mark)}%`, icon: "check", tone: "green", go: "homework" });
    }
    feed.sort((a, b) => b.at - a.at);

    const gains = improvement(attempts);
    const nudges: Nudge[] = [];
    for (const s of quiet) { const t = seen.get(s.childId); nudges.push({ childId: s.childId, childName: s.childName, reason: t ? `Quiet for ${Math.floor((now - t) / DAY)} days` : "No activity yet" }); }
    // low mastery, still active
    const low = config.masteryBands[0];
    const mid = config.masteryBands[1]?.min ?? 50;
    for (const o of overview) {
      if (nudges.some((n) => n.childId === o.childId)) continue;
      const v = o.subjects.filter((x) => x.masteryPct != null).map((x) => x.masteryPct as number);
      if (!v.length) continue;
      const avg = v.reduce((a, b) => a + b, 0) / v.length;
      if (avg < mid) nudges.push({ childId: o.childId, childName: o.childName, reason: `Averaging ${Math.round(avg)}%${low ? ` · ${low.label}` : ""}` });
    }
    return { upcoming, toMark, overdue, written, writtenQuiz, writtenPlacement: writtenPlacement.length, quiet, feed: feed.slice(0, 10), gains, nudges, days: perDay(attempts, now, 14), hasResults: attempts.some((a) => a.status === "marked") };
  }, [parts, now, students, config.masteryBands, mineOnly, myUid]);

  if (!ready || !parts || !d) return <HomeSkeleton label="Loading your day" />;
  const next = d.upcoming[0] ?? null;
  const topicById = new Map(props.topics.map((t) => [t.id, t]));
  const nameOf = new Map(students.map((s) => [s.childId, s.childName]));
  const attendees = next ? (next.students?.length ? next.students.map((s) => s.childName) : (next.childIds ?? []).map((id) => nameOf.get(id) ?? "Student")) : [];
  const attn = d.toMark.length + d.written.length + d.overdue.length + d.quiet.length;
  const allFailed = Object.keys(failed).length;
  // P-12: a brand-new tutor (no active students, nothing failed to load) gets a 3-step guide instead of a wall of zeros.
  // It is the empty state itself: it disappears as soon as there is one student.
  const firstRun = !props.readOnly && allFailed === 0 && students.filter((s) => s.active !== false).length === 0;

  return (
    <div id="hub-home-tutor" className="space-y-4">
      <TutorLiveBanner qs={qs} goTo={() => go("notes")} />
      {allFailed > 0 && allFailed < 4 && (
        <div className="space-y-2">
          {(Object.keys(failed) as (keyof typeof failed)[]).map((k) => <PartError key={k} what={({ lessons: "your lessons", inbox: "the homework inbox", overview: "student mastery", attempts: "quiz activity" } as const)[k]} message={failed[k]} onRetry={reload} />)}
        </div>
      )}

      {firstRun && <FirstRunGuide onStep={(i) => { if (i === 0) go("students"); else if (i === 1) go("notes"); else { setHubIntent({ kind: "homework", groupId: "" }); go("homework"); } }} />}
      {multiTutor && <div className="flex justify-end"><ScopeToggle scope={scope} onChange={setScope} mine={mineCount} all={allLessons?.length ?? 0} what="lessons" /></div>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <NextLessonHero lesson={next} isTutor readOnly={props.readOnly} attendees={attendees} extraCount={Math.max(0, d.upcoming.length - 1)}
          later={d.upcoming.slice(1, 3).map((l) => ({ id: l.id, title: l.title, when: `${relDay(l.startsAt, now)} · ${fmtClock(l.startsAt)}`, who: (l.students?.length ? l.students.map((x) => x.childName) : (l.childIds ?? []).map((id) => nameOf.get(id) ?? "")).filter(Boolean).slice(0, 2).map((n) => n.split(" ")[0]).join(", ") }))}
          topicLabel={next?.topicId && topicById.get(next.topicId) ? topicLabel(topicById.get(next.topicId)!) : undefined}
          onGo={() => go("live")} onSchedule={() => go("live")} />

        {!firstRun && <Card title="Needs your attention" icon="warning" tone={attn ? "gold" : "green"} className="h-full" style={rise(1)}
          aside={<span className="rounded-full px-2.5 py-1 text-[11.5px] font-extrabold" style={attn ? { background: TONES.gold.bg, color: TONES.gold.fg } : { background: TONES.green.bg, color: TONES.green.fg }}>{attn ? plural(attn, "thing") : "All caught up"}</span>}>
          <div className="grid gap-2">
            <Attention icon="homework" tone="brand" count={d.toMark.length} label="Homework to mark" hint={`${plural(d.toMark.length, "hand-in")} waiting`} onClick={() => go("homework")} />
            <Attention icon="quiz" tone="violet" count={d.writtenQuiz} label="Written answers to mark" hint="Quiz answers need your marks" onClick={() => { setHubIntent({ kind: "marking", groupId: "" }); go("quizzes"); }} />
            {d.writtenPlacement > 0 && <Attention icon="compass" tone="violet" count={d.writtenPlacement} label="Starting quizzes to mark" hint="Starting quiz answers need your marks" onClick={() => { setHubIntent({ kind: "marking", groupId: "" }); go("diagnostic"); }} />}
            <Attention icon="warning" tone="red" count={d.overdue.length} label="Overdue homework" hint="Past due and not handed in" onClick={() => { requestHomeworkFilter("assigned"); go("homework"); }} />
            <Attention icon="users" tone="gold" count={d.quiet.length} label="Quiet for 14+ days" hint={d.quiet.slice(0, 2).map((s) => s.childName.split(" ")[0]).join(", ") || "No recent activity"} onClick={() => go("students")} />
          </div>
        </Card>}
      </div>

      {!props.readOnly && <nav aria-label="Quick actions" className="home-rise grid grid-cols-2 gap-2.5 sm:grid-cols-3 2xl:grid-cols-6" style={rise(2)}>
        {ACTIONS.map((a) => (
          <button key={a.key} type="button" onClick={() => { const i = QUICK_INTENT[a.key]; if (i) setHubIntent(i); go(a.key); if (a.key === "notes") openNewLesson(); }} data-action={a.key}
            className={`home-lift flex min-h-[64px] items-center gap-2.5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2.5 text-left shadow-[var(--shadow-sm)] hover:border-[var(--brand-line)] ${FOCUS}`}>
            <IconTile icon={a.icon} tone={a.tone} size={40} />
            <span className="min-w-0"><span className="block text-[13px] font-extrabold leading-tight text-[var(--ink)]">{a.label}</span><span className="block text-[11px] font-semibold leading-snug text-[var(--ink-3)]">{a.hint}</span></span>
          </button>
        ))}
        <button type="button" onClick={() => setTeaching(true)} data-action="teach-in-person" data-testid="home-teach-in-person"
          className={`home-lift flex min-h-[64px] items-center gap-2.5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2.5 text-left shadow-[var(--shadow-sm)] hover:border-[var(--brand-line)] ${FOCUS}`}>
          <IconTile icon="users" tone="brand" size={40} />
          <span className="min-w-0"><span className="block text-[13px] font-extrabold leading-tight text-[var(--ink)]">Teach in person</span><span className="block text-[11px] font-semibold leading-snug text-[var(--ink-3)]">No video call</span></span>
        </button>
      </nav>}
      {teaching && <InPersonApp qs={qs} config={config} goTo={goTo} onClose={() => setTeaching(false)} />}

      {!firstRun && <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <ClassSnapshot overview={parts.overview} roster={students} bands={config.masteryBands} failed={failed.overview} onGo={go} delay={3 * 60} />
        <Callouts improvers={d.gains} nudges={d.nudges} hasResults={d.hasResults} onGo={go} onNudge={props.readOnly ? undefined : (id) => { setHubIntent({ kind: "homework", groupId: "", childIds: [id] }); go("homework"); }} delay={4 * 60} />
      </div>}

      {!firstRun && <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card title="Recent activity" icon="sparkle" tone="brand" style={rise(5)}>
          {d.feed.length === 0 ? (
            <EmptyState icon="sparkle" title="It's quiet — for now" body="Quiz results, hand-ins and marked work land here as they happen, live." />
          ) : (
            <ol className="relative space-y-0.5" aria-label="Latest events">
              {d.feed.map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => go(f.go)} className={`flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left transition hover:bg-[var(--panel)] ${FOCUS}`}>
                    <span className="relative flex-none"><Person name={f.who} size={34} /><span aria-hidden className="absolute -bottom-1 -right-1 grid h-[18px] w-[18px] place-items-center rounded-full border-2 border-[var(--surface)]" style={{ background: TONES[f.tone].bg, color: TONES[f.tone].fg }}><Icon name={f.icon} size={10} strokeWidth={2.6} /></span></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] leading-snug text-[var(--ink)]"><b className="font-extrabold">{f.who.split(" ")[0]}</b> {f.text}</span>
                      {f.sub && <span className="block truncate text-[11.5px] font-semibold" style={{ color: f.tone === "violet" || f.tone === "brand" ? TONES[f.tone].fg : "var(--ink-3)" }}>{f.sub}</span>}
                    </span>
                    <time dateTime={new Date(f.at).toISOString()} className="flex-none text-[11.5px] font-semibold tabular-nums text-[var(--ink-3)]">{relTime(new Date(f.at).toISOString(), now)}</time>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <RhythmChart days={d.days} now={now} delay={6 * 60} unit="quizzes handed in" emptyText="No quiz hand-ins in the last two weeks. When students sit a quiz, the days light up here." />
      </div>}
    </div>
  );
}

const FIRST_STEPS: { title: string; body: string; icon: IconName }[] = [
  { title: "Add a student", body: "Enrol the first child on your roster.", icon: "users" },
  { title: "Pick a lesson", body: "Choose something from the Lessons shelf.", icon: "notes" },
  { title: "Set homework", body: "Give them their first task.", icon: "homework" },
];

/** Three steps for a tutor with no students yet. Shown only while the roster is empty. */
function FirstRunGuide({ onStep }: { onStep: (i: number) => void }) {
  return (
    <Card title="Get started in three steps" icon="sparkle" tone="brand" className="home-rise">
      <ol data-testid="hub-first-run" className="grid gap-2 sm:grid-cols-3">
        {FIRST_STEPS.map((st, i) => (
          <li key={st.title}>
            <button type="button" onClick={() => onStep(i)} className={`home-lift flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 text-left ${FOCUS}`}>
              <IconTile icon={st.icon} tone="brand" size={40} />
              <span className="min-w-0"><span className="block text-[13.5px] font-extrabold text-[var(--ink)]">{i + 1}. {st.title}</span><span className="block text-[12px] text-[var(--ink-3)]">{st.body}</span></span>
            </button>
          </li>
        ))}
      </ol>
    </Card>
  );
}
