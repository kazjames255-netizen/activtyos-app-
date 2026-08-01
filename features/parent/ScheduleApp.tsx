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
  listingId?: string;
  timing?: string;
  pass: string;
  status: Booking["status"];
  ref: string;
  key: string;
}

// The venue + staff + times we pull from each booking's listing (public
// GET /api/listings/:id) so the schedule tells a parent where to be, when,
// and who's running it — not just what was booked.
interface ListingDetail {
  location?: string | null;
  address?: string | null;
  staff: { name: string }[];
  periods: { title: string; start?: string; finish?: string }[];
}

// A row from GET /api/listings?tenantId= — enough to resolve a booking's
// listing (by id or block) and read the venue name/address off it.
interface ListingRow {
  id: string;
  location?: string | null;
  address?: string | null;
  blocks?: { id: string }[];
}

// Boy → blue, Girl → pink, unknown → house grey. Same convention as the
// manual/registers gender chips.
function genderTone(sex?: string): { bg: string; fg: string; on: string } {
  const s = (sex ?? "").toLowerCase();
  if (s.startsWith("b") || s === "male" || s === "m") return { bg: "#eaf0fc", fg: "#1d3a8f", on: "#1d3a8f" };
  if (s.startsWith("g") || s === "female" || s === "f") return { bg: "#fdeaf3", fg: "#b0186a", on: "#c81e77" };
  return { bg: "var(--panel)", fg: "var(--ink-2)", on: "var(--ink-2)" };
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
          listingId: b.listingId,
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

function SessionRow({ s, detail, clash }: { s: Session; detail?: ListingDetail; clash?: boolean }) {
  const [open, setOpen] = useState(false);
  // Match the booked timing to a concrete start–finish from the listing.
  const period = detail?.periods.find((p) => p.title === s.timing) ?? (detail?.periods.length === 1 ? detail.periods[0] : undefined);
  const times = period?.start && period?.finish ? `${period.start}–${period.finish}` : null;
  return (
    <div className="border-b border-dashed border-[var(--line)] py-2 last:border-b-0" style={clash ? { background: "#fff6f6", borderRadius: 8, paddingLeft: 8, paddingRight: 8, marginLeft: -8, marginRight: -8 } : undefined}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[13px] font-extrabold text-[var(--ink)]">{s.child}</span>
        <span className="text-[12.5px] text-[var(--ink-2)]">{s.listing}</span>
        {s.timing && (
          <span className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-2 py-[2px] text-[11px] font-bold text-[var(--ink-2)]">
            {s.timing}{times ? ` · ${times}` : ""}
          </span>
        )}
        {clash && <span className="rounded-full bg-[#fdebec] px-2 py-[2px] text-[11px] font-extrabold text-[#c0392b]">⚠️ overlaps another session</span>}
        <span className="ml-auto flex items-center gap-1.5">
          <span className="text-[11px] text-[var(--ink-3)]">Ref {s.ref}</span>
          <Badge tone={statusTone(s.status)}>{s.status}</Badge>
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--ink-3)]">
        {detail?.location && <span>📍 {detail.location}</span>}
        {times && <span>🕒 {times}</span>}
        {detail && detail.staff.length > 0 && <span>👤 {detail.staff.map((x) => x.name).join(", ")}</span>}
        <button type="button" onClick={() => setOpen((v) => !v)} className="font-bold text-[var(--brand-2)] hover:underline">{open ? "Less" : "Details"}</button>
        <Link href={`/custdash/bookings?amend=${encodeURIComponent(s.ref)}`} className="font-bold text-[var(--brand-2)] hover:underline">Edit booking ✎</Link>
        <Link href={`/custdash/bookings?cancel=${encodeURIComponent(s.ref)}`} className="font-bold text-[var(--red,#e21d27)] hover:underline">Cancel ✕</Link>
      </div>
      {open && (
        <div className="mt-1.5 grid gap-x-6 gap-y-1 rounded-lg bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-2)] sm:grid-cols-2">
          <div><span className="text-[var(--ink-3)]">Location: </span><b>{detail?.location ?? "—"}</b></div>
          <div><span className="text-[var(--ink-3)]">Address: </span><b>{detail?.address ?? "—"}</b></div>
          <div><span className="text-[var(--ink-3)]">Timings: </span><b>{times ?? s.timing ?? "—"}</b></div>
          <div><span className="text-[var(--ink-3)]">Staff onsite: </span><b>{detail && detail.staff.length ? detail.staff.map((x) => x.name).join(", ") : "confirmed nearer the day"}</b></div>
        </div>
      )}
    </div>
  );
}

