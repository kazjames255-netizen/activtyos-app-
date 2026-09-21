"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card } from "@/components/ui";
import { get } from "@/lib/api";
import { Icon } from "../kit";
import type { PanelProps } from "../panelTypes";
import { SubjectCover, SubjectGlyph } from "../subjectArt";
import { errMsg } from "../types";
import { BaselineCard } from "./Baseline";
import { hubPath, type Assessment, type AssessType, type AttemptRow, type Result } from "./api";
import { audienceChips } from "./audience";
import { fmtDate, NEUTRAL, OK, timeAgo, topicShort, type Tone } from "./format";
import { useHubData } from "./hooks";
import { LIFT } from "./motion";
import { ResultView } from "./ResultView";
import { retakeState, useTick } from "./retake";
import { TakeAssessment } from "./TakeAssessment";
import { closeLink, openLink, useLinkOpen } from "../family/link";
import { sweepDrafts } from "./draft";
import { useFamily } from "../family/FamilyContext";
import { CardGridSkeleton, Chip, display, EmptyState, HourglassIcon, MedalIcon, Notice, ScoreRing, ScrollTop, TAP } from "./ui";

// The family-facing list of assessments (quizzes or placement tests) for the
// chosen child, plus the runner and the "look back at a result" view. Grouped
// "To do" / "Done"; a paper left running is offered back as "Resume your quiz".

const GOLD: Tone = { fill: "var(--gold)", soft: "var(--gold-soft)", ink: "color-mix(in srgb, var(--gold) 30%, var(--ink))" };
const BRAND: Tone = { fill: "var(--brand)", soft: "var(--brand-soft)", ink: "var(--brand-strong)" };

const WELCOME = {
  title: "Let's find your starting point",
  body: "This quiz shows what you already know, so your tutor can plan the right next steps. It isn't a pass or fail test, so there's no pressure. Just do your best.",
  bullets: ["You only do this one once. It shows where you start.", "Skip anything you're unsure about, or have a go.", "You'll see your starting point straight after."],
};

const GRID = "grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,310px),1fr))]";

/** What the family can do with one assessment right now. */
interface Card_ { a: Assessment; marked: AttemptRow[]; count: number; best: number | null; running: AttemptRow | null; minsLeft: number | null; /** Newest handed-in paper (marked or with the tutor). */ latest: AttemptRow | null }

