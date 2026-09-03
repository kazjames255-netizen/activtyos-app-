"use client";

// Head-office overview: EVERY franchise's territory on one UK map, colour-coded
// per franchise, with a legend and an approximate overlap warning so the HQ can
// spot clashes, gaps and how far apart franchises sit. Read-only.

import { useEffect, useMemo, useState } from "react";
import { get as apiGet, api } from "@/lib/api";
import { areasOverlap, type TerritoryAreaGeo } from "@/lib/geo";
import { TerritoryMapClient, type TerritoryArea } from "./TerritoryMapClient";

interface WireArea { id: string; name: string; color: string; rings: { lat: number; lng: number }[] }
interface Franchise { franchiseId: string; name: string; area: string | null; territory: { areas: WireArea[]; status?: string } }

const PALETTE = ["#3f78d8", "#e0483d", "#0f9d58", "#f5b81f", "#8e44ad", "#e67e22", "#16a085", "#c2185b", "#6d4c41", "#0097a7"];

// Rings are stored as {lat,lng} objects (Firestore forbids nested arrays); the
// Leaflet map wants [lat,lng] tuples. Convert at the boundary.
const toMap = (areas: WireArea[]): TerritoryArea[] => areas.map((a) => ({ ...a, rings: a.rings.map((p) => [p.lat, p.lng] as [number, number]) }));
const toWire = (areas: TerritoryArea[]): WireArea[] => areas.map((a) => ({ ...a, rings: a.rings.map(([lat, lng]) => ({ lat, lng })) }));

