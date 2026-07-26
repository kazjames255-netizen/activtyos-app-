"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { api, get as apiGet, post as apiPost, put as apiPut } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { Badge, Button, Card, FieldLabel, Input } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// Trips & visits — the off-site log every provider keeps: where, when, who's
// going, how they get there, the risk assessment and parental consent. Themed
// + stepped to match the Medication / Accidents pages, backed by /api/trips.
// ─────────────────────────────────────────────────────────────────────────

type Status = "planned" | "completed" | "cancelled";
type RiskLevel = "" | "L" | "M" | "H";
interface Hazard { h: string; who?: string; controls?: string; initial?: RiskLevel; residual?: RiskLevel; done?: boolean }
interface Trip {
  id: string; destination: string; date: string; departTime?: string; returnTime?: string;
  listingId?: string; transport?: string; childNames: string[]; staff: string[]; headcount?: number;
  riskAssessment?: string; hazards?: Hazard[]; raSigned?: boolean; raAssessor?: string; raDate?: string;
  consentObtained: boolean; notes?: string; status: Status; createdByName?: string;
}

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;
const STAT = {
  planned: { label: "Planned", bg: "#eaf0fc", fg: "#1d3a8f" },
  completed: { label: "Completed", bg: "#e7f6ee", fg: "#0f7a43" },
  cancelled: { label: "Cancelled", bg: "#fdebec", fg: "#c02636" },
} as const;
const RISK = { L: { lbl: "Low", bg: "#e7f6ee", fg: "#0f7a43" }, M: { lbl: "Med", bg: "#fdf3d8", fg: "#9a5a00" }, H: { lbl: "High", bg: "#fdebec", fg: "#c02636" } } as const;
const TRANSPORT = ["Minibus", "Coach", "Walking", "Public bus", "Train", "Parents drop-off", "Provider vehicles"];
// The manual's standard trip hazards — a starter template the operator edits.
const DEFAULT_HAZARDS: Hazard[] = [
  { h: "Transport / travel", who: "All children & staff", controls: "Seatbelts on; head-count on and off; first-aider on board; DBS-checked driver", initial: "M", residual: "L", done: false },
  { h: "Lost / missing child", who: "Children", controls: "Head-count at every checkpoint; hi-vis; named lead; buddy system", initial: "M", residual: "L", done: false },
  { h: "Road crossing / pedestrian", who: "All", controls: "Use crossings; staff front and back; walk in pairs", initial: "M", residual: "L", done: false },
  { h: "Weather / sun / heat", who: "All", controls: "Sun cream; hats; water; shade breaks; check forecast", initial: "L", residual: "L", done: false },
  { h: "Medical / allergies", who: "Named children", controls: "Meds & care plans carried; first-aid kit; emergency contacts to hand", initial: "M", residual: "L", done: false },
  { h: "Venue-specific hazards", who: "All", controls: "Follow venue rules & staff briefing; site risk-assessment reviewed", initial: "M", residual: "L", done: false },
];
const fmtDate = (iso?: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const todayIso = () => { const t = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`; };
const raReady = (hz: Hazard[]) => hz.length > 0 && hz.every((h) => h.done && h.residual);

// Bookings carry the child (or a kids[] list), the listing and the ISO session
// dates each child occupies — so we can offer exactly who's booked on the day.
interface BookKid { name: string; dates?: string[]; cancelledDays?: string[]; cancelled?: boolean }
interface Booking { child?: string; listing?: string; listingId?: string; days?: string[]; kids?: BookKid[]; status?: string }
const LIVE_BOOKING = (s?: string) => !/cancel|declin|waitl|offer/i.test(s ?? "");
// Every child booked onto `dateIso` (optionally within one listing). A child
// with no explicit dates is booked on every session (older bookings).
function childrenOnDate(bkgs: Booking[], listingId: string | undefined, dateIso: string): string[] {
  const out = new Set<string>();
  for (const b of bkgs) {
    if (!LIVE_BOOKING(b.status)) continue;
    if (listingId && b.listingId !== listingId) continue;
    if (b.kids?.length) {
      for (const k of b.kids) {
        if (k.cancelled || (k.cancelledDays ?? []).includes(dateIso)) continue;
        if (!k.dates?.length || k.dates.includes(dateIso)) if (k.name) out.add(k.name.trim());
      }
    } else if (b.child) {
      if (!b.days?.length || b.days.includes(dateIso)) out.add(b.child.trim());
    }
  }
  return [...out].sort();
}

type Draft = Partial<Trip> & { children: string[]; staffList: string[]; hazards: Hazard[] };
const emptyDraft = (): Draft => ({ destination: "", date: todayIso(), departTime: "", returnTime: "", transport: "", children: [], staffList: [], hazards: DEFAULT_HAZARDS.map((h) => ({ ...h })), raSigned: false, consentObtained: false, notes: "", status: "planned" });

function TripForm({ existing, ratioTarget, onSaved, onCancel }: { existing?: Trip; ratioTarget: number; onSaved: () => void; onCancel: () => void }) {
  const isEdit = !!existing;
  const [d, setD] = useState<Draft>(existing
    ? { ...existing, children: existing.childNames, staffList: existing.staff, hazards: existing.hazards?.length ? existing.hazards.map((h) => ({ ...h })) : DEFAULT_HAZARDS.map((h) => ({ ...h })) }
    : emptyDraft());
  const [bkgs, setBkgs] = useState<Booking[]>([]);
  const [listingStaff, setListingStaff] = useState<string[]>([]);
  const [team, setTeam] = useState<string[]>([]);
  const [me, setMe] = useState<string>("You");
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staffInput, setStaffInput] = useState("");
  const set = (patch: Partial<Draft>) => setD((p) => ({ ...p, ...patch }));
  useEffect(() => { apiGet<Booking[]>("/api/bookings").then(setBkgs).catch(() => {}); }, []);
  useEffect(() => { apiGet<{ staff?: { first?: string; last?: string }[] } | null>("/api/library").then((l) => setTeam((l?.staff ?? []).map((s) => `${s.first ?? ""} ${s.last ?? ""}`.trim()).filter(Boolean))).catch(() => {}); }, []);
  useEffect(() => { apiGet<{ name?: string; email?: string }>("/api/me").then((m) => setMe(m.name || m.email || "You")).catch(() => {}); }, []);
  // Staff assigned to the chosen listing (its Staff step) — offered as one-tap chips.
  useEffect(() => {
    let alive = true;
    const lid = d.listingId;
    const p: Promise<string[]> = lid
      ? apiGet<{ library?: { staff?: { name?: string }[] } }>(`/api/listings/${encodeURIComponent(lid)}`)
          .then((r) => (r.library?.staff ?? []).map((s) => (s.name ?? "").trim()).filter(Boolean))
          .catch(() => [])
      : Promise.resolve([]);
    p.then((names) => { if (alive) setListingStaff(names); });
    return () => { alive = false; };
  }, [d.listingId]);

  const listings = [...new Map(bkgs.filter((b) => b.listingId && b.listing).map((b) => [b.listingId!, b.listing!])).entries()];
  const booked = useMemo(() => childrenOnDate(bkgs, d.listingId, d.date ?? ""), [bkgs, d.listingId, d.date]);
  const extraSelected = d.children.filter((c) => !booked.includes(c)); // chosen but not booked on this date
  const childRows = [...booked.map((n) => ({ name: n, onDay: true })), ...extraSelected.map((n) => ({ name: n, onDay: false }))];
  const allBookedChosen = booked.length > 0 && booked.every((n) => d.children.includes(n));
  const toggleChild = (name: string) => set({ children: d.children.includes(name) ? d.children.filter((x) => x !== name) : [...d.children, name] });
  const selectAllBooked = () => set({ children: allBookedChosen ? d.children.filter((c) => !booked.includes(c)) : [...new Set([...d.children, ...booked])] });

  const staffSuggestions = [...new Set([...listingStaff, ...team])].filter((s) => !d.staffList.includes(s));
  const addStaff = () => { const v = staffInput.trim(); if (v && !d.staffList.includes(v)) set({ staffList: [...d.staffList, v] }); setStaffInput(""); };
  const addStaffName = (v: string) => { if (v && !d.staffList.includes(v)) set({ staffList: [...d.staffList, v] }); };
  const ratio = d.staffList.length > 0 ? d.children.length / d.staffList.length : Infinity;
  const understaffed = d.children.length > 0 && ratio > ratioTarget;

  const hz = d.hazards;
  const setHaz = (i: number, patch: Partial<Hazard>) => set({ hazards: hz.map((h, j) => (j === i ? { ...h, ...patch } : h)), ...(d.raSigned ? { raSigned: false } : {}) });
  const addHaz = () => set({ hazards: [...hz, { h: "", who: "", controls: "", initial: "M", residual: "", done: false }], raSigned: false });
  const delHaz = (i: number) => set({ hazards: hz.filter((_, j) => j !== i), ...(d.raSigned ? { raSigned: false } : {}) });
  const signRa = () => set({ raSigned: true, raAssessor: me, raDate: todayIso() });

  async function save() {
    if (!d.destination?.trim() || !d.date) { setError("Add a destination and date."); return; }
    setBusy(true); setError(null);
    const body = {
      destination: d.destination, date: d.date, departTime: d.departTime || undefined, returnTime: d.returnTime || undefined,
      listingId: d.listingId || undefined, transport: d.transport || undefined, childNames: d.children, staff: d.staffList,
      hazards: hz.filter((h) => h.h.trim()), raSigned: !!d.raSigned, raAssessor: d.raAssessor || undefined, raDate: d.raDate || undefined,
      consentObtained: !!d.consentObtained, notes: d.notes || undefined, status: d.status ?? "planned",
    };
    try {
      if (isEdit) await apiPut(`/api/trips/${encodeURIComponent(existing!.id)}`, body);
      else await apiPost("/api/trips", body);
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); setBusy(false); }
  }

  const canNext1 = !!d.destination?.trim() && !!d.date;
  const STEPS: [number, string][] = [[1, "Where & when"], [2, "Who's going"], [3, "Risk & consent"]];
  const seg = (val: RiskLevel, cur: RiskLevel | undefined, on: (v: RiskLevel) => void) => (
    <button type="button" onClick={() => on(val)} className="rounded-md px-2 py-0.5 text-[11px] font-extrabold transition-colors"
      style={cur === val ? { background: RISK[val as "L" | "M" | "H"].fg, color: "#fff" } : { background: RISK[val as "L" | "M" | "H"].bg, color: RISK[val as "L" | "M" | "H"].fg }}>{RISK[val as "L" | "M" | "H"].lbl}</button>
  );

  return (
    <Card className="mb-3.5 p-4">
      <div className="mb-3 text-[13.5px] font-extrabold">{isEdit ? "Edit trip" : "Plan a trip"}</div>
      <div className="mb-4 flex items-center">
        {STEPS.map(([n, label], i) => (
          <div key={n} className={`flex items-center gap-2 ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
            <button type="button" onClick={() => { if (n === 1 || canNext1) setStep(n); }} className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-extrabold transition-colors" style={step === n ? { background: "#1d3a8f", color: "#fff" } : step > n ? { background: "#e7f6ee", color: "#0f7a43" } : { background: "var(--panel)", color: "var(--ink-3)" }}>{step > n ? "✓" : n}</span>
              <span className="hidden text-[13px] font-extrabold sm:inline" style={{ color: step === n ? "var(--ink)" : "var(--ink-3)" }}>{label}</span>
            </button>
            {i < STEPS.length - 1 && <span className="mx-2 h-1 flex-1 rounded-full" style={{ background: step > n ? "#0f7a43" : "var(--line)" }} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="grid gap-2.5 sm:grid-cols-3">
          <div className="sm:col-span-3"><FieldLabel>Where are you going?</FieldLabel><Input value={d.destination ?? ""} onChange={(e) => set({ destination: e.target.value })} placeholder="e.g. Woburn Safari Park" className="w-full" /></div>
          {listings.length > 0 && (
            <div className="sm:col-span-3"><FieldLabel>For which camp/club? (pulls the children booked that day + its staff)</FieldLabel>
              <select value={d.listingId ?? ""} onChange={(e) => set({ listingId: e.target.value || undefined, children: [] })} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px]">
                <option value="">All my bookings</option>
                {listings.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
          )}
          <div><FieldLabel>Date</FieldLabel><Input type="date" min={todayIso()} value={d.date ?? ""} onChange={(e) => set({ date: e.target.value })} className="w-full" /></div>
          <div><FieldLabel>Depart</FieldLabel><Input type="time" value={d.departTime ?? ""} onChange={(e) => set({ departTime: e.target.value })} className="w-full" /></div>
          <div><FieldLabel>Return</FieldLabel><Input type="time" value={d.returnTime ?? ""} onChange={(e) => set({ returnTime: e.target.value })} className="w-full" /></div>
          <div className="sm:col-span-3"><FieldLabel>Transport</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {TRANSPORT.map((t) => (
                <button key={t} type="button" onClick={() => set({ transport: t })} className="rounded-full border-2 px-3 py-1.5 text-[12px] font-bold transition-colors"
                  style={d.transport === t ? { borderColor: "#1d3a8f", background: "#eaf0fc", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{t}</button>
              ))}
            </div>
            <Input value={TRANSPORT.includes(d.transport ?? "") ? "" : d.transport ?? ""} onChange={(e) => set({ transport: e.target.value })} placeholder="…or type your own" className="mt-1.5 w-full" />
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FieldLabel>Who&rsquo;s going? <span className="font-semibold text-[var(--ink-3)]">(booked on {d.date ? fmtDate(d.date) : "the trip date"}{d.listingId ? ", this listing" : ""})</span></FieldLabel>
            {booked.length > 0 && <button type="button" onClick={selectAllBooked} className="rounded-full border border-[#1d3a8f] px-3 py-1 text-[11.5px] font-bold text-[#1d3a8f] transition-colors hover:bg-[#eef4fd]">{allBookedChosen ? "Clear all" : `Select all ${booked.length}`}</button>}
          </div>
          {childRows.length > 0 ? (
            <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1.5 [scrollbar-width:thin]">
              {childRows.map(({ name, onDay }) => {
                const on = d.children.includes(name);
                return (
                  <label key={name} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px]" style={on ? { background: "#eef4fd", color: "#1d3a8f", fontWeight: 700 } : { color: "var(--ink-2)" }}>
                    <input type="checkbox" checked={on} onChange={() => toggleChild(name)} /><span className="flex-1">{name}</span>
                    {!onDay && <span className="text-[10.5px] font-semibold text-[#9a5a00]">not booked this date</span>}
                  </label>
                );
              })}
            </div>
          ) : <div className="rounded-lg bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-3)]">No children booked on {d.date ? fmtDate(d.date) : "this date"}{d.listingId ? " for this listing" : ""} — pick a date with bookings, or add staff and details below.</div>}
          <div className="mt-1.5 text-[11.5px] font-semibold text-[#1d3a8f]">{d.children.length} child{d.children.length === 1 ? "" : "ren"} on the trip</div>

          <div className="mt-3"><FieldLabel>Staff on the trip</FieldLabel>
            {staffSuggestions.length > 0 && (
              <div className="mb-2">
                <div className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{listingStaff.length ? "Assigned to this listing / your team — tap to add" : "Your team — tap to add"}</div>
                <div className="flex flex-wrap gap-1.5">
                  {staffSuggestions.map((s) => <button key={s} type="button" onClick={() => addStaffName(s)} className="rounded-full border-2 border-dashed px-2.5 py-1 text-[12px] font-bold transition-colors" style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}>＋ {s}</button>)}
                </div>
              </div>
            )}
            <div className="flex gap-2"><Input value={staffInput} onChange={(e) => setStaffInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStaff(); } }} placeholder="…or add another staff name" className="flex-1" /><Button variant="solid" onClick={addStaff}>Add</Button></div>
            {d.staffList.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {d.staffList.map((s) => <span key={s} className="inline-flex items-center gap-1 rounded-full bg-[#eaf0fc] px-2.5 py-0.5 text-[12px] font-semibold text-[#1d3a8f]">{s}<button type="button" onClick={() => set({ staffList: d.staffList.filter((x) => x !== s) })} className="text-[#1d3a8f]/60 hover:text-[#1d3a8f]">✕</button></span>)}
              </div>
            )}
          </div>
          {d.staffList.length > 0 && (
            <div className="mt-2.5 rounded-lg px-3 py-2 text-[12px] font-semibold" style={understaffed ? { background: "#fdebec", color: "#c02636" } : { background: "#e7f6ee", color: "#0f7a43" }}>
              {understaffed ? `⚠️ ${d.children.length} children to ${d.staffList.length} staff — that's over your ${ratioTarget}:1 target. Add staff or split the trip.` : `✓ ${d.children.length} children to ${d.staffList.length} staff — within your ${ratioTarget}:1 target.`}
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <FieldLabel>Risk assessment</FieldLabel>
            {d.raSigned ? <Badge tone={{ bg: "#e7f6ee", fg: "#0f7a43" }}>✓ Signed off · {d.raAssessor} · {fmtDate(d.raDate)}</Badge> : <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>Draft</Badge>}
          </div>
          <p className="mb-2 text-[11.5px] text-[var(--ink-3)]">For each hazard: note who&rsquo;s at risk and the controls, set the residual risk, then tick <b>controls in place</b>. Sign off once every hazard is covered.</p>
          <div className="flex flex-col gap-2">
            {hz.map((h, i) => (
              <div key={i} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5">
                <div className="flex items-center gap-2">
                  <input value={h.h} onChange={(e) => setHaz(i, { h: e.target.value })} placeholder="Hazard" className="flex-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12.5px] font-bold outline-none focus:border-[#1d3a8f]" />
                  <button type="button" onClick={() => delHaz(i)} aria-label="Remove hazard" className="text-[var(--ink-3)] hover:text-[#c02636]">✕</button>
                </div>
                <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                  <input value={h.who ?? ""} onChange={(e) => setHaz(i, { who: e.target.value })} placeholder="Who's at risk" className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px] outline-none focus:border-[#1d3a8f]" />
                  <input value={h.controls ?? ""} onChange={(e) => setHaz(i, { controls: e.target.value })} placeholder="Controls in place" className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px] outline-none focus:border-[#1d3a8f]" />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--ink-3)]">Initial{(["L", "M", "H"] as RiskLevel[]).map((v) => <span key={v}>{seg(v, h.initial, (x) => setHaz(i, { initial: x }))}</span>)}</span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--ink-3)]">Residual{(["L", "M", "H"] as RiskLevel[]).map((v) => <span key={v}>{seg(v, h.residual, (x) => setHaz(i, { residual: x }))}</span>)}</span>
                  <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[12px] font-bold" style={{ color: h.done ? "#0f7a43" : "var(--ink-2)" }}><input type="checkbox" checked={!!h.done} onChange={(e) => setHaz(i, { done: e.target.checked })} />Controls in place</label>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addHaz} className="mt-2 rounded-lg border-2 border-dashed border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] transition-colors hover:border-[#1d3a8f] hover:text-[#1d3a8f]">＋ Add hazard</button>
          <div className="mt-2.5">
            {d.raSigned ? (
              <div className="flex items-center gap-2 rounded-lg bg-[#e7f6ee] px-3 py-2 text-[12px] font-semibold text-[#0f7a43]">✓ Risk assessment signed off by {d.raAssessor} ({fmtDate(d.raDate)}).<button type="button" onClick={() => set({ raSigned: false })} className="ml-auto text-[11.5px] font-bold text-[#0f7a43] underline">Re-open to edit</button></div>
            ) : (
              <>
                <Button variant="solid" disabled={!raReady(hz)} onClick={signRa}>Sign off risk assessment</Button>
                {!raReady(hz) && <div className="mt-1.5 rounded-lg bg-[#fdf3d8] px-3 py-2 text-[11.5px] font-semibold text-[#9a5a00]">For every hazard: set a residual risk and tick “controls in place”.</div>}
              </>
            )}
          </div>

          <label className="mt-4 flex items-center gap-2 text-[12.5px] font-bold"><input type="checkbox" checked={!!d.consentObtained} onChange={(e) => set({ consentObtained: e.target.checked })} />Parental consent obtained for every child on the trip</label>
          <div className="mt-2.5"><FieldLabel>Notes (optional)</FieldLabel><Input value={d.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. packed lunches needed; sun cream" className="w-full" /></div>
          {isEdit && (
            <div className="mt-3"><FieldLabel>Status</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {(["planned", "completed", "cancelled"] as Status[]).map((s) => (
                  <button key={s} type="button" onClick={() => set({ status: s })} className="rounded-xl border-2 px-4 py-2 text-[12.5px] font-extrabold transition-colors"
                    style={d.status === s ? { borderColor: STAT[s].fg, background: STAT[s].fg, color: "#fff" } : { borderColor: STAT[s].bg, background: STAT[s].bg, color: STAT[s].fg }}>{STAT[s].label}</button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {error && <div className="mt-3 text-[12.5px] font-bold text-[var(--red)]">{error}</div>}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
        <Button onClick={onCancel}>Cancel</Button>
        <div className="flex gap-2">
          {step > 1 && <Button onClick={() => setStep(step - 1)}>← Back</Button>}
          {step < 3 && <Button variant="solid" disabled={step === 1 && !canNext1} onClick={() => setStep(step + 1)}>Next →</Button>}
          {step === 3 && <Button variant="solid" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save trip"}</Button>}
        </div>
      </div>
    </Card>
  );
}

export function TripsApp() {
  const { settings } = useSettings();
  const ratioTarget = settings.trips?.ratioTarget ?? 8;
  const notifies = settings.trips?.notifyParent ?? true;
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const refresh = useCallback(() => { apiGet<Trip[]>("/api/trips").then((t) => { setTrips(t); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load")); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);
  useRealtime(["trips"], refresh);

  async function remove(t: Trip) { if (!confirm(`Delete the trip to ${t.destination}?`)) return; try { await api(`/api/trips/${encodeURIComponent(t.id)}`, { method: "DELETE" }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }

  const all = trips ?? [];
  const upcoming = all.filter((t) => t.status === "planned" && t.date >= todayIso()).length;
  const thisMonth = all.filter((t) => (t.date ?? "").slice(0, 7) === todayIso().slice(0, 7)).length;
  const consentPending = all.filter((t) => t.status === "planned" && !t.consentObtained).length;
  const tiles: [string, number][] = [["Upcoming", upcoming], ["This month", thisMonth], ["Consent pending", consentPending], ["Total", all.length]];
  const ql = q.trim().toLowerCase();
  const shown = useMemo(() => all.filter((t) => (!ql || t.destination.toLowerCase().includes(ql) || t.childNames.join(" ").toLowerCase().includes(ql)) && (!statusFilter || t.status === statusFilter))
    .sort((a, b) => (`${b.date}` < `${a.date}` ? -1 : 1)), [all, ql, statusFilter]);

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🚌</span>Trips &amp; visits
            </div>
            <p className="mt-1.5 max-w-[620px] text-[12.5px] leading-[1.5] text-white/85">Every off-site trip — where, when, who&rsquo;s going, transport, the risk assessment and parental consent, all in one place.</p>
          </div>
          {!adding && !editing && <button type="button" onClick={() => setAdding(true)} className="rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-[#1d3a8f] shadow-md transition-transform hover:-translate-y-px">＋ Plan a trip</button>}
        </div>
        {trips && (
          <div className="mt-4 flex flex-wrap gap-2.5">
            {tiles.map(([label, v]) => (
              <div key={label} className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm">
                <div className="text-[20px] font-extrabold leading-none">{v}</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {adding && <TripForm ratioTarget={ratioTarget} onSaved={() => { setAdding(false); refresh(); }} onCancel={() => setAdding(false)} />}
      {editing && <TripForm key={editing.id} existing={editing} ratioTarget={ratioTarget} onSaved={() => { setEditing(null); refresh(); }} onCancel={() => setEditing(null)} />}

      {trips && all.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {([["", "All"], ["planned", "Planned"], ["completed", "Completed"], ["cancelled", "Cancelled"]] as [string, string][]).map(([id, label]) => (
            <button key={label} type="button" onClick={() => setStatusFilter(id)} className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
              style={statusFilter === id ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>{label}</button>
          ))}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search destination or child…" className="ml-auto w-56 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] outline-none focus:border-[#1d3a8f]" />
        </div>
      )}

      {!trips ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      : shown.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">{all.length === 0 ? "No trips planned yet — plan your first off-site visit." : "No trips match."}</Card>
      : (
        <div className="flex flex-col gap-2.5">
          {shown.map((t) => {
            const st = STAT[t.status] ?? STAT.planned;
            const kids = t.headcount ?? t.childNames.length;
            const understaffed = kids > 0 && t.staff.length > 0 && kids / t.staff.length > ratioTarget;
            const raSignedOff = !!t.raSigned && raReady(t.hazards ?? []);
            return (
              <Card key={t.id} className="overflow-hidden p-0">
                <div className="h-1.5 w-full" style={{ background: st.fg }} />
                <div className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-[16px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{t.destination}</span>
                        {t.transport && <span className="text-[12.5px] text-[var(--ink-2)]">· {t.transport}</span>}
                      </div>
                      <p className="mt-1 text-[12.5px] text-[var(--ink-2)]">{fmtDate(t.date)}{t.departTime ? ` · ${t.departTime}` : ""}{t.returnTime ? `–${t.returnTime}` : ""}</p>
                    </div>
                    <div className="flex flex-col items-start gap-1.5 sm:items-end">
                      <Badge tone={{ bg: st.bg, fg: st.fg }}>{st.label}</Badge>
                      <span className="text-[11.5px] text-[var(--ink-3)]">{kids} child{kids === 1 ? "" : "ren"} · {t.staff.length} staff</span>
                      {(t.hazards?.length ?? 0) > 0 && (raSignedOff ? <Badge tone={{ bg: "#e7f6ee", fg: "#0f7a43" }}>✓ RA signed</Badge> : <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>RA draft</Badge>)}
                      {t.consentObtained ? <Badge tone={{ bg: "#e7f6ee", fg: "#0f7a43" }}>✓ consent obtained</Badge> : <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>consent pending</Badge>}
                      {understaffed && <Badge tone={{ bg: "#fdebec", fg: "#c02636" }}>⚠️ over {ratioTarget}:1 ratio</Badge>}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
                    <Button sm onClick={() => setOpenId(openId === t.id ? null : t.id)}>{openId === t.id ? "Hide details" : "Details"}</Button>
                    <Button sm variant="solid" onClick={() => { setEditing(t); setAdding(false); setOpenId(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</Button>
                    {canManage && <Button sm variant="danger" onClick={() => remove(t)}>Delete</Button>}
                  </div>
                  {openId === t.id && (
                    <div className="mt-2.5 grid gap-x-6 gap-y-1.5 rounded-xl bg-[var(--panel)] px-3.5 py-3 text-[12px] sm:grid-cols-2">
                      {t.transport && <div><span className="text-[var(--ink-3)]">Transport: </span><b>{t.transport}</b></div>}
                      <div><span className="text-[var(--ink-3)]">Ratio: </span><b>{t.staff.length ? `${kids}:${t.staff.length} (${(kids / t.staff.length).toFixed(1)} per staff)` : "no staff added"}</b></div>
                      {t.childNames.length > 0 && <div className="sm:col-span-2"><span className="text-[var(--ink-3)]">Children: </span><b>{t.childNames.join(", ")}</b></div>}
                      {t.staff.length > 0 && <div className="sm:col-span-2"><span className="text-[var(--ink-3)]">Staff: </span><b>{t.staff.join(", ")}</b></div>}
                      {(t.hazards?.length ?? 0) > 0 && (
                        <div className="sm:col-span-2">
                          <div className="mb-1 text-[var(--ink-3)]">Risk assessment {raSignedOff ? <b className="text-[#0f7a43]">· signed off by {t.raAssessor} ({fmtDate(t.raDate)})</b> : <b className="text-[#9a5a00]">· draft</b>}</div>
                          <div className="flex flex-col gap-1">
                            {t.hazards!.map((h, i) => (
                              <div key={i} className="flex items-start gap-2 rounded-md bg-[var(--surface)] px-2 py-1">
                                <span className="mt-0.5">{h.done ? "✓" : "○"}</span>
                                <div className="flex-1"><b>{h.h}</b>{h.who ? <span className="text-[var(--ink-3)]"> · {h.who}</span> : ""}{h.controls ? <div className="text-[var(--ink-2)]">{h.controls}</div> : null}</div>
                                {h.residual && <Badge tone={{ bg: RISK[h.residual as "L" | "M" | "H"].bg, fg: RISK[h.residual as "L" | "M" | "H"].fg }}>{RISK[h.residual as "L" | "M" | "H"].lbl}</Badge>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {t.notes && <div className="sm:col-span-2"><span className="text-[var(--ink-3)]">Notes: </span><b>{t.notes}</b></div>}
                      {t.createdByName && <div><span className="text-[var(--ink-3)]">Planned by: </span><b>{t.createdByName}</b></div>}
                    </div>
                  )}
                  {notifies && t.status === "planned" && !t.consentObtained && (
                    <div className="mt-2.5 rounded-lg bg-[#f4f8ff] px-3 py-2 text-[11.5px] text-[var(--ink-2)]">📨 Parents of the children on this trip are asked for consent in their area, and reminded until they give it.</div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
