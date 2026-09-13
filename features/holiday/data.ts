"use client";

// Holiday planner store. Server-backed since 12 Sept (GET /api/leave, POST
// /api/leave/absences, …/decide, …/cancel, PUT /api/leave/config): a request
// reaches the manager's bell, a decision reaches the person, and every device
// sees the same planner. It used to be this browser's localStorage, seeded
// with made-up staff and absences.
//
// The screens keep their simple load/save API. localStorage stays as a cache
// (the rota, clock and payroll read it too); saveAbsences() works out what
// changed against the server's last copy and sends just that — the server
// decides what this account is allowed to do (staff: ask for themselves,
// cancel their own; managers: record, edit, decide).
import { DEMO_STAFF } from "@/features/learning/credentials";
import { api, get as apiGet, isDemoMode, post as apiPost, put as apiPut } from "@/lib/api";
import {
  type Absence, type LeaveProfile, type HolidayPolicy, DEFAULT_POLICY,
  HOLIDAY_ABSENCES_KEY, HOLIDAY_POLICY_KEY, HOLIDAY_PROFILES_KEY,
  isoDate, workingDays,
} from "@/lib/holiday";

export const slug = (name: string) => name.trim().toLowerCase().replace(/\s+/g, "-");

const read = <T,>(key: string): T | null => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
const write = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } };

/** Fired after the server copy lands (screens re-read), or a save is refused. */
export const LEAVE_EVENT = "aos:leave";
export const LEAVE_ERROR_EVENT = "aos:leave-error";
const announce = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(LEAVE_EVENT)); };
const fail = (msg: string) => { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(LEAVE_ERROR_EVENT, { detail: msg })); };

// ── Policy ──────────────────────────────────────────────────────────────────
export const loadPolicy = (): HolidayPolicy => ({ ...DEFAULT_POLICY, ...(read<Partial<HolidayPolicy>>(HOLIDAY_POLICY_KEY) || {}) });
export const savePolicy = (p: HolidayPolicy) => {
  write(HOLIDAY_POLICY_KEY, p);
  if (!isDemoMode()) void apiPut("/api/leave/config", { policy: p }).catch((e) => fail(e instanceof Error ? e.message : "Couldn't save the leave policy"));
};

// ── Profiles (per-employee allowance layer) ─────────────────────────────────
// Demo only (the guided tour): a little variety — part-timers, custom
// allowances, carry-over.
const PROFILE_TWEAKS: Record<string, Partial<LeaveProfile>> = {
  "Marcus Bell": { allowanceDays: 25, carriedOver: 3, daysPerWeek: 5 },
  "Jess Patel": { daysPerWeek: 4 },
  "Aisha Rahman": { allowanceDays: 25, daysPerWeek: 5 },
  "Tom Lewis": { daysPerWeek: 3, holidayPay: "rolled-up" },
  "Priya Khan": { daysPerWeek: 5, startDate: undefined },
  "Dan Reed": { allowanceDays: 28, carriedOver: 2, daysPerWeek: 5 },
};
export function seedProfiles(): LeaveProfile[] {
  return DEMO_STAFF.map((s) => ({ id: slug(s.name), name: s.name, role: s.role, op: s.op, daysPerWeek: 5, carriedOver: 0, ...PROFILE_TWEAKS[s.name] }));
}
/** Real team with no saved allowances yet: start from the people on the rota. */
function profilesFromRota(): LeaveProfile[] {
  const r = read<{ staff?: { name?: string; role?: string }[] }>("aos.rota.v5");
  return (r?.staff ?? []).filter((s) => s.name?.trim()).map((s) => ({ id: slug(s.name!), name: s.name!.trim(), role: s.role, daysPerWeek: 5, carriedOver: 0 }));
}
export const loadProfiles = (): LeaveProfile[] => {
  const s = read<LeaveProfile[]>(HOLIDAY_PROFILES_KEY);
  if (Array.isArray(s) && s.length) return s;
  return isDemoMode() ? seedProfiles() : profilesFromRota();
};
export const saveProfiles = (p: LeaveProfile[]) => {
  write(HOLIDAY_PROFILES_KEY, p);
  if (!isDemoMode()) void apiPut("/api/leave/config", { profiles: p }).catch((e) => fail(e instanceof Error ? e.message : "Couldn't save allowances"));
};

