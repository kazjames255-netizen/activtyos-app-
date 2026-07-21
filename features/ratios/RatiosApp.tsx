"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Button, Card } from "@/components/ui";
import { OperatorPage } from "@/components/OperatorPage";
import { useSettings, groupForAge, DEFAULT_RATIO_GROUPS, type RatioGroup } from "@/lib/settings";

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
}
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
interface StaffMember { id: string; first: string; last: string }

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
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

/** Staff for one line: ceil(children / ratio), matching the manual's board. */
const staffForLine = (children: number, ratio: number) => (children > 0 ? Math.ceil(children / Math.max(1, ratio)) : 0);
const ageRange = (g: RatioGroup) => `${g.ageFrom}-${g.ageTo} yrs`;

const EYFS_3TO5_QT = 13;

// ────────────────────────────────────────────────────────────────────────
// Ratio policy table — editable, persists to settings.
// ────────────────────────────────────────────────────────────────────────
function PolicyTable({ groups, onChange }: { groups: RatioGroup[]; onChange: (g: RatioGroup[]) => void }) {
  const patch = (i: number, fn: (g: RatioGroup) => RatioGroup) => onChange(groups.map((x, j) => (j === i ? fn(x) : x)));
  const num = (v: string, min: number) => Math.max(min, parseInt(v, 10) || min);
  const inp = "rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12.5px]";
  return (
    <details className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--surface)]" open>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-[12.5px] font-bold text-[var(--brand-ink,#1d3a8f)] [&::-webkit-details-marker]:hidden">
        <span className="inline-block transition-transform group-open:rotate-90">▸</span>
        Your ratio policy <span className="font-normal text-[var(--ink-3)]">— colours, names, target ratios &amp; sizes; every edit flows to every card below</span>
      </summary>
      <div className="overflow-x-auto px-3.5 pb-3.5">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-[0.04em] text-[var(--ink-3)]">
              <th className="px-2 py-1.5 text-left font-extrabold">Colour</th>
              <th className="px-2 py-1.5 text-left font-extrabold">Group</th>
              <th className="px-2 py-1.5 text-left font-extrabold">Age</th>
              <th className="px-2 py-1.5 text-left font-extrabold">Target ratio</th>
              <th className="px-2 py-1.5 text-left font-extrabold">Max size</th>
              <th className="px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {groups.map((g, i) => (
              <tr key={g.id} className="border-t border-[var(--line)]">
                <td className="px-2 py-1.5">
                  <input type="color" value={g.colour} onChange={(e) => patch(i, (x) => ({ ...x, colour: e.target.value }))} className="h-7 w-10 cursor-pointer rounded border border-[var(--line)] bg-transparent p-0.5" aria-label={`${g.name} colour`} />
                </td>
                <td className="px-2 py-1.5">
                  <input value={g.name} onChange={(e) => patch(i, (x) => ({ ...x, name: e.target.value }))} className={`${inp} w-[130px] font-bold`} placeholder="Group name" />
                </td>
                <td className="px-2 py-1.5">
                  <span className="inline-flex items-center gap-1">
                    <input type="number" min={0} max={21} value={g.ageFrom} onChange={(e) => patch(i, (x) => ({ ...x, ageFrom: num(e.target.value, 0) }))} className={`${inp} w-[52px]`} />
                    <span className="text-[var(--ink-3)]">to</span>
                    <input type="number" min={0} max={21} value={g.ageTo} onChange={(e) => patch(i, (x) => ({ ...x, ageTo: num(e.target.value, 0) }))} className={`${inp} w-[52px]`} />
                    <span className="text-[var(--ink-3)]">yrs</span>
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <span className="inline-flex items-center gap-1">1 :<input type="number" min={1} value={g.targetRatio} onChange={(e) => patch(i, (x) => ({ ...x, targetRatio: num(e.target.value, 1) }))} className={`${inp} w-[56px]`} /></span>
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" min={1} value={g.maxSize} onChange={(e) => patch(i, (x) => ({ ...x, maxSize: num(e.target.value, 1) }))} className={`${inp} w-[64px]`} />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <button type="button" onClick={() => onChange(groups.filter((_, j) => j !== i))} aria-label={`Remove ${g.name}`} className="text-[16px] leading-none text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          onClick={() => onChange([...groups, { id: uid(), name: `Group ${groups.length + 1}`, colour: "#2f6bd8", ageFrom: 0, ageTo: 18, targetRatio: 8, maxSize: 24 }])}
          className="mt-2 rounded-full border border-dashed border-[var(--line)] px-3 py-1 text-[12px] font-bold text-[var(--brand-ink,#1d3a8f)]"
        >
          ＋ Add group
        </button>
      </div>
    </details>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Cover-by-group board — coloured group cards for the day.
