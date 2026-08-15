"use client";

// Clock in/out + timesheets — demo store, model, and actions. Staff clock in/out
// and take breaks; the operator sees who's in / on break / off, and actual hours
// feed the pay run. Clocking also stamps the matching rota shift's in/out so the
// Schedule's check-in state and payroll's "actual rostered hours" pick it up.
// Real per-user identity, device kiosk + geofence, and payroll posting are Amir's
// (docs/timeclock-handoff.md). Matched to people by name (demo).
import { DEMO_STAFF } from "@/features/learning/credentials";

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
  events: ClockEvent[];
  day: string;          // ISO date these events belong to
}
export interface ClockSettings { autoDeductLate: boolean; graceMin: number; rounding: 0 | 5 | 15 }

export const DEFAULT_CLOCK_SETTINGS: ClockSettings = { autoDeductLate: false, graceMin: 5, rounding: 0 };
export const CLOCK_KEY = "aos.timeclock.v1";
export const CLOCK_SETTINGS_KEY = "aos.timeclock.settings.v1";
const ROTA_KEY = "aos.rota.v5";
const HOLIDAY_KEY = "aos.holiday.absences.v1";

export const slug = (name: string) => name.trim().toLowerCase().replace(/\s+/g, "-");
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const hhmm = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "");
export const fmtDur = (ms: number) => { const m = Math.max(0, Math.round(ms / 60000)); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`; };
export function sinceLabel(iso?: string): string { if (!iso) return ""; const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000); if (min < 1) return "just now"; if (min < 60) return `${min}m ago`; return `${Math.floor(min / 60)}h ${min % 60}m ago`; }

const read = <T,>(key: string): T | null => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
const write = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } };

// ── Settings ────────────────────────────────────────────────────────────────
export const loadClockSettings = (): ClockSettings => ({ ...DEFAULT_CLOCK_SETTINGS, ...(read<Partial<ClockSettings>>(CLOCK_SETTINGS_KEY) || {}) });
export const saveClockSettings = (s: ClockSettings) => write(CLOCK_SETTINGS_KEY, s);

// ── Rota lookups (scheduled shift + rate for a person today) ────────────────
interface RotaShift { staffId: string | null; date: string; start: string; end: string; in?: string; out?: string }
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
export function scheduledHoursToday(name: string): number { const sh = shiftToday(name); if (!sh) return 0; return Math.max(0, mins(sh.end) - mins(sh.start)) / 60; }
// stamp the person's rota shift in/out (so Schedule + payroll see the real time)
function stampShift(name: string, field: "in" | "out", hm: string) {
  const store = read<{ staff?: RotaStaff[]; shifts?: RotaShift[] }>(ROTA_KEY); if (!store || !store.shifts) return;
  const day = todayISO(); const nm = name.trim().toLowerCase();
  const ids = new Set((store.staff || []).filter((s) => (s.name || "").trim().toLowerCase() === nm).map((s) => s.id));
  const sh = store.shifts.find((x) => x.staffId && ids.has(x.staffId) && x.date === day);
  if (sh) { sh[field] = hm; write(ROTA_KEY, store); }
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
export const loadClock = (): Record<string, ClockRecord> => {
  const s = read<Record<string, ClockRecord>>(CLOCK_KEY);
  if (!s || typeof s !== "object") return seed();
  // daily reset: if the stored day isn't today, start fresh (keeps demo sane)
  const anyDay = Object.values(s)[0]?.day;
  if (anyDay && anyDay !== todayISO()) return seed();
  return s;
};
export const saveClock = (r: Record<string, ClockRecord>) => write(CLOCK_KEY, r);

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
  return mutate(all, id, (r) => { r.status = "in"; r.clockInAt = iso; r.clockOutAt = undefined; r.breakMs = 0; r.breakStart = undefined; r.lateMin = late; r.loc = loc; r.day = todayISO(); r.events.push({ t: iso, kind: "in", loc }); });
}
export function clockOut(all: Record<string, ClockRecord>, id: string, name: string): Record<string, ClockRecord> {
  const now = new Date(); const iso = now.toISOString(); const hm = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  stampShift(name, "out", hm);
  return mutate(all, id, (r) => { if (r.status === "break" && r.breakStart) { r.breakMs += Date.now() - new Date(r.breakStart).getTime(); r.breakStart = undefined; } r.status = "out"; r.clockOutAt = iso; r.events.push({ t: iso, kind: "out" }); });
}
export function startBreak(all: Record<string, ClockRecord>, id: string): Record<string, ClockRecord> {
  const iso = new Date().toISOString();
  return mutate(all, id, (r) => { if (r.status !== "in") return; r.status = "break"; r.breakStart = iso; r.events.push({ t: iso, kind: "break-start" }); });
}
export function endBreak(all: Record<string, ClockRecord>, id: string): Record<string, ClockRecord> {
  const iso = new Date().toISOString();
  return mutate(all, id, (r) => { if (r.status !== "break" || !r.breakStart) return; r.breakMs += Date.now() - new Date(r.breakStart).getTime(); r.breakStart = undefined; r.status = "in"; r.events.push({ t: iso, kind: "break-end" }); });
}

// worked ms today = (out || now) − in − breaks (incl. an ongoing break)
export function workedMs(r: ClockRecord, now = Date.now()): number {
  if (!r.clockInAt) return 0;
  const end = r.clockOutAt ? new Date(r.clockOutAt).getTime() : now;
  let br = r.breakMs; if (r.status === "break" && r.breakStart) br += now - new Date(r.breakStart).getTime();
  return Math.max(0, end - new Date(r.clockInAt).getTime() - br);
}
export const roundHours = (h: number, rounding: 0 | 5 | 15) => (rounding ? Math.round((h * 60) / rounding) * rounding / 60 : h);
export function setApproved(all: Record<string, ClockRecord>, id: string, approved: boolean): Record<string, ClockRecord> { return mutate(all, id, (r) => { r.approved = approved; }); }
