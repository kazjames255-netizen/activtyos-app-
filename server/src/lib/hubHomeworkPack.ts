// Ready-made homework for a lesson — a PURE, deterministic function. Nothing is stored: every imported lesson
// (exit quiz + flashcards + lesson plan) can hand a tutor a complete suggested homework, built only from the
// lesson's own data (its outcome, key learning points, plan key ideas, keywords, quiz and cards). No new facts
// are ever added — the instructions are fixed templates around the lesson's own words. The tutor edits anything,
// picks the children and presses Set (POST /homework is unchanged).

export interface PackQuiz { id: string; title: string; questionCount: number; published: boolean }

export interface PackInput {
  noteId: string;
  title: string;
  /** The structured `lesson` field of the note, if it has one (a plain note has none). */
  lesson?: Record<string, unknown> | null;
  /** The lesson's exit quiz (lesson.quizId) if it exists in this tenant. */
  quiz?: PackQuiz | null;
  /** Cards written for this lesson, and the topic they sit under (homework links flashcards by topic). */
  flashcardCount?: number;
  flashcardTopicId?: string | null;
  /** The note's own topic — used when the lesson has cards. */
  dueDays?: number;
  now?: Date;
}

export interface HomeworkPack {
  noteId: string;
  title: string;
  instructions: string;
  /** Default due date = now + dueDays, as an ISO time (the UI shows it as a date; it may pick another). */
  dueInDays: number;
  dueAt: string;
  noteIds: string[];
  assessmentId: string | null;
  quiz: PackQuiz | null;
  flashcardTopicId: string | null;
  flashcardCount: number;
  /** "5" for a Year 5 lesson (Oak lessons carry it); the UI turns it into "everyone in Year 5". */
  year: string | null;
  interactive: boolean;
  /** Curated lessons also carry a printable-style worksheet quiz — offered, never attached automatically. */
  worksheetAssessmentId: string | null;
  /** What the pack was built from, so a tutor can see it is not invented ("Key ideas: 3, key words: 4, …"). */
  basis: { keyIdeas: number; keywords: number; quiz: boolean; flashcards: number };
}

const oneLine = (v: unknown, max = 240): string => {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
};
const list = (v: unknown, max: number, len = 240): string[] => (Array.isArray(v) ? v.map((x) => oneLine(x, len)).filter(Boolean).slice(0, max) : []);

/** The lesson's key ideas: key learning points first, else the plan's key ideas, else the outline headings. */
function keyIdeas(l: Record<string, unknown>): string[] {
  // (`points` is the importer's name for the key learning points; earlier lessons called them `steps`)
  const points = list(l.points, 4);
  if (!points.length) points.push(...list(l.steps, 4));
  if (points.length) return points;
  const plan = l.plan as { steps?: { keyIdeas?: unknown }[] } | undefined;
  const fromPlan = (Array.isArray(plan?.steps) ? plan!.steps! : []).flatMap((s) => list(s?.keyIdeas, 4));
  if (fromPlan.length) return [...new Set(fromPlan)].slice(0, 4);
  return list(l.outline, 4, 120);
}
function keywordTerms(l: Record<string, unknown>): string[] {
  const kws = Array.isArray(l.keywords) ? l.keywords : [];
  const out = kws.map((k) => (typeof k === "string" ? k : oneLine((k as Record<string, unknown> | null)?.keyword ?? (k as Record<string, unknown> | null)?.term ?? (k as Record<string, unknown> | null)?.k, 60))).map((k) => oneLine(k, 60)).filter(Boolean);
  return [...new Set(out)].slice(0, 6);
}

export function buildHomeworkPack(i: PackInput): HomeworkPack {
  const l = i.lesson && typeof i.lesson === "object" ? i.lesson : null;
  const title = oneLine(i.title, 180) || "this lesson";
  const dueInDays = Math.min(90, Math.max(1, Math.round(i.dueDays ?? 7)));
  const now = i.now ?? new Date();
  const dueAt = new Date(now.getTime() + dueInDays * 86_400_000).toISOString();
  const cards = Math.max(0, Math.floor(i.flashcardCount ?? 0));
  const quiz = i.quiz ?? null;
  const ideas = l ? keyIdeas(l) : [];
  const terms = l ? keywordTerms(l) : [];
  const outcome = l ? oneLine(l.outcome, 300) : "";

  const steps: string[] = [];
  if (l) {
    steps.push(`Open the lesson “${title}” in the Lessons tab and go through it again.${ideas.length ? ` Make sure you can explain the key ideas:\n${ideas.map((x) => `   • ${x}`).join("\n")}` : ""}${terms.length ? `\n   Key words to know: ${terms.join(", ")}.` : ""}`);
  } else steps.push(`Read the lesson “${title}” in the Lessons tab.`);
  if (quiz) steps.push(`Do the lesson quiz “${quiz.title}”${quiz.questionCount ? ` (${quiz.questionCount} question${quiz.questionCount === 1 ? "" : "s"})` : ""} and check the answers you got wrong.`);
  if (cards > 0) steps.push(`Review the ${cards} flashcard${cards === 1 ? "" : "s"} for this lesson in the Flashcards tab.`);
  steps.push("When you’re done, hand it in and tell us what you found tricky.");

  const instructions = [
    outcome ? `Goal: ${outcome}` : "",
    steps.map((s, n) => `${n + 1}. ${s}`).join("\n"),
  ].filter(Boolean).join("\n\n").slice(0, 5000);

  const ws = l && typeof l.worksheet === "object" && l.worksheet ? (l.worksheet as { assessmentId?: unknown }).assessmentId : null;
  const year = l && (typeof l.year === "string" || typeof l.year === "number") ? oneLine(String(l.year), 6) : "";
  return {
    noteId: i.noteId,
    title: `Homework: ${title}`.slice(0, 200),
    instructions,
    dueInDays, dueAt,
    noteIds: [i.noteId],
    assessmentId: quiz?.id ?? null,
    quiz,
    flashcardTopicId: cards > 0 ? i.flashcardTopicId ?? null : null,
    flashcardCount: cards,
    year: year || null,
    interactive: !!l,
    worksheetAssessmentId: typeof ws === "string" && ws ? ws : null,
    basis: { keyIdeas: ideas.length, keywords: terms.length, quiz: !!quiz, flashcards: cards },
  };
}
