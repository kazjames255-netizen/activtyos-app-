import type { Rng } from "../../../../features/learninghub/tools/engine/rng";
import type { QuizGameSpec, QuizItem } from "../quizArcade";

// Prime Reef — number theory (KS2-KS3 National Curriculum: primes/composites, factors, multiples, divisibility
// rules, prime factorisation). An underwater reef-exploration frame: each correct answer opens the next stretch
// of reef (client-side only; the content and marking here are the real thing).
export const PRIME_REEF_TOPICS = ["primes", "factors", "multiples", "divisibility", "primeFactors"] as const;
export type PrimeReefTopic = (typeof PRIME_REEF_TOPICS)[number];

const PRIMES_TO_100 = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
export function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}
export function factorsOf(n: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= n; i++) if (n % i === 0) out.push(i);
  return out;
}
export function primeFactorise(n: number): number[] {
  const out: number[] = []; let x = n;
  for (let p = 2; p * p <= x; p++) while (x % p === 0) { out.push(p); x /= p; }
  if (x > 1) out.push(x);
  return out;
}
const DIVISIBILITY_RULES: Record<number, string> = {
  2: "its last digit is even", 3: "the sum of its digits divides by 3", 4: "its last two digits divide by 4",
  5: "it ends in 0 or 5", 6: "it divides by both 2 and 3", 8: "its last three digits divide by 8",
  9: "the sum of its digits divides by 9", 10: "it ends in 0", 11: "the alternating sum of its digits divides by 11 (including 0)",
};
export const divides = (n: number, d: number): boolean => n % d === 0;

function shuffledChoices(rng: Rng, correct: string, distractors: string[]): { choices: string[]; correctIndex: number } {
  const pool = [...new Set(distractors)].filter((d) => d !== correct).slice(0, 3);
  for (let n = 1; pool.length < 3; n++) pool.push(`${correct}+${n}`); // defensive, distinct fallback - a generator under-supplying distinct distractors is a bug elsewhere, not something this should mask with a repeated choice
  const choices = rng.shuffle([correct, ...pool]);
  return { choices, correctIndex: choices.indexOf(correct) };
}

