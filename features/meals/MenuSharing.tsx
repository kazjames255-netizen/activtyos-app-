"use client";

import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n/provider";
import { Input, Select } from "@/components/ui";

// Who sees the read-only "what's being served" menu display in the customer
// area. Ordering is always open to booked families at checkout — this only
// gates the informational display. Rendered inside the Meals workspace tab.
export function MenuSharing() {
  const t = useT();
  const { settings, save } = useSettings();
  const share = settings.meals?.menuShare ?? "booked";
  const set = (v: "booked" | "paid") => save({ settings: { ...settings, meals: { ...settings.meals, menuShare: v } } });
  const opt = (v: "booked" | "paid", label: string, sub: string) => (
    <button type="button" onClick={() => set(v)} className="flex-1 rounded-xl border p-4 text-left transition"
      style={share === v ? { borderColor: "#2f6bd8", background: "#eef4fd" } : { borderColor: "var(--line)", background: "var(--panel)" }}>
      <div className="text-[14px] font-extrabold" style={{ color: share === v ? "#1d3a8f" : "var(--ink)" }}>{share === v ? "✓ " : ""}{label}</div>
      <div className="mt-1 text-[12px] text-[var(--ink-3)]">{sub}</div>
    </button>
  );
  return (
    <div>
      <div className="text-[15px] font-extrabold text-[var(--ink)]">{t("meals.menuSharing")}</div>
      <p className="mb-3.5 mt-0.5 text-[12px] text-[var(--ink-3)]">{t("meals.menuSharingDesc")}</p>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        {opt("booked", t("meals.allBookedFamilies"), t("meals.allBookedFamiliesSub"))}
        {opt("paid", t("meals.onlyPaidFamilies"), t("meals.onlyPaidFamiliesSub"))}
      </div>

      <div className="mt-6 border-t border-[var(--line)] pt-4">
        <div className="text-[15px] font-extrabold text-[var(--ink)]">{t("meals.defaultCutoff")}</div>
        <p className="mb-3 mt-0.5 text-[12px] text-[var(--ink-3)]">{t("meals.defaultCutoffDesc")}</p>
        {(() => {
          const when = settings.meals?.cutoffWhen ?? "off";
          return (
            <>
              <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-[var(--ink-2)]">
                <span>{t("meals.orderingCloses")}</span>
                <Select value={when} onChange={(e) => save({ settings: { ...settings, meals: { ...settings.meals, cutoffWhen: e.target.value as "off" | "same" | "prev" | "2days" } } })} className="!py-1.5 !text-[12.5px]">
                  <option value="off">{t("meals.cutoffOff")}</option>
                  <option value="same">{t("meals.cutoffSameMeal")}</option>
                  <option value="prev">{t("meals.cutoffPrev")}</option>
                  <option value="2days">{t("meals.cutoff2days")}</option>
                </Select>
                {when !== "off" && <><span>{t("meals.atWord")}</span><Input type="time" value={settings.meals?.cutoffTime ?? "08:00"} onChange={(e) => save({ settings: { ...settings, meals: { ...settings.meals, cutoffTime: e.target.value } } })} className="!py-1.5 !text-[12.5px]" /></>}
              </div>
              {when === "off" && <p className="mt-1.5 text-[11px] text-[var(--ink-3)]">{t("meals.cutoffNotSet")}</p>}
            </>
          );
        })()}
      </div>

      <div className="mt-6 border-t border-[var(--line)] pt-4">
        <div className="text-[15px] font-extrabold text-[var(--ink)]">{t("meals.allergenDisclaimer")}</div>
        <p className="mb-2 mt-0.5 text-[12px] text-[var(--ink-3)]">{t("meals.allergenDisclaimerDesc")}</p>
        <textarea value={settings.meals?.allergenNote ?? ""} onChange={(e) => save({ settings: { ...settings, meals: { ...settings.meals, allergenNote: e.target.value } } })}
          rows={2} maxLength={300} placeholder={t("meals.allergenPlaceholder")}
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[12.5px] text-[var(--ink)]" />
      </div>

      <div className="mt-6 border-t border-[var(--line)] pt-4">
        <div className="text-[15px] font-extrabold text-[var(--ink)]">{t("meals.mealChangesTitle")}</div>
        <p className="mb-2.5 mt-0.5 text-[12px] text-[var(--ink-3)]">{t("meals.mealChangesDesc")}</p>
        {(() => {
          const mode = settings.meals?.changeApproval ?? "auto";
          const setMode = (v: "review" | "auto") => save({ settings: { ...settings, meals: { ...settings.meals, changeApproval: v } } });
          const card = (v: "review" | "auto", label: string, sub: string) => (
            <button type="button" onClick={() => setMode(v)} className="flex-1 rounded-xl border p-4 text-left transition"
              style={mode === v ? { borderColor: "#2f6bd8", background: "#eef4fd" } : { borderColor: "var(--line)", background: "var(--panel)" }}>
              <div className="text-[14px] font-extrabold" style={{ color: mode === v ? "#1d3a8f" : "var(--ink)" }}>{mode === v ? "✓ " : ""}{label}</div>
              <div className="mt-1 text-[12px] text-[var(--ink-3)]">{sub}</div>
            </button>
          );
          return (
            <div className="flex flex-col gap-2.5 sm:flex-row">
              {card("auto", t("meals.applyStraightAway"), t("meals.applyStraightAwaySub"))}
              {card("review", t("meals.needApproval"), t("meals.needApprovalSub"))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