// ────────────────────────────────────────────────────────────────────────
function CoverBoard({ date, isToday, dayChildren, groups, staff, onDay }: {
  date: string; isToday: boolean; dayChildren: SessionChild[]; groups: RatioGroup[]; staff: StaffMember[];
  onDay: (by: number) => void;
}) {
  // Child → group. Default is by age; a manual drag overrides it (this view
  // only — persisting the board needs a backend store, §R).
  const [override, setOverride] = useState<Record<string, string>>({});
  const [groupStaff, setGroupStaff] = useState<Record<string, string[]>>({});
  const [dragRef, setDragRef] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const groupOf = (c: SessionChild) => override[c.childId ?? c.ref] ?? groupForAge(groups, c.age)?.id ?? "__unplaced";
  const inGroup = (gid: string) => dayChildren.filter((c) => groupOf(c) === gid);
  const setStaffFor = (gid: string, sid: string) =>
    setGroupStaff((m) => ({ ...m, [gid]: (m[gid] ?? []).includes(sid) ? (m[gid] ?? []).filter((x) => x !== sid) : [...(m[gid] ?? []), sid] }));
  const drop = (gid: string) => { if (dragRef) setOverride((o) => ({ ...o, [dragRef]: gid })); setDragRef(null); setDragOver(null); };

  const totalChildren = dayChildren.length;
  const staffOnDuty = new Set(Object.values(groupStaff).flat()).size;
  const staffNeeded = groups.reduce((n, g) => n + staffForLine(inGroup(g.id).length, g.targetRatio), 0) + staffForLine(inGroup("__unplaced").length, 8);
  const within = staffOnDuty >= staffNeeded;
  const overall = staffOnDuty > 0 ? totalChildren / staffOnDuty : 0;
  const unplaced = inGroup("__unplaced");

  const Chip = ({ c, colour, onRemove }: { c: SessionChild; colour?: string; onRemove?: () => void }) => (
    <span
      draggable
      onDragStart={() => setDragRef(c.childId ?? c.ref)}
      className="inline-flex cursor-grab items-center gap-1 rounded-full border py-[3px] pl-2.5 pr-1.5 text-[11.5px] font-bold active:cursor-grabbing"
      style={{ borderColor: colour ? `${colour}66` : "var(--line)", background: colour ? `${colour}12` : "var(--surface)", color: colour ?? "var(--ink)" }}
    >
      {c.name}
      {c.send && <span className="rounded px-1 text-[9px]" style={{ background: colour ? `${colour}22` : "var(--brand-soft)" }}>SEND</span>}
      {c.allergies && <span title="Allergy on file">⚠</span>}
      {onRemove && <button type="button" onClick={onRemove} aria-label={`Remove ${c.name}`} className="text-[13px] leading-none opacity-60">×</button>}
    </span>
  );

  return (
    <div>
      <div className="mb-0.5 text-[15px] font-extrabold" style={{ color: "var(--brand-ink,#1d3a8f)" }}>Cover by group</div>
      <p className="mb-2 text-[12px] text-[var(--ink-3)]">Use ‹ › to move between days · edit a name or target above, drag a child, or add a group — all live.</p>

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
          <div className="flex items-center gap-3 text-[13px]" style={{ fontVariantNumeric: "tabular-nums" }}>
            <span><b className="text-[15px]">{totalChildren}</b> children</span>
            <span><b className="text-[15px]">{staffOnDuty}</b> staff</span>
            <span><b className="text-[15px]">{overall > 0 ? `1:${overall.toFixed(1)}` : `needs ${staffNeeded}`}</b></span>
            <span className="rounded-full px-3 py-1 text-[11.5px] font-extrabold" style={within ? { background: "rgba(255,255,255,.22)" } : { background: "#fee2e2", color: "#c0392b" }}>
              {within ? "WITHIN TARGET" : `SHORT ${staffNeeded - staffOnDuty}`}
            </span>
          </div>
        </div>

        {/* Group cards */}
        <div className="grid gap-3 p-3 sm:grid-cols-2">
          {groups.map((g) => {
            const kids = inGroup(g.id);
            const need = staffForLine(kids.length, g.targetRatio);
            const have = (groupStaff[g.id] ?? []).length;
            const met = have >= need;
            const over = kids.length > g.maxSize;
            const live = have > 0 ? kids.length / have : 0;
            const isOver = dragOver === g.id;
            return (
              <div key={g.id} className="overflow-hidden rounded-xl border-2" style={{ borderColor: isOver ? g.colour : `${g.colour}33` }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(g.id); }} onDragLeave={() => setDragOver((o) => (o === g.id ? null : o))} onDrop={() => drop(g.id)}>
                {/* card header tinted to group colour */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2" style={{ background: `${g.colour}14` }}>
                  <div>
                    <div className="text-[15px] font-extrabold" style={{ color: g.colour }}>{g.name}</div>
                    <div className="text-[11.5px] text-[var(--ink-3)]">{ageRange(g)}</div>
                  </div>
                  <div className="flex items-center gap-3 text-center">
                    <div>
                      <div className="text-[9.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Target</div>
                      <div className="text-[13px] font-extrabold">1:{g.targetRatio}</div>
                    </div>
                    <div>
                      <div className="text-[9.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Live</div>
                      <div className="text-[13px] font-extrabold">{live > 0 ? `1:${live.toFixed(1)}` : "—"}</div>
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full px-2.5 py-[3px] text-[11px] font-extrabold" style={met ? { background: "#e7f8ee", color: "#0f7a44" } : { background: "#fdebec", color: "#c0392b" }}>
                      {met ? "ON TARGET" : "SHORT"} · {kids.length} / {have}
                    </span>
                    <span className="text-[11.5px] text-[var(--ink-3)]">needs {need} staff</span>
                    {over && <span className="rounded-full bg-[#fdebec] px-2 py-[2px] text-[10.5px] font-bold text-[#c0392b]">Over max ({kids.length}/{g.maxSize})</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {kids.map((c) => <Chip key={c.ref} c={c} colour={g.colour} onRemove={() => setOverride((o) => ({ ...o, [c.childId ?? c.ref]: "__unplaced" }))} />)}
                    {kids.length === 0 && <span className="text-[11px] text-[var(--ink-3)]">No children this age. Drag one here.</span>}
                  </div>
                  {/* staff on this group */}
                  <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-[var(--line)] pt-2">
                    {staff.map((m) => {
                      const on = (groupStaff[g.id] ?? []).includes(m.id);
                      return (
                        <button key={m.id} type="button" onClick={() => setStaffFor(g.id, m.id)} className="rounded-full border px-2.5 py-[3px] text-[11px] font-bold"
                          style={on ? { borderColor: "transparent", background: g.colour, color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>
                          {`${m.first} ${m.last}`.trim() || "Staff"}
                        </button>
                      );
                    })}
                    {staff.length === 0 && <span className="text-[11px] text-[var(--ink-3)]">Add yourself and any helpers to your team to assign staff here.</span>}
                  </div>
                </div>
              </div>
            );
          })}
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

function RatioCalculator({ groups, dayChildren }: { groups: RatioGroup[]; dayChildren: SessionChild[] }) {
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
          <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--brand-ink,#1d3a8f)]">Check a live day against the guidance</div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={showLive} disabled={liveCount === 0} className="rounded-lg px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-40" style={{ background: "var(--brand-ink,#1d3a8f)" }}>Show me live ({liveCount})</button>
            <span className="text-[11px] text-[var(--ink-3)]">Drops the day&apos;s actual children into the calculator.</span>
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
  const { settings, save } = useSettings();
  const groups = settings.ratioGroups.length ? settings.ratioGroups : DEFAULT_RATIO_GROUPS;

  const refresh = useCallback(() => {
    apiGet<{ sessions: RatioSession[] }>(`/api/ratios?date=${date}`)
      .then((r) => { setSessions(r.sessions); setLoadedDate(date); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load ratios"));
  }, [date]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ staff?: StaffMember[] } | null>("/api/library").then((l) => setStaffLib(l?.staff ?? [])).catch(() => {}); }, []);
  useRealtime(["ratioGroups", "bookings", "blocks"], refresh);

  const ready = loadedDate === date && sessions;
  const listings = useMemo(() => [...new Set((sessions ?? []).map((s) => s.listingName))].sort(), [sessions]);
  const shown = useMemo(() => (sessions ?? []).filter((s) => !listing || s.listingName === listing), [sessions, listing]);
  // The day's children for the chosen listing, deduplicated across sessions.
  const children = useMemo(() => {
    const seen = new Set<string>(); const out: SessionChild[] = [];
    for (const s of shown) for (const c of s.children) { const k = c.childId ?? c.ref; if (!seen.has(k)) { seen.add(k); out.push(c); } }
    return out;
  }, [shown]);

  const isToday = date === todayIso();
  const groupCount = groups.filter((g) => children.some((c) => c.age >= g.ageFrom && c.age <= g.ageTo)).length;
  const sendCount = children.filter((c) => c.send).length;

  return (
    <OperatorPage
      title="Ratios & groups"
      lede="Set your groups and target ratios, and track live cover as you take registers"
      actions={
        listings.length > 0 ? (
          <select value={listing} onChange={(e) => setListing(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--ink)]">
            <option value="">All listings</option>
            {listings.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        ) : undefined
      }
    >
      {/* Guidance banner */}
      <div className="mb-3 flex gap-2.5 rounded-xl border border-[var(--brand-line,#d5e0f5)] bg-[var(--brand-soft,#eef3fc)] px-3.5 py-2.5 text-[11.5px] leading-[1.55] text-[var(--ink-2)]">
        <span aria-hidden className="text-[15px] leading-none">ℹ️</span>
        <span>
          <b>These are your camp&rsquo;s own ratio targets.</b> Activity &amp; coaching camps aren&rsquo;t bound by
          statutory childcare ratios — you set them, guided by Ofsted&rsquo;s voluntary-register guidance,
          your insurer, activity / NGB rules and a risk assessment. <b>EYFS ratios apply only if you admit
          children under 5.</b>
        </span>
      </div>

      {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#c0392b]">{error}</div>}

      {/* Showing … */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-[var(--panel)] px-3.5 py-2 text-[12.5px]">
        <span className="text-[var(--ink-3)]">Showing</span>
        <b className="text-[var(--brand-ink,#1d3a8f)]">{isToday ? "Today" : ""} · {dayLabel(date)}</b>
        <span className="text-[var(--ink-3)]">· use the day arrows on the board below to change day</span>
        <span className="ml-auto flex items-center gap-1.5">
          <Button sm onClick={() => setDate((d) => shiftDay(d, -1))} aria-label="Previous day">←</Button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px]" />
          <Button sm onClick={() => setDate((d) => shiftDay(d, 1))} aria-label="Next day">→</Button>
          {!isToday && <Button sm onClick={() => setDate(todayIso())}>Today</Button>}
        </span>
      </div>

      {/* Hero tiles */}
      {ready && (
        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <HeroTile icon="👥" tint="#2f6bd8" label="Children on site" value={children.length} sub={`across ${groupCount} group${groupCount === 1 ? "" : "s"}${sendCount ? ` · ${sendCount} SEND` : ""}`} />
          <HeroTile icon="🧑‍🏫" tint="#e2225f" label="Staff on duty" value="—" sub="assign staff on the board below" />
          <HeroTile icon="⚖️" tint="#0e9f6e" label="Groups today" value={groupCount} sub={groupCount ? "every child placed by age" : "no children in range"} />
        </div>
      )}

      {/* Ratio policy — editable, persists */}
      <PolicyTable groups={groups} onChange={(g) => void save({ settings: { ...settings, ratioGroups: g } })} />

      {/* Calculator */}
      <RatioCalculator groups={groups} dayChildren={children} />

      {/* Cover by group board */}
      {!ready ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : shown.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">Nothing runs on {dayLabel(date)}{listing ? ` for ${listing}` : ""}.</Card>
      ) : (
        <CoverBoard date={date} isToday={isToday} dayChildren={children} groups={groups} staff={staffLib} onDay={(by) => setDate((d) => shiftDay(d, by))} />
      )}
    </OperatorPage>
  );
}

function HeroTile({ icon, tint, label, value, sub }: { icon: string; tint: string; label: string; value: number | string; sub: string }) {
  return (
    <div className="rounded-xl border p-3.5" style={{ borderColor: `${tint}33`, background: `${tint}0d` }}>
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg text-[16px]" style={{ background: tint }}>{icon}</div>
      <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{label}</div>
      <div className="mt-0.5 text-[26px] font-extrabold leading-none">{value}</div>
      <div className="mt-1 text-[11px] text-[var(--ink-3)]">{sub}</div>
    </div>
  );
}
