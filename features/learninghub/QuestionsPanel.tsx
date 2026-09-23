"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRealtime } from "@/lib/realtime";
import { EmptyState, FOCUS, Icon, SkeletonRows } from "./kit";
import { useLinkOpen } from "./family/link";
import { useNewMessageRequest } from "./hubIntent";
import { LessonPeek } from "./lesson/doubts/LessonPeek";
import { askDoubt, listDoubts, replyDoubt, seenDoubt, sendDoubtMessage, type Doubt, type DoubtMsg } from "./lesson/doubts/api";
import type { PanelMeta, PanelProps } from "./panelTypes";
import { errMsg } from "./types";

// "Ask my teacher" threads, both sides of the same collection (hub/doubtsApi.ts):
//  - Tutor: "Student message centre" — one folder per student, sub-folders per lesson/topic, unread first. A
//    thread need not be about a lesson at all (StudentsPanel's roster "Message" action starts a plain one).
//  - Family: "Messages" — this child's own threads, grouped by lesson/topic (or "General" for a plain message).
//    Always here (one tab away), not just a popup mid-lesson — a question raised from inside a lesson shows up in
//    exactly the same place as one they come back to later. A bell notification for either side deep-links
//    straight to the thread (?open=doubt:<id>).

export const meta: PanelMeta = { key: "questions", label: "Messages", icon: "help", status: "live", blurb: "Messages between you and students — reply here." };

const POLL_MS = 15_000;
const STEP_LABEL: Record<string, string> = { start: "Start", learn: "Learn", slides: "Slide", words: "Key words", warm: "Warm-up", quiz: "Quiz", done: "Done" };
const GENERAL = "general";

/** Where a question came from, in words either side can act on without opening the lesson: the real slide title or
 *  question text, never a bare step name. Empty for a plain message with no lesson context. */
function whereLabel(d: Pick<Doubt, "noteId" | "step" | "slide" | "questionPrompt">): string {
  if (!d.noteId) return "";
  const step = STEP_LABEL[d.step] ?? d.step;
  if (d.step === "slides") return d.questionPrompt ? `${step} ${d.slide + 1} — "${d.questionPrompt}"` : `${step} ${d.slide + 1}`;
  return d.questionPrompt ? `${step} — "${d.questionPrompt}"` : step;
}
/** The thread list / header subtitle: lesson + where, or just "General message" when there's no lesson. */
function subtitleFor(d: Pick<Doubt, "noteId" | "lessonTitle" | "step" | "slide" | "questionPrompt">): string {
  if (!d.noteId) return "General message";
  const where = whereLabel(d);
  return where ? `${d.lessonTitle} · ${where}` : d.lessonTitle ?? "Lesson";
}
type BadgeTone = { bg: string; fg: string };
const STEP_TONE: Record<string, BadgeTone> = {
  start: { bg: "#eef0f6", fg: "#5b6478" },
  learn: { bg: "#e5f2fd", fg: "#1f77c9" },
  slides: { bg: "#e8ecfb", fg: "#2f3fa8" },
  words: { bg: "#e6f7f0", fg: "#0f7a52" },
  warm: { bg: "#FCE9CE", fg: "#B45309" },
  quiz: { bg: "#f6e9fb", fg: "#8a2fb0" },
  done: { bg: "#e6f7f0", fg: "#0f7a52" },
};

/** The thread header's subtitle, dressed up: the lesson name in brand ink, a coloured
 *  pill for which step it's from, and the actual question as a lively highlighted quote —
 *  instead of one flat grey line — so the thread reads as "about something", fast. */
