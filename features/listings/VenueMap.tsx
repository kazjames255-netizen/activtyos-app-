"use client";

import { useEffect, useRef, useState } from "react";

// Shared between the operator's Locations tab and the customer page, so it
// lives outside both (ListingWizard and FreelancerListingsApp already import
// each other's types — a component import either way would be a cycle).

export const MIN_Z = 8;
export const MAX_Z = 18;

// Tiles come from OUR server (/api/geo/tiles) — Ordnance Survey when keyed,
// OSM otherwise — so the map key stays server-side and this works inside the
// embed widget on providers' own sites. Web Mercator ZXY, standard slippy.
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TILE = 256;

/**
 * A minimal slippy map centred on the venue's pin — a grid of proxied tiles
 * positioned so the pin sits in the middle, with a pin marker and +/− zoom.
 * Dependency-free; the zoom value is owned here and stored on the venue.
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
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => setWidth(e[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  if (lat === undefined || lng === undefined) return null;
  const z = Math.min(MAX_Z, Math.max(MIN_Z, zoom ?? 15));

  // Pin → global pixel at this zoom.
  const n = 2 ** z;
  const xF = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yF = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const centerPx = xF * TILE;
  const centerPy = yF * TILE;
  const w = width || 300;
  const originX = centerPx - w / 2;
  const originY = centerPy - height / 2;

  const tilesEls: React.ReactNode[] = [];
  if (width > 0) {
    const x0 = Math.floor(originX / TILE);
    const x1 = Math.floor((originX + w) / TILE);
    const y0 = Math.floor(originY / TILE);
    const y1 = Math.floor((originY + height) / TILE);
    for (let tx = x0; tx <= x1; tx++) {
      for (let ty = y0; ty <= y1; ty++) {
        if (ty < 0 || ty >= n) continue;
        const wx = ((tx % n) + n) % n; // wrap x
        tilesEls.push(
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${tx}-${ty}`}
            src={`${API}/api/geo/tiles/${z}/${wx}/${ty}.png`}
            alt=""
            width={TILE}
            height={TILE}
            className="absolute select-none"
            style={{ left: tx * TILE - originX, top: ty * TILE - originY }}
            draggable={false}
          />,
        );
      }
    }
  }

  return (
    <div>
      <div ref={ref} className="relative overflow-hidden rounded-lg border border-[var(--line)]" style={{ height }}>
        {tilesEls}
        {/* pin, dead centre */}
        <div className="pointer-events-none absolute" style={{ left: "50%", top: "50%", transform: "translate(-50%, -100%)" }}>
          <svg width="22" height="30" viewBox="0 0 22 30" aria-hidden>
            <path d="M11 0C5 0 0 4.7 0 10.6 0 18 11 30 11 30s11-12 11-19.4C22 4.7 17 0 11 0z" fill="#e22295" />
            <circle cx="11" cy="10.6" r="4" fill="#fff" />
          </svg>
        </div>
        {onZoom && (
          <div className="absolute right-1.5 top-1.5 flex flex-col overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-sm">
            <button type="button" onClick={() => onZoom(Math.min(MAX_Z, z + 1))} disabled={z >= MAX_Z}
              className="h-6 w-6 text-[14px] font-bold leading-none text-[var(--ink-2)] hover:bg-[var(--surface)] disabled:opacity-35" aria-label="Zoom in">+</button>
            <button type="button" onClick={() => onZoom(Math.max(MIN_Z, z - 1))} disabled={z <= MIN_Z}
              className="h-6 w-6 border-t border-[var(--line)] text-[14px] font-bold leading-none text-[var(--ink-2)] hover:bg-[var(--surface)] disabled:opacity-35" aria-label="Zoom out">−</button>
          </div>
        )}
      </div>
      <div className="mt-1 text-right text-[9.5px] leading-none text-[var(--ink-3)]">
        Contains OS data © Crown copyright &amp; database rights
      </div>
    </div>
  );
}
