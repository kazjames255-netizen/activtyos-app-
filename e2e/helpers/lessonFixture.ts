import fs from "node:fs";
import path from "node:path";
import { apiFetch, apiPost } from "./accounts";
import { ROOT } from "./env";

// Arrange-side helper for the interactive-lesson specs: turns an Oak lesson (scratch/oak-raw/…json, or the bundled copy below
// when the crawl isn't on this machine) into a structured lesson exactly as docs/oak-import.md prescribes — questions, an
// exit quiz, and a hubNotes doc with the `lesson` field — using only the public API a tutor uses (never Firestore).

const RAW = path.join(ROOT, "scratch/oak-raw/biology-secondary-ks4-foundation-aqa/coordination-and-control-the-human-nervous-system__neurones-and-synapses.json");

type Part = { type?: string; text?: string };
interface OakQ {
  questionType: string; questionStem: Part[]; feedback?: string; hint?: string;
  answers?: {
    "multiple-choice"?: { answer: Part[]; answerIsCorrect: boolean }[];
    "short-answer"?: { answer: Part[]; answerIsDefault?: boolean }[];
    match?: { correctChoice: Part[]; matchOption: Part[] }[];
    order?: { answer: Part[]; correctOrder: number }[];
  };
}
interface OakLesson {
  lessonTitle: string; unitTitle: string; subjectTitle: string; keyStageTitle: string; year: string; _sourceUrl: string; programmeSlug: string;
  pupilLessonOutcome: string; keyLearningPoints: { keyLearningPoint: string }[]; lessonKeywords: { keyword: string; description: string }[];
  lessonOutline: { lessonOutline: string }[]; misconceptionsAndCommonMistakes: { misconception: string; response: string }[]; teacherTips: { teacherTip: string }[];
  transcriptSentences?: string[]; starterQuiz: OakQ[]; exitQuiz: OakQ[];
}

/** A tiny lesson used when the Oak crawl isn't available (same shape as the crawler's output). */
const BUNDLED: OakLesson = {
  lessonTitle: "Neurones and synapses", unitTitle: "Coordination and control: the human nervous system", subjectTitle: "Biology", keyStageTitle: "Key Stage 4", year: "10",
  programmeSlug: "biology-secondary-ks4-foundation-aqa", _sourceUrl: "https://www.thenational.academy/teachers/programmes/biology-secondary-ks4-foundation-aqa/units/coordination-and-control-the-human-nervous-system/lessons/neurones-and-synapses",
  pupilLessonOutcome: "I can describe the structure and function of neurones and how a nerve impulse crosses a synapse.",
  keyLearningPoints: [
    { keyLearningPoint: "A neurone is a nerve cell that carries electrical impulses around the body." },
    { keyLearningPoint: "The axon carries the impulse and is often covered by a fatty myelin sheath that speeds it up." },
    { keyLearningPoint: "A synapse is a small gap between two neurones that the message crosses using chemicals." },
  ],
  lessonKeywords: [{ keyword: "neurone", description: "A nerve cell." }, { keyword: "axon", description: "The long fibre that carries an impulse away from the cell body." }, { keyword: "synapse", description: "The gap between two neurones." }],
  lessonOutline: [{ lessonOutline: "Neurones carry impulses" }, { lessonOutline: "Synapses" }],
  misconceptionsAndCommonMistakes: [{ misconception: "Nerves and neurones are the same thing.", response: "A nerve is a bundle of many neurones." }],
  teacherTips: [{ teacherTip: "Use the myelin on/off widget to show the difference in speed." }],
  starterQuiz: [
    { questionType: "short-answer", questionStem: [{ type: "text", text: "What are nerve cells called?" }], feedback: "Nerve cells are called neurones.", answers: { "short-answer": [{ answer: [{ text: "neurones" }], answerIsDefault: true }, { answer: [{ text: "neurons" }] }] } },
    { questionType: "multiple-choice", questionStem: [{ type: "text", text: "What is the role of the nervous system?" }], feedback: "It detects changes and coordinates a response.", answers: { "multiple-choice": [{ answer: [{ text: "To pump blood" }], answerIsCorrect: false }, { answer: [{ text: "To detect changes and coordinate responses" }], answerIsCorrect: true }, { answer: [{ text: "To digest food" }], answerIsCorrect: false }] } },
    { questionType: "order", questionStem: [{ type: "text", text: "Put these in order to show how a message moves through the nervous system." }], feedback: "The message goes from the receptor to the effector.", answers: { order: [{ answer: [{ text: "Receptor" }], correctOrder: 1 }, { answer: [{ text: "Sensory neurone" }], correctOrder: 2 }, { answer: [{ text: "Brain" }], correctOrder: 3 }, { answer: [{ text: "Effector" }], correctOrder: 4 }] } },
  ],
  exitQuiz: [
    { questionType: "multiple-choice", questionStem: [{ type: "text", text: "What sort of tissue is the myelin sheath made of?" }], feedback: "The myelin sheath is a fatty layer.", answers: { "multiple-choice": [{ answer: [{ text: "Fatty" }], answerIsCorrect: true }, { answer: [{ text: "Bony" }], answerIsCorrect: false }, { answer: [{ text: "Muscular" }], answerIsCorrect: false }] } },
    { questionType: "short-answer", questionStem: [{ type: "text", text: "What are the chemicals called that diffuse across the synapse?" }], feedback: "They are neurotransmitters.", answers: { "short-answer": [{ answer: [{ text: "neurotransmitters" }], answerIsDefault: true }] } },
    { questionType: "multiple-choice", questionStem: [{ type: "text", text: "What effect does a myelin sheath have on nerve impulses?" }], feedback: "It speeds them up.", answers: { "multiple-choice": [{ answer: [{ text: "It speeds them up" }], answerIsCorrect: true }, { answer: [{ text: "It slows them down" }], answerIsCorrect: false }] } },
  ],
};

