"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { LinkBadge, normaliseUrl, urlKind } from "@/features/common/LinkBadge";
import { useRealtime } from "@/lib/realtime";
import { displayName, looksDerived } from "@/lib/display-name";
import { isMine as isMineOf, hasMySub, whoLabel as whoLabelOf, personLabel as personLabelOf, foldRepeats, REPEAT_WORD, type Person } from "./taskDisplay";
import { useSettings, notificationChannel, type NotifyChannel } from "@/lib/settings";
import { MilestonesApp } from "@/features/milestones/MilestonesApp";
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
const HERO = "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 100%)";
const BLUE = "#1d3a8f";

type Prio = "urgent" | "high" | "med" | "low";
type Status = "backlog" | "todo" | "prog" | "done";
type LinkKind = "child" | "parent" | "camp" | "book" | "comp" | "venue" | "list" | "gen" | "sales";
interface TaskLink { k: LinkKind; v: string; href?: string }
// `who` is the assignee's name, matching Task.who — a subtask can be owned by
// someone other than whoever owns the parent ("book the minibus" is the office,
// "load the kit" is the coach), which is the whole reason to split it out.
// `whoEmail` is set when the step's owner was picked from the team list, so the
// step reaches THEM (their My tasks) even if two people share a name (d11s8).
interface Sub { t: string; done: boolean; who?: string; whoEmail?: string }
/** A step's owner from what was typed: a known team name attaches their email. */
const subOwner = (who: string, team: { name: string; email: string }[]): Pick<Sub, "who" | "whoEmail"> => {
  const w = who.trim();
  if (!w) return { who: "", whoEmail: "" };
  const hit = team.find((p) => p.name.toLowerCase() === w.toLowerCase());
  return { who: w, whoEmail: hit?.email ?? "" };
};
interface Comment { who: string; body: string; when: string }
interface Att { name: string }
/** A web link on a task — Google Drive/Docs/Sheets, Dropbox, OneDrive, any page. */
interface TaskUrl { url: string; title?: string; by?: string; at?: string }
interface Task {
  id: string; t: string; who?: string; prio?: Prio; due?: string | null; time?: string | null; status?: Status;
  link?: TaskLink | null; co?: string; cat?: string; labels?: string[]; subs?: Sub[]; comments?: Comment[]; atts?: Att[];
  urls?: TaskUrl[];
  // The assignee's email alongside the display name. Names aren't unique and
  // change; this is what actually identifies the person.
  whoEmail?: string;
  spawn?: boolean; archived?: boolean; createdByName?: string; calEventId?: string | null;
  // Server-set for STAFF given only a step on someone else's task: they may
  // tick their own step(s) and comment, nothing else (server/src/routes/tasks.ts).
  subtaskOnly?: boolean;
  // Set on create only; the server expands it into one task per date.
  repeat?: { freq: "daily" | "weekdays" | "weekly" | "monthly"; until: string };
  // Present on every task the server generated from a repeat, tying the series
  // together so the whole run can be removed in one go.
  seriesId?: string; seriesFreq?: string; seriesUntil?: string; seriesFrom?: string;
}

// Priority used to share the status palette outright — High WAS In-progress
// amber, Medium WAS To-do blue, Low WAS Backlog grey — so a blue dot beside a
// blue "To do" pill meant two unrelated things.
// Fixed with FOUR DISTINCT HUES running hot→cool, not one hue at four depths:
// a violet ramp separated it from status but made Urgent and Low near-identical,
// which is the worse failure — priority has to be readable at a glance.
// Red → pink → violet → dark slate: none of them is status blue, amber, green
// or the mid-grey of Backlog — the PRIORITY chips sit directly above the column
// headers, so a Low that was merely greyish landed right on top of Backlog.
const PRIO: Record<Prio, { label: string; dot: string }> = {
  // Red → orange → dark blue → slate: urgent and high were two reds (red and
  // pink) that read as the same thing at a glance.
  urgent: { label: "Urgent", dot: "#dc2626" }, high: { label: "High", dot: "#ea580c" },
  med: { label: "Medium", dot: "#1e40af" }, low: { label: "Low", dot: "#475569" },
};
const PRANK: Record<Prio, number> = { urgent: 0, high: 1, med: 2, low: 3 };
// The calendar paints a priority colour as a chip's GROUND. White on the pale
// end of the violet ramp is ~1.9:1, so the ink follows the background instead
// of being hardcoded.
const inkOn = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16);
  const lin = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2] > 0.35 ? "#1f1147" : "#fff";
};
// Sort: most urgent first, then soonest due (null due sinks last).
const byPrioDue = (a: Task, b: Task) => (PRANK[a.prio ?? "med"] - PRANK[b.prio ?? "med"]) || `${a.due ?? "9999-99"}`.localeCompare(`${b.due ?? "9999-99"}`);
// Inside a single day the list is a TIMELINE, so the clock wins: 09:38 before
// 10:00 before 11:00. Priority ordered it before, which put an urgent 09:38
// first but then read 11:00, 10:00 — a day plan you can't follow. Tasks with no
// time have nothing to slot them between, so they sit after the timed ones, by
// priority.
const byTimeThenPrio = (a: Task, b: Task) => {
  const at = (a.time ?? "").trim(); const bt = (b.time ?? "").trim();
  if (at && bt) return at.localeCompare(bt) || byPrioDue(a, b);
  if (at !== bt) return at ? -1 : 1;
  return byPrioDue(a, b);
};
// Shared empty-array reference for "no tasks in this bucket" lookups below, so
// a miss doesn't hand out a fresh array every call.
const EMPTY_TASKS: Task[] = [];
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
  sales: { label: "Sales", bg: "#fff4e5", fg: "#a5600a", icon: "💼" },
};
// The types the picker offers (old camp/comp still render on legacy tasks).
const LINK_TYPES: LinkKind[] = ["child", "parent", "book", "list", "venue", "gen"];
// HQ has no children or bookings — it has a sales pipeline. Its picker offers
// leads instead, and those tasks surface back on the Sales board.
const LINK_TYPES_PLATFORM: LinkKind[] = ["sales", "gen"];
export interface LinkOpts { portal: string; salesOpts?: { id: string; v: string; sub?: string }[]; bookOpts: { ref: string; v: string; sub?: string }[]; childOpts: { name: string; ref: string; sub?: string }[]; parentOpts: { name: string; ref: string; sub?: string }[]; listings: { id: string; title: string; location?: string }[]; locations: string[]; cats: string[];
  // Categories currently on a task. Those can't be forgotten — they'd just come
  // straight back — so only the rest offer a ×.
  catsInUse?: string[]; onForgetCat?: (c: string) => void }

// ── Category colours ────────────────────────────────────────────────────────
// Each category gets its own colour. Priority already speaks in colour, so this
// palette deliberately steers clear of its four — urgent red, high amber,
// medium blue, low grey — and priority keeps its own channel (the dot and the
// card's left edge) rather than sharing the chip.
const CAT_COL: { label: string; bg: string; fg: string }[] = [
  { label: "Violet", bg: "#efe9fe", fg: "#5b3fd8" },
  { label: "Teal", bg: "#dcf3ee", fg: "#0d7a68" },
  { label: "Pink", bg: "#fde7f0", fg: "#b5266b" },
  { label: "Green", bg: "#e3f4e2", fg: "#2b7a30" },
  { label: "Indigo", bg: "#e6eafb", fg: "#3a45a8" },
  { label: "Cyan", bg: "#ddeffa", fg: "#0e6f96" },
  { label: "Plum", bg: "#f6e6f6", fg: "#8a2f8a" },
  { label: "Olive", bg: "#eef2dc", fg: "#5c6b1c" },
  { label: "Clay", bg: "#f6e9df", fg: "#8a5228" },
  { label: "Lime", bg: "#edf7d8", fg: "#4e7a0f" },
  { label: "Slate", bg: "#e6ecf5", fg: "#3f5a80" },
  { label: "Magenta", bg: "#fbe6f7", fg: "#a41f7a" },
];
// Stable per-name pick — the same category always wears the same colour, so it
// doesn't change under you as the list grows.
const hashCol = (name: string) => [...(name || "?").toLowerCase()].reduce((a, c) => a + c.charCodeAt(0), 0) % CAT_COL.length;
// …but a hash alone can hand two categories the SAME colour, which is the one
// thing this is meant to prevent. The page registers the categories in play and
// any collision walks to the next free swatch, so everything on screen is
// distinct (up to CAT_COL.length categories; past that they start repeating).
let CAT_ASSIGN: Record<string, number> = {};
function assignCatColours(cats: string[]) {
  const taken = new Set<number>(); const out: Record<string, number> = {};
  for (const c of [...cats].sort((a, b) => a.localeCompare(b))) {
    let i = hashCol(c);
    for (let n = 0; n < CAT_COL.length && taken.has(i); n++) i = (i + 1) % CAT_COL.length;
    taken.add(i); out[c.trim().toLowerCase()] = i;
  }
  CAT_ASSIGN = out;
}
const catCol = (name: string) => CAT_COL[CAT_ASSIGN[(name || "").trim().toLowerCase()] ?? hashCol(name)];
// The colour on its own — a key dot for pickers and legends.
function CatSwatch({ name, size = 10 }: { name: string; size?: number }) {
  const c = catCol(name);
  return <span aria-hidden className="inline-block flex-none rounded-full" style={{ width: size, height: size, background: c.fg }} />;
}

/** Every link on the tasks that aren't archived, in one place — the file you
 *  need for today without hunting for the task it's on. Archived tasks'
 *  links drop out with the task. */
function QuickLinks({ tasks, me, onOpen }: { tasks: Task[]; me: string; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);
  // One row per LINK, not per task: a repeating task carries the same link on
  // every date, which listed one spreadsheet 24 times.
  // This is a plain-body loop over every task's urls, which used to re-run on
  // EVERY render of QuickLinks — including one caused by typing in the page's
  // main search box above, which re-renders the whole TasksApp tree, whether
  // or not this popover is even open. Memoized on `tasks` (a tenant's whole
  // non-archived task history) so it only redoes the work when the tasks
  // themselves change.
  const byUrl = useMemo(() => {
    const m = new Map<string, { u: TaskUrl; tasks: Task[] }>();
    for (const t of tasks) for (const u of t.urls ?? []) {
      const g = m.get(u.url);
      if (!g) m.set(u.url, { u, tasks: [t] });
      else { if (!g.tasks.includes(t)) g.tasks.push(t); if (!g.u.title && u.title) g.u = u; }
    }
    return m;
  }, [tasks]);
  const today = new Date().toISOString().slice(0, 10);
  // The task a link row opens: the next one due from today, else the latest.
  const nextOf = (ts: Task[]) => [...ts].sort((a, b) => { const ka = a.due ?? "9999", kb = b.due ?? "9999"; const fa = ka >= today, fb = kb >= today; return fa !== fb ? (fa ? -1 : 1) : fa ? ka.localeCompare(kb) : kb.localeCompare(ka); })[0];
  const term = q.trim().toLowerCase();
  // The filter/sort below only matters while the popover is open — no point
  // paying for it (however small) on renders where nobody can see `rows`.
  const rows = open ? [...byUrl.values()]
    .filter(({ u, tasks: ts }) => (!mine || (u.by ?? "") === me) && (!term || [u.title ?? "", u.url, urlKind(u.url).label, ...ts.map((t) => t.t)].some((x) => x.toLowerCase().includes(term))))
    .sort((a, b) => (nextOf(a.tasks).due ?? "9999").localeCompare(nextOf(b.tasks).due ?? "9999")) : [];
  return (
    <span className="relative shrink-0">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} title="All the links on your open tasks"
        className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[12.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">
        🔗 Quick links{byUrl.size ? ` (${byUrl.size})` : ""}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[150]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-[151] mt-1.5 w-[min(420px,90vw)] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2.5 shadow-[0_24px_60px_-20px_rgba(15,23,42,.5)]">
            <div className="mb-2 flex items-center gap-2">
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search links or tasks…" className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#1d3a8f]" />
              <label className="flex flex-none items-center gap-1 text-[11.5px] font-bold text-[var(--ink-2)]"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />Added by me</label>
            </div>
            <div className="max-h-[360px] space-y-1 overflow-auto">
              {rows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--line)] px-3 py-6 text-center text-[12px] text-[var(--ink-3)]">
                  {byUrl.size ? "No links match." : "No links yet — open a task and paste one under Links, or paste a link straight into Quick add."}
                </div>
              ) : rows.map(({ u, tasks: ts }) => { const k = urlKind(u.url); const nt = nextOf(ts); const names = [...new Set(ts.map((t) => t.t))]; return (
                <div key={u.url} className="rounded-xl border border-[var(--line)] px-1.5 py-1">
                  <a href={u.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-[#f2f6ff]">
                    <span className="text-[15px]">{k.icon}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-bold text-[#1d3a8f]">{u.title || k.label}</span><span className="block truncate text-[10.5px] text-[var(--ink-3)]">{u.title ? k.label : u.url}{u.by ? ` · ${u.by}` : ""}</span></span>
                    <span className="text-[11px] text-[#1d3a8f]">↗</span>
                  </a>
                  <button type="button" onClick={() => { onOpen(nt.id); setOpen(false); }} title="Open the task" className="block w-full truncate rounded px-1 pb-0.5 text-left text-[10.5px] font-bold text-[var(--ink-3)] hover:text-[#1d3a8f]">
                    📋 {names.slice(0, 2).join(", ")}{names.length > 2 ? ` +${names.length - 2}` : ""}{ts.length > 1 ? ` · ${ts.length} dates` : ""}{nt.due ? ` · next ${fmtDay(nt.due)}` : ""}
                  </button>
                </div>
              ); })}
            </div>
          </div>
        </>
      )}
    </span>
  );
}

/** A task's links, one click away wherever the task shows (shared badge). */
function UrlsBadge({ t, compact, onDark }: { t: Task; compact?: boolean; onDark?: boolean }) {
  return <LinkBadge links={t.urls ?? []} compact={compact} onDark={onDark} />;
}

// A link chip — deep-links straight to the record when it has an href, and shows
// a ↗ so it's obviously a link ("go to booking", not just a label).
function LinkChip({ link, size = "sm" }: { link: TaskLink; size?: "sm" | "xs" }) {
  const router = useRouter();
  const m = LINK[link.k] ?? LINK.gen;
  const cls = `inline-flex flex-none items-center gap-1 rounded-full font-bold ${size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"}`;
  // Category chips take the category's own colour; every other kind keeps the
  // one colour that stands for its type.
  const isCat = link.k === "gen" && !!link.v;
  const c = isCat ? catCol(link.v) : null;
  const style: CSSProperties = c ? { background: c.bg, color: c.fg } : { background: m.bg, color: m.fg };
  const label = <><span className="opacity-70">{m.label}</span> {link.v}</>;
  if (link.href) return <button type="button" title={`Open ${m.label.toLowerCase()}`} onClick={(e) => { e.stopPropagation(); router.push(link.href!); }} className={`${cls} underline decoration-transparent hover:decoration-current`} style={style}>{label} <span className="font-black">↗</span></button>;
  return <span className={cls} style={style}>{label}</span>;
}
// Avatar chips. These were near-white pastels (#fde2e4 etc) carried over from
// the light theme -- on a dark ground they blaze, and the initials sat on them
// at light-blue, which failed both ways. Now dark tints in the same hue spread,
// with initials in --ink (>=8.9:1 on every one).
const AV = ["#FDE7EF", "#E2F6EC", "#E8EEFD", "#FCF1DC", "#DEF4F1", "#EDE9FD", "#FCF1DC", "#E8EEFD"];
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
  if (t.urls?.length) lines.push("Links:\n" + t.urls.map((l) => `  ${l.title ? `${l.title}: ` : ""}${l.url}`).join("\n"));
  return lines.join("\n").slice(0, 1900);
}
// The deadline as a real date (+ optional time), prefixed with the relative word
// so "Tomorrow · Fri 1 Aug 3:30pm" reads at a glance. Null when there's no due.
function dueFull(t: Task, today: string): { text: string; color: string } | null {
  const dl = dueLabel(t.due, today);
  if (!dl || !t.due) return null;
  return { text: `${dl.text} · ${fmtDay(t.due)}${t.time ? ` ${t.time}` : ""}`, color: dl.color };
}