function ThreadSubtitle(d: Pick<Doubt, "noteId" | "lessonTitle" | "step" | "slide" | "questionPrompt">) {
  if (!d.noteId) return <span className="italic text-[var(--ink-3)]">General message</span>;
  const tone = STEP_TONE[d.step] ?? STEP_TONE.start!;
  const stepLabel = STEP_LABEL[d.step] ?? d.step;
  const pillLabel = d.step === "slides" ? `${stepLabel} ${d.slide + 1}` : stepLabel;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="font-bold text-[var(--brand-2,#2f6bd8)]">✨ {d.lessonTitle ?? "Lesson"}</span>
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.03em]" style={{ background: tone.bg, color: tone.fg }}>
        {pillLabel}
      </span>
      {d.questionPrompt && (
        <span className="italic text-[var(--ink-2)]">&ldquo;{d.questionPrompt}&rdquo;</span>
      )}
    </span>
  );
}

const relTime = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

export function Panel(props: PanelProps) {
  return props.canEdit
    ? <TutorCentre qs={props.qs} config={props.config} students={props.students} />
    : <FamilyMessages qs={props.childQs ?? props.qs} childId={props.childId} config={props.config} />;
}

// ── Grouping: one folder per student (tutor) / per lesson (family), sub-folders per lesson/topic ────────────

interface Group { key: string; label: string; sub: SubGroup[]; unread: number }
interface SubGroup { key: string; label: string; rows: Doubt[]; unread: number }

function groupBy(rows: Doubt[], topLevel: "child" | "lesson", unreadOf: (d: Doubt) => boolean): Group[] {
  const byTop = new Map<string, Doubt[]>();
  for (const d of rows) {
    const k = topLevel === "child" ? d.childId : (d.noteId ?? GENERAL);
    (byTop.get(k) ?? byTop.set(k, []).get(k)!).push(d);
  }
  const groups: Group[] = [...byTop.entries()].map(([key, top]) => {
    const bySub = new Map<string, Doubt[]>();
    for (const d of top) {
      const k = topLevel === "child" ? (d.noteId ?? GENERAL) : (d.messages[0]?.at ?? d.id); // family: sub-folder per thread itself (one lesson already = the top level)
      (bySub.get(k) ?? bySub.set(k, []).get(k)!).push(d);
    }
    const sub: SubGroup[] = [...bySub.entries()].map(([skey, srows]) => {
      srows.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
      return { key: skey, label: topLevel === "child" ? (srows[0]!.lessonTitle ?? "General") : subtitleFor(srows[0]!), rows: srows, unread: srows.filter(unreadOf).length };
    });
    sub.sort((a, b) => Number(b.unread > 0) - Number(a.unread > 0) || b.rows[0]!.lastAt.localeCompare(a.rows[0]!.lastAt));
    return { key, label: topLevel === "child" ? top[0]!.childName : (top[0]!.lessonTitle ?? "General"), sub, unread: sub.reduce((n, s) => n + s.unread, 0) };
  });
  groups.sort((a, b) => Number(b.unread > 0) - Number(a.unread > 0) || b.sub[0]!.rows[0]!.lastAt.localeCompare(a.sub[0]!.rows[0]!.lastAt));
  return groups;
}

// ── Tutor: every thread across the roster, folder per student ───────────────

