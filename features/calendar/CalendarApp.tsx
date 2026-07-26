"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";

// ─────────────────────────────────────────────────────────────────────────
// Calendar — every session across the operator's listings, in Month / Week /
// Day views. Read-only over the real blocks + sessions joined onto
// /api/listings; booked/capacity come from each block's dayCounts + capacity.
// ─────────────────────────────────────────────────────────────────────────

interface Session { date: string; start?: string; end?: string }
interface Block { name?: string; open?: boolean; capacity?: number; bookedCount?: number; dayCounts?: Record<string, number>; sessions?: Session[]; capacityScope?: "day" | "listing" }
interface Listing { id: string; title: string; venue?: { name?: string } | null; venueName?: string; blocks?: Block[] }
interface Ev { date: string; start: string; end: string; listingId: string; listing: string; venue: string; booked: number; cap: number; open: boolean; color: string }

type Mode = "month" | "week" | "day";

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;
const HERO = "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)";
const BLUE = "#1d3a8f";
const PALETTE = ["#7A5AF8", "#2AACE2", "#E91E63", "#0f9d58", "#f0b100", "#e07a5f", "#1d3a8f", "#8a5cf6", "#c0392b", "#0891b2"];
const soft = (hex: string) => `color-mix(in srgb,${hex} 16%,transparent)`;

