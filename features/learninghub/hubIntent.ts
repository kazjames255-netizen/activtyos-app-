import { useCallback, useEffect, useSyncExternalStore } from "react";

// A one-shot hand-off between hub tabs: the Students tab's group quick actions ("Set homework",
// "Set a quiz", "Schedule video lesson") switch tab and the destination panel opens its form with the
// group preselected. Module state (not the URL) because it's intent, not navigation — and it is
// consumed exactly once.

export type HubIntent = {
  kind: "homework" | "quiz" | "lesson" | "newQuiz" | "enrol" | "marking"; groupId: string;
  /** A lesson's "Set as homework": prefill the form with this quiz, these attached lessons/notes and a title (no group). */
  assessmentId?: string; noteIds?: string[]; title?: string; instructions?: string;
  /** A student card's "Set homework": open the form with exactly these students ticked. */
  childIds?: string[];
  /** Prefill the form from this lesson's ready-made homework (GET /notes/:id/homework-pack); the fields above are the instant fallback. */
  packNoteId?: string;
};
let pending: HubIntent | null = null;

export const setHubIntent = (i: HubIntent) => { pending = i; };
/** Take (and clear) the pending intent if it is one of `kinds`. */
export function takeHubIntent(kinds: HubIntent["kind"][]): HubIntent | null {
  if (pending && kinds.includes(pending.kind)) { const p = pending; pending = null; return p; }
  return null;
}

// ── "View" intent: a group card's status tile jumps to a tab FILTERED to one group ───────────────────────
// Unlike the one-shot create intents above, a view filter is state the destination panel keeps showing (as a
// dismissible chip) until it is cleared. It lives here (module store + useSyncExternalStore) so the Students
// tab can set it right before switching tab, and the panel reads it on mount without the shell in between.
// It is scoped to one visit: once the panel that reads it has unmounted, it is dropped.

export type ViewSection = "homework" | "quiz" | "lesson";
const views: Partial<Record<ViewSection, string>> = {};
const mounts: Record<ViewSection, number> = { homework: 0, quiz: 0, lesson: 0 };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

/** Ask the next mount of `section`'s panel to show only what's relevant to `groupId` (null clears). */
export function setHubView(section: ViewSection, groupId: string | null) {
  if ((views[section] ?? null) === groupId) return;
  if (groupId) views[section] = groupId; else delete views[section];
  emit();
}

/** [groupId filtering this section | null, clear()]. The filter dies with the panel that shows it (a
 *  microtask-late check keeps React StrictMode's mount/unmount/mount from clearing it). */
export function useHubView(section: ViewSection): [string | null, () => void] {
  const id = useSyncExternalStore(subscribe, () => views[section] ?? null, () => null);
  useEffect(() => {
    mounts[section]++;
    return () => { mounts[section]--; setTimeout(() => { if (mounts[section] === 0) setHubView(section, null); }, 0); };
  }, [section]);
  const clear = useCallback(() => setHubView(section, null), [section]);
  return [id, clear];
}

// ── "Open this lesson" intent: homework's "Start the lesson" → the Lessons tab opens that lesson in the player ──────
// The Lessons panel stays mounted (hidden) on other tabs, so this is a request it listens for (and also picks up on mount).

let openLessonId: string | null = null;
let openLessonFrom: "homework" | "live" | null = null;
const lessonSubs = new Set<() => void>();

/** Ask the Lessons panel to open lesson `noteId` (the caller switches to the Lessons tab). `from: "live"` — the
 *  tutor's own "you're broadcasting — Rejoin" banner — skips straight past the one-room/share-with-children mode
 *  picker into the Share-with-children roster (which already offers "Resume broadcasting" plus the same student
 *  picker to add/remove who's in it), instead of making them re-pick a mode they already chose. */
export function requestOpenLesson(noteId: string, from: "homework" | "live" | null = null) { openLessonId = noteId; openLessonFrom = from; lessonSubs.forEach((f) => f()); }

/** Lessons panel: `handler(noteId, from)` runs once per request (also for one made before this mounted); `from` = the tab to return to on exit ("homework"), or "live" to jump straight into a rejoin. */
export function useOpenLessonRequest(handler: (noteId: string, from: "homework" | "live" | null) => void) {
  useEffect(() => {
    const run = () => { if (openLessonId) { const id = openLessonId, from = openLessonFrom; openLessonId = null; openLessonFrom = null; handler(id, from); } };
    lessonSubs.add(run); run();
    return () => { lessonSubs.delete(run); };
  }, [handler]);
}

// ── "Message this student" intent: the Students roster's "Message" action → the Questions tab opens a fresh
// composer pre-filled with that child. Mirrors the "open this lesson" intent above.

let newMsgChildId: string | null = null;
const newMsgSubs = new Set<() => void>();

/** Ask the Questions panel to start a new message to `childId` (the caller switches to the Questions tab). */
export function requestNewMessage(childId: string) { newMsgChildId = childId; newMsgSubs.forEach((f) => f()); }

/** Questions panel: `handler(childId)` runs once per request (also for one made before this mounted). */
export function useNewMessageRequest(handler: (childId: string) => void) {
  useEffect(() => {
    const run = () => { if (newMsgChildId) { const id = newMsgChildId; newMsgChildId = null; handler(id); } };
    newMsgSubs.add(run); run();
    return () => { newMsgSubs.delete(run); };
  }, [handler]);
}

/** "Set for children": hand a lesson (its exit quiz, if it has one) to the Homework form, ready to pick students / a group and a due date.
 *  Works for a plain (non-interactive) lesson too — it is then just attached for reading. */
export function lessonHomeworkDraft(n: { id: string; title: string; lesson?: unknown }): { assessmentId?: string; noteIds: string[]; title: string; instructions: string } {
  const q = (n.lesson as { quizId?: unknown } | null | undefined)?.quizId;
  const quizId = typeof q === "string" && q ? q : undefined;
  const interactive = !!n.lesson && typeof n.lesson === "object";
  return {
    assessmentId: quizId, noteIds: [n.id], title: n.title,
    instructions: interactive
      ? `Open the lesson \u201c${n.title}\u201d in the Lessons tab and work through it${quizId ? ", then finish its quiz" : ""}. Hand this in when you're done.`
      : `Read the lesson \u201c${n.title}\u201d in the Lessons tab, then hand this in when you're done.`,
  };
}
export function lessonHomeworkIntent(n: { id: string; title: string; lesson?: unknown }) {
  setHubIntent({ kind: "homework", groupId: "", ...lessonHomeworkDraft(n), packNoteId: n.id });
}


// ── "Open this student's progress" intent: a student card → Progress tab with that child's detail open ─────────────────
let openStudent: { id: string; name: string } | null = null;
export const requestOpenStudent = (id: string, name: string) => { openStudent = { id, name }; };
/** Progress panel, once on mount: the student a card asked for (and clear it). */
export function takeOpenStudent(): { id: string; name: string } | null { const s = openStudent; openStudent = null; return s; }

// ── "Show me the overdue list" intent: Home's Overdue tile → Homework opens on the "Not handed in" filter (not To mark) ──
let hwFilter: "assigned" | null = null;
export const requestHomeworkFilter = (f: "assigned") => { hwFilter = f; };
/** Homework panel, once on mount: the inbox filter Home asked for (and clear it). */
export function takeHomeworkFilter(): "assigned" | null { const f = hwFilter; hwFilter = null; return f; }
