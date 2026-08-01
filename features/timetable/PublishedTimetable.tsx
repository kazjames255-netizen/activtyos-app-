"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { OperatorPage } from "@/components/OperatorPage";
import type { DayInfo, PlanRow } from "./types";

// ─────────────────────────────────────────────────────────────────────────
// Read-only rendering of a PUBLISHED timetable (GET /api/timetables/published)
// — the staff portal's Timetable view, and the day-plan block on the parent's
// Schedule. No store: published snapshots are immutable until re-published.
// ─────────────────────────────────────────────────────────────────────────

export interface PublishedWeek {
  id: string;
  name: string;
  at: string;
  dateFrom: string;
  dateTo: string;
  tenantId?: string;
  tenantName?: string;
  config: { groups: string[] };
  dayList: DayInfo[];
  plan: PlanRow[][];
}

function Banner({ row }: { row: PlanRow }) {
  const lab =
    row.type === "signin" ? "Sign-in" : row.type === "signout" ? "Sign-out" : row.type === "lunch" ? "Lunch" : "Break";
  const tm = row.times ? row.times.join("  ·  ") : row.time;
  const tone =
    row.type === "break" ? "bg-[var(--panel)] text-[var(--ink-3)]" : "bg-[var(--brand-soft)] text-[var(--brand-strong)]";
  return (
    <div className={`flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[11.5px] font-bold ${tone}`} style={{ gridColumn: "1 / -1" }}>
      <b>{lab}</b>
      <span className="opacity-85">{tm}</span>
    </div>
  );
}

/** One day of a published plan, read-only. */
export function PublishedDayGrid({ rows, groups, dayLabel }: { rows: PlanRow[]; groups: string[]; dayLabel: string }) {
  const n = Math.max(1, groups.length);
  return (
    <div className="grid gap-1 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1" style={{ gridTemplateColumns: `74px repeat(${n}, 1fr)` }}>
      <div className="flex items-center justify-center rounded bg-[var(--panel)] p-2 text-center text-[11px] font-extrabold uppercase text-[var(--ink-2)]">
        {dayLabel}
      </div>
      {groups.map((g, i) => {
        const p = g.split("(");
        return (
          <div key={i} className="rounded bg-[var(--panel)] p-2 text-center text-[11px] font-extrabold uppercase text-[var(--ink-2)]">
            {p[0].trim()}
            {p[1] && <small className="block text-[9.5px] font-semibold normal-case text-[var(--ink-3)]">{p[1].replace(")", "")}</small>}
          </div>
        );
      })}
      {rows.map((r, ri) => {
        if (r.whole) {
          return (
            <div key={ri} style={{ display: "contents" }}>
              <div className="flex items-center justify-end rounded bg-[var(--panel)] px-1.5 py-2 text-right text-[11px] font-bold text-[var(--ink-3)]">{r.time}</div>
              <div style={{ gridColumn: `span ${n}` }}>
                <div className="flex flex-col justify-center rounded-lg px-2.5 py-2 text-[11.5px] font-bold text-white" style={{ background: r.whole.color || "#64748B", textShadow: "0 1px 2px rgba(0,0,0,.3)" }}>
                  <span className="text-[9px] font-bold uppercase tracking-wide opacity-90">{r.whole.cat}</span>
                  <span>{r.whole.name}</span>
                  <span className="text-[9.5px] font-semibold opacity-90">Whole camp · {r.whole.place || "all groups"}</span>
                </div>
              </div>
            </div>
          );
        }
        if (r.cells) {
          return (
            <div key={ri} style={{ display: "contents" }}>
              <div className="flex items-center justify-end rounded bg-[var(--panel)] px-1.5 py-2 text-right text-[11px] font-bold text-[var(--ink-3)]">{r.time}</div>
              {r.cells.map((c, gi) =>
                c.name ? (
                  <div key={gi} className="flex h-full min-h-[42px] flex-col justify-center rounded-lg px-2 py-1.5 text-[11.5px] font-bold leading-tight text-white" style={{ background: c.color || "#64748B", textShadow: "0 1px 2px rgba(0,0,0,.30)" }}>
                    {c.cat && <span className="text-[9px] font-bold uppercase tracking-wide opacity-90">{c.cat}</span>}
                    <span>{c.name}</span>
                    {c.place && <span className="text-[9.5px] font-semibold opacity-90">@ {c.place}</span>}
                  </div>
                ) : (
                  <div key={gi} className="min-h-[42px] rounded-lg border border-dashed border-[var(--line)]" />
                ),
              )}
            </div>
          );
        }
        return <Banner key={ri} row={r} />;
      })}
    </div>
  );
}

/** staff/timetable — the weeks the operator has published to the team. */
export function StaffTimetableApp() {
  const [weeks, setWeeks] = useState<PublishedWeek[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wi, setWi] = useState(0);
  const [di, setDi] = useState(0);

  const refresh = useCallback(() => {
    apiGet<PublishedWeek[]>("/api/timetables/published")
      .then((w) => { setWeeks(w); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn’t load the timetable"));
  }, []);
  useEffect(refresh, [refresh]);
  useRealtime(["timetables"], refresh);

  // Default onto today's week/day when the data lands.
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  useEffect(() => {
    if (!weeks?.length) return;
    const w = weeks.findIndex((x) => x.dateTo >= todayIso);
    const wIdx = w >= 0 ? w : weeks.length - 1;
    setWi(wIdx);
    const d = weeks[wIdx].dayList.findIndex((x) => x.iso >= todayIso);
    setDi(d >= 0 ? d : 0);
  }, [weeks, todayIso]);

  const week = weeks?.[Math.min(wi, (weeks?.length ?? 1) - 1)];

  return (
    <OperatorPage title="Timetable" lede="The day plans your organiser has published" icon="▦">
      {error && <div className="text-[13px] font-bold text-[var(--red,#e21d27)]">{error}</div>}
      {!error && weeks === null && <div className="text-[13px] text-[var(--ink-3)]">Loading…</div>}
      {!error && weeks !== null && !weeks.length && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-[13px] text-[var(--ink-2)]">
          Nothing published yet — when the organiser publishes a week from the Activity timetable builder it appears here.
        </div>
      )}

      {week && (
        <>
          {weeks!.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {weeks!.map((w, i) => (
                <button key={w.id} onClick={() => { setWi(i); setDi(0); }} className={`rounded-full border px-3 py-1.5 text-[12px] font-bold ${i === wi ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--ink)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]"}`}>
                  {w.name}
                </button>
              ))}
            </div>
          )}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {week.dayList.map((d, i) => (
              <button key={i} onClick={() => setDi(i)} className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-bold ${i === di ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]"}`}>
                {d.n}
                {d.d && <span className="ml-1 font-semibold opacity-70">{d.d.split(" ")[0]}</span>}
              </button>
            ))}
          </div>
          {week.plan[Math.min(di, week.plan.length - 1)] && (
            <PublishedDayGrid
              rows={week.plan[Math.min(di, week.plan.length - 1)]}
              groups={week.config.groups}
              dayLabel={week.dayList[Math.min(di, week.dayList.length - 1)]?.n ?? ""}
            />
          )}
          <div className="mt-2 text-[11.5px] text-[var(--ink-3)]">
            {week.name} · published {new Date(week.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </div>
        </>
      )}
    </OperatorPage>
  );
}
