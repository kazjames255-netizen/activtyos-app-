"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Button, Card, FieldLabel, Input, Select } from "@/components/ui";

interface Shift {
  id: string;
  staffName: string;
  date: string;
  start: string;
  end: string;
  role?: string;
  listingId?: string;
  notes?: string;
}
interface ListingLite { id: string; title: string }

const iso = (d: Date) => d.toISOString().slice(0, 10);
function mondayOf(d: Date) { const x = new Date(d); const day = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - day); return x; }
const dayLabel = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

type Draft = { staffName: string; date: string; start: string; end: string; role: string; listingId: string };
const emptyDraft = (date: string): Draft => ({ staffName: "", date, start: "09:00", end: "17:00", role: "", listingId: "" });

export function ScheduleApp() {
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [listings, setListings] = useState<ListingLite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [weekStart, setWeekStart] = useState(() => iso(mondayOf(new Date())));
  const [d, setD] = useState<Draft | null>(null);
  const set = (patch: Partial<Draft>) => setD((p) => (p ? { ...p, ...patch } : p));

  const weekEnd = useMemo(() => { const e = new Date(`${weekStart}T00:00:00Z`); e.setUTCDate(e.getUTCDate() + 6); return iso(e); }, [weekStart]);
  const refresh = useCallback(() => {
    apiGet<Shift[]>(`/api/shifts?from=${weekStart}&to=${weekEnd}`).then((s) => { setShifts(s); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [weekStart, weekEnd]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {});
    apiGet<ListingLite[]>("/api/listings?mine=1").then((l) => setListings(l.map((x) => ({ id: x.id, title: x.title })))).catch(() => {});
  }, []);
  useRealtime(["shifts"], refresh);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const x = new Date(`${weekStart}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + i); return x; }), [weekStart]);
  const byDay = useMemo(() => {
    const m: Record<string, Shift[]> = {};
    for (const s of shifts ?? []) (m[s.date] ??= []).push(s);
    for (const k of Object.keys(m)) m[k].sort((a, b) => (a.start < b.start ? -1 : 1));
    return m;
  }, [shifts]);
  const listingName = (id?: string) => listings.find((l) => l.id === id)?.title;

  function shiftWeek(delta: number) { const s = new Date(`${weekStart}T00:00:00Z`); s.setUTCDate(s.getUTCDate() + delta * 7); setWeekStart(iso(s)); }
  async function save() {
    if (!d || !d.staffName.trim() || !d.date) { setError("Name and date are required."); return; }
    try { await apiPost("/api/shifts", { staffName: d.staffName, date: d.date, start: d.start, end: d.end, role: d.role || undefined, listingId: d.listingId || undefined }); setD(null); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); }
  }
  async function remove(s: Shift) { try { await api(`/api/shifts/${encodeURIComponent(s.id)}`, { method: "DELETE" }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Schedule &amp; rota</h2>
        <div className="flex items-center gap-1.5">
          <Button sm onClick={() => shiftWeek(-1)}>‹</Button>
          <span className="min-w-[150px] text-center text-[12.5px] font-bold">{dayLabel(days[0])} – {dayLabel(days[6])}</span>
          <Button sm onClick={() => shiftWeek(1)}>›</Button>
          <Button sm onClick={() => setWeekStart(iso(mondayOf(new Date())))}>This week</Button>
        </div>
      </div>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Who’s working when. {canManage ? "Add shifts to build the week’s rota." : "Your team’s rota for the week."}</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {canManage && (d ? (
        <Card className="mb-3.5 p-4">
          <div className="mb-2 text-[13.5px] font-extrabold">Add a shift</div>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div><FieldLabel>Staff member</FieldLabel><Input value={d.staffName} onChange={(e) => set({ staffName: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>Date</FieldLabel><Input type="date" value={d.date} onChange={(e) => set({ date: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>Role</FieldLabel><Input value={d.role} onChange={(e) => set({ role: e.target.value })} placeholder="e.g. lead coach" className="w-full" /></div>
            <div><FieldLabel>Start</FieldLabel><Input type="time" value={d.start} onChange={(e) => set({ start: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>End</FieldLabel><Input type="time" value={d.end} onChange={(e) => set({ end: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>Programme</FieldLabel><Select value={d.listingId} onChange={(e) => set({ listingId: e.target.value })} className="w-full"><option value="">—</option>{listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</Select></div>
          </div>
          <div className="mt-3 flex gap-2"><Button variant="primary" onClick={save}>Save shift</Button><Button onClick={() => setD(null)}>Cancel</Button></div>
        </Card>
      ) : <div className="mb-3.5"><Button variant="primary" onClick={() => setD(emptyDraft(weekStart))}>＋ Add a shift</Button></div>)}

      {!shifts ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div> : (
        <div className="grid gap-2 md:grid-cols-7">
          {days.map((day) => {
            const key = iso(day);
            const rows = byDay[key] ?? [];
            return (
              <Card key={key} className="p-2.5">
                <div className="mb-1.5 text-[11.5px] font-extrabold uppercase tracking-[0.03em] text-[var(--ink-3)]">{day.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })} <span className="text-[var(--ink-2)]">{day.getUTCDate()}</span></div>
                {rows.length === 0 ? <div className="py-2 text-center text-[11px] text-[var(--ink-3)]">—</div> : (
                  <div className="flex flex-col gap-1.5">
                    {rows.map((s) => (
                      <div key={s.id} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5">
                        <div className="flex items-center gap-1"><span className="min-w-0 flex-1 truncate text-[12px] font-bold">{s.staffName}</span>{canManage && <button type="button" onClick={() => remove(s)} className="text-[var(--ink-3)] hover:text-[var(--red)]" aria-label="Delete">×</button>}</div>
                        <div className="text-[11px] text-[var(--ink-2)]">{s.start}–{s.end}</div>
                        {s.role && <div className="text-[10.5px] text-[var(--ink-3)]">{s.role}</div>}
                        {listingName(s.listingId) && <div className="truncate text-[10.5px] text-[var(--brand)]">{listingName(s.listingId)}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
