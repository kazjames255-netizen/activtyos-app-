"use client";

// "On site now" — one card answering the whole question at a glance: how many
// children are in, who hasn't turned up, and which staff are covering them,
// broken down by listing and totalled across the day.
//
// Replaces the old split between the dashboard's "Who's in now" (staff only,
// no children) and the schedule's Staff attendance board (staff only, per
// venue). Neither told you whether the children were actually covered.
//
// The join: children come from the register (per listing), staff come from the
// clock store keyed by VENUE (`op`). A listing knows its venueId, and the
// library maps venueId → venue name, so listing → venue → staff resolves. When
// that hop fails the staff simply aren't attributed to a listing and fall into
// "Elsewhere / unassigned" rather than being silently dropped.
import { useEffect, useMemo, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { loadClock, hhmm, type ClockRecord } from "./data";

const GREEN = "#0f7a43", AMBER = "#8a5a09", RED = "#c02636";
const ON = { borderColor: "#1d3a8f", background: "#eef4fd", color: "#1d3a8f" };
const OFF = { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" };
const todayIso = () => { const t = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`; };
const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();

// The ROSTERED shift (what they're meant to be working) comes from the rota the
// manager builds, not the clock record — a clock-in time answers "when did they
// arrive", which isn't the same question.
const ROTA_KEY = "aos.rota.v5";
type RotaShift = { staffId: string | null; date: string; start: string; end: string; role?: string };
function rosterToday(day: string): Record<string, { start: string; end: string; role?: string }> {
  try {
    const s = JSON.parse(localStorage.getItem(ROTA_KEY) || "null") as { staff?: { id: string; name: string }[]; shifts?: RotaShift[] } | null;
    const nameById = new Map((s?.staff ?? []).map((x) => [x.id, norm(x.name)]));
    const out: Record<string, { start: string; end: string; role?: string }> = {};
    for (const sh of s?.shifts ?? []) {
      if (sh.date !== day || !sh.staffId) continue;
      const n = nameById.get(sh.staffId);
      if (n) out[n] = { start: sh.start, end: sh.end, role: sh.role };
    }
    return out;
  } catch { return {}; }
}

interface RegAttendee { ref: string; children: { name: string }[]; attendance: { status?: "in" | "absent"; collectedAt?: string } | null }
interface RegSession {
  blockId: string; start: string; end: string; blockName: string; listingId: string; listingName: string;
  attendees: RegAttendee[];
  counts: { expected: number; present: number; notArrived: number; absent: number; collected: number };
}

// ── little visual building blocks (borrowed from the leave planner's language:
//    rings, segmented bars, gradient tiles — a picture beats a sentence) ──────
function Ring({ pct, size = 60, stroke = 7, color = GREEN }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e6ebf3" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-[13px] font-extrabold tabular-nums" style={{ color }}>{pct}%</div>
    </div>
  );
}
// A stacked bar — green (in) / amber (not arrived) / red (absent) — the diagram
// that replaces the old "8 of 12 · 2 not arrived · 2 absent" text line.
function SegBar({ segs, h = 10 }: { segs: { value: number; color: string }[]; h?: number }) {
  const total = Math.max(1, segs.reduce((s, x) => s + x.value, 0));
  return (
    <div className="flex overflow-hidden rounded-full bg-[#eef1f6]" style={{ height: h }}>
      {segs.map((s, i) => s.value > 0 ? <div key={i} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} title={`${s.value}`} /> : null)}
    </div>
  );
}
function LegendDot({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: color }} /><span className="font-bold" style={{ color }}>{children}</span></span>;
}
function Avatar({ name, tone, sm }: { name: string; tone: string; sm?: boolean }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return <span className={`grid flex-none place-items-center rounded-full font-extrabold text-white ring-2 ring-white ${sm ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-[11px]"}`} style={{ background: tone }} title={name}>{initials}</span>;
}
const staffTone = (s: ClockRecord) => (s.status === "break" ? "#f59e0b" : s.status === "in" ? "#12b76a" : "#cbd5e1");

export function OnSiteNowCard() {
  const [regs, setRegs] = useState<RegSession[] | null>(null);
  const [clock, setClock] = useState<Record<string, ClockRecord>>({});
  const [venueOf, setVenueOf] = useState<Record<string, string>>({});
  const [roster, setRoster] = useState<Record<string, { start: string; end: string; role?: string }>>({});
  const today = todayIso();

  useEffect(() => {
    apiGet<RegSession[]>(`/api/registers?date=${today}`).then((r) => setRegs(r ?? [])).catch(() => setRegs([]));
    Promise.all([
      apiGet<{ id: string; venueId?: string | null }[]>("/api/listings?mine=1"),
      apiGet<{ venues?: { id: string; name: string }[] } | null>("/api/library").catch(() => null),
    ]).then(([ls, lib]) => {
      const name = new Map((lib?.venues ?? []).map((v) => [v.id, v.name]));
      setVenueOf(Object.fromEntries((ls ?? []).flatMap((l) => {
        const n = l.venueId ? name.get(l.venueId) : undefined;
        return n ? [[l.id, n] as [string, string]] : [];
      })));
    }).catch(() => {});
    setClock(loadClock());
    setRoster(rosterToday(today));
    const t = setInterval(() => { setClock(loadClock()); setRoster(rosterToday(today)); }, 30000);
    return () => clearInterval(t);
  }, [today]);

  const staff = useMemo(() => Object.values(clock), [clock]);
  // Listing rows, each with its sessions and the staff at that listing's venue.
  const rows = useMemo(() => {
    const byListing = new Map<string, RegSession[]>();
    for (const s of regs ?? []) (byListing.get(s.listingId) ?? byListing.set(s.listingId, []).get(s.listingId)!).push(s);
    const claimed = new Set<string>();
    const out = [...byListing.entries()].map(([id, ss]) => {
      const venue = venueOf[id];
      // Case/space-insensitive: venues are typed by hand in the library ("milton
      // KEYNES") while clock records carry their own casing ("Milton Keynes"),
      // and an exact match silently dropped every staff member to "unassigned".
      const key = norm(venue);
      const mine = key ? staff.filter((r) => norm(r.op) === key) : [];
      mine.forEach((r) => claimed.add(r.id));
      const expected = ss.reduce((n, s) => n + s.counts.expected, 0);
      const present = ss.reduce((n, s) => n + s.counts.present, 0);
      const absent = ss.reduce((n, s) => n + s.counts.absent, 0);
      const notIn = ss.flatMap((s) => s.attendees
        .filter((a) => a.attendance?.status !== "in" && a.attendance?.status !== "absent")
        .map((a) => a.children[0]?.name ?? "—"));
      return { id, name: ss[0].listingName, venue, sessions: ss.slice().sort((a, b) => a.start.localeCompare(b.start)), expected, present, absent, notIn, staff: mine };
    }).sort((a, b) => a.name.localeCompare(b.name));
    const rest = staff.filter((r) => !claimed.has(r.id) && (r.status === "in" || r.status === "break"));
    return { out, rest };
  }, [regs, staff, venueOf]);

  // One listing at a time — there is no "all" view. Defaults to the first
  // listing once the register loads, and re-homes if that listing disappears.
  const [tab, setTab] = useState("");
  useEffect(() => {
    if (rows.out.length && !rows.out.some((r) => r.id === tab)) setTab(rows.out[0].id);
  }, [rows.out, tab]);
  const shown = rows.out.filter((r) => r.id === tab);
  // Staff counts follow the tab too: on a listing, only that listing's staff.
  const staffScope = shown.flatMap((r) => r.staff);
  const staffIn = staffScope.filter((r) => r.status === "in").length;
  const staffBreak = staffScope.filter((r) => r.status === "break").length;

  // Staff read as pills with initials — deliberately unlike the children's
  // plain name chips above, so the two can't be confused at a glance.
  const StaffDot = ({ r }: { r: ClockRecord }) => {
    const tone = r.status === "break" ? "#f59e0b" : r.status === "in" ? "#12b76a" : "#cbd5e1";
    const initials = r.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    // The ROSTERED shift they're meant to be working — falls back to their
    // actual clocked window only when there's no rota entry for them today.
    const ros = roster[norm(r.name)];
    const shift = ros ? `${ros.start}–${ros.end}` : r.clockInAt ? `${hhmm(r.clockInAt)}–${hhmm(r.clockOutAt) || "?"}` : "";
    const role = r.role || ros?.role;
    // On site / off site, stated plainly rather than implied by a timestamp.
    const here = r.status === "in" || r.status === "break";
    const state = r.status === "break" ? "On break" : r.status === "in" ? "On site" : r.clockInAt ? "Left" : "Not on site";
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-[12px] ring-1 ring-[var(--line)]">
        <span className="grid h-5 w-5 flex-none place-items-center rounded-full text-[9px] font-extrabold text-white" style={{ background: tone }}>{initials}</span>
        <span className={here ? "font-bold text-[var(--ink)]" : "text-[var(--ink-3)]"}>{r.name}</span>
        {role && <span className="text-[11.5px] font-semibold text-[var(--ink-2)]">· {role}</span>}
        {shift && <span className="text-[11.5px] tabular-nums text-[var(--ink-3)]">{shift}</span>}
        <span className="rounded-md px-1.5 py-0.5 text-[10.5px] font-extrabold" style={here ? { background: r.status === "break" ? "#fff4e5" : "#e2f5ea", color: r.status === "break" ? "#b45309" : GREEN } : { background: "#eef1f6", color: "#64748b" }}>{state}</span>
        {/* !! matters: lateMin is 0 for an on-time staffer, and `false || 0`
            renders a literal "0" next to their name. */}
        {!!r.lateMin && <span className="text-[10.5px] font-extrabold" style={{ color: RED }}>{r.lateMin} min late</span>}
      </span>
    );
  };

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#12b76a] opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#12b76a]" /></span>
        <div className="text-[14px] font-extrabold text-[var(--ink)]">On site now</div>
        <span className="text-[11px] font-semibold text-[var(--ink-3)]">· updates live</span>
        <a href="timesheets" className="ml-auto text-[11.5px] font-bold text-[#1d3a8f] hover:underline">Timesheets →</a>
      </div>

      {/* Listing tabs — each carries its own in/expected badge, so you can see
          at a glance which site needs a look before you even open it. */}
      {rows.out.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {rows.out.map((r) => {
            const on = tab === r.id;
            return (
              <button key={r.id} type="button" onClick={() => setTab(r.id)} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold" style={on ? ON : OFF}>
                <span className="max-w-[160px] truncate">{r.name}</span>
                <span className="rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums" style={on ? { background: "#1d3a8f", color: "#fff" } : { background: "#eef1f6", color: "#64748b" }}>{r.present}/{r.expected}</span>
              </button>
            );
          })}
        </div>
      )}

      {regs === null ? <div className="py-8 text-center text-[12px] text-[var(--ink-3)]">Loading today…</div>
        : rows.out.length === 0 ? <div className="py-8 text-center text-[12px] text-[var(--ink-3)]">Nothing running today.</div> : (
        <div className="space-y-3">
          {shown.map((r) => {
            const notArr = Math.max(0, r.notIn.length);
            const inPct = r.expected ? Math.round((r.present / r.expected) * 100) : 0;
            return (
              <div key={r.id} className="overflow-hidden rounded-2xl border border-[#dbe6fb] shadow-[0_2px_12px_-6px_rgba(29,58,143,.3)]">
                {/* header band — gradient, like the leave planner's tiles */}
                <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ background: "linear-gradient(120deg,#16306e,#274ba3)" }}>
                  <span className="text-[15px] font-extrabold text-white">{r.name}</span>
                  {r.venue
                    ? <span className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/20">📍 {r.venue}</span>
                    : <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/70">No venue set</span>}
                  <span className="ml-auto text-[13px] font-extrabold tabular-nums text-white">{r.present}/{r.expected} in{r.absent ? ` · ${r.absent} absent` : ""}</span>
                </div>

                {/* ── visual summary: completion ring + segmented bar + staff avatars ── */}
                <div className="grid gap-4 border-b border-[#eef1f6] bg-white px-4 py-4 sm:grid-cols-[1fr_auto]">
                  <div className="flex items-center gap-4">
                    <Ring pct={inPct} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[22px] font-extrabold tabular-nums text-[var(--ink)]">{r.present}<span className="text-[var(--ink-3)]">/{r.expected}</span></span>
                        <span className="text-[12px] font-bold text-[var(--ink-3)]">children in</span>
                      </div>
                      <div className="mt-2"><SegBar segs={[{ value: r.present, color: GREEN }, { value: notArr, color: AMBER }, { value: r.absent, color: RED }]} /></div>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px]">
                        <LegendDot color={GREEN}>{r.present} in</LegendDot>
                        <LegendDot color={AMBER}>{notArr} not arrived</LegendDot>
                        <LegendDot color={RED}>{r.absent} absent</LegendDot>
                      </div>
                    </div>
                  </div>
                  <div className="sm:min-w-[150px] sm:border-l sm:border-[#eef1f6] sm:pl-4">
                    <div className="text-[10.5px] font-extrabold uppercase tracking-[0.09em] text-[var(--ink-3)]">Staff on site</div>
                    <div className="text-[22px] font-extrabold tabular-nums text-[#1d3a8f]">{staffIn}{staffBreak ? <span className="text-[13px] font-bold text-[#b45309]"> +{staffBreak} on break</span> : ""}</div>
                    {r.staff.length > 0
                      ? <div className="mt-1.5 flex flex-wrap items-center pl-1.5">{r.staff.map((s) => <span key={s.id} className="-ml-1.5"><Avatar name={s.name} tone={staffTone(s)} sm /></span>)}</div>
                      : <div className="mt-1 text-[11px] text-[var(--ink-3)]">{r.venue ? "None clocked in here" : "No venue → can’t match staff"}</div>}
                  </div>
                </div>

                {/* per-session mini bars */}
                <div className="bg-white px-4 py-3">
                  <div className="mb-2"><span className="rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.09em]" style={{ background: "#e2f5ea", color: GREEN }}>🧒 By session</span></div>
                  <div className="flex flex-col gap-2">
                    {r.sessions.map((s) => {
                      const na = Math.max(0, s.counts.notArrived ?? (s.counts.expected - s.counts.present - s.counts.absent));
                      return (
                        <div key={s.blockId} className="flex items-center gap-3">
                          <span className="w-[104px] flex-none rounded-md bg-[var(--panel)] px-2 py-1 text-center text-[11.5px] font-bold tabular-nums text-[var(--ink-2)] ring-1 ring-[var(--line)]">{s.start}–{s.end}</span>
                          <div className="min-w-0 flex-1"><SegBar h={8} segs={[{ value: s.counts.present, color: GREEN }, { value: na, color: AMBER }, { value: s.counts.absent, color: RED }]} /></div>
                          <span className="w-[118px] flex-none whitespace-nowrap text-right text-[11.5px] font-semibold tabular-nums text-[var(--ink-2)]"><b style={{ color: GREEN }}>{s.counts.present}</b>/{s.counts.expected} in{s.counts.absent ? ` · ${s.counts.absent} abs` : ""}</span>
                        </div>
                      );
                    })}
                  </div>
                  {r.notIn.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11.5px] font-extrabold" style={{ color: AMBER }}>⏳ Not signed in:</span>
                      {r.notIn.map((n, i) => (
                        <span key={`${n}-${i}`} className="rounded-md px-2 py-0.5 text-[12px] font-bold" style={{ background: "#fff4e5", color: AMBER, boxShadow: "inset 0 0 0 1px #f5d9a8" }}>{n}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* staff band — full detail (role · shift · status · late) */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-[var(--line)] bg-[var(--panel)] px-4 py-3">
                  <span className="rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.09em]" style={{ background: "#e7f0ff", color: "#1d3a8f" }}>👤 Staff</span>
                  {r.staff.length === 0
                    ? <span className="text-[12px] text-[var(--ink-3)]">{r.venue ? "None clocked in here" : "No venue set — staff can’t be matched to this listing"}</span>
                    : r.staff.map((s) => <StaffDot key={s.id} r={s} />)}
                </div>
              </div>
            );
          })}
          {rows.rest.length > 0 && (
            <div className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-3">
              <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">Elsewhere / unassigned</div>
              <div className="flex flex-wrap gap-1.5">{rows.rest.map((s) => <StaffDot key={s.id} r={s} />)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
