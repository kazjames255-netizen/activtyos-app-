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
];

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
    mk("mean", "meaning", `What does “${v.word}” mean?`, v.def, pickN(others, 3, `m${v.word}`).map((o) => o.def), `“${v.word}” means: ${v.def}.`),
    mk("syn", "synonym", `Which word is closest in meaning to “${v.word}”?`, v.syn, pickN(others, 3, `s${v.word}`).map((o) => o.syn), `“${v.syn}” is a synonym of “${v.word}” — both mean ${v.def}.`),
    mk("ant", "antonym", `Which word means the OPPOSITE of “${v.word}”?`, v.ant, pickN(others, 3, `a${v.word}`).map((o) => o.syn), `“${v.ant}” is an antonym (opposite) of “${v.word}”.`),
    mk("ctx", "context", `Which word best fits the blank?\n“${v.sentence}”`, v.word, pickN(others, 3, `c${v.word}`).map((o) => o.word), `“${v.word}” (${v.def}) fits: “${v.sentence.replace("___", v.word)}”`),
  ];
});
