"use client";

import { useEffect, useState } from "react";
import { ApiError, get, post } from "@/lib/api";
import { lessonHomeworkDraft } from "../hubIntent";
import { Icon } from "../kit";
import { FOCUS, StudentPicker } from "../teachKit";
import { errMsg, type Student } from "../types";

interface HwLite { id: string; noteIds: string[]; assignedChildIds: string[] }
interface Unreachable { childId: string; childName: string; reason: string }

/** Right alongside a lesson (its article view, or while actually teaching it live) — set THIS lesson as homework
 *  for students with one click, instead of leaving for the Homework tab. "Set for children" there still exists for
 *  the fuller form (a due date further out, a group, videos); this is the fast path for "yes, now". */
export function HomeworkForLesson({ qs, note }: { qs: string; note: { id: string; title: string; lesson?: unknown } }) {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [existing, setExisting] = useState<HwLite[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [value, setValue] = useState<string[]>([]);
  const [dueChoice, setDueChoice] = useState<number | "custom">(7);
  const [customDate, setCustomDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    get<Student[]>(`/api/learning-hub/students${qs}`).then((r) => { if (alive) setStudents(Array.isArray(r) ? r.filter((s) => s.active !== false) : []); }).catch(() => undefined);
    get<HwLite[]>(`/api/learning-hub/homework${qs}`).then((r) => { if (alive) setExisting(Array.isArray(r) ? r.filter((h) => h.noteIds.includes(note.id)) : []); }).catch(() => { if (alive) setExisting([]); });
    return () => { alive = false; };
  }, [qs, note.id]);

  const assignedIds = [...new Set((existing ?? []).flatMap((h) => h.assignedChildIds))];

  const assign = async () => {
    if (!value.length) return;
    if (dueChoice === "custom" && !customDate) { setErr("Pick a due date"); return; }
    setBusy(true); setErr(null); setWarn(null);
    const due = dueChoice === "custom" ? new Date(`${customDate}T23:59:59`) : (() => { const d = new Date(); d.setDate(d.getDate() + dueChoice); return d; })();
    const draft = lessonHomeworkDraft(note);
    const post1 = (childIds: string[]) => post<HwLite>(`/api/learning-hub/homework${qs}`, { ...draft, assignedChildIds: childIds, dueAt: due.toISOString() });
    try {
      let created: HwLite;
      try {
        created = await post1(value);
      } catch (e) {
        // A quiz that isn't set for someone's year/age never blocks the OTHERS from getting this homework — that's
        // what the fuller Homework tab form is for; here it's a warning, and everyone reachable still gets it.
        if (e instanceof ApiError && e.body && (e.body as { code?: string }).code === "quiz_unreachable") {
          const bad = (e.body as { unreachable: Unreachable[] }).unreachable;
          const rest = value.filter((id) => !bad.some((b) => b.childId === id));
          if (!rest.length) { setWarn(bad.map((b) => b.reason).join("; ")); setBusy(false); return; }
          created = await post1(rest);
          setWarn(`Set for everyone else — ${bad.map((b) => b.childName).join(", ")} couldn't be included: ${bad[0]!.reason}`);
        } else throw e;
      }
      setExisting((e) => [...(e ?? []), created]);
      setPicking(false); setDone(true);
      setTimeout(() => { setDone(false); setWarn(null); }, 6000);
    } catch (e) { setErr(errMsg(e, "Couldn't set that homework")); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3" data-testid="lesson-homework-assign">
      <div className="flex items-center gap-2.5">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]"><Icon name="homework" size={19} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-extrabold text-[var(--ink)]">Homework</div>
          <div className="text-[11.5px] text-[var(--ink-3)]">{assignedIds.length > 0 ? `Given to ${assignedIds.length}` : "Not yet set"}</div>
        </div>
        {assignedIds.length > 0 && <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-[var(--brand-soft)] text-[11px] font-extrabold text-[var(--brand)]">{assignedIds.length}</span>}
      </div>
      {done && !warn && <p className="m-0 mt-2 text-[12.5px] font-bold text-[var(--hub-green-ink)]">Done — it's in their Homework tab.</p>}
      {done && warn && <p role="alert" className="m-0 mt-2 text-[12.5px] font-bold text-[var(--gold-ink,#B45309)]">⚠️ {warn}</p>}
      {!picking && !done && (
        <button type="button" onClick={() => { setValue(assignedIds); setPicking(true); }} data-testid="lesson-homework-assign-open"
          className={`mt-2.5 min-h-[36px] w-full rounded-lg bg-[var(--brand)] text-[12.5px] font-extrabold text-white hover:brightness-110 ${FOCUS}`}>Set homework</button>
      )}
      {picking && (
        <div className="mt-2.5 text-left">
          <div className="mb-2 text-[12.5px] font-extrabold text-[var(--ink)]">Set this lesson as homework — who gets it?</div>
          {students === null ? <div className="h-14 animate-pulse rounded-xl bg-[var(--panel)]" /> : (
            <StudentPicker students={students.map((s) => ({ childId: s.childId, childName: s.childName, yearGroup: null }))} value={value} onChange={setValue} idPrefix="hw-assign" />
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12.5px] font-semibold text-[var(--ink-2)]">
            Due
            <select value={dueChoice} onChange={(e) => setDueChoice(e.target.value === "custom" ? "custom" : Number(e.target.value))}
              className={`rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12.5px] ${FOCUS}`}>
              <option value={0}>Today</option>
              <option value={1}>Tomorrow</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={14}>2 weeks</option>
              <option value="custom">Choose a date…</option>
            </select>
            {dueChoice === "custom" && (
              <input type="date" value={customDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setCustomDate(e.target.value)}
                data-testid="lesson-homework-due-date" className={`rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12.5px] ${FOCUS}`} />
            )}
          </div>
          {warn && !done && <p role="alert" className="m-0 mt-2 text-[12.5px] font-bold text-[var(--gold-ink,#B45309)]">⚠️ {warn} Nobody else was selected, so nothing was set.</p>}
          {err && <p role="alert" className="m-0 mt-2 text-[12.5px] font-semibold text-[var(--red)]">{err}</p>}
          <div className="mt-2.5 flex gap-2">
            <button type="button" onClick={() => void assign()} disabled={busy || !value.length} data-testid="lesson-homework-assign-confirm"
              className={`min-h-[36px] rounded-full bg-[var(--brand)] px-3.5 text-[12.5px] font-extrabold text-white disabled:opacity-50 ${FOCUS}`}>{busy ? "Setting…" : "Set homework"}</button>
            <button type="button" onClick={() => setPicking(false)} className={`min-h-[36px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[12.5px] font-extrabold text-[var(--ink-2)] ${FOCUS}`}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
