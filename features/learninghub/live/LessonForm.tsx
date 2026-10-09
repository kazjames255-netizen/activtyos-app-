"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, FieldLabel, Input } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { get, post, put } from "@/lib/api";
import { errMsg, groupMemberIds, topicLabel, type HubGroup, type NoteLite, type Student, type Topic } from "../types";
import { tint } from "../kit";
import { GroupQuickPick, RecipientSummary, pruneGroups } from "../groupKit";
import { VideoEditor, videoPayload, videosToInputs } from "../videoKit";
import { DISPLAY, Dialog, FOCUS, Notice, StudentPicker, toLocalInput, tzLabel, uiLocale, withQs } from "../teachKit";
import { LessonPicker } from "../lesson/picker/LessonPicker";
import { AttachDialog } from "./workspace/LessonNotesEditor";
import type { Lesson } from "./lessonTypes";
import { uiDate, uiTime, uiDateTime } from "@/lib/i18n/format";

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

/** "Go live now" from the merged New session chooser: a minute ahead of this instant so it never reads as a
 *  past start once the dialog is open and filled in, and it's already inside the join window (opens 10 min
 *  before the scheduled start), so saving drops the tutor straight into the lobby. */
function nowStart(): string {
  return toLocalInput(new Date(Date.now() + 60_000));
}
const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch { return undefined; } };
const dayLabel = (ms: number) => uiDate(new Date(ms), { weekday: "short", day: "numeric", month: "short" }, uiLocale());

