"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "../kit";
import type { Student } from "../types";
import { BigButton, Card, FOCUS, Icon, IconTile, Person, TONES } from "./homeKit";
import { useH } from "./homeI18n";
import { bandName } from "../family/KidMode";
import { bandTone, firstName, type Bands, type OverviewStudent } from "./homeLib";
import { isRtlDoc, scrollEdges } from "../rtl";

// Class snapshot: students × subjects, each cell tinted by the tenant's own
// mastery band (colour by band position; the band NAME and the % are always
// printed, so colour is never the only signal). Mobile scrolls sideways with
// the student column pinned.

const MAX_ROWS = 8, MAX_COLS = 6;

const overall = (p: OverviewStudent): number | null => { const v = p.subjects.filter((x) => x.masteryPct != null).map((x) => x.masteryPct as number); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };

function Cell({ who, subject, pct, band, bands, strong = false }: { who: string; subject: string; pct: number | null; band: string | null; bands: Bands; strong?: boolean }) {
  const { t } = useH();
  const tone = bandTone(pct, bands);
  const has = pct != null && !!tone;
  const label = has ? t("hubshell.hm_cellAria", { who, subject, pct: Math.round(pct), band: bandName(band ?? tone!.label) }) : t("hubshell.hm_cellNone", { who, subject });
  return (
    <td className="px-[3px]">
      <div role="img" aria-label={label} title={label} className="grid h-11 min-w-[62px] place-content-center rounded-xl text-center"
        style={has ? { background: tone!.soft, boxShadow: `inset 0 -3px 0 ${tone!.fill}`, outline: strong ? "1.5px solid var(--line)" : undefined } : { background: "var(--panel)", border: "1px dashed var(--line)" }}>
        {has ? (
          <>
            <span className={`${strong ? "text-[14px]" : "text-[13px]"} font-extrabold leading-none tabular-nums text-[var(--ink)]`}>{Math.round(pct)}%</span>
            <span className="mt-0.5 hidden max-w-[70px] truncate text-[11px] font-bold leading-none text-[var(--ink-2)] sm:block">{bandName(band ?? tone!.label)}</span>
          </>
        ) : <span className="text-[12px] font-bold text-[var(--ink-3)]">–</span>}
      </div>
    </td>
  );
}

