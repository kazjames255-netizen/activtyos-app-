"use client";

// The company (head office) dashboard has two faces: the FRANCHISE-COMPARISON
// board when viewing "Head office — all franchises", and the normal operational
// dashboard when drilled into ONE franchise (or the HO's own locations).
import { useHoScope } from "@/components/franchise/HoScope";
import { HoDashboardApp } from "@/features/franchise/HoDashboardApp";
import { DashboardApp } from "@/features/dashboard/DashboardApp";

export function CompanyDashboardSwitch() {
  const scope = useHoScope();
  return scope ? <DashboardApp /> : <HoDashboardApp />;
}
