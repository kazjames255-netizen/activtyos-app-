"use client";

// The company (head office) "Staff" area has two faces: a lean HEAD-OFFICE team
// & recruitment area when viewing "Head office — all franchises", and the full
// operator Team area (rostering, locations, deployment) when it's a plain
// company or drilled into one franchise / the HO's own locations.
import { useHoScope } from "@/components/franchise/HoScope";
import { peekMe } from "@/components/auth/PortalGuard";
import { HoTeamApp } from "@/features/team/HoTeamApp";
import { TeamApp } from "@/features/team/TeamApp";

export function CompanyStaffSwitch() {
  const scope = useHoScope();
  const isHoCombined = !scope && !!peekMe()?.hasFranchises;
  return isHoCombined ? <HoTeamApp /> : <TeamApp />;
}
