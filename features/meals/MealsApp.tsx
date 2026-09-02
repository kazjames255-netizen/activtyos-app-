"use client";

import { useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import { OperatorPage } from "@/components/OperatorPage";
import { MenuPlanner } from "./MenuPlanner";

// ─────────────────────────────────────────────────────────────────────────
// Meals (operator) — one tabbed workspace: plan a listing's days (Season & listing →
// Menu → Days), plus the Saved-menus library and Menu-sharing setting as tabs.
// Families pick and pay for meals in the booking checkout; this is setup only.
// ─────────────────────────────────────────────────────────────────────────

export function MealsApp() {
  const t = useT();
  const [canManage, setCanManage] = useState(false);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);

  return (
    <OperatorPage title={t("meals.title")} icon="🍽️" lede={t("meals.lede")}>
      {canManage ? <MenuPlanner /> : (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 text-center text-[12.5px] text-[var(--ink-3)]">{t("meals.managedByAdmins")}</div>
      )}
    </OperatorPage>
  );
}
