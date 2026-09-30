"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { Card, Panel, Select, Input, SectionHead, Badge, Button } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { dateLocale } from "@/lib/i18n/format";
import { H, hq } from "./hqText";

// VENTURE CYCLE PROJECT (Phase 1) — a separate business venture Kaz and
// Cameron are exploring: lake/country-park cycle hire, benchmarked against
// Willen Lake, Milton Keynes (150 acres). This view is a read-only,
// filterable/sortable list of every lake / country park >= 60 acres AND
// within a 90-minute DRIVE of Milton Keynes (not straight-line distance —
// see driveTimeMinutes), sourced offline from OpenStreetMap (Overpass API) +
// postcodes.io + OSRM (real driving time) by server/scripts/ventureLakes/
// fetch.mjs into the `ventureLakes` Firestore collection, served by
// GET /api/venture-lakes.
//
// This is intentionally NOT built on the childcare "leads" schema/filters —
// different business, different data shape. Phase 2 (ownership, footfall,
// competition, pricing) will add fields here later; until then those fields
// are simply absent, not faked.
const WILLEN_ACRES = 150;
const MAX_DRIVE_MINUTES = 150;

interface VentureLake {
  id: string;
  name: string;
  postcode?: string;
  locality?: string;
  acres: number;
  pctOfWillen?: number;
  distanceMiles: number;
  driveTimeMinutes?: number;
  lat: number;
  lng: number;
  osmId?: string;
  source?: string;
  // Phase 2 — a Brave-Search-driven research pass over the top 150 sites by
  // acreage (server/scripts/ventureLakes/phase2_research.mjs). Absent on the
  // ~1,106 sites outside that top-150 cut — never faked as empty strings, so
  // `phase2CheckedAt == null` is the reliable "not researched yet" signal.
  owner?: string;
  concessionInfo?: string;
  competitionOnsite?: string[];
  hasCycleHireAlready?: boolean;
  pricingNotes?: string;
  pathSuitability?: string;
  parkingNotes?: string;
  protectedStatus?: string[];
  reviewCountApprox?: number | null;
  verdict?: string;
  phase2CheckedAt?: string;
  // Contact enrichment — website found via Phase 2's own search results
  // (reused, not a fresh query); email/phone scraped from that page directly
  // (no Brave cost). Absent where none was found.
  website?: string;
  email?: string;
  phone?: string;
}

type SortKey = "acres-desc" | "acres-asc" | "drive-asc" | "drive-desc" | "name-asc";

const SORTS: Record<SortKey, { label: string; cmp: (a: VentureLake, b: VentureLake) => number }> = {
  "acres-desc": { label: H("Acres (largest first)"), cmp: (a, b) => b.acres - a.acres },
  "acres-asc": { label: H("Acres (smallest first)"), cmp: (a, b) => a.acres - b.acres },
  "drive-asc": { label: H("Drive time (nearest first)"), cmp: (a, b) => (a.driveTimeMinutes ?? 999) - (b.driveTimeMinutes ?? 999) },
  "drive-desc": { label: H("Drive time (furthest first)"), cmp: (a, b) => (b.driveTimeMinutes ?? -1) - (a.driveTimeMinutes ?? -1) },
  "name-asc": { label: H("Name (A–Z)"), cmp: (a, b) => a.name.localeCompare(b.name) },
};

// Filters on real OSRM driving time from Milton Keynes — the data is
// already pre-filtered server-side to <= 90 minutes, so these are all
// "within" that ceiling; this just lets the table narrow further.
const DRIVE_TIME_OPTIONS = [
  { label: H("Any (up to 90 min drive)"), value: "" },
  { label: H("Within 30 min drive of Milton Keynes"), value: "30" },
  { label: H("Within 45 min drive of Milton Keynes"), value: "45" },
  { label: H("Within 60 min drive of Milton Keynes"), value: "60" },
  { label: H("Within 90 min drive of Milton Keynes"), value: "90" },
];

// --- Phase 2 filter derivations ---------------------------------------------
// These mirror the exact string patterns server/scripts/ventureLakes/
// phase2_research.mjs writes to Firestore — read from there, not guessed.

