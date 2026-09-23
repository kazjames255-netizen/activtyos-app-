// Learning Hub — shared client types + taxonomy helpers. The shapes mirror
// server/src/routes/learningHub.ts (the API contract is server/openapi.yaml).

export interface Topic {
  id: string;
  subject: string;
  topic: string;
  /** null for a top-level topic; the subtopic's own name otherwise. */
  subtopic: string | null;
  /** The topic a subtopic hangs off; null for a top-level topic. */
  parentTopicId: string | null;
  /** Whose it is: null = head office / the provider's own; a franchise's page can only change rows carrying ITS id. */
  franchiseId?: string | null;
}

/** May this caller change a row carrying `rowFranchiseId`? (Mirrors the server's canWriteRow: tenant-level callers change everything; a
 *  franchise only its own — head office's content is theirs to read and use, not edit.) */
export const canChangeRow = (callerFranchiseId: string | null | undefined, rowFranchiseId: string | null | undefined) => !callerFranchiseId || (rowFranchiseId ?? null) === callerFranchiseId;

/** A YouTube video as the server returns it (contract §8). Only ever render `id`/`embedUrl`/`url` from a
 *  response — never build a URL from raw user text. */
export interface HubVideo { id: string; title: string; start: number | null; url: string; embedUrl: string }
/** What a tutor sends: the pasted link (the server parses it to an id and refuses anything else). */
export interface VideoInput { url: string; title?: string; start?: number }

export interface Attachment { id: string; name: string; contentType: string; size: number; url: string }

export interface Note {
  id: string;
  topicId: string;
  title: string;
  body: string;
  /** Drafts (false) are visible to tutors only. */
  published: boolean;
  attachments: Attachment[];
  /** YouTube videos (≤6). Absent on older servers. */
  videos?: HubVideo[];
  /** Whose it is: null = head office / the provider's own. A franchise's page can only change rows carrying ITS id (canChangeRow). */
  franchiseId?: string | null;
  /** Structured interactive lesson (lesson/types.ts LessonRaw). Absent = a plain markdown note. */
  lesson?: import("./lesson/types").LessonRaw | null;
  /** "board" = a whiteboard snapshot saved from a live lesson (pictures, not a written lesson): shown as a "Board snapshot". Absent = an ordinary lesson. */
  kind?: "board";
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

/** A note as the LIST returns it (GET /notes): no body — an excerpt for the card, the read time, whether there is a
 *  body to open. Open a note with GET /notes/:id (a full `Note`). */
export interface NoteLite extends Omit<Note, "body"> {
  excerpt: string;
  hasBody: boolean;
  readMinutes: number;
  /** True when the note is an interactive lesson (has the structured `lesson` field). */
  isLesson?: boolean;
  lessonWidget?: string | null;
  /** School year (1–13) the lesson is for, when known. */
  lessonYear?: number | null;
}

/** GET /notes/counts — what the sidebar and hero show, without listing a single note. */
export interface NoteStats { total: number; drafts: number; files: number; fresh: number; byTopic: Record<string, number>; /** Real lessons only (P-02); absent on an older server. */ lessons?: number; /** Topics that hold at least one real lesson. */ lessonTopicIds?: string[] }

export interface HubChild { childId: string; childName: string }
export interface HubProvider { tenantId: string; name: string; canEdit: boolean; /** Tutors: their franchise (null = tenant-level / head office) — head-office rows are read-only for a franchise. */ franchiseId?: string | null; /** Tutors: their portal role. */ role?: string; /** Tutors: their own login id (matches a student's / lesson's `tutorUid`). */ uid?: string; /** Parents: their enrolled children at this provider. */ children: HubChild[] }

/** A student = a child enrolled by a tutor (GET /students). Tutors get the full
 *  roster row; a parent gets only their own children (parentEmail etc. absent). */
export interface Student {
  childId: string;
  childName: string;
  subjects: string[];
  parentEmail?: string;
  franchiseId?: string | null;
  tutorUid?: string | null;
  tutorName?: string;
  active?: boolean;
  createdAt?: string;
  /** The student's school year ("Year 5") — tutor-tagged, defaulted from the child's date of birth. */
  yearGroup?: string | null;
  /** True when the year was filled in from the child's date of birth (kept current each September). */
  yearGroupAuto?: boolean;
}

/** An optional tutor-made group of students (contract §7) — for one-click homework / quizzes / lessons. */
export interface HubGroup {
  id: string;
  name: string;
  /** A palette id (see GROUP_COLOURS), never a hex. */
  colour: string;
  childIds: string[];
  members?: { childId: string; childName: string }[];
  count?: number;
}

/** Group colours are the server's palette ids (contract §7), mapped to theme tokens — never hex. */
export const GROUP_COLOURS: { id: string; label: string; v: string }[] = [
  { id: "blue", label: "Blue", v: "var(--brand-2)" },
  { id: "teal", label: "Teal", v: "var(--cat-6)" },
  { id: "green", label: "Green", v: "var(--green)" },
  { id: "amber", label: "Amber", v: "var(--gold)" },
  { id: "orange", label: "Orange", v: "var(--cat-10)" },
  { id: "red", label: "Red", v: "var(--red)" },
  { id: "pink", label: "Pink", v: "var(--cat-1)" },
  { id: "purple", label: "Purple", v: "var(--violet)" },
  { id: "slate", label: "Slate", v: "var(--ink-3)" },
];
export const groupColour = (id: string | undefined | null) => (GROUP_COLOURS.find((c) => c.id === id) ?? GROUP_COLOURS[0]!).v;

/** Members of a group as roster ids (tolerates either the id list or the named member list). */
export const groupMemberIds = (g: HubGroup): string[] => (g.childIds?.length ? g.childIds : (g.members ?? []).map((m) => m.childId));

/** What every panel filters by: one subject, optionally narrowed to one topic
 *  (a topic id also covers its subtopics). Both null = everything. */
export interface HubFilter { subject: string | null; topicId: string | null }

export interface SubjectNode { subject: string; topics: { topic: Topic; subs: Topic[] }[] }

/** Flat topic rows → subject → topic → subtopics, in name order. */
export function buildTree(topics: Topic[]): SubjectNode[] {
  const bySubject = new Map<string, SubjectNode>();
  const byName = (a: string, b: string) => a.localeCompare(b);
  for (const t of topics.filter((x) => !x.parentTopicId)) {
    if (!bySubject.has(t.subject)) bySubject.set(t.subject, { subject: t.subject, topics: [] });
    bySubject.get(t.subject)!.topics.push({ topic: t, subs: topics.filter((s) => s.parentTopicId === t.id).sort((a, b) => byName(a.subtopic ?? "", b.subtopic ?? "")) });
  }
  const nodes = [...bySubject.values()].sort((a, b) => byName(a.subject, b.subject));
  for (const n of nodes) n.topics.sort((a, b) => byName(a.topic.topic, b.topic.topic));
  return nodes;
}

/** "Maths › Algebra › Quadratics". */
export const topicLabel = (t: Topic) => [t.subject, t.topic, t.subtopic].filter(Boolean).join(" › ");

/** The topic ids a filter covers — what every panel narrows its data to. */
export function coveredTopicIds(topics: Topic[], f: HubFilter): Set<string> {
  if (f.topicId) return new Set([f.topicId, ...topics.filter((t) => t.parentTopicId === f.topicId).map((t) => t.id)]);
  if (f.subject) return new Set(topics.filter((t) => t.subject === f.subject).map((t) => t.id));
  return new Set(topics.map((t) => t.id));
}

export const fmtSize = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);
export const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

