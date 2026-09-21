"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Select } from "@/components/ui";
import { get, put } from "@/lib/api";
import type { Note, Topic } from "../types";
import { topicLabel } from "../types";
import { FOCUS, Skeleton, withQs } from "../teachKit";
import type { QuizLite } from "./hwTypes";

// The homework form's pickers. A seeded provider has ~450 quizzes and ~450 lessons, so neither is a flat list any
// more: each is a search box over a SERVER-side search (`q`, `limit`), with the current choice always kept in the
// list so it never silently disappears while you type.

const useDebounced = <T,>(v: T, ms = 250) => {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
};

const QUIZ_LIMIT = 40;
export type QuizPick = QuizLite & { published?: boolean };

/** Quiz picker: a search box over a `<select>` grouped by subject. `selected` = the chosen quiz row (any state, incl. a draft). */
export function QuizSelect({ qs, value, selected, onChange, focus }: { qs: string; value: string; selected: QuizPick | null; onChange: (id: string) => void; focus?: boolean }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [res, setRes] = useState<{ items: QuizPick[]; total: number } | null>(null);
  useEffect(() => {
    let live = true;
    get<{ items: QuizPick[]; total: number } | QuizPick[]>(`/api/learning-hub/assessments${withQs(qs, { type: "quiz", light: "1", published: "1", limit: String(QUIZ_LIMIT), q: dq || undefined })}`)
      .then((r) => { if (live) setRes(Array.isArray(r) ? { items: r, total: r.length } : { items: r.items ?? [], total: r.total ?? 0 }); })
      .catch(() => { if (live) setRes({ items: [], total: 0 }); });
    return () => { live = false; };
  }, [qs, dq]);
  const groups = useMemo(() => {
    const items = [...(res?.items ?? [])];
    if (selected && !items.some((x) => x.id === selected.id)) items.unshift(selected);
    const by = new Map<string, QuizPick[]>();
    for (const x of items) by.set(x.subject || "Other", [...(by.get(x.subject || "Other") ?? []), x]);
    return [...by].sort((a, b) => a[0].localeCompare(b[0]));
  }, [res, selected]);
  if (res === null) return <Skeleton className="h-[44px]" />;
  const more = res.total > res.items.length;
  return (
    <div className="grid gap-1.5">
      {(
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search quizzes…" aria-label="Search quizzes" id="hub-hw-quiz-search"
          className={`min-h-[40px] w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand)] ${FOCUS}`} />
      )}
      <Select id="hub-hw-quiz" data-autofocus={focus ? true : undefined} className="min-h-[44px] w-full" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">No quiz</option>
        {groups.map(([subject, xs]) => (
          <optgroup key={subject} label={subject}>
            {xs.map((x) => <option key={x.id} value={x.id}>{x.title} · {x.questionCount} Qs{x.published === false ? " (draft)" : ""}</option>)}
          </optgroup>
        ))}
      </Select>
      {more && <p className="text-[11.5px] text-[var(--ink-3)]">Showing {res.items.length} of {res.total} — type to narrow it down.</p>}
      {!more && res.items.length === 0 && <p className="text-[11.5px] text-[var(--ink-3)]">{dq ? `No published quiz matches “${dq}”.` : "No published quizzes yet — build one in the Quizzes tab."}</p>}
    </div>
  );
}

