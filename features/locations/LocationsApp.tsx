"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePortalHref } from "@/lib/portal-href";
import { get as apiGet, isDemoMode } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { Input, Select } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import { pickPlural } from "@/lib/i18n/plural";
import { Rich } from "@/features/setup/Rich";
import { LIGHT_PALETTE, SettingsLink } from "@/components/OperatorPage";
import { Tile, GRAD } from "@/features/money/finance-kit";
import { LocationDetail, type Venue } from "./LocationDetail";
import { fetchDeployment, resolveDeployment, saveDeployment, type LocStaff } from "./locStaff";

interface Listing { id: string; title?: string; name?: string; venueId?: string | null; seasonId?: string | null; status?: string; visibility?: string; archived?: boolean }
interface Store { staff: LocStaff[] }
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const AV_COL = ["#c2268f", "#0f857b", "#2f6bd8", "#c06a10", "#6366f1", "#b45309"];
const avColour = (id: string) => AV_COL[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % AV_COL.length];
const CHIP_ON = { borderColor: "#22b365", background: "#eef8f1", color: "#0f7a43" } as const;
const CHIP_OFF = { borderColor: "#c9d6ef", background: "white", color: "#1d3a8f" } as const;

// Pretend deployed team for the guided-tour demo only (venue/listing ids match
// the staff-tour fixtures). One person is left unassigned so the tour can show
// adding + assigning to a location and its listings.
const DEMO_DEPLOY: LocStaff[] = [
  { id: "d-alex", name: "Alex Rivera", role: "Site Manager", sites: ["v-mk"], listings: ["l1", "l3"] },
  { id: "d-priya", name: "Priya Shah", role: "First Aider", sites: ["v-mk"], listings: ["l1"] },
  { id: "d-sam", name: "Sam Patel", role: "Play Leader", sites: ["v-bl"], listings: ["l2"] },
  { id: "d-jordan", name: "Jordan Lee", role: "Activity Instructor", sites: ["v-mk", "v-bl"], listings: ["l1", "l2"] },
  { id: "d-grace", name: "Grace Bennett", role: "Coach", sites: [], listings: [] },
];