export function loadOakLesson(): OakLesson {
  try { return JSON.parse(fs.readFileSync(RAW, "utf8")) as OakLesson; } catch { return BUNDLED; }
}

const txt = (parts: Part[] | undefined) => (parts ?? []).filter((p) => p.type === "text" || p.text).map((p) => p.text ?? "").join(" ").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();

/** One question as the tests need it: how to create it, and how to answer it right / wrong through the UI. */
export interface SeedQ {
  id: string;
  kind: "single" | "short" | "order" | "match" | "written";
  prompt: string;
  explanation: string;
  /** single: the correct / one wrong option text · short: the accepted answer · order: the items in the correct order · match: the pairs. */
  right: string; wrong: string; items?: string[]; pairs?: { term: string; definition: string }[];
}

type Body = Record<string, unknown>;
/** Oak question → hubQuestions body + how to answer it; null when it can't be represented without pictures. */
function convert(q: OakQ): { body: Body; meta: Omit<SeedQ, "id"> } | null {
  const prompt = txt(q.questionStem);
  if (!prompt) return null;
  const explanation = (q.feedback ?? "").replace(/\*\*/g, "").trim();
  if (q.questionType === "multiple-choice") {
    const a = (q.answers?.["multiple-choice"] ?? []).map((x) => ({ text: txt(x.answer), ok: x.answerIsCorrect })).filter((x) => x.text);
    const good = a.filter((x) => x.ok), bad = a.filter((x) => !x.ok);
    if (a.length < 2 || good.length !== 1 || !bad.length || new Set(a.map((x) => x.text)).size !== a.length) return null;
    const options = a.map((x, i) => ({ id: `o${i}`, text: x.text }));
    return { body: { kind: "single", prompt, options, answer: options[a.indexOf(good[0])].id, marks: 1, explanation }, meta: { kind: "single", prompt, explanation, right: good[0].text, wrong: bad[0].text } };
  }
  if (q.questionType === "short-answer") {
    const a = (q.answers?.["short-answer"] ?? []).map((x) => ({ text: txt(x.answer), d: !!x.answerIsDefault })).filter((x) => x.text);
    if (!a.length) return null;
    const main = (a.find((x) => x.d) ?? a[0]).text;
    return { body: { kind: "short", prompt, answer: main, acceptedAnswers: a.map((x) => x.text).filter((t) => t !== main), marks: 1, explanation }, meta: { kind: "short", prompt, explanation, right: main, wrong: "zzz wrong" } };
  }
  if (q.questionType === "order") {
    const items = [...(q.answers?.order ?? [])].sort((x, y) => x.correctOrder - y.correctOrder).map((x) => txt(x.answer)).filter(Boolean);
    if (items.length < 2 || items.length > 8) return null;
    return { body: { kind: "order", prompt, items, marks: 1, explanation }, meta: { kind: "order", prompt, explanation, right: items.join(" > "), wrong: "", items } };
  }
  if (q.questionType === "match") {
    const pairs = (q.answers?.match ?? []).map((x) => ({ term: txt(x.matchOption), definition: txt(x.correctChoice) })).filter((p) => p.term && p.definition);
    // Terms like "a", "b", "c" only make sense next to a picture — skip those.
    if (pairs.length < 3 || pairs.length > 8 || pairs.some((p) => p.term.length < 3)) return null;
    return { body: { kind: "match", prompt, pairs, marks: 1, explanation }, meta: { kind: "match", prompt, explanation, right: "", wrong: "", pairs } };
  }
  return null;
}

