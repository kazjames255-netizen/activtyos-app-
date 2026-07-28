"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Button } from "@/components/ui";

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
type LinkKind = "camp" | "book" | "comp" | "venue" | "list" | "gen";
interface TaskLink { k: LinkKind; v: string }
interface Sub { t: string; done: boolean }
interface Comment { who: string; body: string; when: string }
interface Att { name: string }
interface Task {
  id: string; t: string; who?: string; prio?: Prio; due?: string | null; status?: Status;
  link?: TaskLink | null; co?: string; cat?: string; labels?: string[]; subs?: Sub[]; comments?: Comment[]; atts?: Att[];
  spawn?: boolean; archived?: boolean; createdByName?: string;
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
const LINK: Record<LinkKind, { label: string; bg: string; fg: string; icon: string }> = {
  camp: { label: "Camp", bg: "#e6f4fd", fg: "#1f78ab", icon: "⛺" }, book: { label: "Booking", bg: "#efeaff", fg: "#5b3fd8", icon: "🎫" },
  comp: { label: "Compliance", bg: "#fde2e4", fg: "#c02636", icon: "🛡️" }, venue: { label: "Venue", bg: "#e5f6ec", fg: "#0f8a4a", icon: "📍" },
  list: { label: "Listing", bg: "#e6f0ff", fg: "#2f5fd8", icon: "📋" }, gen: { label: "Category", bg: "#f1f2f6", fg: "#5b6478", icon: "🏷️" },
};
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
  const [tab, setTab] = useState<"mine" | "team" | "board" | "cal" | "archive">("mine");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [qa, setQa] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [teamSort, setTeamSort] = useState<"up" | "down">("up");
  const [calAnchor, setCalAnchor] = useState(() => todayIso());
  const [calView, setCalView] = useState<"day" | "week" | "month">("month");
  const [drag, setDrag] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [prioFilter, setPrioFilter] = useState<Prio | "">("");
  const [kpiFilter, setKpiFilter] = useState<"" | "open" | "overdue" | "week" | "unassigned">("");
  const [listings, setListings] = useState<{ id: string; title: string; location?: string }[]>([]);
  const today = todayIso();
  const manager = role === "company" || role === "franchise";
  const isFreelancer = role === "freelancer";
  // A solo freelancer has no team — assignment is meaningless, so every task is
  // theirs and the assignee UI is hidden.
  const noAssignee = isFreelancer;