// Deployment — move staff around fast. Three views: by location, by staff (A–Z),
// by listing. Assignment = which venues (sites) + which specific listings each
// person works. Turn one on and the schedule offers them for those shifts.
// Saved on the server (/api/location-staff, see ./locStaff) — the team is the
// provider's joined staff, first placed where their invite said.
export function LocationsApp({ embedded = false }: { embedded?: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const portalHref = usePortalHref();
  const id = useSearchParams().get("id");
  const { settings } = useSettings();
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [store, setStore] = useState<Store>({ staff: [] });
  const [view, setView] = useState<"loc" | "staff" | "listing">("loc");
  const [q, setQ] = useState("");
  const [addFor, setAddFor] = useState<string | null>(null); // which location's add-picker is open
  const [addQ, setAddQ] = useState("");
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const refresh = useCallback(() => {
    apiGet<{ venues?: Venue[] }>("/api/library").then((lib) => setVenues(lib.venues ?? [])).catch(() => setVenues([]));
    apiGet<Listing[]>("/api/listings?mine=1").then(setListings).catch(() => setListings([]));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["library"], refresh);

  const list = venues; // real venues from the library (null while loading, [] if none)

  // The saved deployment + the real team (no demo seed), UNLESS we're inside a
  // guided-tour iframe (demo mode), where we seed a small pretend team so the
  // walkthrough can show deploying and assigning to listings.
  useEffect(() => {
    if (isDemoMode()) { setStore({ staff: DEMO_DEPLOY }); return; }
    // Locations + listings alongside: an invite's "all locations" / listings need them to place someone.
    Promise.all([fetchDeployment(), apiGet<{ venues?: Venue[] }>("/api/library"), apiGet<Listing[]>("/api/listings?mine=1")])
      .then(([raw, lib, ls]) => setStore({ staff: resolveDeployment(raw, (lib.venues ?? []).map((v) => v.id), ls) }))
      .catch((e) => setSaveErr(t("p8set.lcLoadErr", { msg: e instanceof Error ? e.message : t("p8set.lcCheckConn") })));
  }, []);

  const persist = (next: Store) => {
    setStore(next);
    if (isDemoMode()) return;
    saveDeployment(next.staff, (err) => setSaveErr(err ? t("p8set.lcSaveErr", { err }) : null));
  };
  const staff = store.staff;
  // Touching someone places them (they're no longer "not set up").
  const upd = (staffId: string, fn: (s: LocStaff) => LocStaff) => persist({ staff: staff.map((s) => (s.id === staffId ? { ...fn(s), unset: undefined } : s)) });
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
  const Draft = ({ l }: { l: Listing }) => (!isLive(l) ? <span className="rounded-full bg-[#fdf0e0] px-1.5 py-0.5 text-[10px] font-bold text-[#a86a00]">{t("p8set.lcDraft")}</span> : null);
  const lTitle = (l: Listing) => l.title || l.name || t("p8set.lcUntitled");
  const open = (vid: string) => router.push(`${pathname}?id=${encodeURIComponent(vid)}`);
  const detailVenue = list && id ? list.find((v) => v.id === id) : undefined;

  const az = useMemo(() => [...staff].sort((a, b) => a.name.localeCompare(b.name)), [staff]);
  const shown = q.trim() ? az.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()) || (s.role ?? "").toLowerCase().includes(q.toLowerCase())) : az;

  return (
    <div className={embedded ? "text-[var(--ink)]" : "-m-3 min-h-[calc(100vh-3.5rem)] p-3 text-[var(--ink)] sm:-m-5 sm:p-5"} style={embedded ? undefined : LIGHT_PALETTE}>
      {detailVenue ? <LocationDetail venue={detailVenue} venues={list!} onBack={() => router.push(pathname)} /> : (
      <>
      {!embedded && <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-[20px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{t("p8set.lcDeployment")}</h2><SettingsLink tone="light" /></div>}
      {/* Summary tiles — the flat page needed a top-line at a glance. */}
      <div className="mb-3 grid grid-cols-3 gap-2.5">
        <Tile label={t("p8set.lcLocations")} icon="📍" grad={GRAD.teal} value={String(list?.length ?? 0)} sub={t("p8set.lcVenuesYouRun")} />
        <Tile label={t("p8set.lcStaffDeployed")} icon="👥" grad={GRAD.violet} value={String(staff.filter((s) => s.sites.length > 0).length)} sub={t("p8set.lcOfTeam", { n: staff.length })} />
        <Tile label={t("p8set.lcListings")} icon="🎫" grad={GRAD.blue} value={String(deployListings.length)} sub={t("p8set.lcActiveProg")} />
      </div>
      <p className="mb-3 text-[12.5px] text-[var(--ink-3)]"><Rich k="p8set.lcIntro" slots={{}} /></p>
      {saveErr && <p className="mb-3 rounded-lg bg-[#fdecec] px-3 py-2 text-[12px] font-bold text-[#c0392b]">⚠ {saveErr}</p>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl bg-[var(--panel)] p-1">
          {([["loc", t("p8set.lcByLocation")], ["staff", t("p8set.lcByStaff")], ["listing", t("p8set.lcByListing")]] as const).map(([v, lbl]) => (
            <button key={v} type="button" onClick={() => setView(v)} className={"rounded-lg px-3.5 py-1.5 text-[12.5px] font-bold transition-colors " + (view === v ? "bg-white text-[#1d3a8f] shadow-sm" : "text-[var(--ink-2)]")}>{lbl}</button>
          ))}
        </div>
        {view === "staff" && <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("p8set.lcSearchStaff")} className="w-[200px] text-[12.5px]" />}
      </div>

      {!list ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8set.loading")}</div>

      /* ── BY LOCATION ── */
      : view === "loc" ? (
        <div className="flex flex-col gap-3">
          {list.length === 0 && <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-center text-[12.5px] text-[var(--ink-3)]"><Rich k="p8set.lcNoLocations" slots={{}} /></div>}
          {list.map((v) => {
            const here = staff.filter((s) => s.sites.includes(v.id));
            const notHere = staff.filter((s) => !s.sites.includes(v.id));
            const vListings = deployListings.filter((l) => l.venueId === v.id);
            return (
              <div key={v.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
                <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5">
                  <span className="text-[14px]">📍</span><span className="text-[15px] font-extrabold text-[var(--ink)]">{v.name}</span>{v.city && <span className="text-[11.5px] text-[var(--ink-3)]">· {v.city}</span>}
                  <span className="ms-auto flex items-center gap-2"><span className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-bold text-[#1d3a8f]">{t("p8set.lcDeployedN", { n: here.length })}</span><button type="button" onClick={() => open(v.id)} className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{t("p8set.lcTimesheetsAlerts")}</button></span>
                </div>
                <div className="grid gap-4 p-4 md:grid-cols-[1.3fr,1fr]">
                  <div>
                    <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8set.lcTeamHere")}</div>
                    <div className="flex flex-col divide-y divide-[var(--line-2,#eef2f8)]">
                      {here.length === 0 && <p className="py-1 text-[12px] text-[var(--ink-3)]">{t("p8set.lcNoOneYet")}</p>}
                      {here.map((s) => (
                        <div key={s.id} className="flex items-center gap-2.5 py-2">
                          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ background: avColour(s.id) }}>{initials(s.name)}</span>
                          <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-bold text-[var(--ink)]">{s.name}</div><div className="text-[11px] text-[var(--ink-3)]">{s.role ?? "—"} · {t("p8set.lcAllListingsHere")}</div></div>
                          <button type="button" onClick={() => toggleSite(s.id, v.id)} title={t("p8set.lcRemoveLoc")} className="text-[16px] text-[var(--ink-3)] hover:text-[#c0392b]">×</button>
                        </div>
                      ))}
                    </div>
                    <div className="relative mt-2">
                      <Input value={addFor === v.id ? addQ : ""} onFocus={() => { setAddFor(v.id); setAddQ(""); }} onChange={(e) => { setAddFor(v.id); setAddQ(e.target.value); }} onBlur={() => setTimeout(() => setAddFor((f) => (f === v.id ? null : f)), 150)} placeholder={t("p8set.lcAddStaffPh")} className="w-full text-[12.5px]" />
                      {addFor === v.id && (() => {
                        const opts = notHere.filter((s) => !addQ.trim() || s.name.toLowerCase().includes(addQ.toLowerCase()) || (s.role ?? "").toLowerCase().includes(addQ.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
                        return (
                          <div className="absolute start-0 end-0 top-[40px] z-30 max-h-[260px] overflow-y-auto rounded-xl border border-[var(--line)] bg-white shadow-lg">
                            {notHere.length === 0 ? <div className="px-3 py-2.5 text-[12px] text-[var(--ink-3)]">{t("p8set.lcAllHere")}</div>
                              : opts.length === 0 ? <div className="px-3 py-2.5 text-[12px] text-[var(--ink-3)]">{t("p8set.lcNoMatchQ", { q: addQ })}</div>
                              : opts.map((s) => (
                                <button key={s.id} type="button" onMouseDown={(e) => { e.preventDefault(); addSite(s.id, v.id); setAddFor(null); setAddQ(""); }} className="flex w-full items-center gap-2.5 border-b border-[var(--line-2,#eef2f8)] px-3 py-2 text-start hover:bg-[var(--panel)] last:border-b-0">
                                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[10px] font-extrabold text-white" style={{ background: avColour(s.id) }}>{initials(s.name)}</span>
                                  <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-bold text-[var(--ink)]">{s.name}</span>{s.role && <span className="block text-[10.5px] text-[var(--ink-3)]">{s.role}</span>}</span>
                                  <span className="text-[12px] font-bold text-[#1d3a8f]">{t("p8set.lcAdd")}</span>
                                </button>
                              ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8set.lcListingsHereN", { n: vListings.length })}<a href={portalHref("/listings")} className="ms-auto normal-case text-[11px] font-bold text-[#1d3a8f] hover:underline">{t("p8set.lcEditInListings")}</a></div>
                    {vListings.length === 0 ? <p className="text-[12px] text-[var(--ink-3)]">{t("p8set.lcNoLiveHere")}</p> : (
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
          {shown.length === 0 && <p className="py-6 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8set.lcNoStaffMatch")}</p>}
          {shown.map((s) => {
            const sNone = s.sites.length === 0 && s.listings.length === 0;
            const sAllLoc = list.length > 0 && list.every((v) => s.sites.includes(v.id));
            const sAllList = s.listings.length === 0;
            const sScoped = deployListings.filter((l) => sAllLoc || (l.venueId && s.sites.includes(l.venueId)));
            const summary = s.unset ? t("p8set.lcNotPlaced") : sNone ? t("p8set.lcNotRostered") : (sAllLoc ? t("p8set.lcAllLocs") : pickPlural(t, locale, "p8set.lcNLocs", s.sites.length)) + (sAllList ? t("p8set.lcAllListingsSfx") : ` · ${pickPlural(t, locale, "p8set.lcNListings", s.listings.length)}`);
            return (
            <div key={s.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[12px] font-extrabold text-white" style={{ background: avColour(s.id) }}>{initials(s.name)}</span>
                <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-extrabold text-[var(--ink)]">{s.name}</div><div className="text-[11.5px] text-[var(--ink-3)]">{s.role ?? "—"}</div></div>
                <span className="text-[11px] font-bold text-[var(--ink-3)]">{summary}</span>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => upd(s.id, (x) => ({ ...x, sites: list.map((v) => v.id), listings: [] }))} className="rounded-full border-2 px-3 py-1.5 text-[12px] font-extrabold transition-colors" style={!sNone ? CHIP_ON : CHIP_OFF}>{!sNone ? "✓ " : ""}{t("p8set.lcRostered")}</button>
                <button type="button" onClick={() => upd(s.id, (x) => ({ ...x, sites: [], listings: [] }))} className="rounded-full border-2 px-3 py-1.5 text-[12px] font-extrabold transition-colors" style={sNone && !s.unset ? { borderColor: "#c06a10", background: "#fbeddb", color: "#8a4a12" } : CHIP_OFF}>{sNone && !s.unset ? "✓ " : ""}{t("p8set.lcNoneOffice")}</button>
              </div>

              {!sNone && (
                <>
                  <div className="mt-2.5">
                    <div className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8set.lcStep1")}</div>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => upd(s.id, (x) => ({ ...x, sites: list.map((v) => v.id) }))} className="rounded-full border-2 px-3 py-1.5 text-[12px] font-extrabold transition-colors" style={sAllLoc ? CHIP_ON : CHIP_OFF}>{sAllLoc ? "✓ " : "🌍 "}{t("p8set.lcAllLocs")}</button>
                      {list.map((v) => { const on = !sAllLoc && has(s.sites, v.id); return <button key={v.id} type="button" onClick={() => upd(s.id, (x) => ({ ...x, sites: flip(x.sites, v.id) }))} className="rounded-full border-2 px-3 py-1.5 text-[12px] font-extrabold transition-colors" style={on ? CHIP_ON : CHIP_OFF}>{on ? "✓ " : "📍 "}{v.name}</button>; })}
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{sAllLoc ? t("p8set.lcStep2Across") : t("p8set.lcStep2At")}</div>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => upd(s.id, (x) => ({ ...x, listings: [] }))} className="rounded-full border-2 px-3 py-1.5 text-[12px] font-extrabold transition-colors" style={sAllList ? CHIP_ON : CHIP_OFF}>{sAllList ? "✓ " : "🎟 "}{t("p8set.lcAllListingsBtn")}</button>
                      {sScoped.map((l) => { const on = !sAllList && has(s.listings, l.id); const sn = seasonName(l.seasonId); return <button key={l.id} type="button" onClick={() => upd(s.id, (x) => ({ ...x, listings: flip(x.listings, l.id) }))} className="inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-[12px] font-extrabold transition-colors" style={on ? CHIP_ON : CHIP_OFF}>{on ? "✓" : "🎟"} {lTitle(l)}{sn && <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-bold" style={{ color: "#1d3a8f" }}>📅 {sn}</span>}<Draft l={l} /></button>; })}
                      {sScoped.length === 0 && <span className="text-[11.5px] text-[var(--ink-3)]">{t("p8set.lcNoLiveCovers")}</span>}
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
          {deployListings.length === 0 ? <p className="py-6 text-center text-[12.5px] text-[var(--ink-3)]"><Rich k="p8set.lcNoListingsYet" slots={{}} /></p> : deployListings.map((l) => {
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
                  <a href={portalHref("/listings")} className="ms-auto text-[11px] font-bold text-[#1d3a8f] hover:underline">{t("p8set.lcEditInListings")}</a>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {on.length === 0 && <span className="text-[12px] text-[var(--ink-3)]">{t("p8set.lcNoOneAssigned")}</span>}
                  {on.map((s) => (
                    <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-bold" style={CHIP_ON}><span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-extrabold text-white" style={{ background: avColour(s.id) }}>{initials(s.name)}</span>{s.name}<button type="button" onClick={() => toggleListing(s.id, l.id)} title={t("p8set.lcRemove")} className="text-[13px] text-[#0f7a43] hover:text-[#c0392b]">×</button></span>
                  ))}
                </div>
                <Select value="" onChange={(e) => { if (e.target.value) addListing(e.target.value, l.id); }} className="mt-2 w-full max-w-[280px] text-[12.5px]">
                  <option value="">{t("p8set.lcAddStaffListing")}</option>
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


