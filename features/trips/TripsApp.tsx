"use client";

import { useCallback, useEffect, useState } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Button, Card, FieldLabel, Input } from "@/components/ui";

interface Trip {
  id: string;
  destination: string;
  date: string;
  departTime?: string;
  returnTime?: string;
  transport?: string;
  childNames: string[];
  staff: string[];
  headcount?: number;
  riskAssessment?: string;
  consentObtained: boolean;
  notes?: string;
  status: "planned" | "completed" | "cancelled";
  createdByName?: string;
}
const fmt = (iso: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const commas = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

type Draft = { destination: string; date: string; departTime: string; returnTime: string; transport: string; children: string; staff: string; riskAssessment: string; consentObtained: boolean; notes: string };
const empty = (): Draft => ({ destination: "", date: "", departTime: "", returnTime: "", transport: "", children: "", staff: "", riskAssessment: "", consentObtained: false, notes: "" });

export function TripsApp() {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [d, setD] = useState<Draft | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const set = (patch: Partial<Draft>) => setD((p) => (p ? { ...p, ...patch } : p));

  const refresh = useCallback(() => { apiGet<Trip[]>("/api/trips").then((t) => { setTrips(t); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load")); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);
  useRealtime(["trips"], refresh);

  async function save() {
    if (!d || !d.destination.trim() || !d.date) { setError("Destination and date are required."); return; }
    try {
      await apiPost("/api/trips", { destination: d.destination, date: d.date, departTime: d.departTime || undefined, returnTime: d.returnTime || undefined, transport: d.transport || undefined, childNames: commas(d.children), staff: commas(d.staff), riskAssessment: d.riskAssessment || undefined, consentObtained: d.consentObtained, notes: d.notes || undefined });
      setD(null); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); }
  }
  async function remove(t: Trip) { if (!confirm(`Delete the trip to ${t.destination}?`)) return; try { await api(`/api/trips/${encodeURIComponent(t.id)}`, { method: "DELETE" }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Trips &amp; visits</h2>
        {!d && <Button variant="primary" onClick={() => setD(empty())}>＋ Plan a trip</Button>}
      </div>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Off-site trips — who’s going, transport, risk assessment and consent.</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {d && (
        <Card className="mb-3.5 p-4">
          <div className="mb-2 text-[13.5px] font-extrabold">Plan a trip</div>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div className="sm:col-span-2"><FieldLabel>Destination</FieldLabel><Input value={d.destination} onChange={(e) => set({ destination: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>Date</FieldLabel><Input type="date" value={d.date} onChange={(e) => set({ date: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>Depart</FieldLabel><Input type="time" value={d.departTime} onChange={(e) => set({ departTime: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>Return</FieldLabel><Input type="time" value={d.returnTime} onChange={(e) => set({ returnTime: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>Transport</FieldLabel><Input value={d.transport} onChange={(e) => set({ transport: e.target.value })} placeholder="e.g. minibus" className="w-full" /></div>
            <div className="sm:col-span-3"><FieldLabel>Children (comma separated)</FieldLabel><Input value={d.children} onChange={(e) => set({ children: e.target.value })} className="w-full" /></div>
            <div className="sm:col-span-3"><FieldLabel>Staff (comma separated)</FieldLabel><Input value={d.staff} onChange={(e) => set({ staff: e.target.value })} className="w-full" /></div>
          </div>
          <div className="mt-2.5"><FieldLabel>Risk assessment</FieldLabel><textarea value={d.riskAssessment} onChange={(e) => set({ riskAssessment: e.target.value })} rows={2} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px]" /></div>
          <label className="mt-2 flex items-center gap-2 text-[12.5px] font-bold"><input type="checkbox" checked={d.consentObtained} onChange={(e) => set({ consentObtained: e.target.checked })} />Parental consent obtained for all children</label>
          <div className="mt-3 flex gap-2"><Button variant="primary" onClick={save}>Save trip</Button><Button onClick={() => setD(null)}>Cancel</Button></div>
        </Card>
      )}

      {!trips ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      : trips.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No trips planned.</Card>
      : (
        <div className="flex flex-col gap-2.5">
          {trips.map((t) => (
            <Card key={t.id} className="p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-extrabold">{t.destination}</span>
                <span className="text-[12px] text-[var(--ink-3)]">{fmt(t.date)}{t.departTime ? ` · ${t.departTime}` : ""}{t.returnTime ? `–${t.returnTime}` : ""}</span>
                {t.consentObtained ? <Badge tone={{ bg: "#eaf0fc", fg: "#1d3a8f" }}>consent ✓</Badge> : <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>consent pending</Badge>}
                <span className="ml-auto text-[11.5px] text-[var(--ink-3)]">{t.headcount ?? t.childNames.length} children · {t.staff.length} staff</span>
              </div>
              <div className="mt-1.5 flex gap-2">
                <Button sm onClick={() => setOpenId(openId === t.id ? null : t.id)}>{openId === t.id ? "Hide" : "Details"}</Button>
                {canManage && <Button sm variant="danger" onClick={() => remove(t)}>Delete</Button>}
              </div>
              {openId === t.id && (
                <div className="mt-2 border-t border-[var(--line)] pt-2 text-[12px]">
                  {t.transport && <div><span className="text-[var(--ink-3)]">Transport: </span>{t.transport}</div>}
                  {t.childNames.length > 0 && <div><span className="text-[var(--ink-3)]">Children: </span>{t.childNames.join(", ")}</div>}
                  {t.staff.length > 0 && <div><span className="text-[var(--ink-3)]">Staff: </span>{t.staff.join(", ")}</div>}
                  {t.riskAssessment && <div className="mt-1"><span className="text-[var(--ink-3)]">Risk assessment: </span>{t.riskAssessment}</div>}
                  {t.notes && <div><span className="text-[var(--ink-3)]">Notes: </span>{t.notes}</div>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
