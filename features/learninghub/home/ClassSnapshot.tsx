"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "../kit";
import type { Student } from "../types";
import { BigButton, Card, FOCUS, Icon, IconTile, Person, TONES } from "./homeKit";
import { useH } from "./homeI18n";
import { bandName } from "../family/KidMode";
import { bandTone, firstName, type Bands, type OverviewStudent } from "./homeLib";
import { isRtlDoc, scrollEdges } from "../rtl";
import { requestOpenStudent } from "../hubIntent";

// Class snapshot: students × subjects, each cell tinted by the tenant's own
// mastery band (colour by band position; the band NAME and the % are always
// printed, so colour is never the only signal). ONE need score drives both the
// order and the highlight: a child's lowest scored subject (their overall if
// they somehow have none). Lowest first; under 50 wears gold, under 40 red, and
// a highlighted row never sits below an unhighlighted one. Mobile scrolls
// sideways with the student column pinned.

const MAX_ROWS = 8, MAX_COLS = 6;
const HELP_BELOW = 50, VERY_LOW = 40;

const overall = (p: OverviewStudent): number | null => { const v = p.subjects.filter((x) => x.masteryPct != null).map((x) => x.masteryPct as number); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };

type Scored = { subject: string; masteryPct: number; band: string | null };
const scoredOf = (p: OverviewStudent) => p.subjects.filter((x) => x.masteryPct != null) as Scored[];
/** The child's need score: lowest scored subject, or overall as a fallback; null when there are no results at all. */
const needOf = (p: OverviewStudent): number | null => { const g = scoredOf(p); return g.length ? Math.min(...g.map((x) => x.masteryPct)) : overall(p); };

// The row/ring palette: the theme's gold and red (never navy). `ink` is the readable text colour on the tint.
const HELP_TONES = {
  gold: { ring: "var(--gold)", bg: "color-mix(in srgb, var(--gold) 15%, var(--surface))", line: "color-mix(in srgb, var(--gold) 55%, transparent)", ink: "color-mix(in srgb, var(--gold) 45%, var(--ink))" },
  red: { ring: "var(--red)", bg: "color-mix(in srgb, var(--red) 11%, var(--surface))", line: "color-mix(in srgb, var(--red) 50%, transparent)", ink: "var(--red)" },
} as const;
type HelpKey = keyof typeof HELP_TONES;

/** Does this child need help (need score under 50)? Returns the tone key and their weakest scored subject, or null. */
function helpOf(p: OverviewStudent): { key: HelpKey; weakest: Scored; need: number } | null {
  const g = scoredOf(p);
  if (!g.length) return null;
  const weakest = g.reduce((a, x) => (x.masteryPct < a.masteryPct ? x : a));
  const need = weakest.masteryPct;
  if (need >= HELP_BELOW) return null;
  return { key: need < VERY_LOW ? "red" : "gold", weakest, need };
}

function Cell({ who, subject, pct, band, bands, strong = false, ring }: { who: string; subject: string; pct: number | null; band: string | null; bands: Bands; strong?: boolean; ring?: HelpKey }) {
  const { t } = useH();
  const tone = bandTone(pct, bands);
  const has = pct != null && !!tone;
  const label = has ? t("hubshell.hm_cellAria", { who, subject, pct: Math.round(pct), band: bandName(band ?? tone!.label) }) : t("hubshell.hm_cellNone", { who, subject });
  const ringTone = ring ? HELP_TONES[ring] : null;
  return (
    <div role="cell" className="min-w-0">
      <div role="img" aria-label={label} title={label} data-weakest={ringTone && has ? ring : undefined}
        className="relative grid h-12 place-content-center rounded-xl text-center transition-transform duration-150 hover:-translate-y-px motion-reduce:transition-none motion-reduce:hover:transform-none"
        style={has ? {
          background: tone!.soft,
          boxShadow: `inset 0 1px 0 color-mix(in srgb, var(--surface) 80%, transparent), inset 0 -3px 0 ${tone!.fill}, 0 1px 2px color-mix(in srgb, var(--ink) 10%, transparent)`,
          outline: ringTone ? `2px solid ${ringTone.ring}` : strong ? "1.5px solid var(--line)" : undefined,
          outlineOffset: ringTone ? 1 : undefined,
        } : { background: "var(--panel)", border: "1px dashed var(--line)" }}>
        {has ? (
          <>
            <span className={`${strong ? "text-[14px]" : "text-[13px]"} font-extrabold leading-none tabular-nums text-[var(--ink)]`}>{Math.round(pct)}%</span>
            <span className="mt-0.5 hidden max-w-[70px] truncate text-[11px] font-bold leading-none text-[var(--ink-2)] sm:block">{bandName(band ?? tone!.label)}</span>
            {ringTone && <span aria-hidden className="absolute -end-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full text-[8px] font-extrabold leading-none text-white" style={{ background: ringTone.ring }}>▼</span>}
          </>
        ) : <span className="text-[12px] font-bold text-[var(--ink-3)]">–</span>}
      </div>
    </div>
  );
}

