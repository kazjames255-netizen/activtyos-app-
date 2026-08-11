"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { LIGHT_PALETTE } from "@/components/OperatorPage";
import { LocationDetail, type Venue } from "./LocationDetail";

// Demo venues so Deployment is usable before venues are saved. Matches the schedule.
export const DEMO_VENUES: Venue[] = [
  { id: "v-loughton", name: "Loughton Manor First School", address: "Pitchford Avenue, Loughton", city: "Milton Keynes", kind: "place" },
  { id: "v-gullivers", name: "Gullivers Land, Milton Keynes", address: "Livingstone Drive", city: "Milton Keynes", kind: "place" },
  { id: "v-stantonbury", name: "Stantonbury Leisure Centre", address: "Stantonbury", city: "Milton Keynes", kind: "place" },
];

interface Listing { id: string; title?: string; name?: string; venueId?: string | null; seasonId?: string | null; status?: string; visibility?: string; archived?: boolean }
interface LocStaff { id: string; name: string; sites: string[]; role?: string; perm?: string }
const STAFF_KEY = "aos.locstaff.v1";
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const AV_COL = ["#c2268f", "#0f857b", "#2f6bd8", "#c06a10", "#6366f1", "#b45309"];
const avColour = (id: string) => AV_COL[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % AV_COL.length];

// Deployment: who's assigned where + each location's live listings. Click a
// location to manage its staff/roles/scheduling on the detail page (?id=…).
export function LocationsApp({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const id = useSearchParams().get("id");
  const { settings } = useSettings();
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [staff, setStaff] = useState<LocStaff[]>([]);

  const refresh = useCallback(() => {
    apiGet<{ venues?: Venue[] }>("/api/library").then((lib) => setVenues(lib.venues ?? [])).catch(() => setVenues([]));
    apiGet<Listing[]>("/api/listings?mine=1").then(setListings).catch(() => setListings([]));
  }, []);
  useEffect(() => { refresh(); try { const s = JSON.parse(localStorage.getItem(STAFF_KEY) || "null"); if (s?.staff) setStaff(s.staff); } catch { /* ignore */ } }, [refresh]);
  useRealtime(["library"], refresh);

  const list = useMemo(() => (venues && venues.length > 0 ? venues : venues ? DEMO_VENUES : null), [venues]);
  const seasonName = (sid?: string | null) => settings.seasons?.find((s) => s.id === sid)?.name;
  const liveListings = useMemo(() => listings.filter((l) => (l.title || l.name) && (l.status ?? "live") === "live" && (l.visibility ?? "public") === "public" && !l.archived), [listings]);
  const open = (vid: string) => router.push(`${pathname}?id=${encodeURIComponent(vid)}`);

  const detailVenue = list && id ? list.find((v) => v.id === id) : undefined;
  const notDeployed = staff.filter((s) => s.sites.length === 0);

  return (
    <div className={embedded ? "text-[var(--ink)]" : "-m-3 min-h-[calc(100vh-3.5rem)] p-3 text-[var(--ink)] sm:-m-5 sm:p-5"} style={embedded ? undefined : LIGHT_PALETTE}>
      {detailVenue ? <LocationDetail venue={detailVenue} venues={list!} onBack={() => router.push(pathname)} /> : (
      <>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[20px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>Deployment</h2>
          <p className="text-[12.5px] text-[var(--ink-3)]">Where your team works — who&rsquo;s at each location and the listings that run there. Locations &amp; listings are edited in <a href="/company/listings" className="font-bold text-[#1d3a8f] hover:underline">Listings</a>.</p>
        </div>
      </div>

      {!list ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div> : (
        <div className="flex flex-col gap-3">
          {list.map((v) => {
            const here = staff.filter((s) => s.sites.includes(v.id));
            const vListings = liveListings.filter((l) => l.venueId === v.id);
            return (
              <div key={v.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
                <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5">
                  <span className="text-[14px]">📍</span>
                  <span className="text-[15px] font-extrabold text-[var(--ink)]">{v.name}</span>
                  {v.city && <span className="text-[11.5px] text-[var(--ink-3)]">· {v.city}</span>}
                  <button type="button" onClick={() => open(v.id)} className="ml-auto rounded-full bg-[#1d3a8f] px-3.5 py-1.5 text-[12px] font-extrabold text-white hover:brightness-105">Manage staff ›</button>
                </div>
                <div className="grid gap-4 p-4 md:grid-cols-2">
                  {/* staff deployed here */}
                  <div>
                    <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Team here · {here.length}</div>
                    {here.length === 0 ? <p className="text-[12px] text-[var(--ink-3)]">No one assigned yet — open <b>Manage staff</b> to tick this site on for people.</p> : (
                      <div className="flex flex-col gap-1.5">{here.map((s) => (
                        <div key={s.id} className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ background: avColour(s.id) }}>{initials(s.name)}</span>
                          <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-bold text-[var(--ink)]">{s.name}</div><div className="text-[11px] text-[var(--ink-3)]">{s.role ?? "—"} · all listings here</div></div>
                        </div>
                      ))}</div>
                    )}
                  </div>
                  {/* live listings here */}
                  <div>
                    <div className="mb-1.5 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Listings here · {vListings.length}<a href="/company/listings" className="ml-auto normal-case text-[11px] font-bold text-[#1d3a8f] hover:underline">Edit in Listings ›</a></div>
                    {vListings.length === 0 ? <p className="text-[12px] text-[var(--ink-3)]">No live listings run here yet.</p> : (
                      <div className="flex flex-col gap-1.5">{vListings.map((l) => { const sn = seasonName(l.seasonId); return (
                        <div key={l.id} className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5">
                          <span className="text-[13px]">🎟</span>
                          <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-[var(--ink)]">{l.title || l.name}</span>
                          {sn && <span className="flex-none rounded-full bg-white px-2 py-0.5 text-[10.5px] font-bold text-[#1d3a8f]">📅 {sn}</span>}
                        </div>
                      ); })}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* not deployed — access by role only */}
          {notDeployed.length > 0 && (
            <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Not rostered · {notDeployed.length} <span className="font-normal normal-case">— page access by role only, not in the schedule</span></div>
              <div className="flex flex-wrap gap-1.5">{notDeployed.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--panel)] px-2.5 py-1 text-[12px] font-bold text-[var(--ink)]"><span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-extrabold text-white" style={{ background: avColour(s.id) }}>{initials(s.name)}</span>{s.name}{s.role ? ` · ${s.role}` : ""}</span>
              ))}</div>
            </div>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
}
