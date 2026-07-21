"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Card } from "@/components/ui";
import { VenueMap } from "@/features/listings/VenueMap";

interface Venue {
  id: string;
  name: string;
  address: string;
  kind?: "place" | "online";
  facilities?: string[];
  directions?: string;
  what3words?: string;
  transport?: string;
  lat?: number;
  lng?: number;
  zoom?: number;
}

// Read view of the tenant's venues (edited under Listings → Locations). Run-the-day
// wants them in one glance — address, how to get there, the map — without opening
// a listing. The library is the source of truth; this never writes.
export function LocationsApp() {
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    apiGet<{ venues?: Venue[] }>("/api/library").then((lib) => { setVenues(lib.venues ?? []); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["library"], refresh);

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Locations</h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Your venues — address, directions and map. Manage them under Listings → Locations.</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {!venues ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      : venues.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No venues yet — add one under Listings → Locations.</Card>
      : (
        <div className="grid gap-3 md:grid-cols-2">
          {venues.map((v) => (
            <Card key={v.id} className="overflow-hidden p-0">
              {v.kind !== "online" && v.lat !== undefined && v.lng !== undefined && (
                <VenueMap lat={v.lat} lng={v.lng} zoom={v.zoom} height={150} />
              )}
              <div className="p-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-extrabold">{v.name}</span>
                  {v.kind === "online" && <Badge tone={{ bg: "var(--panel)", fg: "var(--ink-2)" }}>online</Badge>}
                </div>
                {v.address && <div className="mt-0.5 text-[12.5px] text-[var(--ink-2)]">{v.address}</div>}
                {v.transport && <div className="mt-1.5 text-[12px]"><span className="text-[var(--ink-3)]">Transport: </span>{v.transport}</div>}
                {v.directions && <div className="mt-1 text-[12px]"><span className="text-[var(--ink-3)]">Directions: </span>{v.directions}</div>}
                {v.what3words && <div className="mt-1 text-[12px]"><span className="text-[var(--ink-3)]">what3words: </span>{`///${v.what3words.replace(/^\/+/, "")}`}</div>}
                {v.facilities && v.facilities.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {v.facilities.map((f, i) => <Badge key={i} tone={{ bg: "var(--panel)", fg: "var(--ink-2)" }}>{f}</Badge>)}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
