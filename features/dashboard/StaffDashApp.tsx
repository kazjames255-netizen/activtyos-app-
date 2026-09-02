"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { get as apiGet, put as apiPut, openFile } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Button } from "@/components/ui";
import { PageHero } from "@/components/OperatorPage";
import { loadClock, clockIn, clockOut, startBreak, endBreak, slug, fmtDurSec, workedMs, type ClockRecord } from "@/features/timeclock/data";
import { greeting } from "@/lib/greeting";
import { useSettings } from "@/lib/settings";
import { loadAnnouncements, loadRead, saveRead, type Announcement } from "@/features/staff/announcements";

// ─────────────────────────────────────────────────────────────────────────
// staff/dash — the staff member's colourful landing page. Live tenant data:
// today's sessions, the team's tasks, plus the staffer's own shift-today +
// a quick clock in/out card (same store the Clock in & out page uses).
// Demo "me" = Marcus Bell (per-user identity is Amir's).
// ─────────────────────────────────────────────────────────────────────────

const ME = "Marcus Bell";
const ROTA_KEY = "aos.rota.v5";

interface RatioSession { blockId: string; start: string; end: string; blockName: string; listingName: string; totalChildren: number; sendCount: number; requiredStaff: number; staffAssigned: number; met: boolean }
interface Task { id: string; title: string; done: boolean; priority?: "low" | "normal" | "high"; dueDate?: string; assignee?: string }
interface PublishedLite { id: string; dayList: { iso: string }[] }
interface Me { tenantName: string | null; name?: string }
interface MyShift { start: string; end: string; role?: string; site?: string; listing?: string }
// Register feed — the day's real attendance + safeguarding flags per child.
interface ChildFlags { allergies?: string; medical?: string; dietary?: string; send?: string; sendPlanId?: string; sendPlanName?: string; careNotes?: string; likes?: string; dislikes?: string; collectionPassword?: string; photoConsent?: boolean; suncreamConsent?: boolean; firstAidConsent?: boolean; walkHomeConsent?: boolean; emergencyName?: string; emergencyPhone?: string }
interface Accident { id: string; date: string; time?: string; childName: string; description: string; injury?: string; severity?: string }
interface RegAttendee { ref: string; children: { name: string; age?: number }[]; child: ChildFlags | null; attendance: { status?: "in" | "absent"; collectedAt?: string } | null }
interface RegSession { blockId: string; start: string; end: string; blockName: string; listingName: string; attendees: RegAttendee[]; counts: { expected: number; present: number; notArrived: number; absent: number; collected: number } }
interface WatchFlag { k: string; detail?: string; bg: string; fg: string }
interface WatchKid { key: string; name: string; where: string; status: "in" | "absent" | "due"; flags: WatchFlag[] }

// Which safeguarding flags a child carries, as colour-coded chips.
function flagsOf(c: ChildFlags): WatchFlag[] {
  const out: WatchFlag[] = [];
  if (c.send || c.sendPlanId || c.sendPlanName) out.push({ k: "SEND", detail: c.sendPlanName || c.send || undefined, bg: "#f3e8ff", fg: "#7c3aed" });
  if (c.allergies) out.push({ k: "Allergy", detail: c.allergies, bg: "#fdecec", fg: "#c0362c" });
  if (c.medical) out.push({ k: "Medical", detail: c.medical, bg: "#fef3d8", fg: "#9a5a00" });
  if (c.dietary) out.push({ k: "Dietary", detail: c.dietary, bg: "#e6f7ee", fg: "#0f7a43" });
  if (c.careNotes) out.push({ k: "Care plan", detail: c.careNotes, bg: "#e7f0ff", fg: "#1d4ed8" });
  return out;
}

const todayIso = () => { const t = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`; };
const addDaysIso = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); const p = (x: number) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const to12 = (t: string) => { const [h, m] = (t || "0:0").split(":").map(Number); const ap = h >= 12 ? "pm" : "am"; const hr = h % 12 === 0 ? 12 : h % 12; return `${hr}${m ? ":" + String(m).padStart(2, "0") : ""}${ap}`; };
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
function myShiftToday(day: string): MyShift | null {
  try {
    const s = JSON.parse(localStorage.getItem(ROTA_KEY) || "null") as { staff?: { id: string; name: string }[]; shifts?: MyShift[] & { staffId?: string; date?: string }[] } | null;
    const ids = new Set((s?.staff || []).filter((x) => x.name === ME).map((x) => x.id));
    return ((s?.shifts as (MyShift & { staffId?: string; date?: string })[]) || []).find((x) => x.staffId && ids.has(x.staffId) && x.date === day) ?? null;
  } catch { return null; }
}

interface Coworker { name: string; start: string; end: string; role?: string; where?: string }
// Who else is rostered today — gated by the same "co-worker visibility" setting
// that controls MySchedule's "Who's on" tab (all / same-listing / leads / none).
function coworkersToday(vis: "all" | "team" | "leads" | "none", day: string): Coworker[] {
  if (vis === "none") return [];
  try {
    const s = JSON.parse(localStorage.getItem(ROTA_KEY) || "null") as { staff?: { id: string; name: string }[]; shifts?: (MyShift & { staffId?: string; date?: string })[] } | null;
    const staff = s?.staff || [];
    const shifts = (s?.shifts as (MyShift & { staffId?: string; date?: string })[]) || [];
    const meIds = new Set(staff.filter((x) => x.name === ME).map((x) => x.id));
    const mine = shifts.filter((x) => x.date === day && x.staffId && meIds.has(x.staffId));
    const iAmLead = mine.some((x) => /lead|manager|owner/i.test(x.role || ""));
    if (vis === "leads" && !iAmLead) return [];
    const myScopes = new Set(mine.map((x) => x.listing || x.site).filter(Boolean));
    const nameById = new Map(staff.map((x) => [x.id, x.name]));
    const seen = new Set<string>();
    return shifts
      .filter((x) => x.date === day && x.staffId && !meIds.has(x.staffId))
      .filter((x) => (vis === "team" ? myScopes.has(x.listing || x.site) : true))
      .map((x) => ({ name: nameById.get(x.staffId!) || "Colleague", start: x.start, end: x.end, role: x.role, where: x.listing || x.site }))
      .filter((c) => { const k = `${c.name}|${c.start}|${c.end}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => (a.start || "").localeCompare(b.start || ""));
  } catch { return []; }
}