const toMin = (t?: string) => { if (!t) return null; const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
function DayGroup({ date, sessions, today, detailByRef }: { date: string; sessions: Session[]; today: string; detailByRef: Record<string, ListingDetail> }) {
  const rel = date === today ? "Today" : date === addDaysISO(today, 1) ? "Tomorrow" : null;

  // A child booked onto two sessions the same day whose times overlap (or whose
  // times we can't rule out) — almost always a mistake worth flagging.
  const rangeOf = (s: Session): [number, number] | null => {
    const d = detailByRef[s.ref];
    const p = d?.periods.find((x) => x.title === s.timing) ?? (d?.periods.length === 1 ? d.periods[0] : undefined);
    const a = toMin(p?.start), b = toMin(p?.finish);
    return a != null && b != null ? [a, b] : null;
  };
  const clashKeys = new Set<string>();
  const clashChildren = new Set<string>();
  const byChild = new Map<string, Session[]>();
  for (const s of sessions) byChild.set(s.child, [...(byChild.get(s.child) ?? []), s]);
  for (const [child, ss] of byChild) {
    if (ss.length < 2) continue;
    for (let i = 0; i < ss.length; i++) for (let j = i + 1; j < ss.length; j++) {
      const a = rangeOf(ss[i]), b = rangeOf(ss[j]);
      const overlaps = !a || !b ? true : a[0] < b[1] && b[0] < a[1]; // unknown times → can't rule it out
      if (overlaps) { clashKeys.add(ss[i].key); clashKeys.add(ss[j].key); clashChildren.add(child); }
    }
  }
  return (
    <Card className="p-4">
      <div className="mb-1.5 flex flex-wrap items-baseline gap-2">
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
      {clashChildren.size > 0 && (
        <div className="mb-2 flex items-start gap-2 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12px] font-semibold text-[#c0392b]">
          <span aria-hidden>⚠️</span>
          <span>{[...clashChildren].join(" & ")} {clashChildren.size > 1 ? "are" : "is"} booked onto more than one session today with overlapping times. Check this is right — you may want to cancel or move one.</span>
        </div>
      )}
      {[...sessions].sort(sortSessions).map((s) => (
        <SessionRow key={s.key} s={s} detail={detailByRef[s.ref]} clash={clashKeys.has(s.key)} />
      ))}
    </Card>
  );
}

/** custdash/schedule — the signed-in parent's booked sessions, by date. */
export function ScheduleApp({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [tenantRows, setTenantRows] = useState<Record<string, ListingRow[]>>({});
  const [details, setDetails] = useState<Record<string, ListingDetail>>({});
  const [kids, setKids] = useState<Record<string, string>>({}); // child name → sex
  const [childTab, setChildTab] = useState<string>("all");
  const [dateQuery, setDateQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  const refresh = useCallback(() => {
    apiGet<Booking[]>("/api/my/bookings")
      .then(setBookings)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load your schedule"));
    // The family's children — for the per-child tabs, coloured by gender.
    apiGet<{ name: string; sex?: string }[]>("/api/my/children")
      .then((cs) => setKids(Object.fromEntries(cs.map((c) => [c.name.trim(), (c.sex ?? "").toLowerCase()]))))
      .catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);
  useRealtime(["bookings", "children"], refresh);

  // Resolve each booking's listing the way the amend flow does — by blockId
  // against the tenant's listing list (bookings don't always carry listingId).
  // That list also gives us the venue name + address directly.
  useEffect(() => {
    const tids = [...new Set((bookings ?? []).map((b) => b.tenantId).filter(Boolean) as string[])];
    tids.filter((t) => !tenantRows[t]).forEach((t) => {
      apiGet<ListingRow[]>(`/api/listings?tenantId=${encodeURIComponent(t)}`)
        .then((rows) => setTenantRows((m) => ({ ...m, [t]: rows })))
        .catch(() => {});
    });
  }, [bookings, tenantRows]);

  // ref → the resolved listing (id + venue). Then fetch each listing's detail
  // for staff onsite + concrete session times.
  const listingForRef = useMemo(() => {
    const map: Record<string, { id?: string; location?: string | null; address?: string | null }> = {};
    for (const b of bookings ?? []) {
      const rows = tenantRows[b.tenantId ?? ""] ?? [];
      const row = rows.find((r) => (b.listingId && r.id === b.listingId) || (b.blockId && (r.blocks ?? []).some((bk) => bk.id === b.blockId)));
      if (row) map[b.ref] = { id: row.id, location: row.location, address: row.address };
      else if (b.listingId) map[b.ref] = { id: b.listingId };
    }
    return map;
  }, [bookings, tenantRows]);

  useEffect(() => {
    const ids = [...new Set(Object.values(listingForRef).map((x) => x.id).filter(Boolean) as string[])];
    ids.filter((id) => !details[id]).forEach((id) => {
      apiGet<{ library?: { venue?: { name?: string; address?: string } | null; staff?: { name: string }[] }; bundle?: { periods?: { title: string; start?: string; finish?: string }[] } }>(`/api/listings/${encodeURIComponent(id)}`)
        .then((l) => setDetails((m) => ({ ...m, [id]: {
          location: l.library?.venue?.name ?? null,
          address: l.library?.venue?.address ?? null,
          staff: (l.library?.staff ?? []).map((s) => ({ name: s.name })),
          periods: l.bundle?.periods ?? [],
        } })))
        .catch(() => {});
    });
  }, [listingForRef, details]);

  // Merge the venue (from the list) with staff/times (from the detail), per ref.
  const detailByRef = useMemo(() => {
    const out: Record<string, ListingDetail> = {};
    for (const [ref, info] of Object.entries(listingForRef)) {
      const d = info.id ? details[info.id] : undefined;
      out[ref] = {
        location: info.location ?? d?.location ?? null,
        address: info.address ?? d?.address ?? null,
        staff: d?.staff ?? [],
        periods: d?.periods ?? [],
      };
    }
    return out;
  }, [listingForRef, details]);

  const today = todayISO();
  const { upcoming, past, undated, childNames } = useMemo(() => {
    const all = bookings ?? [];
    // Every child in the family's bookings — for the per-child tabs.
    const childNames = [...new Set(
      all.flatMap((b) => (b.kids && b.kids.length ? b.kids.map((k) => k.name) : [b.child]))
        .map((n) => n?.trim())
        .filter(Boolean) as string[],
    )].sort();
    const sel = (name?: string) => childTab === "all" || name?.trim() === childTab;
    const sessions = toSessions(all).filter((s) => sel(s.child));
    const byDate = new Map<string, Session[]>();
    for (const s of sessions) {
      const arr = byDate.get(s.date);
      if (arr) arr.push(s);
      else byDate.set(s.date, [s]);
    }
    const dates = [...byDate.keys()].sort();
    return {
      childNames,
      upcoming: dates.filter((d) => d >= today).map((d) => ({ date: d, sessions: byDate.get(d)! })),
      past: dates
        .filter((d) => d < today)
        .sort((a, b) => (a < b ? 1 : -1))
        .map((d) => ({ date: d, sessions: byDate.get(d)! })),
      undated: undatedBookings(all).filter((b) => sel(b.child) || (b.kids ?? []).some((k) => sel(k.name))),
    };
  }, [bookings, today, childTab]);

  if (error) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!bookings)
    return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading your schedule…</div>;

  const nothing = upcoming.length === 0 && past.length === 0 && undated.length === 0;
  const pastCount = past.reduce((n, g) => n + g.sessions.length, 0);
  // Date search: when a date is picked, show only that day (from upcoming or
  // past) and hide the undated / past-toggle machinery.
  const searching = !!dateQuery;
  const searchGroups = searching ? [...upcoming, ...past].filter((g) => g.date === dateQuery) : [];

  return (
    <div className="text-[var(--ink)]">
      {!hideHeader && (
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
      )}

      {childNames.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setChildTab("all")} className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
            style={childTab === "all" ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
            All children
          </button>
          {childNames.map((name) => {
            const t = genderTone(kids[name]);
            const on = childTab === name;
            return (
              <button key={name} type="button" onClick={() => setChildTab(name)} className="rounded-full border-2 px-3.5 py-1.5 text-[12.5px] font-extrabold transition-colors"
                style={on ? { borderColor: t.on, background: t.on, color: "#fff" } : { borderColor: t.bg, background: t.bg, color: t.fg }}>
                {name}
              </button>
            );
          })}
        </div>
      )}

      {!nothing && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="text-[12px] font-bold text-[var(--ink-3)]">🔎 Jump to a date</label>
          <input type="date" value={dateQuery} onChange={(e) => setDateQuery(e.target.value)}
            className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink-2)] outline-none focus:border-[var(--brand)]" />
          {searching && <button type="button" onClick={() => setDateQuery("")} className="text-[12px] font-bold text-[var(--brand-2)] underline">Clear</button>}
        </div>
      )}

      {nothing ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
          Nothing booked yet —{" "}
          <Link href="/custdash/browse" className="font-bold text-[var(--brand-2)]">
            browse activities
          </Link>{" "}
          to fill your calendar.
        </Card>
      ) : searching ? (
        <div className="flex flex-col gap-3">
          {searchGroups.length === 0 ? (
            <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
              No sessions on {fmtLongDay(dateQuery)}{childTab !== "all" ? ` for ${childTab}` : ""}.
            </Card>
          ) : (
            searchGroups.map((g) => (
              <DayGroup key={g.date} date={g.date} sessions={g.sessions} today={today} detailByRef={detailByRef} />
            ))
          )}
        </div>
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
                    <Link href={`/custdash/bookings?amend=${encodeURIComponent(b.ref)}`} className="ml-auto font-bold text-[var(--brand-2)] hover:underline">Edit booking ✎</Link>
                    <Link href={`/custdash/bookings?cancel=${encodeURIComponent(b.ref)}`} className="font-bold text-[var(--red,#e21d27)] hover:underline">Cancel ✕</Link>
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
            <DayGroup key={g.date} date={g.date} sessions={g.sessions} today={today} detailByRef={detailByRef} />
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
                    <DayGroup key={g.date} date={g.date} sessions={g.sessions} today={today} detailByRef={detailByRef} />
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
