"use client";

import { useSettings } from "@/lib/settings";

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
    </div>
  );
}
