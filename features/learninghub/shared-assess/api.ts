// Quizzes / placement test / progress — the wire types for docs/learning-hub.md
// (milestones 3–5). Everything here mirrors the contract; nothing is marked or
// scored in the browser — the server does that and these types just carry it.
import type { HubSettings } from "@/lib/hubConfig";

export type KindRule = HubSettings["questionKinds"][number]["mark"];
export type QuestionKind = HubSettings["questionKinds"][number];
export type AssessType = "quiz" | "diagnostic";
export type AttemptStatus = "in_progress" | "pending_marking" | "marked";

/** A picture on a question or an option. Tutors save `{id}` (uploaded via /api/uploads);
 *  what a student is sent carries a SHORT-LIVED SIGNED `url` (never a bare id). */
export interface Pic { id?: string; url?: string; alt?: string }
export interface Option { id: string; text: string; image?: Pic | null }

/** match: one correct pair as a tutor authors it (both sides are text; a picture is an https link + alt text). */
export interface PairImage { url: string; alt: string }
export interface Pair { term: string; definition: string; termImage?: PairImage | null; definitionImage?: PairImage | null }
/** One tile a student handles in a match question (a term or a definition). */
export interface Piece { text: string; image?: { url: string; alt?: string } }
/** What a student submits (docs/oak-import.md): match pairs a term-text with a definition-text; order lists the items in the student's sequence. */
export interface MatchAnswer { kind: "match"; pairs: { term: string; definition: string }[] }
export interface OrderAnswer { kind: "order"; items: string[] }

/** Who an assessment is for. Empty year groups + null ages = everyone. */
export interface Audience { yearGroups: string[]; ageMin: number | null; ageMax: number | null }
export const NO_AUDIENCE: Audience = { yearGroups: [], ageMin: null, ageMax: null };
export type RetakePolicy = "unlimited" | "once" | "cooldown";
/** Per-assessment override; "inherit" follows the tenant's setting. */
export type RetakeOverride = "inherit" | RetakePolicy;
/** What the server says about sitting an assessment again (child overlay on GET /assessments). */
export interface RetakeInfo { allowed: boolean; reason: "once" | "cooldown" | "break" | string | null; nextAvailableAt: string | null }

/** Full question, as a tutor sees it (with the answer key). */
export interface Question {
  /** Year groups this question is for (labels); empty = not tagged. */
  yearGroups?: string[];
  id: string;
  topicId: string;
  kind: string;
  prompt: string;
  options: Option[];
  /** choice → option id · multi → option id[] · exact → string · numeric → number · manual → null. */
  answer: string | string[] | number | null;
  /** match → the correct pairs (3–8) · order → the items in the CORRECT order (2–8). Their `answer` is null. */
  pairs?: Pair[];
  items?: string[];
  acceptedAnswers: string[];
  tolerance: number;
  marks: number;
  explanation: string;
  published: boolean;
  updatedAt?: string;
  /** One picture per question (alt text is required when set). */
  image?: Pic | null;
  /** Tutor list only: how many assessments use it. */
  usedBy?: number;
}

/** A question as a LIST row (GET /questions?light=1 / GET /assessments/:id): enough to scan and pick — no options, key or
 *  explanation. Open one with GET /questions/:id for the full `Question`. */
export interface QLite {
  /** Year groups this question is for (labels); empty = not tagged. */
  yearGroups?: string[];
  id: string;
  franchiseId?: string | null;
  topicId: string;
  kind: string;
  prompt: string;
  marks: number;
  published: boolean;
  hasImage?: boolean;
  usedBy?: number;
}

/** GET /questions with ?limit= → this envelope. */
export interface QPage { items: QLite[]; total: number; nextCursor: string | null }

/** What a student is shown while sitting a paper — never any answer key. */
export interface TakeQuestion {
  id: string; kind: string; prompt: string; options?: Option[]; marks: number; topicId: string; image?: Pic | null;
  /** match: the terms as written, and the definitions SHUFFLED by the server (which goes with which is never sent). */
  terms?: Piece[]; definitions?: Piece[];
  /** order: the items, shuffled by the server. */
  items?: string[];
}

export interface LastAttempt { id: string; pct: number; status: AttemptStatus; submittedAt: string | null }

export interface Assessment {
  id: string;
  /** Whose it is (null = head office / the provider's own) — a franchise can't change head office's. */
  franchiseId?: string | null;
  type: AssessType;
  title: string;
  subject: string;
  topicIds: string[];
  /** Tutors get the ids (needed to edit); parents get counts. */
  questionIds?: string[];
  questionCount?: number;
  totalMarks?: number;
  timeLimitMins: number | null;
  passMarkPct: number;
  published?: boolean;
  updatedAt?: string;
  // Parent-only extras
  lastAttempt?: LastAttempt | null;
  done?: boolean;
  locked?: boolean;
  lockedReason?: string;
  // Round 3 — year group / age targeting and retake control
  audience?: Audience;
  /** Tutor list: question kinds in this paper ({kind: count}) — the card's "3 Multiple choice · 1 Written". */
  kindCounts?: Record<string, number>;
  /** GET /assessments/:id (the builder): this paper's questions as light rows, in order. */
  questions?: QLite[];
  /** Tutor: how many enrolled students the audience covers. */
  eligibleCount?: number;
  /** Parent: the child's year group / age is unknown, so eligibility couldn't be checked. */
  audienceUnknown?: boolean;
  /** Parent: this paper is the exit quiz of a lesson (the note's id + title): take the lesson first, not the loose quiz. */
  lessonNoteId?: string | null;
  lessonTitle?: string | null;
  retakePolicy?: RetakeOverride;
  retakeCooldownHours?: number | null;
  /** Parent overlay: can this child sit it again now? */
  retake?: RetakeInfo;
}

