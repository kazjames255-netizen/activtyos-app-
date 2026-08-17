"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { MilestonesApp } from "@/features/milestones/MilestonesApp";
import { Button } from "@/components/ui";
import { TourLauncher } from "@/features/common/TourLauncher";

// ─────────────────────────────────────────────────────────────────────────
// Task Manager — the operator to-do system. A task hangs off a real record
// (camp / booking / compliance / venue) — that's what makes it ActivityOS
// Tasks, not a generic list, and drives the P2 auto-spawn engine.
// Views: My Tasks (grouped list) · Board (kanban) · Calendar · Team.
// ─────────────────────────────────────────────────────────────────────────

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;
const HERO = "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)";
const BLUE = "#1d3a8f";

type Prio = "urgent" | "high" | "med" | "low";
type Status = "backlog" | "todo" | "prog" | "done";
type LinkKind = "child" | "parent" | "camp" | "book" | "comp" | "venue" | "list" | "gen";
interface TaskLink { k: LinkKind; v: string; href?: string }
interface Sub { t: string; done: boolean }
interface Comment { who: string; body: string; when: string }
interface Att { name: string }
interface Task {
  id: string; t: string; who?: string; prio?: Prio; due?: string | null; time?: string | null; status?: Status;
  link?: TaskLink | null; co?: string; cat?: string; labels?: string[]; subs?: Sub[]; comments?: Comment[]; atts?: Att[];
  spawn?: boolean; archived?: boolean; createdByName?: string; calEventId?: string | null;
}

const PRIO: Record<Prio, { label: string; dot: string }> = {
  urgent: { label: "Urgent", dot: "#ef4444" }, high: { label: "High", dot: "#f59e0b" },
  med: { label: "Medium", dot: "#3b82f6" }, low: { label: "Low", dot: "#8a93a6" },
};
const PRANK: Record<Prio, number> = { urgent: 0, high: 1, med: 2, low: 3 };
// Sort: most urgent first, then soonest due (null due sinks last).
const byPrioDue = (a: Task, b: Task) => (PRANK[a.prio ?? "med"] - PRANK[b.prio ?? "med"]) || `${a.due ?? "9999-99"}`.localeCompare(`${b.due ?? "9999-99"}`);
const COLS: { k: Status; label: string; color: string }[] = [
  { k: "backlog", label: "Backlog", color: "#8a93a6" }, { k: "todo", label: "To do", color: "#3b82f6" },
  { k: "prog", label: "In progress", color: "#f59e0b" }, { k: "done", label: "Done", color: "#16b364" },
];
const STATUS_C: Record<Status, string> = { backlog: "#8a93a6", todo: "#3b82f6", prog: "#f59e0b", done: "#16b364" };
const LINK: Record<LinkKind, { label: string; bg: string; fg: string; icon: string }> = {
  child: { label: "Child", bg: "#fff1f5", fg: "#be2063", icon: "🧒" }, parent: { label: "Parent", bg: "#eef4fd", fg: "#1d3a8f", icon: "👤" },
  book: { label: "Booking", bg: "#efeaff", fg: "#5b3fd8", icon: "🎫" }, list: { label: "Listing", bg: "#e6f0ff", fg: "#2f5fd8", icon: "📋" },
  venue: { label: "Location", bg: "#e5f6ec", fg: "#0f8a4a", icon: "📍" }, comp: { label: "Compliance", bg: "#fde2e4", fg: "#c02636", icon: "🛡️" },
  camp: { label: "Camp", bg: "#e6f4fd", fg: "#1f78ab", icon: "⛺" }, gen: { label: "Category", bg: "#f1f2f6", fg: "#5b6478", icon: "🏷️" },
};
// The types the picker offers (old camp/comp still render on legacy tasks).
const LINK_TYPES: LinkKind[] = ["child", "parent", "book", "list", "venue", "gen"];
interface LinkOpts { portal: string; bookOpts: { ref: string; v: string; sub?: string }[]; childOpts: { name: string; ref: string; sub?: string }[]; parentOpts: { name: string; ref: string; sub?: string }[]; listings: { id: string; title: string; location?: string }[]; locations: string[]; cats: string[] }

