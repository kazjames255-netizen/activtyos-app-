"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { Card, Panel, Select, SectionHead, Badge } from "@/components/ui";

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
const MAX_DRIVE_MINUTES = 90;

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
}

type SortKey = "acres-desc" | "acres-asc" | "drive-asc" | "drive-desc" | "name-asc";

const SORTS: Record<SortKey, { label: string; cmp: (a: VentureLake, b: VentureLake) => number }> = {
  "acres-desc": { label: "Acres (largest first)", cmp: (a, b) => b.acres - a.acres },
  "acres-asc": { label: "Acres (smallest first)", cmp: (a, b) => a.acres - b.acres },
  "drive-asc": { label: "Drive time (nearest first)", cmp: (a, b) => (a.driveTimeMinutes ?? 999) - (b.driveTimeMinutes ?? 999) },
  "drive-desc": { label: "Drive time (furthest first)", cmp: (a, b) => (b.driveTimeMinutes ?? -1) - (a.driveTimeMinutes ?? -1) },
  "name-asc": { label: "Name (A–Z)", cmp: (a, b) => a.name.localeCompare(b.name) },
};

// Filters on real OSRM driving time from Milton Keynes — the data is
// already pre-filtered server-side to <= 90 minutes, so these are all
// "within" that ceiling; this just lets the table narrow further.
const DRIVE_TIME_OPTIONS = [
  { label: "Any (up to 90 min drive)", value: "" },
  { label: "Within 30 min drive of Milton Keynes", value: "30" },
  { label: "Within 45 min drive of Milton Keynes", value: "45" },
  { label: "Within 60 min drive of Milton Keynes", value: "60" },
  { label: "Within 90 min drive of Milton Keynes", value: "90" },
];

// Badge palette matches the house convention (features/bookings/helpers.ts
// statusTone/payTone) — amber = caution/unknown, red = direct competitor,
// blue = neutral/positive fact. No green in this app's palette.
const AMBER = { bg: "#FCE9CE", fg: "#B45309" };
const BLUE = { bg: "#e5f2fd", fg: "#1f77c9" };
const RED = { bg: "var(--red-soft,#fdebec)", fg: "#bb1620" };
const GREY = { bg: "#eef0f6", fg: "#5b6478" };

