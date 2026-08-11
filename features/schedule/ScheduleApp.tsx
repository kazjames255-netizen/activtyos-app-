"use client";

import { useEffect, useMemo, useState } from "react";
import { get as apiGet } from "@/lib/api";
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

interface Staff { id: string; name: string; role: string; rate: number; avail: "notsubmitted" | "confirmed"; reminders?: number }
interface Shift { id: string; staffId: string | null; site: string; role: string; listing?: string; season?: string; date: string; start: string; end: string; in?: string; out?: string; locked?: boolean }
interface Store { staff: Staff[]; shifts: Shift[]; sites: string[] }

const ROLE_COL: Record<string, string> = { "Lead Coach": "#2f6bd8", "Lifeguard": "#0f857b", "Coach": "#6366f1", "Activity Assistant": "#8b5cf6", "First Aider": "#c06a10" };
const roleCol = (r: string) => ROLE_COL[r] ?? "#64748b";
const ROLES = ["Lead Coach", "Coach", "Lifeguard", "First Aider", "Activity Assistant"];

const KEY = "aos.rota.v2";
function seed(): Store {
  const mon = mondayOf(new Date());
  const day = (n: number) => { const x = new Date(mon); x.setUTCDate(x.getUTCDate() + n); return iso(x); };
  const LM = "Loughton Manor First School", GL = "Gullivers Land, Milton Keynes";
  const staff: Staff[] = [
    { id: "amelia", name: "Amelia Hart", role: "Coach", rate: 14.0, avail: "confirmed" },
    { id: "dom", name: "Dom Reyes", role: "Lifeguard", rate: 11.5, avail: "notsubmitted" },
    { id: "kitty", name: "Kitty-Rose Bright", role: "Activity Assistant", rate: 13.0, avail: "notsubmitted" },
    { id: "liberty", name: "Liberty Young", role: "Coach", rate: 12.0, avail: "confirmed" },
    { id: "louis", name: "Louis Calderwood", role: "Lifeguard", rate: 11.0, avail: "notsubmitted" },
    { id: "oluwa", name: "OluwaDamilola Adeyemi", role: "Lead Coach", rate: 15.5, avail: "confirmed" },
    { id: "susan", name: "Susan Preston", role: "Lead Coach", rate: 12.5, avail: "confirmed" },
    { id: "taigan", name: "Taigan McMahon", role: "First Aider", rate: 13.5, avail: "notsubmitted" },
  ];
  let n = 0; const id = () => `sh${++n}`;
  const shifts: Shift[] = [
    { id: id(), staffId: "susan", site: LM, role: "Lead Coach", date: day(0), start: "08:00", end: "09:00", in: "08:04" },
    { id: id(), staffId: "oluwa", site: LM, role: "Lead Coach", date: day(0), start: "08:00", end: "09:00", out: "13:02" },
    { id: id(), staffId: null, site: LM, role: "Lead Coach", date: day(0), start: "08:00", end: "09:00" },
    { id: id(), staffId: null, site: LM, role: "Lead Coach", date: day(0), start: "08:00", end: "09:00" },
    { id: id(), staffId: "louis", site: LM, role: "Lead Coach", date: day(4), start: "17:00", end: "18:00" },
    { id: id(), staffId: null, site: LM, role: "Lead Coach", date: day(4), start: "17:00", end: "18:00" },
    { id: id(), staffId: null, site: LM, role: "Lead Coach", date: day(5), start: "11:45", end: "16:15" },
    { id: id(), staffId: null, site: LM, role: "Lead Coach", date: day(5), start: "11:45", end: "16:15" },
    { id: id(), staffId: "liberty", site: LM, role: "Lifeguard", date: day(2), start: "09:00", end: "13:00" },
    { id: id(), staffId: "oluwa", site: GL, role: "Lead Coach", date: day(1), start: "09:00", end: "15:00" },
    { id: id(), staffId: "amelia", site: GL, role: "Lead Coach", date: day(1), start: "09:00", end: "13:00", in: "09:02" },
    { id: id(), staffId: "amelia", site: LM, role: "Coach", date: day(0), start: "09:00", end: "13:00" },
    { id: id(), staffId: "amelia", site: LM, role: "Coach", date: day(3), start: "09:00", end: "13:00" },
    { id: id(), staffId: "taigan", site: GL, role: "Lead Coach", date: day(6), start: "11:45", end: "16:15", locked: true },
  ];
  for (const s of shifts) { s.listing = s.role === "Lifeguard" ? "Swim School" : s.site === LM ? "Holiday Multi-Sports Camp" : "Football Intensive"; s.season = s.site === GL ? "Autumn 2026" : "Summer 2026"; }
  return { staff, shifts, sites: [LM, GL, "Stantonbury Leisure Centre"] };
}
const load = (): Store => { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && v.shifts ? v : seed(); } catch { return seed(); } };

