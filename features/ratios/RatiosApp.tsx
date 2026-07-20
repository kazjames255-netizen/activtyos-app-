"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Button, Card } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// Ratios & groups — is each session safely staffed, and who's in which
// group? Children and the required staff come from the server (resolved from
// bookings + child ages/SEND); the operator assigns staff (from the tenant
// library) and sorts children into named groups. Simple by design — Kaz can
// restyle; the ratio maths and the group persistence are the point.
// ─────────────────────────────────────────────────────────────────────────

interface SessionChild {
  ref: string;
  childId: string | null;
  name: string;
  age: number;
  send: boolean;
  allergies: boolean;
}
interface Group {
  id: string;
  name: string;
  childRefs: string[];
  staffIds: string[];
  required: number;
  staff: number;
  met: boolean;
}
interface RatioSession {
  blockId: string;
  date: string;
  start: string;
  end: string;
  blockName: string;
  listingName: string;
  children: SessionChild[];
  groups: Group[];
  unassignedRefs: string[];
  totalChildren: number;
  sendCount: number;
  requiredStaff: number;
  staffAssigned: number;
  met: boolean;
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
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

// The editable shape (client owns group assignment until Save).
interface EditGroup { id: string; name: string; childRefs: string[]; staffIds: string[] }

function SessionCard({ s, staff, onSave }: { s: RatioSession; staff: StaffMember[]; onSave: (blockId: string, groups: EditGroup[]) => Promise<void> }) {
  const [groups, setGroups] = useState<EditGroup[]>(
    s.groups.map((g) => ({ id: g.id, name: g.name, childRefs: g.childRefs, staffIds: g.staffIds })),
  );
  const [busy, setBusy] = useState(false);
  const groupOf = (ref: string) => groups.find((g) => g.childRefs.includes(ref))?.id ?? "";
  const assignChild = (ref: string, groupId: string) =>
    setGroups((gs) => gs.map((g) => ({ ...g, childRefs: g.id === groupId ? [...new Set([...g.childRefs, ref])] : g.childRefs.filter((r) => r !== ref) })));
  const toggleStaff = (groupId: string, staffId: string) =>
    setGroups((gs) => gs.map((g) => (g.id === groupId ? { ...g, staffIds: g.staffIds.includes(staffId) ? g.staffIds.filter((x) => x !== staffId) : [...g.staffIds, staffId] } : g)));

  // Live recompute so the operator sees the ratio update before saving.
  const requiredFor = (refs: string[]) => {
    const ages = refs.map((r) => s.children.find((c) => c.ref === r)?.age ?? 0);
    if (!ages.length) return 0;
    const bands = [[1, 3], [2, 4], [4, 8], [7, 8], [99, 10]];
    const demand = ages.reduce((sum, age) => sum + 1 / (bands.find(([m]) => age <= m)?.[1] ?? 10), 0);
    return Math.max(1, Math.ceil(Math.round(demand * 1000) / 1000));
  };
  const assignedStaff = new Set(groups.flatMap((g) => g.staffIds));
  const met = assignedStaff.size >= s.requiredStaff;

  async function save() {
    setBusy(true);
    await onSave(s.blockId, groups);
    setBusy(false);
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-[15px] font-extrabold">{s.listingName}</div>
          <div className="text-[12px] text-[var(--ink-3)]">{s.blockName} · {s.start} – {s.end}</div>
        </div>
        <div className="flex items-center gap-2 text-[12px]" style={{ fontVariantNumeric: "tabular-nums" }}>
          <span className="text-[var(--ink-2)]">{s.totalChildren} children{s.sendCount ? ` · ${s.sendCount} SEND` : ""}</span>
          <span
            className="rounded-full px-2.5 py-[3px] text-[11.5px] font-bold"
            style={met ? { background: "var(--green-soft,#e7f8ee)", color: "#0f7a44" } : { background: "var(--red-soft,#fdebec)", color: "var(--red,#e21d27)" }}
          >
            {assignedStaff.size} / {s.requiredStaff} staff {met ? "✓" : `— need ${s.requiredStaff - assignedStaff.size} more`}
          </span>
        </div>
      </div>

      {/* Groups */}
      <div className="mt-3 flex flex-col gap-2.5">
        {groups.map((g) => {
          const req = requiredFor(g.childRefs);
          const gm = g.staffIds.length >= req;
          return (
            <div key={g.id} className="rounded-xl border border-[var(--line)] p-2.5">
              <div className="flex items-center gap-2">
                <input
                  value={g.name}
                  placeholder="Group name"
                  onChange={(e) => setGroups((gs) => gs.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x)))}
                  className="rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12.5px] font-bold"
                />
                <span className="rounded-full px-2 py-[2px] text-[11px] font-bold" style={gm ? { background: "var(--green-soft,#e7f8ee)", color: "#0f7a44" } : { background: "#fdf3d8", color: "#9a5a00" }}>
                  {g.childRefs.length} kids · {g.staffIds.length}/{req} staff
                </span>
                <button type="button" onClick={() => setGroups((gs) => gs.filter((x) => x.id !== g.id))} className="ml-auto text-[var(--ink-3)]" aria-label="Remove group">×</button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {staff.map((m) => (
                  <button key={m.id} type="button" onClick={() => toggleStaff(g.id, m.id)}
                    className="rounded-full border px-2 py-[2px] text-[11px] font-bold transition-colors"
                    style={g.staffIds.includes(m.id) ? { borderColor: "transparent", background: "var(--brand,#2f6bd8)", color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>
                    {`${m.first} ${m.last}`.trim() || "Staff"}
                  </button>
                ))}
                {staff.length === 0 && <span className="text-[11px] text-[var(--ink-3)]">Add staff in Listings → your team to assign them.</span>}
              </div>
            </div>
          );
        })}
        <button type="button" onClick={() => setGroups((gs) => [...gs, { id: uid(), name: `Group ${gs.length + 1}`, childRefs: [], staffIds: [] }])} className="self-start text-[12px] font-bold text-[var(--brand-2,#2f6bd8)] underline">
          + Add group
        </button>
      </div>

      {/* Children → group assignment */}
      {s.children.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Children</div>
          {s.children.map((c) => (
            <div key={c.ref} className="flex items-center gap-2 border-t border-[var(--line)] py-1.5 text-[12.5px] first:border-t-0">
              <span className="min-w-0 flex-1 truncate">
                <b>{c.name}</b> <span className="text-[var(--ink-3)]">({c.age})</span>
                {c.send && <span className="ml-1.5 rounded px-1 text-[10px] font-bold" style={{ background: "var(--brand-soft,#e7f0ff)", color: "var(--brand-ink,#1d3a8f)" }}>SEND</span>}
                {c.allergies && <span className="ml-1 rounded px-1 text-[10px] font-bold" style={{ background: "var(--red-soft,#fdebec)", color: "var(--red,#e21d27)" }}>⚠</span>}
              </span>
              <select value={groupOf(c.ref)} onChange={(e) => assignChild(c.ref, e.target.value)} className="rounded border border-[var(--line)] bg-[var(--surface)] px-1.5 py-1 text-[12px]">
                <option value="">Unassigned</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name || "Group"}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3">
        <Button sm variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save groups"}</Button>
      </div>
    </Card>
  );
}

/** ratios view — freelancer / company / franchise / staff portals. */
export function RatiosApp() {
  const [date, setDate] = useState(todayIso);
  const [loaded, setLoaded] = useState<{ date: string; sessions: RatioSession[] } | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const sessions = loaded && loaded.date === date ? loaded.sessions : null;

  const refresh = useCallback(() => {
    apiGet<{ date: string; sessions: RatioSession[] }>(`/api/ratios?date=${date}`)
      .then((r) => { setLoaded({ date, sessions: r.sessions }); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load ratios"));
  }, [date]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    apiGet<{ staff?: StaffMember[] } | null>("/api/library").then((l) => setStaff(l?.staff ?? [])).catch(() => {});
  }, []);
  useRealtime(["ratioGroups", "bookings", "blocks"], refresh);

  const save = useMemo(() => async (blockId: string, groups: EditGroup[]) => {
    try {
      await api(`/api/ratios/${encodeURIComponent(blockId)}/${date}`, { method: "PUT", body: JSON.stringify({ groups }) });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save groups");
    }
  }, [date, refresh]);

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Ratios &amp; groups</h2>
        <div className="flex items-center gap-1.5">
          <Button sm onClick={() => setDate((d) => shiftDay(d, -1))} aria-label="Previous day">←</Button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--ink)]" />
          <Button sm onClick={() => setDate((d) => shiftDay(d, 1))} aria-label="Next day">→</Button>
          {date !== todayIso() && <Button sm onClick={() => setDate(todayIso())}>Today</Button>}
        </div>
      </div>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">{dayLabel(date)} — staff each session safely and split children into groups.</p>

      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {!sessions ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : sessions.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">Nothing runs on {dayLabel(date)}.</Card>
      ) : (
        <div className="flex flex-col gap-3.5">
          {sessions.map((s) => <SessionCard key={s.blockId} s={s} staff={staff} onSave={save} />)}
        </div>
      )}
    </div>
  );
}
