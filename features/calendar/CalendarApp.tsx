"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Button, Card } from "@/components/ui";

interface Session { date: string; start: string; end: string; spotsLeft?: number }
interface Block { id: string; name: string; open: boolean; sessions: Session[] }
interface Listing { id: string; title: string; blocks?: Block[] }

interface Ev { date: string; start: string; end: string; listing: string; block: string; spotsLeft?: number; open: boolean }

const iso = (d: Date) => d.toISOString().slice(0, 10);
const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

// Read view over real blocks/sessions across the operator's programmes — one
// month grid so they can see what's running when. Sessions come joined onto
// /api/listings; nothing is written here.
export function CalendarApp() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); });
  const [selected, setSelected] = useState<string | null>(null);

  const refresh = useCallback(() => {
    apiGet<Listing[]>("/api/listings?mine=1").then((l) => { setListings(l); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["listings", "blocks"], refresh);

  const events = useMemo(() => {
    const out: Ev[] = [];
    for (const l of listings ?? []) for (const b of l.blocks ?? []) for (const s of b.sessions ?? []) out.push({ date: s.date, start: s.start, end: s.end, listing: l.title, block: b.name, spotsLeft: s.spotsLeft, open: b.open });
    return out;
  }, [listings]);
  const byDate = useMemo(() => {
    const m: Record<string, Ev[]> = {};
    for (const e of events) (m[e.date] ??= []).push(e);
    for (const k of Object.keys(m)) m[k].sort((a, b) => (a.start < b.start ? -1 : 1));
    return m;
  }, [events]);

  const grid = useMemo(() => {
    const first = new Date(cursor);
    const startPad = (first.getUTCDay() + 6) % 7; // Monday-first
    const start = new Date(first); start.setUTCDate(1 - startPad);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setUTCDate(start.getUTCDate() + i); return d; });
  }, [cursor]);

  const thisMonth = monthKey(cursor);
  const todayIso = iso(new Date());
  function shiftMonth(delta: number) { setSelected(null); setCursor((c) => new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + delta, 1))); }
  const selectedEvents = selected ? (byDate[selected] ?? []) : [];

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Calendar</h2>
        <div className="flex items-center gap-1.5">
          <Button sm onClick={() => shiftMonth(-1)}>‹</Button>
          <span className="min-w-[130px] text-center text-[12.5px] font-bold">{cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}</span>
          <Button sm onClick={() => shiftMonth(1)}>›</Button>
          <Button sm onClick={() => { setSelected(null); setCursor(() => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); }); }}>Today</Button>
        </div>
      </div>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Every session across your programmes. Click a day for details.</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {!listings ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div> : (
        <>
          <div className="grid grid-cols-7 gap-1">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="pb-1 text-center text-[10.5px] font-extrabold uppercase tracking-[0.03em] text-[var(--ink-3)]">{d}</div>)}
            {grid.map((d) => {
              const key = iso(d);
              const inMonth = monthKey(d) === thisMonth;
              const evs = byDate[key] ?? [];
              const isToday = key === todayIso;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(evs.length ? key : null)}
                  className={`min-h-[64px] rounded-lg border p-1 text-left align-top transition ${selected === key ? "border-[var(--brand)]" : "border-[var(--line)]"} ${inMonth ? "bg-[var(--surface)]" : "bg-[var(--panel)] opacity-55"} ${evs.length ? "cursor-pointer hover:border-[var(--brand)]" : "cursor-default"}`}
                >
                  <div className={`text-[11px] ${isToday ? "font-extrabold text-[var(--brand)]" : "text-[var(--ink-2)]"}`}>{d.getUTCDate()}</div>
                  <div className="mt-0.5 flex flex-col gap-0.5">
                    {evs.slice(0, 3).map((e, i) => (
                      <div key={i} className={`truncate rounded px-1 py-[1px] text-[9.5px] font-bold ${e.open ? "bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[var(--brand)]" : "bg-[var(--panel)] text-[var(--ink-3)]"}`} title={`${e.listing} · ${e.block} · ${e.start}–${e.end}`}>{e.start} {e.listing}</div>
                    ))}
                    {evs.length > 3 && <div className="px-1 text-[9.5px] text-[var(--ink-3)]">+{evs.length - 3} more</div>}
                  </div>
                </button>
              );
            })}
          </div>

          {selected && (
            <Card className="mt-3 p-3.5">
              <div className="mb-2 text-[13px] font-extrabold">{new Date(`${selected}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</div>
              <div className="flex flex-col gap-1.5">
                {selectedEvents.map((e, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5">
                    <span className="text-[12px] font-bold tabular-nums">{e.start}–{e.end}</span>
                    <span className="text-[12.5px] font-bold">{e.listing}</span>
                    <span className="text-[11.5px] text-[var(--ink-3)]">{e.block}</span>
                    {!e.open ? <Badge tone={{ bg: "var(--panel)", fg: "var(--ink-3)" }}>closed</Badge>
                      : e.spotsLeft === 0 ? <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "var(--red,#e21d27)" }}>full</Badge>
                      : e.spotsLeft !== undefined ? <Badge tone={{ bg: "#eaf0fc", fg: "#1d3a8f" }}>{e.spotsLeft} left</Badge> : null}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
