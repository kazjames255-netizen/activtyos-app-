"use client";

import { useEffect, useMemo, useState } from "react";
import { get } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import { Btn, StepCard, Tag, display } from "../lesson/lessonUi";
import { GroupQuickPick, pruneGroups } from "../groupKit";
import { FOCUS, Icon } from "../kit";
import { Segmented, StudentPicker } from "../teachKit";
import { LessonPicker } from "../lesson/picker/LessonPicker";
import { QuizPicker } from "../lesson/picker/QuizPicker";
import { parseYear } from "../curriculum/cells";
import type { HubGroup, Note, Student } from "../types";
import type { IpSession } from "./api";

// "Teach in person": what are you teaching (an interactive lesson, or a quiz / placement test on its own) and which children are here.
// Also lists a session still open from earlier ("Resume") so a refresh or a closed tab never loses a class.

export interface SetupChoice { noteId: string | null; assessmentId: string | null; childIds: string[]; groupIds: string[]; title: string }

export function SetupStep({ qs, students, groups, preset, live, onStart, onResume, onCancel, busy, error }: {
  qs: string; students: Student[]; groups: HubGroup[];
  preset: { noteId?: string; assessmentId?: string; childIds?: string[]; groupIds?: string[] };
  live: IpSession[]; onStart: (c: SetupChoice) => void; onResume: (s: IpSession) => void; onCancel: () => void; busy: boolean; error: string | null;
}) {
  const t = useT();
  const roster = useMemo(() => students.filter((s) => s.active !== false), [students]);
  const [what, setWhat] = useState<"lesson" | "quiz">(preset.assessmentId && !preset.noteId ? "quiz" : "lesson");
  const [note, setNote] = useState<{ id: string; title: string } | null>(null);
  const [paper, setPaper] = useState<{ id: string; title: string } | null>(null);
  const [childIds, setChildIds] = useState<string[]>(preset.childIds ?? []);
  const [groupIds, setGroupIds] = useState<string[]>(preset.groupIds ?? []);
  // The shelf at the top of the picker suggests lessons for the school year(s) of who is here (or of the whole roster until chosen).
  const years = useMemo(() => {
    const pool = childIds.length ? roster.filter((r) => childIds.includes(r.childId)) : roster;
    return [...new Set(pool.map((r) => parseYear(r.yearGroup)).filter((y): y is number => !!y))].sort((x, y) => x - y).slice(0, 4);
  }, [roster, childIds]);

  // A lesson / quiz handed in by the button that opened this (the Lessons card, a quiz card): show its name straight away.
  useEffect(() => {
    if (preset.noteId) get<Note>(`/api/learning-hub/notes/${preset.noteId}${qs}`).then((n) => setNote({ id: n.id, title: n.title })).catch(() => undefined);
    if (preset.assessmentId) get<{ id: string; title: string }>(`/api/learning-hub/assessments/${preset.assessmentId}${qs}`).then((a) => setPaper({ id: a.id, title: a.title })).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chosen = what === "lesson" ? note : paper;
  const ready = !!chosen && childIds.length > 0;
  const start = () => {
    if (!ready || !chosen) return;
    onStart({ noteId: what === "lesson" ? chosen.id : null, assessmentId: what === "quiz" ? chosen.id : null, childIds, groupIds, title: chosen.title });
  };

  return (
    <StepCard>
      <div className="flex items-start justify-between gap-3">
        <Tag tone="brand">{t("hublive.cTeachInPerson")}</Tag>
        <button type="button" onClick={onCancel} aria-label={t("hublive.cCancel")} data-testid="ip-setup-close"
          className={`-me-1.5 -mt-1.5 grid h-10 w-10 flex-none place-items-center rounded-xl text-[var(--ink-2)] hover:bg-[var(--panel)] ${FOCUS}`}>
          <Icon name="close" size={18} />
        </button>
      </div>
      <h2 className="m-0 mb-1 mt-2 text-[24px] font-extrabold text-[var(--ink)]" style={display} tabIndex={-1} data-autofocus>{t("hublive.cSetupTitle")}</h2>
      <p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]">{t("hublive.cSetupIntro")}</p>

      {live.length > 0 && (
        <div className="mt-4 rounded-2xl border border-[var(--line)] border-s-4 border-s-[var(--gold)] bg-[var(--panel)] p-3.5" data-testid="ip-resume">
          <div className="mb-2 text-[13.5px] font-extrabold text-[var(--ink)]">{t("hublive.cStillOpen")}</div>
          <ul className="m-0 grid list-none gap-2 p-0">
            {live.slice(0, 3).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 text-[13.5px] text-[var(--ink-2)]"><b className="text-[var(--ink)]">{s.title}</b> · {s.students.map((x) => x.childName.split(" ")[0]).slice(0, 4).join(", ")}{s.students.length > 4 ? ` +${s.students.length - 4}` : ""}</span>
                <Btn tone="ghost" className="!min-h-[44px]" onClick={() => onResume(s)} data-testid={`ip-resume-${s.id}`}>{t("hublive.cResume")}</Btn>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="mt-5" aria-labelledby="ip-what">
        <h3 id="ip-what" className="m-0 mb-2 text-[13px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">{t("hublive.cStep1")}</h3>
        <Segmented label={t("hublive.cWhatToTeach")} value={what} onChange={setWhat} options={[{ v: "lesson", label: t("hublive.cOptLesson") }, { v: "quiz", label: t("hublive.cOptQuiz") }]} />
        <div className="mt-3">
          {what === "lesson" ? (
            <LessonPicker key="lessons" qs={qs} mode="single" value={note ? [note.id] : []} years={years} testId="ip-filters" idPrefix="ip-lesson"
              onChange={(ids, items) => setNote(ids[0] ? { id: ids[0], title: items[0]?.title || note?.title || "" } : null)} />
          ) : (
            <QuizPicker key="papers" qs={qs} value={paper ? [paper.id] : []} idPrefix="ip-quiz"
              onChange={(ids, items) => setPaper(ids[0] ? { id: ids[0], title: items[0]?.title || paper?.title || "" } : null)} />
          )}
          {chosen && <p className="m-0 mt-2 text-[13px] text-[var(--ink-2)]" data-testid="ip-chosen">{t("hublive.cChosen")} <b className="text-[var(--ink)]">{chosen.title}</b></p>}
        </div>
      </section>

      <section className="mt-5" aria-labelledby="ip-who">
        <h3 id="ip-who" className="m-0 mb-2 text-[13px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">{t("hublive.cStep2")}</h3>
        <div className="grid gap-3">
          <GroupQuickPick groups={groups} roster={roster} childIds={childIds} groupIds={groupIds} onChange={(n) => { setChildIds(n.childIds); setGroupIds(n.groupIds); }} idPrefix="ip-group" />
          <StudentPicker students={roster} value={childIds} onChange={(ids) => { setChildIds(ids); setGroupIds((g) => pruneGroups(groups, roster, ids, g)); }} idPrefix="ip-student" />
        </div>
        <p className="m-0 mt-2 text-[12.5px] text-[var(--ink-3)]">{t("hublive.cChildrenHere", { n: childIds.length })}</p>
      </section>

      <p className="m-0 mt-5 text-[12.5px] text-[var(--ink-3)]" data-testid="ip-portal-hint">{t("hublive.cPortalHint")}</p>

      {error && <p role="alert" className="mt-4 rounded-xl bg-[var(--red-soft)] px-3.5 py-2.5 text-[13.5px] font-semibold text-[var(--red)]">{error}</p>}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Btn tone="ghost" onClick={onCancel}>{t("hublive.cCancel")}</Btn>
        <Btn onClick={start} disabled={!ready || busy} data-testid="ip-start">{busy ? t("hublive.cStarting") : t("hublive.cSetupStart")}</Btn>
      </div>
    </StepCard>
  );
}
