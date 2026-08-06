"use client";

import { useSettings } from "@/lib/settings";
import { Input, Select } from "@/components/ui";

// Who sees the read-only "what's being served" menu display in the customer
// area. Ordering is always open to booked families at checkout — this only
// gates the informational display. Rendered inside the Meals workspace tab.
export function MenuSharing() {
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
      <div className="text-[15px] font-extrabold text-[var(--ink)]">Menu sharing</div>
      <p className="mb-3.5 mt-0.5 text-[12px] text-[var(--ink-3)]">Who sees the day’s menu as a “what’s being served” note in their customer area. Families can add meals at checkout either way.</p>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        {opt("booked", "All booked families", "Anyone booked on a day can see that day’s menu.")}
        {opt("paid", "Only families who added a meal", "The menu note shows only once a family has bought a meal that day.")}
      </div>

      <div className="mt-6 border-t border-[var(--line)] pt-4">
        <div className="text-[15px] font-extrabold text-[var(--ink)]">Default order cut-off</div>
        <p className="mb-3 mt-0.5 text-[12px] text-[var(--ink-3)]">When parents can order each meal until, by default. Every meal plan pre-fills from this — you can override it per listing on its saved plan.</p>
        {(() => {
          const when = settings.meals?.cutoffWhen ?? "off";
          return (
            <>
              <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-[var(--ink-2)]">
                <span>Ordering closes</span>
                <Select value={when} onChange={(e) => save({ settings: { ...settings, meals: { ...settings.meals, cutoffWhen: e.target.value as "off" | "same" | "prev" | "2days" } } })} className="!py-1.5 !text-[12.5px]">
                  <option value="off">anytime — no cut-off</option>
                  <option value="same">the same day as the meal</option>
                  <option value="prev">the day before</option>
                  <option value="2days">2 days before</option>
                </Select>
                {when !== "off" && <><span>at</span><Input type="time" value={settings.meals?.cutoffTime ?? "08:00"} onChange={(e) => save({ settings: { ...settings, meals: { ...settings.meals, cutoffTime: e.target.value } } })} className="!py-1.5 !text-[12.5px]" /></>}
              </div>
              {when === "off" && <p className="mt-1.5 text-[11px] text-[var(--ink-3)]">Not set — parents can order right up to the day of the meal (each listing can still set its own).</p>}
            </>
          );
        })()}
      </div>

      <div className="mt-6 border-t border-[var(--line)] pt-4">
        <div className="text-[15px] font-extrabold text-[var(--ink)]">Allergen disclaimer</div>
        <p className="mb-2 mt-0.5 text-[12px] text-[var(--ink-3)]">A standard note shown to parents on the menu — e.g. cross-contamination. Per-dish allergens are set on each menu.</p>
        <textarea value={settings.meals?.allergenNote ?? ""} onChange={(e) => save({ settings: { ...settings, meals: { ...settings.meals, allergenNote: e.target.value } } })}
          rows={2} maxLength={300} placeholder="e.g. All meals are prepared in a kitchen that handles nuts, gluten and dairy — please speak to us about any allergy."
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[12.5px] text-[var(--ink)]" />
      </div>
    </div>
  );
}
