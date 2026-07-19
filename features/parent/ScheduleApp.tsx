"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { statusTone } from "@/features/bookings/helpers";
import type { Booking } from "@/features/bookings/types";
import { Badge, Button, Card } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// custdash/schedule — the signed-in parent's calendar of booked sessions.
//
// "My bookings" answers "what have I booked"; this answers "where does my
// child need to be, and when". Each booking carries the concrete ISO session
// dates it occupies (`days`, or per-child `kids[].dates`); we flatten those
// into one occurrence per child-per-date, drop cancelled days, and group by
// date. Read-only and fully server-backed by /api/my/bookings — no local
// state, live-refreshes with the bookings stream.
// ─────────────────────────────────────────────────────────────────────────

interface Session {
  date: string; // ISO "YYYY-MM-DD"
  child: string;
  listing: string;
  timing?: string;
  pass: string;
  status: Booking["status"];
  ref: string;
  key: string;
}

// ── Date helpers (ISO "YYYY-MM-DD", parsed as local to avoid TZ drift) ──────
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function todayISO(): string {
  return toISO(new Date());
}
function addDaysISO(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
function fmtLongDay(iso: string): string {
  return parseISO(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

// Turn the family's bookings into one session per child, per date.
function toSessions(bookings: Booking[]): Session[] {
  const out: Session[] = [];
  for (const b of bookings) {
    if (b.status === "Cancelled" || b.status === "Declined") continue;

    // A booking is either one named child, or several `kids` each with their
    // own dates. Prefer the per-child dates when present.
    const perChild: { child: string; days: string[] }[] = [];
    if (b.kids && b.kids.length) {
      for (const k of b.kids) {
        if (k.cancelled) continue;
        const base = k.dates && k.dates.length ? k.dates : b.days ?? [];
        const cancelled = k.cancelledDays ?? [];
        perChild.push({ child: k.name, days: base.filter((d) => !cancelled.includes(d)) });
      }
    } else {
      perChild.push({ child: b.child, days: b.days ?? [] });
    }

    for (const row of perChild) {
      for (const date of row.days) {
        out.push({
          date,
          child: row.child,
          listing: b.listing,
          timing: b.timing,
          pass: b.pass,
          status: b.status,
          ref: b.ref,
          key: `${b.tenantId ?? ""}-${b.ref}-${row.child}-${date}`,
        });
      }
    }
  }
  return out;
}

// Confirmed/pending bookings with no dated sessions yet (legacy "every
// session" bookings) — surfaced separately so they aren't silently dropped.
function undatedBookings(bookings: Booking[]): Booking[] {
  return bookings.filter(
    (b) =>
      b.status !== "Cancelled" &&
      b.status !== "Declined" &&
      !(b.days && b.days.length) &&
      !(b.kids && b.kids.some((k) => k.dates && k.dates.length)),
  );
}

function sortSessions(a: Session, b: Session): number {
  return (
    (a.timing ?? "").localeCompare(b.timing ?? "") ||
    a.listing.localeCompare(b.listing) ||
    a.child.localeCompare(b.child)
  );
}

function SessionRow({ s }: { s: Session }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-dashed border-[var(--line)] py-2 last:border-b-0">
      <span className="text-[13px] font-extrabold text-[var(--ink)]">{s.child}</span>
      <span className="text-[12.5px] text-[var(--ink-2)]">{s.listing}</span>
      {s.timing && (
        <span className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-2 py-[2px] text-[11px] font-bold text-[var(--ink-2)]">
          {s.timing}
        </span>
      )}
      <span className="ml-auto flex items-center gap-1.5">
        <span className="text-[11px] text-[var(--ink-3)]">Ref {s.ref}</span>
        <Badge tone={statusTone(s.status)}>{s.status}</Badge>
      </span>
    </div>
  );
}

function DayGroup({ date, sessions, today }: { date: string; sessions: Session[]; today: string }) {
  const rel = date === today ? "Today" : date === addDaysISO(today, 1) ? "Tomorrow" : null;
  return (
    <Card className="p-4">
      <div className="mb-1.5 flex items-baseline gap-2">
        {rel && (
          <span className="rounded-md px-2 py-[2px] text-[11px] font-extrabold uppercase tracking-[0.04em] text-white" style={{ background: "var(--brand)" }}>
            {rel}
          </span>
        )}
        <span className="text-[14px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          {fmtLongDay(date)}
        </span>
        <span className="text-[12px] text-[var(--ink-3)]">
          {sessions.length} session{sessions.length === 1 ? "" : "s"}
        </span>
      </div>
      {[...sessions].sort(sortSessions).map((s) => (
        <SessionRow key={s.key} s={s} />
      ))}
    </Card>
  );
}

/** custdash/schedule — the signed-in parent's booked sessions, by date. */
export function ScheduleApp() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  const refresh = useCallback(() => {
    apiGet<Booking[]>("/api/my/bookings")
      .then(setBookings)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load your schedule"));
  }, []);

  useEffect(refresh, [refresh]);
  useRealtime(["bookings"], refresh);

  const today = todayISO();
  const { upcoming, past, undated } = useMemo(() => {
    const all = bookings ?? [];
    const sessions = toSessions(all);
    const byDate = new Map<string, Session[]>();
    for (const s of sessions) {
      const arr = byDate.get(s.date);
      if (arr) arr.push(s);
      else byDate.set(s.date, [s]);
    }
    const dates = [...byDate.keys()].sort();
    return {
      upcoming: dates.filter((d) => d >= today).map((d) => ({ date: d, sessions: byDate.get(d)! })),
      past: dates
        .filter((d) => d < today)
        .sort((a, b) => (a < b ? 1 : -1))
        .map((d) => ({ date: d, sessions: byDate.get(d)! })),
      undated: undatedBookings(all),
    };
  }, [bookings, today]);

  if (error) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!bookings)
    return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading your schedule…</div>;

  const nothing = upcoming.length === 0 && past.length === 0 && undated.length === 0;
  const pastCount = past.reduce((n, g) => n + g.sessions.length, 0);

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            My schedule
          </h2>
          <p className="text-[12.5px] text-[var(--ink-3)]">
            Every day your family is booked in — newest first, live as the provider confirms.
          </p>
        </div>
        <Link href="/custdash/browse">
          <Button variant="primary">+ Book an activity</Button>
        </Link>
      </div>

      {nothing ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
          Nothing booked yet —{" "}
          <Link href="/custdash/browse" className="font-bold text-[var(--brand-2)]">
            browse activities
          </Link>{" "}
          to fill your calendar.
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {undated.length > 0 && (
            <Card className="p-4" style={{ borderLeftWidth: "4px", borderLeftColor: "var(--brand)" }}>
              <div className="mb-1 text-[13px] font-extrabold">Dates to be confirmed</div>
              <div className="text-[12px] text-[var(--ink-3)]">
                These bookings don’t have set session dates yet — they’ll appear on the calendar once
                the provider fixes the days.
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {undated.map((b) => (
                  <div key={`${b.tenantId ?? ""}-${b.ref}`} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                    <span className="font-bold">{b.child}</span>
                    <span className="text-[var(--ink-2)]">{b.listing}</span>
                    <span className="text-[var(--ink-3)]">· {b.pass}</span>
                    <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {upcoming.length === 0 && undated.length === 0 && (
            <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
              No upcoming sessions — your booked days are all in the past.
            </Card>
          )}

          {upcoming.map((g) => (
            <DayGroup key={g.date} date={g.date} sessions={g.sessions} today={today} />
          ))}

          {past.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowPast((v) => !v)}
                className="flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)] hover:text-[var(--ink-2)]"
              >
                <span>{showPast ? "▾" : "▸"}</span> Past sessions ({pastCount})
              </button>
              {showPast && (
                <div className="mt-2 flex flex-col gap-3 opacity-80">
                  {past.map((g) => (
                    <DayGroup key={g.date} date={g.date} sessions={g.sessions} today={today} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
