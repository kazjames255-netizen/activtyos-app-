"use client";

import { useEffect, useState } from "react";
import { Ico } from "../teachIcons";
import { useCallObject, type CallLike } from "./board/callObject";
import { maskName } from "./workspace/wsKit";

// The tutor's "In the room" strip: who is actually CONNECTED to the call right now (from Daily's participant events), not who was invited.
// It sits under the room header, so it is visible whichever workspace tab (or none, or "video only") is showing — the whiteboard's own
// student list is only there when the board is open. A student is matched to a participant by the `user_id` OUR server signed into their
// meeting token (`c:<childId>`), which a browser can't change. Daily has no hand-raise signal in this room (the prebuilt UI's hand-raising is
// switched off on the account), so "muted" is the only state shown besides connected / not here.

interface Presence { sessionId: string; userId: string; name: string; audio: boolean; owner: boolean; local: boolean }
type DailyParticipant = { session_id: string; user_id?: string; user_name?: string; audio?: boolean; owner?: boolean; local?: boolean };

const read = (call: CallLike): Presence[] => {
  try {
    return Object.values(call.participants() as unknown as Record<string, DailyParticipant>).map((p) => ({
      sessionId: p.session_id, userId: p.user_id && p.user_id !== p.session_id ? p.user_id : "", name: (p.user_name ?? "").trim(), audio: p.audio !== false, owner: !!p.owner, local: !!p.local,
    }));
  } catch { return []; }
};
const sig = (l: Presence[]) => l.map((p) => `${p.sessionId}|${p.userId}|${p.name}|${p.audio ? 1 : 0}`).sort().join(",");

/** Who is connected to the call right now (null = no call). Re-renders only when someone joins, leaves, renames or (un)mutes. */
export function useRoomPresence(): Presence[] | null {
  const call = useCallObject();
  const [list, setList] = useState<Presence[] | null>(null);
  useEffect(() => {
    if (!call) { setList(null); return; }
    const sync = () => setList((cur) => { const n = read(call); return cur && sig(cur) === sig(n) ? cur : n; });
    sync();
    const evs = ["joined-meeting", "participant-joined", "participant-updated", "participant-left"];
    for (const e of evs) { try { call.on(e, sync as never); } catch { /* call not ready */ } }
    return () => { for (const e of evs) { try { call.off(e, sync as never); } catch { /* call gone */ } } };
  }, [call]);
  return list;
}

export function RoomRoster({ students, hideNames }: { students: { childId: string; childName: string }[]; hideNames: boolean }) {
  const here = useRoomPresence();
  if (!here) return null;
  const others = here.filter((p) => !p.local && !p.owner);
  const byChild = new Map<string, Presence[]>();
  const guests: Presence[] = [];
  for (const p of others) {
    const cid = p.userId.startsWith("c:") ? p.userId.slice(2) : "";
    if (cid && students.some((s) => s.childId === cid)) byChild.set(cid, [...(byChild.get(cid) ?? []), p]);
    else guests.push(p);
  }
  const rows = students.map((s, i) => ({ s, i, devices: byChild.get(s.childId) ?? [] }));
  const connected = rows.filter((r) => r.devices.length);
  const absent = rows.filter((r) => !r.devices.length);
  const label = (name: string, i: number) => (hideNames ? maskName(i) : name.trim().split(/\s+/)[0] || name);
  const chip = "inline-flex min-h-[32px] flex-none items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-bold";

  return (
    <section aria-label="In the room" data-testid="hub-room-roster" data-here={connected.length} data-total={students.length}
      className="flex flex-none items-center gap-2 overflow-x-auto border-b border-[var(--hub-warm-line)] px-3 py-1.5" style={{ background: "var(--hub-warm)" }}>
      <span className="flex-none text-[11px] font-extrabold uppercase tracking-[0.1em] text-[var(--ink-3)]">In the room</span>
      <span className="flex-none text-[12px] font-extrabold tabular-nums text-[var(--ink)]" aria-live="polite">{connected.length} of {students.length}</span>
      <ul className="m-0 flex list-none items-center gap-1.5 p-0">
        {connected.map(({ s, i, devices }) => {
          const muted = devices.every((d) => !d.audio);
          return (
            <li key={s.childId} data-testid="hub-roster-here" data-child-id={s.childId} data-muted={muted ? "1" : "0"}
              className={`${chip} border-[var(--green-line)] bg-[var(--green-soft)] text-[var(--hub-green-ink)]`}>
              <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--green)]" />
              {label(s.childName, i)}
              {devices.length > 1 && <span className="text-[11px] font-extrabold opacity-80" title="Connected from more than one device">×{devices.length}</span>}
              {muted && <><Ico name="micOff" size={13} /><span className="sr-only">muted</span></>}
            </li>
          );
        })}
        {guests.map((g) => (
          <li key={g.sessionId} data-testid="hub-roster-guest" className={`${chip} border-[var(--gold-line)] bg-[var(--gold-soft)] text-[var(--brand-ink)]`} title="Someone joined who isn't matched to a student on this lesson">
            <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--gold)]" />{hideNames ? "Guest" : g.name || "Guest"}
            {!g.audio && <><Ico name="micOff" size={13} /><span className="sr-only">muted</span></>}
          </li>
        ))}
        {absent.map(({ s, i }) => (
          <li key={s.childId} data-testid="hub-roster-absent" data-child-id={s.childId} className={`${chip} border-[var(--line)] bg-transparent text-[var(--ink-3)]`}>
            <span aria-hidden className="h-2 w-2 rounded-full border border-[var(--ink-3)]" />{label(s.childName, i)}<span className="sr-only"> not connected</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
