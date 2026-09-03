"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { OperatorPage } from "@/components/OperatorPage";
import { getMe } from "@/components/auth/PortalGuard";
import { MenuPlanner } from "./MenuPlanner";

// ─────────────────────────────────────────────────────────────────────────
// Meals (operator) — one tabbed workspace: plan a listing's days (Season & listing →
// Menu → Days), plus the Saved-menus library and Menu-sharing setting as tabs.
// Families pick and pay for meals in the booking checkout; this is setup only.
// ─────────────────────────────────────────────────────────────────────────

export function MealsApp() {
  const t = useT();
  // null = still resolving the role. Start there (not `false`) so operators
  // don't flash the "managed by admins" read-only message before /api/me lands.
  const [canManage, setCanManage] = useState<boolean | null>(null);
  useEffect(() => { getMe().then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => setCanManage(false)); }, []);

  return (
    <OperatorPage title={t("meals.title")} icon="🍽️" lede={t("meals.lede")}>
      {canManage === null ? (
        <div className="p-6 text-center text-[12.5px] text-[var(--ink-3)]">…</div>
      ) : canManage ? <MenuPlanner /> : (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 text-center text-[12.5px] text-[var(--ink-3)]">{t("meals.managedByAdmins")}</div>
      )}
    </OperatorPage>
  );
}
