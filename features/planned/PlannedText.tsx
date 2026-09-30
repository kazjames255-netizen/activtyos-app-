"use client";

import { useT } from "@/lib/i18n/provider";

// Tiny client islands so the server-rendered <Planned> page can still show its fixed wording in the visitor's language.
export function PlannedBadge() {
  const t = useT();
  return <>{t("p8ops.plPlanned")}</>;
}
export function PlannedNote() {
  const t = useT();
  return <>{t("p8ops.plNote")}</>;
}
export function PlannedUntil() {
  const t = useT();
  return <>{t("p8ops.plUntil")}</>;
}