const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s: string) => { const [y, m, dd] = s.split("-").map(Number); return new Date(y, (m || 1) - 1, dd || 1); };
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const startOfWeek = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export function CalendarApp() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("month");
  const [cursor, setCursor] = useState<Date>(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); });
  const jumped = useRef(false);

  const refresh = useCallback(() => {
    apiGet<Listing[]>("/api/listings?mine=1").then((l) => {
      setListings(l); setError(null);
      // once, open on the month that actually has sessions (if today's is empty)
      if (!jumped.current) {
        jumped.current = true;
        const dates: string[] = [];
        for (const li of l) for (const b of li.blocks ?? []) for (const s of b.sessions ?? []) dates.push(s.date);
        if (dates.length) {
          const now = new Date();
          if (!dates.some((d) => d.slice(0, 7) === monthKey(now))) {
            const sorted = [...dates].sort();
            const target = sorted.find((d) => d >= iso(now)) ?? sorted[sorted.length - 1];
            if (target) setCursor(fromIso(target));
          }
        }
      }
    }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["listings", "blocks"], refresh);

  // one colour per listing (stable by sorted id)
  const colorFor = useMemo(() => {
    const ids = [...new Set((listings ?? []).map((l) => l.id))].sort();
    const m = new Map<string, string>();
    ids.forEach((id, i) => m.set(id, PALETTE[i % PALETTE.length]));
    return (id: string) => m.get(id) ?? PALETTE[0];
  }, [listings]);

  const events = useMemo<Ev[]>(() => {
    const out: Ev[] = [];
    for (const l of listings ?? []) {
      const venue = l.venue?.name ?? l.venueName ?? "";
      for (const b of l.blocks ?? []) {
        const cap = b.capacity ?? 0;
        for (const s of b.sessions ?? []) {
          const booked = b.dayCounts?.[s.date] ?? b.bookedCount ?? 0;
          out.push({ date: s.date, start: s.start ?? "", end: s.end ?? "", listingId: l.id, listing: l.title, venue, booked, cap, open: b.open ?? true, color: colorFor(l.id) });
        }
      }
    }
    return out;
  }, [listings, colorFor]);

  const byDate = useMemo(() => {
    const m: Record<string, Ev[]> = {};
    for (const e of events) (m[e.date] ??= []).push(e);
    for (const k of Object.keys(m)) m[k].sort((a, b) => (a.start < b.start ? -1 : 1));
    return m;
  }, [events]);

  // legend = distinct listings that actually have sessions
  const legend = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of events) if (!seen.has(e.listing)) seen.set(e.listing, e.color);
    return [...seen.entries()];
  }, [events]);

  const step = (dir: number) => setCursor((c) => { const x = new Date(c); if (mode === "month") x.setMonth(x.getMonth() + dir); else if (mode === "week") x.setDate(x.getDate() + 7 * dir); else x.setDate(x.getDate() + dir); return x; });
  const goToday = () => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), d.getDate())); };
  const today = new Date();

  const label = mode === "month" ? `${MON[cursor.getMonth()]} ${cursor.getFullYear()}`
    : mode === "week" ? (() => { const ws = startOfWeek(cursor), we = addDays(ws, 6); return `${ws.getDate()} ${MON[ws.getMonth()].slice(0, 3)} – ${we.getDate()} ${MON[we.getMonth()].slice(0, 3)} ${we.getFullYear()}`; })()
    : `${DOW[cursor.getDay()]} ${cursor.getDate()} ${MON[cursor.getMonth()]} ${cursor.getFullYear()}`;

  // ── views ────────────────────────────────────────────────────────────────
  function monthView() {
    const y = cursor.getFullYear(), mo = cursor.getMonth();
    const first = new Date(y, mo, 1), lead = (first.getDay() + 6) % 7;
    const start = addDays(first, -lead);
    const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
    return (
      <div className="grid grid-cols-7 gap-1.5">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-1.5 text-center text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{d}</div>)}
        {cells.map((d) => {
          const key = iso(d), evs = byDate[key] ?? [], inMonth = d.getMonth() === mo, isToday = sameDay(d, today);
          return (
            <div key={key} className="min-h-[112px] rounded-xl border p-1.5 sm:min-h-[128px]" style={{ borderColor: "var(--line)", background: inMonth ? "var(--surface)" : "var(--panel)", opacity: inMonth ? 1 : 0.55, boxShadow: isToday ? `inset 0 0 0 2px ${BLUE}` : undefined }}>
              <div className="text-[13px] font-extrabold" style={{ color: evs.length ? BLUE : "var(--ink-3)" }}>{d.getDate()}</div>
              <div className="mt-0.5 flex flex-col gap-1">
                {evs.slice(0, 3).map((e, i) => (
                  <div key={i} className="truncate rounded-md border px-1.5 py-[3px] text-[11px] font-bold" style={{ color: e.color, background: soft(e.color), borderColor: `${e.color}33` }} title={`${e.listing} · ${e.start}–${e.end} · ${e.booked}/${e.cap}`}>{e.listing}</div>
                ))}
                {evs.length > 3 && <div className="px-1 text-[10px] text-[var(--ink-3)]">+{evs.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function weekView() {
    const ws = startOfWeek(cursor);
    // Mon–Fri, plus any weekend day that actually has a session
    const weekend = [5, 6].filter((k) => (byDate[iso(addDays(ws, k))] ?? []).length > 0);
    const days = [...Array.from({ length: 5 }, (_, k) => addDays(ws, k)), ...weekend.map((k) => addDays(ws, k))];
    return (
      <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${days.length},minmax(0,1fr))` }}>
        {days.map((d) => {
          const evs = byDate[iso(d)] ?? [], isToday = sameDay(d, today);
          return (
            <div key={iso(d)} className="min-w-0">
              <div className="mb-2.5 rounded-lg border py-2 text-center text-[13px] font-extrabold" style={{ borderColor: "var(--line)", background: isToday ? "#eef4fd" : "var(--panel)", color: BLUE }}>{DOW[d.getDay()].slice(0, 3)} {d.getDate()}</div>
              <div className="flex flex-col gap-2">
                {evs.length ? evs.map((e, i) => { const pct = e.cap ? Math.round(e.booked / e.cap * 100) : 0; return (
                  <div key={i} className="rounded-xl border bg-[var(--panel)] p-2.5" style={{ borderColor: "var(--line)", borderLeft: `4px solid ${e.color}` }}>
                    <div className="text-[12.5px] font-extrabold leading-tight">{e.listing}</div>
                    {e.start && <div className="mt-1 text-[11.5px] text-[var(--ink-2)]">{e.start}–{e.end}</div>}
                    <div className="mt-1 text-[11px] font-bold" style={{ color: e.color }}>{e.booked} / {e.cap} booked · {pct}%</div>
                  </div>
                ); }) : <div className="py-2 text-center text-[11px] text-[var(--ink-3)]">—</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function dayView() {
    const evs = byDate[iso(cursor)] ?? [];
    if (!evs.length) return <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-10 text-center text-[13px] text-[var(--ink-3)]">No sessions on this day.</div>;
    return (
      <div className="flex flex-col gap-2.5">
        {evs.map((e, i) => { const pct = e.cap ? Math.round(e.booked / e.cap * 100) : 0; return (
          <div key={i} className="flex flex-wrap items-start gap-4 rounded-2xl border bg-[var(--surface)] p-4" style={{ borderColor: "var(--line)", borderLeft: `4px solid ${e.color}` }}>
            <div className="min-w-[92px] text-[14px] font-extrabold" style={{ color: e.color }}>{e.start ? `${e.start}–${e.end}` : "All day"}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{e.listing}</div>
              <div className="mt-1 text-[12px] text-[var(--ink-2)]">{[e.venue, `${e.booked} / ${e.cap} booked`, `${pct}%`].filter(Boolean).join(" · ")}{e.open ? "" : " · closed"}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: e.color }} /></div>
            </div>
          </div>
        ); })}
      </div>
    );
  }

  const pill = (m: Mode, lbl: string) => (
    <button type="button" onClick={() => setMode(m)} className="rounded-full px-4 py-1.5 text-[13px] font-extrabold transition-colors" style={mode === m ? { background: "#fff", color: BLUE } : { background: "rgba(255,255,255,.16)", color: "#fff" }}>{lbl}</button>
  );

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {/* hero */}
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: HERO }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🗓️</span>Calendar</div>
            <p className="mt-1.5 max-w-[620px] text-[12.5px] leading-[1.5] text-white/85">Your sessions across all listings — switch between Month, Week and Day, and pick any range.</p>
          </div>
          <div className="flex flex-none gap-1.5 rounded-full bg-white/10 p-1 backdrop-blur-sm">{pill("month", "Month")}{pill("week", "Week")}{pill("day", "Day")}</div>
        </div>
      </div>

      {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#e21d27]">{error}</div>}

      {/* range bar */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="min-w-[150px] text-[18px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{label}</div>
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--line)]">
          <button type="button" onClick={() => step(-1)} className="bg-[var(--panel)] px-3 py-1.5 text-[15px] font-extrabold text-[var(--ink)] hover:bg-[var(--line)]">‹</button>
          <button type="button" onClick={goToday} className="border-x border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--line)]">Today</button>
          <button type="button" onClick={() => step(1)} className="bg-[var(--panel)] px-3 py-1.5 text-[15px] font-extrabold text-[var(--ink)] hover:bg-[var(--line)]">›</button>
        </div>
        <label className="inline-flex items-center gap-2 text-[12px] font-bold text-[var(--ink-2)]">Choose {mode === "month" ? "month" : mode === "week" ? "week of" : "date"}<input type="date" value={iso(cursor)} onChange={(e) => { if (e.target.value) setCursor(fromIso(e.target.value)); }} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]" /></label>
      </div>

      {/* legend */}
      {legend.length > 0 && (
        <div className="mb-3.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] font-bold text-[var(--ink-2)]">
          {legend.map(([name, color]) => <span key={name} className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px]" style={{ background: color }} />{name}</span>)}
        </div>
      )}

      {/* body */}
      {!listings ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
        : events.length === 0 ? <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-12 text-center text-[13px] text-[var(--ink-3)]">No dated sessions yet — add a listing with a run and its sessions will appear here.</div>
        : <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 sm:p-4">{mode === "month" ? monthView() : mode === "week" ? weekView() : dayView()}</div>}

      {/* how it works */}
      <details className="group mt-4 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[13px] font-extrabold" style={{ color: BLUE }}>
          <span className="text-[11px] transition-transform group-open:rotate-90">▸</span> How it works
        </summary>
        <div className="border-t border-[var(--line)] px-4 py-3 text-[12.5px] leading-[1.6] text-[var(--ink-2)]">
          <ul className="ml-4 list-disc space-y-1.5">
            <li><b>Month, Week or Day</b> — switch with the tabs top-right. Month gives the overview, Week breaks each day into its sessions with booked numbers, Day is the full run-sheet for one date.</li>
            <li><b>Every colour is a listing</b> — the legend maps each colour to a programme, so you can see at a glance what runs when.</li>
            <li><b>Booked figures are live</b> — “168 / 240 booked · 70%” reads each session&rsquo;s places from its block, updating as bookings come in.</li>
            <li><b>Jump anywhere</b> — use ‹ / › to step, <b>Today</b> to return, or <b>Choose {mode === "month" ? "month" : mode === "week" ? "week" : "date"}</b> to pick a specific {mode === "day" ? "day" : mode}.</li>
            <li>It&rsquo;s a read-only view — to change dates or capacity, edit the listing&rsquo;s run in <b>Listings</b>.</li>
          </ul>
        </div>
      </details>
    </div>
  );
}
