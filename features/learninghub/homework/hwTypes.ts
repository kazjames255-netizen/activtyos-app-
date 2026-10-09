import type { HubVideo } from "../types";
import { KID_COPY } from "../family/kidCopy";
import { hubT, hubLocale, tp } from "../family/hubT";
import { uiDate } from "@/lib/i18n/format";

// Homework — shapes mirror server/src/routes/hub/homeworkApi.ts (contract:
// docs/learning-hub.md → Homework). Marking is the tutor's; the server only
// stores what's sent.

export interface HubFile { id: string; name: string; contentType: string; size: number; /** Short-lived signed link. */ url: string }
export interface Mark { score: number; max: number; feedback: string; markedAt: string; markedByName: string; /** "auto" = the worksheet's automatic mark (a tutor can override it). */ markedBy?: string }
export type SubStatus = "assigned" | "submitted" | "marked";

/** A lesson worksheet attached to a homework (server: homeworkApi worksheetsOut). `quizId` = its auto-marked interactive version, when converted. */
export interface WorksheetRef { noteId: string; title: string; size?: number; quizId?: string }

export interface TutorHomework {
  id: string; title: string; instructions: string; assessmentId: string | null; noteIds: string[]; worksheetNoteIds?: string[]; worksheets?: WorksheetRef[]; flashcardTopicId: string | null;
  dueAt: string; assignedChildIds: string[]; createdAt: string; updatedAt: string;
  /** YouTube videos (≤6) and the groups it was set for (display only). */
  videos?: HubVideo[]; groupIds?: string[];
  counts: { assigned: number; submitted: number; marked: number };
  /** The subject it belongs to (its quiz's, else its lessons'), for the markbook's subject filter. */
  subject?: string | null;
}

/** One row of the tutor's inbox — includes the hand-in itself, so marking needs no second call. */
export interface InboxRow {
  submissionId: string; homeworkId: string; title: string; childId: string; childName: string;
  status: SubStatus; submittedAt: string | null; dueAt: string; attemptPending: boolean;
  text: string; attachments: HubFile[]; attemptId: string | null; attemptIds?: string[]; passMarkPct?: number | null; mark: Mark | null; late: boolean;
}

export interface StudentHomework {
  id: string; childId: string; childName: string; title: string; instructions: string; dueAt: string;
  assessmentId: string | null; worksheets?: WorksheetRef[]; flashcardTopicId: string | null; notes: { id: string; title: string; /** An interactive lesson: opens in the lesson player. */ interactive?: boolean }[]; videos?: HubVideo[];
  submission: { id: string; status: SubStatus; text: string; attachments: HubFile[]; attemptId: string | null; attemptIds?: string[]; submittedAt: string | null; mark: Mark | null; late: boolean };
}

export interface QuizLite { id: string; title: string; subject: string; type: "quiz" | "diagnostic"; questionCount: number; totalMarks: number; published?: boolean }
export interface AttemptLite { id: string; assessmentId: string; homeworkId: string | null; status: "in_progress" | "pending_marking" | "marked"; scoreMarks: number; maxMarks: number; pct: number | null; passed: boolean | null; submittedAt: string | null; startedAt: string; assessmentTitle: string }

/** Where a homework stands against its due date, for chips. */
export type DueTone = "red" | "gold" | "neutral" | "green" | "brand";
export function dueState(dueAt: string, status: SubStatus, now: number, kid = false): { label: string; tone: DueTone; overdue: boolean; soon: boolean } {
  const loc = hubLocale() === "en" ? "en-GB" : hubLocale();
  const dayOf = (o: Intl.DateTimeFormatOptions) => { try { return uiDate(new Date(dueAt), o, loc); } catch { return uiDate(new Date(dueAt), o); } };
  const x = { h: (k: string, v?: Record<string, string | number>) => hubT(`hubhomework.${k}`, v), hp: (k: string, n: number) => tp(hubT, hubLocale(), `hubhomework.${k}`, n), weekday: () => dayOf({ weekday: "long" }), day: () => dayOf({ weekday: "short", day: "numeric", month: "short" }) };
  if (status === "marked") return { label: x.h("stMarked"), tone: "green", overdue: false, soon: false };
  if (status === "submitted") return { label: x.h("stHandedIn"), tone: "brand", overdue: false, soon: false };
  const diff = new Date(dueAt).getTime() - now;
  const day = 86_400_000;
  if (diff < 0) {
    const d = Math.ceil(-diff / day);
    // A child never sees "Overdue": it is homework that is "Waiting for you" (P-13). `overdue` stays true for logic and the tutor/parent wording.
    if (kid) return { label: diff > -day ? KID_COPY.waiting : KID_COPY.waitingSince(x.weekday()), tone: "gold", overdue: true, soon: false };
    return { label: diff > -day ? x.h("overdue") : x.hp("overdueBy", d), tone: "red", overdue: true, soon: false };
  }
  if (diff <= 2 * day) {
    const hrs = Math.round(diff / 3_600_000);
    return { label: hrs < 1 ? x.h("dueHour") : hrs < 24 ? x.h("dueInH", { n: hrs }) : x.h("dueTomorrow"), tone: "gold", overdue: false, soon: true };
  }
  return { label: x.h("dueOn", { day: x.day() }), tone: "neutral", overdue: false, soon: false };
}

export const pctOf = (m: { score: number; max: number }) => (m.max > 0 ? Math.round((m.score / m.max) * 100) : 0);
