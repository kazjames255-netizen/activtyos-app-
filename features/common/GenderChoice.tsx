"use client";

import { useT } from "@/lib/i18n/provider";

// The optional gender choice for a child: Boy / Girl / Non-binary or other / Prefer not to say. One value per child, stored on the child record
// as "boy" | "girl" | "other" | "na". Tapping the chosen option again clears it (it is optional). Only the family's provider ever sees it.
export type Sex = "boy" | "girl" | "other" | "na" | "";
export const SEX_OPTIONS: Sex[] = ["boy", "girl", "other", "na"];

export function GenderChoice({ value, onChange, compact = false }: { value: Sex | undefined; onChange: (v: Sex) => void; compact?: boolean }) {
  const t = useT();
  const label = (v: Sex) => (v === "boy" ? t("p8lst.genBoy") : v === "girl" ? t("p8lst.genGirl") : v === "other" ? t("p8lst.genOther") : t("p8lst.genNa"));
  return (
    <div className={compact ? "flex flex-wrap gap-2" : "grid grid-cols-2 gap-2"} role="radiogroup" aria-label={t("p8lst.genLabel")}>
      {SEX_OPTIONS.map((v) => {
        const on = value === v;
        return (
          <button key={v} type="button" role="radio" aria-checked={on} onClick={() => onChange(on ? "" : v)}
            className={`rounded-xl border text-[12.5px] font-extrabold ${compact ? "px-3 py-1.5" : "p-2.5"}`}
            style={on ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}>
            {label(v)}
          </button>
        );
      })}
    </div>
  );
}