/** Lessons from the library attached at creation (F14). The list of the tutor's lessons is fetched the first time the picker opens. */
function AttachField({ qs, topics, value, onChange, testId }: { qs: string; topics: Topic[]; value: string[]; onChange: (ids: string[]) => void; testId: string }) {
  const t = useT();
  const [notes, setNotes] = useState<NoteLite[] | null>(null);
  const [open, setOpen] = useState(false);
  const load = () => { if (notes === null) get<NoteLite[]>(`/api/learning-hub/notes${withQs(qs, {})}`).then((n) => setNotes(Array.isArray(n) ? n : [])).catch(() => setNotes([])); };
  useEffect(() => { if (value.length) load(); /* names for what is already attached */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const byId = new Map((notes ?? []).map((n) => [n.id, n]));
  return (
    <div data-testid={testId}>
      <FieldLabel>{t("hublive.aForm_attachLabel")}</FieldLabel>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((id) => <span key={id} className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-[3px] text-[12px] font-bold text-[var(--ink-2)]">{byId.get(id)?.title ?? t("hublive.aForm_lessonFallback")}<button type="button" aria-label={t("hublive.aForm_removeX", { title: byId.get(id)?.title ?? t("hublive.aForm_lessonFallback") })} onClick={() => onChange(value.filter((x) => x !== id))} className="text-[var(--ink-3)] hover:text-[var(--red)]">×</button></span>)}
        <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} onClick={() => { load(); setOpen(true); }} data-testid={`${testId}-open`}>{value.length ? t("hublive.aForm_changeLessons") : t("hublive.aForm_attachFrom")}</Button>
      </div>
      <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">{t("hublive.aForm_attachHint")}</p>
      {open && <AttachDialog qs={qs} attached={value} onClose={() => setOpen(false)} onSave={async (ids) => { onChange(ids); setOpen(false); }} />}
    </div>
  );
}

/** One coloured card of the lesson form: an emoji tile, a bold heading, a one-line hint, then its fields. Colours are the hub's own
 *  variables mixed into the surface (dark-theme safe); cards stack on a phone, so nothing shifts sideways. */
function FormSection({ tone, emoji, title, hint, testId, children }: { tone: string; emoji: string; title: string; hint: string; testId: string; children: ReactNode }) {
  return (
    <section data-testid={testId} className="grid gap-3 rounded-2xl border border-s-4 p-4 sm:p-5" style={{ background: tint(tone, 7), borderColor: tint(tone, 30), borderInlineStartColor: tone }}>
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid h-11 w-11 flex-none place-items-center rounded-xl text-[22px]" style={{ background: tint(tone, 22), boxShadow: `inset 0 0 0 1px ${tint(tone, 40)}` }}>{emoji}</span>
        <div className="min-w-0">
          <h3 className="m-0 text-[17px] font-extrabold leading-tight text-[var(--ink)]" style={DISPLAY}>{title}</h3>
          <p className="m-0 mt-0.5 text-[12.5px] text-[var(--ink-3)]">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function LessonForm({ lesson, topics: topicsProp, students, qs, defaultTopicId, groups = [], initialGroupId = null, startNow = false, inPerson: inPersonProp = false, onClose, onSaved }: {
  lesson: Lesson | null;
  topics: Topic[];
  students: Student[];
  qs: string;
  defaultTopicId: string | null;
  groups?: HubGroup[];
  /** Quick action: open with this group's members already invited. */
  initialGroupId?: string | null;
  /** The merged "New session" chooser's "now" choice: start a minute from now instead of the usual tomorrow default. Creating only. */
  startNow?: boolean;
  /** Schedule an IN-PERSON lesson (no video room). Editing takes the lesson's own mode. */
  inPerson?: boolean;
  onClose: () => void;
  onSaved: (l: Lesson) => void;
}) {
  const t = useT();
  const inPerson = lesson ? lesson.mode === "in_person" : inPersonProp;
  const roster = useMemo(() => students.filter((s) => s.active !== false), [students]);
  const [title, setTitle] = useState(lesson?.title ?? "");
  const topics = topicsProp;
  const [topicId, setTopicId] = useState(lesson ? lesson.topicId ?? "" : defaultTopicId ?? "");
  // What this session is about: the same rich lesson picker "Teach in person" uses (subject tiles -> curriculum -> lesson cards),
  // not a flat topic dropdown. Picking a lesson sets both its topic (for filtering/reporting) and attaches it as the material.
  // Editing an existing lesson can't reverse a topicId back to one specific card, so the picker starts empty and the current
  // topic (if any) is shown as a label until the tutor picks a lesson here.
  const [pick, setPick] = useState<{ id: string; title: string } | null>(null);
  const [start, setStart] = useState(() => (lesson ? toLocalInput(new Date(lesson.startsAt)) : startNow ? nowStart() : defaultStart()));
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
    !title.trim() ? t("hublive.aForm_needTitle") :
    !Number.isFinite(startMs) ? t("hublive.aForm_needDate") :
    !lesson && !held && startMs < Date.now() - 60_000 ? t("hublive.aForm_pastStart") :
    !lesson && held && startMs + mins * 60_000 > Date.now() ? t("hublive.aForm_heldNotFinished") :
    !lesson && repeat && !held && !(weeks >= 2 && weeks <= 26) ? t("hublive.aForm_repeatRange") :
    !(mins >= 10 && mins <= 480) ? t("hublive.aForm_durRange") :
    childIds.length === 0 ? t("hublive.aForm_needStudent") : null;

  const save = async () => {
    if (problem || busy) { setErr(problem); return; }
    setBusy(true); setErr(null);
    // Editing: send the time only if it actually moved, so a title tweak doesn't notify families of a "new time".
    const timeSame = !!lesson && start === toLocalInput(new Date(lesson.startsAt));
    const body = {
      title: title.trim(), topicId: topicId || null, childIds, groupIds, notes: notes.trim(), ...(inPerson ? {} : { videos: videoPayload(videos) }),
      ...(timeSame ? {} : { startsAt: new Date(start).toISOString() }),
      ...(lesson && mins === lesson.durationMins ? {} : { durationMins: mins }),
      ...(!lesson || noteIds.join() !== (lesson.noteIds ?? []).join() ? { noteIds } : {}),
      ...(!lesson && inPerson ? { mode: "in_person" as const } : {}),
      ...(!lesson && held ? { held: true, attendedChildIds: childIds.filter((c) => !absent.includes(c)) } : {}),
      ...(!lesson && !held && repeat ? { repeatWeeks: weeks, timeZone: zone() } : {}),
    };
    try {
      const saved = lesson
        ? await put<Lesson>(`/api/learning-hub/lessons/${lesson.id}${qs}`, body)
        : await post<Lesson>(`/api/learning-hub/lessons${qs}`, body);
      onSaved(saved);
    } catch (e) { setErr(errMsg(e, t("hublive.aForm_saveFail"))); setBusy(false); }
  };

  const currentTopic = !pick && topicId ? topics.find((tp) => tp.id === topicId) : undefined;
  const lastWeek = useMemo(() => {
    if (!repeat || !Number.isFinite(startMs)) return "";
    const d = new Date(startMs);
    d.setDate(d.getDate() + 7 * (weeks - 1)); // local wall-clock arithmetic: stays at the same time across a clock change
    return dayLabel(d.getTime());
  }, [repeat, startMs, weeks]);
  const repeatFor = t("hublive.aForm_repeatFor").split("{input}");
  const endLabel = Number.isFinite(startMs) ? uiTime(new Date(startMs + mins * 60_000), { hour: "2-digit", minute: "2-digit" }, uiLocale()) : "";

  // The one-line recap next to the buttons: "Wed 30 Sep, 13:00–14:00 · 2 students · English lesson".
  const summary = Number.isFinite(startMs) && childIds.length > 0
    ? [
        `${uiDate(new Date(startMs), { weekday: "short", day: "numeric", month: "short" }, uiLocale())}, ${uiTime(new Date(startMs), { hour: "2-digit", minute: "2-digit" }, uiLocale())}–${endLabel}`,
        childIds.length === 1 ? t("hublive.aForm_sumStudents1") : t("hublive.aForm_sumStudentsN", { n: childIds.length }),
        ...(pick?.title ? [pick.title] : []),
      ].join(" · ")
    : "";

  return (
    <Dialog id="hub-lesson-form" size="3xl" title={lesson ? t("hublive.aForm_titleEdit") : held ? t("hublive.aForm_titleHeld") : inPerson ? t("hublive.aForm_titleNewIp") : t("hublive.aForm_titleNew")} subtitle={t("hublive.aForm_subtitle", { tz: tzLabel() })} onClose={onClose}
      footer={<>
        {problem
          ? <span data-testid="hub-lesson-form-problem" role="status" className="me-auto self-center text-[13px] font-semibold text-[var(--red)]">{problem}</span>
          : summary ? <span data-testid="hub-lesson-summary" className="me-auto min-w-0 max-w-full self-center truncate rounded-full px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink)]" style={{ background: tint("var(--brand-2)", 12), boxShadow: `inset 0 0 0 1px ${tint("var(--brand-2)", 30)}` }}>{summary}</span> : null}
        <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} onClick={onClose}>{t("hublive.aForm_cancel")}</Button>
        <Button variant="solid" className={`min-h-[44px] ${FOCUS}`} onClick={() => void save()} disabled={busy || !!problem}>{busy ? t("hublive.aForm_saving") : lesson ? t("hublive.aForm_saveChanges") : held ? t("hublive.aForm_logLesson") : repeat ? t("hublive.aForm_scheduleWeekly", { n: weeks }) : inPerson ? t("hublive.aPanel_scheduleIp") : t("hublive.aPanel_schedule")}</Button>
      </>}>
      <div className="grid gap-4">
        {err && <Notice onClose={() => setErr(null)}>{err}</Notice>}
        {lesson?.seriesId && lesson.seriesCount && <p data-testid="hub-lesson-series-note" className="m-0 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[12.5px] text-[var(--ink-2)]">{t("hublive.aForm_seriesNote", { i: (lesson.seriesIndex ?? 0) + 1, n: lesson.seriesCount })}</p>}
        {!lesson && !inPerson && (
          <div role="group" aria-label={t("hublive.aForm_howToAdd")} className="inline-flex max-w-full flex-wrap gap-1 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-1">
            {([[false, t("hublive.aForm_modeSchedule")], [true, t("hublive.aForm_modeHeld")]] as const).map(([v, label]) => (
              <button key={String(v)} type="button" aria-pressed={held === v} data-testid={v ? "hub-lesson-mode-held" : "hub-lesson-mode-schedule"} onClick={() => { setHeld(v); if (v) { setRepeat(false); setStart(pastStart()); } else setStart(defaultStart()); }}
                className={`min-h-[44px] rounded-xl px-3.5 text-[12.5px] font-bold transition-colors ${FOCUS} ${held === v ? "bg-[var(--surface)] text-[var(--brand)] shadow-[var(--shadow-sm)]" : "text-[var(--ink-3)] hover:text-[var(--ink)]"}`}>{label}</button>
            ))}
          </div>
        )}
        <div>
          <FieldLabel htmlFor="hub-lesson-title">{t("hublive.aForm_title")}</FieldLabel>
          <Input id="hub-lesson-title" data-autofocus className="min-h-[44px] w-full" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t("hublive.aForm_titlePh")} />
        </div>
        <FormSection tone="var(--brand-2)" emoji="👥" title={t("hublive.aForm_secWho")} hint={t("hublive.aForm_secWhoHint")} testId="hub-lesson-sec-who">
          <div>
            <div className="grid gap-3">
              <GroupQuickPick groups={groups} roster={roster} childIds={childIds} groupIds={groupIds} onChange={(n) => { setChildIds(n.childIds); setGroupIds(n.groupIds); }} idPrefix="hub-lesson-group" />
              <StudentPicker students={roster} value={childIds} onChange={(ids) => { setChildIds(ids); setGroupIds((g) => pruneGroups(groups, roster, ids, g)); }} idPrefix="hub-lesson-student" />
            </div>
            <RecipientSummary count={childIds.length} verb={held ? t("hublive.aForm_recording") : t("hublive.aForm_inviting")} />
          </div>
          {!lesson && held && childIds.length > 0 && (
            <div data-testid="hub-lesson-attendance">
              <FieldLabel>{t("hublive.aForm_whoCame")}</FieldLabel>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("hublive.aForm_attendance")}>
                {childIds.map((id) => {
                  const name = roster.find((r) => r.childId === id)?.childName ?? t("hublive.aPanel_student");
                  const came = !absent.includes(id);
                  return <button key={id} type="button" aria-pressed={came} data-testid={`hub-lesson-attended-${id}`} onClick={() => setAbsent((a) => (came ? [...a, id] : a.filter((x) => x !== id)))}
                    className={`min-h-[44px] rounded-full border px-3 text-[12.5px] font-bold ${FOCUS} ${came ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[var(--line)] text-[var(--ink-3)] line-through"}`}>{name}</button>;
                })}
              </div>
              <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">{t("hublive.aForm_attendedHint")}</p>
            </div>
          )}
        </FormSection>
        <FormSection tone="var(--green)" emoji="📚" title={t("hublive.aForm_secWhat")} hint={t("hublive.aForm_secWhatHint")} testId="hub-lesson-sec-what">
          <div>
            <FieldLabel htmlFor="hub-lesson-topic-picker">{t("hublive.aForm_topicOpt")}</FieldLabel>
            {currentTopic && (
              <p className="m-0 mb-1.5 text-[12.5px] text-[var(--ink-2)]">{t("hublive.aForm_topicCurrent")} <b className="text-[var(--ink)]">{topicLabel(currentTopic)}</b></p>
            )}
            <LessonPicker qs={qs} mode="single" value={pick ? [pick.id] : []} idPrefix="hub-lesson-topic" testId="hub-lesson-topic-picker"
              onChange={(ids, items) => {
                if (ids[0]) { setPick({ id: ids[0], title: items[0]?.title ?? "" }); setTopicId(items[0]?.topicId ?? topicId); setNoteIds((cur) => (cur.includes(ids[0]!) ? cur : [ids[0]!, ...cur])); }
                else setPick(null);
              }} />
            <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">{t("hublive.aForm_topicHint")}</p>
          </div>
        </FormSection>
        <FormSection tone="var(--gold)" emoji="🗓️" title={t("hublive.aForm_secWhen")} hint={t("hublive.aForm_secWhenHint")} testId="hub-lesson-sec-when">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="hub-lesson-start">{t("hublive.aForm_starts")}</FieldLabel>
              <Input id="hub-lesson-start" type="datetime-local" className="min-h-[44px] w-full" value={start} onChange={(e) => setStart(e.target.value)} />
              {Number.isFinite(startMs) && <p data-testid="hub-lesson-start-text" className="mt-2 inline-flex max-w-full rounded-full px-3 py-1 text-[13.5px] font-extrabold text-[var(--ink)]" style={{ background: tint("var(--gold)", 24), boxShadow: `inset 0 0 0 1px ${tint("var(--gold)", 45)}` }}>{uiDateTime(new Date(startMs), { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" }, uiLocale())}</p>}
            </div>
            <div>
              <FieldLabel htmlFor="hub-lesson-mins">{t("hublive.aForm_lengthMins")}</FieldLabel>
              <Input id="hub-lesson-mins" type="number" min={10} max={480} step={5} className="min-h-[44px] w-full" value={mins} onChange={(e) => setMins(Number(e.target.value))} />
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {PRESETS.map((p) => (
                  <button key={p} type="button" aria-pressed={mins === p} onClick={() => setMins(p)}
                    className={`min-h-[44px] lg:min-h-[36px] rounded-full border px-3 text-[12px] font-bold ${FOCUS} ${mins === p ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--brand)]"}`}>{p}</button>
                ))}
                {endLabel && <span className="ms-1 text-[11.5px] text-[var(--ink-3)]">{t("hublive.aForm_ends", { time: endLabel })}</span>}
              </div>
            </div>
          </div>
          {!lesson && !held && (
            <div>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-[13px] font-bold text-[var(--ink)]">
                <input type="checkbox" id="hub-lesson-repeat" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="h-[18px] w-[18px] accent-[var(--brand)]" />{t("hublive.aForm_repeatEvery")}
              </label>
              {repeat && (
                <div className="mt-1 flex flex-wrap items-center gap-2 ps-7 text-[12.5px] text-[var(--ink-2)]">
                  {repeatFor[0]}<Input id="hub-lesson-weeks" type="number" min={2} max={26} aria-label={t("hublive.aForm_weeksAria")} className="min-h-[44px] w-[84px]" value={weeks} onChange={(e) => setWeeks(Math.max(0, Math.min(26, Number(e.target.value) || 0)))} />{repeatFor[1]}
                  {lastWeek && <span data-testid="hub-lesson-repeat-summary" className="text-[var(--ink-3)]">{t("hublive.aForm_repeatLast", { date: lastWeek })}</span>}
                </div>
              )}
            </div>
          )}
        </FormSection>
        <FormSection tone="var(--violet)" emoji="✨" title={t("hublive.aForm_secExtras")} hint={t("hublive.aForm_secExtrasHint")} testId="hub-lesson-sec-extras">
          <AttachField qs={qs} topics={topics} value={noteIds} onChange={setNoteIds} testId="hub-lesson-attach" />
          {!inPerson && (
            <div>
              <FieldLabel htmlFor="hub-lesson-video-link">{t("hublive.aForm_videosOpt")}</FieldLabel>
              <VideoEditor idPrefix="hub-lesson-video" value={videos} onChange={setVideos} hint={t("hublive.aForm_videoHint")} />
            </div>
          )}
          <div>
            <FieldLabel htmlFor="hub-lesson-notes">{t("hublive.aForm_msgLabel")}</FieldLabel>
            <textarea id="hub-lesson-notes" rows={3} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("hublive.aForm_msgPh")}
              className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
            <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">{t("hublive.aForm_msgHint")}</p>
          </div>
        </FormSection>
      </div>
    </Dialog>
  );
}