// A collapsible card with a richly-coloured header band. Remembers open/closed
// per id. Used for most of the staff dashboard's cards so they read as one set.
function Section({ id, icon, title, sub, tint, ink, badge, action, defaultOpen = true, children }: {
  id: string; icon: string; title: string; sub?: string; tint: string; ink: string; badge?: ReactNode; action?: ReactNode; defaultOpen?: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { try { const v = localStorage.getItem(`aos.sdash.${id}`); if (v === "1") setOpen(true); else if (v === "0") setOpen(false); } catch { /* ignore */ } }, [id]);
  const toggle = () => setOpen((o) => { const n = !o; try { localStorage.setItem(`aos.sdash.${id}`, n ? "1" : "0"); } catch { /* ignore */ } return n; });
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[0_1px_3px_rgba(20,30,60,.06)]">
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: tint }}>
        <button type="button" onClick={toggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-white text-[16px] shadow-sm" style={{ color: ink }}>{icon}</span>
          <div className="min-w-0">
            <div className="text-[14px] font-extrabold leading-tight" style={{ color: ink }}>{title}</div>
            {sub && <div className="truncate text-[11px]" style={{ color: ink, opacity: 0.72 }}>{sub}</div>}
          </div>
        </button>
        {badge != null && <span className="flex-none rounded-full bg-white px-2 py-0.5 text-[10.5px] font-extrabold shadow-sm" style={{ color: ink }}>{badge}</span>}
        {action}
        <button type="button" onClick={toggle} aria-label={open ? "Collapse" : "Expand"} className="flex-none text-[13px] font-bold" style={{ color: ink }}>{open ? "▴" : "▾"}</button>
      </div>
      {open && <div className="p-4 pt-3">{children}</div>}
    </div>
  );
}

// Small uppercase group label to break the page into sections.
function GroupLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 mt-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--ink-3)]">{children}</div>;
}

