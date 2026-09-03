"use client";

// Front-end nudge: when a FRANCHISE picks a listing venue that falls outside its
// agreed territory, warn. Only fires when a territory is actually set (it's
// optional). This is UX only — the authoritative block is server-side (Amir).

import { useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { pointInAnyArea, type TerritoryAreaGeo } from "@/lib/geo";

interface Props {
  venue: { lat?: number; lng?: number; name?: string } | null;
}

export function TerritoryVenueWarning({ venue }: Props) {
  const [terr, setTerr] = useState<{ role: string; areas: TerritoryAreaGeo[]; status?: string } | null>(null);
  useEffect(() => {
    apiGet<{ role: string; franchiseTerritory?: { areas: TerritoryAreaGeo[]; status?: string } | null }>("/api/account")
      .then((a) => setTerr({ role: a.role, areas: a.franchiseTerritory?.areas ?? [], status: a.franchiseTerritory?.status }))
      .catch(() => {});
  }, []);

  if (!terr || terr.role !== "franchise" || terr.areas.length === 0) return null; // not a franchise, or no territory set → no restriction
  if (!venue || typeof venue.lat !== "number" || typeof venue.lng !== "number") return null; // no coordinates to test
  if (pointInAnyArea({ lat: venue.lat, lng: venue.lng }, terr.areas)) return null; // inside — all good

  return (
    <div className="mb-3 max-w-[520px] rounded-lg border border-[#f0d9a8] bg-[#fdf6e3] px-3 py-2 text-[12px] leading-snug text-[#7a5b06]">
      ⚠ <b>{venue.name || "This venue"}</b> looks <b>outside your territory</b>
      {terr.status === "agreed" ? " agreed with your head office" : " (still pending head office agreement)"}. Check with your head office before running services here.
    </div>
  );
}
