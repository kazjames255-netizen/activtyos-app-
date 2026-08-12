"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { Input, Select } from "@/components/ui";
import { LIGHT_PALETTE } from "@/components/OperatorPage";
import { LocationDetail, type Venue } from "./LocationDetail";

interface Listing { id: string; title?: string; name?: string; venueId?: string | null; seasonId?: string | null; status?: string; visibility?: string; archived?: boolean }
interface LocStaff { id: string; name: string; role?: string; sites: string[]; listings: string[] }
interface Store { staff: LocStaff[] }
const STAFF_KEY = "aos.locstaff.v2";
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const AV_COL = ["#c2268f", "#0f857b", "#2f6bd8", "#c06a10", "#6366f1", "#b45309"];
const avColour = (id: string) => AV_COL[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % AV_COL.length];
const CHIP_ON = { borderColor: "#22b365", background: "#eef8f1", color: "#0f7a43" } as const;
const CHIP_OFF = { borderColor: "#c9d6ef", background: "white", color: "#1d3a8f" } as const;

// Deployment — move staff around fast. Three views: by location, by staff (A–Z),
// by listing. Assignment = which venues (sites) + which specific listings each
// person works. Turn one on and the schedule offers them for those shifts.
export function LocationsApp({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const id = useSearchParams().get("id");
  const { settings } = useSettings();
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [store, setStore] = useState<Store>({ staff: [] });
  const [view, setView] = useState<"loc" | "staff" | "listing">("loc");
  const [q, setQ] = useState("");
  const [addFor, setAddFor] = useState<string | null>(null); // which location's add-picker is open
  const [addQ, setAddQ] = useState("");

  const refresh = useCallback(() => {
    apiGet<{ venues?: Venue[] }>("/api/library").then((lib) => setVenues(lib.venues ?? [])).catch(() => setVenues([]));
    apiGet<Listing[]>("/api/listings?mine=1").then(setListings).catch(() => setListings([]));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["library"], refresh);

  const list = venues; // real venues from the library (null while loading, [] if none)

  // Load any saved staff assignments (real staff only — no demo seed).
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(STAFF_KEY) || "null"); if (s?.staff) setStore({ staff: s.staff.map((x: LocStaff) => ({ ...x, sites: x.sites ?? [], listings: x.listings ?? [] })) }); } catch { /* ignore */ }
  }, []);

  const persist = (next: Store) => { setStore(next); try { localStorage.setItem(STAFF_KEY, JSON.stringify(next)); } catch { /* ignore */ } };
  const staff = store.staff;
  const upd = (staffId: string, fn: (s: LocStaff) => LocStaff) => persist({ staff: staff.map((s) => (s.id === staffId ? fn(s) : s)) });
  const has = (arr: string[], v: string) => arr.includes(v);
  const flip = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const toggleSite = (sid: string, vid: string) => upd(sid, (s) => ({ ...s, sites: flip(s.sites, vid) }));
  const toggleListing = (sid: string, lid: string) => upd(sid, (s) => ({ ...s, listings: flip(s.listings, lid) }));
  const addSite = (sid: string, vid: string) => upd(sid, (s) => ({ ...s, sites: [...new Set([...s.sites, vid])] }));
  const addListing = (sid: string, lid: string) => upd(sid, (s) => ({ ...s, listings: [...new Set([...s.listings, lid])] }));

  const seasonName = (sid?: string | null) => settings.seasons?.find((s) => s.id === sid)?.name;
  // All the operator's listings (drafts included) minus archived — so a just-created
  // draft still shows here. isLive marks the ones actually published/running.
  const deployListings = useMemo(() => listings.filter((l) => (l.title || l.name) && !l.archived), [listings]);
  const isLive = (l: Listing) => (l.status ?? "live") === "live" && (l.visibility ?? "public") === "public";
  const Draft = ({ l }: { l: Listing }) => (!isLive(l) ? <span className="rounded-full bg-[#fdf0e0] px-1.5 py-0.5 text-[10px] font-bold text-[#a86a00]">Draft</span> : null);
  const lTitle = (l: Listing) => l.title || l.name || "Untitled";
  const open = (vid: string) => router.push(`${pathname}?id=${encodeURIComponent(vid)}`);
  const detailVenue = list && id ? list.find((v) => v.id === id) : undefined;

  const az = useMemo(() => [...staff].sort((a, b) => a.name.localeCompare(b.name)), [staff]);
  const shown = q.trim() ? az.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()) || (s.role ?? "").toLowerCase().includes(q.toLowerCase())) : az;

  return (
    <div className={embedded ? "text-[var(--ink)]" : "-m-3 min-h-[calc(100vh-3.5rem)] p-3 text-[var(--ink)] sm:-m-5 sm:p-5"} style={embedded ? undefined : LIGHT_PALETTE}>
      {detailVenue ? <LocationDetail venue={detailVenue} venues={list!} onBack={() => router.push(pathname)} /> : (
      <>
      <div className="mb-3">
        <h2 className="text-[20px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>Deployment</h2>
        <p className="text-[12.5px] text-[var(--ink-3)]">Move staff across locations &amp; listings — turn one on and the schedule offers them for its shifts. Locations &amp; listings are edited in <a href="/company/listings" className="font-bold text-[#1d3a8f] hover:underline">Listings</a>.</p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl bg-[var(--panel)] p-1">
          {([["loc", "By location"], ["staff", "By staff"], ["listing", "By listing"]] as const).map(([v, lbl]) => (
            <button key={v} type="button" onClick={() => setView(v)} className={"rounded-lg px-3.5 py-1.5 text-[12.5px] font-bold transition-colors " + (view === v ? "bg-white text-[#1d3a8f] shadow-sm" : "text-[var(--ink-2)]")}>{lbl}</button>
          ))}
        </div>
        {view === "staff" && <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Search staff" className="w-[200px] text-[12.5px]" />}
      </div>

      {!list ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>

      /* ── BY LOCATION ── */
      : view === "loc" ? (
        <div className="flex flex-col gap-3">
          {list.length === 0 && <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-center text-[12.5px] text-[var(--ink-3)]">No locations yet — add your venues under <a href="/company/listings" className="font-bold text-[#1d3a8f] hover:underline">Listings → Locations</a>.</div>}
          {list.map((v) => {
            const here = staff.filter((s) => s.sites.includes(v.id));
            const notHere = staff.filter((s) => !s.sites.includes(v.id));
            const vListings = deployListings.filter((l) => l.venueId === v.id);
            return (
              <div key={v.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
                <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5">
                  <span className="text-[14px]">📍</span><span className="text-[15px] font-extrabold text-[var(--ink)]">{v.name}</span>{v.city && <span className="text-[11.5px] text-[var(--ink-3)]">· {v.city}</span>}
                  <span className="ml-auto flex items-center gap-2"><span className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-bold text-[#1d3a8f]">{here.length} deployed</span><button type="button" onClick={() => open(v.id)} className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">Timesheets &amp; alerts ›</button></span>
                </div>
                <div className="grid gap-4 p-4 md:grid-cols-[1.3fr,1fr]">
                  <div>
                    <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Team here</div>
                    <div className="flex flex-col divide-y divide-[var(--line-2,#eef2f8)]">
                      {here.length === 0 && <p className="py-1 text-[12px] text-[var(--ink-3)]">No one yet — add someone below.</p>}
                      {here.map((s) => (
                        <div key={s.id} className="flex items-center gap-2.5 py-2">
                          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ background: avColour(s.id) }}>{initials(s.name)}</span>
                          <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-bold text-[var(--ink)]">{s.name}</div><div className="text-[11px] text-[var(--ink-3)]">{s.role ?? "—"} · all listings here</div></div>
                          <button type="button" onClick={() => toggleSite(s.id, v.id)} title="Remove from this location" className="text-[16px] text-[var(--ink-3)] hover:text-[#c0392b]">×</button>
                        </div>
                      ))}
                    </div>
                    <div className="relative mt-2">
                      <Input value={addFor === v.id ? addQ : ""} onFocus={() => { setAddFor(v.id); setAddQ(""); }} onChange={(e) => { setAddFor(v.id); setAddQ(e.target.value); }} onBlur={() => setTimeout(() => setAddFor((f) => (f === v.id ? null : f)), 150)} placeholder="＋ Add staff — search any name…" className="w-full text-[12.5px]" />
                      {addFor === v.id && (() => {
                        const opts = notHere.filter((s) => !addQ.trim() || s.name.toLowerCase().includes(addQ.toLowerCase()) || (s.role ?? "").toLowerCase().includes(addQ.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
                        return (
                          <div className="absolute left-0 right-0 top-[40px] z-30 max-h-[260px] overflow-y-auto rounded-xl border border-[var(--line)] bg-white shadow-lg">
                            {notHere.length === 0 ? <div className="px-3 py-2.5 text-[12px] text-[var(--ink-3)]">Everyone&rsquo;s already here.</div>
                              : opts.length === 0 ? <div className="px-3 py-2.5 text-[12px] text-[var(--ink-3)]">No staff match “{addQ}”.</div>
                              : opts.map((s) => (
                                <button key={s.id} type="button" onMouseDown={(e) => { e.preventDefault(); addSite(s.id, v.id); setAddFor(null); setAddQ(""); }} className="flex w-full items-center gap-2.5 border-b border-[var(--line-2,#eef2f8)] px-3 py-2 text-left hover:bg-[var(--panel)] last:border-b-0">
                                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[10px] font-extrabold text-white" style={{ background: avColour(s.id) }}>{initials(s.name)}</span>
                                  <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-bold text-[var(--ink)]">{s.name}</span>{s.role && <span className="block text-[10.5px] text-[var(--ink-3)]">{s.role}</span>}</span>
                                  <span className="text-[12px] font-bold text-[#1d3a8f]">Add ›</span>
                                </button>
                              ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Listings here · {vListings.length}<a href="/company/listings" className="ml-auto normal-case text-[11px] font-bold text-[#1d3a8f] hover:underline">Edit in Listings ›</a></div>
                    {vListings.length === 0 ? <p className="text-[12px] text-[var(--ink-3)]">No live listings run here yet.</p> : (
                      <div className="flex flex-col gap-1.5">{vListings.map((l) => { const sn = seasonName(l.seasonId); return (
                        <div key={l.id} className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5"><span className="text-[13px]">🎟</span><span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-[var(--ink)]">{lTitle(l)}</span>{sn && <span className="flex-none rounded-full bg-white px-2 py-0.5 text-[10.5px] font-bold text-[#1d3a8f]">📅 {sn}</span>}<Draft l={l} /></div>
                      ); })}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      /* ── BY STAFF (A–Z) ── */
      ) : view === "staff" ? (
        <div className="flex flex-col gap-2">
          {shown.length === 0 && <p className="py-6 text-center text-[12.5px] text-[var(--ink-3)]">No staff match.</p>}
          {shown.map((s) => {
            const sNone = s.sites.length === 0 && s.listings.length === 0;
            const sAllLoc = list.length > 0 && list.every((v) => s.sites.includes(v.id));
            const sAllList = s.listings.length === 0;
            const sScoped = deployListings.filter((l) => sAllLoc || (l.venueId && s.sites.includes(l.venueId)));
            const summary = sNone ? "Not rostered" : (sAllLoc ? "All locations" : `${s.sites.length} location${s.sites.length === 1 ? "" : "s"}`) + (sAllList ? " · all listings" : ` · ${s.listings.length} listing${s.listings.length === 1 ? "" : "s"}`);
            return (
            <div key={s.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[12px] font-extrabold text-white" style={{ background: avColour(s.id) }}>{initials(s.name)}</span>
                <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-extrabold text-[var(--ink)]">{s.name}</div><div className="text-[11.5px] text-[var(--ink-3)]">{s.role ?? "—"}</div></div>
                <span className="text-[11px] font-bold text-[var(--ink-3)]">{summary}</span>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => upd(s.id, (x) => ({ ...x, sites: list.map((v) => v.id), listings: [] }))} className="rounded-full border-2 px-3 py-1.5 text-[12px] font-extrabold transition-colors" style={!sNone ? CHIP_ON : CHIP_OFF}>{!sNone ? "✓ " : ""}Rostered</button>
                <button type="button" onClick={() => upd(s.id, (x) => ({ ...x, sites: [], listings: [] }))} className="rounded-full border-2 px-3 py-1.5 text-[12px] font-extrabold transition-colors" style={sNone ? { borderColor: "#c06a10", background: "#fbeddb", color: "#8a4a12" } : CHIP_OFF}>{sNone ? "✓ " : ""}None — office / admin</button>
              </div>

              {!sNone && (
                <>
                  <div className="mt-2.5">
                    <div className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">① Locations</div>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => upd(s.id, (x) => ({ ...x, sites: list.map((v) => v.id) }))} className="rounded-full border-2 px-3 py-1.5 text-[12px] font-extrabold transition-colors" style={sAllLoc ? CHIP_ON : CHIP_OFF}>{sAllLoc ? "✓ " : "🌍 "}All locations</button>
                      {list.map((v) => { const on = !sAllLoc && has(s.sites, v.id); return <button key={v.id} type="button" onClick={() => upd(s.id, (x) => ({ ...x, sites: flip(x.sites, v.id) }))} className="rounded-full border-2 px-3 py-1.5 text-[12px] font-extrabold transition-colors" style={on ? CHIP_ON : CHIP_OFF}>{on ? "✓ " : "📍 "}{v.name}</button>; })}
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">② Listings {sAllLoc ? "across all locations" : "at those locations"}</div>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => upd(s.id, (x) => ({ ...x, listings: [] }))} className="rounded-full border-2 px-3 py-1.5 text-[12px] font-extrabold transition-colors" style={sAllList ? CHIP_ON : CHIP_OFF}>{sAllList ? "✓ " : "🎟 "}All listings here</button>
                      {sScoped.map((l) => { const on = !sAllList && has(s.listings, l.id); const sn = seasonName(l.seasonId); return <button key={l.id} type="button" onClick={() => upd(s.id, (x) => ({ ...x, listings: flip(x.listings, l.id) }))} className="inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-[12px] font-extrabold transition-colors" style={on ? CHIP_ON : CHIP_OFF}>{on ? "✓" : "🎟"} {lTitle(l)}{sn && <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-bold" style={{ color: "#1d3a8f" }}>📅 {sn}</span>}<Draft l={l} /></button>; })}
                      {sScoped.length === 0 && <span className="text-[11.5px] text-[var(--ink-3)]">No live listings here — “All listings here” covers whatever runs there.</span>}
                    </div>
                  </div>
                </>
              )}
            </div>
          ); })}
        </div>

      /* ── BY LISTING ── */
      ) : (
        <div className="flex flex-col gap-2">
          {deployListings.length === 0 ? <p className="py-6 text-center text-[12.5px] text-[var(--ink-3)]">No listings yet — create one in <a href="/company/listings" className="font-bold text-[#1d3a8f] hover:underline">Listings</a>.</p> : deployListings.map((l) => {
            const on = staff.filter((s) => s.listings.includes(l.id));
            const off = staff.filter((s) => !s.listings.includes(l.id));
            const sn = seasonName(l.seasonId);
            const venueName = list.find((v) => v.id === l.venueId)?.name;
            return (
              <div key={l.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px]">🎟</span><span className="text-[14px] font-extrabold text-[var(--ink)]">{lTitle(l)}</span><Draft l={l} />
                  {sn && <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10.5px] font-bold text-[#1d3a8f]">📅 {sn}</span>}
                  {venueName && <span className="text-[11.5px] text-[var(--ink-3)]">· 📍 {venueName}</span>}
                  <a href="/company/listings" className="ml-auto text-[11px] font-bold text-[#1d3a8f] hover:underline">Edit in Listings ›</a>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {on.length === 0 && <span className="text-[12px] text-[var(--ink-3)]">No one assigned to this listing yet.</span>}
                  {on.map((s) => (
                    <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-bold" style={CHIP_ON}><span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-extrabold text-white" style={{ background: avColour(s.id) }}>{initials(s.name)}</span>{s.name}<button type="button" onClick={() => toggleListing(s.id, l.id)} title="Remove" className="text-[13px] text-[#0f7a43] hover:text-[#c0392b]">×</button></span>
                  ))}
                </div>
                <Select value="" onChange={(e) => { if (e.target.value) addListing(e.target.value, l.id); }} className="mt-2 w-full max-w-[280px] text-[12.5px]">
                  <option value="">＋ Add staff to this listing…</option>
                  {[...off].sort((a, b) => a.name.localeCompare(b.name)).map((s) => <option key={s.id} value={s.id}>{s.name}{s.role ? ` · ${s.role}` : ""}</option>)}
                </Select>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}
    </div>
  );
}


