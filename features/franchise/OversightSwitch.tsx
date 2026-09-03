"use client";

// In the head-office COMBINED view (all franchises), the safeguarding/medication
// pages become READ-ONLY network oversight (HoOversightApp). Drilled into a
// single franchise — or for a plain company with no franchises — they render the
// normal operator component, scoped to that context.

import { useEffect, useState, type ReactNode } from "react";
import { getMe } from "@/components/auth/PortalGuard";
import { useHoScope } from "@/components/franchise/HoScope";
import { HoOversightApp } from "./HoOversightApp";
import { LogConcernApp } from "@/features/incidents/LogConcernApp";
import { IncidentsApp } from "@/features/incidents/IncidentsApp";
import { MedicationApp } from "@/features/medication/MedicationApp";

function useCombined(): boolean {
  const scope = useHoScope();
  const [ho, setHo] = useState<boolean | null>(null);
  useEffect(() => { getMe().then((m) => setHo(!!m?.hasFranchises)).catch(() => setHo(false)); }, []);
  return ho === true && scope === null;
}

function Switch({ area, operator }: { area: "incidents" | "accidents" | "medication"; operator: ReactNode }) {
  return useCombined() ? <HoOversightApp area={area} /> : <>{operator}</>;
}

export const CompanyIncidents = () => <Switch area="incidents" operator={<LogConcernApp />} />;
export const CompanyAccidents = () => <Switch area="accidents" operator={<IncidentsApp kind="accident" />} />;
export const CompanyMedication = () => <Switch area="medication" operator={<MedicationApp />} />;
