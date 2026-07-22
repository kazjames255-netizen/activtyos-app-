"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { api, get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button, Card } from "@/components/ui";
import { OperatorPage } from "@/components/OperatorPage";
import { HowItWorks } from "@/components/HowItWorks";
import { useSettings, groupForAge, DEFAULT_RATIO_GROUPS, type RatioGroup } from "@/lib/settings";
import type { ServerListing } from "@/features/listings/ListingWizard";

// The account holder auto-seeded onto the team keeps a stable id, so the "· you"
// marker survives edits and it's never seeded twice.
const HOLDER_ID = "account-holder";

// ─────────────────────────────────────────────────────────────────────────
// Ratios & groups — built to the manual.
//
// The provider's standing GROUPS (Cubs, Explorers…) are the unit. They carry
// a colour, an age range, a target ratio and a max size, live in tenant
// settings, and the whole board flows from them — edit a target and every
// card follows. Children come from the day's bookings (server) and fall into
// a group by age. The operator assigns staff and can drag a child across.
//
// The group CONFIG persists (settings). Staff assignment and drag overrides
// are per-view for now — a persisted per-day board needs a backend store
// (handoff §R). The counts are always real.
// ─────────────────────────────────────────────────────────────────────────

interface SessionChild {
  ref: string;
  childId: string | null;
  name: string;
  age: number;
  send: boolean;
  allergies: boolean;
  /** The child's own arrival→departure window (from their booked timing/period).
   *  Backend still to populate (handoff §V); until then we fall back to the
   *  camp session window, so every child looks like they're in for the day. */
  start?: string;
  end?: string;
}
// A child placed for the day, carrying the window they're actually on site for.
type PlacedChild = SessionChild & { ws: string; we: string };
interface RatioSession {
  blockId: string;
  date: string;
  start: string;
  end: string;
  blockName: string;
  listingName: string;
  children: SessionChild[];
  totalChildren: number;
  sendCount: number;
}
// Shift hours aren't kept for a freelancer (kept simple) — the Company build
// will pull roles and hours from its Schedule area instead.
interface StaffMember { id: string; first: string; last: string; role?: string; photo?: string }

// Staff avatar — their photo if we have one, else initials in a soft circle.
function StaffAvatar({ m, size = 30 }: { m: StaffMember; size?: number }) {
  const initials = `${m.first?.[0] ?? ""}${m.last?.[0] ?? ""}`.toUpperCase() || "?";
  if (m.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={m.photo} alt="" className="flex-none rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div className="flex flex-none items-center justify-center rounded-full font-extrabold text-[var(--brand-strong)]"
      style={{ width: size, height: size, fontSize: size * 0.38, background: "var(--brand-soft,#eaf0fc)" }}>
      {initials}
    </div>
  );
}

const todayIso = () => {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
};
const shiftDay = (iso: string, by: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
};
const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const compactDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