// A link chip — deep-links straight to the record when it has an href, and shows
// a ↗ so it's obviously a link ("go to booking", not just a label).
function LinkChip({ link, size = "sm" }: { link: TaskLink; size?: "sm" | "xs" }) {
  const router = useRouter();
  const m = LINK[link.k] ?? LINK.gen;
  const cls = `inline-flex flex-none items-center gap-1 rounded-full font-bold ${size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"}`;
  const label = <><span className="opacity-70">{m.label}</span> {link.v}</>;
  if (link.href) return <button type="button" title={`Open ${m.label.toLowerCase()}`} onClick={(e) => { e.stopPropagation(); router.push(link.href!); }} className={`${cls} underline decoration-transparent hover:decoration-current`} style={{ background: m.bg, color: m.fg }}>{label} <span className="font-black">↗</span></button>;
  return <span className={cls} style={{ background: m.bg, color: m.fg }}>{label}</span>;
}
const AV = ["#e0e7ff", "#efe0ff", "#dcfce7", "#fff3d6", "#ffe4ef", "#e5f6f8", "#ffe9d6"];
const avBg = (n: string) => AV[[...(n || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
const initials = (n: string) => (n || "?").split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase();

const todayIso = () => { const t = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`; };
const shiftIso = (iso: string, by: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + by); return d.toISOString().slice(0, 10); };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
// A colour-coded relative due label.
function dueLabel(iso: string | null | undefined, today: string): { text: string; color: string } | null {
  if (!iso) return null;
  const d = daysBetween(today, iso);
  if (d < 0) return { text: d === -1 ? "Yesterday" : `${-d}d ago`, color: "#c02636" };
  if (d === 0) return { text: "Today", color: "#b45309" };
  if (d === 1) return { text: "Tomorrow", color: "#8a86a3" };
  return { text: `In ${d}d`, color: "#8a86a3" };
}
// Compose the calendar-event notes from a task so its labels, subtasks and
// comments travel across to the Events calendar (max 1900 chars — the event
// notes cap is 2000).
function calEventNotes(t: Task): string {
  const lines: string[] = [t.link?.v ? `Task · ${t.link.v}` : "Task"];
  if (t.who) lines.push(`Assignee: ${t.who}`);
  if (t.labels?.length) lines.push(`Labels: ${t.labels.join(", ")}`);
  if (t.subs?.length) lines.push("Subtasks:\n" + t.subs.map((s) => `  [${s.done ? "x" : " "}] ${s.t}`).join("\n"));
  if (t.comments?.length) lines.push("Comments:\n" + t.comments.map((c) => `  ${c.who}: ${c.body}`).join("\n"));
  return lines.join("\n").slice(0, 1900);
}
// The deadline as a real date (+ optional time), prefixed with the relative word
// so "Tomorrow · Fri 1 Aug 3:30pm" reads at a glance. Null when there's no due.
function dueFull(t: Task, today: string): { text: string; color: string } | null {
  const dl = dueLabel(t.due, today);
  if (!dl || !t.due) return null;
  return { text: `${dl.text} · ${fmtDay(t.due)}${t.time ? ` ${t.time}` : ""}`, color: dl.color };
}

// Natural-language quick-add: "Brief coaches tomorrow @Jess !high #Riverside".
function parseQuick(raw: string, today: string): { t: string; who?: string; prio?: Prio; link?: TaskLink; due?: string | null } {
  let text = ` ${raw} `;
  let who: string | undefined; let prio: Prio | undefined; let link: TaskLink | undefined; let due: string | null | undefined;
  const at = text.match(/\s@([^\s@!#]+)/); if (at) { who = at[1]; text = text.replace(at[0], " "); }
  const bang = text.match(/\s!(urgent|high|med|low)\b/i); if (bang) { prio = bang[1].toLowerCase() as Prio; text = text.replace(bang[0], " "); }
  const hash = text.match(/\s#([^\s@!#]+)/); if (hash) { link = { k: "camp", v: hash[1] }; text = text.replace(hash[0], " "); }
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  if (/\btoday\b/i.test(text)) { due = today; text = text.replace(/\btoday\b/i, " "); }
  else if (/\btomorrow\b/i.test(text)) { due = shiftIso(today, 1); text = text.replace(/\btomorrow\b/i, " "); }
  else { for (let i = 0; i < 7; i++) { const re = new RegExp(`\\b${days[i]}\\b`, "i"); if (re.test(text)) { const cur = new Date(`${today}T00:00:00Z`).getUTCDay(); let add = (i - cur + 7) % 7; if (add === 0) add = 7; due = shiftIso(today, add); text = text.replace(re, " "); break; } } }
  return { t: text.replace(/\s+/g, " ").trim(), who, prio, link, due };
}

export function TasksApp() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [me, setMe] = useState("");
  const [tab, setTab] = useState<"mine" | "team" | "board" | "cal" | "archive" | "milestones">("mine");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [flash, setFlash] = useState(false);
  const [qa, setQa] = useState("");
  const [qaDue, setQaDue] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [teamSort, setTeamSort] = useState<"up" | "down">("up");
  const [calAnchor, setCalAnchor] = useState(() => todayIso());
  const [calView, setCalView] = useState<"day" | "week" | "month">("month");
  const [drag, setDrag] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [prioFilter, setPrioFilter] = useState<Prio | "">("");
  const [dueScope, setDueScope] = useState(""); // "" (any) | "today" | "tomorrow" | an ISO date
  const [kpiFilter, setKpiFilter] = useState<"" | "open" | "overdue" | "week" | "unassigned">("");
  const [listings, setListings] = useState<{ id: string; title: string; location?: string }[]>([]);
  const [bookings, setBookings] = useState<{ ref: string; booker?: string; email?: string; phone?: string; postcode?: string; child?: string; kids?: { name: string; age?: number }[]; listing?: string; pass?: string; dates?: string }[]>([]);
  const portal = usePathname()?.split("/")[1] || "freelancer";
  const today = todayIso();
  const manager = role === "company" || role === "franchise";
  const isFreelancer = role === "freelancer";
  const showMilestones = role === "company" || role === "franchise";
  const onMilestones = tab === "milestones";
  // A solo freelancer has no team — assignment is meaningless, so every task is
  // theirs and the assignee UI is hidden.
  const noAssignee = isFreelancer;

  const refresh = useCallback(() => {
    apiGet<Task[]>("/api/tasks").then((t) => { setTasks(t); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string; name?: string; email?: string }>("/api/me").then((m) => { setRole(m.role); setMe(m.name || m.email || ""); }).catch(() => {}); }, []);
  useEffect(() => { apiGet<{ id: string; title?: string; name?: string; location?: string }[]>("/api/listings?mine=1").then((l) => setListings(l.map((x) => ({ id: x.id, title: x.title || x.name || "Listing", location: x.location })))).catch(() => {}); }, []);
  useEffect(() => { apiGet<{ ref: string; booker?: string; email?: string; phone?: string; postcode?: string; child?: string; kids?: { name: string; age?: number }[]; listing?: string; pass?: string; dates?: string }[]>("/api/bookings").then((b) => setBookings(b)).catch(() => {}); }, []);
  useRealtime(["tasks"], refresh);

  // Real records to link a task to — each carries a deep-link so the chip jumps
  // straight to it. Child/parent link to that family's booking.
  // Each option carries a `sub` line — the disambiguating detail (a parent's
  // email/phone, a child's age + family, a booking's listing/pass/dates) so the
  // operator can tell "which Sally" before linking.
  const bookOpts = useMemo(() => bookings.map((b) => ({ ref: b.ref, v: `${b.kids?.map((k) => k.name).join(", ") || b.child || "—"} · #${b.ref}`, sub: [b.listing, b.pass, b.dates].filter(Boolean).join(" · ") })), [bookings]);
  const childOpts = useMemo(() => {
    const m = new Map<string, { ref: string; sub: string }>();
    for (const b of bookings) {
      const kids = b.kids?.length ? b.kids : (b.child ? [{ name: b.child, age: undefined }] : []);
      for (const k of kids) if (k.name && !m.has(k.name)) m.set(k.name, { ref: b.ref, sub: [k.age != null ? `age ${k.age}` : null, b.booker ? `parent ${b.booker}` : null, b.listing].filter(Boolean).join(" · ") });
    }
    return [...m.entries()].map(([name, x]) => ({ name, ref: x.ref, sub: x.sub }));
  }, [bookings]);
  // Parents: aggregate across all their bookings — first hit is the most recent
  // (the API returns newest-first), and we collect the distinct listings they've
  // booked on plus contact + postcode so the row is unmistakable.
  const parentOpts = useMemo(() => {
    const m = new Map<string, { ref: string; email?: string; phone?: string; postcode?: string; listings: string[] }>();
    for (const b of bookings) {
      if (!b.booker) continue;
      const cur = m.get(b.booker);
      if (!cur) m.set(b.booker, { ref: b.ref, email: b.email, phone: b.phone, postcode: b.postcode, listings: b.listing ? [b.listing] : [] });
      else { if (b.listing && !cur.listings.includes(b.listing)) cur.listings.push(b.listing); if (!cur.postcode && b.postcode) cur.postcode = b.postcode; }
    }
    return [...m.entries()].map(([name, x]) => ({ name, ref: x.ref, sub: [x.email, x.phone, x.postcode, x.listings.length ? `booked: ${x.listings.slice(0, 3).join(", ")}` : null].filter(Boolean).join(" · ") }));
  }, [bookings]);

  const everything = useMemo(() => tasks ?? [], [tasks]);
  const all = useMemo(() => everything.filter((t) => !t.archived), [everything]);
  const archived = useMemo(() => everything.filter((t) => t.archived), [everything]);
  // For a freelancer every task is "mine"; otherwise match on assignee.
  const mineOf = (t: Task) => noAssignee || (t.who || "").trim().toLowerCase() === me.trim().toLowerCase();
  const team = useMemo(() => [...new Set(all.map((t) => t.who).filter((w): w is string => !!w && w.trim() !== ""))].sort(), [all]);
  const cats = useMemo(() => [...new Set(all.map((t) => t.cat).filter((c): c is string => !!c && c.trim() !== ""))].sort(), [all]);
  const locations = useMemo(() => [...new Set(listings.map((l) => l.location).filter((v): v is string => !!v))].sort(), [listings]);
  const linkOpts: LinkOpts = { portal, bookOpts, childOpts, parentOpts, listings, locations, cats };

  async function create(fields: Partial<Task>, toCal = false) {
    try { const created = await apiPost<Task>("/api/tasks", { status: "todo", prio: "med", ...fields }); if (toCal && created?.due) await syncToCalendar(created); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t add the task"); }
  }
  // Mirror a task onto the Events calendar. First sync creates the event and
  // stamps its id on the task; later syncs UPDATE it (no duplicates), so labels,
  // subtasks and comments added afterwards travel across too.
  async function syncToCalendar(t: Task) {
    if (!t.due) return;
    const payload = { title: t.t, date: t.due, category: "Task", notes: calEventNotes(t), ...(t.time ? { start: t.time, allDay: false } : { allDay: true }) };
    try {
      if (t.calEventId) await api(`/api/calendar-events/${encodeURIComponent(t.calEventId)}`, { method: "PUT", body: JSON.stringify(payload) });
      else { const ev = await apiPost<{ id: string }>("/api/calendar-events", payload); await patch(t.id, { calEventId: ev.id }); }
    } catch { /* the mirror is non-critical — never block the task */ }
  }
  async function unsyncFromCalendar(t: Task) {
    if (t.calEventId) { try { await api(`/api/calendar-events/${encodeURIComponent(t.calEventId)}`, { method: "DELETE" }); } catch { /* already gone */ } }
    patch(t.id, { calEventId: null });
  }
  async function patch(id: string, fields: Partial<Task>) {
    setTasks((ts) => (ts ?? []).map((t) => (t.id === id ? { ...t, ...fields } : t))); // optimistic
    try { await api(`/api/tasks/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(fields) }); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); refresh(); }
  }
  const flashDone = () => { setFlash(true); setTimeout(() => setFlash(false), 1300); };
  const toggleDone = (t: Task) => { const done = t.status !== "done"; patch(t.id, { status: done ? "done" : "todo" }); if (done) flashDone(); };
  // Set a task's status from a dropdown; flash "logged" when it newly becomes Done.
  const setStatus = (t: Task, s: Status) => { patch(t.id, { status: s }); if (s === "done" && t.status !== "done") flashDone(); };
  async function remove(id: string) {
    if (!confirm("Delete this task?")) return;
    setOpenId(null);
    try { await api(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t delete"); }
  }
  function addQuick() {
    if (!qa.trim()) return;
    const p = parseQuick(qa, today);
    if (!p.t) return;
    create({ t: p.t, who: noAssignee ? "" : (p.who ?? ""), prio: p.prio ?? "med", link: p.link ?? null, due: qaDue || p.due || null });
    setQa(""); setQaDue("");
  }

  // KPIs
  const openTasks = all.filter((t) => t.status !== "done");
  const overdue = openTasks.filter((t) => t.due && daysBetween(today, t.due) < 0);
  const dueWeek = openTasks.filter((t) => t.due && daysBetween(today, t.due) >= 0 && daysBetween(today, t.due) <= 6);
  const unassigned = openTasks.filter((t) => !t.who || t.who.trim() === "");
  type KpiKey = "open" | "overdue" | "week" | "unassigned";
  const kpis: [string, number, string, KpiKey][] = [
    ["Open", openTasks.length, "#bfe0ff", "open"], ["Overdue", overdue.length, "#ffb4bd", "overdue"], ["Due this week", dueWeek.length, "#ffd9a6", "week"],
    ...(manager ? [["Unassigned", unassigned.length, "#d6dbe6", "unassigned"] as [string, number, string, KpiKey]] : []),
  ];

  // Combined filters — free-text search + a priority chip + the clicked KPI tile
  // — applied to every view. "My tasks" further narrows to the current user.
  const term = search.trim().toLowerCase();
  const kpiMatch = (t: Task) => kpiFilter === "" ? true
    : kpiFilter === "open" ? t.status !== "done"
    : kpiFilter === "overdue" ? t.status !== "done" && !!t.due && daysBetween(today, t.due) < 0
    : kpiFilter === "week" ? t.status !== "done" && !!t.due && daysBetween(today, t.due) >= 0 && daysBetween(today, t.due) <= 6
    : t.status !== "done" && (!t.who || t.who.trim() === "");
  const searchMatch = (t: Task) => !term || t.t.toLowerCase().includes(term) || (t.who ?? "").toLowerCase().includes(term) || (t.link?.v ?? "").toLowerCase().includes(term) || (t.labels ?? []).some((l) => l.toLowerCase().includes(term));
  const scopeIso = dueScope === "today" ? today : dueScope === "tomorrow" ? shiftIso(today, 1) : dueScope; // keyword → date; else already ISO/""
  const whenMatch = (t: Task) => !dueScope || t.due === scopeIso;
  const base = all.filter((t) => (!prioFilter || t.prio === prioFilter) && kpiMatch(t) && whenMatch(t) && searchMatch(t));
  const filtersActive = !!term || !!prioFilter || !!kpiFilter || !!dueScope;
  const clearFilters = () => { setSearch(""); setPrioFilter(""); setKpiFilter(""); setDueScope(""); };

  const preview = qa.trim() ? parseQuick(qa, today) : null;
  const previewWhoUnknown = preview?.who && !team.some((w) => w.toLowerCase() === preview.who!.toLowerCase());

  if (!tasks) return <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5" style={LIGHT_PALETTE}><div className="py-16 text-center text-[12.5px] text-[var(--ink-3)]">Loading the task manager…</div></div>;

  const openTask = openId ? all.find((t) => t.id === openId) ?? null : null;
  const TABS: [typeof tab, string][] = manager
    ? [["mine", "My tasks"], ["team", "Team"], ["board", "Board"], ["cal", "Calendar"], ["archive", `Archive${archived.length ? ` (${archived.length})` : ""}`]]
    : [["mine", "My tasks"], ["board", "Board"], ["cal", "Calendar"], ["archive", `Archive${archived.length ? ` (${archived.length})` : ""}`]];
  const sub = role === "staff" ? "Your to-do list — tied to the sessions, children & camps you're working."
    : isFreelancer ? "Your to-dos across every company you work for — one combined inbox."
    : role === "franchise" ? "Tasks for your franchise team & freelancers — tied to your camps, bookings & people."
    : "Everything your team & freelancers need to do — tied to the camps, bookings & people it's about.";

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#c02636]">{error}</div>}

      {/* Hero */}
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: HERO }}>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Task manager</div>
        <p className="mt-1 max-w-[640px] text-[12.5px] text-white/85">{sub}</p>
        <div className="mt-3.5 flex flex-wrap gap-2.5">
          {kpis.map(([label, n, color, key]) => {
            const on = kpiFilter === key;
            return (
              <button key={label} type="button" onClick={() => setKpiFilter(on ? "" : key)} title={`Show ${label.toLowerCase()}`}
                className="rounded-xl px-4 py-2 text-left backdrop-blur-sm transition hover:-translate-y-0.5"
                style={on ? { background: "#fff", boxShadow: "0 6px 18px -8px rgba(0,0,0,.4)" } : { background: "rgba(255,255,255,.15)" }}>
                <div className="text-[20px] font-extrabold leading-none" style={{ fontVariantNumeric: "tabular-nums", color: on ? "#1d3a8f" : "#fff" }}>{n}</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: on ? "#4a4763" : "rgba(255,255,255,.8)" }}>{label}</div>
                <div className="mt-0.5 h-0.5 w-6 rounded-full" style={{ background: color }} />
              </button>
            );
          })}
        </div>
      </div>

      <TourLauncher view="tasks" />

      {/* Quick add */}
      {!onMilestones && <div className="mb-3 rounded-2xl border border-[#dbe6fb] bg-[var(--surface)] p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input value={qa} onChange={(e) => setQa(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addQuick(); }} placeholder={`Quick add…   try:  Brief coaches tomorrow ${noAssignee ? "" : "@Jess "}!high #Riverside`} className="min-w-[240px] flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] outline-none focus:border-[#1d3a8f]" />
          <label className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[12px] text-[var(--ink-3)]"><span>Deadline</span><input type="date" value={qaDue} onChange={(e) => setQaDue(e.target.value)} className="bg-transparent text-[12.5px] text-[var(--ink)] outline-none" /></label>
          <Button onClick={addQuick}>Quick add</Button>
          <button type="button" onClick={() => setCreating(true)} className="rounded-lg bg-[#1d3a8f] px-3.5 py-2 text-[12.5px] font-extrabold text-white shadow-sm transition hover:-translate-y-px">+ New task</button>
        </div>
        {preview && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px]">
            <span className="text-[var(--ink-3)]">Preview:</span>
            <span className="font-bold">{preview.t || "…"}</span>
            {preview.who && <span className="rounded-full px-2 py-0.5 font-bold" style={previewWhoUnknown ? { background: "#fde2e4", color: "#c02636" } : { background: "#eef4fd", color: BLUE }}>@{preview.who}{previewWhoUnknown ? " · not in team" : ""}</span>}
            {preview.prio && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--panel)] px-2 py-0.5 font-bold"><span className="h-2 w-2 rounded-full" style={{ background: PRIO[preview.prio].dot }} />{PRIO[preview.prio].label}</span>}
            {preview.link && <span className="rounded-full px-2 py-0.5 font-bold" style={{ background: LINK.camp.bg, color: LINK.camp.fg }}>{LINK.camp.icon} {preview.link.v}</span>}
            {preview.due && <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 font-bold">📅 {fmtDay(preview.due)}</span>}
          </div>
        )}
        <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">{noAssignee ? "" : <><b>@</b> assignee · </>}<b>!</b> priority · <b>#</b> link a camp · <b>today tomorrow Mon</b> set the due date · or <b>+ New task</b> for the full form</div>
      </div>}

      {/* Tabs + toolbar */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1 text-[12.5px] font-bold shadow-sm">
          {TABS.map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className="rounded-xl px-4 py-2 transition-colors" style={tab === k ? { background: BLUE, color: "#fff" } : { color: "var(--ink-3)" }}>{l}</button>)}
          {showMilestones && <button type="button" onClick={() => setTab("milestones")} className="ml-0.5 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 transition-transform hover:-translate-y-px" style={onMilestones ? { background: "linear-gradient(135deg,#6d28d9,#0e7490)", color: "#fff", boxShadow: "0 6px 16px -6px rgba(109,40,217,.5)" } : { color: "#6d28d9", boxShadow: "inset 0 0 0 1.5px rgba(109,40,217,.28)" }}>📍 Milestones</button>}
        </div>
        {!onMilestones && <div className="relative ml-auto">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks…" className="w-[190px] rounded-full border border-[var(--line)] bg-[var(--surface)] py-1.5 px-3 text-[12px] outline-none focus:border-[#1d3a8f]" />
        </div>}
      </div>
      {!onMilestones && <>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">When</span>
        {([["All", ""], ["Today", "today"], ["Tomorrow", "tomorrow"]] as const).map(([label, val]) => <button key={label} type="button" onClick={() => setDueScope(val)} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={dueScope === val ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{label}</button>)}
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={dueScope && dueScope !== "today" && dueScope !== "tomorrow" ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}><span>Pick date</span><input type="date" value={dueScope !== "today" && dueScope !== "tomorrow" ? dueScope : ""} onChange={(e) => setDueScope(e.target.value)} className="bg-transparent text-[11.5px] text-[var(--ink)] outline-none" /></label>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Priority</span>
        {(["urgent", "high", "med", "low"] as Prio[]).map((p) => <button key={p} type="button" onClick={() => setPrioFilter(prioFilter === p ? "" : p)} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={prioFilter === p ? { borderColor: PRIO[p].dot, background: `${PRIO[p].dot}1a`, color: PRIO[p].dot } : { borderColor: "var(--line)", color: "var(--ink-2)" }}><span className="h-2 w-2 rounded-full" style={{ background: PRIO[p].dot }} />{PRIO[p].label}</button>)}
        {filtersActive && <><button type="button" onClick={clearFilters} className="ml-1 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-3)]">Clear ✕</button><span className="text-[11.5px] text-[var(--ink-3)]">{base.length} match{base.length === 1 ? "" : "es"}</span></>}
      </div>
      </>}

      {isFreelancer && tab === "mine" && <div className="mb-2 rounded-xl border border-[#dbe6fb] bg-[#f2f7ff] px-3 py-2 text-[12px] text-[var(--ink-2)]"><b>One inbox across every company you work for</b> — tasks from all the providers you coach for land here together, each badged with the company it belongs to.</div>}

      {/* Views */}
      {onMilestones ? (
        <MilestonesApp mode={role === "company" ? "ho" : "franchise"} embedded />
      ) : all.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-14 text-center">
          <div className="text-[15px] font-extrabold">No tasks yet</div>
          <p className="mx-auto mt-1 max-w-[440px] text-[12.5px] text-[var(--ink-3)]">Add your first with the quick-add above — try <b>Set up Week 3 registers tomorrow @Sam !high #Bedford</b>. Some will also appear on their own once the auto-spawn engine ships.</p>
        </div>
      ) : (<>
        {tab === "mine" && <MyTasks tasks={base.filter(mineOf)} today={today} noAssignee={noAssignee} onOpen={setOpenId} onStatus={setStatus} />}
        {tab === "board" && <Board tasks={base} noAssignee={noAssignee} onOpen={setOpenId} drag={drag} setDrag={setDrag} onDrop={(id, s) => patch(id, { status: s })} onDone={toggleDone} onArchive={(t) => patch(t.id, { archived: true })} />}
        {tab === "cal" && <Calendar tasks={base} anchor={calAnchor} setAnchor={setCalAnchor} view={calView} setView={setCalView} today={today} noAssignee={noAssignee} onOpen={setOpenId} onStatus={setStatus} />}
        {tab === "team" && manager && <TeamView tasks={base} team={team} filter={teamFilter} setFilter={setTeamFilter} sort={teamSort} setSort={setTeamSort} today={today} onOpen={setOpenId} onStatus={setStatus} />}
        {tab === "archive" && <ArchiveView tasks={archived} onOpen={setOpenId} onUnarchive={(t) => patch(t.id, { archived: false })} />}
      </>)}

      {flash && <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-[#16803d] px-4 py-2 text-[13px] font-extrabold text-white shadow-lg">✓ Task logged</div>}
      {creating && <CreateModal noAssignee={noAssignee} team={team} opts={linkOpts} initialTitle={qa} onClose={() => { setCreating(false); setQa(""); }} onCreate={(f, toCal) => { create(f, toCal); setCreating(false); setQa(""); }} />}
      {openTask && <Drawer task={openTask} team={team} noAssignee={noAssignee} me={me} opts={linkOpts} onClose={() => setOpenId(null)} onPatch={(f) => patch(openTask.id, f)} onSyncCal={() => syncToCalendar(openTask)} onUnsyncCal={() => unsyncFromCalendar(openTask)} onArchive={() => { patch(openTask.id, { archived: true }); setOpenId(null); }} onDelete={() => remove(openTask.id)} />}
    </div>
  );
}

// ── Archive ─────────────────────────────────────────────────────────────────
function ArchiveView({ tasks, onOpen, onUnarchive }: { tasks: Task[]; onOpen: (id: string) => void; onUnarchive: (t: Task) => void }) {
  if (tasks.length === 0) return <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-12 text-center text-[12.5px] text-[var(--ink-3)]">Nothing archived. Archive a task from its card to tuck it away here.</div>;
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
      {tasks.map((t) => (
        <div key={t.id} className="flex items-center gap-2.5 border-b border-[var(--line)] px-3 py-2.5 last:border-b-0">
          <span className="h-2 w-2 flex-none rounded-full" style={{ background: PRIO[t.prio ?? "med"].dot }} />
          <button type="button" onClick={() => onOpen(t.id)} className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-[var(--ink-2)]">{t.t}</button>
          {t.link && <span className="flex-none"><LinkChip link={t.link} /></span>}
          {t.due && <span className="flex-none text-[11px] text-[var(--ink-3)]">{fmtDay(t.due)}</span>}
          <button type="button" onClick={() => onUnarchive(t)} className="flex-none rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[#1d3a8f] hover:bg-[#eef4fd]">↩ Unarchive</button>
        </div>
      ))}
    </div>
  );
}

// ── My Tasks — grouped list ─────────────────────────────────────────────────
function MyTasks({ tasks, today, noAssignee, onOpen, onStatus }: { tasks: Task[]; today: string; noAssignee: boolean; onOpen: (id: string) => void; onStatus: (t: Task, s: Status) => void }) {
  const open = tasks.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => t.due && daysBetween(today, t.due) < 0).sort(byPrioDue);
  const todayT = open.filter((t) => t.due && daysBetween(today, t.due) === 0).sort(byPrioDue);
  const upcoming = open.filter((t) => !t.due || daysBetween(today, t.due) > 0).sort((a, b) => `${a.due ?? "9999"}`.localeCompare(`${b.due ?? "9999"}`) || byPrioDue(a, b));
  const done = tasks.filter((t) => t.status === "done");
  const groups: [string, Task[], string, string][] = [["Overdue", overdue, "Nothing overdue — nice.", "#c02636"], ["Today", todayT, "Clear for today.", "#b45309"], ["Upcoming", upcoming, "Nothing scheduled.", "#3b82f6"], ["Done", done, "Nothing done yet.", "#16b364"]];
  return (
    <div className="space-y-4">
      {groups.map(([title, list, empty, color]) => (
        <TaskGroup key={title} title={title} list={list} empty={empty} color={color} today={today} noAssignee={noAssignee} hideDone={title === "Done"} onOpen={onOpen} onStatus={onStatus} />
      ))}
    </div>
  );
}

// One group (Overdue / Today / Upcoming / Done) — shows the first 5, then a
// "Show N more" toggle so long lists stay compact.
function TaskGroup({ title, list, empty, color, today, noAssignee, hideDone, onOpen, onStatus }: { title: string; list: Task[]; empty: string; color: string; today: string; noAssignee: boolean; hideDone: boolean; onOpen: (id: string) => void; onStatus: (t: Task, s: Status) => void }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? list : list.slice(0, 10);
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /><span className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color }}>{title}</span><span className="rounded-full px-1.5 text-[10.5px] font-extrabold" style={{ background: `${color}14`, color }}>{list.length}</span></div>
      {list.length === 0 ? <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[12px] text-[var(--ink-3)]">{empty}</div>
        : <>
          <div className="space-y-2">{shown.map((t) => <TaskRow key={t.id} t={t} today={today} noAssignee={noAssignee} hideDone={hideDone} onOpen={onOpen} onStatus={onStatus} />)}</div>
          {list.length > 10 && <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 w-full rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)] py-2 text-[11.5px] font-extrabold text-[#1d3a8f] transition hover:bg-[#eef4fd]">{expanded ? "Show less" : `Show ${list.length - 10} more`}</button>}
        </>}
    </div>
  );
}

function TaskRow({ t, today, noAssignee, hideDone, onOpen, onStatus }: { t: Task; today: string; noAssignee: boolean; hideDone?: boolean; onOpen: (id: string) => void; onStatus: (t: Task, s: Status) => void }) {
  const done = t.status === "done";
  const subs = t.subs ?? [];
  const isOverdue = !done && !!t.due && daysBetween(today, t.due) < 0;
  const sc = STATUS_C[t.status ?? "todo"];
  // Left date rail — the prominent, listing-card style block.
  const railBg = done ? "linear-gradient(160deg,#0f7a3d,#16b364)" : isOverdue ? "linear-gradient(160deg,#8f1420,#c02636)" : "linear-gradient(160deg,#16307a,#3f78d8)";
  const mon = t.due ? new Date(`${t.due}T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }).toUpperCase() : "";
  const rel = done ? "Done" : isOverdue ? "Overdue" : (dueLabel(t.due, today)?.text ?? "");
  return (
    <div data-ui="card" className="flex h-[52px] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-sm transition hover:shadow-md">
      {/* Date rail — compact */}
      <div className="flex w-[58px] flex-none flex-col items-center justify-center px-1 text-center leading-none text-white" style={{ background: t.due ? railBg : "linear-gradient(160deg,#8a93a6,#aab0be)" }}>
        {t.due ? <>
          <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/80">{mon}</div>
          <div className="text-[19px] font-extrabold">{Number(t.due.slice(-2))}</div>
          <div className="mt-0.5 text-[7.5px] font-bold uppercase tracking-wide text-white/85">{rel}</div>
        </> : <div className="text-[9px] font-bold uppercase leading-tight tracking-wide text-white/90">No<br />date</div>}
      </div>
      {/* Body — single row */}
      <div className="flex min-w-0 flex-1 items-center gap-2 px-2.5">
        {!hideDone && <select value={t.status ?? "todo"} onClick={(e) => e.stopPropagation()} onChange={(e) => onStatus(t, e.target.value as Status)} aria-label="Status" className="flex-none cursor-pointer rounded-full border px-2 py-0.5 text-[10px] font-extrabold outline-none transition-colors" style={{ borderColor: `${sc}55`, background: `${sc}14`, color: sc }}>{COLS.map((c) => <option key={c.k} value={c.k} style={{ color: "var(--ink)" }}>{c.label}</option>)}</select>}
        <span className="h-2 w-2 flex-none rounded-full" style={{ background: PRIO[t.prio ?? "med"].dot }} />
        <button type="button" onClick={() => onOpen(t.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className={`truncate text-[13px] ${done ? "text-[var(--ink-3)] line-through" : "font-extrabold"}`}>{t.t}</span>
          {t.co && <span className="flex-none rounded-full bg-[var(--panel)] px-2 text-[10px] font-bold text-[var(--ink-2)]">{t.co}</span>}
        </button>
        {subs.length > 0 && <span className="flex-none text-[10px] font-semibold text-[var(--ink-3)]">{subs.filter((s) => s.done).length}/{subs.length}</span>}
        {t.time && <span className="flex-none text-[10.5px] font-bold text-[var(--ink-3)]">{t.time}</span>}
        {t.link && <LinkChip link={t.link} size="xs" />}
        {t.calEventId && <span className="flex-none rounded-full bg-[#eef4fd] px-1.5 py-0.5 text-[9.5px] font-bold text-[#1d3a8f]">Cal</span>}
        {!noAssignee && t.who && <span className="flex-none text-[10.5px] font-semibold text-[var(--ink-3)]">{t.who}</span>}
      </div>
    </div>
  );
}

// ── Board — kanban with drag ────────────────────────────────────────────────
function Board({ tasks, noAssignee, onOpen, drag, setDrag, onDrop, onDone, onArchive }: { tasks: Task[]; noAssignee: boolean; onOpen: (id: string) => void; drag: string | null; setDrag: (id: string | null) => void; onDrop: (id: string, s: Status) => void; onDone: (t: Task) => void; onArchive: (t: Task) => void }) {
  const [over, setOver] = useState<Status | null>(null);
  const today = todayIso();
  return (
    <>
      <div className="grid items-start gap-2.5 md:grid-cols-4">
        {COLS.map((c) => (
          <BoardColumn key={c.k} c={c} list={tasks.filter((t) => (t.status ?? "todo") === c.k).slice().sort(byPrioDue)} today={today} noAssignee={noAssignee} over={over === c.k} setOver={setOver} drag={drag} setDrag={setDrag} onDrop={onDrop} onOpen={onOpen} onDone={onDone} onArchive={onArchive} />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-[var(--ink-3)]">Drag a card between columns to move it, or click to open.</p>
    </>
  );
}

// One kanban column — shows the first 10 cards, then a "Show N more" toggle.
function BoardColumn({ c, list, today, noAssignee, over, setOver, drag, setDrag, onDrop, onOpen, onDone, onArchive }: { c: { k: Status; label: string; color: string }; list: Task[]; today: string; noAssignee: boolean; over: boolean; setOver: (s: Status | null) => void; drag: string | null; setDrag: (id: string | null) => void; onDrop: (id: string, s: Status) => void; onOpen: (id: string) => void; onDone: (t: Task) => void; onArchive: (t: Task) => void }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? list : list.slice(0, 10);
  return (
    <div onDragOver={(e) => { e.preventDefault(); setOver(c.k); }} onDragLeave={() => setOver(null)} onDrop={() => { if (drag) onDrop(drag, c.k); setDrag(null); setOver(null); }}
      className="flex flex-col overflow-hidden rounded-2xl border shadow-sm transition-colors" style={{ borderColor: over ? c.color : "var(--line)" }}>
      <div className="flex items-center gap-1.5 px-3 py-2.5 text-white" style={{ background: `linear-gradient(120deg, ${c.color}, ${c.color}c8)` }}><span className="h-2.5 w-2.5 rounded-full bg-white/85" /><span className="text-[11.5px] font-extrabold uppercase tracking-wide">{c.label}</span><span className="ml-auto rounded-full bg-white/25 px-2 text-[10.5px] font-extrabold">{list.length}</span></div>
      <div className="flex-1 space-y-2 p-2" style={{ background: over ? `${c.color}12` : `${c.color}08` }}>
        {shown.map((t) => {
          const dl = dueFull(t, today);
          const isOverdue = t.status !== "done" && !!t.due && daysBetween(today, t.due) < 0;
          const accent = isOverdue ? "#c02636" : PRIO[t.prio ?? "med"].dot;
          return (
          <div key={t.id} draggable onDragStart={() => setDrag(t.id)} onDragEnd={() => setDrag(null)} onClick={() => onOpen(t.id)} data-ui="card"
            className="cursor-grab overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing">
            <div className="border-l-[3px] p-2.5" style={{ borderColor: accent }}>
              <div className="flex items-start gap-1.5">
                <span className="mt-1 h-2 w-2 flex-none rounded-full" style={{ background: PRIO[t.prio ?? "med"].dot }} />
                <span className={`text-[12.5px] leading-snug ${t.status === "done" ? "text-[var(--ink-3)] line-through" : "font-extrabold"}`}>{t.t}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {t.link && <LinkChip link={t.link} size="xs" />}
                {dl && t.status !== "done" && <span className="rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold" style={{ background: `${dl.color}18`, color: dl.color }}>{dl.text}</span>}
                {!noAssignee && t.who && <span className="text-[10px] font-semibold text-[var(--ink-3)]">{t.who}</span>}
                <div className="ml-auto flex items-center gap-1">
                  {t.status === "done" && <button type="button" onClick={(e) => { e.stopPropagation(); onArchive(t); }} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--ink-2)] hover:bg-[var(--panel)]">Archive</button>}
                  <button type="button" onClick={(e) => { e.stopPropagation(); onDone(t); }} className="rounded-md border px-2 py-0.5 text-[10px] font-extrabold transition-colors" style={t.status === "done" ? { borderColor: "#16b364", background: "#16b364", color: "#fff" } : { borderColor: "#16b364", color: "#0f8a4a" }}>{t.status === "done" ? "✓ Done" : "Done"}</button>
                </div>
              </div>
            </div>
          </div>
          );
        })}
        {list.length === 0 && <div className="rounded-xl border border-dashed border-[var(--line)] py-5 text-center text-[11px] text-[var(--ink-3)]">Drop here</div>}
        {list.length > 10 && <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] py-1.5 text-[11px] font-extrabold text-[#1d3a8f] transition hover:bg-[#eef4fd]">{expanded ? "Show less" : `Show ${list.length - 10} more`}</button>}
      </div>
    </div>
  );
}

// ── Calendar — Day / Week / Month ───────────────────────────────────────────
function Calendar({ tasks, anchor, setAnchor, view, setView, today, noAssignee, onOpen, onStatus }: { tasks: Task[]; anchor: string; setAnchor: (d: string) => void; view: "day" | "week" | "month"; setView: (v: "day" | "week" | "month") => void; today: string; noAssignee: boolean; onOpen: (id: string) => void; onStatus: (t: Task, s: Status) => void }) {
  const on = (iso: string) => tasks.filter((t) => t.due === iso).slice().sort(byPrioDue);
  const dowMon = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7; // 0=Mon
  const weekStart = shiftIso(anchor, -dowMon(anchor));
  const step = view === "day" ? 1 : view === "week" ? 7 : 0;
  const stepBy = (dir: number) => { if (view === "month") { const [y, m] = anchor.split("-").map(Number); setAnchor(new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10)); } else setAnchor(shiftIso(anchor, dir * step)); };
  const title = view === "day" ? new Date(`${anchor}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : view === "week" ? `Week of ${fmtDay(weekStart)}`
    : new Date(`${anchor}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  // Compact chip (month/week) — done tasks read struck-through and dimmed.
  const chip = (t: Task) => { const done = t.status === "done"; return <button key={t.id} type="button" onClick={() => onOpen(t.id)} className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[10.5px] font-bold text-white ${done ? "line-through opacity-60" : ""}`} style={{ background: done ? "#16b364" : PRIO[t.prio ?? "med"].dot }} title={t.t}>{t.time ? `${t.time} ` : ""}{t.t}</button>; };
  // Day-view row — inline status picker so Done / In progress etc can be set right here.
  const fullChip = (t: Task) => { const done = t.status === "done"; return <div key={t.id} className="flex w-full items-center gap-2 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[12.5px] hover:bg-[#f7faff]"><span className="h-2 w-2 flex-none rounded-full" style={{ background: done ? "#16b364" : PRIO[t.prio ?? "med"].dot }} /><button type="button" onClick={() => onOpen(t.id)} className={`min-w-0 flex-1 truncate text-left font-bold ${done ? "text-[var(--ink-3)] line-through" : ""}`}>{t.time ? <span className="mr-1 font-black text-[var(--ink-3)]">{t.time}</span> : null}{t.t}</button>{t.link && <LinkChip link={t.link} size="xs" />}{!noAssignee && t.who && <span className="flex-none text-[10.5px] text-[var(--ink-3)]">{t.who}</span>}<select value={t.status ?? "todo"} onChange={(e) => onStatus(t, e.target.value as Status)} onClick={(e) => e.stopPropagation()} aria-label="Status" className="flex-none cursor-pointer rounded-full border px-2 py-0.5 text-[10.5px] font-extrabold outline-none" style={{ borderColor: `${STATUS_C[t.status ?? "todo"]}55`, background: `${STATUS_C[t.status ?? "todo"]}14`, color: STATUS_C[t.status ?? "todo"] }}>{COLS.map((c) => <option key={c.k} value={c.k} style={{ color: "var(--ink)" }}>{c.label}</option>)}</select></div>; };

  let body: ReactNode;
  if (view === "month") {
    const [y, m] = anchor.split("-").map(Number);
    const firstDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells: (string | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: dim }, (_, i) => `${anchor.slice(0, 7)}-${String(i + 1).padStart(2, "0")}`)];
    while (cells.length % 7 !== 0) cells.push(null);
    body = <>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold uppercase text-[var(--ink-3)]">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-1">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">{cells.map((iso, i) => (
        <div key={i} className="min-h-[78px] rounded-lg border p-1" style={{ borderColor: iso === today ? BLUE : "var(--line)", background: iso === today ? "#eef4fd" : iso ? "var(--surface)" : "transparent" }}>
          {iso && <><div className="text-right text-[10.5px] font-bold text-[var(--ink-3)]">{Number(iso.slice(-2))}</div><div className="space-y-0.5">{on(iso).slice(0, 3).map(chip)}{on(iso).length > 3 && <div className="px-1 text-[9.5px] text-[var(--ink-3)]">+{on(iso).length - 3} more</div>}</div></>}
        </div>
      ))}</div>
    </>;
  } else if (view === "week") {
    const days = Array.from({ length: 7 }, (_, i) => shiftIso(weekStart, i));
    body = <div className="grid grid-cols-7 gap-1">{days.map((iso) => (
      <div key={iso} className="min-h-[220px] rounded-lg border p-1.5" style={{ borderColor: iso === today ? BLUE : "var(--line)", background: iso === today ? "#eef4fd" : "var(--surface)" }}>
        <div className="mb-1 text-[10.5px] font-extrabold text-[var(--ink-2)]">{new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" })}</div>
        <div className="space-y-1">{on(iso).map(chip)}{on(iso).length === 0 && <div className="text-[10px] text-[var(--ink-3)]">—</div>}</div>
      </div>
    ))}</div>;
  } else {
    const list = on(anchor);
    body = <div className="space-y-1.5 py-1">{list.length === 0 ? <div className="rounded-lg border border-dashed border-[var(--line)] py-8 text-center text-[12px] text-[var(--ink-3)]">Nothing due this day.</div> : list.map(fullChip)}</div>;
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => stepBy(-1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] text-[15px] font-bold">‹</button>
        <div className="min-w-[180px] text-[14px] font-extrabold">{title}</div>
        <button type="button" onClick={() => stepBy(1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] text-[15px] font-bold">›</button>
        <button type="button" onClick={() => setAnchor(today)} className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-2)]">Today</button>
        <div className="ml-auto flex gap-1 rounded-full border border-[var(--line)] p-0.5">
          {(["day", "week", "month"] as const).map((v) => <button key={v} type="button" onClick={() => setView(v)} className="rounded-full px-3 py-1 text-[11.5px] font-bold capitalize" style={view === v ? { background: "#eef4fd", color: BLUE } : { color: "var(--ink-3)" }}>{v}</button>)}
        </div>
      </div>
      {body}
    </div>
  );
}

