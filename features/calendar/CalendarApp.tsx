"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { api, get as apiGet, post as apiPost, put as apiPut } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";

// ─────────────────────────────────────────────────────────────────────────
// Calendar — every session across the operator's listings PLUS manually-added
// events, in Month / Week / Day. Sessions come from /api/listings (read-only);
// manual events (with optional saved categories/colours) from
// /api/calendar-events. Filter by listing, toggle booking info + events.
// Start-time reminders (email + in-app) are configured in Settings — the
// sending is Amir's.
// ─────────────────────────────────────────────────────────────────────────

interface Session { date: string; start?: string; end?: string }
interface Block { open?: boolean; capacity?: number; bookedCount?: number; dayCounts?: Record<string, number>; sessions?: Session[] }
interface Listing { id: string; title: string; venue?: { name?: string } | null; venueName?: string; blocks?: Block[] }
interface CalEvent { id: string; title: string; date: string; endDate?: string; start?: string; end?: string; allDay?: boolean; category?: string; color?: string; notes?: string; remindMode?: "default" | "on" | "off"; remindMinutes?: number }
interface Item { kind: "session" | "event"; date: string; start: string; end: string; title: string; color: string; booked?: number; cap?: number; venue?: string; open?: boolean; listingId?: string; event?: CalEvent }

type Mode = "month" | "week" | "day";

const LIGHT_PALETTE = { "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc", "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1" } as CSSProperties;
const HERO = "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)";
const BLUE = "#1d3a8f", RED = "#c02636";
const PALETTE = ["#6d28d9", "#0369a1", "#be1259", "#047857", "#b45309", "#c2410c", "#4338ca", "#7c3aed", "#b91c1c", "#0e7490"];
const soft = (hex: string) => `color-mix(in srgb,${hex} 14%,var(--surface))`;

const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s: string) => { const [y, m, dd] = s.split("-").map(Number); return new Date(y, (m || 1) - 1, dd || 1); };
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const startOfWeek = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const inputCls = "rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]";

