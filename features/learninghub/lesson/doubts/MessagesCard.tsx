"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, Icon } from "../../kit";
import { errMsg } from "../../types";
import { askDoubt, replyDoubt, seenDoubt, sendDoubtMessage, type Doubt } from "./api";

// ONE component, two modes — the teacher's "Messages" and the student's "Ask your teacher" are the same threads
// (hubDoubts), just read from opposite sides: this is the same data the old per-card "Asked a question" alert and
// AskTeacher popup used, now surfaced as its own card instead of buried inside the lesson or a mini-screen card.

const relTime = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

export function MessagesCard({ mode, qs, doubts, onUpdate, students, collapsible, context }: {
  mode: "teacher" | "student"; qs: string; doubts: Doubt[]; onUpdate: (d: Doubt) => void;
  /** Teacher mode only: the roster, so a message can be started rather than only ever replied to. */
  students?: { childId: string; childName: string }[];
  /** Its own header becomes an open/close toggle for everything below it (composer + list) — the badge and title
   *  stay visible either way, so collapsing never hides that there's something waiting. */
  collapsible?: boolean;
  /** Student mode only: tags a new question with exactly what the pupil is looking at right now — the same
   *  "tied to the exact spot it was asked from" behaviour the old inline AskTeacher popup had, so this card can
   *  fully replace it rather than being a plainer, context-less copy. */
  context?: { noteId?: string; lessonTitle?: string; step?: string; slide?: number; questionId?: string | null; questionPrompt?: string | null };
}) {
  const [expanded, setExpanded] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [composerText, setComposerText] = useState("");
  const [composerBusy, setComposerBusy] = useState(false);
  const [composerErr, setComposerErr] = useState<string | null>(null);
  // Teacher mode: the composer is a deliberate "start a message" action, not always-on like the student's — most
  // of the time a tutor is replying, not initiating.
  const [composing, setComposing] = useState(false);
  const [toChild, setToChild] = useState("");

  const sorted = [...doubts].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  const unreadCount = doubts.filter((d) => (mode === "teacher" ? d.unreadByTutor : d.unreadByFamily)).length;

  const openReply = (d: Doubt) => {
    setOpenId(d.id); setText(""); setErr(null);
    if (mode === "teacher" && d.unreadByTutor) void seenDoubt(qs, d.id).then(() => onUpdate({ ...d, unreadByTutor: false })).catch(() => undefined);
  };

  const send = async (d: Doubt) => {
    if (!text.trim()) return;
    setBusy(true); setErr(null);
    try {
      const updated = mode === "teacher" ? await replyDoubt(qs, d.id, text.trim()) : await sendDoubtMessage(qs, d.id, text.trim());
      onUpdate(updated); setText(""); setOpenId(null);
    } catch (e) { setErr(errMsg(e, "Couldn't send that — try again")); }
    finally { setBusy(false); }
  };

  const sendNew = async () => {
    if (!composerText.trim() || (mode === "teacher" && !toChild)) return;
    setComposerBusy(true); setComposerErr(null);
    try {
      // A brand new, lesson-less thread — the same "general message" shape a plain "Ask my teacher" tap (student)
      // or the roster's own "Message" action (tutor) already produces elsewhere; here it's this card's own
      // composer instead of a lesson popup or a trip to the Questions tab.
      const created = await askDoubt(qs, { text: composerText.trim(), ...(mode === "teacher" ? { childId: toChild } : {}), ...(mode === "student" ? context : {}) });
      onUpdate(created); setComposerText(""); setComposing(false); setToChild("");
    } catch (e) { setComposerErr(errMsg(e, "Couldn't send that — try again")); }
    finally { setComposerBusy(false); }
  };

  return (
    <div className="overflow-hidden rounded-[14px] bg-white" style={{ border: "1px solid #E4E4EE" }} data-testid="messages-card">
      <div className={`flex items-center gap-2 px-4 py-3.5 ${collapsible ? "cursor-pointer" : ""}`} style={{ borderBottom: "1px solid #E4E4EE" }}
        onClick={collapsible ? () => setExpanded((e) => !e) : undefined}>
        <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]"><Icon name="chat" size={16} /></span>
        <div className="min-w-0 flex-1 text-[13.5px] font-extrabold text-[var(--ink)]">{mode === "teacher" ? "Messages" : "Ask your teacher"}</div>
        {unreadCount > 0 && (
          <span className="flex-none rounded-full px-2 py-0.5 text-[12px] font-extrabold" style={{ background: "#F59E0B", color: "#3A2400" }} data-testid="messages-unread-badge">{unreadCount}</span>
        )}
        {mode === "teacher" && !composing && expanded && (
          <button type="button" onClick={(e) => { e.stopPropagation(); setComposing(true); }} data-testid="messages-new-open"
            className="flex-none min-h-[44px] rounded-full border border-[var(--brand)] px-3 text-[12.5px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)]">New message</button>
        )}
        {collapsible && (
          <button type="button" onClick={(e) => { e.stopPropagation(); setExpanded((x) => !x); }} aria-label={expanded ? "Collapse" : "Expand"} data-testid="messages-toggle"
            className="flex-none grid h-7 w-7 place-items-center rounded-full text-[var(--ink-2)] hover:bg-[var(--panel)]">
            <Icon name="chevronDown" size={16} className={`transition-transform ${expanded ? "" : "-rotate-90"}`} />
          </button>
        )}
      </div>

      {expanded && mode === "student" && (
        <div className="p-4" style={{ borderBottom: "1px solid #E4E4EE" }}>
          <label htmlFor="messages-composer" className="sr-only">Ask a question</label>
          <textarea id="messages-composer" value={composerText} onChange={(e) => setComposerText(e.target.value)} maxLength={2000}
            placeholder="Stuck? Ask a question…" style={{ minHeight: 72 }}
            className="w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--ink)]" />
          {composerErr && <p role="alert" className="m-0 mt-1.5 text-[12px] font-semibold text-[var(--red)]">{composerErr}</p>}
          <button type="button" onClick={() => void sendNew()} disabled={composerBusy || !composerText.trim()} data-testid="messages-composer-send"
            className="mt-2 min-h-[44px] w-full rounded-lg bg-[var(--brand)] text-[13px] font-extrabold text-white disabled:opacity-50">{composerBusy ? "Sending…" : "Send"}</button>
        </div>
      )}

      {expanded && mode === "teacher" && composing && (
        <div className="p-4" style={{ borderBottom: "1px solid #E4E4EE" }}>
          <label htmlFor="messages-new-child" className="mb-1 block text-[12px] font-bold text-[var(--ink-2)]">To</label>
          <select id="messages-new-child" value={toChild} onChange={(e) => setToChild(e.target.value)} data-testid="messages-new-child"
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--ink)]">
            <option value="">Choose a student…</option>
            {(students ?? []).map((s) => <option key={s.childId} value={s.childId}>{s.childName}</option>)}
          </select>
          <label htmlFor="messages-new-text" className="sr-only">Message</label>
          <textarea id="messages-new-text" value={composerText} onChange={(e) => setComposerText(e.target.value)} maxLength={2000}
            placeholder="Write a message…" style={{ minHeight: 72 }}
            className="mt-2 w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--ink)]" />
          {composerErr && <p role="alert" className="m-0 mt-1.5 text-[12px] font-semibold text-[var(--red)]">{composerErr}</p>}
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => void sendNew()} disabled={composerBusy || !composerText.trim() || !toChild} data-testid="messages-new-send"
              className="min-h-[44px] flex-1 rounded-lg bg-[var(--brand)] text-[13px] font-extrabold text-white disabled:opacity-50">{composerBusy ? "Sending…" : "Send"}</button>
            <button type="button" onClick={() => { setComposing(false); setComposerText(""); setToChild(""); setComposerErr(null); }}
              className="min-h-[44px] rounded-lg border border-[var(--line)] px-3.5 text-[13px] font-extrabold text-[var(--ink-2)] hover:bg-[var(--panel)]">Cancel</button>
          </div>
        </div>
      )}

      <div style={{ maxHeight: expanded ? 360 : 0, overflowY: "auto" }}>
        {sorted.length === 0 ? (
          <p className="m-0 p-4 text-center text-[13px] text-[var(--ink-3)]">
            {mode === "teacher" ? "No messages yet. Student questions will appear here." : "No questions yet. Ask your teacher anything about this lesson."}
          </p>
        ) : sorted.map((d) => (
          <MessageRow key={d.id} mode={mode} doubt={d} open={openId === d.id} qs={qs}
            text={openId === d.id ? text : ""} onText={setText} busy={busy} err={openId === d.id ? err : null}
            onOpenReply={() => openReply(d)} onSend={() => void send(d)} onUpdate={onUpdate} />
        ))}
      </div>
    </div>
  );
}

