import type { CourseDoc, Lesson } from "./courseContent";
import { GENERATED_ENHANCEMENTS } from "./courseEnhancements.generated";

/*
 * Course enhancements from the iHASCO benchmark: each entry is an extra
 * "Going further" lesson that folds the missing best-practice content into a
 * course. Non-destructive — appended at view time, generated file untouched.
 */
export function withEnhancements(course: CourseDoc): CourseDoc {
  const e = GENERATED_ENHANCEMENTS[course.id];
  if (!e || !e.blocks.length) return course;
  const lesson: Lesson = { id: "v-enh", title: e.title || "Going further", mins: Math.max(3, Math.round(e.blocks.length * 0.6)), blocks: e.blocks };
  return { ...course, lessons: [...course.lessons, lesson] };
}
