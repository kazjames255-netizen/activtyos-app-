"use client";

import { useEffect, useMemo, useState } from "react";
import { get as apiGet, isDemoMode } from "@/lib/api";
import { useTenantSettings } from "@/lib/settings";
import { SchedulingSettingsForm } from "./SchedulingSettings";
import { Button, Card, Input, Select } from "@/components/ui";
import { PageHero, LIGHT_PALETTE } from "@/components/OperatorPage";

// ── Staff schedule / rota (manual edit663) ─────────────────────────────────
// Left staff panel + a grid that switches across a full set of views:
// {Day, Week, 2 Weeks, 4 Weeks, Month} × {by Area (Location→Role) | by Team
// member}. Day shows hour columns; the rest show date columns. Wages with
// on-cost, availability request, check-in alerts, auto-schedule, copy, publish.
// Demo store for now; backend owed (docs/availability-handoff.md).

const ON_COST = 12.07;
const money = (n: number) => `£${n.toFixed(2)}`;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const dt = (s: string) => new Date(`${s}T00:00:00Z`);
function mondayOf(d: Date) { const x = new Date(d); const day = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - day); return x; }
const mins = (t: string) => { const [h, m] = t.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const durH = (a: string, b: string) => Math.max(0, mins(b) - mins(a)) / 60;
const hourOf = (t: string) => Math.floor(mins(t) / 60);
const hLabel = (h: number) => (h === 0 ? "0h" : Number.isInteger(h) ? `${h}h` : `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`);
const to12 = (t: string) => { const [h, m] = t.split(":").map(Number); const ap = h < 12 ? "am" : "pm"; const hh = ((h + 11) % 12) + 1; return `${hh}:${String(m).padStart(2, "0")}${ap}`; };
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const addDays = (s: string, n: number) => { const x = dt(s); x.setUTCDate(x.getUTCDate() + n); return iso(x); };
const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) => mins(a.start) < mins(b.end) && mins(b.start) < mins(a.end);
const HOURS = Array.from({ length: 13 }, (_, i) => 7 + i); // 7am–7pm
type WDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
const WDAYS: [WDay, string][] = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]];
const WIN_A = 7 * 60, WIN = 19 * 60 - WIN_A; // availability bar window: 7am–7pm

type Week = Partial<Record<WDay, { from: string; to: string }>>;
interface Staff { id: string; name: string; role: string; rate: number; avail: "notsubmitted" | "confirmed"; reminders?: number; requested?: boolean; requestedScope?: "this" | "all"; requestedAt?: number; week?: Week; weeks?: Record<string, Week> }
interface Shift { id: string; staffId: string | null; site: string; role: string; listing?: string; season?: string; date: string; start: string; end: string; in?: string; out?: string; locked?: boolean; note?: string; brk?: { from: string; to: string }; checkinPokes?: number }
interface Store { staff: Staff[]; shifts: Shift[]; sites: string[] }

// weekday key for a date; per-week override (weeks[mondayIso]) falls back to the recurring pattern
const weekdayKey = (date: string): WDay => (["sun", "mon", "tue", "wed", "thu", "fri", "sat"][dt(date).getUTCDay()]) as WDay;
const effWeek = (st: Staff, date: string): Week => st.weeks?.[iso(mondayOf(dt(date)))] ?? st.week ?? {};
// availability of a staff member on a given day, for the assign panel
function dayAvail(st: Staff, date: string): { ok: boolean; label: string } {
  const w = effWeek(st, date)[weekdayKey(date)];
  return w ? { ok: true, label: `${to12(w.from)}–${to12(w.to)} available` } : { ok: false, label: "Unavailable this day" };
}
// group key: shifts sharing these fields are one "shift" (N needed / M filled) in the editor
const gkey = (s: { site: string; role: string; date: string; start: string; end: string }) => `${s.site}|${s.role}|${s.date}|${s.start}|${s.end}`;
// 12-hour split / join for the am–pm time dropdowns
const to12parts = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); const ap = h >= 12 ? "pm" : "am"; const hr = h % 12 === 0 ? 12 : h % 12; return { hr, m: String(m).padStart(2, "0"), ap }; };
const from12 = (hr: number, m: string, ap: string) => { let h = hr % 12; if (ap === "pm") h += 12; return `${String(h).padStart(2, "0")}:${m}`; };
const MIN_OPTS = ["00", "15", "30", "45"];

const ROLE_COL: Record<string, string> = { "Lead Coach": "#2f6bd8", "Lifeguard": "#0f857b", "Coach": "#6366f1", "Activity Assistant": "#8b5cf6", "Activity Instructor": "#b45309", "First Aider": "#c06a10" };
const roleCol = (r: string) => ROLE_COL[r] ?? "#64748b";
const ROLES = ["Lead Coach", "Coach", "Activity Instructor", "Lifeguard", "First Aider", "Activity Assistant"];

interface Template { id: string; name: string; items: { dayOffset: number; site: string; role: string; listing?: string; season?: string; staffId: string | null; start: string; end: string }[] }
const KEY = "aos.rota.v5";
const TKEY = "aos.rota.templates.v1";
const loadTpl = (): Template[] => { try { return JSON.parse(localStorage.getItem(TKEY) || "[]"); } catch { return []; } };
// Real-data only: the rota starts empty. Locations come from the library, listings
// & seasons from the operator's real data; shifts + staff are built here / wired.
const empty = (): Store => ({ staff: [], shifts: [], sites: [] });
const load = (): Store => { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && v.shifts ? v : empty(); } catch { return empty(); } };

// Approved holiday/absence pulled from the Holiday planner (aos.holiday.absences.v1)
// → a Set of `${nameLower}|${date}` so a person on leave can't be rostered.
function loadApprovedLeave(): Set<string> {
  const set = new Set<string>();
  try {
    const arr = JSON.parse(localStorage.getItem("aos.holiday.absences.v1") || "[]");
    if (Array.isArray(arr)) for (const a of arr) {
      if (!a || a.status !== "approved" || !a.name || !a.start || !a.end) continue;
      const nm = String(a.name).trim().toLowerCase();
      let d = a.start as string, guard = 0;
      while (d <= a.end && guard++ < 400) { set.add(`${nm}|${d}`); d = addDays(d, 1); }
    }
  } catch { /* ignore */ }
  return set;
}

type Span = "day" | "week" | "2w" | "4w" | "month";
type Group = "area" | "staff";
const SPANS: [Span, string][] = [["day", "Day"], ["week", "Week"], ["2w", "2 Weeks"], ["4w", "4 Weeks"], ["month", "Month"]];
const GROUPS: [Group, string][] = [["area", "Area"], ["staff", "Team member"]];
const SPAN_WORD: Record<Span, string> = { day: "today", week: "this week", "2w": "these 2 weeks", "4w": "these 4 weeks", month: "this month" };
// A grouped shift draft: one "shift" that needs `slots.length` staff, filled where slot != null.
type Draft = { groupIds: string[]; site: string; role: string; listing: string; season: string; date: string; start: string; end: string; slots: (string | null)[]; brk: { from: string; to: string } | null; note: string };

// Compact am–pm time picker (hour : minute : am/pm) matching the manual.
function TimeSel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const p = to12parts(value);
  const mins = MIN_OPTS.includes(p.m) ? MIN_OPTS : [...MIN_OPTS, p.m].sort();
  const cls = "border border-[var(--line)] bg-[var(--panel)] px-1.5 py-1 text-[13px] font-bold text-[var(--ink)] rounded-lg";
  return (
    <span className="inline-flex items-center gap-1">
      <Select value={p.hr} onChange={(e) => onChange(from12(Number(e.target.value), p.m, p.ap))} className={cls}>{Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h}</option>)}</Select>
      <span className="text-[var(--ink-3)]">:</span>
      <Select value={p.m} onChange={(e) => onChange(from12(p.hr, e.target.value, p.ap))} className={cls}>{mins.map((m) => <option key={m} value={m}>{m}</option>)}</Select>
      <Select value={p.ap} onChange={(e) => onChange(from12(p.hr, p.m, e.target.value))} className={cls}>{["am", "pm"].map((a) => <option key={a} value={a}>{a}</option>)}</Select>
    </span>
  );
}