export function CalendarApp() {
  const { settings, save } = useSettings();
  const categories = useMemo(() => settings.calendar?.categories ?? [], [settings.calendar?.categories]);
  const reminderOn = settings.calendar?.reminderOn ?? true;
  const reminderMinutes = settings.calendar?.reminderMinutes ?? 30;

  const [listings, setListings] = useState<Listing[] | null>(null);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("month");
  const [cursor, setCursor] = useState<Date>(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); });
  const [hidden, setHidden] = useState<Set<string>>(new Set());  // hidden listingIds
  const [showBooking, setShowBooking] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [fullMonth, setFullMonth] = useState(false);
  const [editing, setEditing] = useState<CalEvent | null>(null);
  const [adding, setAdding] = useState(false);
  const jumped = useRef(false);

  const refresh = useCallback(() => {
    apiGet<Listing[]>("/api/listings?mine=1").then((l) => {
      setListings(l); setError(null);
      if (!jumped.current) {
        jumped.current = true;
        const dates: string[] = [];
        for (const li of l) for (const b of li.blocks ?? []) for (const s of b.sessions ?? []) dates.push(s.date);
        if (dates.length) { const now = new Date(); if (!dates.some((d) => d.slice(0, 7) === monthKey(now))) { const sorted = [...dates].sort(); const target = sorted.find((d) => d >= iso(now)) ?? sorted[sorted.length - 1]; if (target) setCursor(fromIso(target)); } }
      }
    }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    apiGet<CalEvent[]>("/api/calendar-events").then(setEvents).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["listings", "blocks", "calendarEvents"], refresh);

  const colorFor = useMemo(() => {
    const ids = [...new Set((listings ?? []).map((l) => l.id))].sort();
    const m = new Map<string, string>();
    ids.forEach((id, i) => m.set(id, PALETTE[i % PALETTE.length]));
    return (id: string) => m.get(id) ?? PALETTE[0];
  }, [listings]);

  // legend = the listings that have sessions (each a show/hide toggle)
  const legend = useMemo(() => {
    const seen = new Map<string, string>();
    for (const l of listings ?? []) if ((l.blocks ?? []).some((b) => (b.sessions ?? []).length)) if (!seen.has(l.id)) seen.set(l.id, l.title);
    return [...seen.entries()].map(([id, title]) => ({ id, title, color: colorFor(id) }));
  }, [listings, colorFor]);

  // everything on a given date, respecting the filters
  const itemsOn = useCallback((dateStr: string): Item[] => {
    const out: Item[] = [];
    for (const l of listings ?? []) {
      if (hidden.has(l.id)) continue;
      const venue = l.venue?.name ?? l.venueName ?? "";
      for (const b of l.blocks ?? []) for (const s of b.sessions ?? []) if (s.date === dateStr) out.push({ kind: "session", date: dateStr, start: s.start ?? "", end: s.end ?? "", title: l.title, color: colorFor(l.id), booked: b.dayCounts?.[dateStr] ?? b.bookedCount ?? 0, cap: b.capacity ?? 0, venue, open: b.open ?? true, listingId: l.id });
    }
    if (showEvents) for (const ev of events) { const end = ev.endDate || ev.date; if (dateStr >= ev.date && dateStr <= end) out.push({ kind: "event", date: dateStr, start: ev.allDay ? "" : (ev.start ?? ""), end: ev.end ?? "", title: ev.title, color: ev.color || categories.find((c) => c.id === ev.category)?.color || "#8a86a3", event: ev }); }
    return out.sort((a, b) => (a.start < b.start ? -1 : 1));
  }, [listings, events, hidden, showEvents, colorFor, categories]);

  const hasAnything = (listings?.some((l) => (l.blocks ?? []).some((b) => (b.sessions ?? []).length)) ?? false) || events.length > 0;
  // every date that has something on it (respecting filters) — powers the
  // "next event" hint when the current period is empty.
  const allDates = useMemo(() => {
    const s = new Set<string>();
    for (const l of listings ?? []) if (!hidden.has(l.id)) for (const b of l.blocks ?? []) for (const ss of b.sessions ?? []) s.add(ss.date);
    if (showEvents) for (const ev of events) s.add(ev.date);
    return [...s].sort();
  }, [listings, events, hidden, showEvents]);
  const fmtLong = (s: string) => fromIso(s).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  const step = (dir: number) => setCursor((c) => { const x = new Date(c); if (mode === "month") x.setMonth(x.getMonth() + dir); else if (mode === "week") x.setDate(x.getDate() + 7 * dir); else x.setDate(x.getDate() + dir); return x; });
  const goToday = () => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), d.getDate())); };
  const today = new Date();
  const toggleListing = (id: string) => setHidden((h) => { const n = new Set(h); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const label = mode === "month" ? `${MON[cursor.getMonth()]} ${cursor.getFullYear()}`
    : mode === "week" ? (() => { const ws = startOfWeek(cursor), we = addDays(ws, 6); return `${ws.getDate()} ${MON[ws.getMonth()].slice(0, 3)} – ${we.getDate()} ${MON[we.getMonth()].slice(0, 3)} ${we.getFullYear()}`; })()
    : `${DOW[cursor.getDay()]} ${cursor.getDate()} ${MON[cursor.getMonth()]} ${cursor.getFullYear()}`;

  async function removeEvent(id: string) { if (!confirm("Delete this event?")) return; try { await api(`/api/calendar-events/${encodeURIComponent(id)}`, { method: "DELETE" }); setEditing(null); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }

  // ── views ────────────────────────────────────────────────────────────────
  function itemChip(it: Item, i: number) {
    // Sessions (from listings) = solid filled. Events (meetings you add) =
    // outlined with a 📌 marker + dashed border, so the two never look alike.
    const evStyle = { color: it.color, background: "var(--surface)", border: `1.5px dashed ${it.color}` } as CSSProperties;
    const sessStyle = { color: "#fff", background: it.color } as CSSProperties;
    return <button key={i} type="button" onClick={() => it.kind === "event" && it.event ? setEditing(it.event) : (setMode("day"), setCursor(fromIso(it.date)))} className="flex w-full items-center gap-1 truncate rounded px-1 py-[1.5px] text-left text-[10px] font-bold leading-tight cursor-pointer" style={it.kind === "event" ? evStyle : sessStyle} title={`${it.kind === "event" ? "Event: " : ""}${it.title}${it.start ? ` · ${it.start}–${it.end}` : ""}`}><span className="truncate">{it.kind === "event" ? "📌 " : ""}{it.title}</span></button>;
  }

  function monthView() {
    const y = cursor.getFullYear(), mo = cursor.getMonth();
    const gridStart = startOfWeek(new Date(y, mo, 1));
    const gridEnd = addDays(startOfWeek(new Date(y, mo + 1, 0)), 6); // end of week containing the last day
    const cells: Date[] = []; for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) cells.push(new Date(d));
    const cap = fullMonth ? 6 : 2;
    const minH = fullMonth ? "min-h-[104px] sm:min-h-[124px]" : "min-h-[58px] sm:min-h-[74px]";
    return (
      <div className="grid grid-cols-7 gap-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="pb-1 text-center text-[10px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{d}</div>)}
        {cells.map((d) => {
          const inMonth = d.getMonth() === mo;
          // Days from the previous/next month keep the week aligned but stay blank.
          if (!inMonth) return <div key={iso(d)} className={`${minH} rounded-lg border border-dashed border-[var(--line)] bg-[var(--panel)] opacity-40`} />;
          const its = itemsOn(iso(d)), isToday = sameDay(d, today);
          return (
            <div key={iso(d)} className={`flex ${minH} flex-col rounded-lg border p-1`} style={{ borderColor: isToday ? BLUE : "var(--line)", background: "var(--surface)", boxShadow: isToday ? `inset 0 0 0 1.5px ${BLUE}` : undefined }}>
              <button type="button" onClick={() => { setMode("day"); setCursor(new Date(d)); }} className="self-start text-[11.5px] font-extrabold leading-none hover:underline" style={{ color: isToday ? BLUE : its.length ? "var(--ink)" : "var(--ink-3)" }} title="Open this day">{d.getDate()}</button>
              <div className="mt-0.5 flex flex-col gap-0.5">
                {its.slice(0, cap).map((it, i) => itemChip(it, i))}
                {its.length > cap && <button type="button" onClick={() => { setMode("day"); setCursor(new Date(d)); }} className="pl-0.5 text-left text-[9.5px] font-bold text-[#1d3a8f] hover:underline">+{its.length - cap} more</button>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function weekView() {
    const ws = startOfWeek(cursor);
    const weekend = [5, 6].filter((k) => itemsOn(iso(addDays(ws, k))).length > 0);
    const days = [...Array.from({ length: 5 }, (_, k) => addDays(ws, k)), ...weekend.map((k) => addDays(ws, k))];
    return (
      <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${days.length},minmax(0,1fr))` }}>
        {days.map((d) => {
          const its = itemsOn(iso(d)), isToday = sameDay(d, today);
          return (
            <div key={iso(d)} className="min-w-0">
              <div className="mb-2.5 rounded-lg border py-2 text-center text-[13px] font-extrabold" style={{ borderColor: "var(--line)", background: isToday ? "#eef4fd" : "var(--panel)", color: BLUE }}>{DOW[d.getDay()].slice(0, 3)} {d.getDate()}</div>
              <div className="flex flex-col gap-2">
                {its.length ? its.map((it, i) => { const pct = it.cap ? Math.round((it.booked ?? 0) / it.cap * 100) : 0; return (
                  <button key={i} type="button" onClick={() => it.kind === "event" && it.event ? setEditing(it.event) : undefined} className={`rounded-xl border bg-[var(--panel)] p-2.5 text-left ${it.kind === "event" ? "cursor-pointer" : "cursor-default"}`} style={{ borderColor: "var(--line)", borderLeft: `4px ${it.kind === "event" ? "dashed" : "solid"} ${it.color}` }}>
                    <div className="text-[12.5px] font-extrabold leading-tight">{it.kind === "event" ? "📌 " : ""}{it.title}</div>
                    {it.start && <div className="mt-1 text-[11.5px] text-[var(--ink-2)]">{it.start}–{it.end}</div>}
                    {it.kind === "session" && showBooking && <div className="mt-1 text-[11px] font-bold" style={{ color: it.color }}>{it.booked} / {it.cap} booked · {pct}%</div>}
                  </button>
                ); }) : <div className="py-2 text-center text-[11px] text-[var(--ink-3)]">—</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function dayCard(it: Item, i: number) {
    const pct = it.cap ? Math.round((it.booked ?? 0) / it.cap * 100) : 0;
    return (
      <button key={i} type="button" onClick={() => it.kind === "event" && it.event ? setEditing(it.event) : undefined} className={`w-full rounded-xl border bg-[var(--surface)] p-2.5 text-left ${it.kind === "event" ? "cursor-pointer" : "cursor-default"}`} style={{ borderColor: "var(--line)", borderLeft: `4px ${it.kind === "event" ? "dashed" : "solid"} ${it.color}` }}>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[13.5px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{it.kind === "event" ? "📌 " : ""}{it.title}</span>
          {it.start && <span className="text-[11.5px] font-bold" style={{ color: it.color }}>{it.start}–{it.end}</span>}
        </div>
        {it.kind === "session" ? <div className="mt-0.5 text-[11.5px] text-[var(--ink-2)]">{[it.venue, showBooking ? `${it.booked} / ${it.cap} booked · ${pct}%` : "", it.open ? "" : "closed"].filter(Boolean).join(" · ")}</div>
          : <div className="mt-0.5 text-[11.5px] text-[var(--ink-2)]">{[it.event?.category ? categories.find((c) => c.id === it.event?.category)?.name : "Event", it.event?.notes].filter(Boolean).join(" · ")}</div>}
        {it.kind === "session" && showBooking && <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: it.color }} /></div>}
      </button>
    );
  }

  // Day view — an hourly timeline; each item spans its full start→end time.
  function dayView() {
    const its = itemsOn(iso(cursor));
    if (!its.length) return <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-10 text-center text-[13px] text-[var(--ink-3)]">No sessions or events on this day.</div>;
    const toMin = (t?: string) => { if (!t) return null; const [h, m] = t.split(":").map(Number); return isNaN(h) ? null : h * 60 + (m || 0); };
    const allDay = its.filter((it) => toMin(it.start) == null);
    const timed = its.map((it) => { const s = toMin(it.start); if (s == null) return null; let e = toMin(it.end); if (e == null || e <= s) e = s + 60; return { it, s, e }; }).filter((x): x is { it: Item; s: number; e: number } => !!x);
    const rowH = 46;
    const lo = timed.length ? Math.max(0, Math.floor(Math.min(...timed.map((t) => t.s)) / 60)) : 9;
    const hi = timed.length ? Math.min(24, Math.ceil(Math.max(...timed.map((t) => t.e)) / 60)) : 18; // end boundary hour
    const hours = Array.from({ length: hi - lo + 1 }, (_, k) => lo + k);
    // greedy column layout so overlapping items sit side-by-side
    const sorted = [...timed].sort((a, b) => a.s - b.s || a.e - b.e);
    const colEnds: number[] = [];
    const placed = sorted.map((t) => { let c = colEnds.findIndex((end) => end <= t.s); if (c < 0) { c = colEnds.length; colEnds.push(t.e); } else colEnds[c] = t.e; return { ...t, col: c }; });
    const ncol = Math.max(1, colEnds.length);
    const nowMin = sameDay(cursor, today) ? new Date().getHours() * 60 + new Date().getMinutes() : null;
    const nowTop = nowMin != null && nowMin >= lo * 60 && nowMin <= hi * 60 ? (nowMin - lo * 60) / 60 * rowH : null;
    return (
      <div className="flex flex-col gap-2">
        {allDay.length > 0 && (
          <div className="flex gap-3">
            <div className="w-12 flex-none pt-1 text-right text-[11px] font-bold uppercase tracking-[0.03em] text-[var(--ink-3)]">All day</div>
            <div className="flex flex-1 flex-col gap-2">{allDay.map((it, i) => dayCard(it, i))}</div>
          </div>
        )}
        <div className="relative" style={{ height: (hi - lo) * rowH + 6 }}>
          {hours.map((h, idx) => (
            <div key={h} className="absolute left-0 flex w-full items-start" style={{ top: idx * rowH }}>
              <div className="w-12 flex-none -translate-y-[7px] pr-2 text-right text-[11.5px] font-extrabold tabular-nums text-[var(--ink-3)]">{pad(h)}:00</div>
              <div className="flex-1 border-t border-[var(--line)]" />
            </div>
          ))}
          {nowTop != null && <div className="absolute z-10 flex w-full items-center" style={{ top: nowTop, left: 0 }}><div className="w-12 flex-none" /><div className="h-[2px] flex-1" style={{ background: RED }} /></div>}
          <div className="absolute bottom-0 top-0" style={{ left: 48, right: 0 }}>
            {placed.map(({ it, s, e, col }, i) => {
              const top = (s - lo * 60) / 60 * rowH, height = Math.max(24, (e - s) / 60 * rowH - 3);
              const w = 100 / ncol, isEv = it.kind === "event";
              const pct = it.cap ? Math.round((it.booked ?? 0) / it.cap * 100) : 0;
              return (
                <button key={i} type="button" onClick={() => isEv && it.event ? setEditing(it.event) : undefined} className={`absolute overflow-hidden rounded-lg border p-1.5 text-left ${isEv ? "cursor-pointer" : "cursor-default"}`} style={{ top, height, left: `calc(${col * w}% + 2px)`, width: `calc(${w}% - 4px)`, background: isEv ? "var(--surface)" : it.color, border: isEv ? `1.5px dashed ${it.color}` : "none", color: isEv ? it.color : "#fff" }} title={`${it.title} · ${it.start}–${it.end}`}>
                  <div className="truncate text-[11.5px] font-extrabold leading-tight">{isEv ? "📌 " : ""}{it.title}</div>
                  <div className="truncate text-[10.5px] font-semibold" style={{ opacity: isEv ? 0.8 : 0.9 }}>{it.start}–{it.end}{it.kind === "session" && showBooking && it.cap ? ` · ${pct}%` : ""}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const modePill = (m: Mode, lbl: string) => (
    <button type="button" onClick={() => setMode(m)} className="rounded-lg px-4 py-1.5 text-[13px] font-extrabold transition-colors" style={mode === m ? { background: BLUE, color: "#fff" } : { background: "var(--surface)", color: "var(--ink-2)" }}>{lbl}</button>
  );

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {/* hero */}
      <div className="relative mb-3 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: HERO }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🗓️</span>Calendar</div>
            <p className="mt-1.5 max-w-[620px] text-[12.5px] leading-[1.5] text-white/85">Your sessions across all listings, plus your own events — switch between Month, Week and Day, and pick any range.</p>
          </div>
          <button type="button" onClick={() => setAdding(true)} className="rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-[#1d3a8f] shadow-md transition-transform hover:-translate-y-px">＋ Add event</button>
        </div>
      </div>

      {/* how it works — top, under the title */}
      <details className="group mb-3 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-[13px] font-extrabold" style={{ color: BLUE }}><span className="text-[11px] transition-transform group-open:rotate-90">▸</span> How it works</summary>
        <div className="border-t border-[var(--line)] px-4 py-3 text-[12.5px] leading-[1.6] text-[var(--ink-2)]">
          <ul className="ml-4 list-disc space-y-1.5">
            <li><b>Month, Week or Day</b> — Month is the overview, Week breaks each day into its sessions with booked numbers, Day is the full run-sheet for one date.</li>
            <li><b>Add your own events</b> — meetings, INSET days, open days, closures. Give them a category &amp; colour to keep things tidy; click an event to edit it.</li>
            <li><b>Filter</b> — click a listing in the legend to show/hide it, and toggle <b>Booking info</b> or <b>Events</b> on and off.</li>
            <li><b>Reminders</b> — turn on email + in-app reminders before an event starts in <b>Settings → Calendar</b> (currently {reminderOn ? `on, ${reminderMinutes} min before` : "off"}).</li>
            <li>Sessions are read-only here — to change dates or capacity, edit the listing&rsquo;s run in <b>Listings</b>.</li>
          </ul>
        </div>
      </details>

      {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#e21d27]">{error}</div>}
      {(adding || editing) && <EventForm existing={editing ?? undefined} categories={categories} settings={settings} save={save} defReminderOn={reminderOn} defReminderMinutes={reminderMinutes} onClose={() => { setAdding(false); setEditing(null); }} onSaved={() => { setAdding(false); setEditing(null); refresh(); }} onDelete={editing ? () => removeEvent(editing.id) : undefined} />}

      {/* mode tabs (visible) */}
      <div className="mb-3 inline-flex gap-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1">{modePill("month", "Month")}{modePill("week", "Week")}{modePill("day", "Day")}</div>

      {/* range bar */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="min-w-[150px] text-[18px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{label}</div>
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--line)]">
          <button type="button" onClick={() => step(-1)} className="bg-[var(--panel)] px-3 py-1.5 text-[15px] font-extrabold text-[var(--ink)] hover:bg-[var(--line)]">‹</button>
          <button type="button" onClick={goToday} className="border-x border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--line)]">Today</button>
          <button type="button" onClick={() => step(1)} className="bg-[var(--panel)] px-3 py-1.5 text-[15px] font-extrabold text-[var(--ink)] hover:bg-[var(--line)]">›</button>
        </div>
        <label className="inline-flex items-center gap-2 text-[12px] font-bold text-[var(--ink-2)]">Choose {mode === "month" ? "month" : mode === "week" ? "week of" : "date"}
          {mode === "month"
            ? <input type="month" value={`${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`} onChange={(e) => { if (e.target.value) { const [y, m] = e.target.value.split("-").map(Number); setCursor(new Date(y, (m || 1) - 1, 1)); } }} className={inputCls} />
            : <input type="date" value={mode === "week" ? iso(startOfWeek(cursor)) : iso(cursor)} onChange={(e) => { if (e.target.value) { const d = fromIso(e.target.value); setCursor(mode === "week" ? startOfWeek(d) : d); } }} className={inputCls} />}
        </label>
      </div>

      {/* filters: booking (not in month view) + events toggles */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {mode !== "month" && <button type="button" onClick={() => setShowBooking((v) => !v)} className="rounded-full border px-3 py-1 text-[11.5px] font-bold transition-colors" style={showBooking ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{showBooking ? "✓ " : ""}Booking info</button>}
        <button type="button" onClick={() => setShowEvents((v) => !v)} className="rounded-full border px-3 py-1 text-[11.5px] font-bold transition-colors" style={showEvents ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{showEvents ? "✓ " : ""}My events</button>
        {mode === "month" && <button type="button" onClick={() => setFullMonth((v) => !v)} className="rounded-full border px-3 py-1 text-[11.5px] font-bold transition-colors" style={fullMonth ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{fullMonth ? "✓ " : ""}Full month</button>}
        {legend.length > 0 && <span className="mx-1 text-[11px] text-[var(--ink-3)]">·</span>}
        {legend.length > 1 && <button type="button" onClick={() => setHidden(new Set())} className="text-[11px] font-bold text-[var(--ink-3)] hover:text-[#1d3a8f]">All listings</button>}
      </div>

      {/* legend = clickable listing filters */}
      {legend.length > 0 && (
        <div className="mb-3.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] font-bold">
          {legend.map(({ id, title, color }) => { const off = hidden.has(id); return (
            <button key={id} type="button" onClick={() => toggleListing(id)} className="inline-flex items-center gap-1.5 transition-opacity" style={{ opacity: off ? 0.4 : 1, color: "var(--ink-2)" }} title={off ? "Hidden — click to show" : "Click to hide"}>
              <span className="h-3 w-3 rounded-[3px]" style={{ background: color }} />{title}{off ? " (hidden)" : ""}
            </button>
          ); })}
        </div>
      )}

      {/* empty-period hint — jump to where the next thing is */}
      {listings && hasAnything && (() => {
        const rs = mode === "month" ? iso(new Date(cursor.getFullYear(), cursor.getMonth(), 1)) : mode === "week" ? iso(startOfWeek(cursor)) : iso(cursor);
        const re = mode === "month" ? iso(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)) : mode === "week" ? iso(addDays(startOfWeek(cursor), 6)) : iso(cursor);
        if (allDates.some((d) => d >= rs && d <= re)) return null;
        const next = allDates.find((d) => d > re) ?? allDates.find((d) => d >= rs) ?? allDates[allDates.length - 1];
        if (!next) return null;
        return (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[#eef4fd] px-3.5 py-2.5 text-[12.5px]" style={{ color: BLUE }}>
            <span>Nothing on this {mode} — the {next > re ? "next" : "first"} is <b>{fmtLong(next)}</b>.</span>
            <button type="button" onClick={() => setCursor(fromIso(next))} className="ml-auto rounded-lg bg-[#1d3a8f] px-3 py-1 text-[12px] font-extrabold text-white">Jump to it →</button>
          </div>
        );
      })()}

      {/* body */}
      {!listings ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
        : !hasAnything ? <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-12 text-center text-[13px] text-[var(--ink-3)]">Nothing dated yet — add a listing with a run, or ＋ Add event.</div>
        : <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 sm:p-4">{mode === "month" ? monthView() : mode === "week" ? weekView() : dayView()}</div>}
    </div>
  );
}

// ── Add / edit event ───────────────────────────────────────────────────────
type SettingsShape = ReturnType<typeof useSettings>["settings"];
type SaveFn = ReturnType<typeof useSettings>["save"];
function EventForm({ existing, categories, settings, save, defReminderOn, defReminderMinutes, onClose, onSaved, onDelete }: { existing?: CalEvent; categories: { id: string; name: string; color: string }[]; settings: SettingsShape; save: SaveFn; defReminderOn: boolean; defReminderMinutes: number; onClose: () => void; onSaved: () => void; onDelete?: () => void }) {
  const isEdit = !!existing;
  const todayIso = iso(new Date());
  const [title, setTitle] = useState(existing?.title ?? "");
  const [date, setDate] = useState(existing?.date ?? todayIso);
  const [endDate, setEndDate] = useState(existing?.endDate ?? "");
  const [allDay, setAllDay] = useState(existing?.allDay ?? false);
  const [start, setStart] = useState(existing?.start ?? "09:00");
  const [end, setEnd] = useState(existing?.end ?? "10:00");
  const [category, setCategory] = useState(existing?.category ?? (categories[0]?.id ?? ""));
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [remindMode, setRemindMode] = useState<"default" | "on" | "off">(existing?.remindMode ?? "default");
  const [remindMinutes, setRemindMinutes] = useState<number>(existing?.remindMinutes ?? defReminderMinutes);
  const [newCat, setNewCat] = useState(false);
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState(PALETTE[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveNewCategory() {
    const name = catName.trim(); if (!name) return;
    const id = `cat_${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}_${Math.abs(name.length * 7 + catColor.length)}`;
    const next = [...(settings.calendar?.categories ?? []), { id, name, color: catColor }];
    await save({ settings: { ...settings, calendar: { ...settings.calendar, categories: next } } });
    setCategory(id); setNewCat(false); setCatName("");
  }

  async function submit() {
    if (!title.trim() || !date) { setError("Add a title and date."); return; }
    setBusy(true); setError(null);
    const color = categories.find((c) => c.id === category)?.color;
    const body = { title: title.trim(), date, endDate: endDate && endDate > date ? endDate : undefined, allDay, start: allDay ? undefined : start, end: allDay ? undefined : end, category: category || undefined, color, notes: notes.trim() || undefined, remindMode, remindMinutes: remindMode === "on" ? remindMinutes : undefined };
    try { if (isEdit) await apiPut(`/api/calendar-events/${encodeURIComponent(existing!.id)}`, body); else await apiPost("/api/calendar-events", body); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4" onClick={onClose}>
      <div className="mt-[6vh] w-full max-w-[460px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><div className="text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{isEdit ? "Edit event" : "Add event"}</div><button type="button" onClick={onClose} className="text-[var(--ink-3)] hover:text-[var(--ink)]">✕</button></div>
        <div className="flex flex-col gap-2.5">
          <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Staff meeting" className={`${inputCls} w-full`} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} w-full`} /></label>
            <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">End date (optional)</span><input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} className={`${inputCls} w-full`} /></label>
          </div>
          <label className="flex items-center gap-2 text-[12.5px] font-bold"><input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />All day</label>
          {!allDay && <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">Start</span><input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={`${inputCls} w-full`} /></label>
            <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">End</span><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={`${inputCls} w-full`} /></label>
          </div>}
          <div>
            <div className="mb-1 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">Category</span><button type="button" onClick={() => setNewCat((v) => !v)} className="text-[11px] font-bold text-[#1d3a8f]">{newCat ? "Cancel" : "＋ New category"}</button></div>
            {newCat ? (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2">
                <input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Category name" className={`${inputCls} flex-1`} />
                <input type="color" value={catColor} onChange={(e) => setCatColor(e.target.value)} className="h-8 w-9 cursor-pointer rounded border border-[var(--line)]" title="Colour" />
                <button type="button" onClick={saveNewCategory} className="rounded-md bg-[#1d3a8f] px-2.5 py-1.5 text-[12px] font-bold text-white">Save</button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => <button key={c.id} type="button" onClick={() => setCategory(c.id)} className="inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-[12px] font-bold" style={category === c.id ? { borderColor: c.color, background: soft(c.color), color: c.color } : { borderColor: "var(--line)", color: "var(--ink-2)" }}><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />{c.name}</button>)}
                {categories.length === 0 && <span className="text-[11.5px] text-[var(--ink-3)]">No categories yet — add one.</span>}
              </div>
            )}
          </div>
          <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">Notes (optional)</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Agenda, who's invited, links, anything to remember…" className={`${inputCls} w-full resize-y leading-[1.5] [field-sizing:content]`} /></label>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">Reminder</span>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {([["default", `Use default (${defReminderOn ? `${defReminderMinutes} min before` : "off"})`], ["on", "On"], ["off", "Off"]] as [typeof remindMode, string][]).map(([m, lbl]) => (
                <button key={m} type="button" onClick={() => setRemindMode(m)} className="rounded-full border-2 px-3 py-1 text-[12px] font-bold transition-colors" style={remindMode === m ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{lbl}</button>
              ))}
              {remindMode === "on" && <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--ink-2)]"><input type="number" min={0} max={1440} value={remindMinutes} onChange={(e) => setRemindMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-16 rounded-md border border-[var(--line)] px-2 py-1 text-center" />min before</span>}
            </div>
            <div className="mt-1 text-[10.5px] text-[var(--ink-3)]">Email + in-app bell before the event — sending is wired up by the backend.</div>
          </div>
        </div>
        {error && <div className="mt-2.5 text-[12px] font-bold text-[var(--red,#e21d27)]">{error}</div>}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
          {onDelete ? <button type="button" onClick={onDelete} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold" style={{ color: RED }}>Delete</button> : <span />}
          <div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">Cancel</button><button type="button" disabled={busy} onClick={submit} className="rounded-lg bg-[#1d3a8f] px-4 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-60">{busy ? "Saving…" : "Save event"}</button></div>
        </div>
      </div>
    </div>
  );
}
