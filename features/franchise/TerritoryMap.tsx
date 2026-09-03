"use client";

// Franchise territory map — a Leaflet + OpenStreetMap (no API key) surface where a
// head office and a franchise agree the exact operating border. Draw one or more
// named, colour-coded areas (polygons), drop venue pins, and keep multiple areas
// tidy via a side-list rather than a mess of overlapping shapes.
//
// Client-only (Leaflet touches window). Import through next/dynamic with
// { ssr: false } — see TerritoryMapClient below.

import { useEffect, useRef, useState } from "react";
import type { Map as LMap, Polygon as LPolygon, LatLng } from "leaflet";

export interface TerritoryArea {
  id: string;
  name: string;
  color: string;
  /** Outer-ring vertices as [lat, lng] pairs. */
  rings: [number, number][];
}

const COLORS = ["#3f78d8", "#e0483d", "#0f9d58", "#f5b81f", "#8e44ad", "#e67e22", "#16a085", "#c2185b"];
const nextColor = (n: number) => COLORS[n % COLORS.length];
// Deterministic id without Date.now/Math.random (both banned in some contexts, and
// stable ids keep React keys quiet). Counter + a tiny prefix is enough here.
let _seq = 0;
const newId = () => `a${(_seq += 1)}_${_seq * 7}`;

interface Props {
  value: TerritoryArea[];
  onChange?: (areas: TerritoryArea[]) => void;
  editable?: boolean;
  venues?: { name: string; lat: number; lng: number }[];
  height?: number;
  /** Place name to centre on first load when there are no areas yet (e.g. "London"). */
  focus?: string;
}