// ── Linked-to picker — pulls real records + builds the deep-link ─────────────
// A search-as-you-type combobox. Each row shows a bold primary line and a muted
// `sub` line (the disambiguating detail) so you pick the right record.
function SearchSelect({ value, placeholder, options, onPick, inputCls }: { value: string; placeholder: string; options: { v: string; sub?: string }[]; onPick: (v: string) => void; inputCls: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const filtered = (ql ? options.filter((o) => `${o.v} ${o.sub ?? ""}`.toLowerCase().includes(ql)) : options).slice(0, 60);
  return (
    <div className="relative">
      <input value={open ? q : value} placeholder={value || `${placeholder} — type to search`} onFocus={() => { setOpen(true); setQ(""); }} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 160)} className={inputCls} />
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-lg">
          {value && <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(""); setOpen(false); }} className="w-full border-b border-[var(--line)] px-3 py-1.5 text-left text-[11.5px] font-bold text-[var(--ink-3)] hover:bg-[#f7faff]">Clear selection</button>}
          {filtered.length === 0 ? <div className="px-3 py-2 text-[12px] text-[var(--ink-3)]">No matches</div>
            : filtered.map((o) => (
              <button type="button" key={o.v} onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(o.v); setOpen(false); }} className="flex w-full flex-col items-start gap-0.5 border-b border-[var(--line)] px-3 py-1.5 text-left last:border-b-0 hover:bg-[#eef4fd]">
                <span className="text-[12.5px] font-bold text-[var(--ink)]">{o.v}</span>
                {o.sub && <span className="text-[11px] text-[var(--ink-3)]">{o.sub}</span>}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function LinkedPicker({ link, onChange, opts, inputCls }: { link: TaskLink | null | undefined; onChange: (l: TaskLink | null) => void; opts: LinkOpts; inputCls: string }) {
  const k = link?.k ?? "";
  const { portal, bookOpts, childOpts, parentOpts, listings, locations, cats } = opts;
  const bookingHref = (ref: string) => `/${portal}/bookings?ref=${encodeURIComponent(ref)}`;
  const setK = (nk: string) => onChange(nk ? { k: nk as LinkKind, v: "" } : null);
  return (
    <div className="space-y-1.5">
      <select value={LINK_TYPES.includes(k as LinkKind) ? k : (k || "")} onChange={(e) => setK(e.target.value)} className={inputCls}>
        <option value="">— not linked —</option>
        {LINK_TYPES.map((kk) => <option key={kk} value={kk}>{LINK[kk].label}</option>)}
      </select>

      {k === "book" && (bookOpts.length
        ? <SearchSelect value={link?.v ?? ""} placeholder="Find a booking" options={bookOpts.map((b) => ({ v: b.v, sub: b.sub }))} onPick={(v) => { const o = bookOpts.find((b) => b.v === v); onChange(o ? { k: "book", v: o.v, href: bookingHref(o.ref) } : null); }} inputCls={inputCls} />
        : <input value={link?.v ?? ""} onChange={(e) => onChange({ k: "book", v: e.target.value })} placeholder="e.g. #APF-1042" className={inputCls} />)}

      {k === "child" && (childOpts.length
        ? <SearchSelect value={link?.v ?? ""} placeholder="Find a child" options={childOpts.map((c) => ({ v: c.name, sub: c.sub }))} onPick={(v) => { const o = childOpts.find((c) => c.name === v); onChange(o ? { k: "child", v: o.name, href: bookingHref(o.ref) } : null); }} inputCls={inputCls} />
        : <input value={link?.v ?? ""} onChange={(e) => onChange({ k: "child", v: e.target.value })} placeholder="Child name" className={inputCls} />)}

      {k === "parent" && (parentOpts.length
        ? <SearchSelect value={link?.v ?? ""} placeholder="Find a parent" options={parentOpts.map((p) => ({ v: p.name, sub: p.sub }))} onPick={(v) => { const o = parentOpts.find((p) => p.name === v); onChange(o ? { k: "parent", v: o.name, href: bookingHref(o.ref) } : null); }} inputCls={inputCls} />
        : <input value={link?.v ?? ""} onChange={(e) => onChange({ k: "parent", v: e.target.value })} placeholder="Parent name" className={inputCls} />)}

      {k === "list" && (listings.length
        ? <SearchSelect value={link?.v ?? ""} placeholder="Find a listing" options={listings.map((l) => ({ v: l.title, sub: l.location }))} onPick={(v) => onChange(v ? { k: "list", v } : null)} inputCls={inputCls} />
        : <input value={link?.v ?? ""} onChange={(e) => onChange({ k: "list", v: e.target.value })} placeholder="Listing name" className={inputCls} />)}

      {k === "venue" && (locations.length
        ? <SearchSelect value={link?.v ?? ""} placeholder="Find a location" options={locations.map((v) => ({ v }))} onPick={(v) => onChange(v ? { k: "venue", v } : null)} inputCls={inputCls} />
        : <input value={link?.v ?? ""} onChange={(e) => onChange({ k: "venue", v: e.target.value })} placeholder="Location or address" className={inputCls} />)}

      {k === "gen" && <><input list="task-cats" value={link?.v ?? ""} onChange={(e) => onChange({ k: "gen", v: e.target.value })} placeholder="Category — type a new one or pick" className={inputCls} /><datalist id="task-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></>}
    </div>
  );
}

// ── Create-task modal ───────────────────────────────────────────────────────
function CreateModal({ noAssignee, team, opts, initialTitle, onClose, onCreate }: { noAssignee: boolean; team: string[]; opts: LinkOpts; initialTitle?: string; onClose: () => void; onCreate: (f: Partial<Task>, toCal: boolean) => void }) {
  const [t, setT] = useState(initialTitle ?? "");
  const [who, setWho] = useState("");
  const [prio, setPrio] = useState<Prio>("med");
  const [due, setDue] = useState("");
  const [time, setTime] = useState("");
  const [status, setStatus] = useState<Status>("todo");
  const [link, setLink] = useState<TaskLink | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [labelIn, setLabelIn] = useState("");
  const [toCal, setToCal] = useState(false);
  const inputCls = "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[12.5px] outline-none focus:border-[#1d3a8f]";
  const fieldRow = (name: string, node: ReactNode) => <div><div className="mb-0.5 text-[11px] font-bold text-[var(--ink-3)]">{name}</div>{node}</div>;
  const submit = () => { if (!t.trim()) return; onCreate({ t: t.trim(), who: noAssignee ? "" : who, prio, due: due || null, time: time || null, status, link, labels }, toCal); };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[6vh]" onClick={onClose}>
      <div className="w-full max-w-[520px] overflow-hidden rounded-3xl bg-[var(--surface)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 text-white" style={{ background: HERO }}>
          <div className="text-[16px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>New task</div>
          <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-[15px] font-bold">×</button>
        </div>
        <div className="max-h-[70vh] space-y-2.5 overflow-y-auto p-4">
          {fieldRow("Task", <input autoFocus value={t} onChange={(e) => setT(e.target.value)} placeholder="What needs doing?" className={inputCls} />)}
          <div className="grid grid-cols-2 gap-2.5">
            {fieldRow("Due / deadline", <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} />)}
            {fieldRow("Time (optional)", <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />)}
            {fieldRow("Priority", <select value={prio} onChange={(e) => setPrio(e.target.value as Prio)} className={inputCls}>{(Object.keys(PRIO) as Prio[]).map((p) => <option key={p} value={p}>{PRIO[p].label}</option>)}</select>)}
            {!noAssignee && fieldRow("Assignee", <><input list="team-list-c" value={who} onChange={(e) => setWho(e.target.value)} placeholder="Unassigned" className={inputCls} /><datalist id="team-list-c">{team.map((w) => <option key={w} value={w} />)}</datalist></>)}
            {fieldRow("Status", <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className={inputCls}>{COLS.map((c) => <option key={c.k} value={c.k}>{c.label}</option>)}</select>)}
          </div>
          {fieldRow("Linked to", <LinkedPicker link={link} onChange={setLink} opts={opts} inputCls={inputCls} />)}
          {fieldRow("Labels", <div className="flex flex-wrap gap-1.5">{labels.map((l, i) => <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[var(--panel)] px-2 py-0.5 text-[11px] font-bold">{l}<button type="button" onClick={() => setLabels(labels.filter((_, j) => j !== i))} className="text-[var(--ink-3)]">×</button></span>)}<input value={labelIn} onChange={(e) => setLabelIn(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && labelIn.trim()) { setLabels([...labels, labelIn.trim()]); setLabelIn(""); } }} placeholder="+ label" className="w-[100px] rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] outline-none focus:border-[#1d3a8f]" /></div>)}
          <label className={`mt-1 flex items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] ${due ? "cursor-pointer border-[#dbe6fb] bg-[#f2f7ff]" : "border-[var(--line)] opacity-60"}`}>
            <input type="checkbox" checked={toCal} disabled={!due} onChange={(e) => setToCal(e.target.checked)} className="h-4 w-4 accent-[#1d3a8f]" />
            <span className="font-bold">Also show in the Events calendar</span>
            <span className="text-[11px] text-[var(--ink-3)]">{due ? "adds it to your sidebar calendar too" : "set a deadline first"}</span>
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--line)] px-4 py-3">
          <Button sm onClick={onClose}>Cancel</Button>
          <Button sm variant="primary" onClick={submit}>Create task</Button>
        </div>
      </div>
    </div>
  );
}

// ── Team — per-assignee ─────────────────────────────────────────────────────
function TeamView({ tasks, team, filter, setFilter, sort, setSort, today, onOpen, onStatus }: { tasks: Task[]; team: string[]; filter: string; setFilter: (s: string) => void; sort: "up" | "down"; setSort: (s: "up" | "down") => void; today: string; onOpen: (id: string) => void; onStatus: (t: Task, s: Status) => void }) {
  const people = filter ? [filter] : [...team, "__unassigned"];
  const byOf = (who: string) => tasks.filter((t) => (who === "__unassigned" ? !t.who || t.who.trim() === "" : (t.who || "") === who));
  const openCount = (who: string) => byOf(who).filter((t) => t.status !== "done").length;
  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => setFilter("")} className="rounded-full border px-3 py-1 text-[12px] font-bold" style={!filter ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>All</button>
        {team.map((w) => <button key={w} type="button" onClick={() => setFilter(w)} className="rounded-full border px-3 py-1 text-[12px] font-bold" style={filter === w ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{w} <span className="text-[var(--ink-3)]">{openCount(w)}</span></button>)}
        <button type="button" onClick={() => setSort(sort === "up" ? "down" : "up")} className="ml-auto rounded-full border border-[var(--line)] px-3 py-1 text-[12px] font-bold text-[var(--ink-2)]">Due {sort === "up" ? "↑" : "↓"}</button>
      </div>
      <div className="space-y-4">
        {people.map((who) => {
          const list = byOf(who).slice().sort((a, b) => (sort === "up" ? 1 : -1) * `${a.due ?? "9999"}`.localeCompare(`${b.due ?? "9999"}`));
          if (list.length === 0) return null;
          const over = list.filter((t) => t.status !== "done" && t.due && daysBetween(today, t.due) < 0).length;
          const label = who === "__unassigned" ? "Unassigned" : who;
          return (
            <div key={who}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-[9.5px] font-extrabold text-[var(--ink-2)]" style={{ background: avBg(label) }}>{who === "__unassigned" ? "—" : initials(label)}</span>
                <span className="text-[12.5px] font-extrabold">{label}</span>
                <span className="text-[11px] text-[var(--ink-3)]">{openCount(who)} open{over ? ` · ${over} overdue` : ""}</span>
              </div>
              <div className="space-y-2">{list.map((t) => <TaskRow key={t.id} t={t} today={today} noAssignee={false} onOpen={onOpen} onStatus={onStatus} />)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Detail drawer ───────────────────────────────────────────────────────────
function Drawer({ task, team, noAssignee, me, opts, onClose, onPatch, onSyncCal, onUnsyncCal, onArchive, onDelete }: { task: Task; team: string[]; noAssignee: boolean; me: string; opts: LinkOpts; onClose: () => void; onPatch: (f: Partial<Task>) => void; onSyncCal: () => void; onUnsyncCal: () => void; onArchive: () => void; onDelete: () => void }) {
  const [label, setLabel] = useState("");
  const [sub, setSub] = useState("");
  const [comment, setComment] = useState("");
  const nowLabel = () => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const field = (name: string, node: ReactNode) => <div className="grid grid-cols-[110px_1fr] items-center gap-2 py-1.5"><span className="text-[11.5px] font-bold text-[var(--ink-3)]">{name}</span><div>{node}</div></div>;
  const inputCls = "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#1d3a8f]";
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="flex h-full w-full max-w-[460px] flex-col bg-[var(--surface)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-[var(--line)] px-4 py-3">
          <div className="flex items-center justify-between">
            <input value={task.t} onChange={(e) => onPatch({ t: e.target.value })} className="min-w-0 flex-1 rounded-lg px-1 text-[15px] font-extrabold outline-none focus:bg-[var(--panel)]" />
            <button type="button" onClick={onClose} className="ml-2 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--panel)] text-[15px] font-bold text-[var(--ink-2)]">×</button>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => onPatch({ status: task.status === "done" ? "todo" : "done" })} className="rounded-full px-2.5 py-1 text-[11px] font-extrabold" style={task.status === "done" ? { background: "#e7f6ee", color: "#0f8a4a" } : { background: "#eef4fd", color: "#1d3a8f" }}>{task.status === "done" ? "✓ Done — reopen" : "Mark complete"}</button>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--panel)] px-2 py-0.5 text-[11px] font-bold"><span className="h-2 w-2 rounded-full" style={{ background: PRIO[task.prio ?? "med"].dot }} />{PRIO[task.prio ?? "med"].label}</span>
            {task.link && <LinkChip link={task.link} />}
            {task.spawn && <span className="rounded bg-[#fdecc8] px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-[#8a6d1a]">auto</span>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {!noAssignee && field("Assignee", <><input list="team-list" value={task.who ?? ""} onChange={(e) => onPatch({ who: e.target.value })} placeholder="Unassigned" className={inputCls} /><datalist id="team-list">{team.map((w) => <option key={w} value={w} />)}</datalist></>)}
          {field("Due date", <input type="date" value={task.due ?? ""} onChange={(e) => onPatch({ due: e.target.value || null })} className={inputCls} />)}
          {field("Time", <input type="time" value={task.time ?? ""} onChange={(e) => onPatch({ time: e.target.value || null })} className={inputCls} />)}
          {field("Priority", <select value={task.prio ?? "med"} onChange={(e) => onPatch({ prio: e.target.value as Prio })} className={inputCls}>{(Object.keys(PRIO) as Prio[]).map((p) => <option key={p} value={p}>{PRIO[p].label}</option>)}</select>)}
          {field("Status", <select value={task.status ?? "todo"} onChange={(e) => onPatch({ status: e.target.value as Status })} className={inputCls}>{COLS.map((c) => <option key={c.k} value={c.k}>{c.label}</option>)}</select>)}
          {field("Linked to", <LinkedPicker link={task.link} onChange={(l) => onPatch({ link: l })} opts={opts} inputCls={inputCls} />)}

          <div className="mt-2 border-t border-[var(--line)] pt-2">
            <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Labels</div>
            <div className="flex flex-wrap gap-1.5">
              {(task.labels ?? []).map((l, i) => <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[var(--panel)] px-2 py-0.5 text-[11px] font-bold">{l}<button type="button" onClick={() => onPatch({ labels: (task.labels ?? []).filter((_, j) => j !== i) })} className="text-[var(--ink-3)]">×</button></span>)}
              <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && label.trim()) { onPatch({ labels: [...(task.labels ?? []), label.trim()] }); setLabel(""); } }} placeholder="+ label" className="w-[90px] rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] outline-none focus:border-[#1d3a8f]" />
            </div>
          </div>

          <div className="mt-3 border-t border-[var(--line)] pt-2">
            <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Subtasks {task.subs?.length ? `(${task.subs.filter((s) => s.done).length}/${task.subs.length})` : ""}</div>
            {(task.subs ?? []).map((s, i) => <label key={i} className="flex items-center gap-2 py-0.5 text-[12.5px]"><input type="checkbox" checked={s.done} onChange={() => onPatch({ subs: (task.subs ?? []).map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })} className="h-3.5 w-3.5 accent-[#16b364]" /><span className={s.done ? "text-[var(--ink-3)] line-through" : ""}>{s.t}</span></label>)}
            <input value={sub} onChange={(e) => setSub(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && sub.trim()) { onPatch({ subs: [...(task.subs ?? []), { t: sub.trim(), done: false }] }); setSub(""); } }} placeholder="+ add a subtask" className={`mt-1 ${inputCls}`} />
          </div>

          <div className="mt-3 border-t border-[var(--line)] pt-2">
            <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Comments</div>
            {(task.comments ?? []).map((c, i) => <div key={i} className="mb-1.5 rounded-lg bg-[var(--panel)] px-2.5 py-1.5 text-[12px]"><div className="font-bold">{c.who} <span className="font-normal text-[var(--ink-3)]">· {c.when}</span></div><div className="text-[var(--ink-2)]">{c.body}</div></div>)}
            <div className="flex gap-1.5"><input value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && comment.trim()) { onPatch({ comments: [...(task.comments ?? []), { who: me || "You", body: comment.trim(), when: nowLabel() }] }); setComment(""); } }} placeholder="Write a comment…" className={inputCls} /></div>
          </div>

          <div className="mt-3 border-t border-[var(--line)] pt-2">
            <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Attachments</div>
            {(task.atts ?? []).map((a, i) => <div key={i} className="text-[12px] text-[var(--ink-2)]">📎 {a.name}</div>)}
            <div className="text-[11px] text-[var(--ink-3)]">File uploads land here once storage ships.</div>
          </div>

          <div className="mt-3 border-t border-[var(--line)] pt-2">
            <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Events calendar</div>
            {!task.due ? (
              <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-3)]">Set a due date to show this task on the Events calendar.</div>
            ) : task.calEventId ? (
              <div className="rounded-lg border border-[#cfe8d8] bg-[#f0faf4] px-3 py-2">
                <div className="text-[12.5px] font-bold text-[#0f8a4a]">On the Events calendar</div>
                <div className="mt-0.5 text-[11px] text-[var(--ink-3)]">Its labels, subtasks and comments show in the event notes. Press update after you change them.</div>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={onSyncCal} className="rounded-lg bg-[#1d3a8f] px-3 py-1.5 text-[11.5px] font-extrabold text-white">Update event</button>
                  <button type="button" onClick={onUnsyncCal} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[11.5px] font-bold text-[var(--ink-2)]">Remove from calendar</button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-[#dbe6fb] bg-[#f2f7ff] px-3 py-2">
                <div className="text-[11px] text-[var(--ink-2)]">Also show this task on the Events calendar, carrying its labels, subtasks and comments into the event notes.</div>
                <button type="button" onClick={onSyncCal} className="mt-2 rounded-lg bg-[#1d3a8f] px-3 py-1.5 text-[11.5px] font-extrabold text-white">Show in Events calendar</button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-3">
          <button type="button" onClick={onDelete} className="rounded-lg border border-[#f6c9cc] px-3 py-1.5 text-[12px] font-bold text-[#c02636]">Delete</button>
          <div className="flex gap-2">
            <button type="button" onClick={onArchive} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">Archive</button>
            <Button sm variant="primary" onClick={onClose}>Done</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
