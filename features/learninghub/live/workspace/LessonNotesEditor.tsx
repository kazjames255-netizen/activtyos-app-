"use client";

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { Button, FieldLabel, Input, Select } from "@/components/ui";
import { LessonPicker } from "../../lesson/picker/LessonPicker";
import { useT } from "@/lib/i18n/provider";
import { get, post, put } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import type { PanelProps } from "../../panelTypes";
import { errMsg, topicLabel, type Note, type NoteLite, type VideoInput } from "../../types";
import { Dialog, FOCUS, Notice, Pill, withQs } from "../../teachKit";
import { NewTopicInline, useTopicsWithNew } from "../../NewTopicInline";
import { Ico } from "../../teachIcons";
import { VideoEditor, videoPayload, videosToInputs } from "../../videoKit";
import type { Lesson } from "../lessonTypes";
import { WsButton } from "./wsKit";

// Adding notes to a lesson, right where the tutor is: a note for the students
// (autosaves), YouTube videos (paste → saved), notes attached from the library
// (a searchable picker) and a "New note" quick-create that is attached at once.
// Everything saves through PUT /lessons/:id {notes?, videos?, noteIds?} — allowed
// at ANY time, live or ended. Nothing here is a "go edit the lesson" detour.

const MAX_ATTACH = 12;
const lessonPath = (qs: string, id: string) => `/api/learning-hub/lessons/${id}${withQs(qs, {})}`;

/** All the tenant's lessons as LIGHT rows (tutor: drafts too), kept fresh — GET /notes carries no `body`; open one with GET /notes/:id. */
export function useNotesList(qs: string) {
  const [notes, setNotes] = useState<NoteLite[] | null>(null);
  const load = useCallback(() => {
    get<NoteLite[]>(`/api/learning-hub/notes${withQs(qs, {})}`).then((n) => setNotes(Array.isArray(n) ? n : [])).catch(() => setNotes((c) => c ?? []));
  }, [qs]);
  useEffect(load, [load]);
  useRealtime(["hubNotes"], load);
  return { notes, reload: load };
}

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";
function SaveTick({ state }: { state: SaveState }) {
  const t = useT();
  if (state === "idle") return null;
  const text = state === "saved" ? t("hublive.aNe_saved") : state === "error" ? t("hublive.aNe_saveErr") : t("hublive.aNe_saving");
  return (
    <span role="status" aria-live="polite" data-save-state={state} className={`inline-flex items-center gap-1 text-[11.5px] font-extrabold ${state === "saved" ? "text-[var(--hub-green-ink)]" : state === "error" ? "text-[var(--red)]" : "text-[var(--ink-3)]"}`}>
      {state === "saved" && <Ico name="check" size={13} strokeWidth={2.6} />}{text}
    </span>
  );
}

export interface NotesEditorHandle { attach: () => void; create: () => void }

