"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, FieldLabel, Input, inputCls } from "@/components/ui";
import { del, get, post, put } from "@/lib/api";
import { renderMarkdown } from "@/lib/markdown";
import type { HubSettings } from "@/lib/hubConfig";
import { CreatorTabs, DiscardStrip, ExistingPicker, type ExistingQuery, type ExistingPage } from "./EditExisting";
import { ConfirmButton, EmptyState, FOCUS, Icon, SkeletonRows, SubjectChip, Switch, subjectColor, tint } from "./kit";
import { lessonHomeworkIntent, setHubIntent, useOpenLessonRequest } from "./hubIntent";
import { NewTopicInline, useTopicsWithNew } from "./NewTopicInline";
import { TopicPicker } from "./TopicPicker";
import { SlideBuilder, finishSlides, newSlide, slidesToText } from "./lesson/builder/SlideBuilder";
import { normalizeSlides, type Slide } from "./lesson/slides/types";
import { LessonPlayer } from "./lesson/LessonPlayer";
import type { LessonRaw } from "./lesson/types";
import { GoLivePicker } from "./inperson/GoLivePicker";
import { SessionRunner } from "./inperson/InPersonApp";
import type { IpSession } from "./inperson/api";
import { StartRemoteSyncButton } from "./remotesync/StartRemoteSyncButton";
import { RemoteSyncApp } from "./remotesync/RemoteSyncApp";
import { TutorLiveBanner } from "./remotesync/TutorLiveBanner";
import { closeLink, openLink, useLinkOpen } from "./family/link";
import { CurriculumCard } from "./curriculum/CurriculumCard";
import { LessonTutorPanel } from "./lesson/LessonTutorPanel";
import { FlashcardsForLesson } from "./lesson/FlashcardsForLesson";
import { stripPlanSection } from "./lesson/plan";
import { canChangeRow, errMsg, fmtDate, fmtSize, readMins, topicLabel, type Attachment, type HubFilter, type Note, type NoteLite, type Student, type Topic, type VideoInput } from "./types";
import { VideoChip, VideoEditor, VideoEmbeds, videoPayload, videosToInputs } from "./videoKit";
import { Notice } from "./teachKit";

// Lessons & resource library (hubNotes; the UI calls them "Lessons") — browsable by curriculum area/year via the
// CurriculumCard above (the primary flow), or by title/text via the search box; never by date. A lesson is either a
// plain markdown note or — when the doc carries a structured `lesson` field (Oak import) —
// an interactive lesson played by lesson/LessonPlayer (pupils) / previewed + widget-picked by tutors. Plain notes are markdown; worksheets/PDFs ride along as attachments
// (private uploads — POST /api/uploads — re-signed by the API on every read).
//
// Three views in one panel: the card list, a comfortable reading view (with the
// worksheet shelf + print), and — for tutors — the editor. The shell keeps this
// component mounted when you switch tabs, so a half-written note is never lost.

// POST /api/uploads caps a PDF at ~750KB and an image at 900KB; refuse early
// with a friendly message rather than after the bytes have been sent.
const MAX_FILE = 700_000;
const MAX_BODY = 20_000;
const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp,image/gif";

interface Props {
  topics: Topic[];
  /** Bumped by the shell whenever the tenant's notes changed (realtime / a save): refetch the visible list. */
  version: number;
  /** "?tenantId=…[&childId=…]" — what a LIST/READ of notes is scoped by (a family's child narrows the subjects). */
  listQs: string;
  covered: Set<string>;
  filter: HubFilter;
  canEdit: boolean;
  /** Tutor mode but view-only (a staff role with "View"): every authoring control is hidden. */
  readOnly?: boolean;
  /** The tutor's franchise (null = head office / the provider itself): head-office lessons are read-only for a franchise. */
  franchiseId?: string | null;
  qs: string;
  /** The hub's roster (useHubData) — passed straight through to the curriculum card so it doesn't re-fetch it. */
  students: Student[];
  onChanged: () => void;
  onError: (msg: string) => void;
  /** Reports whether an editor with unsaved changes is open. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Is the Notes tab showing? (The panel stays mounted while hidden so unsaved work survives a tab switch.) */
  active?: boolean;
  // ── interactive lessons (all optional: without `config` a structured lesson falls back to the plain reader) ──
  /** The chosen child (parents) — the lesson quiz is taken FOR this child. */
  childId?: string | null;
  config?: HubSettings;
  /** Shell focus mode while a pupil is inside a lesson. */
  setFocus?: (on: boolean, opts?: { bare?: boolean }) => void;
  goTo?: (key: "flashcards" | "homework") => void;
  /** The Lessons tab's year-group filter, lifted to the hub shell. */
  years: number[];
  onYearsChange: (y: number[]) => void;
}

type Draft = { id: string | null; topicId: string; title: string; body: string; published: boolean; attachments: { id: string; name: string; size: number; contentType?: string }[]; videos: VideoInput[]; /** Editing an interactive lesson (its structured part is untouched by this editor). */ isLesson?: boolean;
  /** "slides" = the slide builder (an interactive lesson written here); "text" = a plain markdown note (or an imported lesson, whose structure is kept). */ mode: "slides" | "text"; slides: Slide[]; /** School year the lesson is for ("Year 4"), or "" = any. Stored as lesson.year so the year filters find it. */ year: string;
  /** The stored `lesson` of a lesson written in the builder — sent back with the edited slides. */ lessonRaw: LessonRaw | null };