export interface StartedAttempt { attemptId: string; timeLimitMins: number | null; startedAt: string; questions: TakeQuestion[]; /** True when the server handed back a paper that was already running. */ resumed?: boolean;
  /** A resumed paper: the answers-so-far saved server-side (PUT /attempts/:id/draft), so a resume works on any device. */
  draft?: { answers: Record<string, unknown>; idx: number; savedAt: string } }

export interface ResultAnswer {
  questionId: string;
  correct: boolean | null;
  marksAwarded: number;
  marksMax: number;
  response?: unknown;
  /** Only present when the tenant's revealAnswers rule allows it. */
  correctAnswer?: unknown;
  acceptedAnswers?: string[];
  explanation?: string;
  feedback?: string;
  /** Tutor views only: a written answer still waiting for marks. */
  pending?: boolean;
  // Present on GET /attempts/:id ("Result + prompts"); tolerated if absent.
  prompt?: string;
  kind?: string;
  options?: Option[];
  topicId?: string;
  image?: Pic | null;
}

export interface Result {
  id: string;
  status: AttemptStatus;
  scoreMarks: number;
  maxMarks: number;
  pct: number;
  passed?: boolean | null;
  byTopic: Record<string, { got: number; max: number }>;
  answers: ResultAnswer[];
  assessmentId?: string;
  assessmentTitle?: string;
  assessmentType?: AssessType;
  childId?: string;
  childName?: string;
  submittedAt?: string | null;
  passMarkPct?: number;
  // Self-marking clarity: what the auto-marker already scored vs the written part.
  autoMarks?: number;
  autoMax?: number;
  writtenPending?: number;
  awaitingWritten?: boolean;
  /** "after_pass" is holding the answer key + explanations back until the quiz is passed. */
  keyHeld?: boolean;
}

/** A row from GET /attempts (list). */
export interface AttemptRow {
  id: string;
  assessmentId: string;
  assessmentTitle?: string;
  assessmentType?: AssessType;
  childId: string;
  childName?: string;
  status: AttemptStatus;
  /** null while a paper is still being sat. */
  pct: number | null;
  passed?: boolean | null;
  subject?: string;
  scoreMarks?: number;
  maxMarks?: number;
  submittedAt: string | null;
  /** The homework it was set through, when it was (a group's quiz is homework with an assessment). */
  homeworkId?: string | null;
  startedAt?: string;
  autoMarks?: number;
  autoMax?: number;
  writtenPending?: number;
  awaitingWritten?: boolean;
}

export interface MasteryTopic { topicId: string; topic: string; subtopic: string | null; masteryPct: number; band: string | null; attempts: number; baselinePct: number | null; lastAttemptAt: string | null }
export interface MasterySubject { subject: string; masteryPct: number | null; band: string | null; coverage: number; baselinePct: number | null; growthPct: number | null; topics: MasteryTopic[] }
export interface TrendPoint { at: string; pct: number; subject: string; title: string }
export interface MasteryOverall {
  masteryPct: number | null; band: string | null; bandIndex: number; bandCount: number;
  next: { label: string; min: number } | null; toNext: number | null; subjectsCounted: number;
}
export interface Mastery { childId: string; childName: string; subjects: MasterySubject[]; trend: TrendPoint[]; overall?: MasteryOverall | null; bands?: { min: number; label: string }[] }
export interface OverviewStudent { childId: string; childName: string; subjects: { subject: string; masteryPct: number | null; band: string | null }[]; lastActive: string | null }

/** "/api/learning-hub/<path>?tenantId=…&<extra>" — `qs` is the shell's ?tenantId= (or ""). */
export function hubPath(qs: string, path: string, extra?: Record<string, string | null | undefined>): string {
  const params = Object.entries(extra ?? {}).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  const base = qs || "";
  const joined = params.join("&");
  const q = joined ? (base ? `${base}&${joined}` : `?${joined}`) : base;
  return `/api/learning-hub${path}${q}`;
}

export const ruleOf = (kinds: QuestionKind[], kind: string): KindRule => kinds.find((k) => k.id === kind)?.mark ?? "manual";
export const kindLabel = (kinds: QuestionKind[], kind: string) => kinds.find((k) => k.id === kind)?.label ?? kind;

/** A quick local id for an option (the API keys `answer` on these). */
export const newOptionId = () => `o${Math.random().toString(36).slice(2, 8)}`;
