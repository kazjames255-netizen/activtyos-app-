"use client";

// The company (head office) dashboard has two faces: the FRANCHISE-COMPARISON
// board when viewing "Head office — all franchises", and the normal operational
// dashboard when drilled into ONE franchise (or the HO's own locations).
import { useHoScope } from "@/components/franchise/HoScope";
import { peekMe } from "@/components/auth/PortalGuard";
import { HoDashboardApp } from "@/features/franchise/HoDashboardApp";
import { DashboardApp } from "@/features/dashboard/DashboardApp";

export function CompanyDashboardSwitch() {
  const scope = useHoScope();
  // Only a head office WITH franchises gets the comparison board. A plain
  // company (schools, multi-site with no franchises) used to land on it too
  // and could never reach its own operational dashboard. Same test as
  // CompanyStaffSwitch.
  const isHoCombined = !scope && !!peekMe()?.hasFranchises;
  return isHoCombined ? <HoDashboardApp /> : <DashboardApp />;
}