const NOTE_LIMIT = 40;
/** Lesson picker: search + a short checklist (server search, sorted shelf by shelf). Attached lessons are shown by the form itself. */
export function NoteChecklist({ qs, topics, noteIds, onToggle, onSeen }: { qs: string; topics: Topic[]; noteIds: string[]; onToggle: (n: Note) => void; onSeen: (rows: Note[]) => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [res, setRes] = useState<{ items: Note[]; total: number } | null>(null);
  const topicById = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);
  const seenRef = useRef(onSeen);
  useEffect(() => { seenRef.current = onSeen; });
  useEffect(() => {
    let live = true;
    get<{ items: Note[]; total: number }>(`/api/learning-hub/notes${withQs(qs, { limit: String(NOTE_LIMIT), sort: "topic", q: dq || undefined })}`)
      .then((r) => { if (!live) return; const items = Array.isArray(r) ? (r as Note[]) : r.items ?? []; setRes({ items, total: Array.isArray(r) ? items.length : r.total ?? items.length }); seenRef.current(items); })
      .catch(() => { if (live) setRes({ items: [], total: 0 }); });
    return () => { live = false; };
  }, [qs, dq]);
  if (res === null) return <Skeleton className="h-[80px]" />;
  return (
    <div className="grid gap-1.5">
      {(
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lessons…" aria-label="Search lessons" id="hub-hw-note-search"
          className={`min-h-[40px] w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand)] ${FOCUS}`} />
      )}
      {res.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--line)] px-3 py-3 text-[12.5px] text-[var(--ink-3)]">{dq ? `No lesson matches “${dq}”.` : "No lessons yet — add some in the Lessons tab."}</p>
      ) : (
        <div className="max-h-[190px] overflow-y-auto rounded-xl border border-[var(--line)]">
          {res.items.map((n) => {
            const on = noteIds.includes(n.id);
            const t = topicById.get(n.topicId);
            return (
              <label key={n.id} className={`flex min-h-[44px] cursor-pointer items-center gap-2.5 border-b border-[var(--line)] px-3 py-1.5 last:border-b-0 hover:bg-[var(--panel)] ${on ? "bg-[var(--brand-soft)]" : ""}`}>
                <input type="checkbox" checked={on} onChange={() => onToggle(n)} className="h-4 w-4 accent-[var(--brand)]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-[var(--ink)]">{n.title}</span>
                  {t && <span className="block truncate text-[11px] text-[var(--ink-3)]">{topicLabel(t)}</span>}
                </span>
                {!n.published && <span className="rounded-full bg-[var(--gold-soft)] px-2 py-px text-[11px] font-bold text-[var(--brand-ink)]">Draft</span>}
              </label>
            );
          })}
        </div>
      )}
      {res.total > res.items.length && <p className="text-[11.5px] text-[var(--ink-3)]">Showing {res.items.length} of {res.total} — search to find the rest.</p>}
    </div>
  );
}

/** Publish a draft quiz from the homework form (same PUT the Quizzes tab's Publish button sends). */
export async function publishQuiz(qs: string, id: string): Promise<void> {
  const a = await get<{ type: string; title: string; subject: string; topicIds: string[]; questionIds?: string[]; timeLimitMins: number | null; passMarkPct: number; audience?: unknown; retakePolicy?: string; retakeCooldownHours?: number | null }>(`/api/learning-hub/assessments/${encodeURIComponent(id)}${qs}`);
  await put(`/api/learning-hub/assessments/${encodeURIComponent(id)}${qs}`, {
    type: a.type, title: a.title, subject: a.subject, topicIds: a.topicIds, questionIds: a.questionIds ?? [], timeLimitMins: a.timeLimitMins, passMarkPct: a.passMarkPct, published: true,
    ...(a.audience ? { audience: a.audience } : {}), ...(a.retakePolicy ? { retakePolicy: a.retakePolicy } : {}), ...(a.retakeCooldownHours != null ? { retakeCooldownHours: a.retakeCooldownHours } : {}),
  });
}

/** Publish a draft lesson (the server keeps its structured lesson / videos when they're omitted). */
export async function publishNote(qs: string, id: string): Promise<void> {
  const n = await get<Note>(`/api/learning-hub/notes/${encodeURIComponent(id)}${qs}`);
  await put(`/api/learning-hub/notes/${encodeURIComponent(id)}${qs}`, {
    topicId: n.topicId, title: n.title, body: n.body ?? "", published: true, attachments: (n.attachments ?? []).map((a) => ({ id: a.id, name: a.name })),
  });
}
