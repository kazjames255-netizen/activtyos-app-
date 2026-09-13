"use client";

// Clock in/out + timesheets — demo store, model, and actions. Staff clock in/out
// and take breaks; the operator sees who's in / on break / off, and actual hours
// feed the pay run. Clocking also stamps the matching rota shift's in/out so the
// Schedule's check-in state and payroll's "actual rostered hours" pick it up.
// Real per-user identity, device kiosk + geofence, and payroll posting are Amir's
// (docs/timeclock-handoff.md). Matched to people by name (demo).
import { DEMO_STAFF } from "@/features/learning/credentials";
import { useEffect } from "react";
import { get as apiGet, isDemoMode, patch as apiPatch, post as apiPost } from "@/lib/api";
import { ukShiftHours } from "@/features/payroll/payCalc";

export type ClockStatus = "out" | "in" | "break";
export interface ClockEvent { t: string; kind: "in" | "out" | "break-start" | "break-end"; loc?: string }
export interface ClockRecord {
  id: string; name: string; role?: string; op?: string;
  status: ClockStatus;
  clockInAt?: string;   // ISO — today's clock-in
  clockOutAt?: string;  // ISO — today's clock-out
  breakStart?: string;  // ISO — current break start (status === "break")
  breakMs: number;      // accumulated break time today
  lateMin?: number;     // minutes late vs the scheduled shift start
  loc?: string;         // where they clocked in (label)
  approved?: boolean;   // timesheet approved for payroll
  payBasis?: "actual" | "scheduled" | "scheduled-less-late" | "custom"; // how to pay this shift (manager override) — mirrors the global pay policy + "set hours"
  payHoursOverride?: number; // hours when payBasis === "custom"
  editNote?: string;    // manager's reason for editing times/pay
  events: ClockEvent[];
  day: string;          // ISO date these events belong to
}
// Global pay policy (the default for everyone; a per-row payBasis overrides it):
//  actual              — pay the hours they actually clocked
//  scheduled           — pay their scheduled hours flat (ignore clock times)
//  scheduled-less-late — pay scheduled hours MINUS any lateness (early arrival adds nothing)
export type PayPolicy = "actual" | "scheduled" | "scheduled-less-late";
// A "lead" (label configurable) can see everyone working at their own listing.
export interface ClockSettings { payPolicy: PayPolicy; autoPayOvertime: boolean; graceMin: number; rounding: 0 | 5 | 15; leadLabel: string }

export const DEFAULT_CLOCK_SETTINGS: ClockSettings = { payPolicy: "actual", autoPayOvertime: false, graceMin: 5, rounding: 0, leadLabel: "Lead" };
export const CLOCK_KEY = "aos.timeclock.v1";
export const CLOCK_SETTINGS_KEY = "aos.timeclock.settings.v1";
const ROTA_KEY = "aos.rota.v5";
const HOLIDAY_KEY = "aos.holiday.absences.v1";

export const slug = (name: string) => name.trim().toLowerCase().replace(/\s+/g, "-");
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const hhmm = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "");
export const fmtDur = (ms: number) => { const m = Math.max(0, Math.round(ms / 60000)); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`; };
// Same, but with live seconds — for the ticking "worked today" clock.
export const fmtDurSec = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m ${String(s % 60).padStart(2, "0")}s`; };
export function sinceLabel(iso?: string): string { if (!iso) return ""; const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000); if (min < 1) return "just now"; if (min < 60) return `${min}m ago`; return `${Math.floor(min / 60)}h ${min % 60}m ago`; }

const read = <T,>(key: string): T | null => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
const write = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } };

// ── Settings ────────────────────────────────────────────────────────────────
export const loadClockSettings = (): ClockSettings => ({ ...DEFAULT_CLOCK_SETTINGS, ...(read<Partial<ClockSettings>>(CLOCK_SETTINGS_KEY) || {}) });
export const saveClockSettings = (s: ClockSettings) => write(CLOCK_SETTINGS_KEY, s);

