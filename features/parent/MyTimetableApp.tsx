"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useT } from "@/lib/i18n/provider";
import type { Booking } from "@/features/bookings/types";

// Boy → blue, Girl → pink, unknown → grey (matches the bookings pills).
function genderTone(sex?: string): { bg: string; fg: string; on: string } {
  const s = (sex ?? "").toLowerCase();
  if (s.startsWith("b") || s === "male" || s === "m") return { bg: "#eaf0fc", fg: "#1d3a8f", on: "#1d3a8f" };
  if (s.startsWith("g") || s === "female" || s === "f") return { bg: "#fdeaf3", fg: "#b0186a", on: "#c81e77" };
  return { bg: "var(--panel)", fg: "var(--ink-2)", on: "var(--ink-2)" };
}
// A colour per activity so the timetable reads at a glance.
const PALETTE = ["#2f6bd8", "#0e9f6e", "#e2225f", "#7a5af8", "#e88f1f", "#0ea5a0", "#c81e77", "#16a34a"];

const parseISO = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const fmtLongDay = (iso: string) => parseISO(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

interface Sess { date: string; child: string; listing: string; listingId?: string; timing?: string; ref: string; tenantId?: string }
interface Detail { location?: string | null; staff: { name: string }[]; periods: { title: string; start?: string; finish?: string }[] }

/**
 * My timetable — a colourful, day-by-day view of the family's booked sessions:
 * what (activity), when (date + time), where (venue) and who (staff onsite),
 * filterable by child. Read-only companion to the My bookings cards.
 */
export function MyTimetableApp() {
  const t = useT();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, Detail>>({});
  const [kidsSex, setKidsSex] = useState<Record<string, string>>({});
  const [childF, setChildF] = useState("");

  const refresh = useCallback(() => {
    apiGet<Booking[]>("/api/my/bookings")
      .then(setBookings)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn’t load your timetable"));
  }, []);
  useEffect(refresh, [refresh]);
  useRealtime(["bookings"], refresh);

  useEffect(() => {
    apiGet<{ name: string; sex?: string }[]>("/api/my/children")
      .then((cs) => setKidsSex(Object.fromEntries((cs ?? []).map((c) => [c.name.trim(), (c.sex ?? "").toLowerCase()]))))
      .catch(() => {});
  }, []);

  // Venue + staff + times per listing.
  useEffect(() => {
    const ids = [...new Set((bookings ?? []).map((b) => b.listingId).filter(Boolean) as string[])];
    ids.filter((id) => !details[id]).forEach((id) => {
      apiGet<{ library?: { venue?: { name?: string } | null; staff?: { name: string }[] }; bundle?: { periods?: { title: string; start?: string; finish?: string }[] } }>(`/api/listings/${encodeURIComponent(id)}`)
        .then((l) => setDetails((m) => ({ ...m, [id]: { location: l.library?.venue?.name ?? null, staff: l.library?.staff ?? [], periods: l.bundle?.periods ?? [] } })))
        .catch(() => {});
    });
  }, [bookings, details]);

  const listingColour = useMemo(() => {
    const names = [...new Set((bookings ?? []).map((b) => b.listing).filter(Boolean))];
    return Object.fromEntries(names.map((n, i) => [n, PALETTE[i % PALETTE.length]]));
  }, [bookings]);

  const { days, childNames, todayIso } = useMemo(() => {
    const out: Sess[] = [];
    const names = new Set<string>();
    for (const b of bookings ?? []) {
      if (b.status === "Cancelled" || b.status === "Declined") continue;
      const perChild: { child: string; days: string[] }[] = b.kids && b.kids.length
        ? b.kids.filter((k) => !k.cancelled).map((k) => ({ child: k.name, days: (k.dates && k.dates.length ? k.dates : b.days ?? []).filter((d) => !(k.cancelledDays ?? []).includes(d)) }))
        : [{ child: b.child, days: b.days ?? [] }];
      for (const row of perChild) {
        names.add(row.child);
        for (const date of row.days) out.push({ date, child: row.child, listing: b.listing, listingId: b.listingId, timing: b.timing, ref: b.ref, tenantId: b.tenantId });
      }
    }
    const byDate = new Map<string, Sess[]>();
    for (const s of out) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
    const days = [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, sessions]) => ({ date, sessions }));
    return { days, childNames: [...names].sort(), todayIso: toISO(new Date()) };
  }, [bookings]);

  const timesFor = (s: Sess) => {
    const d = s.listingId ? details[s.listingId] : undefined;
    const p = d?.periods.find((x) => x.title === s.timing) ?? (d?.periods.length === 1 ? d.periods[0] : undefined);
    return p?.start && p?.finish ? `${p.start}–${p.finish}` : s.timing || "";
  };
  const staffFor = (s: Sess) => (s.listingId ? details[s.listingId]?.staff ?? [] : []).map((x) => x.name);
  const venueFor = (s: Sess) => (s.listingId ? details[s.listingId]?.location : null) || "";

  const shownDays = days
    .map((d) => ({ ...d, sessions: d.sessions.filter((s) => !childF || s.child === childF) }))
    .filter((d) => d.sessions.length > 0);

  if (error) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!bookings) return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">{t("parent.loadingTimetable")}</div>;

  return (
    <div>
      {childNames.length > 1 && (
        <div className="mb-3.5 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setChildF("")} className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
            style={!childF ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
            {t("parent.allChildren")}
          </button>
          {childNames.map((name) => {
            const t = genderTone(kidsSex[name]);
            const on = childF === name;
            return (
              <button key={name} type="button" onClick={() => setChildF(on ? "" : name)} className="rounded-full border-2 px-3.5 py-1.5 text-[12.5px] font-extrabold transition-colors"
                style={on ? { borderColor: t.on, background: t.on, color: "#fff" } : { borderColor: t.bg, background: t.bg, color: t.fg }}>
                {name}
              </button>
            );
          })}
        </div>
      )}

      {shownDays.length === 0 ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-5 py-10 text-center">
          <div className="text-[15px] font-extrabold text-[var(--ink)]">{t("parent.nothingBookedYet")}</div>
          <div className="mt-1 text-[12.5px] text-[var(--ink-3)]">{t("parent.timetableEmptyHint")}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {shownDays.map(({ date, sessions }) => {
            const rel = date === todayIso ? t("parent.today") : null;
            return (
              <div key={date}>
                <div className="mb-2 flex items-center gap-2">
                  {rel && <span className="rounded-md px-2 py-[2px] text-[11px] font-extrabold uppercase tracking-[0.04em] text-white" style={{ background: "var(--brand)" }}>{rel}</span>}
                  <span className="text-[14px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{fmtLongDay(date)}</span>
                  <span className="text-[12px] text-[var(--ink-3)]">{sessions.length} session{sessions.length === 1 ? "" : "s"}</span>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  {[...sessions].sort((a, b) => timesFor(a).localeCompare(timesFor(b))).map((s, i) => {
                    const col = listingColour[s.listing] || "#2f6bd8";
                    const tone = genderTone(kidsSex[s.child]);
                    const staff = staffFor(s);
                    const venue = venueFor(s);
                    const times = timesFor(s);
                    return (
                      <div key={`${s.ref}-${s.child}-${i}`} className="overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-[0_1px_3px_rgba(20,30,60,.06)]">
                        <div className="h-1.5" style={{ background: col }} />
                        <div className="flex flex-col gap-1.5 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-[13.5px] font-extrabold leading-tight text-[var(--ink)]">{s.listing}</div>
                            <span className="flex-none rounded-full px-2 py-0.5 text-[10.5px] font-extrabold" style={{ background: tone.bg, color: tone.fg }}>{s.child}</span>
                          </div>
                          {times && <div className="text-[12px] font-bold" style={{ color: col }}>🕒 {times}</div>}
                          {venue && <div className="text-[12px] text-[var(--ink-2)]">📍 {venue}</div>}
                          <div className="text-[11.5px] text-[var(--ink-3)]">👤 {staff.length ? staff.join(", ") : t("parent.teamConfirmedNearer")}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
