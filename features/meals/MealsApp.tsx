"use client";

import { useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { OperatorPage } from "@/components/OperatorPage";
import { MenuPlanner } from "./MenuPlanner";

// ─────────────────────────────────────────────────────────────────────────
// Meals (operator) — one tabbed workspace: plan a listing's days (Season & listing →
// Menu → Days), plus the Saved-menus library and Menu-sharing setting as tabs.
// Families pick and pay for meals in the booking checkout; this is setup only.
// ─────────────────────────────────────────────────────────────────────────

export function MealsApp() {
  const [canManage, setCanManage] = useState(false);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);

  return (
    <OperatorPage title="Meals" icon="🍽️" lede="Build a menu, plan its dishes onto your listings’ days, and choose who sees it. Families add meals to their basket at checkout.">
      {canManage ? <MenuPlanner /> : (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 text-center text-[12.5px] text-[var(--ink-3)]">Menus are managed by your provider’s admins.</div>
      )}
    </OperatorPage>
  );
}