/** Staff for one line: ceil(children / ratio), matching the manual's board. */
const staffForLine = (children: number, ratio: number) => (children > 0 ? Math.ceil(children / Math.max(1, ratio)) : 0);
// Colours for the synthesized "by time" cards (age cards use their own colour).
const TIME_CARD_COLOURS = ["#2f6bd8", "#0f9488", "#7a5af8", "#e0692a", "#d6336c", "#0ea5e9"];
const ageRange = (g: RatioGroup) => `${g.ageFrom}-${g.ageTo} yrs`;
/** "1:8" for a round ratio, "1:8.5" only when there's actually a fraction. */
const fmtRatio = (n: number) => `1:${Number.isInteger(n) ? n : n.toFixed(1)}`;
/** "09:00" -> "9am", "15:30" -> "3:30pm" for the time-period buttons. */
const to12h = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  const ap = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${ap}` : `${h12}${ap}`;
};

// Simple line icons for the status tiles — cleaner than emoji, one colour,
// inherit white on the coloured square.
const ICONS: Record<string, React.ReactNode> = {
  children: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3" /><path d="M2 20a7 7 0 0 1 14 0" /><path d="M16 3.5a3 3 0 0 1 0 7M22 20a7 7 0 0 0-5-6.7" />
    </svg>
  ),
  staff: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.2" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /><path d="m9.5 4 2.5-2 2.5 2" />
    </svg>
  ),
  groups: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  ),
};

const EYFS_3TO5_QT = 13;

// ────────────────────────────────────────────────────────────────────────
// Ratio policy table — editable, persists to settings.
// ────────────────────────────────────────────────────────────────────────
// Read-only view of the tenant's ratio groups. These are the ONE master record,
// edited only in Setup → Age groups & rooms; the board here just reads them so
// there's no second place that could contradict Setup.
function PolicyTable({ groups }: { groups: RatioGroup[] }) {
  return (
    <details className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--surface)]" open>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-[12.5px] font-bold text-[var(--brand-ink,#1d3a8f)] [&::-webkit-details-marker]:hidden">
        <span className="inline-block transition-transform group-open:rotate-90">▸</span>
        Your ratio policy <span className="font-normal text-[var(--ink-3)]">— set in Setup → Age groups &amp; rooms; shown here for reference</span>
      </summary>
      <div className="overflow-x-auto px-3.5 pb-3.5">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-[0.04em] text-[var(--ink-3)]">
              <th className="px-2 py-1.5 text-left font-extrabold">Colour</th>
              <th className="px-2 py-1.5 text-left font-extrabold">Group</th>
              <th className="px-2 py-1.5 text-left font-extrabold">Age</th>
              <th className="px-2 py-1.5 text-left font-extrabold">Target ratio</th>
              <th className="px-2 py-1.5 text-left font-extrabold">Room size</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id} className="border-t border-[var(--line)]">
                <td className="px-2 py-1.5"><span className="inline-block h-5 w-8 rounded" style={{ background: g.colour }} aria-label={`${g.name} colour`} /></td>
                <td className="px-2 py-1.5 font-bold">{g.name}</td>
                <td className="px-2 py-1.5 text-[var(--ink-2)]">{g.ageFrom}–{g.ageTo} yrs</td>
                <td className="px-2 py-1.5 text-[var(--ink-2)]">1:{g.targetRatio}</td>
                <td className="px-2 py-1.5 text-[var(--ink-2)]">{g.maxSize > 0 ? g.maxSize : <span className="text-[var(--ink-3)]">no cap</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 text-[11px] leading-[1.5] text-[var(--ink-3)]">
          Colours, names, age bands, ratios and room sizes are your one master record — change them in
          <b> Setup → Age groups &amp; rooms</b> and every board here and every listing updates at once.
        </div>
      </div>
    </details>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Cover-by-group board — coloured group cards for the day.
// ────────────────────────────────────────────────────────────────────────
// Your team — add/remove staff here, saved to the same library list the
// listing builder's Step 9 uses. Gives freelancers (who have no standalone
// team screen) a place to manage staff, and it flows everywhere.
function TeamManager({ staff, onChange, holderId }: { staff: StaffMember[]; onChange: (s: StaffMember[]) => void; holderId?: string }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const add = () => {
    const t = name.trim();
    if (!t) return;
    const [first, ...rest] = t.split(" ");
    const entry = { first, last: rest.join(" "), ...(role.trim() ? { role: role.trim() } : {}) };
    onChange(editId
      ? staff.map((x) => (x.id === editId ? { ...x, ...entry } : x))
      : [...staff, { id: uid(), ...entry }]);
    setName(""); setRole(""); setEditId(null);
  };
  const edit = (m: StaffMember) => { setEditId(m.id); setName(`${m.first} ${m.last}`.trim()); setRole(m.role ?? ""); };
  return (
    <details className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--surface)]" open>
      <summary className="cursor-pointer list-none px-3.5 py-2.5 text-[12.5px] font-bold text-[var(--brand-ink,#1d3a8f)] [&::-webkit-details-marker]:hidden">
        🧑‍🏫 Your team <span className="font-normal text-[var(--ink-3)]">— {staff.length ? `${staff.length} to assign` : "add staff to assign them below"} · shared with your listings&rsquo; Staff step</span>
      </summary>
      <div className="px-3.5 pb-3.5">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {staff.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel)] py-1 pl-1.5 pr-1.5 text-[12px] font-semibold">
              <StaffAvatar m={m} size={20} />
              <span className="leading-tight">
                {`${m.first} ${m.last}`.trim() || "Staff"}
                <span className="ml-1 font-normal text-[var(--ink-3)]">{m.role ? `· ${m.role}` : ""}{m.id === holderId ? " · you" : ""}</span>
              </span>
              <button type="button" aria-label={`Edit ${m.first}`} onClick={() => edit(m)} className="px-1 text-[var(--ink-3)] hover:text-[var(--brand-ink,#1d3a8f)]" title="Edit">✎</button>
              <button type="button" aria-label={`Remove ${m.first}`} onClick={() => onChange(staff.filter((x) => x.id !== m.id))} className="px-1 text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]">✕</button>
            </span>
          ))}
          {staff.length === 0 && <span className="text-[12px] text-[var(--ink-3)]">No staff yet — add yourself and any helpers.</span>}
        </div>
        <div className="flex flex-wrap items-end gap-1.5">
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Name — e.g. Alex Rivera"
            className="w-[200px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px]" />
          <input value={role} onChange={(e) => setRole(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Role — e.g. Coach (optional)"
            className="w-[180px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px]" />
          <Button sm variant="primary" onClick={add}>{editId ? "Save" : "＋ Add"}</Button>
          {editId && <Button sm onClick={() => { setEditId(null); setName(""); setRole(""); }}>Cancel</Button>}
        </div>
      </div>
    </details>
  );
}

function CoverBoard({ date, isToday, dayChildren, groups, staff, onDay, onCover }: {
  date: string; isToday: boolean; dayChildren: PlacedChild[]; groups: RatioGroup[]; staff: StaffMember[];
  onDay: (by: number) => void;
  onCover?: (c: { onDuty: number; needed: number; within: boolean }) => void;
}) {
  // Child → group. Default is by age; a manual drag overrides it (this view
  // only — persisting the board needs a backend store, §R).
  const [override, setOverride] = useState<Record<string, string>>({});
  const [groupStaff, setGroupStaff] = useState<Record<string, string[]>>({});
  const [dragRef, setDragRef] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  // Flick between grouping by age band and grouping by the hours children are in.
  const [mode, setMode] = useState<"age" | "time">("age");

  // In time mode the cards are the distinct arrival→departure windows,
  // synthesized as pseudo-groups so the card render is shared with age mode.
  const timeGroups = useMemo<RatioGroup[]>(() => {
    const wins = new Map<string, { ws: string; we: string }>();
    for (const c of dayChildren) { const k = `${c.ws}|${c.we}`; if (!wins.has(k)) wins.set(k, { ws: c.ws, we: c.we }); }
    return [...wins.values()]
      .sort((a, b) => a.ws.localeCompare(b.ws) || a.we.localeCompare(b.we))
      .map((w, i) => ({ id: `${w.ws}|${w.we}`, name: `${to12h(w.ws)}–${to12h(w.we)}`, colour: TIME_CARD_COLOURS[i % TIME_CARD_COLOURS.length], ageFrom: 0, ageTo: 99, targetRatio: 0, maxSize: 0 }));
  }, [dayChildren]);
  const displayGroups = mode === "age" ? groups : timeGroups;

  const groupOf = (c: PlacedChild) => mode === "time"
    ? `${c.ws}|${c.we}`
    : override[c.childId ?? c.ref] ?? groupForAge(groups, c.age)?.id ?? "__unplaced";
  const inGroup = (gid: string) => dayChildren.filter((c) => groupOf(c) === gid);
  // Staff needed for a mixed-age set on ONE timing (the by-time view).
  //
  // Unlike the age view — where each group is a separate room and so is floored
  // to its own adult — a time window is just "who's on site now". One adult can
  // watch across age bands here, so we add up each band's fractional load
  // (children ÷ its target) and round up once, rather than rounding up per band.
  // Two children in two bands is a load of ~0.2 → 1 adult, not 1 + 1 = 2.
  const needFor = (kids: PlacedChild[]) => {
    if (kids.length === 0) return 0;
    const byGroup = new Map<string, number>();
    for (const c of kids) { const gid = groupForAge(groups, c.age)?.id ?? "__u"; byGroup.set(gid, (byGroup.get(gid) ?? 0) + 1); }
    let load = 0;
    for (const [gid, count] of byGroup) load += count / Math.max(1, groups.find((x) => x.id === gid)?.targetRatio ?? 8);
    return Math.max(1, Math.ceil(load));
  };
  const setStaffFor = (gid: string, sid: string) =>
    setGroupStaff((m) => ({ ...m, [gid]: (m[gid] ?? []).includes(sid) ? (m[gid] ?? []).filter((x) => x !== sid) : [...(m[gid] ?? []), sid] }));
  const drop = (gid: string) => { if (dragRef) setOverride((o) => ({ ...o, [dragRef]: gid })); setDragRef(null); setDragOver(null); };

  const totalChildren = dayChildren.length;
  const staffOnDuty = new Set(Object.values(groupStaff).flat()).size;
  // One adult can't supervise two rooms at once. We allow assigning the same
  // person to more than one group (sometimes you're planning cover and haven't
  // decided), but it's flagged: their coverage in each group is double-counted,
  // so a "met" that leans on a double-booked adult isn't really met.
  const staffGroupCount = Object.values(groupStaff).flat().reduce<Record<string, number>>((m, sid) => { m[sid] = (m[sid] ?? 0) + 1; return m; }, {});
  const doubleBooked = staff.filter((m) => (staffGroupCount[m.id] ?? 0) > 1);
  // Children sitting in an AGE group outside their band — only by a manual drag,
  // and only meaningful in age mode. Allowed but flagged.
  const misplaced = mode === "age"
    ? groups.flatMap((g) => inGroup(g.id).filter((c) => c.age < g.ageFrom || c.age > g.ageTo).map((c) => ({ name: c.name, age: c.age, group: g.name })))
    : [];
  // Staff needed across the board. Age mode uses each card's own ratio; time
  // mode sums each window's mixed-age need.
  const staffNeeded = mode === "time"
    ? displayGroups.reduce((n, g) => n + needFor(inGroup(g.id)), 0)
    : groups.reduce((n, g) => n + staffForLine(inGroup(g.id).length, g.targetRatio), 0) + staffForLine(inGroup("__unplaced").length, 8);
  const within = staffOnDuty >= staffNeeded;
  const unplaced = inGroup("__unplaced");
  // Total room capacity across the groups (blank max = uncapped). Whether the
  // day's children fit the rooms — separate from staffing, and from the
  // listing's booking cap which limits intake before it ever gets here.
  const capped = groups.filter((g) => g.maxSize > 0);
  const totalCapacity = capped.reduce((n, g) => n + g.maxSize, 0);
  const overGroups = groups.filter((g) => g.maxSize > 0 && inGroup(g.id).length > g.maxSize);

  // Bubble live staffing up so the page's "Staff on duty" tile reflects the board.
  useEffect(() => { onCover?.({ onDuty: staffOnDuty, needed: staffNeeded, within }); }, [staffOnDuty, staffNeeded, within, onCover]);

  const Chip = ({ c, colour, onRemove, misfit }: { c: PlacedChild; colour?: string; onRemove?: () => void; misfit?: string }) => (
    <span
      draggable={mode === "age"}
      onDragStart={mode === "age" ? () => setDragRef(c.childId ?? c.ref) : undefined}
      title={misfit}
      className={`inline-flex items-center gap-1 rounded-full border py-[3px] pl-2.5 pr-1.5 text-[11.5px] font-bold ${mode === "age" ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={misfit
        ? { borderColor: "#e21d27", boxShadow: "0 0 0 1.5px #e21d27", background: "#fdebec", color: "#c0392b" }
        : { borderColor: colour ? `${colour}66` : "var(--line)", background: colour ? `${colour}12` : "var(--surface)", color: colour ?? "var(--ink)" }}
    >
      {c.name}
      {/* The child's hours on site — from their booked timing (block window until §V). */}
      <span className="rounded px-1 text-[9px] font-bold" style={{ background: colour ? `${colour}1f` : "var(--panel)", color: colour ?? "var(--ink-3)" }}>{to12h(c.ws)}–{to12h(c.we)}</span>
      {/* Age, so staff can sanity-check the grouping at a glance. */}
      {!misfit && <span className="text-[9.5px] font-semibold opacity-70">aged {c.age}</span>}
      {misfit && <span className="rounded px-1 text-[9px] font-extrabold" style={{ background: "#f6c9cc" }}>⚠ aged {c.age}</span>}
      {c.send && <span className="rounded px-1 text-[9px]" style={{ background: colour ? `${colour}22` : "var(--brand-soft)" }}>SEND</span>}
      {c.allergies && <span title="Allergy on file">⚠</span>}
      {onRemove && <button type="button" onClick={onRemove} aria-label={`Remove ${c.name}`} className="text-[13px] leading-none opacity-60">×</button>}
    </span>
  );

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-extrabold" style={{ color: "var(--brand-ink,#1d3a8f)" }}>{mode === "age" ? "Cover by age group" : "Cover by time"}</div>
        {/* Flick between grouping by age band and by the hours children are in. */}
        <div className="inline-flex rounded-full border border-[var(--line)] bg-[var(--panel)] p-0.5 text-[12px] font-bold">
          {(["age", "time"] as const).map((mo) => (
            <button key={mo} type="button" onClick={() => setMode(mo)}
              className="rounded-full px-3.5 py-1 transition-colors"
              style={mode === mo ? { background: "var(--brand-2,#2f6bd8)", color: "#fff" } : { color: "var(--ink-2)" }}>
              {mo === "age" ? "By age group" : "By time"}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-2 text-[11px] text-[var(--ink-3)]">{mode === "age"
        ? <><b>Target</b> is the ratio you&rsquo;re aiming for; <b>Live</b> is children ÷ staff assigned. Drag a child to move them.</>
        : <>Cards are the <b>hours children are in</b>. Assign staff to each window so every timing is covered.</>}</p>

      <div className="overflow-hidden rounded-2xl border border-[var(--line)]">
        {/* Board header bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" style={{ background: "linear-gradient(120deg,#1d3a8f,#2f6bd8)", color: "#fff" }}>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onDay(-1)} aria-label="Previous day" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-[16px]">‹</button>
            <div>
              <div className="text-[15px] font-extrabold leading-none">{isToday ? "Today" : shortDay(date)}</div>
              {isToday && <div className="text-[11.5px] opacity-85">{shortDay(date)}</div>}
            </div>
            <button type="button" onClick={() => onDay(1)} aria-label="Next day" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-[16px]">›</button>
          </div>
          <div className="flex items-center gap-4" style={{ fontVariantNumeric: "tabular-nums" }}>
            <div className="text-center leading-none">
              <div className="text-[18px] font-extrabold">{totalChildren}</div>
              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.06em] opacity-80">children</div>
            </div>
            {totalCapacity > 0 && (
              <div className="text-center leading-none" title={`Room capacity across your groups — ${capped.length} of ${groups.length} groups have a room size`}>
                <div className="text-[18px] font-extrabold" style={overGroups.length ? { color: "#ffd3d3" } : undefined}>{totalChildren}<span className="text-[12px] opacity-70">/{totalCapacity}</span></div>
                <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.06em] opacity-80">room space</div>
              </div>
            )}
            <div className="h-9 w-px bg-white/20" />
            <div className="text-center leading-none">
              <div className="text-[18px] font-extrabold">{staffNeeded}</div>
              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.06em] opacity-80">staff needed</div>
            </div>
            <div className="text-center leading-none">
              <div className="text-[18px] font-extrabold">{staffOnDuty}</div>
              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.06em] opacity-80">on duty</div>
            </div>
            <span className="rounded-full px-3 py-1.5 text-[11px] font-extrabold" title={within ? undefined : `You've assigned ${staffOnDuty}, this session/day needs ${staffNeeded} — one adult per occupied group.`} style={within ? { background: "rgba(255,255,255,.22)" } : { background: "#fee2e2", color: "#c0392b" }}>
              {within ? "✓ WITHIN TARGET" : `NEEDS ${staffNeeded - staffOnDuty} MORE STAFF ON THIS DAY`}
            </span>
          </div>
        </div>

        {/* Same adult in more than one group — allowed, but they can't be in
            two rooms at once, so say so plainly. */}
        {doubleBooked.length > 0 && (
          <div className="flex items-start gap-2 border-b border-[#f6c9cc] bg-[#fdebec] px-4 py-2 text-[11.5px] leading-[1.45] text-[#c0392b]">
            <span className="text-[13px]">⚠</span>
            <span>
              <b>{doubleBooked.map((m) => `${m.first} ${m.last}`.trim() || "Staff").join(", ")}</b>{" "}
              {doubleBooked.length === 1 ? "is" : "are"} assigned to more than one group. One adult can&rsquo;t cover two rooms at once —
              any group leaning on them isn&rsquo;t really staffed. Assign someone else, or move them to a single group.
            </span>
          </div>
        )}

        {/* Children moved outside their age group by hand — allowed, flagged. */}
        {misplaced.length > 0 && (
          <div className="flex items-start gap-2 border-b border-[#f6c9cc] bg-[#fdebec] px-4 py-2 text-[11.5px] leading-[1.45] text-[#c0392b]">
            <span className="text-[13px]">⚠</span>
            <span>
              <b>{misplaced.map((m) => `${m.name} (age ${m.age}) in ${m.group}`).join(", ")}</b>{" "}
              {misplaced.length === 1 ? "is" : "are"} outside their age group — moved by hand. Fine if it&rsquo;s deliberate; drag them back if not.
            </span>
          </div>
        )}

        {/* Staff roster down the side + group cards */}
        <div className="flex flex-col gap-3 p-3 lg:flex-row">
          <aside className="lg:w-[240px] lg:flex-none">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">Your team</span>
                <span className="text-[10px] text-[var(--ink-3)]">{staffOnDuty}/{staff.length} on duty</span>
              </div>
              {staff.length === 0 ? (
                <div className="text-[11px] leading-[1.5] text-[var(--ink-3)]">No staff yet — add your team in <b>Your team</b> above.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {staff.map((m) => {
                    const assignedTo = displayGroups.filter((g) => (groupStaff[g.id] ?? []).includes(m.id));
                    const clash = assignedTo.length > 1;
                    return (
                      <div key={m.id} className="rounded-lg border p-2" style={{ borderColor: clash ? "#f0b8b8" : "var(--line)" }}>
                        <div className="flex items-center gap-2">
                          <StaffAvatar m={m} />
                          <div className="min-w-0 flex-1 leading-tight">
                            <div className="truncate text-[12px] font-extrabold">{`${m.first} ${m.last}`.trim() || "Staff"}</div>
                            <div className="truncate text-[10px] text-[var(--ink-3)]">{m.role || "Team member"}{m.id === HOLDER_ID ? " · you" : ""}</div>
                          </div>
                        </div>
                        <select value="" onChange={(e) => { if (e.target.value) setStaffFor(e.target.value, m.id); }}
                          className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--ink-2)]">
                          <option value="">＋ Assign to {mode === "time" ? "time" : "group"}…</option>
                          {displayGroups.filter((g) => !(groupStaff[g.id] ?? []).includes(m.id)).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                        {assignedTo.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            {assignedTo.map((g) => (
                              <span key={g.id}
                                className="inline-flex items-center gap-1 rounded-full py-[2px] pl-2 pr-1 text-[10px] font-bold text-white" style={{ background: g.colour }}>
                                {g.name}
                                <button type="button" onClick={() => setStaffFor(g.id, m.id)} aria-label={`Unassign from ${g.name}`} className="text-[11px] leading-none opacity-80">×</button>
                              </span>
                            ))}
                            {clash && <span title="One adult can't cover two rooms at once" className="text-[10px] font-bold text-[#c0392b]">⚠ 2 rooms</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
          {displayGroups.map((g) => {
            const kids = inGroup(g.id);
            const need = mode === "time" ? needFor(kids) : staffForLine(kids.length, g.targetRatio);
            const have = (groupStaff[g.id] ?? []).length;
            const assignedStaff = staff.filter((m) => (groupStaff[g.id] ?? []).includes(m.id));
            const met = have >= need;
            const over = g.maxSize > 0 && kids.length > g.maxSize;
            const live = have > 0 ? kids.length / have : 0;
            const isOver = dragOver === g.id;
            const dragProps = mode === "age"
              ? { onDragOver: (e: DragEvent) => { e.preventDefault(); setDragOver(g.id); }, onDragLeave: () => setDragOver((o) => (o === g.id ? null : o)), onDrop: () => drop(g.id) }
              : {};
            return (
              <div key={g.id} className="overflow-hidden rounded-xl border-2" style={{ borderColor: isOver ? g.colour : `${g.colour}33` }} {...dragProps}>
                {/* card header tinted to group colour */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2" style={{ background: `${g.colour}14` }}>
                  <div>
                    <div className="text-[15px] font-extrabold" style={{ color: g.colour }}>{mode === "time" ? `🕘 ${g.name}` : g.name}</div>
                    <div className="text-[11.5px] text-[var(--ink-3)]">{mode === "time" ? `${kids.length} ${kids.length === 1 ? "child" : "children"} on this timing` : ageRange(g)}</div>
                  </div>
                  <div className="flex items-center gap-3 text-center">
                    {mode === "age" && (
                      <div>
                        <div className="text-[9.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Target</div>
                        <div className="text-[13px] font-extrabold">1:{g.targetRatio}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-[9.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{mode === "time" ? "Staff" : "Live"}</div>
                      <div className="text-[13px] font-extrabold">{mode === "time" ? need : (live > 0 ? fmtRatio(live) : "—")}</div>
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  {kids.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-1 py-3 text-center">
                      <div className="text-[15px] font-extrabold text-[#0f7a44]">✓ No staff required</div>
                      <div className="text-[11px] text-[var(--ink-3)]">No children in this group today — drag one here to place them.</div>
                    </div>
                  ) : (
                    <>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[11.5px] font-extrabold" style={met ? { background: "#e7f8ee", color: "#0f7a44" } : { background: "#fdebec", color: "#c0392b" }}>
                      {met ? "🙂 In ratio" : `😟 ${need - have} staff short`}
                    </span>
                    {/* Needed vs got, read at a glance. */}
                    <span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--ink-3)]">
                      <b className="text-[13px]" style={{ color: met ? "#0f7a44" : "#c0392b" }}>{have}</b>
                      <span className="opacity-70">of</span>
                      <b className="text-[13px] text-[var(--ink-2)]">{need}</b>
                      <span>needed</span>
                    </span>
                    {over && <span className="rounded-full bg-[#fdebec] px-2 py-[2px] text-[10.5px] font-bold text-[#c0392b]">Over max ({kids.length}/{g.maxSize})</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {kids.map((c) => {
                      const misfit = c.age < g.ageFrom || c.age > g.ageTo
                        ? `Age ${c.age} is outside ${g.name} (${g.ageFrom}–${g.ageTo} yrs) — moved here manually`
                        : undefined;
                      return <Chip key={c.ref} c={c} colour={g.colour} misfit={misfit} onRemove={mode === "age" ? () => setOverride((o) => ({ ...o, [c.childId ?? c.ref]: "__unplaced" })) : undefined} />;
                    })}
                  </div>
                    </>
                  )}
                  {/* Staff assigned here. Shown whenever anyone is assigned — even to a
                      group that needs no cover — so an assignment is never invisible.
                      A group that does need cover also gets the "none yet" nudge. */}
                  {(assignedStaff.length > 0 || kids.length > 0) && (
                    <div className="mt-2.5 border-t border-[var(--line)] pt-2">
                      <div className="mb-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">
                        Staff on this group{kids.length === 0 && assignedStaff.length > 0 ? " · none needed today" : ""}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {assignedStaff.map((m) => {
                          const clash = (staffGroupCount[m.id] ?? 0) > 1;
                          return (
                            <span key={m.id} title={clash ? "Also assigned to another group — one adult can't cover two rooms at once" : undefined}
                              className="inline-flex items-center gap-1 rounded-full py-[3px] pl-1 pr-1 text-[11px] font-bold text-white"
                              style={{ background: g.colour, boxShadow: clash ? "0 0 0 1.5px #c0392b" : undefined }}>
                              <StaffAvatar m={m} size={18} />
                              {`${m.first} ${m.last}`.trim() || "Staff"}
                              {clash && <span aria-label="assigned to more than one group">⚠</span>}
                              <button type="button" onClick={() => setStaffFor(g.id, m.id)} aria-label={`Unassign ${m.first}`} className="text-[12px] leading-none opacity-80">×</button>
                            </span>
                          );
                        })}
                        {assignedStaff.length === 0 && <span className="text-[11px] text-[var(--ink-3)]">None yet — assign from the team panel on the left.</span>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>

        {/* Unplaced */}
        {unplaced.length > 0 && (
          <div className="border-t border-[var(--line)] bg-[var(--panel)] px-3 py-2.5" onDragOver={(e) => { e.preventDefault(); setDragOver("__unplaced"); }} onDrop={() => drop("__unplaced")}>
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[#9a5a00]">Outside every group ({unplaced.length}) — drag into a group, or widen an age range above</div>
            <div className="flex flex-wrap gap-1.5">{unplaced.map((c) => <Chip key={c.ref} c={c} />)}</div>
          </div>
        )}
      </div>

      <p className="mt-2 text-[10.5px] text-[var(--ink-3)]">Staff assignment and drag are per-view for now — the group colours, names, ages, targets and sizes above are saved.</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Staffing ratio calculator.
// ────────────────────────────────────────────────────────────────────────
function NumInput({ value, onChange, label, hint, ratio }: { value: number; onChange: (n: number) => void; label: string; hint?: string; ratio?: string }) {
  return (
    <div className="flex items-center gap-2 border-t border-[var(--line)] py-2 first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold">{label}</div>
        {ratio && <div className="text-[10.5px] text-[var(--ink-3)]">{ratio}</div>}
        {hint && <div className="text-[10.5px] leading-[1.4] text-[var(--ink-3)]">{hint}</div>}
      </div>
      <input type="number" min={0} inputMode="numeric" value={value || ""} placeholder="0" onChange={(e) => onChange(Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-[64px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[13px]" />
    </div>
  );
}

function RatioCalculator({ groups, dayChildren, dateText }: { groups: RatioGroup[]; dayChildren: SessionChild[]; dateText: string }) {
  const [eyfs, setEyfs] = useState<Record<string, number>>({ u2: 0, twos: 0, threeFive: 0 });
  const [qt, setQt] = useState(0);
  const [groupN, setGroupN] = useState<Record<string, number>>({});

  const threeFiveRatio = qt > 0 ? EYFS_3TO5_QT : 8;
  // Per-line ceilings, summed — the manual's maths (24/8=3 · … = 10).
  const lines = [
    { label: "Under 2s · 1:3", n: eyfs.u2, ratio: 3, staff: staffForLine(eyfs.u2, 3) },
    { label: "Two-year-olds · 1:5", n: eyfs.twos, ratio: 5, staff: staffForLine(eyfs.twos, 5) },
    { label: `Three to five · 1:${threeFiveRatio}`, n: eyfs.threeFive, ratio: threeFiveRatio, staff: staffForLine(eyfs.threeFive, threeFiveRatio) },
    ...groups.map((g) => ({ label: `${g.name} ${ageRange(g)} · 1:${g.targetRatio}`, n: groupN[g.id] ?? 0, ratio: g.targetRatio, staff: staffForLine(groupN[g.id] ?? 0, g.targetRatio) })),
  ];
  const totalChildren = lines.reduce((s, l) => s + l.n, 0);
  const totalStaff = lines.reduce((s, l) => s + l.staff, 0);

  const showLive = () => {
    const seen = new Set<string>();
    const e = { u2: 0, twos: 0, threeFive: 0 };
    const gn: Record<string, number> = {};
    for (const c of dayChildren) {
      const key = c.childId ?? c.ref;
      if (seen.has(key)) continue;
      seen.add(key);
      if (c.age < 2) e.u2 += 1;
      else if (c.age === 2) e.twos += 1;
      else if (c.age <= 4) e.threeFive += 1;
      else {
        const g = groupForAge(groups, c.age);
        if (g) gn[g.id] = (gn[g.id] ?? 0) + 1;
      }
    }
    setEyfs(e); setGroupN(gn);
  };
  const liveCount = new Set(dayChildren.map((c) => c.childId ?? c.ref)).size;

  return (
    <details className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <summary className="cursor-pointer list-none px-3.5 py-2.5 text-[12.5px] font-bold text-[var(--brand-ink,#1d3a8f)] [&::-webkit-details-marker]:hidden">
        🧮 Staffing ratio calculator <span className="font-normal text-[var(--ink-3)]">— model any mix, or drop in a live day · EYFS bands + your targets</span>
      </summary>
      <div className="px-3.5 pb-3.5">
        <div className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--brand-ink,#1d3a8f)]">Check {dateText} against the guidance</div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={showLive} disabled={liveCount === 0} className="rounded-lg px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-40" style={{ background: "var(--brand-ink,#1d3a8f)" }}>Drop in {dateText} ({liveCount})</button>
            <span className="text-[11px] text-[var(--ink-3)]">Drops the children booked for {dateText} into the calculator above.</span>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_240px]">
          <div>
            <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Early years — statutory EYFS</div>
            <NumInput label="Under 2 year olds" ratio="1 : 3" value={eyfs.u2} onChange={(n) => setEyfs((x) => ({ ...x, u2: n }))} />
            <NumInput label="2 to under 3 year olds" ratio="1 : 5" value={eyfs.twos} onChange={(n) => setEyfs((x) => ({ ...x, twos: n }))} />
            <NumInput label="3 to 5 year olds (pre-Reception)" ratio={qt > 0 ? "1 : 13" : "1 : 8"} value={eyfs.threeFive} onChange={(n) => setEyfs((x) => ({ ...x, threeFive: n }))} />
            <NumInput label="Qualified teacher / level 6 with the 3–5s" hint="Only count them if they work directly with the 3–5s — each lifts that group toward 1:13." value={qt} onChange={setQt} />
            {groups.length > 0 && (
              <>
                <div className="mb-1 mt-3 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">School age — your targets</div>
                {groups.map((g) => (
                  <NumInput key={g.id} label={`${g.name} (${ageRange(g)})`} value={groupN[g.id] ?? 0} onChange={(n) => setGroupN((x) => ({ ...x, [g.id]: n }))} />
                ))}
              </>
            )}
            <div className="mt-3 rounded-lg bg-[var(--panel)] px-3 py-2 text-[11px] leading-[1.5] text-[var(--ink-2)]">
              <b>Ratios used</b> · 1:3 under 2 · 1:5 two-year-olds · 1:8 three to five · 1:13 three to five with a qualified teacher · then each school-age group at the target you set.
            </div>
            <div className="mt-2 text-[10.5px] leading-[1.5] text-[var(--ink-3)]">
              <b className="text-[var(--ink-2)]">EYFS bands are statutory; school-age targets are your policy.</b> A minimum-staffing guide only — also weigh staff qualifications, breaks, deployment, SEND and tighter activity ratios (e.g. swimming).
            </div>
          </div>
          <div className="self-start rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
            <div className="text-[12.5px] font-extrabold text-[var(--brand-ink,#1d3a8f)]">Minimum staff needed</div>
            <div className="mt-2 flex items-baseline justify-between border-b border-[var(--line)] pb-2">
              <span className="text-[12px] text-[var(--ink-2)]">Total children</span><span className="text-[22px] font-extrabold">{totalChildren}</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-b border-[var(--line)] pb-2">
              <span className="text-[12px] text-[var(--ink-2)]">Total staff needed</span><span className="text-[22px] font-extrabold" style={{ color: "#e2225f" }}>{totalStaff}</span>
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {lines.map((l, i) => (
                <div key={i} className="flex items-baseline justify-between text-[11.5px]">
                  <span className="text-[var(--ink-3)]">{l.label}</span><span className="font-bold">{l.staff}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}

// ────────────────────────────────────────────────────────────────────────
export function RatiosApp() {
  const [date, setDate] = useState(todayIso);
  const [sessions, setSessions] = useState<RatioSession[] | null>(null);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [staffLib, setStaffLib] = useState<StaffMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [listing, setListing] = useState<string>("");
  const [staffLoaded, setStaffLoaded] = useState(false);
  const { settings, loading: settingsLoading } = useSettings();
  const { user } = useAuth();
  const groups = settings.ratioGroups.length ? settings.ratioGroups : DEFAULT_RATIO_GROUPS;

  const refresh = useCallback(() => {
    apiGet<{ sessions: RatioSession[] }>(`/api/ratios?date=${date}`)
      .then((r) => { setSessions(r.sessions); setLoadedDate(date); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load ratios"));
  }, [date]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ staff?: StaffMember[] } | null>("/api/library").then((l) => setStaffLib(l?.staff ?? [])).catch(() => {}).finally(() => setStaffLoaded(true)); }, []);

  // All the operator's LIVE listings for the picker — published, not archived,
  // not hidden (unlisted), and not ended (every dated block already finished).
  // The ratios feed is per-day, so this is the fuller set: you can switch to a
  // live listing even on a day it isn't running (the board just reads empty).
  const [liveListings, setLiveListings] = useState<string[]>([]);
  useEffect(() => {
    apiGet<(ServerListing & { status?: string; archived?: boolean; visibility?: string })[]>("/api/listings?mine=1")
      .then((ls) => {
        const today = todayIso();
        const names = (ls ?? [])
          .filter((l) => (l.status ?? "live") === "live" && !l.archived && (l.visibility ?? "public") !== "hidden")
          .filter((l) => !(l.blocks?.length && l.blocks.every((b) => b.endDate < today)))
          .map((l) => l.name)
          .filter(Boolean);
        setLiveListings([...new Set(names)].sort());
      })
      .catch(() => {});
  }, []);
  useRealtime(["ratioGroups", "bookings", "blocks", "library"], refresh);

  // Add/remove staff writes to the tenant library's `staff` list — the same
  // one the listing builder's Step 9 edits — so a coach added here shows up
  // there too, and vice versa. The library PUT is read-modify-write, so
  // sending only `staff` merges without touching anything else.
  const saveStaff = useCallback((next: StaffMember[]) => {
    setStaffLib(next);
    api("/api/library", { method: "PUT", body: JSON.stringify({ staff: next }) }).catch(() =>
      setError("Couldn’t save your team — try again"),
    );
  }, []);

  // Auto-seed the account holder onto the team the first time they open a fresh
  // roster — their public-facing name from onboarding (settings.providerName),
  // falling back to their sign-in name for tenants that predate that setting.
  // Editable and removable like anyone; seeded once so a deliberate removal
  // sticks.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !staffLoaded || settingsLoading) return;
    seededRef.current = true;
    if (staffLib.length > 0) return;
    const nm = (settings.providerName || user?.displayName || "").trim();
    if (!nm) return;
    const [first, ...rest] = nm.split(" ");
    saveStaff([{ id: HOLDER_ID, first, last: rest.join(" ") }]);
  }, [staffLoaded, settingsLoading, staffLib, settings.providerName, user, saveStaff]);

  const ready = loadedDate === date && sessions;
  // The picker lists every live listing. Fall back to whatever's running today
  // if that fetch hasn't landed (or a tenant has none), so the board still works.
  const sessionListings = useMemo(() => [...new Set((sessions ?? []).map((s) => s.listingName))].sort(), [sessions]);
  const listings = liveListings.length ? liveListings : sessionListings;
  // Children in each camp that day, for the tab badges.
  const listingCounts = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const s of sessions ?? []) {
      const set = m.get(s.listingName) ?? new Set<string>();
      for (const c of s.children) set.add(c.childId ?? c.ref);
      m.set(s.listingName, set);
    }
    return m;
  }, [sessions]);
  // Always sit on a real camp — a whole-site aggregate ratio is meaningless,
  // since each camp has its own groups and staffing. Snap to the first
  // available whenever the current pick isn't running (first load, day change).
  useEffect(() => {
    if (listings.length && !listings.includes(listing)) setListing(listings[0]);
  }, [listings, listing]);
  const shown = useMemo(() => (sessions ?? []).filter((s) => !listing || s.listingName === listing), [sessions, listing]);

  // The whole day's children (deduped), each tagged with the window they're on
  // site for: the child's own timing if the feed carries it, else the camp
  // session window as a fallback.
  const allChildren = useMemo<PlacedChild[]>(() => {
    const seen = new Set<string>(); const out: PlacedChild[] = [];
    for (const s of shown) for (const c of s.children) {
      const k = c.childId ?? c.ref;
      if (!seen.has(k)) { seen.add(k); out.push({ ...c, ws: c.start ?? s.start, we: c.end ?? s.end }); }
    }
    return out;
  }, [shown]);

  // Different timings (full day / mornings / afternoons) mean different children
  // are on site at different times — ratios must hold at each. The distinct
  // arrival→departure windows become "by time" buttons; picking one shows only
  // who overlaps it. "" = whole day (everyone in at some point).
  const [period, setPeriod] = useState<string>("");
  // Live staffing reported up from the cover board, for the "Staff on duty" tile.
  const [cover, setCover] = useState({ onDuty: 0, needed: 0, within: true });
  const periods = useMemo(() => {
    const map = new Map<string, { start: string; end: string; here: number }>();
    for (const c of allChildren) { const k = `${c.ws}|${c.we}`; if (!map.has(k)) map.set(k, { start: c.ws, end: c.we, here: 0 }); }
    for (const p of map.values()) p.here = allChildren.filter((c) => c.ws < p.end && p.start < c.we).length;
    return [...map.values()].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  }, [allChildren]);
  const wholeDayCount = allChildren.length;
  // Guard against a stale key when the day/listing changes.
  const activeKey = periods.some((p) => `${p.start}|${p.end}` === period) ? period : "";
  const children = useMemo(() => {
    if (!activeKey) return allChildren;
    const [ps, pe] = activeKey.split("|");
    return allChildren.filter((c) => c.ws < pe && ps < c.we);
  }, [allChildren, activeKey]);

  const isToday = date === todayIso();
  const groupCount = groups.filter((g) => children.some((c) => c.age >= g.ageFrom && c.age <= g.ageTo)).length;
  const sendCount = children.filter((c) => c.send).length;

  return (
    <OperatorPage
      title="Ratios & groups"
      lede="Set your groups and target ratios, and track live cover as you take registers"
    >
      {/* How ratios work — folded away, with a walkthrough video to come. */}
      <HowItWorks video="How ratios work on this board: setting your own targets, placing children by age, the by-time view, and when EYFS applies." minutes="2 min">
        <p className="mb-2.5">
          <b>These are your camp&rsquo;s own ratio targets.</b> Activity &amp; coaching camps aren&rsquo;t bound by
          statutory childcare ratios — you set them, guided by Ofsted&rsquo;s voluntary-register guidance, your
          insurer, activity / NGB rules and a risk assessment. <b>EYFS ratios apply only if you admit children under 5.</b>
        </p>

        <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-2)]">Setting your ratios</div>
        <ol className="mb-3 ml-0 list-none space-y-1.5">
          {[
            <><b>Set your groups</b> in <b>Setup → Age groups &amp; rooms</b> — each group&rsquo;s age band, its <b>1&nbsp;:&nbsp;N</b> staff target, and room size. This is the one master record; every board and listing reads it.</>,
            <><b>Take registers</b> and the day&rsquo;s children drop onto the board, sorted into groups by age.</>,
            <><b>Add your team</b> in <b>Your team</b>, then assign each staff member to a group from the roster down the side.</>,
            <><b>Watch live cover</b> — each card shows a 🙂 when it&rsquo;s in ratio, or how many more staff it needs. The header bar totals it for the day.</>,
          ].map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[1px] flex h-[17px] w-[17px] flex-none items-center justify-center rounded-full bg-[var(--brand-2,#2f6bd8)] text-[10px] font-extrabold text-white">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-2)]">Two ways to view the day</div>
        <ul className="ml-0 list-none space-y-1.5">
          <li className="flex gap-2">
            <span className="flex-none font-bold text-[var(--ink-2)]">By age group</span>
            <span>Cards are your age bands. Each needs one adult per your target for that age. <b>Drag a child</b> between groups to regroup them just for the day — it warns if their age doesn&rsquo;t fit the band.</span>
          </li>
          <li className="flex gap-2">
            <span className="flex-none font-bold text-[var(--ink-2)]">By time</span>
            <span>Cards are the <b>hours children are in</b> (say 9am–3pm vs 8am–5:30pm). Cover is rechecked for each window, so an early drop-off or late pickup that leaves you short shows up on its own.</span>
          </li>
        </ul>
      </HowItWorks>

      {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#c0392b]">{error}</div>}

      {/* Listing picker — the live listings running today. No "whole site":
          each listing has its own groups and staffing, so a combined ratio is
          meaningless. Ended and hidden listings never appear (they have no live
          sessions in the feed). */}
      {ready && listings.length > 0 && (
        <label className="mb-3 flex items-center gap-2 text-[12.5px]">
          <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">Listing</span>
          <span className="relative inline-flex items-center">
            <select value={listing} onChange={(e) => setListing(e.target.value)}
              className="appearance-none rounded-full border border-[var(--line)] bg-[var(--surface)] py-2 pl-4 pr-9 text-[13px] font-bold text-[var(--ink)] shadow-[0_1px_2px_rgba(20,30,60,.06)] transition-colors hover:border-[var(--brand-2,#2f6bd8)] focus:border-[var(--brand-2,#2f6bd8)] focus:outline-none">
              {listings.map((l) => {
                const n = listingCounts.get(l)?.size ?? 0;
                return <option key={l} value={l}>{l} · {n} {n === 1 ? "child" : "kids"}</option>;
              })}
            </select>
            <span aria-hidden className="pointer-events-none absolute right-3.5 text-[10px] text-[var(--ink-3)]">▼</span>
          </span>
        </label>
      )}

      {/* Showing … with a fancy day navigator */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--panel)] px-3.5 py-2 text-[12.5px]">
        <span className="flex items-center gap-2 text-[var(--ink-3)]">
          Showing
          <b className="rounded-full bg-[var(--brand-soft,#eef3fc)] px-2.5 py-0.5 text-[var(--brand-ink,#1d3a8f)]">{isToday ? `Today · ${compactDay(date)}` : shortDay(date)}</b>
        </span>
        <div className="inline-flex items-center gap-0.5 rounded-full border border-[var(--line)] bg-[var(--surface)] p-1 shadow-[0_1px_2px_rgba(20,30,60,.06)]">
          <button type="button" onClick={() => setDate((d) => shiftDay(d, -1))} aria-label="Previous day" className="flex h-7 w-7 items-center justify-center rounded-full text-[16px] text-[var(--ink-2)] transition-colors hover:bg-[var(--panel)]">‹</button>
          <label className="relative inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 font-bold text-[var(--ink)] transition-colors hover:bg-[var(--panel)]">
            <span aria-hidden>📅</span>
            <span className="tabular-nums">{compactDay(date)}</span>
            <input type="date" value={date} onClick={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()} onChange={(e) => e.target.value && setDate(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Pick a date" />
          </label>
          <button type="button" onClick={() => setDate((d) => shiftDay(d, 1))} aria-label="Next day" className="flex h-7 w-7 items-center justify-center rounded-full text-[16px] text-[var(--ink-2)] transition-colors hover:bg-[var(--panel)]">›</button>
          {!isToday && <button type="button" onClick={() => setDate(todayIso())} className="ml-0.5 rounded-full bg-[var(--brand-2,#2f6bd8)] px-2.5 py-1 text-[11.5px] font-bold text-white">Today</button>}
        </div>
      </div>

      {/* By time — who's on site in each arrival→departure window. Shown even
          when there's a single timing, so it always states the day's hours. */}
      {ready && periods.length === 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-[var(--panel)] px-3.5 py-2 text-[12px]">
          <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">By time</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 font-bold text-[var(--ink-2)]">
            🕘 You have {periods[0].here} {periods[0].here === 1 ? "child" : "children"} in, {to12h(periods[0].start)}–{to12h(periods[0].end)}
          </span>
          <span className="ml-auto text-[10.5px] text-[var(--ink-3)]">split buttons appear once children arrive or leave at different times</span>
        </div>
      )}
      {ready && periods.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-xl bg-[var(--panel)] px-3.5 py-2 text-[12px]">
          <span className="mr-0.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">By time</span>
          {[{ start: "", end: "", here: wholeDayCount, whole: true }, ...periods.map((p) => ({ ...p, whole: false }))].map((p) => {
            const k = p.whole ? "" : `${p.start}|${p.end}`;
            const on = activeKey === k;
            return (
              <button key={k || "all"} type="button" onClick={() => setPeriod(k)}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-bold"
                style={on ? { borderColor: "transparent", background: "var(--brand-2,#2f6bd8)", color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>
                {p.whole ? "Whole day" : `${to12h(p.start)}–${to12h(p.end)}`}
                <span className="rounded-full px-1.5 text-[10px] font-extrabold" style={{ background: on ? "rgba(255,255,255,.25)" : "var(--surface)", color: on ? "#fff" : "var(--ink-3)" }}>{p.here}</span>
              </button>
            );
          })}
          <span className="ml-auto text-[10.5px] text-[var(--ink-3)]">shows who&rsquo;s on site in that window — the board &amp; ratios recheck for it</span>
        </div>
      )}

      {/* Hero tiles */}
      {ready && (
        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <HeroTile icon="children" tint="#2f6bd8" label={activeKey ? `Children ${to12h(activeKey.split("|")[0])}–${to12h(activeKey.split("|")[1])}` : "Children on site"} value={children.length} sub={`across ${groupCount} group${groupCount === 1 ? "" : "s"}${sendCount ? ` · ${sendCount} SEND` : ""}`} />
          <HeroTile icon="staff" tint="#e2225f" label="Staff on duty" value={cover.onDuty} sub={cover.needed > 0 ? `${cover.needed} needed · ${cover.within ? "within target ✓" : `${cover.needed - cover.onDuty} short`}` : "no staff needed"} />
          <HeroTile icon="groups" tint="#0e9f6e" label="Groups today" value={groupCount} sub={groupCount ? "every child placed by age" : "no children in range"} />
        </div>
      )}

      {/* Ratio policy — read-only reference (edited in Setup) */}
      <PolicyTable groups={groups} />

      {/* Your team — add/manage staff, shared with the listing Staff step */}
      <TeamManager staff={staffLib} onChange={saveStaff} holderId={HOLDER_ID} />

      {/* Cover by group board — the day-to-day workspace */}
      {!ready ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : shown.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">Nothing runs on {dayLabel(date)}{listing ? ` for ${listing}` : ""}.</Card>
      ) : (
        <CoverBoard date={date} isToday={isToday} dayChildren={children} groups={groups} staff={staffLib} onDay={(by) => setDate((d) => shiftDay(d, by))} onCover={setCover} />
      )}

      {/* Staff ratio calculator — occasional planning tool, kept at the bottom. */}
      <RatioCalculator groups={groups} dayChildren={children} dateText={isToday ? "today" : dayLabel(date)} />
    </OperatorPage>
  );
}

function HeroTile({ icon, tint, label, value, sub }: { icon: keyof typeof ICONS; tint: string; label: string; value: number | string; sub: string }) {
  return (
    <div className="rounded-xl border p-3.5" style={{ borderColor: `${tint}33`, background: `${tint}0d` }}>
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: tint }}>{ICONS[icon]}</div>
      <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{label}</div>
      <div className="mt-0.5 text-[26px] font-extrabold leading-none">{value}</div>
      <div className="mt-1 text-[11px] text-[var(--ink-3)]">{sub}</div>
    </div>
  );
}
