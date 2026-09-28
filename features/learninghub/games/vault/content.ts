import { shuffleOptionIds, type QuizItem } from "../quiz/core";

// WORD VAULT — vocabulary building (word meanings, synonyms/antonyms, word-in-context), genuinely curriculum-
// appropriate word lists for upper KS2 through KS3. Same seeded item-bank mechanic as the other quiz-quest games.
interface VocabWord { word: string; difficulty: 1 | 2 | 3; def: string; syn: string; ant: string; sentence: string } // sentence has a ___ blank for `word`
const WORDS: VocabWord[] = [
  { word: "meticulous", difficulty: 2, def: "very careful and paying great attention to detail", syn: "thorough", ant: "careless", sentence: "The jeweller was ___ when repairing the tiny watch." },
  { word: "reluctant", difficulty: 1, def: "unwilling and hesitant", syn: "unwilling", ant: "eager", sentence: "She was ___ to leave the warm house on such a cold morning." },
  { word: "abundant", difficulty: 1, def: "existing in large quantities; plentiful", syn: "plentiful", ant: "scarce", sentence: "Fish were ___ in the river that summer." },
  { word: "cautious", difficulty: 1, def: "careful to avoid danger or mistakes", syn: "wary", ant: "reckless", sentence: "He was ___ as he crossed the icy bridge." },
  { word: "enormous", difficulty: 1, def: "very large in size or amount", syn: "huge", ant: "tiny", sentence: "An ___ wave crashed over the harbour wall." },
  { word: "furious", difficulty: 1, def: "extremely angry", syn: "irate", ant: "calm", sentence: "Dad was ___ when he saw the broken window." },
  { word: "genuine", difficulty: 1, def: "real and authentic, not fake", syn: "authentic", ant: "fake", sentence: "The museum confirmed the painting was ___." },
  { word: "isolated", difficulty: 2, def: "far away from other places; alone", syn: "remote", ant: "connected", sentence: "The cottage stood ___ at the top of the hill." },
  { word: "sufficient", difficulty: 2, def: "enough for a particular purpose", syn: "adequate", ant: "insufficient", sentence: "There was just ___ bread left for breakfast." },
  { word: "vivid", difficulty: 1, def: "producing powerful, clear images in the mind", syn: "graphic", ant: "dull", sentence: "She gave a ___ description of the storm." },
  { word: "ancient", difficulty: 1, def: "very old, from a long time ago", syn: "age-old", ant: "modern", sentence: "The museum displayed ___ pottery from Egypt." },
  { word: "brittle", difficulty: 2, def: "hard but easily broken", syn: "fragile", ant: "flexible", sentence: "The old paper had gone ___ with age." },
  { word: "diminish", difficulty: 2, def: "to become or make smaller or less", syn: "decrease", ant: "increase", sentence: "The noise began to ___ as the train pulled away." },
  { word: "eloquent", difficulty: 3, def: "fluent and persuasive in speaking or writing", syn: "articulate", ant: "inarticulate", sentence: "The candidate gave an ___ speech about climate change." },
  { word: "ambiguous", difficulty: 3, def: "open to more than one interpretation; unclear", syn: "vague", ant: "clear", sentence: "The instructions were so ___ that nobody knew where to meet." },
  { word: "benevolent", difficulty: 3, def: "kind and generous", syn: "kind-hearted", ant: "malicious", sentence: "The ___ landlord lowered the rent during the hard winter." },
  { word: "candid", difficulty: 2, def: "honest and direct, even if unwelcome", syn: "frank", ant: "evasive", sentence: "She gave a ___ answer about why the project had failed." },
  { word: "resilient", difficulty: 2, def: "able to recover quickly from difficulties", syn: "tough", ant: "fragile", sentence: "The community proved ___ after the flood." },
  { word: "skeptical", difficulty: 2, def: "not easily convinced; having doubts", syn: "doubtful", ant: "credulous", sentence: "The scientist remained ___ until she saw the results herself." },
  { word: "tedious", difficulty: 2, def: "long, slow, and boring", syn: "dull", ant: "engaging", sentence: "Filling in the same form twice was a ___ task." },
  { word: "trepidation", difficulty: 3, def: "a feeling of fear or anxiety about something that may happen", syn: "apprehension", ant: "confidence", sentence: "She approached the exam hall with a growing sense of ___." },
  { word: "meander", difficulty: 3, def: "to follow a winding course; to wander without a fixed direction", syn: "wind", ant: "beeline", sentence: "The river began to ___ through the wide valley." },
  { word: "obstinate", difficulty: 3, def: "stubbornly refusing to change one's mind", syn: "stubborn", ant: "flexible", sentence: "The ___ donkey refused to move another step." },
  { word: "plausible", difficulty: 3, def: "seeming reasonable or probable", syn: "believable", ant: "implausible", sentence: "The witness gave a ___ account of what she had seen." },
  { word: "punctual", difficulty: 1, def: "arriving or doing something at the agreed time", syn: "prompt", ant: "late", sentence: "Please be ___ for the school trip: the coach leaves at eight." },
  { word: "essential", difficulty: 1, def: "absolutely necessary", syn: "vital", ant: "unnecessary", sentence: "Water is ___ for all living things." },
  { word: "conceal", difficulty: 2, def: "to hide something so that it cannot be seen or found", syn: "hide", ant: "reveal", sentence: "The spy tried to ___ the letter under a cushion." },
  { word: "chaotic", difficulty: 2, def: "completely disorganised and confused", syn: "disorderly", ant: "orderly", sentence: "The lunch hall was ___ when the fire bell rang unexpectedly." },
  { word: "temporary", difficulty: 1, def: "lasting for only a short time", syn: "short-term", ant: "permanent", sentence: "The ___ bridge will be replaced by a permanent one next year." },
  { word: "abandon", difficulty: 2, def: "to leave something behind completely", syn: "desert", ant: "keep", sentence: "The crew had to ___ the sinking ship." },
  { word: "novice", difficulty: 2, def: "a person who is new to an activity and has little experience", syn: "beginner", ant: "expert", sentence: "As a ___, she still needed help with the controls." },
  { word: "conserve", difficulty: 2, def: "to protect something and use it carefully so that it lasts", syn: "save", ant: "waste", sentence: "We must ___ water during the drought." },
  { word: "pursue", difficulty: 2, def: "to follow or chase in order to catch", syn: "chase", ant: "flee", sentence: "The detective decided to ___ the suspect through the busy market." },
  { word: "monitor", difficulty: 2, def: "to watch and check something carefully over a period of time", syn: "observe", ant: "ignore", sentence: "Nurses ___ each patient\u2019s temperature through the night." },
];

