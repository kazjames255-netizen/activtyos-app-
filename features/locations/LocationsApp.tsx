"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Card } from "@/components/ui";
import { LIGHT_PALETTE } from "@/components/OperatorPage";
import { VenueMap } from "@/features/listings/VenueMap";
import { LocationDetail, type Venue } from "./LocationDetail";

// A demo set so the Locations area is usable before any venues are saved in the
// library. Matches the sites used by the staff schedule.
const DEMO_VENUES: Venue[] = [
  { id: "v-loughton", name: "Loughton Manor First School", address: "Pitchford Avenue, Loughton", city: "Milton Keynes", kind: "place" },
  { id: "v-gullivers", name: "Gullivers Land, Milton Keynes", address: "Livingstone Drive", city: "Milton Keynes", kind: "place" },
  { id: "v-stantonbury", name: "Stantonbury Leisure Centre", address: "Stantonbury", city: "Milton Keynes", kind: "place" },
];

// Read view of the tenant's venues (edited under Listings → Locations). Click a
// venue to manage its staff, roles and scheduling on the detail page (?id=…).
export function LocationsApp({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const id = useSearchParams().get("id");
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    apiGet<{ venues?: Venue[] }>("/api/library").then((lib) => { setVenues(lib.venues ?? []); setError(null); }).catch(() => { setVenues([]); });
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["library"], refresh);

  // Fall back to the demo set only when the library has none.
  const list = useMemo(() => (venues && venues.length > 0 ? venues : venues ? DEMO_VENUES : null), [venues]);
  const open = (vid: string) => router.push(`${pathname}?id=${encodeURIComponent(vid)}`);

  const detailVenue = list && id ? list.find((v) => v.id === id) : undefined;

  return (
    <div className={embedded ? "text-[var(--ink)]" : "-m-3 min-h-[calc(100vh-3.5rem)] p-3 text-[var(--ink)] sm:-m-5 sm:p-5"} style={embedded ? undefined : LIGHT_PALETTE}>
      {detailVenue ? <LocationDetail venue={detailVenue} venues={list!} onBack={() => router.push(pathname)} /> : (
      <>
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Locations</h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Your venues — click one to manage its staff, roles and scheduling. Address, directions and map are edited under Listings → Locations.</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {!list ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((v) => (
            <Card key={v.id} className="overflow-hidden p-0">
              {v.kind !== "online" && v.lat !== undefined && v.lng !== undefined && <VenueMap lat={v.lat} lng={v.lng} zoom={v.zoom} height={150} />}
              <div className="p-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-extrabold">{v.name}</span>
                  {v.kind === "online" && <Badge tone={{ bg: "var(--panel)", fg: "var(--ink-2)" }}>online</Badge>}
                </div>
                {v.address && <div className="mt-0.5 text-[12.5px] text-[var(--ink-2)]">{v.address}{v.city ? `, ${v.city}` : ""}</div>}
                {v.facilities && v.facilities.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">{v.facilities.map((f, i) => <Badge key={i} tone={{ bg: "var(--panel)", fg: "var(--ink-2)" }}>{f}</Badge>)}</div>
                )}
                <button type="button" onClick={() => open(v.id)} className="mt-3 rounded-full bg-[#1d3a8f] px-4 py-2 text-[12.5px] font-extrabold text-white hover:brightness-105">Manage staff &amp; setup ›</button>
              </div>
            </Card>
          ))}
        </div>
      )}
      </>
      )}
    </div>
  );
}

