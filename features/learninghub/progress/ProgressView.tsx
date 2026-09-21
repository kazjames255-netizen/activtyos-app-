"use client";

import { SubjectTile } from "../subjectArt";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui";
import type { PanelProps } from "../panelTypes";
import { hubPath, type Mastery, type MasterySubject } from "../shared-assess/api";
import { bandTone, NEUTRAL, OK, timeAgo, type Tone } from "../shared-assess/format";
import { useHubData } from "../shared-assess/hooks";
import { LIFT } from "../shared-assess/motion";
import { display, EmptyState, FOCUS, Meter, Notice, ScoreRing, Skeleton, Stat } from "../shared-assess/ui";
import { Attainment } from "./Attainment";
import { BandChip, GrowthChip, TrendChart } from "./charts";
import { LevelLegend, LevelsModal } from "./levels";

// One child's mastery dashboard. Everything shown (percentages, bands, growth,
// coverage, trend) is computed by the API; this only lays it out. Used by the
// parent's Progress tab and, unchanged, when a tutor opens a student.

const CHANNELS = ["hubMastery", "hubAttempts"];
const asPct = (c: number) => (c <= 1 ? c * 100 : c);
const BRAND: Tone = { fill: "var(--brand)", soft: "var(--brand-soft)", ink: "var(--brand-strong)" };

