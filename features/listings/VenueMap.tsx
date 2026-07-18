"use client";

// Shared between the operator's Locations tab and the customer page, so it
// lives outside both (ListingWizard and FreelancerListingsApp already import
// each other's types — a component import either way would be a cycle).

export const MIN_Z = 8;
export const MAX_Z = 18;

/**
 * OpenStreetMap embed centred on the venue's saved pin.
 *
 * The iframe is cross-origin, so it can't report a zoom back to us — the +/−
 * buttons own it and the value is stored on the venue. OSM's own attribution
 * footer wraps to three lines at this width and swamps the map, and can't be
 * restyled from outside; instead the iframe renders at double width (where the
 * footer is one small line), is scaled by half, and the strip is cropped. Our
 * own attribution goes underneath — ODbL requires it either way.
 */
export function VenueMap({
  lat,
  lng,
  zoom,
  onZoom,
  height = 160,
}: {
  lat?: number;
  lng?: number;
  zoom?: number;
  /** Omit for a read-only map (customer page). */
  onZoom?: (z: number) => void;
  height?: number;
}) {
  if (lat === undefined || lng === undefined) return null;

  const z = Math.min(MAX_Z, Math.max(MIN_Z, zoom ?? 15));
  // 580 CSS px of map at this zoom, then halved by the scale below.
  const lonSpan = (360 * 580) / (256 * Math.pow(2, z));
  const latSpan = lonSpan * 0.62;
  const bbox = [lng - lonSpan / 2, lat - latSpan / 2, lng + lonSpan / 2, lat + latSpan / 2].join(",");

  return (
    <div>
      <div className="relative overflow-hidden rounded-lg border border-[var(--line)]" style={{ height }}>
        <iframe
          title="Venue location"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`}
          loading="lazy"
          className="absolute left-0 top-0 border-0"
          style={{ width: "200%", height: height * 2 + 60, transform: "scale(0.5)", transformOrigin: "top left", marginTop: -15 }}
        />
        {onZoom && (
          <div className="absolute right-1.5 top-1.5 flex flex-col overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-sm">
            <button type="button" onClick={() => onZoom(Math.min(MAX_Z, z + 1))} disabled={z >= MAX_Z}
              className="h-6 w-6 text-[14px] font-bold leading-none text-[var(--ink-2)] hover:bg-[var(--surface)] disabled:opacity-35" aria-label="Zoom in">+</button>
            <button type="button" onClick={() => onZoom(Math.max(MIN_Z, z - 1))} disabled={z <= MIN_Z}
              className="h-6 w-6 border-t border-[var(--line)] text-[14px] font-bold leading-none text-[var(--ink-2)] hover:bg-[var(--surface)] disabled:opacity-35" aria-label="Zoom out">−</button>
          </div>
        )}
      </div>
      <div className="mt-1 text-[10px] text-[var(--ink-3)]">
        Map data ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer noopener" className="underline">OpenStreetMap</a>{" "}
        contributors
      </div>
    </div>
  );
}
