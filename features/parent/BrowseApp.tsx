"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Card } from "@/components/ui";
import type { ListingSummary } from "./types";
import { CroppedImage } from "@/features/listings/ListingWizard";

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;

// The distinct categories across the live listings on show, as a natural phrase
// for the header — "Breakfast Clubs, Holiday Camps and After-School Clubs". So
// the wording always reflects what's actually bookable rather than a fixed
// "Camps and clubs", which it falls back to when nothing's tagged.
function liveCategories(listings: ListingSummary[] | null): string {
  const seen: string[] = [];
  for (const l of listings ?? [])
    for (const c of l.categories ?? []) {
      const name = c.trim();
      if (name && !seen.some((s) => s.toLowerCase() === name.toLowerCase())) seen.push(name);
    }
  if (!seen.length) return "Camps and clubs";
  const capped = seen.slice(0, 4);
  const extra = seen.length - capped.length;
  const parts = extra > 0 ? [...capped, `${extra} more`] : capped;
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

const fmtDay = (iso?: string) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : null;

// The age band a listing accepts, worded for either or both ends being open.
function agesLabel(l: ListingSummary): string | null {
  const { ageFrom, ageTo } = l;
  if (ageFrom == null && ageTo == null) return null;
  if (ageFrom != null && ageTo != null) return `Ages ${ageFrom}–${ageTo}`;
  return ageFrom != null ? `Ages ${ageFrom}+` : `Up to age ${ageTo}`;
}

// Its run window — earliest block start to latest block end.
function dateRange(l: ListingSummary): string | null {
  const starts = (l.blocks ?? []).map((b) => b.startDate).filter(Boolean).sort();
  const ends = (l.blocks ?? []).map((b) => b.endDate).filter(Boolean).sort();
  const from = fmtDay(starts[0]);
  if (!from) return null;
  const until = fmtDay(ends[ends.length - 1]);
  return until && until !== from ? `${from} – ${until}` : from;
}

type LatLng = { lat: number; lng: number };
// Radius options in miles; 0 = any distance.
const RADII = [0, 1, 3, 5, 10, 25];

// Great-circle distance in miles.
function haversineMi(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

// A UK postcode pulled out of a free-text venue address, so a venue that wasn't
// geocoded when it was saved can still be placed for distance search.
const ukPostcode = (s?: string | null): string | null =>
  s?.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i)?.[0] ?? null;

/** custdash/browse — parents browse the provider's listings and book. */
export function BrowseApp() {
  const [listings, setListings] = useState<ListingSummary[] | null>(null);
  // The providers this parent belongs to. Phase 1 is single-provider: a parent
  // sees only their own provider's activities, never a cross-provider
  // marketplace. That opens up in Phase 2 behind a per-provider opt-in toggle
  // in the ActivityOS area (see handoff §X) — until then this scopes the feed.
  const [providers, setProviders] = useState<{ tenantId: string; name: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Captured once per mount — the server enforces opensAt regardless.
  const [now] = useState(() => Date.now());
  const router = useRouter();
  // Browse filters — the manual's customer browse offers search + category +
  // location. "" = no filter (show all).
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [locFilter, setLocFilter] = useState("");
  const [childAge, setChildAge] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [availOnly, setAvailOnly] = useState(false);
  const [duration, setDuration] = useState(""); // "" | "single" | "week"
  const [whenF, setWhenF] = useState(""); // "" | "week" | "month"
  const [sort, setSort] = useState("relevance"); // relevance | price-asc | price-desc | soonest
  // Distance search: the parent's coordinates (from their onboarding postcode —
  // never asked here), a radius, and a cache of venue coordinates geocoded from
  // their postcodes (for venues the operator never geocoded).
  const [myCoords, setMyCoords] = useState<LatLng | null>(null);
  const [radius, setRadius] = useState(0);
  const [geoBusy, setGeoBusy] = useState(false);
  const [venueGeo, setVenueGeo] = useState<Record<string, LatLng | null>>({});
  const geoReqRef = useRef<Set<string>>(new Set());

  const loadListings = useCallback(() => {
    apiGet<ListingSummary[]>("/api/listings")
      .then(setListings)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load activities"));
  }, []);

  useEffect(() => {
    loadListings();
    apiGet<{ tenantId: string; name: string }[]>("/api/my/providers")
      .then((p) => setProviders(p ?? []))
      .catch(() => setProviders([]));
    // Locate the parent from the postcode they gave at signup — no typing here.
    apiGet<{ postcode?: string | null }>("/api/me")
      .then((m) => {
        const pc = m?.postcode?.trim();
        if (!pc) return;
        setGeoBusy(true);
        return apiGet<{ lat: number; lng: number }[]>(`/api/geo/search?q=${encodeURIComponent(pc)}`)
          .then((hits) => hits?.[0] && setMyCoords({ lat: hits[0].lat, lng: hits[0].lng }))
          .finally(() => setGeoBusy(false));
      })
      .catch(() => {});
  }, [loadListings]);
  useRealtime(["listings", "blocks"], loadListings);

  // Geocode the postcode of any venue that has no stored coordinates, once, so
  // its distance can be worked out. Venues geocoded at save time skip this.
  useEffect(() => {
    if (!listings) return;
    for (const l of listings) {
      if (l.lat != null && l.lng != null) continue;
      const pc = ukPostcode(l.address);
      if (!pc || geoReqRef.current.has(pc)) continue;
      geoReqRef.current.add(pc);
      apiGet<{ lat: number; lng: number }[]>(`/api/geo/search?q=${encodeURIComponent(pc)}`)
        .then((hits) => setVenueGeo((m) => ({ ...m, [pc]: hits?.[0] ? { lat: hits[0].lat, lng: hits[0].lng } : null })))
        .catch(() => setVenueGeo((m) => ({ ...m, [pc]: null })));
    }
  }, [listings]);

  if (error) {
    return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  }
  if (!listings || providers === null) {
    return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading activities…</div>;
  }

  // Phase 1: a parent's Browse is single-provider — only the activities of the
  // provider(s) this family is actually linked to (anyone they've booked / were
  // invited by), never the cross-provider marketplace. The server's feed also
  // includes marketplace-opted providers, so we scope it to the parent's own
  // providers here. (Cross-provider is Phase 2, behind a per-provider opt-in.)
  const providerIds = new Set(providers.map((p) => p.tenantId));
  const visible = providerIds.size ? listings.filter((l) => providerIds.has(l.tenantId)) : listings;
  const listedProviders = new Set(visible.map((l) => l.tenantId));
  const providerName = listedProviders.size === 1 && providers.length === 1 ? providers[0].name : null;

  // Distance from the parent to a listing's venue, or null if either end has no
  // coordinates (venue not geocoded / no postcode, or no postcode entered).
  const coordsOf = (l: ListingSummary): LatLng | null => {
    if (l.lat != null && l.lng != null) return { lat: l.lat, lng: l.lng };
    const pc = ukPostcode(l.address);
    return pc ? venueGeo[pc] ?? null : null;
  };
  const distanceOf = (l: ListingSummary): number | null => {
    const c = coordsOf(l);
    return myCoords && c ? haversineMi(myCoords, c) : null;
  };

  // Filter dropdowns only offer categories and locations that actually exist on
  // the provider's live listings — no empty options. Location groups by
  // town/city where the operator set one, falling back to venue name.
  const placeOf = (l: ListingSummary) => l.city || l.location || null;
  const fromPrice = (l: ListingSummary) => (l.passes.length ? Math.min(...l.passes.map((p) => p.price)) : 0);
  const firstStartMs = (l: ListingSummary) => {
    const s = (l.blocks ?? []).map((b) => b.startDate).filter(Boolean).sort()[0];
    return s ? new Date(`${s}T00:00:00Z`).getTime() : Infinity;
  };
  const runsWithin = (l: ListingSummary, days: number) => {
    const end = now + days * 86_400_000;
    return (l.blocks ?? []).some((b) => {
      const s = new Date(`${b.startDate}T00:00:00Z`).getTime();
      const e = new Date(`${b.endDate}T23:59:59Z`).getTime();
      return s <= end && e >= now;
    });
  };
  const hasPlaces = (l: ListingSummary) => (l.blocks ?? []).some((b) => b.open);
  const ageFits = (l: ListingSummary) => {
    const a = parseInt(childAge, 10);
    if (Number.isNaN(a)) return true;
    // ageFrom/ageTo can arrive as strings from the feed — coerce before comparing.
    const lo = Number(l.ageFrom);
    const hi = Number(l.ageTo);
    return a >= (Number.isNaN(lo) ? 0 : lo) && a <= (Number.isNaN(hi) ? 99 : hi);
  };

  const allCats = [...new Set(visible.flatMap((l) => l.categories ?? []))].sort();
  const allLocs = [...new Set(visible.map(placeOf).filter((v): v is string => !!v))].sort();
  const filtered = visible.filter((l) => {
    if (catFilter && !(l.categories ?? []).includes(catFilter)) return false;
    if (locFilter && placeOf(l) !== locFilter) return false;
    if (radius > 0 && myCoords) {
      const d = distanceOf(l);
      if (d == null || d > radius) return false;
    }
    if (!ageFits(l)) return false;
    if (maxPrice.trim() && fromPrice(l) > Number(maxPrice)) return false;
    if (availOnly && !hasPlaces(l)) return false;
    if (duration === "single" && !(l.passes ?? []).some((p) => (p.days ?? 1) <= 1)) return false;
    if (duration === "week" && !(l.passes ?? []).some((p) => (p.days ?? 0) >= 5)) return false;
    if (whenF === "week" && !runsWithin(l, 7)) return false;
    if (whenF === "month" && !runsWithin(l, 31)) return false;
    if (q.trim()) {
      const hay = `${l.title ?? ""} ${l.name} ${l.location ?? ""} ${l.city ?? ""}`.toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });
  // Sort: explicit choice wins; otherwise nearest first when we know where the
  // parent is, else leave the feed order.
  const shown = [...filtered];
  if (sort === "price-asc") shown.sort((a, b) => fromPrice(a) - fromPrice(b));
  else if (sort === "price-desc") shown.sort((a, b) => fromPrice(b) - fromPrice(a));
  else if (sort === "soonest") shown.sort((a, b) => firstStartMs(a) - firstStartMs(b));
  else if (myCoords) shown.sort((a, b) => (distanceOf(a) ?? Infinity) - (distanceOf(b) ?? Infinity));
  const filtersActive = !!(
    q.trim() || catFilter || locFilter || childAge.trim() || maxPrice.trim() ||
    availOnly || duration || whenF || (radius > 0 && myCoords)
  );
  const pill = "rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--ink-2)] shadow-[0_2px_8px_-4px_rgba(29,58,143,.25)] outline-none transition-colors hover:border-[#1d3a8f] focus:border-[#1d3a8f]";

  if (!visible.length) {
    return (
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
        <div className="relative mb-4 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)" }}>
          <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🔎</span>Browse activities
          </div>
        </div>
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
          No activities to show right now. New providers appear here as they join the marketplace &mdash; or open a
          booking link a provider shared with you to get started.
        </Card>
      </div>
    );
  }

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {/* Hero — same blue/white bar as the rest of the app. */}
      <div className="relative mb-4 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)" }}>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🔎</span>Browse activities
        </div>
        <p className="mt-1.5 max-w-[640px] text-[12.5px] leading-[1.5] text-white/85">
          {providerName ? `${providerName} — ` : ""}{liveCategories(visible)} with places available — book directly from here.
        </p>
      </div>

      {/* Search + category + location, matching the manual's customer browse.
          Each dropdown only appears once there's something to filter by. */}
      {visible.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[190px] flex-1">
            <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[12px] text-[var(--ink-3)]">🔍</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or venue…"
              className="w-full rounded-full border border-[var(--line)] bg-[var(--surface)] py-2 pl-9 pr-3.5 text-[12.5px] shadow-[0_2px_8px_-4px_rgba(29,58,143,.25)] outline-none transition-colors focus:border-[#1d3a8f]" />
          </div>
          {allCats.length > 0 && (
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className={pill} aria-label="Filter by category">
              <option value="">All categories</option>
              {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {allLocs.length > 0 && (
            <select value={locFilter} onChange={(e) => setLocFilter(e.target.value)} className={pill} aria-label="Filter by location">
              <option value="">All locations</option>
              {allLocs.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          )}
          {/* Distance filter — appears once we've located the parent from their
              onboarding postcode. */}
          {myCoords && (
            <select value={radius} onChange={(e) => setRadius(Number(e.target.value))} className={pill} aria-label="Distance from you">
              {RADII.map((r) => <option key={r} value={r}>{r === 0 ? "Any distance" : `📍 Within ${r} mi`}</option>)}
            </select>
          )}
          {geoBusy && <span className="text-[11px] text-[var(--ink-3)]">Finding activities near you…</span>}
        </div>
      )}

      {/* Row 2 — child's age, price, length, when, availability, and sort. */}
      {visible.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <select value={childAge} onChange={(e) => setChildAge(e.target.value)} className={pill} aria-label="Child's age">
            <option value="">Any age</option>
            {Array.from({ length: 16 }, (_, i) => i + 2).map((a) => <option key={a} value={a}>🎂 Age {a}</option>)}
          </select>
          <select value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={pill} aria-label="Max price">
            <option value="">Any price</option>
            {[25, 50, 75, 100, 150, 200, 300].map((p) => <option key={p} value={p}>Up to £{p}</option>)}
          </select>
          <select value={duration} onChange={(e) => setDuration(e.target.value)} className={pill} aria-label="Length">
            <option value="">Any length</option>
            <option value="single">Single day</option>
            <option value="week">Full week</option>
          </select>
          <select value={whenF} onChange={(e) => setWhenF(e.target.value)} className={pill} aria-label="When">
            <option value="">Any time</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </select>
          <label className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--ink-2)]">
            <input type="checkbox" checked={availOnly} onChange={(e) => setAvailOnly(e.target.checked)} /> Places left only
          </label>
          <span className="ml-auto flex items-center gap-1.5 text-[12px] text-[var(--ink-3)]">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value)} className={pill} aria-label="Sort by">
              <option value="relevance">{myCoords ? "Nearest" : "Featured"}</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="soonest">Starting soonest</option>
            </select>
          </span>
          {filtersActive && (
            <button type="button" onClick={() => { setQ(""); setCatFilter(""); setLocFilter(""); setRadius(0); setChildAge(""); setMaxPrice(""); setAvailOnly(false); setDuration(""); setWhenF(""); }}
              className="text-[12px] font-bold text-[var(--brand-2,#2f6bd8)]">Clear all</button>
          )}
        </div>
      )}

      {shown.length === 0 && (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
          {filtersActive ? "No activities match your filters — try clearing them." : "No activities with places available right now — check back soon."}
        </Card>
      )}
      <div className="grid gap-3.5 lg:grid-cols-2">
        {shown.map((l) => {
          const from = l.passes.length ? Math.min(...l.passes.map((p) => p.price)) : 0;
          const hero = l.images?.[0];
          const opensLater = !!l.opensAt && new Date(l.opensAt).getTime() > now;
          const dist = distanceOf(l);
          return (
            <Card key={l.id} className="overflow-hidden p-0">
              {/* Frosted-panel card: title, provider and from-price sit on a
                  translucent navy band over the 16:9 image (cover-cropped to the
                  focal point). Details and one blue "More details" CTA below. */}
              <button type="button" onClick={() => router.push(`/book/${l.id}`)} className="relative block w-full overflow-hidden" aria-label={`More details — ${l.name}`}>
                {hero ? (
                  <CroppedImage im={hero} className="w-full" style={{ aspectRatio: "16 / 9" }} />
                ) : (
                  <div className="flex w-full items-center justify-center text-[26px] text-white/85" style={{ aspectRatio: "16 / 9", background: "linear-gradient(135deg,#1d3a8f,#2f6bd8 70%,#5b8af0)" }}>🎪</div>
                )}
                {opensLater && (
                  <span className="absolute right-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-[4px] text-[11px] font-bold text-[#9a3412]">
                    ⏰ Opens {new Date(l.opensAt!).toLocaleString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 px-3.5 py-2.5 text-left" style={{ background: "rgba(23,35,90,.62)" }}>
                  <div className="truncate text-[15px] font-extrabold text-white">{l.title || l.name}</div>
                  <div className="truncate text-[11.5px] text-[#cdddf7]">{l.tenantName} · from {money(from)}</div>
                </div>
              </button>
              <div className="p-4">
                {(l.location || agesLabel(l) || dateRange(l) || dist != null) && (
                  <div className="flex flex-col gap-1.5 text-[12px] text-[var(--ink-2)]">
                    {l.location && (
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span aria-hidden>📍</span>
                        <span className="truncate"><span className="font-semibold text-[var(--ink)]">{l.location}</span>{l.address ? <span className="text-[var(--ink-3)]"> · {l.address}</span> : null}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {dist != null && <span className="flex items-center gap-1.5 font-semibold text-[#1d3a8f]"><span aria-hidden>🧭</span>{dist < 10 ? dist.toFixed(1) : Math.round(dist)} mi away</span>}
                      {agesLabel(l) && <span className="flex items-center gap-1.5"><span aria-hidden>🎂</span>{agesLabel(l)}</span>}
                      {dateRange(l) && <span className="flex items-center gap-1.5"><span aria-hidden>📅</span>{dateRange(l)}</span>}
                    </div>
                  </div>
                )}
                <button type="button" onClick={() => router.push(`/book/${l.id}`)} className="mt-3 w-full rounded-lg bg-[var(--brand-2,#2f6bd8)] py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90">
                  More details
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
