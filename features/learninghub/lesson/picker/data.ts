import { get } from "@/lib/api";
import { withQs } from "../../teachKit";
import type { NoteLite, Topic } from "../../types";
import { getMap, getCellLessons, type CurriculumMap } from "../../curriculum/api";
import { strandColor, type MapArea } from "../../curriculum/cells";
import { subjectColor } from "../../kit";
import type { PickItem } from "./types";

// Cached reads for the shared picker: the curriculum map and the topic list are fetched once per hub query string
// (and shared by every picker on screen), so the second open paints straight away. Lesson pages are server-paged.

const TTL = 120_000;
const cache = new Map<string, { at: number; p: Promise<unknown> }>();
function memo<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.p as Promise<T>;
  const p = load();
  cache.set(key, { at: Date.now(), p });
  p.catch(() => cache.delete(key));
  return p;
}
export const FRAMEWORK = "nc2014";
export const loadMap = (qs: string): Promise<CurriculumMap> => memo(`map|${qs}`, () => getMap(qs, FRAMEWORK));
export const loadTopics = (qs: string): Promise<Topic[]> => memo(`topics|${qs}`, () => get<Topic[]>(`/api/learning-hub/topics${withQs(qs, {})}`).then((r) => (Array.isArray(r) ? r : [])));

export const PAGE = 24;
export const CAP = 240;
export interface NotesQuery { q: string; year: number | null; subject: string; lessons: boolean; worksheet: boolean; published: boolean }
type Raw = NoteLite & { hasWorksheet?: boolean; worksheetQuizId?: string | null };
export function toItem(n: Raw, topics: Map<string, Topic>): PickItem {
  const tp = topics.get(n.topicId);
  return { id: n.id, title: n.title, excerpt: n.excerpt, year: n.lessonYear ?? yearOfTopic(tp), subject: tp?.subject, color: tp?.subject ? subjectColor(tp.subject) : undefined, isLesson: n.isLesson, hasWorksheet: !!n.hasWorksheet || !!n.worksheetQuizId, worksheetQuizId: n.worksheetQuizId ?? null, topicId: n.topicId };
}
const yearOfTopic = (t?: Topic): number | null => { const m = /^year\s*(\d{1,2})$/i.exec((t?.subtopic ?? "").trim()); return m ? Number(m[1]) : null; };

/** A page of the tutor's library (server paged + searched; `sort=topic` = subject, then unit, then title). */
export async function fetchPage(qs: string, x: NotesQuery, cursor: string | null, topics: Map<string, Topic>): Promise<{ items: PickItem[]; total: number; next: string | null }> {
  const r = await get<{ items: Raw[]; total: number; nextCursor: string | null }>(`/api/learning-hub/notes${withQs(qs, {
    limit: String(PAGE), cursor: cursor ?? undefined, sort: "topic", q: x.q || undefined, year: x.year ? String(x.year) : undefined, subject: x.subject || undefined,
    lessons: x.lessons ? "1" : undefined, worksheet: x.worksheet ? "1" : undefined, published: x.published ? "1" : undefined })}`);
  return { items: (r.items ?? []).map((n) => toItem(n, topics)), total: r.total ?? 0, next: r.nextCursor ?? null };
}
export async function fetchYears(qs: string, yearsKey: string, topics: Map<string, Topic>): Promise<PickItem[]> {
  const r = await get<{ items: Raw[] }>(`/api/learning-hub/notes${withQs(qs, { limit: "8", sort: "topic", year: yearsKey, lessons: "1", published: "1" })}`);
  return (r.items ?? []).map((n) => toItem(n, topics));
}
export async function fetchByIds(qs: string, ids: string[], topics: Map<string, Topic>): Promise<PickItem[]> {
  if (!ids.length) return [];
  const r = await get<{ items: Raw[] } | Raw[]>(`/api/learning-hub/notes${withQs(qs, { ids: ids.join(","), limit: "40" })}`);
  const rows = Array.isArray(r) ? r : r.items ?? [];
  const by = new Map(rows.map((n) => [n.id, n]));
  return ids.map((id) => by.get(id)).filter((n): n is Raw => !!n).map((n) => toItem(n, topics));
}
export async function fetchCell(qs: string, area: MapArea, year: number | null): Promise<{ items: PickItem[]; total: number }> {
  const r = await getCellLessons(qs, FRAMEWORK, area.id, year);
  const color = strandColor(area);
  return { total: r.total, items: r.lessons.map((l) => ({ id: l.id, title: l.title, excerpt: l.excerpt, year: l.year, subject: area.strand, color, isLesson: l.isLesson })) };
}

// "Recently used" is per browser and per kind; it only ever holds ids + titles.
const RK = "hub.picker.recent.v1";
export const RECENT_MAX = 5; // shelf stays tidy: only the 5 most recent picks
export type Recent = { id: string; title: string; year?: number | null };
export const readRecent = (kind: string): Recent[] => { try { const o = JSON.parse(localStorage.getItem(RK) || "{}"); return Array.isArray(o[kind]) ? o[kind] : []; } catch { return []; } };
export const pushRecent = (kind: string, it: Recent) => {
  try { const o = JSON.parse(localStorage.getItem(RK) || "{}"); o[kind] = [it, ...(Array.isArray(o[kind]) ? o[kind] : []).filter((x: Recent) => x.id !== it.id)].slice(0, RECENT_MAX); localStorage.setItem(RK, JSON.stringify(o)); } catch { /* a nicety */ }
};
