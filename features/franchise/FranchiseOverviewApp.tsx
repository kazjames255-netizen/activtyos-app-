"use client";

// Head-office "Franchises" summary — one card per franchise (+ head-office
// direct) showing its key figures (revenue / bookings / families / royalty), the
// listings it runs (with an assign control to move a listing between franchises),
// its territory status, and a drill-in. The single place a franchisor reviews
// "who runs what and how they're doing".

import { useEffect, useMemo, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { money } from "@/features/bookings/helpers";
import { Card } from "@/components/ui";
import { setHoScopeId } from "@/components/franchise/HoScope";

interface TopListing { name: string; bookings: number }
interface TopSeason { name: string; revenue: number; bookings: number }
interface Insights { listingCount: number; topListing: TopListing | null; topSeason: TopSeason | null; avgBooking: number }
interface FrRow extends Insights { franchiseId: string; name: string; area: string | null; revenue: number; bookings: number; collected: number; outstanding: number; royalty: number; families: number; children: number; trendPct: number; openIncidents: number; territory: string; live: boolean; lastBookingAt: string | null }
interface Overview { franchises: FrRow[]; direct: Insights & { revenue: number; bookings: number; collected: number; families: number; children: number; live: boolean } }
interface OwnListing { id: string; name?: string; title?: string; franchiseId?: string | null; location?: string }

const PALETTE = ["#2f6bd8", "#e0483d", "#0f9d58", "#f5b81f", "#8e44ad", "#e67e22", "#16a085", "#c2185b", "#6d4c41", "#0097a7"];

const fmtSince = (iso: string | null) => {
  if (!iso) return "—";
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days}d ago` : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
const trendChip = (pct: number) => pct === 0 ? null : <span className={"text-[11px] font-extrabold " + (pct > 0 ? "text-[#0f7a43]" : "text-[#c0392b]")}>{pct > 0 ? "▲" : "▼"} {Math.abs(pct)}%</span>;

const terrBadge = (s: string) =>
  s === "agreed" ? <span className="rounded-full bg-[#e2f4ea] px-2 py-0.5 text-[10px] font-extrabold text-[#0f7a43]">✓ territory agreed</span>
    : s === "proposed" ? <span className="rounded-full bg-[#fdf0e3] px-2 py-0.5 text-[10px] font-extrabold text-[#b45309]">territory pending</span>
      : <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--ink-3)]">no territory</span>;

export function FranchiseOverviewApp() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [listings, setListings] = useState<OwnListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    apiGet<Overview>("/api/ho/overview").then(setOv).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the network"));
    apiGet<OwnListing[]>("/api/listings?mine=1").then(setListings).catch(() => setListings([]));
  };
  useEffect(() => { load(); }, []);

  const franchises = useMemo(() => (ov?.franchises ?? []).map((f, i) => ({ ...f, color: PALETTE[i % PALETTE.length] })), [ov]);
  const listingsFor = (fid: string | null) => (listings ?? []).filter((l) => (l.franchiseId ?? null) === fid);

  const STAT_STYLE: Record<string, { tone: string; icon: string }> = {
    Revenue: { tone: "#2f6bd8", icon: "💷" },
    Bookings: { tone: "#0d9488", icon: "🎟️" },
    Families: { tone: "#e22295", icon: "👪" },
    Children: { tone: "#f59e0b", icon: "🧒" },
    Collected: { tone: "#16a34a", icon: "✅" },
    Royalty: { tone: "#7c3aed", icon: "％" },
  };
  const Stat = ({ k, v }: { k: string; v: string }) => {
    const s = STAT_STYLE[k] ?? { tone: "#2f6bd8", icon: "" };
    return (
      <div className="relative overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 shadow-sm">
        <span className="absolute inset-y-0 left-0 w-1" style={{ background: s.tone }} />
        <div className="flex items-center gap-1.5 pl-1.5">
          <span className="text-[12px] leading-none" aria-hidden>{s.icon}</span>
          <span className="text-[9px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">{k}</span>
        </div>
        <div className="pl-1.5 text-[17px] font-black leading-tight tabular-nums" style={{ color: s.tone }}>{v}</div>
      </div>
    );
  };

  // Insight chips — the "more information" a franchisor wants at a glance.
  const Insight = ({ icon, k, v, sub }: { icon: string; k: string; v: string; sub?: string }) => (
    <div className="flex items-start gap-2 rounded-lg border border-[var(--line)] px-2.5 py-2">
      <span className="text-[15px] leading-none">{icon}</span>
      <div className="min-w-0"><div className="text-[9.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{k}</div><div className="truncate text-[12.5px] font-extrabold">{v}</div>{sub && <div className="truncate text-[10px] text-[var(--ink-3)]">{sub}</div>}</div>
    </div>
  );

  // Read-only list of the listings a franchise runs (no reassign — too risky here).
  const ListingRows = ({ fid }: { fid: string | null }) => {
    const ls = listingsFor(fid);
    if (!listings) return <div className="py-2 text-[11.5px] text-[var(--ink-3)]">Loading listings…</div>;
    if (ls.length === 0) return <div className="py-2 text-[11.5px] text-[var(--ink-3)]">No listings yet.</div>;
    return (
      <div className="flex flex-wrap gap-1.5">
        {ls.map((l) => (
          <span key={l.id} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11.5px] font-semibold">
            {l.title || l.name || "Untitled listing"}{l.location && <span className="font-normal text-[var(--ink-3)]">· {l.location}</span>}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[#f6f6f8] p-5 text-[#171534]">
      <div className="mx-auto max-w-[1120px]">
        <div className="op-hero relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(0,0,0,.5)]" style={{ background: "var(--hero-grad)" }}>
          <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-[16px]">🏬</span>
            Franchises
          </div>
          <p className="mt-1.5 max-w-[620px] text-[12.5px] leading-[1.5] text-white/80">Every franchise at a glance — what they run, how they&rsquo;re trading, their most popular listing and season. Open any franchise to run it.</p>
        </div>

        {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#e21d27]">{error}</div>}
        {!ov ? (
          <div className="py-16 text-center text-[13px] text-[var(--ink-3)]">Loading franchises…</div>
        ) : franchises.length === 0 ? (
          <Card className="p-10 text-center text-[13px] text-[var(--ink-3)]">No franchises yet. Invite one from <b>Invite franchises</b>.</Card>
        ) : (
          <div className="flex flex-col gap-3">
            {franchises.map((f) => (
              <Card key={f.franchiseId} className="p-4">
                <div className="mb-2.5 flex flex-wrap items-center gap-2">
                  <span className="h-3.5 w-3.5 flex-none rounded-full" style={{ background: f.color }} />
                  <div className="text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{f.name}</div>
                  {f.area && <span className="text-[12px] font-semibold text-[var(--ink-3)]">· {f.area}</span>}
                  {terrBadge(f.territory)}
                  {trendChip(f.trendPct)}
                  {f.openIncidents > 0 && <span className="rounded-full bg-[#fdecec] px-2 py-0.5 text-[10px] font-extrabold text-[#c0392b]">🛡 {f.openIncidents} open</span>}
                  {!f.live && <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-3)]">not trading yet</span>}
                  <button type="button" onClick={() => setHoScopeId(f.franchiseId)} className="ml-auto rounded-full bg-[#171534] px-3.5 py-1.5 text-[11.5px] font-extrabold text-white hover:brightness-125">Open franchise →</button>
                </div>
                <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  <Stat k="Revenue" v={money(f.revenue)} />
                  <Stat k="Bookings" v={String(f.bookings)} />
                  <Stat k="Families" v={String(f.families)} />
                  <Stat k="Children" v={String(f.children)} />
                  <Stat k="Collected" v={money(f.collected)} />
                  <Stat k="Royalty" v={money(f.royalty)} />
                </div>
                <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Insight icon="⭐" k="Most popular" v={f.topListing?.name ?? "—"} sub={f.topListing ? `${f.topListing.bookings} booking${f.topListing.bookings === 1 ? "" : "s"}` : undefined} />
                  <Insight icon="🗓️" k="Top season" v={f.topSeason?.name ?? "—"} sub={f.topSeason ? `${money(f.topSeason.revenue)} · ${f.topSeason.bookings} bkg` : "no seasons set"} />
                  <Insight icon="💷" k="Avg booking" v={money(f.avgBooking)} />
                  <Insight icon="🕒" k="Last booking" v={fmtSince(f.lastBookingAt)} sub={`${f.listingCount} listing${f.listingCount === 1 ? "" : "s"}`} />
                </div>
                <div className="rounded-xl border border-[var(--line)] p-3">
                  <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Listings it runs · {f.listingCount}</div>
                  <ListingRows fid={f.franchiseId} />
                </div>
              </Card>
            ))}

            {/* Head office's own direct operation */}
            <Card className="border-2 border-dashed border-[var(--line)] bg-[var(--panel)] p-4">
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#64748b] text-[12px]">🏛</span>
                <div className="text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Head office <span className="font-normal text-[var(--ink-3)]">· direct</span></div>
                <button type="button" onClick={() => setHoScopeId("__ho__")} className="ml-auto rounded-full bg-[#171534] px-3.5 py-1.5 text-[11.5px] font-extrabold text-white hover:brightness-125">Open →</button>
              </div>
              <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                <Stat k="Revenue" v={money(ov.direct.revenue)} />
                <Stat k="Bookings" v={String(ov.direct.bookings)} />
                <Stat k="Families" v={String(ov.direct.families)} />
                <Stat k="Children" v={String(ov.direct.children)} />
                <Stat k="Collected" v={money(ov.direct.collected)} />
                <Stat k="Royalty" v="—" />
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Insight icon="⭐" k="Most popular" v={ov.direct.topListing?.name ?? "—"} sub={ov.direct.topListing ? `${ov.direct.topListing.bookings} bookings` : undefined} />
                <Insight icon="🗓️" k="Top season" v={ov.direct.topSeason?.name ?? "—"} sub={ov.direct.topSeason ? `${money(ov.direct.topSeason.revenue)} · ${ov.direct.topSeason.bookings} bkg` : "no seasons set"} />
                <Insight icon="💷" k="Avg booking" v={money(ov.direct.avgBooking)} />
                <Insight icon="📋" k="Listings" v={`${ov.direct.listingCount}`} />
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Listings head office runs directly · {ov.direct.listingCount}</div>
                <ListingRows fid={null} />
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