// Cycle-hire status: only meaningful once a site has been researched
// (phase2CheckedAt set); `hasCycleHireAlready` is a plain boolean.
type CycleHireFilter = "" | "opportunity" | "competitor" | "unresearched";
const CYCLE_HIRE_OPTIONS: { value: CycleHireFilter; label: string }[] = [
  { value: "", label: H("Any") },
  { value: "opportunity", label: H("No cycle hire found (opportunity)") },
  { value: "competitor", label: H("Already has cycle hire (competitor)") },
  { value: "unresearched", label: H("Not yet researched") },
];

// buildVerdict() in phase2_research.mjs always writes one of these three
// prefixes, e.g. "Good fit: managed by X; no existing cycle hire found...".
type VerdictQuality = "" | "good" | "possible" | "weaker" | "unresearched";
const VERDICT_OPTIONS: { value: VerdictQuality; label: string }[] = [
  { value: "", label: H("Any") },
  { value: "good", label: H("Good fit") },
  { value: "possible", label: H("Possible fit") },
  { value: "weaker", label: H("Weaker fit") },
  { value: "unresearched", label: H("Not researched") },
];
function verdictQuality(verdict?: string): Exclude<VerdictQuality, ""> {
  if (!verdict) return "unresearched";
  if (verdict.startsWith("Good fit")) return "good";
  if (verdict.startsWith("Possible fit")) return "possible";
  if (verdict.startsWith("Weaker fit")) return "weaker";
  return "unresearched";
}

// extractOwner() in phase2_research.mjs matches OWNER_PATTERNS and writes one
// of its exact labels (e.g. "City Council", "National Trust", "Trust
// (unspecified)", "Private estate"...), or "Unknown — not identified from
// search" when nothing matched. Grouped here into broad buckets; anything not
// explicitly named (RSPB, Woodland Trust, Environment Agency, unspecified
// trusts, private estates...) falls into "Private / other".
type OwnerCategory = "" | "council" | "national-trust" | "wildlife-trust" | "forestry-england" | "canal-river-trust" | "private-other" | "unknown";
const OWNER_OPTIONS: { value: OwnerCategory; label: string }[] = [
  { value: "", label: H("Any") },
  { value: "council", label: H("Council") },
  { value: "national-trust", label: H("National Trust") },
  { value: "wildlife-trust", label: H("Wildlife Trust") },
  { value: "forestry-england", label: H("Forestry England") },
  { value: "canal-river-trust", label: H("Canal & River Trust") },
  { value: "private-other", label: H("Private / other") },
  { value: "unknown", label: H("Unknown / not researched") },
];
function ownerCategory(owner?: string): Exclude<OwnerCategory, ""> {
  const o = owner || "";
  if (!o || o.startsWith("Unknown")) return "unknown";
  if (/national trust/i.test(o)) return "national-trust";
  if (/wildlife trust/i.test(o)) return "wildlife-trust";
  if (/forestry england/i.test(o)) return "forestry-england";
  if (/canal (&|and) river trust/i.test(o)) return "canal-river-trust";
  if (/council/i.test(o)) return "council";
  return "private-other";
}

// pricingNotes/protectedStatus carry a "nothing found" placeholder string
// rather than being empty/absent — check against those, not just truthiness.
function hasPricingInfo(r: VentureLake): boolean {
  return !!r.pricingNotes && r.pricingNotes !== "No pricing found in search results";
}
function isProtected(r: VentureLake): boolean {
  return !!r.protectedStatus && r.protectedStatus.length > 0 && r.protectedStatus[0] !== "None found";
}
function hasFootfallData(r: VentureLake): boolean {
  return r.reviewCountApprox != null;
}

// extractTrail() writes a plain boolean into a fixed pathSuitability string
// (not a raw boolean field) — the two exact strings the script writes:
const TRAIL_FOUND_TEXT = "Path/trail infrastructure referenced in search results";
const TRAIL_NONE_TEXT = "No clear path/trail evidence found";
type TrailFilter = "" | "has" | "none";
function hasTrail(r: VentureLake): boolean {
  return r.pathSuitability === TRAIL_FOUND_TEXT;
}
function noTrailFound(r: VentureLake): boolean {
  return r.pathSuitability === TRAIL_NONE_TEXT;
}

