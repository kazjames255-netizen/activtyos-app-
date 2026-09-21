"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";
import type { PanelProps } from "../../panelTypes";
import { get } from "@/lib/api";
import { errMsg, fmtSize, topicLabel, type Attachment, type Note, type NoteLite } from "../../types";
import { DISPLAY, FOCUS, Pill, Skeleton, withQs } from "../../teachKit";
import { Ico } from "../../teachIcons";
import { VideoEmbeds } from "../../videoKit";
import type { Lesson } from "../lessonTypes";
import { LessonNotes } from "../liveKit";
import { PaneOverlay, WsButton, WsEmpty, WsSection, useWsView } from "./wsKit";
import { lessonCovered } from "./wsLib";
import { LessonNotesEditor, useNotesList, type NotesEditorHandle } from "./LessonNotesEditor";

// "Notes" — the tutor's note for this lesson + its videos (YouTube facade
// players), the topic's notes, and a resource shelf of every attached file.
// "Present" opens a note in a big, calm reading view for screen sharing.

const fileChip = (a: Attachment) => (
  <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" download={a.name}
    className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--hub-warm-line)] bg-[var(--surface)] px-3 text-[12.5px] font-semibold text-[var(--ink)] hover:border-[var(--brand)] ${FOCUS}`}>
    <Ico name={a.contentType === "application/pdf" ? "file" : "image"} size={15} /><span className="max-w-[190px] truncate">{a.name}</span>
    <span className="text-[11px] font-normal text-[var(--ink-3)]">{fmtSize(a.size)}</span>
  </a>
);

export function NotesTab({ p, lesson, isTutor }: { p: PanelProps; lesson: Lesson; isTutor: boolean }) {
  const { big } = useWsView();
  const { notes, reload } = useNotesList(p.qs);
  const [open, setOpen] = useState<string | null>(null);
  const [reading, setReading] = useState<NoteLite | null>(null);
  const [scope, setScope] = useState<"topic" | "subject">("topic");
  const [ids, setIds] = useState<string[]>(lesson.noteIds ?? []);
  const ctl = useRef<NotesEditorHandle>(null);
  const first = useRef(true);
  const idsKey = (lesson.noteIds ?? []).join(",");
  useEffect(() => { setIds(idsKey ? idsKey.split(",") : []); }, [idsKey]);
  const covered = lessonCovered(p.topics, lesson);
  const topic = p.topics.find((t) => t.id === lesson.topicId) ?? null;

  const byId = useMemo(() => new Map((notes ?? []).map((n) => [n.id, n])), [notes]);
  const attached = useMemo(() => ids.map((id) => byId.get(id)).filter((n): n is NoteLite => !!n), [ids, byId]);
  const shown = useMemo(() => (notes ?? []).filter((n) => !ids.includes(n.id) && (scope === "subject" && topic
    ? p.topics.find((t) => t.id === n.topicId)?.subject === topic.subject
    : !covered || covered.has(n.topicId))), [notes, ids, scope, topic, covered, p.topics]);
  useEffect(() => { if (first.current && (attached[0] || shown[0])) { first.current = false; setOpen((attached[0] ?? shown[0])!.id); } }, [attached, shown]);
  const files = useMemo(() => [...attached, ...shown].flatMap((n) => n.attachments.map((a) => ({ a, note: n.title }))), [attached, shown]);
  const topicOf = (n: NoteLite) => p.topics.find((t) => t.id === n.topicId);
  const hasLessonNote = !!lesson.notes?.trim() || (lesson.videos?.length ?? 0) > 0;

  const noteCard = (n: NoteLite, tag?: string) => {
    const on = open === n.id;
    return (
      <div key={n.id} className="overflow-hidden rounded-xl border border-[var(--hub-warm-line)] bg-[var(--surface)]" data-note={n.id}>
        <div className="flex items-center">
          <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : n.id)} className={`flex min-h-[48px] min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left ${FOCUS}`}>
            <span className="min-w-0 flex-1">
              <span className={`block truncate font-extrabold text-[var(--ink)] ${big ? "text-[16px]" : "text-[13.5px]"}`}>{n.title}</span>
              {(tag || (!topic && topicOf(n)) || scope === "subject") && <span className="block truncate text-[11px] text-[var(--ink-3)]">{tag ?? (topicOf(n) ? topicLabel(topicOf(n)!) : "")}</span>}
            </span>
            {tag && <Pill tone="brand">For this lesson</Pill>}
            {n.kind === "board" && <Pill tone="gold">Board snapshot</Pill>}
            {!n.published && <Pill tone="gold">Draft</Pill>}
            <Ico name="chevronDown" size={15} className={`flex-none text-[var(--ink-3)] transition-transform motion-reduce:transition-none ${on ? "rotate-180" : ""}`} />
          </button>
          <button type="button" onClick={() => setReading(n)} aria-label={`Present ${n.title}`} title="Present — big reading view" className={`mr-1.5 inline-flex min-h-[44px] flex-none items-center gap-1 rounded-lg px-2.5 text-[12px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}><Ico name="monitor" size={15} />Present</button>
        </div>
        {on && (
          <div className="border-t border-[var(--line)] px-3 py-3">
            <NoteBody n={n} qs={p.qs} big={big} />
            {(n.videos?.length ?? 0) > 0 && <VideoEmbeds videos={n.videos} heading={null} className="mt-3" />}
            {n.attachments.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{n.attachments.map(fileChip)}</div>}
          </div>
        )}
      </div>
    );
  };

  const loading = notes === null;
  return (
    <div className="grid gap-3">
      <WsSection title="This live lesson" icon="notes" aside={topic ? <Pill tone="brand">{topicLabel(topic)}</Pill> : null}>
        {isTutor
          ? <LessonNotesEditor p={p} lesson={lesson} notes={notes} reloadNotes={reload} ids={ids} onIds={setIds} controlRef={ctl} />
          : hasLessonNote ? <LessonNotes lesson={lesson} isTutor={false} alwaysOpen /> : <p className="m-0 text-[12.5px] leading-relaxed text-[var(--ink-3)]">No message for this live lesson.</p>}
      </WsSection>

      {attached.length > 0 && (
        <WsSection title={`Lessons for this live lesson · ${attached.length}`} icon="notes">
          <div className="grid gap-2" data-testid="attached-notes">{attached.map((n) => noteCard(n, "Attached by your tutor"))}</div>
        </WsSection>
      )}

      <WsSection title={scope === "subject" && topic ? `All ${topic.subject} lessons` : topic ? "Topic lessons" : "Lessons"} icon="notes"
        aside={topic ? (
          <button type="button" onClick={() => setScope((v) => (v === "topic" ? "subject" : "topic"))} aria-pressed={scope === "subject"} data-action="browse-all"
            className={`min-h-[44px] lg:min-h-[36px] rounded-lg px-2.5 text-[12px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}>{scope === "subject" ? "Just this topic" : `Browse all ${topic.subject} lessons`}</button>
        ) : null}>
        {loading ? <div className="grid gap-2"><Skeleton className="h-11" /><Skeleton className="h-11" /></div> : shown.length === 0 ? (
          <WsEmpty icon="notes" title={topic ? "No lessons for this topic yet" : "No lessons yet"}
            body={isTutor ? (scope === "topic" && topic ? "Attach one from your library, write a new one, or browse everything in this subject." : "Attach one from your library or write a new one — students see it right here in the call.") : "No lessons have been shared for this topic yet."}
            action={isTutor ? (
              <div className="flex flex-wrap justify-center gap-2">
                <WsButton variant="soft" icon="plus" onClick={() => ctl.current?.attach()}>Attach a lesson</WsButton>
                <WsButton variant="ghost" icon="edit" onClick={() => ctl.current?.create()}>New lesson</WsButton>
                {topic && scope === "topic" && <WsButton variant="ghost" onClick={() => setScope("subject")}>Browse all {topic.subject} lessons</WsButton>}
              </div>
            ) : undefined} />
        ) : <div className="grid gap-2">{shown.map((n) => noteCard(n))}</div>}
      </WsSection>

      {files.length > 0 && (
        <WsSection title={`Worksheets & files · ${files.length}`} icon="folder">
          <div className="flex flex-wrap gap-2">{files.map(({ a, note }) => <span key={a.id} title={`From “${note}”`}>{fileChip(a)}</span>)}</div>
        </WsSection>
      )}

      {reading && <PaneOverlay><ReadingView note={reading} qs={p.qs} onClose={() => setReading(null)} /></PaneOverlay>}
    </div>
  );
}

/** A lesson's full text: the list is light (no body), so it is fetched (GET /notes/:id) when a card is opened or presented. */
function useFullNote(qs: string, n: NoteLite): { full: Note | null; error: string | null } {
  const [state, setState] = useState<{ id: string; stamp: string; full: Note | null; error: string | null } | null>(null);
  useEffect(() => {
    let live = true;
    get<Note>(`/api/learning-hub/notes/${encodeURIComponent(n.id)}${withQs(qs, {})}`)
      .then((full) => { if (live) setState({ id: n.id, stamp: n.updatedAt, full, error: null }); })
      .catch((e) => { if (live) setState({ id: n.id, stamp: n.updatedAt, full: null, error: errMsg(e, "Couldn't open that lesson") }); });
    return () => { live = false; };
  }, [qs, n.id, n.updatedAt]);
  return state && state.id === n.id ? { full: state.full, error: state.error } : { full: null, error: null };
}

function NoteBody({ n, qs, big }: { n: NoteLite; qs: string; big: boolean }) {
  const { full, error } = useFullNote(qs, n);
  if (error) return <p role="alert" className="m-0 text-[12.5px] text-[var(--red)]">{error}</p>;
  if (!full) return <Skeleton className="h-16" />;
  return full.body.trim()
    ? <div className={`space-y-2 leading-relaxed text-[var(--ink-2)] ${big ? "text-[16px]" : "text-[13px]"}`}>{renderMarkdown(full.body)}</div>
    : <p className="m-0 text-[12.5px] text-[var(--ink-3)]">No written text — see the attached files.</p>;
}

function ReadingView({ note, qs, onClose }: { note: NoteLite; qs: string; onClose: () => void }) {
  const { full, error } = useFullNote(qs, note);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    root.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("keydown", key, true); prev?.focus?.({ preventScroll: true }); };
  }, [onClose]);
  return (
    <div ref={root} tabIndex={-1} role="dialog" aria-label={`Reading: ${note.title}`} data-testid="ws-reading" className="absolute inset-0 z-20 flex flex-col outline-none" style={{ background: "var(--hub-warm)" }}>
      <div className="flex items-center gap-2 border-b border-[var(--hub-warm-line)] px-4 py-2.5">
        <h3 className="m-0 min-w-0 flex-1 truncate text-[20px] font-extrabold text-[var(--ink)]" style={DISPLAY}>{note.title}</h3>
        <WsButton variant="ghost" icon="close" onClick={onClose} ariaLabel="Close reading view">Close</WsButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-10">
        <div className="mx-auto max-w-[760px]">
          <div className="space-y-4 text-[clamp(18px,2.4vw,26px)] leading-[1.6] text-[var(--ink)]">{error ? <p role="alert">{error}</p> : !full ? <Skeleton className="h-24" /> : full.body.trim() ? renderMarkdown(full.body) : <p>No written text.</p>}</div>
          {(note.videos?.length ?? 0) > 0 && <VideoEmbeds videos={note.videos} heading={null} className="mt-6" />}
        </div>
      </div>
    </div>
  );
}
