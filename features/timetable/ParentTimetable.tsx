"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { PublishedDayGrid, type PublishedWeek } from "./PublishedTimetable";

const fmt = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

/**
 * Parent-facing timetable — the day plans a provider has published for the days
 * this family's child is booked (the /published feed already trims to booked
 * days for the "booked" audience). When the family is booked onto more than one
 * activity there are several published weeks, so a switcher picks between them
 * and only the chosen week's plan shows.
 */
export function ParentTimetableApp() {
  const [weeks, setWeeks] = useState<PublishedWeek[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  const [di, setDi] = useState(0);

  const refresh = useCallback(() => {
    apiGet<PublishedWeek[]>("/api/timetables/published")
      .then((w) => { setWeeks(w); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn’t load the timetable"));
  }, []);
  useEffect(refresh, [refresh]);
  useRealtime(["timetables"], refresh);

  const list = weeks ?? [];
  const wk = list[Math.min(sel, Math.max(0, list.length - 1))];
  const dayIdx = wk ? Math.min(di, Math.max(0, wk.dayList.length - 1)) : 0;
  const rows = wk ? wk.plan[Math.min(dayIdx, wk.plan.length - 1)] ?? [] : [];
  const label = (w: PublishedWeek) => `${w.tenantName ? `${w.tenantName} · ` : ""}${w.name}`;

  return (
    <div className="-m-3 p-3 sm:-m-5 sm:p-5">
      {/* Hero */}
      <div
        className="relative mb-4 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]"
        style={{ background: "linear-gradient(120deg,#16306e 0%,#3f78d8 60%,#ffffff 100%)" }}
      >
        <h2 className="m-0 flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white/20 text-[17px]">▦</span>
          Activity timetable
        </h2>
        <p className="mt-1.5 max-w-[640px] text-[12.5px] leading-[1.5] text-white/85">
          The day plan for the days your child is booked — updated whenever your provider publishes the week.
        </p>
      </div>

      {error && <div className="text-[13px] font-bold text-[var(--red,#e21d27)]">{error}</div>}
      {!error && weeks === null && <div className="text-[13px] text-[var(--ink-3)]">Loading…</div>}
      {!error && weeks !== null && !list.length && (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-5 py-10 text-center">
          <div className="text-[15px] font-extrabold text-[var(--ink)]">No timetable shared yet</div>
          <div className="mx-auto mt-1 max-w-[420px] text-[12.5px] text-[var(--ink-3)]">
            When your provider publishes the week for the days your child is booked, the daily plan appears here.
          </div>
        </div>
      )}

      {/* Switch between activities when booked onto more than one. */}
      {list.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {list.map((w, i) => (
            <button
              key={w.id}
              onClick={() => { setSel(i); setDi(0); }}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold ${
                i === sel ? "border-transparent text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]"
              }`}
              style={i === sel ? { background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" } : undefined}
            >
              {label(w)}
            </button>
          ))}
        </div>
      )}

      {wk && (
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[0_1px_3px_rgba(20,30,60,.06)]">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-white" style={{ background: "radial-gradient(120% 140% at 12% -20%, #4f8bf5 0%, transparent 55%), linear-gradient(120deg,#16306e 0%,#3f78d8 100%)" }}>
            <div>
              {wk.tenantName && <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-white/80">{wk.tenantName}</div>}
              <div className="text-[14px] font-extrabold">{wk.name}</div>
            </div>
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11.5px] font-bold">
              {fmt(wk.dateFrom)} – {fmt(wk.dateTo)}
            </span>
          </div>
          <div className="p-3.5">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {wk.dayList.map((d, i) => (
                <button
                  key={i}
                  onClick={() => setDi(i)}
                  className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-bold ${
                    i === dayIdx ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]"
                  }`}
                >
                  {d.n}
                  {d.d && <span className="ml-1 font-semibold opacity-70">{d.d.split(" ")[0]}</span>}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <PublishedDayGrid rows={rows} groups={wk.config.groups} dayLabel={wk.dayList[dayIdx]?.n ?? ""} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