function MessageRow({ mode, doubt, open, qs, text, onText, busy, err, onOpenReply, onSend, onUpdate }: {
  mode: "teacher" | "student"; doubt: Doubt; open: boolean; qs: string; text: string; onText: (t: string) => void;
  busy: boolean; err: string | null; onOpenReply: () => void; onSend: () => void; onUpdate: (d: Doubt) => void;
}) {
  const unread = mode === "teacher" ? doubt.unreadByTutor : doubt.unreadByFamily;
  const last = doubt.messages[doubt.messages.length - 1];
  const teacherReplies = doubt.messages.filter((m) => m.from === "tutor");
  const rowRef = useRef<HTMLDivElement>(null);

  // Student mode: a reply is marked read once it's actually been seen on screen, not the instant it lands.
  useEffect(() => {
    if (mode !== "student" || !unread || !rowRef.current) return;
    const el = rowRef.current;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) { void seenDoubt(qs, doubt.id).then(() => onUpdate({ ...doubt, unreadByFamily: false })).catch(() => undefined); io.disconnect(); }
    }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, unread, doubt.id]);

  return (
    <div ref={rowRef} className="px-4 py-3" style={{ borderBottom: "1px solid #F0F0F5", background: unread ? "#FFFBEB" : undefined }} data-testid="messages-row">
      <div className="flex items-center gap-2">
        {unread && <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: "#F59E0B" }} />}
        {mode === "teacher" && <Avatar name={doubt.childName} size={28} />}
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--ink)]">{mode === "teacher" ? doubt.childName : "You"}</span>
        <span className="flex-none text-[11px] text-[var(--ink-3)]">{relTime(doubt.lastAt)}</span>
      </div>
      <p className="m-0 mt-1 line-clamp-3 text-[13px] leading-snug text-[var(--ink)]">{last?.text}</p>

      {mode === "teacher" ? (
        open ? (
          <div className="mt-2">
            <textarea value={text} onChange={(e) => onText(e.target.value)} maxLength={4000} rows={2} autoFocus placeholder="Your reply…"
              className="w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)]" />
            {err && <p role="alert" className="m-0 mt-1 text-[12px] font-semibold text-[var(--red)]">{err}</p>}
            <button type="button" onClick={onSend} disabled={busy || !text.trim()} data-testid="messages-reply-send"
              className="mt-1.5 min-h-[44px] rounded-full bg-[var(--brand)] px-3.5 text-[12.5px] font-extrabold text-white disabled:opacity-50">{busy ? "Sending…" : "Send"}</button>
          </div>
        ) : (
          <button type="button" onClick={onOpenReply} data-testid="messages-reply-open"
            className="mt-2 min-h-[44px] rounded-full border border-[var(--line)] px-3.5 text-[12.5px] font-extrabold text-[var(--ink-2)] hover:bg-[var(--panel)]">Reply</button>
        )
      ) : teacherReplies.length > 0 ? (
        <div className="ml-4 mt-2 rounded-lg p-2.5" style={{ background: "#E6F4EA" }}>
          <div className="text-[11.5px] font-extrabold text-[var(--ink)]">{teacherReplies[teacherReplies.length - 1]!.byName} · {relTime(teacherReplies[teacherReplies.length - 1]!.at)}</div>
          <p className="m-0 mt-0.5 text-[13px] leading-snug text-[var(--ink)]">{teacherReplies[teacherReplies.length - 1]!.text}</p>
        </div>
      ) : (
        <span className="mt-1.5 inline-block rounded-full bg-[var(--panel)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-3)]">Waiting for reply</span>
      )}
    </div>
  );
}