/** Wrong options for one question: unique, and never equal (ignoring case) to the right answer. A shared word (one word's synonym is another word's antonym, e.g. "dull") used to
 *  be able to appear twice in the same question, so a child could tap the identical-looking wrong copy and be marked wrong. */
function distract(pool: string[], correct: string, n: number): string[] {
  const seen = new Set([correct.toLowerCase()]); const out: string[] = [];
  for (const t of pool) { const k = t.toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push(t); if (out.length === n) break; }
  return out;
}

function seeded(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h || 1; }
function pickN<A>(xs: A[], n: number, salt: string): A[] {
  const arr = [...xs]; let h = seeded(salt);
  for (let i = arr.length - 1; i > 0; i--) { h = (h * 1103515245 + 12345) >>> 0; const j = h % (i + 1); [arr[i], arr[j]] = [arr[j]!, arr[i]!]; }
  return arr.slice(0, n);
}

export const VAULT_ITEMS: QuizItem[] = WORDS.flatMap((v, i) => {
  const others = WORDS.filter((o) => o.word !== v.word);
  const mk = (suffix: string, topic: string, prompt: string, correct: string, wrongs: string[], explanation: string): QuizItem => {
    const key = `vb_${suffix}_${i}`;
    const { options, correctId } = shuffleOptionIds(key, correct, wrongs);
    return { key, topics: ["vocabulary", topic], difficulty: v.difficulty, prompt, options, correctId, explanation };
  };
  return [
    mk("mean", "meaning", `What does “${v.word}” mean?`, v.def, distract(pickN(others, others.length, `m${v.word}`).map((o) => o.def), v.def, 3), `“${v.word}” means: ${v.def}.`),
    mk("syn", "synonym", `Which word is closest in meaning to “${v.word}”?`, v.syn, distract(pickN(others, others.length, `s${v.word}`).map((o) => o.syn), v.syn, 3), `“${v.syn}” is a synonym of “${v.word}” — both mean ${v.def}.`),
    mk("ant", "antonym", `Which word means the OPPOSITE of “${v.word}”?`, v.ant, distract(pickN(others, others.length, `a${v.word}`).map((o) => o.syn), v.ant, 3), `“${v.ant}” is an antonym (opposite) of “${v.word}”.`),
    mk("ctx", "context", `Which word best fits the blank?\n“${v.sentence}”`, v.word, distract(pickN(others, others.length, `c${v.word}`).map((o) => o.word), v.word, 3), `“${v.word}” (${v.def}) fits: “${v.sentence.replace("___", v.word)}”`),
  ];
});
