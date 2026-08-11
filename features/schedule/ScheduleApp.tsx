"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Button, Card, FieldLabel, Input, Select } from "@/components/ui";
import { PageHero, LIGHT_PALETTE } from "@/components/OperatorPage";

// ── Staff schedule — Rota + Availability (manual edit663) ──────────────────
// Rota: week grid of shifts; add/edit/assign, Unassigned pool, colour-coded by
// programme, clash + on-leave conflict flags, hours→payroll. Availability: the
// "who's available" grid (company magenta / staff teal / unavailable / on-leave
// amber) with Leave requests → Approve/Decline. Rota is real (/api/shifts);
// availability + leave run on a local store until the backend lands (handoff).

interface Shift { id: string; staffName: string; date: string; start: string; end: string; role?: string; listingId?: string }
interface ListingLite { id: string; title: string }
type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const UNASSIGNED = "Unassigned";
const iso = (d: Date) => d.toISOString().slice(0, 10);
const dayKeyOf = (dateIso: string) => DAY_KEYS[new Date(`${dateIso}T00:00:00Z`).getUTCDay()];
function mondayOf(d: Date) { const x = new Date(d); const day = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - day); return x; }
const dayLabel = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const mins = (t: string) => { const [h, m] = t.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const hoursOf = (s: Shift) => Math.max(0, mins(s.end) - mins(s.start)) / 60;
const fmtHrs = (h: number) => (Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`);
const PALETTE = ["#2f6bd8", "#0f766e", "#7c3aed", "#c026a3", "#b45309", "#0f7a43", "#2563eb", "#d13a41"];

// ── Availability / leave — local store (backend owed) ──────────────────────
interface Leave { id: string; name: string; from: string; to: string; status: "pending" | "approved" | "declined" }
interface AvailStore { company: Record<string, DayKey[]>; staff: Record<string, DayKey[]>; leave: Leave[] }
const AKEY = "aos.schedule.avail.v1";
const loadAvail = (): AvailStore => { try { const v = JSON.parse(localStorage.getItem(AKEY) || "null"); return v && v.leave ? v : { company: {}, staff: {}, leave: [] }; } catch { return { company: {}, staff: {}, leave: [] }; } };
const uid = () => `lv-${Math.random().toString(36).slice(2, 8)}`;

type Draft = { id?: string; staffName: string; date: string; start: string; end: string; role: string; listingId: string };
const emptyDraft = (date: string): Draft => ({ staffName: "", date, start: "09:00", end: "17:00", role: "", listingId: "" });

export function ScheduleApp() {
  const [tab, setTab] = useState<"rota" | "avail">("rota");
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [listings, setListings] = useState<ListingLite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [weekStart, setWeekStart] = useState(() => iso(mondayOf(new Date())));
  const [d, setD] = useState<Draft | null>(null);
  const [avail, setAvail] = useState<AvailStore>({ company: {}, staff: {}, leave: [] });
  const set = (patch: Partial<Draft>) => setD((p) => (p ? { ...p, ...patch } : p));

  const weekEnd = useMemo(() => { const e = new Date(`${weekStart}T00:00:00Z`); e.setUTCDate(e.getUTCDate() + 6); return iso(e); }, [weekStart]);
  const refresh = useCallback(() => {
    apiGet<Shift[]>(`/api/shifts?from=${weekStart}&to=${weekEnd}`).then((s) => { setShifts(s); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [weekStart, weekEnd]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    setAvail(loadAvail());
    apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {});
    apiGet<ListingLite[]>("/api/listings?mine=1").then((l) => setListings(l.map((x) => ({ id: x.id, title: x.title })))).catch(() => {});
  }, []);
  useRealtime(["shifts"], refresh);
  const persistAvail = (next: AvailStore) => { setAvail(next); try { localStorage.setItem(AKEY, JSON.stringify(next)); } catch { /* ignore */ } };

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const x = new Date(`${weekStart}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + i); return x; }), [weekStart]);
  const byDay = useMemo(() => {
    const m: Record<string, Shift[]> = {};
    for (const s of shifts ?? []) (m[s.date] ??= []).push(s);
    for (const k of Object.keys(m)) m[k].sort((a, b) => (a.start < b.start ? -1 : 1));
    return m;
  }, [shifts]);
  const listingName = (id?: string) => listings.find((l) => l.id === id)?.title;
  const colourFor = (id?: string) => { if (!id) return "#8592a8"; const i = listings.findIndex((l) => l.id === id); return i >= 0 ? PALETTE[i % PALETTE.length] : "#2f6bd8"; };
  const usedListings = useMemo(() => listings.filter((l) => (shifts ?? []).some((s) => s.listingId === l.id)), [listings, shifts]);
  const staffNames = useMemo(() => [...new Set([...(shifts ?? []).map((s) => s.staffName), ...avail.leave.map((l) => l.name), ...Object.keys(avail.company), ...Object.keys(avail.staff)].filter((n) => n && n !== UNASSIGNED))].sort(), [shifts, avail]);

  const perStaff = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of shifts ?? []) { if (s.staffName === UNASSIGNED) continue; m[s.staffName] = (m[s.staffName] ?? 0) + hoursOf(s); }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [shifts]);
  const totalHours = perStaff.reduce((n, [, h]) => n + h, 0);
  const unassignedCount = (shifts ?? []).filter((s) => s.staffName === UNASSIGNED).length;

  const onLeave = useCallback((name: string, dateIso: string) => avail.leave.some((l) => l.status === "approved" && l.name === name && dateIso >= l.from && dateIso <= l.to), [avail]);
  const clashIds = useMemo(() => {
    const bad = new Set<string>();
    const groups: Record<string, Shift[]> = {};
    for (const s of shifts ?? []) { if (s.staffName === UNASSIGNED) continue; (groups[`${s.staffName}|${s.date}`] ??= []).push(s); }
    for (const arr of Object.values(groups)) { const sorted = [...arr].sort((a, b) => mins(a.start) - mins(b.start)); for (let i = 1; i < sorted.length; i++) if (mins(sorted[i].start) < mins(sorted[i - 1].end)) { bad.add(sorted[i].id); bad.add(sorted[i - 1].id); } }
    return bad;
  }, [shifts]);
  const pendingLeave = avail.leave.filter((l) => l.status === "pending");

  function shiftWeek(delta: number) { const s = new Date(`${weekStart}T00:00:00Z`); s.setUTCDate(s.getUTCDate() + delta * 7); setWeekStart(iso(s)); }
  function openEdit(s: Shift) { setD({ id: s.id, staffName: s.staffName === UNASSIGNED ? "" : s.staffName, date: s.date, start: s.start, end: s.end, role: s.role ?? "", listingId: s.listingId ?? "" }); }
  async function save() {
    if (!d || !d.date) { setError("A date is required."); return; }
    const body = { staffName: d.staffName.trim() || UNASSIGNED, date: d.date, start: d.start, end: d.end, role: d.role || undefined, listingId: d.listingId || undefined };
    try { if (d.id) await api(`/api/shifts/${encodeURIComponent(d.id)}`, { method: "PUT", body: JSON.stringify(body) }); else await apiPost("/api/shifts", body); setD(null); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); }
  }
  async function remove(s: Shift) { try { await api(`/api/shifts/${encodeURIComponent(s.id)}`, { method: "DELETE" }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }

  // Availability grid: cell state + manager toggles company-set availability.
  const cellState = (name: string, dateIso: string): "company" | "staff" | "leave" | "off" => {
    if (onLeave(name, dateIso)) return "leave";
    const dk = dayKeyOf(dateIso);
    if (avail.company[name]?.includes(dk)) return "company";
    if (avail.staff[name]?.includes(dk)) return "staff";
    return "off";
  };
  const toggleCompany = (name: string, dateIso: string) => {
    const dk = dayKeyOf(dateIso); const cur = avail.company[name] ?? [];
    const next = cur.includes(dk) ? cur.filter((x) => x !== dk) : [...cur, dk];
    persistAvail({ ...avail, company: { ...avail.company, [name]: next } });
  };
  const setLeave = (id: string, status: Leave["status"]) => persistAvail({ ...avail, leave: avail.leave.map((l) => (l.id === id ? { ...l, status } : l)) });
  const addLeave = (name: string) => { const from = weekStart; const to = weekStart; persistAvail({ ...avail, leave: [...avail.leave, { id: uid(), name, from, to, status: "pending" }] }); };

  const AV = { company: { c: "#c2268f", label: "Company-set" }, staff: { c: "#0f857b", label: "Staff-set" }, off: { c: "#c3cad6", label: "Unavailable" }, leave: { c: "#c06a10", label: "On leave" } } as const;

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero
        title="Staff schedule"
        icon="🗓"
        lede="Build the week's rota and see who's available — hours feed Payroll."
        actions={
          <div className="flex items-center gap-1.5">
            <Button sm onClick={() => shiftWeek(-1)}>‹</Button>
            <span className="min-w-[150px] text-center text-[12.5px] font-bold text-white">{dayLabel(days[0])} – {dayLabel(days[6])}</span>
            <Button sm onClick={() => shiftWeek(1)}>›</Button>
            <Button sm onClick={() => setWeekStart(iso(mondayOf(new Date())))}>This week</Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="mb-3 flex gap-1.5">
        {([["rota", "Rota"], ["avail", `Availability${pendingLeave.length ? ` · ${pendingLeave.length}` : ""}`]] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className="rounded-full border px-4 py-1.5 text-[12.5px] font-bold"
            style={tab === k ? { borderColor: "var(--brand)", background: "var(--brand)", color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
            {label}
          </button>
        ))}
      </div>

      {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#e21d27]">{error}</div>}

      {tab === "rota" ? (
        <>
          <Card className="mb-3 p-3.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div><div className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">This week</div><div className="text-[18px] font-extrabold tabular-nums text-[var(--ink)]">{fmtHrs(Math.round(totalHours * 10) / 10)}</div></div>
              <div className="h-8 w-px bg-[var(--line)]" />
              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {perStaff.length === 0 ? <span className="text-[12px] text-[var(--ink-3)]">No shifts yet this week.</span>
                  : perStaff.map(([name, h]) => <span key={name} className="rounded-full bg-[var(--panel)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-2)]">{name} · <span className="tabular-nums">{fmtHrs(Math.round(h * 10) / 10)}</span></span>)}
                {unassignedCount > 0 && <span className="rounded-full bg-[#fdf6e3] px-2.5 py-1 text-[11.5px] font-extrabold text-[#b45309]">{unassignedCount} unassigned</span>}
                {clashIds.size > 0 && <span className="rounded-full bg-[#fdebec] px-2.5 py-1 text-[11.5px] font-extrabold text-[#c0392b]">⚠ {clashIds.size / 2} double-booking{clashIds.size / 2 === 1 ? "" : "s"}</span>}
              </div>
              <span className="text-[11px] text-[var(--ink-3)]">Hours feed Payroll.</span>
            </div>
          </Card>

          {canManage && (d ? (
            <Card className="mb-3.5 p-4">
              <div className="mb-2 text-[13.5px] font-extrabold text-[var(--ink)]">{d.id ? "Edit shift" : "Add a shift"}</div>
              <div className="grid gap-2.5 sm:grid-cols-3">
                <div>
                  <FieldLabel>Staff member <span className="font-normal normal-case text-[var(--ink-3)]">— blank = unassigned</span></FieldLabel>
                  <Input value={d.staffName} onChange={(e) => set({ staffName: e.target.value })} list="rota-staff" placeholder="Leave blank to fill later" className="w-full" />
                  <datalist id="rota-staff">{staffNames.map((n) => <option key={n} value={n} />)}</datalist>
                </div>
                <div><FieldLabel>Date</FieldLabel><Input type="date" value={d.date} onChange={(e) => set({ date: e.target.value })} className="w-full" /></div>
                <div><FieldLabel>Role</FieldLabel><Input value={d.role} onChange={(e) => set({ role: e.target.value })} placeholder="e.g. lead coach" className="w-full" /></div>
                <div><FieldLabel>Start</FieldLabel><Input type="time" value={d.start} onChange={(e) => set({ start: e.target.value })} className="w-full" /></div>
                <div><FieldLabel>End</FieldLabel><Input type="time" value={d.end} onChange={(e) => set({ end: e.target.value })} className="w-full" /></div>
                <div><FieldLabel>Programme</FieldLabel><Select value={d.listingId} onChange={(e) => set({ listingId: e.target.value })} className="w-full"><option value="">—</option>{listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</Select></div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button variant="primary" onClick={save}>{d.id ? "Save changes" : "Save shift"}</Button>
                <Button onClick={() => setD(null)}>Cancel</Button>
                {d.id && <button type="button" onClick={() => { const s = shifts?.find((x) => x.id === d.id); if (s) { remove(s); setD(null); } }} className="ml-auto text-[12px] font-bold text-[#c0392b] hover:underline">Delete shift</button>}
              </div>
            </Card>
          ) : <div className="mb-3.5"><Button variant="primary" onClick={() => setD(emptyDraft(weekStart))}>＋ Add a shift</Button></div>)}

          {!shifts ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div> : (
            <>
              <div className="grid gap-2 md:grid-cols-7">
                {days.map((day) => {
                  const key = iso(day);
                  const rows = byDay[key] ?? [];
                  return (
                    <Card key={key} className="p-2.5">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[11.5px] font-extrabold uppercase tracking-[0.03em] text-[var(--ink-3)]">{day.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })} <span className="text-[var(--ink-2)]">{day.getUTCDate()}</span></span>
                        {canManage && <button type="button" onClick={() => setD(emptyDraft(key))} title="Add a shift on this day" className="rounded-full px-1.5 text-[15px] leading-none text-[var(--ink-3)] hover:bg-[var(--panel)] hover:text-[#1d3a8f]">＋</button>}
                      </div>
                      {rows.length === 0 ? <div className="py-2 text-center text-[11px] text-[var(--ink-3)]">—</div> : (
                        <div className="flex flex-col gap-1.5">
                          {rows.map((s) => {
                            const unassigned = s.staffName === UNASSIGNED;
                            const clash = clashIds.has(s.id);
                            const leaveConflict = !unassigned && onLeave(s.staffName, s.date);
                            const flagged = clash || leaveConflict;
                            const col = colourFor(s.listingId);
                            return (
                              <button key={s.id} type="button" onClick={() => canManage && openEdit(s)} disabled={!canManage}
                                title={leaveConflict ? "This person is on approved leave" : clash ? "Double-booked — overlapping shift" : undefined}
                                className="w-full rounded-lg border px-2 py-1.5 text-left transition-colors enabled:hover:shadow-sm"
                                style={flagged ? { borderColor: "#e2b4b8", background: "#fdebec", boxShadow: "inset 3px 0 0 #c0392b" }
                                  : unassigned ? { borderColor: "#f0d9a8", background: "#fdf6e3", borderStyle: "dashed" }
                                    : { borderColor: "var(--line)", background: "var(--surface)", boxShadow: `inset 3px 0 0 ${col}` }}>
                                <div className="flex items-center gap-1">
                                  {flagged && <span className="flex-none text-[11px]">⚠</span>}
                                  <span className={"min-w-0 flex-1 truncate text-[12px] font-bold " + (unassigned ? "text-[#b45309]" : flagged ? "text-[#c0392b]" : "text-[var(--ink)]")}>{unassigned ? "Unassigned" : s.staffName}</span>
                                  {canManage && <span role="button" onClick={(e) => { e.stopPropagation(); remove(s); }} className="text-[var(--ink-3)] hover:text-[#c0392b]" aria-label="Delete">×</span>}
                                </div>
                                <div className="text-[11px] text-[var(--ink-2)] tabular-nums">{s.start}–{s.end}</div>
                                {leaveConflict && <div className="text-[10.5px] font-bold text-[#c0392b]">On leave</div>}
                                {s.role && !leaveConflict && <div className="text-[10.5px] text-[var(--ink-3)]">{s.role}</div>}
                                {listingName(s.listingId) && <div className="truncate text-[10.5px] font-semibold" style={{ color: col }}>{listingName(s.listingId)}</div>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
              {usedListings.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[var(--ink-3)]">
                  <span className="font-extrabold uppercase tracking-wide">Programmes</span>
                  {usedListings.map((l) => <span key={l.id} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: colourFor(l.id) }} />{l.title}</span>)}
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-dashed border-[#f0d9a8] bg-[#fdf6e3]" />Unassigned</span>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        /* ── Availability tab ── */
        <>
          {/* Leave requests */}
          <Card className="mb-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[13.5px] font-extrabold text-[var(--ink)]">Leave requests</div>
              {pendingLeave.length > 0 && <span className="rounded-full bg-[#fcefd2] px-2.5 py-0.5 text-[11.5px] font-extrabold text-[#b45309]">{pendingLeave.length} pending</span>}
            </div>
            {avail.leave.length === 0 ? <p className="mt-1 text-[12px] text-[var(--ink-3)]">No leave requested. Approved leave shows amber below and blocks rostering on those days.</p> : (
              <div className="mt-2 flex flex-col gap-1.5">
                {avail.leave.map((l) => (
                  <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[12.5px]">
                    <span className="font-bold text-[var(--ink)]">{l.name}</span>
                    <span className="text-[var(--ink-2)]">{l.from === l.to ? l.from : `${l.from} → ${l.to}`}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      {l.status === "pending" ? (
                        <>
                          <button type="button" onClick={() => setLeave(l.id, "approved")} className="rounded-full bg-[#0f7a43] px-3 py-1 text-[11.5px] font-bold text-white">Approve</button>
                          <button type="button" onClick={() => setLeave(l.id, "declined")} className="rounded-full border border-[#e6b3b3] bg-white px-3 py-1 text-[11.5px] font-bold text-[#c0392b]">Decline</button>
                        </>
                      ) : (
                        <span className={"rounded-full px-2.5 py-0.5 text-[11px] font-extrabold " + (l.status === "approved" ? "bg-[#e2f4ea] text-[#0f7a43]" : "bg-[#eef1f6] text-[var(--ink-3)]")}>{l.status === "approved" ? "Approved" : "Declined"}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Who's available grid */}
          <Card className="p-4">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13.5px] font-extrabold text-[var(--ink)]">Who&rsquo;s available</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--ink-3)]">
                {(["company", "staff", "off", "leave"] as const).map((k) => <span key={k} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: AV[k].c }} />{AV[k].label}</span>)}
              </div>
            </div>
            {canManage && <p className="mb-2 text-[11.5px] text-[var(--ink-3)]">Tap a cell to set company availability (magenta). Teal is what staff submitted themselves.</p>}
            {staffNames.length === 0 ? <p className="py-4 text-center text-[12.5px] text-[var(--ink-3)]">Add shifts or staff to build availability here.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left" style={{ minWidth: 620 }}>
                  <thead><tr>
                    <th className="px-2 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Staff</th>
                    {days.map((day) => <th key={iso(day)} className="px-1 py-1.5 text-center text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{day.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}<div className="text-[var(--ink-2)]">{day.getUTCDate()}</div></th>)}
                  </tr></thead>
                  <tbody>
                    {staffNames.map((name) => (
                      <tr key={name} className="border-t border-[var(--line-2,#eef2f8)]">
                        <td className="px-2 py-2 text-[12.5px] font-bold text-[var(--ink)]">{name}</td>
                        {days.map((day) => {
                          const key = iso(day); const st = cellState(name, key);
                          return (
                            <td key={key} className="px-1 py-1.5 text-center">
                              <button type="button" disabled={!canManage || st === "leave"} onClick={() => toggleCompany(name, key)} title={AV[st].label}
                                className="mx-auto flex h-8 w-full max-w-[70px] flex-col items-center justify-center gap-0.5 rounded-lg transition-colors enabled:hover:bg-[var(--panel)] disabled:cursor-default"
                                style={{ background: st === "leave" ? "#fdf3e3" : "transparent" }}>
                                <span className="h-2.5 w-2.5 rounded-full" style={{ background: AV[st].c }} />
                                <span className="text-[9px] font-bold" style={{ color: AV[st].c }}>{st === "off" ? "" : AV[st].label.split("-")[0]}</span>
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {canManage && staffNames.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3 text-[11.5px] text-[var(--ink-3)]">
                Add a leave request for
                <Select value="" onChange={(e) => { if (e.target.value) addLeave(e.target.value); }} className="w-[180px]"><option value="">a staff member…</option>{staffNames.map((n) => <option key={n} value={n}>{n}</option>)}</Select>
                <span>(demo — creates a pending request for this week)</span>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
