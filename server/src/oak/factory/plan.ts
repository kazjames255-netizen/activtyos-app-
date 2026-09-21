// Lesson-factory PLAN generator + validator: turns the structured facts Oak publishes for a lesson (pupil outcome, key learning
// points, keywords + definitions, lesson outline, teacher tips, misconceptions) into a simplified STEP-BY-STEP LESSON PLAN
// (features/learninghub/lesson/plan.ts) that replaces the raw video script. Deterministic, no LLM, no network.
//
// SAFETY RULES (children's content — a wrong statement is the worst bug):
//  · Nothing is invented. Every fact in a derived plan is a verbatim (whitespace-normalised) piece of Oak's own outcome / key
//    learning point / keyword definition / outline heading / teacher tip / misconception. The only words that are ours are the fixed
//    TEMPLATES below (instructions with no lesson facts in them), and validatePlan() checks that independently.
//  · The video transcript is NOT used as text: sampled transcripts contain transcription errors (e.g. "non-unit" heard as "one-unit")
//    and pupils' wrong statements. The single exception is PURE ARITHMETIC sentences ("6 plus 4 is equal to 10"), which are kept only
//    when the arithmetic is evaluated and comes out TRUE, so they cannot be wrong.
//  · Teacher chatter ("Hi, I'm Mr X", "pause the video", "let's"), names and references to Oak's video / slides / worksheets are
//    filtered out of tips and misconceptions.
import type { LessonPlan, PlanStep, PlanKeyword } from "../../../../features/learninghub/lesson/plan";
import { allocate, titleSections } from "./generate";
import { cleanPoints, cleanKeywords, cleanOutline, tidy, BAD_MISTAKE } from "./quality";

export interface PlanFacts {
  outcome: string; points: string[]; keywords: { k: string; d: string }[]; outline: string[];
  tips: string[]; mis: { misconception: string; response: string }[]; transcript: string[];
  /** Oak's subject title ("English", "French"...): arithmetic worked examples are only taken for subjects that have them. */
  subject?: string;
}
export interface PlanOpts { hasWarmup: boolean }

