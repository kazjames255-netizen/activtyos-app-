"use client";

import { useMemo, useState } from "react";
import { Select } from "@/components/ui";
import { DISPLAY, FOCUS, Avatar } from "../teachKit";
import type { HubGroup } from "../types";
import { membersOf } from "../groupStatus";
import { useHw, type Hw } from "./hwI18n";
import { pctOf, type InboxRow, type TutorHomework } from "./hwTypes";

// Tutor: the MARKBOOK — children x homework, MyMaths-style. One cell per child per homework: the score, a traffic light and a
// text label. Built from the hand-in inbox (one row per child per homework), so it needs no extra endpoint.
//
// Light = how the work stands against the due date (never the score), so late-but-done and missing look different:
//   done (on time) · late (handed in late) · missing (past due, nothing in) · soon (due within 2 days) · notdue (later).
// The SCORE is judged against the quiz's own pass mark and shown as a separate "below pass" flag with a glyph.

export type Light = "done" | "late" | "missing" | "soon" | "notdue";
const COLOR: Record<Light, string> = { done: "var(--green)", late: "var(--gold)", missing: "var(--red)", soon: "var(--brand-2)", notdue: "var(--ink-3)" };
const GLYPH: Record<Light, string> = { done: "✓", late: "◔", missing: "✕", soon: "◷", notdue: "–" };
/** With no quiz behind the mark there is no pass mark of its own; a plain 50% keeps the flag honest for paper marks. */
const FALLBACK_PASS = 50;
const DAY = 86_400_000;

export interface Cell { light: Light; label: string; score: string; pct: number | null; below: boolean; toMark: boolean }

export function lightOf(x: Hw, r: InboxRow, now: number): Cell {
  const handed = r.status !== "assigned";
  const pass = r.passMarkPct ?? FALLBACK_PASS;
  if (r.status === "marked" && r.mark) {
    const p = pctOf(r.mark);
    const below = p < pass;
    return { light: r.late ? "late" : "done", label: r.late ? x.h("lightDoneLate") : x.h("lightDone"), score: `${r.mark.score}/${r.mark.max}`, pct: p, below, toMark: false };
  }
  if (handed) return { light: r.late ? "late" : "done", label: r.late ? x.h("lightLateToMark") : x.h("lightToMark"), score: x.h("scoreIn"), pct: null, below: false, toMark: true };
  const diff = new Date(r.dueAt).getTime() - now;
  if (diff < 0) return { light: "missing", label: x.h("lightMissing"), score: "–", pct: null, below: false, toMark: false };
  if (diff <= 2 * DAY) return { light: "soon", label: x.h("lightSoon"), score: "–", pct: null, below: false, toMark: false };
  return { light: "notdue", label: x.h("lightNotDue"), score: "–", pct: null, below: false, toMark: false };
}

const LEGEND: Light[] = ["done", "late", "missing", "soon", "notdue"];
const legendText = (x: Hw, l: Light) => ({ done: x.h("lightDone"), late: x.h("lightDoneLate"), missing: x.h("lightMissing"), soon: x.h("lightSoon"), notdue: x.h("lightNotDue") })[l];
const avg = (ns: number[]) => (ns.length ? Math.round(ns.reduce((a, b) => a + b, 0) / ns.length) : null);
const SIZES = [8, 16, 32];

