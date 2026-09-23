"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { HubSettings } from "@/lib/hubConfig";
import { useRealtime } from "@/lib/realtime";
import { FOCUS, Icon } from "../../kit";
import { Modal } from "../../shared-assess/ui";
import { Btn } from "../lessonUi";
import { errMsg } from "../../types";
import { askDoubt, listDoubts, seenDoubt, sendDoubtMessage, type Doubt } from "./api";
import { LessonPeek } from "./LessonPeek";

const POLL_MS = 15_000;

/** What the pupil is looking at right now, so a question is tied to the exact spot it was asked from — a slide's
 *  title, or a warm-up/quiz question's real prompt (never a bare step name). */
export interface AskContext { step: string; slide: number; questionId: string | null; questionPrompt: string | null }

/** Modal (shared-assess/ui.tsx) is a plain `fixed inset-0` div, not portaled — nested inside anything with its own
 *  stacking context (a `position: sticky` header, say) its "full screen" resolves against that ancestor's box
 *  instead of the viewport. AskTeacher always renders in the main step content, never the header, but portal
 *  anyway so it's never at the mercy of wherever a future caller mounts it. */
// #learning-hub carries CSS-variable overrides (a warm light palette, forced regardless of the pupil's/parent's
// own dark-mode preference) that every hub overlay depends on — portalling past it to document.body falls back
// to the app's plain :root tokens instead, which on a dark-mode account renders this black-on-black.
const Portal = ({ children }: { children: React.ReactNode }) => {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.getElementById("learning-hub") ?? document.body);
};

/** "Ask my teacher" — a big, clearly-labelled banner in the lesson's main content (one per step). A real two-way
 *  thread: the tutor's reply (from the hub's Questions tab) pops up here as soon as it lands, even if the pupil has
 *  moved on to another step/slide, and they can keep replying right from the popup. */
export function AskTeacher({ qs, childId, noteId, lessonTitle, context, config }: { qs: string; childId: string | null; noteId: string; lessonTitle: string; context: AskContext; config: HubSettings }) {
  const [open, setOpen] = useState(false);
  // Known so far for THIS exact spot (step/slide/question) — kept up to date by polling/realtime even while the
  // popup is closed, so closing it never loses the thread: the banner below keeps showing its state, and reopening
  // it (the SAME banner, not a fresh "Ask a question") is how a pupil gets back to a reply, in-lesson, without
  // having to leave for the hub's Questions tab.
  const [thread, setThread] = useState<Doubt | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [autoPopup, setAutoPopup] = useState(false);
  const seen = useRef(new Set<string>());

  const check = useCallback(() => {
    if (!childId) return;
    listDoubts(qs, { noteId }).then((rows) => {
      const mine = rows.filter((d) => d.step === context.step && d.slide === context.slide && d.questionId === context.questionId);
      const latest = mine.length ? mine.reduce((a, b) => (a.lastAt > b.lastAt ? a : b)) : null;
      if (latest) setThread(latest);
      const fresh = mine.find((d) => d.unreadByFamily && !seen.current.has(d.id));
      if (fresh) { seen.current.add(fresh.id); setViewOpen(true); setAutoPopup(true); }
    }).catch(() => undefined);
  }, [qs, noteId, childId, context.step, context.slide, context.questionId]);
  useEffect(() => { check(); const t = setInterval(check, POLL_MS); return () => clearInterval(t); }, [check]);
  useRealtime(["hubDoubts"], check);

  const close = () => setViewOpen(false);
  const preview = thread?.messages[thread.messages.length - 1] ?? null;

  return (
    <>
      <button type="button" onClick={() => (thread ? setViewOpen(true) : setOpen(true))} disabled={!childId} data-testid="ask-teacher-open"
        className={`mt-4 flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left transition hover:brightness-[0.98] disabled:opacity-40 ${FOCUS} ${thread?.unreadByFamily ? "border-[var(--gold)] bg-[var(--gold-soft,#fdf3d8)]" : "border-[var(--brand-line)] bg-[var(--brand-soft)]"}`}>
        <span aria-hidden className="grid h-11 w-11 flex-none place-items-center rounded-full bg-[var(--surface)] text-[var(--brand)]"><Icon name="help" size={22} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15.5px] font-extrabold text-[var(--brand-strong)]">
            {thread ? (thread.unreadByFamily ? "Your teacher replied!" : "Your question") : "Ask a question"}
          </span>
          {preview ? (
            <span className="mt-0.5 block truncate text-[12.5px] font-semibold text-[var(--ink-2)]">
              {preview.from === "child" ? "You: " : `${preview.byName}: `}{preview.text}
            </span>
          ) : (
            <span className="block text-[12.5px] font-semibold text-[var(--ink-2)]">Stuck, or need help on this? Ask your teacher — they'll reply here.</span>
          )}
        </span>
        {thread?.unreadByFamily && <span aria-hidden className="h-2.5 w-2.5 flex-none rounded-full bg-[var(--red)]" />}
      </button>
      {open && (
        <Portal>
          <AskComposer qs={qs} childId={childId} noteId={noteId} lessonTitle={lessonTitle} context={context} onClose={() => setOpen(false)}
            onSent={(d) => { setOpen(false); seen.current.add(d.id); setThread(d); setViewOpen(true); setAutoPopup(false); }} />
        </Portal>
      )}
      {viewOpen && thread && (
        <Portal>
          <ThreadView qs={qs} thread={thread} auto={autoPopup} config={config} onClose={close} onUpdate={setThread} />
        </Portal>
      )}
    </>
  );
}