// ── Absences ────────────────────────────────────────────────────────────────
export function seedAbsences(): Absence[] {
  const today = new Date();
  const d = (offset: number) => { const x = new Date(today); x.setDate(x.getDate() + offset); return isoDate(x); };
  const now = () => new Date().toISOString();
  const mk = (id: string, name: string, kind: Absence["kind"], start: string, end: string, status: Absence["status"], extra: Partial<Absence> = {}): Absence =>
    ({ id, staffId: slug(name), name, kind, start, end, days: workingDays(start, end, { half: extra.half ?? null }), status, requestedAt: now(), ...extra });
  return [
    mk("seed-1", "Jess Patel", "annual", d(6), d(12), "pending", { reason: "Family trip" }),
    mk("seed-2", "Aisha Rahman", "annual", d(8), d(9), "pending", { reason: "Long weekend" }),
    mk("seed-3", "Priya Khan", "annual", d(13), d(13), "pending", { half: "am", reason: "Appointment" }),
    mk("seed-4", "Marcus Bell", "annual", d(40), d(44), "pending", { reason: "Half-term break" }),
    mk("seed-5", "Priya Khan", "annual", d(20), d(24), "approved", { decidedBy: "You", decidedAt: now() }),
    mk("seed-6", "Marcus Bell", "annual", d(-30), d(-26), "approved", { decidedBy: "You", decidedAt: now() }),
    mk("seed-7", "Tom Lewis", "sickness", d(-3), d(-2), "approved", { reason: "Flu", decidedBy: "You", decidedAt: now() }),
    mk("seed-8", "Dan Reed", "toil", d(-10), d(-10), "approved", { half: "pm", reason: "Weekend event cover", decidedBy: "You", decidedAt: now() }),
    mk("seed-9", "Marcus Bell", "sickness", d(-60), d(-60), "approved", { decidedBy: "You", decidedAt: now() }),
  ];
}
export const loadAbsences = (): Absence[] => {
  const s = read<Absence[]>(HOLIDAY_ABSENCES_KEY);
  if (isDemoMode()) return Array.isArray(s) ? s : seedAbsences();
  // A real account never shows the old demo's made-up "seed-" absences.
  return Array.isArray(s) ? s.filter((a) => !a.id.startsWith("seed-")) : [];
};

// The server's last copy — what a save is diffed against.
let serverAbsences: Absence[] | null = null;

// Absences entered in this browser before leave moved server-side. They are
// NOT uploaded automatically: localStorage is per browser, not per account, and
// an HQ user viewing several accounts would push one provider's staff leave
// (sickness included) into another's. They're set aside here, and the manager's
// planner offers to import them into the account they're looking at.
const LOCAL_BACKUP_KEY = "aos.holiday.absences.local-backup";
export const pendingLocalAbsences = (): Absence[] => (read<Absence[]>(LOCAL_BACKUP_KEY) ?? []).filter((a) => !a.id.startsWith("seed-"));
export async function importLocalAbsences(): Promise<{ ok: number; failed: number }> {
  const list = pendingLocalAbsences();
  let ok = 0, failed = 0;
  for (const a of list) {
    try { await apiPost("/api/leave/absences", a); ok++; } catch { failed++; }
  }
  if (!failed) { try { localStorage.removeItem(LOCAL_BACKUP_KEY); } catch { /* ignore */ } }
  await syncLeave();
  return { ok, failed };
}
export const discardLocalAbsences = () => { try { localStorage.removeItem(LOCAL_BACKUP_KEY); } catch { /* ignore */ } announce(); };

