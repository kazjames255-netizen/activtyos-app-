"use client";

import { useT } from "@/lib/i18n/provider";
import { relativeFrom, formatDay, localizeDateLabels } from "@/lib/i18n/format";

// The "Dates & times" list of a booking: one row per session, each with a coloured calendar tile (weekday, big day number, month) and the
// time as a bold coloured pill, plus a small Today / Tomorrow / in N days / Past tag. Sessions arrive as strings like
// "Wed 28 Oct 2026 · 09:00 – 15:30"; anything we cannot read as a date falls back to the plain text row.

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export interface SessionTile { wd: string; day: number; mon: string; year: number; iso: string; time: string }

/** Pure: read one session string into tile parts (or null when it has no date we understand). */
export function parseSessionTile(s: string): SessionTile | null {
  const [datePart, ...rest] = s.split(" · ");
  const m = /^(\w{3,9})\s+(\d{1,2})\s+(\w{3,9})\s+(\d{4})\b/.exec(datePart.trim());
  if (!m) return null;
  const mi = MONTHS.indexOf(m[3].slice(0, 3).toLowerCase());
  if (mi < 0) return null;
  const d = new Date(Date.UTC(Number(m[4]), mi, Number(m[2])));
  if (Number.isNaN(d.getTime())) return null;
  return { wd: m[1].slice(0, 3), day: Number(m[2]), mon: m[3].slice(0, 3), year: Number(m[4]), iso: d.toISOString().slice(0, 10), time: rest.join(" · ").replace(/\s*–\s*/, "–") };
}

/** Pure: whole days from today to the session (negative = past). */
export function daysFromToday(iso: string, todayIso = new Date().toISOString().slice(0, 10)): number {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) / 86_400_000);
}

export function SessionTiles({ sessions, place }: { sessions: string[]; place?: string | null }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1.5">
      {sessions.map((s, i) => {
        const p = parseSessionTile(s);
        if (!p) {
          const parts = s.split(" · ");
          return (
            <div key={i} className="flex justify-between border-b border-dashed border-[var(--line)] py-[3px] text-[12px] text-[var(--ink)]">
              <span>{localizeDateLabels(parts[0])}</span>
              <b>{parts[1] || ""}</b>
            </div>
          );
        }
        const diff = daysFromToday(p.iso);
        const past = diff < 0;
        const tag = past ? t("p8lst.sessPast") : relativeFrom(diff, "day");
        return (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2" data-ui="session-row">
            <div
              className="flex h-[54px] w-[50px] flex-none flex-col items-center justify-center rounded-xl text-white"
              style={{ background: past ? "#5b6478" : "linear-gradient(160deg,#1d3a8f,#2f6bd8)" }}
              aria-hidden="true"
            >
              <span className="text-[10px] font-extrabold uppercase leading-none tracking-[0.06em] opacity-90">{formatDay(p.iso, { weekday: "short" })}</span>
              <span className="text-[22px] font-extrabold leading-[1.1]">{p.day}</span>
              <span className="text-[10px] font-extrabold uppercase leading-none tracking-[0.06em] opacity-90">{formatDay(p.iso, { month: "short" })}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-extrabold text-[var(--ink)]">{localizeDateLabels(s.split(" · ")[0])}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                <span className="rounded-full px-2 py-[1px]" style={{ background: past ? "#eceff6" : "#e1fbe9", color: past ? "#4a4763" : "#0b5a2f" }}>{tag}</span>
                {place && <span className="text-[var(--ink-3)]">{place}</span>}
              </div>
            </div>
            {p.time && (
              <span className="flex-none rounded-full px-3 py-[5px] text-[13px] font-extrabold" style={{ background: "#e3ebfc", color: "#1d3a8f" }}>{p.time}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