export function ClassSnapshot({ overview, roster, bands, failed, onGo, delay = 0 }: {
  overview: OverviewStudent[]; roster: Student[]; bands: Bands; failed?: string; onGo: (k: "students" | "dashboard" | "quizzes") => void; delay?: number;
}) {
  const { t, pl } = useH();
  const { rows, subjects, hiddenCols, hiddenRows, unstarted, needCount } = useMemo(() => {
    const byId = new Map(overview.map((o) => [o.childId, o]));
    // Everyone on the roster appears — a student with no results yet still deserves a place.
    const people: OverviewStudent[] = roster.filter((s) => s.active !== false).map((s) => byId.get(s.childId) ?? { childId: s.childId, childName: s.childName, subjects: [], lastActive: null });
    for (const o of overview) if (!people.some((p) => p.childId === o.childId)) people.push(o);
    const count = new Map<string, number>();
    const fresh = new Map<string, number>(); // when a subject last saw activity, so ties favour what's current
    const at = (p: OverviewStudent) => (p.lastActive ? new Date(p.lastActive).getTime() || 0 : 0);
    for (const p of people) for (const s of p.subjects) if (s.masteryPct != null) { count.set(s.subject, (count.get(s.subject) ?? 0) + 1); fresh.set(s.subject, Math.max(fresh.get(s.subject) ?? 0, at(p))); }
    const subs = [...count.entries()].sort((a, b) => b[1] - a[1] || (fresh.get(b[0]) ?? 0) - (fresh.get(a[0]) ?? 0) || a[0].localeCompare(b[0])).map(([s]) => s);
    // ONE need score orders the rows AND decides the highlight, so a highlighted row can never sit below an unhighlighted one.
    const started = people.filter((p) => needOf(p) != null);
    const ranked = [...started].sort((a, b) => (needOf(a) as number) - (needOf(b) as number) || (overall(a) ?? 0) - (overall(b) ?? 0) || at(b) - at(a) || a.childName.localeCompare(b.childName));
    // Children with no results yet leave the grid and sit in ONE calm line under it (unless nobody has results at all).
    const inGrid = started.length ? ranked : people;
    const unstarted = started.length ? people.filter((p) => needOf(p) == null) : [];
    return { rows: inGrid.slice(0, MAX_ROWS), subjects: subs.slice(0, MAX_COLS), hiddenCols: Math.max(0, subs.length - MAX_COLS), hiddenRows: Math.max(0, inGrid.length - MAX_ROWS), unstarted, needCount: started.filter((p) => helpOf(p)).length };
  }, [overview, roster]);

  const graded = subjects.length > 0;
  // Columns: student | overall | subjects… | open. The min width keeps the student column readable; narrower screens scroll sideways.
  const cols = `minmax(168px,1.7fr) repeat(${subjects.length + 1}, minmax(60px,1fr)) 44px`;
  const minW = 168 + (subjects.length + 1) * 66 + 52;

  // Sideways scroll on phones: fade the right edge and hint while there is more to see.
  const scroller = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) { setMore(false); return; }
    const e = scrollEdges(el);
    setMore(isRtlDoc() ? e.left : e.right); // more content past the END edge (right in LTR, left in RTL)
  }, []);
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, rows.length, subjects.length]);

  const openChild = (p: { childId: string; childName: string }) => { requestOpenStudent(p.childId, p.childName); onGo("dashboard"); };
  const chip = graded ? (needCount > 0
    ? <span data-testid="snapshot-help-count" className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11.5px] font-extrabold tabular-nums" style={{ background: HELP_TONES[rows.some((p) => helpOf(p)?.key === "red") ? "red" : "gold"].bg, borderColor: HELP_TONES[rows.some((p) => helpOf(p)?.key === "red") ? "red" : "gold"].line, color: HELP_TONES[rows.some((p) => helpOf(p)?.key === "red") ? "red" : "gold"].ink }}>{t("hubshell.hm_snapNeedHelp", { n: needCount })}</span>
    : <span data-testid="snapshot-help-count" className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11.5px] font-extrabold" style={{ background: TONES.green.bg, borderColor: TONES.green.line, color: TONES.green.fg }}>✓ {t("hubshell.hm_snapAllOnTrack")}</span>) : null;

  return (
    <Card title={t("hubshell.hm_studentSnapshot")} icon="users" tone="green" className="h-full" style={{ ["--d" as string]: `${delay}ms` }}
      aside={rows.length > 0 ? <span className="inline-flex flex-wrap items-center justify-end gap-x-2">{chip}<button type="button" onClick={() => onGo("dashboard")} className={`inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 text-[12px] font-extrabold text-[var(--brand)] hover:underline ${FOCUS}`}>{t("hubshell.hm_openProgress")} <Icon name="chevronRight" size={14} /></button></span> : undefined}>
      {failed && !rows.length ? (
        <p className="rounded-2xl border border-dashed border-[var(--red-line)] bg-[var(--red-soft)] px-4 py-3 text-[12.5px] font-semibold text-[var(--ink)]">{t("hubshell.hm_couldntLoadMastery", { message: failed })}</p>
      ) : rows.length === 0 ? (
        <EmptyState icon="users" title={t("hubshell.hm_noStudents")} body={t("hubshell.hm_noStudentsBody")}
          action={<BigButton icon="plus" onClick={() => onGo("students")}>{t("hubshell.hm_enrolStudent")}</BigButton>} />
      ) : (
        <>
          <div className="relative">
            <div ref={scroller} onScroll={measure} className="overflow-x-auto pb-1">
              <div role="table" aria-label={t("hubshell.hm_snapshotCaption")} style={{ minWidth: graded ? minW : undefined }} className="grid gap-1.5">
                {graded && (
                  <div role="row" className="grid items-end gap-x-1.5 px-2" style={{ gridTemplateColumns: cols }}>
                    <div role="columnheader" className="sticky start-0 z-[2] bg-[var(--surface)] ps-[14px] text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("hubshell.hm_colStudent")}</div>
                    <div role="columnheader" className="pb-0.5 text-center text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink)]">{t("hubshell.hm_colOverall")}</div>
                    {subjects.map((s) => <div key={s} role="columnheader" className="pb-0.5 text-center text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]"><span className="block truncate" title={s}>{s}</span></div>)}
                    <div role="columnheader"><span className="sr-only">{t("hubshell.hm_helpOpen")}</span></div>
                  </div>
                )}
                {rows.map((p) => {
                  const h = graded ? helpOf(p) : null;
                  const tone = h ? HELP_TONES[h.key] : null;
                  const detail = h ? `${h.weakest.subject} ${Math.round(h.need)}%` : t("hubshell.hm_helpOverall", { pct: overall(p) ?? 0 });
                  const rowBg = tone ? tone.bg : "var(--surface)";
                  return (
                    <div key={p.childId} role="row" data-testid="snapshot-row" data-child={p.childId} data-help={h?.key}
                      className="grid items-center gap-x-1.5 rounded-[20px] px-2 py-1.5"
                      style={{ gridTemplateColumns: graded ? cols : undefined, background: rowBg, boxShadow: tone ? `inset 0 0 0 1.5px ${tone.line}` : undefined }}>
                      <div role="rowheader" className="sticky start-0 z-[1] flex min-w-0 items-center gap-2.5 rounded-s-[16px]" style={{ background: rowBg }}>
                        {/* the accent bar's space is reserved in EVERY row so avatars and names line up */}
                        <span aria-hidden data-testid="snapshot-accent" className="h-10 w-1 flex-none rounded-full" style={{ background: tone ? tone.ring : "transparent" }} />
                        <Person name={p.childName} size={38} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-extrabold leading-tight text-[var(--ink)]">{p.childName}</span>
                          {h && <span data-testid="snapshot-why" className="mt-0.5 block truncate text-[11.5px] font-bold leading-tight" style={{ color: tone!.ink }}>{t("hubshell.hm_snapWhy", { subject: h.weakest.subject, pct: Math.round(h.need) })}</span>}
                        </span>
                      </div>
                      {graded ? (
                        <>
                          <Cell who={p.childName} subject={t("hubshell.hm_overall")} pct={overall(p)} band={null} bands={bands} strong />
                          {subjects.map((sub) => {
                            const m = p.subjects.find((x) => x.subject === sub);
                            return <Cell key={sub} who={p.childName} subject={sub} pct={m?.masteryPct ?? null} band={m?.band ?? null} bands={bands} ring={h && h.weakest.subject === sub ? h.key : undefined} />;
                          })}
                          <div role="cell" className="grid place-items-center">
                            <button type="button" data-testid="snapshot-open" data-child={p.childId} onClick={() => openChild(p)} aria-label={t("hubshell.hm_helpOpenAria", { name: p.childName, detail })}
                              className={`group grid h-11 w-11 place-items-center rounded-full ${FOCUS}`}>
                              <span className="grid h-8 w-8 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--brand)] shadow-[var(--shadow-sm)] transition group-hover:-translate-y-px group-hover:brightness-[0.97] motion-reduce:transition-none"><Icon name="chevronRight" size={15} /></span>
                            </button>
                          </div>
                        </>
                      ) : <div role="cell" className="text-[12.5px] font-semibold text-[var(--ink-3)]">{t("hubshell.hm_noQuizResults")}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
            <div aria-hidden className={`pointer-events-none absolute inset-y-0 end-0 w-12 transition-opacity duration-200 motion-reduce:transition-none bg-[linear-gradient(to_left,var(--surface),transparent)] rtl:bg-[linear-gradient(to_right,var(--surface),transparent)] ${more ? "opacity-100" : "opacity-0"}`} />
          </div>
          {graded && unstarted.length > 0 && (
            <p data-testid="snapshot-not-started" className="m-0 mt-2 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[12px] font-bold leading-relaxed text-[var(--ink-3)]">
              {t("hubshell.hm_notStartedYet")}:{" "}
              {unstarted.map((u, i) => (
                <span key={u.childId}>
                  <button type="button" data-testid="snapshot-not-started-open" data-child={u.childId} onClick={() => openChild(u)}
                    aria-label={t("hubshell.hm_helpOpenAria", { name: u.childName, detail: t("hubshell.hm_notStartedYet") })}
                    className={`inline rounded-md py-1 font-bold text-[var(--ink-2)] underline-offset-2 hover:underline ${FOCUS}`}>{firstName(u.childName)}</button>{i < unstarted.length - 1 ? ", " : ""}
                </span>
              ))}
            </p>
          )}
          {more && <div className="mt-1 flex items-center justify-end gap-1 text-[11px] font-bold text-[var(--ink-3)] sm:hidden"><span>{t("hubshell.hm_swipe")}</span><Icon name="chevronRight" size={12} /></div>}
          {graded && (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5" aria-label={t("hubshell.hm_legend")}>
              {bands.map((b, i) => {
                const t = bandTone(b.min, bands);
                return <span key={b.label + i} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--ink-2)]"><span aria-hidden className="h-2.5 w-2.5 rounded-[4px]" style={{ background: t?.fill }} />{bandName(b.label)}<span className="text-[var(--ink-3)]">{b.min}%+</span></span>;
              })}
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--ink-3)]"><span aria-hidden className="h-2.5 w-2.5 rounded-[4px] border border-dashed border-[var(--ink-3)]" />{t("hubshell.hm_notStarted")}</span>
              {(hiddenRows > 0 || hiddenCols > 0) && <span className="ms-auto text-[11.5px] font-semibold text-[var(--ink-3)]">{hiddenRows > 0 ? pl("hm_moreStudents", hiddenRows) : ""}{hiddenRows > 0 && hiddenCols > 0 ? " · " : ""}{hiddenCols > 0 ? pl("hm_moreSubjects", hiddenCols) : ""}</span>}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// ── callouts ────────────────────────────────────────────────────────────────

export interface Improver { childId: string; childName: string; delta: number; latest: number }
export interface Nudge { childId: string; childName: string; reason: string }

/** "Top improvers" and "Needs a nudge" — two short, kind lists. */
export function Callouts({ improvers, nudges, hasResults, onGo, onNudge, delay = 0 }: { improvers: Improver[]; nudges: Nudge[]; hasResults: boolean; onGo: (k: "homework" | "dashboard" | "quizzes") => void; /** Nudge = open the homework form with this student ticked; omitted (view-only) means the row opens their progress instead. */ onNudge?: (childId: string) => void; delay?: number }) {
  const up = TONES.green, nudge = TONES.gold;
  const { t } = useH();
  return (
    <div className="grid h-full min-w-0 content-start gap-4">
      <Card title={t("hubshell.hm_topImprovers")} icon="sparkle" tone="green" style={{ ["--d" as string]: `${delay}ms` }}>
        {improvers.filter((i) => i.delta > 0).length === 0 ? (
          <p className="rounded-2xl bg-[var(--panel)] px-3.5 py-3 text-[12.5px] leading-relaxed text-[var(--ink-2)]">{hasResults ? t("hubshell.hm_noImproversYet") : t("hubshell.hm_improversHint")}</p>
        ) : (
          <ul className="space-y-1.5">
            {improvers.filter((i) => i.delta > 0).slice(0, 3).map((i) => (
              <li key={i.childId}>
                <button type="button" onClick={() => onGo("dashboard")} aria-label={t("hubshell.hm_improvedAria", { name: i.childName, delta: i.delta, latest: i.latest })}
                  className={`flex min-h-[48px] w-full items-center gap-2.5 rounded-2xl px-2.5 py-1.5 text-start transition hover:bg-[var(--panel)] ${FOCUS}`}>
                  <Person name={i.childName} size={32} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-bold text-[var(--ink)]">{i.childName}</span><span className="block text-[11.5px] text-[var(--ink-3)]">{t("hubshell.hm_latestQuiz", { pct: i.latest })}</span></span>
                  <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-extrabold tabular-nums" style={{ background: up.bg, color: up.fg, borderColor: up.line }}>▲ {t("hubshell.hm_ptsGain", { n: i.delta })}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={t("hubshell.hm_needsNudge")} icon="warning" tone="gold" style={{ ["--d" as string]: `${delay + 60}ms` }}>
        {nudges.length === 0 ? (
          <p className="flex items-center gap-2.5 rounded-2xl bg-[var(--panel)] px-3.5 py-3 text-[12.5px] leading-relaxed text-[var(--ink-2)]"><IconTile icon="check" tone="green" size={28} />{t("hubshell.hm_allOnTrack")}</p>
        ) : (
          <ul className="space-y-1.5">
            {nudges.slice(0, 3).map((n) => (
              <li key={n.childId}>
                <button type="button" onClick={() => (onNudge ? onNudge(n.childId) : onGo("dashboard"))} aria-label={t(onNudge ? "hubshell.hm_nudgeAriaHw" : "hubshell.hm_nudgeAriaProg", { name: n.childName, reason: n.reason })}
                  className={`flex min-h-[48px] w-full items-center gap-2.5 rounded-2xl px-2.5 py-1.5 text-start transition hover:bg-[var(--panel)] ${FOCUS}`}>
                  <Person name={n.childName} size={32} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-bold text-[var(--ink)]">{firstName(n.childName)}</span><span className="block truncate text-[11.5px] text-[var(--ink-3)]">{n.reason}</span></span>
                  <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-extrabold" style={{ background: nudge.bg, color: nudge.fg, borderColor: nudge.line }}>{onNudge ? t("hubshell.hm_setHomework") : t("hubshell.hm_progress")} <Icon name="chevronRight" size={12} /></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