// extractTender() returns matched descriptive text or null; the script writes
// that text into concessionInfo, or this exact placeholder when null — so
// filter on presence/non-placeholder, not a boolean.
const CONCESSION_NONE_TEXT = "No concession/tender process found in search results";
type ConcessionFilter = "" | "has" | "none";
function hasConcessionInfo(r: VentureLake): boolean {
  return !!r.concessionInfo && r.concessionInfo !== CONCESSION_NONE_TEXT;
}
function noConcessionInfo(r: VentureLake): boolean {
  return r.concessionInfo === CONCESSION_NONE_TEXT;
}

// pricingNotes and reviewCountApprox are both noisy extractions (see
// extractPricing()/extractReviewCount() in phase2_research.mjs — pricing
// matches ANY "£X" near the site's name with no context on what it's for;
// review count is regex-picked out of snippet text and easily confused with
// unrelated numbers). Shown as a hover caveat wherever either field appears.
const PRICING_CAVEAT =
  H("⚠ Any £ mention found near this site in search results — not verified to be cycle-hire specific. Treat as “worth checking”, not a confirmed price.");
const FOOTFALL_CAVEAT =
  H("⚠ Approximate, extracted from search snippets — low numbers (under ~20–30) are likely extraction noise, not real visitor counts.");
const PROTECTED_EXPLAINER =
  H("A legal conservation designation was found for this site — e.g. SSSI (Site of Special Scientific Interest), NNR (National Nature Reserve), SAC (Special Area of Conservation), or a National Trust designation. This can restrict or block adding new commercial structures (a hire kiosk, signage, storage) — check with the landowner before assuming a lease is possible.");

// Badge palette matches the house convention (features/bookings/helpers.ts
// statusTone/payTone) — amber = caution/unknown, red = direct competitor,
// blue = neutral/positive fact. No green in this app's palette.
const AMBER = { bg: "#FCE9CE", fg: "#B45309" };
const BLUE = { bg: "#e5f2fd", fg: "#1f77c9" };
const RED = { bg: "var(--red-soft,#fdebec)", fg: "#bb1620" };
const GREY = { bg: "#eef0f6", fg: "#5b6478" };