export function ProgressView({ p, childId, onLoaded }: { p: PanelProps; childId: string; onLoaded?: (m: Mastery) => void }) {
  const { data, loading, error, reload } = useHubData<Mastery>(hubPath(p.qs, "/mastery", { childId }), CHANNELS);
  const [dismissed, setDismissed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState(false);
  const bands = p.config.masteryBands;
  // The same screen serves a family (second person: "your") and a tutor looking at one student (third person).
  const tutor = p.canEdit;
  const name = tutor ? p.students.find((x) => x.childId === childId)?.childName ?? "This student" : "";
  const first = name.split(" ")[0] || "They";
  // Levels were edited: the server re-bands on read, so fetch the mastery again.
  const bandsKey = JSON.stringify(bands);
  const seenBands = useRef(bandsKey);
  useEffect(() => { if (seenBands.current !== bandsKey) { seenBands.current = bandsKey; void reload(); } }, [bandsKey, reload]);
  useEffect(() => { setDismissed(false); }, [error]);
  useEffect(() => { if (data) onLoaded?.(data); }, [data, onLoaded]);

  if (loading && !data) return <ProgressSkeleton />;
  if (!data) return error ? <Notice action={<button type="button" onClick={reload} className="min-h-[44px] rounded-lg px-2 text-[12px] font-extrabold underline">Retry</button>}>{error}</Notice> : null;

  const subjects = data.subjects
    .filter((s) => !p.filter.subject || s.subject === p.filter.subject)
    .map((s) => (p.filter.topicId ? { ...s, topics: s.topics.filter((t) => p.covered.has(t.topicId)) } : s))
    .filter((s) => !p.filter.topicId || s.topics.length > 0)
    .sort((a, b) => a.subject.localeCompare(b.subject));
  const isStarted = (s: MasterySubject) => s.masteryPct != null || s.topics.some((t) => t.attempts > 0);
  const started = subjects.filter(isStarted);
  const notStarted = subjects.filter((s) => !isStarted(s));
  const topicsPractised = data.subjects.reduce((n, s) => n + s.topics.filter((t) => t.attempts > 0).length, 0);
  const latest = [...data.trend].sort((a, b) => a.at.localeCompare(b.at)).pop();
  const anyAttempted = data.subjects.some((s) => s.masteryPct != null || s.topics.some((t) => t.attempts > 0));

  if (!anyAttempted && data.trend.length === 0) {
    return (
      tutor ? (
        <EmptyState icon="sparkle" title={`${name} hasn't taken a quiz yet`}
          body={<>Each quiz {first} finishes fills in a bar here, topic by topic. Open the <b>Quizzes</b>{p.config.requireDiagnostic ? <> (or the <b>Placement test</b> first)</> : null} tab and use <b>Set for children</b> to give {first} one.</>}
          action={p.readOnly ? undefined : <button type="button" onClick={() => p.goTo?.("quizzes")} className={`min-h-[44px] rounded-full px-4 text-[13px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}>Go to Quizzes</button>} />
      ) : (
      <EmptyState icon="sparkle" title="Your progress starts with the first quiz"
        body={<>Every quiz you finish fills in a bar here, topic by topic, so you can see what&apos;s solid and what needs another go. Open the <b>Quizzes</b>{p.config.requireDiagnostic ? <> (or the <b>Placement test</b> first)</> : null} tab to begin.</>} />
      )
    );
  }

  return (
    <div className="grid gap-4" data-testid="hub-progress">
      {error && !dismissed && <Notice onDismiss={() => setDismissed(true)}>{error}</Notice>}
      {subjects.length === 0 && <EmptyState icon="search" title="Nothing in this topic yet" body="Pick another subject or topic on the left, or clear the filter." />}
      <section aria-label="Attainment" data-ui="card" className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] sm:p-5" style={{ background: "linear-gradient(120deg, var(--brand-soft), var(--surface) 55%)" }}>
        <Attainment bare overall={data.overall} bands={bands} subjects={data.subjects} onEmptyAction={p.canEdit ? undefined : () => p.goTo?.("quizzes")} />
        <div className="mt-3 border-t border-[var(--line)] pt-2"><LevelLegend bands={bands} onEdit={p.canEdit && !p.readOnly ? () => setEditing(true) : undefined} /></div>
      </section>
      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Latest quiz" value={latest ? `${Math.round(latest.pct)}%` : "–"} sub={latest ? latest.title : "No quizzes yet"} />
        <Stat label="Topics practised" value={topicsPractised} sub={`across ${data.subjects.filter(isStarted).length} ${data.subjects.filter(isStarted).length === 1 ? "subject" : "subjects"}`} />
        <Stat label="Quizzes taken" value={data.trend.length >= 20 ? "20+" : data.trend.length} sub="recent, marked" />
      </div>
      <div className="grid gap-4 2xl:grid-cols-2">{started.map((s) => <SubjectCard key={s.subject} s={s} p={p} who={tutor ? first : null} />)}</div>
      {notStarted.length > 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-3.5" data-testid="hub-not-started">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">Not started yet</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {(showAll ? notStarted : notStarted.slice(0, 8)).map((s) => <span key={s.subject} className="rounded-full bg-[var(--panel)] px-3 py-1 text-[12px] font-bold text-[var(--ink-2)]">{s.subject}</span>)}
            {notStarted.length > 8 && <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className={`min-h-[44px] rounded-full px-3 text-[12px] font-extrabold text-[var(--brand)] hover:underline ${FOCUS}`}>{showAll ? "Show fewer" : `+${notStarted.length - 8} more`}</button>}
          </div>
        </div>
      )}

      {data.trend.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h3 className="m-0 text-[15px] font-extrabold text-[var(--ink)]" style={display}>Most recent progress</h3>
          <p className="m-0 mb-1 mt-0.5 text-[12.5px] text-[var(--ink-3)]">{tutor ? `${first}'s` : "Your"} last {Math.min(20, data.trend.length)} quiz {data.trend.length === 1 ? "score" : "scores"}. Placement tests set {tutor ? "the" : "your"} starting point and don&apos;t appear here.</p>
          <TrendChart points={data.trend} bands={bands} passMark={p.config.passMarkPct} />
        </Card>
      )}
      {editing && <LevelsModal p={p} onClose={() => setEditing(false)} />}
    </div>
  );
}

function SubjectCard({ s, p, who }: { s: MasterySubject; p: PanelProps; who: string | null }) {
  const bands = p.config.masteryBands;
  const tone = bandTone(bands, s.band);
  const started = s.masteryPct != null;
  const topics = [...s.topics].sort((a, b) => (a.topic + (a.subtopic ?? "")).localeCompare(b.topic + (b.subtopic ?? "")));
  const practised = topics.filter((t) => t.attempts > 0).length;
  const cov = Math.round(asPct(s.coverage ?? 0));
  // Never let a full ring imply mastery of a whole subject that has been sampled once.
  const partial = started && topics.length > 0 && practised < topics.length;
  return (
    <Card className={`overflow-hidden ${LIFT}`} id={`hub-progress-${s.subject}`}>
      <div className="flex items-center gap-4 p-4 sm:p-5" style={{ borderTop: `4px solid ${started ? tone.fill : "var(--line)"}` }}>
        <ScoreRing pct={s.masteryPct ?? 0} size={96} stroke={9} tone={started ? tone : NEUTRAL} label={started ? undefined : "–"} sub={started && topics.length > 0 ? `${practised} of ${topics.length} ${topics.length === 1 ? "topic" : "topics"}` : undefined} />
        <div className="min-w-0 flex-1">
          <h3 className="m-0 flex items-center gap-2 text-[18px] font-extrabold leading-tight text-[var(--ink)] [overflow-wrap:anywhere]" style={display}><SubjectTile subject={s.subject} size={26} />{s.subject}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <BandChip bands={bands} band={s.band} />
            {started && <GrowthChip growth={s.growthPct} baseline={s.baselinePct} />}
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between gap-2 text-[11px] font-semibold text-[var(--ink-3)]"><span>Coverage</span><span className="tabular-nums">{topics.length > 0 ? `${practised} of ${topics.length} ${topics.length === 1 ? "topic" : "topics"} practised` : `${cov}% of topics practised`}</span></div>
            <Meter pct={cov} tone={cov >= 100 ? OK : BRAND} height={7} label={`Coverage ${cov}%`} />
          </div>
        </div>
      </div>
      {partial && <div className="border-t border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-[12px] leading-snug text-[var(--ink-2)] sm:px-5">This score comes from {practised} of {topics.length} topics so far. It will move as {who ?? "you"} practise{who ? "s" : ""} the rest.</div>}

      {topics.length > 0 && (
        <ul className="m-0 grid list-none divide-y divide-[var(--line)] border-t border-[var(--line)] p-0">
          {topics.map((t, i) => {
            const tt = bandTone(bands, t.band);
            const tried = t.attempts > 0;
            return (
              <li key={t.topicId} className="px-4 py-3 sm:px-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 text-[13px] font-bold text-[var(--ink)] [overflow-wrap:anywhere]">{t.topic}{t.subtopic ? <span className="font-semibold text-[var(--ink-3)]"> › {t.subtopic}</span> : null}</div>
                  <BandChip bands={bands} band={tried ? t.band : null} pct={tried ? t.masteryPct : null} />
                </div>
                <div className="relative mt-2">
                  <Meter pct={tried ? t.masteryPct : 0} tone={tt} height={8} delay={120 + i * 80} label={`${t.topic} mastery`} mark={t.baselinePct} />
                </div>
                <div className="mt-1 flex justify-between text-[11px] font-semibold text-[var(--ink-3)]">
                  <span>{tried ? `${t.attempts} ${t.attempts === 1 ? "quiz" : "quizzes"}` : "Not practised yet"}{t.baselinePct != null ? ` · started at ${Math.round(t.baselinePct)}%` : ""}</span>
                  {t.lastAttemptAt && <span>{timeAgo(t.lastAttemptAt)}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {topics.some((t) => t.baselinePct != null) && (
        <div className="flex items-center gap-2 border-t border-[var(--line)] bg-[var(--panel)] px-5 py-2 text-[11px] font-semibold text-[var(--ink-3)]">
          <span aria-hidden className="inline-block h-3 w-[3px] rounded bg-[var(--ink)]" /> marks {who ? `${who}'s` : "your"} placement-test starting point
        </div>
      )}
    </Card>
  );
}

/** Mirrors the real layout: three stat tiles, then a subject card (ring, chips, topic bars). */
function ProgressSkeleton() {
  return (
    <div role="status" aria-label="Loading progress" className="grid gap-4">
      <div aria-hidden className="grid grid-cols-3 gap-2.5">{[0, 1, 2].map((i) => <div key={i} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3"><Skeleton className="h-2.5 w-16" /><Skeleton className="mt-2.5 h-6 w-12" /><Skeleton className="mt-2 h-2.5 w-20" /></div>)}</div>
      <div aria-hidden className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex items-center gap-4 p-5"><Skeleton className="h-24 w-24 flex-none !rounded-full" /><div className="flex-1"><Skeleton className="h-5 w-2/5" /><div className="mt-2.5 flex gap-2"><Skeleton className="h-5 w-16 !rounded-full" /><Skeleton className="h-5 w-24 !rounded-full" /></div><Skeleton className="mt-4 h-2 w-full !rounded-full" /></div></div>
        {[0, 1].map((i) => <div key={i} className="border-t border-[var(--line)] px-5 py-3"><div className="flex justify-between"><Skeleton className="h-3.5 w-1/3" /><Skeleton className="h-5 w-20 !rounded-full" /></div><Skeleton className="mt-3 h-2 w-full !rounded-full" /></div>)}
      </div>
    </div>
  );
}
