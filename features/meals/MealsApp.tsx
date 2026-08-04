"use client";

import { useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { OperatorPage, MasterCard } from "@/components/OperatorPage";
import { useSettings } from "@/lib/settings";
import { MenuPlanner } from "./MenuPlanner";
import { SavedMenus } from "./SavedMenus";

// ─────────────────────────────────────────────────────────────────────────
// Meals (operator) — build menus (Saved menus), plan them onto each camp's
// days (Menu planner), and choose who sees the day's menu (Menu sharing).
// Parents pick and pay for meals in the booking checkout; this is the setup
// side only.
// ─────────────────────────────────────────────────────────────────────────

export function MealsApp() {
  const [canManage, setCanManage] = useState(false);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);

  return (
    <OperatorPage title="Meals" icon="🍽️" lede="Build a menu, plan its dishes onto your camps’ days, and choose who sees it. Families add meals to their basket at checkout.">
      {canManage ? (
        <>
          <MenuPlanner />
          <SavedMenus />
          <MenuSharing />
        </>
      ) : (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 text-center text-[12.5px] text-[var(--ink-3)]">Menus are managed by your provider’s admins.</div>
      )}
    </OperatorPage>
  );
}

// Who sees the read-only "what's being served" menu display in the customer
// area. Ordering is always open to booked families at checkout — this only
// gates the informational display.
function MenuSharing() {
  const { settings, save } = useSettings();
  const share = settings.meals?.menuShare ?? "booked";
  const set = (v: "booked" | "paid") => save({ settings: { ...settings, meals: { ...settings.meals, menuShare: v } } });
  const opt = (v: "booked" | "paid", label: string, sub: string) => (
    <button type="button" onClick={() => set(v)} className="flex-1 rounded-xl border p-2.5 text-left"
      style={share === v ? { borderColor: "#2f6bd8", background: "#eef4fd" } : { borderColor: "var(--line)", background: "var(--panel)" }}>
      <div className="text-[12.5px] font-extrabold" style={{ color: share === v ? "#1d3a8f" : "var(--ink)" }}>{share === v ? "✓ " : ""}{label}</div>
      <div className="mt-0.5 text-[11px] text-[var(--ink-3)]">{sub}</div>
    </button>
  );
  return (
    <MasterCard className="mb-4" header={
      <div>
        <div className="flex items-center gap-2 text-[14px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}><span className="text-[15px]">👀</span> Menu sharing</div>
        <div className="mt-0.5 text-[11.5px] text-white/80">Who sees the day’s menu as a “what’s being served” note. Families can add meals at checkout either way.</div>
      </div>
    }>
      <div className="flex flex-col gap-2 sm:flex-row">
        {opt("booked", "All booked families", "Anyone booked on a day can see that day’s menu.")}
        {opt("paid", "Only families who added a meal", "The menu note shows only once a family has bought a meal that day.")}
      </div>
    </MasterCard>
  );
}