function TutorCentre({ qs, config, students }: { qs: string; config: PanelProps["config"]; students: PanelProps["students"] }) {
  const [rows, setRows] = useState<Doubt[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openChild, setOpenChild] = useState<string | null>(null);
  const [openLesson, setOpenLesson] = useState<string | null>(null);
  const [peek, setPeek] = useState(false);
  const [composing, setComposing] = useState<string | null>(null); // childId, once "New message" is picked
  const { id: linkId } = useLinkOpen("doubt");

  const load = useCallback(() => { listDoubts(qs).then(setRows).catch(() => undefined); }, [qs]);
  useEffect(() => { load(); const t = setInterval(load, POLL_MS); return () => clearInterval(t); }, [load]);
  useRealtime(["hubDoubts"], load);
  useNewMessageRequest(useCallback((childId: string) => setComposing(childId), []));

  const groups = useMemo(() => (rows ? groupBy(rows, "child", (d) => d.unreadByTutor) : []), [rows]);

  // A bell notification (?open=doubt:<id>) selects that thread and expands the folders it's in.
  useEffect(() => {
    if (!linkId || !rows) return;
    const hit = rows.find((d) => d.id === linkId);
    if (!hit) return;
    setOpenId(linkId); setOpenChild(hit.childId); setOpenLesson(hit.noteId ?? GENERAL);
  }, [linkId, rows]);
  useEffect(() => {
    if (openChild || !groups.length) return;
    setOpenChild(groups[0]!.key); setOpenLesson(groups[0]!.sub[0]?.key ?? null);
  }, [groups, openChild]);

  const flatRows = groups.flatMap((g) => g.sub.flatMap((s) => s.rows));
  const open = flatRows.find((d) => d.id === openId) ?? flatRows[0] ?? null;
  const update = (next: Doubt) => setRows((rs) => rs?.map((r) => (r.id === next.id ? next : r)) ?? null);
  const onCreated = (d: Doubt) => { setComposing(null); setRows((rs) => [...(rs ?? []), d]); setOpenId(d.id); setOpenChild(d.childId); setOpenLesson(d.noteId ?? GENERAL); };

  if (!rows) return <SkeletonRows rows={4} label="Loading messages" variant="card" />;

  return (
    <div id="hub-questions" className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start" data-testid="questions-panel">
      <div className="space-y-2 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto">
        <button type="button" onClick={() => setComposing(students[0]?.childId ?? "")} data-testid="question-new-message"
          className={`flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-[var(--brand-line)] px-3 py-2.5 text-[13px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}>
          <Icon name="plus" size={15} />New message
        </button>
        {!rows.length && <EmptyState id="hub-questions-empty" icon="help" title="No messages yet" body="When a student taps “Ask a question” inside a lesson, it shows up here." />}
        {groups.map((g) => (
          <div key={g.key} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
            <button type="button" onClick={() => setOpenChild(openChild === g.key ? null : g.key)} data-testid="question-folder-child"
              className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left ${FOCUS}`}>
              <Icon name="chevronRight" size={14} className={`flex-none transition-transform ${openChild === g.key ? "rotate-90" : ""}`} />
              <Icon name="folder" size={16} className="flex-none text-[var(--ink-3)]" />
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold text-[var(--ink)]">{g.label}</span>
              {g.unread > 0 && <span className="flex-none rounded-full bg-[var(--brand)] px-1.5 text-[11px] font-extrabold text-white">{g.unread}</span>}
            </button>
            {openChild === g.key && (
              <ul className="space-y-1.5 px-2.5 pb-2.5">
                {g.sub.map((s) => (
                  <li key={s.key} className="rounded-xl border border-[var(--line)]">
                    <button type="button" onClick={() => setOpenLesson(openLesson === s.key ? null : s.key)} data-testid="question-folder-lesson"
                      className={`flex w-full items-center gap-1.5 px-2.5 py-2 text-left ${FOCUS}`}>
                      <Icon name="chevronRight" size={12} className={`flex-none transition-transform ${openLesson === s.key ? "rotate-90" : ""}`} />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-[var(--ink-2)]">{s.label}</span>
                      {s.unread > 0 && <span className="flex-none rounded-full bg-[var(--brand)] px-1.5 text-[10.5px] font-extrabold text-white">{s.unread}</span>}
                    </button>
                    {openLesson === s.key && (
                      <ul className="space-y-1 px-1.5 pb-1.5">
                        {s.rows.map((d) => {
                          const last = d.messages[d.messages.length - 1];
                          const active = d.id === open?.id;
                          return (
                            <li key={d.id}>
                              <button type="button" onClick={() => setOpenId(d.id)} data-testid="question-thread-open"
                                className={`w-full rounded-lg border p-2 text-left transition ${active ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-transparent hover:bg-[var(--panel)]"} ${FOCUS}`}>
                                <div className="flex items-center gap-1.5">
                                  {d.unreadByTutor && <span aria-label="Unread" className="h-2 w-2 flex-none rounded-full bg-[var(--brand)]" />}
                                  <span className="line-clamp-1 text-[12.5px] leading-snug text-[var(--ink)]">{last?.text}</span>
                                </div>
                                <div className="mt-0.5 text-[10.5px] text-[var(--ink-3)]">{relTime(d.lastAt)}</div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      {composing !== null
        ? <NewMessageComposer qs={qs} students={students} childId={composing} onChildId={setComposing} onCancel={() => setComposing(null)} onSent={onCreated} />
        : open && (
          <>
            <ThreadPane key={open.id} title={open.childName} subtitle={subtitleFor(open)} messages={open.messages} mine="tutor" childName={open.childName}
              unread={open.unreadByTutor} onSeen={() => update({ ...open, unreadByTutor: false })}
              onSend={async (text) => update(await replyDoubt(qs, open.id, text))} sendTestId="question-thread"
              onView={open.noteId ? () => setPeek(true) : undefined} />
            {peek && open.noteId && <LessonPeek qs={qs} noteId={open.noteId} step={open.step} slide={open.slide} questionId={open.questionId} lessonTitle={open.lessonTitle} config={config} onClose={() => setPeek(false)} />}
          </>
        )}
    </div>
  );
}

// ── Family: this child's own threads, grouped by lesson/topic ───────────────

function FamilyMessages({ qs, childId, config }: { qs: string; childId: string | null; config: PanelProps["config"] }) {
  const [rows, setRows] = useState<Doubt[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openLesson, setOpenLesson] = useState<string | null>(null);
  const [peek, setPeek] = useState(false);
  const [composing, setComposing] = useState(false);
  const { id: linkId } = useLinkOpen("doubt");

  const load = useCallback(() => { if (childId) listDoubts(qs).then(setRows).catch(() => undefined); }, [qs, childId]);
  useEffect(() => { load(); const t = setInterval(load, POLL_MS); return () => clearInterval(t); }, [load]);
  useRealtime(["hubDoubts"], load);

  const groups = useMemo(() => (rows ? groupBy(rows, "lesson", (d) => d.unreadByFamily) : []), [rows]);

  useEffect(() => {
    if (!linkId || !rows) return;
    const hit = rows.find((d) => d.id === linkId);
    if (!hit) return;
    setOpenId(linkId); setOpenLesson(hit.noteId ?? GENERAL);
  }, [linkId, rows]);
  useEffect(() => {
    if (openLesson || !groups.length) return;
    setOpenLesson(groups[0]!.key);
  }, [groups, openLesson]);

  if (!childId) return <EmptyState id="hub-questions-nochild" icon="help" title="No child selected" body="Choose a child to see their messages." />;
  if (!rows) return <SkeletonRows rows={4} label="Loading messages" variant="card" />;

  const flatRows = groups.flatMap((g) => g.sub.flatMap((s) => s.rows));
  const open = flatRows.find((d) => d.id === openId) ?? flatRows[0] ?? null;
  const update = (next: Doubt) => setRows((rs) => rs?.map((r) => (r.id === next.id ? next : r)) ?? null);
  const onCreated = (d: Doubt) => { setComposing(false); setRows((rs) => [...(rs ?? []), d]); setOpenId(d.id); setOpenLesson(d.noteId ?? GENERAL); };

  return (
    <div id="hub-questions" className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start" data-testid="questions-panel">
      <div className="space-y-2 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto">
        <button type="button" onClick={() => setComposing(true)} data-testid="question-new-message"
          className={`flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-[var(--brand-line)] px-3 py-2.5 text-[13px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}>
          <Icon name="plus" size={15} />New message
        </button>
        {!rows.length && <EmptyState id="hub-questions-empty" icon="help" title="No messages yet" body="Tap “Ask a question” inside any lesson, or start one here — you and your tutor's replies both show up here, any time." />}
        {groups.map((g) => (
          <div key={g.key} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
            <button type="button" onClick={() => setOpenLesson(openLesson === g.key ? null : g.key)} data-testid="question-folder-lesson"
              className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left ${FOCUS}`}>
              <Icon name="chevronRight" size={14} className={`flex-none transition-transform ${openLesson === g.key ? "rotate-90" : ""}`} />
              <Icon name="folder" size={16} className="flex-none text-[var(--ink-3)]" />
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold text-[var(--ink)]">{g.label}</span>
              {g.unread > 0 && <span className="flex-none rounded-full bg-[var(--brand)] px-1.5 text-[11px] font-extrabold text-white">{g.unread}</span>}
            </button>
            {openLesson === g.key && (
              <ul className="space-y-1 px-2.5 pb-2.5">
                {g.sub.flatMap((s) => s.rows).map((d) => {
                  const last = d.messages[d.messages.length - 1];
                  const active = d.id === open?.id;
                  const where = whereLabel(d);
                  return (
                    <li key={d.id}>
                      <button type="button" onClick={() => setOpenId(d.id)} data-testid="question-thread-open"
                        className={`w-full rounded-lg border p-2 text-left transition ${active ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-transparent hover:bg-[var(--panel)]"} ${FOCUS}`}>
                        {where && <div className="flex items-center gap-1.5"><span className="text-[11.5px] font-bold text-[var(--ink-2)]">{where}</span></div>}
                        <div className="flex items-center gap-1.5">
                          {d.unreadByFamily && <span aria-label="Unread" className="h-2 w-2 flex-none rounded-full bg-[var(--brand)]" />}
                          <span className="line-clamp-1 text-[12.5px] leading-snug text-[var(--ink)]">{last?.text}</span>
                        </div>
                        <div className="mt-0.5 text-[10.5px] text-[var(--ink-3)]">{relTime(d.lastAt)}</div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
      {composing
        ? <NewMessageComposer qs={qs} onCancel={() => setComposing(false)} onSent={onCreated} />
        : open && (
          <>
            <ThreadPane key={open.id} title={open.lessonTitle ?? "General message"} subtitle={whereLabel(open) || "A message to your tutor"} messages={open.messages} mine="child" childName={open.childName}
              unread={open.unreadByFamily} onSeen={() => update({ ...open, unreadByFamily: false })}
              onSend={async (text) => update(await sendDoubtMessage(qs, open.id, text))} sendTestId="question-thread"
              onView={open.noteId ? () => setPeek(true) : undefined} />
            {peek && open.noteId && <LessonPeek qs={qs} noteId={open.noteId} step={open.step} slide={open.slide} questionId={open.questionId} lessonTitle={open.lessonTitle} config={config} onClose={() => setPeek(false)} />}
          </>
        )}
    </div>
  );
}

// ── Start a plain message, no lesson attached ────────────────────────────────

function NewMessageComposer({ qs, students, childId, onChildId, onCancel, onSent }: {
  qs: string;
  /** Tutor only: who to message. */
  students?: PanelProps["students"]; childId?: string | null; onChildId?: (id: string) => void;
  onCancel: () => void; onSent: (d: Doubt) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isTutor = students !== undefined;

  const send = async () => {
    if (!text.trim() || (isTutor && !childId)) return;
    setBusy(true); setErr(null);
    try { const d = await askDoubt(qs, { text: text.trim(), ...(isTutor ? { childId: childId! } : {}) }); onSent(d); }
    catch (e) { setErr(errMsg(e, "Couldn't send that — try again")); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-[420px] flex-col rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4" data-testid="question-new-composer">
      <div className="border-b border-[var(--line)] pb-3">
        <div className="text-[15px] font-extrabold text-[var(--ink)]">New message</div>
        {isTutor && (
          <select value={childId ?? ""} onChange={(e) => onChildId?.(e.target.value)} data-testid="question-new-child"
            className={`mt-2 min-h-[40px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[13.5px] text-[var(--ink)] ${FOCUS}`}>
            {(students ?? []).map((s) => <option key={s.childId} value={s.childId}>{s.childName}</option>)}
          </select>
        )}
      </div>
      <div className="min-h-0 flex-1 py-3">
        <p className="m-0 text-[13px] text-[var(--ink-2)]">Not about a particular lesson — just a message.</p>
      </div>
      {err && <p role="alert" className="mb-2 text-[13px] font-semibold text-[var(--red)]">{err}</p>}
      <div className="flex items-end gap-2 border-t border-[var(--line)] pt-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={2} placeholder="Write your message…" autoFocus data-testid="question-new-text"
          className={`min-h-[44px] flex-1 resize-none rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--ink)] ${FOCUS}`} />
        <button type="button" onClick={onCancel} className={`inline-flex min-h-[44px] items-center rounded-xl px-3 text-[13px] font-extrabold text-[var(--ink-2)] hover:bg-[var(--panel)] ${FOCUS}`}>Cancel</button>
        <button type="button" onClick={send} disabled={busy || !text.trim() || (isTutor && !childId)} data-testid="question-new-send"
          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--brand)] px-4 text-[14px] font-extrabold text-white disabled:opacity-50 ${FOCUS}`}><Icon name="check" size={15} />{busy ? "Sending…" : "Send"}</button>
      </div>
    </div>
  );
}

// ── Shared thread view (both sides) ──────────────────────────────────────────

function ThreadPane({ title, subtitle, messages, mine, childName, unread, onSeen, onSend, sendTestId, onView }: {
  title: string; subtitle: string; messages: DoubtMsg[]; mine: "tutor" | "child"; childName: string;
  unread: boolean; onSeen: () => void; onSend: (text: string) => Promise<unknown>; sendTestId: string;
  /** A quick, read-only popup of the exact slide/question this thread is about — omitted for a plain message. */
  onView?: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (unread) onSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subtitle]);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true); setErr(null);
    try { await onSend(text.trim()); setText(""); }
    catch (e) { setErr(errMsg(e, "Couldn't send that — try again")); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-[420px] flex-col rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4" data-testid={sendTestId}>
      <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] pb-3">
        <div className="min-w-0">
          <div className="text-[15px] font-extrabold text-[var(--ink)]">{title}</div>
          <div className="mt-0.5 text-[12.5px] text-[var(--ink-2)]">{subtitle}</div>
        </div>
        {onView && (
          <button type="button" onClick={onView} data-testid="question-thread-view"
            className={`inline-flex min-h-[36px] flex-none items-center gap-1.5 rounded-full border border-[var(--brand)] px-3 text-[12.5px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}>
            <Icon name="external" size={14} />View slide
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto py-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug ${m.from === mine ? "bg-[var(--brand)] text-white" : "border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)]"}`}>
              {m.text}
              <div className={`mt-1 text-[11px] font-semibold ${m.from === mine ? "text-white/70" : "text-[var(--ink-3)]"}`}>{m.from === "child" ? childName : m.byName}</div>
            </div>
          </div>
        ))}
      </div>
      {err && <p role="alert" className="mb-2 text-[13px] font-semibold text-[var(--red)]">{err}</p>}
      <div className="flex items-end gap-2 border-t border-[var(--line)] pt-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} rows={2} placeholder="Reply…" data-testid="question-thread-reply"
          className={`min-h-[44px] flex-1 resize-none rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--ink)] ${FOCUS}`} />
        <button type="button" onClick={send} disabled={busy || !text.trim()} data-testid="question-thread-send"
          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--brand)] px-4 text-[14px] font-extrabold text-white disabled:opacity-50 ${FOCUS}`}><Icon name="check" size={15} />{busy ? "Sending…" : "Send"}</button>
      </div>
    </div>
  );
}