export default function TerritoryMap({ value, onChange, editable = false, venues = [], height = 400, focus }: Props) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LMap | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const layersRef = useRef<Record<string, LPolygon>>({});
  const metaRef = useRef<Record<string, { name: string; color: string }>>({});
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [areas, setAreas] = useState<TerritoryArea[]>(value);
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);

  // Rebuild the areas array from the live layers + metadata, then emit.
  function emit() {
    const L = LRef.current!;
    const next: TerritoryArea[] = Object.entries(layersRef.current).map(([id, layer]) => {
      const latlngs = (layer.getLatLngs()[0] as LatLng[]) ?? [];
      return { id, name: metaRef.current[id]?.name ?? "Area", color: metaRef.current[id]?.color ?? COLORS[0], rings: latlngs.map((p) => [p.lat, p.lng] as [number, number]) };
    });
    void L; // (kept for symmetry / future use)
    setAreas(next);
    onChangeRef.current?.(next);
  }

  // One-time init. Seeds from the INITIAL `value`; after that the map owns geometry.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default ?? (await import("leaflet"));
      await import("@geoman-io/leaflet-geoman-free");
      // CSS (side-effect imports resolve to injected styles under Turbopack).
      await import("leaflet/dist/leaflet.css");
      await import("@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css");
      if (cancelled || !holderRef.current || mapRef.current) return;
      LRef.current = L as typeof import("leaflet");

      const map = L.map(holderRef.current, { zoomControl: true, attributionControl: true }).setView([51.5072, -0.1276], 10);
      mapRef.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // Seed existing areas.
      value.forEach((a, i) => {
        const color = a.color || nextColor(i);
        metaRef.current[a.id] = { name: a.name, color };
        const poly = L.polygon(a.rings.map(([la, ln]) => [la, ln]) as [number, number][], { color, weight: 2, fillOpacity: 0.15 }).addTo(map);
        (poly as unknown as { _terrId: string })._terrId = a.id;
        poly.bindTooltip(a.name, { permanent: false, direction: "center" });
        layersRef.current[a.id] = poly;
        if (editable) poly.on("pm:update", emit);
      });

      // Fit to seeded areas, else centre on the focus place, else default London.
      if (value.length) {
        const grp = L.featureGroup(Object.values(layersRef.current));
        try { map.fitBounds(grp.getBounds().pad(0.2)); } catch { /* empty */ }
      } else if (focus) {
        void geocode(focus).then((c) => { if (c && mapRef.current) mapRef.current.setView([c.lat, c.lng], 11); });
      }

      // Venue pins.
      venues.filter((v) => typeof v.lat === "number" && typeof v.lng === "number").forEach((v) => {
        L.circleMarker([v.lat, v.lng], { radius: 6, color: "#16306e", weight: 2, fillColor: "#3f78d8", fillOpacity: 0.9 }).addTo(map).bindTooltip(v.name);
      });

      if (editable) {
        map.pm.addControls({
          position: "topleft",
          drawPolygon: true, drawRectangle: true,
          editMode: true, dragMode: true, removalMode: true,
          drawMarker: false, drawCircle: false, drawCircleMarker: false, drawPolyline: false, drawText: false,
          cutPolygon: false, rotateMode: false,
        });
        map.pm.setGlobalOptions({ allowSelfIntersection: false });
        map.on("pm:create", (e: { layer: LPolygon }) => {
          const layer = e.layer;
          const id = newId();
          const idx = Object.keys(layersRef.current).length;
          const color = nextColor(idx);
          metaRef.current[id] = { name: `Area ${idx + 1}`, color };
          (layer as unknown as { _terrId: string })._terrId = id;
          layer.setStyle?.({ color, weight: 2, fillOpacity: 0.15 });
          layer.bindTooltip(metaRef.current[id].name, { direction: "center" });
          layersRef.current[id] = layer;
          layer.on("pm:update", emit);
          emit();
        });
        map.on("pm:remove", (e: { layer: LPolygon }) => {
          const id = (e.layer as unknown as { _terrId?: string })._terrId;
          if (id) { delete layersRef.current[id]; delete metaRef.current[id]; }
          emit();
        });
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
    // Seed-once: intentionally not re-running on value/venues changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nominatim geocode (free, no key) — used to centre and to power the search box.
  async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`, { headers: { Accept: "application/json" } });
      const j = (await r.json()) as { lat: string; lon: string }[];
      if (j?.[0]) return { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon) };
    } catch { /* offline / rate-limited — ignore */ }
    return null;
  }

  async function runSearch() {
    if (!q.trim() || !mapRef.current) return;
    setSearching(true);
    const c = await geocode(q.trim());
    setSearching(false);
    if (c) mapRef.current.setView([c.lat, c.lng], 12);
  }

  function rename(id: string, name: string) {
    if (metaRef.current[id]) metaRef.current[id].name = name;
    const layer = layersRef.current[id];
    if (layer) { layer.unbindTooltip(); layer.bindTooltip(name, { direction: "center" }); }
    emit();
  }
  function recolor(id: string, color: string) {
    if (metaRef.current[id]) metaRef.current[id].color = color;
    layersRef.current[id]?.setStyle?.({ color });
    emit();
  }
  function remove(id: string) {
    const layer = layersRef.current[id];
    if (layer && mapRef.current) mapRef.current.removeLayer(layer);
    delete layersRef.current[id]; delete metaRef.current[id];
    emit();
  }
  function focusArea(id: string) {
    const layer = layersRef.current[id];
    if (layer && mapRef.current) { try { mapRef.current.fitBounds(layer.getBounds().pad(0.2)); } catch { /* empty */ } }
  }

  return (
    <div className="flex flex-col gap-2.5 lg:flex-row">
      <div className="min-w-0 flex-1">
        {editable && (
          <div className="mb-2 flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runSearch(); } }}
              placeholder="Find a place — e.g. Camden, London" className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#3f78d8]" />
            <button type="button" onClick={runSearch} disabled={searching} className="flex-none rounded-lg bg-[#1d3a8f] px-3 py-2 text-[12.5px] font-bold text-white hover:brightness-110 disabled:opacity-50">{searching ? "…" : "Find"}</button>
          </div>
        )}
        <div ref={holderRef} style={{ height, borderRadius: 12, overflow: "hidden" }} className="border border-[var(--line)] bg-[#e8eef7]" />
        {editable && <p className="mt-1.5 text-[11px] leading-snug text-[var(--ink-3)]">Use the ▰ tool (top-left) to draw the boundary of an area, then the ✎/🗑 tools to adjust or remove it. Add more than one area for multiple territories.</p>}
      </div>

      <div className="w-full flex-none lg:w-[220px]">
        <div className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{editable ? "Areas you cover" : "Areas covered"}</div>
        {!ready ? (
          <div className="mt-2 text-[12px] text-[var(--ink-3)]">Loading map…</div>
        ) : areas.length === 0 ? (
          <div className="mt-2 rounded-lg border border-dashed border-[var(--line)] p-3 text-[12px] leading-snug text-[var(--ink-3)]">{editable ? "No areas yet — draw one on the map to define where you operate." : "No territory drawn yet."}</div>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {areas.map((a) => (
              <li key={a.id} className="rounded-lg border border-[var(--line)] bg-white p-2">
                <div className="flex items-center gap-1.5">
                  {editable
                    ? <input type="color" value={a.color} onChange={(e) => recolor(a.id, e.target.value)} className="h-5 w-5 flex-none cursor-pointer rounded border-0 bg-transparent p-0" title="Colour" />
                    : <span className="h-3.5 w-3.5 flex-none rounded-full" style={{ background: a.color }} />}
                  {editable
                    ? <input value={a.name} onChange={(e) => rename(a.id, e.target.value)} className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-[12.5px] font-bold outline-none hover:border-[var(--line)] focus:border-[#3f78d8]" />
                    : <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold">{a.name}</span>}
                </div>
                <div className="mt-1 flex items-center gap-2 pl-[26px] text-[11px]">
                  <button type="button" onClick={() => focusArea(a.id)} className="font-bold text-[#1d3a8f] hover:underline">Zoom to</button>
                  {editable && <button type="button" onClick={() => remove(a.id)} className="font-bold text-[#c0392b] hover:underline">Remove</button>}
                  <span className="ml-auto text-[var(--ink-3)]">{a.rings.length} pts</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {venues.length > 0 && <p className="mt-2 text-[11px] leading-snug text-[var(--ink-3)]">📍 {venues.length} venue{venues.length === 1 ? "" : "s"} shown as pins.</p>}
      </div>
    </div>
  );
}