function AskComposer({ qs, childId, noteId, lessonTitle, context, onClose, onSent }: { qs: string; childId: string | null; noteId: string; lessonTitle: string; context: AskContext; onClose: () => void; onSent: (d: Doubt) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    if (!text.trim() || !childId) return;
    setBusy(true); setErr(null);
    try {
      const d = await askDoubt(qs, { noteId, lessonTitle, step: context.step, slide: context.slide, questionId: context.questionId, questionPrompt: context.questionPrompt, text: text.trim() });
      onSent(d);
    } catch (e) { setErr(errMsg(e, "Couldn't send that — try again")); setBusy(false); }
  };

  return (
    <Modal title="Ask a question" onClose={onClose} footer={<><Btn tone="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={send} disabled={busy || !text.trim()} data-testid="ask-teacher-send">{busy ? "Sending…" : "Send"}</Btn></>}>
      <div className="space-y-3">
        {context.questionPrompt && <p className="m-0 rounded-xl bg-[var(--panel)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--ink-2)]">About: “{context.questionPrompt}”</p>}
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={4} autoFocus
          placeholder="What would you like to ask?" data-autofocus data-testid="ask-teacher-text"
          className={`w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ${FOCUS}`} />
        {err && <p role="alert" className="m-0 text-[13px] font-semibold text-[var(--red)]">{err}</p>}
      </div>
    </Modal>
  );
}

/** The whole thread, both sides, oldest first — with a box to keep replying. Marks the family's side seen on open.
 *  A "View slide" tab mirrors the tutor's own Questions-tab thread view: the exact spot this was raised from
 *  (a slide, or a warm-up/quiz question), read-only — never buried a level deeper than the tutor already gets it. */
function ThreadView({ qs, thread, auto, config, onClose, onUpdate }: { qs: string; thread: Doubt; auto: boolean; config: HubSettings; onClose: () => void; onUpdate: (d: Doubt) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [peek, setPeek] = useState(false);

  useEffect(() => { void seenDoubt(qs, thread.id).catch(() => undefined); }, [qs, thread.id]);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true); setErr(null);
    try { const d = await sendDoubtMessage(qs, thread.id, text.trim()); onUpdate(d); setText(""); }
    catch (e) { setErr(errMsg(e, "Couldn't send that — try again")); }
    finally { setBusy(false); }
  };

  return (
    <>
    <Modal title={auto ? "Your tutor replied" : "Ask a question"}
      headerExtra={thread.noteId && (
        <button type="button" onClick={() => setPeek(true)} data-testid="ask-teacher-view-slide"
          className={`inline-flex min-h-[36px] flex-none items-center gap-1.5 rounded-full border border-[var(--brand)] px-3 text-[12.5px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}>
          <Icon name="external" size={14} />View slide
        </button>
      )}
      onClose={onClose}
      footer={
        <div className="flex w-full items-end gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={1}
            placeholder="Reply…" data-testid="ask-teacher-followup"
            className={`min-h-[40px] flex-1 resize-none rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--ink)] ${FOCUS}`} />
          <Btn onClick={send} disabled={busy || !text.trim()} data-testid="ask-teacher-followup-send">{busy ? "…" : "Send"}</Btn>
        </div>
      }>
      <div className="space-y-2.5">
        {thread.questionPrompt && <p className="m-0 rounded-xl bg-[var(--panel)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--ink-2)]">About: “{thread.questionPrompt}”</p>}
        {thread.messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === "child" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug ${m.from === "child" ? "bg-[var(--brand)] text-white" : "border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>
              {m.text}
              <div className={`mt-1 text-[11px] font-semibold ${m.from === "child" ? "text-white/70" : "text-[var(--ink-3)]"}`}>{m.from === "tutor" ? m.byName : "You"}</div>
            </div>
          </div>
        ))}
        {err && <p role="alert" className="m-0 text-[13px] font-semibold text-[var(--red)]">{err}</p>}
      </div>
    </Modal>
    {peek && thread.noteId && (
      <LessonPeek qs={qs} noteId={thread.noteId} step={thread.step} slide={thread.slide} questionId={thread.questionId}
        lessonTitle={thread.lessonTitle} config={config} onClose={() => setPeek(false)} />
    )}
    </>
  );
}
