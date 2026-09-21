"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PanelProps } from "../../panelTypes";
import { DISPLAY, FOCUS, Avatar } from "../../teachKit";
import { Ico } from "../../teachIcons";
import { ProgressView } from "../../progress/ProgressView";
import type { Lesson } from "../lessonTypes";
import { WS_TABS, type WsTabKey } from "./tabs";
import { LessonBoard } from "../board/LessonBoard";
import { busEmit, setBoardShown, useTutorPresenting, useUnseenBoardOps } from "../board/callObject";
import { CardsTab } from "./CardsTab";
import { FamilyHomework } from "./FamilyHomework";
import { HomeworkTab } from "./HomeworkTab";
import { NotesTab } from "./NotesTab";
import { ProgressTab } from "./ProgressTab";
import { QuizTab } from "./QuizTab";
import { StudentsTab } from "./StudentsTab";
import { TabBoundary } from "./TabBoundary";
import { LessonShareProvider, TeachableLessons, useLessonShare } from "./TeachLesson";
import { OverlayHostCtx, PaneOverlay, WsButton, WsViewCtx, maskName, type WsView } from "./wsKit";
import { useWorkspaceData } from "./useWorkspaceData";
import { attendeesOf } from "./wsLib";

// The in-call workspace: the hub's information for THIS lesson's students,
// beside the video. Tutors get Students · Notes · Progress · Homework · Quiz ·
// Cards, scoped to the lesson's attendees (a group lesson shows the group);
// families get a lighter Notes · Homework · Cards for their own child only.
// Every tab reuses the hub's own components/endpoints — no domain logic here.

/** A family on a phone may have the workspace collapsed: when the tutor starts teaching a lesson, ask the room to open it. */
function TeachingWatcher() {
  const { tutorTeaching } = useLessonShare();
  useEffect(() => { if (tutorTeaching) busEmit("workspace", true); }, [tutorTeaching]);
  return null;
}