function itemPrimes(rng: Rng, difficulty: 1 | 2 | 3, idx: number): QuizItem {
  const hi = difficulty === 1 ? 30 : difficulty === 2 ? 60 : 100;
  const n = rng.int(2, hi);
  const correct = isPrime(n) ? "Prime" : "Composite";
  const choices = rng.shuffle([correct, correct === "Prime" ? "Composite" : "Prime"]);
  const factors = factorsOf(n);
  const explain = isPrime(n) ? `${n} is prime — its only factors are 1 and ${n}.` : `${n} is composite — its factors include ${factors.slice(1, -1).slice(0, 3).join(", ") || factors[1]}, not just 1 and itself.`;
  return { id: `q${idx}`, topic: "primes", prompt: `Is ${n} a prime number or a composite number?`, choices, correctIndex: choices.indexOf(correct), explain };
}
function itemWhichPrime(rng: Rng, difficulty: 1 | 2 | 3, idx: number): QuizItem {
  const hi = difficulty === 1 ? 30 : difficulty === 2 ? 60 : 100;
  const prime = rng.pick(PRIMES_TO_100.filter((p) => p <= hi));
  const composites: number[] = [];
  while (composites.length < 3) { const c = rng.int(4, hi); if (!isPrime(c) && c !== prime && !composites.includes(c)) composites.push(c); }
  const choices = rng.shuffle([String(prime), ...composites.map(String)]);
  return { id: `q${idx}`, topic: "primes", prompt: "Which of these numbers is prime?", choices, correctIndex: choices.indexOf(String(prime)), explain: `${prime} is only divisible by 1 and ${prime}. The others each have a factor between 1 and themselves.` };
}
// A highly composite small n (n=6: factors 1,2,3,6) can have FEWER than 3 non-factor integers inside [2, n-1] -
// {2,3,4,5} has only {4,5} as non-factors of 6, so drawing distractors from that narrow a range alone can never
// find 3 and would loop forever. Search a widening range beyond n instead (still real non-factors of n; a
// distractor doesn't need to be smaller than n), with a bounded guard and a guaranteed-terminating fallback.
function nonFactorsOf(rng: Rng, n: number, facts: readonly number[], count: number): number[] {
  const out = new Set<number>();
  let hi = Math.max(n + 8, 12), guard = 0;
  while (out.size < count && guard++ < 400) { const x = rng.int(2, hi); if (!facts.includes(x)) out.add(x); if (guard % 40 === 0) hi += 10; }
  for (let filler = n + 1; out.size < count; filler++) if (!facts.includes(filler)) out.add(filler); // n+1 is never a factor of n>1
  return [...out].slice(0, count);
}
function itemFactors(rng: Rng, difficulty: 1 | 2 | 3, idx: number): QuizItem {
  const n = difficulty === 1 ? rng.int(6, 24) : difficulty === 2 ? rng.int(20, 48) : rng.int(36, 96);
  const facts = factorsOf(n);
  const correct = rng.pick(facts);
  const notFactors = nonFactorsOf(rng, n, facts, 3);
  const { choices, correctIndex } = shuffledChoices(rng, String(correct), notFactors.map(String));
  return { id: `q${idx}`, topic: "factors", prompt: `Which of these numbers is a factor of ${n}?`, choices, correctIndex, explain: `${n} ÷ ${correct} = ${n / correct}, so ${correct} is a factor of ${n}.` };
}
function itemHowManyFactors(rng: Rng, difficulty: 1 | 2 | 3, idx: number): QuizItem {
  const n = difficulty === 1 ? rng.int(6, 24) : difficulty === 2 ? rng.int(12, 48) : rng.int(24, 96);
  const count = factorsOf(n).length;
  const distractors = [count - 1, count + 1, count + 2].filter((x) => x > 0);
  const { choices, correctIndex } = shuffledChoices(rng, String(count), distractors.map(String));
  return { id: `q${idx}`, topic: "factors", prompt: `How many factors does ${n} have (including 1 and ${n})?`, choices, correctIndex, explain: `The factors of ${n} are ${factorsOf(n).join(", ")} — that's ${count}.` };
}
function itemMultiples(rng: Rng, difficulty: 1 | 2 | 3, idx: number): QuizItem {
  const base = difficulty === 1 ? rng.int(2, 10) : difficulty === 2 ? rng.int(3, 12) : rng.int(6, 15);
  const k = rng.int(3, 9);
  const correct = base * k;
  const distractors = [correct + rng.int(1, base - 1 || 1), correct - rng.int(1, base - 1 || 1), correct + base * (rng.pick([2, -2]))].map((x) => Math.max(1, x));
  const { choices, correctIndex } = shuffledChoices(rng, String(correct), distractors.map(String));
  return { id: `q${idx}`, topic: "multiples", prompt: `Which of these is a multiple of ${base}?`, choices, correctIndex, explain: `${base} × ${k} = ${correct}, so ${correct} is a multiple of ${base}.` };
}
function itemCommonMultiple(rng: Rng, difficulty: 1 | 2 | 3, idx: number): QuizItem {
  const hi = difficulty === 1 ? 6 : 9;
  const a = rng.int(2, hi); let b = rng.int(2, hi);
  while (b === a) b = rng.int(2, hi); // LCM of a number with itself is trivial and starves the distractor pool

  const lcm = (x: number, y: number): number => { const gcd = (p: number, q: number): number => (q === 0 ? p : gcd(q, p % q)); return (x * y) / gcd(x, y); };
  const correct = lcm(a, b);
  const distractors = [a * b, correct + Math.min(a, b), Math.max(a, b)].filter((x) => x !== correct);
  const { choices, correctIndex } = shuffledChoices(rng, String(correct), distractors.map(String));
  return { id: `q${idx}`, topic: "multiples", prompt: `What is the lowest common multiple of ${a} and ${b}?`, choices, correctIndex, explain: `The multiples of ${a} and ${b} first meet at ${correct} — that's their LCM.` };
}
function itemDivisibility(rng: Rng, difficulty: 1 | 2 | 3, idx: number): QuizItem {
  const divisorsPool = difficulty === 1 ? [2, 5, 10] : difficulty === 2 ? [2, 3, 4, 5, 9, 10] : [2, 3, 4, 5, 6, 8, 9, 10, 11];
  const d = rng.pick(divisorsPool);
  const askTrue = rng.next() < 0.5;
  let n = rng.int(20, difficulty === 3 ? 999 : 200);
  if (askTrue) { while (!divides(n, d)) n = rng.int(20, difficulty === 3 ? 999 : 200); }
  else { while (divides(n, d)) n = rng.int(20, difficulty === 3 ? 999 : 200); }
  const correct = divides(n, d) ? "Yes" : "No";
  const choices = rng.shuffle(["Yes", "No"]);
  return { id: `q${idx}`, topic: "divisibility", prompt: `Does ${n} divide exactly by ${d}?`, choices, correctIndex: choices.indexOf(correct), explain: `A number divides exactly by ${d} when ${DIVISIBILITY_RULES[d]}. For ${n}, that check gives "${correct}".` };
}
function itemPrimeFactorise(rng: Rng, difficulty: 1 | 2 | 3, idx: number): QuizItem {
  const n = difficulty === 3 ? rng.pick([36, 48, 60, 72, 84, 90, 100, 120, 144]) : rng.pick([12, 18, 20, 24, 28, 30, 32, 40]);
  const pf = primeFactorise(n);
  const correct = pf.join(" × ");
  const wrong1 = [...pf.slice(0, -1), pf[pf.length - 1]! + 1].join(" × ");
  const wrong2 = factorsOf(n).slice(1, -1).slice(0, pf.length).join(" × ") || `${n / 2} × 2`;
  const wrong3 = [n, 1].join(" × ");
  const { choices, correctIndex } = shuffledChoices(rng, correct, [wrong1, wrong2, wrong3]);
  return { id: `q${idx}`, topic: "primeFactors", prompt: `What is the prime factorisation of ${n}?`, choices, correctIndex, explain: `Breaking ${n} down into primes only gives ${correct}.` };
}

