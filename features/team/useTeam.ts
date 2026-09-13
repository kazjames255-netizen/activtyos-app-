"use client";

import { useEffect, useState } from "react";
import { get as apiGet, isDemoMode } from "@/lib/api";
import { DEMO_STAFF } from "@/features/learning/credentials";

export type TeamMember = (typeof DEMO_STAFF)[number];
/** The people onboarding is FOR: this provider's joined staff (the demo cast
 *  only in demo mode — it used to be shown to every real provider). */
export function useTeam(): TeamMember[] {
  const [team, setTeam] = useState<TeamMember[]>(() => (isDemoMode() ? DEMO_STAFF : []));
  useEffect(() => {
    if (isDemoMode()) return;
    Promise.all([
      apiGet<{ franchiseId: string | null }>("/api/me"),
      apiGet<{ role: string; usedBy: string | null; status?: string; name?: string | null; sentTo?: string | null; jobTitle?: string | null; staffRole?: string | null; franchiseId?: string | null }[]>("/api/invites"),
    ])
      .then(([me, list]) => {
        const seen = new Set<string>();
        const people = list
          // Head office onboards its own staff; each franchise its own.
          .filter((i) => i.role === "staff" && i.usedBy && i.status !== "deactivated" && (i.franchiseId ?? null) === (me.franchiseId ?? null))
          .map((i) => ({ name: (i.name || i.sentTo || "").trim(), role: i.jobTitle || i.staffRole || "", op: "", dbs: "", pfa: "" }))
          .filter((p) => p.name && !seen.has(p.name.toLowerCase()) && seen.add(p.name.toLowerCase()));
        setTeam(people);
      })
      .catch(() => {});
  }, []);
  return team;
}