export interface SeededLesson {
  title: string; subject: string; topicId: string; noteId: string; quizId: string; quizTitle: string;
  warmup: SeedQ[]; quiz: SeedQ[];
  keywords: { keyword: string; description: string }[]; points: string[]; outcome: string; sourceUrl: string; widget: string;
  /** The lesson plan stored on the lesson (what the tutor reader and the student recap render). */
  plan: { steps: { title: string; recap: string[] }[]; commonMistakes: { mistake: string; fix: string }[]; watchOut: string[] };
}

export interface SeedOpts {
  stamp: string;
  /** Subject of the topic the lesson is filed under (the student is enrolled in it). */
  subject: string;
  topicId: string;
  widget?: string | null;
  /** How many warm-up / quiz questions to keep (after converting). */
  warmupMax?: number; quizMax?: number;
  /** Kinds to leave out (e.g. while a question kind's UI isn't available). */
  skipKinds?: SeedQ["kind"][];
  /** Extra questions created as-is (a hubQuestions body + how to answer it) and put FIRST in the warm-up / the exit quiz —
   *  e.g. a picture question with picture options, or a written answer the tutor must mark. */
  extraWarmup?: { body: Record<string, unknown>; meta: Omit<SeedQ, "id"> }[];
  extraQuiz?: { body: Record<string, unknown>; meta: Omit<SeedQ, "id"> }[];
  /** A slide deck (lesson.slides, features/learninghub/lesson/slides/types.ts): the lesson then runs warm-up → slides → quiz. */
  slides?: unknown[];
  /** Override the exit quiz's retake policy (default: inherit the tenant's). */
  retakePolicy?: "inherit" | "unlimited" | "once" | "cooldown";
}

