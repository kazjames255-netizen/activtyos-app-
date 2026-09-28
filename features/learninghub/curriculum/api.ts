import { del, get, put } from "@/lib/api";
import type { MapArea, MapRow } from "./cells";

// Curriculum map API — server/src/routes/hub/curriculumApi.ts. `qs` is the hub's usual "?tenantId=…" (a parent's already carries &childId=…).
export interface FrameworkInfo { id: string; label: string; version: string; note: string }
export interface CurriculumMap {
  mode: "tutor" | "child";
  framework: FrameworkInfo;
  frameworks: { id: string; label: string }[];
  areas: MapArea[];
  rows: MapRow[];
  summary: { checked: number; covered: number; thin: number; gaps: number };
  /** Lessons this map was drawn from, how many of them the map couldn't place, and how many placements are auto-mapped at each confidence. */
  lessons: number; unplaced: number; autoMapped: { high: number; medium: number; low: number };
}
export interface CellLesson {
  id: string; title: string; excerpt: string; isLesson: boolean; kind: "board" | null; createdByName: string; updatedAt: string;
  year: number; confidence: number; corrected: boolean;
  /** The exit quiz has been handed in — the pre-existing signal (mastery/attempts-based). */
  done: boolean;
  /** The child has actually gone through this lesson — set the moment `done` is (a finished quiz proves it too),
   *  but ALSO true on its own from just opening/reading the lesson (LessonPlayer's own "viewed" write), with no
   *  quiz needed. See server/src/routes/hub/lessonApi.ts POST /notes/:id/viewed. */
  viewed: boolean;
  canCorrect: boolean;
}

const join = (qs: string, extra: string) => `${qs}${qs.includes("?") ? "&" : "?"}${extra}`;
export const getMap = (qs: string, framework: string) => get<CurriculumMap>(`/api/learning-hub/curriculum${join(qs, `framework=${encodeURIComponent(framework)}`)}`);
export const getCellLessons = (qs: string, framework: string, areaId: string, year: number | null) =>
  get<{ area: { id: string; area: string; strand: string }; total: number; lessons: CellLesson[] }>(`/api/learning-hub/curriculum/lessons${join(qs, `framework=${encodeURIComponent(framework)}&area=${encodeURIComponent(areaId)}&year=${year ?? "all"}`)}`);
/** Which areas hold a lesson whose title/body matches this text (independent of the area's own name).
 *  `unplaced` are matching lessons that exist but aren't on the map yet, and `placed` carries each match's
 *  year — both exist because a match can be invisible on the CURRENT view (unplaced entirely, or placed
 *  under a year other than the one currently selected) and `areaIds` alone can't tell those apart. */
export const searchAreasByLesson = (qs: string, framework: string, q: string) =>
  get<{ areaIds: string[]; placed: { areaId: string; year: number; title: string }[]; unplaced: { id: string; title: string }[] }>(`/api/learning-hub/curriculum/search${join(qs, `framework=${encodeURIComponent(framework)}&q=${encodeURIComponent(q)}`)}`);
export const setTag = (qs: string, noteId: string, body: { framework: string; areaId: string; year?: number | null }) => put<{ ok: true }>(`/api/learning-hub/curriculum/tags/${noteId}${qs}`, body);
export const clearTag = (qs: string, noteId: string, framework: string) => del<{ ok: true }>(`/api/learning-hub/curriculum/tags/${noteId}${join(qs, `framework=${encodeURIComponent(framework)}`)}`);

/** Tutor only: one student's overlay for one year — per area, library / given / finished counts and a lesson to open, review or set next. */
export interface StudentArea { areaId: string; library: number; assigned: number; done: number; open: { id: string; title: string } | null; review: { id: string; title: string } | null; next: { id: string; title: string } | null }
export const getStudentYear = (qs: string, framework: string, childId: string, year: number) =>
  get<{ childId: string; year: number; childName: string; areas: StudentArea[] }>(`/api/learning-hub/curriculum/student${join(qs, `framework=${encodeURIComponent(framework)}&childId=${encodeURIComponent(childId)}&year=${year}`)}`);