export function FranchiseTerritoriesApp() {
  const [rows, setRows] = useState<Franchise[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Head office editing one franchise's border (fid), plus the working areas.
  const [editFid, setEditFid] = useState<string | null>(null);
  const [editAreas, setEditAreas] = useState<TerritoryArea[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  // HQ agrees / revokes a franchise's border (status-only).
  async function setStatus(fid: string, status: "agreed" | "proposed") {
    setBusy(fid); setError(null);
    try {
      await api(`/api/franchises/${fid}/territory`, { method: "PUT", body: JSON.stringify({ status }) });
      setRows((rs) => (rs ?? []).map((f) => (f.franchiseId === fid ? { ...f, territory: { ...(f.territory ?? { areas: [] }), status } } : f)));
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't update the territory"); }
    finally { setBusy(null); }
  }
  function startEdit(f: Franchise) { setEditFid(f.franchiseId); setEditAreas(toMap(f.territory?.areas ?? [])); }
  // HQ saves an edited border (draws/adjusts it), setting it back to "proposed"
  // until it's approved (or "draft" if cleared).
  async function saveBorder() {
    if (!editFid) return;
    setBusy(editFid); setError(null);
    const areas = toWire(editAreas);
    const status = areas.length ? "proposed" : "draft";
    try {
      await api(`/api/franchises/${editFid}/territory`, { method: "PUT", body: JSON.stringify({ areas, status }) });
      setRows((rs) => (rs ?? []).map((f) => (f.franchiseId === editFid ? { ...f, territory: { areas, status } } : f)));
      setEditFid(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save the border"); }
    finally { setBusy(null); }
  }

  useEffect(() => {
    apiGet<Franchise[]>("/api/franchises")
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load franchises"));
  }, []);

  // One colour per franchise; flatten every area onto the map, prefixing the name.
  const { mapAreas, withColor } = useMemo(() => {
    const withColor = (rows ?? []).map((f, i) => ({ ...f, color: PALETTE[i % PALETTE.length] }));
    const mapAreas: TerritoryArea[] = withColor.flatMap((f) =>
      (f.territory?.areas ?? []).map((a) => ({
        id: `${f.franchiseId}__${a.id}`,
        name: `${f.name}${a.name ? ` · ${a.name}` : ""}`,
        color: f.color,
        rings: a.rings.map((p) => [p.lat, p.lng] as [number, number]),
      })),
    );
    return { mapAreas, withColor };
  }, [rows]);

  // Approximate overlapping pairs.
  const overlaps = useMemo(() => {
    const out: { a: string; b: string }[] = [];
    const list = withColor.filter((f) => (f.territory?.areas ?? []).length > 0);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (areasOverlap(list[i].territory.areas as TerritoryAreaGeo[], list[j].territory.areas as TerritoryAreaGeo[])) {
          out.push({ a: list[i].name, b: list[j].name });
        }
      }
    }
    return out;
  }, [withColor]);

  const withTerritory = withColor.filter((f) => (f.territory?.areas ?? []).length > 0);
  const noTerritory = withColor.filter((f) => (f.territory?.areas ?? []).length === 0);
  const agreed = withColor.filter((f) => f.territory?.status === "agreed").length;

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[#f5f8fd] p-5 text-[#171534]">
      <div className="mx-auto max-w-[1120px]">
        <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "var(--hero-grad)" }}>
          <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🗺</span>
            Franchise territories
          </div>
          <p className="mt-1.5 text-[12.5px] leading-[1.5] text-white/85">Every franchise&rsquo;s agreed border on one map — see coverage, gaps and any overlaps at a glance.</p>
        </div>

        {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#e21d27]">{error}</div>}

        {/* Summary tiles */}
        {rows && (
          <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[["Franchises", String(rows.length)], ["With a territory", String(withTerritory.length)], ["Agreed by HQ", String(agreed)], ["Overlaps", String(overlaps.length)]].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-[#ece6f1] bg-white p-3">
                <div className="text-[10.5px] font-bold uppercase tracking-wide text-[#8a86a3]">{k}</div>
                <div className={"text-[22px] font-extrabold " + (k === "Overlaps" && overlaps.length > 0 ? "text-[#c0392b]" : "")}>{v}</div>
              </div>
            ))}
          </div>
        )}

        {overlaps.length > 0 && (
          <div className="mb-3 rounded-lg border border-[#f0d9a8] bg-[#fdf6e3] px-3 py-2.5 text-[12.5px] leading-relaxed text-[#7a5b06]">
            ⚠ <b>Overlapping territories</b> — these franchises appear to share ground: {overlaps.map((o) => `${o.a} ↔ ${o.b}`).join("; ")}. Two franchises shouldn&rsquo;t cover the same patch — adjust their borders.
          </div>
        )}

        <div className="rounded-2xl border border-[#ece6f1] bg-white p-4">
          {!rows ? (
            <div className="py-10 text-center text-[12.5px] text-[#8a86a3]">Loading territories…</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-[12.5px] text-[#8a86a3]">No franchises yet. Invite one from <b>Team &amp; invites</b> — their territory will appear here.</div>
          ) : (
            editFid ? (
              // ── Head office editing ONE franchise's border ──────────────────
              <>
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#dbe6fb] bg-[#eef4fd] px-3 py-2">
                  <div className="text-[12.5px] font-bold text-[#1d3a8f]">✎ Drawing the border for <b>{withColor.find((f) => f.franchiseId === editFid)?.name}</b> — use the map tools to draw or adjust, then save.</div>
                  <div className="flex gap-2">
                    <button type="button" onClick={saveBorder} disabled={busy === editFid} className="rounded-full bg-[#1d3a8f] px-3.5 py-1.5 text-[12px] font-extrabold text-white hover:brightness-110 disabled:opacity-60">{busy === editFid ? "Saving…" : "Save border"}</button>
                    <button type="button" onClick={() => setEditFid(null)} className="rounded-full border border-[#c9d6ee] px-3.5 py-1.5 text-[12px] font-bold text-[#1d3a8f]">Cancel</button>
                  </div>
                </div>
                <TerritoryMapClient key={editFid} value={editAreas} onChange={setEditAreas} editable height={460} />
              </>
            ) : (
              <>
                <TerritoryMapClient value={mapAreas} editable={false} height={460} />
                {/* Legend / franchise list — with the HQ approve / edit controls. */}
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {withColor.map((f) => {
                    const areas = f.territory?.areas ?? [];
                    const status = f.territory?.status;
                    return (
                      <div key={f.franchiseId} className="rounded-lg border border-[#ece6f1] bg-[#fbf8fc] p-2.5">
                        <div className="flex items-center gap-2">
                          <span className="h-3.5 w-3.5 flex-none rounded-full" style={{ background: f.color }} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[12.5px] font-bold">{f.name}{f.area ? ` · ${f.area}` : ""}</div>
                            <div className="text-[11px] text-[#8a86a3]">{areas.length} area{areas.length === 1 ? "" : "s"} · {status === "agreed" ? "✓ agreed by HQ" : areas.length ? "awaiting your approval" : "no border set"}</div>
                          </div>
                          {status === "agreed" ? <span className="flex-none rounded-full bg-[#e2f4ea] px-2 py-0.5 text-[10px] font-extrabold text-[#0f7a43]">✓ Agreed</span>
                            : areas.length ? <span className="flex-none rounded-full bg-[#fdf0e3] px-2 py-0.5 text-[10px] font-extrabold text-[#b45309]">Pending</span> : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {areas.length > 0 && status !== "agreed" && (
                            <button type="button" onClick={() => setStatus(f.franchiseId, "agreed")} disabled={busy === f.franchiseId} className="rounded-full bg-[#0f9d58] px-3 py-1 text-[11px] font-extrabold text-white hover:brightness-110 disabled:opacity-60">{busy === f.franchiseId ? "…" : "✓ Approve border"}</button>
                          )}
                          {status === "agreed" && (
                            <button type="button" onClick={() => setStatus(f.franchiseId, "proposed")} disabled={busy === f.franchiseId} className="rounded-full border border-[#f6c9cc] px-3 py-1 text-[11px] font-bold text-[#c0392b] hover:bg-[#fdecec] disabled:opacity-60">Revoke</button>
                          )}
                          <button type="button" onClick={() => startEdit(f)} className="rounded-full border border-[#ece6f1] px-3 py-1 text-[11px] font-bold text-[#1d3a8f] hover:bg-white">✎ {areas.length ? "Edit" : "Draw"} border</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {noTerritory.length > 0 && <p className="mt-2 text-[11.5px] text-[#8a86a3]">{noTerritory.length} franchise{noTerritory.length === 1 ? "" : "s"} haven&rsquo;t got a border yet — they can create listings anywhere until you draw &amp; approve one.</p>}
              </>
            )
          )}
        </div>

        <p className="mt-2.5 text-[11.5px] text-[#8a86a3]">Assign which franchise runs each listing on the <b>Franchises</b> page.</p>
      </div>
    </div>
  );
}
