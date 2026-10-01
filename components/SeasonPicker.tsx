"use client";

import { seasonDisplayName, type Season } from "@/lib/seasons";
import { useT } from "@/lib/i18n/provider";

/**
 * The one control that scopes a page to a trading period. Value is a season id,
 * or "" for "all time". Renders nothing when the provider hasn't set seasons up
 * (so pages using it simply behave as before — all time).
 */
export function SeasonPicker({
  seasons,
  value,
  onChange,
  allLabel,
  className = "",
}: {
  seasons: Season[];
  value: string;
  onChange: (id: string) => void;
  allLabel?: string;
  className?: string;
}) {
  const t = useT();
  if (!seasons.length) return null;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title={t("p8ops.seasonFilterTip")}
      className={`rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-[12px] font-bold text-[var(--ink-2)] outline-none focus:border-[#2f6bd8] ${className}`}
    >
      <option value="">📅 {allLabel ?? t("p8ops.seasonAllTime")}</option>
      {seasons.map((s) => (
        <option key={s.id} value={s.id}>
          {seasonDisplayName(t, s.name)}
        </option>
      ))}
    </select>
  );
}