  const refresh = useCallback(() => {
    apiGet<Task[]>("/api/tasks").then((t) => { setTasks(t); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string; name?: string; email?: string }>("/api/me").then((m) => { setRole(m.role); setMe(m.name || m.email || ""); }).catch(() => {}); }, []);
  useEffect(() => { apiGet<{ id: string; title?: string; name?: string; location?: string }[]>("/api/listings?mine=1").then((l) => setListings(l.map((x) => ({ id: x.id, title: x.title || x.name || "Listing", location: x.location })))).catch(() => {}); }, []);
  useRealtime(["tasks"], refresh);

  const everything = useMemo(() => tasks ?? [], [tasks]);
  const all = useMemo(() => everything.filter((t) => !t.archived), [everything]);
  const archived = useMemo(() => everything.filter((t) => t.archived), [everything]);
  // For a freelancer every task is "mine"; otherwise match on assignee.
  const mineOf = (t: Task) => noAssignee || (t.who || "").trim().toLowerCase() === me.trim().toLowerCase();
  const team = useMemo(() => [...new Set(all.map((t) => t.who).filter((w): w is string => !!w && w.trim() !== ""))].sort(), [all]);
  const cats = useMemo(() => [...new Set(all.map((t) => t.cat).filter((c): c is string => !!c && c.trim() !== ""))].sort(), [all]);
  const venues = useMemo(() => [...new Set(listings.map((l) => l.location).filter((v): v is string => !!v))].sort(), [listings]);

  async function create(fields: Partial<Task>) {
    try { await apiPost("/api/tasks", { status: "todo", prio: "med", ...fields }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t add the task"); }
  }
  async function patch(id: string, fields: Partial<Task>) {
    setTasks((ts) => (ts ?? []).map((t) => (t.id === id ? { ...t, ...fields } : t))); // optimistic
    try { await api(`/api/tasks/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(fields) }); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); refresh(); }
  }
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
    create({ t: p.t, who: noAssignee ? "" : (p.who ?? ""), prio: p.prio ?? "med", link: p.link ?? null, due: p.due ?? null });
    setQa("");
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
  const base = all.filter((t) => (!prioFilter || t.prio === prioFilter) && kpiMatch(t) && searchMatch(t));
  const filtersActive = !!term || !!prioFilter || !!kpiFilter;
  const clearFilters = () => { setSearch(""); setPrioFilter(""); setKpiFilter(""); };

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
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[16px]">✓</span>Task manager</div>
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

      {/* Quick add */}
      <div className="mb-3 rounded-2xl border border-[#dbe6fb] bg-[var(--surface)] p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input value={qa} onChange={(e) => setQa(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addQuick(); }} placeholder={`Quick add…   try:  Brief coaches tomorrow ${noAssignee ? "" : "@Jess "}!high #Riverside`} className="min-w-[240px] flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] outline-none focus:border-[#1d3a8f]" />
          <Button onClick={addQuick}>Quick add</Button>
          <Button variant="primary" onClick={() => setCreating(true)}>+ New task</Button>
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
      </div>

      {/* Tabs + toolbar */}
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
        {TABS.map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className="rounded-full border px-3.5 py-1.5 text-[12px] font-bold" style={tab === k ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>{l}</button>)}
        <div className="relative ml-auto">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks…" className="w-[190px] rounded-full border border-[var(--line)] bg-[var(--surface)] py-1.5 pl-8 pr-3 text-[12px] outline-none focus:border-[#1d3a8f]" />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--ink-3)]">🔎</span>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Priority</span>
        {(["urgent", "high", "med", "low"] as Prio[]).map((p) => <button key={p} type="button" onClick={() => setPrioFilter(prioFilter === p ? "" : p)} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={prioFilter === p ? { borderColor: PRIO[p].dot, background: `${PRIO[p].dot}1a`, color: PRIO[p].dot } : { borderColor: "var(--line)", color: "var(--ink-2)" }}><span className="h-2 w-2 rounded-full" style={{ background: PRIO[p].dot }} />{PRIO[p].label}</button>)}
        {filtersActive && <><button type="button" onClick={clearFilters} className="ml-1 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-3)]">Clear ✕</button><span className="text-[11.5px] text-[var(--ink-3)]">{base.length} match{base.length === 1 ? "" : "es"}</span></>}
      </div>

      {isFreelancer && tab === "mine" && <div className="mb-2 rounded-xl border border-[#dbe6fb] bg-[#f2f7ff] px-3 py-2 text-[12px] text-[var(--ink-2)]"><b>One inbox across every company you work for</b> — tasks from all the providers you coach for land here together, each badged with the company it belongs to.</div>}

      {/* Views */}
      {all.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-14 text-center">
          <div className="text-[15px] font-extrabold">No tasks yet</div>
          <p className="mx-auto mt-1 max-w-[440px] text-[12.5px] text-[var(--ink-3)]">Add your first with the quick-add above — try <b>Set up Week 3 registers tomorrow @Sam !high #Bedford</b>. Some will also appear on their own once the auto-spawn engine ships.</p>
        </div>
      ) : (<>
        {tab === "mine" && <MyTasks tasks={base.filter(mineOf)} today={today} onOpen={setOpenId} onToggle={(t) => patch(t.id, { status: t.status === "done" ? "todo" : "done" })} />}
        {tab === "board" && <Board tasks={base} onOpen={setOpenId} drag={drag} setDrag={setDrag} onDrop={(id, s) => patch(id, { status: s })} onDone={(t) => patch(t.id, { status: t.status === "done" ? "todo" : "done" })} />}
        {tab === "cal" && <Calendar tasks={base.filter((t) => t.status !== "done")} anchor={calAnchor} setAnchor={setCalAnchor} view={calView} setView={setCalView} today={today} onOpen={setOpenId} />}
        {tab === "team" && manager && <TeamView tasks={base} team={team} filter={teamFilter} setFilter={setTeamFilter} sort={teamSort} setSort={setTeamSort} today={today} onOpen={setOpenId} onToggle={(t) => patch(t.id, { status: t.status === "done" ? "todo" : "done" })} />}
        {tab === "archive" && <ArchiveView tasks={archived} onOpen={setOpenId} onUnarchive={(t) => patch(t.id, { archived: false })} />}
      </>)}

      {creating && <CreateModal noAssignee={noAssignee} team={team} cats={cats} venues={venues} listings={listings} onClose={() => setCreating(false)} onCreate={(f) => { create(f); setCreating(false); }} />}
      {openTask && <Drawer task={openTask} team={team} noAssignee={noAssignee} me={me} cats={cats} venues={venues} listings={listings} onClose={() => setOpenId(null)} onPatch={(f) => patch(openTask.id, f)} onArchive={() => { patch(openTask.id, { archived: true }); setOpenId(null); }} onDelete={() => remove(openTask.id)} />}
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
          {t.link && <span className="flex-none rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: LINK[t.link.k].bg, color: LINK[t.link.k].fg }}>{LINK[t.link.k].icon} {t.link.v}</span>}
          {t.due && <span className="flex-none text-[11px] text-[var(--ink-3)]">{fmtDay(t.due)}</span>}
          <button type="button" onClick={() => onUnarchive(t)} className="flex-none rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[#1d3a8f] hover:bg-[#eef4fd]">↩ Unarchive</button>
        </div>
      ))}
    </div>
  );
}

// ── My Tasks — grouped list ─────────────────────────────────────────────────
function MyTasks({ tasks, today, onOpen, onToggle }: { tasks: Task[]; today: string; onOpen: (id: string) => void; onToggle: (t: Task) => void }) {
  const open = tasks.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => t.due && daysBetween(today, t.due) < 0).sort(byPrioDue);
  const todayT = open.filter((t) => t.due && daysBetween(today, t.due) === 0).sort(byPrioDue);
  const upcoming = open.filter((t) => !t.due || daysBetween(today, t.due) > 0).sort((a, b) => `${a.due ?? "9999"}`.localeCompare(`${b.due ?? "9999"}`) || byPrioDue(a, b));
  const done = tasks.filter((t) => t.status === "done");
  const groups: [string, Task[], string][] = [["Overdue", overdue, "Nothing overdue — nice."], ["Today", todayT, "Clear for today."], ["Upcoming", upcoming, "Nothing scheduled."], ["Done", done, "Nothing done yet."]];
  return (
    <div className="space-y-4">
      {groups.map(([title, list, empty]) => (
        <div key={title}>
          <div className="mb-1.5 flex items-center gap-2"><span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{title}</span><span className="rounded-full bg-[var(--panel)] px-1.5 text-[10.5px] font-bold text-[var(--ink-3)]">{list.length}</span></div>
          {list.length === 0 ? <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[12px] text-[var(--ink-3)]">{empty}</div>
            : <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">{list.map((t) => <TaskRow key={t.id} t={t} today={today} onOpen={onOpen} onToggle={onToggle} />)}</div>}
        </div>
      ))}
    </div>
  );
}

function TaskRow({ t, today, onOpen, onToggle }: { t: Task; today: string; onOpen: (id: string) => void; onToggle: (t: Task) => void }) {
  const done = t.status === "done";
  const dl = dueLabel(t.due, today);
  const subs = t.subs ?? [];
  const isOverdue = !done && !!t.due && daysBetween(today, t.due) < 0;
  return (
    <div className="flex items-center gap-2.5 border-b border-[var(--line)] px-3 py-2.5 transition-colors last:border-b-0 hover:bg-[#f7faff]" style={isOverdue ? { boxShadow: "inset 3px 0 0 #c02636" } : undefined}>
      <button type="button" onClick={() => onToggle(t)} aria-label="Toggle done" className="flex h-5 w-5 flex-none items-center justify-center rounded-full border-2" style={{ borderColor: done ? "#16b364" : "var(--line)", background: done ? "#16b364" : "transparent", color: "#fff" }}>{done ? "✓" : ""}</button>
      <span className="h-2 w-2 flex-none rounded-full" style={{ background: PRIO[t.prio ?? "med"].dot }} />
      <button type="button" onClick={() => onOpen(t.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className={`truncate text-[13px] ${done ? "text-[var(--ink-3)] line-through" : "font-bold"}`}>{t.t}</span>
        {t.spawn && <span className="flex-none rounded bg-[#fdecc8] px-1.5 text-[9.5px] font-extrabold uppercase text-[#8a6d1a]">auto</span>}
        {t.co && <span className="flex-none rounded-full bg-[var(--panel)] px-2 text-[10.5px] font-bold text-[var(--ink-2)]">{t.co}</span>}
        {subs.length > 0 && <span className="flex-none text-[10.5px] text-[var(--ink-3)]">☑ {subs.filter((s) => s.done).length}/{subs.length}</span>}
        {t.link && <span className="flex-none rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: LINK[t.link.k].bg, color: LINK[t.link.k].fg }}>{LINK[t.link.k].icon} {t.link.v}</span>}
      </button>
      {dl && <span className="flex-none text-[11px] font-bold" style={{ color: dl.color }}>{dl.text}</span>}
      {t.who ? <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[9.5px] font-extrabold text-[var(--ink-2)]" style={{ background: avBg(t.who) }} title={t.who}>{initials(t.who)}</span>
        : <span className="flex-none text-[10.5px] text-[var(--ink-3)]">Unassigned</span>}
    </div>
  );
}

// ── Board — kanban with drag ────────────────────────────────────────────────
function Board({ tasks, onOpen, drag, setDrag, onDrop, onDone }: { tasks: Task[]; onOpen: (id: string) => void; drag: string | null; setDrag: (id: string | null) => void; onDrop: (id: string, s: Status) => void; onDone: (t: Task) => void }) {
  const [over, setOver] = useState<Status | null>(null);
  const today = todayIso();
  return (
    <>
      <div className="grid gap-2.5 md:grid-cols-4">
        {COLS.map((c) => {
          const list = tasks.filter((t) => (t.status ?? "todo") === c.k).slice().sort(byPrioDue);
          return (
            <div key={c.k} onDragOver={(e) => { e.preventDefault(); setOver(c.k); }} onDragLeave={() => setOver((o) => (o === c.k ? null : o))} onDrop={() => { if (drag) onDrop(drag, c.k); setDrag(null); setOver(null); }}
              className="rounded-2xl border bg-[var(--surface)] p-2 transition-colors" style={{ borderColor: over === c.k ? c.color : "var(--line)", background: over === c.k ? "#f7faff" : "var(--surface)" }}>
              <div className="mb-1.5 flex items-center gap-1.5 px-1 py-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} /><span className="text-[11.5px] font-extrabold uppercase tracking-wide" style={{ color: c.color }}>{c.label}</span><span className="ml-auto rounded-full bg-[var(--panel)] px-1.5 text-[10.5px] font-bold text-[var(--ink-3)]">{list.length}</span></div>
              <div className="space-y-1.5">
                {list.map((t) => {
                  const dl = dueLabel(t.due, today);
                  const isOverdue = t.status !== "done" && !!t.due && daysBetween(today, t.due) < 0;
                  return (
                  <div key={t.id} draggable onDragStart={() => setDrag(t.id)} onDragEnd={() => setDrag(null)} onClick={() => onOpen(t.id)}
                    className="cursor-grab rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing" style={isOverdue ? { boxShadow: "inset 3px 0 0 #c02636" } : undefined}>
                    <div className="flex items-start gap-1.5">
                      <button type="button" title={t.status === "done" ? "Reopen" : "Mark done"} onClick={(e) => { e.stopPropagation(); onDone(t); }} className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border-2 text-[9px]" style={{ borderColor: t.status === "done" ? "#16b364" : "var(--line)", background: t.status === "done" ? "#16b364" : "transparent", color: "#fff" }}>{t.status === "done" ? "✓" : ""}</button>
                      <span className={`text-[12.5px] leading-snug ${t.status === "done" ? "text-[var(--ink-3)] line-through" : "font-bold"}`}>{t.t}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      {t.spawn && <span className="rounded bg-[#fdecc8] px-1.5 text-[9px] font-extrabold uppercase text-[#8a6d1a]">auto</span>}
                      {t.link && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: LINK[t.link.k].bg, color: LINK[t.link.k].fg }}>{LINK[t.link.k].icon} {t.link.v}</span>}
                      {dl && t.status !== "done" && <span className="text-[10px] font-bold" style={{ color: dl.color }}>{dl.text}</span>}
                      {t.who && <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-extrabold text-[var(--ink-2)]" style={{ background: avBg(t.who) }} title={t.who}>{initials(t.who)}</span>}
                    </div>
                  </div>
                  );
                })}
                {list.length === 0 && <div className="rounded-xl border border-dashed border-[var(--line)] py-4 text-center text-[11px] text-[var(--ink-3)]">Drop here</div>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-[var(--ink-3)]">Drag a card between columns to move it, or click to open.</p>
    </>
  );
}

// ── Calendar — Day / Week / Month ───────────────────────────────────────────
function Calendar({ tasks, anchor, setAnchor, view, setView, today, onOpen }: { tasks: Task[]; anchor: string; setAnchor: (d: string) => void; view: "day" | "week" | "month"; setView: (v: "day" | "week" | "month") => void; today: string; onOpen: (id: string) => void }) {
  const on = (iso: string) => tasks.filter((t) => t.due === iso).slice().sort(byPrioDue);
  const dowMon = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7; // 0=Mon
  const weekStart = shiftIso(anchor, -dowMon(anchor));
  const step = view === "day" ? 1 : view === "week" ? 7 : 0;
  const stepBy = (dir: number) => { if (view === "month") { const [y, m] = anchor.split("-").map(Number); setAnchor(new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10)); } else setAnchor(shiftIso(anchor, dir * step)); };
  const title = view === "day" ? new Date(`${anchor}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : view === "week" ? `Week of ${fmtDay(weekStart)}`
    : new Date(`${anchor}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const chip = (t: Task) => <button key={t.id} type="button" onClick={() => onOpen(t.id)} className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[10.5px] font-bold text-white" style={{ background: PRIO[t.prio ?? "med"].dot }} title={t.t}>{t.t}</button>;
  const fullChip = (t: Task) => <button key={t.id} type="button" onClick={() => onOpen(t.id)} className="flex w-full items-center gap-2 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-left text-[12.5px] hover:bg-[#f7faff]"><span className="h-2 w-2 flex-none rounded-full" style={{ background: PRIO[t.prio ?? "med"].dot }} /><span className="min-w-0 flex-1 truncate font-bold">{t.t}</span>{t.link && <span className="flex-none rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: LINK[t.link.k].bg, color: LINK[t.link.k].fg }}>{LINK[t.link.k].icon} {t.link.v}</span>}{t.who && <span className="flex-none text-[10.5px] text-[var(--ink-3)]">{t.who}</span>}</button>;

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

// ── Linked-to picker (shared by create + drawer) ────────────────────────────
function LinkedPicker({ link, onChange, venues, listings, cats, inputCls }: { link: TaskLink | null | undefined; onChange: (l: TaskLink | null) => void; venues: string[]; listings: { id: string; title: string }[]; cats: string[]; inputCls: string }) {
  const k = link?.k ?? "";
  const setK = (nk: string) => onChange(nk ? { k: nk as LinkKind, v: "" } : null);
  const setV = (v: string) => onChange({ k: (link?.k ?? "gen") as LinkKind, v });
  return (
    <div className="space-y-1.5">
      <select value={k} onChange={(e) => setK(e.target.value)} className={inputCls}>
        <option value="">— not linked —</option>
        {(Object.keys(LINK) as LinkKind[]).map((kk) => <option key={kk} value={kk}>{LINK[kk].label}</option>)}
      </select>
      {k === "venue" && (venues.length ? <select value={link?.v ?? ""} onChange={(e) => setV(e.target.value)} className={inputCls}><option value="">Choose a venue…</option>{venues.map((v) => <option key={v} value={v}>{v}</option>)}</select> : <input value={link?.v ?? ""} onChange={(e) => setV(e.target.value)} placeholder="Venue name" className={inputCls} />)}
      {k === "list" && (listings.length ? <select value={link?.v ?? ""} onChange={(e) => setV(e.target.value)} className={inputCls}><option value="">Choose a listing…</option>{listings.map((l) => <option key={l.id} value={l.title}>{l.title}</option>)}</select> : <input value={link?.v ?? ""} onChange={(e) => setV(e.target.value)} placeholder="Listing name" className={inputCls} />)}
      {k === "gen" && <><input list="task-cats" value={link?.v ?? ""} onChange={(e) => setV(e.target.value)} placeholder="Category — type a new one or pick" className={inputCls} /><datalist id="task-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></>}
      {(k === "camp" || k === "book" || k === "comp") && <input value={link?.v ?? ""} onChange={(e) => setV(e.target.value)} placeholder={k === "camp" ? "e.g. Summer Camp · Wk1" : k === "book" ? "e.g. #APF-1042" : "e.g. DBS · Tom"} className={inputCls} />}
    </div>
  );
}

// ── Create-task modal ───────────────────────────────────────────────────────
function CreateModal({ noAssignee, team, cats, venues, listings, onClose, onCreate }: { noAssignee: boolean; team: string[]; cats: string[]; venues: string[]; listings: { id: string; title: string }[]; onClose: () => void; onCreate: (f: Partial<Task>) => void }) {
  const [t, setT] = useState("");
  const [who, setWho] = useState("");
  const [prio, setPrio] = useState<Prio>("med");
  const [due, setDue] = useState("");
  const [status, setStatus] = useState<Status>("todo");
  const [link, setLink] = useState<TaskLink | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [labelIn, setLabelIn] = useState("");
  const inputCls = "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[12.5px] outline-none focus:border-[#1d3a8f]";
  const fieldRow = (name: string, node: ReactNode) => <div><div className="mb-0.5 text-[11px] font-bold text-[var(--ink-3)]">{name}</div>{node}</div>;
  const submit = () => { if (!t.trim()) return; onCreate({ t: t.trim(), who: noAssignee ? "" : who, prio, due: due || null, status, link, labels }); };
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
            {fieldRow("Priority", <select value={prio} onChange={(e) => setPrio(e.target.value as Prio)} className={inputCls}>{(Object.keys(PRIO) as Prio[]).map((p) => <option key={p} value={p}>{PRIO[p].label}</option>)}</select>)}
            {!noAssignee && fieldRow("Assignee", <><input list="team-list-c" value={who} onChange={(e) => setWho(e.target.value)} placeholder="Unassigned" className={inputCls} /><datalist id="team-list-c">{team.map((w) => <option key={w} value={w} />)}</datalist></>)}
            {fieldRow("Status", <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className={inputCls}>{COLS.map((c) => <option key={c.k} value={c.k}>{c.label}</option>)}</select>)}
          </div>
          {fieldRow("Linked to", <LinkedPicker link={link} onChange={setLink} venues={venues} listings={listings} cats={cats} inputCls={inputCls} />)}
          {fieldRow("Labels", <div className="flex flex-wrap gap-1.5">{labels.map((l, i) => <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[var(--panel)] px-2 py-0.5 text-[11px] font-bold">{l}<button type="button" onClick={() => setLabels(labels.filter((_, j) => j !== i))} className="text-[var(--ink-3)]">×</button></span>)}<input value={labelIn} onChange={(e) => setLabelIn(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && labelIn.trim()) { setLabels([...labels, labelIn.trim()]); setLabelIn(""); } }} placeholder="+ label" className="w-[100px] rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] outline-none focus:border-[#1d3a8f]" /></div>)}
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
function TeamView({ tasks, team, filter, setFilter, sort, setSort, today, onOpen, onToggle }: { tasks: Task[]; team: string[]; filter: string; setFilter: (s: string) => void; sort: "up" | "down"; setSort: (s: "up" | "down") => void; today: string; onOpen: (id: string) => void; onToggle: (t: Task) => void }) {
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
              <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">{list.map((t) => <TaskRow key={t.id} t={t} today={today} onOpen={onOpen} onToggle={onToggle} />)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Detail drawer ───────────────────────────────────────────────────────────
function Drawer({ task, team, noAssignee, me, cats, venues, listings, onClose, onPatch, onArchive, onDelete }: { task: Task; team: string[]; noAssignee: boolean; me: string; cats: string[]; venues: string[]; listings: { id: string; title: string }[]; onClose: () => void; onPatch: (f: Partial<Task>) => void; onArchive: () => void; onDelete: () => void }) {
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
            {task.link && <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: LINK[task.link.k].bg, color: LINK[task.link.k].fg }}>{LINK[task.link.k].icon} {task.link.v}</span>}
            {task.spawn && <span className="rounded bg-[#fdecc8] px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-[#8a6d1a]">auto</span>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {!noAssignee && field("Assignee", <><input list="team-list" value={task.who ?? ""} onChange={(e) => onPatch({ who: e.target.value })} placeholder="Unassigned" className={inputCls} /><datalist id="team-list">{team.map((w) => <option key={w} value={w} />)}</datalist></>)}
          {field("Due date", <input type="date" value={task.due ?? ""} onChange={(e) => onPatch({ due: e.target.value || null })} className={inputCls} />)}
          {field("Priority", <select value={task.prio ?? "med"} onChange={(e) => onPatch({ prio: e.target.value as Prio })} className={inputCls}>{(Object.keys(PRIO) as Prio[]).map((p) => <option key={p} value={p}>{PRIO[p].label}</option>)}</select>)}
          {field("Status", <select value={task.status ?? "todo"} onChange={(e) => onPatch({ status: e.target.value as Status })} className={inputCls}>{COLS.map((c) => <option key={c.k} value={c.k}>{c.label}</option>)}</select>)}
          {field("Linked to", <LinkedPicker link={task.link} onChange={(l) => onPatch({ link: l })} venues={venues} listings={listings} cats={cats} inputCls={inputCls} />)}

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