export function ResultsBoard({ inbox, homework, now, groups = [], onOpen }: { inbox: InboxRow[]; homework: TutorHomework[]; now: number; groups?: HubGroup[]; onOpen: (submissionId: string) => void }) {
  const x = useHw();
  const { h, hp } = x;
  const [size, setSize] = useState<number>(8);
  const [groupId, setGroupId] = useState("");
  const sorted = useMemo(() => [...homework].sort((a, b) => b.dueAt.localeCompare(a.dueAt)), [homework]);
  const cols = useMemo(() => (size <= 0 ? sorted : sorted.slice(0, size)), [sorted, size]);
  const members = useMemo(() => { const g = groups.find((y) => y.id === groupId); return g ? membersOf(g) : null; }, [groups, groupId]);
  const kids = useMemo(() => {
    const m = new Map<string, { id: string; name: string; cells: Map<string, InboxRow> }>();
    for (const r of inbox) {
      if (!cols.some((c) => c.id === r.homeworkId) || (members && !members.has(r.childId))) continue;
      const k = m.get(r.childId) ?? { id: r.childId, name: r.childName, cells: new Map() };
      k.cells.set(r.homeworkId, r);
      m.set(r.childId, k);
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [inbox, cols, members]);

  const pctOfCell = (r: InboxRow | undefined) => (r && r.status === "marked" && r.mark ? pctOf(r.mark) : null);
  const colAvg = (hwId: string) => avg(kids.map((k) => pctOfCell(k.cells.get(hwId))).filter((v): v is number => v !== null));
  const classAvg = avg(kids.flatMap((k) => [...k.cells.values()].map(pctOfCell)).filter((v): v is number => v !== null));

  return (
    <section aria-label={h("resTitle")} data-testid="hub-results" className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h3 className="m-0 text-[15px] font-extrabold text-[var(--ink)]" style={DISPLAY}>{h("resTitle")}</h3>
        <label className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--ink-2)]">{h("resShow")}
          <Select data-testid="hub-results-size" aria-label={h("resShow")} value={String(size)} onChange={(e) => setSize(Number(e.target.value))} className="min-h-[40px]">
            {SIZES.map((n) => <option key={n} value={n}>{h("resLatest", { n })}</option>)}
            <option value="0">{h("resAll", { n: sorted.length })}</option>
          </Select>
        </label>
        {groups.length > 0 && (
          <label className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--ink-2)]">{h("resGroup")}
            <Select data-testid="hub-results-group" aria-label={h("resGroup")} value={groupId} onChange={(e) => setGroupId(e.target.value)} className="min-h-[40px]">
              <option value="">{h("resEveryone")}</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </label>
        )}
        <span className="text-[12px] text-[var(--ink-3)]" data-testid="hub-results-count">{h("resShowing", { shown: cols.length, total: sorted.length })}</span>
      </div>
      <ul className="m-0 mb-3 flex list-none flex-wrap gap-x-3.5 gap-y-1 p-0 text-[12px] text-[var(--ink-2)]" aria-label={h("resKey")}>
        {LEGEND.map((l) => <li key={l} className="inline-flex items-center gap-1.5"><span aria-hidden className="grid h-4 w-4 place-items-center rounded-full text-[10px] font-extrabold text-white" style={{ background: COLOR[l] }}>{GLYPH[l]}</span>{legendText(x, l)}</li>)}
        <li className="inline-flex items-center gap-1.5"><span aria-hidden className="font-extrabold text-[var(--red)]">▼</span>{h("resBelowKey")}</li>
      </ul>
      {kids.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-[12.5px] text-[var(--ink-3)]">{h("resNone")}</p> : (
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-start text-[12.5px]">
          <thead>
            <tr>
              <th scope="col" className="sticky start-0 z-[1] min-w-[120px] bg-[var(--surface)] px-2 py-2 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)] sm:min-w-[140px]">{h("resStudent")}</th>
              {cols.map((c) => {
                const done = c.counts.submitted + c.counts.marked, total = c.counts.assigned + done;
                const a = colAvg(c.id);
                return (
                  <th key={c.id} scope="col" className="min-w-[112px] px-2 py-2 align-bottom">
                    <span className="block max-w-[150px] truncate text-[12px] font-extrabold text-[var(--ink)]" title={c.title}>{c.title}</span>
                    <span className="block text-[11.5px] font-semibold text-[var(--ink-3)]">{h("resIn", { done, total })}{a !== null && <> · {h("resAvg", { n: a })}</>}</span>
                  </th>
                );
              })}
              <th scope="col" className="min-w-[80px] px-2 py-2 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">{h("resDone")}</th>
              <th scope="col" className="min-w-[72px] px-2 py-2 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">{h("resAvgCol")}</th>
            </tr>
          </thead>
          <tbody>
            {kids.map((k) => {
              const handed = [...k.cells.values()].filter((r) => r.status !== "assigned").length;
              const a = avg([...k.cells.values()].map(pctOfCell).filter((v): v is number => v !== null));
              return (
                <tr key={k.id} data-child={k.id}>
                  <th scope="row" className="sticky start-0 z-[1] border-t border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 font-bold text-[var(--ink)]"><span className="inline-flex items-center gap-1.5"><Avatar name={k.name} size={20} /><span className="truncate">{k.name}</span></span></th>
                  {cols.map((c) => {
                    const r = k.cells.get(c.id);
                    if (!r) return <td key={c.id} className="border-t border-[var(--line)] px-2 py-1.5 text-[var(--ink-3)]">–</td>;
                    const t = lightOf(x, r, now);
                    const showScore = t.score !== "–" && t.score !== h("scoreIn");
                    return (
                      <td key={c.id} className="border-t border-[var(--line)] px-1 py-1">
                        <button type="button" onClick={() => onOpen(r.submissionId)} aria-label={h("resCellAria", { name: k.name, title: c.title, state: t.label, score: showScore ? `, ${t.score}${t.below ? `, ${h("resBelowPass")}` : ""}` : "" })} data-light={t.light} data-below={t.below ? "1" : undefined}
                          className={`inline-flex min-h-[44px] w-full items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 text-start hover:border-[var(--brand)] ${FOCUS}`}>
                          <span aria-hidden className="grid h-5 w-5 flex-none place-items-center rounded-full text-[11px] font-extrabold text-white" style={{ background: COLOR[t.light] }}>{GLYPH[t.light]}</span>
                          <span className="min-w-0"><span className="block text-[12.5px] font-extrabold tabular-nums text-[var(--ink)]">{t.score}{t.below && <span aria-hidden className="ms-1 text-[var(--red)]" title={h("resBelowPass")}>▼</span>}</span><span className="block truncate text-[11.5px] text-[var(--ink-3)]">{t.label}</span></span>
                        </button>
                      </td>
                    );
                  })}
                  <td className="border-t border-[var(--line)] px-2 py-1.5 font-bold tabular-nums text-[var(--ink-2)]">{handed}/{k.cells.size}</td>
                  <td className="border-t border-[var(--line)] px-2 py-1.5 font-bold tabular-nums text-[var(--ink)]">{a !== null ? `${a}%` : "–"}</td>
                </tr>
              );
            })}
            <tr>
              <th scope="row" className="sticky start-0 z-[1] border-t-2 border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-[12px] font-extrabold text-[var(--ink)]">{h("resClassAvg")}</th>
              {cols.map((c) => { const a = colAvg(c.id); return <td key={c.id} className="border-t-2 border-[var(--line)] px-2 py-2 font-extrabold tabular-nums text-[var(--ink)]">{a !== null ? `${a}%` : "–"}</td>; })}
              <td className="border-t-2 border-[var(--line)] px-2 py-2" />
              <td className="border-t-2 border-[var(--line)] px-2 py-2 font-extrabold tabular-nums text-[var(--ink)]">{classAvg !== null ? `${classAvg}%` : "–"}</td>
            </tr>
          </tbody>
        </table>
      </div>
      )}
      <p className="mt-2 text-[11.5px] text-[var(--ink-3)]">{hp("resCounts", kids.length)}</p>
    </section>
  );
}
