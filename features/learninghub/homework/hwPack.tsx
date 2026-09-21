"use client";

import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import type { Note } from "../types";
import { FOCUS, withQs } from "../teachKit";

// READY-MADE homework for a lesson. The server builds the suggestion from the lesson's own data
// (server/src/lib/hubHomeworkPack.ts, GET /notes/:id/homework-pack) — nothing is stored, and nothing is computed
// here. The homework form is prefilled from it (all editable) and this picker lets a tutor base a homework on any lesson.

export interface HomeworkPack {
  noteId: string; title: string; instructions: string; dueInDays: number; dueAt: string; noteIds: string[];
  assessmentId: string | null; quiz: { id: string; title: string; questionCount: number; published: boolean } | null;
  flashcardTopicId: string | null; flashcardCount: number; year: string | null; interactive: boolean; worksheetAssessmentId: string | null;
  basis: { keyIdeas: number; keywords: number; quiz: boolean; flashcards: number };
}

export const fetchHomeworkPack = (qs: string, noteId: string) => get<HomeworkPack>(`/api/learning-hub/notes/${encodeURIComponent(noteId)}/homework-pack${withQs(qs, {})}`);

/** "Base it on a lesson…": a search box over the tutor's lessons; picking one hands its pack to `onPick`. */
export function LessonPackPicker({ qs, activeTitle, busy, onPick }: { qs: string; activeTitle?: string | null; busy?: boolean; onPick: (n: Note) => void }) {
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [items, setItems] = useState<Note[] | null>(null);
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    if (!dq) { setItems(null); return; }
    let live = true;
    get<{ items: Note[] } | Note[]>(`/api/learning-hub/notes${withQs(qs, { lessons: "1", limit: "6", sort: "topic", q: dq })}`)
      .then((r) => { if (live) setItems(Array.isArray(r) ? r : r.items ?? []); }).catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, [qs, dq]);
  return (
    <div data-testid="hub-hw-pack-picker" className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
      <label htmlFor="hub-hw-pack-search" className="block text-[12.5px] font-extrabold text-[var(--ink)]">Base it on a lesson</label>
      <p className="mb-2 text-[11.5px] text-[var(--ink-3)]">{activeTitle ? <>Filled in from <b>{activeTitle}</b> — edit anything below.</> : "Pick a lesson and the title, instructions, quiz, flashcards and due date fill in for you."}</p>
      <input id="hub-hw-pack-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Base it on a lesson…" aria-label="Base it on a lesson" autoComplete="off"
        className={`min-h-[44px] w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand)] ${FOCUS}`} />
      {dq && items && (
        <div className="mt-1.5 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]" role="listbox" aria-label="Lessons">
          {items.length === 0 ? <p className="px-3 py-2.5 text-[12.5px] text-[var(--ink-3)]">No lesson matches “{dq}”.</p> : items.map((n) => (
            <button key={n.id} type="button" role="option" aria-selected={false} disabled={busy} onClick={() => { onPick(n); setQ(""); setItems(null); }}
              className={`flex min-h-[44px] w-full items-center gap-2 border-b border-[var(--line)] px-3 py-1.5 text-left text-[13px] font-bold text-[var(--ink)] last:border-b-0 hover:bg-[var(--brand-soft)] ${FOCUS}`}>
              <span className="min-w-0 flex-1 truncate">{n.title}</span>
              {!n.published && <span className="rounded-full bg-[var(--gold-soft)] px-2 py-px text-[11px] font-bold text-[var(--brand-ink)]">Draft</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