const readAsDataUrl = (f: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(new Error("Couldn't read that file"));
  r.readAsDataURL(f);
});
const snap = (d: Draft | null) => (d ? JSON.stringify([d.topicId, d.title, d.body, d.published, d.attachments.map((a) => a.id), d.videos.map((v) => [v.url, v.title ?? "", v.start ?? 0]), d.mode, d.mode === "slides" ? [d.slides, d.year] : null]) : "");
const isPdf = (t?: string) => t === "application/pdf";

/** A worksheet / file tile — used in the reader's shelf. */
function FileTile({ a }: { a: Attachment }) {
  const pdf = isPdf(a.contentType);
  return (
    <a href={a.url} target="_blank" rel="noopener noreferrer" download={a.name}
      className={`group flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 transition hover:-translate-y-px hover:border-[var(--brand-2)] hover:shadow-[var(--shadow)] ${FOCUS}`}>
      <span className="grid h-11 w-11 flex-none place-items-center rounded-xl" style={{ background: pdf ? "var(--red-soft)" : "var(--violet-soft)", color: pdf ? "var(--red)" : "var(--violet)" }}>
        <Icon name={pdf ? "file" : "image"} size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-extrabold text-[var(--ink)]">{a.name}</span>
        <span className="text-[11.5px] font-semibold text-[var(--ink-2)]">{pdf ? "PDF" : "Image"} · {fmtSize(a.size)}</span>
      </span>
      <span className="grid h-8 w-8 flex-none place-items-center rounded-full text-[var(--brand)] transition group-hover:bg-[var(--brand-soft)]" aria-hidden="true"><Icon name="upload" size={16} className="rotate-180" /></span>
    </a>
  );
}