// ── helpers ──────────────────────────────────────────────────────────────────
const nz = (s: string) => s.replace(/\s+/g, " ").trim();
const nk = (s: string) => nz(s).toLowerCase().replace(/[“”]/g, "'");
/** A source span quoted inside a template. Curly double quotes inside it become straight single ones so the quote pairs stay unambiguous (nk() maps both the same way). */
const q = (s: string) => `“${s.replace(/[“”]/g, "'")}”`;
const JUNK = /\$\$|\\\(|\\frac|\\times|\\\\|\{\{|\[object /;
export const CHATTER = /\b(i'm|i am|i'll|i've|my name|hello|hi there|hey|welcome|let'?s|pause|your turn|my turn|repeat (?:after|that|it)|thank you|thanks for|well done|video|slides?|worksheet|learning cycles?|powerpoint|mr|mrs|ms|miss|dr|oak|izzy|jun|sam|aisha|alex|andeep|laura|lucas|sofia|sophia|jacob|marcus|emma|ravi|priya)\b\.?/i;
/** References to Oak's own resources / structure that a tutor using this plan cannot follow ("Task B2", "LC1", "CfU", "Cycle B", "Lesson 2 of this unit", "media clips page", "as the illustrations show"). */
const TASK_CODE_CS = /\b(?:Tasks?|Activity|Exercises?|Cycle|Section|Part)s? [A-Z]\d?[a-z]?\b|\b(?:Tasks?|Exercises?) \d|\bLC ?\d|\bCfUs?\b|\b[A-D]\d[a-z]?(?:-[a-z])?\b/;
const TASK_CODE_CI = /\blessons? \d|\bmedia clips?\b|\billustrations?\b|\bstem sentence\b|\bthe (?:quiz|starter|exit) (?:quiz|question)|\bbelow\b|\bthis unit\b|\bworksheet|\bexit ticket\b|\bour (?:\w+ )?curriculum\b|\bas mentioned\b|\bprevious units?\b|\b(?:this|the|in the|throughout the|within the|beyond this|of this) (?:lesson|session|activity)\b|\blesson resources?\b|\badditional materials?\b|\bcycle [a-d0-9]\b|\bpractice tasks?\b|\bas suggested\b|\bstem sentences?\b|\bchecks? for understanding\b|\bCLEAPSS\b|\bwebsite\b|\bMWB\b|\bpart [12]\b|_{2,}|\bthe animation\b|\bthe model making\b|\bpages? \d|https?:|www\.|\bour\b[^.]{0,30}\bcurricul|\b(?:first|second|third|final|last|next|main) (?:practice |writing |reading )?tasks?\b|\baudio\b|\bthe (?:song|clip)\b/i;
const TASK_CODE = { test: (s: string) => TASK_CODE_CS.test(s) || TASK_CODE_CI.test(s) };
const MAX_FACT = 690; // longest source sentence kept whole (normalizePlan clips at 750)

const T = {
  title: { warm: "Warm-up and goal", guided: "Practise together", indep: "Try it on your own", plen: "Recap and finish", ideas: "Key ideas" },
  warm: {
    warmup: "Start with the warm-up questions.",
    goal: "Read the lesson goal aloud together.",
    words: "Go through the key words. Ask what each one means before showing the definition.",
    sounds: "Go through the sounds together. Say each one aloud and ask the student to say it back.", // Q2: sound-symbol keywords ([é], [ch]) are not "meanings"
    ask: (k: string) => `What does ${q(k)} mean?`,
    recap: (o: string) => `Our goal: ${q(o)}`,
  },
  teach: {
    go1: "Go through the key idea below.",
    goN: "Go through the key ideas below, one at a time.",
    say1: "Ask the student to say it back in their own words before you move on.",
    sayN: "Ask the student to say each idea back in their own words before you move on.",
    kw1: (k: string) => `Point out the key word ${k} as it comes up.`,
    kwN: (k: string) => `Point out the key words ${k} as they come up.`,
    askH: (h: string) => `What did you learn in this part of the lesson: ${q(h)}?`, // Q2: outline headings are activities ("Writing descriptive sentences"), not concepts to "explain"
    ask: "Can you say the key idea back in your own words?",
  },
  guided: {
    g1: "Practise the key ideas together, using the key words.",
    g2: "Let the student try first, then help them check their own answer.",
    ex: "Work through the worked examples below together.",
    tips: "See the tips at the end of this plan for ideas.",
    recap: "Practise the ideas with a little help.",
  },
  indep: {
    i1: "Ask the student to do the lesson quiz on their own.",
    i2: "Mark it together and talk through any answer they got wrong.",
    r1: "Do the quiz questions on your own.", r2: "Look again at any you got wrong.",
    i3: (o: string) => `Then let the student have a go at the lesson goal itself: ${q(o)}`, // Q2: a writing / performing lesson's independent task is the task itself, not only the quiz
  },
  plen: {
    p1: "Ask the student to tell you the main ideas of the lesson in their own words.",
    p2: (o: string) => `Read the goal again: ${q(o)} Then ask whether they can do it now.`,
    ask: "What were the most important things you learned today?",
    recap: (o: string) => `Can you do it now? ${q(o)}`,
  },
};
const quotedList = (xs: string[]) => (xs.length === 1 ? q(xs[0]) : `${xs.slice(0, -1).map(q).join(", ")} and ${q(xs[xs.length - 1])}`);

/** Every template as a skeleton (source quotes → §). The validator accepts a derived plan's own words only if they are one of these. */
const SKELETONS = new Set<string>();
{
  const S = "§";
  const add = (...xs: string[]) => xs.forEach((x) => SKELETONS.add(x));
  add(T.title.warm, T.title.guided, T.title.indep, T.title.plen, T.title.ideas);
  add(T.warm.warmup, T.warm.goal, T.warm.words, T.warm.sounds, T.warm.ask(S), T.warm.recap(S));
  add(T.teach.go1, T.teach.goN, T.teach.say1, T.teach.sayN, T.teach.kw1("“§”"), T.teach.kwN("“§”"), T.teach.askH(S), T.teach.ask);
  add(T.guided.g1, T.guided.g2, T.guided.ex, T.guided.tips, T.guided.recap);
  add(T.indep.i1, T.indep.i2, T.indep.i3(S), T.indep.r1, T.indep.r2);
  add(T.plen.p1, T.plen.p2(S), T.plen.ask, T.plen.recap(S));
}
/** "Key idea 2" style titles. */
const KEY_IDEA_N = /^Key idea \d+$/;

// ── pure-arithmetic worked examples (kept only when TRUE) ───────────────────
const NUM = /^-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;
const OPW: Record<string, string> = { plus: "+", add: "+", added: "+", minus: "-", subtract: "-", subtracted: "-", times: "*", multiplied: "*", divided: "/", "+": "+", "-": "-", "×": "*", "x": "*", "÷": "/", "/": "/" };
const FILL = new Set(["by", "and"]);
const EQ_TOK = new Set(["equals", "makes", "gives", "=", "is"]);
function evalSide(toks: string[]): number | null {
  // alternating number (op number)*, ops from OPW, precedence * / before + -
  const nums: number[] = []; const ops: string[] = [];
  let expectNum = true;
  for (const t of toks) {
    if (FILL.has(t) && !expectNum) continue; // "multiplied BY", "divided BY"
    if (expectNum) { if (!NUM.test(t)) return null; nums.push(Number(t.replace(/,/g, ""))); expectNum = false; }
    else { const o = OPW[t]; if (!o) return null; ops.push(o); expectNum = true; }
  }
  if (expectNum || nums.length < 1 || nums.length > 4) return null;
  // first pass * /
  const n2 = [nums[0]]; const o2: string[] = [];
  for (let i = 0; i < ops.length; i++) {
    if (ops[i] === "*") n2[n2.length - 1] *= nums[i + 1];
    else if (ops[i] === "/") { if (nums[i + 1] === 0) return null; n2[n2.length - 1] /= nums[i + 1]; }
    else { o2.push(ops[i]); n2.push(nums[i + 1]); }
  }
  let v = n2[0]; for (let i = 0; i < o2.length; i++) v = o2[i] === "+" ? v + n2[i + 1] : v - n2[i + 1];
  return v;
}
/** A transcript sentence that is nothing but an arithmetic equation ("37,000 plus 6,000 is equal to 25,000 plus 18,000"), TRUE when evaluated. */
export function trueArithmetic(sentence: string): boolean {
  const s = nz(sentence).replace(/[.]$/, "");
  if (!/\d/.test(s) || /[?!"“”:;()]/.test(s) || s.length > 120) return false;
  let toks = s.replace(/^so,? /i, "").replace(/\bis equal to\b/gi, "equals").replace(/\bequal to\b/gi, "equals").toLowerCase().split(" ").filter(Boolean);
  if (toks.some((t) => /,$/.test(t))) return false;
  const eqAt = toks.map((t, i) => (EQ_TOK.has(t) ? i : -1)).filter((i) => i >= 0);
  if (eqAt.length !== 1) return false;
  toks = toks.map((t) => t);
  const l = evalSide(toks.slice(0, eqAt[0])), r = evalSide(toks.slice(eqAt[0] + 1));
  if (l === null || r === null) return false;
  if (toks.slice(0, eqAt[0]).length < 3) return false; // a bare number is no example
  return Math.abs(l - r) < 1e-9 * Math.max(1, Math.abs(l));
}
export function arithmeticExamples(transcript: string[], max = 4): string[] {
  const seen = new Set<string>(); const out: string[] = [];
  for (const raw of transcript) {
    const s = nz(raw);
    if (!trueArithmetic(s) || /^so\b/i.test(s) || seen.has(nk(s))) continue;
    seen.add(nk(s)); out.push(/[.]$/.test(s) ? s : `${s}.`);
    if (out.length >= max) break;
  }
  return out.length >= 2 ? out : []; // one stray sum in the narration is an aside, not a worked example
}

// ── the generator ────────────────────────────────────────────────────────────
/** A tip / misconception is kept only when it is plain teaching advice: no Oak-resource references, names, or chatter. */
const cleanAdvice = (s: string) => { const t = nz(s); return t.length >= 15 && t.length <= MAX_FACT && !JUNK.test(t) && !CHATTER.test(t) && !TASK_CODE.test(t); };
/** A sound-symbol keyword of a language lesson ("[é]", "[ch]"): pronounced, not "meant". */
const soundSymbol = (k: { k: string }) => /^\[/.test(k.k.trim());
const clipTitle = (s: string) => (s.length > 90 ? `${s.slice(0, 89).trimEnd()}…` : s);

export function derivePlan(f: PlanFacts, opts: PlanOpts): LessonPlan | null {
  const outcome = nz(f.outcome);
  const okOutcome = outcome.length >= 8 && outcome.length <= 300 && !JUNK.test(outcome) ? outcome : "";
  const kws = f.keywords.map((k) => ({ k: nz(k.k), d: nz(k.d) })).filter((k) => k.k && k.k.length <= 60 && !JUNK.test(k.k) && !JUNK.test(k.d) && k.d.length <= 400);
  const kwDefs = kws.filter((k) => k.d.length >= 8);
  const points = f.points.map(nz).filter((p) => p.length >= 8 && p.length <= MAX_FACT && !JUNK.test(p));
  if (!okOutcome || (!points.length && kwDefs.length < 2)) return null;
  const outline = f.outline.map(nz).filter((h) => h && h.length <= 300 && !JUNK.test(h));
  const inPoint = (k: string, ps: string[]) => { const re = new RegExp(`(^|[^\\p{L}\\p{N}])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\p{N}])`, "iu"); return ps.some((p) => re.test(p)); };
  const kwObj = (k: { k: string; d: string }): PlanKeyword => (k.d ? { term: k.k, meaning: k.d } : { term: k.k });
  const examples = /^(?:english|french|spanish|german)$/i.test(f.subject ?? "") ? [] : arithmeticExamples(f.transcript); // Q2: a sum in an English lesson's narration is an aside, never a worked example
  const tips = f.tips.map(nz).filter(cleanAdvice).slice(0, 3);
  const mistakes = f.mis.map((m) => ({ mistake: nz(m.misconception), fix: nz(m.response) })).filter((m) => cleanAdvice(m.mistake) && !BAD_MISTAKE(m.mistake) && (!m.fix || cleanAdvice(m.fix))).slice(0, 3);

  const steps: PlanStep[] = [];
  // 1. warm-up and goal
  {
    const wk = kws.slice(0, 8);
    const first = kwDefs.find((k) => !soundSymbol(k)); // "What does “[é]” mean?" makes no sense: sound keywords are not asked as meanings
    const doThis = [...(opts.hasWarmup ? [T.warm.warmup] : []), T.warm.goal, ...(wk.length ? [wk.every(soundSymbol) ? T.warm.sounds : T.warm.words] : [])];
    steps.push({
      kind: "warmup", title: T.title.warm, minutes: 5, doThis, say: okOutcome,
      ...(wk.length ? { keywords: wk.map(kwObj) } : {}),
      ...(first ? { checkFor: { ask: T.warm.ask(first.k), lookFor: first.d } } : {}),
      recap: [T.warm.recap(okOutcome)],
    });
  }
  // 2. teaching steps: one per part of the lesson, holding its key learning points
  // Q5: the same section titles as the deck (outline heading when it fits, else the key word / subject the points are about)
  const secs = points.length ? titleSections(allocate(points, outline, okOutcome), kws, [okOutcome, ...points, ...outline].join(" ")) : [{ heading: "", points: [] as string[], title: T.title.ideas, fromOutline: false }];
  const perStep = Math.max(3, Math.round(20 / Math.max(1, secs.length)));
  secs.forEach((sec) => {
    const heading = clipTitle(sec.title);
    const used = kws.filter((k) => sec.points.length && inPoint(k.k, sec.points)).slice(0, 4);
    const ideas = sec.points.length ? sec.points : kwDefs.slice(0, 6).map((k) => `${k.k}: ${k.d}`);
    const many = ideas.length > 1;
    const doThis = [many ? T.teach.goN : T.teach.go1, many ? T.teach.sayN : T.teach.say1, ...(used.length ? [used.length === 1 ? T.teach.kw1(q(used[0].k)) : T.teach.kwN(quotedList(used.map((u) => u.k)))] : [])];
    steps.push({
      kind: "teach", title: heading, minutes: perStep, doThis, keyIdeas: ideas,
      ...(used.length ? { keywords: used.map(kwObj) } : {}),
      checkFor: { ask: sec.fromOutline ? T.teach.askH(clipTitle(sec.heading)) : T.teach.ask },
      recap: ideas,
    });
  });
  // 3. guided practice
  steps.push({
    kind: "guided", title: T.title.guided, minutes: 8,
    doThis: [T.guided.g1, T.guided.g2, ...(examples.length ? [T.guided.ex] : []), ...(tips.length ? [T.guided.tips] : [])],
    ...(examples.length ? { examples } : {}),
    recap: [T.guided.recap],
  });
  // 4. independent practice (the lesson quiz)
  const doesSomething = okOutcome.length <= 200 && /^I can (?:write|plan|perform|form|spell|edit|create|compose|speak|say|present|recite|draft|record|ask|talk|describe|translate)\b/i.test(okOutcome);
  steps.push({ kind: "independent", title: T.title.indep, minutes: 10, doThis: [T.indep.i1, T.indep.i2, ...(doesSomething ? [T.indep.i3(okOutcome)] : [])], recap: [T.indep.r1, T.indep.r2] });
  // 5. plenary
  steps.push({
    kind: "plenary", title: T.title.plen, minutes: 4, doThis: [T.plen.p1, T.plen.p2(okOutcome)],
    checkFor: { ask: T.plen.ask },
    recap: [T.plen.recap(okOutcome)],
  });
  return { v: 1, source: "derived", steps, commonMistakes: mistakes.map((m) => ({ mistake: m.mistake, fix: m.fix })), watchOut: tips };
}

// ── the validator ────────────────────────────────────────────────────────────
export interface PlanSource extends PlanFacts { /** All the text Oak published for the lesson (facts, quizzes, transcript, slide text): the pool every NUMBER in a plan must come from. */ blob: string }

/** Every string of a plan, tagged with the field it sits in. */
export function planTexts(plan: LessonPlan) { return fields(plan).map((f) => f.text); }
function fields(plan: LessonPlan): { field: string; text: string }[] {
  const out: { field: string; text: string }[] = [];
  plan.steps.forEach((s) => {
    out.push({ field: "title", text: s.title });
    s.doThis.forEach((t) => out.push({ field: "doThis", text: t }));
    if (s.say) out.push({ field: "say", text: s.say });
    (s.keyIdeas ?? []).forEach((t) => out.push({ field: "keyIdeas", text: t }));
    if (s.checkFor) { out.push({ field: "ask", text: s.checkFor.ask }); if (s.checkFor.lookFor) out.push({ field: "lookFor", text: s.checkFor.lookFor }); }
    (s.keywords ?? []).forEach((k) => { out.push({ field: "kwTerm", text: k.term }); if (k.meaning) out.push({ field: "kwMeaning", text: k.meaning }); });
    (s.examples ?? []).forEach((t) => out.push({ field: "examples", text: t }));
    s.recap.forEach((t) => out.push({ field: "recap", text: t }));
  });
  plan.commonMistakes.forEach((m) => { out.push({ field: "mistake", text: m.mistake }); if (m.fix) out.push({ field: "fix", text: m.fix }); });
  plan.watchOut.forEach((t) => out.push({ field: "watchOut", text: t }));
  return out;
}

/** Problems with a plan ([] = valid). `curated` plans (written by hand) get the shape, chatter and number checks; DERIVED plans must also be
 *  traceable: every fact verbatim from the lesson's data and every other word one of the fixed templates. */
export function validatePlan(plan: LessonPlan | null | undefined, src: PlanSource, mode: "derived" | "curated"): string[] {
  const p: string[] = [];
  if (!plan || !Array.isArray(plan.steps)) return ["no plan"];
  const st = plan.steps;
  if (st.length < 3 || st.length > 9) p.push(`${st.length} steps (want 3-9)`);
  if (st[0]?.kind !== "warmup") p.push("first step is not the warm-up");
  if (st[st.length - 1]?.kind !== "plenary") p.push("last step is not the plenary");
  if (!st.some((s) => s.kind === "teach")) p.push("no teaching step");
  if (!st.some((s) => s.kind === "independent")) p.push("no independent-practice step");
  const rank = { warmup: 0, teach: 1, guided: 2, independent: 3, plenary: 4 } as const;
  for (let i = 1; i < st.length; i++) if (rank[st[i].kind] < rank[st[i - 1].kind]) p.push(`step ${i + 1} (${st[i].kind}) is out of order`);
  for (const [i, s] of st.entries()) {
    if (!s.title) p.push(`step ${i + 1} has no title`);
    if (!s.doThis.length || s.doThis.length > 4) p.push(`step ${i + 1}: ${s.doThis.length} doThis sentences (want 1-4)`);
    if (!s.recap.length) p.push(`step ${i + 1}: no student recap`);
    if (s.doThis.some((d) => d.length > 280)) p.push(`step ${i + 1}: a doThis sentence is over 280 chars`);
  }
  if (JSON.stringify(plan).length > 30_000) p.push("plan larger than 30KB");
  if (p.length) return p;

  // sets of source text
  const facts = new Set<string>();
  const add = (s: string) => { if (nz(s)) facts.add(nk(s)); };
  add(src.outcome); src.points.forEach(add); src.outline.forEach(add); src.tips.forEach(add);
  src.keywords.forEach((k) => { add(k.k); add(k.d); add(`${k.k}: ${k.d}`); });
  src.mis.forEach((m) => { add(m.misconception); add(m.response); });
  const clean = new Set<string>([nk(src.outcome), ...src.points.map(nk), ...src.outline.map(nk), ...src.keywords.flatMap((k) => [nk(k.k), nk(k.d), nk(`${k.k}: ${k.d}`)])]); // pupil-facing Oak text: exempt from the chatter scan (English lessons name Mr Darcy...)
  const blob = nk(src.blob);
  const pool = new Set(src.transcript.map((x) => nk(x).replace(/[.]$/, "")));

  for (const { field, text } of fields(plan)) {
    const t = nk(text);
    // numbers must come from the lesson
    for (const n of text.match(/\d+(?:[.,]\d+)*/g) ?? []) if (!blob.includes(n.toLowerCase())) p.push(`${field}: number ${n} is not in the lesson data ("${text.slice(0, 50)}")`);
    // the chatter scan skips pupil-facing Oak text (whole field, or a “quoted” span of it that is one)
    const scan = text.replace(/“([^”]*)”/g, (m, inner: string) => (clean.has(nk(inner)) ? "“”" : m));
    if (!clean.has(t) && CHATTER.test(scan)) {
      // hand-written text must be chatter-free; derived tips/mistakes were filtered already so any hit here is a bug
      p.push(`${field}: teacher chatter / Oak-resource reference in "${text.slice(0, 60)}"`);
    }
    if (mode !== "derived") continue;
    // traceability of a derived plan
    const factField = ["keyIdeas", "say", "kwMeaning", "kwTerm", "mistake", "fix", "watchOut"].includes(field);
    if (factField) { if (!facts.has(t)) p.push(`${field}: not verbatim from the lesson data: "${text.slice(0, 70)}"`); continue; }
    if (field === "examples") { if (!pool.has(t.replace(/[.]$/, ""))) p.push(`example not in the transcript: "${text}"`); if (!trueArithmetic(text)) p.push(`example is not pure, true arithmetic: "${text}"`); continue; }
    if (field === "lookFor") {
      // one definition, or key learning points joined by spaces
      let rest = t; for (const f of [...facts].sort((a, b) => b.length - a.length)) if (rest.includes(f)) rest = rest.split(f).join(" ");
      if (rest.trim() !== "") p.push(`lookFor: contains words that are not lesson facts: "${text.slice(0, 70)}"`);
      continue;
    }
    if (field === "recap" && facts.has(t)) continue;
    // template fields: source quotes → §, then the skeleton must be a known template
    let ok = true;
    let sk = text.replace(/“([^”]*)”/g, (_m, inner: string) => { if (facts.has(nk(inner)) || (inner.endsWith("…") && [...facts].some((f) => f.startsWith(nk(inner.slice(0, -1)))))) return "“§”"; ok = false; return "“?”"; });
    sk = sk.replace(/“§”(?:, “§”)*(?: and “§”)?/g, "“§”");
    if (field === "title") {
      // Q5: a teaching step may also be titled with a verbatim piece of a pupil-facing fact (the key word or the subject of a key idea)
      const piece = /\p{L}{4,}/u.test(t) && [...clean].some((f) => f.includes(t));
      if (!SKELETONS.has(sk) && !KEY_IDEA_N.test(sk) && !facts.has(t) && !piece && !(text.endsWith("…") && [...facts].some((f) => f.startsWith(nk(text.slice(0, -1)))))) p.push(`title not a template or outline heading: "${text}"`);
      continue;
    }
    if (!ok || !SKELETONS.has(sk)) p.push(`${field}: not a known template: "${text.slice(0, 80)}"`);
  }
  return p;
}

// ── from a raw crawler lesson ────────────────────────────────────────────────
type Cm = (s: string) => string;
/** Oak's teacher tips / misconceptions carry markdown bold ("**only**"): the plan shows plain text (Q2). */
const unbold = (x: string) => x.replace(/\*\*/g, "");
export function planFactsFromRaw(o: Record<string, unknown>, cm: Cm): PlanFacts {
  const arr = <T>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);
  const t = (v: unknown) => tidy(cm(String(v ?? ""))).trim();
  // the same cleaned facts as the deck generator (quality.ts), so deck and plan never disagree
  return {
    outcome: t(o.pupilLessonOutcome),
    points: cleanPoints(arr<{ keyLearningPoint?: string }>(o.keyLearningPoints).map((x) => t(x.keyLearningPoint)).filter(Boolean)),
    keywords: cleanKeywords(arr<{ keyword?: string; description?: string }>(o.lessonKeywords).map((x) => ({ k: t(x.keyword), d: t(x.description) })).filter((x) => x.k)),
    outline: cleanOutline(arr<{ lessonOutline?: string }>(o.lessonOutline).map((x) => t(x.lessonOutline)).filter(Boolean)),
    tips: arr<{ teacherTip?: string }>(o.teacherTips).map((x) => unbold(t(x.teacherTip))).filter(Boolean),
    mis: arr<{ misconception?: string; response?: string }>(o.misconceptionsAndCommonMistakes).map((x) => ({ misconception: unbold(t(x.misconception)), response: unbold(t(x.response)) })).filter((x) => x.misconception),
    transcript: arr<unknown>(o.transcriptSentences).map(t).filter(Boolean),
    subject: String(o.subjectTitle ?? ""),
  };
}
/** Facts plus the pool of ALL text Oak published for the lesson (quizzes, transcript, ...; plus `extraText`, e.g. its slide text). */
export function planSourceFromRaw(o: Record<string, unknown>, cm: Cm, extraText = ""): PlanSource {
  const bits: string[] = [];
  const walk = (v: unknown, key = "") => {
    if (typeof v === "string") { if (!/url|slug|uid/i.test(key)) bits.push(v); }
    else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(o);
  return { ...planFactsFromRaw(o, cm), blob: cm(`${bits.join("\n")}\n${extraText}`) };
}
