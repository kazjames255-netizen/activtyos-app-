"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Badge, Card } from "@/components/ui";

interface Dash {
  today: { date: string; booked: number; sessions: { listing: string; start: string; end: string; booked: number; capacity: number }[] };
  next: { date: string; start: string; end: string; listing: string } | null;
  upcoming: { date: string; start: string; end: string; listing: string; spotsLeft: number }[];
  bookings: { live: number; newThisWeek: number; waitlist: number };
  occupancy: { booked: number; capacity: number; pct: number };
  money: { takenThisWeek: number; outstanding: number; overdueVouchers: number; awaitingVoucher: number };
  counts: { listings: number; activeBlocks: number };
}

const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{label}</div>
      <div className="mt-1 text-[26px] font-extrabold leading-none" style={{ fontFamily: "var(--ff-display)", color: tone === "warn" ? "var(--red,#e21d27)" : "var(--ink)" }}>{value}</div>
      {sub && <div className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">{sub}</div>}
    </Card>
  );
}

export function DashboardApp() {
  const [d, setD] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<Dash>("/api/dashboard").then((x) => { setD(x); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(load, [load]);
  useRealtime(["bookings", "blocks", "listings", "payments"], load);

  if (error) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!d) return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>;

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-4 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Dashboard</h2>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="On site today" value={`${d.today.booked}`} sub={`${d.today.sessions.length} session${d.today.sessions.length === 1 ? "" : "s"} running`} />
        <Stat label="Occupancy" value={`${d.occupancy.pct}%`} sub={`${d.occupancy.booked}/${d.occupancy.capacity} places, open runs`} />
        <Stat label="Taken this week" value={money(d.money.takenThisWeek)} sub={`${d.bookings.newThisWeek} new booking${d.bookings.newThisWeek === 1 ? "" : "s"}`} />
        <Stat label="Outstanding" value={money(d.money.outstanding)} sub={d.money.overdueVouchers ? `${d.money.overdueVouchers} overdue voucher${d.money.overdueVouchers === 1 ? "" : "s"}` : d.money.awaitingVoucher ? `${d.money.awaitingVoucher} awaiting voucher` : "all settled"} tone={d.money.overdueVouchers ? "warn" : undefined} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[13.5px] font-extrabold">Today · {fmtDay(d.today.date)}</div>
            {d.bookings.waitlist > 0 && <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>{d.bookings.waitlist} on waitlist</Badge>}
          </div>
          {d.today.sessions.length === 0 ? (
            <div className="py-4 text-center text-[12.5px] text-[var(--ink-3)]">Nothing running today.</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {d.today.sessions.map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5">
                  <span className="text-[12px] font-bold tabular-nums">{s.start}–{s.end}</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold">{s.listing}</span>
                  <span className="text-[11.5px] text-[var(--ink-3)]">{s.booked}/{s.capacity}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="mb-2 text-[13.5px] font-extrabold">Coming up</div>
          {d.upcoming.length === 0 ? (
            <div className="py-4 text-center text-[12.5px] text-[var(--ink-3)]">No upcoming sessions.</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {d.upcoming.map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5">
                  <span className="w-[92px] shrink-0 text-[11.5px] font-bold text-[var(--ink-2)]">{fmtDay(s.date)}</span>
                  <span className="text-[12px] tabular-nums text-[var(--ink-2)]">{s.start}</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px]">{s.listing}</span>
                  {s.spotsLeft === 0 ? <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "var(--red,#e21d27)" }}>full</Badge> : <span className="text-[11px] text-[var(--ink-3)]">{s.spotsLeft} left</span>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-3 text-[11.5px] text-[var(--ink-3)]">{d.counts.listings} listing{d.counts.listings === 1 ? "" : "s"} · {d.counts.activeBlocks} active run{d.counts.activeBlocks === 1 ? "" : "s"} · {d.bookings.live} live booking{d.bookings.live === 1 ? "" : "s"}</div>
    </div>
  );
}
