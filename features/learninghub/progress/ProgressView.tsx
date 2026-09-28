"use client";

import { SubjectTile } from "../subjectArt";
import { subjectSwatch } from "../subjectColour";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui";
import type { PanelProps } from "../panelTypes";
import { hubPath, type Mastery, type MasterySubject, type MasteryTopic } from "../shared-assess/api";
import { bandTone, NEUTRAL, OK, timeAgo, type Tone } from "../shared-assess/format";
import { useHubData } from "../shared-assess/hooks";
import { LIFT } from "../shared-assess/motion";
import { display, EmptyState, FOCUS, Meter, Notice, ScoreRing, Skeleton } from "../shared-assess/ui";
import { GlassOrb } from "../shared-ui/GlassOrb";
import { useSupport } from "../family/FamilyContext";
import { Attainment } from "./Attainment";
import { ProgressCards } from "./ProgressCards";
import { BandChip, GrowthChip, TrendChart } from "./charts";
import { LevelLegend, LevelsModal } from "./levels";
import { PARENT_COPY } from "../family/parentCopy";
import { friendlyError } from "../kit";
import { MY_CLASSROOM } from "../names";
import { Rich } from "./Rich";
import { useHubI18n } from "../family/hubT";

// One child's mastery dashboard. Everything shown (percentages, bands, growth,
// coverage, trend) is computed by the API; this only lays it out. Used by the
// parent's Progress tab and, unchanged, when a tutor opens a student.

const CHANNELS = ["hubMastery", "hubAttempts"];
const asPct = (c: number) => (c <= 1 ? c * 100 : c);
const BRAND: Tone = { fill: "var(--brand)", soft: "var(--brand-soft)", ink: "var(--brand-strong)" };

