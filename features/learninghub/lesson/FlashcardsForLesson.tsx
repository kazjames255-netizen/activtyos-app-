"use client";

import { useEffect, useState } from "react";
import { get, post } from "@/lib/api";
import { Icon } from "../kit";
import { FOCUS, StudentPicker } from "../teachKit";
import { errMsg, type Student } from "../types";

// Right on the lesson itself — not a separate trip to the Flashcards tab — a tutor sees how many cards this
// lesson's topic has and can hand them to students with one click. A child's enrolment (Setup → subjects) only
// grants a whole SUBJECT; on a big shared curriculum most children have nothing picked there, and used to fall
// back to seeing every card in the tenant. This is the actual "give this topic's cards to these students" action
// (server: hubFlashcardAssignments, via POST /flashcards/assign) — the same idea as "Set for children" for
// homework, offered right where the tutor is already looking, so it's a click now or just as easily skipped for
// later from here or the Flashcards tab itself.
interface CardLite { id: string; front: string }

export function FlashcardsForLesson({ qs, topicId }: { qs: string; topicId: string }) {
  const [total, setTotal] = useState<number | null>(null);
  const [students, setStudents] = useState<Student[] | null>(null);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [value, setValue] = useState<string[]>([]);
  // "Choose specific cards": off by default (the whole topic, incl. cards added later) — the tutor opts into
  // picking individual cards only when they want less than the full deck.
  const [pickingCards, setPickingCards] = useState(false);
  const [cards, setCards] = useState<CardLite[] | null>(null);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const qp = (extra: string) => `${qs}${qs.includes("?") ? "&" : "?"}${extra}`;

  useEffect(() => {
    let alive = true;
    get<{ total: number }>(`/api/learning-hub/flashcards${qp(`topicId=${topicId}&limit=1`)}`).then((r) => { if (alive) setTotal(r.total ?? 0); }).catch(() => { if (alive) setTotal(0); });
    get<Student[]>(`/api/learning-hub/students${qs}`).then((r) => { if (alive) setStudents(Array.isArray(r) ? r.filter((s) => s.active !== false) : []); }).catch(() => undefined);
    get<{ childIds: string[] }>(`/api/learning-hub/flashcards/assigned${qp(`topicId=${topicId}`)}`).then((r) => { if (alive) { setAssignedIds(r.childIds ?? []); setValue(r.childIds ?? []); } }).catch(() => undefined);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs, topicId]);

  if (!total) return null; // nothing here yet — no point offering to assign an empty topic

  const openCardPicker = () => {
    setPickingCards(true);
    if (cards !== null) return;
    get<{ items: CardLite[] }>(`/api/learning-hub/flashcards${qp(`topicId=${topicId}&limit=200`)}`)
      .then((r) => { setCards(r.items); setSelectedCards(r.items.map((c) => c.id)); })
      .catch(() => setCards([]));
  };
  const toggleCard = (id: string) => setSelectedCards((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  const assign = async () => {
    if (!value.length) return;
    // Only send specific cardIds if the tutor actually narrowed it down — ticking every card and sending that
    // exact list would freeze the assignment to today's deck, silently missing anything added to the topic later.
    const cardIds = pickingCards && cards && selectedCards.length < cards.length ? selectedCards : undefined;
    setBusy(true); setErr(null);
    try {
      await post(`/api/learning-hub/flashcards/assign${qs}`, { topicId, childIds: value, ...(cardIds ? { cardIds } : {}) });
      setAssignedIds(value); setPicking(false); setPickingCards(false); setDone(true);
      setTimeout(() => setDone(false), 4000);
    } catch (e) { setErr(errMsg(e, "Couldn't assign those flashcards")); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3" data-testid="lesson-flashcards-assign">
      <div className="flex items-center gap-2.5">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-[var(--violet-soft)] text-[var(--violet)]"><Icon name="cards" size={19} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-extrabold text-[var(--ink)]">Flashcards</div>
          <div className="text-[11.5px] text-[var(--ink-3)]">{assignedIds.length > 0 ? `Given to ${assignedIds.length}` : "Not yet assigned"}</div>
        </div>
        <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-[var(--violet-soft)] text-[11px] font-extrabold text-[var(--violet)]">{total}</span>
      </div>
      {done && <p className="m-0 mt-2 text-[12.5px] font-bold text-[var(--hub-green-ink)]">Done — they&apos;ll see it next time they open flashcards.</p>}
      {!picking && !done && (
        <button type="button" onClick={() => setPicking(true)} data-testid="lesson-flashcards-assign-open"
          className={`mt-2.5 min-h-[36px] w-full rounded-lg border border-[var(--violet)] text-[12.5px] font-extrabold text-[var(--violet)] hover:bg-[var(--violet-soft)] ${FOCUS}`}>Send flashcards</button>
      )}
      {picking && (
        <div className="mt-2.5 text-left">
          <div className="mb-2 text-[12.5px] font-extrabold text-[var(--ink)]">{total} flashcard{total === 1 ? "" : "s"} for this topic — who gets it?</div>
          {students === null ? <div className="h-14 animate-pulse rounded-xl bg-[var(--panel)]" /> : (
            <StudentPicker students={students.map((s) => ({ childId: s.childId, childName: s.childName, yearGroup: null }))} value={value} onChange={setValue} idPrefix="fc-assign" />
          )}
          {!pickingCards ? (
            <button type="button" onClick={openCardPicker} data-testid="lesson-flashcards-choose-cards" className={`mt-2.5 text-[12px] font-extrabold text-[var(--violet)] hover:underline ${FOCUS}`}>
              Choose specific cards, not the whole topic
            </button>
          ) : (
            <div className="mt-2.5 rounded-lg border border-[var(--line)] p-2">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Cards ({selectedCards.length}/{cards?.length ?? 0})</span>
                <button type="button" onClick={() => setSelectedCards(selectedCards.length === (cards?.length ?? 0) ? [] : (cards ?? []).map((c) => c.id))}
                  className={`text-[11.5px] font-extrabold text-[var(--violet)] hover:underline ${FOCUS}`}>
                  {selectedCards.length === (cards?.length ?? 0) ? "Clear all" : "Select all"}
                </button>
              </div>
              {cards === null ? <div className="h-14 animate-pulse rounded-lg bg-[var(--panel)]" /> : (
                <div className="max-h-[160px] space-y-1 overflow-y-auto">
                  {cards.map((c) => (
                    <label key={c.id} className="flex items-start gap-1.5 rounded px-1 py-0.5 text-[12.5px] text-[var(--ink)] hover:bg-[var(--panel)]">
                      <input type="checkbox" checked={selectedCards.includes(c.id)} onChange={() => toggleCard(c.id)} className="mt-0.5 flex-none" />
                      <span className="min-w-0 truncate">{c.front}</span>
                    </label>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => setPickingCards(false)} className={`mt-1.5 text-[11.5px] font-extrabold text-[var(--ink-3)] hover:underline ${FOCUS}`}>Use the whole topic instead</button>
            </div>
          )}
          {err && <p role="alert" className="m-0 mt-2 text-[12.5px] font-semibold text-[var(--red)]">{err}</p>}
          <div className="mt-2.5 flex gap-2">
            <button type="button" onClick={() => void assign()} disabled={busy || !value.length || (pickingCards && !selectedCards.length)} data-testid="lesson-flashcards-assign-confirm"
              className={`min-h-[36px] rounded-full bg-[var(--violet)] px-3.5 text-[12.5px] font-extrabold text-white disabled:opacity-50 ${FOCUS}`}>{busy ? "Assigning…" : "Assign"}</button>
            <button type="button" onClick={() => setPicking(false)} className={`min-h-[36px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[12.5px] font-extrabold text-[var(--ink-2)] ${FOCUS}`}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
