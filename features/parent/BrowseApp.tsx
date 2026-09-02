"use client";
// i18n + browse filters (age/season/date/distance), collapsible filter card,
// price-basis, discount ribbon + payment chips. (touch to force clean recompile)

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useT } from "@/lib/i18n/provider";
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
  const t = useT();
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
  const [seasonF, setSeasonF] = useState("");
  // The filter bar folds into the title card (open/close), remembered per browser.
  const [filtersOpen, setFiltersOpen] = useState(true);
  useEffect(() => { try { if (localStorage.getItem("aos.browse.filters") === "0") setFiltersOpen(false); } catch { /* storage off */ } }, []);
  useEffect(() => { try { localStorage.setItem("aos.browse.filters", filtersOpen ? "1" : "0"); } catch { /* storage off */ } }, [filtersOpen]);
  const [childAge, setChildAge] = useState("");
  // The family's own children's ages — powers the "my children's ages" filter.
  const [kidAges, setKidAges] = useState<number[]>([]);
  const [myKidsOnly, setMyKidsOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState("");
  const [availOnly, setAvailOnly] = useState(false);
  const [duration, setDuration] = useState(""); // "" | "single" | "week"
  const [whenF, setWhenF] = useState(""); // "" | "week" | "month"
  const [onDate, setOnDate] = useState(""); // YYYY-MM-DD — a specific day the child is free
  const [sort, setSort] = useState("relevance"); // relevance | price-asc | price-desc | soonest
  // Distance search: the parent's coordinates (from their onboarding postcode —
  // never asked here), a radius, and a cache of venue coordinates geocoded from
  // their postcodes (for venues the operator never geocoded).
  const [myCoords, setMyCoords] = useState<LatLng | null>(null);
  const [myPostcode, setMyPostcode] = useState("");
  // Which cards have their extra offers expanded (best offer shown by default so
  // every card is the same height).
  const [offersOpen, setOffersOpen] = useState<Set<string>>(new Set());
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
        setMyPostcode(pc.toUpperCase());
        setGeoBusy(true);
        return apiGet<{ lat: number; lng: number }[]>(`/api/geo/search?q=${encodeURIComponent(pc)}`)
          .then((hits) => hits?.[0] && setMyCoords({ lat: hits[0].lat, lng: hits[0].lng }))
          .finally(() => setGeoBusy(false));
      })
      .catch(() => {});
  }, [loadListings]);
  useRealtime(["listings", "blocks"], loadListings);

  // The family's children, so parents can filter to activities that accept their
  // own kids' ages. Age comes straight off the record, or is worked out from DOB.
  useEffect(() => {
    apiGet<{ age?: number; dob?: string }[]>("/api/my/children")
      .then((kids) => {
        const today = new Date();
        const ages = (kids ?? []).map((c) => {
          if (typeof c.age === "number") return c.age;
          if (c.dob) {
            const d = new Date(c.dob);
            if (!Number.isNaN(d.getTime())) {
              let a = today.getFullYear() - d.getFullYear();
              const m = today.getMonth() - d.getMonth();
              if (m < 0 || (m === 0 && today.getDate() < d.getDate())) a--;
              return a;
            }
          }
          return null;
        }).filter((a): a is number => a != null && a >= 0);
        setKidAges([...new Set(ages)].sort((a, b) => a - b));
      })
      .catch(() => setKidAges([]));
  }, []);

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
    return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">{t("parent.loadingActivities")}</div>;
  }

  // Phase 1: a parent's Browse is single-provider — only the activities of the
  // provider(s) this family is actually linked to (anyone they've booked / were
  // invited by), never the cross-provider marketplace. The server's feed also
  // includes marketplace-opted providers, so we scope it to the parent's own
  // providers here. (Cross-provider is Phase 2, behind a per-provider opt-in.)
  const providerIds = new Set(providers.map((p) => p.tenantId));
  // Always scope to the parent's own providers — no "show everything" fallback.
  // If we can't resolve a provider yet, they see the empty state, never another
  // provider's catalogue (that would break Phase-1 single-provider scoping).
  const visible = listings.filter((l) => providerIds.has(l.tenantId));
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
  // Average session length (hours) from the block session times — lets us label a
  // "from" price with its BASIS so a 1-hour club (£6/session) isn't mistaken for a
  // full-day camp (£40/day). Prices differ by duration, so always show the unit.
  const sessionHrs = (l: ListingSummary): number | null => {
    const durs = (l.blocks ?? []).flatMap((b) => (b.sessions ?? []).map((s) => {
      const a = /^(\d{1,2}):(\d{2})/.exec(s.start); const z = /^(\d{1,2}):(\d{2})/.exec(s.end);
      if (!a || !z) return null;
      const mins = (Number(z[1]) * 60 + Number(z[2])) - (Number(a[1]) * 60 + Number(a[2]));
      return mins > 0 ? mins / 60 : null;
    })).filter((x): x is number => x != null);
    return durs.length ? durs.reduce((s, n) => s + n, 0) / durs.length : null;
  };
  const priceBasis = (l: ListingSummary): string => {
    const cheapest = l.passes.length ? l.passes.reduce((m, p) => (p.price < m.price ? p : m)) : null;
    const d = cheapest?.days ?? 1;
    if (d >= 5) return t("parent.perWeek");
    if (d > 1) return t("parent.perNDays", { n: d });
    const h = sessionHrs(l);
    if (h != null && h <= 3) return t("parent.perSession");
    return t("parent.perDay");
  };
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
  // Does the listing actually run on a specific date? Prefer real session dates;
  // fall back to the block's date span for listings with no session breakdown.
  const runsOn = (l: ListingSummary, ymd: string) => (l.blocks ?? []).some((b) => {
    const sessions = b.sessions ?? [];
    if (sessions.length) return sessions.some((s) => s.date === ymd);
    return (b.startDate ?? "") <= ymd && ymd <= (b.endDate ?? "");
  });
  const hasPlaces = (l: ListingSummary) => (l.blocks ?? []).some((b) => b.open);
  // Does a given age fall inside a listing's accepted range? (feed values can be
  // strings, so coerce; missing bound = open-ended.)
  const ageInRange = (l: ListingSummary, a: number) => {
    const lo = Number(l.ageFrom);
    const hi = Number(l.ageTo);
    return a >= (Number.isNaN(lo) ? 0 : lo) && a <= (Number.isNaN(hi) ? 99 : hi);
  };
  const ageFits = (l: ListingSummary) => {
    const a = parseInt(childAge, 10);
    if (Number.isNaN(a)) return true;
    return ageInRange(l, a);
  };
  // "My children's ages" — keep listings that accept AT LEAST ONE of my kids'
  // ages, PLUS listings whose provider allows out-of-range children (they can
  // still attend by request — see allowOutOfRange, enforced at checkout).
  const fitsMyKids = (l: ListingSummary) => !myKidsOnly || !kidAges.length
    || kidAges.some((a) => ageInRange(l, a)) || !!l.allowOutOfRange;

  const allCats = [...new Set(visible.flatMap((l) => l.categories ?? []))].sort();
  const allLocs = [...new Set(visible.map(placeOf).filter((v): v is string => !!v))].sort();
  const allSeasons = [...new Set(visible.map((l) => l.season).filter((v): v is string => !!v))].sort();
  const filtered = visible.filter((l) => {
    if (catFilter && !(l.categories ?? []).includes(catFilter)) return false;
    if (locFilter && placeOf(l) !== locFilter) return false;
    if (seasonF && l.season !== seasonF) return false;
    if (radius > 0 && myCoords) {
      const d = distanceOf(l);
      if (d == null || d > radius) return false;
    }
    if (!ageFits(l)) return false;
    if (!fitsMyKids(l)) return false;
    if (maxPrice.trim() && fromPrice(l) > Number(maxPrice)) return false;
    if (availOnly && !hasPlaces(l)) return false;
    // Length filter uses the SAME session/day/week vocabulary as the prices.
    // A single-day pass is a "session" when its sessions are short (≤3h, e.g. an
    // after-school club) and a "day" when they run longer (a full-day camp).
    if (duration === "session" && !(l.passes ?? []).some((p) => (p.days ?? 1) <= 1 && (sessionHrs(l) ?? 4) <= 3)) return false;
    if (duration === "day" && !(l.passes ?? []).some((p) => (p.days ?? 1) <= 1 && (sessionHrs(l) ?? 4) > 3)) return false;
    if (duration === "week" && !(l.passes ?? []).some((p) => (p.days ?? 0) >= 5)) return false;
    if (whenF === "week" && !runsWithin(l, 7)) return false;
    if (whenF === "month" && !runsWithin(l, 31)) return false;
    if (onDate && !runsOn(l, onDate)) return false;
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
  const activeFilters = [q.trim(), catFilter, locFilter, seasonF, childAge.trim(), maxPrice.trim(), availOnly, myKidsOnly, duration, whenF, onDate, radius > 0 && !!myCoords];
  const activeCount = activeFilters.filter(Boolean).length;
  const filtersActive = activeCount > 0;
  const pill = "rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--ink-2)] shadow-[0_2px_8px_-4px_rgba(29,58,143,.25)] outline-none transition-colors hover:border-[#1d3a8f] focus:border-[#1d3a8f]";

  if (!visible.length) {
    return (
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
        <div className="relative mb-4 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 100%)" }}>
          <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🔎</span>{t("parent.browseActivitiesTitle")}
          </div>
        </div>
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
          {t("parent.noActivitiesToShow")}
        </Card>
      </div>
    );
  }

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {/* Title card — the whole filter bar folds inside it (open/close), like the
          company Registers card. Choice remembered per browser. */}
      <div className="mb-4 overflow-hidden rounded-2xl shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]">
        <div className="relative p-5 text-white" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 100%)" }}>
          <button type="button" onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen}
            className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-white/25">
            🔧 {filtersOpen ? t("parent.hideFilters") : t("parent.showFilters")}{!filtersOpen && filtersActive ? ` · ${activeCount}` : ""}
            <span className="text-[9px]" aria-hidden>{filtersOpen ? "▲" : "▼"}</span>
          </button>
          <div className="flex items-center gap-2 pr-32 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🔎</span>{t("parent.browseActivitiesTitle")}
          </div>
          <p className="mt-1.5 max-w-[640px] text-[12.5px] leading-[1.5] text-white/85">
            {providerName ? `${providerName} — ` : ""}{liveCategories(visible)}{t("parent.withPlacesAvailable")}
          </p>
        </div>
        {filtersOpen && (
        <div className="border-t border-[var(--line)] bg-[var(--surface)] p-4 pb-1">

      {/* Search + category + location, matching the manual's customer browse.
          Each dropdown only appears once there's something to filter by. */}
      {visible.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[190px] flex-1">
            <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[12px] text-[var(--ink-3)]">🔍</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("parent.searchNameVenue")}
              className="w-full rounded-full border border-[var(--line)] bg-[var(--surface)] py-2 pl-9 pr-3.5 text-[12.5px] shadow-[0_2px_8px_-4px_rgba(29,58,143,.25)] outline-none transition-colors focus:border-[#1d3a8f]" />
          </div>
          {allCats.length > 0 && (
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className={pill} aria-label={t("parent.filterByCategory")}>
              <option value="">{t("parent.allCategories")}</option>
              {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {allLocs.length > 0 && (
            <select value={locFilter} onChange={(e) => setLocFilter(e.target.value)} className={pill} aria-label={t("parent.filterByLocation")}>
              <option value="">{t("parent.allLocations")}</option>
              {allLocs.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          )}
          {allSeasons.length > 0 && (
            <select value={seasonF} onChange={(e) => setSeasonF(e.target.value)} className={pill} aria-label={t("parent.filterBySeason")}>
              <option value="">{t("parent.allSeasons")}</option>
              {allSeasons.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {/* Distance filter — appears once we've located the parent from their
              onboarding postcode. The caption makes clear it's from THEIR address. */}
          {myCoords && (
            <span className="inline-flex items-center gap-1.5" title={`${t("parent.distancesFromAddress")}${myPostcode ? ` (${myPostcode})` : ""}`}>
              <select value={radius} onChange={(e) => setRadius(Number(e.target.value))} className={pill} aria-label={t("parent.distanceFromYou")}>
                {RADII.map((r) => <option key={r} value={r}>{r === 0 ? t("parent.anyDistance") : t("parent.withinMi", { r })}</option>)}
              </select>
              <span className="whitespace-nowrap text-[11px] text-[var(--ink-3)]">📍 {t("parent.fromMyAddress")}{myPostcode ? ` (${myPostcode})` : ""}</span>
            </span>
          )}
          {geoBusy && <span className="text-[11px] text-[var(--ink-3)]">{t("parent.findingNearYou")}</span>}
        </div>
      )}

      {/* Row 2 — child's age, price, length, when, availability, and sort. */}
      {visible.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <select value={childAge} onChange={(e) => setChildAge(e.target.value)} className={pill} aria-label={t("parent.childsAge")}>
            <option value="">{t("parent.anyAge")}</option>
            {Array.from({ length: 16 }, (_, i) => i + 2).map((a) => <option key={a} value={a}>{t("parent.ageOption", { a })}</option>)}
          </select>
          {kidAges.length > 0 && (
            <button
              type="button"
              onClick={() => setMyKidsOnly((v) => !v)}
              title={t("parent.myKidsAgesHint")}
              className={"rounded-full px-3.5 py-2 text-[12.5px] font-bold transition-colors " + (myKidsOnly ? "text-white" : "border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[#1d3a8f]")}
              style={myKidsOnly ? { background: "#1d3a8f" } : undefined}
            >
              {myKidsOnly ? "✓ " : "👧 "}{t("parent.myKidsAges")}
            </button>
          )}
          <select value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={pill} aria-label={t("parent.maxPrice")} title={t("parent.priceFilterHint")}>
            <option value="">{t("parent.anyPrice")}</option>
            {[25, 50, 75, 100, 150, 200, 300].map((p) => <option key={p} value={p}>{t("parent.upToPrice", { p })}</option>)}
          </select>
          <select value={duration} onChange={(e) => setDuration(e.target.value)} className={pill} aria-label={t("parent.lengthLabel")}>
            <option value="">{t("parent.anyLength")}</option>
            <option value="session">{t("parent.singleSession")}</option>
            <option value="day">{t("parent.singleDay")}</option>
            <option value="week">{t("parent.fullWeek")}</option>
          </select>
          <select value={whenF} onChange={(e) => { setWhenF(e.target.value); if (e.target.value) setOnDate(""); }} className={pill} aria-label={t("parent.whenLabel")}>
            <option value="">{t("parent.anyTime")}</option>
            <option value="week">{t("parent.thisWeek")}</option>
            <option value="month">{t("parent.thisMonth")}</option>
          </select>
          {/* Or pick an exact day the child is free — filters to listings running that date. */}
          <input
            type="date"
            value={onDate}
            min={new Date(now).toISOString().slice(0, 10)}
            onChange={(e) => { setOnDate(e.target.value); if (e.target.value) setWhenF(""); }}
            className={pill}
            aria-label={t("parent.onDate")}
            title={t("parent.onDateHint")}
          />
          {onDate && (
            <button type="button" onClick={() => setOnDate("")} className="text-[12px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)]" aria-label={t("parent.clearDate")}>✕</button>
          )}
          <label className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--ink-2)]">
            <input type="checkbox" checked={availOnly} onChange={(e) => setAvailOnly(e.target.checked)} /> {t("parent.placesLeftOnly")}
          </label>
          <span className="ml-auto flex items-center gap-1.5 text-[12px] text-[var(--ink-3)]">
            {t("parent.sortLabel")}
            <select value={sort} onChange={(e) => setSort(e.target.value)} className={pill} aria-label={t("parent.sortBy")}>
              <option value="relevance">{myCoords ? t("parent.nearest") : t("parent.featured")}</option>
              <option value="price-asc">{t("parent.priceLowHigh")}</option>
              <option value="price-desc">{t("parent.priceHighLow")}</option>
              <option value="soonest">{t("parent.startingSoonest")}</option>
            </select>
          </span>
          {filtersActive && (
            <button type="button" onClick={() => { setQ(""); setCatFilter(""); setLocFilter(""); setSeasonF(""); setRadius(0); setChildAge(""); setMaxPrice(""); setAvailOnly(false); setMyKidsOnly(false); setDuration(""); setWhenF(""); setOnDate(""); }}
              className="text-[12px] font-bold text-[var(--brand-2,#2f6bd8)]">{t("parent.clearAll")}</button>
          )}
        </div>
      )}

      {/* When filtering by the family's ages, explain that out-of-range-friendly
          listings are included too (allowOutOfRange — accepted as a request). */}
      {myKidsOnly && kidAges.length > 0 && (
        <div className="mt-1 rounded-xl border border-[#cfe0f7] bg-[#eef5ff] px-3.5 py-2.5 text-[12px] leading-[1.5] text-[#1d3a8f]">
          👧 {t("parent.myKidsAgesNote")}
        </div>
      )}
        </div>
        )}
      </div>

      {shown.length === 0 && (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
          {filtersActive ? t("parent.noActivitiesMatch") : t("parent.noActivitiesRightNow")}
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
              <button type="button" onClick={() => router.push(`/book/${l.id}`)} className="relative block w-full overflow-hidden" aria-label={t("parent.moreDetailsFor", { name: l.name })}>
                {hero ? (
                  <CroppedImage im={hero} className="w-full" style={{ aspectRatio: "16 / 9" }} />
                ) : (
                  <div className="flex w-full items-center justify-center text-[26px] text-white/85" style={{ aspectRatio: "16 / 9", background: "linear-gradient(135deg,#1d3a8f,#2f6bd8 70%,#5b8af0)" }}>🎪</div>
                )}
                {opensLater && (
                  <span className="absolute left-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-[4px] text-[11px] font-bold text-[#9a3412]">
                    {t("parent.opensDate", { date: new Date(l.opensAt!).toLocaleString("en-GB", { day: "numeric", month: "short" }) })}
                  </span>
                )}
                {/* Best auto-offer as a corner ribbon (clipped by overflow-hidden). */}
                {l.bestOfferPercent ? (
                  <span className="absolute right-[-30px] top-[13px] rotate-[38deg] bg-[#e24b4a] px-8 py-[5px] text-[11px] font-extrabold text-white shadow-[0_4px_10px_rgba(0,0,0,.2)]">
                    {t("parent.saveBadge", { n: l.bestOfferPercent })}
                  </span>
                ) : null}
                <div className="absolute inset-x-0 bottom-0 px-3.5 py-2.5 text-left" style={{ background: "rgba(23,35,90,.62)" }}>
                  <div className="truncate text-[15px] font-extrabold text-white">{l.title || l.name}</div>
                  <div className="truncate text-[11.5px] text-[#cdddf7]">{l.tenantName} · {t("parent.fromWord")} {money(from)} <span className="opacity-90">/ {priceBasis(l)}</span></div>
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
                      {dist != null && <span className="flex items-center gap-1.5 font-semibold text-[#1d3a8f]"><span aria-hidden>🧭</span>{dist < 10 ? dist.toFixed(1) : Math.round(dist)} {t("parent.miAway")}</span>}
                      {agesLabel(l) && <span className="flex items-center gap-1.5"><span aria-hidden>🎂</span>{agesLabel(l)}</span>}
                      {dateRange(l) && <span className="flex items-center gap-1.5"><span aria-hidden>📅</span>{dateRange(l)}</span>}
                    </div>
                  </div>
                )}
                {/* Best offer only (+N more, expandable) so every card is the same
                    height; accepted childcare payments (green) after. */}
                {((l.offers && l.offers.length) || l.acceptsTFC || l.acceptsVouchers) && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {(() => { const offs = l.offers ?? []; const exp = offersOpen.has(l.id); const shown = exp ? offs : offs.slice(0, 1); return (<>
                      {shown.map((o) => <span key={o.label} className="rounded-full bg-[#fdecea] px-2.5 py-1 text-[11px] font-extrabold text-[#b3261e]">🏷️ {o.label}</span>)}
                      {offs.length > 1 && <button type="button" onClick={() => setOffersOpen((s) => { const n = new Set(s); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })} className="rounded-full bg-[#eef4ff] px-2.5 py-1 text-[11px] font-extrabold text-[#1d3a8f] hover:bg-[#e3ecff]">{exp ? t("parent.showLess") : t("parent.moreOffers", { n: offs.length - 1 })}</button>}
                    </>); })()}
                    {l.acceptsTFC && <span className="rounded-full bg-[#e9f9f2] px-2.5 py-1 text-[11px] font-extrabold text-[#0b5a3f]">✓ {t("parent.tfcAccepted")}</span>}
                    {l.acceptsVouchers && <span className="rounded-full bg-[#e9f9f2] px-2.5 py-1 text-[11px] font-extrabold text-[#0b5a3f]">✓ {t("parent.vouchersAccepted")}</span>}
                  </div>
                )}
                <button type="button" onClick={() => router.push(`/book/${l.id}`)} className="mt-3 w-full rounded-lg bg-[var(--brand-2,#2f6bd8)] py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90">
                  {t("parent.moreDetails")}
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