export function StaffDashApp() {
  const [me, setMe] = useState<Me | null>(null);
  const [venues, setVenues] = useState<{ name: string; address?: string; city?: string }[]>([]);
  const [sessions, setSessions] = useState<RatioSession[] | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [regs, setRegs] = useState<RegSession[] | null>(null);
  const [accidents, setAccidents] = useState<Accident[] | null>(null);
  const [timetableToday, setTimetableToday] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState<Record<string, ClockRecord> | null>(null);
  const [shift, setShift] = useState<MyShift | null>(null);
  // My real assigned camp days (backend), keyed by date, so the shift card shows them.
  const [assignedByDate, setAssignedByDate] = useState<Record<string, MyShift>>({});
  const [coworkers, setCoworkers] = useState<Coworker[]>([]);
  const [profile, setProfile] = useState<WatchKid | null>(null); // watch-list child card
  const [sendOpen, setSendOpen] = useState(false); // SEND slideshow modal
  const [sendIdx, setSendIdx] = useState(0); // which SEND child is showing
  const [, tick] = useState(0); // live worked-time tick
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annRead, setAnnRead] = useState<string[]>([]);
  const [annOpen, setAnnOpen] = useState(false); // is the current announcement expanded
  const { settings } = useSettings();
  const coworkerVis = settings.scheduling?.coworkerVisibility ?? "all";
  const today = todayIso();
  const [date, setDate] = useState(todayIso()); // the day the whole page is showing
  const isToday = date === today;

  const refresh = useCallback(() => {
    apiGet<{ sessions: RatioSession[] }>(`/api/ratios?date=${date}`).then((d) => setSessions(d?.sessions ?? [])).catch((e) => setError(e instanceof Error ? e.message : "Couldn’t load that day"));
    apiGet<RegSession[]>(`/api/registers?date=${date}`).then((r) => setRegs(r ?? [])).catch(() => setRegs([]));
    apiGet<Task[]>("/api/tasks").then((t) => setTasks(t ?? [])).catch(() => {});
    apiGet<Accident[]>("/api/incidents?kind=accident").then((l) => setAccidents(l ?? [])).catch(() => setAccidents([]));
    apiGet<PublishedLite[]>("/api/timetables/published").then((w) => setTimetableToday((w ?? []).some((x) => x.dayList.some((d) => d.iso === date)))).catch(() => {});
    apiGet<{ venues?: { name: string; address?: string; city?: string }[] }>("/api/library").then((l) => setVenues(l.venues ?? [])).catch(() => {});
  }, [date]);
  useEffect(() => { apiGet<Me>("/api/me").then(setMe).catch(() => {}); setClock(loadClock()); setAnnouncements(loadAnnouncements()); setAnnRead(loadRead()); }, []);
  useEffect(() => {
    apiGet<{ requests: { camp?: { listingName: string; location?: string; open: string; close: string; assignedDates?: string[] } | null }[]; pattern: { grid?: Record<string, { from: string; to: string }> } | null }>("/api/availability/mine")
      .then((r) => {
        const grid = r.pattern?.grid ?? {}; const map: Record<string, MyShift> = {};
        for (const req of r.requests || []) { const c = req.camp; if (!c?.assignedDates?.length) continue; for (const d of c.assignedDates) { const g = grid[d]; map[d] = { start: g?.from ?? c.open, end: g?.to ?? c.close, listing: c.listingName, site: c.location }; } }
        setAssignedByDate(map);
      }).catch(() => {});
  }, []);
  useEffect(() => { setSessions(null); setRegs(null); refresh(); }, [refresh]);
  useEffect(() => { setShift(myShiftToday(date) ?? assignedByDate[date] ?? null); setCoworkers(coworkersToday(coworkerVis, date)); }, [date, coworkerVis, assignedByDate]);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(id); }, []);
  useRealtime(["bookings", "blocks", "tasks", "timetables", "registers"], refresh);

  const open = (tasks ?? []).filter((t) => !t.done);
  // "at my site, today" — from the live register: present = in now, expected = due in.
  const childrenIn = (regs ?? []).reduce((n, s) => n + s.counts.present, 0);
  const dueIn = (regs ?? []).reduce((n, s) => n + s.counts.expected, 0);
  const watch: WatchKid[] = (regs ?? []).flatMap((s) => s.attendees
    .filter((a) => a.child && flagsOf(a.child).length > 0)
    .map((a) => ({
      key: `${s.blockId}:${a.ref}`,
      name: a.children[0]?.name ?? "—",
      where: `${s.start}–${s.end} · ${s.listingName}`,
      status: a.attendance?.status === "in" ? "in" : a.attendance?.status === "absent" ? "absent" : "due",
      flags: flagsOf(a.child!),
    } as WatchKid)));
  // Every child in today with a record — feeds the likes/dislikes + permissions cards.
  const kidsToday = (regs ?? []).flatMap((s) => s.attendees.filter((a) => a.child).map((a) => ({ key: `${s.blockId}:${a.ref}`, name: a.children[0]?.name ?? "—", where: `${s.start}–${s.end} · ${s.listingName}`, c: a.child! })));
  const likesKids = kidsToday.filter((k) => k.c.likes || k.c.dislikes);
  const sendKids = kidsToday.filter((k) => k.c.send || k.c.sendPlanId || k.c.sendPlanName).map((k) => ({ ...k, plan: k.c.sendPlanName || k.c.send || "" }));
  const permKids = kidsToday.filter((k) => k.c.collectionPassword || k.c.emergencyName || k.c.photoConsent != null || k.c.suncreamConsent != null || k.c.walkHomeConsent != null || k.c.firstAidConsent != null);
  const recentAccidents = (accidents ?? []).slice(0, 6);
  const tickTask = (t: Task) => { setTasks((list) => (list ?? []).map((x) => (x.id === t.id ? { ...x, done: true } : x))); void apiPut(`/api/tasks/${t.id}`, { done: true }).catch(() => refresh()); };
  const dayLabel = new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  // Where I'm working today — match the shift's venue name to the library venue for its address.
  const myVenueName = shift?.site || shift?.listing || "";
  const myVenue = venues.find((v) => v.name === myVenueName);
  const myAddress = myVenue ? [myVenue.address, myVenue.city].filter(Boolean).join(", ") : "";

  // ── quick clock in/out ──
  const meId = slug(ME);
  const rec = clock?.[meId];
  const status = rec?.status ?? "out";
  const doIn = () => setClock((c) => clockIn(c || {}, meId, ME, shift?.site));
  const doOut = () => setClock((c) => clockOut(c || {}, meId, ME));
  const doBreak = () => setClock((c) => (status === "break" ? endBreak(c || {}, meId) : startBreak(c || {}, meId)));
  // Clean white cards with a restrained, cohesive accent chip — no loud gradients.
  const STAT = [
    { big: sessions === null ? "…" : String(sessions.length), small: "Sessions", tint: "#eaf1ff", ink: "#1d4ed8", icon: "🎪", sub: "running at your site" },
    { big: regs === null ? "…" : String(childrenIn), small: "Children in", tint: "#e4f5f6", ink: "#0e7490", icon: "🧒", sub: "signed in right now" },
    { big: regs === null ? "…" : String(dueIn), small: "Due in", tint: "#eceafe", ink: "#4f46e5", icon: "📋", sub: "expected across sessions" },
    { big: tasks === null ? "…" : String(open.length), small: "My open tasks", tint: "#f3ecfe", ink: "#7c3aed", icon: "✅", sub: "assigned to you" },
  ];

  // Compact clock in/out control that lives in the hero's top-right.
  const clockWidget = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-extrabold text-white backdrop-blur-sm">
        <span className="h-2 w-2 rounded-full" style={{ background: status === "in" ? "#3ddc84" : status === "break" ? "#f5b81f" : "#cbd5e1" }} />
        {status === "in" ? `Clocked in · ${fmtDurSec(workedMs(rec!))}` : status === "break" ? `On break · ${fmtDurSec(workedMs(rec!))}` : "Clocked out"}
      </span>
      {status === "out" ? (
        <button type="button" onClick={doIn} className="rounded-full bg-white px-3.5 py-1.5 text-[12px] font-extrabold text-[#0b6b3a] shadow-sm transition hover:brightness-95">⏱ Clock in</button>
      ) : (<>
        <button type="button" onClick={doBreak} className="rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-extrabold text-white backdrop-blur-sm transition hover:bg-white/25">{status === "break" ? "End break" : "Break"}</button>
        <button type="button" onClick={doOut} className="rounded-full bg-white px-3.5 py-1.5 text-[12px] font-extrabold text-[#c0362c] shadow-sm transition hover:brightness-95">Clock out</button>
      </>)}
    </div>
  );

  // Retention + on/off come from Setup → Announcements. Show unread notices from
  // the last N days, newest/most-important first, one at a time.
  const annCfg = settings.announcements;
  const annEnabled = annCfg?.enabled ?? true;
  const sinceIso = addDaysIso(today, -Math.max(1, annCfg?.dashboardDays ?? 1));
  const recentUnread = !annEnabled ? [] : [...announcements]
    .filter((a) => a.date >= sinceIso && !annRead.includes(a.id))
    .sort((a, b) => (Number(!!b.pinned) - Number(!!a.pinned)) || (Number(!!b.important) - Number(!!a.important)) || b.date.localeCompare(a.date));
  const curAnn = recentUnread[0] ?? null;
  const annDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const markAnnRead = (id: string) => { const next = Array.from(new Set([...annRead, id])); setAnnRead(next); saveRead(next); setAnnOpen(false); };

  return (
    <div className="text-[var(--ink)]">
      <PageHero
        icon="👋"
        title={greeting(me?.name)}
        lede={`${dayLabel}${me?.tenantName ? ` · ${me.tenantName}` : ""} — your shifts, registers and tasks.`}
        actions={clockWidget}
      />

      {error && <div className="mb-3 text-[12.5px] font-bold text-[var(--red,#e21d27)]">{error}</div>}

      {/* Date navigator — the whole page follows this date */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-0.5 rounded-xl border border-[var(--line)] bg-white p-1 shadow-sm">
          <button type="button" onClick={() => setDate(addDaysIso(date, -1))} aria-label="Previous day" className="grid h-7 w-7 place-items-center rounded-lg text-[16px] font-bold text-[var(--ink-2)] transition hover:bg-[var(--panel)]">‹</button>
          <label className="relative flex cursor-pointer items-center gap-1.5 px-2 text-[12.5px] font-bold text-[var(--ink)]">
            <span>📅 {new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}{isToday ? " · Today" : ""}</span>
            <input type="date" value={date} onChange={(e) => { if (e.target.value) setDate(e.target.value); }} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Pick a date" />
          </label>
          <button type="button" onClick={() => setDate(addDaysIso(date, 1))} aria-label="Next day" className="grid h-7 w-7 place-items-center rounded-lg text-[16px] font-bold text-[var(--ink-2)] transition hover:bg-[var(--panel)]">›</button>
        </div>
        {!isToday && <button type="button" onClick={() => setDate(today)} className="rounded-xl border border-[var(--line)] bg-white px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f] shadow-sm transition hover:bg-[var(--panel)]">Jump to today</button>}
        <span className="text-[11.5px] text-[var(--ink-3)]">Everything below is for this date.</span>
      </div>

      {/* Staff announcements — newest unread from the last 24h. Slim one-liner on
          landing; click to expand the full message + actions. */}
      {curAnn && (
        annOpen ? (
          <div className="mb-3 overflow-hidden rounded-2xl border border-[#e3ebff] bg-gradient-to-br from-[#f4f8ff] to-white shadow-[0_1px_3px_rgba(20,30,60,.06)]">
            <div className="flex items-center gap-2 px-4 pt-3.5">
              <span className="grid h-8 w-8 flex-none place-items-center rounded-xl bg-[#1d3a8f] text-[15px]">📣</span>
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-3)]">Staff announcement</div>
              {recentUnread.length > 1 && <span className="rounded-full bg-[#e21d27] px-2 py-0.5 text-[10px] font-black text-white">{recentUnread.length} new</span>}
              <Link href="/staff/announcements" className="ml-auto text-[11.5px] font-bold text-[#1d3a8f] hover:underline">View all ›</Link>
            </div>
            <div className="px-4 pb-3.5 pt-2.5">
              <div className="flex items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: curAnn.important ? "#e21d27" : "#1d3a8f" }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {curAnn.pinned && <span className="flex-none text-[10px]">📌</span>}
                    <span className="text-[15px] font-bold tracking-[-0.01em] text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{curAnn.title}</span>
                    {curAnn.important && <span className="flex-none rounded-full bg-[#fdecec] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#c0362c]">Important</span>}
                  </div>
                  <div className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-[var(--ink-2)]">{curAnn.body}</div>
                  <div className="mt-1.5 text-[10.5px] font-semibold text-[var(--ink-3)]">{curAnn.author}{curAnn.role ? ` · ${curAnn.role}` : ""} · {annDate(curAnn.date)}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button type="button" onClick={() => setAnnOpen(false)} className="rounded-full bg-[#1d3a8f] px-3.5 py-1.5 text-[12px] font-extrabold text-white transition hover:brightness-110">Close</button>
                <button type="button" onClick={() => markAnnRead(curAnn.id)} className="rounded-full border border-[var(--line)] bg-white px-3.5 py-1.5 text-[12px] font-bold text-[var(--ink-2)] transition hover:bg-[var(--panel)]">✓ Mark as read</button>
                <Link href="/staff/announcements" className="ml-auto text-[11.5px] font-bold text-[#1d3a8f] hover:underline">View all announcements ›</Link>
              </div>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setAnnOpen(true)} className="mb-3 flex w-full items-center gap-2.5 rounded-2xl border border-[#e3ebff] bg-gradient-to-br from-[#f4f8ff] to-white px-3.5 py-2.5 text-left shadow-[0_1px_3px_rgba(20,30,60,.06)] transition hover:border-[#c9d6f5]">
            <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-[#1d3a8f] text-[13px]">📣</span>
            <span className="h-2 w-2 flex-none rounded-full" style={{ background: curAnn.important ? "#e21d27" : "#1d3a8f" }} />
            <span className="flex-none text-[13px] font-bold tracking-[-0.01em] text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{curAnn.title}</span>
            <span className="hidden min-w-0 truncate text-[12px] text-[var(--ink-3)] sm:inline">— {curAnn.body}</span>
            <span className="ml-auto flex flex-none items-center gap-2">
              <span className="hidden text-[11px] font-semibold text-[var(--ink-3)] md:inline">{curAnn.author}</span>
              {recentUnread.length > 1 && <span className="rounded-full bg-[#e21d27] px-1.5 py-0.5 text-[9px] font-black text-white">{recentUnread.length}</span>}
              <span className="text-[11.5px] font-bold text-[#1d3a8f]">Open ›</span>
            </span>
          </button>
        )
      )}

      {/* My shift + at-a-glance & sessions */}
      <div className="mb-3 grid items-start gap-3 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-[0_14px_34px_-16px_rgba(29,58,143,.6)]" style={{ background: "linear-gradient(125deg,#16306e 0%,#2f5bc4 55%,#3f78d8 100%)" }}>
          <div className="relative flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/75">🗓 My shift</div>
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10.5px] font-extrabold backdrop-blur-sm">{shift ? "On rota" : "Day off"}</span>
          </div>
          {shift ? (<>
            <div className="relative mt-2 text-[30px] font-extrabold leading-none tracking-[-0.02em]" style={{ fontFamily: "var(--ff-display)" }}>{to12(shift.start)} – {to12(shift.end)}</div>
            {shift.role && <div className="relative mt-2 inline-block rounded-full bg-white/15 px-2.5 py-0.5 text-[12px] font-bold backdrop-blur-sm">{shift.role}</div>}
            {myVenueName && (
              <div className="relative mt-3 flex items-start gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm">
                <span className="text-[14px] leading-none">📍</span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-bold text-white">{myVenueName}</div>
                  <div className="text-[11.5px] text-white/75">{myAddress || "Address on the register"}</div>
                </div>
              </div>
            )}
          </>) : (<>
            <div className="relative mt-2 text-[18px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{isToday ? "You’re not on the rota today" : "No shift this day"}</div>
            <div className="relative mt-1 text-[13px] text-white/75">{isToday ? "Enjoy your day off 🌿" : "You’re not on the rota for this date."}</div>
          </>)}
          {coworkers.length > 0 && (
            <div className="relative mt-3 border-t border-white/15 pt-3">
              <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-white/70">Working with you</div>
              <div className="flex flex-col gap-2">
                {coworkers.slice(0, 6).map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-white/20 text-[9.5px] font-extrabold text-white">{initials(c.name)}</span>
                    <span className="text-[12.5px] font-bold text-white">{c.name}</span>
                    {c.role && <span className="truncate text-[11px] text-white/70">{c.role}</span>}
                    <span className="ml-auto flex-none tabular-nums text-[12px] font-semibold text-white/90">{to12(c.start)}–{to12(c.end)}</span>
                  </div>
                ))}
                {coworkers.length > 6 && <div className="pl-8 text-[11px] text-white/70">+{coworkers.length - 6} more on the rota</div>}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-[0_1px_3px_rgba(20,30,60,.06)]">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-3)]">At a glance</div>
          <div className="grid grid-cols-2 gap-2.5">
            {STAT.map((t) => (
              <div key={t.small} className="flex items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-lg text-[15px]" style={{ background: t.tint, color: t.ink }}>{t.icon}</span>
                <div className="min-w-0">
                  <div className="text-[21px] font-extrabold leading-none tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{t.big}</div>
                  <div className="truncate text-[9.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t.small}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <Section id="sessions" icon="🗓️" title="Sessions" sub="Registers &amp; ratios" tint="#eaf1ff" ink="#1d4ed8" defaultOpen action={<span className="flex flex-none gap-2">{timetableToday && <Link href="/staff/timetable"><Button sm>Day plan</Button></Link>}<Link href="/staff/registers"><Button sm variant="primary">Open registers</Button></Link></span>}>
          {sessions === null ? <div className="py-4 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
            : sessions.length === 0 ? <div className="py-4 text-center text-[12.5px] text-[var(--ink-3)]">Nothing scheduled.</div>
              : sessions.map((s) => (
                <div key={s.blockId} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-dashed border-[var(--line)] py-2 last:border-b-0">
                  <span className="text-[12px] font-bold text-[var(--ink-3)]">{s.start}–{s.end}</span>
                  <span className="text-[13px] font-extrabold">{s.listingName}</span>
                  <span className="text-[12px] text-[var(--ink-3)]">{s.blockName}</span>
                  <span className="ml-auto flex items-center gap-1.5 text-[11.5px]">
                    <Badge tone={{ bg: "var(--brand-soft)", fg: "var(--brand-strong)" }}>{s.totalChildren} children</Badge>
                    {s.sendCount > 0 && <Badge tone={{ bg: "#f3e8ff", fg: "#7c3aed" }}>{s.sendCount} SEND</Badge>}
                    <Badge tone={s.met ? { bg: "#eaf0fc", fg: "#1d3a8f" } : { bg: "#fdf3d8", fg: "#9a5a00" }}>{s.staffAssigned}/{s.requiredStaff} staff</Badge>
                  </span>
                </div>
              ))}
        </Section>
        </div>
      </div>

      {/* ── Children today ───────────────────────────────────────────── */}
      <GroupLabel>Children</GroupLabel>

      {/* SEND at a glance — click to open the slideshow */}
      <button type="button" onClick={() => { setSendIdx(0); setSendOpen(true); }} className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-[#e7e1fb] bg-white p-4 text-left shadow-[0_1px_3px_rgba(20,30,60,.06)] transition hover:bg-[#faf9ff]">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-[#efe9fe] text-[18px]">🧩</span>
        <div>
          <div className="text-[22px] font-extrabold leading-none tabular-nums text-[#6d28d9]" style={{ fontFamily: "var(--ff-display)" }}>{regs === null ? "…" : sendKids.length}</div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--ink-3)]">children marked SEND</div>
        </div>
        <span className="ml-auto flex-none rounded-full bg-[#6d28d9] px-3.5 py-1.5 text-[12px] font-extrabold text-white transition hover:brightness-110">View plans ›</span>
      </button>

      <div className="mb-3 grid items-start gap-3 lg:grid-cols-2">
      <Section id="watch" icon="⚠️" title="Watch list" sub="Tap a child for their care card" tint="#fdecec" ink="#c0362c" badge={regs !== null && watch.length > 0 ? watch.length : undefined} defaultOpen>
          {regs === null ? <div className="py-3 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
            : watch.length === 0 ? <div className="py-3 text-center text-[12.5px] text-[var(--ink-3)]">No flagged children in. 👍</div>
              : watch.map((k) => (
                <button type="button" key={k.key} onClick={() => setProfile(k)} title="View care card" className="-mx-1 flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border-b border-dashed border-[var(--line)] px-1 py-2 text-left transition-colors last:border-b-0 hover:bg-[var(--panel)]">
                  <span className="text-[13px] font-extrabold">{k.name}</span>
                  <span className={"rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase " + (k.status === "in" ? "bg-[#d7f5e3] text-[#0f7a43]" : k.status === "absent" ? "bg-[#eef1f6] text-[#64748b]" : "bg-[#fef3d8] text-[#9a5a00]")}>{k.status === "in" ? "In" : k.status === "absent" ? "Absent" : "Due"}</span>
                  <span className="flex flex-wrap gap-1">
                    {k.flags.map((f, i) => (
                      <span key={i} className="group/flag relative inline-block" aria-label={f.detail ? `${f.k}: ${f.detail}` : f.k}>
                        <span className="cursor-help rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: f.bg, color: f.fg }}>{f.k}</span>
                        <span className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-max max-w-[260px] rounded-lg bg-[#111634] px-2.5 py-1.5 text-[11px] font-semibold leading-snug text-white shadow-[0_8px_24px_-6px_rgba(0,0,0,.5)] group-hover/flag:block">
                          <b className="text-white">{f.k}</b>{f.detail ? <span className="font-normal text-white/85"> — {f.detail}</span> : <span className="font-normal text-white/70"> — no detail recorded</span>}
                        </span>
                      </span>
                    ))}
                  </span>
                  <span className="ml-auto flex items-center gap-1.5 text-[11px] text-[var(--ink-3)]">{k.where}<span className="text-[var(--brand,#1d3a8f)]">›</span></span>
                </button>
              ))}
      </Section>

      <Section id="likes" icon="😊" title="Likes &amp; dislikes" sub="Little things that make their day" tint="#e9f7ef" ink="#0f7a43" badge={regs !== null && likesKids.length > 0 ? likesKids.length : undefined} defaultOpen={false}>
            {regs === null ? <div className="py-3 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
              : likesKids.length === 0 ? <div className="py-3 text-center text-[12.5px] text-[var(--ink-3)]">Nothing noted for these children.</div>
                : likesKids.slice(0, 8).map((k) => (
                  <div key={k.key} className="border-b border-dashed border-[var(--line)] py-2 last:border-b-0">
                    <div className="text-[12.5px] font-extrabold">{k.name}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {k.c.likes && <span className="rounded-full bg-[#e9f7ef] px-2 py-0.5 text-[11px] font-semibold text-[#0f7a43]">👍 {k.c.likes}</span>}
                      {k.c.dislikes && <span className="rounded-full bg-[#fdecec] px-2 py-0.5 text-[11px] font-semibold text-[#c0362c]">👎 {k.c.dislikes}</span>}
                    </div>
                  </div>
                ))}
      </Section>

      <Section id="perm" icon="🔑" title="Collection &amp; permissions" sub="Passwords, contacts &amp; consents" tint="#eef0fe" ink="#4f46e5" badge={regs !== null && permKids.length > 0 ? permKids.length : undefined} defaultOpen={false}>
            {regs === null ? <div className="py-3 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
              : permKids.length === 0 ? <div className="py-3 text-center text-[12.5px] text-[var(--ink-3)]">No collection notes.</div>
                : permKids.slice(0, 8).map((k) => (
                  <div key={k.key} className="border-b border-dashed border-[var(--line)] py-2 last:border-b-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-extrabold">{k.name}</span>
                      {k.c.collectionPassword && <span className="rounded-full bg-[#eef0fe] px-2 py-0.5 font-mono text-[11px] font-bold tracking-wide text-[#4f46e5]">🔑 {k.c.collectionPassword}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--ink-3)]">
                      {k.c.emergencyName && <span>📞 <b className="text-[var(--ink-2)]">{k.c.emergencyName}</b>{k.c.emergencyPhone ? ` · ${k.c.emergencyPhone}` : ""}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {([["📷 Photos", k.c.photoConsent], ["☀️ Suncream", k.c.suncreamConsent], ["🚶 Walk home", k.c.walkHomeConsent], ["⛑ First aid", k.c.firstAidConsent]] as const)
                        .filter(([, v]) => v != null)
                        .map(([label, v]) => (
                          <span key={label} className={"rounded-full px-2 py-0.5 text-[10px] font-bold " + (v ? "bg-[#e9f7ef] text-[#0f7a43]" : "bg-[#f1f3f7] text-[#64748b] line-through")}>{label}</span>
                        ))}
                    </div>
                  </div>
                ))}
      </Section>

      <Section id="accidents" icon="🩹" title="Recent accidents" sub="Latest logged incidents" tint="#fef3e2" ink="#b45309" badge={accidents !== null && recentAccidents.length > 0 ? recentAccidents.length : undefined} defaultOpen={false}>
        {accidents === null ? <div className="py-3 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
          : recentAccidents.length === 0 ? <div className="py-3 text-center text-[12.5px] text-[var(--ink-3)]">No accidents logged. 🎉</div>
            : recentAccidents.map((a) => (
              <div key={a.id} className="border-b border-dashed border-[var(--line)] py-2 last:border-b-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-extrabold">{a.childName}</span>
                  <span className="flex items-center gap-1.5">
                    {a.severity && <span className={"rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase " + (a.severity === "serious" || a.severity === "major" ? "bg-[#fdecec] text-[#c0362c]" : "bg-[#fef3d8] text-[#9a5a00]")}>{a.severity}</span>}
                    <span className="text-[11px] text-[var(--ink-3)]">{a.date}{a.time ? ` · ${a.time}` : ""}</span>
                  </span>
                </div>
                <div className="mt-0.5 text-[11.5px] leading-snug text-[var(--ink-2)]">{a.injury ? <b>{a.injury}. </b> : ""}{a.description}</div>
              </div>
            ))}
      </Section>
      </div>

      {/* ── My work ──────────────────────────────────────────────────── */}
      <GroupLabel>My work</GroupLabel>
      <div className="mb-3">
      <Section id="tasks" icon="✅" title="Team tasks" sub="Everyone&rsquo;s to-dos" tint="#e4f5f6" ink="#0e7490" badge={tasks !== null && open.length > 0 ? open.length : undefined} defaultOpen action={<Link href="/staff/tasks"><Button sm>All tasks</Button></Link>}>
          {tasks === null ? <div className="py-3 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
            : open.length === 0 ? <div className="py-3 text-center text-[12.5px] text-[var(--ink-3)]">All done — nothing open. 🎉</div>
              : open.slice(0, 6).map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 border-b border-dashed border-[var(--line)] py-1.5 last:border-b-0">
                  <button type="button" onClick={() => tickTask(t)} aria-label={`Mark "${t.title}" done`} className="h-[18px] w-[18px] flex-none cursor-pointer rounded-md border-[1.5px] border-[var(--line)] hover:border-[var(--brand)]" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px]">{t.title}</span>
                  {t.priority === "high" && <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "#bb1620" }}>high</Badge>}
                  {t.dueDate && <span className="text-[11px] text-[var(--ink-3)]">{t.dueDate}</span>}
                </div>
              ))}
      </Section>
      </div>

      {/* SEND — a slideshow, one child per slide, with their support plan */}
      {sendOpen && (() => {
        const n = sendKids.length;
        const idx = Math.min(sendIdx, Math.max(0, n - 1));
        const k = n > 0 ? sendKids[idx] : null;
        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onClick={() => setSendOpen(false)}>
            <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,.4)]" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3 px-5 py-4 text-white" style={{ backgroundImage: `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), linear-gradient(120deg,#5b21b6,#8b5cf6)`, backgroundSize: "18px 18px, cover", backgroundRepeat: "repeat, no-repeat" }}>
                <div>
                  <div className="text-[17px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>🧩 SEND · {n}</div>
                  <div className="mt-1 text-[12px] text-white/85">Swipe through each child · open their uploaded plan</div>
                </div>
                <button type="button" onClick={() => setSendOpen(false)} aria-label="Close" className="flex-none text-[18px] leading-none text-white/80 hover:text-white">✕</button>
              </div>

              {n === 0 || !k ? (
                <div className="p-6 text-center text-[12.5px] text-[var(--ink-3)]">No children marked SEND in. 👍</div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="min-h-0 flex-1 overflow-y-auto p-5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-[#f3e8ff] text-[13px] font-extrabold text-[#7c3aed]">{initials(k.name)}</span>
                      <div className="min-w-0">
                        <div className="text-[17px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{k.name}</div>
                        <div className="text-[12px] text-[var(--ink-3)]">{k.where}</div>
                      </div>
                      <span className="ml-auto flex-none rounded-full bg-[var(--panel)] px-2.5 py-1 text-[11px] font-bold tabular-nums text-[var(--ink-2)]">{idx + 1} / {n}</span>
                    </div>

                    {/* The uploaded support-plan DOCUMENT — an EHCP/PDF the parent or provider added */}
                    <div className="mt-4 rounded-xl border border-[var(--line)] p-3.5">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-[#efe9fe] text-[18px]">📄</span>
                        <div className="min-w-0">
                          <div className="text-[13px] font-extrabold text-[var(--ink)]">{k.c.sendPlanName || "SEND support plan"}</div>
                          <div className="text-[11px] text-[var(--ink-3)]">{k.c.sendPlanId ? "Uploaded document" : "No document uploaded yet"}</div>
                        </div>
                        {k.c.sendPlanId && <button type="button" onClick={() => openFile(`/api/my/files/${k.c.sendPlanId}`).catch((e) => alert(e instanceof Error ? e.message : "Couldn’t open the plan."))} className="ml-auto flex-none rounded-lg bg-[#6d28d9] px-3.5 py-2 text-[12px] font-extrabold text-white transition hover:brightness-110">📄 Open plan ›</button>}
                      </div>
                      {!k.c.sendPlanId && <p className="mt-2 text-[11.5px] leading-[1.5] text-[var(--ink-3)]">No plan file attached for {k.name.split(" ")[0]} yet. When the parent or provider uploads an EHCP / support plan, it opens here as a PDF.</p>}
                    </div>

                    {/* SEND notes from the register (context, not the plan itself) */}
                    {k.c.send && (
                      <div className="mt-2.5 rounded-xl border border-[#e7e1fb] bg-[#faf9ff] p-3.5">
                        <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6d28d9]">SEND note</div>
                        <p className="mt-1 text-[13px] leading-[1.55] text-[var(--ink-2)]">{k.c.send}</p>
                      </div>
                    )}
                    {k.c.careNotes && (
                      <div className="mt-2.5 rounded-xl border border-[var(--line)] p-3.5">
                        <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ink-3)]">Care notes</div>
                        <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--ink-2)]">{k.c.careNotes}</p>
                      </div>
                    )}
                    {(k.c.likes || k.c.dislikes) && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {k.c.likes && <span className="rounded-full bg-[#e9f7ef] px-2.5 py-1 text-[11.5px] font-semibold text-[#0f7a43]">👍 {k.c.likes}</span>}
                        {k.c.dislikes && <span className="rounded-full bg-[#fdecec] px-2.5 py-1 text-[11.5px] font-semibold text-[#c0362c]">👎 {k.c.dislikes}</span>}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-5 py-3">
                    <button type="button" disabled={idx === 0} onClick={() => setSendIdx((i) => Math.max(0, i - 1))} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] disabled:opacity-40">‹ Prev</button>
                    <div className="flex items-center gap-1.5">
                      {sendKids.map((_, i) => <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: i === idx ? "#6d28d9" : "var(--line)" }} />)}
                    </div>
                    <button type="button" disabled={idx >= n - 1} onClick={() => setSendIdx((i) => Math.min(n - 1, i + 1))} className="rounded-lg bg-[#6d28d9] px-3.5 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-40">Next ›</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Care card — the flagged child's needs at a glance */}
      {profile && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onClick={() => setProfile(null)}>
          <div className="w-full max-w-[440px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,.4)]" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 text-white" style={{ backgroundImage: `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), linear-gradient(120deg,#16306e,#3f78d8)`, backgroundSize: "18px 18px, cover", backgroundRepeat: "repeat, no-repeat" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[19px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{profile.name}</div>
                  <div className="mt-1 text-[12px] text-white/85">{profile.where}</div>
                </div>
                <button type="button" onClick={() => setProfile(null)} aria-label="Close" className="flex-none text-[18px] leading-none text-white/80 hover:text-white">✕</button>
              </div>
              <span className="mt-2.5 inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide" style={profile.status === "in" ? { background: "#d7f5e3", color: "#0f7a43" } : profile.status === "absent" ? { background: "#eef1f6", color: "#334155" } : { background: "#fef3d8", color: "#9a5a00" }}>{profile.status === "in" ? "In now" : profile.status === "absent" ? "Absent" : "Due in"}</span>
            </div>
            <div className="p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-3)]">Care needs</div>
              <div className="mt-2 flex flex-col gap-2">
                {profile.flags.map((f, i) => (
                  <div key={i} className="rounded-xl border border-[var(--line)] p-3">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: f.bg, color: f.fg }}>{f.k}</span>
                    <p className="mt-1.5 text-[12.5px] leading-[1.5] text-[var(--ink-2)]">{f.detail || "No detail recorded — check the register or ask your lead."}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="text-[11.5px] text-[var(--ink-3)]">Open the register for the full care plan.</p>
                <Link href="/staff/registers" onClick={() => setProfile(null)}><Button sm variant="primary">Open register</Button></Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