export function VentureLakesApp() {
  useT(); // re-render on language change (labels are translated at render time)
  const [items, setItems] = useState<VentureLake[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sort, setSort] = useState<SortKey>("acres-desc");
  const [maxDriveMinutes, setMaxDriveMinutes] = useState("");
  const [minAcres, setMinAcres] = useState("60");
  const [expanded, setExpanded] = useState<string | null>(null); // row whose Phase 2 detail panel is open

  // Phase 2 filters — only meaningful for the top-150 researched subset, but
  // compose (AND) with the Phase 1 acres/drive-time filters above.
  const [cycleHireFilter, setCycleHireFilter] = useState<CycleHireFilter>("");
  const [verdictFilter, setVerdictFilter] = useState<VerdictQuality>("");
  const [ownerFilter, setOwnerFilter] = useState<OwnerCategory>("");
  const [pricingOnly, setPricingOnly] = useState(false);
  const [hideProtected, setHideProtected] = useState(false);
  const [minReviews, setMinReviews] = useState("");
  const [researchedOnly, setResearchedOnly] = useState(false);
  const [trailFilter, setTrailFilter] = useState<TrailFilter>("");
  const [concessionFilter, setConcessionFilter] = useState<ConcessionFilter>("");
  const [footfallFilter, setFootfallFilter] = useState<"" | "has" | "none">("");

  const phase2FiltersActive =
    !!cycleHireFilter || !!verdictFilter || !!ownerFilter || pricingOnly || hideProtected || !!minReviews ||
    researchedOnly || !!trailFilter || !!concessionFilter || !!footfallFilter;
  const filtersActive = phase2FiltersActive || minAcres !== "60" || !!maxDriveMinutes;

  const clearFilters = () => {
    setMinAcres("60");
    setMaxDriveMinutes("");
    setCycleHireFilter("");
    setVerdictFilter("");
    setOwnerFilter("");
    setPricingOnly(false);
    setHideProtected(false);
    setMinReviews("");
    setResearchedOnly(false);
    setTrailFilter("");
    setConcessionFilter("");
    setFootfallFilter("");
  };

  const CSV_COLUMNS: (keyof VentureLake)[] = [
    "name", "postcode", "locality", "acres", "pctOfWillen", "distanceMiles", "driveTimeMinutes",
    "owner", "hasCycleHireAlready", "verdict", "concessionInfo", "competitionOnsite", "pricingNotes",
    "pathSuitability", "parkingNotes", "protectedStatus", "reviewCountApprox", "phase2CheckedAt",
    "website", "email", "phone",
  ];
  const csvCell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = Array.isArray(v) ? v.join("; ") : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const downloadCsv = () => {
    const lines = [CSV_COLUMNS.join(",")];
    for (const it of rows) lines.push(CSV_COLUMNS.map((c) => csvCell(it[c])).join(","));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "venture-lakes.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiGet<{ items: VentureLake[] }>("/api/venture-lakes")
      .then((r) => { if (!cancelled) { setItems(r.items || []); setLoadError(""); } })
      .catch((err) => { if (!cancelled) setLoadError(err instanceof Error ? err.message : hq("Failed to load")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const rows = useMemo(() => {
    const min = Number(minAcres) || 0;
    const maxDrive = maxDriveMinutes ? Number(maxDriveMinutes) : Infinity;
    const minRev = minReviews ? Number(minReviews) : 0;
    return items
      .filter((it) => it.acres >= min && (it.driveTimeMinutes ?? Infinity) <= maxDrive)
      .filter((it) => {
        const researched = !!it.phase2CheckedAt;
        if (researchedOnly && !researched) return false;

        if (cycleHireFilter) {
          if (cycleHireFilter === "unresearched" && researched) return false;
          if (cycleHireFilter === "opportunity" && !(researched && !it.hasCycleHireAlready)) return false;
          if (cycleHireFilter === "competitor" && !(researched && it.hasCycleHireAlready)) return false;
        }

        if (verdictFilter && verdictQuality(it.verdict) !== verdictFilter) return false;

        if (ownerFilter && ownerCategory(it.owner) !== ownerFilter) return false;

        if (pricingOnly && !hasPricingInfo(it)) return false;

        if (hideProtected && isProtected(it)) return false;

        if (minRev > 0 && (it.reviewCountApprox ?? 0) < minRev) return false;

        if (trailFilter === "has" && !hasTrail(it)) return false;
        if (trailFilter === "none" && !noTrailFound(it)) return false;

        if (concessionFilter === "has" && !hasConcessionInfo(it)) return false;
        if (concessionFilter === "none" && !noConcessionInfo(it)) return false;

        if (footfallFilter === "has" && !hasFootfallData(it)) return false;
        if (footfallFilter === "none" && hasFootfallData(it)) return false;

        return true;
      })
      .slice()
      .sort(SORTS[sort].cmp);
  }, [
    items, sort, maxDriveMinutes, minAcres, cycleHireFilter, verdictFilter, ownerFilter, pricingOnly,
    hideProtected, minReviews, researchedOnly, trailFilter, concessionFilter, footfallFilter,
  ]);

  return (
    <div className="flex flex-col gap-3.5 p-4">
      <SectionHead>
        {hq("Leads Lakes/Country Parks")}
        <span className="ms-2 font-normal text-[12px] text-[var(--ink-3)]">
          {hq("Lakes & country parks ≥ 60 acres, within a {m}-minute (2.5hr) drive of Milton Keynes — cycle-hire feasibility list (Willen Lake, Milton Keynes = {a} acres, 100%)", { m: MAX_DRIVE_MINUTES, a: WILLEN_ACRES })}
        </span>
      </SectionHead>

      <Card className="border-s-4 border-s-[var(--brand)] bg-[var(--surface-2,rgba(127,127,127,0.04))] p-3 text-[13px] text-[var(--ink-2)]">
        <strong className="text-[var(--ink)]">{hq("Only the top 150 largest sites (by acreage) have been fully researched so far")}</strong> {hq("— owner, existing competition, cycle-hire status, pricing signals, path suitability, and contact details. The remaining ~1,100+ sites currently only have Phase 1 data (name, size, location, drive time) and show as “Not researched” below. Use the “Researched only” filter to see just the completed 150.")}
      </Card>

      <Card className="flex flex-wrap items-center gap-3 p-3">
        <label className="flex items-center gap-2 text-[13px] text-[var(--ink-2)]">
          {hq("Sort by")}
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {Object.entries(SORTS).map(([key, s]) => (
              <option key={key} value={key}>{hq(s.label)}</option>
            ))}
          </Select>
        </label>

        <label className="flex items-center gap-2 text-[13px] text-[var(--ink-2)]">
          {hq("Drive time from MK")}
          <Select value={maxDriveMinutes} onChange={(e) => setMaxDriveMinutes(e.target.value)}>
            {DRIVE_TIME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{hq(o.label)}</option>
            ))}
          </Select>
        </label>

        <label className="flex items-center gap-2 text-[13px] text-[var(--ink-2)]">
          {hq("Min acres")}
          <Select value={minAcres} onChange={(e) => setMinAcres(e.target.value)}>
            <option value="60">{hq("60+ (all sites)")}</option>
            <option value="90">90+</option>
            <option value="120">120+</option>
            <option value="150">{hq("150+ (Willen Lake size or larger)")}</option>
          </Select>
        </label>
      </Card>

      <Card className="flex flex-wrap items-center gap-3 p-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">{hq("Phase 2 research")}</span>

        <label className="flex items-center gap-2 text-[13px] text-[var(--ink-2)]">
          {hq("Cycle hire status")}
          <Select value={cycleHireFilter} onChange={(e) => setCycleHireFilter(e.target.value as CycleHireFilter)}>
            {CYCLE_HIRE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{hq(o.label)}</option>
            ))}
          </Select>
        </label>

        <label className="flex items-center gap-2 text-[13px] text-[var(--ink-2)]">
          {hq("Best fit")}
          <Select value={verdictFilter} onChange={(e) => setVerdictFilter(e.target.value as VerdictQuality)}>
            {VERDICT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{hq(o.label)}</option>
            ))}
          </Select>
        </label>

        <label className="flex items-center gap-2 text-[13px] text-[var(--ink-2)]">
          {hq("Owner")}
          <Select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value as OwnerCategory)}>
            {OWNER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{hq(o.label)}</option>
            ))}
          </Select>
        </label>

        <label className="flex items-center gap-2 text-[13px] text-[var(--ink-2)]">
          {hq("Footpath/trail")}
          <Select value={trailFilter} onChange={(e) => setTrailFilter(e.target.value as TrailFilter)}>
            <option value="">{hq("Any")}</option>
            <option value="has">{hq("Has trail")}</option>
            <option value="none">{hq("No trail found")}</option>
          </Select>
        </label>

        <label className="flex items-center gap-2 text-[13px] text-[var(--ink-2)]">
          {hq("Concession/tender")}
          <Select value={concessionFilter} onChange={(e) => setConcessionFilter(e.target.value as ConcessionFilter)}>
            <option value="">{hq("Any")}</option>
            <option value="has">{hq("Has concession info")}</option>
            <option value="none">{hq("None found")}</option>
          </Select>
        </label>

        <label className="flex items-center gap-2 text-[13px] text-[var(--ink-2)]" title={hq(FOOTFALL_CAVEAT)}>
          {hq("Reviews shown (footfall proxy)")}
          <span className="cursor-help text-[var(--ink-3)]" aria-hidden>⚠</span>
          <Select value={footfallFilter} onChange={(e) => setFootfallFilter(e.target.value as "" | "has" | "none")}>
            <option value="">{hq("Any")}</option>
            <option value="has">{hq("Yes — has review data")}</option>
            <option value="none">{hq("No — none found")}</option>
          </Select>
        </label>

        <label className="flex items-center gap-2 text-[13px] text-[var(--ink-2)]" title={hq(FOOTFALL_CAVEAT)}>
          {hq("Min reviews")}
          <span className="cursor-help text-[var(--ink-3)]" aria-hidden>⚠</span>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder={hq("Any")}
            value={minReviews}
            onChange={(e) => setMinReviews(e.target.value)}
            className="w-[90px]"
          />
        </label>

        <label className="flex items-center gap-1.5 text-[13px] text-[var(--ink-2)]" title={hq(PRICING_CAVEAT)}>
          <input type="checkbox" checked={pricingOnly} onChange={(e) => setPricingOnly(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
          {hq("Has pricing info")} <span className="cursor-help text-[var(--ink-3)]" aria-hidden>⚠</span>
        </label>

        <label className="flex items-center gap-1.5 text-[13px] text-[var(--ink-2)]" title={hq(PROTECTED_EXPLAINER)}>
          <input type="checkbox" checked={hideProtected} onChange={(e) => setHideProtected(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
          {hq("Hide protected sites")} <span className="cursor-help text-[var(--ink-3)]" aria-hidden>ⓘ</span>
        </label>

        <label className="flex items-center gap-1.5 text-[13px] text-[var(--ink-2)]">
          <input type="checkbox" checked={researchedOnly} onChange={(e) => setResearchedOnly(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
          {hq("Researched only")}
        </label>

        {filtersActive && (
          <button type="button" onClick={clearFilters} className="text-[12px] font-bold text-[var(--brand)] underline">
            {hq("Clear filters")}
          </button>
        )}

        <Button type="button" onClick={downloadCsv} disabled={rows.length === 0}>
          {hq("⬇ Download CSV (rows: {n}, all fields)", { n: rows.length })}
        </Button>

        <span className="ms-auto text-[12px] text-[var(--ink-3)]">
          {loading ? hq("Loading…") : hq("{n} of {total} sites match", { n: rows.length, total: items.length })}
        </span>
      </Card>

      {loadError && (
        <Card className="p-3 text-[13px] text-[var(--danger)]">{hq("Couldn’t load the list: {why}", { why: loadError })}</Card>
      )}

      {!loading && !loadError && items.length === 0 && (
        <Card className="p-4 text-[13px] text-[var(--ink-3)]">
          {hq("No sites loaded yet — run server/scripts/ventureLakes/fetch.mjs to populate the ventureLakes collection.")}
        </Card>
      )}

      <Panel title={hq("Sites")}>
        <div className="-m-4 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[var(--line)] text-start text-[11px] uppercase tracking-wide text-[var(--ink-3)]">
                <th className="px-4 py-2 font-semibold">{hq("Name")}</th>
                <th className="px-4 py-2 font-semibold">{hq("Location / postcode")}</th>
                <th className="px-4 py-2 font-semibold">{hq("Acres")}</th>
                <th className="px-4 py-2 font-semibold">{hq("Size vs Willen Lake (%)")}</th>
                <th className="px-4 py-2 font-semibold">{hq("Drive time from MK")}</th>
                <th className="px-4 py-2 font-semibold">{hq("Distance (mi, straight-line)")}</th>
                <th className="px-4 py-2 font-semibold" title={hq(FOOTFALL_CAVEAT)}>
                  {hq("Reviews (footfall proxy)")} <span className="cursor-help" aria-hidden>⚠</span>
                </th>
                <th className="px-4 py-2 font-semibold">{hq("Phase 2")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const researched = !!r.phase2CheckedAt;
                const isOpen = expanded === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr
                      data-ui="card"
                      className="cursor-pointer border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-hover,rgba(127,127,127,0.06))]"
                      onClick={() => setExpanded(isOpen ? null : r.id)}
                    >
                      <td className="px-4 py-2 font-medium text-[var(--ink)]">
                        <span className="me-1.5 text-[var(--ink-3)]">{isOpen ? "▾" : "▸"}</span>
                        {r.name}
                      </td>
                      <td className="px-4 py-2 text-[var(--ink-2)]">
                        {[r.locality, r.postcode].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="px-4 py-2 tabular-nums">{r.acres.toFixed(1)}</td>
                      <td className="px-4 py-2 tabular-nums">
                        {(r.pctOfWillen ?? (r.acres / WILLEN_ACRES) * 100).toFixed(0)}%
                      </td>
                      <td className="px-4 py-2 tabular-nums">
                        {r.driveTimeMinutes != null ? hq("{n} min", { n: r.driveTimeMinutes }) : "—"}
                      </td>
                      <td className="px-4 py-2 tabular-nums text-[var(--ink-3)]">{r.distanceMiles.toFixed(1)}</td>
                      <td className="px-4 py-2 tabular-nums" title={hq(FOOTFALL_CAVEAT)}>
                        {r.reviewCountApprox != null ? (
                          <span className="cursor-help">~{r.reviewCountApprox.toLocaleString(dateLocale())}</span>
                        ) : (
                          <span className="text-[var(--ink-3)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {researched ? (
                          r.hasCycleHireAlready ? (
                            <Badge tone={RED}>{hq("Cycle hire exists")}</Badge>
                          ) : (
                            <Badge tone={BLUE}>{hq("No cycle hire found")}</Badge>
                          )
                        ) : (
                          <Badge tone={GREY}>{hq("Not researched")}</Badge>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-[var(--line)] last:border-0">
                        <td colSpan={8} className="bg-[var(--surface-2,rgba(127,127,127,0.04))] px-4 py-3">
                          {!researched ? (
                            <p className="text-[13px] text-[var(--ink-3)]">
                              {hq("Not yet covered by the Phase 2 research pass (top 150 sites by acreage only).")}
                            </p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge tone={r.owner && !r.owner.startsWith("Unknown") ? BLUE : GREY}>
                                  {hq("Owner: {who}", { who: r.owner || hq("Unknown") })}
                                </Badge>
                                {r.hasCycleHireAlready ? (
                                  <Badge tone={RED}>{hq("Existing cycle hire — direct competitor")}</Badge>
                                ) : (
                                  <Badge tone={BLUE}>{hq("No cycle hire found")}</Badge>
                                )}
                                {r.protectedStatus && r.protectedStatus.length > 0 && r.protectedStatus[0] !== "None found" && (
                                  <span title={hq(PROTECTED_EXPLAINER)} className="cursor-help">
                                    <Badge tone={AMBER}>{r.protectedStatus.join(", ")} <span aria-hidden>ⓘ</span></Badge>
                                  </span>
                                )}
                                {r.reviewCountApprox != null && (
                                  <span title={hq(FOOTFALL_CAVEAT)} className="cursor-help">
                                    <Badge tone={GREY}>
                                      {hq("~{n} reviews (footfall proxy)", { n: r.reviewCountApprox.toLocaleString(dateLocale()) })} <span aria-hidden>⚠</span>
                                    </Badge>
                                  </span>
                                )}
                              </div>

                              {r.verdict && (
                                <p className="text-[13px] font-semibold text-[var(--ink)]">{r.verdict}</p>
                              )}

                              <div className="flex flex-wrap items-center gap-3 text-[12px]">
                                {r.website && (
                                  <a href={r.website} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--brand)] underline">
                                    {hq("Website")} ↗
                                  </a>
                                )}
                                {r.email && (
                                  <a href={`mailto:${r.email}`} className="text-[var(--ink-2)]">{r.email}</a>
                                )}
                                {r.phone && <span className="text-[var(--ink-2)]">{r.phone}</span>}
                                {!r.website && !r.email && !r.phone && (
                                  <span className="text-[var(--ink-3)]">{hq("No website/contact found")}</span>
                                )}
                              </div>

                              <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-[12px] text-[var(--ink-2)] sm:grid-cols-2">
                                <div>
                                  <span className="font-semibold text-[var(--ink-3)]">{hq("Concession/tender")}: </span>
                                  {r.concessionInfo || "—"}
                                </div>
                                <div>
                                  <span className="font-semibold text-[var(--ink-3)]">{hq("Onsite competition")}: </span>
                                  {(r.competitionOnsite && r.competitionOnsite.join(", ")) || "—"}
                                </div>
                                <div>
                                  <span className="font-semibold text-[var(--ink-3)]" title={hq(PRICING_CAVEAT)}>
                                    {hq("Pricing notes")} <span className="cursor-help" aria-hidden>⚠</span>:{" "}
                                  </span>
                                  {r.pricingNotes || "—"}
                                </div>
                                <div>
                                  <span className="font-semibold text-[var(--ink-3)]">{hq("Path/trail suitability")}: </span>
                                  {r.pathSuitability || "—"}
                                </div>
                                <div>
                                  <span className="font-semibold text-[var(--ink-3)]">{hq("Parking")}: </span>
                                  {r.parkingNotes || "—"}
                                </div>
                                <div>
                                  <span className="font-semibold text-[var(--ink-3)]">{hq("Checked")}: </span>
                                  {r.phase2CheckedAt ? new Date(r.phase2CheckedAt).toLocaleDateString(dateLocale()) : "—"}
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!loading && rows.length === 0 && items.length > 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-[var(--ink-3)]">
                    {hq("No sites match these filters.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