export type { WsTabKey };
export function Workspace({ p, lesson, isTutor, view, active, now, tab, onTab }: {
  p: PanelProps; lesson: Lesson; isTutor: boolean; view: WsView; /** Is the pane visible right now? (drives the 1–6 shortcuts) */ active: boolean; now: number;
  tab: WsTabKey; onTab: (t: WsTabKey) => void;
}) {
  const tabs = useMemo(() => WS_TABS(isTutor), [isTutor]);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [drawer, setDrawer] = useState<string | null>(null);
  const attendees = useMemo(() => attendeesOf(lesson, p.students), [lesson, p.students]);
  const data = useWorkspaceData(p.qs, isTutor);
  const groupNames = useMemo(() => (p.groups ?? []).filter((g) => (lesson.groupIds ?? []).includes(g.id)).map((g) => g.name), [p.groups, lesson.groupIds]);
  const current = tabs.some((t) => t.key === tab) ? tab : tabs[0]!.key;
  const listRef = useRef<HTMLDivElement>(null);
  const boardLive = useUnseenBoardOps();
  const tutorPresenting = useTutorPresenting();
  useEffect(() => { if (tutorPresenting && !isTutor) onTab("board"); }, [tutorPresenting, isTutor, onTab]); // the tutor put the board on the main stage
  useEffect(() => { setBoardShown(active && current === "board"); return () => setBoardShown(false); }, [active, current]);
  // Tabs mount when first opened and then stay mounted (hidden), so switching back is instant and never refetches.
  // The BOARD is mounted from the start (even while another tab, or no workspace, is showing): its live link is what
  // introduces this person to the tutor and receives the board, the permissions and the "presenting" signal — it can't wait for a tap.
  const [opened, setOpened] = useState<Set<WsTabKey>>(() => new Set([current, "board"]));
  useEffect(() => { setOpened((o) => (o.has(current) ? o : new Set([...o, current]))); }, [current]);

  // Number keys jump between tabs (only while the pane is showing and nobody is typing).
  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= tabs.length) onTab(tabs[n - 1]!.key);
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [active, tabs, onTab]);

  const onTabKey = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.key === current);
    const move = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!move && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const n = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (i + move + tabs.length) % tabs.length;
    onTab(tabs[n]!.key);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-tab="${tabs[n]!.key}"]`)?.focus());
  };

  const badge: Partial<Record<WsTabKey, number>> = {
    homework: isTutor ? (data.inbox ?? []).filter((r) => r.status === "submitted" && attendees.some((a) => a.childId === r.childId)).length : 0,
  };
  const drawerIdx = attendees.findIndex((a) => a.childId === drawer);
  const drawerName = drawerIdx >= 0 ? (view.hideNames ? maskName(drawerIdx) : attendees[drawerIdx]!.name) : "Student";

  return (
    <WsViewCtx.Provider value={view}>
      <OverlayHostCtx.Provider value={host}>
        <LessonShareProvider p={p} isTutor={isTutor}>
        <TeachingWatcher />
        <div className="relative flex h-full min-h-0 flex-col" style={{ background: "var(--hub-warm)" }} data-testid="hub-workspace" data-present={view.present ? "1" : "0"}>
          <div ref={listRef} role="tablist" aria-label="Lesson workspace" onKeyDown={onTabKey} className="@container flex flex-none items-stretch gap-1 overflow-x-auto border-b border-[var(--hub-warm-line)] px-2 py-1.5" style={{ background: "var(--hub-warm-2)" }}>
            {tabs.map((t, i) => {
              const on = t.key === current;
              return (
                <button key={t.key} type="button" role="tab" id={`ws-tab-${t.key}`} data-tab={t.key} aria-label={t.label} aria-selected={on} aria-controls={`ws-panel-${t.key}`} tabIndex={on ? 0 : -1} onClick={() => onTab(t.key)}
                  title={`${t.label} (${i + 1})`}
                  className={`inline-flex min-h-[44px] flex-none items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-extrabold transition-colors motion-reduce:transition-none ${FOCUS} ${on ? "bg-[var(--surface)] text-[var(--brand)] shadow-[var(--shadow-sm)]" : "text-[var(--ink-2)] hover:bg-[var(--surface)]/60"}`}>
                  <Ico name={t.icon} size={15} /><span className={on ? "" : "hidden @[560px]:inline"}>{t.label}</span>
                  {t.key === "board" && !isTutor && boardLive > 0 && current !== "board" && <span className="h-2 w-2 rounded-full bg-[var(--red)]" aria-label="Your tutor is using the board" />}
                  {!!badge[t.key] && <span className="rounded-full bg-[var(--brand)] px-1.5 py-px text-[11px] font-extrabold text-white" aria-label={`${badge[t.key]} to mark`}>{badge[t.key]}</span>}
                </button>
              );
            })}
          </div>

          {view.present && (
            <div className="flex flex-none items-center gap-2 border-b border-[var(--brand-line)] bg-[var(--brand-soft)] px-3 py-1.5 text-[12px] font-bold text-[var(--brand-strong)]" role="status">
              <Ico name="monitor" size={14} />Presenting — tutor-only controls are hidden{view.hideNames ? "; names are hidden" : ""}. Press P to stop.
            </div>
          )}

          <div className={`min-h-0 flex-1 ${view.big ? "text-[16px]" : ""}`}>
            {tabs.map((t) => opened.has(t.key) && (
              <div key={t.key} id={`ws-panel-${t.key}`} role="tabpanel" aria-labelledby={`ws-tab-${t.key}`} tabIndex={-1} hidden={t.key !== current} className={`h-full min-w-0 ${t.key === "board" ? "overflow-hidden" : "overflow-y-auto overscroll-contain p-3 [&_.grid>*]:min-w-0"}`}>
                <TabBoundary label={t.key}>
                {t.key === "students" && isTutor && <StudentsTab p={p} lesson={lesson} attendees={attendees} data={data} groupNames={groupNames} now={now} onOpen={setDrawer} />}
                {t.key === "notes" && <div className="grid gap-3"><TeachableLessons p={p} lesson={lesson} /><NotesTab p={p} lesson={lesson} isTutor={isTutor} /></div>}
                {t.key === "progress" && isTutor && <ProgressTab p={p} lesson={lesson} attendees={attendees} data={data} />}
                {t.key === "homework" && (isTutor ? <HomeworkTab p={p} lesson={lesson} attendees={attendees} data={data} /> : <FamilyHomework p={p} lesson={lesson} />)}
                {t.key === "quiz" && isTutor && <QuizTab p={p} lesson={lesson} attendees={attendees} data={data} />}
                {t.key === "cards" && <CardsTab p={p} lesson={lesson} isTutor={isTutor} />}
                </TabBoundary>
                {t.key === "board" && <LessonBoard lessonId={lesson.id} qs={p.childQs ?? p.qs} isTutor={isTutor} childId={p.childId} attendees={isTutor ? attendees : undefined} hideNames={view.hideNames} subject={p.topics.find((x) => x.id === lesson.topicId)?.subject ?? null} years={attendees.map((a) => a.yearGroup)} lessonTitle={lesson.title} noteIds={lesson.noteIds} topicId={lesson.topicId} fallbackTopicId={p.topics[0]?.id ?? null} active={active && t.key === current} onError={p.onError} />}
              </div>
            ))}
          </div>

          <div ref={setHost} className="pointer-events-none absolute inset-0 z-20 [&>*]:pointer-events-auto" />
          {drawer && isTutor && !view.present && (
            <PaneOverlay>
              <div role="dialog" aria-label={`${drawerName}: progress`} data-testid="ws-drawer" className="absolute inset-0 z-10 flex flex-col" style={{ background: "var(--hub-warm)" }}>
                <div className="flex flex-none items-center gap-2 border-b border-[var(--hub-warm-line)] px-3 py-2">
                  <Avatar name={drawerName} size={30} />
                  <h3 className="m-0 min-w-0 flex-1 truncate text-[16px] font-extrabold text-[var(--ink)]" style={DISPLAY}>{drawerName}</h3>
                  <WsButton variant="ghost" icon="close" onClick={() => setDrawer(null)} ariaLabel="Close student details">Close</WsButton>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3"><ProgressView p={p} childId={drawer} /></div>
              </div>
            </PaneOverlay>
          )}
        </div>
        </LessonShareProvider>
      </OverlayHostCtx.Provider>
    </WsViewCtx.Provider>
  );
}