export function VentureLakesApp() {
  const [items, setItems] = useState<VentureLake[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sort, setSort] = useState<SortKey>("acres-desc");
  const [maxDriveMinutes, setMaxDriveMinutes] = useState("");
  const [minAcres, setMinAcres] = useState("60");
  const [expanded, setExpanded] = useState<string | null>(null); // row whose Phase 2 detail panel is open

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiGet<{ items: VentureLake[] }>("/api/venture-lakes")
      .then((r) => { if (!cancelled) { setItems(r.items || []); setLoadError(""); } })
      .catch((err) => { if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const rows = useMemo(() => {
    const min = Number(minAcres) || 0;
    const maxDrive = maxDriveMinutes ? Number(maxDriveMinutes) : Infinity;
    return items
      .filter((it) => it.acres >= min && (it.driveTimeMinutes ?? Infinity) <= maxDrive)
      .slice()
      .sort(SORTS[sort].cmp);
  }, [items, sort, maxDriveMinutes, minAcres]);

  return (
    <div className="flex flex-col gap-3.5 p-4">
      <SectionHead>
        Leads Lakes/Country Parks
        <span className="ml-2 font-normal text-[12px] text-[var(--ink-3)]">
          Lakes &amp; country parks ≥ 60 acres, within a {MAX_DRIVE_MINUTES}-minute drive of Milton Keynes — cycle-hire feasibility list
          (Willen Lake, Milton Keynes = {WILLEN_ACRES} acres, 100%)
        </span>
      </SectionHead>

      <Card className="flex flex-wrap items-center gap-3 p-3">
        <label className="flex items-center gap-2 text-[13px] text-[var(--ink-2)]">
          Sort by
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {Object.entries(SORTS).map(([key, s]) => (
              <option key={key} value={key}>{s.label}</option>
            ))}
          </Select>
        </label>

        <label className="flex items-center gap-2 text-[13px] text-[var(--ink-2)]">
          Drive time from MK
          <Select value={maxDriveMinutes} onChange={(e) => setMaxDriveMinutes(e.target.value)}>
            {DRIVE_TIME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </label>

        <label className="flex items-center gap-2 text-[13px] text-[var(--ink-2)]">
          Min acres
          <Select value={minAcres} onChange={(e) => setMinAcres(e.target.value)}>
            <option value="60">60+ (all sites)</option>
            <option value="90">90+</option>
            <option value="120">120+</option>
            <option value="150">150+ (Willen Lake size or larger)</option>
          </Select>
        </label>

        <span className="ml-auto text-[12px] text-[var(--ink-3)]">
          {loading ? "Loading…" : `${rows.length} of ${items.length} sites`}
        </span>
      </Card>

      {loadError && (
        <Card className="p-3 text-[13px] text-[var(--danger)]">Couldn&apos;t load the list: {loadError}</Card>
      )}

      {!loading && !loadError && items.length === 0 && (
        <Card className="p-4 text-[13px] text-[var(--ink-3)]">
          No sites loaded yet — run server/scripts/ventureLakes/fetch.mjs to populate the ventureLakes collection.
        </Card>
      )}

      <Panel title="Sites">
        <div className="-m-4 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-[11px] uppercase tracking-wide text-[var(--ink-3)]">
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 font-semibold">Location / postcode</th>
                <th className="px-4 py-2 font-semibold">Acres</th>
                <th className="px-4 py-2 font-semibold">% of Willen Lake</th>
                <th className="px-4 py-2 font-semibold">Drive time from MK</th>
                <th className="px-4 py-2 font-semibold">Distance (mi, straight-line)</th>
                <th className="px-4 py-2 font-semibold">Phase 2</th>
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
                        <span className="mr-1.5 text-[var(--ink-3)]">{isOpen ? "▾" : "▸"}</span>
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
                        {r.driveTimeMinutes != null ? `${r.driveTimeMinutes} min` : "—"}
                      </td>
                      <td className="px-4 py-2 tabular-nums text-[var(--ink-3)]">{r.distanceMiles.toFixed(1)}</td>
                      <td className="px-4 py-2">
                        {researched ? (
                          r.hasCycleHireAlready ? (
                            <Badge tone={RED}>Cycle hire exists</Badge>
                          ) : (
                            <Badge tone={BLUE}>No cycle hire found</Badge>
                          )
                        ) : (
                          <Badge tone={GREY}>Not researched</Badge>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-[var(--line)] last:border-0">
                        <td colSpan={7} className="bg-[var(--surface-2,rgba(127,127,127,0.04))] px-4 py-3">
                          {!researched ? (
                            <p className="text-[13px] text-[var(--ink-3)]">
                              Not yet covered by the Phase 2 research pass (top 150 sites by acreage only).
                            </p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge tone={r.owner && !r.owner.startsWith("Unknown") ? BLUE : GREY}>
                                  Owner: {r.owner || "Unknown"}
                                </Badge>
                                {r.hasCycleHireAlready ? (
                                  <Badge tone={RED}>Existing cycle hire — direct competitor</Badge>
                                ) : (
                                  <Badge tone={BLUE}>No cycle hire found</Badge>
                                )}
                                {r.protectedStatus && r.protectedStatus.length > 0 && r.protectedStatus[0] !== "None found" && (
                                  <Badge tone={AMBER}>{r.protectedStatus.join(", ")}</Badge>
                                )}
                                {r.reviewCountApprox != null && (
                                  <Badge tone={GREY}>~{r.reviewCountApprox.toLocaleString()} reviews (footfall proxy)</Badge>
                                )}
                              </div>

                              {r.verdict && (
                                <p className="text-[13px] font-semibold text-[var(--ink)]">{r.verdict}</p>
                              )}

                              <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-[12px] text-[var(--ink-2)] sm:grid-cols-2">
                                <div>
                                  <span className="font-semibold text-[var(--ink-3)]">Concession/tender: </span>
                                  {r.concessionInfo || "—"}
                                </div>
                                <div>
                                  <span className="font-semibold text-[var(--ink-3)]">Onsite competition: </span>
                                  {(r.competitionOnsite && r.competitionOnsite.join(", ")) || "—"}
                                </div>
                                <div>
                                  <span className="font-semibold text-[var(--ink-3)]">Pricing notes: </span>
                                  {r.pricingNotes || "—"}
                                </div>
                                <div>
                                  <span className="font-semibold text-[var(--ink-3)]">Path/trail suitability: </span>
                                  {r.pathSuitability || "—"}
                                </div>
                                <div>
                                  <span className="font-semibold text-[var(--ink-3)]">Parking: </span>
                                  {r.parkingNotes || "—"}
                                </div>
                                <div>
                                  <span className="font-semibold text-[var(--ink-3)]">Checked: </span>
                                  {r.phase2CheckedAt ? new Date(r.phase2CheckedAt).toLocaleDateString() : "—"}
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
                  <td colSpan={7} className="px-4 py-6 text-center text-[var(--ink-3)]">
                    No sites match these filters.
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
