"use client";

import { sortSeasons, type Season } from "@/lib/seasons";

/**
 * The one control that scopes a page to a trading period. Value is a season id,
 * or "" for "all time". Renders nothing when the provider hasn't set seasons up
 * (so pages using it simply behave as before — all time).
 */
export function SeasonPicker({
  seasons,
  value,
  onChange,
  allLabel = "All time",
  className = "",
}: {
  seasons: Season[];
  value: string;
  onChange: (id: string) => void;
  allLabel?: string;
  className?: string;
}) {
  if (!seasons.length) return null;
  const sorted = sortSeasons(seasons);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title="Filter to a season"
      className={`rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-[12px] font-bold text-[var(--ink-2)] outline-none focus:border-[#2f6bd8] ${className}`}
    >
      <option value="">📅 {allLabel}</option>
      {sorted.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