type Span = "day" | "week" | "2w" | "4w" | "month";
type Group = "area" | "staff";
const SPANS: [Span, string][] = [["day", "Day"], ["week", "Week"], ["2w", "2 Weeks"], ["4w", "4 Weeks"], ["month", "Month"]];
const GROUPS: [Group, string][] = [["area", "Area"], ["staff", "Team member"]];
const SPAN_WORD: Record<Span, string> = { day: "today", week: "this week", "2w": "these 2 weeks", "4w": "these 4 weeks", month: "this month" };
type Draft = { id?: string; site: string; role: string; listing: string; season: string; date: string; staffId: string | null; start: string; end: string };

export function ScheduleApp() {
  const [store, setStore] = useState<Store>(seed);
  const [anchor, setAnchor] = useState(() => iso(new Date()));
  const [span, setSpan] = useState<Span>("week");
  const [group, setGroup] = useState<Group>("area");
  const [site, setSite] = useState("all");
  const [listingF, setListingF] = useState("all");
  const [seasonF, setSeasonF] = useState("all");
  const [q, setQ] = useState("");
  const [help, setHelp] = useState(false);
  const [canManage, setCanManage] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [autoMenu, setAutoMenu] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  useEffect(() => { setStore(load()); apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);
  const persist = (s: Store) => { setStore(s); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } };

  // Period dates for the current span/anchor
  const dates = useMemo(() => {
    if (span === "day") return [anchor];
    if (span === "month") { const d = dt(anchor); const y = d.getUTCFullYear(), m = d.getUTCMonth(); const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); return Array.from({ length: last }, (_, i) => iso(new Date(Date.UTC(y, m, i + 1)))); }
    const len = span === "week" ? 7 : span === "2w" ? 14 : 28;
    const start = iso(mondayOf(dt(anchor)));
    return Array.from({ length: len }, (_, i) => addDays(start, i));
  }, [span, anchor]);
  const dateSet = useMemo(() => new Set(dates), [dates]);
  const isDay = span === "day";

  const nav = (dir: 1 | -1) => {
    if (span === "day") setAnchor(addDays(anchor, dir));
    else if (span === "month") { const d = dt(anchor); setAnchor(iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + dir, 1)))); }
    else setAnchor(addDays(iso(mondayOf(dt(anchor))), dir * (span === "week" ? 7 : span === "2w" ? 14 : 28)));
  };
  const label = useMemo(() => {
    if (span === "day") return dt(anchor).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
    if (span === "month") return dt(anchor).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
    const f = (s: string) => dt(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    return `${f(dates[0])} – ${f(dates[dates.length - 1])}`;
  }, [span, anchor, dates]);

  const staffById = useMemo(() => Object.fromEntries(store.staff.map((s) => [s.id, s])), [store.staff]);
  const inPeriod = (s: Shift) => dateSet.has(s.date) && (site === "all" || s.site === site) && (listingF === "all" || s.listing === listingF) && (seasonF === "all" || s.season === seasonF);
  const periodShifts = useMemo(() => store.shifts.filter(inPeriod), [store.shifts, dateSet, site, listingF, seasonF]);
  const listingOpts = useMemo(() => [...new Set(store.shifts.map((s) => s.listing).filter(Boolean) as string[])].sort(), [store.shifts]);
  const seasonOpts = useMemo(() => [...new Set(store.shifts.map((s) => s.season).filter(Boolean) as string[])].sort(), [store.shifts]);

  const staffHours = (id: string) => periodShifts.filter((s) => s.staffId === id).reduce((n, s) => n + durH(s.start, s.end), 0);
  const wagesAt = store.staff.reduce((n, st) => n + staffHours(st.id) * st.rate, 0);
  const wagesCost = wagesAt * (1 + ON_COST / 100);
  const assignedStaff = useMemo(() => new Set(periodShifts.filter((s) => s.staffId).map((s) => s.staffId as string)), [periodShifts]);
  const notSubmitted = store.staff.filter((s) => s.avail === "notsubmitted").length;
  const alerts = useMemo(() => periodShifts.filter((s) => s.staffId && !s.in && !s.out), [periodShifts]);
  const shownStaff = store.staff.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.role.toLowerCase().includes(q.toLowerCase()));

  // Columns: hours for Day, dates otherwise
  const cols = useMemo(() => isDay ? HOURS.map((h) => ({ key: `h${h}`, hour: h, label: to12(`${h}:00`), date: anchor })) : dates.map((d) => ({ key: d, date: d, hour: null as number | null, label: dt(d).toLocaleDateString("en-GB", span === "week" ? { weekday: "short", day: "numeric", timeZone: "UTC" } : { day: "numeric", timeZone: "UTC" }) })), [isDay, dates, anchor, span]);
  const colW = isDay ? 66 : span === "week" ? 92 : span === "2w" ? 58 : 34;
  const cellShifts = (rows: Shift[], c: { date: string; hour: number | null }) => rows.filter((s) => s.date === c.date && (c.hour == null || hourOf(s.start) === c.hour)).sort((a, b) => mins(a.start) - mins(b.start));

  const removeShift = (id: string) => persist({ ...store, shifts: store.shifts.filter((s) => s.id !== id) });
  const remind = (id: string) => { persist({ ...store, staff: store.staff.map((s) => (s.id === id ? { ...s, reminders: (s.reminders ?? 0) + 1 } : s)) }); flash("Reminder sent."); };
  const requestAvail = () => flash(`Availability requested from ${notSubmitted} staff.`);
  function saveDraft() {
    if (!draft) return;
    if (draft.id) persist({ ...store, shifts: store.shifts.map((s) => (s.id === draft.id ? { ...s, ...draft, listing: draft.listing || undefined, season: draft.season || undefined } : s)) });
    else persist({ ...store, shifts: [...store.shifts, { id: `sh${Date.now()}`, site: draft.site, role: draft.role, listing: draft.listing || undefined, season: draft.season || undefined, date: draft.date, staffId: draft.staffId, start: draft.start, end: draft.end }] });
    setDraft(null);
  }
  function autoFill() {
    setAutoMenu(false);
    const confirmed = store.staff.filter((s) => s.avail === "confirmed");
    const next = store.shifts.map((s) => ({ ...s })); let filled = 0;
    for (const u of next.filter((s) => inPeriod(s) && !s.staffId)) {
      const busy = (sid: string) => next.some((x) => x.staffId === sid && x.date === u.date && overlaps(x, u));
      const cand = [...confirmed].sort((a, b) => Number(b.role === u.role) - Number(a.role === u.role)).find((c) => !busy(c.id));
      if (cand) { u.staffId = cand.id; filled++; }
    }
    persist({ ...store, shifts: next });
    flash(filled ? `Auto-filled ${filled} shift${filled === 1 ? "" : "s"}.` : "No confirmed staff free for the open shifts.");
  }
  function clearPeriod() { setAutoMenu(false); const n = periodShifts.length; persist({ ...store, shifts: store.shifts.filter((s) => !inPeriod(s)) }); flash(`Cleared ${n} shift${n === 1 ? "" : "s"}.`); }
  function copyForward() { const len = dates.length; const copies = periodShifts.map((s, i) => ({ ...s, id: `sh${Date.now()}${i}`, date: addDays(s.date, len), in: undefined, out: undefined, locked: false })); persist({ ...store, shifts: [...store.shifts, ...copies] }); flash(`Copied ${copies.length} shift${copies.length === 1 ? "" : "s"} forward.`); }
  function publish() { const ids = new Set(periodShifts.filter((s) => s.staffId).map((s) => s.id)); persist({ ...store, shifts: store.shifts.map((s) => (ids.has(s.id) ? { ...s, locked: true } : s)) }); flash(`Published to ${assignedStaff.size} staff — shifts locked.`); }
  const openAdd = (site_: string, role: string, c: { date: string; hour: number | null }, staffId: string | null) =>
    setDraft({ site: site_, role, listing: listingF !== "all" ? listingF : "", season: seasonF !== "all" ? seasonF : "Summer 2026", date: c.date, staffId, start: c.hour != null ? `${String(c.hour).padStart(2, "0")}:00` : "09:00", end: c.hour != null ? `${String(c.hour + 1).padStart(2, "0")}:00` : "17:00" });

  const ShiftBlock = ({ s, compact }: { s: Shift; compact?: boolean }) => {
    const st = s.staffId ? staffById[s.staffId] : null; const filled = !!st; const col = roleCol(s.role);
    return (
      <button type="button" onClick={() => canManage && setDraft({ id: s.id, site: s.site, role: s.role, listing: s.listing ?? "", season: s.season ?? "", date: s.date, staffId: s.staffId, start: s.start, end: s.end })} disabled={!canManage}
        className={"w-full rounded-lg border text-left transition-shadow enabled:hover:shadow-sm " + (compact ? "px-1 py-1 text-[9.5px]" : "px-2 py-1.5 text-[11px]")}
        style={filled ? { borderColor: col, background: `${col}0f`, borderLeftWidth: 3 } : { borderColor: "var(--line)", borderStyle: "dashed", background: "var(--surface)" }}>
        {!compact && <div className="flex items-start gap-1"><span className="min-w-0 flex-1 font-extrabold text-[var(--ink)]">{to12(s.start)} – {to12(s.end)}</span>{canManage && <span role="button" onClick={(e) => { e.stopPropagation(); removeShift(s.id); }} className="flex-none text-[var(--ink-3)] hover:text-[#c0392b]">×</span>}</div>}
        <div className={"truncate " + (filled ? "font-bold text-[var(--ink)]" : "text-[var(--ink-3)]")}>{st ? (compact ? st.name.split(" ")[0] : st.name) : (compact ? "—" : "Unfilled")}</div>
        {!compact && filled && <div className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={s.out || s.in ? { background: "#e2f4ea", color: "#0f7a43" } : { background: "var(--panel)", color: "var(--ink-3)" }}>{s.out ? `✅ Out ${to12(s.out)}` : s.in ? `🟢 In ${to12(s.in)}` : "⚪ Not in"}</div>}
        {!compact && s.locked && <div className="mt-1 inline-block rounded bg-[#1d3a8f] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-white">Locked</div>}
      </button>
    );
  };

  // Render a row of column-cells for a given set of shifts (a role or a staff member)
  const CellRow = ({ rows, onAdd, compact }: { rows: Shift[]; onAdd: (c: { date: string; hour: number | null }) => void; compact?: boolean }) => (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${cols.length},minmax(${colW}px,1fr))` }}>
      {cols.map((c) => (
        <div key={c.key} className="flex min-h-[54px] flex-col gap-1 border-r border-[var(--line-2,#eef2f8)] p-1 last:border-r-0">
          {cellShifts(rows, c).map((s) => <ShiftBlock key={s.id} s={s} compact={compact} />)}
          {canManage && <button type="button" onClick={() => onAdd(c)} className="rounded-md border border-dashed border-[var(--line)] py-0.5 text-[12px] text-[var(--ink-3)] hover:border-[var(--brand)] hover:text-[#1d3a8f]">＋</button>}
        </div>
      ))}
    </div>
  );
  const TotalsRow = ({ rows }: { rows: Shift[] }) => (
    <div className="grid border-b border-[var(--line-2,#eef2f8)]" style={{ gridTemplateColumns: `repeat(${cols.length},minmax(${colW}px,1fr))` }}>
      {cols.map((c) => <div key={c.key} className="px-2 py-1 text-[10px] font-bold text-[var(--ink-3)]">{hLabel(cellShifts(rows, c).reduce((n, s) => n + durH(s.start, s.end), 0))}</div>)}
    </div>
  );

  const compact = colW < 60;
  const gridSites = site === "all" ? store.sites.filter((si) => periodShifts.some((s) => s.site === si)) : [site];

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="Staff schedule" icon="🗓" lede="Build the rota by site & role or by team member, across day / week / month — with wages and on-cost." />

      <Card className="mb-3 overflow-hidden">
        <button type="button" onClick={() => setHelp((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left"><span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--panel)] text-[12px]">ⓘ</span><span className="text-[14px] font-extrabold text-[var(--ink)]">How availability works</span><span className="ml-auto text-[12px] text-[var(--ink-3)]">{help ? "▲" : "▼"}</span></button>
        {help && <ol className="ml-9 list-decimal space-y-1 px-4 pb-3.5 text-[13px] leading-relaxed text-[var(--ink-2)]"><li><b>Request availability</b> — hit the red button in the staff panel. Everyone starts <b className="text-[#c0392b]">Not submitted</b>.</li><li>Staff set the days &amp; times they can work — their card turns <b className="text-[#0f7a43]">Confirmed</b>.</li><li>Still red? Tap the <b>gold bell</b> to send a reminder.</li><li>Then ✨ Auto-schedule fills open shifts and Publish locks them &amp; tells staff.</li></ol>}
      </Card>

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[13px] font-bold text-[#1d3a8f]">📍 <Select value={site} onChange={(e) => setSite(e.target.value)} className="border-0 bg-transparent p-0 text-[13px] font-bold text-[#1d3a8f] outline-none"><option value="all">All sites</option>{store.sites.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
        <div className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[13px] font-bold text-[#1d3a8f]">🎟 <Select value={listingF} onChange={(e) => setListingF(e.target.value)} className="border-0 bg-transparent p-0 text-[13px] font-bold text-[#1d3a8f] outline-none"><option value="all">All listings</option>{listingOpts.map((l) => <option key={l} value={l}>{l}</option>)}</Select></div>
        <div className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[13px] font-bold text-[#1d3a8f]">📅 <Select value={seasonF} onChange={(e) => setSeasonF(e.target.value)} className="border-0 bg-transparent p-0 text-[13px] font-bold text-[#1d3a8f] outline-none"><option value="all">All seasons</option>{seasonOpts.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-1.5 py-1">
          <button type="button" onClick={() => nav(-1)} className="px-2 text-[15px] text-[var(--ink-3)] hover:text-[var(--ink)]">‹</button>
          <span className="min-w-[120px] text-center text-[12.5px] font-bold text-[var(--ink)]">{label}</span>
          <button type="button" onClick={() => nav(1)} className="px-2 text-[15px] text-[var(--ink-3)] hover:text-[var(--ink)]">›</button>
        </div>
        <button type="button" onClick={() => setShowAlerts(true)} className="relative rounded-full border border-[#bcd0f5] bg-[#eef4fd] px-3.5 py-1.5 text-[13px] font-bold text-[#1d3a8f]">🔔 Check-in alerts{alerts.length > 0 && <span className="ml-1 rounded-full bg-[#c0392b] px-1.5 text-[10px] font-extrabold text-white">{alerts.length}</span>}</button>
        <div className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[13px] font-bold text-[#1d3a8f]">
          <Select value={`${span}:${group}`} onChange={(e) => { const [sp, gr] = e.target.value.split(":"); setSpan(sp as Span); setGroup(gr as Group); }} className="border-0 bg-transparent p-0 text-[13px] font-bold text-[#1d3a8f] outline-none">
            {GROUPS.map(([g, gl]) => SPANS.map(([s, sl]) => <option key={`${s}:${g}`} value={`${s}:${g}`}>{sl} by {gl}</option>))}
          </Select>
        </div>
        {canManage && (
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button type="button" onClick={() => setAutoMenu((v) => !v)} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[13px] font-bold text-[#1d3a8f]">✨ Auto-schedule ▾</button>
              {autoMenu && <div className="absolute right-0 top-[38px] z-20 w-[240px] overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-lg"><button type="button" onClick={autoFill} className="block w-full px-3.5 py-2.5 text-left text-[12.5px] font-semibold text-[var(--ink)] hover:bg-[var(--panel)]">Fill open shifts from confirmed staff</button><button type="button" onClick={clearPeriod} className="block w-full border-t border-[var(--line-2,#eef2f8)] px-3.5 py-2.5 text-left text-[12.5px] font-semibold text-[#c0392b] hover:bg-[#fdebec]">Clear all shifts shown</button></div>}
            </div>
            <button type="button" onClick={() => { setStore(load()); flash("Refreshed."); }} title="Refresh" className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[13px]">↻</button>
            <button type="button" onClick={copyForward} title="Copy this period forward" className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[13px]">⧉</button>
            <button type="button" onClick={publish} className="rounded-full bg-[#0f7a43] px-4 py-1.5 text-[13px] font-extrabold text-white hover:brightness-105">Publish to staff · {assignedStaff.size}</button>
          </div>
        )}
      </div>

      {/* Wages */}
      <Card className="mb-3 border-l-4 border-l-[#1d3a8f] p-4">
        <div className="flex flex-wrap items-start justify-between gap-4"><div className="text-[14px] font-extrabold text-[var(--ink)]">Total wages · {SPAN_WORD[span]}</div><div className="flex gap-8 text-right"><div><div className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">At hourly rate</div><div className="text-[22px] font-extrabold tabular-nums text-[var(--ink)]">{money(wagesAt)}</div></div><div><div className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Incl. {ON_COST}% on-cost</div><div className="text-[22px] font-extrabold tabular-nums text-[#1d3a8f]">{money(wagesCost)}</div></div></div></div>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--ink-3)]">Predicted <b>on-cost</b> adds a cost on top of wages (e.g. employer NI, pension). Recorded only — ActivityOS never moves money.</p>
      </Card>

      <div className="flex flex-col gap-3 lg:flex-row">
        {/* Staff panel */}
        <div className="lg:w-[204px] lg:flex-none">
          <Card className="p-2.5">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Search" className="mb-2 w-full text-[12px]" />
            {canManage && <div className="mb-2.5"><div className="mb-1 text-[9px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">Step 1 · Confirm availability</div><button type="button" onClick={requestAvail} className="w-full rounded-lg bg-[#c0392b] px-2 py-2 text-[11px] font-extrabold uppercase leading-tight tracking-wide text-white hover:brightness-105">Request staff{notSubmitted ? ` · ${notSubmitted}` : ""}</button></div>}
            <div className="flex flex-col divide-y divide-[var(--line-2,#eef2f8)]">
              {shownStaff.map((st) => { const hrs = staffHours(st.id); const pay = hrs * st.rate; const cost = pay * (1 + ON_COST / 100); return (
                <div key={st.id} className="flex items-start gap-2 py-2">
                  <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--panel)] text-[10.5px] font-extrabold text-[var(--ink-2)]">{initials(st.name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1"><span className="truncate text-[12px] font-extrabold text-[var(--ink)]">{st.name}</span>{st.avail === "notsubmitted" ? <button type="button" onClick={() => remind(st.id)} title={`Send reminder${st.reminders ? ` (sent ${st.reminders})` : ""}`} className="flex-none text-[11px]">🔔</button> : <span title="Confirmed" className="flex-none text-[10px] text-[#0f7a43]">✓</span>}</div>
                    <div className="text-[9px] font-bold uppercase tracking-wide text-[var(--ink-3)]"><span className={st.avail === "confirmed" ? "text-[#0f7a43]" : "text-[#c0392b]"}>{st.avail === "confirmed" ? "Confirmed" : "Not submitted"}</span></div>
                    <div className="mt-0.5 text-[11px] text-[var(--ink-2)]">{hLabel(hrs)} · £{st.rate.toFixed(2)}/hr</div>
                    <div className="text-[11px] font-bold text-[var(--ink)]">{money(pay)} <span className="font-normal text-[var(--ink-3)]">· {money(cost)} on-cost</span></div>
                  </div>
                </div>
              ); })}
            </div>
          </Card>
        </div>

        {/* Grid */}
        <div className="min-w-0 flex-1">
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <div style={{ minWidth: cols.length * colW + 40 }}>
                <div className="grid text-white" style={{ gridTemplateColumns: `repeat(${cols.length},minmax(${colW}px,1fr))`, background: "linear-gradient(120deg,#16306e,#2f6bd8)" }}>
                  {cols.map((c) => <div key={c.key} className="px-2 py-2.5 text-[11.5px] font-extrabold">{c.label}</div>)}
                </div>

                {periodShifts.length === 0 && <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">No shifts in this view.</div>}

                {group === "area" ? (
                  gridSites.map((si) => (
                    <div key={si}>
                      <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-3 py-2"><span className="text-[13px]">📍</span><span className="text-[14px] font-extrabold text-[var(--ink)]">{si}</span><span className="ml-auto text-[11.5px] text-[var(--ink-3)]">{periodShifts.filter((s) => s.site === si).length} shifts</span></div>
                      {[...new Set(periodShifts.filter((s) => s.site === si).map((s) => s.role))].map((role) => {
                        const rows = periodShifts.filter((s) => s.site === si && s.role === role);
                        return (
                          <div key={role}>
                            <div className="flex items-center gap-2 border-b border-[var(--line-2,#eef2f8)] px-3 py-1.5" style={{ boxShadow: `inset 3px 0 0 ${roleCol(role)}` }}><span className="h-2.5 w-2.5 rounded-full" style={{ background: roleCol(role) }} /><span className="text-[13px] font-extrabold" style={{ color: roleCol(role) }}>{role}</span></div>
                            {!isDay && <TotalsRow rows={rows} />}
                            <CellRow rows={rows} compact={compact} onAdd={(c) => openAdd(si, role, c, null)} />
                          </div>
                        );
                      })}
                    </div>
                  ))
                ) : (
                  shownStaff.map((st) => {
                    const rows = periodShifts.filter((s) => s.staffId === st.id);
                    return (
                      <div key={st.id}>
                        <div className="flex items-center gap-2 border-b border-[var(--line-2,#eef2f8)] bg-[var(--panel)] px-3 py-1.5"><span className="text-[12.5px] font-extrabold text-[var(--ink)]">{st.name}</span><span className="text-[11px] text-[var(--ink-3)]">{st.role} · {hLabel(staffHours(st.id))} · {money(staffHours(st.id) * st.rate)}</span></div>
                        {!isDay && <TotalsRow rows={rows} />}
                        <CellRow rows={rows} compact={compact} onAdd={(c) => openAdd(store.sites[0], st.role, c, st.id)} />
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
            <p className="mt-1 text-[12px] text-[var(--ink-3)]">Assigned staff who haven&rsquo;t checked in. Staff check in from their app / the register; if they&rsquo;re not in by their start time they appear here.</p>
            {alerts.length === 0 ? <p className="mt-3 rounded-lg bg-[#e2f4ea] px-3 py-2.5 text-[12.5px] font-bold text-[#0f7a43]">✓ Everyone assigned is checked in.</p> : (
              <div className="mt-3 flex flex-col gap-1.5">{alerts.map((s) => { const st = staffById[s.staffId!]; return (
                <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[12.5px]"><span className="font-bold text-[var(--ink)]">{st?.name}</span><span className="text-[var(--ink-3)]">{dt(s.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })} · {to12(s.start)}–{to12(s.end)} · {s.site}</span><span className="ml-auto flex items-center gap-1.5"><span className="rounded-full bg-[#eef1f6] px-2 py-0.5 text-[11px] font-bold text-[var(--ink-3)]">⚪ Not in</span><button type="button" onClick={() => remind(s.staffId!)} className="rounded-full bg-[#1d3a8f] px-2.5 py-0.5 text-[11px] font-bold text-white hover:bg-[#16306e]">Remind</button></span></div>
              ); })}</div>
            )}
          </div>
        </div>
      )}

      {/* Add / edit shift */}
      {draft && (
        <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[8vh]" onClick={() => setDraft(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-[15px] font-extrabold text-[var(--ink)]">{draft.id ? "Edit shift" : "Add a shift"}</div>
            <div className="mt-1 text-[12px] text-[var(--ink-3)]">{dt(draft.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" })}</div>
            <div className="mt-3 grid gap-2.5">
              <div className="grid grid-cols-2 gap-2.5"><div><label className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Location</label><Select value={draft.site} onChange={(e) => setDraft({ ...draft, site: e.target.value })} className="w-full">{store.sites.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div><div><label className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Role</label><Select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} className="w-full">{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</Select></div></div>
              <div className="grid grid-cols-2 gap-2.5"><div><label className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Listing</label><Input value={draft.listing} onChange={(e) => setDraft({ ...draft, listing: e.target.value })} list="rota-listings" className="w-full" /><datalist id="rota-listings">{listingOpts.map((l) => <option key={l} value={l} />)}</datalist></div><div><label className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Season</label><Input value={draft.season} onChange={(e) => setDraft({ ...draft, season: e.target.value })} list="rota-seasons" className="w-full" /><datalist id="rota-seasons">{seasonOpts.map((s) => <option key={s} value={s} />)}</datalist></div></div>
              <div><label className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Assign to</label><Select value={draft.staffId ?? ""} onChange={(e) => setDraft({ ...draft, staffId: e.target.value || null })} className="w-full"><option value="">Unfilled — fill later</option>{store.staff.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.role}</option>)}</Select></div>
              <div className="grid grid-cols-2 gap-2.5"><div><label className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Start</label><Input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className="w-full" /></div><div><label className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">End</label><Input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} className="w-full" /></div></div>
            </div>
            <div className="mt-4 flex items-center gap-2"><Button variant="primary" onClick={saveDraft}>{draft.id ? "Save changes" : "Add shift"}</Button><Button onClick={() => setDraft(null)}>Cancel</Button>{draft.id && <button type="button" onClick={() => { removeShift(draft.id!); setDraft(null); }} className="ml-auto text-[12px] font-bold text-[#c0392b] hover:underline">Delete shift</button>}</div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-5 left-1/2 z-[140] -translate-x-1/2 rounded-full bg-[#16306e] px-4 py-2.5 text-[12.5px] font-bold text-white shadow-lg">{toast}</div>}
    </div>
  );
}
