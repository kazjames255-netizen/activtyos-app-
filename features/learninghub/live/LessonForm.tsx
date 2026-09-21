"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, FieldLabel, Input, Select } from "@/components/ui";
import { get, post, put } from "@/lib/api";
import { errMsg, groupMemberIds, topicLabel, type HubGroup, type NoteLite, type Student, type Topic } from "../types";
import { GroupQuickPick, RecipientSummary, pruneGroups } from "../groupKit";
import { VideoEditor, videoPayload, videosToInputs } from "../videoKit";
import { Dialog, FOCUS, Notice, StudentPicker, toLocalInput, tzLabel, withQs } from "../teachKit";
import { NewTopicInline, useTopicsWithNew } from "../NewTopicInline";
import { AttachDialog } from "./workspace/LessonNotesEditor";
import type { Lesson } from "./lessonTypes";

// Tutor: schedule or edit a lesson. Times are entered in the tutor's local
// timezone and sent as an ISO instant, so every viewer sees their own local time.

const PRESETS = [30, 45, 60, 90];

function defaultStart(): string {
  const d = new Date(Date.now() + 24 * 3_600_000);
  d.setMinutes(0, 0, 0);
  return toLocalInput(d);
}

function pastStart(): string {
  const d = new Date(Date.now() - 24 * 3_600_000);
  d.setMinutes(0, 0, 0);
  return toLocalInput(d);
}
const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch { return undefined; } };
const dayLabel = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

