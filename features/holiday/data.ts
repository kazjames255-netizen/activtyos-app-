"use client";

// Demo store + seeding for the holiday planner. Absences/policy/profiles live in
// localStorage; profiles seed from the shared staff roster (DEMO_STAFF) so the
// planner, payroll and schedule all talk about the same people. Real per-user
// identity + server storage are Amir's (docs/holiday-planner-handoff.md).
import { DEMO_STAFF } from "@/features/learning/credentials";
import {
  type Absence, type LeaveProfile, type HolidayPolicy, DEFAULT_POLICY,
  HOLIDAY_ABSENCES_KEY, HOLIDAY_POLICY_KEY, HOLIDAY_PROFILES_KEY,
  isoDate, workingDays,
} from "@/lib/holiday";

export const slug = (name: string) => name.trim().toLowerCase().replace(/\s+/g, "-");

const read = <T,>(key: string): T | null => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
const write = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } };

// ── Policy ──────────────────────────────────────────────────────────────────
export const loadPolicy = (): HolidayPolicy => ({ ...DEFAULT_POLICY, ...(read<Partial<HolidayPolicy>>(HOLIDAY_POLICY_KEY) || {}) });
export const savePolicy = (p: HolidayPolicy) => write(HOLIDAY_POLICY_KEY, p);

// ── Profiles (per-employee allowance layer) ─────────────────────────────────
// A little variety so the demo shows part-timers, custom allowances + carry-over.
const PROFILE_TWEAKS: Record<string, Partial<LeaveProfile>> = {
  "Marcus Bell": { allowanceDays: 25, carriedOver: 3, daysPerWeek: 5 },
  "Jess Patel": { daysPerWeek: 4 },                       // part-time → statutory 22.4
  "Aisha Rahman": { allowanceDays: 25, daysPerWeek: 5 },
  "Tom Lewis": { daysPerWeek: 3, holidayPay: "rolled-up" }, // seasonal/casual → holiday included in pay (12.07%)
  "Priya Khan": { daysPerWeek: 5, startDate: undefined },
  "Dan Reed": { allowanceDays: 28, carriedOver: 2, daysPerWeek: 5 },
};
export function seedProfiles(): LeaveProfile[] {
  return DEMO_STAFF.map((s) => ({ id: slug(s.name), name: s.name, role: s.role, op: s.op, daysPerWeek: 5, carriedOver: 0, ...PROFILE_TWEAKS[s.name] }));
}
export const loadProfiles = (): LeaveProfile[] => { const s = read<LeaveProfile[]>(HOLIDAY_PROFILES_KEY); return Array.isArray(s) && s.length ? s : seedProfiles(); };
export const saveProfiles = (p: LeaveProfile[]) => write(HOLIDAY_PROFILES_KEY, p);

// ── Absences ────────────────────────────────────────────────────────────────
export function seedAbsences(): Absence[] {
  const today = new Date();
  const d = (offset: number) => { const x = new Date(today); x.setDate(x.getDate() + offset); return isoDate(x); };
  const now = () => new Date().toISOString();
  const mk = (id: string, name: string, kind: Absence["kind"], start: string, end: string, status: Absence["status"], extra: Partial<Absence> = {}): Absence =>
    ({ id, staffId: slug(name), name, kind, start, end, days: workingDays(start, end, { half: extra.half ?? null }), status, requestedAt: now(), ...extra });
  return [
    // pending requests (the approvals queue)
    mk("seed-1", "Jess Patel", "annual", d(6), d(12), "pending", { reason: "Family trip" }),
    mk("seed-2", "Aisha Rahman", "annual", d(8), d(9), "pending", { reason: "Long weekend" }),   // clashes with Jess
    mk("seed-3", "Priya Khan", "annual", d(13), d(13), "pending", { half: "am", reason: "Appointment" }),
    mk("seed-4", "Marcus Bell", "annual", d(40), d(44), "pending", { reason: "Half-term break" }),
    // approved (booked / taken) + other kinds
    mk("seed-5", "Priya Khan", "annual", d(20), d(24), "approved", { decidedBy: "You", decidedAt: now() }),
    mk("seed-6", "Marcus Bell", "annual", d(-30), d(-26), "approved", { decidedBy: "You", decidedAt: now() }),
    mk("seed-7", "Tom Lewis", "sickness", d(-3), d(-2), "approved", { reason: "Flu", decidedBy: "You", decidedAt: now() }),
    mk("seed-8", "Dan Reed", "toil", d(-10), d(-10), "approved", { half: "pm", reason: "Weekend event cover", decidedBy: "You", decidedAt: now() }),
    mk("seed-9", "Marcus Bell", "sickness", d(-60), d(-60), "approved", { decidedBy: "You", decidedAt: now() }),
  ];
}
export const loadAbsences = (): Absence[] => { const s = read<Absence[]>(HOLIDAY_ABSENCES_KEY); return Array.isArray(s) ? s : seedAbsences(); };
export const saveAbsences = (a: Absence[]) => write(HOLIDAY_ABSENCES_KEY, a);