// ── Repeats ─────────────────────────────────────────────────────────────────
// Which fields describe ONE date rather than the repeat itself. The due date is
// the whole point of a date having its own task; ticking Tuesday done, or
// commenting on it, says nothing about Wednesday. Everything else — title,
// assignee, priority, time, what it's linked to, labels — is a property of the
// repeat, so changing it is where "just this one or all of them?" belongs.
const PER_OCCURRENCE = ["due", "calEventId", "status", "subs", "comments", "atts", "archived"] as const;
const pick = (f: Partial<Task>, keep: (k: string) => boolean) =>
  Object.fromEntries(Object.entries(f).filter(([k]) => keep(k))) as Partial<Task>;
const onlyPerOccurrence = (f: Partial<Task>) => pick(f, (k) => (PER_OCCURRENCE as readonly string[]).includes(k));
const seriesWide = (f: Partial<Task>) => pick(f, (k) => !(PER_OCCURRENCE as readonly string[]).includes(k));
// Is there anything in this change worth asking about? Marking one date done
// shouldn't interrupt you with a dialog it can only answer one way.
const asksAboutSeries = (f: Partial<Task>) => Object.keys(seriesWide(f)).length > 0;

// Who a task is assigned to, as a label. The rules live in ./taskDisplay so
// every surface that lists tasks agrees; ME is held module-side here rather
// than drilled through MyTasks → TaskGroup → RepeatRows → TaskRow (and Board,
// and Calendar) — it's the signed-in user, the same for every row on screen.
let ME: Person = { name: "", email: "" };
const isMine = (t: Task) => isMineOf(t, ME);
const whoLabel = (t: Task) => whoLabelOf(t, ME);
const personLabel = (who: string) => (who === "__unassigned" ? "Unassigned" : personLabelOf(who, ME));