const fetchLeave = () => apiGet<{ absences: Absence[]; profiles: LeaveProfile[]; policy: Partial<HolidayPolicy> | null }>("/api/leave");

/** Pull the planner from the server into the cache, then tell the screens. */
export async function syncLeave(): Promise<void> {
  if (isDemoMode()) return;
  const r = await fetchLeave();
  serverAbsences = r.absences ?? [];
  // Before the cache becomes the server's copy, set aside anything only this
  // browser has (once — the backup isn't overwritten) so nothing is lost.
  const onlyHere = (read<Absence[]>(HOLIDAY_ABSENCES_KEY) ?? [])
    .filter((a) => !a.id.startsWith("seed-") && !serverAbsences!.some((x) => x.id === a.id || x.id.endsWith(`_${a.id}`)));
  if (onlyHere.length && !read<Absence[]>(LOCAL_BACKUP_KEY)?.length && !localStorage.getItem("aos.holiday.synced.v1")) write(LOCAL_BACKUP_KEY, onlyHere);
  try { localStorage.setItem("aos.holiday.synced.v1", "1"); } catch { /* ignore */ }
  write(HOLIDAY_ABSENCES_KEY, serverAbsences);
  if (r.profiles?.length) write(HOLIDAY_PROFILES_KEY, r.profiles);
  if (r.policy) write(HOLIDAY_POLICY_KEY, { ...DEFAULT_POLICY, ...r.policy });
  announce();
}

const FIELDS: (keyof Absence)[] = ["name", "kind", "start", "end", "half", "fromTime", "toTime", "days", "reason", "paid", "pay", "ssp", "awe"];
const changed = (a: Absence, b: Absence) => FIELDS.some((k) => JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null));

/** Save the whole list. Writes the cache now; sends only what changed. */
export function saveAbsences(next: Absence[]) {
  write(HOLIDAY_ABSENCES_KEY, next);
  if (isDemoMode()) return;
  void (async () => {
    // Never diff against nothing: a save before the first fetch would read
    // every cached absence as new and duplicate it.
    if (serverAbsences === null) { try { serverAbsences = (await fetchLeave()).absences ?? []; } catch { fail("Couldn't reach the server — that change isn't saved"); return; } }
    sendDiff(serverAbsences, next);
  })();
}

function sendDiff(prev: Absence[], next: Absence[]) {
  const byId = new Map(prev.map((a) => [a.id, a]));
  const ops: Promise<unknown>[] = [];
  for (const n of next) {
    const p = byId.get(n.id);
    // "seed-…" records are the old demo planner's made-up absences, still in
    // some browsers' caches. Never upload them.
    if (!p && n.id.startsWith("seed-")) continue;
    if (!p) { ops.push(apiPost("/api/leave/absences", n)); continue; }
    if (n.status !== p.status) {
      if (n.status === "approved" || n.status === "declined") ops.push(apiPost(`/api/leave/absences/${encodeURIComponent(n.id)}/decide`, { status: n.status, note: n.note }));
      else if (n.status === "cancelled") ops.push(apiPost(`/api/leave/absences/${encodeURIComponent(n.id)}/cancel`, {}));
    }
    if (changed(n, p)) { const { id: _id, ...body } = n; ops.push(api(`/api/leave/absences/${encodeURIComponent(n.id)}`, { method: "PUT", body: JSON.stringify(body) })); }
  }
  // A record MISSING from the list is never taken as a cancellation — a stale
  // or half-loaded screen would otherwise cancel the whole team's leave.
  // Cancelling is an explicit status change (handled above).
  // Whatever happened, finish on the server's version — refused changes roll
  // back on screen, and new requests pick up their real ids.
  void Promise.allSettled(ops).then((results) => {
    const bad = results.find((x) => x.status === "rejected") as PromiseRejectedResult | undefined;
    if (bad) fail(bad.reason instanceof Error ? bad.reason.message : "Couldn't save that change");
    return syncLeave();
  }).catch(() => {});
}
