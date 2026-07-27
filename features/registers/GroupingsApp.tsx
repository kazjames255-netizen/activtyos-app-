"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { get as apiGet, put as apiPut } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings, groupForAge } from "@/lib/settings";
import { Button } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// Groupings (Register Phase 2) — the allocation board. Split a listing's
// children on a date into named/coloured groups, assign staff + a Lead, and
// lock it. Auto-splits by your age bands. Kept OUT of the day register (which
// stays a flat list) — this is the setup board.
// ─────────────────────────────────────────────────────────────────────────

const LIGHT_PALETTE = { "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc", "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1" } as CSSProperties;
const HERO = "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)";
const PALETTE = ["#e2225f", "#2f6bd8", "#0e9f6e", "#7A5AF8", "#d97706", "#0e7490", "#c2410c", "#4338ca"];
const PRESET = ["Badgers", "Squirrels", "Foxes", "Owls", "Robins", "Hedgehogs", "Apples", "Acorns", "Conkers", "Pioneers"];
const todayIso = () => { const t = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`; };
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

interface Kid { ref: string; name: string; age?: number }
interface Session { blockId: string; listingId: string; listingName: string; attendees: { ref: string; children: { name: string; age?: number }[] }[] }
interface Group { id: string; name: string; color?: string; staff?: string[]; lead?: string; childRefs?: string[] }
interface Board { locked: boolean; groups: Group[] }

export function GroupingsApp() {
  const { settings } = useSettings();
  const bands = settings.ratioGroups ?? [];
  const [date, setDate] = useState(todayIso);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [listingId, setListingId] = useState("");
  const [board, setBoard] = useState<Board>({ locked: false, groups: [] });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [staffDraft, setStaffDraft] = useState<Record<string, string>>({});
  const dirty = useRef(false);

  const loadSessions = useCallback(() => {
    apiGet<Session[]>(`/api/registers?date=${date}`).then((l) => { setSessions(l); if (!l.some((s) => s.listingId === listingId)) setListingId(l[0]?.listingId ?? ""); }).catch(() => setSessions([]));
  }, [date, listingId]);
  useEffect(() => { loadSessions(); }, [loadSessions]);
  useRealtime(["registers", "bookings", "blocks", "groupings"], loadSessions);

  // Load the saved board when listing/date changes.
  useEffect(() => {
    if (!listingId) return;
    let alive = true; dirty.current = false;
    apiGet<Board>(`/api/groupings?listingId=${encodeURIComponent(listingId)}&date=${date}`).then((b) => { if (alive) { setBoard({ locked: b.locked ?? false, groups: b.groups ?? [] }); setStatus("idle"); } }).catch(() => {});
    return () => { alive = false; };
  }, [listingId, date]);

  // Auto-save.
  useEffect(() => {
    if (!dirty.current || !listingId) return;
    const t = setTimeout(async () => {
      try { await apiPut(`/api/groupings/${encodeURIComponent(listingId)}/${date}`, { locked: board.locked, groups: board.groups }); setStatus("saved"); }
      catch { setStatus("error"); }
    }, 700);
    return () => clearTimeout(t);
  }, [board, listingId, date]);

  const listings = useMemo(() => [...new Map((sessions ?? []).map((s) => [s.listingId, s.listingName])).entries()], [sessions]);
  const kids: Kid[] = useMemo(() => {
    const m = new Map<string, Kid>();
    for (const s of (sessions ?? []).filter((x) => x.listingId === listingId)) for (const a of s.attendees) { const c = a.children[0]; if (c) m.set(a.ref, { ref: a.ref, name: a.children.map((k) => k.name).join(", "), age: c.age }); }
    return [...m.values()];
  }, [sessions, listingId]);
  const assigned = useMemo(() => new Set(board.groups.flatMap((g) => g.childRefs ?? [])), [board]);
  const unassigned = kids.filter((k) => !assigned.has(k.ref));
  const kidByRef = new Map(kids.map((k) => [k.ref, k]));

  const mut = (fn: (b: Board) => Board) => { dirty.current = true; setStatus("saving"); setBoard(fn); };
  const addGroup = () => mut((b) => ({ ...b, groups: [...b.groups, { id: `g_${new Date().toISOString()}_${b.groups.length}`, name: PRESET[b.groups.length % PRESET.length], color: PALETTE[b.groups.length % PALETTE.length], staff: [], childRefs: [] }] }));
  const patchGroup = (id: string, p: Partial<Group>) => mut((b) => ({ ...b, groups: b.groups.map((g) => (g.id === id ? { ...g, ...p } : g)) }));
  const delGroup = (id: string) => mut((b) => ({ ...b, groups: b.groups.filter((g) => g.id !== id) }));
  const assign = (ref: string, gid: string) => mut((b) => ({ ...b, groups: b.groups.map((g) => ({ ...g, childRefs: g.id === gid ? [...new Set([...(g.childRefs ?? []), ref])] : (g.childRefs ?? []).filter((r) => r !== ref) })) }));
  const unassign = (ref: string) => mut((b) => ({ ...b, groups: b.groups.map((g) => ({ ...g, childRefs: (g.childRefs ?? []).filter((r) => r !== ref) })) }));
  const addStaff = (gid: string, name: string) => { const n = name.trim(); if (!n) return; mut((b) => ({ ...b, groups: b.groups.map((g) => (g.id === gid ? { ...g, staff: [...new Set([...(g.staff ?? []), n])] } : g)) })); setStaffDraft((d) => ({ ...d, [gid]: "" })); };
  const removeStaff = (gid: string, name: string) => mut((b) => ({ ...b, groups: b.groups.map((g) => (g.id === gid ? { ...g, staff: (g.staff ?? []).filter((s) => s !== name), lead: g.lead === name ? undefined : g.lead } : g)) }));

  // Auto-split every child into an age-band group (creating the groups needed).
  function autoSplit() {
    if (!bands.length) return;
    mut(() => {
      const byBand = new Map<string, Group>();
      for (const b of bands) byBand.set(b.id, { id: `band_${b.id}`, name: b.name, color: b.colour, staff: [], childRefs: [] });
      const leftover: string[] = [];
      for (const k of kids) { const band = k.age != null ? groupForAge(bands, k.age) : null; if (band) byBand.get(band.id)!.childRefs!.push(k.ref); else leftover.push(k.ref); }
      const groups = [...byBand.values()].filter((g) => g.childRefs!.length);
      if (leftover.length) groups.push({ id: "band_other", name: "Other", color: "#8a86a3", staff: [], childRefs: leftover });
      return { locked: false, groups };
    });
  }

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: HERO }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🧩</span>Groups & rooms</div>
            <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">Split a listing&rsquo;s children into groups for the day, assign staff and a lead, then lock it. Auto-split by your age bands, or arrange them by hand.</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {listings.length > 1 && <select value={listingId} onChange={(e) => setListingId(e.target.value)} className="rounded-lg border-0 bg-white/90 px-2.5 py-1.5 text-[12.5px] font-semibold text-[#1d3a8f]">{listings.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>}
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="rounded-lg border-0 bg-white/90 px-2.5 py-1.5 text-[12.5px] font-semibold text-[#1d3a8f]" />
          </div>
        </div>
      </div>

      <div className="mb-3 rounded-xl border-2 border-[#f6e2a8] bg-[#fffdf3] px-4 py-2.5 text-[12px] text-[#9a5a00]"><b>⚠ Phase 2 — a working preview.</b> Staff assignment &amp; lock are new; the day register itself stays a simple flat list.</div>

      {!sessions ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
        : kids.length === 0 ? <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-12 text-center text-[13px] text-[var(--ink-3)]">No children booked for this listing on {dayLabel(date)}.</div>
        : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button sm variant="solid" onClick={addGroup} disabled={board.locked}>＋ Add a group</Button>
              {bands.length > 0 && <Button sm onClick={autoSplit} disabled={board.locked}>✨ Auto-split by age band</Button>}
              <button type="button" onClick={() => mut((b) => ({ ...b, locked: !b.locked }))} className="rounded-full border px-3.5 py-1.5 text-[12px] font-extrabold" style={board.locked ? { borderColor: "#0f7a43", background: "#e7f6ee", color: "#0f7a43" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{board.locked ? "🔒 Locked for the day" : "🔓 Lock groups for the day"}</button>
              <span className="ml-auto text-[11.5px] font-semibold" style={{ color: status === "error" ? "#c02636" : status === "saved" ? "#0f7a43" : "var(--ink-3)" }}>{status === "saving" ? "Saving…" : status === "saved" ? "✓ Saved" : status === "error" ? "Couldn’t save" : "Saves automatically"}</span>
            </div>

            {/* Unassigned pool */}
            <div className="mb-3.5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
              <div className="mb-2 text-[12.5px] font-extrabold">⏳ Unassigned <span className="text-[11px] font-semibold text-[var(--ink-3)]">({unassigned.length})</span></div>
              {unassigned.length === 0 ? <div className="text-[12px] text-[var(--ink-3)]">Everyone&rsquo;s in a group. 🎉</div> : (
                <div className="flex flex-wrap gap-1.5">
                  {unassigned.map((k) => (
                    <span key={k.ref} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel)] py-0.5 pl-2.5 pr-1 text-[12px] font-semibold">
                      {k.name}{k.age != null ? ` (${k.age})` : ""}
                      {!board.locked && board.groups.length > 0 && (
                        <select value="" onChange={(e) => e.target.value && assign(k.ref, e.target.value)} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-1.5 py-0.5 text-[10.5px] font-bold text-[#1d3a8f]"><option value="">→ group</option>{board.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Group cards */}
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {board.groups.map((g) => {
                const gk = (g.childRefs ?? []).map((r) => kidByRef.get(r)).filter(Boolean) as Kid[];
                return (
                  <div key={g.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
                    <div className="h-1.5 w-full" style={{ background: g.color ?? "#1d3a8f" }} />
                    <div className="p-3.5">
                      <div className="flex items-center gap-2">
                        <input value={g.name} disabled={board.locked} onChange={(e) => patchGroup(g.id, { name: e.target.value })} className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent text-[14px] font-extrabold outline-none hover:border-[var(--line)] focus:border-[#1d3a8f]" />
                        {!board.locked && <>
                          <div className="flex gap-0.5">{PALETTE.slice(0, 5).map((c) => <button key={c} type="button" onClick={() => patchGroup(g.id, { color: c })} className="h-4 w-4 rounded-full border" style={{ background: c, borderColor: g.color === c ? "#171534" : "transparent" }} />)}</div>
                          <button type="button" onClick={() => delGroup(g.id)} className="text-[var(--ink-3)] hover:text-[#c02636]">✕</button>
                        </>}
                      </div>
                      <div className="mt-1 text-[11px] font-bold text-[var(--ink-3)]">{gk.length} child{gk.length === 1 ? "" : "ren"}</div>

                      {/* staff */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(g.staff ?? []).map((s) => (
                          <span key={s} className="inline-flex items-center gap-1 rounded-full bg-[#eef4fd] py-0.5 pl-2 pr-1 text-[11px] font-semibold text-[#1d3a8f]">
                            <button type="button" onClick={() => patchGroup(g.id, { lead: g.lead === s ? undefined : s })} title="Lead" className="text-[12px]">{g.lead === s ? "★" : "☆"}</button>{s}
                            {!board.locked && <button type="button" onClick={() => removeStaff(g.id, s)} className="text-[#1d3a8f]/60">✕</button>}
                          </span>
                        ))}
                      </div>
                      {!board.locked && (
                        <div className="mt-1.5 flex gap-1.5">
                          <input value={staffDraft[g.id] ?? ""} onChange={(e) => setStaffDraft((d) => ({ ...d, [g.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addStaff(g.id, staffDraft[g.id] ?? "")} placeholder="Add staff…" className="min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[11.5px]" />
                          <Button sm onClick={() => addStaff(g.id, staffDraft[g.id] ?? "")}>Add</Button>
                        </div>
                      )}

                      {/* children */}
                      <div className="mt-2 flex flex-col gap-1 border-t border-[var(--line)] pt-2">
                        {gk.length === 0 ? <div className="text-[11.5px] text-[var(--ink-3)]">No children yet — assign from the pool.</div>
                          : gk.map((k) => (
                            <div key={k.ref} className="flex items-center justify-between gap-2 text-[12px]">
                              <span className="truncate font-semibold">{k.name}{k.age != null ? ` (${k.age})` : ""}</span>
                              {!board.locked && <button type="button" onClick={() => unassign(k.ref)} className="flex-none text-[var(--ink-3)] hover:text-[#c02636]" title="Back to unassigned">✕</button>}
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
    </div>
  );
}