export function ClassSnapshot({ overview, roster, bands, failed, onGo, delay = 0 }: {
  overview: OverviewStudent[]; roster: Student[]; bands: Bands; failed?: string; onGo: (k: "students" | "dashboard" | "quizzes") => void; delay?: number;
}) {
  const { t, pl } = useH();
  const { rows, subjects, hiddenCols, hiddenRows } = useMemo(() => {
    const byId = new Map(overview.map((o) => [o.childId, o]));
    // Everyone on the roster appears — a student with no results yet still deserves a row.
    const people: OverviewStudent[] = roster.filter((s) => s.active !== false).map((s) => byId.get(s.childId) ?? { childId: s.childId, childName: s.childName, subjects: [], lastActive: null });
    for (const o of overview) if (!people.some((p) => p.childId === o.childId)) people.push(o);
    const count = new Map<string, number>();
    const fresh = new Map<string, number>(); // when a subject last saw activity, so ties favour what's current
    const at = (p: OverviewStudent) => (p.lastActive ? new Date(p.lastActive).getTime() || 0 : 0);
    for (const p of people) for (const s of p.subjects) if (s.masteryPct != null) { count.set(s.subject, (count.get(s.subject) ?? 0) + 1); fresh.set(s.subject, Math.max(fresh.get(s.subject) ?? 0, at(p))); }
    const subs = [...count.entries()].sort((a, b) => b[1] - a[1] || (fresh.get(b[0]) ?? 0) - (fresh.get(a[0]) ?? 0) || a[0].localeCompare(b[0])).map(([s]) => s);
    const avg = (p: OverviewStudent) => { const v = p.subjects.filter((s) => s.masteryPct != null).map((s) => s.masteryPct as number); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : -1; };
    const ranked = [...people].sort((a, b) => avg(b) - avg(a) || at(b) - at(a) || a.childName.localeCompare(b.childName));
    return { rows: ranked.slice(0, MAX_ROWS), subjects: subs.slice(0, MAX_COLS), hiddenCols: Math.max(0, subs.length - MAX_COLS), hiddenRows: Math.max(0, ranked.length - MAX_ROWS) };
  }, [overview, roster]);

  const graded = subjects.length > 0;

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

  return (
    <Card title={t("hubshell.hm_studentSnapshot")} icon="users" tone="green" className="h-full" style={{ ["--d" as string]: `${delay}ms` }}
      aside={rows.length > 0 ? <button type="button" onClick={() => onGo("dashboard")} className={`inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 text-[12px] font-extrabold text-[var(--brand)] hover:underline ${FOCUS}`}>{t("hubshell.hm_openProgress")} <Icon name="chevronRight" size={14} /></button> : undefined}>
      {failed && !rows.length ? (
        <p className="rounded-2xl border border-dashed border-[var(--red-line)] bg-[var(--red-soft)] px-4 py-3 text-[12.5px] font-semibold text-[var(--ink)]">{t("hubshell.hm_couldntLoadMastery", { message: failed })}</p>
      ) : rows.length === 0 ? (
        <EmptyState icon="users" title={t("hubshell.hm_noStudents")} body={t("hubshell.hm_noStudentsBody")}
          action={<BigButton icon="plus" onClick={() => onGo("students")}>{t("hubshell.hm_enrolStudent")}</BigButton>} />
      ) : (
        <>
          <div className="relative">
          <div ref={scroller} onScroll={measure} className="-mx-1 overflow-x-auto px-1 pb-1">
            <table className="w-full border-separate text-start" style={{ borderSpacing: "0 6px", minWidth: 132 + (subjects.length + 1) * 70 }}>
              <caption className="sr-only">{t("hubshell.hm_snapshotCaption")}</caption>
              {graded && (
                <thead>
                  <tr>
                    <th scope="col" className="sticky start-0 z-[1] bg-[var(--surface)] pe-2 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("hubshell.hm_colStudent")}</th>
                    <th scope="col" className="px-1 pb-1 text-center text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink)]">{t("hubshell.hm_colOverall")}</th>
                    {subjects.map((s) => <th key={s} scope="col" className="px-1 pb-1 text-center text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]"><span className="block max-w-[92px] truncate" title={s}>{s}</span></th>)}
                  </tr>
                </thead>
              )}
              <tbody>
                {rows.map((p) => (
                  <tr key={p.childId}>
                    <th scope="row" className="sticky start-0 z-[1] bg-[var(--surface)] pe-2 text-start font-normal">
                      <span className="flex min-w-[112px] items-center gap-2"><Person name={p.childName} size={28} /><span className="max-w-[110px] truncate text-[13px] font-bold text-[var(--ink)]">{p.childName}</span></span>
                    </th>
                    {graded && <Cell key="overall" who={p.childName} subject={t("hubshell.hm_overall")} pct={overall(p)} band={null} bands={bands} strong />}
                    {graded ? subjects.map((s) => {
                      const m = p.subjects.find((x) => x.subject === s);
                      return <Cell key={s} who={p.childName} subject={s} pct={m?.masteryPct ?? null} band={m?.band ?? null} bands={bands} />;
                    }) : <td className="px-1 text-[12.5px] font-semibold text-[var(--ink-3)]">{t("hubshell.hm_noQuizResults")}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div aria-hidden className={`pointer-events-none absolute inset-y-0 end-0 w-12 transition-opacity duration-200 motion-reduce:transition-none bg-[linear-gradient(to_left,var(--surface),transparent)] rtl:bg-[linear-gradient(to_right,var(--surface),transparent)] ${more ? "opacity-100" : "opacity-0"}`} />
          </div>
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