export function ProgressView({ p, childId, onLoaded }: { p: PanelProps; childId: string; onLoaded?: (m: Mastery) => void }) {
  const { data, loading, error, reload } = useHubData<Mastery>(hubPath(p.qs, "/mastery", { childId }), CHANNELS);
  const { t, tp } = useHubI18n();
  const [dismissed, setDismissed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState(false);
  const bands = p.config.masteryBands;
  // The same screen serves a family (second person: "your") and a tutor looking at one student (third person).
  const tutor = p.canEdit;
  const name = tutor ? p.students.find((x) => x.childId === childId)?.childName ?? t("hubfam.pgThisStudent") : "";
  const first = name.split(" ")[0] || t("hubfam.pgThey");
  // Levels were edited: the server re-bands on read, so fetch the mastery again.
  const bandsKey = JSON.stringify(bands);
  const seenBands = useRef(bandsKey);
  useEffect(() => { if (seenBands.current !== bandsKey) { seenBands.current = bandsKey; void reload(); } }, [bandsKey, reload]);
  useEffect(() => { setDismissed(false); }, [error]);
  useEffect(() => { if (data) onLoaded?.(data); }, [data, onLoaded]);

  if (loading && !data) return <ProgressSkeleton />;
  if (!data) return error ? <Notice action={<button type="button" onClick={reload} className="min-h-[44px] rounded-lg px-2 text-[12px] font-extrabold underline">{PARENT_COPY.tryAgain}</button>}>{tutor ? error : friendlyError(error, MY_CLASSROOM)}</Notice> : null;

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
      <div className="grid gap-4">
      {tutor ? (
        <EmptyState icon="sparkle" title={t("hubfam.pgTutorEmptyTitle", { name })}
          body={<Rich text={t(p.config.requireDiagnostic ? "hubfam.pgTutorEmptyBodyDiag" : "hubfam.pgTutorEmptyBody", { first })} />}
          action={p.readOnly ? undefined : <button type="button" onClick={() => p.goTo?.("quizzes")} className={`min-h-[44px] rounded-full px-4 text-[13px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}>{t("hubfam.pgGoQuizzes")}</button>} />
      ) : (
      <EmptyState icon="sparkle" title={PARENT_COPY.noQuizYetTitle}
        body={<Rich text={t(p.config.requireDiagnostic ? "hubfam.pgParentEmptyBodyDiag" : "hubfam.pgParentEmptyBody")} />} />
      )}
      {/* No quiz yet, but games / homework / flashcards may still have something to show. */}
      <ProgressCards p={p} childId={childId} quiz={null} />
      </div>
    );
  }

  return (
    <div className="grid gap-4" data-testid="hub-progress">
      {error && !dismissed && <Notice onDismiss={() => setDismissed(true)}>{tutor ? error : friendlyError(error, MY_CLASSROOM)}</Notice>}
      {subjects.length === 0 && <EmptyState icon="search" title={t("hubfam.pgNoTopicTitle")} body={t("hubfam.pgNoTopicBody")} />}
      <section aria-label={tutor ? t("hubfam.pgAttainmentCap") : t("hubfam.pgLevelCap")} data-ui="card" className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] sm:p-5" style={{ background: "linear-gradient(120deg, var(--brand-soft), var(--surface) 55%)" }}>
        <Attainment bare overall={data.overall} bands={bands} subjects={data.subjects} onEmptyAction={p.canEdit ? undefined : () => p.goTo?.("quizzes")} />
        <div className="mt-3 border-t border-[var(--line)] pt-2"><LevelLegend bands={bands} onEdit={p.canEdit && !p.readOnly ? () => setEditing(true) : undefined} /></div>
      </section>
      <ProgressCards p={p} childId={childId} quiz={{ latest: latest ? { pct: latest.pct, title: latest.title } : null, topicsRecent: data.subjects.flatMap((sb) => sb.topics.filter((tp2) => tp2.attempts > 0).map((tp2) => ({ name: tp2.subtopic ? `${tp2.topic} › ${tp2.subtopic}` : tp2.topic, subject: sb.subject, pct: tp2.masteryPct, at: tp2.lastAttemptAt ?? "" }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5), recent: [...data.trend].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5).map((x) => ({ title: x.title, pct: x.pct })), topics: topicsPractised, subjects: data.subjects.filter(isStarted).length, taken: data.trend.length, who: first === t("hubfam.pgThey") ? "" : first,
        labels: { latest: t("hubfam.pgLatestQuiz"), noQuiz: t("hubfam.pgNoQuizzesYet"), topics: t("hubfam.pgTopicsPractised"), across: tp("hubfam.pgAcrossSubjects", data.subjects.filter(isStarted).length), taken: t("hubfam.pgQuizzesTaken"), recent: t("hubfam.pgRecentMarked") } }} />
      <div className="grid gap-4 2xl:grid-cols-2">{started.map((s) => <SubjectCard key={s.subject} s={s} p={p} who={tutor ? first : null} />)}</div>
      {notStarted.length > 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-3.5" data-testid="hub-not-started">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{t("hubfam.pgNotStartedYet")}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {(showAll ? notStarted : notStarted.slice(0, 8)).map((s) => <span key={s.subject} className="rounded-full bg-[var(--panel)] px-3 py-1 text-[12px] font-bold text-[var(--ink-2)]">{s.subject}</span>)}
            {notStarted.length > 8 && <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className={`min-h-[44px] rounded-full px-3 text-[12px] font-extrabold text-[var(--brand)] hover:underline ${FOCUS}`}>{showAll ? t("hubfam.pgShowFewer") : t("hubfam.pgMore", { n: notStarted.length - 8 })}</button>}
          </div>
        </div>
      )}

      {data.trend.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h3 className="m-0 text-[15px] font-extrabold text-[var(--ink)]" style={display}>{t("hubfam.pgMostRecent")}</h3>
          <p className="m-0 mb-1 mt-0.5 text-[12.5px] text-[var(--ink-3)]">{tutor ? tp("hubfam.pgTrendT", Math.min(20, data.trend.length), { name: first }) : tp("hubfam.pgTrendY", Math.min(20, data.trend.length))}</p>
          <TrendChart points={data.trend} bands={bands} passMark={p.config.passMarkPct} />
        </Card>
      )}
      {editing && <LevelsModal p={p} onClose={() => setEditing(false)} />}
    </div>
  );
}

function SubjectCard({ s, p, who }: { s: MasterySubject; p: PanelProps; who: string | null }) {
  const { t: tr, tp } = useHubI18n();
  const calm = useSupport().calm;
  const bands = p.config.masteryBands;
  const tone = bandTone(bands, s.band);
  const sw = subjectSwatch(s.subject);
  const started = s.masteryPct != null;
  const topics = [...s.topics].sort((a, b) => (a.topic + (a.subtopic ?? "")).localeCompare(b.topic + (b.subtopic ?? "")));
  const practised = topics.filter((t) => t.attempts > 0).length;
  const cov = Math.round(asPct(s.coverage ?? 0));
  // Never let a full ring imply mastery of a whole subject that has been sampled once.
  const partial = started && topics.length > 0 && practised < topics.length;
  const pctLabel = started ? `${Math.round(s.masteryPct ?? 0)}%` : undefined;
  return (
    <Card className={`overflow-hidden ${LIFT}`} id={`hub-progress-${s.subject}`}>
      <div className="flex items-center gap-4 p-4 sm:p-5" style={{ borderTop: `4px solid ${started ? tone.fill : "var(--line)"}` }}>
        <div className="grid flex-none justify-items-center gap-1">
          <GlassOrb pct={started ? s.masteryPct : null} color={sw.base} size={96} calm={calm}
            aria={`${s.subject}: ${pctLabel ?? tr("hubfam.pgNotStarted")}`}
            center={started ? <span className="text-[24px] font-extrabold leading-none" style={display}>{pctLabel}</span> : undefined} />
          {started && topics.length > 0 && <div className="whitespace-nowrap text-[11px] font-bold text-[var(--ink-3)]">{tp("hubfam.pgOfTopics", topics.length, { a: practised, b: topics.length })}</div>}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="m-0 flex items-center gap-2 text-[18px] font-extrabold leading-tight text-[var(--ink)] [overflow-wrap:anywhere]" style={display}><SubjectTile subject={s.subject} size={26} />{s.subject}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <BandChip bands={bands} band={s.band} />
            {started && <GrowthChip growth={s.growthPct} baseline={s.baselinePct} />}
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between gap-2 text-[11px] font-semibold text-[var(--ink-3)]"><span>{who === null && !p.canEdit ? PARENT_COPY.topicsTried : tr("hubfam.pgCoverage")}</span><span className="tabular-nums">{topics.length > 0 ? tp("hubfam.pgOfTopicsPract", topics.length, { a: practised, b: topics.length }) : tr("hubfam.pgPctPract", { pct: cov })}</span></div>
            <Meter pct={cov} tone={cov >= 100 ? OK : BRAND} height={7} label={tr("hubfam.pgCoverageAria", { pct: cov })} />
          </div>
        </div>
      </div>
      {partial && <div className="border-t border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-[12px] leading-snug text-[var(--ink-2)] sm:px-5">{who ? tr("hubfam.pgPartialWho", { a: practised, b: topics.length, name: who }) : tr("hubfam.pgPartialYou", { a: practised, b: topics.length })}</div>}

      {topics.length > 0 && <JourneyPath topics={topics} bands={bands} tr={tr} tp={tp} who={who} canEdit={p.canEdit} subject={s.subject} />}
    </Card>
  );
}

// A horizontal level-path (Kaz picked "Journey map" from the mockups, then rejected the first build — a
// stacked vertical list of cards — as not matching it at all). This matches the mockup literally: stops in
// a single horizontal row on a zigzag dotted line, "started at X%" ABOVE each ring, the topic name below it,
// and exactly ONE flag — at the very end of the trail, not one per stop. Scrolls horizontally on a phone,
// same as a game's level-select map would.
const STOP_W = 128, ZIGZAG = 30, RING = 60;
function JourneyPath({ topics, bands, tr, tp, who, canEdit, subject }: {
  topics: MasteryTopic[]; bands: { min: number; label: string }[]; who: string | null; canEdit: boolean; subject: string;
  tr: ReturnType<typeof useHubI18n>["t"]; tp: ReturnType<typeof useHubI18n>["tp"];
}) {
  const yOf = (i: number) => (i % 2 === 0 ? 0 : ZIGZAG);
  const w = Math.max(1, topics.length - 1) * STOP_W + RING + 40;
  const h = RING + ZIGZAG + 8;
  // Every ring in this subject's trail shares ONE colour — the subject's own (the same red/blue/green/etc as
  // its card up top) — rather than each topic's individual mastery band. Kaz: "the colours need to reflect
  // these colours" (pointing at the subject cards). bandTone stays only for the tiny BandChip-free text, unused here.
  const sw = subjectSwatch(subject);
  const subjTone: Tone = { fill: sw.base, soft: sw.bg, ink: sw.fg };
  return (
    <div className="border-t border-[var(--line)] px-2 py-5 sm:px-4" data-testid="hub-journey-path">
      <div className="overflow-x-auto pb-1 [scrollbar-width:thin]">
        <ol className="relative m-0 list-none p-0" style={{ width: w, height: h + 66 }} aria-label={tr("hubfam.pgJourneyAria", { subject })}>
          {topics.length > 1 && (
            <svg aria-hidden className="absolute start-0 pointer-events-none" width={w} height={h} style={{ top: 33 }}>
              <polyline fill="none" stroke={`color-mix(in srgb, ${sw.base} 45%, var(--line))`} strokeWidth={3} strokeDasharray="1 9" strokeLinecap="round"
                points={topics.map((_, i) => `${20 + i * STOP_W + RING / 2},${yOf(i) + RING / 2}`).join(" ")} />
            </svg>
          )}
          {topics.map((t, i) => {
            const tried = t.attempts > 0;
            const last = i === topics.length - 1;
            return (
              <li key={t.topicId} data-testid="hub-journey-stop" className="absolute top-0 flex flex-col items-center text-center" style={{ insetInlineStart: 20 + i * STOP_W, width: RING + 24, transform: `translateY(${yOf(i)}px)` }}>
                {t.baselinePct != null && <div className="mb-1 whitespace-nowrap text-[11px] font-bold text-[var(--ink-3)]">{tr("hubfam.pgStartedAtSfx", { pct: Math.round(t.baselinePct) })}</div>}
                <div className="relative">
                  <ScoreRing pct={tried ? t.masteryPct : 0} size={RING} stroke={5} tone={tried ? subjTone : NEUTRAL} state={tried ? undefined : "empty"}
                    ariaLabel={tr(who === null && !canEdit ? "hubfam.pgTopicLevel" : "hubfam.pgTopicMastery", { topic: t.topic })} />
                  {last && <span aria-hidden className="absolute top-1/2 start-full ms-1.5 -translate-y-1/2 text-[22px]">🚩</span>}
                </div>
                <div className="mt-1.5 w-full text-[12px] font-extrabold leading-tight text-[var(--ink)] [overflow-wrap:anywhere]">{t.topic}</div>
                <div className="mt-0.5 whitespace-nowrap text-[10.5px] font-semibold text-[var(--ink-3)]">
                  {tried ? tp("hubfam.pgQuizCount", t.attempts) : tr("hubfam.pgNotPractised")}{t.lastAttemptAt ? ` · ${timeAgo(t.lastAttemptAt)}` : ""}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** Mirrors the real layout: three stat tiles, then a subject card (ring, chips, topic bars). */
function ProgressSkeleton() {
  const { t } = useHubI18n();
  return (
    <div role="status" aria-label={t("hubfam.pgLoadingProgress")} className="grid gap-4">
      <div aria-hidden className="grid grid-cols-3 gap-2.5">{[0, 1, 2].map((i) => <div key={i} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3"><Skeleton className="h-2.5 w-16" /><Skeleton className="mt-2.5 h-6 w-12" /><Skeleton className="mt-2 h-2.5 w-20" /></div>)}</div>
      <div aria-hidden className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex items-center gap-4 p-5"><Skeleton className="h-24 w-24 flex-none !rounded-full" /><div className="flex-1"><Skeleton className="h-5 w-2/5" /><div className="mt-2.5 flex gap-2"><Skeleton className="h-5 w-16 !rounded-full" /><Skeleton className="h-5 w-24 !rounded-full" /></div><Skeleton className="mt-4 h-2 w-full !rounded-full" /></div></div>
        {[0, 1].map((i) => <div key={i} className="border-t border-[var(--line)] px-5 py-3"><div className="flex justify-between"><Skeleton className="h-3.5 w-1/3" /><Skeleton className="h-5 w-20 !rounded-full" /></div><Skeleton className="mt-3 h-2 w-full !rounded-full" /></div>)}
      </div>
    </div>
  );
}
