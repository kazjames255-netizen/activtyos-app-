import { FRAMES, getFrame, combineSections, KEY_STAGES, type FrameKind } from "./frames";
import {
  wordCount, sentenceCount, splitSentences, averageSentenceLength, sentenceVariety, repeatedWords, sentenceOpeners, connectivesUsed,
  paragraphCount, readingTime, checklistProgress, wordsToTarget,
} from "./textstats";

let n = 0, bad = 0;
function eq<T>(label: string, got: T, want: T) {
  n++;
  if (JSON.stringify(got) !== JSON.stringify(want)) { bad++; console.error(`FAIL ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
}
function ok(label: string, cond: boolean) { eq(label, cond, true); }
const sent = (len: number, w = "word") => Array(len).fill(w).join(" ") + ".";

// ---- frames
ok("at least 14 frames", FRAMES.length >= 14);
eq("frame ids unique", new Set(FRAMES.map((f) => f.id)).size, FRAMES.length);
const kinds = new Set<FrameKind>(FRAMES.map((f) => f.kind));
for (const k of ["narrative", "profile", "report", "formal-letter", "informal-letter", "diary", "speech", "persuasive", "instructions", "newspaper", "analysis", "essay", "argument", "comparison", "descriptive"] as FrameKind[]) ok(`kind exists: ${k}`, kinds.has(k));
for (const f of FRAMES) {
  ok(`${f.id}: title`, f.title.trim().length > 0);
  ok(`${f.id}: key stages valid`, f.keyStages.length > 0 && f.keyStages.every((k) => KEY_STAGES.includes(k)));
  ok(`${f.id}: has sections`, f.sections.length >= 3 || f.kind === "instructions");
  eq(`${f.id}: section ids unique`, new Set(f.sections.map((x) => x.id)).size, f.sections.length);
  ok(`${f.id}: overall checklist`, f.overallChecklist.length >= 3 && f.overallChecklist.every((c) => c.trim().length > 0));
  for (const sec of f.sections) {
    ok(`${f.id}/${sec.id}: heading+prompt`, sec.heading.trim().length > 0 && sec.prompt.trim().length > 0);
    ok(`${f.id}/${sec.id}: >=3 starters`, sec.starters.length >= 3);
    ok(`${f.id}/${sec.id}: starters non-empty`, sec.starters.every((x) => x.trim().length > 0));
    eq(`${f.id}/${sec.id}: starters unique`, new Set(sec.starters.map((x) => x.trim().toLowerCase())).size, sec.starters.length);
    ok(`${f.id}/${sec.id}: minWords sane`, sec.minWords === undefined || (Number.isInteger(sec.minWords) && sec.minWords > 0));
  }
}
eq("story mountain sections", getFrame("story-mountain")!.sections.map((x) => x.id), ["opening", "buildup", "problem", "climax", "resolution", "ending"]);
eq("story mountain KS", getFrame("story-mountain")!.keyStages, [1, 2, 3]);
ok("PEE/PETAL/WHW exist", !!getFrame("pee") && !!getFrame("petal") && !!getFrame("what-how-why"));
eq("PETAL has 5 parts", getFrame("petal")!.sections.length, 5);
ok("analysis bank has suggests, implies, connotes", ["suggests", "implies", "connotes"].every((w) => getFrame("pee")!.banks![0]!.words.includes(w)));
ok("persuasive bank has AFOREST", getFrame("persuasive")!.banks![0]!.words.includes("Alliteration") && getFrame("persuasive")!.banks![0]!.words.length === 7);
eq("argument planner parts", getFrame("argument-16")!.sections.map((x) => x.id), ["intro", "for", "against", "judgement"]);
eq("essay planner has thesis first", getFrame("essay-planner")!.sections[0]!.id, "thesis");
eq("newspaper lead checklist has 5Ws", getFrame("newspaper-report")!.sections[1]!.checklist, ["Who", "What", "When", "Where", "Why"]);
eq("getFrame unknown", getFrame("nope"), undefined);
eq("getFrame non-string", getFrame(3), undefined);
eq("combineSections skips empty", combineSections(getFrame("pee")!, { point: " A. ", explain: "C." }), "A.\n\nC.");
eq("combineSections headings", combineSections(getFrame("what-how-why")!, { what: "W" }, true), "What\nW");

// ---- word counts
eq("plain words", wordCount("The cat sat."), 3);
eq("hyphenated is one word", wordCount("A well-known, mother-in-law."), 3);
eq("apostrophe is one word", wordCount("Don't stop, it's Sam's."), 4);
eq("curly apostrophe", wordCount("don’t stop"), 2);
eq("empty", wordCount(""), 0);
eq("whitespace only", wordCount("  \n\t "), 0);
eq("digits count", wordCount("I ate 3 apples"), 4);
eq("dash with spaces is not a word", wordCount("wait - what"), 2);
eq("punctuation only", wordCount("... !!"), 0);

// ---- sentences
eq("Mr. abbreviation", splitSentences("Mr. Smith went home. He slept."), ["Mr. Smith went home.", "He slept."]);
eq("e.g. abbreviation", sentenceCount("Eat fruit, e.g. apples, daily. Good."), 2);
eq("ellipsis then lowercase continues", splitSentences("Wait... what happened? Nobody knew."), ["Wait... what happened?", "Nobody knew."]);
eq("ellipsis then capital splits", sentenceCount("He paused... Then he ran."), 2);
eq("quoted speech continues", splitSentences("\"Stop!\" he said. Then he ran."), ["\"Stop!\" he said.", "Then he ran."]);
eq("decimal not a split", sentenceCount("Pi is 3.14 today."), 1);
eq("no final punctuation", sentenceCount("No punctuation here"), 1);
eq("empty text", sentenceCount(""), 0);
eq("!? split", sentenceCount("Hello! How are you? Fine."), 3);
eq("Dr. Who?", sentenceCount("Dr. Who? Yes."), 2);
eq("blank line ends heading", splitSentences("My Title\n\nBody text here."), ["My Title", "Body text here."]);
eq("child forgets capital", sentenceCount("I ran home. then I ate. it was fun."), 3);
eq("average length", averageSentenceLength("One two three. Four five six seven."), 3.5);
eq("average length empty", averageSentenceLength(""), 0);

// ---- variety
const mixed = [3, 18, 4, 10].map((l) => sent(l)).join(" ");
eq("mixed lengths -> no tips", sentenceVariety(mixed).tips, []);
eq("mixed lengths recorded", sentenceVariety(mixed).lengths, [3, 18, 4, 10]);
const same = Array(4).fill(sent(8)).join(" ");
const sv = sentenceVariety(same);
ok("uniform 8s: short-sentence tip", sv.tips.some((t) => t.includes("short sentence for impact")));
ok("uniform 8s: longer-sentence tip", sv.tips.some((t) => t.includes("longer sentence")));
eq("short-only text asks for a longer one", sentenceVariety([3, 4, 3, 5].map((l) => sent(l)).join(" ")).tips.length, 1);
ok("very long sentence flagged", sentenceVariety([3, 40, 4, 9].map((l) => sent(l)).join(" ")).tips.some((t) => t.includes("very long")));
eq("too few sentences -> no tips", sentenceVariety(sent(8) + " " + sent(9)).tips, []);
eq("histogram", sentenceVariety([3, 8, 12, 18, 25].map((l) => sent(l)).join(" ")).histogram.map((h) => h.count), [1, 1, 1, 1, 1]);
eq("histogram boundary 5/6", sentenceVariety(sent(5) + " " + sent(6)).histogram.map((h) => h.count), [1, 1, 0, 0, 0]);

// ---- repeated words
eq("repeated word", repeatedWords("The dragon saw a dragon. The dragon roared and the knight ran from the dragon."), [{ word: "dragon", count: 4 }]);
eq("stop words ignored", repeatedWords("the the the the and and and and").length, 0);
eq("case-insensitive", repeatedWords("Big big BIG day"), [{ word: "big", count: 3 }]);
eq("minCount 2", repeatedWords("red car, red bus, blue bus", 2), [{ word: "bus", count: 2 }, { word: "red", count: 2 }]);
eq("numbers ignored", repeatedWords("100 100 100 100").length, 0);

// ---- openers
const run = sentenceOpeners("The cat ran. The dog ran. The bird flew. A fish swam.");
eq("opener count", run.openers, [{ word: "the", count: 3 }]);
eq("opener run", run.maxRun, 3);
ok("run tip", run.tip!.startsWith("3 sentences in a row"));
const spread = sentenceOpeners("The cat ran. A dog ran. The bird flew. A fish swam. The end came.");
eq("spread run", spread.maxRun, 1);
ok("spread tip names word", spread.tip!.includes('"the"'));
eq("varied openers", sentenceOpeners("Cats run. Dogs bark. Birds sing.").tip, null);
eq("openers empty", sentenceOpeners("").maxRun, 0);

// ---- connectives
eq("connectives found", connectivesUsed("I like it because it is fun, but however it is hard. On the other hand, it is cheap."),
  [{ word: "on the other hand", count: 1 }, { word: "because", count: 1 }, { word: "however", count: 1 }, { word: "but", count: 1 }]);
eq("no partial-word match", connectivesUsed("butter and thereforeness"), []);
eq("connective counts", connectivesUsed("Although tired, although late, he went.").map((c) => c.count), [2]);

// ---- paragraphs, reading time, progress, targets
eq("paragraph count", paragraphCount("a b\n\nc d\n\n\ne"), 3);
eq("single newline same paragraph", paragraphCount("one\ntwo"), 1);
eq("no paragraphs", paragraphCount("  "), 0);
eq("reading 400 words", readingTime(Array(400).fill("w").join(" ")), { minutes: 2, label: "about 2 min" });
eq("reading 100 words", readingTime(Array(100).fill("w").join(" ")).label, "under a minute");
eq("reading none", readingTime("").label, "nothing yet");
eq("checklist progress", checklistProgress(["a", "b", "c", "d"], ["a", "c", "zzz"]), { done: 2, total: 4, fraction: 0.5, percent: 50 });
eq("checklist empty", checklistProgress([], ["a"]).percent, 0);
eq("target below", wordsToTarget("one two three", 10, 20), { words: 3, status: "below", toMin: 7, over: 0, message: "3 words: about 7 more to reach 10" });
eq("target in range", wordsToTarget("one two three", 2, 5).status, "inRange");
eq("target above", wordsToTarget("one two three", 1, 2).over, 1);
eq("target none", wordsToTarget("one").message, "1 word");

console.log(`${n - bad}/${n} checks passed`);
if (n < 45) { console.error("fewer than 45 checks"); process.exit(1); }
if (bad) process.exit(1);