const GENERATORS: ((rng: Rng, difficulty: 1 | 2 | 3, idx: number) => QuizItem)[] = [itemPrimes, itemWhichPrime, itemFactors, itemHowManyFactors, itemMultiples, itemCommonMultiple, itemDivisibility, itemPrimeFactorise];
const BY_TOPIC: Record<PrimeReefTopic, ((rng: Rng, difficulty: 1 | 2 | 3, idx: number) => QuizItem)[]> = {
  primes: [itemPrimes, itemWhichPrime], factors: [itemFactors, itemHowManyFactors], multiples: [itemMultiples, itemCommonMultiple], divisibility: [itemDivisibility], primeFactors: [itemPrimeFactorise],
};

export const primeReefSpec: QuizGameSpec = {
  gameId: "prime-reef", topics: PRIME_REEF_TOPICS, runLength: 8,
  buildPlan(rng, { difficulty, weakTopics }) {
    const items: QuizItem[] = [];
    const weak = weakTopics.filter((t): t is PrimeReefTopic => (PRIME_REEF_TOPICS as readonly string[]).includes(t));
    for (let i = 0; i < 8; i++) {
      // Bias toward weak topics but always cover the domain broadly (never all one topic in a run).
      const useWeak = weak.length && i < 5 && rng.next() < 0.6;
      const pool = useWeak ? BY_TOPIC[rng.pick(weak)]! : GENERATORS;
      let item = rng.pick(pool)(rng, difficulty, i);
      // Avoid literal duplicate prompts within a run.
      let guard = 0;
      while (items.some((x) => x.prompt === item.prompt) && guard++ < 5) item = rng.pick(GENERATORS)(rng, difficulty, i);
      items.push(item);
    }
    return items;
  },
};
