"use client";

import { useEffect, useMemo, useState } from "react";
import type { PanelProps } from "../../panelTypes";
import { Avatar, Skeleton } from "../../teachKit";
import { bandTone } from "../../home/homeLib";
import { LevelLegend } from "../../progress/levels";
import { TrendChart } from "../../progress/TrendChart";
import type { TrendPoint } from "../../shared-assess/api";
import type { Lesson } from "../lessonTypes";
import { WsButton, WsEmpty, WsSection, useShownName, useWsView, type Attendee } from "./wsKit";
import type { WsData } from "./useWorkspaceData";
import { lessonSubject } from "./wsLib";

// "Progress" — a mastery heatmap for THIS lesson's students, from the ONE
// GET /mastery/overview call (stored rows, fast), filtered to the attendees by
// childId. Columns are every subject any of them has been scored in (the
// lesson's own subject first, and highlighted — never a filter that could hide
// their data). A skeleton cell means "loading"; "—" only ever means "no
// attempts yet". Cells carry the % AND the level name (colour is never the only
// signal). Below: one student's quiz trend, built from the one GET /attempts call.

export function ProgressTab({ p, lesson, attendees, data }: { p: PanelProps; lesson: Lesson; attendees: Attendee[]; data: WsData }) {
  const { hideNames, big } = useWsView();
  const shown = useShownName();
  const { want } = data;
  useEffect(() => want(["overview", "attempts"]), [want]);
  const bands = p.config.masteryBands;
  const subject = lessonSubject(p.topics, lesson);
  const [pick, setPick] = useState<string | null>(attendees[0]?.childId ?? null);
  const loading = data.overview === null && !data.failed.includes("overview");

  const cols = useMemo(() => {
    const ids = new Set(attendees.map((a) => a.childId));
    const found = new Set<string>();
    for (const s of data.overview ?? []) if (ids.has(s.childId)) for (const x of s.subjects) found.add(x.subject);
    const rest = [...found].filter((x) => x !== subject).sort((a, b) => a.localeCompare(b));
    return [...(subject ? [subject] : []), ...rest].slice(0, 8);
  }, [attendees, data.overview, subject]);

  const cell = (childId: string, sj: string): number | null => data.overview?.find((s) => s.childId === childId)?.subjects.find((x) => x.subject === sj)?.masteryPct ?? null;

  const trend: TrendPoint[] = useMemo(() => (data.attempts ?? [])
    .filter((r) => r.childId === pick && r.status === "marked" && r.pct != null && r.assessmentType !== "diagnostic")
    .map((r) => ({ at: r.submittedAt ?? r.startedAt ?? "", pct: r.pct ?? 0, subject: r.subject ?? "Quiz", title: r.assessmentTitle ?? "Quiz" }))
    .filter((r) => r.at), [data.attempts, pick]);

  if (!attendees.length) return <WsEmpty icon="chart" title="No students on this lesson" />;
  if (data.failed.includes("overview") && data.overview === null) return <WsEmpty icon="warning" title="Couldn't load progress" action={<WsButton variant="soft" icon="refresh" onClick={data.reload}>Try again</WsButton>} />;
  const pickIdx = attendees.findIndex((a) => a.childId === pick);
  const noData = !loading && cols.length === 0;

  return (
    <div className="grid gap-3">
      <WsSection title="Levels by subject" icon="chart" aside={subject ? <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-extrabold text-[var(--brand-strong)]">This lesson: {subject}</span> : null}>
        {noData ? (
          <p className="m-0 py-3 text-center text-[12.5px] text-[var(--ink-3)]">No attempts yet — once these students finish a quiz, their levels fill in here.</p>
        ) : (
          <div className="overflow-x-auto pb-1" tabIndex={0} role="group" aria-label="Mastery heatmap, scrolls sideways" aria-busy={loading}>
            <table className="w-full border-separate border-spacing-1.5 text-left">
              <thead>
                <tr>
                  <th className="w-[1%] whitespace-nowrap pb-1 pr-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">Student</th>
                  {loading ? <th className="min-w-[88px] pb-1"><Skeleton className="h-3 w-16" /></th> : cols.map((c) => <th key={c} scope="col" className={`min-w-[88px] pb-1 text-[11px] font-extrabold uppercase leading-tight tracking-[0.06em] ${c === subject ? "text-[var(--brand)]" : "text-[var(--ink-3)]"}`}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {attendees.map((a, i) => (
                  <tr key={a.childId}>
                    <th scope="row" className="whitespace-nowrap pr-2 text-[12.5px] font-extrabold text-[var(--ink)]"><span className="inline-flex items-center gap-1.5"><Avatar name={shown(a, i)} size={22} />{shown(a, i)}</span></th>
                    {loading ? <td><Skeleton className="h-[46px]" /></td> : cols.map((c) => {
                      const v = cell(a.childId, c);
                      const t = bandTone(v, bands);
                      return (
                        <td key={c} title={v == null ? "No attempts yet" : undefined} className="rounded-xl px-2 py-1.5 text-center align-middle" style={{ background: t ? t.soft : "var(--panel)", boxShadow: `inset 0 0 0 1px ${t ? `color-mix(in srgb, ${t.fill} 40%, var(--surface))` : "var(--line)"}` }}>
                          {v == null ? <span className="text-[12px] font-bold text-[var(--ink-3)]">—</span> : (
                            <>
                              <span className={`block font-extrabold tabular-nums text-[var(--ink)] ${big ? "text-[18px]" : "text-[14px]"}`} style={{ fontFamily: "var(--ff-display)" }}>{hideNames ? "•" : `${Math.round(v)}%`}</span>
                              <span className="block truncate text-[11px] font-bold text-[var(--ink-2)]">{t?.label}</span>
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-2 border-t border-[var(--line)] pt-2"><LevelLegend bands={bands} /></div>
      </WsSection>

      {!hideNames && (
        <WsSection title="Recent quizzes" icon="quiz" aside={
          attendees.length > 1 ? (
            <select aria-label="Student" value={pick ?? ""} onChange={(e) => setPick(e.target.value)} className="min-h-[36px] rounded-lg border border-[var(--hub-warm-line)] bg-[var(--surface)] px-2 text-[12px] font-bold text-[var(--ink)]">
              {attendees.map((a, i) => <option key={a.childId} value={a.childId}>{shown(a, i)}</option>)}
            </select>
          ) : null
        }>
          {data.attempts === null && !data.failed.includes("attempts") ? <Skeleton className="h-[200px]" /> : trend.length ? <TrendChart points={trend} bands={bands} passMark={p.config.passMarkPct ?? null} /> : <p className="m-0 py-4 text-center text-[12.5px] text-[var(--ink-3)]">{pickIdx >= 0 ? `${attendees[pickIdx]!.name.split(" ")[0]} hasn't finished a quiz yet.` : "No quizzes yet."}</p>}
        </WsSection>
      )}
    </div>
  );
}
