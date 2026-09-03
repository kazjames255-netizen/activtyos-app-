"use client";

// The company (head office) "Finance" view has two faces: a single simplified
// head-office Finance page (P&L + royalty income + breakdown by franchise) when
// viewing "Head office — all franchises", and the full per-site Finance hub when
// it's a plain company or drilled into one franchise / the HO's own locations.
import { useHoScope } from "@/components/franchise/HoScope";
import { peekMe } from "@/components/auth/PortalGuard";
import { HoFinanceApp } from "@/features/franchise/HoFinanceApp";
import { FinanceAnalyticsApp } from "@/features/money/FinanceAnalyticsApp";

export function CompanyFinanceSwitch() {
  const scope = useHoScope();
  const isHoCombined = !scope && !!peekMe()?.hasFranchises;
  return isHoCombined ? <HoFinanceApp /> : <FinanceAnalyticsApp />;
}