export function ScheduleApp() {
  const [store, setStore] = useState<Store>(empty);
  const [anchor, setAnchor] = useState(() => iso(new Date()));
  const [span, setSpan] = useState<Span>("week");
  const [group, setGroup] = useState<Group>("area");
  const [site, setSite] = useState("all");
  const [listingF, setListingF] = useState("all");
  const [seasonSel, setSeasonSel] = useState<string[]>([]); // [] = all seasons; season is picked first
  const [seasonMenu, setSeasonMenu] = useState(false);
  const [q, setQ] = useState("");
  const [help, setHelp] = useState(false);
  const [canManage, setCanManage] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [autoMenu, setAutoMenu] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [hover, setHover] = useState<{ id: string; top: number; left: number } | null>(null);
  const [availEdit, setAvailEdit] = useState<Staff | null>(null);
  const [availWeekMode, setAvailWeekMode] = useState<"all" | "this">("all");
  const [reqOpen, setReqOpen] = useState(false); // Step 1: reveal the scope choice on click
  const [assignOpen, setAssignOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false); // keep the note field open once revealed, even if cleared
  const [actionsOpen, setActionsOpen] = useState(false);
  const [extraRoles, setExtraRoles] = useState<Record<string, string[]>>({});
  const [roleMenu, setRoleMenu] = useState<string | null>(null);
  const { settings: tenantSettings } = useTenantSettings();
  const roleOptions = tenantSettings.staffRoles?.length ? tenantSettings.staffRoles : ROLES;
  const onCost = tenantSettings.scheduling?.onCostPct ?? ON_COST;
  const firstDay = tenantSettings.scheduling?.firstDay ?? "mon";
  const defShiftH = tenantSettings.scheduling?.defaultShiftHours ?? 6;
  const defBreakM = tenantSettings.scheduling?.defaultBreakMins ?? 30;
  const breakUnpaid = (tenantSettings.scheduling?.breakPaid ?? "unpaid") === "unpaid";
  const checkinGrace = tenantSettings.scheduling?.checkinGraceMin ?? 15;
  const checkinAutoAlert = tenantSettings.scheduling?.checkinAutoAlert ?? true;
  const notifyOnPublish = tenantSettings.scheduling?.notifyOnPublish ?? "email_push";
  // Week start honours First-day-of-week (Mon default; Sun option).
  const weekStartOf = (d: Date) => { const x = new Date(d); const dow = x.getUTCDay(); const back = firstDay === "sun" ? dow : (dow + 6) % 7; x.setUTCDate(x.getUTCDate() - back); return x; };
  const addMins = (t: string, m: number) => { const [h, mm] = t.split(":").map(Number); const tot = h * 60 + mm + m; return `${String(Math.floor(tot / 60) % 24).padStart(2, "0")}:${String(tot % 60).padStart(2, "0")}`; };
  const addRole = (siteName: string, role: string) => { setExtraRoles((p) => ({ ...p, [siteName]: [...new Set([...(p[siteName] ?? []), role])] })); setRoleMenu(null); };
  const [toast, setToast] = useState<string | null>(null);
  const [venuesR, setVenuesR] = useState<{ id: string; name: string }[]>([]);
  const [listingsR, setListingsR] = useState<{ title: string; seasonId?: string | null; venueId?: string | null }[]>([]);
  const [schedView, setSchedView] = useState<"rota" | "settings">("rota");
  const [copyMenu, setCopyMenu] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplSaveOpen, setTplSaveOpen] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplListOpen, setTplListOpen] = useState(false);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  useEffect(() => {
    setStore(load()); setTemplates(loadTpl());
    apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {});
    apiGet<{ venues?: { id: string; name: string }[] }>("/api/library").then((lib) => setVenuesR(lib.venues ?? [])).catch(() => {});
    apiGet<{ title?: string; name?: string; seasonId?: string | null; venueId?: string | null }[]>("/api/listings?mine=1").then((rows) => setListingsR(rows.map((r) => ({ title: r.title || r.name || "", seasonId: r.seasonId ?? null, venueId: r.venueId ?? null })).filter((r) => r.title))).catch(() => {});
  }, []);
  // Real data drives the filters. Season is picked FIRST: it scopes which locations
  // and listings you then see (a listing carries its venueId + seasonId).
  const seasonNameOf = (sid?: string | null) => (tenantSettings.seasons ?? []).find((s) => s.id === sid)?.name;
  const inSeason = (sn?: string | null) => seasonSel.length === 0 || (sn != null && seasonSel.includes(sn));
  const scopedListings = useMemo(() => listingsR.filter((l) => inSeason(seasonNameOf(l.seasonId))), [listingsR, seasonSel, tenantSettings.seasons]);
  const scopedVenueIds = useMemo(() => new Set(scopedListings.map((l) => l.venueId).filter(Boolean) as string[]), [scopedListings]);
  const sites = useMemo(() => (seasonSel.length ? venuesR.filter((v) => scopedVenueIds.has(v.id)) : venuesR).map((v) => v.name), [venuesR, seasonSel, scopedVenueIds]);
  const persistTpl = (next: Template[]) => { setTemplates(next); try { localStorage.setItem(TKEY, JSON.stringify(next)); } catch { /* ignore */ } };
  const persist = (s: Store) => { setStore(s); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } };

  // Period dates for the current span/anchor
  const dates = useMemo(() => {
    if (span === "day") return [anchor];
    if (span === "month") { const d = dt(anchor); const y = d.getUTCFullYear(), m = d.getUTCMonth(); const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); return Array.from({ length: last }, (_, i) => iso(new Date(Date.UTC(y, m, i + 1)))); }
    const len = span === "week" ? 7 : span === "2w" ? 14 : 28;
    const start = iso(weekStartOf(dt(anchor)));
    return Array.from({ length: len }, (_, i) => addDays(start, i));
  }, [span, anchor, firstDay]);
  const dateSet = useMemo(() => new Set(dates), [dates]);
  const isDay = span === "day";

  const nav = (dir: 1 | -1) => {
    if (span === "day") setAnchor(addDays(anchor, dir));
    else if (span === "month") { const d = dt(anchor); setAnchor(iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + dir, 1)))); }
    else setAnchor(addDays(iso(weekStartOf(dt(anchor))), dir * (span === "week" ? 7 : span === "2w" ? 14 : 28)));
  };
  const label = useMemo(() => {
    if (span === "day") return dt(anchor).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
    if (span === "month") return dt(anchor).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
    const f = (s: string) => dt(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    return `${f(dates[0])} – ${f(dates[dates.length - 1])}`;
  }, [span, anchor, dates]);

  const staffById = useMemo(() => Object.fromEntries(store.staff.map((s) => [s.id, s])), [store.staff]);
  // approved leave from the Holiday planner (recomputed when the assign panel opens / period changes)
  const onLeaveSet = useMemo(() => loadApprovedLeave(), [assignOpen, anchor, span]);
  const onLeave = (name: string, date: string) => onLeaveSet.has(`${name.trim().toLowerCase()}|${date}`);
  const inPeriod = (s: Shift) => dateSet.has(s.date) && (site === "all" || s.site === site) && (listingF === "all" || s.listing === listingF) && inSeason(s.season);
  const periodShifts = useMemo(() => store.shifts.filter(inPeriod), [store.shifts, dateSet, site, listingF, seasonSel]);
  const listingOpts = useMemo(() => [...new Set(scopedListings.map((l) => l.title))].sort(), [scopedListings]);
  const seasonOpts = useMemo(() => (tenantSettings.seasons ?? []).map((s) => s.name), [tenantSettings.seasons]);

  const staffHours = (id: string) => periodShifts.filter((s) => s.staffId === id).reduce((n, s) => n + durH(s.start, s.end), 0);
  // Available hours across the period (from their availability pattern) and how
  // much of it is already rostered — used to sort staff by spare capacity.
  const availHrs = (id: string) => { const st = staffById[id]; if (!st) return 0; return dates.reduce((n, d) => { const w = effWeek(st, d)[weekdayKey(d)]; return n + (w ? durH(w.from, w.to) : 0); }, 0); };
  const pctUsed = (id: string) => { const a = availHrs(id); const u = staffHours(id); return a > 0 ? (u / a) * 100 : (u > 0 ? 1000 : 0); };
  const [staffSort, setStaffSort] = useState<"name" | "availLow" | "availHigh" | "costHigh" | "costLow">("name");
  const wagesAt = store.staff.reduce((n, st) => n + staffHours(st.id) * st.rate, 0);
  const wagesCost = wagesAt * (1 + onCost / 100);
  const assignedStaff = useMemo(() => new Set(periodShifts.filter((s) => s.staffId).map((s) => s.staffId as string)), [periodShifts]);
  const notSubmitted = store.staff.filter((s) => s.avail === "notsubmitted").length;
  // A shift is a check-in alert only once its start time has passed by the grace
  // window (default 15 min) and the assigned person still isn't in — future
  // shifts and ones inside the grace period don't nag.
  const CHECKIN_GRACE_MIN = checkinGrace;
  const shiftStartMs = (s: Shift) => { const [y, mo, d] = s.date.split("-").map(Number); const [h, mi] = s.start.split(":").map(Number); return new Date(y, (mo || 1) - 1, d || 1, h || 0, mi || 0).getTime(); };
  const overdueMin = (s: Shift) => Math.floor((Date.now() - shiftStartMs(s)) / 60000);
  const overdueLabel = (s: Shift) => { const m = overdueMin(s); if (m < 60) return `${m} min late`; const h = Math.floor(m / 60); return `${h}h ${m % 60}m late`; };
  const alerts = useMemo(() => (checkinAutoAlert ? periodShifts.filter((s) => s.staffId && !s.in && !s.out && Date.now() >= shiftStartMs(s) + CHECKIN_GRACE_MIN * 60000) : []), [periodShifts, checkinAutoAlert, CHECKIN_GRACE_MIN]);
  const [alertQ, setAlertQ] = useState("");
  const shownStaff = store.staff
    .filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.role.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      switch (staffSort) {
        case "availLow": return pctUsed(a.id) - pctUsed(b.id);   // most spare capacity first
        case "availHigh": return pctUsed(b.id) - pctUsed(a.id);  // most fully-booked first
        case "costHigh": return b.rate - a.rate;
        case "costLow": return a.rate - b.rate;
        default: return a.name.localeCompare(b.name);
      }
    });

  // Columns: hours for Day, dates otherwise
  const cols = useMemo(() => isDay ? HOURS.map((h) => ({ key: `h${h}`, hour: h, label: to12(`${h}:00`), date: anchor })) : dates.map((d) => ({ key: d, date: d, hour: null as number | null, label: dt(d).toLocaleDateString("en-GB", span === "week" ? { weekday: "short", day: "numeric", timeZone: "UTC" } : { day: "numeric", timeZone: "UTC" }) })), [isDay, dates, anchor, span]);
  const colW = isDay ? 66 : span === "week" ? 92 : span === "2w" ? 62 : span === "4w" ? 42 : 40;
  // Day view keeps fixed hour widths (scrolls if narrow); every dated span fills
  // the page width instead — columns share the space so nothing scrolls sideways.
  const gridTmpl = isDay ? `repeat(${cols.length},minmax(${colW}px,1fr))` : `repeat(${cols.length},minmax(0,1fr))`;
  const cellShifts = (rows: Shift[], c: { date: string; hour: number | null }) => rows.filter((s) => s.date === c.date && (c.hour == null || hourOf(s.start) === c.hour)).sort((a, b) => mins(a.start) - mins(b.start));

  const removeShift = (id: string) => persist({ ...store, shifts: store.shifts.filter((s) => s.id !== id) });
  const remind = (id: string) => { persist({ ...store, staff: store.staff.map((s) => (s.id === id ? { ...s, reminders: (s.reminders ?? 0) + 1 } : s)) }); flash("Reminder sent."); };
  // Per-shift check-in nudge (separate from the availability reminder count).
  const pokeCheckin = (shiftId: string) => { persist({ ...store, shifts: store.shifts.map((s) => (s.id === shiftId ? { ...s, checkinPokes: (s.checkinPokes ?? 0) + 1 } : s)) }); flash("Check-in reminder sent."); };
  // Ask ONE staff member to complete their availability (from their editor).
  const requestOne = (id: string, scope: "this" | "all") => { persist({ ...store, staff: store.staff.map((s) => (s.id === id ? { ...s, requested: true, requestedScope: scope, requestedAt: Date.now(), reminders: (s.reminders ?? 0) + 1 } : s)) }); flash(`Availability requested · ${scope === "this" ? label : "all weeks"}.`); };
  // Step 1 — ask staff who haven't confirmed to submit their availability.
  // Scope = this week (the period in view) or all weeks in the season. Marks
  // each as Requested (front-end); the actual push/email is Amir's backend.
  const requestAvail = (scope: "this" | "all") => {
    setReqOpen(false);
    const targets = store.staff.filter((s) => s.avail === "notsubmitted");
    if (!targets.length) { flash("Everyone has already confirmed — nothing to request."); return; }
    const at = Date.now();
    persist({ ...store, staff: store.staff.map((s) => (s.avail === "notsubmitted" ? { ...s, requested: true, requestedScope: scope, requestedAt: at, reminders: (s.reminders ?? 0) + 1 } : s)) });
    flash(`Availability requested from ${targets.length} staff · ${scope === "this" ? label : "all weeks this season"}.`);
  };
  // Reconcile the grouped draft back into individual shift rows (one per needed slot),
  // reusing existing rows (to keep check-ins) where a staff member still matches.
  function currentRows(d: Draft): Shift[] {
    const existing = store.shifts.filter((s) => d.groupIds.includes(s.id));
    const used = new Set<string>();
    return d.slots.map((sid, i) => {
      let base = sid ? existing.find((e) => e.staffId === sid && !used.has(e.id)) : undefined;
      if (!base) base = existing.find((e) => !used.has(e.id));
      if (base) used.add(base.id);
      const keepIO = base && base.staffId === sid;
      return {
        id: base?.id ?? `sh${Date.now()}${i}`,
        site: d.site, role: d.role, listing: d.listing || undefined, season: d.season || undefined,
        date: d.date, start: d.start, end: d.end, staffId: sid,
        in: keepIO ? base!.in : undefined, out: keepIO ? base!.out : undefined,
        locked: base?.locked, note: d.note || undefined, brk: d.brk || undefined,
      };
    });
  }
  const freshRows = (d: Draft, date: string, tag: string): Shift[] => d.slots.map((sid, i) => ({ id: `sh${Date.now()}${tag}${i}`, site: d.site, role: d.role, listing: d.listing || undefined, season: d.season || undefined, date, start: d.start, end: d.end, staffId: sid, note: d.note || undefined, brk: d.brk || undefined }));
  function saveDraft() {
    if (!draft) return;
    persist({ ...store, shifts: [...store.shifts.filter((s) => !draft.groupIds.includes(s.id)), ...currentRows(draft)] });
    setDraft(null); setAssignOpen(false); setNoteOpen(false); setActionsOpen(false);
  }
  function deleteDraft() { if (!draft) return; persist({ ...store, shifts: store.shifts.filter((s) => !draft.groupIds.includes(s.id)) }); setDraft(null); setActionsOpen(false); setAssignOpen(false); }
  // Shift-actions menu
  function copyToAllDays() {
    if (!draft) return;
    const others = store.shifts.filter((s) => !draft.groupIds.includes(s.id));
    const targets = dates.filter((d) => d !== draft.date && !others.some((s) => gkey(s) === gkey({ ...draft, date: d })));
    const copies = targets.flatMap((d, di) => freshRows(draft, d, `c${di}`));
    persist({ ...store, shifts: [...others, ...currentRows(draft), ...copies] });
    setDraft(null); setActionsOpen(false); flash(`Copied to ${targets.length} day${targets.length === 1 ? "" : "s"} in view.`);
  }
  function duplicateShift() {
    if (!draft) return;
    const others = store.shifts.filter((s) => !draft.groupIds.includes(s.id));
    persist({ ...store, shifts: [...others, ...currentRows(draft), ...freshRows(draft, draft.date, "d")] });
    setDraft(null); setActionsOpen(false); flash("Shift duplicated.");
  }
  const clearOpen = () => { if (!draft) return; setDraft({ ...draft, slots: draft.slots.map(() => null) }); setActionsOpen(false); };
  // Auto-fill the draft's empty slots from available, non-double-booked staff (role-preferred).
  function autoFillDraft() {
    if (!draft) return;
    const taken = new Set(draft.slots.filter(Boolean) as string[]);
    const busy = (sid: string) => store.shifts.some((s) => s.staffId === sid && s.date === draft.date && !draft.groupIds.includes(s.id));
    const pool = store.staff
      .filter((s) => !taken.has(s.id) && !busy(s.id) && !onLeave(s.name, draft.date) && dayAvail(s, draft.date).ok)
      .sort((a, b) => Number(b.role === draft.role) - Number(a.role === draft.role));
    const slots = draft.slots.slice(); let pi = 0;
    for (let i = 0; i < slots.length && pi < pool.length; i++) if (!slots[i]) { slots[i] = pool[pi++].id; }
    setDraft({ ...draft, slots });
  }
  const toggleAssign = (sid: string) => {
    if (!draft) return;
    const slots = draft.slots.slice();
    const at = slots.indexOf(sid);
    if (at >= 0) slots[at] = null;                       // unassign
    else { const empty = slots.indexOf(null); if (empty >= 0) slots[empty] = sid; else slots.push(sid); }
    setDraft({ ...draft, slots });
  };
  const setNeed = (n: number) => { if (!draft) return; const slots = draft.slots.slice(); if (n > slots.length) while (slots.length < n) slots.push(null); else { for (let i = slots.length - 1; i >= 0 && slots.length > n; i--) if (!slots[i]) slots.splice(i, 1); while (slots.length > n) slots.pop(); } setDraft({ ...draft, slots }); };
  function autoFill() {
    setAutoMenu(false);
    const confirmed = store.staff.filter((s) => s.avail === "confirmed");
    const next = store.shifts.map((s) => ({ ...s })); let filled = 0;
    for (const u of next.filter((s) => inPeriod(s) && !s.staffId)) {
      const busy = (sid: string) => next.some((x) => x.staffId === sid && x.date === u.date && overlaps(x, u));
      const cand = [...confirmed].sort((a, b) => Number(b.role === u.role) - Number(a.role === u.role)).find((c) => !busy(c.id) && !onLeave(c.name, u.date));
      if (cand) { u.staffId = cand.id; filled++; }
    }
    persist({ ...store, shifts: next });
    flash(filled ? `Auto-filled ${filled} shift${filled === 1 ? "" : "s"}.` : "No confirmed staff free for the open shifts.");
  }
  function clearPeriod() { setAutoMenu(false); const n = periodShifts.length; persist({ ...store, shifts: store.shifts.filter((s) => !inPeriod(s)) }); flash(`Cleared ${n} shift${n === 1 ? "" : "s"}.`); }
  function copyForward() { setCopyMenu(false); const len = dates.length; const copies = periodShifts.map((s, i) => ({ ...s, id: `sh${Date.now()}${i}`, date: addDays(s.date, len), in: undefined, out: undefined, locked: false })); persist({ ...store, shifts: [...store.shifts, ...copies] }); flash(`Copied ${copies.length} shift${copies.length === 1 ? "" : "s"} forward to the next ${span === "day" ? "day" : span === "month" ? "month" : span === "week" ? "week" : span === "2w" ? "2 weeks" : "4 weeks"}.`); }
  function saveTemplate() {
    const name = tplName.trim(); if (!name) return;
    const items = periodShifts.map((s) => ({ dayOffset: Math.max(0, dates.indexOf(s.date)), site: s.site, role: s.role, listing: s.listing, season: s.season, staffId: s.staffId, start: s.start, end: s.end }));
    persistTpl([...templates, { id: `tpl${Date.now()}`, name, items }]);
    setTplSaveOpen(false); setTplName(""); flash(`Saved “${name}” — ${items.length} shift${items.length === 1 ? "" : "s"} in the template.`);
  }
  function applyTemplate(tpl: Template) {
    const created = tpl.items.filter((it) => dates[it.dayOffset]).map((it, i) => ({ id: `sh${Date.now()}${i}`, site: it.site, role: it.role, listing: it.listing, season: it.season, staffId: it.staffId, date: dates[it.dayOffset], start: it.start, end: it.end }));
    persist({ ...store, shifts: [...store.shifts, ...created] }); setTplListOpen(false); flash(`Applied “${tpl.name}” — added ${created.length} shift${created.length === 1 ? "" : "s"}.`);
  }
  function deleteTemplate(id: string) { persistTpl(templates.filter((t) => t.id !== id)); }
  function publish() { const ids = new Set(periodShifts.filter((s) => s.staffId).map((s) => s.id)); persist({ ...store, shifts: store.shifts.map((s) => (ids.has(s.id) ? { ...s, locked: true } : s)) }); const how = notifyOnPublish === "off" ? "no notification sent" : notifyOnPublish === "email" ? "notified by email" : notifyOnPublish === "push" ? "notified by push" : "notified by email + push"; flash(`Published to ${assignedStaff.size} staff — shifts locked · ${how}.`); }
  const openAdd = (site_: string, role: string, c: { date: string; hour: number | null }, staffId: string | null) => {
    setAssignOpen(false); setActionsOpen(false);
    const start = c.hour != null ? `${String(c.hour).padStart(2, "0")}:00` : "09:00";
    setNoteOpen(false); setDraft({ groupIds: [], site: site_, role, listing: listingF !== "all" ? listingF : "", season: seasonSel.length === 1 ? seasonSel[0] : "", date: c.date, start, end: addMins(start, defShiftH * 60), slots: [staffId], brk: null, note: "" });
  };
  // Add a shift under a specific listing (presets its location + season).
  const openAddL = (l: { title: string; venueId?: string | null; seasonId?: string | null }, role: string, c: { date: string; hour: number | null }) => {
    setAssignOpen(false); setActionsOpen(false);
    const start = c.hour != null ? `${String(c.hour).padStart(2, "0")}:00` : "09:00";
    setNoteOpen(false); setDraft({ groupIds: [], site: venueNameOf(l.venueId), role, listing: l.title, season: seasonNameOf(l.seasonId) ?? "", date: c.date, start, end: addMins(start, defShiftH * 60), slots: [null], brk: null, note: "" });
  };
  // Open the editor on the whole group of shifts sharing this slot (N needed / M filled).
  const openEditGroup = (s: Shift) => {
    setAssignOpen(false); setActionsOpen(false);
    const group = store.shifts.filter((x) => gkey(x) === gkey(s));
    const filledFirst = [...group].sort((a, b) => Number(!!b.staffId) - Number(!!a.staffId));
    setNoteOpen(false); setDraft({ groupIds: group.map((x) => x.id), site: s.site, role: s.role, listing: s.listing ?? "", season: s.season ?? "", date: s.date, start: s.start, end: s.end, slots: filledFirst.map((x) => x.staffId), brk: s.brk ?? null, note: s.note ?? "" });
  };

  const ShiftBlock = ({ s, compact }: { s: Shift; compact?: boolean }) => {
    const st = s.staffId ? staffById[s.staffId] : null; const filled = !!st;
    // Status heat — colour is the state, not the role: green = filled/covered,
    // amber = needs staff. (The role is still named on the row label + its dot.)
    // #6 — assigned = bold navy fill; unassigned = soft red tint (calmer when
    // the rota has lots of open shifts, and the booked ones pop).
    const heat = filled
      ? { background: "linear-gradient(160deg,#3a6fd8 0%,#234da8 55%,#1d3a8f 100%)", borderColor: "#16306e", color: "#ffffff", boxShadow: "inset 0 1px 0 rgba(255,255,255,.22)" }
      : { background: "#fff1f2", borderColor: "#f4a6ae", color: "#b91c1c" };
    return (
      <button type="button" onClick={() => canManage && openEditGroup(s)} disabled={!canManage}
        className={"w-full rounded-lg border text-left shadow-sm transition enabled:hover:brightness-[1.04] enabled:hover:shadow-md " + (compact ? "px-1 py-1 text-[9.5px]" : "px-2 py-1.5 text-[11px]")}
        style={heat}>
        {!compact && <div className="flex items-start gap-1"><span className="min-w-0 flex-1 font-extrabold">{to12(s.start)} – {to12(s.end)}</span>{canManage && <span role="button" onClick={(e) => { e.stopPropagation(); removeShift(s.id); }} className="flex-none opacity-60 hover:opacity-100">×</span>}</div>}
        <div className="truncate font-bold">{st ? (compact ? st.name.split(" ")[0] : st.name) : (compact ? "—" : "Unfilled")}</div>
        {!compact && s.listing && <div className="truncate text-[10px] opacity-75">🎟 {s.listing}{s.season ? ` · ${s.season}` : ""}</div>}
        {!compact && filled && <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-white/40 px-1.5 py-0.5 text-[10px] font-bold">{s.out ? `✅ Out ${to12(s.out)}` : s.in ? `🟢 In ${to12(s.in)}` : "⚪ Not in"}</div>}
        {!compact && s.locked && <div className="mt-1 inline-block rounded bg-black/25 px-1.5 py-0.5 text-[9px] font-extrabold uppercase">Locked</div>}
      </button>
    );
  };

  // Render a row of column-cells for a given set of shifts (a role or a staff member)
  const CellRow = ({ rows, onAdd, compact }: { rows: Shift[]; onAdd: (c: { date: string; hour: number | null }) => void; compact?: boolean }) => (
    <div className="grid" style={{ gridTemplateColumns: gridTmpl }}>
      {cols.map((c) => { const has = cellShifts(rows, c).length > 0; return (
        <div key={c.key} className="flex min-h-[54px] flex-col gap-1 border-r border-[var(--line-2,#eef2f8)] p-1 last:border-r-0">
          {cellShifts(rows, c).map((s) => <ShiftBlock key={s.id} s={s} compact={compact} />)}
          {canManage && <button type="button" onClick={() => onAdd(c)} title="Add a shift" className={has
            ? "rounded-md border border-dashed border-[var(--line)] py-0.5 text-[12px] text-[var(--ink-3)] hover:border-[var(--brand)] hover:text-[#1d3a8f]"
            : "flex flex-1 items-center justify-center rounded-md bg-[var(--panel)] text-[13px] text-[var(--ink-3)] ring-1 ring-inset ring-[var(--line)] hover:bg-[#eef4fd] hover:text-[#1d3a8f]"}>＋</button>}
        </div>
      ); })}
    </div>
  );
  const TotalsRow = ({ rows }: { rows: Shift[] }) => (
    <div className="grid border-b border-[var(--line-2,#eef2f8)]" style={{ gridTemplateColumns: gridTmpl }}>
      {cols.map((c) => <div key={c.key} className="px-2 py-1 text-[10px] font-bold text-[var(--ink-3)]">{hLabel(cellShifts(rows, c).reduce((n, s) => n + durH(s.start, s.end), 0))}</div>)}
    </div>
  );

  const compact = colW < 60;
  const venueNameOf = (vid?: string | null) => venuesR.find((v) => v.id === vid)?.name ?? "";
  // The rota is organised by LISTING (location + season shown underneath).
  const gridListings = useMemo(() => scopedListings.filter((l) => (site === "all" || venueNameOf(l.venueId) === site) && (listingF === "all" || l.title === listingF)), [scopedListings, site, listingF, venuesR]);

  // TEMPORARY — one-click sample shifts so the status-heat colours are visible
  // (green = filled, amber = needs staff). Remove this + the toolbar button once
  // real rostering is wired. Uses the listings/dates currently in view.
  const seedDemo = () => {
    // Demo staff (always added so the Assign-staff picker has people to book),
    // each made available all week so auto-fill / assign works out of the box.
    const allWeek: Week = { mon: { from: "08:00", to: "18:00" }, tue: { from: "08:00", to: "18:00" }, wed: { from: "08:00", to: "18:00" }, thu: { from: "08:00", to: "18:00" }, fri: { from: "08:00", to: "18:00" }, sat: { from: "08:00", to: "18:00" }, sun: { from: "08:00", to: "18:00" } };
    const demoStaff: Staff[] = [
      { id: "demo-a", name: "Alex Rivera", role: "First Aider", rate: 14.5, avail: "confirmed", week: allWeek },
      { id: "demo-b", name: "Sam Patel", role: "Play Leader", rate: 12.75, avail: "confirmed", week: allWeek },
      { id: "demo-c", name: "Jordan Lee", role: "First Aider", rate: 13.25, avail: "notsubmitted", week: allWeek },
      { id: "demo-d", name: "Priya Shah", role: "Play Leader", rate: 13.0, avail: "notsubmitted", week: allWeek },
    ];
    const ls = (gridListings.length ? gridListings : scopedListings).slice(0, 2);
    if (!ls.length) { persist({ ...store, staff: demoStaff }); flash("Added 4 sample staff — add a listing to place shifts."); return; }
    const roles = ["First Aider", "Play Leader"];
    const shifts: Shift[] = [];
    ls.forEach((l, li) => {
      const siteN = venueNameOf(l.venueId); const seasonN = seasonNameOf(l.seasonId) ?? "";
      roles.forEach((role, ri) => {
        const who = demoStaff.filter((s) => s.role === role);
        dates.forEach((d, di) => {
          if (di > 5) return; // leave the last day empty so a grey "no shift" tile shows too
          const start = ri === 0 ? "09:00" : "13:00"; const end = ri === 0 ? "15:00" : "17:00";
          // Most shifts are BOOKED (green, named staff); every 4th stays unfilled
          // (amber) so both states are visible.
          const assign = (di + ri) % 4 !== 3;
          const someIn = assign && di % 2 === 0; // a couple show a check-in state
          shifts.push({ id: `demo-${li}-${ri}-${di}`, staffId: assign && who.length ? who[di % who.length].id : null, site: siteN, role, listing: l.title, season: seasonN, date: d, start, end, in: someIn ? start : undefined });
        });
      });
    });
    persist({ ...store, staff: demoStaff, shifts: [...store.shifts.filter((s) => !s.id.startsWith("demo-")), ...shifts] });
    flash(`Added ${shifts.length} sample shifts — green = filled, amber = needs staff.`);
  };
  const clearDemo = () => { persist({ ...store, staff: store.staff.filter((s) => !s.id.startsWith("demo-")), shifts: store.shifts.filter((s) => !s.id.startsWith("demo-")) }); flash("Cleared sample shifts."); };
  const hasDemo = store.shifts.some((s) => s.id.startsWith("demo-"));
  // In the guided-tour iframe, auto-fill the rota with the sample staff + shifts
  // once listings have loaded, so the walkthrough drives a fully populated week.
  useEffect(() => {
    if (isDemoMode() && store.shifts.length === 0 && scopedListings.length > 0) seedDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedListings.length]);

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="Staff schedule" icon="🗓" lede="Build the rota by location & role or by team member, across day / week / month — with wages and on-cost." />

      {/* Wages — always above the Rota/Settings tabs */}
      <div className="relative mb-3 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(22,48,110,0.55)]" style={{ background: "linear-gradient(125deg,#132a63 0%,#1d3a8f 46%,#2f6bd8 100%)" }}>
        <div className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-[#7fb0ff]/20 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-white/90 backdrop-blur">💷 Payroll forecast</div>
            <div className="text-[19px] font-extrabold leading-tight">Total wages <span className="font-semibold text-white/70">· {SPAN_WORD[span]}</span></div>
          </div>
          <div className="flex items-stretch gap-3">
            <div className="rounded-xl bg-white/10 px-4 py-2.5 ring-1 ring-white/15 backdrop-blur">
              <div className="text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-white/60">At hourly rate</div>
              <div className="text-[24px] font-extrabold leading-tight tabular-nums text-white">{money(wagesAt)}</div>
            </div>
            <div className="rounded-xl bg-white px-4 py-2.5 shadow-lg ring-1 ring-white/40">
              <div className="text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-[#5566a0]">Incl. {onCost}% on-cost</div>
              <div className="text-[24px] font-extrabold leading-tight tabular-nums text-[#1d3a8f]">{money(wagesCost)}</div>
            </div>
          </div>
        </div>
        <p className="relative mt-3 max-w-2xl text-[11.5px] leading-relaxed text-white/70">Predicted <b className="text-white">on-cost</b> adds a cost on top of wages (e.g. employer NI, pension). Recorded only — ActivityOS never moves money.</p>
      </div>

      <div className="mb-3 inline-flex rounded-xl bg-[var(--panel)] p-1">
        {([["rota", "Rota"], ["settings", "Settings"]] as const).map(([v, lbl]) => (
          <button key={v} type="button" onClick={() => setSchedView(v)} className={"rounded-lg px-4 py-1.5 text-[13px] font-bold transition-colors " + (schedView === v ? "bg-white text-[#1d3a8f] shadow-sm" : "text-[var(--ink-2)]")}>{lbl}</button>
        ))}
      </div>

      {schedView === "settings" ? <SchedulingSettingsForm /> : (
      <>

      <Card className="mb-3 overflow-hidden">
        <button type="button" onClick={() => setHelp((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left"><span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--panel)] text-[12px]">ⓘ</span><span className="text-[14px] font-extrabold text-[var(--ink)]">How availability works</span><span className="ml-auto text-[12px] text-[var(--ink-3)]">{help ? "▲" : "▼"}</span></button>
        {help && <ol className="ml-9 list-decimal space-y-1 px-4 pb-3.5 text-[13px] leading-relaxed text-[var(--ink-2)]"><li><b>Request availability</b> — hit the red button in the staff panel. Everyone starts <b className="text-[#c0392b]">Not submitted</b>.</li><li>Staff set the days &amp; times they can work — their card turns <b className="text-[#0f7a43]">Confirmed</b>.</li><li>Still red? Tap the <b>gold bell</b> to send a reminder.</li><li>Then ✨ Auto-schedule fills open shifts and Publish locks them &amp; tells staff.</li></ol>}
      </Card>

      {/* Toolbar — classy white pills, each with its own coloured icon badge */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* Season first — multi-select popup; it scopes the locations & listings below */}
        <button type="button" onClick={() => setSeasonMenu(true)} className="group inline-flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3.5 text-[13px] font-bold text-[var(--ink)] shadow-[0_1px_3px_rgba(16,24,64,0.08)] ring-1 ring-black/[0.04] transition hover:shadow-md">
          <span className="grid h-[26px] w-[26px] place-items-center rounded-[8px] text-[12.5px]" style={{ background: "#eceaff", color: "#4f46e5" }}>📅</span>
          {seasonSel.length === 0 ? "All seasons" : `${seasonSel.length} of ${seasonOpts.length} seasons`}<span className="text-[10px] text-[var(--ink-3)]">▾</span>
        </button>
        {seasonSel.map((sn) => (
          <span key={sn} className="inline-flex items-center gap-1 rounded-full bg-[#eef8f1] px-2.5 py-1.5 text-[12px] font-bold text-[#0f7a43] ring-1 ring-[#bfe3cd]">📅 {sn}<button type="button" onClick={() => { setSeasonSel((xs) => xs.filter((x) => x !== sn)); setSite("all"); setListingF("all"); }} className="text-[13px] text-[#0f7a43] hover:text-[#c0392b]">×</button></span>
        ))}
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-2 text-[13px] font-bold text-[var(--ink)] shadow-[0_1px_3px_rgba(16,24,64,0.08)] ring-1 ring-black/[0.04]"><span className="grid h-[26px] w-[26px] place-items-center rounded-[8px] text-[12.5px]" style={{ background: "#ffe9ed", color: "#e11d48" }}>📍</span><Select value={site} onChange={(e) => setSite(e.target.value)} className="border-0 bg-transparent p-0 text-[13px] font-bold text-[var(--ink)] outline-none"><option value="all">All locations</option>{sites.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-2 text-[13px] font-bold text-[var(--ink)] shadow-[0_1px_3px_rgba(16,24,64,0.08)] ring-1 ring-black/[0.04]"><span className="grid h-[26px] w-[26px] place-items-center rounded-[8px] text-[12.5px]" style={{ background: "#e5eefe", color: "#2563eb" }}>🎟</span><Select value={listingF} onChange={(e) => setListingF(e.target.value)} className="border-0 bg-transparent p-0 text-[13px] font-bold text-[var(--ink)] outline-none"><option value="all">All listings</option>{listingOpts.map((l) => <option key={l} value={l}>{l}</option>)}</Select></div>
        <div className="inline-flex items-center gap-1 rounded-full bg-white px-1 py-1 shadow-[0_1px_3px_rgba(16,24,64,0.08)] ring-1 ring-black/[0.04]">
          <button type="button" onClick={() => nav(-1)} className="grid h-7 w-7 place-items-center rounded-full text-[15px] text-[var(--ink-3)] hover:bg-[var(--panel)] hover:text-[#1d3a8f]">‹</button>
          <span className="min-w-[116px] text-center text-[12.5px] font-extrabold text-[var(--ink)]">{label}</span>
          <button type="button" onClick={() => nav(1)} className="grid h-7 w-7 place-items-center rounded-full text-[15px] text-[var(--ink-3)] hover:bg-[var(--panel)] hover:text-[#1d3a8f]">›</button>
        </div>
        {checkinAutoAlert && <button type="button" onClick={() => setShowAlerts(true)} className="relative inline-flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3.5 text-[13px] font-bold text-[var(--ink)] shadow-[0_1px_3px_rgba(16,24,64,0.08)] ring-1 ring-black/[0.04] transition hover:shadow-md">
          <span className="grid h-[26px] w-[26px] place-items-center rounded-[8px] text-[12.5px]" style={{ background: "#fdeecf", color: "#b45309" }}>🔔</span>Check-in alerts{alerts.length > 0 && <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#c0392b] px-1 text-[10px] font-extrabold text-white">{alerts.length}</span>}</button>}
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-2 text-[13px] font-bold text-[var(--ink)] shadow-[0_1px_3px_rgba(16,24,64,0.08)] ring-1 ring-black/[0.04]">
          <span className="grid h-[26px] w-[26px] place-items-center rounded-[8px] text-[12.5px]" style={{ background: "#dcf5e8", color: "#059669" }}>🗓</span>
          <Select value={`${span}:${group}`} onChange={(e) => { const [sp, gr] = e.target.value.split(":"); setSpan(sp as Span); setGroup(gr as Group); }} className="border-0 bg-transparent p-0 text-[13px] font-bold text-[var(--ink)] outline-none">
            {GROUPS.map(([g, gl]) => SPANS.map(([s, sl]) => <option key={`${s}:${g}`} value={`${s}:${g}`}>{sl} by {gl}</option>))}
          </Select>
        </div>
        {canManage && (
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button type="button" onClick={() => setAutoMenu((v) => !v)} className="rounded-full bg-white px-3.5 py-1.5 text-[13px] font-bold text-[#1d3a8f] shadow-[0_1px_3px_rgba(16,24,64,0.08)] ring-1 ring-black/[0.04] transition hover:shadow-md">✨ Auto-schedule ▾</button>
              {autoMenu && <div className="absolute right-0 top-[38px] z-20 w-[240px] overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-lg"><button type="button" onClick={autoFill} className="block w-full px-3.5 py-2.5 text-left text-[12.5px] font-semibold text-[var(--ink)] hover:bg-[var(--panel)]">Fill open shifts from confirmed staff</button><button type="button" onClick={clearPeriod} className="block w-full border-t border-[var(--line-2,#eef2f8)] px-3.5 py-2.5 text-left text-[12.5px] font-semibold text-[#c0392b] hover:bg-[#fdebec]">Clear all shifts shown</button></div>}
            </div>
            <button type="button" onClick={() => { setStore(load()); flash("Refreshed."); }} title="Refresh" className="grid h-[34px] w-[34px] place-items-center rounded-full bg-white text-[13px] shadow-[0_1px_3px_rgba(16,24,64,0.08)] ring-1 ring-black/[0.04] transition hover:shadow-md">↻</button>
            <div className="relative">
              <button type="button" onClick={() => setCopyMenu((v) => !v)} title="Copy schedule / templates" className="rounded-full bg-white px-3.5 py-1.5 text-[13px] font-bold text-[#1d3a8f] shadow-[0_1px_3px_rgba(16,24,64,0.08)] ring-1 ring-black/[0.04] transition hover:shadow-md">⧉ Copy ▾</button>
              {copyMenu && <div className="absolute right-0 top-[38px] z-20 w-[240px] overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-lg">
                <button type="button" onClick={copyForward} className="block w-full px-3.5 py-2.5 text-left text-[12.5px] font-semibold text-[var(--ink)] hover:bg-[var(--panel)]">Copy schedule <span className="block text-[10.5px] font-normal text-[var(--ink-3)]">Duplicate this view into the next period</span></button>
                <button type="button" onClick={() => { setCopyMenu(false); setTplName(""); setTplSaveOpen(true); }} className="block w-full border-t border-[var(--line-2,#eef2f8)] px-3.5 py-2.5 text-left text-[12.5px] font-semibold text-[var(--ink)] hover:bg-[var(--panel)]">Save as template <span className="block text-[10.5px] font-normal text-[var(--ink-3)]">Reuse this week&rsquo;s pattern later</span></button>
                <button type="button" onClick={() => { setCopyMenu(false); setTplListOpen(true); }} className="block w-full border-t border-[var(--line-2,#eef2f8)] px-3.5 py-2.5 text-left text-[12.5px] font-semibold text-[var(--ink)] hover:bg-[var(--panel)]">Templates… <span className="block text-[10.5px] font-normal text-[var(--ink-3)]">{templates.length} saved</span></button>
              </div>}
            </div>
            <button type="button" onClick={publish} className="rounded-full bg-[#0f7a43] px-4 py-1.5 text-[13px] font-extrabold text-white hover:brightness-105">Publish to staff · {assignedStaff.size}</button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        {/* Staff panel */}
        <div className="lg:w-[204px] lg:flex-none">
          <Card className="p-2.5">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Search" className="mb-2 w-full text-[12px]" />
            <div className="mb-2 flex items-center gap-1">
              <span className="text-[9px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">Sort</span>
              <Select value={staffSort} onChange={(e) => setStaffSort(e.target.value as typeof staffSort)} className="ml-auto w-full max-w-[150px] text-[11px]">
                <option value="name">Name (A–Z)</option>
                <option value="availLow">Availability used · least</option>
                <option value="availHigh">Availability used · most</option>
                <option value="costHigh">Cost/hr · high → low</option>
                <option value="costLow">Cost/hr · low → high</option>
              </Select>
            </div>
            {canManage && <div className="mb-2.5">
              <div className="mb-1 text-[9px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">Step 1 · Confirm availability</div>
              <button type="button" onClick={() => setReqOpen((v) => !v)} className="w-full rounded-lg bg-[#c0392b] px-2 py-2.5 text-[10.5px] font-extrabold uppercase leading-tight tracking-wide text-white shadow-sm hover:brightness-105">Request staff to confirm availability{notSubmitted ? ` · ${notSubmitted}` : ""}</button>
              {reqOpen && <div className="mt-1.5">
                <div className="mb-1 text-[9px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">Send request for…</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button type="button" onClick={() => requestAvail("this")} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[11px] font-extrabold text-[var(--ink-2)] transition-colors hover:border-[#1d3a8f] hover:bg-[#eef4fd] hover:text-[#1d3a8f]">This week</button>
                  <button type="button" onClick={() => requestAvail("all")} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[11px] font-extrabold text-[var(--ink-2)] transition-colors hover:border-[#1d3a8f] hover:bg-[#eef4fd] hover:text-[#1d3a8f]">All weeks</button>
                </div>
              </div>}
              {notSubmitted === 0 && store.staff.length > 0 && <div className="mt-1.5 text-center text-[10px] font-bold text-[#0f7a43]">✓ All {store.staff.length} confirmed</div>}
            </div>}
            <div className="flex flex-col divide-y divide-[var(--line-2,#eef2f8)]">
              {shownStaff.map((st) => { const hrs = staffHours(st.id); const pay = hrs * st.rate; const cost = pay * (1 + onCost / 100); return (
                <div key={st.id}
                  onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover({ id: st.id, top: Math.max(64, Math.min(r.top, (typeof window !== "undefined" ? window.innerHeight : 800) - 430)), left: r.right + 10 }); }}
                  onMouseLeave={() => setHover((h) => (h?.id === st.id ? null : h))}
                  onClick={() => setAvailEdit(st)}
                  role="button"
                  title="Click to view / edit availability"
                  className="-mx-1 flex cursor-pointer items-start gap-2 rounded-lg px-1 py-2 hover:bg-[var(--panel)]">
                  <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--panel)] text-[10.5px] font-extrabold text-[var(--ink-2)]">{initials(st.name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1"><span className="truncate text-[12px] font-extrabold text-[var(--ink)]">{st.name}</span>{st.avail === "confirmed"
                      ? <span title="Confirmed availability" className="flex-none inline-flex items-center gap-0.5 rounded-full bg-[#e2f4ea] px-1.5 py-[1px] text-[10px] font-extrabold text-[#0f7a43]">🔔 ✓</span>
                      : <button type="button" onClick={(e) => { e.stopPropagation(); remind(st.id); }} title={st.reminders ? `Sent ${st.reminders}× — send another reminder` : "Send availability reminder"} className="flex-none inline-flex items-center gap-0.5 rounded-full bg-[#fdebec] px-1.5 py-[1px] text-[10px] font-extrabold text-[#c0392b] hover:bg-[#f9d7da]">🔔{st.reminders ? ` ${st.reminders}` : ""}</button>}</div>
                    <div className="text-[9px] font-bold uppercase tracking-wide text-[var(--ink-3)]"><span className={st.avail === "confirmed" ? "text-[#0f7a43]" : st.requested ? "text-[#b45309]" : "text-[#c0392b]"}>{st.avail === "confirmed" ? "Confirmed" : st.requested ? `Requested${st.requestedScope === "all" ? " · all wks" : ""}` : "Not submitted"}</span></div>
                    <div className="mt-0.5 text-[11px] text-[var(--ink-2)]">{hLabel(hrs)} · £{st.rate.toFixed(2)}/hr</div>
                    {(() => { const a = availHrs(st.id); const p = Math.round(pctUsed(st.id)); const tone = a === 0 ? "var(--ink-3)" : p >= 90 ? "#c0392b" : p >= 60 ? "#b45309" : "#0f7a43"; return (
                      <div className="mt-0.5 flex items-center gap-1.5"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full rounded-full" style={{ width: `${Math.min(100, p)}%`, background: tone }} /></div><span className="text-[9.5px] font-extrabold tabular-nums" style={{ color: tone }}>{a === 0 ? "—" : `${p}%`}</span></div>
                    ); })()}
                    <div className="mt-0.5 text-[11px] font-bold text-[var(--ink)]">{money(pay)} <span className="font-normal text-[var(--ink-3)]">· {money(cost)} on-cost</span></div>
                  </div>
                </div>
              ); })}
            </div>
          </Card>
        </div>

        {/* Grid */}
        <div className="min-w-0 flex-1">
          {/* Status-heat key + temporary sample-data button */}
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-white px-3.5 py-2 text-[11.5px] font-bold text-[var(--ink-2)] shadow-[0_1px_3px_rgba(16,24,64,0.08)] ring-1 ring-black/[0.04]">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Key</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: "linear-gradient(160deg,#3a6fd8,#1d3a8f)" }} />Assigned</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: "#fff1f2", boxShadow: "inset 0 0 0 1px #f4a6ae" }} />Not assigned</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[var(--panel)] ring-1 ring-inset ring-[var(--line)]" />No shift</span>
            {canManage && <span className="ml-auto flex items-center gap-2">
              <button type="button" onClick={seedDemo} className="rounded-full bg-[#eef4fd] px-3 py-1 text-[11.5px] font-extrabold text-[#1d3a8f] ring-1 ring-[#bcd0f5] hover:bg-[#e2ecfb]">🎨 Add sample shifts</button>
              {hasDemo && <button type="button" onClick={clearDemo} className="rounded-full px-2.5 py-1 text-[11.5px] font-bold text-[#c0392b] hover:bg-[#fdebec]">Clear samples</button>}
            </span>}
          </div>
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <div style={isDay ? { minWidth: cols.length * colW + 40 } : undefined}>
                <div className="grid text-white" style={{ gridTemplateColumns: gridTmpl, background: "linear-gradient(120deg,#16306e,#2f6bd8)" }}>
                  {cols.map((c) => {
                    // Day view = hour columns (keep the "9 AM" labels). Every other
                    // span shows a real dated header: weekday over "12 Jul" — never
                    // a bare number — with the full date on hover.
                    if (c.hour !== null) return <div key={c.key} className="px-2 py-2.5 text-[11.5px] font-extrabold">{c.label}</div>;
                    const d = dt(c.date);
                    const wd = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
                    const dm = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
                    const isWknd = [0, 6].includes(d.getUTCDay());
                    return (
                      <div key={c.key} title={d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })} className={"px-1.5 py-2 text-center leading-tight " + (isWknd ? "bg-white/10" : "")}>
                        <div className={"font-bold uppercase tracking-wide text-white/70 " + (colW < 50 ? "text-[8.5px]" : "text-[9.5px]")}>{wd}</div>
                        <div className={"font-extrabold " + (colW < 50 ? "text-[10px]" : "text-[12px]")}>{dm}</div>
                      </div>
                    );
                  })}
                </div>

                {group === "area" ? (
                  <>
                  {gridListings.length === 0 && <div className="border-b border-[var(--line)] px-3 py-6 text-center text-[12.5px] text-[var(--ink-3)]">No listings for this view — publish listings (with a venue &amp; season) under <a href="/company/listings" className="font-bold text-[#1d3a8f] hover:underline">Listings</a>, or widen the season filter.</div>}
                  {gridListings.map((l) => {
                    const loc = venueNameOf(l.venueId), sn = seasonNameOf(l.seasonId);
                    const listingShifts = periodShifts.filter((s) => s.listing === l.title);
                    // Every role/shift ever added to this listing — so switching Day /
                    // Week / Month keeps the rows you built, even when this view's dates
                    // hold none of them.
                    const allListingShifts = store.shifts.filter((s) => s.listing === l.title);
                    const elsewhere = allListingShifts.length - listingShifts.length;
                    const lRoles = [...new Set([...allListingShifts.map((s) => s.role), ...(extraRoles[l.title] ?? [])])];
                    return (
                    <div key={l.venueId + "|" + l.title}>
                      <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-3 py-2">
                        <span className="text-[13px]">🎟</span>
                        <div className="min-w-0"><div className="truncate text-[14px] font-extrabold text-[var(--ink)]">{l.title}</div><div className="text-[10.5px] font-semibold text-[var(--ink-3)]">📍 {loc || "no venue"}{sn ? ` · 📅 ${sn}` : ""}</div></div>
                        <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-[var(--ink-3)]"><b className="text-[var(--ink)]">{listingShifts.length}</b> shifts{elsewhere > 0 && <span className="rounded-full bg-[#eef0ff] px-2 py-0.5 text-[10.5px] font-bold text-[#5b53d6]" title="Shifts on dates outside this view — widen the span or use ‹ › to see them">+{elsewhere} other dates</span>}</span>
                      </div>
                      {lRoles.map((role) => {
                        const rows = listingShifts.filter((s) => s.role === role);
                        return (
                          <div key={role}>
                            <div className="flex items-center gap-2 border-b border-[var(--line-2,#eef2f8)] px-3 py-1.5" style={{ boxShadow: `inset 3px 0 0 ${roleCol(role)}` }}><span className="h-2.5 w-2.5 rounded-full" style={{ background: roleCol(role) }} /><span className="text-[13px] font-extrabold" style={{ color: roleCol(role) }}>{role}</span></div>
                            {!isDay && <TotalsRow rows={rows} />}
                            <CellRow rows={rows} compact={compact} onAdd={(c) => openAddL(l, role, c)} />
                          </div>
                        );
                      })}
                      {canManage && <div className="border-b border-[var(--line-2,#eef2f8)] px-3 py-2.5">
                        <button type="button" onClick={() => setRoleMenu(l.title)} className="text-[13px] font-extrabold text-[#1d3a8f] hover:underline">＋ Add a new role</button>
                      </div>}
                    </div>
                  ); })}
                  </>
                ) : (
                  shownStaff.map((st) => {
                    const rows = periodShifts.filter((s) => s.staffId === st.id);
                    return (
                      <div key={st.id}>
                        <div className="flex items-center gap-2 border-b border-[var(--line-2,#eef2f8)] bg-[var(--panel)] px-3 py-1.5"><span className="text-[12.5px] font-extrabold text-[var(--ink)]">{st.name}</span><span className="text-[11px] text-[var(--ink-3)]">{st.role} · {hLabel(staffHours(st.id))} · {money(staffHours(st.id) * st.rate)}</span></div>
                        {!isDay && <TotalsRow rows={rows} />}
                        <CellRow rows={rows} compact={compact} onAdd={(c) => openAdd(sites[0] ?? "", st.role, c, st.id)} />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Check-in alerts */}
      {showAlerts && (
        <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[8vh]" onClick={() => setShowAlerts(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2"><span className="text-[16px]">🔔</span><div className="text-[15px] font-extrabold text-[var(--ink)]">Check-in alerts</div><button type="button" onClick={() => setShowAlerts(false)} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
            <p className="mt-1 text-[12px] text-[var(--ink-3)]">Assigned staff who haven&rsquo;t checked in more than {CHECKIN_GRACE_MIN} min after their start time. Staff check in from their app / the register.</p>
            {alerts.length === 0 ? <p className="mt-3 rounded-lg bg-[#e2f4ea] px-3 py-2.5 text-[12.5px] font-bold text-[#0f7a43]">✓ No one is overdue — everyone due is checked in.</p> : (() => {
              const shown = alerts.filter((s) => { const st = staffById[s.staffId!]; return !alertQ || (st?.name.toLowerCase().includes(alertQ.toLowerCase())); });
              return (<>
              <input value={alertQ} onChange={(e) => setAlertQ(e.target.value)} placeholder="🔍 Search staff name" className="mt-3 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[12.5px] text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
              <div className="mt-2 flex max-h-[52vh] flex-col gap-1.5 overflow-y-auto">{shown.map((s) => { const st = staffById[s.staffId!]; const pokes = s.checkinPokes ?? 0; return (
                <div key={s.id} className="rounded-xl border border-[#f4d3c8] bg-[#fff6f1] px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-extrabold text-[var(--ink)]">{st?.name}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#fdebec] px-2 py-0.5 text-[10px] font-extrabold text-[#c0392b]"><span className="h-1.5 w-1.5 rounded-full bg-[#c0392b]" />Not in</span>
                    <span className="ml-auto text-[11px] font-extrabold text-[#c0392b]">⏰ {overdueLabel(s)}</span>
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">{dt(s.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })} · {to12(s.start)}–{to12(s.end)} · {s.site}</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    {pokes > 0 && <span className="text-[10.5px] font-bold text-[#b45309]">🔔 Reminded {pokes}×</span>}
                    <button type="button" onClick={() => pokeCheckin(s.id)} className="ml-auto rounded-full bg-[#f59e0b] px-3.5 py-1 text-[11px] font-extrabold text-white shadow-sm hover:brightness-105">{pokes > 0 ? "Remind again" : "Remind to check in"}</button>
                  </div>
                </div>
              ); })}
              {shown.length === 0 && <p className="py-4 text-center text-[12px] text-[var(--ink-3)]">No overdue staff match “{alertQ}”.</p>}
              </div>
              </>);
            })()}
          </div>
        </div>
      )}

      {/* Save as template */}
      {tplSaveOpen && (
        <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[10vh]" onClick={() => setTplSaveOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2"><span className="text-[16px]">📋</span><div className="text-[15px] font-extrabold text-[var(--ink)]">Save as template</div><button type="button" onClick={() => setTplSaveOpen(false)} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
            <p className="mt-1 text-[12px] text-[var(--ink-3)]">Saves the <b>{periodShifts.length}</b> shift{periodShifts.length === 1 ? "" : "s"} shown (day, role, hours &amp; who&rsquo;s assigned) as a reusable pattern you can drop onto any week.</p>
            <label className="mt-3 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Template name</label>
            <Input autoFocus value={tplName} onChange={(e) => setTplName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveTemplate(); }} placeholder="e.g. Standard summer camp week" className="mt-1 w-full" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setTplSaveOpen(false)} className="rounded-full border border-[var(--line)] bg-white px-4 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)]">Cancel</button>
              <button type="button" disabled={!tplName.trim() || periodShifts.length === 0} onClick={saveTemplate} className="rounded-full bg-[#1d3a8f] px-4 py-1.5 text-[12.5px] font-extrabold text-white disabled:opacity-40">Save template</button>
            </div>
          </div>
        </div>
      )}

      {/* Templates picker */}
      {tplListOpen && (
        <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[8vh]" onClick={() => setTplListOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2"><span className="text-[16px]">📋</span><div className="text-[15px] font-extrabold text-[var(--ink)]">Templates</div><button type="button" onClick={() => setTplListOpen(false)} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
            <p className="mt-1 text-[12px] text-[var(--ink-3)]">Apply a saved pattern onto <b>{label}</b> — it adds the shifts on the matching days.</p>
            {templates.length === 0 ? (
              <p className="mt-3 rounded-lg bg-[var(--panel)] px-3 py-3 text-center text-[12.5px] text-[var(--ink-3)]">No templates yet. Build a week you like, then <b>Copy ▾ → Save as template</b>.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-1.5">{templates.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-[12.5px]">
                  <div className="min-w-0 flex-1"><div className="truncate font-bold text-[var(--ink)]">{t.name}</div><div className="text-[11px] text-[var(--ink-3)]">{t.items.length} shift{t.items.length === 1 ? "" : "s"}</div></div>
                  <button type="button" onClick={() => applyTemplate(t)} className="rounded-full bg-[#1d3a8f] px-3 py-1 text-[11.5px] font-bold text-white hover:bg-[#16306e]">Apply</button>
                  <button type="button" onClick={() => deleteTemplate(t.id)} title="Delete template" className="rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-[11.5px] font-bold text-[#c0392b] hover:bg-[#fdebec]">Delete</button>
                </div>
              ))}</div>
            )}
          </div>
        </div>
      )}

      {/* Add / edit shift — grouped (N staff needed / M filled) */}
      {draft && (() => {
        const assigned = draft.slots.filter(Boolean) as string[];
        const need = draft.slots.length, filled = assigned.length;
        const firstSt = assigned[0] ? staffById[assigned[0]] : null;
        const brkH = draft.brk ? durH(draft.brk.from, draft.brk.to) : 0;
        const shiftH = Math.max(0, durH(draft.start, draft.end) - (breakUnpaid ? brkH : 0));
        const cost = assigned.reduce((n, sid) => n + (staffById[sid]?.rate ?? 0) * shiftH, 0);
        return (
        <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[7vh]" onClick={() => { setDraft(null); setAssignOpen(false); setNoteOpen(false); }}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* header */}
            <div className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-3.5">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--panel)] text-[12px] font-extrabold text-[var(--ink-2)]">{firstSt ? initials(firstSt.name) : "＋"}</span>
              <div className="min-w-0"><div className="truncate text-[16px] font-extrabold text-[var(--ink)]">{firstSt ? firstSt.name : (draft.groupIds.length ? "Shift" : "New shift")}{filled > 1 && <span className="text-[var(--ink-3)]"> +{filled - 1}</span>}</div><div className="text-[11.5px] text-[var(--ink-3)]">{draft.role} · {draft.site}</div></div>
              <button type="button" onClick={() => { setDraft(null); setAssignOpen(false); setNoteOpen(false); }} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button>
            </div>

            {!assignOpen && !actionsOpen ? (
            <div className="px-5 py-4">
              {/* date */}
              <div className="flex items-center gap-2.5 border-b border-[var(--line-2,#eef2f8)] py-2.5"><span className="text-[15px]">📅</span>
                {isDay ? <span className="text-[13.5px] font-bold text-[var(--ink)]">{dt(draft.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}</span>
                  : <Select value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-[13.5px] font-bold text-[var(--ink)] rounded-lg">{(dates.includes(draft.date) ? dates : [draft.date, ...dates]).map((d) => <option key={d} value={d}>{dt(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}</option>)}</Select>}</div>
              {/* time */}
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line-2,#eef2f8)] py-2.5"><span className="text-[15px]">🕐</span><TimeSel value={draft.start} onChange={(v) => setDraft({ ...draft, start: v })} /><span className="text-[var(--ink-3)]">—</span><TimeSel value={draft.end} onChange={(v) => setDraft({ ...draft, end: v })} /></div>
              {/* staff needed / day → opens assign */}
              <div className="flex flex-wrap items-center gap-2.5 border-b border-[var(--line-2,#eef2f8)] py-2.5">
                <span className="text-[15px]">👤</span><span className="text-[13.5px] font-bold text-[var(--ink)]">Staff needed / day</span>
                <span className="ml-auto flex items-center gap-2">
                  <button type="button" onClick={() => setNeed(Math.max(1, need - 1))} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] text-[15px] font-extrabold text-[var(--ink-2)] hover:bg-[var(--panel)]">−</button>
                  <span className="w-6 text-center text-[15px] font-extrabold tabular-nums text-[var(--ink)]">{need}</span>
                  <button type="button" onClick={() => setNeed(need + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] text-[15px] font-extrabold text-[var(--ink-2)] hover:bg-[var(--panel)]">+</button>
                </span>
              </div>
              <button type="button" onClick={() => setAssignOpen(true)} className={"flex w-full items-center gap-2 py-2.5 text-left " + (assigned.length === 0 ? "border-b border-[var(--line-2,#eef2f8)]" : "")}>
                <span className="text-[15px]">🧑‍🤝‍🧑</span>
                <span className="text-[13.5px] font-bold text-[#1d3a8f]">Assign staff</span>
                <span className="ml-auto flex items-center gap-1.5 text-[12px] font-bold" style={{ color: filled >= need ? "#0f7a43" : "var(--ink-3)" }}>{filled} / {need} filled<span className="text-[var(--ink-3)]">›</span></span>
              </button>
              {/* assigned staff — remove one to unassign (frees the slot → open) */}
              {assigned.length > 0 && <div className="flex flex-wrap gap-1.5 border-b border-[var(--line-2,#eef2f8)] pb-2.5">
                {assigned.map((sid) => { const s = staffById[sid]; return (
                  <span key={sid} className="inline-flex items-center gap-1 rounded-full bg-[#eef4fd] py-1 pl-2.5 pr-1.5 text-[12px] font-bold text-[#1d3a8f]">{s?.name ?? "Unknown"}<button type="button" onClick={() => toggleAssign(sid)} title={`Unassign ${s?.name ?? ""}`} className="grid h-4 w-4 place-items-center rounded-full text-[12px] text-[#1d3a8f] hover:bg-[#dbe6fb] hover:text-[#c0392b]">×</button></span>
                ); })}
              </div>}
              {/* break */}
              {draft.brk ? (
                <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line-2,#eef2f8)] py-2.5"><span className="text-[15px]">☕</span><span className="text-[13px] font-bold text-[var(--ink)]">Break</span><TimeSel value={draft.brk.from} onChange={(v) => setDraft({ ...draft, brk: { ...draft.brk!, from: v } })} /><span className="text-[var(--ink-3)]">—</span><TimeSel value={draft.brk.to} onChange={(v) => setDraft({ ...draft, brk: { ...draft.brk!, to: v } })} /><button type="button" onClick={() => setDraft({ ...draft, brk: null })} className="ml-auto text-[16px] text-[var(--ink-3)]">×</button></div>
              ) : (
                <button type="button" onClick={() => setDraft({ ...draft, brk: { from: "12:00", to: addMins("12:00", defBreakM) } })} className="flex w-full items-center gap-2 border-b border-[var(--line-2,#eef2f8)] py-2.5 text-left"><span className="text-[15px]">☕</span><span className="text-[13.5px] font-bold text-[#1d3a8f]">Add break</span></button>
              )}
              {/* note */}
              {(noteOpen || draft.note.length > 0) ? (
                <div className="flex items-start gap-2 border-b border-[var(--line-2,#eef2f8)] py-2.5"><span className="text-[15px]">💬</span><textarea autoFocus value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} rows={2} placeholder="Shift note — visible to assigned staff" className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand)]" /></div>
              ) : (
                <button type="button" onClick={() => setNoteOpen(true)} className="flex w-full items-center gap-2 border-b border-[var(--line-2,#eef2f8)] py-2.5 text-left"><span className="text-[15px]">💬</span><span className="text-[13.5px] font-bold text-[#1d3a8f]">Add shift note</span></button>
              )}
              {/* role / location / listing / season */}
              <details className="border-b border-[var(--line-2,#eef2f8)] py-2.5"><summary className="cursor-pointer list-none text-[12.5px] font-bold text-[var(--ink-2)]">⚙️ Role · location · listing · season</summary>
                <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                  <div><label className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Role</label><Select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} className="w-full">{[...new Set([draft.role, ...roleOptions])].filter(Boolean).map((r) => <option key={r} value={r}>{r}</option>)}</Select></div>
                  <div><label className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Location</label><Select value={draft.site} onChange={(e) => setDraft({ ...draft, site: e.target.value })} className="w-full">{sites.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
                  <div><label className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Listing</label><Input value={draft.listing} onChange={(e) => setDraft({ ...draft, listing: e.target.value })} list="rota-listings" className="w-full" /><datalist id="rota-listings">{listingOpts.map((l) => <option key={l} value={l} />)}</datalist></div>
                  <div><label className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Season</label><Input value={draft.season} onChange={(e) => setDraft({ ...draft, season: e.target.value })} list="rota-seasons" className="w-full" /><datalist id="rota-seasons">{seasonOpts.map((s) => <option key={s} value={s} />)}</datalist></div>
                </div>
              </details>
              {/* footer */}
              <div className="mt-3 flex items-center gap-3">
                <div><div className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Total</div><div className="text-[15px] font-extrabold text-[var(--ink)]">{hLabel(shiftH)} · <span className="tabular-nums">{money(cost)}</span></div></div>
                <div className="ml-auto flex items-center gap-2">
                  <button type="button" onClick={() => setActionsOpen(true)} title="Shift actions" className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] text-[18px] font-extrabold leading-none text-[var(--ink-3)] hover:bg-[var(--panel)] hover:text-[var(--ink)]">⋯</button>
                  <button type="button" onClick={saveDraft} className="rounded-xl bg-[#0f7a43] px-6 py-2 text-[14px] font-extrabold text-white hover:brightness-105">Save</button>
                </div>
              </div>
            </div>
            ) : assignOpen ? (
            /* ── Assign staff sub-panel ── */
            <div className="px-5 py-4">
              <div className="mb-3 flex items-center gap-2"><button type="button" onClick={() => setAssignOpen(false)} className="text-[16px] text-[var(--ink-3)] hover:text-[var(--ink)]">‹</button><div className="text-[15px] font-extrabold text-[var(--ink)]">Assign staff</div><div className="ml-auto text-[12.5px] font-bold" style={{ color: filled >= need ? "#0f7a43" : "var(--ink-3)" }}>{filled} / {need} filled</div></div>
              <button type="button" onClick={autoFillDraft} className="mb-3 w-full rounded-xl bg-[#eef4fd] px-4 py-2.5 text-[13.5px] font-extrabold text-[#1d3a8f] hover:bg-[#e2edfb]">⚡ Auto-fill available staff</button>
              <p className="mb-2 text-[11.5px] text-[var(--ink-3)]">Staff already on a shift that day (here or at another location) can&rsquo;t be double-booked.</p>
              <div className="flex max-h-[46vh] flex-col divide-y divide-[var(--line-2,#eef2f8)] overflow-y-auto">
                {[...store.staff]
                  .map((st) => ({ st, on: draft.slots.includes(st.id), av: dayAvail(st, draft.date), busy: store.shifts.some((s) => s.staffId === st.id && s.date === draft.date && !draft.groupIds.includes(s.id)), leave: onLeave(st.name, draft.date) }))
                  .sort((a, b) => Number(b.on) - Number(a.on) || Number(a.leave) - Number(b.leave) || Number(b.av.ok) - Number(a.av.ok) || Number(a.busy) - Number(b.busy))
                  .map(({ st, on, av, busy, leave }) => {
                    const blocked = (busy || leave) && !on;
                    const sub = leave ? "🏖 On approved leave" : busy ? "On another shift this day" : av.label;
                    return (
                    <button key={st.id} type="button" disabled={blocked} onClick={() => toggleAssign(st.id)}
                      className={"flex items-center gap-3 py-2.5 text-left transition-colors " + (on ? "bg-[#eef4fd]" : "enabled:hover:bg-[var(--panel)]") + (blocked ? " opacity-45" : "")}>
                      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[var(--panel)] text-[12px] font-extrabold text-[var(--ink-2)]">{initials(st.name)}</span>
                      <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-extrabold text-[var(--ink)]">{st.name}</div><div className="text-[12px] font-semibold" style={{ color: blocked ? (leave ? "#b45309" : "var(--ink-3)") : av.ok ? "#0f7a43" : "var(--ink-3)" }}>{sub} · £{st.rate.toFixed(2)}/hr</div></div>
                      {on && <span className="text-[16px] font-extrabold text-[#1d3a8f]">✓</span>}
                    </button>
                  ); })}
              </div>
              <div className="mt-3 flex justify-end"><button type="button" onClick={() => setAssignOpen(false)} className="rounded-xl bg-[#0f7a43] px-6 py-2 text-[14px] font-extrabold text-white hover:brightness-105">Done</button></div>
            </div>
            ) : (
            /* ── Shift actions ── */
            <div className="px-5 py-4">
              <div className="mb-3 flex items-center gap-2"><button type="button" onClick={() => setActionsOpen(false)} className="text-[16px] text-[var(--ink-3)] hover:text-[var(--ink)]">‹</button><div className="text-[15px] font-extrabold text-[var(--ink)]">Shift actions</div></div>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => { autoFillDraft(); setActionsOpen(false); }} className="flex items-center gap-3 rounded-xl border border-[var(--line)] px-4 py-3 text-left text-[14px] font-extrabold text-[var(--ink)] hover:bg-[var(--panel)]"><span className="text-[16px]">⚡</span>Auto-fill available staff</button>
                <button type="button" onClick={copyToAllDays} className="flex items-center gap-3 rounded-xl border border-[var(--line)] px-4 py-3 text-left text-[14px] font-extrabold text-[var(--ink)] hover:bg-[var(--panel)]"><span className="text-[16px]">📋</span>Copy to all days in view</button>
                <button type="button" onClick={duplicateShift} className="flex items-center gap-3 rounded-xl border border-[var(--line)] px-4 py-3 text-left text-[14px] font-extrabold text-[var(--ink)] hover:bg-[var(--panel)]"><span className="text-[16px]">⧉</span>Duplicate shift</button>
                <button type="button" onClick={clearOpen} className="flex items-center gap-3 rounded-xl border border-[var(--line)] px-4 py-3 text-left text-[14px] font-extrabold text-[var(--ink)] hover:bg-[var(--panel)]"><span className="text-[16px]">↺</span>Clear (unassign → open)</button>
                <button type="button" onClick={deleteDraft} className="flex items-center gap-3 rounded-xl border border-[#f3c9cd] px-4 py-3 text-left text-[14px] font-extrabold text-[#c0392b] hover:bg-[#fdebec]"><span className="text-[16px]">🗑</span>Delete shift (all cards)</button>
              </div>
            </div>
            )}
          </div>
        </div>
      ); })()}

      {/* Hover card — a staff member's weekly availability */}
      {hover && (() => { const st = staffById[hover.id]; if (!st) return null; const daysOn = WDAYS.filter(([k]) => st.week?.[k]).length; return (
        <div style={{ position: "fixed", top: hover.top, left: hover.left, zIndex: 200 }} className="pointer-events-none w-[330px] overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-2xl">
          <div className="flex items-center gap-3 px-4 py-3.5 text-white" style={{ background: "linear-gradient(120deg,#16306e,#2f6bd8)" }}>
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white/20 text-[14px] font-extrabold">{initials(st.name)}</span>
            <div><div className="text-[15px] font-extrabold">{st.name}</div><div className="text-[12px] text-white/85">{st.avail === "confirmed" ? `Available ${daysOn} of 7 days` : "Availability not submitted"} · £{st.rate.toFixed(2)}/hr</div></div>
          </div>
          <div className="px-4 py-3">
            <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">Weekly availability</div>
            {st.avail !== "confirmed" ? <p className="py-2 text-[12.5px] text-[var(--ink-3)]">They haven&rsquo;t submitted their availability yet — send a reminder.</p> : (
              <div className="flex flex-col gap-2">
                {WDAYS.map(([k, lbl]) => { const w = st.week?.[k]; return (
                  <div key={k} className="flex items-center gap-3">
                    <span className="w-9 flex-none text-[12.5px] font-extrabold text-[var(--ink)]">{lbl}</span>
                    <div className="relative h-2 flex-1 rounded-full bg-[var(--panel)]">{w && <div className="absolute top-0 h-2 rounded-full" style={{ left: `${(mins(w.from) - WIN_A) / WIN * 100}%`, width: `${(mins(w.to) - mins(w.from)) / WIN * 100}%`, background: "#22b365" }} />}</div>
                    <span className="w-[112px] flex-none text-right text-[12px] font-bold" style={{ color: w ? "#0f7a43" : "var(--ink-3)" }}>{w ? `${to12(w.from)}–${to12(w.to)}` : "Unavailable"}</span>
                  </div>
                ); })}
              </div>
            )}
          </div>
        </div>
      ); })()}

      {/* View / edit a staff member's availability — This week / All weeks */}
      {availEdit && (() => { const st = availEdit;
        const mondayIso = iso(mondayOf(dt(anchor)));
        const wkSun = addDays(mondayIso, 6);
        const f = (s: string) => dt(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
        const target: Week = availWeekMode === "all" ? (st.week ?? {}) : (st.weeks?.[mondayIso] ?? st.week ?? {});
        const daysOn = WDAYS.filter(([k]) => target[k]).length;
        const commit = (wk: Week) => {
          const next: Staff = availWeekMode === "all"
            ? { ...st, week: wk, avail: Object.keys(wk).length ? "confirmed" : st.avail }
            : { ...st, weeks: { ...(st.weeks ?? {}), [mondayIso]: wk }, avail: "confirmed" };
          setAvailEdit(next); persist({ ...store, staff: store.staff.map((x) => (x.id === st.id ? next : x)) });
        };
        const setDay = (k: WDay, w: { from: string; to: string } | null) => { const wk = { ...target }; if (w) wk[k] = w; else delete wk[k]; commit(wk); };
        const preset = (keys: WDay[]) => commit(Object.fromEntries(keys.map((k) => [k, { from: "09:00", to: "17:00" }])) as Week);
        return (
          <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[6vh]" onClick={() => setAvailEdit(null)}>
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              {/* dark header */}
              <div className="flex items-center gap-3 px-5 py-4 text-white" style={{ background: "linear-gradient(120deg,#16306e,#2f6bd8)" }}>
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white/20 text-[14px] font-extrabold">{initials(st.name)}</span>
                <div><div className="text-[16px] font-extrabold">{st.name}</div><div className="text-[12px] text-white/85">Available {daysOn} of 7 days · £{st.rate.toFixed(2)}/hr</div></div>
                <button type="button" onClick={() => setAvailEdit(null)} className="ml-auto text-[20px] text-white/80 hover:text-white">×</button>
              </div>
              <div className="px-5 py-4">
                {/* tabs */}
                <div className="flex gap-2 rounded-xl bg-[var(--panel)] p-1">
                  <button type="button" onClick={() => setAvailWeekMode("this")} className={"flex-1 rounded-lg px-3 py-2 text-center transition-colors " + (availWeekMode === "this" ? "bg-white shadow-sm" : "")}><div className={"text-[13px] font-extrabold " + (availWeekMode === "this" ? "text-[#1d3a8f]" : "text-[var(--ink-2)]")}>This week</div><div className="text-[10.5px] text-[var(--ink-3)]">{f(mondayIso)}–{f(wkSun)} only</div></button>
                  <button type="button" onClick={() => setAvailWeekMode("all")} className={"flex-1 rounded-lg px-3 py-2 text-center transition-colors " + (availWeekMode === "all" ? "bg-white shadow-sm" : "")}><div className={"text-[13px] font-extrabold " + (availWeekMode === "all" ? "text-[#1d3a8f]" : "text-[var(--ink-2)]")}>All weeks</div><div className="text-[10.5px] text-[var(--ink-3)]">Recurring pattern</div></button>
                </div>
                <p className="mt-2.5 text-[11.5px] text-[var(--ink-3)]">{availWeekMode === "all"
                  ? <>Sets {st.name.split(" ")[0]}&rsquo;s <b>standard weekly availability</b> — applies to every week until changed.</>
                  : <>Overrides the recurring pattern for <b>this week only</b> ({f(mondayIso)}–{f(wkSun)}).</>}</p>
                {/* individually ask this staff member to fill in their own availability */}
                {(() => { const live = store.staff.find((x) => x.id === st.id) ?? st; const asked = live.reminders ?? 0; return (
                  <button type="button" onClick={() => requestOne(st.id, availWeekMode)} className={"mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-[11.5px] font-extrabold uppercase tracking-wide text-white shadow-sm hover:brightness-105 " + (live.avail === "confirmed" ? "bg-[#1d3a8f]" : "bg-[#c0392b]")}>✉️ {live.avail === "confirmed" ? `Ask ${st.name.split(" ")[0]} to update` : `Request ${st.name.split(" ")[0]} to complete availability`}{asked > 0 && <span className="rounded-full bg-white/25 px-1.5 py-[1px] text-[10px]">asked {asked}×</span>}</button>
                ); })()}
                {/* presets */}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => preset(["mon", "tue", "wed", "thu", "fri"])} className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">Weekdays 9–5</button>
                  <button type="button" onClick={() => preset(WDAYS.map(([k]) => k))} className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">All 7 days</button>
                  <button type="button" onClick={() => commit({})} className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">Clear all</button>
                </div>
                {/* per-day */}
                <div className="mt-2.5 flex flex-col gap-1.5">
                  {WDAYS.map(([k, lbl]) => { const w = target[k]; return (
                    <div key={k} className="flex flex-wrap items-center gap-2.5 rounded-xl border px-3 py-2" style={{ borderColor: w ? "#c9e7d5" : "var(--line)", background: w ? "#f2faf5" : "var(--surface)" }}>
                      <button type="button" onClick={() => setDay(k, w ? null : { from: "09:00", to: "17:00" })} role="switch" aria-checked={!!w} className="relative h-[22px] w-[40px] flex-none rounded-full transition-colors" style={{ background: w ? "#22b365" : "var(--line)" }}><span className="absolute top-[3px] h-[16px] w-[16px] rounded-full bg-white transition-all" style={{ left: w ? "21px" : "3px" }} /></button>
                      <span className="w-[40px] flex-none text-[13px] font-extrabold text-[var(--ink)]">{lbl}</span>
                      {w ? <div className="flex items-center gap-1.5"><TimeSel value={w.from} onChange={(v) => setDay(k, { ...w, from: v })} /><span className="text-[var(--ink-3)]">–</span><TimeSel value={w.to} onChange={(v) => setDay(k, { ...w, to: v })} /></div> : <span className="text-[12.5px] font-semibold text-[var(--ink-3)]">Not available</span>}
                    </div>
                  ); })}
                </div>
                <div className="mt-4 flex justify-end"><Button variant="primary" onClick={() => setAvailEdit(null)}>Done</Button></div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add-a-new-role picker */}
      {roleMenu && (() => { const si = roleMenu; const shown = [...new Set([...store.shifts.filter((s) => s.listing === si).map((s) => s.role), ...(extraRoles[si] ?? [])])]; const avail = roleOptions.filter((r) => !shown.includes(r)); return (
        <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[12vh]" onClick={() => setRoleMenu(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2"><span className="text-[16px]">➕</span><div className="text-[15px] font-extrabold text-[var(--ink)]">Add a role</div><button type="button" onClick={() => setRoleMenu(null)} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
            <p className="mt-1 text-[12px] text-[var(--ink-3)]">Adds a role row to <b>{si}</b> so you can roster it.</p>
            <div className="mt-3 flex flex-col gap-1.5">
              {avail.length === 0 && <p className="rounded-lg bg-[var(--panel)] px-3 py-2.5 text-center text-[12px] text-[var(--ink-3)]">Every standard role is already on this listing — add a custom one below.</p>}
              {avail.map((r) => (
                <button key={r} type="button" onClick={() => addRole(si, r)} className="flex items-center gap-2.5 rounded-xl border border-[var(--line)] px-3.5 py-2.5 text-left text-[13.5px] font-bold text-[var(--ink)] hover:bg-[var(--panel)]"><span className="h-3 w-3 flex-none rounded-full" style={{ background: roleCol(r) }} />{r}</button>
              ))}
              <button type="button" onClick={() => { const r = window.prompt("New role name"); if (r && r.trim()) addRole(si, r.trim()); else setRoleMenu(null); }} className="mt-1 flex items-center gap-2.5 rounded-xl border border-dashed border-[var(--line)] px-3.5 py-2.5 text-left text-[13.5px] font-bold text-[#1d3a8f] hover:bg-[var(--panel)]"><span className="text-[15px]">＋</span>Custom role…</button>
            </div>
          </div>
        </div>
      ); })()}

      </>
      )}

      {/* Season filter popup */}
      {seasonMenu && (
        <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[9vh]" onClick={() => setSeasonMenu(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2"><span className="text-[16px]">📅</span><div className="text-[15px] font-extrabold text-[var(--ink)]">Filter by season</div><button type="button" onClick={() => setSeasonMenu(false)} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
            <p className="mt-1 text-[12px] text-[var(--ink-3)]">Pick one or more seasons — the locations &amp; listings then narrow to whatever runs in them.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => { setSeasonSel(seasonOpts); setSite("all"); setListingF("all"); }} className="rounded-full border border-[#bfe3cd] bg-[#eef8f1] px-3 py-1 text-[12px] font-bold text-[#0f7a43]">✓ Select all</button>
              <button type="button" onClick={() => { setSeasonSel([]); setSite("all"); setListingF("all"); }} className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[12px] font-bold text-[var(--ink-2)]">Clear (all seasons)</button>
              <span className="ml-auto self-center text-[11.5px] font-bold text-[var(--ink-3)]">{seasonSel.length}/{seasonOpts.length}</span>
            </div>
            {seasonOpts.length === 0 ? (
              <p className="mt-3 rounded-lg bg-[var(--panel)] px-3 py-3 text-center text-[12.5px] text-[var(--ink-3)]">No seasons yet — add them in <b>Setup → Seasons</b>.</p>
            ) : (
              <div className="mt-3 flex max-h-[46vh] flex-col divide-y divide-[var(--line-2,#eef2f8)] overflow-y-auto">
                {seasonOpts.map((sn) => { const on = seasonSel.includes(sn); return (
                  <button key={sn} type="button" onClick={() => { setSeasonSel((xs) => (xs.includes(sn) ? xs.filter((x) => x !== sn) : [...xs, sn])); setSite("all"); setListingF("all"); }} className="flex items-center gap-2.5 py-2.5 text-left hover:bg-[var(--panel)]">
                    <span className="flex h-5 w-5 flex-none items-center justify-center rounded-md border-2 text-[11px] font-extrabold text-white" style={{ borderColor: on ? "#22b365" : "var(--line)", background: on ? "#22b365" : "white" }}>{on ? "✓" : ""}</span>
                    <span className="text-[13.5px] font-bold text-[var(--ink)]">{sn}</span>
                  </button>
                ); })}
              </div>
            )}
            <div className="mt-4 flex justify-end"><button type="button" onClick={() => setSeasonMenu(false)} className="rounded-full bg-[#1d3a8f] px-6 py-2 text-[13.5px] font-extrabold text-white hover:bg-[#16306e]">Done</button></div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-5 left-1/2 z-[140] -translate-x-1/2 rounded-full bg-[#16306e] px-4 py-2.5 text-[12.5px] font-bold text-white shadow-lg">{toast}</div>}
    </div>
  );
}