/** Create the questions, the exit quiz and the lesson note on `tutorToken`'s tenant. */
export async function seedOakLesson(tutorToken: string, o: SeedOpts): Promise<SeededLesson> {
  const oak = loadOakLesson();
  const skip = new Set(o.skipKinds ?? []);
  const make = async (list: OakQ[], max: number) => {
    const out: SeedQ[] = [];
    for (const raw of list) {
      if (out.length >= max) break;
      const c = convert(raw);
      if (!c || skip.has(c.meta.kind)) continue;
      const made = await apiPost<{ id: string }>("/api/learning-hub/questions", tutorToken, { topicId: o.topicId, ...c.body });
      out.push({ id: made.id, ...c.meta });
    }
    return out;
  };
  const extra = async (list: SeedOpts["extraWarmup"]) => {
    const out: SeedQ[] = [];
    for (const x of list ?? []) {
      const made = await apiPost<{ id: string }>("/api/learning-hub/questions", tutorToken, { topicId: o.topicId, ...x.body });
      out.push({ id: made.id, ...x.meta });
    }
    return out;
  };
  const warmup = [...(await extra(o.extraWarmup)), ...(await make(oak.starterQuiz, o.warmupMax ?? 4))];
  const quiz = [...(await extra(o.extraQuiz)), ...(await make(oak.exitQuiz, o.quizMax ?? 3))];
  if (!warmup.length || !quiz.length) throw new Error("the Oak fixture produced no usable questions");

  const title = `${oak.lessonTitle} ${o.stamp}`;
  const quizTitle = `Lesson quiz — ${title}`;
  const asm = await apiPost<{ id: string }>("/api/learning-hub/assessments", tutorToken, { type: "quiz", title: quizTitle, subject: o.subject, topicIds: [o.topicId], questionIds: quiz.map((q) => q.id), timeLimitMins: null, passMarkPct: 50, published: true, ...(o.retakePolicy ? { retakePolicy: o.retakePolicy } : {}) });

  const points = oak.keyLearningPoints.map((k) => k.keyLearningPoint);
  const keywords = oak.lessonKeywords.map((k) => ({ keyword: k.keyword, description: k.description }));
  const widget = o.widget === undefined ? "neurone" : o.widget;
  const body = [`**${oak.pupilLessonOutcome}**`, "", ...points.map((p) => `- ${p}`), "", ...keywords.map((k) => `- **${k.keyword}**: ${k.description}`), "",
    `A ${oak.subjectTitle} lesson by Oak National Academy licensed under Open Government Licence (OGL).`].join("\n");
  // The lesson plan (lesson.plan, features/learninghub/lesson/plan.ts) that replaced the raw video script: built here from the fixture's own facts.
  const outline = oak.lessonOutline.map((x) => x.lessonOutline);
  const half = Math.max(1, Math.ceil(points.length / Math.max(1, outline.length)));
  const plan = {
    v: 1, source: "derived" as const,
    steps: [
      { kind: "warmup", title: "Warm-up and goal", minutes: 5, doThis: ["Start with the warm-up questions.", "Read the lesson goal aloud together."], say: oak.pupilLessonOutcome, keywords: keywords.map((k) => ({ term: k.keyword, meaning: k.description })), recap: [`Our goal: “${oak.pupilLessonOutcome}”`] },
      ...outline.map((h, i) => { const ideas = points.slice(i * half, (i + 1) * half); return { kind: "teach", title: h, minutes: 7, doThis: ["Go through the key ideas below, one at a time."], keyIdeas: ideas, checkFor: { ask: `Can you explain “${h}” in your own words?` }, recap: ideas.length ? ideas : [h] }; }),
      { kind: "guided", title: "Practise together", minutes: 8, doThis: ["Practise the key ideas together, using the key words."], recap: ["Practise the ideas with a little help."] },
      { kind: "independent", title: "Try it on your own", minutes: 10, doThis: ["Ask the student to do the lesson quiz on their own."], recap: ["Do the quiz questions on your own."] },
      { kind: "plenary", title: "Recap and finish", minutes: 4, doThis: ["Ask the student to tell you the main ideas of the lesson in their own words."], recap: [`Can you do it now? “${oak.pupilLessonOutcome}”`] },
    ],
    commonMistakes: oak.misconceptionsAndCommonMistakes.map((m) => ({ mistake: m.misconception, fix: m.response })),
    watchOut: oak.teacherTips.map((t) => t.teacherTip),
  };
  const note = await apiPost<{ id: string }>("/api/learning-hub/notes", tutorToken, {
    topicId: o.topicId, title, body, published: true,
    lesson: {
      v: 1, subject: oak.subjectTitle, keyStage: oak.keyStageTitle, year: oak.year, unit: oak.unitTitle, outcome: oak.pupilLessonOutcome,
      steps: points, outline: oak.lessonOutline.map((x) => x.lessonOutline), keywords,
      misconceptions: oak.misconceptionsAndCommonMistakes, teacherTips: oak.teacherTips.map((t) => t.teacherTip), plan,
      warmupQuestionIds: warmup.map((q) => q.id), quizId: asm.id, widget,
      ...(o.slides ? { slides: o.slides } : {}),
      source: { provider: "oak", url: oak._sourceUrl, licence: "OGL-3.0", attribution: `A ${oak.subjectTitle} lesson by Oak National Academy licensed under Open Government Licence (OGL)`, programmes: [oak.programmeSlug], fetchedAt: new Date().toISOString() },
    },
  });
  return { title, subject: o.subject, topicId: o.topicId, noteId: note.id, quizId: asm.id, quizTitle, warmup, quiz, keywords, points, outcome: oak.pupilLessonOutcome, sourceUrl: oak._sourceUrl, widget: widget ?? "", plan };
}

export const getNote = <T = Record<string, unknown>>(token: string, id: string) => apiFetch<T>(`/api/learning-hub/notes/${id}`, token);