// Natural-language quick-add: "Brief coaches tomorrow @Jess !high #Riverside".
function parseQuick(raw: string, today: string): { t: string; who?: string; prio?: Prio; link?: TaskLink; due?: string | null; urls?: string[] } {
  let text = ` ${raw} `;
  // Web links first — a URL's own # and @ would otherwise read as a camp and
  // an assignee. Each one becomes a link on the task.
  const urls = [...text.matchAll(/https?:\/\/[^\s<>"]+/gi)].map((m) => m[0].replace(/[),.;]+$/, ""));
  for (const u of urls) text = text.replace(u, " ");
  let who: string | undefined; let prio: Prio | undefined; let link: TaskLink | undefined; let due: string | null | undefined;
  const at = text.match(/\s@([^\s@!#]+)/); if (at) { who = at[1]; text = text.replace(at[0], " "); }
  const bang = text.match(/\s!(urgent|high|med|low)\b/i); if (bang) { prio = bang[1].toLowerCase() as Prio; text = text.replace(bang[0], " "); }
  const hash = text.match(/\s#([^\s@!#]+)/); if (hash) { link = { k: "camp", v: hash[1] }; text = text.replace(hash[0], " "); }
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  if (/\btoday\b/i.test(text)) { due = today; text = text.replace(/\btoday\b/i, " "); }
  else if (/\btomorrow\b/i.test(text)) { due = shiftIso(today, 1); text = text.replace(/\btomorrow\b/i, " "); }
  else { for (let i = 0; i < 7; i++) { const re = new RegExp(`\\b${days[i]}\\b`, "i"); if (re.test(text)) { const cur = new Date(`${today}T00:00:00Z`).getUTCDay(); let add = (i - cur + 7) % 7; if (add === 0) add = 7; due = shiftIso(today, add); text = text.replace(re, " "); break; } } }
  const t = text.replace(/\s+/g, " ").trim() || (urls[0] ? urlKind(urls[0]).label : "");
  return { t, who, prio, link, due, ...(urls.length ? { urls } : {}) };
}

export function TasksApp() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [me, setMe] = useState("");
  const [myEmail, setMyEmail] = useState("");
  const [myAliases, setMyAliases] = useState<string[]>([]);
  const [roster, setRoster] = useState<{ name: string; email: string }[]>([]);
  const [salesOpts, setSalesOpts] = useState<{ id: string; v: string; sub?: string }[]>([]);
  const [meDerived, setMeDerived] = useState(false);
  const [remOpen, setRemOpen] = useState(false);
  // The task just ticked off, waiting on "archive it?".
  const [archiveAsk, setArchiveAsk] = useState<Task | null>(null);
  const { settings, save } = useSettings();
  // Lands on the Calendar's Day view: what's due today, in time order, is the
  // question this page gets opened to answer.
  const [tab, setTab] = useState<"mine" | "team" | "board" | "cal" | "archive" | "milestones">("cal");
  const [openId, setOpenId] = useState<string | null>(null);
  // ?task=<id> — the bell and the reminder email link straight at a task, so
  // arriving here should OPEN it, not just land on the list and leave you to
  // find it. Re-runs on navigation, so clicking a second bell item while
  // already on this page works too.
  const sp = useSearchParams();
  const navRouter = useRouter();
  const navPath = usePathname();
  const deepTask = sp.get("task");
  useEffect(() => { if (deepTask) setOpenId(deepTask); }, [deepTask]);
  // Closing clears ?task= too, so a refresh doesn't reopen what you just shut,
  // and the back button doesn't feel broken.
  const closeTask = useCallback(() => {
    setOpenId(null);
    if (deepTask && navPath) navRouter.replace(navPath, { scroll: false });
  }, [deepTask, navRouter, navPath]);
  const [creating, setCreating] = useState(false);
  const [flash, setFlash] = useState(false);
  const [qa, setQa] = useState("");
  const [qaDue, setQaDue] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [teamSort, setTeamSort] = useState<"up" | "down">("up");
  const [calAnchor, setCalAnchor] = useState(() => todayIso());
  const [calView, setCalView] = useState<"day" | "week" | "month">("day");
  const [drag, setDrag] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [prioFilter, setPrioFilter] = useState<Prio | "">("");
  const [dueScope, setDueScope] = useState(""); // "" (any) | "today" | "tomorrow" | an ISO date
  const [kpiFilter, setKpiFilter] = useState<"" | "open" | "overdue" | "week" | "unassigned">("");
  const [heroOpen, setHeroOpen] = useState(true);
  useEffect(() => { try { if (localStorage.getItem("aos.hero.tasks") === "0") setHeroOpen(false); } catch { /* ignore */ } }, []);
  const toggleHero = () => setHeroOpen((v) => { const n = !v; try { localStorage.setItem("aos.hero.tasks", n ? "1" : "0"); } catch { /* ignore */ } return n; });
  const [listings, setListings] = useState<{ id: string; title: string; location?: string }[]>([]);
  const [bookings, setBookings] = useState<{ ref: string; booker?: string; email?: string; phone?: string; postcode?: string; child?: string; kids?: { name: string; age?: number }[]; listing?: string; pass?: string; dates?: string }[]>([]);
  const portal = usePathname()?.split("/")[1] || "freelancer";
  const today = todayIso();
  // HQ runs its own board and gets the full tab set, same as a company.
  const manager = role === "company" || role === "franchise" || role === "platform";
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
  useEffect(() => {
    apiGet<{ role: string; name?: string; email?: string }>("/api/me").then((m) => {
      setRole(m.role);
      // Never put a raw email address on a task. If no name is set, derive one
      // and flag it, so the hint below can point at Account → Name.
      setMe(displayName(m.name, m.email));
      setMyEmail((m.email ?? "").trim());
      setMyAliases(Array.isArray((m as { alsoMe?: string[] }).alsoMe) ? (m as { alsoMe?: string[] }).alsoMe! : []);
      setMeDerived(looksDerived(m.name, m.email));
    }).catch(() => {});
  }, []);
  // The real team, from the tenant's own directory. Without this the assignee
  // list was derived ONLY from names already used on existing tasks, so a fresh
  // board offered nobody at all — not even yourself.
  useEffect(() => {
    apiGet<{ groups: { people: { name: string; email: string }[] }[] }>("/api/tasks/assignees")
      .then((r) => setRoster((r.groups ?? []).flatMap((g) => g.people ?? [])
        .map((p) => ({ name: displayName(p.name, p.email), email: (p.email ?? "").trim() }))))
      .catch(() => {});
  }, []);
  useEffect(() => { apiGet<{ id: string; title?: string; name?: string; location?: string }[]>("/api/listings?mine=1").then((l) => setListings(l.map((x) => ({ id: x.id, title: x.title || x.name || "Listing", location: x.location })))).catch(() => {}); }, []);
  useEffect(() => { apiGet<{ ref: string; booker?: string; email?: string; phone?: string; postcode?: string; child?: string; kids?: { name: string; age?: number }[]; listing?: string; pass?: string; dates?: string }[]>("/api/bookings").then((b) => setBookings(b)).catch(() => {}); }, []);
  // HQ only: the sales pipeline, so a task can hang off a real lead.
  useEffect(() => {
    if (portal !== "platform") return;
    apiGet<{ id: string; business?: string; contactName?: string; name?: string; stage?: string; owner?: string }[]>("/api/platform/leads")
      .then((ls) => setSalesOpts(ls.map((l) => ({
        id: l.id,
        v: l.business || l.contactName || l.name || "Untitled lead",
        sub: [l.stage, l.owner].filter(Boolean).join(" · "),
      }))))
      .catch(() => {});
  }, [portal]);
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
  // Set before any row renders — every assignee label below reads it.
  ME = { name: me, email: myEmail, aliases: myAliases };
  const all = useMemo(() => everything.filter((t) => !t.archived), [everything]);
  const archived = useMemo(() => everything.filter((t) => t.archived), [everything]);
  // For a freelancer every task is "mine"; otherwise match on assignee.
  // Match on email where both sides have one — a rename must not lose your tasks.
  // Your other sign-ins (users.alsoMe) count too — one person, two logins.
  // A step handed to you counts too — it must reach you, not only the task's owner (d11s8).
  const mineOf = (t: Task) => noAssignee || isMineOf(t, { name: me, email: myEmail, aliases: myAliases }) || hasMySub(t, { name: me, email: myEmail, aliases: myAliases });
  // You are ALWAYS assignable, in every portal. Then the tenant's directory,
  // then any name free-typed onto an existing task so nothing disappears from
  // the picker. "Me" first — alphabetical order buries you under the Bs.
  const team = useMemo(() => {
    const used = all
      .filter((t) => (t.who ?? "").trim() !== "")
      .map((t) => ({ name: (t.who ?? "").trim(), email: (t.whoEmail ?? "").trim() }));
    // Keyed by email where there is one, so the same person appears once even
    // if their name has changed since an older task was assigned.
    const byKey = new Map<string, { name: string; email: string }>();
    for (const p of [...roster, ...used]) {
      const key = (p.email || p.name).toLowerCase();
      if (!key) continue;
      if (!byKey.has(key) || (!byKey.get(key)!.email && p.email)) byKey.set(key, p);
    }
    // You get re-added at the top, so drop yourself from the middle — under
    // BOTH keys. Entries key on email-or-name, so the roster files you under
    // your email while a task you free-typed your name onto files you under the
    // name: deleting one key left the other behind and you appeared twice
    // (visible as two "Me" chips once labels were tidied).
    for (const k of [myEmail, me, ...myAliases, ...myAliases.filter((a) => a.includes("@")).map((a) => displayName("", a))]) if (k?.trim()) byKey.delete(k.trim().toLowerCase());
    const others = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
    return me.trim() ? [{ name: me, email: myEmail }, ...others] : others;
  }, [all, roster, me, myEmail, myAliases]);
  // The picker writes the category to link.v ({k:"gen", v:"…"}), but this list
  // was reading t.cat — a different field nothing sets. So every category you
  // typed was saved on the task and never offered again. Read what's actually
  // written, keep t.cat for older tasks, and union with the saved list so a
  // category outlives the task that introduced it.
  const cats = useMemo(() => {
    const fromTasks = all.flatMap((t) => [t.link?.k === "gen" ? t.link.v : "", t.cat ?? ""]);
    const saved = settings.taskCategories ?? [];
    const list = [...new Set([...saved, ...fromTasks].map((c) => (c ?? "").trim()).filter(Boolean))].sort();
    // Hand the colour map the full list so no two categories share a colour.
    assignCatColours(list);
    return list;
  }, [all, settings.taskCategories]);

  // Remember a newly typed category. Best-effort: HQ has no tenant library to
  // save into, so there it simply falls back to the derived list above.
  const rememberCat = useCallback((link?: TaskLink | null) => {
    const v = link?.k === "gen" ? (link.v ?? "").trim() : "";
    if (!v) return;
    const saved = settings.taskCategories ?? [];
    if (saved.some((c) => c.toLowerCase() === v.toLowerCase())) return;
    void save({ settings: { ...settings, taskCategories: [...saved, v] } });
  }, [settings, save]);
  // Drop a saved category from the library. Only offered for ones no task uses.
  const forgetCat = useCallback((c: string) => {
    const saved = settings.taskCategories ?? [];
    void save({ settings: { ...settings, taskCategories: saved.filter((x) => x.trim().toLowerCase() !== c.trim().toLowerCase()) } });
  }, [settings, save]);
  // Must mirror `cats` exactly — anything a task still contributes survives a
  // forget, so offering × on it would be a button that does nothing.
  const catsInUse = useMemo(() => [...new Set(all.flatMap((t) => [t.link?.k === "gen" ? t.link.v : "", t.cat ?? ""]).map((c) => (c ?? "").trim()).filter(Boolean))], [all]);
  const locations = useMemo(() => [...new Set(listings.map((l) => l.location).filter((v): v is string => !!v))].sort(), [listings]);
  const linkOpts: LinkOpts = { portal, bookOpts, childOpts, parentOpts, listings, locations, cats, salesOpts, catsInUse, onForgetCat: forgetCat };

  async function create(fields: Partial<Task>, toCal = false) {
    try { const created = await apiPost<Task>("/api/tasks", { status: "todo", prio: "med", ...fields }); rememberCat(fields.link); if (toCal && created?.due) await syncToCalendar(created); refresh(); }
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
  // `seriesId` set = apply this edit to every date in the repeat, not just the
  // one that's open. The server strips anything per-occurrence (see its
  // PER_OCCURRENCE list), so the optimistic update mirrors that rule here.
  async function patch(id: string, fields: Partial<Task>, seriesId?: string) {
    // NOT rememberCat here. The drawer saves on every keystroke, so typing
    // "Cameron Bikes" into the category box filed C, Ca, Cam, Came… as fourteen
    // separate saved categories. A category is remembered when a task is
    // CREATED with it; edited-in ones still appear in the list because `cats`
    // unions the categories in use on tasks (see below).
    //
    // Finishing a task is the moment to get it off the board, so ask. Caught
    // here rather than at each button so every route to done — the row's status
    // dropdown, the board card, the drawer's Mark complete, the calendar —
    // asks the same question. Only on the todo→done edge, never on a task
    // that's already done or archived.
    const before = (tasks ?? []).find((t) => t.id === id);
    if (fields.status === "done" && before && before.status !== "done" && !before.archived) {
      setArchiveAsk({ ...before, ...fields });
    }
    setTasks((ts) => (ts ?? []).map((t) => (
      t.id === id ? { ...t, ...fields }
        : seriesId && t.seriesId === seriesId ? { ...t, ...seriesWide(fields) }
        : t
    ))); // optimistic
    const url = seriesId ? `/api/tasks/series/${encodeURIComponent(seriesId)}` : `/api/tasks/${encodeURIComponent(id)}`;
    try {
      await api(url, { method: "PUT", body: JSON.stringify(fields) });
      // The series call skips the open task's per-occurrence bits, so send those
      // on separately — otherwise "10:00 for all dates" would save the time but
      // silently drop a due-date change made in the same breath.
      if (seriesId) {
        const own = onlyPerOccurrence(fields);
        if (Object.keys(own).length) await api(`/api/tasks/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(own) });
      }
    }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); refresh(); }
  }
  const flashDone = () => { setFlash(true); setTimeout(() => setFlash(false), 1300); };
  // Set a task's status from a dropdown; flash "logged" when it newly becomes Done.
  const setStatus = (t: Task, s: Status) => { patch(t.id, { status: s }); if (s === "done" && t.status !== "done") flashDone(); };
  async function remove(id: string, alreadyConfirmed = false) {
    if (!alreadyConfirmed && !confirm("Delete this task?")) return;
    setOpenId(null);
    try { await api(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t delete"); }
  }
  function addQuick() {
    if (!qa.trim()) return;
    const p = parseQuick(qa, today);
    if (!p.t) return;
    const at = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    // @name → a real person on the team: exact name, else a unique first-name /
    // prefix match ("@Sam" → "Sam Taylor"), carrying their email so the task
    // reaches them. Someone not on the team is flagged before it's saved (d11s7).
    let who = noAssignee ? "" : (p.who ?? "");
    let whoEmail: string | undefined;
    if (who) {
      const w = who.toLowerCase();
      const exact = roster.filter((r) => r.name.toLowerCase() === w);
      const byFirst = roster.filter((r) => r.name.toLowerCase().split(/\s+/)[0] === w || r.name.toLowerCase().startsWith(w));
      const hit = exact.length === 1 ? exact[0] : byFirst.length === 1 ? byFirst[0] : null;
      if (hit) { who = hit.name; whoEmail = hit.email || undefined; }
      else if (roster.length && !window.confirm(byFirst.length > 1
        ? `"@${p.who}" matches more than one person (${byFirst.map((r) => r.name).join(", ")}). Save it for "${p.who}" anyway? Choose Cancel to type their full name.`
        : `"@${p.who}" isn't anyone on your team. Save the task for "${p.who}" anyway?`)) return;
    }
    create({ t: p.t, who, ...(whoEmail ? { whoEmail } : {}), prio: p.prio ?? "med", link: p.link ?? null, due: qaDue || p.due || null, ...(p.urls ? { urls: p.urls.map((url) => ({ url, by: me, at })) } : {}) });
    setQa(""); setQaDue("");
  }

  // KPIs
  const openTasks = all.filter((t) => t.status !== "done");
  const overdue = openTasks.filter((t) => t.due && daysBetween(today, t.due) < 0);
  const dueWeek = openTasks.filter((t) => t.due && daysBetween(today, t.due) >= 0 && daysBetween(today, t.due) <= 6);
  const unassigned = openTasks.filter((t) => !t.who || t.who.trim() === "");
  type KpiKey = "open" | "overdue" | "week" | "unassigned";
  // Counted BOTH ways. A repeat is one job on many dates, so a month of a daily
  // task read as 30 open tasks — "79 open" looked like a mountain of work that
  // was really a handful of jobs. The headline is the number of jobs, which is
  // also what the list below shows once repeats are folded, so tile and list
  // agree; the raw date count sits under it for when that's what you want.
  const jobs = (list: Task[]) => foldRepeats(list).length;
  // Two accents per tile. The pale one is for the translucent tile on the navy
  // hero; the dark one is for when the tile is SELECTED and flips to white,
  // where every pale accent drops to ~1.2:1 and the underline disappears.
  const kpis: [string, number, number, string, KpiKey, string][] = [
    ["Open", jobs(openTasks), openTasks.length, "#bfe0ff", "open", "#1d6fd0"],
    ["Overdue", jobs(overdue), overdue.length, "#ffb4bd", "overdue", "#c02636"],
    ["Due this week", jobs(dueWeek), dueWeek.length, "#ffd9a6", "week", "#b45309"],
    ...(manager ? [["Unassigned", jobs(unassigned), unassigned.length, "#d6dbe6", "unassigned", "#5a6478"] as [string, number, number, string, KpiKey, string]] : []),
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

  const teamNames = useMemo(() => team.map((p) => p.name).filter(Boolean), [team]);
  const preview = qa.trim() ? parseQuick(qa, today) : null;
  const previewWhoUnknown = preview?.who && !teamNames.some((w) => w.toLowerCase() === preview.who!.toLowerCase());

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
      <div className="op-hero relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ backgroundImage: `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), ${HERO}`, backgroundSize: "18px 18px, cover, cover, cover, cover", backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Task manager</div>
          <div className="flex flex-none flex-wrap items-center gap-2">
            <TourLauncher view="tasks" compact />
            <button type="button" onClick={toggleHero} aria-expanded={heroOpen} title={heroOpen ? "Collapse cards" : "Show cards"} className="inline-flex flex-none items-center gap-1 rounded-full border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white/85 backdrop-blur-sm transition hover:text-white" style={{ background: "rgba(12,26,68,.42)" }}><span className="text-[10px] leading-none">{heroOpen ? "▾" : "▸"}</span>{heroOpen ? "Hide" : "Show"}</button>
          </div>
        </div>
        {heroOpen && <p className="mt-1 max-w-[640px] text-[12.5px] text-white/85">{sub}</p>}
        {heroOpen && <div className="mt-3.5 flex flex-wrap gap-2.5">
          {kpis.map(([label, n, dates, color, key, onColor]) => {
            const on = kpiFilter === key;
            return (
              <button key={label} type="button" onClick={() => setKpiFilter(on ? "" : key)} title={`Show ${label.toLowerCase()}`}
                className="rounded-xl px-4 py-2 text-left backdrop-blur-sm transition hover:-translate-y-0.5"
                style={on ? { background: "#fff", boxShadow: "0 6px 18px -8px rgba(0,0,0,.4)" } : { background: "rgba(255,255,255,.15)" }}>
                {/* `on` renders a WHITE tile, so the ink has to be navy. This
                    number was #F4F6FC — white on white, 1.03:1, invisible. */}
                <div className="text-[20px] font-extrabold leading-none" style={{ fontVariantNumeric: "tabular-nums", color: on ? BLUE : "#fff" }}>{n}</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: on ? "#4a4763" : "rgba(255,255,255,.8)" }}>{label}</div>
                {/* Only when they differ — with no repeats the two numbers are
                    the same and a second line would just be noise. */}
                {dates > n && (
                  <div className="mt-0.5 text-[9.5px] font-semibold" style={{ color: on ? "#8a86a3" : "rgba(255,255,255,.62)" }}
                    title={`${n} task${n === 1 ? "" : "s"}, ${dates} counting every date of a repeat`}>
                    🔁 {dates} dates
                  </div>
                )}
                <div className="mt-0.5 h-0.5 w-6 rounded-full" style={{ background: on ? onColor : color }} />
              </button>
            );
          })}
        </div>}
        {/* Section tabs — a segmented control that sits on the hero */}
        <div className="mt-4 inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-full bg-white/10 p-1 text-[12.5px] font-bold ring-1 ring-inset ring-white/15 backdrop-blur-sm">
          {TABS.map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className="rounded-full px-3.5 py-1.5 transition-colors" style={tab === k ? { background: "#fff", color: BLUE } : { color: "rgba(255,255,255,.8)" }}>{l}</button>)}
          {showMilestones && <button type="button" onClick={() => setTab("milestones")} className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-colors" style={onMilestones ? { background: "#fff", color: "#6d28d9" } : { color: "rgba(255,255,255,.85)" }}>📍 Milestones</button>}
        </div>
      </div>

      {/* Quick add */}
      {!onMilestones && <div className="mb-3 rounded-2xl border border-[#dbe6fb] bg-[var(--surface)] p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {/* The Quick add action sits INSIDE the field it submits, so the row
              isn't a line of buttons with no obvious relationship to the input. */}
          <div className="flex min-w-[240px] flex-1 items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] pr-1 focus-within:border-[#1d3a8f]">
            <input value={qa} onChange={(e) => setQa(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addQuick(); }} placeholder={`Quick add…   try:  Brief coaches tomorrow ${noAssignee ? "" : "@Jess "}!high #Riverside`} className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[13px] outline-none" />
            <button type="button" onClick={addQuick} disabled={!qa.trim()}
              className="shrink-0 rounded-md bg-[#1d3a8f] px-3 py-1.5 text-[12px] font-extrabold text-white transition disabled:opacity-35">
              Quick add
            </button>
          </div>
          <label className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[12px] text-[var(--ink-3)]"><span>Deadline</span><input type="date" value={qaDue} onChange={(e) => setQaDue(e.target.value)} className="bg-transparent text-[12.5px] text-[var(--ink)] outline-none" /></label>
          <QuickLinks tasks={all} me={me} onOpen={setOpenId} />
          <button type="button" onClick={() => setRemOpen(true)} title="Task reminders"
            className="shrink-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[12.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">
            🔔 Reminders
          </button>
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
            {preview.urls?.map((u) => { const k = urlKind(u); return <span key={u} className="rounded-full bg-[#eef4ff] px-2 py-0.5 font-bold text-[#1d3a8f]">{k.icon} {k.label}</span>; })}
          </div>
        )}
        <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">{noAssignee ? "" : <><b>@</b> assignee · </>}<b>!</b> priority · <b>#</b> link a camp · <b>today tomorrow Mon</b> set the due date · paste a <b>link</b> (Google Drive, a web page) to attach it · or <b>+ New task</b> for the full form</div>
      </div>}

      {/* Toolbar (tabs now live in the title card above) */}
      {!onMilestones && (
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <div className="relative ml-auto">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks…" className="w-[190px] rounded-full border border-[var(--line)] bg-[var(--surface)] py-1.5 px-3 text-[12px] outline-none focus:border-[#1d3a8f]" />
          </div>
        </div>
      )}
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
        {tab === "board" && <Board tasks={base} noAssignee={noAssignee} onOpen={setOpenId} drag={drag} setDrag={setDrag} onDrop={(id, s) => patch(id, { status: s })} onStatus={setStatus} onArchive={(t) => patch(t.id, { archived: true })} />}
        {tab === "cal" && <Calendar tasks={base} anchor={calAnchor} setAnchor={setCalAnchor} view={calView} setView={setCalView} today={today} noAssignee={noAssignee} onOpen={setOpenId} onStatus={setStatus} />}
        {tab === "team" && manager && <TeamView tasks={base} team={teamNames} filter={teamFilter} setFilter={setTeamFilter} sort={teamSort} setSort={setTeamSort} today={today} onOpen={setOpenId} onStatus={setStatus} />}
        {tab === "archive" && <ArchiveView tasks={archived} onOpen={setOpenId}
          onUnarchive={(t) => patch(t.id, { archived: false })}
          canDelete={role !== "staff"}
          onDelete={(t) => { if (confirm(`Delete "${t.t}" permanently? This cannot be undone.`)) remove(t.id, true); }} />}
      </>)}

      {remOpen && (() => {
        const prefs = settings.notifications ?? {};
        const rows: [string, string][] = [["task-due", "A task of yours is due today"], ["task-overdue", "A task of yours is overdue"]];
        const set = (k: string, ch: NotifyChannel) =>
          void save({ settings: { ...settings, notifications: { ...prefs, [k]: ch === "off" ? false : ch === "bell" ? "bell" : true } } });
        return (
          <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/40 p-4 pt-[10vh]" onClick={() => setRemOpen(false)}>
            <div className="w-full max-w-[520px] rounded-2xl bg-[var(--surface)] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-extrabold text-[var(--ink)]">Task reminders</h3>
                <button type="button" onClick={() => setRemOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--panel)] text-[15px] font-bold text-[var(--ink-2)]">×</button>
              </div>
              <p className="mt-1.5 text-[12.5px] text-[var(--ink-2)]">
                Sent to <b>both</b> the assignee and whoever created the task. Due-today goes out at the task&rsquo;s time,
                or from 08:00 if it has none; overdue chases the next morning, once.
              </p>
              {rows.map(([k, label]) => (
                <div key={k} className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-3 py-2.5">
                  <span className="text-[13px] font-semibold text-[var(--ink)]">{label}</span>
                  <div className="flex shrink-0 gap-1">
                    {(["both", "bell", "off"] as NotifyChannel[]).map((c) => (
                      <button key={c} type="button" onClick={() => set(k, c)}
                        className="rounded-full px-2.5 py-1 text-[11.5px] font-extrabold"
                        style={notificationChannel(prefs, k) === c
                          ? { background: c === "off" ? "#fdeaee" : "#eaf0fc", color: c === "off" ? "#b3123c" : "#1d3a8f" }
                          : { background: "transparent", color: "var(--ink-3)" }}>
                        {c === "both" ? "Bell + email" : c === "bell" ? "Bell only" : "Off"}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <p className="mt-3 text-[11.5px] text-[var(--ink-3)]">
                These are the same settings as Setup → Notifications. Everything else lives there.
              </p>
            </div>
          </div>
        );
      })()}
      {flash && <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-[#16803d] px-4 py-2 text-[13px] font-extrabold text-white shadow-lg">✓ Task logged</div>}

      {/* Ticked off — offer to file it away. "No" is the safe default (Enter /
          click-away / Esc all leave the task on the board, done but visible),
          because archiving is the move that makes it disappear. */}
      {archiveAsk && (() => {
        const t = archiveAsk;
        const close = () => setArchiveAsk(null);
        return (
          <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/40 p-4 pt-[18vh]" onClick={close}>
            <div className="w-full max-w-[420px] rounded-2xl bg-[var(--surface)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} style={LIGHT_PALETTE}>
              <div className="text-[15px] font-extrabold text-[var(--ink)]">✓ Done — archive it?</div>
              <p className="mt-1.5 text-[12.5px] text-[var(--ink-2)]">
                <b>{t.t}</b> is marked complete. Archiving tucks it out of your lists; it stays in <b>Archive</b>, where you can bring it back.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={close} className="rounded-lg border border-[var(--line)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">No, leave it</button>
                <button type="button" autoFocus onClick={() => { patch(t.id, { archived: true }); close(); }} className="rounded-lg bg-[#1d3a8f] px-3.5 py-2 text-[12.5px] font-extrabold text-white">Yes, archive</button>
              </div>
            </div>
          </div>
        );
      })()}
      {creating && <CreateModal noAssignee={noAssignee} team={team} me={me} myEmail={myEmail} opts={linkOpts} initialTitle={qa} onClose={() => { setCreating(false); setQa(""); }} onCreate={(f, toCal) => { create(f, toCal); setCreating(false); setQa(""); }} />}
      {openTask && <Drawer task={openTask} team={team} noAssignee={noAssignee} me={me} myEmail={myEmail} meDerived={meDerived} opts={linkOpts} onClose={closeTask} onPatch={(f, scope) => patch(openTask.id, f, scope === "all" ? (openTask.seriesId ?? undefined) : undefined)} onSyncCal={() => syncToCalendar(openTask)} onUnsyncCal={() => unsyncFromCalendar(openTask)} onArchive={() => { patch(openTask.id, { archived: true }); closeTask(); }} onDelete={() => remove(openTask.id)}
        seriesStart={openTask.seriesId ? everything.filter((x) => x.seriesId === openTask.seriesId).map((x) => x.due ?? "").filter(Boolean).sort()[0] : undefined}
        onEditSeries={async (r) => {
          if (!openTask.seriesId) return null;
          try {
            const out = await api<{ created: number; removed: number; keptDone: number }>(`/api/tasks/series/${encodeURIComponent(openTask.seriesId)}/range`, { method: "PUT", body: JSON.stringify(r) });
            // The open date may have been one of the removed ones.
            if (openTask.due && (openTask.due < r.from || openTask.due > r.until) && openTask.status !== "done") setOpenId(null);
            refresh();
            return `✓ Repeat updated — ${out.created} date${out.created === 1 ? "" : "s"} added, ${out.removed} removed${out.keptDone ? `, ${out.keptDone} done date${out.keptDone === 1 ? "" : "s"} kept` : ""}.`;
          } catch (e) { return `⚠ ${e instanceof Error ? e.message : "Couldn't change the dates"}`; }
        }}
        onDeleteSeries={async () => {
          if (!openTask.seriesId) return;
          if (!confirm("Delete every task in this repeat? This cannot be undone.")) return;
          try { await api(`/api/tasks/series/${encodeURIComponent(openTask.seriesId)}`, { method: "DELETE" }); setOpenId(null); refresh(); }
          catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
        }} />}
    </div>
  );
}

// ── Archive ─────────────────────────────────────────────────────────────────
function ArchiveView({ tasks, onOpen, onUnarchive, onDelete, canDelete }: { tasks: Task[]; onOpen: (id: string) => void; onUnarchive: (t: Task) => void; onDelete: (t: Task) => void; canDelete: boolean }) {
  if (tasks.length === 0) return <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-12 text-center text-[12.5px] text-[var(--ink-3)]">Nothing archived. Archive a task from its card to tuck it away here.</div>;
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
      {tasks.map((t) => (
        <div key={t.id} className="flex items-center gap-2.5 border-b border-[var(--line)] px-3 py-2.5 last:border-b-0">
          <span className="h-2 w-2 flex-none rounded-full" style={{ background: PRIO[t.prio ?? "med"].dot }} />
          <button type="button" onClick={() => onOpen(t.id)} className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-[var(--ink-2)]">{t.t}</button>
          {t.link && <span className="flex-none"><LinkChip link={t.link} /></span>}<UrlsBadge t={t} />
          {t.due && <span className="flex-none text-[11px] text-[var(--ink-3)]">{fmtDay(t.due)}</span>}
          <button type="button" onClick={() => onUnarchive(t)} className="flex-none rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[#1d3a8f] hover:bg-[#eef4fd]">↩ Unarchive</button>
          {/* Archive is where tasks go to be got rid of, so the delete belongs
              here rather than only inside the drawer. Operators only. */}
          {canDelete && (
            <button type="button" onClick={() => onDelete(t)} title="Delete permanently"
              className="flex-none rounded-lg border border-[#f6c9cc] px-2.5 py-1 text-[11.5px] font-bold text-[#c02636] hover:bg-[#fdeaee]">
              Delete
            </button>
          )}
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
  // Group heading colours are ink on the page, so they use the light accents.
  // The dark 500-weights they had (#C81E5E etc) sat at ~2.6:1 on the dimmed navy.
  const groups: [string, Task[], string, string][] = [["Overdue", overdue, "Nothing overdue — nice.", "#C81E5E"], ["Today", todayT, "Clear for today.", "#16307a"], ["Upcoming", upcoming, "Nothing scheduled.", "#2f5fd0"], ["Done", done, "Nothing done yet.", "#0f7a43"]];
  return (
    <div className="space-y-4">
      {groups.map(([title, list, empty, color]) => (
        <TaskGroup key={title} title={title} list={list} empty={empty} color={color} today={today} noAssignee={noAssignee} hideDone={title === "Done"} onOpen={onOpen} onStatus={onStatus} />
      ))}
    </div>
  );
}

// ── Repeats in a list ───────────────────────────────────────────────────────
// A month of a daily task is 30 identical rows that bury everything else, so a
// repeat shows as ONE row — its next date — with the remaining dates folded
// behind it. The list arrives sorted, so the first one seen is the soonest and
// `rest` fills by reference as the rest of the list goes past.
// This is per-group on purpose: a repeat with overdue dates still shows an
// overdue row of its own, which is the thing you actually need to see.
// (The Calendar shows every date regardless — that's what a calendar is for.)
// One folded repeat: the next date, then its other dates on demand.
function RepeatRows({ lead, rest, today, noAssignee, hideDone, onOpen, onStatus }: { lead: Task; rest: Task[]; today: string; noAssignee: boolean; hideDone: boolean; onOpen: (id: string) => void; onStatus: (t: Task, s: Status) => void }) {
  const [open, setOpen] = useState(false);
  const row = (t: Task) => <TaskRow key={t.id} t={t} today={today} noAssignee={noAssignee} hideDone={hideDone} onOpen={onOpen} onStatus={onStatus} />;
  if (!rest.length) return row(lead);
  return (
    <div className="space-y-2">
      {row(lead)}
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="ml-[58px] flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">
        🔁 {lead.seriesFreq ? `${REPEAT_WORD[lead.seriesFreq] ?? lead.seriesFreq} · ` : ""}
        {open ? "hide the other dates" : `${rest.length} more date${rest.length === 1 ? "" : "s"}`}
        <span className="text-[9px]">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="ml-[58px] space-y-2 border-l-2 border-dashed border-[var(--line)] pl-2">{rest.map(row)}</div>}
    </div>
  );
}

// One group (Overdue / Today / Upcoming / Done) — shows the first 10, then a
// "Show N more" toggle so long lists stay compact.
function TaskGroup({ title, list, empty, color, today, noAssignee, hideDone, onOpen, onStatus }: { title: string; list: Task[]; empty: string; color: string; today: string; noAssignee: boolean; hideDone: boolean; onOpen: (id: string) => void; onStatus: (t: Task, s: Status) => void }) {
  const [expanded, setExpanded] = useState(false);
  // Fold first, then cap: "show 10" now means 10 jobs, not 10 dates of one job.
  const folded = useMemo(() => foldRepeats(list), [list]);
  const shown = expanded ? folded : folded.slice(0, 10);
  const repeats = folded.filter((f) => f.rest.length).length;
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /><span className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color }}>{title}</span>
        <span className="rounded-full px-1.5 text-[10.5px] font-extrabold" style={{ background: `${color}14`, color }}>{list.length}</span>
        {/* The count is still every date — say so, or a folded repeat looks like
            rows that went missing. */}
        {repeats > 0 && <span className="text-[10.5px] font-semibold text-[var(--ink-3)]">across {folded.length} task{folded.length === 1 ? "" : "s"} · repeats folded</span>}
      </div>
      {list.length === 0 ? <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[12px] text-[var(--ink-3)]">{empty}</div>
        : <>
          <div className="space-y-2">{shown.map((f) => <RepeatRows key={f.lead.id} lead={f.lead} rest={f.rest} today={today} noAssignee={noAssignee} hideDone={hideDone} onOpen={onOpen} onStatus={onStatus} />)}</div>
          {folded.length > 10 && <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 w-full rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)] py-2 text-[11.5px] font-extrabold text-[#1d3a8f] transition hover:bg-[#eef4fd]">{expanded ? "Show less" : `Show ${folded.length - 10} more`}</button>}
        </>}
    </div>
  );
}

// Subtask progress, for every surface that shows a task in collapsed form —
// board card, calendar row, list row. One component so the three can't drift on
// colour, rounding or what "complete" looks like.
function SubProgress({ subs }: { subs: Sub[] }) {
  if (!subs.length) return null;
  const doneN = subs.filter((s) => s.done).length;
  const pct = Math.round((doneN / subs.length) * 100);
  return (
    <span className="inline-flex flex-none items-center gap-1" title={`${doneN} of ${subs.length} subtasks done`}>
      <span className="block h-1 w-8 overflow-hidden rounded-full bg-[var(--line)]">
        <span className="block h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct === 100 ? "#16b364" : "#3b82f6" }} />
      </span>
      <span className="text-[9.5px] font-extrabold" style={{ color: pct === 100 ? "#0f8a4a" : "var(--ink-3)" }}>{pct}%</span>
    </span>
  );
}

function TaskRow({ t, today, noAssignee, hideDone, onOpen, onStatus }: { t: Task; today: string; noAssignee: boolean; hideDone?: boolean; onOpen: (id: string) => void; onStatus: (t: Task, s: Status) => void }) {
  const done = t.status === "done";
  const subs = t.subs ?? [];
  const [openSubs, setOpenSubs] = useState(false);
  const isOverdue = !done && !!t.due && daysBetween(today, t.due) < 0;
  const sc = STATUS_C[t.status ?? "todo"];
  // Left date rail — the prominent, listing-card style block.
  const railBg = done ? "linear-gradient(160deg,#0f7a3d,#16b364)" : isOverdue ? "linear-gradient(160deg,#8f1420,#c02636)" : "linear-gradient(160deg,#16307a,#3f78d8)";
  const mon = t.due ? new Date(`${t.due}T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }).toUpperCase() : "";
  const rel = done ? "Done" : isOverdue ? "Overdue" : (dueLabel(t.due, today)?.text ?? "");
  return (
    // Was a fixed h-[52px] flex row. Now a column so the subtask list can drop
    // out underneath — the row itself keeps the same 52px so a collapsed card
    // looks exactly as it did.
    <div data-ui="card" className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-sm transition hover:shadow-md">
      <div className="flex h-[52px]">
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
        {/* The x/y count is now the toggle — you had to open the whole task to
            find out what the subtasks actually were. */}
        <SubProgress subs={subs} />
        {subs.length > 0 && (
          <button type="button" onClick={(e) => { e.stopPropagation(); setOpenSubs((v) => !v); }}
            aria-expanded={openSubs} title={openSubs ? "Hide subtasks" : "Show subtasks"}
            className="flex-none rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[10px] font-extrabold text-[var(--ink-3)] transition-colors hover:border-[#1d3a8f] hover:text-[#1d3a8f]">
            {subs.filter((s) => s.done).length}/{subs.length} <span className="text-[8px]">{openSubs ? "▲" : "▼"}</span>
          </button>
        )}
        {t.time && <span className="flex-none text-[10.5px] font-bold text-[var(--ink-3)]">{t.time}</span>}
        {t.link && <LinkChip link={t.link} size="xs" />}<UrlsBadge t={t} />
        {t.calEventId && <span className="flex-none rounded-full bg-[#eef4fd] px-1.5 py-0.5 text-[9.5px] font-bold text-[#1d3a8f]">Cal</span>}
        {!noAssignee && whoLabel(t) && <span className="flex-none text-[10.5px] font-semibold text-[var(--ink-3)]">{whoLabel(t)}</span>}
      </div>
      </div>
      {openSubs && subs.length > 0 && (
        // Indented to clear the date rail so the subtasks read as belonging to
        // the task above rather than as siblings of it.
        <div className="border-t border-[var(--line)] bg-[var(--panel)]/40 py-1.5 pl-[68px] pr-2.5">
          {subs.map((s, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5 text-[11.5px]">
              <span className={"grid h-3.5 w-3.5 flex-none place-items-center rounded border text-[9px] font-extrabold " + (s.done ? "border-[#16b364] bg-[#16b364] text-white" : "border-[var(--line)] text-transparent")}>✓</span>
              <span className={"min-w-0 flex-1 truncate " + (s.done ? "text-[var(--ink-3)] line-through" : "text-[var(--ink-2)]")}>{s.t}</span>
              {!noAssignee && s.who?.trim() && <span className="flex-none text-[10px] font-semibold text-[var(--ink-3)]">{personLabel(s.who.trim())}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Board — kanban with drag ────────────────────────────────────────────────
function Board({ tasks, noAssignee, onOpen, drag, setDrag, onDrop, onStatus, onArchive }: { tasks: Task[]; noAssignee: boolean; onOpen: (id: string) => void; drag: string | null; setDrag: (id: string | null) => void; onDrop: (id: string, s: Status) => void; onStatus: (t: Task, s: Status) => void; onArchive: (t: Task) => void }) {
  const [over, setOver] = useState<Status | null>(null);
  const today = todayIso();
  return (
    <>
      <div className="grid items-start gap-2.5 md:grid-cols-4">
        {COLS.map((c) => (
          <BoardColumn key={c.k} c={c} list={tasks.filter((t) => (t.status ?? "todo") === c.k).slice().sort(byPrioDue)} today={today} noAssignee={noAssignee} over={over === c.k} setOver={setOver} drag={drag} setDrag={setDrag} onDrop={onDrop} onOpen={onOpen} onStatus={onStatus} onArchive={onArchive} />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-[var(--ink-3)]">Drag a card between columns to move it, or click to open.</p>
    </>
  );
}

// One kanban column — shows the first 10 cards, then a "Show N more" toggle.
function BoardColumn({ c, list, today, noAssignee, over, setOver, drag, setDrag, onDrop, onOpen, onStatus, onArchive }: { c: { k: Status; label: string; color: string }; list: Task[]; today: string; noAssignee: boolean; over: boolean; setOver: (s: Status | null) => void; drag: string | null; setDrag: (id: string | null) => void; onDrop: (id: string, s: Status) => void; onOpen: (id: string) => void; onStatus: (t: Task, s: Status) => void; onArchive: (t: Task) => void }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? list : list.slice(0, 10);
  return (
    <div onDragOver={(e) => { e.preventDefault(); setOver(c.k); }} onDragLeave={() => setOver(null)} onDrop={() => { if (drag) onDrop(drag, c.k); setDrag(null); setOver(null); }}
      className="flex flex-col overflow-hidden rounded-2xl border shadow-sm transition-colors" style={{ borderColor: over ? c.color : "var(--line)" }}>
      <div className="flex items-center gap-1.5 px-3 py-2.5 text-white" style={{ background: `linear-gradient(120deg, ${c.color}, ${c.color}c8)` }}><span className="h-2.5 w-2.5 rounded-full bg-white/85" /><span className="text-[11.5px] font-extrabold uppercase tracking-wide">{c.label}</span><span className="ml-auto rounded-full bg-white/25 px-2 text-[10.5px] font-extrabold">{list.length}</span></div>
      {/* Neutral body — the coloured header already names the column, and a
          tint behind every card meant the cards themselves never sat on a
          steady ground. Still lights up in the column colour while dragging. */}
      <div className="flex-1 space-y-2 p-2" style={{ background: over ? `${c.color}12` : "var(--panel)" }}>
        {shown.map((t) => {
          const dl = dueFull(t, today);
          const isOverdue = t.status !== "done" && !!t.due && daysBetween(today, t.due) < 0;
          const accent = isOverdue ? "#c02636" : PRIO[t.prio ?? "med"].dot;
          // Overdue or due today — the only two states worth shouting about.
          const urgentDue = isOverdue || t.due === today;
          return (
          <div key={t.id} draggable onDragStart={() => setDrag(t.id)} onDragEnd={() => setDrag(null)} onClick={() => onOpen(t.id)} data-ui="card"
            className="cursor-grab overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing">
            {/* One fact, one colour. The category band that used to sit here
                repeated the category chip below it, and the priority dot beside
                the title repeated this left border — six colour systems on one
                card, so none of them read. Priority is the border; category is
                the chip; status is the COLUMN. */}
            <div className="border-l-[3px] p-2.5" style={{ borderColor: accent }}>
              <span className={`block text-[12.5px] leading-snug ${t.status === "done" ? "text-[var(--ink-3)] line-through" : "font-extrabold"}`}>{t.t}</span>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {t.link && <LinkChip link={t.link} size="xs" />}<UrlsBadge t={t} />
                {/* Tinted only when it's actually pressing. "In 2d" in a red
                    badge cried wolf and made the genuinely overdue ones blend in. */}
                {dl && t.status !== "done" && (urgentDue
                  ? <span className="rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold" style={{ background: `${dl.color}18`, color: dl.color }}>{dl.text}</span>
                  : <span className="text-[9.5px] font-bold text-[var(--ink-3)]">{dl.text}</span>)}
                <SubProgress subs={t.subs ?? []} />
                {!noAssignee && whoLabel(t) && <span className="text-[10px] font-semibold text-[var(--ink-3)]">{whoLabel(t)}</span>}
                <div className="ml-auto flex items-center gap-1">
                  {t.status === "done" && <button type="button" onClick={(e) => { e.stopPropagation(); onArchive(t); }} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--ink-2)] hover:bg-[var(--panel)]">Archive</button>}
                  {/* The same status dropdown the list view uses. A lone "Done"
                      button could only move a card one way — every other status
                      needed a drag, and the board disagreed with the list about
                      how you change a status at all. */}
                  {/* Neutral here, unlike the list and calendar: on the board the
                      card already sits IN its status column under a header in
                      that colour, so a matching pill said it a third time and
                      clashed with the priority border next to it. */}
                  <select value={t.status ?? "todo"} onClick={(e) => e.stopPropagation()} onChange={(e) => { e.stopPropagation(); onStatus(t, e.target.value as Status); }} aria-label="Status"
                    className="flex-none cursor-pointer rounded-full border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--ink-3)] outline-none transition-colors hover:border-[var(--ink-3)] hover:text-[var(--ink-2)]">
                    {COLS.map((col) => <option key={col.k} value={col.k} style={{ color: "var(--ink)" }}>{col.label}</option>)}
                  </select>
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
  // Which day has its overflow list open.
  const [moreDay, setMoreDay] = useState<string | null>(null);
  // Month view calls this per cell (up to ~42) and week view per day (7), each
  // read up to twice (once for the list, once for the "+N more" count) — that
  // used to mean a full re-scan of `tasks` (every non-archived task a tenant
  // has, potentially years' worth) per cell, per render. One pass groups them
  // by due date instead, so each cell is a Map lookup.
  const byDue = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.due) continue;
      const arr = m.get(t.due);
      if (arr) arr.push(t); else m.set(t.due, [t]);
    }
    for (const arr of m.values()) arr.sort(byTimeThenPrio);
    return m;
  }, [tasks]);
  const on = (iso: string) => byDue.get(iso) ?? EMPTY_TASKS;
  const dowMon = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7; // 0=Mon
  const weekStart = shiftIso(anchor, -dowMon(anchor));
  const step = view === "day" ? 1 : view === "week" ? 7 : 0;
  const stepBy = (dir: number) => { if (view === "month") { const [y, m] = anchor.split("-").map(Number); setAnchor(new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10)); } else setAnchor(shiftIso(anchor, dir * step)); };
  const title = view === "day" ? new Date(`${anchor}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : view === "week" ? `Week of ${fmtDay(weekStart)}`
    : new Date(`${anchor}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  // Compact chip (month/week) — done tasks read struck-through and dimmed.
  const chip = (t: Task) => { const done = t.status === "done"; const bg = done ? "#16b364" : PRIO[t.prio ?? "med"].dot; return (
    // The chip opens the task; its 🔗 opens the task's link (Drive, a page…).
    <div key={t.id} className={`flex w-full items-center gap-0.5 rounded pr-0.5 ${done ? "opacity-60" : ""}`} style={{ background: bg, color: inkOn(bg) }}>
      <button type="button" onClick={() => onOpen(t.id)} className={`block min-w-0 flex-1 truncate px-1.5 py-0.5 text-left text-[10.5px] font-bold ${done ? "line-through" : ""}`} title={t.t}>{t.time ? `${t.time} ` : ""}{t.t}</button>
      <UrlsBadge t={t} compact onDark />
    </div>
  ); };
  // Day-view row — inline status picker so Done / In progress etc can be set right here.
  // The day list was a flex row, so every row sized its own right-hand side and
  // nothing lined up between rows — a task with a category chip pushed its
  // assignee and status out of step with the row above. It's a fixed grid now,
  // sharing DAY_COLS with the header so the two can't drift.
  const DAY_COLS = "grid-cols-[minmax(0,1fr)_86px_72px_92px_104px]";
  const dayHeader = (
    // `border-transparent` matches the rows' 1px border, or the header's 1fr
    // column resolves 2px wider and every label sits just off its column.
    <div className={`hidden ${DAY_COLS} gap-2 border border-transparent px-2.5 pb-1 text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)] md:grid`}>
      <span>Task</span>
      <span>Category</span>
      <span>Progress</span>
      <span>{noAssignee ? "" : "Assigned to"}</span>
      <span className="text-right">Status</span>
    </div>
  );
  const fullChip = (t: Task) => {
    const done = t.status === "done";
    const sc = STATUS_C[t.status ?? "todo"];
    return (
      <div key={t.id} className={`grid w-full ${DAY_COLS} items-center gap-2 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[12.5px] hover:bg-[#f7faff]`}>
        <button type="button" onClick={() => onOpen(t.id)} className="flex min-w-0 items-center gap-2 text-left">
          <span className="h-2 w-2 flex-none rounded-full" style={{ background: done ? "#16b364" : PRIO[t.prio ?? "med"].dot }} />
          {t.time ? <span className="flex-none font-black text-[var(--ink-3)]">{t.time}</span> : null}
          <span className={`truncate font-bold ${done ? "text-[var(--ink-3)] line-through" : ""}`}>{t.t}</span>
        </button>
        <span className="flex min-w-0 items-center gap-1">{t.link && <LinkChip link={t.link} size="xs" />}<UrlsBadge t={t} /></span>
        <span className="min-w-0"><SubProgress subs={t.subs ?? []} /></span>
        <span className="truncate text-[10.5px] text-[var(--ink-3)]">{noAssignee ? "" : whoLabel(t)}</span>
        <select value={t.status ?? "todo"} onChange={(e) => onStatus(t, e.target.value as Status)} onClick={(e) => e.stopPropagation()} aria-label="Status"
          className="w-full cursor-pointer rounded-full border px-2 py-0.5 text-[10.5px] font-extrabold outline-none"
          style={{ borderColor: `${sc}55`, background: `${sc}14`, color: sc }}>
          {COLS.map((c) => <option key={c.k} value={c.k} style={{ color: "var(--ink)" }}>{c.label}</option>)}
        </select>
      </div>
    );
  };

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
          {iso && <>
            <div className="text-right text-[10.5px] font-bold text-[var(--ink-3)]">{Number(iso.slice(-2))}</div>
            <div className="relative space-y-0.5">
              {on(iso).slice(0, 3).map(chip)}
              {on(iso).length > 3 && (
                <button type="button" onClick={() => setMoreDay(moreDay === iso ? null : iso)}
                  className="w-full rounded px-1 text-left text-[9.5px] font-bold text-[#1d3a8f] hover:bg-[#eef4fd]">
                  +{on(iso).length - 3} more
                </button>
              )}
              {/* Was plain text, so the hidden tasks were unreachable — on a busy
                  day the calendar simply hid work from you. */}
              {moreDay === iso && (
                <>
                  <div className="fixed inset-0 z-[150]" onClick={() => setMoreDay(null)} />
                  {/* Opens leftwards from the right-hand columns — from Fri–Sun it
                      ran off the edge of the page. */}
                  <div className={`absolute ${i % 7 >= 4 ? "right-0" : "left-0"} top-full z-[151] mt-1 max-h-[260px] w-[min(240px,80vw)] overflow-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-[0_18px_44px_-16px_rgba(15,23,42,.45)]`}>
                    <div className="px-1 pb-1 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">
                      {new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })} · {on(iso).length}
                    </div>
                    <div className="space-y-0.5">{on(iso).map(chip)}</div>
                  </div>
                </>
              )}
            </div>
          </>}
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
    body = <div className="py-1">{list.length === 0 ? <div className="rounded-lg border border-dashed border-[var(--line)] py-8 text-center text-[12px] text-[var(--ink-3)]">Nothing due this day.</div> : <>{dayHeader}<div className="space-y-1.5">{list.map(fullChip)}</div></>}</div>;
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => stepBy(-1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] text-[15px] font-bold">‹</button>
        <div className="min-w-[180px] text-[14px] font-extrabold">{title}</div>
        <button type="button" onClick={() => stepBy(1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] text-[15px] font-bold">›</button>
        <button type="button" onClick={() => setAnchor(today)} className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-2)]">Today</button>
        {/* Segmented control. The selected pill was a pale tint on white, which
            at this size read as "slightly lighter", not "selected" — it takes a
            solid fill and white text to say which view you're in at a glance. */}
        <div className="ml-auto flex gap-0.5 rounded-full border border-[var(--line)] bg-[var(--panel)] p-1">
          {(["day", "week", "month"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
              className="rounded-full px-3.5 py-1 text-[11.5px] font-extrabold capitalize transition-colors"
              style={view === v
                ? { background: BLUE, color: "#fff", boxShadow: "0 1px 4px rgba(29,58,143,.35)" }
                : { color: "var(--ink-2)" }}>
              {v}
            </button>
          ))}
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
  const { portal, bookOpts, childOpts, parentOpts, listings, locations, cats, salesOpts = [], catsInUse, onForgetCat } = opts;
  // HQ has no children or bookings to link to — it has a pipeline.
  const types = portal === "platform" ? LINK_TYPES_PLATFORM : LINK_TYPES;
  const bookingHref = (ref: string) => `/${portal}/bookings?ref=${encodeURIComponent(ref)}`;
  const setK = (nk: string) => onChange(nk ? { k: nk as LinkKind, v: "" } : null);
  return (
    <div className="space-y-1.5">
      <select value={types.includes(k as LinkKind) ? k : (k || "")} onChange={(e) => setK(e.target.value)} className={inputCls}>
        <option value="">— not linked —</option>
        {types.map((kk) => <option key={kk} value={kk}>{LINK[kk].label}</option>)}
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

      {k === "sales" && (salesOpts.length
        ? <SearchSelect value={link?.v ?? ""} placeholder="Find a lead" options={salesOpts.map((o) => ({ v: o.v, sub: o.sub }))}
            onPick={(v) => { const o = salesOpts.find((x) => x.v === v); onChange(o ? { k: "sales", v: o.v, href: `/platform/sales?lead=${encodeURIComponent(o.id)}` } : null); }} inputCls={inputCls} />
        : <input value={link?.v ?? ""} onChange={(e) => onChange({ k: "sales", v: e.target.value })} placeholder="Lead or company name" className={inputCls} />)}

      {k === "gen" && <>
        <input list="task-cats" value={link?.v ?? ""} onChange={(e) => onChange({ k: "gen", v: e.target.value })} placeholder="Category — type a new one or pick" className={inputCls} />
        <datalist id="task-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
        {/* The categories in their own colours, so you pick the one you'll
            actually see on the board rather than guessing from a name. */}
        {cats.length > 0 && <div className="flex flex-wrap gap-1 pt-0.5">
          {cats.map((c) => {
            const on = (link?.v ?? "").toLowerCase() === c.toLowerCase();
            const col = catCol(c);
            const inUse = (catsInUse ?? []).some((u) => u.trim().toLowerCase() === c.trim().toLowerCase());
            return <span key={c} className="inline-flex items-center rounded-full border pr-1 text-[11px] font-bold"
              style={on ? { borderColor: col.fg, background: col.bg, color: col.fg } : { borderColor: "var(--line)", color: "var(--ink-2)", background: "var(--surface)" }}>
              <button type="button" onClick={() => onChange({ k: "gen", v: c })} className="inline-flex items-center gap-1.5 px-2 py-0.5">
                <CatSwatch name={c} />{c}
              </button>
              {onForgetCat && !inUse && (
                <button type="button" title={`Remove "${c}" from the category list`} onClick={() => onForgetCat(c)}
                  className="px-1 text-[12px] leading-none text-[var(--ink-3)] hover:text-[#c02636]">×</button>
              )}
            </span>;
          })}
        </div>}
      </>}
    </div>
  );
}

// ── Create-task modal ───────────────────────────────────────────────────────
export function CreateModal({ noAssignee, team, me, myEmail, opts, initialTitle, onClose, onCreate }: { noAssignee: boolean; team: { name: string; email: string }[]; me: string; myEmail?: string; opts: LinkOpts; initialTitle?: string; onClose: () => void; onCreate: (f: Partial<Task>, toCal: boolean) => void }) {
  // HQ has no Events calendar of its own — offering to sync a platform task
  // to "the Events calendar" would point at a feature that doesn't exist there.
  const isPlatform = usePathname()?.split("/")[1] === "platform";
  const [t, setT] = useState(initialTitle ?? "");
  const [who, setWho] = useState("");
  const [whoEmail, setWhoEmail] = useState("");
  const [prio, setPrio] = useState<Prio>("med");
  const [due, setDue] = useState("");
  const [time, setTime] = useState("");
  const [status, setStatus] = useState<Status>("todo");
  const [link, setLink] = useState<TaskLink | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [labelIn, setLabelIn] = useState("");
  const [toCal, setToCal] = useState(false);
  // Steps and links can go on at creation, the same as in the task itself.
  const [subs, setSubs] = useState<Sub[]>([]);
  const [subIn, setSubIn] = useState("");
  const [subWho, setSubWho] = useState("");
  const [urls, setUrls] = useState<TaskUrl[]>([]);
  // Recurrence. Off unless a frequency is chosen; the end date is required so a
  // repeat can never run forever by accident.
  const [rptFreq, setRptFreq] = useState<"" | "daily" | "weekdays" | "weekly" | "monthly">("");
  const [rptUntil, setRptUntil] = useState("");
  const inputCls = D_INPUT;
  const repeatOn = rptFreq !== "";
  const start = due || new Date().toISOString().slice(0, 10);
  const repeatBad = repeatOn && (!rptUntil || rptUntil < start);
  const addSub = () => { const x = subIn.trim(); if (!x) return; setSubs([...subs, { t: x, done: false, ...(subWho.trim() ? subOwner(subWho, team) : {}) }]); setSubIn(""); setSubWho(""); };
  const submit = () => {
    if (!t.trim() || repeatBad) return;
    onCreate({
      t: t.trim(), who: noAssignee ? "" : who, whoEmail: noAssignee ? "" : whoEmail, prio, due: due || null, time: time || null, status, link, labels,
      ...(subs.length ? { subs } : {}), ...(urls.length ? { urls } : {}),
      ...(repeatOn ? { repeat: { freq: rptFreq, until: rptUntil } } : {}),
    } as Partial<Task>, toCal);
  };
  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-[#0f172a]/45 p-3 pt-[4vh] backdrop-blur-[2px]" onClick={onClose}>
      {/* Wide, two columns of sections — the whole form on one screen. */}
      <div className="@container flex max-h-[92vh] w-full max-w-[980px] flex-col overflow-hidden rounded-3xl bg-[#f4f7fc] shadow-2xl" onClick={(e) => e.stopPropagation()}>

        <div className="op-hero relative flex-none overflow-hidden px-5 pb-4 pt-3.5 text-white" style={{ background: STATUS_HERO[status] }}>
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-2">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-white/75">New task</span>
            {repeatOn && <span className="rounded-full bg-white/18 px-2 py-0.5 text-[10.5px] font-extrabold ring-1 ring-white/25">🔁 Repeats</span>}
            <button type="button" onClick={onClose} aria-label="Close" className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px] font-bold text-white ring-1 ring-white/30 transition hover:bg-white/30">×</button>
          </div>
          <input autoFocus value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }} placeholder="What needs doing?" aria-label="Task title"
            className="relative mt-1 w-full rounded-lg bg-white/10 px-2.5 py-1.5 text-[20px] font-extrabold leading-tight text-white outline-none ring-1 ring-white/25 placeholder:text-white/60 focus:bg-white/15 focus:ring-white/60" style={{ fontFamily: "var(--ff-display)" }} />
          <div className="relative mt-3 max-w-[520px]"><StatusButtons value={status} onChange={setStatus} /></div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-1 pt-4">
          <div className="gap-3 @2xl:columns-2 [&>*]:mb-3 [&>*]:break-inside-avoid">
              <DSection icon="📋" tint="#1d3a8f" title="Details">
                <div className="space-y-3">
                  {!noAssignee && (
                    <div>
                      <DLabel>Assigned to</DLabel>
                      <div className="flex items-center gap-2">
                        <span className="grid h-9 w-9 flex-none place-items-center rounded-full text-[12px] font-extrabold text-white" style={{ background: who.trim() ? avatarTint(who) : "#cbd5e1" }}>{who.trim() ? initialsOf(who) : "?"}</span>
                        <input list="team-list-c" value={who}
                          onChange={(e) => { const v = e.target.value; setWho(v); setWhoEmail(team.find((p) => p.name.toLowerCase() === v.trim().toLowerCase())?.email ?? ""); }}
                          placeholder="Unassigned — type a name" className={inputCls} />
                        <datalist id="team-list-c">{team.map((p) => <option key={p.email || p.name} value={p.name}>{p.email}</option>)}</datalist>
                        {me && who.trim().toLowerCase() !== me.trim().toLowerCase() && (
                          <button type="button" onClick={() => { setWho(me); setWhoEmail(myEmail || ""); }}
                            className="shrink-0 rounded-xl border border-[#c7d6f5] bg-[#eef4ff] px-3 py-2 text-[12.5px] font-extrabold text-[#1d3a8f] hover:bg-[#e0ebff]">Me</button>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="block"><DLabel>Due / deadline</DLabel><input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} /></label>
                    <label className="block"><DLabel>Time (optional)</DLabel><input type="time" value={time} onChange={(e) => {
                      setTime(e.target.value);
                      // A time with no date is a reminder that can never fire — the
                      // sweep keys off the due date. Setting a time means today.
                      if (e.target.value && !due) setDue(new Date().toISOString().slice(0, 10));
                    }} className={inputCls} /></label>
                  </div>
                  {/* Repeat sits with the date it repeats from. */}
                  <div className="rounded-xl border border-[#a5f3fc] bg-[#f0fdff] p-2.5">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#0e7490]">🔁 Repeat{repeatOn ? <span className="rounded-full bg-[#0e7490] px-1.5 py-px text-[9.5px] text-white">On</span> : null}</div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <label className="block"><DLabel>How often</DLabel>
                        <select value={rptFreq} onChange={(e) => setRptFreq(e.target.value as typeof rptFreq)} className={inputCls}>
                          <option value="">Does not repeat</option>
                          <option value="daily">Every day</option>
                          <option value="weekdays">Every weekday (Mon–Fri)</option>
                          <option value="weekly">Every week</option>
                          <option value="monthly">Every month</option>
                        </select>
                      </label>
                      <label className="block"><DLabel>Until</DLabel><input type="date" value={rptUntil} min={start} disabled={!repeatOn} onChange={(e) => setRptUntil(e.target.value)} className={`${inputCls} disabled:opacity-40`} /></label>
                    </div>
                    {repeatOn && (
                      <p className={`mt-2 text-[11.5px] ${repeatBad ? "font-bold text-[#c0392b]" : "text-[var(--ink-3)]"}`}>
                        {repeatBad ? "Choose an end date on or after the start date." : `One task per date from ${fmtDay(start)} to ${fmtDay(rptUntil)}, each tickable on its own (max 366). You can change the dates later.`}
                      </p>
                    )}
                  </div>
                  <div><DLabel>Priority</DLabel><PrioButtons value={prio} onChange={setPrio} /></div>
                  <div><DLabel>Linked to</DLabel><LinkedPicker link={link} onChange={setLink} opts={opts} inputCls={inputCls} /></div>
                  <div>
                    <DLabel>Labels</DLabel>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {labels.map((l, i) => { const c = avatarTint(l); return (
                        <span key={i} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ background: `${c}18`, color: c, boxShadow: `inset 0 0 0 1px ${c}33` }}>
                          #{l}<button type="button" onClick={() => setLabels(labels.filter((_, j) => j !== i))} aria-label={`Remove ${l}`} className="opacity-60 hover:opacity-100">×</button>
                        </span>
                      ); })}
                      <input value={labelIn} onChange={(e) => setLabelIn(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && labelIn.trim()) { e.preventDefault(); setLabels([...labels, labelIn.trim()]); setLabelIn(""); } }} placeholder="+ add label, press Enter" className="w-[170px] rounded-full border border-dashed border-[#c7d2e5] bg-white px-3 py-1 text-[11.5px] outline-none focus:border-[#1d3a8f]" />
                    </div>
                  </div>
                </div>
              </DSection>

              <DSection icon="✅" tint="#0f8a4a" title="Checklist" meta={subs.length ? `${subs.length} step${subs.length === 1 ? "" : "s"}` : undefined}>
                {subs.length > 0 && (
                  <div className="mb-2 space-y-1.5">
                    {subs.map((x, i) => (
                      <div key={i} className="flex items-center gap-2.5 rounded-xl border border-[var(--line)] bg-white px-2.5 py-2 text-[13px]">
                        <span className="h-[16px] w-[16px] flex-none rounded border-2 border-[#b7dcc6]" />
                        <input value={x.t} onChange={(e) => setSubs(subs.map((y, j) => (j === i ? { ...y, t: e.target.value } : y)))} onBlur={() => { if (!x.t.trim()) setSubs(subs.filter((_, j) => j !== i)); }} aria-label="Step" title="Click to edit"
                          className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 font-semibold outline-none hover:bg-[#f1f5f9] focus:bg-white focus:ring-2 focus:ring-[#0f8a4a]/25" />
                        {x.who && <span className="rounded-full bg-[#f0faf4] px-2 py-0.5 text-[11px] font-bold text-[#0f8a4a]">👤 {x.who}</span>}
                        <button type="button" onClick={() => setSubs(subs.filter((_, j) => j !== i))} aria-label={`Remove ${x.t}`} className="flex-none rounded-full px-1.5 text-[15px] text-[var(--ink-3)] hover:bg-[#fdebec] hover:text-[#c02636]">×</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-1.5">
                  <input value={subIn} onChange={(e) => setSubIn(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSub(); } }} placeholder="Add a step…" className={inputCls} />
                  {!noAssignee && <input list="team-list-c" value={subWho} onChange={(e) => setSubWho(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSub(); } }} placeholder="Assign to" className="w-[118px] shrink-0 rounded-xl border border-[var(--line)] bg-[#f8fafc] px-2.5 py-2 text-[12.5px] outline-none focus:border-[#0f8a4a]" />}
                  <button type="button" onClick={addSub} disabled={!subIn.trim()} className="shrink-0 rounded-xl bg-[#0f8a4a] px-3.5 py-2 text-[12.5px] font-extrabold text-white shadow-sm disabled:opacity-35">Add</button>
                </div>
              </DSection>

              <DSection icon="🔗" tint="#2563eb" title="Links" meta={urls.length ? String(urls.length) : undefined}>
                {urls.length > 0 && <div className="mb-2 space-y-1.5">{urls.map((l, i) => <LinkTile key={l.url} l={l} onRemove={() => setUrls(urls.filter((_, j) => j !== i))} />)}</div>}
                <LinkAdder existing={urls} me={me} onAdd={(u) => setUrls([...urls, u])} />
              </DSection>

              {!isPlatform && (
                <DSection icon="📅" tint="#be185d" title="Events calendar">
                  <label className={`flex items-start gap-2.5 ${due ? "cursor-pointer" : "opacity-60"}`}>
                    <input type="checkbox" checked={toCal} disabled={!due} onChange={(e) => setToCal(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] flex-none accent-[#be185d]" />
                    <span className="text-[12.5px] text-[var(--ink-2)]"><b className="text-[var(--ink)]">Also show in the Events calendar</b><br />{due ? "Adds it to your sidebar calendar too." : "Set a due date first."}</span>
                  </label>
                </DSection>
              )}
          </div>
        </div>

        <div className="flex flex-none items-center gap-2 border-t border-[var(--line)] bg-white px-4 py-3">
          <span className="hidden text-[11px] text-[var(--ink-3)] @2xl:inline">Tip: ⌘/Ctrl + Enter in the title creates it.</span>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-[12.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">Cancel</button>
            <button type="button" onClick={submit} disabled={!t.trim() || repeatBad} className="rounded-xl bg-[#1d3a8f] px-5 py-2 text-[12.5px] font-extrabold text-white shadow-[0_6px_16px_-8px_rgba(29,58,143,.8)] hover:brightness-110 disabled:opacity-40">Create task</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Team — per-assignee ─────────────────────────────────────────────────────
function TeamView({ tasks, team, filter, setFilter, sort, setSort, today, onOpen, onStatus }: { tasks: Task[]; team: string[]; filter: string; setFilter: (s: string) => void; sort: "up" | "down"; setSort: (s: "up" | "down") => void; today: string; onOpen: (id: string) => void; onStatus: (t: Task, s: Status) => void }) {
  const people = filter ? [filter] : [...team, "__unassigned"];
  // Buckets matched on the EXACT `who` string, which quietly dropped tasks: a
  // task filed under your email and one filed under your name are both yours,
  // but only one of those strings is in `team`, so the other lot appeared in no
  // group at all — "5 matches" up top, one row below. Your own bucket matches on
  // identity (email first, then name), the same rule "My tasks" uses.
  //
  // This used to be one full scan of `tasks` PER PERSON (`.filter()` inside
  // `byOf`), called again for every chip's count AND again for every person's
  // list below — a tenant's whole task history times the size of the team,
  // twice, on every render (including every keystroke of the global search
  // box upstream). One pass buckets every task by its owner instead; `team`
  // has at most one entry whose identity is "Me" (the roster excludes your
  // own aliases — see `team` in TasksApp), so it's resolved once up front.
  const meKey = team.find((w) => personLabel(w) === "Me");
  const buckets = useMemo(() => {
    const m = new Map<string, Task[]>();
    const add = (k: string, t: Task) => { const a = m.get(k); if (a) a.push(t); else m.set(k, [t]); };
    for (const t of tasks) {
      if (!t.who || t.who.trim() === "") { add("__unassigned", t); continue; }
      if (meKey && isMine(t)) add(meKey, t);
      else add(t.who, t);
    }
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, meKey]);
  const byOf = (who: string) => buckets.get(who) ?? EMPTY_TASKS;
  const openCount = (who: string) => byOf(who).filter((t) => t.status !== "done").length;
  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => setFilter("")} className="rounded-full border px-3 py-1 text-[12px] font-bold" style={!filter ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>All</button>
        {/* The chip's VALUE stays the raw `who` the tasks were filed under; only
            the label is tidied, so filtering still matches. */}
        {team.map((w) => <button key={w} type="button" onClick={() => setFilter(w)} className="rounded-full border px-3 py-1 text-[12px] font-bold" style={filter === w ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{personLabel(w)} <span className="text-[var(--ink-3)]">{openCount(w)}</span></button>)}
        {/* Unassigned is a person as far as this view is concerned — work nobody
            has picked up is the thing you most need to see here, and it only had
            a group further down the page, never a chip to filter to. Always
            shown, including at zero, so "is anything unclaimed?" is answerable
            without scrolling. */}
        <button type="button" onClick={() => setFilter("__unassigned")} className="rounded-full border px-3 py-1 text-[12px] font-bold" style={filter === "__unassigned" ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>Unassigned <span className="text-[var(--ink-3)]">{openCount("__unassigned")}</span></button>
        <button type="button" onClick={() => setSort(sort === "up" ? "down" : "up")} className="ml-auto rounded-full border border-[var(--line)] px-3 py-1 text-[12px] font-bold text-[var(--ink-2)]">Due {sort === "up" ? "↑" : "↓"}</button>
      </div>
      <div className="space-y-4">
        {people.map((who) => {
          const list = byOf(who).slice().sort((a, b) => (sort === "up" ? 1 : -1) * `${a.due ?? "9999"}`.localeCompare(`${b.due ?? "9999"}`));
          if (list.length === 0) return null;
          const over = list.filter((t) => t.status !== "done" && t.due && daysBetween(today, t.due) < 0).length;
          const label = personLabel(who);
          return (
            <div key={who}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-[9.5px] font-extrabold text-[var(--ink-2)]" style={{ background: avBg(label) }}>{who === "__unassigned" ? "—" : initials(label)}</span>
                <span className="text-[12.5px] font-extrabold">{label}</span>
                <span className="text-[11px] text-[var(--ink-3)]">{openCount(who)} open{over ? ` · ${over} overdue` : ""}</span>
              </div>
              <div className="space-y-2">{foldRepeats(list).map((f) => <RepeatRows key={f.lead.id} lead={f.lead} rest={f.rest} today={today} noAssignee={false} hideDone={false} onOpen={onOpen} onStatus={onStatus} />)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Detail drawer ───────────────────────────────────────────────────────────
/** A drawer section: a card with a coloured icon tile, so each part of the task
 *  (details, checklist, links, comments…) is found by colour as much as by name. */
function DSection({ icon, tint, title, meta, right, children }: { icon: string; tint: string; title: string; meta?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-[0_1px_3px_rgba(15,23,42,.06)]" style={{ borderColor: `${tint}2e` }}>
      <header className="flex items-center gap-2.5 px-3.5 py-2.5" style={{ background: `linear-gradient(90deg, ${tint}17 0%, ${tint}05 70%, transparent 100%)`, borderBottom: `1px solid ${tint}1f` }}>
        <span className="grid h-7 w-7 flex-none place-items-center rounded-lg text-[13px] shadow-sm" style={{ background: tint }}><span className="drop-shadow-[0_1px_1px_rgba(0,0,0,.25)]">{icon}</span></span>
        <span className="text-[13.5px] font-extrabold text-[var(--ink)]">{title}</span>
        {meta && <span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold" style={{ background: `${tint}14`, color: tint }}>{meta}</span>}
        {right && <span className="ml-auto">{right}</span>}
      </header>
      <div className="px-3.5 py-3">{children}</div>
    </section>
  );
}
/** The header wears the status — the same colours as the board's columns — so
 *  the state of the task is the first thing you see. Shared by the drawer and
 *  the New task form so the two can't drift apart. */
const STATUS_HERO: Record<Status, string> = {
  backlog: "linear-gradient(135deg,#3f4a5c 0%,#8a93a6 100%)",
  todo: "linear-gradient(135deg,#16307a 0%,#3b82f6 100%)",
  prog: "linear-gradient(135deg,#9a3412 0%,#f59e0b 100%)",
  done: "linear-gradient(135deg,#0b6b35 0%,#16b364 100%)",
};
const STATUS_INK: Record<Status, string> = { backlog: "#475569", todo: "#1d4ed8", prog: "#b45309", done: "#0f7a3d" };
const D_INPUT = "w-full rounded-xl border border-[var(--line)] bg-[#f8fafc] px-3 py-2 text-[13px] text-[var(--ink)] outline-none transition focus:border-[#1d3a8f] focus:bg-white focus:ring-2 focus:ring-[#1d3a8f]/15";
const DLabel = ({ children }: { children: ReactNode }) => <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-[var(--ink-3)]">{children}</div>;
/** Status as four buttons on the coloured header. */
function StatusButtons({ value, onChange }: { value: Status; onChange: (s: Status) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1 rounded-xl bg-black/20 p-1">
      {COLS.map((c) => { const on = value === c.k; return (
        <button key={c.k} type="button" onClick={() => onChange(c.k)} aria-pressed={on}
          className={`rounded-lg px-1 py-1.5 text-[11.5px] font-extrabold transition ${on ? "shadow-sm" : "text-white/85 hover:bg-white/10"}`}
          style={on ? { background: "#fff", color: STATUS_INK[c.k] } : undefined}>{c.label}</button>
      ); })}
    </div>
  );
}
/** Priority as four coloured buttons. */
function PrioButtons({ value, onChange }: { value: Prio; onChange: (p: Prio) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {(Object.keys(PRIO) as Prio[]).map((p) => { const on = value === p; const c = PRIO[p].dot; return (
        <button key={p} type="button" onClick={() => onChange(p)} aria-pressed={on}
          className="flex items-center justify-center gap-1.5 rounded-xl border-2 px-1.5 py-1.5 text-[12px] font-extrabold transition hover:-translate-y-px"
          style={on ? { background: c, borderColor: c, color: "#fff", boxShadow: `0 6px 14px -8px ${c}` } : { borderColor: `${c}40`, color: c, background: `${c}0d` }}>
          <span className="h-2 w-2 rounded-full" style={{ background: on ? "#fff" : c }} />{PRIO[p].label}
        </button>
      ); })}
    </div>
  );
}
/** A link tile (drawer + New task). */
function LinkTile({ l, onRemove }: { l: TaskUrl; onRemove: () => void }) {
  const k = urlKind(l.url);
  return (
    <div className="group flex items-center gap-2.5 rounded-xl border border-[#dbe6fb] bg-gradient-to-r from-[#f5f9ff] to-white px-2.5 py-2">
      <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-white text-[18px] shadow-sm ring-1 ring-[#dbe6fb]">{k.icon}</span>
      <a href={l.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-extrabold text-[#1d3a8f] group-hover:underline">{l.title || k.label} <span className="text-[11px]">↗</span></div>
        <div className="truncate text-[10.5px] text-[var(--ink-3)]">{l.title ? k.label : l.url}{l.by ? ` · added by ${l.by}` : ""}</div>
      </a>
      <button type="button" title="Copy link" onClick={() => { void navigator.clipboard?.writeText(l.url); }} className="flex-none rounded-lg px-1.5 py-1 text-[12px] text-[var(--ink-3)] hover:bg-[#eef4ff] hover:text-[#1d3a8f]">⧉</button>
      <button type="button" title="Remove link" onClick={onRemove} className="flex-none rounded-lg px-1.5 py-0.5 text-[15px] text-[var(--ink-3)] hover:bg-[#fdebec] hover:text-[#c0392b]">×</button>
    </div>
  );
}
/** Paste-a-link row (drawer + New task). */
function LinkAdder({ existing, me, onAdd }: { existing: TaskUrl[]; me: string; onAdd: (u: TaskUrl) => void }) {
  const [urlIn, setUrlIn] = useState("");
  const [title, setTitle] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const add = () => {
    const n = normaliseUrl(urlIn);
    if (n.error) { setErr(n.error); return; }
    if (!n.url) return;
    if (existing.some((x) => x.url === n.url)) { setErr("That link is already on this task."); return; }
    onAdd({ url: n.url, ...(title.trim() ? { title: title.trim() } : {}), by: me, at: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" }) });
    setUrlIn(""); setTitle(""); setErr(null);
  };
  return (
    <div className="space-y-1.5">
      <input value={urlIn} onChange={(e) => { setUrlIn(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Paste a link — Google Drive, Docs, Sheets, a web page…" className={D_INPUT} />
      <div className="flex gap-1.5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Name it (optional)" className={D_INPUT} />
        <button type="button" onClick={add} disabled={!urlIn.trim()} className="shrink-0 rounded-xl bg-[#2563eb] px-3.5 py-2 text-[12.5px] font-extrabold text-white shadow-sm disabled:opacity-35">Add link</button>
      </div>
      {err && <div className="text-[11.5px] font-bold text-[#c0392b]">{err}</div>}
    </div>
  );
}
/** The drawer for a member of staff who was handed one step of someone else's
 *  task (d11s8): the task's title and due date for context, every step with
 *  ONLY theirs tickable, and the comments. Least privilege — see tasks.ts. */
function StepsOnlyDrawer({ task, me, myEmail, comment, setComment, onAddComment, onClose, onSave }: { task: Task; me: string; myEmail?: string; comment: string; setComment: (v: string) => void; onAddComment: () => void; onClose: () => void; onSave: (f: Partial<Task>) => void }) {
  const subs = task.subs ?? [];
  const mine = (x: Sub) => isMineOf(x, { name: me, email: myEmail ?? "" });
  return (
    <div className="fixed inset-0 z-[9999] flex justify-end bg-[#0f172a]/45 backdrop-blur-[2px]" onClick={onClose}>
      <div className="relative flex h-full w-full max-w-[560px] flex-col overflow-y-auto bg-[#f4f7fc] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-[var(--ink-3)]">Your step on a task</span>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-white text-[17px] font-bold text-[var(--ink-2)] ring-1 ring-[var(--line)]">×</button>
        </div>
        <h2 className="mt-1 text-[19px] font-extrabold leading-tight text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{task.t}</h2>
        <div className="mt-1 text-[12px] text-[var(--ink-3)]">
          {task.due ? `Due ${fmtDay(task.due)}${task.time ? ` · ${task.time}` : ""}` : "No due date"}{task.who ? ` · task owner: ${task.who}` : ""}
        </div>
        <p className="mt-2 rounded-xl border border-[#c7d6f5] bg-[#eef4ff] px-3 py-2 text-[12px] text-[#1d3a8f]">You&rsquo;ve been given a step on this task. Tick yours when it&rsquo;s done, or leave a comment — the rest of the task stays with its owner.</p>
        <div className="mt-3 space-y-1.5">
          {subs.map((x, i) => (
            <label key={i} className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-[13px] ${mine(x) ? "border-[#0f8a4a]/40 bg-white" : "border-[var(--line)] bg-[#f8fafc] opacity-70"}`}>
              <input type="checkbox" checked={x.done} disabled={!mine(x)} onChange={() => onSave({ subs: subs.map((y, j) => (j === i ? { ...y, done: !y.done } : y)) })} aria-label={x.done ? `Untick ${x.t}` : `Tick ${x.t}`} className="h-[18px] w-[18px] flex-none accent-[#16b364] disabled:cursor-not-allowed" />
              <span className={"min-w-0 flex-1 " + (x.done ? "text-[var(--ink-3)] line-through" : "font-semibold text-[var(--ink)]")}>{x.t}</span>
              <span className="flex-none text-[11px] text-[var(--ink-3)]">{mine(x) ? "You" : x.who || "—"}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 text-[12px] font-extrabold text-[var(--ink-2)]">Comments</div>
        <div className="mt-1.5 space-y-1.5">
          {(task.comments ?? []).map((c, i) => (
            <div key={i} className="rounded-xl bg-white px-3 py-2 text-[12.5px] ring-1 ring-[var(--line)]"><b>{c.who}</b> <span className="text-[11px] text-[var(--ink-3)]">{c.when}</span><div className="mt-0.5 whitespace-pre-wrap">{c.body}</div></div>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5">
          <input value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onAddComment(); }} placeholder="Add a comment…" className={D_INPUT} />
          <button type="button" onClick={onAddComment} disabled={!comment.trim()} className="shrink-0 rounded-xl bg-[#ea580c] px-3.5 py-2 text-[12.5px] font-extrabold text-white disabled:opacity-35">Post</button>
        </div>
      </div>
    </div>
  );
}
const initialsOf = (name: string) => name.trim().split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
/** A stable colour per person / label, from a small palette that reads on white. */
const AVATAR_TINTS = ["#1d3a8f", "#0f8a4a", "#b45309", "#be185d", "#0e7490", "#7c2d12", "#4338ca", "#15803d", "#c2410c", "#0369a1"];
const avatarTint = (s: string) => AVATAR_TINTS[[...s.trim().toLowerCase()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR_TINTS.length];
function Drawer({ task, team, noAssignee, me, myEmail, meDerived, opts, onClose, onPatch, onSyncCal, onUnsyncCal, onArchive, onDelete, onDeleteSeries, seriesStart, onEditSeries }: { task: Task; team: { name: string; email: string }[]; noAssignee: boolean; me: string; myEmail?: string; meDerived?: boolean; opts: LinkOpts; onClose: () => void; onPatch: (f: Partial<Task>, scope?: "one" | "all") => void; onSyncCal: () => void; onUnsyncCal: () => void; onArchive: () => void; onDelete: () => void; onDeleteSeries: () => void; seriesStart?: string; onEditSeries: (r: { from: string; until: string; freq: string }) => Promise<string | null> }) {
  // HQ has no Events calendar of its own.
  const isPlatform = usePathname()?.split("/")[1] === "platform";
  // Editing when the repeat runs (its first/last date, how often).
  const [rangeEdit, setRangeEdit] = useState<{ from: string; until: string; freq: string } | null>(null);
  const [rangeBusy, setRangeBusy] = useState(false);
  const [rangeMsg, setRangeMsg] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [sub, setSub] = useState("");
  const [subWho, setSubWho] = useState("");
  const [comment, setComment] = useState("");
  // ── Editing one date of a repeat ──────────────────────────────────────────
  // The drawer saves as you type, so asking "this date or all dates?" on every
  // keystroke would be unusable. It asks ONCE, on the first change that could
  // go either way, then remembers the answer for as long as the drawer is open
  // (and shows it in the banner, where it can be changed).
  const [scope, setScope] = useState<"one" | "all" | null>(null);
  const [pending, setPending] = useState<Partial<Task> | null>(null);
  const save = (f: Partial<Task>) => {
    if (!task.seriesId || !asksAboutSeries(f)) { onPatch(f, "one"); return; }
    if (scope) { onPatch(f, scope); return; }
    setPending(f);
  };
  const answer = (s: "one" | "all") => { setScope(s); if (pending) onPatch(pending, s); setPending(null); };
  // Comments: the latest two, the rest behind "show all".
  const [allComments, setAllComments] = useState(false);
  // Both of these were Enter-only, with no button and no other affordance: type
  // a comment, click away, and it vanished with no sign it was ever there.
  const addComment = () => {
    const body = comment.trim(); if (!body) return;
    // Date AND time — "12 Sept" on its own can't tell two comments that day apart.
    const at = new Date();
    const when = `${at.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · ${at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
    save({ comments: [...(task.comments ?? []), { who: me || "You", body, when }] });
    setComment("");
  };
  const addSub = () => {
    const t = sub.trim(); if (!t) return;
    save({ subs: [...(task.subs ?? []), { t, done: false, ...(subWho.trim() ? subOwner(subWho, team) : {}) }] });
    setSub(""); setSubWho("");
  };
  // Closing the drawer with something typed but unsent is the other way work
  // got lost. Ask rather than discard.
  const closeGuarded = () => {
    if ((comment.trim() || sub.trim()) && !confirm("You have something typed that hasn't been added yet. Close anyway?")) return;
    onClose();
  };
  // Given only a step on someone else's task: the cut-down view — their step(s)
  // to tick and the comments, nothing else editable (the server enforces it).
  if (task.subtaskOnly) return <StepsOnlyDrawer task={task} me={me} myEmail={myEmail} comment={comment} setComment={setComment} onAddComment={addComment} onClose={closeGuarded} onSave={(f) => onPatch(f, "one")} />;
  const inputCls = D_INPUT;
  const status = task.status ?? "todo";
  const prio = task.prio ?? "med";
  const todayIso = new Date().toLocaleDateString("en-CA");
  const due = dueLabel(task.due, todayIso);
  const isOverdue = status !== "done" && !!task.due && task.due < todayIso;
  const subs = task.subs ?? [];
  const subsDone = subs.filter((x) => x.done).length;
  const FREQ_WORD: Record<string, string> = { daily: "Every day", weekdays: "Every weekday", weekly: "Every week", monthly: "Every month" };
  const lbl = (t: string) => <DLabel>{t}</DLabel>;
  const heroChip = "inline-flex items-center gap-1 rounded-full bg-white/18 px-2.5 py-1 text-[11.5px] font-bold text-white ring-1 ring-white/25 backdrop-blur-sm";
  return (
    // z-[9999] is the app's modal layer (BookingDetail, TakeBookingModal, the
    // wizards). At z-50 this sat UNDER the portal header's deliberate z-[300],
    // which painted over the drawer's title and close button.
    <div className="fixed inset-0 z-[9999] flex justify-end bg-[#0f172a]/45 backdrop-blur-[2px]" onClick={closeGuarded}>
      {/* Wide, with two columns of sections when there's room — the task fits
          on one screen instead of a long scroll. */}
      <div className="@container relative flex h-full w-full max-w-[940px] flex-col bg-[#f4f7fc] shadow-2xl" onClick={(e) => e.stopPropagation()}>

        {/* ── Header: title, the facts at a glance, status, complete ───────── */}
        <div className="relative flex-none overflow-hidden px-5 pb-4 pt-3.5 text-white" style={{ background: STATUS_HERO[status] }}>
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-2">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-white/75">Task</span>
            {task.seriesId && <span className="rounded-full bg-white/18 px-2 py-0.5 text-[10.5px] font-extrabold ring-1 ring-white/25">🔁 {FREQ_WORD[task.seriesFreq ?? ""] ?? "Repeats"}</span>}
            {task.spawn && <span className="rounded-full bg-[#fde68a] px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#7c5a06]">auto</span>}
            <button type="button" onClick={closeGuarded} aria-label="Close" className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px] font-bold text-white ring-1 ring-white/30 transition hover:bg-white/30">×</button>
          </div>
          <input value={task.t} onChange={(e) => save({ t: e.target.value })} aria-label="Task title"
            className="relative mt-1 w-full rounded-lg bg-transparent px-1 py-0.5 text-[20px] font-extrabold leading-tight text-white outline-none placeholder:text-white/60 hover:bg-white/10 focus:bg-white/15" style={{ fontFamily: "var(--ff-display)" }} />
          <div className="relative mt-2 flex flex-wrap items-center gap-1.5">
            <span className={heroChip} style={isOverdue ? { background: "#fee2e2", color: "#b91c1c" } : undefined}>
              📅 {task.due ? `${fmtDay(task.due)}${task.time ? ` · ${task.time}` : ""}` : "No due date"}{due && status !== "done" ? ` · ${isOverdue ? "overdue" : due.text}` : ""}
            </span>
            <span className={heroChip}><span className="h-2.5 w-2.5 rounded-full ring-2 ring-white/80" style={{ background: PRIO[prio].dot }} />{PRIO[prio].label}</span>
            {subs.length > 0 && <span className={heroChip}>✅ {subsDone}/{subs.length}</span>}
            {(task.urls?.length ?? 0) > 0 && <span className={heroChip}>🔗 {task.urls!.length}</span>}
            {task.link && <span className="rounded-full bg-white p-0.5"><LinkChip link={task.link} /></span>}
          </div>
          {/* Status as four buttons, not a dropdown — it's the thing you change
              most. Beside "Mark complete" when the drawer is wide. */}
          <div className="relative mt-3 grid gap-2 @2xl:grid-cols-[1fr_230px]">
            <StatusButtons value={status} onChange={(v) => save({ status: v })} />
            <button type="button" onClick={() => save({ status: status === "done" ? "todo" : "done" })}
              className="w-full rounded-xl bg-white px-3 py-2.5 text-[13.5px] font-extrabold shadow-[0_6px_18px_-8px_rgba(0,0,0,.45)] transition hover:-translate-y-px"
              style={{ color: status === "done" ? "#0f7a3d" : "#1d3a8f" }}>
              {status === "done" ? "✓ Done — reopen it" : "✓ Mark complete"}
            </button>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 pb-1 pt-4">
         {/* Sections flow down the left column and on into the right, balanced
             by height — two fixed columns left a gap under the shorter one. */}
         <div className="gap-3 @2xl:columns-2 [&>*]:mb-3 [&>*]:break-inside-avoid">
          {meDerived && (
            <div className="flex items-start gap-2 rounded-xl border border-[#f3d9a4] bg-[#fdf6e3] px-3 py-2 text-[11.5px] text-[#7c5a06]">
              <span>⚠️</span><span>Your account has no name set, so &ldquo;{me}&rdquo; is being used. Set it in <b>Account → Name</b>.</span>
            </div>
          )}

          {task.seriesId && (
            <DSection icon="🔁" tint="#0e7490" title="Repeat" meta={FREQ_WORD[task.seriesFreq ?? ""] ?? undefined}
              right={!rangeEdit ? <button type="button" onClick={() => { setRangeMsg(null); setRangeEdit({ from: task.seriesFrom ?? seriesStart ?? task.due ?? "", until: task.seriesUntil ?? task.due ?? "", freq: task.seriesFreq ?? "daily" }); }} className="rounded-lg bg-[#0e7490] px-2.5 py-1 text-[11.5px] font-extrabold text-white shadow-sm hover:brightness-110">Edit dates</button> : null}>
              <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--ink)]">
                <span className="rounded-lg bg-[#ecfeff] px-2.5 py-1 text-[#0e7490] ring-1 ring-[#a5f3fc]">{(task.seriesFrom ?? seriesStart) ? fmtDay((task.seriesFrom ?? seriesStart)!) : "—"}</span>
                <span className="text-[var(--ink-3)]">→</span>
                <span className="rounded-lg bg-[#ecfeff] px-2.5 py-1 text-[#0e7490] ring-1 ring-[#a5f3fc]">{task.seriesUntil ? fmtDay(task.seriesUntil) : "—"}</span>
              </div>
              {rangeEdit && (
                <div className="mt-3 rounded-xl border border-[#a5f3fc] bg-[#f0fdff] p-3">
                  <div className="grid grid-cols-3 gap-2">
                    <label>{lbl("From")}<input type="date" value={rangeEdit.from} onChange={(e) => setRangeEdit({ ...rangeEdit, from: e.target.value })} className={inputCls} /></label>
                    <label>{lbl("Until")}<input type="date" value={rangeEdit.until} min={rangeEdit.from} onChange={(e) => setRangeEdit({ ...rangeEdit, until: e.target.value })} className={inputCls} /></label>
                    <label>{lbl("How often")}<select value={rangeEdit.freq} onChange={(e) => setRangeEdit({ ...rangeEdit, freq: e.target.value })} className={inputCls}><option value="daily">Every day</option><option value="weekdays">Weekdays</option><option value="weekly">Every week</option><option value="monthly">Every month</option></select></label>
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-[var(--ink-3)]">Dates outside the new range are removed — except ones already done or archived, which are kept. New dates copy this task&rsquo;s details.</p>
                  <div className="mt-2.5 flex items-center justify-end gap-2">
                    <button type="button" onClick={() => setRangeEdit(null)} className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">Cancel</button>
                    <button type="button" disabled={rangeBusy || !rangeEdit.from || !rangeEdit.until || rangeEdit.until < rangeEdit.from}
                      onClick={async () => { setRangeBusy(true); const msg = await onEditSeries(rangeEdit); setRangeBusy(false); setRangeMsg(msg); if (msg && !msg.startsWith("⚠")) setRangeEdit(null); }}
                      className="rounded-lg bg-[#0e7490] px-3.5 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-40">{rangeBusy ? "Saving…" : "Save dates"}</button>
                  </div>
                </div>
              )}
              {rangeMsg && <div className={`mt-2 text-[11.5px] font-semibold ${rangeMsg.startsWith("⚠") ? "text-[#c0392b]" : "text-[#0f7a43]"}`}>{rangeMsg}</div>}
              {/* Once you've answered, the answer stays visible — otherwise the
                  next edit silently follows a decision you made minutes ago. */}
              {scope && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-[var(--panel)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--ink-2)]">
                  <span>Your edits apply to <b>{scope === "all" ? "all dates in the repeat" : "just this date"}</b>.</span>
                  <button type="button" onClick={() => setScope(null)} className="ml-auto font-extrabold text-[#0e7490] underline">Change</button>
                </div>
              )}
            </DSection>
          )}

          <DSection icon="📋" tint="#1d3a8f" title="Details">
            <div className="space-y-3">
              {!noAssignee && (
                <div>
                  {lbl("Assigned to")}
                  <div className="flex items-center gap-2">
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-full text-[12px] font-extrabold text-white" style={{ background: (task.who ?? "").trim() ? avatarTint(task.who ?? "") : "#cbd5e1" }}>{(task.who ?? "").trim() ? initialsOf(task.who ?? "") : "?"}</span>
                    <input list="team-list" value={task.who ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        // Typing a known name attaches their email; a free-typed name
                        // clears it rather than leaving a stale one attached.
                        const hit = team.find((p) => p.name.toLowerCase() === v.trim().toLowerCase());
                        save({ who: v, whoEmail: hit?.email ?? "" });
                      }}
                      placeholder="Unassigned — type a name" className={inputCls} />
                    {/* value is what lands in the field; the label disambiguates two
                        people with the same name. */}
                    <datalist id="team-list">{team.map((p) => <option key={p.email || p.name} value={p.name}>{p.email}</option>)}</datalist>
                    {/* A datalist only opens once you type — this is the one-tap
                        way to put a task on yourself. */}
                    {me && (task.who ?? "").trim().toLowerCase() !== me.trim().toLowerCase() && (
                      <button type="button" onClick={() => save({ who: me, whoEmail: myEmail || "" })}
                        className="shrink-0 rounded-xl border border-[#c7d6f5] bg-[#eef4ff] px-3 py-2 text-[12.5px] font-extrabold text-[#1d3a8f] hover:bg-[#e0ebff]">Me</button>
                    )}
                  </div>
                  {(task.whoEmail ?? "").trim() && <div className="mt-1 pl-11 text-[11px] text-[var(--ink-3)]">{task.whoEmail}</div>}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">{lbl("Due date")}<input type="date" value={task.due ?? ""} onChange={(e) => save({ due: e.target.value || null })} className={inputCls} /></label>
                <label className="block">{lbl("Time")}<input type="time" value={task.time ?? ""} onChange={(e) => {
                  const v = e.target.value || null;
                  // Same rule as the create form: a time implies a date, or nothing
                  // will ever remind you.
                  save(v && !task.due ? { time: v, due: new Date().toISOString().slice(0, 10) } : { time: v });
                }} className={inputCls} /></label>
              </div>
              <div>
                {lbl("Priority")}
                <PrioButtons value={prio} onChange={(p) => save({ prio: p })} />
              </div>
              <div>
                {lbl("Linked to")}
                <LinkedPicker link={task.link} onChange={(l) => save({ link: l })} opts={opts} inputCls={inputCls} />
              </div>
              <div>
                {lbl("Labels")}
                <div className="flex flex-wrap items-center gap-1.5">
                  {(task.labels ?? []).map((l, i) => { const c = avatarTint(l); return (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ background: `${c}18`, color: c, boxShadow: `inset 0 0 0 1px ${c}33` }}>
                      #{l}<button type="button" onClick={() => save({ labels: (task.labels ?? []).filter((_, j) => j !== i) })} aria-label={`Remove ${l}`} className="opacity-60 hover:opacity-100">×</button>
                    </span>
                  ); })}
                  <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && label.trim()) { save({ labels: [...(task.labels ?? []), label.trim()] }); setLabel(""); } }} placeholder="+ add label, press Enter" className="w-[170px] rounded-full border border-dashed border-[#c7d2e5] bg-white px-3 py-1 text-[11.5px] outline-none focus:border-[#1d3a8f]" />
                </div>
              </div>
            </div>
          </DSection>

          <DSection icon="✅" tint="#0f8a4a" title="Checklist" meta={subs.length ? `${subsDone} of ${subs.length} done` : undefined}>
            {subs.length > 0 && (
              <div className="mb-2.5 h-2 overflow-hidden rounded-full bg-[#dcf3e5]"><div className="h-full rounded-full bg-gradient-to-r from-[#16b364] to-[#0f8a4a] transition-all" style={{ width: `${Math.round((subsDone / subs.length) * 100)}%` }} /></div>
            )}
            <div className="space-y-1.5">
              {subs.map((x, i) => (
                <div key={i} className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-[13px] transition ${x.done ? "border-[#cfe8d8] bg-[#f0faf4]" : "border-[var(--line)] bg-white"}`}>
                  <input type="checkbox" checked={x.done} onChange={() => save({ subs: subs.map((y, j) => (j === i ? { ...y, done: !y.done } : y)) })} aria-label={x.done ? `Untick ${x.t}` : `Tick ${x.t}`} className="h-[18px] w-[18px] flex-none cursor-pointer accent-[#16b364]" />
                  {/* Editable in place — click the words to fix a typo. */}
                  <input value={x.t} onChange={(e) => save({ subs: subs.map((y, j) => (j === i ? { ...y, t: e.target.value } : y)) })} onBlur={() => { if (!x.t.trim()) save({ subs: subs.filter((_, j) => j !== i) }); }} aria-label="Step" title="Click to edit"
                    className={"min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 outline-none hover:bg-[#f1f5f9] focus:bg-white focus:ring-2 focus:ring-[#0f8a4a]/25 " + (x.done ? "text-[var(--ink-3)] line-through" : "font-semibold text-[var(--ink)]")} />
                  {/* Same datalist as the parent's assignee, so the two can't offer
                      different people. Blank = inherits the parent's owner. */}
                  {!noAssignee && (
                    <input list="team-list" value={x.who ?? ""} placeholder="👤 anyone"
                      onChange={(e) => save({ subs: subs.map((y, j) => (j === i ? { ...y, ...subOwner(e.target.value, team), who: e.target.value } : y)) })}
                      className="w-[112px] flex-none rounded-full border border-[var(--line)] bg-[#f8fafc] px-2.5 py-1 text-[11.5px] font-semibold outline-none focus:border-[#0f8a4a]" />
                  )}
                  <button type="button" onClick={() => save({ subs: subs.filter((_, j) => j !== i) })} aria-label={`Remove ${x.t}`} className="flex-none rounded-full px-1.5 text-[15px] text-[var(--ink-3)] hover:bg-[#fdebec] hover:text-[#c02636]">×</button>
                </div>
              ))}
            </div>
            <div className={`${subs.length ? "mt-2" : ""} flex gap-1.5`}>
              <input value={sub} onChange={(e) => setSub(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addSub(); }} placeholder="Add a step…" className={inputCls} />
              {!noAssignee && (
                <input list="team-list" value={subWho} onChange={(e) => setSubWho(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addSub(); }} placeholder="Assign to"
                  className="w-[118px] shrink-0 rounded-xl border border-[var(--line)] bg-[#f8fafc] px-2.5 py-2 text-[12.5px] outline-none focus:border-[#0f8a4a]" />
              )}
              <button type="button" onClick={addSub} disabled={!sub.trim()}
                className="shrink-0 rounded-xl bg-[#0f8a4a] px-3.5 py-2 text-[12.5px] font-extrabold text-white shadow-sm disabled:opacity-35">Add</button>
            </div>
          </DSection>

          <DSection icon="🔗" tint="#2563eb" title="Links" meta={task.urls?.length ? String(task.urls.length) : undefined}>
            {(task.urls ?? []).length > 0 && (
              <div className="mb-2 space-y-1.5">
                {(task.urls ?? []).map((l, i) => <LinkTile key={l.url} l={l} onRemove={() => save({ urls: (task.urls ?? []).filter((_, j) => j !== i) })} />)}
              </div>
            )}
            <LinkAdder existing={task.urls ?? []} me={me} onAdd={(u) => save({ urls: [...(task.urls ?? []), u] })} />
            {(task.atts ?? []).length > 0 && <div className="mt-2">{(task.atts ?? []).map((a, i) => <div key={i} className="text-[12px] text-[var(--ink-2)]">📎 {a.name}</div>)}</div>}
            <div className="mt-1.5 text-[10.5px] leading-snug text-[var(--ink-3)]">To attach a file, put it on Google Drive (or Dropbox/OneDrive) and paste its share link. Anyone opening it needs access to that file.</div>
          </DSection>

          <DSection icon="💬" tint="#ea580c" title="Comments" meta={task.comments?.length ? String(task.comments.length) : undefined}>
            {(task.comments ?? []).length > 2 && (
              <button type="button" onClick={() => setAllComments((v) => !v)} className="mb-2 w-full rounded-lg border border-dashed border-[#fdc9a6] bg-[#fffaf6] px-3 py-1.5 text-[11.5px] font-extrabold text-[#c2410c] hover:bg-[#fff4ec]">
                {allComments ? "▲ Show only the latest 2" : `▼ Show ${(task.comments ?? []).length - 2} earlier comment${(task.comments ?? []).length - 2 === 1 ? "" : "s"}`}
              </button>
            )}
            {(task.comments ?? []).length > 0 && (
              <div className="mb-2.5 space-y-2">
                {(allComments ? (task.comments ?? []) : (task.comments ?? []).slice(-2)).map((c, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="grid h-7 w-7 flex-none place-items-center rounded-full text-[10.5px] font-extrabold text-white" style={{ background: avatarTint(c.who) }}>{initialsOf(c.who)}</span>
                    <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-[#fff4ec] px-3 py-2 ring-1 ring-[#fde0cc]">
                      <div className="text-[11.5px] font-extrabold text-[#9a3412]">{c.who} <span className="font-semibold text-[var(--ink-3)]">· {c.when}</span></div>
                      <div className="mt-0.5 whitespace-pre-wrap text-[12.5px] text-[var(--ink)]">{c.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <input value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addComment(); }} placeholder="Write a comment…" className={inputCls} />
              <button type="button" onClick={addComment} disabled={!comment.trim()}
                className="shrink-0 rounded-xl bg-[#ea580c] px-3.5 py-2 text-[12.5px] font-extrabold text-white shadow-sm disabled:opacity-35">Post</button>
            </div>
          </DSection>

          {!isPlatform && (
            <DSection icon="📅" tint="#be185d" title="Events calendar" meta={task.calEventId ? "Showing" : undefined}>
              {!task.due ? (
                <div className="text-[12px] text-[var(--ink-3)]">Set a due date to show this task on the Events calendar.</div>
              ) : task.calEventId ? (
                <>
                  <div className="text-[12px] text-[var(--ink-2)]"><b className="text-[#0f8a4a]">✓ On the Events calendar.</b> Its labels, subtasks, links and comments show in the event notes — press Update after you change them.</div>
                  <div className="mt-2.5 flex gap-2">
                    <button type="button" onClick={onSyncCal} className="rounded-xl bg-[#be185d] px-3.5 py-2 text-[12px] font-extrabold text-white shadow-sm">Update event</button>
                    <button type="button" onClick={onUnsyncCal} className="rounded-xl border border-[var(--line)] bg-white px-3.5 py-2 text-[12px] font-bold text-[var(--ink-2)]">Remove from calendar</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[12px] text-[var(--ink-2)]">Also show this task on the Events calendar, carrying its labels, subtasks, links and comments into the event notes.</div>
                  <button type="button" onClick={onSyncCal} className="mt-2.5 rounded-xl bg-[#be185d] px-3.5 py-2 text-[12px] font-extrabold text-white shadow-sm">Show in Events calendar</button>
                </>
              )}
            </DSection>
          )}
         </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="flex flex-none items-center gap-2 border-t border-[var(--line)] bg-white px-4 py-3">
          <button type="button" onClick={onDelete} className="rounded-xl px-2.5 py-2 text-[12px] font-bold text-[#c02636] hover:bg-[#fdebec]">🗑 Delete{task.seriesId ? " this date" : ""}</button>
          {/* Deleting one date out of a 200-day repeat is rarely what you meant. */}
          {task.seriesId && (
            <button type="button" onClick={onDeleteSeries} className="rounded-xl px-2.5 py-2 text-[12px] font-bold text-[#c02636] hover:bg-[#fdebec]">Delete whole repeat</button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onArchive} className="rounded-xl border border-[var(--line)] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">Archive</button>
            <button type="button" onClick={onClose} className="rounded-xl bg-[#1d3a8f] px-5 py-2 text-[12.5px] font-extrabold text-white shadow-[0_6px_16px_-8px_rgba(29,58,143,.8)] hover:brightness-110">Done</button>
          </div>
        </div>

        {/* The one question a repeat has to ask. Held inside the drawer so the
            edit that triggered it stays on screen behind the sheet, and there's
            no way past it except answering — dismissing would leave the change
            typed but unsaved, which is how the old behaviour lost work. */}
        {pending && (
          // Fixed to the screen, not the drawer: pinned inside the drawer's
          // scrolling body it sat off the bottom once you'd scrolled down (to
          // Links, say) and couldn't be reached.
          <div className="fixed inset-0 z-[210] flex items-end justify-center bg-black/35 p-3 sm:items-center" onClick={(e) => e.stopPropagation()}>
            <div className="max-h-[calc(100vh-24px)] w-full max-w-[460px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-4 shadow-2xl">
              <div className="text-[14.5px] font-extrabold text-[var(--ink)]">This is a repeating task</div>
              <p className="mt-1 text-[12.5px] text-[var(--ink-2)]">
                Apply this change to just <b>{task.due ? fmtDay(task.due) : "this date"}</b>, or to every date in the repeat?
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <button type="button" onClick={() => answer("one")} className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-left">
                  <div className="text-[13px] font-extrabold text-[var(--ink)]">Just this date</div>
                  <div className="text-[11.5px] text-[var(--ink-3)]">The other dates stay as they are.</div>
                </button>
                <button type="button" onClick={() => answer("all")} className="rounded-xl border border-[#1d3a8f] bg-[#eef4fd] px-3 py-2.5 text-left">
                  <div className="text-[13px] font-extrabold text-[#1d3a8f]">All dates in the repeat</div>
                  <div className="text-[11.5px] text-[var(--ink-2)]">Due dates, ticks and comments stay per-date — only what you changed travels.</div>
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <p className="min-w-0 flex-1 text-[11px] text-[var(--ink-3)]">Asked once — the rest of your edits here follow the same choice until you change it.</p>
                <button type="button" onClick={() => setPending(null)} className="flex-none rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
