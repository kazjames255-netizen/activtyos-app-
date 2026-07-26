"use client";

import { useState } from "react";
import { post as apiPost } from "@/lib/api";

export interface Note { by: string; role: string; text: string; at: string }

const stamp = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

/**
 * A shared accident/incident notes thread. Both the provider's staff and the
 * parent can add notes (backend gates who can post to which record); each note
 * shows who wrote it, their side, and when. Optimistic append on send.
 */
export function NotesThread({ id, notes, side, onAdded }: {
  id: string; notes?: Note[]; side: "staff" | "parent"; onAdded?: () => void;
}) {
  const [list, setList] = useState<Note[]>(notes ?? []);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    const t = text.trim();
    if (!t) return;
    setBusy(true); setErr(null);
    try {
      const res = await apiPost<{ note: Note }>(`/api/incidents/${encodeURIComponent(id)}/note`, { text: t });
      setList((l) => [...l, res.note]);
      setText("");
      onAdded?.();
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t add note"); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Notes {list.length > 0 && `· ${list.length}`}</div>
      {list.length > 0 ? (
        <div className="mb-2.5 flex flex-col gap-1.5">
          {list.map((n, i) => {
            const mine = n.role === side;
            const isParent = n.role === "parent";
            return (
              <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%] rounded-xl px-3 py-1.5" style={isParent ? { background: "#eef4fd" } : { background: "#f3f0f8" }}>
                  <div className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: isParent ? "#1d3a8f" : "#6a5a86" }}>{isParent ? "👪 " : "🏷️ "}{n.by}{n.role === "staff" ? " (staff)" : ""} · {stamp(n.at)}</div>
                  <div className="mt-0.5 text-[12.5px] leading-snug text-[var(--ink)]">{n.text}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mb-2 text-[12px] text-[var(--ink-3)]">No notes yet — {side === "parent" ? "add one for the provider" : "add one for the parent or your team"}.</p>
      )}
      <div className="flex items-center gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder={side === "parent" ? "Reply to the provider…" : "Add a note…"} className="flex-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] outline-none focus:border-[#1d3a8f]" />
        <button type="button" disabled={busy || !text.trim()} onClick={send} className="rounded-full bg-[#1d3a8f] px-4 py-1.5 text-[12.5px] font-extrabold text-white disabled:opacity-50">{busy ? "…" : "Send"}</button>
      </div>
      {err && <div className="mt-1.5 text-[11.5px] font-bold text-[var(--red)]">{err}</div>}
    </div>
  );
}