export function NotesPanel({ topics: topicsProp, version, listQs, covered, filter, canEdit, readOnly = false, franchiseId = null, qs, students, onChanged, onError, onDirtyChange, active = true, childId = null, config, setFocus, goTo, years, onYearsChange }: Props) {
  // `canEdit` = tutor mode (a view-only staff member is in it too — the screens are the tutor's); `mayAuthor` = may also WRITE.
  const mayAuthor = canEdit && !readOnly;
  // Topics created inline ("+ New subject / topic") show up at once, before the realtime refetch lands.
  const [topics, rememberTopic, forgetSubject] = useTopicsWithNew(topicsProp);
  /** May THIS tutor edit / delete this lesson? A franchise cannot change head-office lessons (the server would 403). */
  const canChange = (row: { franchiseId?: string | null }) => mayAuthor && canChangeRow(franchiseId, row.franchiseId);
  const fromHeadOffice = (row: { franchiseId?: string | null }) => mayAuthor && !canChange(row);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [initial, setInitial] = useState("");
  // A save that forked a head-office (shared-library) lesson into the tutor's own copy — the editor
  // closes right away on save, so the confirmation lives here, on the list behind it.
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 5000); return () => clearTimeout(t); }, [flash]);
  const [preview, setPreview] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  // Pure preview (LessonTutorPanel's "Preview lesson" button): step through the slide deck itself, standalone —
  // no roster, no session, nothing started or saved. Distinct from `previewing` (the "Open" button), which leads
  // straight to the real one-room/share-with-children choice.
  const [previewOnly, setPreviewOnly] = useState(false);
  // "Teach in person" from the tutor's own preview: click "Start the lesson" → pick who's here → the SAME LessonPlayer
  // goes live (see GoLivePicker / inperson/SessionRunner). `goingLive` is the inline "who's here?" step; once a
  // session exists, `ipSession` swaps the preview into the real in-person run.
  const [goingLive, setGoingLive] = useState(false);
  const [ipSession, setIpSession] = useState<IpSession | null>(null);
  const [ipRoster, setIpRoster] = useState<Student[]>([]);
  // Set by a "live" open-lesson request (the tutor's Rejoin banner); consumed once the note's body has loaded — see the effect below.
  const pendingLiveRejoin = useRef(false);
  const [rejoinLive, setRejoinLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [discard, setDiscard] = useState(false);
  /** The editor's "Edit existing" tab is showing its picker (a new draft, if any, is kept underneath). */
  const [picking, setPicking] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const scrollTop = useRef<HTMLDivElement>(null);

  const topicById = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);
  const dirty = !!draft && snap(draft) !== initial;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  // Leaving the tab with an editor that was opened but never touched ("Nothing changed yet") closes it, so coming
  // back shows the notes — not an empty editor covering the list. A draft with real edits is kept.
  useEffect(() => { if (!active && draft && snap(draft) === initial) { setDraft(null); setInitial(""); setDiscard(false); } }, [active, draft, initial]);

  const [opened, setOpened] = useState<Note | null>(null);
  const [opening, setOpening] = useState(false);

  // Opening a note fetches its body (GET /notes/:id).
  const openPath = (id: string) => `/api/learning-hub/notes/${id}${listQs}`;
  useEffect(() => {
    if (!reading) { setOpened(null); return; }
    let live = true;
    setOpening(true); setOpened(null);
    get<Note>(openPath(reading))
      .then((n) => { if (live) setOpened(n); })
      .catch((e) => { if (live) { onError(errMsg(e, "Couldn't open that lesson")); setReading(null); } })
      .finally(() => { if (live) setOpening(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading]);
  // The note being read changed elsewhere (or was just saved): refresh its body quietly, no flicker.
  useEffect(() => {
    if (!reading || version === 0) return;
    let live = true;
    get<Note>(openPath(reading)).then((n) => { if (live) setOpened(n); }).catch(() => undefined);
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
  const openNote = reading && opened?.id === reading ? opened : null;
  useEffect(() => { setPreviewing(false); setPreviewOnly(false); setGoingLive(false); setIpSession(null); setRejoinLive(false); }, [reading]);
  // A "you're broadcasting — Rejoin" request: once the lesson's body has loaded, skip the one-room/share-with-children
  // choice entirely (the tutor already made it) and land straight on the share-with-children roster, which offers
  // "Resume broadcasting" plus the same student picker to add/remove who's in the class.
  useEffect(() => {
    if (openNote && pendingLiveRejoin.current) { pendingLiveRejoin.current = false; setPreviewing(true); setRejoinLive(true); }
  }, [openNote]);
  // A topic/subject filter changing (there's no UI left on this tab that sets one, but `filter` is shared app state)
  // leaves whatever lesson was open: show the list again, not the old lesson.
  useEffect(() => { setReading(null); }, [filter.topicId, filter.subject]);
  // A pupil's homework "Start the lesson" opens that lesson here (and Back returns to the homework).
  const returnTo = useRef<"homework" | null>(null);
  useOpenLessonRequest(useCallback((id: string, from: "homework" | "live" | null) => {
    returnTo.current = from === "homework" ? "homework" : null;
    pendingLiveRejoin.current = from === "live";
    setPreviewing(false); setPreviewOnly(false); setReading(id);
  }, []));
  // A family's open lesson lives in the URL (?open=lesson:<id>[&hw=<homework>]): a refresh resumes it, Back closes it (instead of leaving the hub),
  // and a link (a homework's "Start the lesson", a notification) lands on it.
  const urlLesson = useLinkOpen("lesson");
  useEffect(() => { if (!canEdit) setReading(urlLesson.id); }, [urlLesson.id, canEdit]);
  const openReading = (id: string) => { setReading(id); if (!canEdit) openLink({ kind: "lesson", id }, { tab: "notes" }); };
  const closeReading = () => { setReading(null); if (!canEdit) closeLink(); };
  const toTop = () => scrollTop.current?.scrollIntoView({ block: "nearest" });

  const begin = (d: Draft) => { setDraft(d); setInitial(snap(d)); setPreview(false); setDiscard(false); setPicking(false); setConfirmNew(false); toTop(); };
  const startNew = () => {
    const t = (filter.topicId && topicById.get(filter.topicId)) || topics.find((x) => covered.has(x.id)) || topics[0];
    begin({ id: null, topicId: t?.id ?? "", title: "", body: "", published: true, attachments: [], videos: [], mode: "slides", slides: [newSlide()], year: "", lessonRaw: null });
  };
  const startEdit = (n: Note) => {
    // A lesson written in the slide builder (tutor-made, has slides, not an import) opens in the builder; imported lessons keep their structure.
    const l = n.lesson && typeof n.lesson === "object" ? n.lesson : null;
    const authored = !!l && (!l.source?.provider || l.source.provider === "tutor") && !l.oakDeck && !(l.deckSlides as unknown[] | undefined)?.length && Array.isArray(l.slides) && l.slides.length > 0;
    begin({ id: n.id, topicId: n.topicId, title: n.title, body: n.body, published: n.published, attachments: n.attachments.map((a) => ({ id: a.id, name: a.name, size: a.size, contentType: a.contentType })), videos: videosToInputs(n.videos), isLesson: !!n.lesson,
      mode: authored ? "slides" : "text", slides: authored ? normalizeSlides(l!.slides) : [], year: authored && l!.year != null ? String(l!.year) : "", lessonRaw: authored ? l : null });
  };
  const editFromList = async (n: NoteLite) => {
    try { startEdit(await get<Note>(openPath(n.id))); }
    catch (e) { onError(errMsg(e, "Couldn't open that lesson")); }
  };
  const setForChildren = (n: { id: string; title: string; lesson?: unknown }) => { lessonHomeworkIntent(n); goTo?.("homework"); };
  const leaveEditor = () => { setDraft(null); setDiscard(false); setInitial(""); setPicking(false); setConfirmNew(false); };
  const cancelEditor = () => { if (dirty && !discard) setDiscard(true); else leaveEditor(); };

  // "Edit existing" inside the editor: a searchable list of this tutor's lessons (same endpoint + filters as the list); choosing one opens it here.
  const fetchExisting = useCallback(async (x: ExistingQuery): Promise<ExistingPage> => {
    const sp = new URLSearchParams({ limit: "20", sort: "topic" });
    if (x.cursor) sp.set("cursor", x.cursor);
    if (x.topicId) sp.set("topicId", x.topicId); else if (x.subject) sp.set("subject", x.subject);
    if (x.q) sp.set("q", x.q);
    const r = await get<{ items: NoteLite[]; total: number; nextCursor: string | null }>(`/api/learning-hub/notes${listQs}${listQs ? "&" : "?"}${sp.toString()}`);
    return { rows: r.items.map((n) => ({ id: n.id, title: n.title, topicId: n.topicId, draft: !n.published, meta: [n.isLesson ? "Interactive" : null, !canChange(n) ? "From head office (read-only)" : null].filter(Boolean).join(" · ") || undefined })), total: r.total, next: r.nextCursor };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listQs, franchiseId, mayAuthor]);
  const pickExisting = async (r: { id: string }) => {
    const n = await get<Note>(openPath(r.id));
    if (!canChange(n)) throw new Error("That lesson belongs to head office, so you can't edit it.");
    startEdit(n);
  };
  const onCreatorTab = (m: "new" | "existing") => {
    if (m === "existing") { setPicking(true); return; }
    if (draft?.id) { if (dirty) setConfirmNew(true); else startNew(); return; }
    setPicking(false);
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      let text = draft.body; let lessonPart: { lesson?: LessonRaw } = {};
      if (draft.mode === "slides") {
        const r = finishSlides(draft.slides);
        if ("error" in r) { onError(r.error); return; }
        if (r.slides.length || draft.lessonRaw) {
          // the plain-text version (search, screen readers) is generated from the slides
          text = r.slides.length ? slidesToText(r.slides).slice(0, MAX_BODY) : draft.body;
          lessonPart = { lesson: { ...(draft.lessonRaw ?? {}), title: draft.title.trim(), subject: topicById.get(draft.topicId)?.subject ?? "", ...(draft.year ? { year: draft.year } : { year: undefined }), slides: r.slides, source: { ...(draft.lessonRaw?.source ?? {}), provider: "tutor" } } };
        }
      }
      const body = { topicId: draft.topicId, title: draft.title, body: text, published: draft.published, attachments: draft.attachments.map(({ id, name, size }) => ({ id, name, size })), videos: videoPayload(draft.videos), ...lessonPart };
      if (draft.id) {
        // A head-office (shared-library) lesson can't be edited in place — the server forks it into
        // a new one owned by this tenant instead (`forked: true`). The editor closes either way, so
        // the tutor is told via the flash on the list behind it.
        const r = await put<{ forked?: boolean }>(`/api/learning-hub/notes/${draft.id}${qs}`, body);
        if (r.forked) setFlash("That lesson belonged to head office, so saving it made your own copy.");
      }
      else await post(`/api/learning-hub/notes${qs}`, body);
      leaveEditor();
      onChanged();
    } catch (e) { onError(errMsg(e, "Couldn't save the lesson")); }
    finally { setBusy(false); }
  };

  const attach = async (files: FileList | File[] | null) => {
    if (!files || !files.length || !draft) return;
    setUploading(true);
    try {
      const added: Draft["attachments"] = [];
      for (const f of Array.from(files)) {
        if (!ACCEPT.split(",").includes(f.type)) { onError(`"${f.name}" isn't a PDF or image, so it can't be attached.`); continue; }
        if (f.size > MAX_FILE) { onError(`"${f.name}" is ${fmtSize(f.size)} — the limit is ${fmtSize(MAX_FILE)}. Save a smaller PDF or use a photo.`); continue; }
        const dataUrl = await readAsDataUrl(f);
        const up = await post<{ id: string }>("/api/uploads", { dataUrl, purpose: "private", kind: "hub" });
        added.push({ id: up.id, name: f.name, size: f.size, contentType: f.type });
      }
      setDraft((d) => (d ? { ...d, attachments: [...d.attachments, ...added].slice(0, 10) } : d));
    } catch (e) { onError(errMsg(e, "Couldn't upload that file")); }
    finally { setUploading(false); }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try { await del(`/api/learning-hub/notes/${id}${qs}`); if (reading === id) setReading(null); onChanged(); }
    catch (e) { onError(errMsg(e, "Couldn't delete the lesson")); }
    finally { setBusy(false); }
  };

  // ── editor ───────────────────────────────────────────────────────────────
  if (draft) {
    const over = draft.body.length > MAX_BODY * 0.9;
    return (
      <div id="hub-note-editor" data-ui="card" className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
        <div ref={scrollTop} className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3 sm:px-5" style={{ background: "linear-gradient(180deg, var(--brand-soft), var(--surface))" }}>
          <span className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(135deg, var(--brand-2), var(--brand))" }}><Icon name="edit" size={17} /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{draft.id ? "Edit lesson" : "New lesson"}</h3>
            <p className="text-[12px] text-[var(--ink-2)]">{dirty ? "Unsaved changes" : "Nothing changed yet"}</p>
          </div>
        </div>

        <div className="grid gap-4 px-4 py-4 sm:px-5">
          <CreatorTabs mode={picking || draft.id ? "existing" : "new"} onChange={onCreatorTab} noun="Lesson" />
          {confirmNew && (
            <DiscardStrip message="Start a new lesson? Your unsaved changes to this one will be lost." confirmLabel="Discard and start new" onKeep={() => setConfirmNew(false)} onConfirm={startNew} testId="edit-existing-confirm-new" />
          )}
          {picking ? (
            <ExistingPicker noun="lesson" topics={topics} fetchPage={fetchExisting} onPick={pickExisting} onError={onError}
              initialSubject={filter.subject ?? ""} initialTopicId={filter.topicId ?? ""} guard={dirty ? "You have unsaved changes in the lesson you're writing." : null} refresh={version} />
          ) : (<>
          {draft.isLesson && draft.mode === "text" && <p role="note" className="m-0 rounded-xl border border-[var(--line)] border-l-4 border-l-[var(--violet)] bg-[var(--panel)] px-3.5 py-2.5 text-[13px] text-[var(--ink)]">This is an interactive lesson: students step through it in the lesson player. You&apos;re editing its title, topic, plain-text version and files — the interactive part is kept as it is.</p>}
          <div className="grid gap-4">
            <div>
              <FieldLabel htmlFor="hub-note-topic">Topic</FieldLabel>
              <TopicPicker id="hub-note-topic" topics={topics} value={draft.topicId} onChange={(topicId) => setDraft({ ...draft, topicId })}
                deleteSubject={mayAuthor ? { qs, done: (subject) => {
                  forgetSubject(subject);
                  setDraft((d) => (d && topics.find((t) => t.id === d.topicId)?.subject.toLowerCase() === subject.toLowerCase() ? { ...d, topicId: topics.find((t) => t.subject.toLowerCase() !== subject.toLowerCase())?.id ?? "" } : d));
                  onChanged();
                } } : undefined} />
              <NewTopicInline qs={qs} topics={topics} subject={topicById.get(draft.topicId)?.subject} canCreate={mayAuthor} testId="note-new-topic"
                onCreated={(t) => { rememberTopic(t); setDraft((d) => (d ? { ...d, topicId: t.id } : d)); onChanged(); }} />
            </div>
            <div>
              <FieldLabel htmlFor="hub-note-title">Title</FieldLabel>
              <Input id="hub-note-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={200} placeholder="e.g. Solving quadratics by factorising" className="min-h-[44px] w-full" />
            </div>
          </div>

          {draft.mode === "slides" && (config?.yearGroups?.length ?? 0) > 0 && (
            <div>
              <span className="mb-1 block text-[11.5px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">Year group</span>
              <div role="radiogroup" aria-label="Year group" className="flex flex-wrap gap-1.5" data-testid="lesson-year">
                {["", ...config!.yearGroups].map((y) => {
                  const on = draft.year === y;
                  return <button key={y || "any"} type="button" role="radio" aria-checked={on} onClick={() => setDraft({ ...draft, year: y })}
                    className={`min-h-[36px] rounded-full border px-3.5 text-[13px] font-bold transition ${FOCUS} ${on ? "border-[var(--brand-2)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand-2)]"}`}>{y || "Any year"}</button>;
                })}
              </div>
            </div>
          )}
          {draft.mode === "slides" && <SlideBuilder slides={draft.slides} onChange={(slides) => setDraft({ ...draft, slides })} disabled={busy} />}

          {draft.mode === "text" && (
          <div>
            <div className="mb-1.5 flex items-end justify-between gap-2">
              <FieldLabel htmlFor="hub-note-body">Lesson text</FieldLabel>
              <div role="tablist" aria-label="Editor mode" className="mb-1 inline-flex rounded-full border border-[var(--line)] bg-[var(--panel)] p-0.5">
                {(["Write", "Preview"] as const).map((m) => {
                  const on = (m === "Preview") === preview;
                  return (
                    <button key={m} type="button" role="tab" aria-selected={on} onClick={() => setPreview(m === "Preview")}
                      className={`min-h-[44px] lg:min-h-[32px] rounded-full px-3.5 text-[12px] font-extrabold transition ${on ? "text-white shadow-sm" : "text-[var(--ink-2)] hover:text-[var(--ink)]"} ${FOCUS}`}
                      style={on ? { background: "linear-gradient(180deg, var(--brand-2), var(--brand))" } : undefined}>{m}</button>
                  );
                })}
              </div>
            </div>
            {preview ? (
              <div className="min-h-[248px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[14px] leading-[1.7] text-[var(--ink)]" aria-live="polite">
                {draft.body.trim() ? <div className="space-y-2">{renderMarkdown(draft.body)}</div> : <p className="text-[var(--ink-2)]">Nothing to preview yet — switch to Write.</p>}
              </div>
            ) : (
              <textarea id="hub-note-body" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={11} maxLength={MAX_BODY}
                className={`${inputCls} block min-h-[248px] w-full !rounded-xl px-3.5 py-3 !text-[14px] leading-[1.65] ${FOCUS}`}
                placeholder={"# Heading\n\n- **Bold**, *italic*, bullet and numbered lists\n- > quotes for worked examples"} />
            )}
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[var(--ink-2)]">
              <span>Markdown: # headings, **bold**, *italic*, lists, &gt; quotes and tables.</span>
              <span className={`font-bold tabular-nums ${over ? "text-[var(--red)]" : ""}`} aria-live="polite">{draft.body.length.toLocaleString()}/{MAX_BODY.toLocaleString()}</span>
            </div>
          </div>
          )}

          <div>
            <FieldLabel htmlFor="hub-note-files">Worksheets &amp; files</FieldLabel>
            {draft.attachments.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-2">
                {draft.attachments.map((a) => (
                  <li key={a.id} className="inline-flex max-w-full items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] py-1 pl-2.5 pr-1 text-[12px] font-bold text-[var(--ink)]">
                    <Icon name={isPdf(a.contentType) || /\.pdf$/i.test(a.name) ? "file" : "image"} size={15} className="text-[var(--brand)]" />
                    <span className="max-w-[200px] truncate">{a.name}</span>
                    <button type="button" aria-label={`Remove ${a.name}`} onClick={() => setDraft({ ...draft, attachments: draft.attachments.filter((x) => x.id !== a.id) })}
                      className={`grid h-8 w-8 place-items-center rounded-lg text-[var(--ink-2)] hover:bg-[var(--red-soft)] hover:text-[var(--red)] ${FOCUS}`}><Icon name="close" size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
            {draft.attachments.length < 10 && (
              <label htmlFor="hub-note-files"
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); void attach(e.dataTransfer.files); }}
                className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed px-4 py-5 text-center transition focus-within:ring-2 focus-within:ring-[var(--brand-2)]"
                style={{ borderColor: dragging ? "var(--brand-2)" : "var(--line)", background: dragging ? "var(--brand-soft)" : "var(--panel)" }}>
                <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: tint("var(--brand)", 12), color: "var(--brand)" }}><Icon name="upload" size={20} /></span>
                <span className="text-[13px] font-extrabold text-[var(--ink)]">{uploading ? "Uploading…" : "Drop a PDF or image here, or browse"}</span>
                <span className="text-[11.5px] text-[var(--ink-2)]">Up to {fmtSize(MAX_FILE)} each · max 10 files</span>
                <input id="hub-note-files" type="file" accept={ACCEPT} multiple className="sr-only" disabled={uploading} onChange={(e) => { void attach(e.target.files); e.target.value = ""; }} />
              </label>
            )}
          </div>

          <div>
            <FieldLabel htmlFor="hub-note-video-link">Videos</FieldLabel>
            <VideoEditor idPrefix="hub-note-video" value={draft.videos} onChange={(videos) => setDraft({ ...draft, videos })} hint="Paste a YouTube link — students watch it beside your lesson." />
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
            <div className="min-w-0 flex-1">
              <div id="hub-note-pub-label" className="text-[13px] font-extrabold text-[var(--ink)]">{draft.published ? "Published" : "Draft"}</div>
              <p className="text-[12px] leading-snug text-[var(--ink-2)]">{draft.published ? "Students and parents can see this lesson now." : "Only you and other tutors can see it. Publish when it's ready."}</p>
            </div>
            <Switch checked={draft.published} onChange={(v) => setDraft({ ...draft, published: v })} label="Published — students can see it" />
          </div>
          </>)}
        </div>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t border-[var(--hub-warm-line)] bg-[var(--hub-warm-2)] px-4 py-3 sm:px-5">
          {discard && (
            <span role="alert" className="mr-auto text-[12.5px] font-bold text-[var(--ink)]">Discard your changes?</span>
          )}
          <span className={discard ? "" : "ml-auto"} />
          {discard ? (
            <>
              <Button onClick={() => setDiscard(false)} className="!h-[44px] lg:!h-[40px]">Keep editing</Button>
              <Button variant="danger" onClick={leaveEditor} className="!h-[44px] lg:!h-[40px]">Discard</Button>
            </>
          ) : (
            <>
              <Button onClick={cancelEditor} className="!h-[44px] lg:!h-[40px]">Cancel</Button>
              <Button variant="primary" onClick={save} disabled={busy || uploading || picking || !draft.title.trim() || !draft.topicId} className="!h-[44px] lg:!h-[40px]">{busy ? "Saving…" : "Save lesson"}</Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── reading view ─────────────────────────────────────────────────────────
  if (reading && !openNote) {
    return (
      <div id="hub-reader-wrap">
        <div className="mb-3">
          <button type="button" onClick={closeReading} className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[12.5px] font-extrabold text-[var(--ink)] hover:border-[var(--brand-2)] ${FOCUS}`}>
            <Icon name="arrowLeft" size={15} /> All lessons
          </button>
        </div>
        {opening ? <SkeletonRows rows={2} label="Opening the lesson" variant="card" /> : null}
      </div>
    );
  }
  if (openNote?.lesson && config && (!canEdit || previewing || previewOnly)) {
    // An interactive lesson: pupils play it; a tutor's Preview plays it read-only (nothing started or saved) —
    // unless they've gone live in person (ipSession), in which case the SAME player is now the real thing.
    const exitPreview = () => { setPreviewing(false); setPreviewOnly(false); setGoingLive(false); setIpSession(null); };
    return (
      <div id="hub-reader-wrap">
        {canEdit && (
          <div className="mb-3">
            <button type="button" onClick={exitPreview} data-testid="lesson-preview-back" className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[12.5px] font-extrabold text-[var(--ink)] hover:border-[var(--brand-2)] ${FOCUS}`}>
              <Icon name="arrowLeft" size={15} /> Back
            </button>
          </div>
        )}
        {ipSession ? (
          <SessionRunner key={ipSession.id} qs={qs} config={config} initial={ipSession} roster={ipRoster} goTo={goTo} onClose={exitPreview} />
        ) : goingLive ? (
          <GoLivePicker qs={qs} noteId={openNote.id} title={openNote.title} onCancel={() => setGoingLive(false)}
            onStarted={(session, roster) => { setIpRoster(roster); setIpSession(session); setGoingLive(false); }} />
        ) : rejoinLive ? (
          // Leaving here came FROM the "you're broadcasting" banner, not from browsing this lesson — landing back
          // on the one-room/share-with-children choice would read as a non-sequitur (that card has no session
          // context any more). Go all the way back to the lesson list instead, same as any other "Back".
          <RemoteSyncApp qs={qs} config={config} noteId={openNote.id} title={openNote.title} subject={topicById.get(openNote.topicId)?.subject} year={(() => { const m = /(\d{1,2})/.exec(topicById.get(openNote.topicId)?.subtopic ?? ""); return m ? Number(m[1]) : null; })()} onClose={() => { setRejoinLive(false); closeReading(); }} />
        ) : (
          previewOnly ? (
            // Pure preview: the tutor steps through the deck itself via LessonPlayer's own Start/Next controls —
            // no roster, no session, nothing started or saved. The one-room/share-with-children cards are for
            // actually RUNNING the lesson with real children, so they don't belong here.
            <LessonPlayer note={{ id: openNote.id, title: openNote.title, lesson: openNote.lesson }} qs={qs} childQs={listQs} childId={childId} config={config}
              readOnly setFocus={setFocus} goTo={goTo} onLessonSaved={canChange(openNote) ? (n) => setOpened(n as Note) : undefined}
              onExit={exitPreview} />
          ) : canEdit ? (
            <div className="overflow-hidden rounded-2xl border border-[var(--line)] shadow-[var(--shadow-sm)]" data-testid="lesson-mode-card">
              <LessonPlayer note={{ id: openNote.id, title: openNote.title, lesson: openNote.lesson }} qs={qs} childQs={listQs} childId={childId} config={config}
                readOnly setFocus={setFocus} goTo={goTo} onLessonSaved={canChange(openNote) ? (n) => setOpened(n as Note) : undefined}
                onExit={() => setPreviewing(false)} hideStartButton hideHeader startCardClassName="!rounded-b-none !rounded-t-2xl !border-0 !shadow-none" />
              <div className="grid divide-y divide-[var(--line)] bg-[var(--surface)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <div className="flex flex-col p-5">
                  <span className="mb-2 grid h-11 w-11 place-items-center rounded-full" style={{ background: tint("var(--brand)", 14), color: "var(--brand)" }}><Icon name="users" size={22} /></span>
                  <h3 className="m-0 text-[18px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>One room</h3>
                  <p className="m-0 mt-1.5 flex-1 text-[14px] leading-relaxed text-[var(--ink-2)]">Best when a child is sat right here with you — you run it together on this screen, and their answers get recorded as you go.</p>
                  <Button variant="primary" onClick={() => setGoingLive(true)} className="!mt-4 !h-[46px] !w-full !text-[15px]" data-testid="lesson-one-room"><Icon name="play" size={16} /> Start — one room</Button>
                </div>
                <div className="flex flex-col p-5">
                  <span className="mb-2 grid h-11 w-11 place-items-center rounded-full" style={{ background: tint("var(--violet)", 14), color: "var(--violet)" }}><Icon name="play" size={22} /></span>
                  <h3 className="m-0 text-[18px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>Share with children</h3>
                  <p className="m-0 mt-1.5 flex-1 text-[14px] leading-relaxed text-[var(--ink-2)]">Best when each child has their own device — they follow along and answer for themselves, wherever they are.</p>
                  <StartRemoteSyncButton qs={qs} config={config} noteId={openNote.id} title={openNote.title} testId="lesson-start-remote-sync" variant="solid" className="!mt-4 !h-[46px] !w-full !justify-center !text-[15px]" />
                </div>
              </div>
            </div>
          ) : (
            <LessonPlayer note={{ id: openNote.id, title: openNote.title, lesson: openNote.lesson }} qs={qs} childQs={listQs} childId={childId} config={config}
              readOnly={false} setFocus={setFocus} goTo={goTo} onLessonSaved={canChange(openNote) ? (n) => setOpened(n as Note) : undefined}
              onExit={() => { closeReading(); if (returnTo.current) { returnTo.current = null; goTo?.("homework"); } }} homeworkId={urlLesson.hw} />
          )
        )}
        {!ipSession && !goingLive && ((openNote.videos?.length ?? 0) > 0 || openNote.attachments.length > 0) && (
          <div className="mt-4 grid gap-4" data-testid="lesson-extras">
            {(openNote.videos?.length ?? 0) > 0 && <VideoEmbeds videos={openNote.videos} />}
            {openNote.attachments.length > 0 && (
              <section aria-labelledby="hub-lesson-files">
                <h3 id="hub-lesson-files" className="mb-2 flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]"><Icon name="folder" size={15} /> Worksheets &amp; files</h3>
                <div className="grid gap-2.5 sm:grid-cols-2">{openNote.attachments.map((a) => <FileTile key={a.id} a={a} />)}</div>
              </section>
            )}
          </div>
        )}
      </div>
    );
  }
  if (openNote) {
    const t = topicById.get(openNote.topicId);
    const color = subjectColor(t?.subject ?? "");
    return (
      <div id="hub-reader-wrap">
        <style>{`@media print { body * { visibility: hidden !important; } #hub-reader, #hub-reader * { visibility: visible !important; } #hub-reader { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: 0 !important; } .hub-no-print { display: none !important; } }`}</style>
        <div className="hub-no-print mb-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={closeReading} className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[12.5px] font-extrabold text-[var(--ink)] hover:border-[var(--brand-2)] ${FOCUS}`}>
            <Icon name="arrowLeft" size={15} /> All lessons
          </button>
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button onClick={() => window.print()} className="!h-[44px] lg:!h-[40px]"><Icon name="print" size={15} /> Print</Button>
            {mayAuthor && !!openNote.lesson && <Button variant="primary" onClick={() => setPreviewing(true)} className="!h-[44px] lg:!h-[40px]" data-testid="lesson-open"><Icon name="play" size={15} /> Open</Button>}
            {mayAuthor && goTo && <Button variant="primary" onClick={() => setForChildren(openNote)} className="!h-[44px] lg:!h-[40px]" data-testid="lesson-set-for-children" title="Give this lesson to students or a group, with a due date"><Icon name="homework" size={15} /> Set for children</Button>}
            {canChange(openNote) && <Button onClick={() => startEdit(openNote)} className="!h-[44px] lg:!h-[40px]"><Icon name="edit" size={15} /> Edit</Button>}
            {canChange(openNote) && <ConfirmButton ariaLabel={`Delete ${openNote.title}`} label="Delete" confirmLabel="Confirm delete" disabled={busy} onConfirm={() => remove(openNote.id)} />}
          </span>
        </div>

        <article id="hub-reader" data-ui="card" className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
          <div className="absolute inset-y-0 left-0 w-1" style={{ background: color }} aria-hidden="true" />
          <div className="px-5 py-6 sm:px-9 sm:py-8">
            <div className="mx-auto max-w-[68ch]">
              <div className="flex flex-wrap items-center gap-2">
                {t && <SubjectChip subject={t.subject}>{topicLabel(t)}</SubjectChip>}
                <VideoChip count={openNote.videos?.length ?? 0} />
                {!openNote.published && <span className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-[3px] text-[11px] font-extrabold text-[var(--ink-2)]">Draft — students can&apos;t see this</span>}
                {fromHeadOffice(openNote) && <span className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-[3px] text-[11px] font-extrabold text-[var(--ink-2)]" data-testid="from-head-office">From head office</span>}
              </div>
              <h2 className="mt-3 text-[26px] font-extrabold leading-tight text-[var(--ink)] sm:text-[30px]" style={{ fontFamily: "var(--ff-display)" }}>{openNote.title}</h2>
              {/* A blog-style "By … · updated … · N min read" byline is right for a plain written note, but wrong for an
                  interactive lesson deck (shared-library content isn't "by" this tutor, and slides don't have a read time)
                  — LessonTutorPanel below shows this lesson's own, more relevant metadata instead. */}
              {!openNote.lesson && <p className="mt-2 text-[12.5px] text-[var(--ink-2)]">By {openNote.createdByName || "your tutor"} · updated {fmtDate(openNote.updatedAt)}{openNote.body.trim() ? ` · ${readMins(openNote.body)} min read` : ""}</p>}
              {(openNote.videos?.length ?? 0) > 0 && <VideoEmbeds videos={openNote.videos} className="mt-6" />}
              {openNote.lesson && config && <LessonTutorPanel note={openNote} qs={qs} canEdit={mayAuthor} goTo={goTo} onPreview={() => setPreviewOnly(true)} onSaved={(n) => setOpened(n)} onError={onError} />}
              {mayAuthor && (
                <div className="mt-5 grid gap-3">
                  {t && <FlashcardsForLesson qs={qs} topicId={t.id} />}
                </div>
              )}
              <div className="mt-6 space-y-3 text-[15.5px] leading-[1.75] text-[var(--ink)]">
                {(config && openNote.lesson?.plan ? stripPlanSection(openNote.body) : openNote.body).trim() ? renderMarkdown(config && openNote.lesson?.plan ? stripPlanSection(openNote.body) : openNote.body) : <p className="text-[var(--ink-2)]">No written text — see the attached worksheets below.</p>}
              </div>
            </div>
            {openNote.attachments.length > 0 && (
              <section className="mt-8 border-t border-dashed border-[var(--line)] pt-5" aria-labelledby="hub-shelf">
                <h3 id="hub-shelf" className="mb-3 flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]"><Icon name="folder" size={15} /> Worksheets &amp; files <span className="rounded-full bg-[var(--panel)] px-1.5 text-[11px]">{openNote.attachments.length}</span></h3>
                <div className="grid gap-2.5 sm:grid-cols-2">{openNote.attachments.map((a) => <FileTile key={a.id} a={a} />)}</div>
              </section>
            )}
          </div>
        </article>
      </div>
    );
  }

  // ── list ─────────────────────────────────────────────────────────────────
  // The curriculum card is the only way to find a lesson now (click an area+year tile → its lessons).
  const noTopics = topics.length === 0;
  return (
    <div id="hub-notes">
      {/* The family "join your tutor's live lesson" banner now lives in LearningHubApp, above every tab — here it sat inside this (hidden-on-other-tabs) panel, so a child on Home never saw the invite. */}
      {canEdit && <TutorLiveBanner qs={listQs} />}
      {flash && <Notice tone="green" onClose={() => setFlash(null)}>{flash}</Notice>}
      {/* The first thing on the Lessons tab, always open: where the lessons fit the national curriculum / GCSE
          (tutor: coverage; child: what they've covered) — click an area+year tile to see its lessons. */}
      <CurriculumCard qs={listQs} canEdit={canEdit} mayAuthor={mayAuthor} students={students} onOpenLesson={openReading} onNewLesson={mayAuthor ? startNew : undefined}
        onSetHomework={goTo ? (childId, id, title) => { setHubIntent({ kind: "homework", groupId: "", childIds: [childId], noteIds: [id], title, packNoteId: id }); goTo("homework"); } : undefined} />

      {/* The curriculum card above is the only way in now (click an area+year tile → its lessons) — a lesson with
          no topic yet is the one thing it can't show, so that's the only case left here. */}
      {noTopics && (
        <EmptyState icon="folder" title={mayAuthor ? "Start your first lesson" : canEdit ? "No lessons yet" : "Nothing shared yet"} color="var(--brand)"
          body={canEdit && !mayAuthor ? "There are no topics or lessons here yet." : canEdit ? "A lesson needs a subject and topic — you'll create both together when you write it (e.g. Maths › Algebra)." : "Your tutor hasn't shared any lessons or topics yet. They'll appear here as soon as they do."}
          action={mayAuthor ? <Button variant="primary" onClick={startNew}><Icon name="plus" size={15} /> Start your first lesson</Button> : undefined} />
      )}
    </div>
  );
}
