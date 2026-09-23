import type { HubVideo } from "../types";
import { KID_COPY } from "../family/kidCopy";

// Homework — shapes mirror server/src/routes/hub/homeworkApi.ts (contract:
// docs/learning-hub.md → Homework). Marking is the tutor's; the server only
// stores what's sent.

export interface HubFile { id: string; name: string; contentType: string; size: number; /** Short-lived signed link. */ url: string }
export interface Mark { score: number; max: number; feedback: string; markedAt: string; markedByName: string }
export type SubStatus = "assigned" | "submitted" | "marked";

export interface TutorHomework {
  id: string; title: string; instructions: string; assessmentId: string | null; noteIds: string[]; flashcardTopicId: string | null;
  dueAt: string; assignedChildIds: string[]; createdAt: string; updatedAt: string;
  /** YouTube videos (≤6) and the groups it was set for (display only). */
  videos?: HubVideo[]; groupIds?: string[];
  counts: { assigned: number; submitted: number; marked: number };
}

/** One row of the tutor's inbox — includes the hand-in itself, so marking needs no second call. */
export interface InboxRow {
  submissionId: string; homeworkId: string; title: string; childId: string; childName: string;
  status: SubStatus; submittedAt: string | null; dueAt: string; attemptPending: boolean;
  text: string; attachments: HubFile[]; attemptId: string | null; mark: Mark | null; late: boolean;
}

export interface StudentHomework {
  id: string; childId: string; childName: string; title: string; instructions: string; dueAt: string;
  assessmentId: string | null; flashcardTopicId: string | null; notes: { id: string; title: string; /** An interactive lesson: opens in the lesson player. */ interactive?: boolean }[]; videos?: HubVideo[];
  submission: { id: string; status: SubStatus; text: string; attachments: HubFile[]; attemptId: string | null; submittedAt: string | null; mark: Mark | null; late: boolean };
}

export interface QuizLite { id: string; title: string; subject: string; type: "quiz" | "diagnostic"; questionCount: number; totalMarks: number; published?: boolean }
export interface AttemptLite { id: string; assessmentId: string; homeworkId: string | null; status: "in_progress" | "pending_marking" | "marked"; scoreMarks: number; maxMarks: number; pct: number | null; passed: boolean | null; submittedAt: string | null; startedAt: string; assessmentTitle: string }

/** Where a homework stands against its due date, for chips. */
export type DueTone = "red" | "gold" | "neutral" | "green" | "brand";
export function dueState(dueAt: string, status: SubStatus, now: number, kid = false): { label: string; tone: DueTone; overdue: boolean; soon: boolean } {
  if (status === "marked") return { label: "Marked", tone: "green", overdue: false, soon: false };
  if (status === "submitted") return { label: "Handed in", tone: "brand", overdue: false, soon: false };
  const diff = new Date(dueAt).getTime() - now;
  const day = 86_400_000;
  if (diff < 0) {
    const d = Math.ceil(-diff / day);
    // A child never sees "Overdue": it is homework that is "Waiting for you" (P-13). `overdue` stays true for logic and the tutor/parent wording.
    if (kid) return { label: diff > -day ? KID_COPY.waiting : KID_COPY.waitingSince(new Date(dueAt).toLocaleDateString("en-GB", { weekday: "long" })), tone: "gold", overdue: true, soon: false };
    return { label: diff > -day ? "Overdue" : `Overdue by ${d} day${d === 1 ? "" : "s"}`, tone: "red", overdue: true, soon: false };
  }
  if (diff <= 2 * day) {
    const h = Math.round(diff / 3_600_000);
    return { label: h < 1 ? "Due within the hour" : h < 24 ? `Due in ${h} h` : "Due tomorrow", tone: "gold", overdue: false, soon: true };
  }
  return { label: `Due ${new Date(dueAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`, tone: "neutral", overdue: false, soon: false };
}

export const pctOf = (m: { score: number; max: number }) => (m.max > 0 ? Math.round((m.score / m.max) * 100) : 0);