// ── shell helpers (F1) ─────────────────────────────────────────────────────

/** Note counts per topic id, counting a topic's subtopics into it and each
 *  subject as a whole: { byTopic, bySubject, total }. */
export function noteCounts(topics: Topic[], notes: Note[]) {
  const own = new Map<string, number>();
  for (const n of notes) own.set(n.topicId, (own.get(n.topicId) ?? 0) + 1);
  const byTopic = new Map<string, number>();
  const bySubject = new Map<string, number>();
  for (const t of topics) {
    const c = own.get(t.id) ?? 0;
    byTopic.set(t.id, (byTopic.get(t.id) ?? 0) + c);
    if (t.parentTopicId) byTopic.set(t.parentTopicId, (byTopic.get(t.parentTopicId) ?? 0) + c);
    bySubject.set(t.subject, (bySubject.get(t.subject) ?? 0) + c);
  }
  return { byTopic, bySubject, total: notes.length };
}

/** The same shape as `noteCounts`, from the server's per-topic own counts: a topic's subtopics roll up into it and each
 *  subject is the sum of its topics. */
export function countsFromStats(topics: Topic[], stats: NoteStats | null) {
  const own = stats?.byTopic ?? {};
  const byTopic = new Map<string, number>();
  const bySubject = new Map<string, number>();
  for (const t of topics) {
    const c = own[t.id] ?? 0;
    byTopic.set(t.id, (byTopic.get(t.id) ?? 0) + c);
    if (t.parentTopicId) byTopic.set(t.parentTopicId, (byTopic.get(t.parentTopicId) ?? 0) + c);
    bySubject.set(t.subject, (bySubject.get(t.subject) ?? 0) + c);
  }
  return { byTopic, bySubject, total: stats?.total ?? 0 };
}

/** Markdown → plain one-line text for card snippets. */
export function plainText(md: string): string {
  return md
    .replace(/^\s*\|?[\s:|-]{3,}\|?\s*$/gm, " ")
    .replace(/^[#>\-*+\d.)\s|]+/gm, "")
    .replace(/[*_`~|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** A one-line preview of a markdown note: headings, fences, rules, table
 *  scaffolding and inline markup are dropped; the first real line leads (a short
 *  one borrows the next so the card never says just "Intro"). Falls back to the
 *  first heading for a note that is only headings. */
export function mdExcerpt(md: string, max = 170): string {
  const clean = (l: string) => l
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+|>\s*)+/, "")
    .replace(/[*_`~]/g, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const lines: string[] = [];
  let heading = "";
  let fenced = false;
  for (const raw of (md ?? "").split(/\r?\n/)) { // a list row may come without its body (summary rows)
    const l = raw.trim();
    if (l.startsWith("```")) { fenced = !fenced; continue; }
    if (fenced || !l) continue;
    if (/^#{1,6}\s/.test(l)) { if (!heading) heading = clean(l.replace(/^#+\s*/, "")); continue; }
    if (/^([-*_]\s*){3,}$/.test(l) || /^\|?[\s:|-]{3,}\|?$/.test(l)) continue;
    const c = clean(l);
    if (c) lines.push(c);
    if (lines.length >= 2) break;
  }
  let out = lines[0] ?? heading;
  if (lines[0] && lines[1] && lines[0].length < 70) out = `${lines[0]} ${lines[1]}`;
  return out.length > max ? `${out.slice(0, max - 1).trimEnd()}…` : out;
}

/** Whole minutes to read a note (≥1), at a relaxed 200 words a minute. */
export const readMins = (md: string) => Math.max(1, Math.round((md.trim().split(/\s+/).filter(Boolean).length) / 200));

export const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

/** Distinct subject names in a topic list, sorted. */
export const subjectsOf = (topics: Topic[]) => [...new Set(topics.map((t) => t.subject))].sort((a, b) => a.localeCompare(b));
