import type { Topic } from "../../types";
import type { Lesson } from "../lessonTypes";
import type { Attendee } from "./wsKit";
import type { Student } from "../../types";

/** The subject this lesson is about (from its topic), or null when it isn't tied to one. */
export function lessonSubject(topics: Topic[], lesson: Pick<Lesson, "topicId">): string | null {
  return topics.find((t) => t.id === lesson.topicId)?.subject ?? null;
}

/** Topic ids whose notes belong with this lesson: its topic, that topic's SUBTOPICS, and (when the lesson is on a
 *  subtopic) its parent topic. null = the lesson isn't tied to a topic → everything. */
export function lessonCovered(topics: Topic[], lesson: Pick<Lesson, "topicId">): Set<string> | null {
  const t = topics.find((x) => x.id === lesson.topicId);
  if (!t) return null;
  return new Set([t.id, ...topics.filter((x) => x.parentTopicId === t.id).map((x) => x.id), ...(t.parentTopicId ? [t.parentTopicId] : [])]);
}

/** The lesson's attendees: the lesson's own student list (a family only ever gets its own), with year group from the roster. */
export function attendeesOf(lesson: Lesson, roster: Student[]): Attendee[] {
  const byId = new Map(roster.map((s) => [s.childId, s]));
  const names = new Map((lesson.students ?? []).map((s) => [s.childId, s.childName]));
  return (lesson.childIds ?? []).map((id) => ({
    childId: id,
    name: names.get(id) ?? byId.get(id)?.childName ?? "Student",
    yearGroup: byId.get(id)?.yearGroup ?? null,
    joinedAt: lesson.attendance?.[id] ?? null,
  }));
}