// ── Rota lookups (scheduled shift + rate for a person today) ────────────────
interface RotaShift { staffId: string | null; date: string; start: string; end: string; in?: string; out?: string; clockedBreakMin?: number }
interface RotaStaff { id: string; name: string; rate?: number }
function rota(): { staff: RotaStaff[]; shifts: RotaShift[] } { const s = read<{ staff?: RotaStaff[]; shifts?: RotaShift[] }>(ROTA_KEY); return { staff: s?.staff || [], shifts: s?.shifts || [] }; }
const mins = (t: string) => { const [h, m] = (t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
// today's scheduled shift for a person (by name)
export function shiftToday(name: string): RotaShift | undefined {
  const { staff, shifts } = rota(); const day = todayISO(); const nm = name.trim().toLowerCase();
  const ids = new Set(staff.filter((s) => (s.name || "").trim().toLowerCase() === nm).map((s) => s.id));
  return shifts.find((sh) => sh.staffId && ids.has(sh.staffId) && sh.date === day);
}
export function rateFor(name: string): number { const nm = name.trim().toLowerCase(); return rota().staff.find((s) => (s.name || "").trim().toLowerCase() === nm)?.rate ?? 0; }
// real hours, so the night the clocks change isn't capped an hour short (d16s7)
export function scheduledHoursToday(name: string): number { const sh = shiftToday(name); if (!sh) return 0; return sh.date ? ukShiftHours(sh.date, sh.start, sh.end) : Math.max(0, mins(sh.end) - mins(sh.start)) / 60; }
// stamp the person's rota shift in/out (so Schedule + payroll see the real time)
// — on the server (the rota lives there; this browser's copy is only a cache
// that the next sync replaces), and in the cache so this screen sees it now.
// On clock-out the break actually taken goes with it, so payroll pays the real
// break, not the planned one (d16s3).
function stampShift(name: string, field: "in" | "out", hm: string, breakMin?: number) {
  if (!isDemoMode()) void apiPost("/api/rota/clock", { field, hm, date: todayISO(), name, ...(breakMin !== undefined ? { breakMin } : {}) }).catch(() => {});
  const store = read<{ staff?: RotaStaff[]; shifts?: RotaShift[] }>(ROTA_KEY); if (!store || !store.shifts) return;
  const day = todayISO(); const nm = name.trim().toLowerCase();
  const ids = new Set((store.staff || []).filter((s) => (s.name || "").trim().toLowerCase() === nm).map((s) => s.id));
  const sh = store.shifts.find((x) => x.staffId && ids.has(x.staffId) && x.date === day);
  if (sh) { sh[field] = hm; if (breakMin !== undefined) sh.clockedBreakMin = breakMin; write(ROTA_KEY, store); }
}

// ── Who's off today (approved leave), from the Holiday planner ──────────────
export function offToday(): { name: string; kind: string }[] {
  const day = todayISO(); const arr = read<{ name: string; kind: string; status: string; start: string; end: string }[]>(HOLIDAY_KEY) || [];
  return arr.filter((a) => a && a.status === "approved" && a.start <= day && a.end >= day).map((a) => ({ name: a.name, kind: a.kind }));
}

// ── Records ─────────────────────────────────────────────────────────────────
function seed(): Record<string, ClockRecord> {
  const now = new Date(); const at = (hoursAgo: number, minAgo = 0) => new Date(now.getTime() - hoursAgo * 3600000 - minAgo * 60000).toISOString();
  const base = (name: string, role: string, op: string): ClockRecord => ({ id: slug(name), name, role, op, status: "out", breakMs: 0, events: [], day: todayISO() });
  const out: Record<string, ClockRecord> = {};
  DEMO_STAFF.forEach((s) => { out[slug(s.name)] = base(s.name, s.role, s.op); });
  const setIn = (name: string, hoursAgo: number, late = 0, loc?: string) => { const r = out[slug(name)]; if (!r) return; const t = at(hoursAgo); r.status = "in"; r.clockInAt = t; r.lateMin = late; r.loc = loc; r.events = [{ t, kind: "in", loc }]; };
  setIn("Jess Patel", 3, 0, "Company-owned");
  setIn("Aisha Rahman", 2.5, 0, "Milton Keynes");
  setIn("Dan Reed", 2, 12, "Bedford");                 // 12 min late
  // Tom Lewis on a break
  { const r = out[slug("Tom Lewis")]; const t = at(2.2); const bs = at(0, 20); r.status = "break"; r.clockInAt = t; r.breakStart = bs; r.loc = "Milton Keynes"; r.events = [{ t, kind: "in", loc: "Milton Keynes" }, { t: bs, kind: "break-start" }]; }
  return out;
}
// So the scheduled-shift + on-time/late display has data even if the Schedule
// page was never opened: seed a demo rota matching the clock records — each
// clocked-in person's shift starts when they clocked in, minus any lateness, so
// "in 12:50 · 12m late · shift 12:38" all agrees. Only writes when the rota is
// empty, so a real/seeded schedule is never clobbered.
// A deterministic demo lateness per person (minutes) — mostly on time, a few
// clearly late — so the "clocked in late by X" display is actually visible.
const DEMO_LATES = [0, 0, 0, 11, 24, 43];
const demoLateFor = (r: ClockRecord) => (r.lateMin && r.lateMin > 0 ? r.lateMin : DEMO_LATES[[...r.name].reduce((n, c) => n + c.charCodeAt(0), 0) % DEMO_LATES.length]);
// Seed a demo rota so every clocked-in person has a scheduled shift (their start
// = clock-in minus a demo lateness, so a mix read as on-time / late). Marked
// `demo:true` so we can refresh it, but NEVER touch a real/seeded rota.
function ensureDemoRota(recs: Record<string, ClockRecord>): void {
  const raw = read<{ staff?: RotaStaff[]; shifts?: RotaShift[]; demo?: boolean }>(ROTA_KEY);
  // Only ever write when the rota is absent or our own demo — never touch a real
  // schedule (any store the Schedule saved, even with staff but no shifts yet).
  if (raw && !raw.demo && ((raw.shifts?.length ?? 0) > 0 || (raw.staff?.length ?? 0) > 0)) return;
  const day = todayISO();
  const pad = (n: number) => String(n).padStart(2, "0");
  const hm = (t: number) => `${pad(Math.floor((((t % 1440) + 1440) % 1440) / 60))}:${pad(((t % 60) + 60) % 60)}`;
  const staff: RotaStaff[] = []; const shifts: RotaShift[] = [];
  for (const r of Object.values(recs)) {
    // A rate so the pay-per-shift figures have something to show. Only ever
    // written into our OWN demo rota (guarded above), never a real schedule —
    // a real one carries the rates the operator set.
    staff.push({ id: r.id, name: r.name, rate: /lead/i.test(r.role ?? "") ? 14.25 : 12.5 });
    const startMin = r.clockInAt ? mins(hhmm(r.clockInAt)) - demoLateFor(r) : mins("09:00");
    shifts.push({ staffId: r.id, date: day, start: hm(startMin), end: hm(startMin + 360) });
  }
  write(ROTA_KEY, { staff, shifts, demo: true });
}
// UI-truth lateness: how late vs their scheduled shift start (falls back to the
// stored value). Recomputed live so it's always right for the current rota.
export function lateMinutesToday(r: ClockRecord): number {
  if (!r.clockInAt) return 0;
  const sh = shiftToday(r.name);
  if (sh) return Math.max(0, mins(hhmm(r.clockInAt)) - mins(sh.start));
  return r.lateMin || 0;
}
export const loadClock = (): Record<string, ClockRecord> => {
  const s = read<Record<string, ClockRecord>>(CLOCK_KEY);
  // Demo people (Marcus Bell & co.) and a demo rota are for the demo only — a
  // real provider's board starts empty and fills from the server (syncClock).
  const fresh = () => { if (!isDemoMode()) return {}; const x = seed(); ensureDemoRota(x); return x; };
  if (!s || typeof s !== "object") return fresh();
  // daily reset: if the stored day isn't today, start fresh (keeps demo sane)
  const anyDay = Object.values(s)[0]?.day;
  if (anyDay && anyDay !== todayISO()) return fresh();
  if (isDemoMode()) ensureDemoRota(s);
  return s;
};
export const saveClock = (r: Record<string, ClockRecord>) => write(CLOCK_KEY, r);

// ── Server sync ─────────────────────────────────────────────────────────────
// Clock records live on the server (/api/timeclock); this browser's copy is a
// cache so the screens can read it synchronously. Before, each device only
// ever saw its own clockings — a phone clock-in never reached the manager's
// board or the timesheets.
export const CLOCK_EVENT = "aos:clock";
let syncing: Promise<void> | null = null;
export function syncClock(): Promise<void> {
  if (typeof window === "undefined" || isDemoMode()) return Promise.resolve();
  if (syncing) return syncing;
  syncing = apiGet<ClockRecord[]>(`/api/timeclock?day=${todayISO()}`)
    .then((list) => {
      const map: Record<string, ClockRecord> = {};
      for (const r of list) map[r.id] = { ...r, breakMs: r.breakMs ?? 0, events: r.events ?? [], day: r.day ?? todayISO() };
      write(CLOCK_KEY, map);
      window.dispatchEvent(new Event(CLOCK_EVENT));
    })
    .catch(() => {})
    .finally(() => { syncing = null; });
  return syncing;
}
let clockTimer: ReturnType<typeof setInterval> | null = null;
/** Keep the cache fresh while the portal is open (PortalGuard starts it). */
export function startClockSync(): void {
  if (clockTimer || typeof window === "undefined" || isDemoMode()) return;
  void syncClock();
  clockTimer = setInterval(() => { if (document.visibilityState === "visible") void syncClock(); }, 30_000);
}
/** Re-read the cache whenever the server copy lands. */
export function useClockRefresh(onChange: (all: Record<string, ClockRecord>) => void): void {
  useEffect(() => {
    const h = () => onChange(loadClock());
    window.addEventListener(CLOCK_EVENT, h);
    return () => window.removeEventListener(CLOCK_EVENT, h);
  }, [onChange]);
}
function sendEvent(kind: ClockEvent["kind"], name: string, extra: { role?: string; loc?: string; lateMin?: number } = {}) {
  if (isDemoMode()) return;
  void apiPost("/api/timeclock/event", { kind, day: todayISO(), name, ...extra })
    .then(() => syncClock())
    // Say so — a clocking that only this phone knows about is the failure this
    // whole store exists to prevent.
    .catch((e: unknown) => { alert(`Your ${kind === "in" ? "clock-in" : kind === "out" ? "clock-out" : "break"} wasn't saved to the team board: ${e instanceof Error ? e.message : "no connection"}. Try again.`); });
}
function sendPatch(id: string, patch: Record<string, unknown>) {
  if (isDemoMode()) return;
  void apiPatch(`/api/timeclock/${encodeURIComponent(id)}?day=${todayISO()}`, patch).then(() => syncClock()).catch(() => {});
}

// mutate one person's record and persist; returns the new map
function mutate(all: Record<string, ClockRecord>, id: string, fn: (r: ClockRecord) => void): Record<string, ClockRecord> {
  const next = { ...all }; const r = { ...(next[id] || { id, name: id, status: "out" as ClockStatus, breakMs: 0, events: [], day: todayISO() }) };
  r.events = [...r.events]; fn(r); next[id] = r; saveClock(next); return next;
}

// ── Actions ─────────────────────────────────────────────────────────────────
export function clockIn(all: Record<string, ClockRecord>, id: string, name: string, loc?: string): Record<string, ClockRecord> {
  const now = new Date(); const iso = now.toISOString(); const hm = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const sh = shiftToday(name); const late = sh ? Math.max(0, mins(hm) - mins(sh.start)) : 0;
  stampShift(name, "in", hm);
  sendEvent("in", name, { role: all[id]?.role, loc, lateMin: late });
  return mutate(all, id, (r) => { r.status = "in"; r.clockInAt = iso; r.clockOutAt = undefined; r.breakMs = 0; r.breakStart = undefined; r.lateMin = late; r.loc = loc; r.day = todayISO(); r.events.push({ t: iso, kind: "in", loc }); });
}
export function clockOut(all: Record<string, ClockRecord>, id: string, name: string): Record<string, ClockRecord> {
  const now = new Date(); const iso = now.toISOString(); const hm = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const cur = all[id]; const brMs = (cur?.breakMs ?? 0) + (cur?.status === "break" && cur.breakStart ? now.getTime() - new Date(cur.breakStart).getTime() : 0);
  stampShift(name, "out", hm, Math.round(brMs / 60000));
  sendEvent("out", name);
  return mutate(all, id, (r) => { if (r.status === "break" && r.breakStart) { r.breakMs += Date.now() - new Date(r.breakStart).getTime(); r.breakStart = undefined; } r.status = "out"; r.clockOutAt = iso; r.events.push({ t: iso, kind: "out" }); });
}
export function startBreak(all: Record<string, ClockRecord>, id: string): Record<string, ClockRecord> {
  const iso = new Date().toISOString();
  sendEvent("break-start", all[id]?.name ?? id);
  return mutate(all, id, (r) => { if (r.status !== "in") return; r.status = "break"; r.breakStart = iso; r.events.push({ t: iso, kind: "break-start" }); });
}
export function endBreak(all: Record<string, ClockRecord>, id: string): Record<string, ClockRecord> {
  const iso = new Date().toISOString();
  sendEvent("break-end", all[id]?.name ?? id);
  return mutate(all, id, (r) => { if (r.status !== "break" || !r.breakStart) return; r.breakMs += Date.now() - new Date(r.breakStart).getTime(); r.breakStart = undefined; r.status = "in"; r.events.push({ t: iso, kind: "break-end" }); });
}

// worked ms today = (out || now) − in − breaks (incl. an ongoing break)
export function workedMs(r: ClockRecord, now = Date.now()): number {
  if (!r.clockInAt) return 0;
  const end = r.clockOutAt ? new Date(r.clockOutAt).getTime() : now;
  let br = r.breakMs; if (r.status === "break" && r.breakStart) br += now - new Date(r.breakStart).getTime();
  return Math.max(0, end - new Date(r.clockInAt).getTime() - br);
}
// Hours to pay for: worked time, plus the break back when breaks are paid
// (Setup → Scheduling → "Default break — paid or unpaid"; d16s3).
export function paidMs(r: ClockRecord, breakPaid = false, now = Date.now()): number {
  if (!breakPaid || !r.clockInAt) return workedMs(r, now);
  return Math.max(0, (r.clockOutAt ? new Date(r.clockOutAt).getTime() : now) - new Date(r.clockInAt).getTime());
}
export const roundHours =(h: number, rounding: 0 | 5 | 15) => (rounding ? Math.round((h * 60) / rounding) * rounding / 60 : h);
export function setApproved(all: Record<string, ClockRecord>, id: string, approved: boolean): Record<string, ClockRecord> { sendPatch(id, { approved }); return mutate(all, id, (r) => { r.approved = approved; }); }
// Manager edit of a timesheet row (times / break / pay basis). Recomputes lateMin.
export function editRecord(all: Record<string, ClockRecord>, id: string, patch: Partial<ClockRecord>): Record<string, ClockRecord> {
  const next = mutate(all, id, (r) => {
    Object.assign(r, patch);
    if (patch.clockInAt && r.clockInAt) { const sh = shiftToday(r.name); const hm = new Date(r.clockInAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); r.lateMin = sh ? Math.max(0, mins(hm) - mins(sh.start)) : 0; }
  });
  const r = next[id];
  const keys = ["approved", "payBasis", "payHoursOverride", "editNote", "clockInAt", "clockOutAt", "breakMs", "lateMin"] as const;
  const nullable = new Set<string>(["payBasis", "payHoursOverride", "clockOutAt"]);
  const body: Record<string, unknown> = {};
  for (const k of keys) {
    if (!(k in patch) && !(k === "lateMin" && patch.clockInAt)) continue;
    const v = r?.[k];
    if (v !== undefined) body[k] = v; else if (nullable.has(k)) body[k] = null;
  }
  sendPatch(id, body);
  return next;
}
// pay hours for an explicit per-row override (lateOverH = late minutes over grace, in hours)
export function payHours(r: ClockRecord, rounding: 0 | 5 | 15, lateOverH = 0, breakPaid = false): number {
  const worked = roundHours(paidMs(r, breakPaid) / 3600000, rounding);
  const sched = scheduledHoursToday(r.name);
  if (r.payBasis === "scheduled") return sched || worked;
  if (r.payBasis === "scheduled-less-late") return Math.max(0, (sched || worked) - lateOverH);
  if (r.payBasis === "custom") return r.payHoursOverride ?? worked;
  return worked; // "actual" — full worked hours (explicit manager choice, uncapped)
}