export function StudentAssess({ p, type }: { p: PanelProps; type: AssessType }) {
  const childId = p.childId;
  const diag = type === "diagnostic";
  const { data, loading, error, reload } = useHubData<Assessment[]>(childId ? hubPath(p.qs, "/assessments", { type, childId }) : null, ["hubAssessments", "hubQuestions", "hubAttempts", "hubEnrolments"]);
  const att = useHubData<AttemptRow[]>(childId ? hubPath(p.qs, "/attempts", { childId }) : null, ["hubAttempts"]);
  const [taking, setTaking] = useState<{ a: Assessment; resume: boolean; hw: string | null } | null>(null);
  const kidMode = useFamily().kid;
  const tabKey = diag ? "diagnostic" : "quizzes";
  // The open paper lives in the URL (?open=quiz:<id>[&hw=<homework>]): a refresh resumes it, a link lands on it, Back closes it.
  const link = useLinkOpen("quiz");
  const linkId = link.id, linkHw = link.hw;
  const [review, setReview] = useState<{ a: Assessment; r: Result } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const now = useTick(30_000);
  useEffect(() => { sweepDrafts(); }, []); // drop answers-so-far of papers never handed in (older than a week)
  // A seeded provider publishes hundreds of papers (the server already narrows them to what suits this child): show the
  // first page of each list and let the family filter by subject (with counts) or reveal more.
  const PAGE = 24;
  const [subjectF, setSubjectF] = useState("");
  const [shownTodo, setShownTodo] = useState(PAGE);
  const [shownDone, setShownDone] = useState(PAGE);

  const topicById = useMemo(() => new Map(p.topics.map((t) => [t.id, t])), [p.topics]);

  const cards = useMemo<Card_[]>(() => {
    const narrowed = !!(p.filter.subject || p.filter.topicId);
    const rows = att.data ?? [];
    return (data ?? [])
      .filter((a) => a.type === type)
      .filter((a) => !subjectF || a.subject === subjectF)
      .filter((a) => !narrowed || (p.filter.topicId ? a.topicIds.some((id) => p.covered.has(id)) : a.subject === p.filter.subject))
      .sort((a, b) => a.subject.localeCompare(b.subject) || a.title.localeCompare(b.title))
      .map((a) => {
        const mine = rows.filter((r) => r.assessmentId === a.id);
        const marked = mine.filter((r) => r.status === "marked" && r.pct != null);
        const submitted = mine.filter((r) => r.status !== "in_progress").length;
        const bestRow = marked.reduce<number | null>((m, r) => (m == null || (r.pct ?? 0) > m ? (r.pct ?? 0) : m), null);
        const best = bestRow ?? (a.lastAttempt?.status === "marked" ? a.lastAttempt.pct : null);
        // A running paper is only worth resuming while its clock (if any) hasn't run out.
        const running = mine.filter((r) => r.status === "in_progress" && r.startedAt)
          .filter((r) => !a.timeLimitMins || Date.now() < Date.parse(r.startedAt!) + a.timeLimitMins * 60_000)
          .sort((x, y) => (y.startedAt ?? "").localeCompare(x.startedAt ?? ""))[0] ?? null;
        const minsLeft = running && a.timeLimitMins ? Math.max(1, Math.ceil((Date.parse(running.startedAt!) + a.timeLimitMins * 60_000 - Date.now()) / 60_000)) : null;
        const latest = mine.filter((r) => r.status !== "in_progress").sort((x, y) => (y.submittedAt ?? "").localeCompare(x.submittedAt ?? ""))[0] ?? null;
        return { a, marked, count: Math.max(submitted, a.lastAttempt ? 1 : 0), best, running, minsLeft, latest };
      });
  }, [data, att.data, type, p.filter, p.covered, subjectF]);
  const subjectCounts = useMemo(() => { const m = new Map<string, number>(); for (const a of data ?? []) if (a.type === type) m.set(a.subject, (m.get(a.subject) ?? 0) + 1); return [...m].sort(([x], [y]) => x.localeCompare(y)); }, [data, type]);

  const isDone = (c: Card_) => {
    const la = c.a.lastAttempt;
    if (!la || c.a.locked) return false;
    if (diag) return !!c.a.done;                       // pending counts as done: the baseline is in
    if (la.status === "pending_marking") return true;
    return la.status === "marked" && la.pct >= c.a.passMarkPct;
  };
  const running = cards.filter((c) => c.running && !c.a.locked);
  // A lesson's exit quiz belongs at the END of its lesson: never sat before, it isn't offered as a loose quiz.
  const viaLesson = (c: Card_) => !diag && !!c.a.lessonNoteId && !c.a.lastAttempt && !c.running && !c.a.locked;
  const lessonOnly = cards.filter(viaLesson);
  const todo = cards.filter((c) => !isDone(c) && !viaLesson(c));
  const done = cards.filter(isDone);

  useEffect(() => {
    if (!linkId) { setTaking((cur) => (cur ? null : cur)); return; }
    if (taking?.a.id === linkId) return;
    const a = (data ?? []).find((x) => x.id === linkId);
    if (!a || (att.data === null && !att.error)) return; // wait for both lists
    const live = (att.data ?? []).some((r) => r.assessmentId === a.id && r.status === "in_progress" && !!r.startedAt && (!a.timeLimitMins || Date.now() < Date.parse(r.startedAt) + a.timeLimitMins * 60_000));
    setTaking({ a, resume: live, hw: linkHw });
  }, [linkId, linkHw, data, att.data, att.error, taking]);
  const begin = (a: Assessment, resume: boolean) => { setTaking({ a, resume, hw: null }); openLink({ kind: "quiz", id: a.id }, { tab: tabKey }); };

  if (!childId) return <EmptyState icon="users" title="Choose a child" body="Pick which child is taking this from the header." />;

  if (taking) {
    return <TakeAssessment key={taking.a.id} a={taking.a} p={p} childId={childId} resume={taking.resume} homeworkId={taking.hw}
      onExit={() => { setTaking(null); closeLink(); reload(); att.reload(); }} onSubmitted={() => { reload(); att.reload(); }}
      welcome={diag ? WELCOME : undefined}
      resultExtra={diag ? (r) => (r.status === "marked" ? <BaselineCard p={p} childId={childId} subject={taking.a.subject} /> : null) : undefined} />;
  }

  if (review) {
    return (
      <ScrollTop className="mx-auto w-full max-w-[860px]">
        <button type="button" onClick={() => setReview(null)} className="mb-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg pr-3 text-[13px] font-bold text-[var(--ink-2)] hover:text-[var(--brand)]"><Icon name="arrowLeft" size={16} />Back</button>
        <ResultView onRefreshImages={async () => { const r = await get<Result>(hubPath(p.qs, `/attempts/${review.r.id}`, { childId })); setReview((cur) => cur && { ...cur, r }); }} result={review.r} questions={undefined} topics={p.topics} config={p.config} type={type} passMarkPct={review.a.passMarkPct} title={`${review.a.title} · ${fmtDate(review.r.submittedAt)}`}>
          {diag && review.r.status === "marked" ? <BaselineCard p={p} childId={childId} subject={review.a.subject} /> : null}
        </ResultView>
      </ScrollTop>
    );
  }

  const openResult = async (a: Assessment) => {
    if (!a.lastAttempt) return;
    setOpening(a.id);
    try {
      const r = await get<Result>(hubPath(p.qs, `/attempts/${a.lastAttempt.id}`, { childId }));
      setReview({ a, r });
    } catch (e) { p.onError(errMsg(e, "Couldn't open that result")); }
    finally { setOpening(null); }
  };

  const cardFor = (c: Card_) => (
    <AssessCard key={c.a.id} c={c} diag={diag} now={now} yearGroups={p.config.yearGroups} kid={kidMode} onGoDiag={p.goTo ? () => p.goTo!("diagnostic") : undefined} onStart={() => begin(c.a, false)} onView={() => openResult(c.a)} opening={opening === c.a.id}
      topicNames={c.a.topicIds.map((id) => topicById.get(id)).filter((t): t is NonNullable<typeof t> => !!t).map(topicShort)} />
  );
  const noun = diag ? (kidMode ? "starting quizzes" : "placement tests") : "quizzes";
  const narrowed = !!(p.filter.subject || p.filter.topicId);

  return (
    <div className="grid gap-5" data-testid={`hub-${type}-list`}>
      {diag && <DiagHero list={data ?? []} loading={loading} kid={kidMode} />}
      {error && !dismissed && <Notice onDismiss={() => setDismissed(true)} action={<button type="button" onClick={reload} className="min-h-[44px] rounded-lg px-2 text-[12px] font-extrabold underline">Retry</button>}>{error}</Notice>}
      {loading && !data && <CardGridSkeleton count={3} label={diag ? `Loading ${noun}` : "Loading quizzes"} />}
      {data && cards.length === 0 && (
        <EmptyState icon={diag ? "compass" : "quiz"} title={narrowed ? `No ${noun} for this topic yet` : `No ${noun} yet`}
          body={narrowed ? "Try another subject or topic, or clear the filter." : `Your tutor hasn't published any ${noun} for you yet. They'll appear here as soon as they do.`} />
      )}

      {(data?.length ?? 0) > PAGE && subjectCounts.length > 1 && (
        <div role="group" aria-label="Filter by subject" data-testid="hub-subject-counts" className="flex max-w-full gap-1.5 overflow-x-auto pb-0.5">
          {[["", data?.filter((a) => a.type === type).length ?? 0] as [string, number], ...subjectCounts].map(([sub, n]) => (
            <button key={sub || "all"} type="button" aria-pressed={subjectF === sub} onClick={() => { setSubjectF(sub); setShownTodo(PAGE); setShownDone(PAGE); }}
              className={`min-h-[44px] lg:min-h-[40px] flex-none rounded-full border px-3.5 text-[12.5px] font-bold transition-colors ${subjectF === sub ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand)]"}`}>{sub || "All"}<span className="ml-1 tabular-nums opacity-70">{n}</span></button>
          ))}
        </div>
      )}

      {running.map((c) => <ResumeCard key={c.a.id} c={c} kid={kidMode} onResume={() => begin(c.a, true)} />)}

      {lessonOnly.length > 0 && (
        <section aria-label="Comes with a lesson" data-testid="hub-lesson-quizzes">
          <GroupHead label="Finish a lesson to unlock" count={lessonOnly.length} />
          <div className="grid gap-2">
            {lessonOnly.map((c) => (
              <div key={c.a.id} data-lesson-quiz={c.a.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
                <div className="min-w-0 flex-1 basis-[200px]">
                  <div className="truncate text-[14px] font-extrabold text-[var(--ink)]">{c.a.title}</div>
                  <div className="text-[12px] font-semibold text-[var(--ink-3)]">This quiz comes at the end of {c.a.lessonTitle ? `the lesson \u201c${c.a.lessonTitle}\u201d` : "a lesson"}. Do the lesson first.</div>
                </div>
                <Button variant="solid" className={`${TAP} w-full !px-5 sm:w-auto`} data-testid="hub-quiz-start-lesson" onClick={() => openLink({ kind: "lesson", id: c.a.lessonNoteId! }, { tab: "notes" })}>Start the lesson first</Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {todo.length > 0 && (
        <section aria-label="To do">
          <GroupHead label="To do" count={todo.length} />
          <div className={GRID}>{todo.slice(0, shownTodo).map(cardFor)}</div>
          {todo.length > shownTodo && <div className="mt-3 flex justify-center"><Button onClick={() => setShownTodo((n) => n + PAGE)} className={`${TAP} !px-6`}>Show more ({todo.length - shownTodo} left)</Button></div>}
        </section>
      )}
      {done.length > 0 && (
        <section aria-label="Done">
          <GroupHead label="Done" count={done.length} tone="done" />
          <div className={GRID}>{done.slice(0, shownDone).map(cardFor)}</div>
          {done.length > shownDone && <div className="mt-3 flex justify-center"><Button onClick={() => setShownDone((n) => n + PAGE)} className={`${TAP} !px-6`}>Show more ({done.length - shownDone} left)</Button></div>}
        </section>
      )}
    </div>
  );
}

function GroupHead({ label, count, tone }: { label: string; count: number; tone?: "done" }) {
  return (
    <div className="mb-2.5 flex items-center gap-2.5 px-0.5">
      <h3 className="m-0 text-[13px] font-extrabold uppercase tracking-[0.1em] text-[var(--ink-2)]">{label}</h3>
      <span className="grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 text-[11px] font-extrabold tabular-nums" style={tone === "done" ? { background: OK.soft, color: OK.ink } : { background: "var(--brand-soft)", color: "var(--brand-strong)" }}>{count}</span>
      <span aria-hidden className="h-px flex-1 bg-[var(--line)]" />
    </div>
  );
}

function DiagHero({ list, loading, kid }: { list: Assessment[]; loading: boolean; kid: boolean }) {
  const done = list.filter((a) => a.done).length;
  const all = list.length > 0 && done === list.length;
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 text-white sm:p-6" style={{ background: "linear-gradient(120deg, var(--brand-strong), var(--brand-2))" }}>
      <svg aria-hidden viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="pointer-events-none absolute -bottom-10 -right-6 h-[190px] w-[190px] opacity-[0.13]"><circle cx="32" cy="32" r="26" /><circle cx="32" cy="32" r="18" /><path d="m39 25-4.500 10L25 39l4.500-10z" /></svg>
      <div className="relative flex items-start gap-4">
        <div className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-white/15" aria-hidden><Icon name={all ? "check" : "compass"} size={26} strokeWidth={1.7} /></div>
        <div className="min-w-0">
          <h3 className="m-0 text-[20px] font-extrabold leading-tight" style={display}>{all ? "Your starting points are set" : "Find your starting point"}</h3>
          <p className="m-0 mt-1 max-w-[560px] text-[13.5px] leading-relaxed opacity-90">{kid ? (all ? "Every quiz you do now shows how far you've come." : "A short quiz for each subject shows where you're starting from. Then every quiz after it can show how far you've come.") : all ? "Every quiz you take from here shows how far you've come. Head to Progress to watch it grow." : "A short placement test for each subject sets your starting point. It shows what you already know, so every quiz after it can show how far you've come."}</p>
          {!loading && list.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[12px] font-extrabold">{done} of {list.length} {list.length === 1 ? "subject" : "subjects"} done</span>
              <span className="flex gap-1" aria-hidden>{list.slice(0, 12).map((a) => <span key={a.id} className="h-2 w-6 rounded-full" style={{ background: a.done ? "#fff" : "rgba(255,255,255,.28)" }} />)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResumeCard({ c, kid, onResume }: { c: Card_; kid: boolean; onResume: () => void }) {
  const { a, running } = c;
  return (
    <div data-testid="hub-resume" className="relative overflow-hidden rounded-2xl border p-4 sm:p-5" style={{ borderColor: "var(--gold-line)", background: "linear-gradient(120deg, var(--gold-soft), var(--surface) 70%)" }}>
      <div className="flex flex-wrap items-center gap-4">
        <SubjectCover subject={a.subject} height={52} width={52} rounded="rounded-xl"><span className="grid h-[52px] w-[52px] place-items-center"><SubjectGlyph subject={a.subject} size={26} /></span></SubjectCover>
        <div className="min-w-[180px] flex-1">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.1em]" style={{ color: GOLD.ink }}>Pick up where you left off</div>
          <div className="mt-0.5 text-[16px] font-extrabold leading-snug text-[var(--ink)] [overflow-wrap:anywhere]" style={display}>{a.title}</div>
          <div className="mt-0.5 text-[12px] font-semibold text-[var(--ink-3)]">Started {timeAgo(running?.startedAt)}{c.minsLeft != null ? ` · about ${c.minsLeft} min left on the clock` : ""}</div>
        </div>
        <Button variant="solid" className={`${TAP} w-full !px-6 sm:w-auto`} onClick={onResume}>{a.type === "diagnostic" ? (kid ? "Carry on" : "Resume your test") : (kid ? "Carry on" : "Resume your quiz")}</Button>
      </div>
    </div>
  );
}

function AssessCard({ c, diag, kid, onGoDiag, topicNames, onStart, onView, opening, now, yearGroups }: { c: Card_; diag: boolean; kid: boolean; onGoDiag?: () => void; topicNames: string[]; onStart: () => void; onView: () => void; opening: boolean; now: number; yearGroups: string[] }) {
  const { a, best, count, latest } = c;
  const la = a.lastAttempt ?? null;
  const pending = la?.status === "pending_marking";
  const marked = la?.status === "marked";
  const locked = !!a.locked;
  // The list only carries the latest score, so pass/fail compares it to the pass mark the API sent.
  const passed = marked && la ? la.pct >= a.passMarkPct : false;
  const bestPassed = best != null && best >= a.passMarkPct;
  const doneDiag = diag && !!a.done && !pending;
  const reset = diag && marked && !a.done;            // the tutor reset the baseline: it can be sat again

  // Self-marking clarity: an auto-marked score is shown the moment it exists; only the
  // written part is "with your tutor". A paper with nothing auto-marked keeps the hourglass.
  const autoMax = latest?.autoMax ?? 0;
  const partial = pending && autoMax > 0 && latest?.autoMarks != null;
  const wp = latest?.writtenPending ?? 1;
  const partialPct = partial ? (latest!.autoMarks! / autoMax) * 100 : 0;
  const share = partial && latest?.maxMarks ? Math.max(0, ((latest.maxMarks - autoMax) / latest.maxMarks) * 100) : 20;
  // Retake control, worded from what the server reported (a.retake); shown only after a paper is handed in.
  const rt = !diag && la && la.status !== "in_progress" ? retakeState(a, now) : ({ kind: "open" } as const);
  const chips = audienceChips(a.audience, yearGroups);

  const status = locked ? <Chip tone={NEUTRAL} icon={<Icon name="close" size={11} />}>Locked</Chip>
    : diag
      ? (pending ? <Chip tone={BRAND} icon={<HourglassIcon size={12} />}>{kid ? "Your tutor is marking it" : "Awaiting marking"}</Chip> : doneDiag ? <Chip tone={OK} icon={<Icon name="check" size={12} strokeWidth={2.4} />}>Done</Chip> : reset ? <Chip tone={GOLD}>Ready to retake</Chip> : <Chip tone={GOLD}>Not done yet</Chip>)
      : (pending ? (partial ? <Chip tone={BRAND} icon={<Icon name="check" size={12} strokeWidth={2.4} />}>{kid ? "Scored" : "Auto-marked"} {latest!.autoMarks}/{autoMax}</Chip> : <Chip tone={BRAND} icon={<HourglassIcon size={12} />}>{kid ? "Your tutor is marking it" : "Awaiting marking"}</Chip>) : marked ? (passed ? <Chip tone={OK} icon={<Icon name="check" size={12} strokeWidth={2.4} />}>Passed</Chip> : <Chip tone={GOLD}>{kid ? "Not yet" : "Not passed yet"}</Chip>) : <Chip tone={NEUTRAL}>New</Chip>);

  const ringTone = diag || pending ? BRAND : passed ? OK : GOLD;
  const showStart = !locked && (diag ? !doneDiag && !pending : true);
  const meta = [a.questionCount != null ? `${a.questionCount} ${a.questionCount === 1 ? "question" : "questions"}` : null, a.totalMarks != null ? `${a.totalMarks} ${a.totalMarks === 1 ? "mark" : "marks"}` : null, a.timeLimitMins ? `${a.timeLimitMins} min` : "Untimed", diag ? null : `pass ${a.passMarkPct}%`].filter(Boolean).join(" · ");

  let blurb: string;
  if (diag) blurb = pending ? "Your tutor is marking your written answers. Your starting point is set as soon as they finish."
    : doneDiag ? "Your starting point is set. It only counts once, so there's no need to retake it."
    : reset ? "Your tutor reset this test, so you can sit it again to set a fresh starting point."
    : "One go, no pass mark. It shows your tutor where to begin.";
  else blurb = pending ? (partial ? `Plus ${wp} written ${wp === 1 ? "answer" : "answers"} being reviewed by your tutor. This may change.` : "Every answer here is marked by your tutor. You'll see a score once they're done.")
    : marked ? (passed ? (best != null && best >= 100 ? "Full marks. Brilliant work." : best != null && la && best > la.pct ? "Passed, and your best is even higher." : "Passed. Retake any time to beat your best.") : `You need ${a.passMarkPct}% to pass. Have another go when you're ready.`)
    : `Get ${a.passMarkPct}% or more to pass.`;

  return (
    <Card className={`flex flex-col overflow-hidden ${LIFT} ${locked ? "opacity-80" : ""}`} id={`hub-assess-${a.id}`}>
      <SubjectCover subject={a.subject} height={58} rounded="rounded-none">
        <div className="flex h-[58px] items-center justify-between gap-2 px-4">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-2)]"><SubjectGlyph subject={a.subject} size={15} /><span className="truncate">{a.subject}</span></span>
          {status}
        </div>
      </SubjectCover>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h4 className="m-0 text-[16px] font-extrabold leading-snug text-[var(--ink)] [overflow-wrap:anywhere]" style={display}>{a.title}</h4>
          <div className="mt-1 text-[12px] font-semibold text-[var(--ink-3)]">{meta}</div>
          {(chips.length > 0 || a.audienceUnknown) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5" data-testid="hub-audience-chips">
              {chips.map((c2) => <span key={c2} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold" style={{ background: "var(--brand-soft)", color: "var(--brand-strong)" }}><Icon name="users" size={11} strokeWidth={2} />{c2}</span>)}
              {a.audienceUnknown && chips.length > 0 && <span className="text-[11px] font-semibold text-[var(--ink-3)]">(check with your tutor)</span>}
            </div>
          )}
          {topicNames.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{topicNames.slice(0, 3).map((n) => <span key={n} className="rounded-md bg-[var(--panel)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--ink-2)]">{n}</span>)}{topicNames.length > 3 && <span className="px-1 text-[11px] font-bold text-[var(--ink-3)]">+{topicNames.length - 3}</span>}</div>}
        </div>

        {!locked && (
          <div className="flex items-center gap-3.5 rounded-xl bg-[var(--panel)] p-3">
            {pending
              ? (partial ? <ScoreRing pct={partialPct} size={64} stroke={7} tone={BRAND} maybe={share} ariaLabel={`Auto-marked ${latest!.autoMarks} out of ${autoMax}. ${wp} written ${wp === 1 ? "answer" : "answers"} still being marked, so this may change.`} /> : <ScoreRing pct={0} size={64} stroke={7} tone={BRAND} state="pending" />)
              : la && marked
                ? <ScoreRing pct={la.pct} size={64} stroke={7} tone={ringTone} passMark={diag ? null : a.passMarkPct} />
                : <ScoreRing pct={0} size={64} stroke={7} tone={BRAND} state="empty" label={diag ? "–" : `${a.passMarkPct}%`} sub={diag ? undefined : "to pass"} />}
            <div className="min-w-0 flex-1">
              {marked && best != null && !diag ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="inline-flex items-center gap-1 text-[13px] font-extrabold tabular-nums text-[var(--ink)]"><MedalIcon size={17} gold={bestPassed} />Best {Math.round(best)}%</span>
                  {la && Math.round(la.pct) !== Math.round(best) && <span className="text-[12px] font-semibold tabular-nums text-[var(--ink-3)]">Last {Math.round(la.pct)}%</span>}
                </div>
              ) : marked && diag ? (
                <div className="text-[13px] font-extrabold tabular-nums text-[var(--ink)]">Starting point {Math.round(la!.pct)}%</div>
              ) : pending ? (
                <div className="text-[13px] font-extrabold text-[var(--ink)]">{partial ? `${kid ? "Scored" : "Auto-marked"} ${latest!.autoMarks}/${autoMax}` : "Handed in"}</div>
              ) : (
                <div className="text-[13px] font-extrabold text-[var(--ink)]">{diag ? "Not done yet" : "Not tried yet"}</div>
              )}
              <div className="mt-0.5 text-[11.5px] leading-snug text-[var(--ink-3)]">{blurb}</div>
              {count > 1 && <div className="mt-0.5 text-[11px] font-semibold text-[var(--ink-3)]">{count} attempts{la?.submittedAt ? ` · last ${fmtDate(la.submittedAt)}` : ""}</div>}
              {count === 1 && la?.submittedAt && <div className="mt-0.5 text-[11px] font-semibold text-[var(--ink-3)]">{fmtDate(la.submittedAt)}</div>}
            </div>
          </div>
        )}
        {locked && (
          <div className="grid gap-2 rounded-xl bg-[var(--panel)] px-3 py-2.5 text-[12.5px] font-semibold leading-snug text-[var(--ink-2)]" data-testid="hub-locked">
            <span>{kid ? `Do the starting quiz for ${a.subject} first. It unlocks this one.` : a.lockedReason || "Sit the placement test for this subject first."}</span>
            {onGoDiag && <Button variant="solid" className={`${TAP} w-full !px-5 sm:w-auto`} onClick={onGoDiag} data-testid="hub-go-diag">{kid ? "Go to the starting quiz" : "Go to the placement test"}</Button>}
          </div>
        )}

        {!locked && (
          <div className="mt-auto flex flex-wrap items-center gap-2">
            {showStart && rt.kind === "open" && <Button variant={(marked && passed) || pending ? "ghost" : "solid"} className={`${TAP} flex-1 !px-5 sm:flex-none`} onClick={onStart} data-testid="hub-open-assessment">{diag ? (reset ? "Retake" : "Start") : la ? "Retake" : "Start"}</Button>}
            {showStart && rt.kind === "wait" && <span data-testid="hub-retake-wait" className="inline-flex min-h-[44px] flex-1 items-center gap-1.5 rounded-full bg-[var(--panel)] px-3.5 text-[12px] font-extrabold text-[var(--ink-2)] sm:flex-none"><HourglassIcon size={14} />{rt.label}</span>}
            {showStart && rt.kind === "once" && <span data-testid="hub-retake-once" className="flex min-h-[44px] w-full items-center gap-1.5 rounded-2xl bg-[var(--panel)] px-3.5 py-2 text-[12px] font-bold leading-snug text-[var(--ink-2)]">{rt.label}</span>}
            {la && <Button variant={showStart ? "ghost" : "solid"} className={`${TAP} flex-1 sm:flex-none`} onClick={onView} disabled={opening}>{opening ? "Opening…" : pending || (diag && doneDiag) ? "View result" : "Last result"}</Button>}
          </div>
        )}
      </div>
    </Card>
  );
}
