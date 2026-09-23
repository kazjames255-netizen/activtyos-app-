"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get } from "@/lib/api";
import type { HubSettings } from "@/lib/hubConfig";
import { Icon } from "../kit";
import { LessonPlayer, type InPersonSlots } from "../lesson/LessonPlayer";
import { Btn, LessonStyles } from "../lesson/lessonUi";
import { Switch } from "../shared-assess/ui";
import { setHubIntent } from "../hubIntent";
import { Dialog, FOCUS, FullscreenPortal, StudentPicker } from "../teachKit";
import { errMsg, type HubGroup, type Note, type Student } from "../types";
import { CaptureGrid } from "./CaptureGrid";
import { createSession, endSession, listLiveSessions, setAttendance, submitClass, type IpSession } from "./api";
import { newKey } from "./inKit";
import { ResultsPanel, warmTally } from "./ResultsPanel";
import { SetupStep, type SetupChoice } from "./SetupStep";
import { useClassState } from "./useClassState";
import { WarmupExtra } from "./WarmupExtra";

// "Teach in person": the tutor runs a lesson or quiz on THEIR device with children beside them — no video call. This is the
// full-screen shell: set up (what + who) → run (the lesson player with a capture grid for the quiz, or the grid on its own) → results.
// Every child's answers are recorded as a real attempt (server/src/routes/hub/inPersonApi.ts); nothing here marks anything.

export interface InPersonPreset { noteId?: string; assessmentId?: string; childIds?: string[]; groupIds?: string[] }
export interface InPersonProps {
  qs: string; config: HubSettings; preset?: InPersonPreset;
  /** Jump to another hub tab (the Homework form for a follow-up). */
  goTo?: (key: "homework") => void;
  onClose: () => void;
}

export function InPersonApp({ qs, config, preset = {}, goTo, onClose }: InPersonProps) {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [groups, setGroups] = useState<HubGroup[]>([]);
  const [live, setLive] = useState<IpSession[]>([]);
  const [session, setSession] = useState<IpSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const key = useRef(newKey());

  useEffect(() => {
    let alive = true;
    get<Student[]>(`/api/learning-hub/students${qs}`).then((r) => { if (alive) setStudents(Array.isArray(r) ? r : []); }).catch((e) => { if (alive) { setStudents([]); setErr(errMsg(e, "Couldn't load your students")); } });
    get<HubGroup[]>(`/api/learning-hub/groups${qs}`).then((r) => { if (alive) setGroups(Array.isArray(r) ? r : []); }).catch(() => undefined);
    listLiveSessions(qs).then((r) => { if (alive) setLive(Array.isArray(r) ? r : []); }).catch(() => undefined);
    return () => { alive = false; };
  }, [qs]);

  const start = async (c: SetupChoice) => {
    setBusy(true); setErr(null);
    try {
      const s = await createSession(qs, { childIds: c.childIds, groupIds: c.groupIds.length ? c.groupIds : undefined, noteId: c.noteId, assessmentId: c.assessmentId, title: c.title, key: key.current });
      key.current = newKey();
      setSession(s);
    } catch (e) { setErr(errMsg(e, "Couldn't start the session")); }
    finally { setBusy(false); }
  };

  return (
    <FullscreenPortal>
      <div className="fixed inset-0 z-[300] overflow-y-auto overscroll-contain bg-[var(--bg)] text-[var(--ink)]" role="dialog" aria-modal="true" aria-label="Teach in person" data-testid="inperson-app">
        <LessonStyles />
        {session ? (
          <SessionRunner key={session.id} qs={qs} config={config} initial={session} roster={students ?? []} goTo={goTo} onClose={onClose} />
        ) : (
          <div className="mx-auto w-full max-w-[820px] p-3 sm:p-6">
            {students === null ? (
              // Never a bare blank screen: the full-screen layer says what it is, that it's loading, and offers a way back out.
              <div role="status" aria-live="polite" className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="m-0 text-[18px] font-extrabold text-[var(--ink)]">Teach in person</h2>
                    <p className="m-0 mt-1 text-[13px] text-[var(--ink-2)]">Loading your students…</p>
                  </div>
                  <button type="button" onClick={onClose} className={`min-h-[44px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-[13px] font-extrabold text-[var(--ink)] hover:border-[var(--ink-3)] ${FOCUS}`}>Cancel</button>
                </div>
                <div className="mt-4 h-28 animate-pulse rounded-xl bg-[var(--panel)]" />
              </div>
            ) : (
              <SetupStep qs={qs} students={students} groups={groups} preset={preset} live={live} busy={busy} error={err} onStart={start} onResume={(s) => setSession(s)} onCancel={onClose} />
            )}
          </div>
        )}
      </div>
    </FullscreenPortal>
  );
}