/** Lessons from the library attached at creation (F14). The list of the tutor's lessons is fetched the first time the picker opens. */
function AttachField({ qs, topics, value, onChange, testId }: { qs: string; topics: Topic[]; value: string[]; onChange: (ids: string[]) => void; testId: string }) {
  const [notes, setNotes] = useState<NoteLite[] | null>(null);
  const [open, setOpen] = useState(false);
  const load = () => { if (notes === null) get<NoteLite[]>(`/api/learning-hub/notes${withQs(qs, {})}`).then((n) => setNotes(Array.isArray(n) ? n : [])).catch(() => setNotes([])); };
  useEffect(() => { if (value.length) load(); /* names for what is already attached */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const byId = new Map((notes ?? []).map((n) => [n.id, n]));
  return (
    <div data-testid={testId}>
      <FieldLabel>Lessons to attach (optional)</FieldLabel>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((id) => <span key={id} className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-[3px] text-[12px] font-bold text-[var(--ink-2)]">{byId.get(id)?.title ?? "Lesson"}<button type="button" aria-label={`Remove ${byId.get(id)?.title ?? "lesson"}`} onClick={() => onChange(value.filter((x) => x !== id))} className="text-[var(--ink-3)] hover:text-[var(--red)]">×</button></span>)}
        <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} onClick={() => { load(); setOpen(true); }} data-testid={`${testId}-open`}>{value.length ? "Change lessons" : "Attach lessons from my library"}</Button>
      </div>
      <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">Students see these first beside the video. Up to 12.</p>
      {open && <AttachDialog notes={notes} topics={topics} attached={value} onClose={() => setOpen(false)} onSave={async (ids) => { onChange(ids); setOpen(false); }} />}
    </div>
  );
}

export function LessonForm({ lesson, topics: topicsProp, students, qs, defaultTopicId, groups = [], initialGroupId = null, onClose, onSaved }: {
  lesson: Lesson | null;
  topics: Topic[];
  students: Student[];
  qs: string;
  defaultTopicId: string | null;
  groups?: HubGroup[];
  /** Quick action: open with this group's members already invited. */
  initialGroupId?: string | null;
  onClose: () => void;
  onSaved: (l: Lesson) => void;
}) {
  const roster = useMemo(() => students.filter((s) => s.active !== false), [students]);
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [topics, rememberTopic] = useTopicsWithNew(topicsProp);
  const [topicId, setTopicId] = useState(lesson ? lesson.topicId ?? "" : defaultTopicId ?? "");
  const [start, setStart] = useState(() => (lesson ? toLocalInput(new Date(lesson.startsAt)) : defaultStart()));
  const [mins, setMins] = useState(lesson?.durationMins ?? 60);
  const preGroup = useMemo(() => (initialGroupId ? groups.find((g) => g.id === initialGroupId) ?? null : null), [initialGroupId, groups]);
  const [childIds, setChildIds] = useState<string[]>(() => lesson?.childIds ?? (preGroup ? groupMemberIds(preGroup) : roster.length === 1 ? [roster[0]!.childId] : []));
  const [groupIds, setGroupIds] = useState<string[]>(() => lesson?.groupIds ?? (preGroup ? [preGroup.id] : []));
  const [videos, setVideos] = useState(() => videosToInputs(lesson?.videos));
  const [notes, setNotes] = useState(lesson?.notes ?? "");
  const [noteIds, setNoteIds] = useState<string[]>(lesson?.noteIds ?? []);
  // F14: log a lesson that already happened (past, with who attended, no room), or repeat weekly. Both only when creating.
  const [held, setHeld] = useState(false);
  const [absent, setAbsent] = useState<string[]>([]);
  const [repeat, setRepeat] = useState(false);
  const [weeks, setWeeks] = useState(6);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const startMs = new Date(start).getTime();
  const problem =
    !title.trim() ? "Give the lesson a title." :
    !Number.isFinite(startMs) ? "Pick a date and time." :
    !lesson && !held && startMs < Date.now() - 60_000 ? "That start time is in the past — to record a lesson that already happened, choose “Log a lesson already held”." :
    !lesson && held && startMs + mins * 60_000 > Date.now() ? "A lesson you've already held has to have finished — pick the time it actually ran." :
    !lesson && repeat && !held && !(weeks >= 2 && weeks <= 26) ? "Repeat for between 2 and 26 weeks." :
    !(mins >= 10 && mins <= 480) ? "Duration must be between 10 minutes and 8 hours." :
    childIds.length === 0 ? "Choose at least one student." : null;

  const save = async () => {
    if (problem || busy) { setErr(problem); return; }
    setBusy(true); setErr(null);
    // Editing: send the time only if it actually moved, so a title tweak doesn't notify families of a "new time".
    const timeSame = !!lesson && start === toLocalInput(new Date(lesson.startsAt));
    const body = {
      title: title.trim(), topicId: topicId || null, childIds, groupIds, notes: notes.trim(), videos: videoPayload(videos),
      ...(timeSame ? {} : { startsAt: new Date(start).toISOString() }),
      ...(lesson && mins === lesson.durationMins ? {} : { durationMins: mins }),
      ...(!lesson || noteIds.join() !== (lesson.noteIds ?? []).join() ? { noteIds } : {}),
      ...(!lesson && held ? { held: true, attendedChildIds: childIds.filter((c) => !absent.includes(c)) } : {}),
      ...(!lesson && !held && repeat ? { repeatWeeks: weeks, timeZone: zone() } : {}),
    };
    try {
      const saved = lesson
        ? await put<Lesson>(`/api/learning-hub/lessons/${lesson.id}${qs}`, body)
        : await post<Lesson>(`/api/learning-hub/lessons${qs}`, body);
      onSaved(saved);
    } catch (e) { setErr(errMsg(e, "Couldn't save the lesson")); setBusy(false); }
  };

  const sortedTopics = useMemo(() => [...topics].sort((a, b) => topicLabel(a).localeCompare(topicLabel(b))), [topics]);
  const lastWeek = useMemo(() => {
    if (!repeat || !Number.isFinite(startMs)) return "";
    const d = new Date(startMs);
    d.setDate(d.getDate() + 7 * (weeks - 1)); // local wall-clock arithmetic: stays at the same time across a clock change
    return dayLabel(d.getTime());
  }, [repeat, startMs, weeks]);
  const endLabel = Number.isFinite(startMs) ? new Date(startMs + mins * 60_000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <Dialog id="hub-lesson-form" title={lesson ? "Edit video lesson" : held ? "Log a lesson you've already held" : "Schedule a video lesson"} subtitle={`Times are in your timezone (${tzLabel()}). Students see them in theirs.`} onClose={onClose}
      footer={<>
        <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} onClick={onClose}>Cancel</Button>
        <Button variant="solid" className={`min-h-[44px] ${FOCUS}`} onClick={() => void save()} disabled={busy || !!problem}>{busy ? "Saving…" : lesson ? "Save changes" : held ? "Log lesson" : repeat ? `Schedule ${weeks} weekly lessons` : "Schedule video lesson"}</Button>
      </>}>
      <div className="grid gap-4">
        {err && <Notice onClose={() => setErr(null)}>{err}</Notice>}
        {lesson?.seriesId && lesson.seriesCount && <p data-testid="hub-lesson-series-note" className="m-0 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[12.5px] text-[var(--ink-2)]">This is week {(lesson.seriesIndex ?? 0) + 1} of {lesson.seriesCount} in a weekly series. Changes here apply to this lesson only.</p>}
        {!lesson && (
          <div role="group" aria-label="How to add the lesson" className="inline-flex max-w-full flex-wrap gap-1 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-1">
            {([[false, "Schedule a lesson"], [true, "Log a lesson already held"]] as const).map(([v, label]) => (
              <button key={label} type="button" aria-pressed={held === v} data-testid={v ? "hub-lesson-mode-held" : "hub-lesson-mode-schedule"} onClick={() => { setHeld(v); if (v) { setRepeat(false); setStart(pastStart()); } else setStart(defaultStart()); }}
                className={`min-h-[44px] rounded-xl px-3.5 text-[12.5px] font-bold transition-colors ${FOCUS} ${held === v ? "bg-[var(--surface)] text-[var(--brand)] shadow-[var(--shadow-sm)]" : "text-[var(--ink-3)] hover:text-[var(--ink)]"}`}>{label}</button>
            ))}
          </div>
        )}
        <div>
          <FieldLabel htmlFor="hub-lesson-title">Title</FieldLabel>
          <Input id="hub-lesson-title" data-autofocus className="min-h-[44px] w-full" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Quadratics: factorising" />
        </div>
        <div>
          <FieldLabel htmlFor="hub-lesson-topic">Topic (optional)</FieldLabel>
          <Select id="hub-lesson-topic" className="min-h-[44px] w-full" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">No specific topic</option>
            {sortedTopics.map((t) => <option key={t.id} value={t.id}>{topicLabel(t)}</option>)}
          </Select>
          <NewTopicInline qs={qs} topics={topics} subject={topics.find((t) => t.id === topicId)?.subject} testId="live-new-topic" onCreated={(t) => { rememberTopic(t); setTopicId(t.id); }} />
          <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">The topic&rsquo;s lessons appear beside the video during the call.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="hub-lesson-start">Starts</FieldLabel>
            <Input id="hub-lesson-start" type="datetime-local" className="min-h-[44px] w-full" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="hub-lesson-mins">Length (minutes)</FieldLabel>
            <Input id="hub-lesson-mins" type="number" min={10} max={480} step={5} className="min-h-[44px] w-full" value={mins} onChange={(e) => setMins(Number(e.target.value))} />
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {PRESETS.map((p) => (
                <button key={p} type="button" aria-pressed={mins === p} onClick={() => setMins(p)}
                  className={`min-h-[44px] lg:min-h-[36px] rounded-full border px-3 text-[12px] font-bold ${FOCUS} ${mins === p ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--brand)]"}`}>{p}</button>
              ))}
              {endLabel && <span className="ml-1 text-[11.5px] text-[var(--ink-3)]">ends {endLabel}</span>}
            </div>
          </div>
        </div>
        {!lesson && !held && (
          <div>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-[13px] font-bold text-[var(--ink)]">
              <input type="checkbox" id="hub-lesson-repeat" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="h-[18px] w-[18px] accent-[var(--brand)]" />Repeat every week
            </label>
            {repeat && (
              <div className="mt-1 flex flex-wrap items-center gap-2 pl-7 text-[12.5px] text-[var(--ink-2)]">
                for <Input id="hub-lesson-weeks" type="number" min={2} max={26} aria-label="Number of weekly lessons" className="min-h-[44px] w-[84px]" value={weeks} onChange={(e) => setWeeks(Math.max(0, Math.min(26, Number(e.target.value) || 0)))} /> lessons
                {lastWeek && <span data-testid="hub-lesson-repeat-summary" className="text-[var(--ink-3)]">— the last one is on {lastWeek}. You can edit or cancel any single week afterwards.</span>}
              </div>
            )}
          </div>
        )}
        <div>
          <FieldLabel>Students</FieldLabel>
          <div className="grid gap-3">
            <GroupQuickPick groups={groups} roster={roster} childIds={childIds} groupIds={groupIds} onChange={(n) => { setChildIds(n.childIds); setGroupIds(n.groupIds); }} idPrefix="hub-lesson-group" />
            <StudentPicker students={roster} value={childIds} onChange={(ids) => { setChildIds(ids); setGroupIds((g) => pruneGroups(groups, roster, ids, g)); }} idPrefix="hub-lesson-student" />
          </div>
          <RecipientSummary count={childIds.length} verb={held ? "Recording" : "Inviting"} />
        </div>
        {!lesson && held && childIds.length > 0 && (
          <div data-testid="hub-lesson-attendance">
            <FieldLabel>Who came?</FieldLabel>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Attendance">
              {childIds.map((id) => {
                const name = roster.find((r) => r.childId === id)?.childName ?? "Student";
                const came = !absent.includes(id);
                return <button key={id} type="button" aria-pressed={came} data-testid={`hub-lesson-attended-${id}`} onClick={() => setAbsent((a) => (came ? [...a, id] : a.filter((x) => x !== id)))}
                  className={`min-h-[44px] rounded-full border px-3 text-[12.5px] font-bold ${FOCUS} ${came ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[var(--line)] text-[var(--ink-3)] line-through"}`}>{name}</button>;
              })}
            </div>
            <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">Ticked = attended. Families aren&rsquo;t sent a notification for a lesson you log afterwards, and there&rsquo;s no video room for it.</p>
          </div>
        )}
        <AttachField qs={qs} topics={topics} value={noteIds} onChange={setNoteIds} testId="hub-lesson-attach" />
        <div>
          <FieldLabel htmlFor="hub-lesson-video-link">Videos to watch (optional)</FieldLabel>
          <VideoEditor idPrefix="hub-lesson-video" value={videos} onChange={setVideos} hint="Pre-lesson viewing or a recap — shown with the lesson, and beside the call." />
        </div>
        <div>
          <FieldLabel htmlFor="hub-lesson-notes">Message for students — they&rsquo;ll see this before and during the lesson (optional)</FieldLabel>
          <textarea id="hub-lesson-notes" rows={3} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Bring your last homework and a calculator."
            className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
          <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">Shown on the lesson card and in the lobby, and pinned beside the video during the call — for you and every student. (This is separate from the title.)</p>
        </div>
      </div>
    </Dialog>
  );
}