export function LessonNotesEditor({ p, lesson, notes, reloadNotes, ids, onIds, controlRef }: {
  p: PanelProps; lesson: Lesson; notes: NoteLite[] | null; reloadNotes: () => void;
  /** The attached note ids (the parent keeps them so its lists update instantly). */
  ids: string[]; onIds: (ids: string[]) => void;
  controlRef?: Ref<NotesEditorHandle>;
}) {
  const { qs } = p;
  const t = useT();
  const [text, setText] = useState(lesson.notes ?? "");
  const [textState, setTextState] = useState<SaveState>("idle");
  const [videos, setVideos] = useState<VideoInput[]>(() => videosToInputs(lesson.videos));
  const [vidState, setVidState] = useState<SaveState>("idle");
  const [err, setErr] = useState<string | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const dirty = useRef(false);
  const textTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vidTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestText = useRef(text);
  useEffect(() => { latestText.current = text; });
  useImperativeHandle(controlRef, () => ({ attach: () => setAttachOpen(true), create: () => setNewOpen(true) }), []);

  // Pick up edits made elsewhere (another window, the lesson form) — but never clobber what's being typed.
  useEffect(() => { if (!dirty.current) setText(lesson.notes ?? ""); }, [lesson.notes]);

  const saveText = useCallback(async () => {
    if (textTimer.current) { clearTimeout(textTimer.current); textTimer.current = null; }
    const v = latestText.current;
    setTextState("saving");
    try { await put(lessonPath(qs, lesson.id), { notes: v }); if (latestText.current === v) dirty.current = false; setTextState("saved"); setErr(null); }
    catch (e) { setTextState("error"); setErr(errMsg(e, t("hublive.aNe_msgFail"))); }
  }, [qs, lesson.id, t]);
  const onText = (v: string) => {
    setText(v); dirty.current = true; setTextState("pending");
    if (textTimer.current) clearTimeout(textTimer.current);
    textTimer.current = setTimeout(() => void saveText(), 800);
  };
  // Leaving with unsaved typing (closing the dialog, switching tab) still saves it.
  const flush = useRef(saveText);
  useEffect(() => { flush.current = saveText; });
  useEffect(() => () => { if (dirty.current) void flush.current(); }, []);

  const onVideos = (v: VideoInput[]) => {
    setVideos(v); setVidState("pending");
    if (vidTimer.current) clearTimeout(vidTimer.current);
    vidTimer.current = setTimeout(async () => {
      setVidState("saving");
      try { await put(lessonPath(qs, lesson.id), { videos: videoPayload(v) }); setVidState("saved"); setErr(null); }
      catch (e) { setVidState("error"); setErr(errMsg(e, t("hublive.aNe_vidFail"))); }
    }, 350);
  };

  const saveIds = async (next: string[]) => {
    const prev = ids;
    onIds(next);
    try { await put(lessonPath(qs, lesson.id), { noteIds: next }); setErr(null); }
    catch (e) { onIds(prev); setErr(errMsg(e, t("hublive.aNe_attachFail"))); throw e; }
  };

  const byId = useMemo(() => new Map((notes ?? []).map((n) => [n.id, n])), [notes]);
  const attached = ids.map((id) => byId.get(id)).filter((n): n is NoteLite => !!n);

  return (
    <div className="grid gap-4" data-testid="lesson-notes-editor">
      {err && <Notice onClose={() => setErr(null)}>{err}</Notice>}

      <div>
        <div className="mb-1 flex items-center gap-2">
          <label htmlFor="ws-lesson-note" className="text-[13px] font-extrabold text-[var(--ink)]">{t("hublive.aNe_msgLabel")}</label>
          <span className="ms-auto"><SaveTick state={textState} /></span>
        </div>
        <textarea id="ws-lesson-note" rows={4} maxLength={4000} value={text} onChange={(e) => onText(e.target.value)} onBlur={() => { if (dirty.current) void saveText(); }}
          placeholder={t("hublive.aNe_msgPh")}
          className="min-h-[104px] w-full resize-y rounded-xl border border-[var(--hub-warm-line)] bg-[var(--surface)] px-3 py-2.5 text-[13.5px] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
        <p className="m-0 mt-1 text-[11.5px] text-[var(--ink-3)]">{t("hublive.aNe_msgHint")}</p>
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-2 text-[13px] font-extrabold text-[var(--ink)]">{t("hublive.aNe_attachedHdr")} <span className="rounded-full bg-[var(--panel)] px-1.5 py-px text-[11px] text-[var(--ink-2)]">{ids.length}/{MAX_ATTACH}</span></div>
        {attached.length > 0 && (
          <ul className="m-0 mb-2 flex list-none flex-wrap gap-1.5 p-0" aria-label={t("hublive.aNe_attachedAria")}>
            {attached.map((n) => (
              <li key={n.id} className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--brand-line)] bg-[var(--brand-soft)] py-0.5 ps-3 pe-0.5 text-[12.5px] font-bold text-[var(--brand-strong)]">
                <span className="max-w-[200px] truncate">{n.title}</span>{!n.published && <Pill tone="gold">{t("hublive.aNotes_draft")}</Pill>}
                <button type="button" onClick={() => void saveIds(ids.filter((x) => x !== n.id)).catch(() => undefined)} aria-label={t("hublive.aNe_detachX", { title: n.title })} title={t("hublive.aNe_detach")} className={`grid h-9 w-9 place-items-center rounded-full hover:bg-[var(--surface)] ${FOCUS}`}><Ico name="close" size={13} /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <WsButton variant="soft" icon="plus" id="ws-attach-notes" onClick={() => setAttachOpen(true)}>{t("hublive.aForm_attachFrom")}</WsButton>
          <WsButton variant="ghost" icon="edit" id="ws-new-note" onClick={() => setNewOpen(true)}>{t("hublive.aNotes_newLesson")}</WsButton>
        </div>
        {attached.some((n) => !n.published) && <p className="m-0 mt-1.5 text-[11.5px] text-[var(--gold)]">{t("hublive.aNe_draftHint")}</p>}
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-2"><span className="text-[13px] font-extrabold text-[var(--ink)]">{t("hublive.aNe_videos")}</span><span className="ms-auto"><SaveTick state={vidState} /></span></div>
        <VideoEditor idPrefix="ws-lesson-video" value={videos} onChange={onVideos} hint={t("hublive.aNe_videoHint")} />
      </div>

      {attachOpen && <AttachDialog qs={p.qs} attached={ids} onClose={() => setAttachOpen(false)} onSave={async (next) => { await saveIds(next); setAttachOpen(false); }} />}
      {newOpen && (
        <NewNoteDialog p={p} lesson={lesson} full={ids.length >= MAX_ATTACH} onClose={() => setNewOpen(false)}
          onCreated={async (n) => { reloadNotes(); await saveIds([...ids, n.id].slice(0, MAX_ATTACH)).catch(() => undefined); setNewOpen(false); }} />
      )}
    </div>
  );
}

// ── attach from the library ─────────────────────────────────────────────────
export function AttachDialog({ qs, attached, onClose, onSave }: { qs: string; attached: string[]; onClose: () => void; onSave: (ids: string[]) => Promise<void> }) {
  const t = useT();
  const [picked, setPicked] = useState<string[]>(attached);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const changed = picked.length !== attached.length || picked.some((x) => !attached.includes(x));
  const save = async () => { setBusy(true); setErr(null); try { await onSave(picked); } catch (e) { setErr(errMsg(e, t("hublive.aNe_attachFailDlg"))); setBusy(false); } };
  return (
    <Dialog id="ws-attach-dialog" title={t("hublive.aNe_attachTitle")} subtitle={t("hublive.aNe_attachSub", { n: MAX_ATTACH })} onClose={onClose} size="xl"
      footer={<><Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} onClick={onClose}>{t("hublive.aForm_cancel")}</Button><Button variant="solid" className={`min-h-[44px] ${FOCUS}`} disabled={busy || !changed} onClick={() => void save()}>{busy ? t("hublive.aNe_saving") : t("hublive.aNe_saveN", { n: picked.length })}</Button></>}>
      <div className="grid gap-3">
        {err && <Notice onClose={() => setErr(null)}>{err}</Notice>}
        <LessonPicker qs={qs} mode="multi" max={MAX_ATTACH} value={picked} onChange={(ids) => setPicked(ids)} lessonsOnly={false} published={false} idPrefix="ws-attach" testId="ws-attach-picker" />
      </div>
    </Dialog>
  );
}

// ── quick-create a lesson (attached straight away) ────────────────────────────
function NewNoteDialog({ p, lesson, full, onClose, onCreated }: { p: PanelProps; lesson: Lesson; full: boolean; onClose: () => void; onCreated: (n: Note) => Promise<void> }) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [topicId, setTopicId] = useState(lesson.topicId ?? "");
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [withNew, rememberTopic] = useTopicsWithNew(p.topics);
  const sorted = useMemo(() => [...withNew].sort((a, b) => topicLabel(a).localeCompare(topicLabel(b))), [withNew]);
  const problem = !title.trim() ? t("hublive.aNe_needTitle") : !topicId ? t("hublive.aNe_needTopic") : null;
  const save = async () => {
    if (problem) { setErr(problem); return; }
    setBusy(true); setErr(null);
    try {
      const n = await post<Note>(`/api/learning-hub/notes${withQs(p.qs, {})}`, { topicId, title: title.trim(), body, published: publish, attachments: [] });
      await onCreated(n);
    } catch (e) { setErr(errMsg(e, t("hublive.aNe_saveFailLesson"))); setBusy(false); }
  };
  return (
    <Dialog id="ws-new-note-dialog" title={t("hublive.aNe_newTitle")} subtitle={full ? t("hublive.aNe_newSubFull", { n: MAX_ATTACH }) : t("hublive.aNe_newSub")} onClose={onClose}
      footer={<><Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} onClick={onClose}>{t("hublive.aForm_cancel")}</Button><Button variant="solid" className={`min-h-[44px] ${FOCUS}`} disabled={busy || !!problem} onClick={() => void save()}>{busy ? t("hublive.aNe_saving") : full ? t("hublive.aNe_saveLesson") : t("hublive.aNe_saveAttach")}</Button></>}>
      <div className="grid gap-4">
        {err && <Notice onClose={() => setErr(null)}>{err}</Notice>}
        <div><FieldLabel htmlFor="ws-nn-title">{t("hublive.aNe_title")}</FieldLabel><Input id="ws-nn-title" data-autofocus className="min-h-[44px] w-full" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={t("hublive.aNe_titlePh")} /></div>
        <div><FieldLabel htmlFor="ws-nn-topic">{t("hublive.aNe_topic")}</FieldLabel>
          <Select id="ws-nn-topic" className="min-h-[44px] w-full" value={topicId} onChange={(e) => setTopicId(e.target.value)}><option value="">{t("hublive.aNe_chooseTopic")}</option>{sorted.map((tp) => <option key={tp.id} value={tp.id}>{topicLabel(tp)}</option>)}</Select>
          <NewTopicInline qs={p.qs} topics={withNew} subject={withNew.find((t) => t.id === topicId)?.subject} canCreate={p.canEdit && !p.readOnly} testId="ws-new-topic" onCreated={(t) => { rememberTopic(t); setTopicId(t.id); }} /></div>
        <div><FieldLabel htmlFor="ws-nn-body">{t("hublive.aNe_bodyLabel")}</FieldLabel>
          <textarea id="ws-nn-body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("hublive.aNe_bodyPh")} className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[13.5px] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--brand)]" /></div>
        <label className="flex min-h-[44px] items-center gap-2.5 text-[13px] font-bold text-[var(--ink)]"><input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="h-[18px] w-[18px] accent-[var(--brand)]" />{t("hublive.aNe_visible")} <span className="font-normal text-[var(--ink-3)]">{t("hublive.aNe_visibleHint")}</span></label>
      </div>
    </Dialog>
  );
}

/** The same editor in a dialog — opened from the lesson cards ("Add notes / videos"). */
export function LessonNotesDialog({ p, lesson, onClose }: { p: PanelProps; lesson: Lesson; onClose: () => void }) {
  const t = useT();
  const { notes, reload } = useNotesList(p.qs);
  const [ids, setIds] = useState<string[]>(lesson.noteIds ?? []);
  return (
    <Dialog id="hub-lesson-notes-dialog" title={t("hublive.aNe_dlgTitle")} subtitle={lesson.title} size="lg" onClose={onClose}
      footer={<Button variant="solid" className={`min-h-[44px] ${FOCUS}`} onClick={onClose}>{t("hublive.aNe_done")}</Button>}>
      <LessonNotesEditor p={p} lesson={lesson} notes={notes} reloadNotes={reload} ids={ids} onIds={setIds} />
    </Dialog>
  );
}