/** The live in-person run: header (leave / who's here) + the lesson player (or bare capture grid for a quiz-only
 *  session) + results. Exported so a tutor's own lesson PREVIEW (NotesPanel.tsx) can swap into the SAME component
 *  inline once a session is created there via GoLivePicker, instead of mounting a separate full-screen app. */
export function SessionRunner({ qs, config, initial, roster, goTo, onClose }: { qs: string; config: HubSettings; initial: IpSession; roster: Student[]; goTo?: (key: "homework") => void; onClose: () => void }) {
  const store = useClassState(initial.id);
  const [sess, setSess] = useState<IpSession>(initial);
  const [note, setNote] = useState<Note | null>(null);
  const [noteErr, setNoteErr] = useState<string | null>(null);
  const [hideNames, setHideNames] = useState(false);
  const [leave, setLeave] = useState(false);
  const [who, setWho] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [quiz, setQuiz] = useState<{ id: string; title: string; passMark: number | null } | null>(null);
  const [stage, setStage] = useState<"capture" | "results">(() => (Object.keys(store.state.results).length ? "results" : "capture"));

  useEffect(() => {
    if (!initial.noteId) return;
    let alive = true;
    get<Note>(`/api/learning-hub/notes/${initial.noteId}${qs}`).then((n) => { if (alive) { if (n.lesson) setNote(n); else setNoteErr("That lesson isn't interactive, so it can't be run in person. Pick a quiz instead."); } })
      .catch((e) => { if (alive) setNoteErr(errMsg(e, "Couldn't open that lesson")); });
    return () => { alive = false; };
  }, [initial.noteId, qs]);

  const present = useMemo(() => sess.students.filter((s) => s.present), [sess.students]);
  const assessmentId = initial.noteId ? quiz?.id ?? store.state.assessmentId : initial.assessmentId;

  const handIn = useCallback(async (childIds: string[], override?: boolean): Promise<boolean> => {
    const id = initial.noteId ? quiz?.id ?? store.state.assessmentId : initial.assessmentId;
    if (!id) return false;
    setErr(null);
    try {
      const r = await submitClass(qs, initial.id, {
        assessmentId: id, override,
        children: childIds.map((c) => ({
          childId: c,
          answers: Object.entries(store.state.cells[c] ?? {}).map(([questionId, cell]) => ({ questionId, ...(cell.response !== undefined ? { response: cell.response } : {}), ...(cell.verdict ? { verdict: cell.verdict } : {}) })),
        })),
      });
      store.setResults(r.results);
      return true;
    } catch (e) { setErr(errMsg(e, "Couldn't record the results — nothing was lost, try again")); return false; }
  }, [qs, initial.id, initial.noteId, initial.assessmentId, quiz?.id, store]);

  const toggleHere = async (childId: string, here: boolean) => {
    setErr(null);
    try { setSess(await setAttendance(qs, initial.id, { [childId]: here })); } catch (e) { setErr(errMsg(e, "Couldn't update who is here")); }
  };
  const addChildren = async (ids: string[]) => {
    if (!ids.length) return;
    setErr(null);
    try { setSess(await setAttendance(qs, initial.id, {}, ids)); } catch (e) { setErr(errMsg(e, "Couldn't add them")); }
  };

  const finish = async (after?: () => void) => {
    setFinishing(true); setErr(null);
    try {
      await endSession(qs, initial.id, warmTally(store));
      store.clear();
      after?.();
      onClose();
    } catch (e) { setErr(errMsg(e, "Couldn't finish the session")); setFinishing(false); }
  };
  const followUp = goTo ? (childIds: string[]) => {
    void finish(() => {
      setHubIntent({
        kind: "homework", groupId: "", assessmentId: assessmentId ?? undefined, noteIds: initial.noteId ? [initial.noteId] : undefined, childIds,
        title: `Follow-up: ${initial.title}`, instructions: `A little more practice after our lesson together on “${initial.title}”.`,
      });
      goTo("homework");
    });
  } : undefined;

  const results = (
    <ResultsPanel session={sess} students={sess.students} quizTitle={quiz?.title ?? null} hasQuiz={!!assessmentId || Object.keys(store.state.results).length > 0} passMark={quiz?.passMark ?? null}
      store={store} hideNames={hideNames} retry={async (c) => { await handIn([c], true); }} toggleHere={toggleHere} followUp={followUp} finish={() => void finish()} finishing={finishing} />
  );

  const slots: InPersonSlots = {
    banner: (
      <div role="note" data-testid="ip-banner" className="mb-3 rounded-xl border border-[var(--line)] border-l-4 border-l-[var(--brand-2)] bg-[var(--panel)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--ink)]">
        In-person lesson with {present.length} {present.length === 1 ? "child" : "children"}. Teach from here; you&apos;ll tap in each child&apos;s answers at the quiz and they&apos;re recorded for their parents.
      </div>
    ),
    quiz: ({ quiz: qz, onFinish, onBack }) => (
      <QuizSlot key={qz.id} quiz={qz} onSeen={(t) => setQuiz((cur) => (cur?.id === qz.id ? cur : { id: qz.id, title: t.title, passMark: null }))}>
        <CaptureGrid qs={qs} sessionId={initial.id} assessmentId={qz.id} roster={present} store={store} hideNames={hideNames} onBack={onBack} handIn={handIn} onDone={() => { store.setAssessment(qz.id); onFinish(); }} />
      </QuizSlot>
    ),
    warmupExtra: (q) => <WarmupExtra q={q} noteId={initial.noteId!} qs={qs} roster={present} store={store} hideNames={hideNames} config={config} />,
    done: () => results,
  };

  return (
    <div className="mx-auto w-full max-w-[900px] p-3 sm:p-6" data-testid="inperson-run" data-session={initial.id}>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 shadow-[var(--shadow-sm)]">
        <button type="button" onClick={() => setLeave(true)} aria-label="Leave the class session" data-testid="ip-leave" className={`grid h-11 w-11 flex-none place-items-center rounded-xl text-[var(--ink-2)] hover:bg-[var(--panel)] ${FOCUS}`}><Icon name="close" size={20} /></button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--brand)]">In-person</div>
          <div className="truncate text-[14px] font-extrabold text-[var(--ink)]">{sess.title}</div>
        </div>
        <Switch on={hideNames} onChange={setHideNames} label="Hide names" />
        <button type="button" onClick={() => setWho(true)} data-testid="ip-who-btn" className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-3.5 text-[13px] font-extrabold text-[var(--ink)] hover:border-[var(--brand-2)] ${FOCUS}`}>
          <Icon name="users" size={16} />{present.length} of {sess.students.length} here
        </button>
      </div>
      {err && <p role="alert" className="mb-3 rounded-xl bg-[var(--red-soft)] px-3.5 py-2.5 text-[13.5px] font-semibold text-[var(--red)]" data-testid="ip-error">{err}</p>}

      {initial.noteId ? (
        noteErr ? <p role="alert" className="rounded-xl bg-[var(--red-soft)] px-3.5 py-2.5 text-[14px] font-semibold text-[var(--red)]">{noteErr}</p>
        : !note ? <div role="status" aria-label="Loading the lesson" className="h-40 animate-pulse rounded-2xl bg-[var(--panel)]" />
        : <LessonPlayer note={{ id: note.id, title: note.title, lesson: note.lesson }} qs={qs} childQs={qs} childId={null} config={config} readOnly inPerson={slots} onExit={() => setLeave(true)} />
      ) : !initial.assessmentId ? (
        results
      ) : stage === "results" ? results : (
        <QuizSlot key={initial.assessmentId} quiz={{ id: initial.assessmentId, title: initial.title }} onSeen={(t) => setQuiz({ id: initial.assessmentId!, title: t.title, passMark: null })}>
          <CaptureGrid qs={qs} sessionId={initial.id} assessmentId={initial.assessmentId} roster={present} store={store} hideNames={hideNames} handIn={handIn} onDone={() => { store.setAssessment(initial.assessmentId); setStage("results"); }} />
        </QuizSlot>
      )}

      {leave && (
        <Dialog title="Leave the class session?" onClose={() => setLeave(false)}
          footer={<><Btn tone="ghost" onClick={() => setLeave(false)}>Stay</Btn><Btn onClick={onClose} data-testid="ip-leave-confirm">Leave for now</Btn></>}>
          <p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]">Your taps are saved on this device and the session stays open. Choose <b className="text-[var(--ink)]">Teach in person</b> again to resume it. Answers you haven&apos;t marked yet aren&apos;t recorded for the children.</p>
        </Dialog>
      )}
      {who && (
        <Dialog title="Who's here?" subtitle="Untick anyone who isn't. Only children marked here are in the quiz." onClose={() => setWho(false)} footer={<Btn onClick={() => setWho(false)}>Done</Btn>}>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Attendance">
            {sess.students.map((s) => (
              <button key={s.childId} type="button" aria-pressed={s.present} onClick={() => void toggleHere(s.childId, !s.present)}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border-2 px-3.5 text-[13.5px] font-extrabold ${FOCUS} ${s.present ? "border-[var(--green)] bg-[var(--green-soft)] text-[var(--hub-green-ink)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-3)] line-through"}`}>
                {s.present && <Icon name="check" size={14} strokeWidth={3} />}{s.childName}
              </button>
            ))}
          </div>
          {roster.filter((r) => r.active !== false && !sess.childIds.includes(r.childId)).length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">Someone else turned up?</div>
              <AddChildren roster={roster.filter((r) => r.active !== false && !sess.childIds.includes(r.childId))} onAdd={addChildren} />
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}

/** Tells the shell which quiz (and its title) the capture grid is for, so the results screen and the hand-in know it. */
function QuizSlot({ quiz, onSeen, children }: { quiz: { id: string; title: string }; onSeen: (q: { title: string }) => void; children: React.ReactNode }) {
  useEffect(() => { onSeen({ title: quiz.title }); }, [quiz.id, quiz.title]); // eslint-disable-line react-hooks/exhaustive-deps
  return <>{children}</>;
}

function AddChildren({ roster, onAdd }: { roster: Student[]; onAdd: (ids: string[]) => void }) {
  const [ids, setIds] = useState<string[]>([]);
  return (
    <div>
      <StudentPicker students={roster} value={ids} onChange={setIds} idPrefix="ip-add" />
      <div className="mt-2"><Btn tone="ghost" disabled={!ids.length} onClick={() => { onAdd(ids); setIds([]); }} data-testid="ip-add-btn">Add {ids.length || ""} to this session</Btn></div>
    </div>
  );
}
