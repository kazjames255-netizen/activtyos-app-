import { shuffleOptionIds, type QuizItem } from "../quiz/core";
import { WORDPOP_EXTRA } from "./content.extra";

// WORD POP — fast spelling / homophones / common exception words. The item SHAPE is identical to the other
// quiz-quest games (a seeded multiple-choice bank), but the mechanic is genuinely different: quick-fire, timed,
// arcade-paced (docs/games-prototypes/BACKEND-PATTERN.md step 1 — "reuse vs fork" applied honestly, see
// features/learninghub/games/wordpop/core.ts's file header for why only the TIMING/SCORING layer is forked while
// everything else — item shape, Leitner state, profile bookkeeping — is reused from features/learninghub/games/quiz/core.ts).
interface SpellItem { key: string; topic: string; difficulty: 1 | 2 | 3; sentence: string; correct: string; wrongs: string[]; explanation: string } // sentence has a ___ blank
const RAW: SpellItem[] = [
  { key: "sp_h1", topic: "homophone", difficulty: 1, sentence: "___ going to the park after lunch.", correct: "They're", wrongs: ["Their", "There"], explanation: "“They're” is short for ‘they are’ — the apostrophe replaces the missing letters." },
  { key: "sp_h2", topic: "homophone", difficulty: 1, sentence: "Put the books back on ___ shelf.", correct: "their", wrongs: ["there", "they're"], explanation: "“their” shows possession — the shelf belongs to them." },
  { key: "sp_h3", topic: "homophone", difficulty: 1, sentence: "Put the box over ___, by the door.", correct: "there", wrongs: ["their", "they're"], explanation: "“there” refers to a place." },
  { key: "sp_h4", topic: "homophone", difficulty: 1, sentence: "Can we go ___ the shop before it shuts?", correct: "to", wrongs: ["too", "two"], explanation: "“to” shows direction or movement towards something." },
  { key: "sp_h5", topic: "homophone", difficulty: 1, sentence: "I would like some cake ___.", correct: "too", wrongs: ["to", "two"], explanation: "“too” means ‘as well’ or ‘also’." },
  { key: "sp_h6", topic: "homophone", difficulty: 1, sentence: "She has ___ pet rabbits.", correct: "two", wrongs: ["to", "too"], explanation: "“two” is the number 2." },
  { key: "sp_h7", topic: "homophone", difficulty: 1, sentence: "The knight rode a white ___.", correct: "horse", wrongs: ["hoarse", "hourse"], explanation: "“horse” is the animal. “hoarse” describes a rough, croaky voice." },
  { key: "sp_h8", topic: "homophone", difficulty: 2, sentence: "After shouting all day, his voice was ___.", correct: "hoarse", wrongs: ["horse", "horce"], explanation: "“hoarse” describes a rough voice, often from shouting or a cold." },
  { key: "sp_h9", topic: "homophone", difficulty: 3, sentence: "The weather had a big ___ on the harvest.", correct: "effect", wrongs: ["affect", "efect"], explanation: "“effect” is usually the noun — the result of something." },
  { key: "sp_h10", topic: "homophone", difficulty: 3, sentence: "Cold weather can badly ___ crops.", correct: "affect", wrongs: ["effect", "afect"], explanation: "“affect” is usually the verb — to influence something." },
  { key: "sp_h11", topic: "homophone", difficulty: 3, sentence: "The teacher gave us some helpful ___.", correct: "advice", wrongs: ["advise", "advize"], explanation: "“advice” is the noun (a suggestion given)." },
  { key: "sp_h12", topic: "homophone", difficulty: 3, sentence: "Could you ___ me on which subject to choose?", correct: "advise", wrongs: ["advice", "advize"], explanation: "“advise” is the verb (to give a suggestion)." },
  { key: "sp_h13", topic: "homophone", difficulty: 1, sentence: "The ___ blew the leaves across the yard.", correct: "wind", wrongs: ["whined", "wined"], explanation: "“wind” is the moving air." },
  { key: "sp_h14", topic: "homophone", difficulty: 1, sentence: "We ___ our bikes to school every day.", correct: "ride", wrongs: ["wride", "right"], explanation: "“ride” means to travel on something like a bike or horse." },
  { key: "sp_e1", topic: "exception", difficulty: 1, sentence: "It was a beautiful, ___ afternoon.", correct: "peaceful", wrongs: ["peacefull", "peacful"], explanation: "“peaceful” — the ‘-ful’ suffix has only ONE l, even though ‘full’ has two." },
  { key: "sp_e2", topic: "exception", difficulty: 2, sentence: "She felt ___ about the results.", correct: "anxious", wrongs: ["ankshus", "anxous"], explanation: "“anxious” — a tricky exception word: -xious, not -xous." },
  { key: "sp_e3", topic: "exception", difficulty: 1, sentence: "That is a very ___ idea.", correct: "interesting", wrongs: ["intresting", "interestin"], explanation: "“interesting” keeps all three vowels: inter-est-ing." },
  { key: "sp_e4", topic: "exception", difficulty: 2, sentence: "The bridge was built by talented ___.", correct: "engineers", wrongs: ["enginears", "engeneers"], explanation: "“engineers” — remember the ‘gin’ in the middle, like the word ‘engine’." },
  { key: "sp_e5", topic: "exception", difficulty: 2, sentence: "We must all try to be ___.", correct: "sensible", wrongs: ["sensable", "sencible"], explanation: "“sensible” ends in -ible, not -able." },
  { key: "sp_e6", topic: "exception", difficulty: 3, sentence: "The results were completely ___.", correct: "unnecessary", wrongs: ["unnecesary", "unecessary"], explanation: "“unnecessary”: double n, one c, double s — a famously tricky word." },
  { key: "sp_e7", topic: "exception", difficulty: 3, sentence: "It is a matter of great ___.", correct: "controversy", wrongs: ["contraversy", "controvercy"], explanation: "“controversy” — remember the ‘o’ in the middle: contr-o-versy." },
  { key: "sp_e8", topic: "exception", difficulty: 3, sentence: "The channel announced a new ___.", correct: "programme", wrongs: ["program", "programm"], explanation: "In British English, a TV or school ‘programme’ is spelt with -mme." },
  { key: "sp_e9", topic: "exception", difficulty: 3, sentence: "She showed great ___ under pressure.", correct: "perseverance", wrongs: ["perseverence", "persevereance"], explanation: "“perseverance” ends -ance, and keeps ‘sever’ in the middle, like ‘persevere’." },
  { key: "sp_e10", topic: "exception", difficulty: 3, sentence: "The museum's ___ collection amazed visitors.", correct: "extraordinary", wrongs: ["extrordinary", "extraordinery"], explanation: "“extraordinary” is ‘extra’ + ‘ordinary’ joined together." },
  { key: "sp_p1", topic: "pattern", difficulty: 1, sentence: "The fire ___ arrived within minutes.", correct: "station", wrongs: ["stasion", "staition"], explanation: "Most words ending in the ‘shun’ sound after a consonant use -tion: sta-tion." },
  { key: "sp_p2", topic: "pattern", difficulty: 2, sentence: "The two cars were in a ___.", correct: "collision", wrongs: ["collition", "colision"], explanation: "After an -l, the ‘shun’ sound is usually spelt -sion: colli-sion." },
  { key: "sp_p3", topic: "pattern", difficulty: 3, sentence: "He hopes to become a ___ one day.", correct: "musician", wrongs: ["musition", "musicion"], explanation: "Words for a person who does something often end -cian: musi-cian, like magician and electrician." },
  { key: "sp_p4", topic: "pattern", difficulty: 1, sentence: "She was ___ across the finish line first.", correct: "running", wrongs: ["runing", "runnning"], explanation: "A short vowel before a single final consonant doubles it before -ing: run → runn-ing." },
  { key: "sp_p5", topic: "pattern", difficulty: 2, sentence: "The children were ___ in the playground.", correct: "hopping", wrongs: ["hoping", "hopeing"], explanation: "“hopping” (jumping) doubles the p; “hoping” (wishing) does not — the doubled letter keeps the short vowel sound." },
  { key: "sp_p6", topic: "pattern", difficulty: 3, sentence: "It felt like an odd ___ of events.", correct: "sequence", wrongs: ["seqence", "sequense"], explanation: "“sequence” keeps the silent -u- after q, and ends -ence." },
  { key: "sp_p7", topic: "pattern", difficulty: 3, sentence: "The old castle had a hidden ___.", correct: "chamber", wrongs: ["chaimber", "chammber"], explanation: "“chamber” — ch makes a ‘ch’ sound, and the a is short before the m." },
  { key: "sp_p8", topic: "pattern", difficulty: 1, sentence: "The ___ scratched at the door.", correct: "kitten", wrongs: ["kiten", "kittin"], explanation: "“kitten” doubles the t after the short i sound." },
];
const WORDPOP_BASE: QuizItem[] = RAW.map((s) => {
  const { options, correctId } = shuffleOptionIds(s.key, s.correct, s.wrongs);
  return { key: s.key, topics: ["spelling", s.topic], difficulty: s.difficulty, prompt: s.sentence, options, correctId, explanation: s.explanation };
});

/** The original bank plus the extra items (content.extra.ts): 100+ items in all. */
export const WORDPOP_ITEMS: QuizItem[] = [...WORDPOP_BASE, ...WORDPOP_EXTRA];
